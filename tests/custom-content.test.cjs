const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const read=name=>fs.readFileSync(__dirname+'/../site/'+name,'utf8');
const source=read('custom-content.js'),catalogSource=read('catalog.js'),npcSource=read('npc-library.js');
const plain=x=>JSON.parse(JSON.stringify(x));
function storage(initial={}){
 const map=new Map(Object.entries(initial));let full=false;
 return {getItem:k=>map.has(k)?map.get(k):null,setItem(k,v){if(full)throw Error('quota');map.set(k,String(v))},removeItem:k=>{map.delete(k)},key:i=>[...map.keys()][i]??null,get length(){return map.size},map,fill(v=true){full=v}};
}
// A fresh copy for every test: the module keeps the collection and its form state.
function load(options={}){
 const calls=[],state={gmExtras:{},campaigns:[{id:'k',name:'Job',roster:[]}]},localStorage=options.storage||storage(options.initial);
 const window={localStorage,App:{getState:()=>state,save(){calls.push(['save'])},render(){calls.push(['render'])},notify:m=>calls.push(['notify',m]),lang:()=>options.lang||'ru',check:(base,label,opts)=>{calls.push(['check',base,label,opts]);return {total:base}},dice:(n,s,label)=>{calls.push(['dice',n,s,label]);return n}}};
 const context={window,Date,Math,JSON,Promise,setTimeout,globalThis:{}};
 if(options.catalog!==false)vm.runInNewContext(catalogSource,context);
 if(options.npc)vm.runInNewContext(npcSource,context);
 vm.runInNewContext(source,context);
 return {C:window.CustomContent,window,state,calls,localStorage,N:window.NpcLibrary};
}
const root=()=>({isConnected:true,dataset:{lang:'ru'},outerHTML:''});
const click=(C,action,data={},r=root())=>C.handle({type:'click',target:{closest:s=>s==='[data-cc-root]'?r:s==='[data-cc-action]'?{dataset:{ccAction:action,...data}}:null,dataset:{}}},'ru');
const type=(C,field,value,r=root(),extra={})=>C.handle({type:'input',target:{closest:s=>s==='[data-cc-root]'?r:null,dataset:{ccField:field},value,...extra}},'ru');
const weapon={id:'w1',category:'weapon',name:{ru:'Обрез',en:'Sawn-off'},price:250,details:{ru:'Громкий',en:'Loud'},stats:{damage:'5D6',rof:1,hands:2,concealable:true,skill:'Shoulder Arms',magazine:2,ammo:'Slug'}};
const npc={id:'n1',name:'Стрелок',ref:7,hp:35,head:7,torso:11,body:6,will:5,weapons:'Нож',notes:'Трус',skills:[{name:'Уклонение',base:9}],attacks:[{name:'Пистолет',base:12,damage:'3d6'}]};

test('an item is rebuilt from a whitelist: shape of the catalog, own limits, nothing extra',()=>{
 const {C}=load();
 const r=C.checkItem({...weapon,evil:'<script>',__proto__:{polluted:1},stats:{...weapon.stats,extra:'x'}});
 assert.equal(r.ok,true);
 assert.deepEqual(plain(r.item),{id:'w1',category:'weapon',name:{ru:'Обрез',en:'Sawn-off'},price:250,details:{ru:'Громкий',en:'Loud'},stats:{damage:'5d6',rof:1,hands:2,concealable:true,skill:'Shoulder Arms',magazine:2,ammo:'Slug'}});
 assert.deepEqual(plain(C.cleanItem({id:'a',category:'armor',name:{en:'Plate'},stats:{sp:'12',penalty:-2}})),{id:'a',category:'armor',name:{ru:'',en:'Plate'},price:null,details:{ru:'',en:''},stats:{sp:12,penalty:-2}});
 assert.deepEqual(plain(C.cleanItem({id:'c',category:'cyberware',name:{ru:'Глаз'},price:'500',stats:{humanityLoss:'2D6',installation:'Mall'}}).stats),{humanityLoss:'2d6',humanityLossAtCreation:7,installation:'Mall'});
 assert.deepEqual(plain(C.cleanItem({id:'g',category:'gear',name:{ru:'Фонарь'},stats:{damage:'9d6'}}).stats),{},'gear has no stats');
 assert.equal(C.humanityAtCreation('1d6/2'),2);assert.equal(C.humanityAtCreation('4d6'),14);assert.equal(C.humanityAtCreation('0'),0);
});

test('an item that cannot be read says why',()=>{
 const {C}=load(),bad=(patch,reason)=>assert.equal(C.checkItem({...weapon,...patch}).reason,reason,JSON.stringify(patch));
 bad({id:'has space'},'id');bad({id:'x'.repeat(33)},'id');bad({id:7},'id');
 bad({name:{ru:'  ',en:''}},'name');bad({name:'Обрез'},'name');
 bad({category:'vehicles'},'category');bad({category:'constructor'},'category');
 bad({price:-1},'price');bad({price:1.5},'price');bad({price:'много'},'price');bad({price:1e9},'price');
 bad({stats:{...weapon.stats,damage:'drop table'}},'damage');bad({stats:{...weapon.stats,damage:'0d6'}},'damage');bad({stats:{...weapon.stats,damage:'3d8'}},'damage');
 bad({stats:{...weapon.stats,skill:'<b>Handgun</b>'}},'skill');
 assert.equal(C.checkItem({id:'a',category:'armor',name:{ru:'x'},stats:{sp:99}}).reason,'sp');
 assert.equal(C.checkItem({id:'c',category:'cyberware',name:{ru:'x'},stats:{humanityLoss:'много'}}).reason,'humanity');
 for(const v of [null,undefined,'x',7,[],[weapon]])assert.equal(C.checkItem(v).ok,false);
});

