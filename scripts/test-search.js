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

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const { stageOneFilter, expandQuery, BUSINESS_CATALOG } = require('../api/ai-search.js');

// ---------------------------------------------------------------------------
// The page's own local search, lifted out of index.html.
//
// This matters as much as the API: the local engine answers whenever the API
// is slow, rate-limited or down, and both of the bugs found on 13 Aug lived
// here rather than in the serverless function. Extracting the block by marker
// keeps the test honest — it runs the code that ships, not a copy.
// ---------------------------------------------------------------------------
function loadLocalSearch() {
  const root = path.join(__dirname, '..');
  const lines = fs.readFileSync(path.join(root, 'index.html'), 'utf8').split('\n');
  const from = lines.findIndex(l => l.includes('const STOP_WORDS = new Set'));
  const to = lines.findIndex((l, i) => i > from && l.startsWith('async function executeAiSearch'));
  if (from < 0 || to < 0) throw new Error('could not locate the search block in index.html');

  // buildHeadline and its place-casing helpers sit higher up the file.
  const hFrom = lines.findIndex(l => l.includes('const PLACE_MINOR'));
  const hTo = lines.findIndex((l, i) => i > hFrom && l.startsWith('const searchInput'));

  const ctx = {
    console,
    window: {},
    BUSINESSES: JSON.parse(fs.readFileSync(path.join(root, 'data/businesses.json'), 'utf8')),
  };
  vm.createContext(ctx);
  vm.runInContext(fs.readFileSync(path.join(root, 'assets/query-expand.js'), 'utf8'), ctx);
  vm.runInContext(lines.slice(hFrom, hTo).join('\n'), ctx);
  vm.runInContext(lines.slice(from, to).join('\n'), ctx);
  return q => ({
    result: vm.runInContext(`localSearch(${JSON.stringify(q)})`, ctx),
    headline: vm.runInContext(`localHeadlineData(localSearch(${JSON.stringify(q)}))`, ctx),
    banner: vm.runInContext(`buildHeadline(localHeadlineData(localSearch(${JSON.stringify(q)})))`, ctx),
  });
}

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
  // The catalogue never writes "fork" — Sheffield makers write "cutlery" — so
  // the lexicon has to carry it, or fuzzy matching turns it into "pork".
  { q: 'sheffield fork',  expectTags: ['cutlery & knives'], expectCategory: 'cutlery', minInCategory: 3 },
  { q: 'spoons',          expectTags: ['cutlery & knives'], expectCategory: 'cutlery', minInCategory: 2 },
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
// ---------------------------------------------------------------------------
// Judgement words must not change the answer.
//
// Ranking on "sustainable" or "ethical" would mean this map deciding which
// businesses are more sustainable than others, on no evidence. Mechanically it
// was already doing so: the word appears in enough descriptions to score.
// ---------------------------------------------------------------------------
console.log('\njudgement words are ignored — same results as the bare noun\n');

const local = loadLocalSearch();
const ids = list => list.map(b => b.id || b.i).join(',');

const neutrality = [
  { bare: 'jumper', dressed: ['sustainable jumper', 'nice jumper', 'ethical jumper', 'the best quality jumper'] },
  { bare: 'mugs',   dressed: ['eco friendly mugs', 'lovely mugs'] },
  { bare: 'beef',   dressed: ['premium beef'] },
];

for (const { bare, dressed } of neutrality) {
  const apiBase = ids(stageOneFilter(bare, BUSINESS_CATALOG, 40));
  const localBase = ids(local(bare).result.matches);
  for (const q of dressed) {
    const apiSame = ids(stageOneFilter(q, BUSINESS_CATALOG, 40)) === apiBase;
    const localSame = ids(local(q).result.matches) === localBase;
    const echoed = local(q).headline.productTerm || '';
    const clean = !/sustainab|ethic|eco|nice|lovely|best|quality|premium/i.test(echoed);
    const ok = apiSame && localSame && clean;
    if (!ok) failures++;
    line(ok, `"${q}"`.padEnd(34) + `api ${apiSame ? '=' : '≠'}  page ${localSame ? '=' : '≠'}  echoes "${echoed}"`);
  }
}

