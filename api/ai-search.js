const fs = require('fs');
const path = require('path');
const https = require('https');

// Load business catalog
let catalogCache = null;
function getCompressedCatalog() {
  if (catalogCache) return catalogCache;
  try {
    const dataPath = path.join(process.cwd(), 'data', 'businesses.json');
    const raw = fs.readFileSync(dataPath, 'utf8');
    const businesses = JSON.parse(raw);
    const compact = businesses.map(b => ({
      i: b.id,
      n: b.name,
      c: b.category,
      s: b.subcategory || '',
      t: b.town,
      d: b.description,
      tr: b.tier
    }));
    catalogCache = JSON.stringify(compact, null, 0);
    return catalogCache;
  } catch (err) {
    console.error("Error loading businesses catalog:", err);
    return "[]";
  }
}

module.exports = async function handler(req, res) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed. Use POST.' });
  }

  const apiKey = process.env.GEMINI_API_KEY || (req.body && req.body.apiKey);
  if (!apiKey) {
    return res.status(400).json({
      error: 'Missing GEMINI_API_KEY. Set GEMINI_API_KEY environment variable in Vercel or pass apiKey in request body.'
    });
  }

  const query = req.body && req.body.query ? req.body.query.trim() : '';
  if (!query) {
    return res.status(400).json({ error: 'Query parameter is required.' });
  }

  const catalogStr = getCompressedCatalog();

  const systemInstruction = `You are the Buy British AI Search Assistant.
Analyze the user's natural language request and find the best matching British makers from the provided catalog.

CRITICAL INSTRUCTIONS:
1. Understand regional synonyms (e.g. Yorkshire = Sheffield, Leeds, Hathersage; Scotland = Hawick, Edinburgh, Glasgow, Highlands; Wales = Gwynedd, Monmouthshire; Cotswolds = Chipping Campden).
2. Match materials, craft techniques, and product synonyms (e.g. kitchen knife = forged cutlery/blades; jumper = knitwear/cashmere/wool; cookware = cast iron/spun iron/copper pans).
3. Return ONLY a valid JSON object matching this exact structure:
{
  "query": "${query.replace(/"/g, '\\"')}",
  "reasoning": "1-2 sentence explanation of what the user is looking for and the regional/material context.",
  "matches": [
    {
      "id": "exact-business-id-from-catalog",
      "reason": "1-sentence specific rationale explaining why this business matches the query."
    }
  ]
}
4. Limit matches to the top 1-12 most relevant businesses.
5. DO NOT include markdown formatting like \`\`\`json. Return raw JSON string only.

BUSINESS CATALOG:
${catalogStr}`;

  const payload = JSON.stringify({
    contents: [
      {
        parts: [
          { text: systemInstruction },
          { text: `User Search Query: "${query}"` }
        ]
      }
    ],
    generationConfig: {
      temperature: 0.2,
      maxOutputTokens: 2000
    }
  });

  const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;

  try {
    const apiRes = await new Promise((resolve, reject) => {
      const parsedUrl = new URL(apiUrl);
      const options = {
        hostname: parsedUrl.hostname,
        path: parsedUrl.pathname + parsedUrl.search,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(payload)
        }
      };

      const request = https.request(options, response => {
        let body = '';
        response.on('data', chunk => (body += chunk));
        response.on('end', () => resolve({ statusCode: response.statusCode, body }));
      });

      request.on('error', err => reject(err));
      request.write(payload);
      request.end();
    });

    if (apiRes.statusCode !== 200) {
      console.error("Gemini API Error:", apiRes.body);
      return res.status(apiRes.statusCode).json({
        error: `Gemini API returned status ${apiRes.statusCode}`,
        details: apiRes.body
      });
    }

    const geminiData = JSON.parse(apiRes.body);
    const candidateText =
      geminiData.candidates &&
      geminiData.candidates[0] &&
      geminiData.candidates[0].content &&
      geminiData.candidates[0].content.parts &&
      geminiData.candidates[0].content.parts[0]
        ? geminiData.candidates[0].content.parts[0].text
        : '';

    const cleanJsonText = candidateText
      .replace(/^```json\s*/i, '')
      .replace(/^```\s*/i, '')
      .replace(/\s*```$/i, '')
      .trim();

    const parsedResults = JSON.parse(cleanJsonText);
    return res.status(200).json(parsedResults);
  } catch (err) {
    console.error("Error in ai-search handler:", err);
    return res.status(500).json({ error: 'Internal server error processing AI search query.', message: err.message });
  }
};
