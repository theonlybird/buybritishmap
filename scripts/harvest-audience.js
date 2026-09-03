#!/usr/bin/env node
/**
 * Who does this business dress? — evidence harvest.
 *
 * A search for "mens jackets" was returning womenswear-only makers, because
 * nothing in the catalogue records who a garment is for. This walks the
 * clothing listings and reads each shop's OWN description of its range:
 *
 *   1. the listing itself   — name, subcategory, description (curated by us)
 *   2. Shopify collections  — /collections.json  (a shop that splits by gender
 *                             says so here, and it is the cleanest signal)
 *   3. Shopify product types— /products.json product_type values
 *   4. product titles + tags— the same feed, free text
 *   5. WooCommerce / Squarespace / sitemap slugs, for the non-Shopify shops
 *
 * Nothing is inferred beyond what those strings say. A shop that never names
 * an audience is recorded as unknown, NOT as unisex — the search treats those
 * two differently and conflating them is how a good maker gets hidden.
 *
 * Output: data/audience-index.json + data/audience-report.md
 *         (businesses.json is written only by scripts/apply-audience.js)
 *
 * Usage:
 *   node scripts/harvest-audience.js
 *   node scripts/harvest-audience.js --only frimble,gushlow-cole
 *   node scripts/harvest-audience.js --limit 20
 *   node scripts/harvest-audience.js --refresh     # re-check ones already done
 */

const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');
const { AUDIENCES, readAudience } = require('./lib/audience-vocab');

const ROOT = path.join(__dirname, '..');
const DATA = path.join(ROOT, 'data', 'businesses.json');
const OUT = path.join(ROOT, 'data', 'audience-index.json');
const REPORT = path.join(ROOT, 'data', 'audience-report.md');

const CONTACT = 'hello@grownandmade.uk';
const UA = `GrownAndMadeBot/1.0 (+https://grownandmade.uk; ${CONTACT})`;
const DELAY_MS = Number(process.env.HARVEST_DELAY_MS || 1200);
const TIMEOUT_MS = Number(process.env.HARVEST_TIMEOUT_MS || 12000);
const MAX_BODY = Number(process.env.HARVEST_MAX_BODY || 40e6);

const argv = process.argv.slice(2);
const arg = name => { const i = argv.indexOf(name); return i === -1 ? null : argv[i + 1]; };
const onlyIds = (arg('--only') || '').split(',').map(s => s.trim()).filter(Boolean);
const limit = Number(arg('--limit') || 0);
const refresh = argv.includes('--refresh');

const sleep = ms => new Promise(r => setTimeout(r, ms));

// --- fetching ---------------------------------------------------------------
function fetchRaw(url, wantJson, redirectsLeft = 3) {
  return new Promise(resolve => {
    let u;
    try { u = new URL(url); } catch (e) { return resolve({ ok: false, reason: 'bad-url' }); }
    const lib = u.protocol === 'http:' ? http : https;
    const req = lib.request(
      { hostname: u.hostname, path: u.pathname + u.search, method: 'GET',
        headers: { 'User-Agent': UA, 'Accept': wantJson ? 'application/json' : '*/*' },
        timeout: TIMEOUT_MS },
      res => {
        if ([301, 302, 303, 307, 308].includes(res.statusCode) && res.headers.location && redirectsLeft > 0) {
          res.resume();
          return resolve(fetchRaw(new URL(res.headers.location, url).toString(), wantJson, redirectsLeft - 1));
        }
        if (res.statusCode !== 200) { res.resume(); return resolve({ ok: false, reason: 'http-' + res.statusCode }); }
        if (wantJson && !String(res.headers['content-type'] || '').includes('json')) {
          res.resume(); return resolve({ ok: false, reason: 'not-json' });
        }
        let body = '', aborted = false;
        res.on('data', c => {
          body += c;
          if (body.length > MAX_BODY && !aborted) { aborted = true; req.destroy(); resolve({ ok: false, reason: 'too-large' }); }
        });
        res.on('end', () => {
          if (aborted) return;
          if (!wantJson) return resolve({ ok: true, body });
          try { resolve({ ok: true, data: JSON.parse(body) }); }
          catch (e) { resolve({ ok: false, reason: 'parse-error' }); }
        });
      });
    req.on('timeout', () => { req.destroy(); resolve({ ok: false, reason: 'timeout' }); });
    req.on('error', e => resolve({ ok: false, reason: 'net-' + (e.code || 'error') }));
    req.end();
  });
}
const fetchJson = u => fetchRaw(u, true);
const fetchText = u => fetchRaw(u, false);