// "organic" is a certified claim, not an opinion, and must still bite.
{
  const differs = ids(stageOneFilter('organic beef', BUSINESS_CATALOG, 40)) !== ids(stageOneFilter('beef', BUSINESS_CATALOG, 40));
  if (!differs) failures++;
  line(differs, '"organic beef" still differs from "beef" (certified, not subjective)');
}

// ---------------------------------------------------------------------------
// A place must be a place the user typed.
//
// "jumper" widens to include "cardigan"; Cardigan is a town in Ceredigion, so
// the widened word was read as a location the user had asked for. Every
// knitwear search then apologised for being "a bit further afield" than a
// place nobody had mentioned.
// ---------------------------------------------------------------------------
console.log('\nplaces come from the user, not from synonym widening\n');

const placeCases = [
  { q: 'jumper',              expectPlace: null,       expectQuality: 'exact' },
  { q: 'sustainable jumper',  expectPlace: null,       expectQuality: 'exact' },
  { q: 'cardigans',           expectPlace: null,       expectQuality: 'exact' },
  // Typed place names must still work, including when the place shares its
  // name with a garment.
  { q: 'jumper in cardigan',  expectPlace: 'cardigan', expectQuality: 'wider' },
  { q: 'wool jumper cornwall', expectPlace: 'cornwall' },
];

for (const c of placeCases) {
  const h = local(c.q).headline;
  const got = h.locationTerm;
  const problems = [];
  if ((got || null) !== c.expectPlace) problems.push(`locationTerm ${JSON.stringify(got)}, wanted ${JSON.stringify(c.expectPlace)}`);
  if (c.expectQuality && h.matchQuality !== c.expectQuality) problems.push(`matchQuality "${h.matchQuality}", wanted "${c.expectQuality}"`);
  if (problems.length) {
    failures++;
    line(false, `"${c.q}"`);
    problems.forEach(p => console.log(`          ${p}`));
  } else {
    line(true, `"${c.q}"`.padEnd(34) + `place: ${got || 'none'}  (${h.matchQuality})`);
  }
}

// ---------------------------------------------------------------------------
// Qualifiers rank but never admit.
//
// "handmade bowl" used to return Hurdwick Handmade Bag Company, Alex Monroe
// and Drakes. None of them make bowls; they simply have the word in their name
// or copy. The noun decides who is eligible; the qualifier only orders them.
// ---------------------------------------------------------------------------
console.log('\nqualifiers boost, but never make a business eligible\n');

{
  const bowlMakers = new Set(
    BUSINESS_CATALOG.filter(b => (b.pt || []).includes('bowls')).map(b => b.i)
  );
  const apiIntruders = stageOneFilter('handmade bowl', BUSINESS_CATALOG, 40)
    .filter(b => !bowlMakers.has(b.i) && b.c !== 'ceramics');
  const pageIntruders = local('handmade bowl').result.matches
    .filter(b => !bowlMakers.has(b.id) && b.category !== 'ceramics');

  const okApi = apiIntruders.length === 0;
  const okPage = pageIntruders.length === 0;
  if (!okApi) failures++;
  if (!okPage) failures++;
  line(okApi, `"handmade bowl" — api returns no non-bowl makers` +
    (okApi ? '' : ` (got ${apiIntruders.slice(0, 4).map(b => b.i).join(', ')})`));
  line(okPage, `"handmade bowl" — page returns no non-bowl makers` +
    (okPage ? '' : ` (got ${pageIntruders.slice(0, 4).map(b => b.id).join(', ')})`));
}

