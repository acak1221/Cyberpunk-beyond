// Skills list: grouping (by category, by STAT, A–Z) and «hide zeroes» as per-device preferences.
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const src=f=>fs.readFileSync(__dirname+'/../site/'+f,'utf8');
const same=(a,b,m)=>assert.deepEqual(JSON.parse(JSON.stringify(a)),b,m);

function memory(){const store=new Map();return {getItem:k=>store.has(k)?store.get(k):null,setItem:(k,v)=>{store.set(k,String(v))},removeItem:k=>store.delete(k),get length(){return store.size},key:i=>[...store.keys()][i],store}}
function load({storage,withMemory=true}={}){
 const win={localStorage:storage||memory()};
 win.SkillReference={GROUPS:{awareness:['Восприятие','Awareness'],body:['Тело','Body'],education:['Образование','Education']},SKILLS:[['Concentration','awareness','WILL'],['Athletics','body','DEX'],['Language','education','INT'],['Local Expert','education','INT']]};
 if(withMemory)vm.runInNewContext(src('ui-memory.js'),{window:win,globalThis:win});
 vm.runInNewContext(src('skill-filter.js'),{window:win});
 return win;
}
// A list of rows like the sheet's, with enough of the DOM for the filter: children, dataset, classList, nextElementSibling.
function fakeList(skills){
 const items=[];
 const el=(cls,dataset={},extra={})=>{const o={classList:{contains:c=>cls.split(' ').includes(c)},dataset:{...dataset},hidden:false,remove(){const i=items.indexOf(o);if(i>=0)items.splice(i,1)},get nextElementSibling(){return items[items.indexOf(o)+1]||null},querySelector:()=>null,...extra};return o};
 const list={dataset:{},ownerDocument:{createElement:()=>el('skill-group-head-new')},appendChild(x){const i=items.indexOf(x);if(i>=0)items.splice(i,1);items.push(x)},querySelectorAll(sel){return sel==='.skill-row'?items.filter(i=>i.classList.contains('skill-row')):sel==='.skill-group-head'?items.filter(i=>i.classList.contains('skill-group-head')):[]}};
 for(const [name,ru,stat,level,specs=[]] of skills){
  items.push(el('skill-row',{skillSearch:`${name} ${ru} ${stat}`,skillStat:stat,skillRu:ru},{querySelector:s=>s==='input[data-skill]'?{dataset:{skill:name},value:String(level)}:null}));
  for(const sp of specs)items.push(el('skill-row skill-spec-row',{skillSearch:`${sp} spec`,specParent:name,skillLevel:'2'},{querySelector:()=>null}));
 }
 // headings made by the filter get a real class
 list.ownerDocument.createElement=()=>{const h=el('skill-group-head');h.textContent='';h.className='skill-group-head';return h};
 const count={textContent:''},controls={},root={isConnected:true,querySelector:s=>s==='.skills-list'?list:s==='[data-skill-filter-count]'?count:controls[s]||null,querySelectorAll:s=>list.querySelectorAll(s)};
 root.querySelectorAll=s=>s==='.skill-row[data-skill-search]'?items.filter(i=>i.classList.contains('skill-row')&&i.dataset.skillSearch):list.querySelectorAll(s);
 return {items,list,root,count,controls,names:()=>items.map(i=>i.classList.contains('skill-group-head')?'#'+i.dataset.skillHead:i.classList.contains('skill-spec-row')?'  spec of '+i.dataset.specParent:i.querySelector('input[data-skill]').dataset.skill)};
}
const SK=[['Concentration','Концентрация','WILL',2],['Athletics','Атлетика','DEX',0],['Language (Other)','Язык (другой)','INT',0,['Esperanto']],['Local Expert (Home)','Знание района (дом)','INT',3]];

