// Static contracts for the actual CSS and localized Help content.
// Removing either native-modal page lock must fail. Browser scroll/geometry QA is separate.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');
const { gunzipSync } = require('node:zlib');
let html = fs.readFileSync(process.env.DEVICE_CHECK_HTML || path.join(__dirname, '../src/index.template.html'), 'utf8');
const payload = html.match(/<script id="self-extract-payload" type="application\/octet-stream">([A-Za-z0-9+/=\r\n]+)<\/script>/);
if (payload) html = gunzipSync(Buffer.from(payload[1], 'base64')).toString('utf8');
const css = [...html.matchAll(/<style\b[^>]*>([\s\S]*?)<\/style>/g)].map(match => match[1]).join('\n').replace(/\/\*[\s\S]*?\*\//g, '');
const rules = [...css.matchAll(/([^{}]+)\{([^{}]*)\}/g)].map(([, selectors, declarations]) => ({
  selectors: selectors.split(',').map(selector => selector.trim()),
  declarations: Object.fromEntries(declarations.split(';').filter(value => value.includes(':')).map(value => {
    const colon = value.indexOf(':');
    return [value.slice(0, colon).trim(), value.slice(colon + 1).trim()];
  }))
}));
const declarationsFor = selector => Object.assign({}, ...rules.filter(rule => rule.selectors.includes(selector)).map(rule => rule.declarations));

for (const element of ['html', 'body']) {
  test(`${element} locks page scrolling only while a native modal is present`, () => {
    assert.equal(declarationsFor(`${element}:has(dialog:modal)`).overflow, 'hidden', `${element} needs a native-modal overflow lock`);
    assert.ok(!['hidden', 'clip'].includes(declarationsFor(element).overflow), `${element} must remain scrollable without a modal`);
    assert.ok(!rules.some(rule => rule.selectors.includes(`${element}:has(dialog[open])`)), 'A non-modal open dialog must not lock the page');
  });
}

test('Help retains its existing bounded shell and independently scrolling content', () => {
  assert.equal(declarationsFor('dialog').overflow, 'hidden');
  assert.equal(declarationsFor('dialog')['max-height'], 'min(760px,calc(100dvh - 28px))');
  assert.equal(declarationsFor('.dialog-body').overflow, 'auto');
  assert.equal(declarationsFor('.dialog-body')['max-height'], 'calc(100dvh - 102px)');
  assert.match(html, /<dialog id="helpDialog" aria-labelledby="helpTitle">/);
  assert.match(html, /<button[^>]*id="closeHelpButton"[^>]*type="button"/);
});

test('Japanese and English Help explain existing ways to close without layout audit prose', () => {
  const help = html.match(/<!-- APP:HELP:BEGIN -->([\s\S]*?)<!-- APP:HELP:END -->/);
  assert.ok(help, 'Help content must stay in its source region');
  assert.match(help[1], /data-i18n="helpDialogUse"/);
  const context = vm.createContext({});
  const start = html.indexOf('    const translations=');
  const end = html.indexOf('    const $=');
  assert.ok(start >= 0 && end > start, 'Real translations must be present');
  vm.runInContext(html.slice(start, end) + '\nthis.copy=translations;', context);
  assert.doesNotMatch(context.copy.ja.helpDialogUse, /背景.*スクロール/);
  assert.match(context.copy.ja.helpDialogUse, /閉じる.*Esc.*外側/);
  assert.doesNotMatch(context.copy.en.helpDialogUse, /background.*scroll/i);
  assert.match(context.copy.en.helpDialogUse, /Close.*Esc.*outside/i);
});
