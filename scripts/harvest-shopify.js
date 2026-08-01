#!/usr/bin/env node
/**
 * Product harvest — Phase 2 of product-level search.
 *
 * Tries four sources per business, in order of data quality:
 *   1. Shopify   /products.json
 *   2. WooCommerce  /wp-json/wc/store/products
 *   3. Squarespace  /shop?format=json
 *   4. Sitemap   product names read from URL slugs (no page fetches)
 *
 * Shopify stores expose a public, structured product feed at /products.json.
 * This walks every business in data/businesses.json, tries that endpoint, and
 * records the product types it ACTUALLY finds. Nothing is inferred or invented:
 * if a site isn't Shopify or the fetch fails, the business is simply recorded
 * as unharvested.
 *
 * Output: data/product-index.json  (kept separate from businesses.json so a bad
 * run can never corrupt the verified listing data)
 *
 * Usage:
 *   node scripts/harvest-shopify.js              # all businesses
 *   node scripts/harvest-shopify.js --limit 25   # first 25 unharvested
 *   node scripts/harvest-shopify.js --only emma-bridgewater,trakke
 *   node scripts/harvest-shopify.js --refresh    # re-fetch already-harvested
 *
 * Polite by default: 1.5s between requests, identifies itself, gives up
 * quickly, and never hammers a site that has already said no.
 */

const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');

const ROOT = path.join(__dirname, '..');
const DATA = path.join(ROOT, 'data', 'businesses.json');
const OUT = path.join(ROOT, 'data', 'product-index.json');

const CONTACT = 'hello@buybritishmap.uk';
const UA = `BuyBritishMapBot/1.0 (+https://buybritishmap.uk; ${CONTACT})`;
const DELAY_MS = Number(process.env.HARVEST_DELAY_MS || 1500);
// Sites that hang rather than refuse can burn the whole cascade on timeouts
// (Squarespace alone tries four paths). Lower this to get a quick verdict.
const TIMEOUT_MS = Number(process.env.HARVEST_TIMEOUT_MS || 12000);
// Shopify's products.json embeds every variant and image, so a mid-sized shop
// can run to tens of MB. Generous, because this is a one-off batch job.
const MAX_BODY = Number(process.env.HARVEST_MAX_BODY || 40e6);

// ---------------------------------------------------------------------------
// Controlled vocabulary now lives in scripts/lib/product-vocab.js so that this
// harvester and scripts/rescore-product-index.js can never drift apart. It
// carries the category gating and head-noun rules as well as the word lists.
// ---------------------------------------------------------------------------
const { mapWithEvidence, mapToVocab, isTagAllowed, VOCAB_VERSION } = require('./lib/product-vocab');

// ---------------------------------------------------------------------------
function fetchJson(url, redirectsLeft = 3) {
  return new Promise(resolve => {
    let u;
    try { u = new URL(url); } catch (e) { return resolve({ ok: false, reason: 'bad-url' }); }
    const lib = u.protocol === 'http:' ? http : https;
    const req = lib.request(
      {
        hostname: u.hostname,
        path: u.pathname + u.search,
        method: 'GET',
        headers: { 'User-Agent': UA, 'Accept': 'application/json' },
        timeout: TIMEOUT_MS,
      },
      res => {
        if ([301, 302, 303, 307, 308].includes(res.statusCode) && res.headers.location && redirectsLeft > 0) {
          res.resume();
          const next = new URL(res.headers.location, url).toString();
          return resolve(fetchJson(next, redirectsLeft - 1));
        }
        if (res.statusCode !== 200) {
          res.resume();
          return resolve({ ok: false, reason: 'http-' + res.statusCode });
        }
        const ct = String(res.headers['content-type'] || '');
        if (!ct.includes('json')) {
          res.resume();
          return resolve({ ok: false, reason: 'not-json' });
        }
        let body = '';
        let aborted = false;
        res.on('data', c => {
          body += c;
          // Big Shopify catalogues can exceed this. Resolve explicitly rather
          // than just destroying the request: an unresolved promise here hangs
          // the whole harvest forever.
          if (body.length > MAX_BODY && !aborted) {
            aborted = true;
            req.destroy();
            resolve({ ok: false, reason: 'too-large' });
          }
        });
        res.on('end', () => {
          if (aborted) return;
          try { resolve({ ok: true, data: JSON.parse(body) }); }
          catch (e) { resolve({ ok: false, reason: 'parse-error' }); }
        });
      }
    );
    req.on('timeout', () => { req.destroy(); resolve({ ok: false, reason: 'timeout' }); });
    req.on('error', e => resolve({ ok: false, reason: 'net-' + (e.code || 'error') }));
    req.end();
  });
}

