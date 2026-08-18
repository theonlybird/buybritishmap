#!/usr/bin/env node
/**
 * Grown and Made UK — Email Harvester
 *
 * Discovers verified email addresses across all 474 listed businesses
 * using multi-endpoint web scraping, Cloudflare email de-obfuscation,
 * Shopify contact disclosures, and fallback tracking.
 *
 * Usage:
 *   node scripts/harvest-emails.js                  # Run full sweep
 *   node scripts/harvest-emails.js --limit 20       # Run on first 20 businesses
 *   node scripts/harvest-emails.js --only trakke,seh-kelly
 *   node scripts/harvest-emails.js --concurrency 10 # Concurrency level (default: 8)
 *   node scripts/harvest-emails.js --refresh        # Re-fetch already processed
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const DATA_FILE = path.join(ROOT, 'data', 'businesses.json');
const OUT_FILE = path.join(ROOT, 'data', 'business-contacts.json');
const REPORT_FILE = path.join(ROOT, 'data', 'contact-harvest-report.md');
const CSV_FILE = path.join(ROOT, 'data', 'business-contacts.csv');

const USER_AGENT = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36 (GrownAndMade/1.0; contact: hello@grownandmade.uk)';
const TIMEOUT_MS = 6000;

// High-yield paths to crawl in priority order
const TARGET_PATHS = [
  '',
  '/contact',
  '/contact-us',
  '/contact_us',
  '/pages/contact',
  '/pages/contact-us',
  '/pages/contact_us',
  '/policies/contact-information',
  '/policies/privacy-policy',
  '/about',
  '/about-us',
  '/pages/about',
  '/pages/about-us',
  '/pages/our-story',
  '/customer-service',
  '/help',
  '/pages/help',
  '/policies/terms-of-service',
  '/policies/legal-notice'
];

// Domains/patterns that are never the business contact email
const BLACKLISTED_DOMAINS = new Set([
  'sentry.io', 'wixpress.com', 'shopify.com', 'squarespace.com', 'myshopify.com',
  'schema.org', 'w3.org', 'example.com', 'example.org', 'domain.com', 'email.com',
  'yourdomain.com', 'yoursite.com', 'test.com', 'klaviyo.com', 'yotpo.com',
  'cloudflare.com', 'google.com', 'apple.com', 'facebook.com', 'instagram.com',
  'twitter.com', 'trustpilot.com', 'privacypolicies.com', 'termly.io', 'iubenda.com',
  'cookiebot.com', 'onetrust.com', 'wordpress.org', 'wordpress.com', 'gravatar.com',
  'github.com', 'bugsnag.com', 'hotjar.com', 'zendesk.com', 'typeform.com',
  'mailchimp.com', 'hubspot.com', 'gorgias.io', 'intercom.io'
]);

const FILE_EXTENSIONS = /\.(png|jpg|jpeg|gif|svg|webp|avif|css|js|woff|woff2|ttf|eot|mp4|webm|pdf|zip)$/i;

// Decode Cloudflare email protection
function decodeCfEmail(hex) {
  if (!hex || hex.length < 4) return '';
  try {
    const k = parseInt(hex.substr(0, 2), 16);
    let email = '';
    for (let i = 2; i < hex.length; i += 2) {
      email += String.fromCharCode(parseInt(hex.substr(i, 2), 16) ^ k);
    }
    return email;
  } catch (e) {
    return '';
  }
}

// Clean and normalize email string
function sanitizeEmail(str) {
  if (!str || typeof str !== 'string') return null;
  let clean = str.trim()
    .toLowerCase()
    .replace(/^mailto:/i, '')
    .replace(/^[<"'\(\[\{]+/, '')
    .replace(/[>"'\)\]\},;.]+$/, '');

  // Strip query parameters e.g. email@domain.com?subject=...
  if (clean.includes('?')) {
    clean = clean.split('?')[0];
  }

  // Basic format check
  if (!/^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(clean)) {
    return null;
  }

  if (FILE_EXTENSIONS.test(clean)) return null;

  const domain = clean.split('@')[1];
  if (!domain || BLACKLISTED_DOMAINS.has(domain)) return null;
  if (domain.endsWith('.png') || domain.endsWith('.jpg') || domain.endsWith('.webp')) return null;

  // Placeholder check
  const local = clean.split('@')[0];
  if (['user', 'username', 'name', 'yourname', 'test', 'sample', 'email', 'someone', 'domain'].includes(local)) return null;

  return clean;
}

// Extract emails from HTML content
function extractEmailsFromHtml(html, pagePath) {
  const found = [];
  if (!html) return found;

  // 1. Cloudflare protected emails
  const cfMatches = [...html.matchAll(/data-cfemail=["']([a-fA-F0-9]+)["']/gi)];
  for (const match of cfMatches) {
    const decoded = decodeCfEmail(match[1]);
    const valid = sanitizeEmail(decoded);
    if (valid) {
      found.push({ email: valid, source: `${pagePath}:cloudflare` });
    }
  }

  // Cloudflare links
  const cfLinks = [...html.matchAll(/\/cdn-cgi\/l\/email-protection#([a-fA-F0-9]+)/gi)];
  for (const match of cfLinks) {
    const decoded = decodeCfEmail(match[1]);
    const valid = sanitizeEmail(decoded);
    if (valid) {
      found.push({ email: valid, source: `${pagePath}:cloudflare_link` });
    }
  }

  // 2. Mailto links
  const mailtoMatches = [...html.matchAll(/href=["']mailto:([^"' >]+)["']/gi)];
  for (const match of mailtoMatches) {
    const valid = sanitizeEmail(match[1]);
    if (valid) {
      found.push({ email: valid, source: `${pagePath}:mailto` });
    }
  }

  // 3. Obfuscated text ([at], (at), &#64;)
  const deobfuscated = html
    .replace(/&#64;/g, '@')
    .replace(/&#x40;/g, '@')
    .replace(/&amp;/g, '&')
    .replace(/\s*\[at\]\s*/gi, '@')
    .replace(/\s*\(at\)\s*/gi, '@')
    .replace(/\s*\[dot\]\s*/gi, '.')
    .replace(/\s*\(dot\)\s*/gi, '.');

  // 4. Raw regex in text & JSON-LD
  const rawMatches = [...deobfuscated.matchAll(/\b([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})\b/gi)];
  for (const match of rawMatches) {
    const valid = sanitizeEmail(match[1]);
    if (valid) {
      found.push({ email: valid, source: `${pagePath}:text` });
    }
  }

  return found;
}

