#!/usr/bin/env node
/**
 * Merge the harvested product index into businesses.json.
 *
 * The harvest and the rescore both ran, but only a fraction of the result was
 * ever merged into the file search actually reads. Pipers Farm has twelve tags
 * in the index and shipped one; Gazegill has twelve and shipped three. This
 * closes that gap.
 *
 * Rules, in the order they are applied:
 *
 *   1. HAND TAGS ARE NEVER DROPPED. Anything already on the business that the
 *      harvester could not have produced (`fresh meat`, `farm shop & deli`) is
 *      editorial and outranks anything scraped.
 *
 *   2. STRONG TAGS ARE TAKEN AS THEY COME. A strong tag is one the shop itself
 *      filed under that product_type. That is the shop's own claim about its
 *      own goods, which is the best evidence available short of asking them.
 *
 *   3. WEAK TAGS NEED CORROBORATION. A weak tag is inferred from free-text
 *      product titles, and a single title is thin: one "Beef Dripping Candle"
 *      should not make a chandler into a beef farm. The rescore report flagged
 *      this and asked for a count threshold once counts existed. They exist
 *      now, so: at least MIN_WEAK_PRODUCTS distinct products must support it.
 *
 *   4. WEAK TAGS ARE RE-TESTED AGAINST THEIR OWN EVIDENCE. The index was built
 *      under an older noise list, and a weak tag's stored evidence IS the
 *      product title that produced it — so it can simply be re-read under
 *      today's rules. This is what catches "Big Green Egg" being filed as eggs
 *      (it is a barbecue), "Duck Fat Yorkshire Puddings" as poultry, and
 *      "Whipped Tallow Butter" as dairy. All three were live in the index.
 *
 *   5. CATEGORY GATING STILL APPLIES, belt and braces — a Stoke pottery cannot
 *      acquire "fruit & veg" here any more than it could during tagging.
 *
 * Also stamps `products_checked` so a stale tag can be seen to be stale rather
 * than quietly presented as current.
 *
 * SCOPE. By default only food and drink tags are merged. The harvested tags
 * for clothing describe what a shop STOCKS, not what it MAKES — Sub Zero's
 * feed yields "bags & leather goods" off a Lifeventure boot bag, and Budd
 * would gain "dresses" and "umbrellas" it has never made. The map's claim is
 * about making, so those need editorial review before they ship. For a farm
 * shop the distinction does not arise: stocking cheese is exactly what makes
 * it the right answer to "where can I buy cheese".
 *
 * Usage:  node scripts/merge-product-index.js [--dry-run] [--groups food,drink]
 */

const fs = require('fs');
const path = require('path');
const { isTagAllowed, mapToVocab, TAG_GROUP } = require('./lib/product-vocab');

// A weak tag rests on product titles alone. Three independent products saying
// the same thing is the point where it stops being an accident of wording.
const MIN_WEAK_PRODUCTS = 3;

const groupsArg = (process.argv.find(a => a.startsWith('--groups=')) || '').split('=')[1];
const ALLOWED_GROUPS = process.argv.includes('--all-groups')
  ? null
  : new Set((groupsArg || 'food,drink').split(',').map(s => s.trim()));

const root = path.join(__dirname, '..');
const businessesPath = path.join(root, 'data/businesses.json');
// The rescored index is the corrected one: it applied category gating and
// head-noun suppression. Fall back only if it is missing.
const indexPath = fs.existsSync(path.join(root, 'data/product-index.rescored.json'))
  ? path.join(root, 'data/product-index.rescored.json')
  : path.join(root, 'data/product-index.json');

const dryRun = process.argv.includes('--dry-run');

const businesses = JSON.parse(fs.readFileSync(businessesPath, 'utf8'));
const index = JSON.parse(fs.readFileSync(indexPath, 'utf8'));

let added = 0, weakRejected = 0, gated = 0, touched = 0, outOfScope = 0;
const evidenceRejected = [];
const report = [];

