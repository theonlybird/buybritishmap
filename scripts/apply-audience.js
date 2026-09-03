#!/usr/bin/env node
/**
 * Write the harvested audience onto the listings.
 *
 * Reads data/audience-index.json (see scripts/harvest-audience.js) and adds
 * two fields to each clothing listing in data/businesses.json:
 *
 *   audience             ["men"] | ["women","children"] | …
 *   audience_confidence  "strong" | "medium"
 *
 * A listing with no audience field is not "unisex" — it is unclassified, and
 * the search shows it in every gendered search, ranked below the confirmed
 * matches. That is the whole reason the field is absent rather than empty.
 *
 * WEAK VERDICTS ARE NOT WRITTEN. A verdict resting only on product titles and
 * merchandising tags is where the false positives live: Globe-Trotter, a
 * luggage maker, comes back "children" on the strength of one repeated tag.
 * Being wrong here HIDES a business from a search, so free text alone is not
 * enough to do it. They stay in the index for review.
 *
 * Usage:
 *   node scripts/apply-audience.js --dry     # report only
 *   node scripts/apply-audience.js
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const DATA = path.join(ROOT, 'data', 'businesses.json');
const INDEX = path.join(ROOT, 'data', 'audience-index.json');

const dry = process.argv.includes('--dry');

const businesses = JSON.parse(fs.readFileSync(DATA, 'utf8'));
const index = JSON.parse(fs.readFileSync(INDEX, 'utf8'));

let written = 0, cleared = 0, skippedWeak = 0, unchanged = 0;
const changes = [];

businesses.forEach(b => {
  if (b.category !== 'clothing') return;
  const rec = index[b.id];
  const before = Array.isArray(b.audience) ? b.audience.join('+') : '';

  if (!rec || !rec.audience || rec.confidence === 'weak' || rec.confidence === 'none') {
    if (rec && rec.audience && rec.confidence === 'weak') skippedWeak++;
    // Never leave a stale label behind if a re-harvest downgraded a verdict.
    if (b.audience) { delete b.audience; delete b.audience_confidence; cleared++; changes.push(`${b.id}: ${before} -> unclassified`); }
    return;
  }

  const after = rec.audience.join('+');
  if (before === after && b.audience_confidence === rec.confidence) { unchanged++; return; }
  b.audience = rec.audience.slice();
  b.audience_confidence = rec.confidence;
  written++;
  changes.push(`${b.id}: ${before || 'unclassified'} -> ${after} (${rec.confidence})`);
});

console.log(`${written} written, ${cleared} cleared, ${unchanged} already correct, ${skippedWeak} weak verdicts left unapplied.`);
changes.slice(0, 40).forEach(c => console.log('  ' + c));
if (changes.length > 40) console.log(`  … ${changes.length - 40} more`);

if (dry) { console.log('\n--dry: businesses.json not touched.'); process.exit(0); }

fs.writeFileSync(DATA, JSON.stringify(businesses, null, 2));
console.log(`\nWrote ${DATA}`);
