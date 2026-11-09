'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('fs'),vm=require('vm'),path=require('path');
const SITE=path.join(__dirname,'../site'),site=f=>fs.readFileSync(path.join(SITE,f),'utf8');
// A tiny DOM: only the card-heading tag spans are returned for the selector native.js uses for them.
function span(text,attrs={}){const cl=new Set();return {textContent:text,dataset:{},attrs,classList:{add:n=>cl.add(n),has:n=>cl.has(n)},hasAttribute:k=>k in attrs,cls:cl}}
function setup({lang='ru',native=true}={}){
 const classes=new Set(native?['ui-native']:[]);let spans=[];
 const scope={querySelectorAll:s=>s.startsWith('.card-heading > span:last-child')?spans.filter(x=>!x.dataset.nx):[]};
 const document={readyState:'complete',documentElement:{lang,classList:{contains:n=>classes.has(n),toggle(n,on){on?classes.add(n):classes.delete(n)}}},querySelector:s=>s==='#app'?scope:null,querySelectorAll:()=>[],addEventListener(){},createTreeWalker:()=>({nextNode:()=>false})};
 const window={document,localStorage:{getItem:()=>null,setItem(){}},requestAnimationFrame(){}};
 vm.runInNewContext(site('native.js'),{window,MutationObserver:class{observe(){}}});
 return {UI:window.NativeUI,scan:list=>{spans=list;window.NativeUI.scan(scope);return list}};
}

test('counters in card headings are never shown as page references',()=>{
 const {scan}=setup();
 const list=scan([span('63 / 62'),span('20 / 86'),span('4 / 300'),span('2'),span('0'),span('01 / 04'),span('01 / 05'),span('6 / 2045'),span('РАУНД 4 / ХОД 1'),span('СВОИ ПРОТИВНИКИ · 1/100')]);
 for(const s of list){assert.equal(s.cls.has('nx-page'),false,s.textContent);assert.doesNotMatch(s.textContent,/стр\.|p\./i)}
 assert.deepEqual(list.slice(0,5).map(s=>s.textContent),['63 / 62','20 / 86','4 / 300','2','0']);
});
test('decorative codes stay decor',()=>{
 const {scan}=setup();
 const [id,dice,gm]=scan([span('01 / ID'),span('02 / DICE'),span('GM')]);
 assert.ok(id.cls.has('nx-deco')&&dice.cls.has('nx-deco')&&gm.cls.has('nx-deco'));
 assert.equal(id.textContent,'01 / ID');
});
test('bare page numbers become page pills only with data-page-ref',()=>{
 const {scan}=setup();
 const [a,b,c,d,plain]=scan([span('174 / 182',{'data-page-ref':''}),span('169',{'data-page-ref':''}),span('129–130 · 201–205',{'data-page-ref':''}),span('170 / 176–178 / 186–188',{'data-page-ref':''}),span('174 / 182')]);
 assert.deepEqual([a,b,c,d].map(s=>s.textContent),['стр. 174, 182','стр. 169','стр. 129–130, 201–205','стр. 170, 176–178, 186–188']);
 assert.ok([a,b,c,d].every(s=>s.cls.has('nx-page')));
 assert.equal(plain.textContent,'174 / 182');assert.equal(plain.cls.has('nx-page'),false);
});
test('text with a page marker is recognised and the marker follows the interface language',()=>{
 let {scan}=setup({lang:'ru'});
 let r=scan([span('СТР. 45'),span('PP. 172–173'),span('СТР. 337–340, 385'),span('СТР. 45 · Бросьте 1d10'),span('02 / 04 · СТР. 78–80')]);
 assert.deepEqual(r.map(s=>s.textContent),['стр. 45','стр. 172–173','стр. 337–340, 385','СТР. 45 · Бросьте 1d10','02 / 04 · СТР. 78–80']);
 assert.deepEqual(r.map(s=>s.cls.has('nx-page')),[true,true,true,false,false]);
 ({scan}=setup({lang:'en'}));
 r=scan([span('P. 24'),span('PP. 128–141'),span('186–187',{'data-page-ref':''}),span('170 / 344',{'data-page-ref':''}),span('225',{'data-page-ref':''}),span('42')]);
 assert.deepEqual(r.map(s=>s.textContent),['p. 24','pp. 128–141','pp. 186–187','pp. 170, 344','p. 225','42']);
});
test('pageRef is a pure helper',()=>{
 const {UI}=setup();
 assert.equal(UI.pageRef('63 / 62',false,true),null);
 assert.equal(UI.pageRef('63 / 62',true,true),'стр. 63, 62');
 assert.equal(UI.pageRef('СТР.',false,true),null);
 assert.equal(UI.pageRef('',true,true),null);
 assert.equal(UI.pageRef('ID',true,false),null);
 assert.equal(UI.pageRef('1000',true,false),null,'four-digit numbers are years or limits, not pages');
});
test('the cyberpunk look leaves headings untouched',()=>{
 const {scan}=setup({native:false});
 const [a]=scan([span('174 / 182',{'data-page-ref':''})]);
 assert.equal(a.textContent,'174 / 182');assert.equal(a.cls.has('nx-page'),false);
});

// Static checks over the modules: every literal page tag is marked, and nothing dynamic is.
const files=fs.readdirSync(SITE).filter(f=>f.endsWith('.js'));
const TAG=/card-heading"><span>(?:(?!<\/span>).)*<\/span><span( data-page-ref)?>((?:(?!<\/span>).)*)<\/span>/g;
test('every bare page-number tag in a card heading carries data-page-ref',()=>{
 const missing=[],marked=[];
 for(const f of files)for(const m of site(f).matchAll(TAG)){
  const [,flag,text]=m;
  if(flag){marked.push(f);assert.match(text,/^\d{1,3}(?:\s*[–\-,/·]\s*\d{1,3})*$/,`${f}: data-page-ref on "${text}" must hold page numbers only`);continue}
  // The creation wizards number their steps "01 / 04"; those are counters, not pages.
  if(/^\d[\d\s–\-,/·]*$/.test(text)&&!/^0\d \/ 0\d$/.test(text))missing.push(`${f}: ${text}`);
 }
 assert.deepEqual(missing,[]);
 assert.ok(marked.length>=30,'page references are marked across the tool modules');
});
test('counters built from data are not marked as page references',()=>{
 for(const f of files)for(const m of site(f).matchAll(/<span data-page-ref>([^<]*)<\/span>/g))assert.doesNotMatch(m[1],/\$\{/,`${f}: ${m[1]}`);
 assert.match(site('app.js'),/<span data-calc="stats">\$\{sum\}/,'the STAT counter stays a plain counter');
 assert.match(site('campaigns.js'),/<span>\$\{list\.length\} \/ \$\{JOURNAL_MAX\}<\/span>/,'the journal counter stays a plain counter');
});
test('quick builder shows a localised page marker',()=>{
 assert.match(site('quick-builder.js'),/04 \/ 05 · \$\{text\(ctx,'СТР\.','PP\.'\)\} 98, 103, 117/);
});
