// Synthetic behavioral regressions for Device Check. No physical devices or permissions are used.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const html = fs.readFileSync(process.env.DEVICE_CHECK_HTML || path.join(__dirname, '../src/index.template.html'), 'utf8');
const lines = html.split('\n');

test('the complete inline application script parses without duplicate declarations', () => {
  const scripts = [...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)];
  const app = scripts.map(item => item[1]).find(body => body.includes('const APP_CONFIG = '));
  assert.ok(app, 'the complete inline app script exists');
  assert.doesNotThrow(() => new vm.Script(app, { filename: 'device-check-app.js' }));
});

function appFunction(name) {
  const line = lines.find(line => line.startsWith('    function ' + name + '(') || line.startsWith('    async function ' + name + '('));
  assert.ok(line, 'real application function missing: ' + name);
  return line;
}
function classList() {
  const classes = new Set();
  return {
    add: key => classes.add(key),
    remove: key => classes.delete(key),
    contains: key => classes.has(key),
    toggle(key, enabled) { if (enabled) classes.add(key); else classes.delete(key); }
  };
}
const deferred = () => {
  let resolve, reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
};
function sensorHarness() {
  const nodes = new Map(), listeners = new Map(), requests = [], timers = new Map();
  let nextTimer = 0;
  const node = id => {
    if (!nodes.has(id)) nodes.set(id, { disabled: /Stop$/.test(id), textContent: '' });
    return nodes.get(id);
  };
  const request = () => { const d = deferred(); requests.push(d); return d.promise; };
  const sandbox = {
    window: { DeviceOrientationEvent: { requestPermission: request }, DeviceMotionEvent: { requestPermission: request } },
    $: node, t: key => key, fmt: number => String(number),
    setStatus: (kind, state) => { sandbox.testState[kind] = state; },
    testState: { sensor: 'idle' },
    addEventListener: (event, fn) => listeners.set(event, fn),
    removeEventListener: (event, fn) => { if (listeners.get(event) === fn) listeners.delete(event); },
    setTimeout: (fn, time) => { const id = ++nextTimer; timers.set(id, { fn, time }); return id; },
    clearTimeout: id => timers.delete(id),
    sensorListening: false, sensorReceived: false, sensorPending: false, sensorGeneration: 0, sensorWarningTimer: 0
  };
  const ctx = vm.createContext(sandbox);
  const functions = ['requestSensorPermission', 'onOrientation', 'onMotion', 'startSensors', 'stopSensors'];
  vm.runInContext(functions.map(appFunction).join('\n') +
    '\nthis.api={requestSensorPermission,startSensors,stopSensors,onOrientation,onMotion,snapshot:()=>({sensorListening,sensorPending,sensorGeneration,sensorReceived})};', ctx);
  return { api: ctx.api, sandbox, requests, listeners, timers, node };
}

test('iOS permission prompts are both requested before either resolves', async () => {
  const h = sensorHarness();
  const pending = h.api.requestSensorPermission();
  assert.equal(h.requests.length, 2, 'must request orientation and motion in the original user gesture');
  h.requests[0].resolve('granted');
  h.requests[1].resolve('granted');
  await pending;
});

test('a denied sensor permission is not interpreted as a successful start', async () => {
  const h = sensorHarness();
  const pending = h.api.startSensors();
  assert.equal(h.node('#sensorStart').disabled, true);
  assert.equal(h.node('#sensorStop').disabled, false);
  h.requests[0].resolve('granted'); h.requests[1].resolve('denied');
  await pending;
  assert.equal(h.sandbox.testState.sensor, 'warn');
  assert.equal(h.listeners.size, 0);
  assert.equal(h.node('#sensorStop').disabled, true);
  assert.equal(h.node('#sensorStart').disabled, false);
});

test('Stop before sensor permission returns invalidates pending listeners and status', async () => {
  const h = sensorHarness();
  const pending = h.api.startSensors();
  assert.equal(h.requests.length, 2);
  h.api.stopSensors();
  h.requests[0].resolve('granted');
  h.requests[1].resolve('granted');
  await pending;
  assert.equal(h.api.snapshot().sensorListening, false);
  assert.equal(h.sandbox.testState.sensor, 'idle');
  assert.equal(h.listeners.size, 0);
  assert.equal(h.node('#sensorStop').disabled, true);
  assert.equal(h.timers.size, 0);
});

test('repeated Start cannot create duplicate sensor listeners or permission prompts', async () => {
  const h = sensorHarness();
  const first = h.api.startSensors();
  await h.api.startSensors();
  assert.equal(h.requests.length, 2);
  h.requests.forEach(request => request.resolve('granted'));
  await first;
  assert.equal(h.listeners.size, 2);
  assert.equal(h.api.snapshot().sensorListening, true);
  h.listeners.get('devicemotion')({ accelerationIncludingGravity: { x: 1, y: 2, z: 3 } });
  assert.equal(h.sandbox.testState.sensor, 'pass');
  const oldMotionListener = h.listeners.get('devicemotion');
  h.api.stopSensors();
  assert.equal(h.listeners.size, 0);
  assert.equal(h.timers.size, 0);
  assert.equal(h.sandbox.testState.sensor, 'pass', 'previous confirmed result is preserved');
  oldMotionListener({ acceleration: { x: 100 } });
  assert.equal(h.node('#sensorAccX').textContent, '1', 'stale sensor event must not update the UI');
});

