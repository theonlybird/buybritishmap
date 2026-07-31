#!/usr/bin/env node
/**
 * Shopify product harvest — Phase 2 of product-level search.
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
const DELAY_MS = 1500;
const TIMEOUT_MS = 12000;

// ---------------------------------------------------------------------------
// Controlled vocabulary. Maps words seen in a shop's own product data onto the
// tag set already used by the site. Deliberately conservative — anything that
// doesn't match a rule is kept as a raw observed type for manual review rather
// than being guessed at.
// ---------------------------------------------------------------------------
const VOCAB = [
  ['mugs',                 /\b(mug|beaker)/i],
  ['bowls',                /\b(bowl|dish(es)?)\b/i],
  ['plates',               /\b(plate|platter|charger)/i],
  ['tableware',            /\b(tableware|dinner ?set|teapot|jug|cup and saucer|cutlery set)/i],
  ['pottery',              /\b(pottery|ceramic|stoneware|porcelain|earthenware)/i],
  ['flowerpots',           /\b(flower ?pot|planter|garden pot|terracotta pot)/i],
  ['knitwear',             /\b(jumper|sweater|knitwear|cardigan|pullover|knit)\b/i],
  ['cashmere & merino',    /\b(cashmere|merino|lambswool)\b/i],
  ['vests & waistcoats',   /\b(waistcoat|gilet|body ?warmer|vest)\b/i],
  ['coats & jackets',      /\b(coat|jacket|parka|anorak|mac|smock)\b/i],
  ['shirts',               /\b(shirt)\b/i],
  ['suits & trousers',     /\b(suit|trouser|chino|blazer|jacket and trouser)/i],
  ['jeans & denim',        /\b(jean|denim)\b/i],
  ['socks',                /\b(sock|hosiery)\b/i],
  ['hats & caps',          /\b(hat|cap|beanie|beret)\b/i],
  ['scarves & accessories',/\b(scarf|scarves|shawl|glove|mitten|tie|pocket ?square|wrap)\b/i],
  ['bags & leather goods', /\b(bag|satchel|rucksack|backpack|holdall|wallet|purse|luggage)\b/i],
  ['braces & belts',       /\b(brace|belt|suspender)\b/i],
  ['umbrellas',            /\b(umbrella)\b/i],
  ['footwear & boots',     /\b(shoe|boot|slipper|sandal|trainer|sneaker|loafer|brogue)\b/i],
  ['underwear & nightwear',/\b(boxer|underwear|pyjama|nightwear|loungewear|robe|dressing gown|brief)\b/i],
  ['activewear',           /\b(activewear|sportswear|base ?layer|cycling|running|legging)\b/i],
  ['dresses',              /\b(dress(?!ing\b|\s*stud|\s*shirt)(es)?\b|frock|ball ?gown|wedding gown)/i],
  ['womenswear',           /\b(women|ladies|blouse|skirt)\b/i],
  ['childrenswear',        /\b(child(ren)?s?wear|kids ?wear|babygrow|romper|toddler|infant)\b|\bbaby(?! ?(leaf|leaves|potato|carrot|corn|beet|spinach|kale|gem|plum|new))/i],
  ['tweed & woven goods',  /\b(tweed|tartan|blanket|throw|woven|cloth by the metre)\b/i],
  ['workwear & aprons',    /\b(apron|workwear|overall|dungaree|boiler ?suit)\b/i],
  ['jewellery',            /\b(ring|necklace|pendant|earring|bracelet|brooch|jewel)/i],
  ['cufflinks & signets',  /\b(cufflink|signet)/i],
  ['silverware',           /\b(silverware|sterling silver|hallmark)/i],
  ['watches',              /\b(watch|chronometer|timepiece)/i],
  ['cutlery & knives',     /\b(knife|knive|cutlery|blade|cleaver)/i],
  ['drinks & spirits',     /\b(gin|whisky|whiskey|beer|ale|cider|wine|rum|vodka|liqueur)\b/i],
  ['bread & bakery',       /\b(bread|loaf|cake|pastry|bakery|scone)\b/i],
  ['dairy & cheese',       /\b(cheese|butter|milk|yoghurt|cream)\b/i],
  ['beef',                 /\b(beef|brisket|sirloin|ribeye|rib-eye)\b/i],
  ['lamb',                 /\b(lamb|mutton|hogget)\b/i],
  ['pork & bacon',         /\b(pork|bacon|sausage|gammon|ham)\b/i],
  ['poultry',              /\b(chicken|turkey|duck|goose|poultry)\b/i],
  ['game & venison',       /\b(venison|game|pheasant|partridge|rabbit)\b/i],
  ['fruit & veg',          /\b(vegetable|veg box|fruit|potato|apple|salad)\b/i],
];

// Words that appear in product titles as COLOURS, MATERIALS or CARE PRODUCTS
// rather than as the thing being sold. Stripped before matching, because
// "Shoe Cream" is not dairy and "Whiskey Nubuck" is not a spirit.
const NOISE = new RegExp('\\b(' + [
  // colours & finishes
  'cream','whiskey','whisky','wine','burgundy','port','chocolate','coffee','honey',
  'oatmeal','biscuit','caramel','mustard','olive','plum','cherry','peach','oxblood',
  'chestnut','walnut','almond','butterscotch','champagne','sand','stone','ivory',
  'charcoal','navy','tan','natural','black','brown','green','blue','red','grey','gray',
  // leather / material words that collide with food or product tags
  'calf','kid','kidskin','buck','doe','hide','suede','nubuck','shell','cordovan',
  // care products & extras
  'polish','wax','cream cleaner','shoe tree','gift card','gift voucher','sample',
  'swatch','care kit','conditioner','spare','refill','repair'
].join('|') + ')\\b', 'gi');

function mapToVocab(text) {
  const cleaned = String(text || '').replace(NOISE, ' ');
  const hits = new Set();
  for (const [tag, re] of VOCAB) if (re.test(cleaned)) hits.add(tag);
  return [...hits];
}

// Same, but records WHICH string produced each tag so every tag is auditable.
function mapWithEvidence(text) {
  const cleaned = String(text || '').replace(NOISE, ' ');
  const out = [];
  for (const [tag, re] of VOCAB) {
    const m = cleaned.match(re);
    if (m) out.push([tag, String(text).trim().slice(0, 60)]);
  }
  return out;
}

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
        res.on('data', c => { body += c; if (body.length > 6e6) req.destroy(); });
        res.on('end', () => {
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

function origin(website) {
  try { const u = new URL(website); return u.origin; } catch (e) { return null; }
}

async function harvestOne(biz) {
  const base = origin(biz.website);
  if (!base) return { id: biz.id, shopify: false, reason: 'no-website' };

  const seenTypes = new Set();
  const evidence = {};
  const sample = [];
  let count = 0;

  for (let page = 1; page <= 4; page++) {
    const r = await fetchJson(`${base}/products.json?limit=250&page=${page}`);
    if (!r.ok) {
      if (page === 1) return { id: biz.id, shopify: false, reason: r.reason };
      break;
    }
    const products = (r.data && r.data.products) || [];
    if (!products.length) break;
    for (const p of products) {
      count++;
      if (p.product_type) seenTypes.add(String(p.product_type).trim());
      if (sample.length < 8 && p.title) sample.push(String(p.title).slice(0, 70));
      const text = [p.title, p.product_type, (p.tags || []).join(' ')].join(' ');
      mapWithEvidence(text).forEach(([t, ev]) => {
        seenTypes.add('::' + t);
        if (!evidence[t]) evidence[t] = ev;   // first example that produced this tag
      });
    }
    if (products.length < 250) break;
    await sleep(DELAY_MS);
  }

  const mapped = [...seenTypes].filter(t => t.startsWith('::')).map(t => t.slice(2)).sort();
  const rawTypes = [...seenTypes].filter(t => !t.startsWith('::')).sort().slice(0, 40);

  return {
    id: biz.id,
    shopify: true,
    productCount: count,
    tags: mapped,          // controlled vocabulary, safe to merge into the site
    tagEvidence: evidence, // tag -> the product text that triggered it, for audit
    observedTypes: rawTypes, // their own product_type values, for review
    sample,                // a few real titles, as evidence the harvest is genuine
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

  let shopify = 0, failed = 0, done = 0;
  for (const biz of queue) {
    const res = await harvestOne(biz);
    res.checked = new Date().toISOString().slice(0, 10);
    index[biz.id] = res;
    done++;

    if (res.shopify) {
      shopify++;
      console.log(`  OK   ${biz.id.padEnd(28)} ${String(res.productCount).padStart(4)} products -> ${res.tags.join(', ') || '(no vocab match)'}`);
    } else {
      failed++;
      console.log(`  --   ${biz.id.padEnd(28)} ${res.reason}`);
    }

    // save as we go, so an interrupted run loses nothing
    if (done % 10 === 0) fs.writeFileSync(OUT, JSON.stringify(index, null, 1));
    await sleep(DELAY_MS);
  }

  fs.writeFileSync(OUT, JSON.stringify(index, null, 1));
  console.log(`\nDone. Shopify: ${shopify}  |  not available: ${failed}  |  index now ${Object.keys(index).length} entries`);
  console.log(`Written to ${path.relative(ROOT, OUT)}`);
  console.log(`\nNothing has been merged into businesses.json — review the index first,`);
  console.log(`then run scripts/merge-product-tags.js when you're happy with it.`);
}

main().catch(e => { console.error(e); process.exit(1); });