test('strings are cut, flattened and stripped of control characters',()=>{
 const {C}=load();
 const item=C.cleanItem({id:'g',category:'gear',name:{ru:'А\u0000Б\n\tВ'+'я'.repeat(200),en:'x'},details:{ru:'д'.repeat(1000)}});
 assert.equal(item.name.ru.startsWith('А Б В'),true);assert.equal(item.name.ru.length,80);assert.equal(item.details.ru.length,400);
 const w=C.cleanItem({...weapon,stats:{...weapon.stats,magazine:5000,ammo:'Slug'}});assert.equal(w.stats.magazine,null);assert.equal(w.stats.ammo,null,'a magazine out of range means no ammunition');
 assert.equal(C.cleanItem({...weapon,stats:{...weapon.stats,ammo:'Plasma'}}).stats.ammo,null);
 assert.equal(C.cleanItem({...weapon,stats:{...weapon.stats,rof:99,hands:'varies'}}).stats.rof,4);
});

test('an opponent has the NPC library shape and passes its own check unchanged',()=>{
 const {C,N}=load({npc:true});
 const n=C.cleanNpc({...npc,junk:1,skills:[...npc.skills,{name:'',base:1},{name:'x',base:'много'}],attacks:[...npc.attacks,{name:'Плохой',base:1,damage:'<img>'}]});
 assert.deepEqual(plain(n),npc);
 const entry=C.toNpcEntry(n);assert.equal(entry.id,'cc-n1');
 assert.deepEqual(plain(N.cleanEntry(entry)),plain(entry),'the library keeps a custom opponent exactly as it is');
 assert.equal(C.checkNpc({id:'n',name:'  '}).reason,'npcName');assert.equal(C.checkNpc({id:'<x>',name:'a'}).reason,'id');
 const old=C.cleanNpc({id:'o',name:'Старый'});assert.deepEqual(plain(old),{id:'o',name:'Старый',ref:6,hp:30,head:0,torso:0,weapons:'',notes:''});
 assert.equal(C.cleanNpc({id:'long',name:'x',ref:999,hp:-5,head:1e9}).ref,20);
 assert.equal(C.hpFromStats(6,5),40);assert.equal(C.hpFromStats('',5),null);
});

test('a collection keeps ids unique, counts what it could not read and stops at the limits',()=>{
 const {C}=load();
 const d=C.cleanData({items:[weapon,{...weapon,name:{ru:'Двойник'}},{id:'bad',category:'weapon',name:{ru:'Без урона'},stats:{}},null,'x'],npcs:[npc,{name:'Без id'}],extra:{a:1}});
 assert.equal(d.items.length,1);assert.equal(d.npcs.length,1);
 assert.deepEqual(plain(d.rejected.map(r=>[r.kind,r.name,r.reason])),[['item','Двойник','duplicate'],['item','Без урона','damage'],['item','','name'],['item','','name'],['npc','Без id','id']]);
 const many=C.cleanData({items:Array.from({length:400},(_,i)=>({id:'g'+i,category:'gear',name:{ru:'Вещь '+i}})),npcs:Array.from({length:150},(_,i)=>({id:'n'+i,name:'NPC '+i}))});
 assert.equal(many.items.length,C.MAX_ITEMS);assert.equal(many.npcs.length,C.MAX_NPCS);assert.equal(many.rejected.filter(r=>r.reason==='full').length,150);
 for(const v of [null,[],'x',{items:'x',npcs:{}}])assert.deepEqual(plain(C.cleanData(v)),{items:[],npcs:[],rejected:[]});
});

