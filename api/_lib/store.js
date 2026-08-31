/* Where submissions live.
 *
 * Vercel Blob in production, a directory on disk when GM_STORE_DIR is set.
 * The local backend is not a convenience: it is what makes the endpoint
 * testable off Vercel, so the validation and token logic can be exercised
 * without a network round trip to a store that costs money per operation.
 *
 * One JSON blob per submission under submissions/. At ~150 submissions over a
 * campaign, listing and reading them individually is cheap and needs no index
 * to keep consistent. If this ever grows into the thousands, add one.
 */
const fs = require('fs');
const path = require('path');

const PREFIX = 'submissions/';
const localDir = () => process.env.GM_STORE_DIR;

async function blob() {
  // @vercel/blob is ESM; this file is CommonJS, like api/ai-search.js.
  return await import('@vercel/blob');
}

function localPath(key) {
  return path.join(localDir(), key.replace(/\//g, '__'));
}

async function put(key, value) {
  const body = JSON.stringify(value, null, 2);
  if (localDir()) {
    fs.mkdirSync(localDir(), { recursive: true });
    fs.writeFileSync(localPath(key), body);
    return;
  }
  const { put: blobPut } = await blob();
  await blobPut(key, body, {
    access: 'private',
    contentType: 'application/json',
    allowOverwrite: true,
  });
}

async function get(key) {
  if (localDir()) {
    const p = localPath(key);
    return fs.existsSync(p) ? JSON.parse(fs.readFileSync(p, 'utf8')) : null;
  }
  const { get: blobGet } = await blob();
  // access is required and throws if omitted -- it is not inferred from the
  // store. useCache:false so a status just written by the admin page reads
  // back immediately rather than after the CDN catches up.
  const res = await blobGet(key, { access: 'private', useCache: false });
  if (!res || res.statusCode !== 200 || !res.stream) return null;
  const text = await new Response(res.stream).text();
  return JSON.parse(text);
}

async function listAll() {
  if (localDir()) {
    if (!fs.existsSync(localDir())) return [];
    return fs.readdirSync(localDir())
      .filter((f) => f.startsWith('submissions__'))
      .map((f) => JSON.parse(fs.readFileSync(path.join(localDir(), f), 'utf8')));
  }
  const { list } = await blob();
  const out = [];
  let cursor;
  do {
    const page = await list({ prefix: PREFIX, cursor, limit: 1000 });
    cursor = page.cursor;
    const batch = await Promise.all(page.blobs.map((b) => get(b.pathname)));
    out.push(...batch.filter(Boolean));
  } while (cursor);
  return out;
}

function keyFor(submission) {
  return PREFIX + submission.submission_id + '.json';
}

module.exports = { put, get, listAll, keyFor, PREFIX };
