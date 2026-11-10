// The catalog draws one page of cards at a time; the rest wait behind «Показать ещё».
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const window={};
vm.runInNewContext(fs.readFileSync(__dirname+'/../site/catalog.js','utf8'),{window});
const cards=html=>(html.match(/class="catalog-card/g)||[]).length;
const TOTAL=window.CATALOG.length;

test('catalogMatches filters by category and by text in either language',()=>{
 assert.equal(window.catalogMatches('','all').length,TOTAL);
 assert.equal(window.catalogMatches('',undefined).length,TOTAL);
 const weapons=window.catalogMatches('','weapon');
 assert.ok(weapons.length>0&&weapons.length<TOTAL&&weapons.every(x=>x.category==='weapon'));
 const ru=window.catalogMatches('  ПИСТОЛЕТ ','all'),en=window.catalogMatches('pistol','all');
 assert.ok(ru.length>0&&en.length>0);
 assert.ok(ru.every(x=>[x.name.ru,x.details.ru].join(' ').toLocaleLowerCase().includes('пистолет')));
 assert.equal(window.catalogMatches('no such thing zzz','all').length,0);
});

test('without a limit every match is drawn and there is no «more» button',()=>{
 const html=window.renderCatalog('ru','','all');
 assert.equal(cards(html),TOTAL);assert.doesNotMatch(html,/data-action="catalog-more"/);
});

test('a limit draws one page and says how many are left',()=>{
 const html=window.renderCatalog('ru','','all',48);
 assert.equal(cards(html),48);
 assert.match(html,new RegExp(`data-action="catalog-more"[^>]*>Показать ещё · осталось ${TOTAL-48}<`));
 assert.match(window.renderCatalog('en','','all',48),new RegExp(`data-action="catalog-more"[^>]*>Show more · ${TOTAL-48} left<`));
});

test('the next page adds cards after the ones already shown, in the same order',()=>{
 const ids=html=>[...html.matchAll(/data-action="catalog-(?:buy|add)" data-id="([^"]+)"/g)].map(m=>m[1]);
 const one=ids(window.renderCatalog('ru','','all',48)),two=ids(window.renderCatalog('ru','','all',96));
 assert.ok(one.length>=48&&two.length>one.length);
 assert.deepEqual(two.slice(0,one.length),one);
});

test('a short result fits on one page: no button',()=>{
 const n=window.catalogMatches('','armor').length;assert.ok(n>0&&n<=48);
 const html=window.renderCatalog('ru','','armor',48);
 assert.equal(cards(html),n);assert.doesNotMatch(html,/catalog-more/);
});

test('a limit equal to the number of matches leaves nothing behind a button',()=>{
 assert.doesNotMatch(window.renderCatalog('ru','','all',TOTAL),/catalog-more/);
});

test('a wrong limit falls back to everything instead of an empty page',()=>{
 for(const bad of [0,-5,NaN,undefined,null])assert.equal(cards(window.renderCatalog('ru','','weapon',bad)),window.catalogMatches('','weapon').length,String(bad));
});

test('no match gives the empty note, with or without a limit',()=>{
 assert.match(window.renderCatalog('ru','zzzz nothing','all',48),/Ничего не найдено/);
 assert.match(window.renderCatalog('en','zzzz nothing','all'),/No items found/);
});
