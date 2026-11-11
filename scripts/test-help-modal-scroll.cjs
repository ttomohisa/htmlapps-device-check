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

test('Help is concise, bilingual, and keeps material limitations', () => {
  const help = html.match(/<!-- APP:HELP:BEGIN -->([\s\S]*?)<!-- APP:HELP:END -->/);
  assert.ok(help, 'Help content must stay in its source region');
  assert.doesNotMatch(help[1], /data-i18n="helpDialogUse"/, 'Closing instructions do not need to take space in the UI');
  const lists = [...help[1].matchAll(/<li data-i18n="([^"]+)"/g)].map(m => m[1]);
  assert.equal(lists.length, 8, 'Three short steps and five important notes');
  for (const key of ['helpStep1', 'helpStep2', 'helpStep3', 'helpPrivacyBody', 'helpOffline',
    'helpNotePermission', 'helpNoteContext', 'helpMediaLifecycle', 'helpKeyboardReset', 'helpNoteLimitation']) {
    assert.match(help[1], new RegExp('data-i18n="' + key + '"'), key + ' must remain in Help');
  }
  const context = vm.createContext({});
  const start = html.indexOf('    const translations=');
  const end = html.indexOf('    const $=');
  assert.ok(start >= 0 && end > start, 'Real translations must be present');
  vm.runInContext(html.slice(start, end) + '\nthis.copy=translations;', context);
  const ja = context.copy.ja, en = context.copy.en;
  for (const key of ['helpStep1', 'helpStep2', 'helpStep3', 'helpPrivacyBody', 'helpOffline',
    'helpNotePermission', 'helpNoteContext', 'helpMediaLifecycle', 'helpKeyboardReset', 'helpNoteLimitation']) {
    assert.ok(ja[key] && en[key], key + ': translation must be bilingual');
  }
  assert.doesNotMatch(ja.helpStep1, /閉じる|Esc/);
  assert.doesNotMatch(en.helpStep1, /Close|Esc/);
  assert.match(ja.helpNotePermission, /許可/);
  assert.match(en.helpNotePermission, /permission/);
  assert.match(ja.helpNoteContext, /HTTPS/);
  assert.match(en.helpNoteContext, /HTTPS/);
  assert.match(ja.helpPrivacyBody, /送信しません/);
  assert.match(en.helpPrivacyBody, /not sent/);
  assert.match(ja.helpOffline, /言語.*クイック診断/);
  assert.match(en.helpOffline, /language and quick-check/);
  assert.match(ja.helpNoteLimitation, /故障は断定できません。/);
  assert.match(en.helpNoteLimitation, /cannot confirm whether hardware is faulty/);
  assert.equal(ja.introTitle, '端末の動作を確認する');
  assert.equal(en.introTitle, 'Check your device');
  assert.ok(ja.lead.length < 65 && en.lead.length < 110, 'Hero descriptions remain short');
});
