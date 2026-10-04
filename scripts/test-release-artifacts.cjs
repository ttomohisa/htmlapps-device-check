const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const zlib = require('node:zlib');
const root = path.join(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
// Only the build timestamp may differ. Source, app config and embedded assets must match.
function normalizeTimestamp(html) {
  const match = html.match(/const BUILD_MANIFEST = (\{[^\n]+\});/);
  assert.ok(match, 'generated build manifest must exist');
  const manifest = JSON.parse(match[1]);
  assert.ok(typeof manifest.generatedAtUtc === 'string' && !Number.isNaN(Date.parse(manifest.generatedAtUtc)));
  return html.replace(match[0], match[0].replace(/"generatedAtUtc":"[^"]+"/, '"generatedAtUtc":"<build-time>"'));
}
test('root download matches fresh readable release except build time', () => {
  assert.ok(normalizeTimestamp(read('device-check.html')) === normalizeTimestamp(read('dist/index.html')),
    'device-check.html is stale; copy dist/index.html to device-check.html after building and commit it');
});
test('self-extract payload restores the exact readable release bytes', () => {
  const match = read('dist/index.self-extract.html').match(/<script id="self-extract-payload" type="application\/octet-stream">([A-Za-z0-9+/=\r\n]+)<\/script>/);
  assert.ok(match);
  assert.deepEqual(zlib.gunzipSync(Buffer.from(match[1], 'base64')), fs.readFileSync(path.join(root, 'dist/index.html')));
});
test('timestamp normalization cannot hide runtime or config changes', () => {
  const html = read('dist/index.html'), normalized = normalizeTimestamp(html);
  assert.equal(normalizeTimestamp(html.replace(/"generatedAtUtc":"[^"]+"/, '"generatedAtUtc":"2000-01-01T00:00:00Z"')), normalized);
  for (const marker of ['function startCamera(', '"slug":"device-check"', 'const assetBundle =']) {
    assert.ok(html.includes(marker), marker);
    assert.notEqual(normalizeTimestamp(html.replace(marker, marker + 'STALE')), normalized);
  }
});
