const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const dir=path.join(__dirname,'../site');
const context={window:{},Math,Number,String,Array,Object,Set,Infinity,JSON};
for(const f of ['catalog.js','catalog-extra.js','defenses-extra.js','night-market.js','skill-reference.js','streetslang.js'])vm.runInNewContext(fs.readFileSync(path.join(dir,f),'utf8'),context);
const {NightMarket:NM,SkillReference:SR,Streetslang:SL,CATALOG}=context.window;
function seq(values){let i=0;return ()=>values[i++%values.length]}
function seeded(seed){return ()=>{seed=(seed*1103515245+12345)%2147483648;return seed/2147483648}}

test('night market: six categories, every category has priced catalog goods',()=>{
 assert.deepEqual([...NM.CATEGORIES].map(c=>c.id),['food','electronics','weapons','cyberware','clothing','survival']);
 for(const c of NM.CATEGORIES){assert(c.ru&&c.en);assert(NM.pool(c.id,'superluxury').length>=3,c.id)}
 for(const item of CATALOG){const c=NM.categoryOf(item);if(c)assert(item.price>0)}
 assert.equal(NM.categoryOf(CATALOG.find(i=>i.id==='extra-pharmaceutical-speedheal')),null,'unpriced pharmaceuticals are not sold');
 assert.equal(NM.categoryOf(CATALOG.find(i=>i.id==='gear-agent')),'electronics');
 assert.equal(NM.categoryOf(CATALOG.find(i=>i.id==='cyberware-techhair')),'clothing');
 assert.equal(NM.categoryOf(CATALOG.find(i=>i.id==='weapon-heavy-pistol')||CATALOG.find(i=>i.category==='weapon')),'weapons');
});
test('night market: price tiers match Corebook p. 385 and cap the pool',()=>{
 assert.deepEqual([...NM.PRICE_TIERS].map(t=>t.max).slice(0,7),[10,20,50,100,500,1000,5000]);
 assert.equal(NM.tierOf(20).id,'everyday');assert.equal(NM.tierOf(10000).id,'superluxury');
 for(const c of NM.CATEGORIES)for(const i of NM.pool(c.id,'premium'))assert(i.price<=100);
});
test('night market: category rolls reroll duplicate 1d6 faces',()=>{
 // faces: 3, 3 (duplicate), 5
 const r=NM.rollCategories(2,seq([0.4,0.4,0.7]));assert.deepEqual([...r.categories],['weapons','clothing']);assert.deepEqual([...r.rolls],[3,3,5]);
 assert.equal(NM.rollCategories(6,seeded(7)).categories.length,6);
 assert.equal(new Set(NM.rollCategories(6,seeded(9)).categories).size,6);
});
test('night market: generated stock is distinct, within cap, and rerolls stay valid',()=>{
 const m=NM.generate({categories:3,items:8,cap:'expensive'},seeded(42));
 assert.equal(m.stalls.length,3);
 for(const s of m.stalls){assert.equal(new Set(s.items).size,s.items.length);for(const id of s.items){const i=CATALOG.find(x=>x.id===id);assert(i.price<=500);assert.equal(NM.categoryOf(i),s.category)}}
 const before=m.stalls[0].items.slice();assert(NM.rerollItem(m,0,0,seeded(3)));assert.equal(new Set(m.stalls[0].items).size,before.length);assert(!before.includes(m.stalls[0].items[0]));
 assert(!NM.rerollItem(m,0,99,seeded(3)));assert(!NM.rerollStall(m,7,seeded(3)));
 const d=NM.generate({categories:1},seq([0.0,0.95]));assert.equal(d.stalls[0].count,10);
});
test('night market render escapes and reflects state through handle',()=>{
 NM.reset();let html=NM.render('en');assert(html.includes('NIGHT MARKET'));assert(html.includes('Build market'));
 const root={dataset:{lang:'en'},querySelector:s=>({'[data-nm-field="categories"]':{value:'2'},'[data-nm-field="items"]':{value:'3'},'[data-nm-field="cap"]':{value:'luxury'}})[s]||null,isConnected:true,outerHTML:''};
 const btn={dataset:{nmAction:'generate'},closest:s=>s==='[data-nm-root]'?root:btn};
 assert(NM.handle({type:'click',target:btn},'en',seeded(5)));
 assert(root.outerHTML.includes('nm-stall'));assert.equal(NM.market.stalls.length,2);for(const s of NM.market.stalls)assert(s.items.length<=3);
 html=NM.render('ru');assert(html.includes('НОЧНОЙ РЫНОК'));assert(!/<script/i.test(html));
 assert.equal(NM.handle({type:'click',target:{closest:()=>null}},'en'),false);
});