test('custom items are mirrored into the catalog, found by the search and marked',()=>{
 const {C,window}=load(),before=window.CATALOG.length;
 assert.equal(C.saveItem(C.getData(),weapon).ok,true);
 click(C,'toggle');click(C,'new',{ccKind:'item'});
 for(const [k,v] of [['nameRu','Обрез <b>'],['category','weapon'],['price','250'],['damage','5d6'],['skill','Shoulder Arms'],['hands','2'],['magazine','2'],['ammo','Slug'],['descRu','Громкий']])type(C,k,v);
 click(C,'save');
 assert.equal(window.CATALOG.length,before+1);
 const item=window.CATALOG.at(-1);
 assert.equal(item.custom,true);assert.match(item.id,/^custom-c[a-z0-9]+$/);assert.equal(item.page,null);assert.equal(item.name.en,'Обрез <b>','a missing language uses the other one');
 assert.equal(item.details.ru,'Урон 5d6 · ROF 1 · Навык: Shoulder Arms · Руки: 2 · Магазин 2 (Slug) · Громкий');
 assert.match(item.details.en,/^Damage 5d6 · ROF 1 · Skill: Shoulder Arms · Hands: 2 · Magazine 2 \(Slug\) · Громкий$/);
 assert.deepEqual(plain(window.catalogMatches('обрез','weapon').map(x=>x.id)),[item.id]);
 const html=window.renderCatalog('ru','обрез','all');
 assert.match(html,/<span class="badge cc-mark">Своё<\/span>/);assert.match(html,/Обрез &lt;b&gt;/);assert.equal(html.includes('<b>'),false);assert.equal(html.includes('СТР. null'),false);
 assert.match(window.renderCatalog('en','обрез','all'),/cc-mark">Custom</);
 assert.equal(window.renderCatalog('ru','Лёгкое оружие ближнего боя','all').includes('cc-mark'),false,'book items keep their page');
});

test('the catalog is changed in place and never gets two copies or a clash with a book id',()=>{
 const {C}=load({catalog:false});
 const catalog=[{id:'gear-agent'},{id:'custom-old',custom:true},{id:'custom-w1',category:'gear'}];
 assert.equal(C.syncCatalog(catalog,[C.cleanItem(weapon),C.cleanItem({id:'g',category:'gear',name:{ru:'Фонарь'}})]),1,'an id the catalog already has is skipped');
 assert.deepEqual(catalog.map(x=>x.id),['gear-agent','custom-w1','custom-g']);
 C.syncCatalog(catalog,[]);assert.deepEqual(catalog.map(x=>x.id),['gear-agent','custom-w1']);
 assert.equal(C.syncCatalog(undefined,[]),0);
});

test('the collection lives in its own key and comes back after a reload',()=>{
 const a=load();
 click(a.C,'toggle');click(a.C,'new',{ccKind:'item'});type(a.C,'nameEn','Lamp');type(a.C,'price','20');click(a.C,'save');
 click(a.C,'tab',{ccTab:'npcs'});click(a.C,'new',{ccKind:'npc'});type(a.C,'name','Стрелок');type(a.C,'attacksText','Пистолет 12 3d6');type(a.C,'skillsText','Уклонение 9');click(a.C,'save');
 assert.deepEqual([...a.localStorage.map.keys()],['nightcity-red-custom-v1']);
 const stored=JSON.parse(a.localStorage.getItem(a.C.KEY));
 assert.equal(stored.format,'nightcity-red-custom');assert.equal(stored.version,1);assert.equal(stored.items[0].name.en,'Lamp');assert.equal(stored.items[0].price,20);
 assert.deepEqual(stored.npcs[0].attacks,[{name:'Пистолет',base:12,damage:'3d6'}]);
 assert.equal(a.calls.filter(c=>c[0]==='render').length,2,'the page is drawn again so the catalog list shows the change');
 const b=load({storage:a.localStorage});
 assert.deepEqual(b.C.getData(),a.C.getData());assert.equal(b.window.CATALOG.filter(x=>x.custom).length,1);
});

test('editing keeps the id, deleting asks twice, and an empty collection leaves no key behind',()=>{
 const {C,localStorage,window}=load();
 click(C,'toggle');click(C,'new',{ccKind:'item'});type(C,'nameRu','Фонарь');click(C,'save');
 const id=C.getData().items[0].id;
 click(C,'edit',{ccKind:'item',ccId:id});type(C,'nameRu','Фонарь-2');type(C,'category','armor');type(C,'sp','11');click(C,'save');
 assert.deepEqual(C.getData().items.map(x=>[x.id,x.name.ru,x.category,x.stats.sp]),[[id,'Фонарь-2','armor',11]]);
 click(C,'del',{ccKind:'item',ccId:id});assert.equal(C.getData().items.length,1,'the first press only arms the button');
 assert.match(C.render('ru'),/Точно удалить\?/);
 click(C,'del',{ccKind:'item',ccId:id});
 assert.equal(C.getData().items.length,0);assert.equal(localStorage.getItem(C.KEY),null);assert.equal(window.CATALOG.some(x=>x.custom),false);
});

test('the form says what is wrong and saves nothing',()=>{
 const {C,localStorage}=load();
 click(C,'toggle');click(C,'new',{ccKind:'item'});click(C,'save');
 assert.match(C.render('ru'),/role="alert"[^>]*>Укажите название хотя бы на одном языке\./);
 type(C,'nameRu','Пушка');type(C,'category','weapon');type(C,'damage','много');click(C,'save');
 assert.match(C.render('ru'),/Урон записывается кубиками/);assert.match(C.render('en'),/Damage is written as dice/);
 type(C,'damage','2d6');type(C,'price','-5');click(C,'save');assert.match(C.render('ru'),/Цена — целое число/);
 assert.equal(localStorage.getItem(C.KEY),null);
 click(C,'tab',{ccTab:'npcs'});click(C,'new',{ccKind:'npc'});type(C,'name','Ганк');type(C,'attacksText','Пистолет 10 3d8');click(C,'save');
 assert.match(C.render('ru'),/Не удалось прочитать строку: «Пистолет 10 3d8»/);
 assert.equal(C.getData().npcs.length,0);
});

test('a full browser does not lose what is on screen or pretend it was saved',()=>{
 const {C,localStorage,calls}=load();
 click(C,'toggle');click(C,'new',{ccKind:'item'});type(C,'nameRu','Фонарь');localStorage.fill();click(C,'save');
 assert.match(C.render('ru'),/Не удалось сохранить/);assert.match(C.render('ru'),/value="Фонарь"/);assert.equal(C.getData().items.length,0);
 assert.equal(calls.some(c=>c[0]==='notify'),false);
 localStorage.fill(false);click(C,'save');assert.equal(C.getData().items.length,1);
});

test('stored data that cannot be read is set aside, not overwritten; a newer version is not read',()=>{
 const a=load({initial:{'nightcity-red-custom-v1':'{broken'}});
 assert.deepEqual(a.C.getData(),{items:[],npcs:[]});assert.equal(a.localStorage.getItem('nightcity-red-custom-v1:unreadable'),'{broken');
 click(a.C,'toggle');assert.match(a.C.render('ru'),/Исходная копия отложена/);
 click(a.C,'unreadable-drop');assert.equal(a.localStorage.getItem('nightcity-red-custom-v1:unreadable'),null);assert.equal(a.C.render('ru').includes('Исходная копия отложена'),false);
 const newer=JSON.stringify({format:'nightcity-red-custom',version:2,items:[weapon]}),b=load({initial:{'nightcity-red-custom-v1':newer}});
 assert.equal(b.C.getData().items.length,0);assert.equal(b.localStorage.getItem('nightcity-red-custom-v1:unreadable'),newer);
 const c=load({initial:{'nightcity-red-custom-v1':JSON.stringify({format:'nightcity-red-custom',version:1,items:[weapon,{id:'x'}],npcs:'нет'})}});
 assert.equal(c.C.getData().items.length,1,'readable entries of a partly broken collection are kept');assert.equal(c.localStorage.getItem('nightcity-red-custom-v1:unreadable'),null);
});

test('a pack file round-trips and is validated before anything is stored',()=>{
 const a=load();a.C.restoreFromBackup({customContent:{format:'nightcity-red-custom',version:1,items:[weapon],npcs:[npc]}},true);
 const pack=a.C.buildPack(a.C.getData(),'  Арсенал\n ',new Date('2045-01-02T03:04:05Z'));
 assert.equal(pack.format,'nightcity-red-content-pack');assert.equal(pack.version,1);assert.equal(pack.title,'Арсенал');assert.equal(pack.exportedAt,'2045-01-02T03:04:05.000Z');
 const b=load(),r=b.C.parsePack(JSON.stringify(pack));
 assert.equal(r.ok,true);assert.equal(r.title,'Арсенал');assert.deepEqual(plain(r.items),a.C.getData().items);assert.deepEqual(plain(r.npcs),a.C.getData().npcs);
 assert.equal(b.localStorage.getItem(b.C.KEY),null,'reading a pack stores nothing');
 const bad=(text,reason)=>assert.equal(b.C.parsePack(text).reason,reason,String(text).slice(0,40));
 bad('{nope','json');bad(undefined,'json');bad('[]','format');bad('null','format');bad('"x"','format');bad('{}','format');
 bad(JSON.stringify({format:'nightcity-red-character',version:1,items:[weapon]}),'format');
 bad(JSON.stringify({...pack,version:2}),'newer');bad(JSON.stringify({...pack,version:'1'}),'format');bad(JSON.stringify({...pack,version:0}),'format');
 bad(JSON.stringify({...pack,items:[{id:'x'}],npcs:[]}),'empty');
 bad(' '.repeat(b.C.MAX_FILE_CHARS+1),'size');
 bad('['.repeat(200000),'json');
 assert.equal(b.C.readPack({format:'nightcity-red-backup',version:1,characters:[]}).reason,'format','a backup without custom content is not a pack');
 assert.equal(b.C.readPack({format:'nightcity-red-backup',version:1,customContent:{format:'nightcity-red-custom',version:1,items:[weapon]}}).ok,true);
});

test('a hostile pack cannot inject markup, pollute prototypes or grow the store without limit',()=>{
 const {C,localStorage}=load(),xss='"><img src=x onerror=alert(1)><script>alert(2)</script>';
 const text=JSON.stringify({format:'nightcity-red-content-pack',version:1,title:xss,
  items:[{id:'i1',category:'gear',name:{ru:xss,en:xss},price:5,details:{ru:xss,en:xss},stats:{}},{id:xss,category:'gear',name:{ru:'плохой id'}},{id:'i2',category:xss,name:{ru:'x'}},{id:'i3',category:'weapon',name:{ru:'w'},stats:{damage:xss,skill:xss}}],
  npcs:[{id:'n1',name:xss,weapons:xss,notes:xss,skills:[{name:xss,base:5}],attacks:[{name:xss,base:5,damage:'1d6'},{name:'d',base:1,damage:xss}]}]}).replace('"version":1','"version":1,"__proto__":{"polluted":true},"constructor":{"prototype":{"polluted":true}}');
 click(C,'toggle');click(C,'tab',{ccTab:'pack'});
 const r=C.openPack(text,'ru');
 assert.equal(r.ok,true);assert.equal(r.items.length,1);assert.equal(r.npcs.length,1);assert.equal(r.rejected.length,3);
 assert.equal({}.polluted,undefined);assert.equal(r.items[0].polluted,undefined);assert.equal(r.polluted,undefined);
 const preview=C.render('ru');
 assert.match(preview,/ПРЕДПРОСМОТР НАБОРА/);assert.match(preview,/Новых: 2 · заменит ваши: 0 · без изменений: 0/);assert.match(preview,/Не прочитано и будет пропущено: 3/);
 for(const html of [preview,C.render('en')]){assert.equal(/<img|<script|onerror=alert\(1\)>/.test(html),false);assert.match(html,/&lt;img src=x onerror=alert\(1\)&gt;/)}
 assert.equal(localStorage.getItem(C.KEY),null,'the preview stores nothing');
 click(C,'apply');
 const stored=JSON.parse(localStorage.getItem(C.KEY));
 assert.deepEqual(Object.keys(stored),['format','version','items','npcs']);assert.deepEqual(Object.keys(stored.items[0]),['id','category','name','price','details','stats']);
 click(C,'tab',{ccTab:'items'});assert.equal(/<img|<script/.test(C.render('ru')),false);
 click(C,'tab',{ccTab:'npcs'});assert.equal(/<img|<script/.test(C.render('ru')),false);
 const huge=JSON.stringify({format:'nightcity-red-content-pack',version:1,items:Array.from({length:5000},(_,i)=>({id:'h'+i,category:'gear',name:{ru:'x'}}))});
 const h=C.parsePack(huge);assert.equal(h.ok,true);assert.equal(h.items.length,C.MAX_ITEMS);
 const done=C.applyImport(C.getData(),h);assert.equal(done.data.items.length,C.MAX_ITEMS);assert.equal(done.overflow,1,'one place was already taken');
});

test('the preview tells new entries from replacements and unchanged ones, and loading follows it',()=>{
 const {C}=load();
 C.restoreFromBackup({customContent:{format:'nightcity-red-custom',version:1,items:[weapon,{id:'g',category:'gear',name:{ru:'Фонарь'}}],npcs:[npc]}},true);
 const pack=C.readPack({format:'nightcity-red-content-pack',version:1,items:[weapon,{id:'g',category:'gear',name:{ru:'Фонарь'},price:30},{id:'new',category:'gear',name:{ru:'Трос'}}],npcs:[{...npc,hp:50}]});
 const plan=C.planImport(C.getData(),pack);
 assert.deepEqual(plain(plan.items.map(x=>x.status)),['same','update','new']);assert.deepEqual(plain(plan.npcs.map(x=>x.status)),['update']);
 assert.deepEqual([plan.added,plan.updated,plan.same,plan.overflow],[1,2,1,0]);
 const before=C.getData(),r=C.applyImport(before,pack);
 assert.deepEqual(before,C.getData(),'planning and applying do not touch the stored collection');
 assert.deepEqual(plain(r.data.items.map(x=>[x.id,x.price])),[['w1',250],['g',30],['new',null]]);assert.equal(r.data.npcs[0].hp,50);
 click(C,'toggle');click(C,'tab',{ccTab:'pack'});C.openPack(JSON.stringify({format:'nightcity-red-content-pack',version:1,items:pack.items,npcs:pack.npcs}));
 const html=C.render('ru');assert.match(html,/cc-tag-same">уже есть/);assert.match(html,/cc-tag-update">заменит/);assert.match(html,/cc-tag-new">новое/);
 click(C,'discard');assert.equal(C.render('ru').includes('data-cc-preview'),false);assert.equal(C.getData().items.length,2);
 C.openPack(JSON.stringify({format:'nightcity-red-content-pack',version:1,items:[weapon]}),'ru');
 assert.match(C.render('ru'),/В наборе нет ничего нового\./);assert.equal(C.render('ru').includes('data-cc-action="apply"'),false);
 C.openPack('{nope','en');assert.match(C.render('en'),/role="alert"[^>]*>This is not a pack file/);
});

test('backups carry the collection and give it back without touching the main archive',()=>{
 const a=load();
 assert.deepEqual(plain(a.C.backupPart()),{},'nothing custom: the backup file stays as it was');
 a.C.restoreFromBackup({customContent:{format:'nightcity-red-custom',version:1,items:[weapon],npcs:[npc]}},true);
 const file={format:'nightcity-red-backup',version:1,characters:[],campaigns:[],_completeSnapshot:{characters:[],campaigns:[]},...a.C.backupPart()};
 assert.deepEqual(Object.keys(file._completeSnapshot),['characters','campaigns'],'the main snapshot does not hold custom content');
 const b=load(),r=b.C.restoreFromBackup(JSON.parse(JSON.stringify(file)));
 assert.deepEqual(plain(r),{ok:true,changed:2,kept:0});assert.deepEqual(b.C.getData(),a.C.getData());
 assert.deepEqual(b.calls.filter(c=>c[0]==='notify').map(c=>c[1]),['Свои материалы из копии: 2.']);
 assert.equal(b.C.restoreFromBackup(file).changed,0,'the same backup twice changes nothing');
 for(const old of [{format:'nightcity-red-backup',version:1,characters:[]},null,'x',{customContent:'x'},{customContent:{format:'other',version:1,items:[weapon]}}])assert.equal(b.C.restoreFromBackup(old).ok,false);
 assert.deepEqual(b.C.getData(),a.C.getData());
});

test('custom opponents show in the NPC library, roll and join a fight, but are edited only in the editor',()=>{
 const {C,N,state,calls}=load({npc:true});
 assert.equal(N.render('ru').includes('cc-mark'),false);
 C.restoreFromBackup({customContent:{format:'nightcity-red-custom',version:1,npcs:[{...npc,name:'<i>Стрелок</i>'}]}},true);
 const html=N.render('ru');
 assert.match(html,/data-nl-entry="cc-n1"/);assert.match(html,/&lt;i&gt;Стрелок&lt;\/i&gt;/);assert.equal(html.includes('<i>'),false);assert.match(html,/cc-mark">Своё</);
 assert.equal(html.includes('data-nl-action="edit"'),false);assert.equal(html.includes('data-nl-action="del"'),false);
 assert.match(html,/СВОИ ПРОТИВНИКИ · 0\/100/,'the library count is about its own presets');
 assert.match(N.render('en'),/cc-mark">Custom</);
 const nlRoot={isConnected:true,dataset:{lang:'ru'},outerHTML:''},box={querySelector:s=>s==='[data-nl-pick]'?{value:'k'}:{value:'2'}};
 const press=(action,data)=>N.handle({type:'click',target:{closest:s=>s==='[data-nl-root]'?nlRoot:s==='[data-nl-action]'?{dataset:{nlAction:action,...data},closest:()=>box}:null,dataset:{}}},'ru');
 press('roll-attack',{nlId:'cc-n1',nlI:'0'});
 assert.deepEqual(plain(calls.find(c=>c[0]==='check')),['check',12,'<i>Стрелок</i> · Пистолет · атака',{wounds:false}]);
 press('add',{nlId:'cc-n1'});
 assert.deepEqual(state.campaigns[0].roster.map(r=>[r.name,r.hp,r.sourceLibrary,r.sp.head]),[['<i>Стрелок</i> 1',35,'cc-n1',7],['<i>Стрелок</i> 2',35,'cc-n1',7]]);
 assert.equal(state.gmExtras.npcLibrary,undefined,'the library itself is not written');
});

test('the editor is drawn in both languages, closed by default, with labelled controls',()=>{
 const {C}=load();
 const closed=C.render('ru');
 assert.match(closed,/<h2 class="cc-title">Свои материалы<\/h2>/);assert.match(closed,/aria-expanded="false"[^>]*>Открыть редактор</);assert.equal(closed.includes('cc-body'),false);
 assert.match(C.render('en'),/My content/);assert.match(C.render('xx'),/Свои материалы/);
 click(C,'toggle');click(C,'new',{ccKind:'item'});
 for(const [lang,words] of [['ru',['Название (русский)','Категория','Цена, eb','Описание (English)','Сохранить','Отмена']],['en',['Name (Russian)','Category','Price, eb','Description (English)','Save','Cancel']]])for(const w of words)assert.equal(C.render(lang).includes(w),true,w);
 type(C,'category','weapon');assert.match(C.render('ru'),/Урон \(кубики\)/);type(C,'category','armor');assert.match(C.render('en'),/Stopping power \(SP\)/);type(C,'category','cyberware');assert.match(C.render('ru'),/Потеря Humanity/);
 const html=C.render('ru');
 assert.equal((html.match(/<(input|select|textarea)\b/g)||[]).length,(html.match(/<label\b/g)||[]).length,'every control sits in its own label');
 click(C,'tab',{ccTab:'pack'});assert.match(C.render('ru'),/data-cc-action="export" disabled/);assert.match(C.render('ru'),/type="file" accept="application\/json,\.json"/);
 C.reset();assert.equal(C.render('ru').includes('cc-body'),false);
});

test('a custom weapon and a custom implant can be added to a sheet and bought, without a page number in the notes',()=>{
 const ctx={window:{localStorage:storage()},console};vm.createContext(ctx);
 for(const f of ['catalog.js','catalog-extra.js','character-extra.js','equipment-tools.js','custom-content.js'])vm.runInContext(read(f),ctx);
 const C=ctx.window.CustomContent,c={id:'c1',name:'V',role:'solo',stats:{INT:6,REF:6,DEX:6,TECH:6,COOL:6,WILL:6,LUCK:6,MOVE:6,BODY:8,EMP:6},skills:{},hp:45,humanity:60,head:0,bodyArmor:0,extra:{cash:1000,gearBudget:0,fashionBudget:0,items:[],weapons:[]}};
 C.restoreFromBackup({customContent:{format:'nightcity-red-custom',version:1,items:[weapon,{id:'eye',category:'cyberware',name:{ru:'Глаз'},price:100,stats:{humanityLoss:'1d6'}},{id:'free',category:'gear',name:{en:'Trinket'}}]}},true);
 const find=id=>ctx.window.CATALOG.find(x=>x.id===id);
 const w=ctx.window.CharacterExtra.addCatalog(c,find('custom-w1'),'ru');
 assert.equal(w.kind,'weapon');assert.equal(w.record.name,'Обрез');assert.equal(w.record.damage,'5d6');assert.equal(w.record.skill,'Shoulder Arms');assert.equal(w.record.stat,'REF');assert.equal(w.record.capacity,2);assert.equal(w.record.usesAmmo,true);assert.equal(w.record.catalogId,'custom-w1');
 assert.match(w.record.notes,/своё · 250 eb/);assert.equal(w.record.notes.includes('стр.'),false);
 const bought=ctx.window.EquipmentTools.purchase(c,find('custom-eye'),'cash','en',{confirmed:true});
 assert.equal(bought.ok,true);assert.equal(c.extra.cash,900);
 const eye=c.extra.items.find(i=>i.catalogId==='custom-eye');assert.equal(eye.category,'cyberware');assert.match(eye.notes,/custom · 100 eb · Humanity loss: 1d6/);
 assert.equal(ctx.window.EquipmentTools.quote(c,find('custom-free'),'cash','ru').reason,'invalidPrice','an item without a price can be added but not bought');
 assert.equal(ctx.window.CharacterExtra.addCatalog(c,find('custom-free'),'en').record.name,'Trinket');
 assert.match(ctx.window.CharacterExtra.addCatalog(c,find('weapon-heavy-pistol'),'ru').record.notes,/стр\. \d+/,'book items keep their page');
});

test('adding an older backup never replaces an entry edited here; only "replace everything" takes the file\'s version',()=>{
 const {C,calls}=load(),file=()=>plain({format:'nightcity-red-backup',version:1,characters:[],...C.backupPart()});
 C.restoreFromBackup({customContent:{format:'nightcity-red-custom',version:1,items:[{...weapon,price:100}],npcs:[npc]}},true);
 const older=file();
 C.restoreFromBackup({customContent:{format:'nightcity-red-custom',version:1,items:[{...weapon,price:777}]}},{quiet:true,overwrite:true});
 assert.equal(C.getData().items[0].price,777);
 older.customContent.items.push({id:'g9',category:'gear',name:{ru:'Фонарь'}});
 assert.deepEqual(plain(C.backupPlan(older)),{added:1,kept:1,same:1,overflow:0});assert.equal(C.backupPlan({characters:[]}),null);
 const r=C.restoreFromBackup(older);
 assert.deepEqual(plain(r),{ok:true,changed:1,kept:1});
 assert.equal(C.getData().items.find(x=>x.id==='w1').price,777,'the newer edit stays');assert.equal(C.getData().items.length,2);
 assert.deepEqual(calls.filter(c=>c[0]==='notify').map(c=>c[1]),['Свои материалы из копии: 1. Не изменено: 1 — у вас уже есть свои версии этих записей.']);
 assert.deepEqual(plain(C.restoreFromBackup(older,true)),{ok:true,changed:0,kept:1},'the old quiet flag still adds only');assert.equal(C.getData().items[0].price,777);
 assert.deepEqual(plain(C.restoreFromBackup(older,{quiet:true,overwrite:true})),{ok:true,changed:1,kept:0});assert.equal(C.getData().items.find(x=>x.id==='w1').price,100);
});

// The real app.js with the transfer panel and the custom collection, enough of a page to press its inputs.
function appHarness({lang='ru',encoded=[]}={}){
 const listeners={},docListeners={},notices=[],ls=new Map(),store=new Map();let uid=0;
 const el=()=>({innerHTML:'',setAttribute(){},addEventListener(t,fn){(listeners[t]||=[]).push(fn)}}),nodes={'#app':el(),'#sync-root':el(),'#sync-adapter-status':el(),'#app-notice':{set textContent(v){notices.push(v)},classList:{add(){},remove(){}}}};
 const adapter={stateLabel:()=>'',start(){},canEdit:()=>true,getScope:()=>'local',hasQueued:()=>false,save:()=>Promise.resolve({ok:true}),copies:()=>[],readCopy:id=>store.get(id)??null,removeCopy:id=>store.delete(id),keepBeforeRestore(snapshot){const id='copy-'+store.size;store.set(id,snapshot);return id},dropOlderBeforeRestore(){},forget(){},lastBackup:()=>null,persistence:()=>'granted'};
 const localStorage={getItem:k=>ls.has(k)?ls.get(k):null,setItem:(k,v)=>{ls.set(k,String(v))},removeItem:k=>{ls.delete(k)}};
 const document={querySelector:s=>nodes[s]||null,documentElement:{},title:'',createElement:()=>({click(){},remove(){}}),body:{appendChild(){}},addEventListener(t,fn){(docListeners[t]||=[]).push(fn)}};
 class Enc extends TextEncoder{encode(text){encoded.push(text);return super.encode(text)}}
 const w={document,ROLES:[{id:'solo',name:{en:'Solo',ru:'Соло'},description:{en:'',ru:''}}],CombatTools:{handle:()=>false},Book:{handle:()=>false},Campaigns:{handle:()=>false,render:()=>''},NetTools:{setScope(){},validArchitectures:Array.isArray},RoleTools:{render:()=>'',handle:()=>({handled:false}),refresh(){}},LocalStore:{create:()=>adapter},confirm:()=>true,scrollTo(){},crypto:globalThis.crypto,localStorage,addEventListener(){},setTimeout,clearTimeout};
 const ctx={window:w,document,Blob:class{},URL:{createObjectURL:()=>'blob:x',revokeObjectURL(){}},localStorage,globalThis:{crypto:{randomUUID:()=>'id-'+(++uid)}},confirm:()=>true,setTimeout:()=>0,clearTimeout(){},console,Math,Date,JSON,Set,Map,Number,String,Array,Object,Promise,WeakMap,TextEncoder:Enc,TextDecoder,Uint8Array,Error};
 vm.createContext(ctx);for(const f of ['catalog.js','character-extra.js','equipment-tools.js','custom-content.js','transfer.js'])vm.runInContext(read(f),ctx);
 vm.runInContext(read('app.js')+`\nrender=()=>{};state.lang=${JSON.stringify(lang)};state.view='characters';window.qa={state:()=>state};`,ctx);
 const input=(id,data)=>{const node={id,isConnected:true,value:'x',files:[{name:'a.json',size:10,text:async()=>JSON.stringify(data)}],closest:()=>null,matches:()=>false,dataset:{}};nodes['#'+id]=node;return node};
 const change=async(id,data)=>{const target=input(id,data);for(const fn of listeners.change)await fn({target,type:'change'});delete nodes['#'+id]};
 const inRoot={closest:s=>s==='[data-transfer-root]'?{}:null};
 const openFile=data=>w.Transfer._test.onChange({target:{...inRoot,matches:s=>s==='[data-xfer-file]',files:[{name:'a.json',size:10,text:async()=>JSON.stringify(data)}],value:'x'}});
 const press=action=>w.Transfer._test.onClick({target:{closest:s=>s==='[data-xfer]'?{dataset:{xfer:action},disabled:false,closest:q=>q==='[data-transfer-root]'?{}:null}:null}});
 return {w,C:w.CustomContent,T:w.Transfer,notices,encoded,change,openFile,press,state:()=>w.qa.state()};
}
const sheet=(id,name)=>({id,name,role:'solo',rank:4,stats:{INT:6,REF:6,DEX:6,TECH:6,COOL:6,WILL:6,LUCK:6,MOVE:6,BODY:8,EMP:6},skills:{Handgun:2},hp:45,humanity:60,head:0,bodyArmor:0,extra:{uid:'u-'+id,updatedAt:5}});
const archive=(snapshot,items=[weapon],npcs=[npc])=>({format:'nightcity-red-backup',version:1,savedAt:1,...snapshot,_completeSnapshot:snapshot,customContent:{format:'nightcity-red-custom',version:1,items,npcs}});

test('an archive the app refuses as newer brings no custom content with it',async()=>{
 for(const id of ['import-backup','import-file']){
  const h=appHarness(),newer=archive({schemaVersion:9999,characters:[sheet('a','Вега')],campaigns:[]},[{id:'fromnewer',category:'gear',name:{ru:'из нового архива'},price:1}],[]);
  assert.equal(h.w.App.archive.read(newer).newer,true);
  await h.change(id,newer);
  assert.equal(h.state().characters.length,0,id);assert.deepEqual(h.C.getData(),{items:[],npcs:[]},id+': nothing custom came in');
  assert.equal(h.notices.some(n=>/Свои материалы/.test(n)),false,'the refusal is not replaced by a success notice');
  await h.change(id,archive({schemaVersion:1,characters:[sheet('a','Вега')],campaigns:[]}));
  assert.equal(h.state().characters.length,1,id);assert.deepEqual(h.C.getData().items.map(x=>x.id),['w1'],id+': a readable archive still brings its custom content');
 }
});

test('the transfer panel shows, adds and sends custom content with the archive',async()=>{
 const h=appHarness(),file=archive({schemaVersion:1,characters:[sheet('a','Вега')],campaigns:[]});
 await h.openFile(file);
 const preview=h.T.render('ru');
 assert.match(preview,/Добавятся свои материалы \(предметы и противники\): 2\./);assert.deepEqual(h.C.getData(),{items:[],npcs:[]},'a preview changes nothing');
 h.press('apply-add');
 assert.equal(h.state().characters.length,1);assert.deepEqual([h.C.getData().items.length,h.C.getData().npcs.length],[1,1]);
 assert.equal(h.w.CATALOG.some(x=>x.id==='custom-w1'),true,'the catalog has the item at once');
 assert.match(h.T._test.ui().note.text,/Свои материалы: добавлено 2\./);
 // The same sheets again, with one custom entry changed in the file and one new: only the new one comes in, and the button is not disabled.
 const again=archive({schemaVersion:1,characters:[sheet('a','Вега')],campaigns:[]},[{...weapon,price:1},{id:'g9',category:'gear',name:{ru:'Фонарь'}}],[npc]);
 await h.openFile(again);
 const html=h.T.render('ru');
 assert.match(html,/останутся как здесь: 1\./);assert.match(html,/data-xfer="apply-add">/,'custom content alone is worth adding');assert.equal(html.includes('Добавлять нечего'),false);
 h.press('apply-add');
 assert.deepEqual(h.C.getData().items.map(x=>[x.id,x.price]),[['w1',250],['g9',null]]);assert.equal(h.T._test.ui().note.kind,'ok');assert.equal(h.T._test.ui().incoming,null);
 // Replacing everything adds custom content too and never removes the user's own.
 const other=archive({schemaVersion:1,characters:[sheet('b','Нова')],campaigns:[]},[{id:'r1',category:'gear',name:{ru:'Трос'}}],[]);
 await h.openFile(other);assert.match(h.T.render('ru'),/Свои материалы \(предметы и противники\) не заменяются/);
 h.press('arm');h.press('apply-replace');
 assert.deepEqual(h.state().characters.map(c=>c.name),['Нова']);assert.deepEqual(h.C.getData().items.map(x=>x.id),['w1','g9','r1']);
 // Device to device: the payload carries the collection.
 try{h.press('send')}catch{}
 const sent=h.encoded.map(t=>{try{return JSON.parse(t)}catch{return null}}).find(x=>x&&x.format==='nightcity-red-backup');
 assert.ok(sent,'a payload was built');assert.deepEqual(sent.customContent.items.map(x=>x.id),['w1','g9','r1']);assert.equal(sent.customContent.npcs.length,1);
});

test('a custom implant is installed on the sheet with the Humanity loss its author set, and is not sent to the book',()=>{
 const ctx={window:{localStorage:storage()},console};vm.createContext(ctx);
 for(const f of ['catalog.js','catalog-extra.js','character-extra.js','equipment-tools.js','custom-content.js'])vm.runInContext(read(f),ctx);
 const C=ctx.window.CustomContent,E=ctx.window.EquipmentTools,c={id:'c1',name:'V',role:'solo',stats:{INT:6,REF:6,DEX:6,TECH:6,COOL:6,WILL:6,LUCK:6,MOVE:6,BODY:8,EMP:6},skills:{},hp:45,humanity:60,head:0,bodyArmor:0,extra:{cash:5000,gearBudget:0,fashionBudget:0,items:[],weapons:[]}};
 C.restoreFromBackup({customContent:{format:'nightcity-red-custom',version:1,items:[{id:'eye',category:'cyberware',name:{ru:'Глаз'},price:100,stats:{humanityLoss:'2d6',installation:'Clinic'}},{id:'arm',category:'cyberware',name:{ru:'Рука'},price:100,stats:{humanityLoss:'3d6/2',installation:'Hospital'}},{id:'tat',category:'cyberware',name:{ru:'Тату'},price:10,stats:{humanityLoss:'0',installation:'Mall'}}]}},true);
 const find=id=>ctx.window.CATALOG.find(x=>x.id===id),buy=id=>{assert.equal(E.purchase(c,find(id),'cash','ru',{confirmed:true}).ok,true);return c.extra.items.find(i=>i.catalogId===id).id};
 const eye=buy('custom-eye'),arm=buy('custom-arm'),tat=buy('custom-tat');
 assert.equal(E.setMax(c,60,'ru',true).ok,true);
 for(const lang of ['ru','en']){
  const html=E.render(c,lang);
  assert.equal((html.match(/data-eq-action="prepare"/g)||[]).length,3,'every custom implant has its install controls');
  assert.equal(/стр\. *<|p\. *</.test(html),false,'no dangling page reference');assert.equal(/Corebook|по книге\. *<\/p><\/div>|using the book/.test(html),false,'a homebrew item is not referred to the book');
 }
 const fixed=E.prepare(c,eye,'creation','included',true,'ru');assert.equal(fixed.ok,true);assert.equal(fixed.draft.loss,7);assert.equal(fixed.draft.maxLoss,2);
 assert.equal(E.commit(c,fixed.draft,'ru',true).ok,true);assert.equal(c.humanity,53);assert.equal(c.extra.equipment.maxHumanity,58);
 assert.match(E.render(c,'ru'),/Установлено: 1 \/ 1 · HL 2d6/);
 const rolled=E.prepare(c,arm,'play','found',true,'ru',()=>3);assert.equal(rolled.ok,true);assert.deepEqual(plain(rolled.draft.rolls),[3,3,3]);assert.equal(rolled.draft.loss,5,'3d6/2 rolled as 9, halved up');assert.equal(rolled.draft.fee,1000);
 assert.equal(E.commit(c,rolled.draft,'ru',true).ok,true);assert.equal(c.humanity,48);assert.equal(c.extra.cash,5000-210-1000);
 const none=E.prepare(c,tat,'play','included',true,'ru');assert.equal(none.draft.loss,0);assert.equal(none.draft.maxLoss,0);
 const install=c.extra.equipment.installs[0];assert.equal(E.uninstall(c,install.id,true,true,'ru').ok,true);assert.equal(c.extra.equipment.maxHumanity,58,'removing gives the maximum back');
 assert.equal(E.prepare({...c,extra:{...c.extra,items:[{id:'x',name:'?',quantity:1,catalogId:'custom-eye'}]}},'x','creation','included',true,'ru').ok,true);
 // A book implant that was never audited stays manual, and a broken custom entry is not trusted.
 ctx.window.CATALOG.push({id:'custom-bad',custom:true,category:'cyberware',name:{ru:'x',en:'x'},price:1,page:null,details:{ru:'',en:''},stats:{humanityLoss:'2d6',humanityLossAtCreation:99,installation:'Clinic'}},{id:'cyberware-not-audited',category:'cyberware',name:{ru:'y',en:'y'},price:1,page:1,details:{ru:'',en:''},stats:{humanityLoss:'2d6',humanityLossAtCreation:7,installation:'Clinic'}});
 for(const id of ['custom-bad','cyberware-not-audited']){const d={...c,extra:{...c.extra,items:[{id:'x',name:'?',quantity:1,catalogId:id}]}};assert.equal(E.prepare(d,'x','creation','included',true,'ru').reason,'unverified',id)}
});
