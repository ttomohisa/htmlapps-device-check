// Regression tests use actual production functions with simulated browser/device APIs.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const html = fs.readFileSync(process.env.DEVICE_CHECK_HTML || path.join(__dirname, '../src/index.template.html'), 'utf8');
const lines = html.split('\n');
function source(name) {
  const line = lines.find(s => s.startsWith('    function ' + name + '(') || s.startsWith('    async function ' + name + '('));
  assert.ok(line, 'production function missing: ' + name);
  return line;
}
function cls() {
  const values = new Set();
  return { add: x => values.add(x), remove: x => values.delete(x), contains: x => values.has(x) };
}
function fakeNodes() {
  const map = new Map();
  function get(key) {
    if (!map.has(key)) {
      const n = { textContent: '', disabled: false, value: '35', style: {}, classList: cls(), children: [],
        append(c) { this.children.push(c); }, querySelector() { return {textContent:''}; } };
      Object.defineProperty(n, 'innerHTML', { set() { n.children.length = 0; } });
      map.set(key, n);
    }
    return map.get(key);
  }
  return { get, map };
}
function gamepadHarness({ blocked = false } = {}) {
  const { get, map } = fakeNodes(), states = [], toasts = [], eventHandlers = {};
  let pads = [];
  const raf = new Map();
  let nextRaf = 0;
  const dom = {
    createElement: () => {
      const n = {textContent:'',className:'',classList:cls(),children:[],
        append(c){this.children.push(c)},querySelector:()=>({textContent:''})};
      Object.defineProperty(n, 'innerHTML', {set(){n.children=[]}});
      return n;
    }
  };
  const sandbox = {
    navigator: {getGamepads() {if(blocked)throw Object.assign(new Error('Blocked by policy'),{name:'SecurityError'});return pads}},
    $: get, document: dom, gamepadRaf: 0, observedGamepadKey: '',
    t: x => x, setStatus: (key, value) => states.push([key,value]), showToast: (...args) => toasts.push(args),
    addEventListener: (key, fn) => eventHandlers[key] = fn,
    requestAnimationFrame: fn => {const id=++nextRaf;raf.set(id,fn);return id},
    cancelAnimationFrame: id=>raf.delete(id)
  };
  const ctx = vm.createContext(sandbox);
  const gamepadFns = ['getGamepadList','currentGamepad','getHapticActuator','updateGamepadHapticState','pollGamepads'].map(source).join('\n');
  const eventBinding = lines.find(line => line.includes("addEventListener('gamepadconnected'"));
  assert.ok(eventBinding);
  vm.runInContext(gamepadFns+'\n'+eventBinding+'\nthis.api={currentGamepad,pollGamepads};',ctx);
  return {ctx,get,map,states,toasts,eventHandlers,raf,setPads: next =>{pads=next}};
}

test('blocked Gamepad API cannot stop initialization of other device tests', () => {
  const h = gamepadHarness({blocked:true});
  assert.equal(h.ctx.api.currentGamepad(),null);
  assert.deepEqual(h.states.slice(-1), [['gamepad','unsupported']]);
  h.eventHandlers.gamepadconnected();
  assert.equal(h.ctx.api.currentGamepad(),null);
});

test('gamepad confirms only actual button or stick movement, not connection alone', () => {
  const h = gamepadHarness();
  const pad = {index:0,id:'Pad A',buttons:[{pressed:false,value:0}],axes:[0]};
  h.setPads([pad]);
  h.ctx.api.pollGamepads();
  assert.deepEqual(h.states.slice(-1), [['gamepad','active']]);
  assert.equal(h.raf.size,1);
  pad.buttons[0].pressed=true;
  h.ctx.api.pollGamepads();
  assert.deepEqual(h.states.slice(-1), [['gamepad','pass']]);
  const pad2={index:1,id:'Pad B',buttons:[{pressed:false,value:0}],axes:[0]};
  h.setPads([null,pad2]);
  h.ctx.api.pollGamepads();
  assert.deepEqual(h.states.slice(-1), [['gamepad','active']],'new controller must be tested separately');
  pad2.axes[0]=.65;
  h.ctx.api.pollGamepads();
  assert.deepEqual(h.states.slice(-1), [['gamepad','pass']]);
});

