// Real localization functions and click bindings, with synthetic DOM/storage only.
// Reverting JA, dropping target-language descriptions, or stale Help copy must fail.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const test = require('node:test');
const { gunzipSync } = require('node:zlib');
let html = fs.readFileSync(process.env.DEVICE_CHECK_HTML || path.join(__dirname, '../src/index.template.html'), 'utf8');
const payload = html.match(/<script id="self-extract-payload" type="application\/octet-stream">([A-Za-z0-9+/=\r\n]+)<\/script>/);
if (payload) html = gunzipSync(Buffer.from(payload[1], 'base64')).toString('utf8');
const lines = html.split('\n');
const line = prefix => {
  const found = lines.find(value => value.startsWith(prefix));
  assert.ok(found, `Missing real application code: ${prefix}`);
  return found;
};
function harness({ language = 'en', stored, storageUnavailable = false } = {}) {
  const nodes = [], ids = new Map(), storage = new Map();
  if (stored) storage.set('device-check:language', stored);
  for (const match of html.matchAll(/<([\w-]+)\b([^>]*)>/g)) {
    const attributes = Object.fromEntries([...match[2].matchAll(/([\w-]+)(?:="([^"]*)")?/g)].map(m => [m[1], m[2] ?? '']));
    const n = { attributes, textContent: '', dataset: {}, listeners: {}, open: false,
      setAttribute(key, value) { this.attributes[key] = String(value); },
      getAttribute(key) { return this.attributes[key] ?? null; },
      addEventListener(type, fn) { this.listeners[type] = fn; },
      click() { this.listeners.click?.({ target: this, currentTarget: this }); },
      showModal() { this.open = true; }, close() { this.open = false; }
    };
    Object.defineProperty(n, 'title', { get() { return this.getAttribute('title') || ''; }, set(value) { this.setAttribute('title', value); } });
    for (const [key, value] of Object.entries(attributes)) if (key.startsWith('data-')) n.dataset[key.slice(5).replace(/-([a-z])/g, (_, c) => c.toUpperCase())] = value;
    nodes.push(n); if (attributes.id) ids.set('#' + attributes.id, n);
  }
  const document = { documentElement: {} };
  const $ = selector => { assert.ok(ids.has(selector), `Missing ${selector}`); return ids.get(selector); };
  const $$ = selector => { const attr = selector.match(/^\[([^\]]+)\]$/)?.[1]; assert.ok(attr, selector); return nodes.filter(n => attr in n.attributes); };
  const context = vm.createContext({ document, $, $$, navigator: { language },
    APP_CONFIG: { slug: 'device-check', name: 'Device Check', nameJa: 'Device Check', defaultLanguage: 'auto' },
    localStorage: { getItem(key) { if (storageUnavailable) throw Error('Unavailable'); return storage.get(key) ?? null; }, setItem(key, value) { if (storageUnavailable) throw Error('Unavailable'); storage.set(key, value); } },
    testState: {}, updateEnvironment() {}, renderCapabilities() {}, renderKeyboardMap() {}, updateQuickDiagnosis() {}, updateGamepadHapticState() {}, renderMediaState() {}
  });
  vm.runInContext(html.slice(html.indexOf('    const translations='), html.indexOf('    const $=')) + '\n' +
    ['readStorage', 'writeStorage', 'detectLanguage', 't', 'applyLanguage'].map(name => line('    function ' + name + '(')).join('\n') + '\n' +
    line('    const storageKey=') + '\n' + line('    let language=') + '\n' +
    line("    $('#languageButton').addEventListener") + '\n' + line("    const helpDialog=$('#helpDialog');") + '\napplyLanguage();', context);
  return { $, document, storage };
}
function assertHeader(h, language) {
  const target = language === 'ja' ? '英語に切り替え' : 'Switch to Japanese';
  const help = language === 'ja' ? '使い方と注意事項' : 'How to use & notes';
  assert.equal(h.document.documentElement.lang, language);
  assert.equal(h.$('#languageButton').textContent, language === 'ja' ? 'EN' : 'JA');
  assert.equal(h.$('#languageButton').getAttribute('aria-label'), target);
  assert.equal(h.$('#languageButton').title, target);
  assert.equal(h.$('#helpButton').getAttribute('aria-label'), help);
  assert.equal(h.$('#helpButton').title, help);
  assert.equal(h.$('#helpTitle').textContent, help);
  assert.equal(h.$('#closeHelpButton').getAttribute('aria-label'), language === 'ja' ? '閉じる' : 'Close');
  assert.equal(h.$('#closeHelpButton').title, language === 'ja' ? '閉じる' : 'Close');
}
for (const language of ['ja', 'en']) {
  test(`${language}: fresh header uses compact target-language labels and localized descriptions`, () => assertHeader(harness({ language }), language));
  test(`${language}: repeated clicks persist and restore the header`, () => {
    const h = harness({ stored: language, language: language === 'ja' ? 'en' : 'ja' });
    let current = language;
    for (let i = 0; i < 4; i++) {
      assertHeader(h, current);
      h.$('#languageButton').click();
      current = current === 'ja' ? 'en' : 'ja';
      assert.equal(h.storage.get('device-check:language'), current);
      assertHeader(harness({ stored: current }), current);
    }
  });
}
test('language switching works when localStorage is unavailable', () => {
  const h = harness({ language: 'ja', storageUnavailable: true });
  assertHeader(h, 'ja'); h.$('#languageButton').click(); assertHeader(h, 'en');
});
test('existing Help close control stays localized while open', () => {
  const h = harness({ language: 'ja' }); h.$('#helpButton').click();
  assert.equal(h.$('#helpDialog').open, true);
  assert.equal(h.$('#closeHelpButton').getAttribute('aria-label'), '閉じる');
  h.$('#languageButton').click();
  assert.equal(h.$('#closeHelpButton').getAttribute('aria-label'), 'Close');
  h.$('#closeHelpButton').click(); assert.equal(h.$('#helpDialog').open, false);
});
test('header keeps its original no-badge layout', () => {
  const header = html.match(/<header\b[^>]*>[\s\S]*?<\/header>/)?.[0];
  assert.ok(header); assert.doesNotMatch(header, /privacy-badge|localOnly|完全ローカル処理/);
});
test('initial Japanese HTML describes the language target before initialization', () => {
  const button = html.match(/<button[^>]*id="languageButton"[^>]*>/)[0];
  assert.match(button, /aria-label="英語に切り替え"/);
  assert.match(button, /title="英語に切り替え"/);
});
