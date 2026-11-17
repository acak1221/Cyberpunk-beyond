const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const dir=path.join(__dirname,'../site');
function load(extra={}){const win={...extra};vm.runInNewContext(fs.readFileSync(path.join(dir,'night-city.js'),'utf8'),{window:win,Object,Array,Set,String});return win.NightCity}
const C=load();
// The chapters of the book index already in the repo (book-toc.js): [start page, ...]. A page must fall inside the book.
const toc=fs.readFileSync(path.join(dir,'book-toc.js'),'utf8'),starts=[...toc.matchAll(/^ \[(\d+),'/gm)].map(m=>Number(m[1]));
const bookPages=new Set([...toc.matchAll(/\[(\d+),'[^']*','[^']*'/g)].map(m=>Number(m[1])));

test('every page jump points at a page of the book index or inside a chapter of it',()=>{
 assert.ok(starts.length>10);const last=Math.max(...starts)+60;
 for(const p of C.PAGES){assert.ok(Number.isInteger(p)&&p>=starts[0]&&p<=last,String(p));assert.ok(bookPages.has(p)||starts.some(s=>s<=p),String(p))}
 for(const p of [267,304,308,310,326,337,340,377])assert.ok(C.PAGES.includes(p),'page '+p+' of the brief');
});
test('the sections have unique ids, both names and both descriptions',()=>{
 const ids=new Set();
 for(const s of C.SECTIONS){assert.ok(!ids.has(s.id));ids.add(s.id);assert.ok(s.ru&&s.en&&s.dru&&s.den,s.id);for(const p of s.pages)assert.ok(Number.isInteger(p[0])&&p[1]&&p[2],s.id)}
 for(const need of ['corporations','people','gangs','places','news','prices','market','rumors'])assert.ok(ids.has(need),need);
});
test('render draws page jumps that the book reader understands, in both languages',()=>{
 for(const lang of ['ru','en']){
  const html=C.render(lang);
  assert.match(html,/data-nc-root/);assert.match(html,lang==='ru'?/Банды/:/Gangs/);assert.match(html,lang==='ru'?/Корпорации/:/Corporations/);
  const jumps=[...html.matchAll(/data-action="book-page" data-page="(\d+)"/g)].map(m=>Number(m[1]));
  assert.equal(jumps.length,C.SECTIONS.reduce((n,s)=>n+s.pages.length,0));for(const p of jumps)assert.ok(C.PAGES.includes(p));
  assert.equal((html.match(/data-action="book-page"[^>]*aria-label/g)||[]).length,0,'the visible text is the accessible name (no mismatching aria-label)');assert.equal((html.match(/data-action="book-page"[^>]*>[^<]*\d+ ↗</g)||[]).length,jumps.length,'every jump shows its page number');
  assert.equal((html.match(/<section/g)||[]).length,(html.match(/<\/section>/g)||[]).length);
 }
});
test('inside the hub the cards carry shortcuts to the tools; the standalone page has none and draws the factions and rumors cards',()=>{
 const f=load({Factions:{render:l=>`<section data-fc-root>${l}</section>`},Rumors:{render:l=>`<section data-ru-root>${l}</section>`}});
 const hub=f.render('en');assert.match(hub,/data-gmh-go="factions"/);assert.match(hub,/data-gmh-go="market"/);assert.match(hub,/data-gmh-go="random"/);assert.doesNotMatch(hub,/data-fc-root|data-ru-root/);
 const page=f.render('en',{cards:true,go:false});assert.doesNotMatch(page,/data-gmh-go/);assert.match(page,/data-fc-root/);assert.match(page,/data-ru-root/);
 assert.doesNotMatch(page,/data-nc-card="rumors"/,'a card with neither a page nor a tool is left out');
 assert.doesNotThrow(()=>C.render('en',{cards:true}));assert.match(C.render('ru',{cards:true}),/data-nc-root/,'no factions module: the launcher alone');
});
test('every shortcut targets a tool that the hub can open',()=>{
 const hub=fs.readFileSync(path.join(dir,'gm-hub.js'),'utf8');
 for(const s of C.SECTIONS)if(s.go)assert.ok(hub.includes(`id:'${s.go[0]}'`),s.go[0]);
});
test('unknown language falls back to Russian and no text is taken from outside',()=>{
 assert.match(C.render('xx'),/Банды/);assert.doesNotMatch(C.render('en'),/https?:|src=|<img/);
});