// ---------------------------------------------------------------------------
// Prune pass: food and drink tags on businesses that are not farm shops.
//
// These predate category gating and are all misreadings of trade vocabulary:
// "veg tan" leather became fruit & veg (Barnes & Moore, Cherchbi, Everbound),
// "duck cotton" became poultry (Blackhorse Lane, Paul Brown, The Cotton
// London), "game" became game & venison on a jeweller, and a slate cheeseboard
// became dairy & cheese. A shirtmaker tagged poultry is the kind of error that
// costs more trust than it wins searches.
//
// Deliberately narrow. It does NOT prune every tag that fails category gating,
// because CATEGORY_ALLOWS is tight by design and some cross-craft tags are
// true: Anta really does weave tweed as well as throw pots, Thomas Ferguson
// really does weave linen tableware, and David Mellor really does make it.
// Only food and drink on a non-farm business is safe to call wrong outright.
// ---------------------------------------------------------------------------
const FOOD_GROUPS = new Set(['food', 'drink']);
const pruned = [];
for (const biz of businesses) {
  if (biz.category === 'farm') continue;
  const before = biz.product_tags || [];
  const after = before.filter(t => !FOOD_GROUPS.has(TAG_GROUP.get(t)));
  if (after.length !== before.length) {
    pruned.push(`${biz.id} (${biz.category}): -${before.filter(t => !after.includes(t)).join(', ')}`);
    biz.product_tags = after;
  }
}

for (const biz of businesses) {
  const entry = index[biz.id];
  const existing = (biz.product_tags || []).map(t => String(t).toLowerCase());
  const before = new Set(existing);

  if (!entry || !Array.isArray(entry.tags) || !entry.tags.length) continue;

  const confidence = entry.tagConfidence || {};
  const counts = entry.tagCounts || {};
  const accepted = [];

  for (const tag of entry.tags) {
    if (before.has(tag)) continue;

    if (ALLOWED_GROUPS && !ALLOWED_GROUPS.has(TAG_GROUP.get(tag))) { outOfScope++; continue; }

    if (!isTagAllowed(tag, biz.category)) { gated++; continue; }

    if (confidence[tag] === 'weak') {
      if ((counts[tag] || 0) < MIN_WEAK_PRODUCTS) { weakRejected++; continue; }

      // Re-read the product title that produced this tag under today's rules.
      // A weak tag is only ever as good as that sentence, so if the sentence
      // no longer yields the tag, the tag was a misreading.
      const evidence = (entry.tagEvidence || {})[tag];
      if (evidence && !mapToVocab(evidence).includes(tag)) {
        evidenceRejected.push(`${biz.id}: ${tag} <- "${String(evidence).slice(0, 55)}"`);
        continue;
      }
    }

    accepted.push(tag);
  }

  if (!accepted.length) continue;

  // Hand tags first: they are the editorial claim, and order is what the
  // search scorer and the card both read top-down.
  biz.product_tags = [...(biz.product_tags || []), ...accepted];
  if (entry.checked) biz.products_checked = String(entry.checked).slice(0, 10);

  added += accepted.length;
  touched++;
  report.push(`${biz.id} (${biz.category}): +${accepted.length} -> ${biz.product_tags.join(', ')}`);
}

console.log(`source: ${path.basename(indexPath)}`);
console.log(`scope : ${ALLOWED_GROUPS ? [...ALLOWED_GROUPS].join(', ') : 'ALL GROUPS'}`);
console.log(`\nfood/drink tags pruned from non-farm businesses: ${pruned.length}`);
pruned.forEach(p => console.log('    ' + p));
console.log('');
console.log(`businesses updated : ${touched}`);
console.log(`tags added         : ${added}`);
console.log(`weak, uncorroborated (<${MIN_WEAK_PRODUCTS} products): ${weakRejected} rejected`);
console.log(`weak, evidence no longer supports it: ${evidenceRejected.length} rejected`);
evidenceRejected.forEach(r => console.log('    ' + r));
console.log(`category-gated     : ${gated} rejected`);
console.log(`out of scope group : ${outOfScope} skipped`);

const farmTouched = report.filter(r => r.includes('(farm)'));
console.log(`\nfarm shops updated : ${farmTouched.length}`);
farmTouched.slice(0, 10).forEach(r => console.log('  ' + r));

if (dryRun) {
  console.log('\n--dry-run: nothing written.');
} else if (!touched && !pruned.length) {
  console.log('\nnothing to do.');
} else {
  fs.writeFileSync(businessesPath, JSON.stringify(businesses, null, 2) + '\n');
  console.log(`\nwritten: data/businesses.json`);
}
