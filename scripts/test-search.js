#!/usr/bin/env node
/**
 * Regression harness for stage-one retrieval.
 *
 * Runs against the GENERATED api/ai-search.js, not the library, so it tests
 * what actually deploys — including the inlining step, which is where a silent
 * drift between the tagging vocabulary and the search vocabulary would show up.
 *
 * Each case asserts on the shortlist that gets handed to the model. It does not
 * call Gemini: the bug being guarded against was never in the ranking, it was
 * that the right businesses never reached the model in the first place.
 *
 * Usage:  node scripts/test-search.js
 */

const { stageOneFilter, expandQuery, BUSINESS_CATALOG } = require('../api/ai-search.js');

if (typeof stageOneFilter !== 'function') {
  console.error('stageOneFilter not found — did you run scripts/update-search-api.js?');
  process.exit(1);
}

const cases = [
  // --- the reported fault: food terms that no tag label contains ---
  { q: 'sausages',        expectTags: ['pork & bacon'], expectCategory: 'farm', minInCategory: 5 },
  { q: 'british cider',   expectTags: ['drinks & spirits'], expectCategory: 'farm', minInCategory: 3 },
  { q: 'ale',             expectTags: ['drinks & spirits'], expectCategory: 'farm', minInCategory: 3 },
  { q: 'vegetables',      expectTags: ['fruit & veg'], expectCategory: 'farm', minInCategory: 10 },
  { q: 'raw milk',        expectTags: ['dairy & cheese'], expectCategory: 'farm', minInCategory: 5 },
  { q: 'veg box',         expectTags: ['fruit & veg'], expectCategory: 'farm', minInCategory: 5 },

  // --- kitchen-table words that appear in no product feed ---
  { q: 'bangers',         expectTags: ['pork & bacon'], expectCategory: 'farm', minInCategory: 5 },
  { q: 'spuds',           expectTags: ['fruit & veg'], expectCategory: 'farm', minInCategory: 5 },
  { q: 'a joint of beef', expectTags: ['beef'], expectCategory: 'farm', minInCategory: 3 },
  { q: 'sourdough',       expectTags: ['bread & bakery'], expectCategory: 'farm', minInCategory: 2 },
  { q: 'somewhere with a butcher', expectTags: ['pork & bacon'], expectCategory: 'farm', minInCategory: 5 },

  // --- non-food controls: these worked before and must still work ---
  { q: 'knitted vests',   expectTags: ['knitwear', 'vests & waistcoats'], expectCategory: 'clothing', minInCategory: 5 },
  { q: 'kitchen knife',   expectTags: ['cutlery & knives'], expectCategory: 'cutlery', minInCategory: 3 },
  { q: 'pet food bowls',  expectTags: ['bowls'], expectCategory: 'ceramics', minInCategory: 3 },
  { q: 'wellies',         expectTags: ['footwear & boots'], expectCategory: 'clothing', minInCategory: 2 },

  // --- precision: the word-boundary bug and the head-noun rule ---
  { q: 'ale',             mustNotExpandTo: ['bread & bakery'] },
  { q: 'cake tin',        mustNotExpandTo: ['bread & bakery'] },
  { q: 'glasses case',    mustNotExpandTo: ['glasses'] },
];

let failures = 0;
const line = (ok, text) => console.log(`  ${ok ? 'ok  ' : 'FAIL'}  ${text}`);

console.log(`\nstage-one retrieval — ${BUSINESS_CATALOG.length} businesses\n`);

for (const c of cases) {
  const exp = expandQuery(c.q);
  const shortlist = stageOneFilter(c.q, BUSINESS_CATALOG, 40);
  const problems = [];

  for (const t of (c.expectTags || [])) {
    if (!exp.tags.includes(t)) problems.push(`did not expand to "${t}" (got: ${exp.tags.join(', ') || 'nothing'})`);
  }
  for (const t of (c.mustNotExpandTo || [])) {
    if (exp.tags.includes(t)) problems.push(`wrongly expanded to "${t}"`);
  }
  if (c.expectCategory) {
    const n = shortlist.filter(s => s.c === c.expectCategory).length;
    if (n < c.minInCategory) {
      problems.push(`only ${n} ${c.expectCategory} businesses in the shortlist, wanted >= ${c.minInCategory}`);
    }
  }
  if (shortlist.length === 0) problems.push('empty shortlist');

  if (problems.length) {
    failures++;
    line(false, `"${c.q}"`);
    problems.forEach(p => console.log(`          ${p}`));
  } else {
    const top = shortlist.slice(0, 3).map(s => s.i).join(', ');
    line(true, `"${c.q}"`.padEnd(34) + `-> [${exp.tags.join(', ') || '-'}]  ${top}`);
  }
}

// A false "no results" is the failure that started this. Nothing that names a
// product should ever hand the model an all-wrong shortlist.
console.log('');
if (failures) {
  console.log(`${failures} of ${cases.length} cases failed\n`);
  process.exit(1);
}
console.log(`all ${cases.length} cases passed\n`);