test('order: by STAT, by category and A–Z, in the language shown, with the book order kept inside a group',()=>{
 const w=load(),rows=[{name:'Concentration',ru:'Концентрация',stat:'WILL',group:'awareness',index:0},{name:'Athletics',ru:'Атлетика',stat:'DEX',group:'body',index:1},{name:'Language (Other)',ru:'Язык (другой)',stat:'INT',group:'education',index:2},{name:'Accounting',ru:'Бухгалтерия',stat:'INT',group:'education',index:3}];
 const G=w.SkillReference.GROUPS;
 same(w.SkillFilter.order(rows,'stat','en').map(g=>[g.id,g.items.map(i=>i.name)]),[['INT',['Language (Other)','Accounting']],['DEX',['Athletics']],['WILL',['Concentration']]]);
 same(w.SkillFilter.order(rows,'stat','ru').map(g=>g.label),['INT · Интеллект','DEX · Ловкость','WILL · Воля']);
 same(w.SkillFilter.order(rows,'category','ru').map(g=>[g.label,g.items.length]),[['Восприятие',1],['Тело',1],['Образование',2]]);
 same(w.SkillFilter.order(rows,'category','en').map(g=>g.label),['Awareness','Body','Education']);
 const az=w.SkillFilter.order(rows,'az','en');same(az.length,1);same(az[0].label,'');same(az[0].items.map(i=>i.name),['Accounting','Athletics','Concentration','Language (Other)']);
 same(w.SkillFilter.order(rows,'az','ru')[0].items.map(i=>i.ru),['Атлетика','Бухгалтерия','Концентрация','Язык (другой)'],'sorted by the Russian names in Russian');
 same(w.SkillFilter.order(rows,'nonsense','en').map(g=>g.id),['awareness','body','education'],'an unknown mode is the category mode');
 same(w.SkillFilter.order('x','stat','en'),[]);
 // a skill with an unknown category or STAT is not lost
 same(w.SkillFilter.order([{name:'X',ru:'Х',stat:'?',group:'',index:0}],'stat','en').map(g=>g.id),['?']);
 same(w.SkillFilter.order([{name:'X',ru:'Х',stat:'INT',group:'new',index:0}],'category','en').map(g=>g.id),['new']);
});

test('groupOf finds the category of the sheet\'s Skill names, also the ones with a suffix',()=>{
 const w=load();
 assert.equal(w.SkillFilter.groupOf('Concentration'),'awareness');
 assert.equal(w.SkillFilter.groupOf('Language (Streetslang)'),'education');
 assert.equal(w.SkillFilter.groupOf('Local Expert (Other)'),'education');
 assert.equal(w.SkillFilter.groupOf('Nothing'),'other');
 assert.equal(w.SkillFilter.groupOf(undefined),'other');
});

test('hide zeroes and search are one rule over a row',()=>{
 const w=load(),P=w.SkillFilter.passes;
 assert.equal(P({search:'Athletics Атлетика DEX',value:'0'},['ath'],false),true);
 assert.equal(P({search:'Athletics Атлетика DEX',value:'0'},['ath'],true),false);
 assert.equal(P({search:'Athletics Атлетика DEX',value:'3'},['ath'],true),true);
 assert.equal(P({search:'Athletics Атлетика DEX',value:'abc'},[],true),false,'a value that is not a number is not trained');
 assert.equal(P({search:'Athletics',value:'3'},['dex'],false),false);
});

test('regroup moves the rows with their specializations, puts headings between groups and keeps the book order recoverable',()=>{
 const w=load(),L=fakeList(SK),c={};
 w.SkillFilter.render(c,'ru','a',1);
 const sel={dataset:{skillFilter:'group'},value:'stat',isConnected:true,closest:()=>L.root};L.controls['[data-skill-filter="group"]']=sel;
 assert.equal(w.SkillFilter.handle({type:'change',target:sel},c,'ru','a',1),true);
 same(L.names(),['#INT','Language (Other)','  spec of Language (Other)','Local Expert (Home)','#DEX','Athletics','#WILL','Concentration']);
 // the same mode again does not touch the page
 const before=L.names().join();w.SkillFilter.apply(L.root,'ru');assert.equal(L.names().join(),before);
 // back to categories: the book order, headings of the categories, the specialization still under its Skill
 const cat={dataset:{skillFilter:'group'},value:'category',isConnected:true,closest:()=>L.root};L.controls['[data-skill-filter="group"]']=cat;
 w.SkillFilter.handle({type:'change',target:cat},c,'ru','a',1);
 same(L.names(),['#awareness','Concentration','#body','Athletics','#education','Language (Other)','  spec of Language (Other)','Local Expert (Home)']);
 // A–Z in English: no headings
 const az={dataset:{skillFilter:'group'},value:'az',isConnected:true,closest:()=>L.root};L.controls['[data-skill-filter="group"]']=az;
 w.SkillFilter.handle({type:'change',target:az},c,'en','a',1);
 same(L.names(),['Athletics','Concentration','Language (Other)','  spec of Language (Other)','Local Expert (Home)']);
});

