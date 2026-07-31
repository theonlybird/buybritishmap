const fs = require('fs');
const path = require('path');

const dataPath = path.join(__dirname, '../data/businesses.json');
const apiPath = path.join(__dirname, '../api/ai-search.js');

const data = JSON.parse(fs.readFileSync(dataPath, 'utf8'));

const catalog = data.map(b => ({
  i: b.id,
  n: b.name,
  c: b.category,
  s: b.subcategory,
  t: b.town,
  d: b.description,
  tr: b.tier,
  pt: b.product_tags || []
}));

const catalogJson = JSON.stringify(catalog);

const apiCode = `const BUSINESS_CATALOG = ${catalogJson};

function stageOneFilter(query, catalog, maxCandidates = 40) {
  if (!query || typeof query !== 'string') return catalog.slice(0, maxCandidates);
  
  const qClean = query.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
  if (!qClean) return catalog.slice(0, maxCandidates);
  
  const stopWords = new Set(['the', 'a', 'an', 'and', 'or', 'for', 'in', 'on', 'at', 'to', 'of', 'with', 'who', 'sell', 'sells', 'selling', 'make', 'makes', 'maker', 'makers', 'making', 'which', 'what', 'can', 'are', 'is', 'do', 'does', 'find', 'looking']);
  const tokens = qClean.split(/\\s+/).filter(t => t.length > 1 && !stopWords.has(t));

  const scored = catalog.map(item => {
    let score = 0;
    const textNorm = ' ' + (item.n + ' ' + item.c + ' ' + item.s + ' ' + item.t + ' ' + item.d).toLowerCase().replace(/[^a-z0-9]+/g, ' ') + ' ';
    const ptList = (item.pt || []).map(p => p.toLowerCase());
    const ptStr = ' ' + ptList.join(' ') + ' ';

    if (qClean.length >= 3 && textNorm.includes(' ' + qClean + ' ')) {
      score += 20;
    }

    ptList.forEach(pt => {
      const ptNorm = pt.replace(/[^a-z0-9]+/g, ' ');
      if (qClean.includes(ptNorm) || ptNorm.includes(qClean)) {
        score += 15;
      }
    });

    tokens.forEach(t => {
      if (ptStr.includes(' ' + t + ' ')) score += 10;
      if (item.c.toLowerCase().includes(t)) score += 8;
      if (item.s.toLowerCase().includes(t)) score += 6;
      if (item.n.toLowerCase().includes(t)) score += 6;
      if (item.t.toLowerCase().includes(t)) score += 8;
      if (item.d.toLowerCase().includes(t)) score += 3;
    });

    return { item, score };
  });

  scored.sort((a, b) => b.score - a.score);

  const matched = scored.filter(s => s.score > 0).map(s => s.item);

  if (matched.length >= 15) {
    return matched.slice(0, maxCandidates);
  }

  const matchedIds = new Set(matched.map(m => m.i));
  const fallback = catalog.filter(c => !matchedIds.has(c.i)).slice(0, maxCandidates - matched.length);
  return [...matched, ...fallback];
}

const MODEL_CANDIDATES = [
  'gemini-1.5-flash',
  'gemini-2.5-flash',
  'gemini-2.0-flash',
  'gemini-1.5-pro'
];

const https = require('https');

function httpsJson(urlStr, method, payloadStr) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(urlStr);
    const options = {
      hostname: urlObj.hostname,
      path: urlObj.pathname + urlObj.search,
      method: method,
      headers: { 'Content-Type': 'application/json' }
    };

    const req = https.request(options, res => {
      let responseData = '';
      res.on('data', chunk => { responseData += chunk; });
      res.on('end', () => {
        resolve({ statusCode: res.statusCode, body: responseData });
      });
    });

    req.on('error', reject);
    if (payloadStr) req.write(payloadStr);
    req.end();
  });
}

async function listUsableModels(apiKey) {
  try {
    const res = await httpsJson(
      \`https://generativelanguage.googleapis.com/v1beta/models?key=\${apiKey}\`,
      'GET', null
    );
    if (res.statusCode !== 200) return null;
    const resData = JSON.parse(res.body);
    if (!resData.models) return null;
    return resData.models
      .filter(m => Array.isArray(m.supportedGenerationMethods) && m.supportedGenerationMethods.includes('generateContent'))
      .map(m => m.name.replace(/^models\\//, ''));
  } catch (e) {
    return null;
  }
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return res.status(500).json({
      error: 'GEMINI_API_KEY environment variable is missing on server.'
    });
  }

  if (req.method === 'GET') {
    const models = await listUsableModels(apiKey);
    return res.status(200).json({
      keyPresent: true,
      keyLength: String(apiKey).length,
      modelsVisibleToThisKey: models,
      configuredCandidates: MODEL_CANDIDATES,
      willUse: models ? MODEL_CANDIDATES.find(m => models.includes(m)) || null : null
    });
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed. Use POST.' });
  }

  let body = req.body;
  if (typeof body === 'string') {
    try { body = JSON.parse(body); } catch (e) {}
  }

  const query = body && body.query ? String(body.query).trim() : '';
  if (!query) return res.status(400).json({ error: 'Query parameter is required.' });

  // Stage 1 Two-Stage Retrieval
  const shortlistedCatalog = stageOneFilter(query, BUSINESS_CATALOG, 40);
  const catalogStr = JSON.stringify(shortlistedCatalog);

  const systemInstruction = \`You are the Buy British AI Search Assistant.
Analyze the user's natural language request and find the best matching British makers from the provided candidate catalog.

CRITICAL INSTRUCTIONS:
1. Understand regional synonyms (e.g. Yorkshire = Sheffield, Leeds; Scotland = Hawick, Edinburgh; Wales = Gwynedd; Cotswolds = Chipping Campden).
2. Match materials, craft techniques, product terms and tags (e.g. pet food bowls = ceramics/pottery pet bowls; knitted vests = woollen waistcoats/gilets; kitchen knife = forged cutlery/blades).
3. Return ONLY a valid JSON object matching this exact structure:
{
  "query": \${JSON.stringify(query)},
  "productTerm": "the plural everyday noun for what they want, e.g. jumpers, watches, jewellery, venison, mugs. Lowercase. Null if they named no product.",
  "locationTerm": "the place they asked for exactly as a person would say it, e.g. Darlington, Norfolk, Cornwall. Null if they named no place.",
  "madeOrGrown": "made or grown - use grown for food, produce, meat and farm goods; made for everything else",
  "matchQuality": "exact if you found businesses that genuinely satisfy BOTH the product and the location; wider if you found the right product but had to go outside the requested area; loose if you could only find loosely related businesses",
  "matches": [
    { "id": "exact-business-id-from-catalog" }
  ]
}
4. Limit matches to the top 1-12 most relevant businesses.
4a. IMPORTANT: never return an empty matches array. If nothing matches well, set matchQuality to "wider" or "loose" and still return the closest alternatives from the catalog.
4b. Be honest in matchQuality. If the user asked for a town and the nearest match is a county away, that is "wider", not "exact".
5. DO NOT include markdown formatting like \\\`\\\`\\\`json. Return raw JSON string only.

CANDIDATE CATALOG:
\${catalogStr}\`;

  function buildPayload(model) {
    const generationConfig = { temperature: 0.2, maxOutputTokens: 8192 };
    if (/^gemini-(2\\.5|3)/.test(model)) generationConfig.thinkingConfig = { thinkingBudget: 0 };
    return JSON.stringify({
      contents: [{ parts: [{ text: systemInstruction }, { text: \`User Search Query: "\${query}"\` }] }],
      generationConfig
    });
  }

  let lastStatus = 0, lastBody = '', triedModels = [];

  for (const model of MODEL_CANDIDATES) {
    triedModels.push(model);
    let apiRes;
    try {
      apiRes = await httpsJson(
        \`https://generativelanguage.googleapis.com/v1beta/models/\${model}:generateContent?key=\${apiKey}\`,
        'POST', buildPayload(model)
      );
    } catch (err) {
      return res.status(502).json({ error: 'Could not reach the Gemini API.', details: err.message });
    }

    lastStatus = apiRes.statusCode;
    lastBody = apiRes.body;

    // 404 = model not enabled; 429 = rate limit / quota exceeded for this model: continue trying next model!
    if (apiRes.statusCode === 404 || apiRes.statusCode === 429) continue;
    if (apiRes.statusCode !== 200) break;

    try {
      const geminiData = JSON.parse(apiRes.body);
      const text = geminiData.candidates?.[0]?.content?.parts?.[0]?.text || '';
      if (!text) {
        return res.status(502).json({
          error: 'Gemini returned no text.',
          finishReason: geminiData.candidates?.[0]?.finishReason || null,
          usage: geminiData.usageMetadata || null
        });
      }
      const clean = text.replace(/^\\\`\\\`\\\`json\\s*/i, '').replace(/^\\\`\\\`\\\`\\s*/i, '').replace(/\\s*\\\`\\\`\\\`$/i, '').trim();
      const parsed = JSON.parse(clean);
      parsed._model = model;
      parsed._stageOneCandidateCount = shortlistedCatalog.length;
      return res.status(200).json(parsed);
    } catch (err) {
      return res.status(502).json({
        error: 'Gemini replied but the response could not be parsed as JSON.',
        details: String(lastBody).slice(0, 500)
      });
    }
  }

  let googleMessage = '';
  try { googleMessage = JSON.parse(lastBody)?.error?.message || ''; } catch (e) {}

  return res.status(lastStatus || 502).json({
    error: \`Gemini API error (status \${lastStatus}).\`,
    googleMessage,
    triedModels,
    details: String(lastBody).slice(0, 500)
  });
};
`;

fs.writeFileSync(apiPath, apiCode);
console.log('Successfully updated api/ai-search.js with 429 quota fallback handling.');