test('summary counts verified checks, not denied access or reported problems', () => {
  const nodes = new Map();
  const $ = id => {
    if (!nodes.has(id)) nodes.set(id, { textContent: '', style: {} });
    return nodes.get(id);
  };
  const ctx = vm.createContext({
    testState: { camera: 'pass', mic: 'warn', speaker: 'active', screen: 'idle' },
    $
  });
  vm.runInContext(appFunction('updateSummary') + '\nupdateSummary();', ctx);
  assert.equal($('#summaryScore').textContent, '1 / 4');
  assert.equal($('#summaryProgress').style.width, '25%');
});

test('quick diagnosis with zero verified steps is incomplete, not success', () => {
  const nodes = new Map();
  const node = id => {
    if (!nodes.has(id)) nodes.set(id, { textContent: '', dataset: {}, classList: classList() });
    return nodes.get(id);
  };
  const steps = Array.from({ length: 3 }, () => ({ classList: classList(), disabled: false }));
  const notifications = [];
  const ctx = vm.createContext({
    $: node, $$: () => steps, quickIndex: 2,
    quickTests: ['camera', 'mic', 'speaker'],
    testState: { camera: 'idle', mic: 'warn', speaker: 'idle' },
    t: key => key, showToast: (...args) => notifications.push(args)
  });
  vm.runInContext(appFunction('updateQuickDiagnosis') + '\n' + appFunction('finishQuickDiagnosis') +
    '\nfinishQuickDiagnosis();', ctx);
  assert.deepEqual(notifications, [['quickIncomplete (0/3)', 'warning']]);
  assert.equal(node('#quickDiagnosis').dataset.mobilePage, 'home');
  assert.equal(node('#quickScore').textContent, '0 / 3');
  assert.match(html, /body\[data-mobile-page="media"\] \.main>\.quick-diagnosis\.active:not\(\[hidden\]\)\{display:grid\}/);
});

test('60fps comparison uses time-derived reference frames on a 144Hz display', () => {
  const nodes = new Map(), raf = new Map();
  let count = 0, refUpdates = 0;
  const $ = id => {
    if (!nodes.has(id)) {
      const style = {};
      if (id === '#motionDot60') Object.defineProperty(style, 'left', {
        set(value) { this._left = value; refUpdates++; },
        get() { return this._left; }
      });
      nodes.set(id, { textContent: '', style: {}, ...{ style } });
    }
    return nodes.get(id);
  };
  const ctx = vm.createContext({
    $,
    performance: { now: () => 0 },
    fmt: n => String(Math.round(n)),
    screenMotionRaf: 0, screenMotionStart: 0, screenFrameTimes: [],
    requestAnimationFrame: fn => { const id = ++count; raf.set(id, fn); return id; },
    cancelAnimationFrame: id => raf.delete(id)
  });
  vm.runInContext(appFunction('stopScreenMotion') + '\n' + appFunction('startScreenMotion') + '\nstartScreenMotion();', ctx);
  for (let i = 0; i < 144; i++) {
    const [id, tick] = [...raf.entries()].at(-1);
    raf.delete(id);
    tick(i * 1000 / 144);
  }
  assert.ok(refUpdates >= 59 && refUpdates <= 61, 'expected ~60 reference updates, got ' + refUpdates);
});

test('display verification needs a user result; cancellation retains previous result', () => {
  const nodes = new Map(), states = [];
  const node = id => {
    if (!nodes.has(id)) nodes.set(id, {
      dataset: {}, classList: classList(), textContent: '', focus() {}, requestFullscreen: () => Promise.resolve()
    });
    return nodes.get(id);
  };
  const ctx = vm.createContext({
    $: node, testState: { screen: 'idle' }, screenPriorStatus: 'idle',
    setStatus(kind, state) { this.testState[kind] = state; states.push(state); },
    t: key => key, stopScreenMotion() {}, startScreenMotion() {},
    document: { fullscreenElement: null }
  });
  // setStatus must close over the same object, not the vm global's this binding.
  ctx.setStatus = (kind, state) => { ctx.testState[kind] = state; states.push(state); };
  vm.runInContext(appFunction('openScreen') + '\n' + appFunction('closeScreen') +
    '\nopenScreen("red");closeScreen();openScreen("blue");closeScreen("warn");', ctx);
  assert.deepEqual(states, ['active', 'idle', 'active', 'warn']);
});

test('gamepad disconnect checks for another connected pad', () => {
  const line = lines.find(line => line.includes("addEventListener('gamepaddisconnected'"));
  assert.ok(line);
  assert.match(line, /gamepaddisconnected'.*if\(currentGamepad\(\)\)\{pollGamepads\(\);return\}/);
});

test('mouse hover, iPad detection, fullscreen exit, and manual screen results remain wired', () => {
  assert.match(html, /pointerZone\.addEventListener\('pointerleave'.*activePointers\.has/);
  assert.doesNotMatch(html, /pointermove'&&e\.buttons===0/);
  assert.match(appFunction('detectPlatform'), /platform==='MacIntel'&&navigator\.maxTouchPoints>1/);
  assert.match(html, /id="screenLooksOk"/);
  assert.match(html, /id="screenIssue"/);
  assert.match(html, /document\.addEventListener\('fullscreenchange'/);
});