const sleep = ms => new Promise(r => setTimeout(r, ms));

// Fetch raw text (sitemaps, HTML). Same politeness as fetchJson.
function fetchText(url, redirectsLeft = 3) {
  return new Promise(resolve => {
    let u;
    try { u = new URL(url); } catch (e) { return resolve({ ok: false, reason: 'bad-url' }); }
    const lib = u.protocol === 'http:' ? http : https;
    const req = lib.request(
      { hostname: u.hostname, path: u.pathname + u.search, method: 'GET',
        headers: { 'User-Agent': UA, 'Accept': '*/*' }, timeout: TIMEOUT_MS },
      res => {
        if ([301,302,303,307,308].includes(res.statusCode) && res.headers.location && redirectsLeft > 0) {
          res.resume();
          return resolve(fetchText(new URL(res.headers.location, url).toString(), redirectsLeft - 1));
        }
        if (res.statusCode !== 200) { res.resume(); return resolve({ ok:false, reason:'http-'+res.statusCode }); }
        let body = '';
        let aborted = false;
        res.on('data', c => {
          body += c;
          // Same hazard as fetchJson: always resolve, never just destroy.
          if (body.length > MAX_BODY && !aborted) {
            aborted = true;
            req.destroy();
            resolve({ ok: true, body });   // a truncated sitemap is still usable
          }
        });
        res.on('end', () => { if (!aborted) resolve({ ok: true, body }); });
      });
    req.on('timeout', () => { req.destroy(); resolve({ ok:false, reason:'timeout' }); });
    req.on('error', e => resolve({ ok:false, reason:'net-'+(e.code||'error') }));
    req.end();
  });
}

// --- WooCommerce Store API (public on modern WooCommerce) -------------------
async function tryWooCommerce(base) {
  const r = await fetchJson(`${base}/wp-json/wc/store/products?per_page=100`);
  if (!r.ok || !Array.isArray(r.data) || !r.data.length) return null;
  return {
    platform: 'woocommerce',
    items: r.data.map(p => ({
      title: p.name || '',
      type: (p.categories || []).map(c => c.name).join(' '),
      tags: ''
    }))
  };
}

// --- Squarespace: any collection URL returns JSON with ?format=json ---------
async function trySquarespace(base) {
  for (const pathTry of ['/shop', '/store', '/products', '/all']) {
    const r = await fetchJson(`${base}${pathTry}?format=json`);
    if (!r.ok) continue;
    const items = (r.data && (r.data.items || [])) || [];
    if (!items.length) continue;
    return {
      platform: 'squarespace',
      items: items.map(i => ({
        title: i.title || '',
        type: (i.categories || []).join(' '),
        tags: (i.tags || []).join(' ')
      }))
    };
  }
  return null;
}

