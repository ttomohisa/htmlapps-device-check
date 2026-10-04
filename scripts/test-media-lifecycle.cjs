// Runs actual application functions with synthetic media boundaries. No devices or permissions are used.
// Removing generation guards, operation cleanup, or setup-error handling must fail these tests.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const nodeTest = require('node:test');
const test = (name, fn) => nodeTest(name, { timeout: 1000 }, fn);
const html = fs.readFileSync(process.env.DEVICE_CHECK_HTML || path.join(__dirname, '../src/index.template.html'), 'utf8');
const translations = html.slice(html.indexOf('    const translations='), html.indexOf('    const $='));
const state = html.slice(html.indexOf('    const testState='), html.indexOf('    const uniqueKeys='));
const actualFunctions = html.slice(html.indexOf('    function friendlyMediaError('), html.indexOf('    async function playTone(')) + '\n' + ['t','setStatus','updateSummary','applyLanguage'].map(name=>html.split('\n').find(line=>line.startsWith('    function '+name+'('))).join('\n');
const bindings = html.split('\n').filter(line=>line.includes("$('#cameraStart').addEventListener")||line.includes("$('#micStart').addEventListener")).join('\n');
const pagehide = html.split('\n').find(line=>line.includes("addEventListener('pagehide',()=>{stopCamera()"));
const deferred = () => { let resolve, reject; const promise = new Promise((a,b) => { resolve=a;reject=b; }); return {promise,resolve,reject}; };
const tick = async () => { for(let i=0;i<15;i++) await Promise.resolve(); };
const error = name => Object.assign(new Error('Synthetic '+name), {name});
function stream(name, kind='video') {
  const track={name,kind,readyState:'live',stops:0,listeners:{},removeEventListener(type,fn){if(this.listeners[type]===fn)delete this.listeners[type]},end(){this.readyState='ended';this.listeners.ended?.()},stop(){this.stops++;this.readyState='ended';},getSettings(){return kind==='video'?{width:640,height:480,frameRate:30,deviceId:name}:{sampleRate:48000,channelCount:2,deviceId:name};},addEventListener(type,fn){this.listeners[type]=fn;}};
  return {name,track,getTracks(){return [track]},getVideoTracks(){return kind==='video'?[track]:[]},getAudioTracks(){return kind==='audio'?[track]:[]}};
}
function harness(config={}) {
  const nodes=new Map(), requests=[], enums=[], contexts=[], raf=new Map(), listeners={}, toasts=[];
  let nextRaf=0;
  function node(id) {
    if(nodes.has(id))return nodes.get(id);
    const classes=new Set();
    const n={id,value:'',textContent:'',style:{},dataset:{},disabled: /Stop$/.test(id),options:[],srcObject:null,clientWidth:720,clientHeight:118,listeners:{},addEventListener(type,fn){this.listeners[type]=fn},
      classList:{add:c=>classes.add(c),remove:c=>classes.delete(c),contains:c=>classes.has(c),toggle(c,on){on?classes.add(c):classes.delete(c)}},setAttribute(k,v){this[k]=v},pause(){},
      play:()=>config.play?config.play():Promise.resolve(),
      append(o){this.options.push(o)},getContext(){return {clearRect(){},fillRect(){},beginPath(){},moveTo(){},lineTo(){},stroke(){}}}};
    Object.defineProperty(n,'innerHTML',{set(){n.options=[]}});nodes.set(id,n);return n;
  }
  class AudioContext {
    constructor(){if(config.constructFails)throw error('NotSupportedError');this.state=config.contextState||'running';this.nodes=[];this.sampleRate=48000;this.closed=0;this.destination={};contexts.push(this);}
    resume(){return config.resume?config.resume():Promise.resolve()}
    close(){this.closed++;return Promise.resolve()}
    createMediaStreamSource(s){if(config.sourceFails)throw error('InvalidStateError');assert.ok(s);return this.makeNode()}
    makeNode(extra={}){const n={connect(){},disconnect(){this.disconnected=true},...extra};this.nodes.push(n);return n}
    createAnalyser(){return this.makeNode({fftSize:2048,getFloatTimeDomainData(a){a.fill(.01)}})}
    createChannelSplitter(){return this.makeNode()}
    createGain(){if(config.gainFails)throw error('InvalidStateError');return this.makeNode({gain:{value:1}})}
  }
  const ctx=vm.createContext({console,Float32Array,Intl,devicePixelRatio:1,
    navigator:{mediaDevices:{getUserMedia(constraints){const d=deferred();requests.push({...d,constraints});return d.promise;},enumerateDevices(){const d=deferred();enums.push(d);if(!config.deferEnumeration){config.enumerationError?d.reject(error(config.enumerationError)):d.resolve([]);}return d.promise;}}},
    window:config.noAudioContext?{}:{AudioContext},
    document:{documentElement:{},createElement:()=>({value:'',textContent:''})},
    $:node,$$:()=>[],language:'en',APP_CONFIG:{name:'Device Check',nameJa:'Device Check'},updateEnvironment(){},renderCapabilities(){},renderKeyboardMap(){},updateQuickDiagnosis(){},updateGamepadHapticState(){},fmt:(v,n=0)=>Number(v).toFixed(n),showToast:(...a)=>toasts.push(a),
    requestAnimationFrame(fn){const id=++nextRaf;raf.set(id,fn);return id;},cancelAnimationFrame(id){raf.delete(id)},
    addEventListener(type,fn){listeners[type]=fn},stopSensors(){},stopScreenMotion(){},
  });
  vm.runInContext(`${translations}\n${state}\n${actualFunctions}\n${pagehide}\n${bindings}\nthis.api={startCamera,stopCamera,startMic,stopMic,getMediaStreamWithFallback,changeLanguage:(value)=>{language=value;applyLanguage()},snapshot:()=>({cameraStream,micStream,micAudioContext,micRaf,testState:{...testState}})};`,ctx);
  return {api:ctx.api,requests,enums,contexts,raf,nodes,node,listeners,toasts};
}