// Check if page contains an active contact form
function detectContactForm(html, url) {
  if (!html) return false;
  const hasFormTag = /<form[\s>]/i.test(html);
  const hasEmailInput = /<input[^>]+type=["']email["']/i.test(html) || /<textarea/i.test(html);
  const hasContactKeywords = /contact|get in touch|send message|send enquiry|enquire/i.test(html);
  return (hasFormTag && hasEmailInput) || (hasFormTag && hasContactKeywords);
}

// Find internal contact links in navigation / footer
function findInternalContactLinks(html, currentUrl) {
  const links = new Set();
  if (!html) return links;

  let origin = '';
  try { origin = new URL(currentUrl).origin; } catch (e) { return links; }

  const hrefMatches = [...html.matchAll(/href=["'](\/[^"'#? >]+|\bhttps?:\/\/[^"'#? >]+)["']/gi)];
  for (const match of hrefMatches) {
    const href = match[1];
    try {
      const fullUrl = new URL(href, origin);
      if (fullUrl.origin === origin) {
        const pathLower = fullUrl.pathname.toLowerCase();
        if (
          (pathLower.includes('contact') || pathLower.includes('get-in-touch') || pathLower.includes('reach-us') || pathLower.includes('touch')) &&
          !TARGET_PATHS.includes(fullUrl.pathname)
        ) {
          links.add(fullUrl.pathname);
        }
      }
    } catch (e) {}
  }
  return links;
}

// Score candidate emails to pick the best primary email
function scoreEmail(email, business, source) {
  let score = 0;
  const local = email.split('@')[0];
  const domain = email.split('@')[1];

  let host = '';
  try {
    host = new URL(business.website).hostname.replace(/^www\./, '').toLowerCase();
  } catch (e) {}

  // 1. Domain matching
  if (host && (domain === host || host.endsWith('.' + domain) || domain.endsWith('.' + host))) {
    score += 100;
  } else if (business.name && domain.includes(business.id.replace(/-/g, ''))) {
    score += 80;
  } else {
    // Slight penalty if domain is completely different (could be web agency)
    score += 10;
  }

  // 2. Role ranking
  if (['hello', 'hi', 'welcome'].includes(local)) {
    score += 45;
  } else if (['info', 'enquiries', 'enquiry', 'contact', 'reachus', 'getintouch'].includes(local)) {
    score += 40;
  } else if (['sales', 'shop', 'store', 'orders', 'customercare', 'customerservice', 'support', 'help', 'mail', 'studio', 'office', 'team', 'general'].includes(local)) {
    score += 35;
  } else if (['press', 'media', 'pr', 'wholesale', 'trade'].includes(local)) {
    score += 20;
  } else if (['privacy', 'dpo', 'gdpr', 'legal'].includes(local)) {
    score += 5; // Valid fallback, but lowest preference
  } else {
    score += 25; // Named person e.g. theo@
  }

  // 3. Source priority
  if (source.includes('/policies/contact-information')) {
    score += 30; // Shopify verified contact
  } else if (source.includes('/contact')) {
    score += 25;
  } else if (source.includes('mailto')) {
    score += 20;
  } else if (source.includes('cloudflare')) {
    score += 20;
  }

  return score;
}

// Fetch a single URL with timeout
async function fetchPage(url) {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
    const res = await fetch(url, {
      headers: {
        'User-Agent': USER_AGENT,
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-GB,en;q=0.9'
      },
      signal: controller.signal,
      redirect: 'follow'
    });
    clearTimeout(timer);
    if (!res.ok) return { ok: false, status: res.status };
    const ct = res.headers.get('content-type') || '';
    if (!ct.includes('text/html') && !ct.includes('application/xhtml+xml')) {
      return { ok: false, status: res.status, reason: 'not-html' };
    }
    const html = await res.text();
    return { ok: true, html, url: res.url };
  } catch (err) {
    return { ok: false, reason: err.message };
  }
}

// Process a single business
async function harvestBusiness(business) {
  let origin = '';
  try {
    origin = new URL(business.website).origin;
  } catch (e) {
    return {
      id: business.id,
      name: business.name,
      website: business.website,
      category: business.category,
      tier: business.tier,
      status: 'failed',
      error: 'invalid-url',
      primary_email: null,
      all_emails: [],
      contact_form_url: null,
      instagram: business.instagram || null
    };
  }

  const allDiscovered = [];
  let detectedFormUrl = null;
  const pathsToTry = [...TARGET_PATHS];

  for (let i = 0; i < pathsToTry.length; i++) {
    const p = pathsToTry[i];
    const targetUrl = origin + p;
    const res = await fetchPage(targetUrl);
    if (res.ok && res.html) {
      // Extract emails
      const extracted = extractEmailsFromHtml(res.html, p || '/');
      allDiscovered.push(...extracted);

      // Check contact form
      if (!detectedFormUrl && (p.includes('contact') || p === '') && detectContactForm(res.html, targetUrl)) {
        detectedFormUrl = res.url || targetUrl;
      }

      // On homepage, discover any custom contact page links
      if (p === '') {
        const extraLinks = findInternalContactLinks(res.html, origin);
        for (const link of extraLinks) {
          if (!pathsToTry.includes(link)) {
            pathsToTry.push(link);
          }
        }
      }

      // Early stop if we found a high confidence Shopify /policies/contact-information email
      if (p === '/policies/contact-information' && extracted.length > 0) {
        break;
      }
    }
  }

  // Deduplicate and score emails
  const emailMap = new Map();
  for (const item of allDiscovered) {
    const current = emailMap.get(item.email);
    if (!current) {
      const score = scoreEmail(item.email, business, item.source);
      emailMap.set(item.email, { email: item.email, score, sources: [item.source] });
    } else {
      if (!current.sources.includes(item.source)) {
        current.sources.push(item.source);
      }
    }
  }

  const sortedCandidates = Array.from(emailMap.values()).sort((a, b) => b.score - a.score);

  let status = 'failed';
  let primaryEmail = null;
  let primarySource = null;

  if (sortedCandidates.length > 0) {
    primaryEmail = sortedCandidates[0].email;
    primarySource = sortedCandidates[0].sources.join(', ');
    status = 'found_email';
  } else if (detectedFormUrl) {
    status = 'needs_contact_form';
  } else if (business.instagram) {
    status = 'needs_dm';
  }

  return {
    id: business.id,
    name: business.name,
    website: business.website,
    category: business.category,
    subcategory: business.subcategory || '',
    tier: business.tier,
    town: business.town || '',
    status,
    primary_email: primaryEmail,
    primary_source: primarySource,
    all_emails: sortedCandidates.map(c => ({ email: c.email, score: c.score, sources: c.sources })),
    contact_form_url: detectedFormUrl,
    instagram: business.instagram || null
  };
}

// Generate Markdown & CSV reports
function writeReports(results) {
  const total = results.length;
  const found = results.filter(r => r.status === 'found_email');
  const forms = results.filter(r => r.status === 'needs_contact_form');
  const dms = results.filter(r => r.status === 'needs_dm');
  const failed = results.filter(r => r.status === 'failed');

  const hitRate = ((found.length / total) * 100).toFixed(1);

  // By Category
  const byCat = {};
  for (const r of results) {
    if (!byCat[r.category]) byCat[r.category] = { total: 0, found: 0 };
    byCat[r.category].total++;
    if (r.status === 'found_email') byCat[r.category].found++;
  }

  // By Tier
  const byTier = { gold: { total: 0, found: 0 }, silver: { total: 0, found: 0 } };
  for (const r of results) {
    const t = r.tier || 'silver';
    if (!byTier[t]) byTier[t] = { total: 0, found: 0 };
    byTier[t].total++;
    if (r.status === 'found_email') byTier[t].found++;
  }

  let md = `# Grown and Made UK — Contact Harvest Report\n\n`;
  md += `*Generated: ${new Date().toISOString()}*\n\n`;
  md += `## Executive Summary\n\n`;
  md += `| Metric | Count | Percentage |\n`;
  md += `|---|---|---|\n`;
  md += `| **Total Businesses** | **${total}** | 100.0% |\n`;
  md += `| **Direct Email Harvested** | **${found.length}** | **${hitRate}%** |\n`;
  md += `| **Contact Form Fallback (Manual)** | ${forms.length} | ${((forms.length / total) * 100).toFixed(1)}% |\n`;
  md += `| **Instagram DM Fallback (Manual)** | ${dms.length} | ${((dms.length / total) * 100).toFixed(1)}% |\n`;
  md += `| **No Contact Channel Found** | ${failed.length} | ${((failed.length / total) * 100).toFixed(1)}% |\n\n`;

  md += `### Category Breakdown\n\n`;
  md += `| Category | Total | Emails Found | Hit Rate |\n`;
  md += `|---|---|---|---|\n`;
  for (const [cat, stats] of Object.entries(byCat)) {
    const rate = ((stats.found / stats.total) * 100).toFixed(1);
    md += `| ${cat} | ${stats.total} | ${stats.found} | ${rate}% |\n`;
  }
  md += `\n`;

  md += `### Tier Breakdown\n\n`;
  md += `| Tier | Total | Emails Found | Hit Rate |\n`;
  md += `|---|---|---|---|\n`;
  for (const [tier, stats] of Object.entries(byTier)) {
    const rate = stats.total > 0 ? ((stats.found / stats.total) * 100).toFixed(1) : '0.0';
    md += `| ${tier.toUpperCase()} | ${stats.total} | ${stats.found} | ${rate}% |\n`;
  }
  md += `\n`;

  md += `## Manual Outreach Queue (${forms.length + dms.length} Businesses)\n\n`;
  if (forms.length > 0) {
    md += `### Contact Form Queue (${forms.length})\n\n`;
    md += `| Business | Category | Tier | Contact Form URL |\n`;
    md += `|---|---|---|---|\n`;
    for (const r of forms) {
      md += `| [${r.name}](${r.website}) | ${r.category} | ${r.tier.toUpperCase()} | [Open Form](${r.contact_form_url}) |\n`;
    }
    md += `\n`;
  }

  if (dms.length > 0) {
    md += `### Instagram DM Queue (${dms.length})\n\n`;
    md += `| Business | Category | Tier | Instagram |\n`;
    md += `|---|---|---|---|\n`;
    for (const r of dms) {
      md += `| [${r.name}](${r.website}) | ${r.category} | ${r.tier.toUpperCase()} | [${r.instagram}](${r.instagram}) |\n`;
    }
    md += `\n`;
  }

  fs.writeFileSync(REPORT_FILE, md, 'utf8');

  // CSV Export for email tools (Mailchimp, Brevo, Gmail mail merge, etc.)
  let csv = 'id,name,website,category,subcategory,tier,town,status,primary_email,primary_source,contact_form_url,instagram\n';
  for (const r of results) {
    const escapeCsv = (str) => {
      if (!str) return '""';
      return `"${String(str).replace(/"/g, '""')}"`;
    };
    csv += [
      escapeCsv(r.id),
      escapeCsv(r.name),
      escapeCsv(r.website),
      escapeCsv(r.category),
      escapeCsv(r.subcategory),
      escapeCsv(r.tier),
      escapeCsv(r.town),
      escapeCsv(r.status),
      escapeCsv(r.primary_email),
      escapeCsv(r.primary_source),
      escapeCsv(r.contact_form_url),
      escapeCsv(r.instagram)
    ].join(',') + '\n';
  }
  fs.writeFileSync(CSV_FILE, csv, 'utf8');
}

// Main execution loop with concurrency
async function main() {
  const args = process.argv.slice(2);
  let limit = null;
  let only = null;
  let concurrency = 8;
  let refresh = false;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--limit' && args[i + 1]) limit = parseInt(args[++i], 10);
    if (args[i] === '--only' && args[i + 1]) only = args[++i].split(',').map(s => s.trim());
    if (args[i] === '--concurrency' && args[i + 1]) concurrency = parseInt(args[++i], 10);
    if (args[i] === '--refresh') refresh = true;
  }

  const raw = fs.readFileSync(DATA_FILE, 'utf8');
  let businesses = JSON.parse(raw);

  if (only) {
    businesses = businesses.filter(b => only.includes(b.id) || only.includes(b.name));
  }
  if (limit) {
    businesses = businesses.slice(0, limit);
  }

  console.log(`Starting harvest for ${businesses.length} businesses (concurrency: ${concurrency})...`);

  // Load existing contacts cache if not refresh
  let contactMap = new Map();
  if (!refresh && fs.existsSync(OUT_FILE)) {
    try {
      const existing = JSON.parse(fs.readFileSync(OUT_FILE, 'utf8'));
      for (const item of existing) {
        contactMap.set(item.id, item);
      }
      console.log(`Loaded ${contactMap.size} existing cached records.`);
    } catch (e) {}
  }

  const toProcess = businesses.filter(b => refresh || !contactMap.has(b.id));
  console.log(`To process: ${toProcess.length} businesses.`);

  let completed = 0;
  let foundCount = Array.from(contactMap.values()).filter(r => r.status === 'found_email').length;

  async function worker(queue) {
    while (queue.length > 0) {
      const b = queue.shift();
      try {
        const result = await harvestBusiness(b);
        contactMap.set(b.id, result);
        completed++;
        if (result.status === 'found_email') {
          foundCount++;
          console.log(`[${completed}/${toProcess.length}] ✓ ${b.name} -> ${result.primary_email} (${result.primary_source.split(',')[0]})`);
        } else if (result.status === 'needs_contact_form') {
          console.log(`[${completed}/${toProcess.length}] 📝 ${b.name} -> Contact Form: ${result.contact_form_url}`);
        } else if (result.status === 'needs_dm') {
          console.log(`[${completed}/${toProcess.length}] 📸 ${b.name} -> Instagram DM: ${result.instagram}`);
        } else {
          console.log(`[${completed}/${toProcess.length}] ✗ ${b.name} -> No email/form found`);
        }

        // Save progress periodically
        if (completed % 10 === 0 || queue.length === 0) {
          const allResults = businesses.map(bus => contactMap.get(bus.id) || { id: bus.id, name: bus.name, status: 'pending' });
          fs.writeFileSync(OUT_FILE, JSON.stringify(allResults, null, 2), 'utf8');
          writeReports(allResults.filter(r => r.status !== 'pending'));
        }
      } catch (err) {
        console.error(`Error processing ${b.name}:`, err.message);
      }
    }
  }

  const queue = [...toProcess];
  const workers = Array.from({ length: concurrency }, () => worker(queue));
  await Promise.all(workers);

  const finalResults = businesses.map(bus => contactMap.get(bus.id)).filter(Boolean);
  fs.writeFileSync(OUT_FILE, JSON.stringify(finalResults, null, 2), 'utf8');
  writeReports(finalResults);

  const finalFound = finalResults.filter(r => r.status === 'found_email').length;
  const finalHitRate = ((finalFound / finalResults.length) * 100).toFixed(1);

  console.log(`\n========================================`);
  console.log(`Harvest complete!`);
  console.log(`Total: ${finalResults.length}`);
  console.log(`Emails found: ${finalFound} (${finalHitRate}%)`);
  console.log(`Master contacts saved to: ${OUT_FILE}`);
  console.log(`CSV export saved to: ${CSV_FILE}`);
  console.log(`Markdown report saved to: ${REPORT_FILE}`);
  console.log(`========================================\n`);
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
