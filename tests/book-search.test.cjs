const {test}=require('node:test'),assert=require('node:assert/strict');
global.window={};require('../public/game/book-search.js');
const {create}=window.BookSearch;
const file={arrayBuffer:async()=>new Uint8Array([1]).buffer};
function loader(pages){let calls=0;const load=async()=>{calls++;return {promise:Promise.resolve({numPages:pages.length,getPage:async n=>({getTextContent:async()=>({items:[{str:pages[n-1]}]}),cleanup(){}}),destroy(){}}),destroy(){}}};load.calls=()=>calls;return load}
test('indexes the chosen local document and reuses it for searches with printed page numbers',async()=>{
 const load=loader(['Cover','The first page: Night City','Another NIGHT CITY page']);const s=create(load);s.setFile(file);await s.search('night city');assert.deepEqual(s.snapshot().results.map(x=>x.page),[1,2]);await s.search('first page');assert.deepEqual(s.snapshot().results.map(x=>x.page),[1]);assert.equal(load.calls(),1);
});
test('common Russian terms search their English equivalents; unknown phrases stay literal',async()=>{
 const s=create(loader(['cover','Autofire and armor','Critical Injury and cover']));s.setFile(file);await s.search('  Автоматический   ОГОНЬ ');assert.equal(s.snapshot().term,'Autofire');assert.deepEqual(s.snapshot().results.map(x=>x.page),[1]);await s.search('критическое ранение');assert.equal(s.snapshot().term,'Critical Injury');assert.deepEqual(s.snapshot().results.map(x=>x.page),[2]);assert.equal(window.BookSearch.searchTerm('неизвестная фраза'),'неизвестная фраза');assert.equal(window.BookSearch.searchTerm('Night City'),'Night City');assert.equal(window.BookSearch.searchTerm('constructor'),'constructor');assert.equal(window.BookSearch.searchTerm('__proto__'),'__proto__');
});
test('exact catalog names use an unambiguous existing translation',()=>{
 window.CATALOG=[{name:{ru:'Средний пистолет',en:'Medium Pistol'}},{name:{ru:'Средний пистолет',en:'Medium Pistol'}},{name:{ru:'Спорное название',en:'First'}},{name:{ru:'Спорное название',en:'Second'}}];
 assert.equal(window.BookSearch.searchTerm('СРЕДНИЙ ПИСТОЛЕТ'),'Medium Pistol');assert.equal(window.BookSearch.searchTerm('Спорное название'),'Спорное название');assert.equal(window.BookSearch.searchTerm('средний'),'средний');delete window.CATALOG;
});
test('new files invalidate the old index and markup in text remains data',async()=>{
 const load=loader(['cover','<script>Night City</script>']);const s=create(load);s.setFile(file);await s.search('night city');assert.match(s.snapshot().results[0].snippet,/<script>/);s.setFile(file);assert.equal(s.snapshot().results.length,0);await s.search('night city');assert.equal(load.calls(),2);
});
test('replacing the file or issuing an invalid search prevents stale asynchronous results',async()=>{
 let unblock;const wait=new Promise(r=>unblock=r),slow={arrayBuffer:()=>wait};const s=create(loader(['cover','night city']));s.setFile(slow);const pending=s.search('night city');s.setFile(file);unblock(new ArrayBuffer(1));await pending;assert.equal(s.snapshot().results.length,0);assert.equal(s.snapshot().status.key,'start');
 let resume;const stalled={arrayBuffer:()=>new Promise(r=>resume=r)};s.setFile(stalled);const pending2=s.search('night city');await s.search('x');resume(new ArrayBuffer(1));await pending2;assert.equal(s.snapshot().status.key,'need');assert.equal(s.snapshot().results.length,0);
});
test('failed document parsing is reported without carrying previous results',async()=>{
 const s=create(async()=>{throw Error('bad file')});s.setFile(file);await s.search('night city');assert.equal(s.snapshot().status.key,'error');assert.deepEqual(s.snapshot().results,[]);
});
test('loading task is destroyed on success and on text extraction errors',async()=>{
 let closed=0;const mk=fail=>async()=>({promise:Promise.resolve({numPages:2,getPage:async()=>({getTextContent:async()=>{if(fail)throw Error('parse');return {items:[{str:'night city'}]}}})}),destroy(){closed++}});
 const ok=create(mk(false));ok.setFile(file);await ok.search('night city');assert.equal(ok.snapshot().status.key,'ready');assert.equal(closed,1);
 const broken=create(mk(true));broken.setFile(file);await broken.search('night city');assert.equal(broken.snapshot().status.key,'error');assert.equal(closed,2);
});