function origin(website) {
  try { return new URL(website).origin; } catch (e) { return null; }
}

// --- evidence ---------------------------------------------------------------
// Three strengths, because they are not equally trustworthy:
//   strong — the shop's own navigation or our own curated listing text
//   medium — the shop's product-type taxonomy
//   weak   — free text: product titles, merchandising tags, URL slugs
// A tag reading "men" on a unisex sock is exactly why weak evidence cannot
// on its own put a womenswear label on a shop, or take one off.
function blank() {
  const ev = {};
  AUDIENCES.forEach(a => { ev[a] = { strong: 0, medium: 0, weak: 0, quotes: [] }; });
  return ev;
}

const WEAKER = { strong: 'medium', medium: 'weak', weak: 'weak' };

function record(ev, text, strength, opts) {
  const found = readAudience(text, opts);
  let hits = 0;
  const add = (who, word, level) => {
    ev[who][level] += 1;
    hits++;
    if (ev[who].quotes.length < 4) ev[who].quotes.push(`${String(text).slice(0, 60)} (${word})`);
  };
  Object.entries(found.explicit).forEach(([who, word]) => add(who, word, strength));
  // An implied garment always lands one rung below where it was found: a
  // "Skirts" collection is good evidence, but it is not the shop saying
  // "women" out loud.
  Object.entries(found.implied).forEach(([who, word]) => add(who, word, WEAKER[strength]));
  return hits > 0;
}

// --- sources ----------------------------------------------------------------
// The single most valuable request in the harvest — a shop's own navigation —
// so it is the one request worth retrying. A first pass at high concurrency
// came back empty for sites that answered perfectly well on their own, and the
// verdicts that fell out of it were wrong in the worst direction: Gushlow &
// Cole, whose site has a Women collection and no men's one at all, was filed as
// childrenswear because only its baby boots survived.
async function shopifyCollections(base, ev, tries = 2) {
  let r = await fetchJson(`${base}/collections.json?limit=250`);
  for (let i = 1; i < tries && (!r.ok || !r.data || !Array.isArray(r.data.collections)); i++) {
    await sleep(2000);
    r = await fetchJson(`${base}/collections.json?limit=250`);
  }
  if (!r.ok || !r.data || !Array.isArray(r.data.collections)) return 0;
  r.data.collections.forEach(c => record(ev, `${c.title || ''} ${c.handle || ''}`, 'strong'));
  return r.data.collections.length;
}

async function shopifyProducts(base, ev) {
  let count = 0;
  const types = new Set();
  for (let page = 1; page <= 3; page++) {
    const r = await fetchJson(`${base}/products.json?limit=250&page=${page}`);
    if (!r.ok || !r.data || !Array.isArray(r.data.products) || !r.data.products.length) break;
    r.data.products.forEach(p => {
      count++;
      if (p.product_type) types.add(p.product_type);
      record(ev, p.title || '', 'weak');
      (p.tags || []).forEach(t => record(ev, t, 'weak', { implied: false }));
    });
    if (r.data.products.length < 250) break;
    await sleep(DELAY_MS);
  }
  types.forEach(t => record(ev, t, 'medium'));
  return count;
}

async function woocommerce(base, ev) {
  const r = await fetchJson(`${base}/wp-json/wc/store/products?per_page=100`);
  if (!r.ok || !Array.isArray(r.data) || !r.data.length) return 0;
  const cats = new Set();
  r.data.forEach(p => {
    record(ev, p.name || '', 'weak');
    (p.categories || []).forEach(c => cats.add(c.name));
  });
  cats.forEach(c => record(ev, c, 'medium'));
  return r.data.length;
}

async function squarespace(base, ev) {
  for (const p of ['/shop', '/store', '/products', '/all']) {
    const r = await fetchJson(`${base}${p}?format=json`);
    if (!r.ok) continue;
    const items = (r.data && r.data.items) || [];
    if (!items.length) continue;
    const cats = new Set();
    items.forEach(i => {
      record(ev, i.title || '', 'weak');
      (i.categories || []).forEach(c => cats.add(c));
      (i.tags || []).forEach(t => record(ev, t, 'weak', { implied: false }));
    });
    cats.forEach(c => record(ev, c, 'medium'));
    return items.length;
  }
  return 0;
}