test('the group and hide-zeroes choices are kept per device and survive a new page; a bad stored value is ignored',()=>{
 const storage=memory(),c={};let w=load({storage});
 const root={isConnected:true,querySelector:()=>sel,querySelectorAll:()=>[]};const sel={dataset:{skillFilter:'group'},value:'stat',isConnected:true,closest:()=>root};
 w.SkillFilter.render(c,'en','a',1);w.SkillFilter.handle({type:'change',target:sel},c,'en','a',1);
 const box={dataset:{skillFilter:'trained'},checked:true,isConnected:true,closest:()=>({isConnected:true,querySelector:()=>box,querySelectorAll:()=>[]})};
 w.SkillFilter.handle({type:'change',target:box},c,'en','a',1);
 assert.equal(storage.getItem('nc-pref-skill-group'),'"stat"');assert.equal(storage.getItem('nc-pref-skill-hide-zero'),'true');
 w=load({storage});const html=w.SkillFilter.render({},'en','a',1);
 assert.match(html,/<option value="stat" selected>/);assert.match(html,/data-skill-filter="trained" checked/);
 // not in the archive: only the nc-pref- keys were written
 assert.deepEqual([...storage.store.keys()].sort(),['nc-pref-skill-group','nc-pref-skill-hide-zero']);
 storage.setItem('nc-pref-skill-group','"bogus"');storage.setItem('nc-pref-skill-hide-zero','"yes"');
 w=load({storage});const bad=w.SkillFilter.render({},'en','a',1);
 assert.match(bad,/<option value="category" selected>/);assert.doesNotMatch(bad,/data-skill-filter="trained" checked/);
});

test('with blocked storage the choice is kept for the visit and nothing throws',()=>{
 const blocked={getItem(){throw new Error('blocked')},setItem(){throw new Error('blocked')},removeItem(){throw new Error('blocked')},length:0,key:()=>null};
 const w=load({storage:blocked}),c={};w.SkillFilter.render(c,'ru','a',1);
 const sel={dataset:{skillFilter:'group'},value:'az',isConnected:true,closest:()=>({isConnected:true,querySelector:()=>sel,querySelectorAll:()=>[]})};
 assert.doesNotThrow(()=>w.SkillFilter.handle({type:'change',target:sel},c,'ru','a',1));
 assert.match(w.SkillFilter.render(c,'ru','a',1),/<option value="az" selected>/);
});

test('both languages for the controls and the markup stays escaped',()=>{
 const w=load();
 const ru=w.SkillFilter.render({},'ru','a',1),en=w.SkillFilter.render({},'en','a',1);
 for(const word of ['Группировка','По категориям','По STAT','По алфавиту','Скрыть нулевые'])assert.ok(ru.includes(word),word);
 for(const word of ['Group by','By category','By STAT','A–Z','Hide zeroes'])assert.ok(en.includes(word),word);
 assert.doesNotMatch(ru,/Только изученные/);
});

test('the page wires the filter data: every Skill row carries its STAT and Russian name',()=>{
 const app=src('app.js');
 assert.match(app,/data-skill-stat="\$\{s\[2\]\}" data-skill-ru="\$\{esc\(s\[1\]\)\}"/);
 assert.match(src('index.html'),/sheet-compact\.css/);
});

test('«hide zeroes» is not applied while no Skill is above zero (a fresh sheet is never an empty list)',()=>{
 const w=load();const E=w.SkillFilter.effectiveHideZero;
 assert.equal(E(['0','0','0'],true),false);assert.equal(E(['0','3'],true),true);assert.equal(E(['0','3'],false),false);assert.equal(E([],true),false);assert.equal(E('x',true),false);
 const fresh=fakeList([['Concentration','Концентрация','WILL',0],['Athletics','Атлетика','DEX',0]]);
 w.localStorage.setItem('nc-pref-skill-hide-zero','true');w.SkillFilter.reset(fresh.root,{},'ru','a',1);
 assert.equal(w.SkillFilter.state().trained,true,'the preference is on');
 assert.equal(fresh.items.filter(i=>i.classList.contains('skill-row')&&i.hidden).length,0,'every row stays visible');
 assert.match(fresh.count.textContent,/2 из 2/);
});
