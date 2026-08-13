#!/usr/bin/env node
/**
 * Stamp `nation` and `county` onto every business in businesses.json.
 *
 * Place search previously matched the user's words against the town and
 * address text, which meant a Scottish farm shop was only findable as Scottish
 * if it happened to write the word. Ardross Farm (Fife), Mains of Glassaugh
 * (Aberdeenshire), Kilnford (Dumfries), Newton Farm Foods (Angus) and Loch
 * Arthur (Dumfries) never do — so "scottish pork" ranked them below English
 * farms, and the map looked as though it held five Scottish farm shops when it
 * holds ten.
 *
 * Usage:  node scripts/add-regions.js [--dry-run]
 */

const fs = require('fs');
const path = require('path');
const { classify, crossCheck } = require('./lib/uk-regions');

const dryRun = process.argv.includes('--dry-run');
const businessesPath = path.join(__dirname, '../data/businesses.json');
const businesses = JSON.parse(fs.readFileSync(businessesPath, 'utf8'));

const byNation = {};
const noCounty = [];
const disagreements = [];

for (const biz of businesses) {
  const { nation, county } = classify(biz);
  biz.nation = nation;
  if (county) biz.county = county; else delete biz.county;

  byNation[nation] = (byNation[nation] || 0) + 1;
  if (!county) noCounty.push(`${biz.id} — ${biz.town}`);

  const complaint = crossCheck(biz, nation);
  if (complaint) disagreements.push(`${biz.id} (${biz.town}) — ${complaint}`);
}

console.log('nations:');
Object.entries(byNation)
  .sort((a, b) => b[1] - a[1])
  .forEach(([n, c]) => console.log(`  ${n.padEnd(18)} ${c}`));

console.log(`\nno county resolved: ${noCounty.length}`);
noCounty.slice(0, 15).forEach(n => console.log('  ' + n));
if (noCounty.length > 15) console.log(`  ...and ${noCounty.length - 15} more`);

// The point of the cross-check. Anything listed here is a gap in the county
// table, not a border case — border counties are excluded from the check.
console.log(`\ncoordinates disagree with the address text: ${disagreements.length}`);
disagreements.forEach(d => console.log('  ' + d));

const farmScot = businesses.filter(b => b.category === 'farm' && b.nation === 'Scotland');
console.log(`\nScottish farm shops: ${farmScot.length}`);
farmScot.forEach(b => console.log(`  ${b.id.padEnd(24)} ${b.county || b.town}`));

if (dryRun) {
  console.log('\n--dry-run: nothing written.');
} else {
  fs.writeFileSync(businessesPath, JSON.stringify(businesses, null, 2) + '\n');
  console.log('\nwritten: data/businesses.json');
}