function speakerHarness({panMode='stereo',suspendResume=false}={}) {
  const {get}=fakeNodes(), contexts=[], statuses=[], toasts=[], channels=[], allOscillators=[];
  let firstResumeResolve;
  class FakeAudio {
    constructor(){
      this.state='running';this.currentTime=0;this.destination={};
      this.created=[];contexts.push(this);
    }
    resume(){
      if(this.state==='closed')return Promise.reject(new Error('Context closed'));
      if(suspendResume && contexts.length===1)return new Promise(resolve=>{firstResumeResolve=resolve});
      return Promise.resolve();
    }
    close(){this.state='closed';return Promise.resolve()}
    createOscillator(){
      const osc={stops:[],frequency:{value:0},connect(){},start(){this.started=true},
        stop(time){this.stops.push(time)}};
      this.created.push(osc);allOscillators.push(osc);return osc;
    }
    createGain(){return {gain:{setValueAtTime(){},linearRampToValueAtTime(){}},connect(target,index,channel){if(target?.isMerger)channels.push(channel)}}}
    createStereoPanner(){
      if(panMode!=='stereo')throw new Error('Stereo panner unavailable');
      return {pan:{value:0},connect(){}};
    }
    createChannelMerger(){return {isMerger:true,connect(){}}}
  }
  if(panMode!=='stereo')delete FakeAudio.prototype.createStereoPanner;
  if(panMode==='none')delete FakeAudio.prototype.createChannelMerger;
  const ctx=vm.createContext({
    window:{AudioContext:FakeAudio},$:get,t:key=>key,
    setStatus:(...args)=>statuses.push(args),showToast:(...args)=>toasts.push(args),
    updateQuickDiagnosis(){}, quickIndex:-1,quickSpeakerPlayed:false,
    quickCompleted:new Set(),quickWarned:new Set(),speakerContext:null,activeSpeakerOscillator:null,
    speakerPlaybackGeneration:0,gamepadRaf:0,cancelAnimationFrame(){},stopCamera(){},stopMic(){},stopSensors(){},stopScreenMotion(){}
  });
  const pagehide = lines.find(line=>line.includes("addEventListener('pagehide',()=>{stopCamera()"));
  assert.ok(pagehide);
  const listeners={};
  ctx.addEventListener=(name,callback)=>listeners[name]=callback;
  vm.runInContext(source('markQuickResult')+'\n'+source('stopSpeakerTone')+'\n'+source('playTone')+
    '\n'+pagehide+'\nthis.api={playTone,speakerState:()=>speakerContext?.state};',ctx);
  return {api:ctx.api,contexts,allOscillators,channels,statuses,toasts,listeners,
    resolveFirst:()=>firstResumeResolve?.()};
}
test('speaker works after pagehide/bfcache style restoration',async()=>{
  const h=speakerHarness();
  await h.api.playTone(0);
  assert.equal(h.contexts.length,1);
  assert.equal(h.contexts[0].state,'running');
  h.listeners.pagehide();
  assert.equal(h.contexts[0].state,'closed');
  await h.api.playTone(0);
  assert.equal(h.contexts.length,2);
  assert.equal(h.contexts[1].state,'running');
  assert.equal(h.statuses.at(-1)[1],'active');
});
test('rapid speaker clicks stop the old tone before starting the next one',async()=>{
  const h=speakerHarness();
  await h.api.playTone(0);
  await h.api.playTone(0);
  assert.equal(h.allOscillators.length,2);
  assert.ok(h.allOscillators[0].stops.length>=2,'first oscillator must be stopped immediately on next click');
});
test('unsupported stereo positioning never silently plays centered as left or right',async()=>{
  const noPan=speakerHarness({panMode:'none'});
  await noPan.api.playTone(-1);
  assert.equal(noPan.allOscillators.length,0);
  assert.equal(noPan.statuses.at(-1)[1],'warn');
  assert.equal(noPan.toasts.at(-1)[1],'warning');
  const merger=speakerHarness({panMode:'merger'});
  await merger.api.playTone(-1);
  await merger.api.playTone(1);
  assert.deepEqual(merger.channels,[0,1]);
});
test('delayed old speaker resume cannot start audio after pagehide',async()=>{
  const h=speakerHarness({suspendResume:true});
  const pending=h.api.playTone(0);
  h.listeners.pagehide();
  h.resolveFirst();
  await pending;
  assert.equal(h.allOscillators.length,0);
});

test('display overlay uses translated names instead of raw internal pattern codes',()=>{
  const labels={graySteps:'16 steps',fineLines:'Fine lines',rgbGradient:'RGB gradient',motionTest:'Motion test'};
  const overlay={classList:cls(),dataset:{},focus(){},requestFullscreen(){return Promise.resolve()}};
  const outputs=new Map();
  const $=id=>id==='#screenOverlay'?overlay:(outputs.get(id)||(()=>{const n={textContent:''};outputs.set(id,n);return n})());
  const ctx=vm.createContext({$,t:key=>labels[key]||key,
    testState:{screen:'idle'},screenPriorStatus:'idle',stopScreenMotion(){},startScreenMotion(){},
    setStatus(){},document:{fullscreenElement:null}});
  vm.runInContext(source('openScreen')+'\nthis.openScreen=openScreen;',ctx);
  for(const pattern of ['graysteps','lines','rgb','motion']){
    ctx.openScreen(pattern);
    assert.ok(![pattern].includes($('#screenOverlayLabel').textContent));
  }
});
