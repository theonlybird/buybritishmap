#!/usr/bin/env node
/**
 * Offline re-scoring of data/product-index.json.
 *
 * Makes NO network calls. Re-runs the corrected vocabulary over the evidence
 * that the harvest already stored, so the effect of the rule changes can be
 * reviewed before anything touches businesses.json.
 *
 * IMPORTANT LIMITATION
 * The harvest did not keep all 34,417 product titles — only, per business:
 *   - observedTypes : up to 40 of the shop's OWN product_type values (clean)
 *   - tagEvidence   : one example title per tag it awarded
 *   - sample        : 8 example titles
 * So this pass can reliably REMOVE wrong tags and can ADD tags visible in
 * observedTypes, but it cannot recover a tag whose only supporting title was
 * never stored. A full re-harvest is needed for that.
 *
 * Confidence recorded per tag:
 *   strong — came from the shop's own product_type taxonomy
 *   weak   — came only from a free-text product title
 *
 * Usage:
 *   node scripts/rescore-product-index.js            # write rescored index + report
 *   node scripts/rescore-product-index.js --dry      # print summary only
 */

const fs = require('fs');
const path = require('path');
const vocab = require('./lib/product-vocab');

const ROOT = path.join(__dirname, '..');
const BUSINESSES = path.join(ROOT, 'data', 'businesses.json');
const INDEX = path.join(ROOT, 'data', 'product-index.json');
const OUT = path.join(ROOT, 'data', 'product-index.rescored.json');
const REPORT = path.join(ROOT, 'data', 'product-index-rescore-report.md');

const dry = process.argv.includes('--dry');

const businesses = JSON.parse(fs.readFileSync(BUSINESSES, 'utf8'));
const index = JSON.parse(fs.readFileSync(INDEX, 'utf8'));
const byId = Object.fromEntries(businesses.map(b => [b.id, b]));

const stats = {
  entries: 0,
  harvested: 0,
  tagsBefore: 0,
  tagsAfter: 0,
  droppedGated: 0,
  droppedModifier: 0,
  droppedNoMatch: 0,
  addedFromTypes: 0,
  businessesEmptied: 0,
};

const drops = [];   // { id, category, tag, reason, evidence }
const adds = [];    // { id, category, tag, evidence }
const rescored = {};

for (const [id, entry] of Object.entries(index)) {
  stats.entries++;
  const biz = byId[id];
  const category = biz ? biz.category : null;
  const before = Array.isArray(entry.tags) ? entry.tags : [];
  stats.tagsBefore += before.length;

  if (!entry.platform) {
    rescored[id] = { ...entry, tags: [], tagConfidence: {}, rescored: true };
    continue;
  }
  stats.harvested++;

  // Entries harvested under the corrected rules already carry confidence and
  // were gated at write time. They saw every product title; this script only
  // ever sees the stored sample, so re-deriving them would LOSE tags. Pass
  // them through untouched.
  if (entry.tagConfidence && Object.keys(entry.tagConfidence).length) {
    rescored[id] = { ...entry, rescored: false, alreadyGated: true };
    stats.tagsAfter += before.length;
    stats.passedThrough = (stats.passedThrough || 0) + 1;
    continue;
  }

  // --- gather candidate tags from every stored source ---------------------
  const strong = new Map();   // tag -> evidence string (from product_type)
  const weak = new Map();     // tag -> evidence string (from a title)
  const suppressed = new Map();

  for (const t of entry.observedTypes || []) {
    for (const r of vocab.mapWithEvidence(t)) {
      if (r.suppressed) { if (!suppressed.has(r.tag)) suppressed.set(r.tag, r); continue; }
      if (!strong.has(r.tag)) strong.set(r.tag, r.evidence);
    }
  }

  const titleSources = [
    ...Object.values(entry.tagEvidence || {}),
    ...(entry.sample || []),
  ];
  for (const t of titleSources) {
    for (const r of vocab.mapWithEvidence(t)) {
      if (r.suppressed) { if (!suppressed.has(r.tag)) suppressed.set(r.tag, r); continue; }
      if (!strong.has(r.tag) && !weak.has(r.tag)) weak.set(r.tag, r.evidence);
    }
  }

  // --- apply category gating ----------------------------------------------
  const finalTags = [];
  const confidence = {};
  const evidenceOut = {};

  for (const [tag, ev] of [...strong.entries()].map(e => [e[0], e[1]])) {
    if (!vocab.isTagAllowed(tag, category)) {
      drops.push({ id, category, tag, reason: 'category-gated', evidence: ev });
      stats.droppedGated++;
      continue;
    }
    finalTags.push(tag); confidence[tag] = 'strong'; evidenceOut[tag] = ev;
  }
  for (const [tag, ev] of weak.entries()) {
    if (finalTags.includes(tag)) continue;
    if (!vocab.isTagAllowed(tag, category)) {
      drops.push({ id, category, tag, reason: 'category-gated', evidence: ev });
      stats.droppedGated++;
      continue;
    }
    finalTags.push(tag); confidence[tag] = 'weak'; evidenceOut[tag] = ev;
  }

  // --- account for tags the old run had that this one doesn't --------------
  for (const tag of before) {
    if (finalTags.includes(tag)) continue;
    if (drops.some(d => d.id === id && d.tag === tag)) continue;
    const s = suppressed.get(tag);
    if (s) {
      drops.push({ id, category, tag, reason: 'modifier', evidence: s.evidence });
      stats.droppedModifier++;
    } else {
      drops.push({
        id, category, tag, reason: 'no-longer-matches',
        evidence: (entry.tagEvidence || {})[tag] || '',
      });
      stats.droppedNoMatch++;
    }
  }

  for (const tag of finalTags) {
    if (!before.includes(tag)) {
      adds.push({ id, category, tag, evidence: evidenceOut[tag] });
      stats.addedFromTypes++;
    }
  }

  finalTags.sort();
  stats.tagsAfter += finalTags.length;
  if (before.length && !finalTags.length) stats.businessesEmptied++;

  rescored[id] = {
    ...entry,
    tags: finalTags,
    tagConfidence: confidence,
    tagEvidence: evidenceOut,
    previousTags: before,
    rescored: true,
  };
}

