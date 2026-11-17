const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const eq=(a,b,m)=>assert.deepEqual(JSON.parse(JSON.stringify(a)),b,m);
const doc={querySelectorAll:()=>[]},win={App:{lang:()=>'en'}};vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../site/npc-filter.js'),'utf8'),{window:win,document:doc,Object,Array,String,Number,Math});const F=win.NpcFilter;
const book=(ru,en,tier)=>({name:{ru,en},tier,source:'book'}),lib=(name,tier,extra)=>({name,tier,source:'library',extra});
test('clean keeps only known tiers and sources and a short normalized text',()=>{
 eq(F.clean({text:'  ЁЖ  Тест ',tiers:['boss','x','mook','boss'],source:'nope'}),{text:'еж тест',tiers:['mook','boss'],source:'all'});
 eq(F.clean(null),{text:'',tiers:[],source:'all'});
 assert.equal(F.clean({text:'a'.repeat(300)}).text.length,60);
});
test('text matches every word in the name in either language or in the role text',()=>{
 const x=book('Телохранитель','Bodyguard','mook');
 for(const q of ['тело','bodyg','телохр'])assert.equal(F.matches(x,{text:q}),true,q);
 assert.equal(F.matches(x,{text:'pyro'}),false);
 assert.equal(F.matches(x,{text:'body pyro'}),false);
 assert.equal(F.matches(lib('Ганк','mook','из банды Тигры'),{text:'банды тигры'}),true);
 assert.equal(F.matches(book('Ёж','Hedgehog','boss'),{text:'еж'}),true,'yo and ye are the same letter');
});
test('tier chips are an OR; an untiered entry is left out while a chip is on',()=>{
 const f={tiers:['mook','boss']};
 assert.equal(F.matches(book('a','a','mook'),f),true);
 assert.equal(F.matches(book('a','a','boss'),f),true);
 assert.equal(F.matches(book('a','a','miniboss'),f),false);
 assert.equal(F.matches(lib('x',undefined),f),false);
 assert.equal(F.matches(lib('x',undefined),{}),true);
});
test('source narrows to the book or to the library',()=>{
 assert.equal(F.matches(book('a','a','mook'),{source:'library'}),false);
 assert.equal(F.matches(lib('a','mook'),{source:'library'}),true);
 assert.equal(F.matches(lib('a','mook'),{source:'book'}),false);
});
test('bad items never match',()=>{for(const x of [null,undefined,7,'s'])assert.equal(F.matches(x,{}),false)});
test('attrs mark a card and draw it hidden when the current filter excludes it',()=>{
 F.reset();
 const a=F.attrs({name:{ru:'Пиро',en:'Pyro'},tier:'miniboss',source:'book'});
 assert.match(a,/data-nf-item/);assert.match(a,/data-nf-tier="miniboss"/);assert.match(a,/data-nf-src="book"/);assert.doesNotMatch(a,/hidden/);
 F.set({tiers:['boss']});
 assert.match(F.attrs({name:'x',tier:'mook',source:'library'}),/ hidden/);
 F.reset();
 assert.match(F.attrs({name:'"><script>',tier:'zzz',source:'book'}),/data-nf-tier=""/);
 assert.doesNotMatch(F.attrs({name:'"><script>'}),/<script>/);
});
test('the row is drawn in both languages with named controls and pressed states',()=>{
 F.reset();F.set({tiers:['boss'],text:'a"b'});
 const ru=F.rowHTML('ru'),en=F.rowHTML('en');
 assert.match(ru,/Найти NPC/);assert.match(en,/Find an NPC/);assert.match(ru,/Мини-босс/);assert.match(en,/Mini boss/);
 assert.match(en,/data-nf-tier-chip="boss" aria-pressed="true"/);
 assert.match(en,/data-nf-tier-chip="mook" aria-pressed="false"/);
 assert.match(en,/value="a&quot;b"/);
 assert.match(en,/role="status" aria-live="polite"/);
 assert.doesNotMatch(en,/data-nf-reset hidden/);
 F.reset();
 assert.match(F.rowHTML('en'),/data-nf-reset hidden/);
});
test('apply hides cards on the page and writes the count',()=>{
 F.reset();
 const mk=(name,tier,src)=>({dataset:{nfName:name,nfTier:tier,nfSrc:src},hidden:false});
 const cards=[mk('pyro пиро','miniboss','book'),mk('bodyguard','mook','book'),mk('ганк','mook','library')],counts=[{textContent:''}],resets=[{hidden:true}];
 doc.querySelectorAll=s=>s==='[data-nf-item]'?cards:s==='[data-nf-count]'?counts:s==='[data-nf-reset]'?resets:[];
 try{
  F.set({tiers:['mook']});
  eq(cards.map(c=>c.hidden),[true,false,false]);assert.equal(counts[0].textContent,'Showing 2 of 3');assert.equal(resets[0].hidden,false);
  F.set({source:'library'});
  eq(cards.map(c=>c.hidden),[true,true,false]);
  F.set({text:'zzz'});
  assert.equal(counts[0].textContent,'Nothing found');
  F.reset();
  eq(cards.map(c=>c.hidden),[false,false,false]);assert.equal(counts[0].textContent,'');
 }finally{doc.querySelectorAll=()=>[]}
});