// --- Sitemap fallback: product names live in the URL slug ------------------
// Cheapest possible signal — no product pages are fetched at all.
async function trySitemap(base) {
  const seen = new Set();
  const urls = [];
  const roots = [`${base}/sitemap.xml`, `${base}/sitemap_index.xml`, `${base}/product-sitemap.xml`];
  for (const root of roots) {
    const r = await fetchText(root);
    if (!r.ok) continue;
    const locs = [...r.body.matchAll(/<loc>([^<]+)<\/loc>/gi)].map(m => m[1]);
    // one level of sitemap-index expansion, product sitemaps only
    const nested = locs.filter(l => /\.xml$/i.test(l) && /(product|shop|store|collection)/i.test(l)).slice(0, 3);
    for (const n of nested) {
      await sleep(DELAY_MS);
      const rn = await fetchText(n);
      if (rn.ok) [...rn.body.matchAll(/<loc>([^<]+)<\/loc>/gi)].forEach(m => urls.push(m[1]));
    }
    locs.filter(l => !/\.xml$/i.test(l)).forEach(l => urls.push(l));
    if (urls.length) break;
    await sleep(DELAY_MS);
  }
  const productUrls = urls.filter(u => /\/(product|products|shop|store|collections?)\//i.test(u));
  if (productUrls.length < 3) return null;
  const items = [];
  for (const u of productUrls.slice(0, 400)) {
    const slug = decodeURIComponent(u.split('?')[0].replace(/\/$/, '').split('/').pop() || '');
    const title = slug.replace(/[-_]+/g, ' ').trim();
    if (title && !seen.has(title)) { seen.add(title); items.push({ title, type: '', tags: '' }); }
  }
  return items.length >= 3 ? { platform: 'sitemap', items } : null;
}


function origin(website) {
  try { const u = new URL(website); return u.origin; } catch (e) { return null; }
}

async function harvestOne(biz) {
  const base = origin(biz.website);
  if (!base) return { id: biz.id, shopify: false, platform: null, reason: 'no-website' };

  const seenTypes = new Set();
  const evidence = {};       // tag -> example string
  const tagCounts = {};      // tag -> how many products supported it
  const strongTags = new Set(); // tags seen in the shop's own product_type
  const sample = [];
  let count = 0;
  let platform = null;

  // Record a match. `fromType` means it came from the shop's own taxonomy,
  // which is far more reliable than a free-text title.
  const record = (text, fromType) => {
    for (const r of mapWithEvidence(text)) {
      if (r.suppressed) continue;
      seenTypes.add('::' + r.tag);
      tagCounts[r.tag] = (tagCounts[r.tag] || 0) + 1;
      if (fromType) strongTags.add(r.tag);
      if (!evidence[r.tag]) evidence[r.tag] = r.evidence;
    }
  };

  // 1. Shopify — richest source, try first and paginate.
  for (let page = 1; page <= 4; page++) {
    const r = await fetchJson(`${base}/products.json?limit=250&page=${page}`);
    if (!r.ok) break;
    const products = (r.data && r.data.products) || [];
    if (!products.length) break;
    platform = 'shopify';
    for (const p of products) {
      count++;
      if (p.product_type) {
        seenTypes.add(String(p.product_type).trim());
        record(p.product_type, true);
      }
      if (sample.length < 8 && p.title) sample.push(String(p.title).slice(0, 70));
      record([p.title, (p.tags || []).join(' ')].join(' '), false);
    }
    if (products.length < 250) break;
    await sleep(DELAY_MS);
  }

  // 2. Fall through the other platforms only if Shopify gave nothing.
  if (!platform) {
    let result = null;
    for (const attempt of [tryWooCommerce, trySquarespace, trySitemap]) {
      await sleep(DELAY_MS);
      try { result = await attempt(base); } catch (e) { result = null; }
      if (result) break;
    }
    if (!result) return { id: biz.id, shopify: false, platform: null, reason: 'no-feed-found' };

    platform = result.platform;
    for (const it of result.items) {
      count++;
      if (it.type) {
        seenTypes.add(String(it.type).trim());
        record(it.type, true);
      }
      if (sample.length < 8 && it.title) sample.push(String(it.title).slice(0, 70));
      record([it.title, it.tags].join(' '), false);
    }
  }

  // Category gating: drop anything implausible for this business's category
  // before it is ever written to disk.
  const gated = [];
  const mapped = [...seenTypes]
    .filter(t => t.startsWith('::'))
    .map(t => t.slice(2))
    .filter(t => {
      if (isTagAllowed(t, biz.category)) return true;
      gated.push(t);
      return false;
    })
    .sort();

  const rawTypes = [...seenTypes].filter(t => !t.startsWith('::')).sort().slice(0, 40);

  const confidence = {};
  mapped.forEach(t => { confidence[t] = strongTags.has(t) ? 'strong' : 'weak'; });

  return {
    id: biz.id,
    shopify: platform === 'shopify',
    platform,
    vocabVersion: VOCAB_VERSION,
    productCount: count,
    tags: mapped,
    tagConfidence: confidence,
    tagCounts,
    tagEvidence: evidence,
    gatedOut: gated.sort(),
    observedTypes: rawTypes,
    sample,
  };
}

// ---------------------------------------------------------------------------
async function main() {
  const args = process.argv.slice(2);
  const getArg = n => { const i = args.indexOf(n); return i === -1 ? null : args[i + 1]; };
  const limit = getArg('--limit') ? parseInt(getArg('--limit'), 10) : Infinity;
  const only = getArg('--only') ? getArg('--only').split(',').map(s => s.trim()) : null;
  const refresh = args.includes('--refresh');

  const businesses = JSON.parse(fs.readFileSync(DATA, 'utf8'));
  let index = {};
  if (fs.existsSync(OUT)) index = JSON.parse(fs.readFileSync(OUT, 'utf8'));

  let queue = businesses.filter(b => b.website);
  if (only) queue = queue.filter(b => only.includes(b.id));
  else if (!refresh) queue = queue.filter(b => !index[b.id]);
  queue = queue.slice(0, limit);

  console.log(`Harvesting ${queue.length} businesses (${Object.keys(index).length} already done)\n`);

  // Concurrency is across DIFFERENT domains, so politeness is unaffected: each
  // individual site still sees one request at a time with DELAY_MS between them
  // (enforced inside harvestOne's pagination loop). Default stays 1 so the
  // script behaves exactly as before unless asked otherwise.
  const concurrency = getArg('--concurrency') ? parseInt(getArg('--concurrency'), 10) : 1;

  let shopify = 0, failed = 0, done = 0;
  let cursor = 0;

  const save = () => fs.writeFileSync(OUT, JSON.stringify(index, null, 1));

  // Sites that are slow to fail can outlast the caller's patience. Flush what
  // we have on interrupt so a resumed run doesn't repeat the same dead ends.
  for (const sig of ['SIGTERM', 'SIGINT']) {
    process.on(sig, () => { save(); console.log(`\n[${sig}] saved ${Object.keys(index).length} entries.`); process.exit(0); });
  }

  async function worker() {
    while (cursor < queue.length) {
      const biz = queue[cursor++];
      let res;
      try {
        res = await harvestOne(biz);
      } catch (e) {
        res = { id: biz.id, shopify: false, platform: null, reason: 'error-' + (e.code || e.message || 'unknown') };
      }
      res.checked = new Date().toISOString().slice(0, 10);
      index[biz.id] = res;
      done++;

      if (res.platform) {
        shopify++;
        console.log(`  OK   ${biz.id.padEnd(26)} ${String(res.platform).padEnd(12)} ${String(res.productCount).padStart(4)} items -> ${res.tags.join(', ') || '(no vocab match)'}`);
      } else {
        failed++;
        console.log(`  --   ${biz.id.padEnd(28)} ${res.reason}`);
      }

      // Save often: this script gets interrupted, and a resumed run skips
      // anything already in the index.
      if (done % 5 === 0) save();
      await sleep(DELAY_MS);
    }
  }

  await Promise.all(Array.from({ length: Math.max(1, concurrency) }, worker));

  save();
  console.log(`\nDone. Shopify: ${shopify}  |  not available: ${failed}  |  index now ${Object.keys(index).length} entries`);
  console.log(`Written to ${path.relative(ROOT, OUT)}`);
  console.log(`\nNothing has been merged into businesses.json — review the index first,`);
  console.log(`then run scripts/merge-product-tags.js when you're happy with it.`);
}

main().catch(e => { console.error(e); process.exit(1); });