// URL slugs only — no product pages are fetched. /collections/womens-coats/
// is a navigation fact, so a gendered word in the PATH counts as medium.
async function sitemap(base, ev) {
  const urls = [];
  for (const root of [`${base}/sitemap.xml`, `${base}/sitemap_index.xml`, `${base}/product-sitemap.xml`]) {
    const r = await fetchText(root);
    if (!r.ok) continue;
    const locs = [...r.body.matchAll(/<loc>([^<]+)<\/loc>/gi)].map(m => m[1]);
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
  const productUrls = urls.filter(u => /\/(product|products|shop|store|collections?)\//i.test(u)).slice(0, 500);
  productUrls.forEach(u => {
    const p = decodeURIComponent(u.split('?')[0]).replace(/https?:\/\/[^/]+/, '').replace(/[-_/]+/g, ' ');
    record(ev, p, 'weak');
  });
  return productUrls.length;
}

// --- the call ---------------------------------------------------------------
// Strong evidence, where it exists, is the whole answer. A shop with fifteen
// women's collections and no men's one is a womenswear shop, whatever a few
// unisex sock tags say — that is the FINDRA case, and reading its tags as
// evidence would have put it back in a menswear search.
function decide(ev, itemCount) {
  // One score per audience, not a ladder of tiers. The first version compared
  // audiences at DIFFERENT strengths — Swaine came back "children" because a
  // single "Junior" product type outranked 262 men's and 225 women's products
  // that were only ever going to be weak evidence. Weighting and then comparing
  // like with like is the fix.
  const WEIGHT = { strong: 6, medium: 3, weak: 1 };
  const score = a => Object.keys(WEIGHT).reduce((n, s) => n + WEIGHT[s] * ev[a][s], 0);
  const scores = {};
  AUDIENCES.forEach(a => { scores[a] = score(a); });
  const total = AUDIENCES.reduce((n, a) => n + scores[a], 0);
  const best = Math.max(...AUDIENCES.map(a => scores[a]));

  const anyFirm = AUDIENCES.some(a => ev[a].strong || ev[a].medium);

  // Free text alone has to clear a higher bar before it can exclude anybody:
  // it is where "baker boy cap" and "Baby Blue" live.
  const floor = anyFirm ? 3 : 5;
  if (best < floor || (!anyFirm && itemCount < 8)) {
    return { audience: null, confidence: 'none', basis: 'no audience named clearly enough', scores };
  }

  // A sixth of the evidence. Low enough to keep a men's line in a mostly
  // women's shop, high enough to ignore the handful of unisex socks that a
  // womenswear shop tags for both. Erring low is deliberate: including an
  // audience only ever shows a business to more people, while excluding one
  // hides it.
  const audience = AUDIENCES.filter(a => scores[a] >= floor && scores[a] / total >= 0.15);
  if (!audience.length) {
    return { audience: null, confidence: 'none', basis: 'no audience named clearly enough', scores };
  }
  const confidence = AUDIENCES.some(a => audience.includes(a) && ev[a].strong) ? 'strong'
    : AUDIENCES.some(a => audience.includes(a) && ev[a].medium) ? 'medium' : 'weak';
  return { audience, confidence, basis: confidence === 'strong' ? 'shop navigation or listing text'
    : confidence === 'medium' ? 'product-type taxonomy' : 'product titles and tags', scores };
}

async function harvestOne(biz) {
  const ev = blank();
  // Our own listing text first: it costs nothing and it is curated.
  record(ev, `${biz.name} ${biz.subcategory || ''}`, 'strong');
  record(ev, biz.description || '', 'medium');

  const base = origin(biz.website);
  const out = { id: biz.id, name: biz.name, platform: null, items: 0, checked: new Date().toISOString().slice(0, 10) };
  if (base) {
    let collections = 0, items = 0;
    collections = await shopifyCollections(base, ev);
    await sleep(DELAY_MS);
    items = await shopifyProducts(base, ev);
    if (items) out.platform = 'shopify';
    if (!items) {
      await sleep(DELAY_MS);
      items = await woocommerce(base, ev);
      if (items) out.platform = 'woocommerce';
    }
    if (!items) {
      await sleep(DELAY_MS);
      items = await squarespace(base, ev);
      if (items) out.platform = 'squarespace';
    }
    if (!items) {
      await sleep(DELAY_MS);
      items = await sitemap(base, ev);
      if (items) out.platform = 'sitemap';
    }
    out.items = items;
    out.collections = collections;
  }

  const verdict = decide(ev, out.items);
  return { ...out, evidence: ev, ...verdict };
}

// --- main -------------------------------------------------------------------
(async () => {
  const businesses = JSON.parse(fs.readFileSync(DATA, 'utf8'));
  const index = fs.existsSync(OUT) ? JSON.parse(fs.readFileSync(OUT, 'utf8')) : {};

  // Re-run the verdict over evidence already gathered, with no network at all.
  // The evidence counts are what the crawl is expensive for; the rules on top
  // of them are the part that gets tuned, so they are re-runnable on their own.
  if (argv.includes('--rescore')) {
    let changed = 0;
    Object.values(index).forEach(rec => {
      const before = (rec.audience || []).join('+');
      Object.assign(rec, decide(rec.evidence, rec.items || 0));
      if ((rec.audience || []).join('+') !== before) changed++;
    });
    fs.writeFileSync(OUT, JSON.stringify(index, null, 1));
    console.log(`Rescored ${Object.keys(index).length} businesses — ${changed} verdicts changed.`);
    writeReport(index);
    return;
  }

  let queue = businesses.filter(b => b.category === 'clothing');
  if (onlyIds.length) queue = businesses.filter(b => onlyIds.includes(b.id));
  else if (!refresh) queue = queue.filter(b => !index[b.id]);
  if (limit) queue = queue.slice(0, limit);

  // A pool, not a queue of one. Every worker is on a different domain, so the
  // per-site politeness delay is untouched — it is the wall clock that changes,
  // from half an hour to a few minutes. A single site that hangs can no longer
  // stall the run either: each business gets a hard budget and is recorded as
  // unreachable if it overruns.
  const concurrency = Number(arg('--concurrency') || 5);
  const BUDGET_MS = Number(process.env.HARVEST_BUDGET_MS || 60000);
  console.log(`Reading audience evidence for ${queue.length} businesses (${concurrency} at a time)…`);

  let next = 0, done = 0;
  const withBudget = biz => Promise.race([
    harvestOne(biz),
    sleep(BUDGET_MS).then(() => ({ id: biz.id, name: biz.name, platform: null, items: 0,
      checked: new Date().toISOString().slice(0, 10), evidence: blank(),
      audience: null, confidence: 'none', basis: 'timed out' }))
  ]);

  async function worker() {
    while (next < queue.length) {
      const b = queue[next++];
      let rec;
      try { rec = await withBudget(b); }
      catch (e) {
        rec = { id: b.id, name: b.name, platform: null, items: 0, evidence: blank(),
                audience: null, confidence: 'none', basis: 'error: ' + e.message };
      }
      index[b.id] = rec;
      done++;
      const label = rec.audience ? rec.audience.join('+') : 'unknown';
      console.log(`  [${done}/${queue.length}] ${b.id} — ${label} (${rec.confidence}, ${rec.platform || 'no feed'}, ${rec.items} items)`);
      fs.writeFileSync(OUT, JSON.stringify(index, null, 1));
    }
  }
  await Promise.all(Array.from({ length: concurrency }, worker));

  writeReport(index);
  console.log(`\nWrote ${OUT}\nWrote ${REPORT}`);
})();

function writeReport(index) {
  const rows = Object.values(index);
  const tally = {};
  rows.forEach(r => { const k = r.audience ? r.audience.join('+') : 'unknown'; tally[k] = (tally[k] || 0) + 1; });
  let md = `# Audience harvest\n\nGenerated ${new Date().toISOString().slice(0, 10)} by scripts/harvest-audience.js.\n\n`;
  md += `${rows.length} clothing businesses read.\n\n## Verdicts\n\n`;
  Object.entries(tally).sort((a, b) => b[1] - a[1]).forEach(([k, v]) => { md += `- **${k}** — ${v}\n`; });
  md += `\n## Exclusions asserted\n\nEvery business below will be hidden from a search for an audience it does not serve. These are the rows worth spot-checking.\n\n`;
  rows.filter(r => r.audience && r.audience.length < 3)
      .sort((a, b) => a.id.localeCompare(b.id))
      .forEach(r => {
        const missing = AUDIENCES.filter(a => !r.audience.includes(a));
        const quotes = r.audience.map(a => (r.evidence[a].quotes[0] || '')).filter(Boolean).join('; ');
        md += `- \`${r.id}\` — **${r.audience.join(' + ')}** (${r.confidence}); not ${missing.join('/')}. ${quotes}\n`;
      });
  md += `\n## Unknown — shown in every search, ranked below confirmed matches\n\n`;
  rows.filter(r => !r.audience).sort((a, b) => a.id.localeCompare(b.id))
      .forEach(r => { md += `- \`${r.id}\` — ${r.platform || 'no product feed reached'}, ${r.items} items\n`; });
  fs.writeFileSync(REPORT, md);
}
