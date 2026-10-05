// Exercise the actual app handlers and bindings with synthetic DOM boundaries only.
// Reintroducing the Tab trap, omitting any reset field, or stealing focus must fail.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const test = require('node:test');
const html = fs.readFileSync(process.env.DEVICE_CHECK_HTML || path.join(__dirname, '../src/index.template.html'), 'utf8');
const lines = html.split('\n');
const line = prefix => lines.find(value => value.startsWith(prefix)) || '';
const translations = html.slice(html.indexOf('    const translations='), html.indexOf('    const $='));
const state = html.slice(html.indexOf('    const testState='), html.indexOf('    const quickTests='));
const functions = ['t', 'fmt', 'setStatus', 'updateSummary', 'applyLanguage', 'renderKeyboardMap', 'updateKeyVisual', 'updateModifierChips', 'handleKeyDown', 'handleKeyUp', 'resetPressedKeys', 'clearKeyboardResults'].map(name => line('    function ' + name + '(')).join('\n');
const bindings = lines.filter(value => value.startsWith("    const keyZone=$('#keyboardZone');") || value.includes("$('#keyboardClear').addEventListener")).join('\n');
const section = html.slice(html.indexOf('<section class="section" data-mobile-page="input" id="keyboardSection"'), html.indexOf('<section class="section" data-mobile-page="input" id="pointerSection"'));
function harness() {
  const nodes = new Map(), statuses = [], localized = [], document = {activeElement:null, documentElement:{}};
  function makeNode() {
    const classes = new Set();
    const n = {textContent:'', style:{}, dataset:{}, children:[], listeners:{}, disabled:false,
      classList:{add:c=>classes.add(c), remove:c=>classes.delete(c), contains:c=>classes.has(c), toggle(c,on){on?classes.add(c):classes.delete(c)}},
      addEventListener(type, fn){this.listeners[type]=fn}, setAttribute(k,v){this[k]=v},
      append(child){this.children.push(child);child.parent=this}, prepend(child){this.children.unshift(child);child.parent=this},
      remove(){this.parent.children.splice(this.parent.children.indexOf(this),1)},
      focus(){if(document.activeElement===this)return;document.activeElement?.listeners.blur?.();document.activeElement=this;this.listeners.focus?.()},
      click(){if(!this.disabled)this.listeners.click?.({currentTarget:this,target:this})}
    };
    Object.defineProperty(n,'className',{set(value){classes.clear();value.split(/\s+/).filter(Boolean).forEach(c=>classes.add(c))}});
    Object.defineProperty(n,'innerHTML',{set(value){assert.equal(value,'');this.children=[]}});
    Object.defineProperty(n,'lastElementChild',{get(){return this.children.at(-1)}});
    return n;
  }
  for (const match of html.matchAll(/<([\w-]+)\b([^>]*)>/g)) {
    const attrs = match[2], id = attrs.match(/\bid="([^"]+)"/), status = attrs.match(/\bdata-status-for="([^"]+)"/), i18n = attrs.match(/\bdata-i18n="([^"]+)"/);
    if(!id&&!status&&!i18n)continue;
    const n=makeNode();n.tagName=match[1].toUpperCase();n.disabled=/\bdisabled\b/.test(attrs);
    if(id)nodes.set('#'+id[1],n);
    if(status){n.dataset.statusFor=status[1];statuses.push(n)}
    if(i18n){n.dataset.i18n=i18n[1];localized.push(n)}
  }
  const descendants = node => [node,...node.children.flatMap(descendants)];
  const $ = selector => {
    if(selector.startsWith('#'))return nodes.get(selector)||null;
    const key=selector.match(/^\[data-key-code="(.*)"\]$/)?.[1];
    return key ? descendants(nodes.get('#keyboardMap')).find(n=>n.dataset.keyCode===key)||null : null;
  };
  const $$ = selector => selector==='[data-i18n]' ? localized : selector.startsWith('[data-status-for=') ? statuses.filter(n=>n.dataset.statusFor===selector.match(/"([^"]+)"/)[1]) : [];
  document.createElement=makeNode;
  const context=vm.createContext({JSON,document,$,$$,CSS:{escape:value=>value},APP_CONFIG:{name:'Device Check',nameJa:'端末チェック'},updateEnvironment(){},renderCapabilities(){},updateQuickDiagnosis(){},updateGamepadHapticState(){},renderMediaState(){}});
  vm.runInContext(translations+"\nlet language='en';\n"+state+'\n'+line('    const keyboardLayout=')+'\n'+functions+'\n'+bindings+`
    this.api={snapshot:()=>JSON.parse(JSON.stringify({unique:[...uniqueKeys],pressed:[...pressedKeys],max:maxSimultaneousKeys,testState,mediaState,maxObservedTouches,activePointers:[...activePointers],micPeak,sensorListening,quickIndex})),setStatus,changeLanguage(value){language=value;applyLanguage()},primeOtherTests(){
      ['camera','speaker','screen','pointer','gamepad','sensor'].forEach(test=>setStatus(test,'pass'));setStatus('mic','active');
      mediaState.camera.generation=7;mediaState.camera.operation={name:'live-camera'};mediaState.mic.generation=9;mediaState.mic.operation={name:'pending-mic'};
      maxObservedTouches=4;activePointers.set(12,{x:15,y:30});micPeak=-4;sensorListening=true;quickIndex=1;
    }};applyLanguage();`,context);
  const zone=$('#keyboardZone'),clear=$('#keyboardClear'),outside=$('#speakerVolume');
  function send(type,key,code=key,mods={},target=document.activeElement) {
    const e={type,key,code,shiftKey:false,ctrlKey:false,altKey:false,metaKey:false,repeat:false,defaultPrevented:false,preventDefault(){this.defaultPrevented=true},...mods};
    target?.listeners[type]?.(e);
    // Simulate platform focus navigation only if the real handler leaves default behavior available.
    if(type==='keydown'&&key==='Tab'&&!e.defaultPrevented&&target===zone)(e.shiftKey?outside:clear||outside).focus();
    return e;
  }
  return {$,$$,document,zone,clear,outside,send,api:context.api};
}
function exercise(h) {
  h.zone.focus();h.send('keydown','Shift','ShiftLeft',{shiftKey:true});h.send('keydown','Control','ControlLeft',{shiftKey:true,ctrlKey:true});h.send('keydown','a','KeyA',{shiftKey:true,ctrlKey:true,altKey:true,metaKey:true});
  assert.equal(h.api.snapshot().testState.keyboard,'pass');
}
function reset(h) {assert.ok(h.clear,'A native clear-results button must exist');h.clear.click()}
function assertEmpty(h) {
  const s=h.api.snapshot();assert.deepEqual(s.unique,[]);assert.deepEqual(s.pressed,[]);assert.equal(s.max,0);assert.equal(s.testState.keyboard,'idle');
  for(const id of ['uniqueKeyCount','keySimultaneous','keySimultaneousMax'])assert.equal(h.$('#'+id).textContent,'0',id);
  assert.equal(h.$('#keyCode').textContent,'key: — · code: —');assert.equal(h.$('#keyLog').children.length,0);
  for(const id of ['keyShift','keyCtrl','keyAlt','keyMeta']){assert.equal(h.$('#'+id).style.background,'');assert.equal(h.$('#'+id).style.color,'')}
  for(const code of ['ShiftLeft','ControlLeft','KeyA','Tab'])assert.equal(h.$(`[data-key-code="${code}"]`).classList.contains('down'),false,code);
  for(const status of h.$$('[data-status-for="keyboard"]'))assert.equal(status.dataset.state,'');
}
test('clear is a native, enabled button after and outside the capture area',()=>{
  const button=section.match(/<button\b[^>]*id="keyboardClear"[^>]*>/);assert.ok(button,'clear-results control is missing');assert.match(button[0],/type="button"/);assert.doesNotMatch(button[0],/disabled|hidden/);
  const open=[];for(const match of section.matchAll(/<\/?(section|div|button)\b[^>]*>/g)){if(match[0].startsWith('</'))open.pop();else {if(match[0].includes('id="keyboardClear"'))assert.ok(!open.some(tag=>tag.includes('id="keyboardZone"')),'clear must be outside capture');open.push(match[0])}}
  assert.ok(section.indexOf('id="keyboardClear"')>section.indexOf('id="keyboardZone"'));
});
test('clear resets all keyboard observations, held visuals, status and summary',()=>{const h=harness();exercise(h);assert.equal(h.$('#summaryScore').textContent,'1 / 8');reset(h);assertEmpty(h);assert.equal(h.$('#keyMain').textContent,'Press a key');assert.equal(h.$('#summaryScore').textContent,'0 / 8');assert.equal(h.$('#summaryProgress').style.width,'0%')});
test('clear does not alter other tests, active capture ownership, pointer counts or quick diagnosis',()=>{const h=harness();h.api.primeOtherTests();exercise(h);const before=h.api.snapshot();reset(h);const after=h.api.snapshot();for(const key of Object.keys(before)){if(['unique','pressed','max','testState'].includes(key))continue;assert.deepEqual(after[key],before[key],key)}for(const key of Object.keys(before.testState)){if(key!=='keyboard')assert.equal(after.testState[key],before.testState[key],key)}assert.equal(h.$('#summaryScore').textContent,'6 / 8')});
test('empty and repeated clear retain button focus without capturing activation keys',()=>{const h=harness();reset(h);for(let i=0;i<3;i++){reset(h);assert.equal(h.document.activeElement,h.clear);assert.equal(h.clear.disabled,false);assert.equal(h.zone.classList.contains('active'),false);h.send('keydown','Enter');h.send('keyup','Enter');h.send('keydown',' ','Space');h.send('keyup',' ','Space');assertEmpty(h)}});
test('a fresh session after reset starts from one key and a new peak',()=>{const h=harness();exercise(h);reset(h);h.zone.focus();h.send('keydown','z','KeyZ');const s=h.api.snapshot();assert.deepEqual(s.unique,['KeyZ']);assert.deepEqual(s.pressed,['KeyZ']);assert.equal(s.max,1);assert.equal(s.testState.keyboard,'active');assert.equal(h.$('#keyLog').children.length,1);assert.equal(h.$('#summaryScore').textContent,'0 / 8')});
for(const shiftKey of [false,true]){
  test(`${shiftKey?'Shift+Tab':'Tab'} leaves native forward/reverse navigation available and blur releases held state`,()=>{const h=harness();exercise(h);const e=h.send('keydown','Tab','Tab',{shiftKey});assert.equal(e.defaultPrevented,false);assert.equal(h.document.activeElement,shiftKey?h.outside:h.clear);assert.deepEqual(h.api.snapshot().pressed,[]);assert.equal(h.$('#keySimultaneous').textContent,'0');assert.ok(h.api.snapshot().unique.includes('Tab'));assert.equal(h.zone.classList.contains('active'),false);assert.equal(h.send('keyup','Tab','Tab',{shiftKey}).defaultPrevented,false)});
  test(`${shiftKey?'Shift+Tab':'Tab'} keyup delivered inside the zone is not cancelled`,()=>{const h=harness();h.zone.focus();assert.equal(h.send('keyup','Tab','Tab',{shiftKey}).defaultPrevented,false)});
}
test('blur retains measurements but clears held keys, visuals and modifiers',()=>{const h=harness();exercise(h);h.outside.focus();const s=h.api.snapshot();assert.equal(s.unique.length,3);assert.equal(s.max,3);assert.deepEqual(s.pressed,[]);assert.equal(s.testState.keyboard,'pass');assert.equal(h.$('#keyLog').children.length,3);assert.equal(h.$('[data-key-code="KeyA"]').classList.contains('down'),false);assert.equal(h.$('#keyShift').style.background,'')});
test('ordinary keys, Escape, code fallback and repeats preserve diagnostic behavior',()=>{const h=harness();h.zone.focus();assert.equal(h.send('keydown','a','KeyA').defaultPrevented,true);assert.equal(h.$('#keyMain').textContent,'a');assert.equal(h.send('keydown','a','KeyA',{repeat:true}).defaultPrevented,true);assert.equal(h.$('#keyLog').children.length,1);assert.equal(h.api.snapshot().max,1);assert.equal(h.send('keyup','a','KeyA').defaultPrevented,true);assert.deepEqual(h.api.snapshot().pressed,[]);h.send('keydown','Escape');assert.equal(h.document.activeElement,h.zone);assert.equal(h.$('#keyMain').textContent,'Escape');h.send('keydown','x','');assert.ok(h.api.snapshot().unique.includes('x'))});
test('recent history stays bounded and can be fully cleared',()=>{const h=harness();h.zone.focus();for(let i=0;i<25;i++){h.send('keydown','key'+i,'code'+i);h.send('keyup','key'+i,'code'+i)}assert.equal(h.$('#keyLog').children.length,18);assert.equal(h.api.snapshot().unique.length,25);reset(h);assertEmpty(h)});
test('typing outside the test before and after clear is not captured',()=>{const h=harness();h.outside.focus();assert.equal(h.send('keydown','x','KeyX').defaultPrevented,false);assert.deepEqual(h.api.snapshot().unique,[]);exercise(h);reset(h);assert.equal(h.send('keydown','x','KeyX').defaultPrevented,false);assertEmpty(h)});
for(const language of ['ja','en'])test(`${language}: label, navigation/reset hint, help and empty state stay localized after reset`,()=>{const h=harness();h.api.changeLanguage(language);exercise(h);reset(h);assert.equal(h.clear.textContent,language==='ja'?'キーボード結果をクリア':'Clear keyboard results');assert.equal(h.$('#keyMain').textContent,language==='ja'?'キーを押してください':'Press a key');const hint=h.$('#keyboardResetHint');assert.ok(hint,'navigation hint exists');assert.match(hint.textContent,/Tab/);assert.match(hint.textContent,language==='ja'?/キーボード.*クリア/:/keyboard.*clear/i);const help=html.slice(html.indexOf('<!-- APP:HELP:BEGIN -->'),html.indexOf('<!-- APP:HELP:END -->'));assert.match(help,/data-i18n="helpKeyboardReset"/);assert.match(section,/aria-describedby="keyboardResetHint"/);h.api.changeLanguage(language==='ja'?'en':'ja');assertEmpty(h);assert.equal(h.document.activeElement,h.clear)});