// The boost must still do its job: organic farms should out-rank non-organic
// ones on an organic query, without changing who is eligible.
{
  const organicFirst = local('organic beef').result.matches
    .slice(0, 3).filter(b => /organic/i.test(b.name + ' ' + b.description)).length >= 2;
  if (!organicFirst) failures++;
  line(organicFirst, '"organic beef" still ranks organic farms into the top 3');

  const same = ids(local('organic beef').result.matches.filter(b => b.category !== 'farm'));
  if (same !== '') failures++;
  line(same === '', '"organic beef" returns farm shops only');
}

// A query made only of qualifiers has no noun to fall back on, and must still
// return something rather than nothing.
{
  const r = local('organic').result.matches;
  const ok = r.length > 0;
  if (!ok) failures++;
  line(ok, `"organic" alone still returns results (${r.length})`);
}

// ---------------------------------------------------------------------------
// A spelling correction must be declared, not applied quietly.
//
// Darlington is in County Durham, Dartington is in Devon, and they are one
// letter apart. Searching the first silently returned two businesses in the
// second under the banner "Here are some UK businesses we think you'll love".
// ---------------------------------------------------------------------------
console.log('\nspelling corrections are declared, not silent\n');

const correctionCases = [
  { q: 'darlington',      expect: ['darlington', 'dartington'], banner: /No results for <b>Darlington<\/b>.*Dartington/ },
  { q: 'sheffild knives', expect: ['sheffild', 'sheffield'],    banner: /No results for <b>Sheffild<\/b>.*Sheffield/ },
  // Not corrections: exact hits, and the stemmer's own doubled-letter repairs
  // ("cornwal" reaches Cornwall by collapsing "ll", so it is the same word).
  { q: 'dartington',      expect: null },
  { q: 'cornwal',         expect: null },
  { q: 'sausages',        expect: null },
  // A word the lexicon recognises is a real product term and must never be
  // corrected. "sheffield fork" was returning farm shops under "No results for
  // Fork, showing Pork instead."
  { q: 'fork',            expect: null },
  { q: 'sheffield fork',  expect: null },
];

for (const c of correctionCases) {
  const { result, banner } = local(c.q);
  const fixes = result.corrections || [];
  const problems = [];

  if (c.expect === null) {
    if (fixes.length) problems.push(`announced a correction it should not have: ${JSON.stringify(fixes)}`);
    if (/No results for/.test(banner)) problems.push('banner claims a correction');
  } else {
    const got = fixes.length ? [fixes[0].from, fixes[0].to] : null;
    if (!got || got[0] !== c.expect[0] || got[1] !== c.expect[1]) {
      problems.push(`corrections ${JSON.stringify(got)}, wanted ${JSON.stringify(c.expect)}`);
    }
    if (c.banner && !c.banner.test(banner)) problems.push(`banner reads: ${banner}`);
    if (!result.matches.length) problems.push('no results to show');
  }

  if (problems.length) {
    failures++;
    line(false, `"${c.q}"`);
    problems.forEach(p => console.log(`          ${p}`));
  } else {
    const shown = banner.replace(/<\/?b>/g, '').replace(/&mdash;/g, '—').replace(/&rsquo;/g, '’');
    line(true, `"${c.q}"`.padEnd(34) + shown.slice(0, 62));
  }
}

// A fuzzy correction may not change the first letter. Typos happen in the
// middle and at the end of words; a changed initial is a different word.
{
  const { result, banner } = local('sheffield fork');
  const farms = result.matches.filter(b => b.category === 'farm');
  const cutlers = result.matches.filter(b => b.category === 'cutlery');
  const ok = farms.length === 0 && cutlers.length >= 3 && !/Pork/i.test(banner);
  if (!ok) failures++;
  line(ok, `"sheffield fork" — ${cutlers.length} cutlers, ${farms.length} farm shops` +
    (ok ? '' : ` | ${banner}`));
}

console.log('');
if (failures) {
  console.log(`${failures} failing assertion(s)\n`);
  process.exit(1);
}
console.log(`all assertions passed\n`);