test('skill reference: DV ladder from Corebook p. 130',()=>{
 assert.deepEqual([...SR.DV.map(d=>d[0])],[9,13,15,17,21,24,29]);
});
test('skill reference: skill list agrees with the app sheet skills (STAT, ×2, basic)',()=>{
 const src=fs.readFileSync(path.join(dir,'app.js'),'utf8');const app=new Map([...src.matchAll(/\['([^']+)','[^']+','([A-Z]+)',(\d),(\d)\]/g)].map(m=>[m[1],m]));
 assert.equal(new Set(SR.SKILLS.map(s=>s[0])).size,SR.SKILLS.length);
 const alias={'Language':'Language (Other)','Local Expert':'Local Expert (Other)'};
 for(const s of SR.SKILLS){const m=app.get(alias[s[0]]||s[0]);assert(m,s[0]);assert.equal(s[2],m[2],s[0]);assert.equal(s[3],Number(m[3]),s[0]);if(!alias[s[0]])assert.equal(s[4],Number(m[4]),s[0]);assert(s[5]&&s[6]&&s[7]);assert(Object.hasOwn(SR.GROUPS,s[1]))}
 assert.equal(SR.SKILLS.length,66);
 assert.equal(SR.SKILLS.filter(s=>s[3]===2).length,7);
 assert.equal(SR.filter('','fighting').length,4);assert(SR.filter('WILL','all').every(s=>s[2]==='WILL'||/will/i.test(s.join(' '))));
 assert.equal(SR.filter('уклон','all')[0][0],'Evasion');
});
test('skill reference: success chance with exploding/imploding d10',()=>{
 const near=(a,b)=>assert(Math.abs(a-b)<1e-9,a+' vs '+b);
 near(SR.chance(0,0),0.9);   // faces 2–9 and every natural 10 succeed; a natural 1 never does
 near(SR.chance(5,15),0.1);  // only a natural 10 (+1d10) beats DV 15
 near(SR.chance(10,15),0.5); // faces 6–9, plus natural 10
 near(SR.chance(14,9),0.95); // natural 1 succeeds when the subtracted d10 is 1–5
 near(SR.chance(30,29),0.91); // a natural 1 minus 1 still succeeds
 assert.equal(SR.chance('x',9),null);
 for(let b=-10;b<=40;b++)assert(SR.chance(b,15)>=SR.chance(b-1,15));
});
test('skill reference handle updates the list without touching other data',()=>{
 SR.reset();const box={innerHTML:''},count={textContent:''};const root={dataset:{lang:'en'},querySelector:s=>s==='[data-sr-list]'?box:s==='[data-sr-count]'?count:null};
 const input={dataset:{srField:'query'},value:'pick',closest:()=>root};
 assert(SR.handle({type:'input',target:input}));assert(box.innerHTML.includes('Pick Lock'));assert(box.innerHTML.includes('Pick Pocket'));assert.equal(count.textContent,'2 skills');
 input.value='<b>x';SR.handle({type:'input',target:input});assert(SR.render('en').includes('value="&lt;b&gt;x"'));SR.reset();
 assert.equal(SR.handle({type:'input',target:{dataset:{}}}),false);
});

test('streetslang: bilingual entries with valid topics and Corebook pages',()=>{
 assert(SL.TERMS.length>=30);assert.equal(new Set(SL.TERMS.map(t=>t[0])).size,SL.TERMS.length);
 for(const t of SL.TERMS){assert(Object.hasOwn(SL.TOPICS,t[1]),t[0]);assert(Number.isInteger(t[2])&&t[2]>=24&&t[2]<=340,t[0]);for(const i of [3,4,5])assert(t[i].trim(),t[0])}
 assert.equal(SL.filter('preem','all').length,1);assert.equal(SL.filter('eurodollars','all')[0][0],'Eddies');assert.equal(SL.filter('евродоллар','all')[0][0],'Eddies');
 assert(SL.filter('','net').every(t=>t[1]==='net'));
 SL.reset();assert(SL.render('ru').includes('УЛИЧНЫЙ СЛЕНГ'));assert(SL.render('en').includes('STREETSLANG'));
});