const begin = (h,kind='camera') => kind==='camera'?h.api.startCamera():h.api.startMic();
const stop = (h,kind='camera') => kind==='camera'?h.api.stopCamera():h.api.stopMic();
const acquired = async(h,kind='camera',name='current') => {const p=begin(h,kind),s=stream(name,kind==='camera'?'video':'audio');h.requests.at(-1).resolve(s);await p;return s};
for(const kind of ['camera','mic']) {
 test(`${kind}: pending Start disables repeats in UI and exposes Stop immediately`,async()=>{const h=harness(),p=begin(h,kind);assert.equal(h.node(`#${kind}Start`).disabled,true);assert.equal(h.node(`#${kind}Stop`).disabled,false);stop(h,kind);h.requests[0].resolve(stream('late',kind==='camera'?'video':'audio'));await p});
 test(`${kind}: overlapping starts release every obsolete resource`,async()=>{const h=harness(),a=stream('old',kind==='camera'?'video':'audio'),b=stream('new',kind==='camera'?'video':'audio');const p=begin(h,kind),q=begin(h,kind);h.requests[1].resolve(b);await q;h.requests[0].resolve(a);await p;assert.equal(a.track.readyState,'ended');assert.equal(b.track.readyState,'live');stop(h,kind);assert.equal(b.track.readyState,'ended');assert.ok(h.contexts.every(c=>c.closed===1));assert.equal(h.raf.size,0)});
 test(`${kind}: pagehide invalidates pending acquisition`,async()=>{const h=harness(),a=stream('late',kind==='camera'?'video':'audio'),p=begin(h,kind);h.listeners.pagehide();h.requests[0].resolve(a);await p;assert.equal(a.track.readyState,'ended');assert.notEqual(h.api.snapshot().testState[kind],'pass');assert.equal(h.node(`#${kind}Stop`).disabled,true);assert.equal(h.raf.size,0);assert.ok(h.contexts.every(c=>c.closed===1));if(kind==='camera')assert.equal(h.node('#cameraVideo').srcObject,null)});
 test(`${kind}: stale failure cannot overwrite newer success`,async()=>{const h=harness(),p=begin(h,kind);await acquired(h,kind);h.requests[0].reject(error('NotAllowedError'));await p;assert.equal(h.api.snapshot().testState[kind],'pass');assert.equal(h.node(`#${kind}Stop`).disabled,false)});
 test(`${kind}: enumeration failure is recoverable and capture remains stoppable`,async()=>{const h=harness({enumerationError:'NotReadableError'}),s=await acquired(h,kind);assert.equal(h.api.snapshot().testState[kind],'pass');assert.equal(h.node(`#${kind}Stop`).disabled,false);assert.match(h.node(`#${kind}Hint`).textContent,/device list/i);stop(h,kind);assert.equal(s.track.readyState,'ended');assert.ok(h.contexts.every(c=>c.closed===1));assert.equal(h.raf.size,0)});
 test(`${kind}: Stop while enumerating cannot be undone by completion`,async()=>{const h=harness({deferEnumeration:true}),p=begin(h,kind),s=stream('current',kind==='camera'?'video':'audio');h.requests[0].resolve(s);await tick();assert.equal(h.enums.length,1);stop(h,kind);h.enums[0].resolve([{kind:kind==='camera'?'videoinput':'audioinput',deviceId:'obsolete',label:'Old'}]);await p;assert.equal(s.track.readyState,'ended');assert.equal(h.node(`#${kind}Stop`).disabled,true);assert.notEqual(h.api.snapshot().testState[kind],'pass');assert.equal(h.node(`#${kind}Select`).options.length,0)});
 test(`${kind}: stale selected-device rejection cannot start fallback after pagehide`,async()=>{const h=harness();h.node(`#${kind}Select`).value='selected';const p=begin(h,kind);h.listeners.pagehide();h.requests[0].reject(error('OverconstrainedError'));await tick();assert.equal(h.requests.length,1);await p;assert.equal(h.node(`#${kind}Select`).value,'selected')});
 test(`${kind}: current selected-device fallback requests only its media type`,async()=>{const h=harness();h.node(`#${kind}Select`).value='missing';const p=begin(h,kind);h.requests[0].reject(error('OverconstrainedError'));await tick();assert.equal(h.requests.length,2);assert.equal(h.requests[1].constraints[kind==='camera'?'audio':'video'],false);assert.equal(h.requests[1].constraints[kind==='camera'?'video':'audio'],true);h.requests[1].resolve(stream('default',kind==='camera'?'video':'audio'));await p;assert.equal(h.api.snapshot().testState[kind],'pass');stop(h,kind)});
 test(`${kind}: current ended event cleans up and allows retry; stale ended is ignored`,async()=>{const h=harness(),a=await acquired(h,kind,'old'),oldEnded=a.track.listeners.ended,b=await acquired(h,kind,'new');oldEnded?.();assert.equal(b.track.readyState,'live');assert.equal(h.api.snapshot().testState[kind],'pass');b.track.end();assert.equal(h.node(`#${kind}Stop`).disabled,true);assert.equal(h.node(`#${kind}Start`).disabled,false);assert.equal(h.api.snapshot().testState[kind],'warn');assert.equal(h.raf.size,0);await acquired(h,kind,'retry');assert.equal(h.api.snapshot().testState[kind],'pass');stop(h,kind)});
 test(`${kind}: repeat start/stop cycles leave no tracks, contexts, graph nodes, or frames`,async()=>{const h=harness();for(let i=0;i<4;i++){const s=await acquired(h,kind);stop(h,kind);stop(h,kind);assert.equal(s.track.readyState,'ended');assert.equal(h.raf.size,0)}assert.ok(h.contexts.every(c=>c.closed===1&&c.nodes.every(n=>n.disconnected)));assert.equal(h.api.snapshot().testState[kind],'pass');assert.match(h.node(`#${kind}Hint`).textContent,/stopped/i)});
 test(`${kind}: language changes preserve pending and stopped hints`,async()=>{const h=harness(),p=begin(h,kind);h.api.changeLanguage('ja');assert.match(h.node(`#${kind}Hint`).textContent,/開始|準備|許可/);stop(h,kind);h.api.changeLanguage('en');assert.match(h.node(`#${kind}Hint`).textContent,/stopped/i);h.requests[0].resolve(stream('late',kind==='camera'?'video':'audio'));await p;assert.match(h.node(`#${kind}Hint`).textContent,/stopped/i)});
}
test('camera: rejected preview playback releases track and never marks checked',async()=>{const h=harness({play:()=>Promise.reject(error('NotAllowedError'))}),s=await acquired(h);assert.equal(s.track.readyState,'ended');assert.equal(h.node('#cameraVideo').srcObject,null);assert.equal(h.api.snapshot().testState.camera,'warn');assert.equal(h.node('#cameraStop').disabled,true);assert.ok(!h.toasts.some(t=>t[1]==='success'))});
test('camera: Stop while playback waits clears attachment and late completion is inert',async()=>{const d=deferred(),h=harness({play:()=>d.promise}),p=begin(h),s=stream('late');h.requests[0].resolve(s);await tick();stop(h);d.resolve();await p;assert.equal(s.track.readyState,'ended');assert.equal(h.node('#cameraVideo').srcObject,null);assert.equal(h.api.snapshot().testState.camera,'idle')});
test('mic: missing Web Audio never requests permission or acquires a track',async()=>{const h=harness({noAudioContext:true}),p=begin(h,'mic');await tick();assert.equal(h.requests.length,0);await p;assert.equal(h.api.snapshot().testState.mic,'unsupported');assert.equal(h.node('#micStop').disabled,true)});
test('mic: rejected resume releases tracks and context and never marks checked',async()=>{const h=harness({resume:()=>Promise.reject(error('NotAllowedError'))}),s=await acquired(h,'mic');assert.equal(s.track.readyState,'ended');assert.equal(h.contexts[0].closed,1);assert.equal(h.api.snapshot().testState.mic,'warn');assert.equal(h.raf.size,0)});
test('mic: Stop while resume waits closes operation context and late completion is inert',async()=>{const d=deferred(),h=harness({resume:()=>d.promise}),p=begin(h,'mic'),s=stream('late','audio');h.requests[0].resolve(s);await tick();stop(h,'mic');d.resolve();await p;assert.equal(s.track.readyState,'ended');assert.equal(h.contexts[0].closed,1);assert.equal(h.raf.size,0);assert.equal(h.api.snapshot().testState.mic,'idle')});
for(const config of [{constructFails:true},{sourceFails:true}])test(`mic: setup failure ${Object.keys(config)[0]} releases all owned resources`,async()=>{const h=harness(config),s=await acquired(h,'mic');assert.equal(s.track.readyState,'ended');assert.ok(h.contexts.every(c=>c.closed===1&&c.nodes.every(n=>n.disconnected)));assert.equal(h.raf.size,0);assert.equal(h.api.snapshot().testState.mic,'warn')});
test('camera and mic generations are independent',async()=>{const h=harness(),cam=await acquired(h),mic=await acquired(h,'mic');stop(h);assert.equal(cam.track.readyState,'ended');assert.equal(mic.track.readyState,'live');assert.equal(h.api.snapshot().testState.mic,'pass');assert.equal(h.raf.size,1);await acquired(h);stop(h,'mic');assert.ok(h.node('#cameraVideo').srcObject);assert.equal(h.api.snapshot().testState.camera,'pass');stop(h)});