// ---------------------------------------------------------------------------
const pct = (n, d) => d ? Math.round((n / d) * 100) + '%' : '0%';

const summary = `
Rescore summary
---------------
index entries              ${stats.entries}
  of which harvested       ${stats.harvested}
tags before                ${stats.tagsBefore}
tags after                 ${stats.tagsAfter}  (${pct(stats.tagsAfter, stats.tagsBefore)} retained)

dropped: category-gated    ${stats.droppedGated}
dropped: modifier/head-noun${String(stats.droppedModifier).padStart(4)}
dropped: no longer matches ${stats.droppedNoMatch}
added from product_type    ${stats.addedFromTypes}
businesses left with none  ${stats.businessesEmptied}
`;

console.log(summary);

if (dry) {
  console.log('Dry run — nothing written.');
  process.exit(0);
}

fs.writeFileSync(OUT, JSON.stringify(rescored, null, 1));

// --- human-readable report --------------------------------------------------
const byReason = r => drops.filter(d => d.reason === r);
const groupById = list => {
  const m = {};
  list.forEach(d => { (m[d.id] = m[d.id] || []).push(d); });
  return m;
};

let md = `# Product index — rescore report\n\n`;
md += `*Generated ${new Date().toISOString().slice(0, 10)} by \`scripts/rescore-product-index.js\`. `;
md += `Offline pass over the existing harvest — no sites were re-fetched.*\n\n`;
md += '```' + summary + '```\n\n';
md += `## What changed\n\n`;
md += `Three rules were added: category gating, head-noun suppression for food `;
md += `and drink words, and an expanded noise list. Tags are now also marked `;
md += `**strong** (from the shop's own \`product_type\` taxonomy) or **weak** `;
md += `(from a free-text product title only).\n\n`;

for (const [reason, title, blurb] of [
  ['category-gated', 'Dropped — implausible for the business category',
   'A tag whose group does not belong to the business\'s category on the map.'],
  ['modifier', 'Dropped — food word was modifying an object',
   'The food word is a motif or a modifier; the product is the object that follows it.'],
  ['no-longer-matches', 'Dropped — no longer matches the corrected rules',
   'Usually a noise word (colour, material, care product) that now gets stripped.'],
]) {
  const list = byReason(reason);
  md += `### ${title} (${list.length})\n\n${blurb}\n\n`;
  if (!list.length) { md += `_None._\n\n`; continue; }
  md += `| Business | Category | Tag | Evidence |\n|---|---|---|---|\n`;
  list.slice(0, 120).forEach(d => {
    md += `| ${d.id} | ${d.category || '?'} | ${d.tag} | ${String(d.evidence).replace(/\|/g, '/')} |\n`;
  });
  if (list.length > 120) md += `\n_…and ${list.length - 120} more._\n`;
  md += `\n`;
}

md += `### Added from the shop's own product_type (${adds.length})\n\n`;
md += `These were missed before because the old rules only read product titles.\n\n`;
if (adds.length) {
  md += `| Business | Category | Tag | Evidence |\n|---|---|---|---|\n`;
  adds.slice(0, 80).forEach(a => {
    md += `| ${a.id} | ${a.category || '?'} | ${a.tag} | ${String(a.evidence).replace(/\|/g, '/')} |\n`;
  });
  if (adds.length > 80) md += `\n_…and ${adds.length - 80} more._\n`;
}

md += `\n## Still to do before merging\n\n`;
md += `- Tags marked **weak** rest on a single product title. Consider requiring\n`;
md += `  two or more supporting products, which needs per-tag counts from a fresh\n`;
md += `  harvest — the current index does not store them.\n`;
md += `- ${stats.businessesEmptied} businesses came out of this pass with no tags at all.\n`;
md += `- Nothing has been written to \`businesses.json\`.\n`;

fs.writeFileSync(REPORT, md);

console.log(`Written:\n  ${path.relative(ROOT, OUT)}\n  ${path.relative(ROOT, REPORT)}`);
console.log(`\nNothing has been merged into businesses.json.`);
