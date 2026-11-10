const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
global.window={};require('../site/book-tables.js');
const B=window.BookTables,source=f=>fs.readFileSync(__dirname+'/../site/'+f,'utf8');
const seq=values=>{let i=0;return()=>values[i++%values.length]};

test('the tables have the shape of the book: dice, columns and pages (pp. 326, 331, 332)',()=>{
 assert.equal(B.HEADLINE.page,326);assert.equal(B.HEADLINE.category.length,6);for(const k of ['who','does','what'])assert.equal(B.HEADLINE[k].length,10);
 assert.equal(B.VENDIT.page,331);assert.equal(B.VENDIT.types.length,3);assert.equal(B.VENDIT.items.length,3);for(const list of B.VENDIT.items)assert.equal(list.length,10);
 assert.equal(B.BODEGA.page,332);for(const k of ['owner','first','second'])assert.equal(B.BODEGA[k].length,6);
 const pairs=[...B.HEADLINE.category,...B.HEADLINE.who,...B.HEADLINE.does,...B.HEADLINE.what,...B.VENDIT.types,...B.VENDIT.items.flat(),...B.BODEGA.owner,...B.BODEGA.first,...B.BODEGA.second];
 for(const p of pairs){assert.equal(p.length,2);for(const v of p)assert.ok(typeof v==='string'&&v.trim()&&v.length<=110,`entry too long or empty: ${v}`)}
});

test('dice map to entries: 1d6 picks the Vendit type 1–3 / 4–5 / 6',()=>{
 const type=roll=>B.rows({table:'vendit',type:roll,item:1},'en')[0][1];
 assert.deepEqual([1,2,3,4,5,6].map(type),['Food','Food','Food','Personal','Personal','Just plain weird']);
 assert.equal(B.rows({table:'vendit',type:6,item:7},'en')[1][1],'Live rhinoceros beetles');
 assert.equal(B.rows({table:'vendit',type:1,item:10},'ru')[1][1],'Газировка в банках');
});

test('generators stay inside the dice ranges at both ends',()=>{
 for(const rng of [()=>0,()=>0.999999,()=>1]){
  for(const make of [B.headline,B.vendit,B.bodega]){const e=make(rng);assert.ok(B.valid(e),JSON.stringify(e));assert.ok(B.html(e,'ru').includes('data-action="book-page"'))}
 }
 assert.deepEqual(B.headline(seq([0,0.15,0.95,0.5])),{table:'headline',category:1,who:2,does:10,what:6});
});

test('a result names its page and reads the same in the journal text',()=>{
 const e={table:'headline',category:4,who:2,does:2,what:2};
 assert.match(B.html(e,'en'),/Screamsheet headline <button class="rule-source" type="button" data-action="book-page" data-page="326">p\. 326<\/button>/);
 assert.equal(B.text(e,'en'),'Screamsheet headline (p. 326): Section: Local; Headline: Senator · threatens · city');
 assert.equal(B.text(e,'ru'),'Заголовок скримшита (стр. 326): Раздел: Местные; Заголовок: Сенатор · угрожает · город');
 assert.match(B.text({table:'bodega',owner:1,first:5,second:4},'ru'),/^Кто в бодеге \(стр\. 332\): За кассой: .+; Посетитель: .+; Ещё один: .+$/);
});

test('damaged results are refused instead of breaking the page',()=>{
 for(const bad of [null,5,{},{table:'vendit',type:7,item:1},{table:'vendit',type:1,item:0},{table:'headline',category:1,who:1,does:1},{table:'bodega',owner:1.5,first:1,second:1},{table:'other'}]){assert.equal(B.valid(bad),false);assert.equal(B.html(bad,'ru'),'');assert.equal(B.text(bad,'ru'),'')}
 assert.doesNotMatch(B.html({table:'vendit',type:1,item:1},'en'),/<script/);
});

test('the GM tools offer the book tables, keep prep on the device and write results to a journal',()=>{
 const extras=source('gm-extras.js'),market=source('night-market.js');
 assert.match(source('index.html'),/<script src="book-tables\.js"><\/script><script src="gm-extras\.js">/);
 for(const a of ['book-headline','book-vendit','book-bodega'])assert.match(extras,new RegExp(`case '${a}':pushLog\\(\\{kind:'book'`));
 assert.match(extras,/PREP_KEY='nc-gm-prep-v1'/);assert.match(extras,/function pushLog\(entry\)\{log\.unshift\(entry\);log=log\.slice\(0,LOG_SIZE\);storePrep\(\)\}/);
 assert.match(extras,/window\.Campaigns\?\.journalAdd\?\.\(target,text\.slice\(0,2000\),false\)/);
 assert.match(market,/MARKET_KEY='nc-night-market-v1'/);assert.match(market,/storeMarket\(\);\n const l=lang\|\|root\.dataset\.lang/);
});