for(const kind of ['camera','mic']) {
 test(`${kind}: device change while pending invalidates earlier selection`,async()=>{const h=harness();const p=begin(h,kind);h.node(`#${kind}Select`).value='new-device';h.node(`#${kind}Select`).listeners.change();assert.equal(h.requests.length,2);assert.equal(h.requests[1].constraints[kind==='camera'?'video':'audio'].deviceId.exact,'new-device');const newer=stream('new-device',kind==='camera'?'video':'audio');h.requests[1].resolve(newer);await tick();const older=stream('old-device',kind==='camera'?'video':'audio');h.requests[0].resolve(older);await p;assert.equal(older.track.readyState,'ended');assert.equal(newer.track.readyState,'live');assert.equal(h.api.snapshot().testState[kind],'pass');stop(h,kind)});
 test(`${kind}: earlier request resolving first cannot leak while newer is pending`,async()=>{const h=harness(),p=begin(h,kind),q=begin(h,kind),a=stream('old',kind==='camera'?'video':'audio');h.requests[0].resolve(a);await p;assert.equal(a.track.readyState,'ended');assert.equal(h.api.snapshot().testState[kind],'active');const b=stream('new',kind==='camera'?'video':'audio');h.requests[1].resolve(b);await q;stop(h,kind);assert.equal(b.track.readyState,'ended');assert.equal(h.raf.size,0)});
 test(`${kind}: empty capture result fails honestly and releases all returned tracks`,async()=>{const h=harness(),p=begin(h,kind),s=stream('wrong-kind',kind==='camera'?'audio':'video');h.requests[0].resolve(s);await p;assert.equal(s.track.readyState,'ended');assert.equal(h.api.snapshot().testState[kind],'warn');assert.equal(h.node(`#${kind}Stop`).disabled,true)});
 test(`${kind}: default-device fallback rejection never loops or leaves checking`,async()=>{const h=harness();h.node(`#${kind}Select`).value='missing';const p=begin(h,kind);h.requests[0].reject(error('OverconstrainedError'));await tick();h.requests[1].reject(error('OverconstrainedError'));await p;assert.equal(h.requests.length,2);assert.equal(h.api.snapshot().testState[kind],'warn');assert.equal(h.node(`#${kind}Start`).disabled,false)});
 test(`${kind}: language changes preserve a recoverable list warning`,async()=>{const h=harness({enumerationError:'NotReadableError'});await acquired(h,kind);h.api.changeLanguage('ja');assert.match(h.node(`#${kind}Hint`).textContent,/一覧/);h.api.changeLanguage('en');assert.match(h.node(`#${kind}Hint`).textContent,/device list/i);assert.equal(h.node(`#${kind}Hint`).classList.contains('warning'),true);stop(h,kind)});
}
test('mic: resolved resume that remains suspended is not a successful test',async()=>{const h=harness({contextState:'suspended'}),s=await acquired(h,'mic');assert.equal(s.track.readyState,'ended');assert.equal(h.contexts[0].closed,1);assert.equal(h.api.snapshot().testState.mic,'warn')});
test('mic: partial graph setup failure disconnects all earlier nodes',async()=>{const h=harness({gainFails:true}),s=await acquired(h,'mic');assert.equal(s.track.readyState,'ended');assert.ok(h.contexts[0].nodes.length>0);assert.ok(h.contexts[0].nodes.every(n=>n.disconnected));assert.equal(h.contexts[0].closed,1);assert.equal(h.raf.size,0)});
test('mic: an already queued stale animation cannot duplicate the newer meter loop',async()=>{const h=harness();await acquired(h,'mic');const staleFrame=[...h.raf.values()][0];await acquired(h,'mic');assert.equal(h.raf.size,1);staleFrame();assert.equal(h.raf.size,1);stop(h,'mic');staleFrame();assert.equal(h.raf.size,0)});
test('initial default selections use empty device IDs rather than localized option labels',()=>{for(const kind of ['camera','mic']){const option=html.match(new RegExp(`<select[^>]+id="${kind}Select"[^>]*>\\s*(<option[^>]*>)`));assert.ok(option,kind);assert.match(option[1],/value=""/,'Default must not request an exact device with its translated label')}});
test('mic: application-owned startup failure rerenders fully after a language change',async()=>{const h=harness({contextState:'suspended'});h.api.changeLanguage('ja');await acquired(h,'mic');assert.match(h.node('#micHint').textContent,/音声解析/);h.api.changeLanguage('en');assert.match(h.node('#micHint').textContent,/Audio analysis could not start/);assert.doesNotMatch(h.node('#micHint').textContent,/音声解析/)});
