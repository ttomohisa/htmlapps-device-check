const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const html=fs.readFileSync(path.join(__dirname,'../src/index.template.html'),'utf8');
test('build metadata is unique and the final Help content',()=>{
 const main=html.match(/<main\b[^>]*>([\s\S]*?)<\/main>/)[1];
 const help=html.match(/<dialog id="helpDialog"[^>]*>([\s\S]*?)<\/dialog>/)[1];
 assert.doesNotMatch(main,/id="buildVersion"/);
 const bodyStart=help.indexOf('<div class="dialog-body">');
 let depth=0,bodyEnd=-1;
 for(const match of help.slice(bodyStart).matchAll(/<div\b[^>]*>|<\/div>/g)){
  depth+=match[0].startsWith('</')?-1:1;
  if(depth===0){bodyEnd=bodyStart+match.index;break;}
 }
 assert.ok(bodyEnd>bodyStart);
 assert.match(help.slice(bodyStart,bodyEnd),/id="buildVersion"/);
 assert.ok(help.includes("<details class=\"build-info\" data-mobile-page=\"device\"><summary data-i18n=\"buildInfo\">ビルド情報</summary><div class=\"build-grid\"><div class=\"build-item\"><span data-i18n=\"appVersion\">アプリバージョン</span><strong id=\"buildVersion\">—</strong></div><div class=\"build-item\"><span data-i18n=\"builtAt\">生成日時</span><strong id=\"builtAt\">—</strong></div><div class=\"build-item\"><span data-i18n=\"dependencies\">内包依存数</span><strong id=\"dependencyCount\">0</strong></div></div></details>"));
 const tail=help.slice(help.indexOf("<details class=\"build-info\" data-mobile-page=\"device\"><summary data-i18n=\"buildInfo\">ビルド情報</summary><div class=\"build-grid\"><div class=\"build-item\"><span data-i18n=\"appVersion\">アプリバージョン</span><strong id=\"buildVersion\">—</strong></div><div class=\"build-item\"><span data-i18n=\"builtAt\">生成日時</span><strong id=\"builtAt\">—</strong></div><div class=\"build-item\"><span data-i18n=\"dependencies\">内包依存数</span><strong id=\"dependencyCount\">0</strong></div></div></details>")+"<details class=\"build-info\" data-mobile-page=\"device\"><summary data-i18n=\"buildInfo\">ビルド情報</summary><div class=\"build-grid\"><div class=\"build-item\"><span data-i18n=\"appVersion\">アプリバージョン</span><strong id=\"buildVersion\">—</strong></div><div class=\"build-item\"><span data-i18n=\"builtAt\">生成日時</span><strong id=\"builtAt\">—</strong></div><div class=\"build-item\"><span data-i18n=\"dependencies\">内包依存数</span><strong id=\"dependencyCount\">0</strong></div></div></details>".length);
 assert.match(tail,/^\s*(?:<!--[^]*?-->\s*)?<\/div>\s*$/);
 for(const id of ["buildVersion", "builtAt", "dependencyCount"])assert.equal((html.match(new RegExp(`id="${id}"`,'g'))||[]).length,1);
});

test('keyboard disclosure activation is not mistaken for backdrop',{timeout:1000},()=>{
 const handler=html.match(/helpDialog\.addEventListener\('click',e=>\{(.*?)\}\);/)[1];
 const dialog={closed:0,getBoundingClientRect(){return{left:20,right:300,top:20,bottom:400}},close(){this.closed++}};
 const run=new Function('helpDialog','e',handler);run(dialog,{target:{},clientX:0,clientY:0});assert.equal(dialog.closed,0);run(dialog,{target:dialog,clientX:0,clientY:0});assert.equal(dialog.closed,1);
});
