const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const dir=path.join(__dirname,'../site'),read=f=>fs.readFileSync(path.join(dir,f),'utf8');
const plain=x=>JSON.parse(JSON.stringify(x));
const eq=(a,b,m)=>assert.deepEqual(plain(a),b,m);
const same=(a,b,m)=>assert.deepEqual(plain(a),plain(b),m);
function seeded(seed){return ()=>{seed=(seed*1103515245+12345)%2147483648;return seed/2147483648}}
function load(options={}){
 const calls=[],window={},state=options.state||{gmExtras:{}};
 if(options.app!==false)window.App={getState:()=>state,save(){calls.push(['save'])},render(){calls.push(['render'])},notify:m=>calls.push(['notify',m]),notifyAction:(m,label,fn)=>calls.push(['action',m,label,fn])};
 const context={window,Math,Number,String,Array,Object,Set,Infinity,JSON,Date,Promise,setTimeout};
 for(const f of ['catalog.js','catalog-extra.js','defenses-extra.js','night-market.js'])vm.runInNewContext(read(f),context);
 return {NM:window.NightMarket,window,state,calls,CATALOG:window.CATALOG};
}
const until=async f=>{for(let i=0;i<400&&!f();i++)await new Promise(r=>setTimeout(r,5))};
let n=0;const ids=()=>'s'+(++n);
function stallOf(NM,category='weapons',count=3,cap='expensive'){
 const m={cap,stalls:[{category,count,items:NM.pickItems(category,count,cap,seeded(3)).map(i=>i.id)}]};
 return NM.stallFromMarket(m,0,'en',ids);
}
const plainMarket=(NM,state)=>NM.readStalls(state);

test('saved stalls: a stall of the generated market becomes a record with catalog prices',()=>{
 const {NM,CATALOG}=load();
 const s=stallOf(NM,'weapons',4);
 assert.equal(s.category,'weapons');assert.equal(s.cap,'expensive');assert.equal(s.lines.length,4);
 assert.match(s.name,/Weapons and Armor · Expensive/);
 for(const ln of s.lines){const i=CATALOG.find(x=>x.id===ln.item);assert.equal(ln.price,i.price);assert.equal(ln.name,i.name.en)}
 assert.match(NM.stallFromMarket({cap:'costly',stalls:[{category:'food',count:1,items:[CATALOG.find(i=>NM.categoryOf(i)==='food').id]}]},0,'ru',ids).name,/Еда и наркотики · недешёвое/);
 assert.equal(NM.stallFromMarket({cap:'costly',stalls:[{category:'food',items:[]}]},0,'ru',ids),null,'empty section: nothing to keep');
 assert.equal(NM.stallFromMarket({stalls:[]},3,'ru',ids),null);assert.equal(NM.stallFromMarket(null,0,'ru',ids),null);
 assert.equal(NM.stallFromMarket({cap:'costly',stalls:[{category:'junk',items:['x']}]},0,'ru',ids),null);
});

test('saved stalls: cap of 30 stalls and 40 lines, ids stay unique',()=>{
 const {NM}=load();let list=[];
 for(let i=0;i<30;i++){const r=NM.keepStall(list,stallOf(NM,'survival',2,'superluxury'));assert(r.ok,String(i));list=r.list}
 assert.equal(NM.keepStall(list,stallOf(NM,'food',2,'costly')).key,'full');
 assert.equal(NM.keepStall(list,list[0]).key,'full');
 assert.equal(NM.keepStall([],{id:'bad id',category:'food',lines:[]}).key,'bad');
 const one=NM.keepStall([],stallOf(NM,'survival',2,'superluxury'));assert.equal(NM.keepStall(one.list,one.list[0]).key,'bad','same id twice');
 // 40 lines at most: reading a bigger record cuts it, adding the 41st is refused.
 const big={id:'big',name:'x',category:'weapons',cap:'superluxury',lines:Array.from({length:60},(_,i)=>({name:'L'+i,price:1}))};
 assert.equal(NM.cleanStall(big).lines.length,40);
 const full=NM.keepStall([],big).list;
 assert.equal(NM.addLine(full,'big',NM.pool('weapons','superluxury')[0].id).key,'linesFull');
});

test('saved stalls: remove a line, reroll a line, add a catalog item, change a price',()=>{
 const {NM,CATALOG}=load();
 const base=NM.keepStall([],stallOf(NM,'weapons',3)).list,id=base[0].id,items=base[0].lines.map(l=>l.item);
 let r=NM.removeLine(base,id,1);assert(r.ok);eq(r.list[0].lines.map(l=>l.item),[items[0],items[2]]);assert.equal(base[0].lines.length,3,'the old list is not touched');
 assert.equal(NM.removeLine(base,id,9).key,'stale');assert.equal(NM.removeLine(base,id,-1).key,'stale');assert.equal(NM.removeLine(base,'nope',0).key,'stale');
 r=NM.rerollLine(base,id,0,seeded(11));assert(r.ok);
 const now=r.list[0].lines.map(l=>l.item);assert(!items.includes(now[0]),'a new item, not one already in the stall');assert.equal(new Set(now).size,3);
 const i=CATALOG.find(x=>x.id===now[0]);assert.equal(NM.categoryOf(i),'weapons');assert(i.price<=500,'respects the price cap');assert.equal(r.list[0].lines[0].price,i.price);
 // No other item under a tight cap: refused.
 const tiny={id:'t',name:'t',category:'weapons',cap:'cheap',lines:NM.pool('weapons','cheap').map(x=>({item:x.id,name:x.name.en,price:x.price}))};
 assert.equal(NM.rerollLine([NM.cleanStall(tiny)],'t',0,seeded(1)).key,'noMore');
 const free=NM.pool('weapons','superluxury').find(x=>!items.includes(x.id));
 r=NM.addLine(base,id,free.id);assert(r.ok);assert.equal(r.list[0].lines.at(-1).item,free.id);assert.equal(r.list[0].lines.at(-1).price,free.price);
 assert.equal(NM.addLine(r.list,id,free.id).key,'dup');
 assert.equal(NM.addLine(base,id,CATALOG.find(x=>NM.categoryOf(x)==='food').id).key,'unknown','another category is refused');
 assert.equal(NM.addLine(base,id,'nope').key,'unknown');
 r=NM.setLinePrice(base,id,0,'1500');assert(r.ok);assert.equal(r.list[0].lines[0].price,1500);
 assert(NM.setLinePrice(base,id,0,0).ok);
 for(const bad of ['','-3','1.5','abc',1e9,null,-1])assert.equal(NM.setLinePrice(base,id,0,bad).key,'badPrice',String(bad));
 assert.equal(NM.setLinePrice(base,id,7,5).key,'stale');
 r=NM.renameStall(base,id,'  Ripper   row ');assert.equal(r.list[0].name,'Ripper row');
 assert.equal(NM.renameStall(base,id,'x'.repeat(200)).list[0].name.length,60);
});

test('saved stalls: duplicate and delete',()=>{
 const {NM}=load();
 const base=NM.keepStall([],stallOf(NM,'clothing',3,'superluxury')).list,id=base[0].id;
 const d=NM.duplicateStall(base,id,'ru',ids);assert(d.ok);assert.equal(d.list.length,2);assert.notEqual(d.id,id);
 assert.match(d.list[1].name,/\(копия\)$/);same(d.list[1].lines,base[0].lines);assert.equal(NM.duplicateStall(base,id,'en',ids).list[1].name.endsWith('(copy)'),true);
 d.list[1].lines[0].price=1;assert.notEqual(base[0].lines[0].price,1,'lines are copied, not shared');
 let list=base;for(let i=1;i<30;i++)list=NM.duplicateStall(list,id,'ru',ids).list;
 assert.equal(list.length,30);assert.equal(NM.duplicateStall(list,id,'ru',ids).key,'full');
 assert.equal(NM.duplicateStall(base,'nope','ru',ids).key,'stale');
 const del=NM.deleteStall(d.list,id);assert(del.ok);assert.equal(del.list.length,1);assert.equal(del.name,base[0].name);assert.equal(NM.deleteStall(d.list,'nope').key,'stale');
});

test('saved stalls: read and write only touch their own key and rebuild every field',()=>{
 const {NM}=load();
 const state={gmExtras:{clocks:[{id:'c'}],rollTables:[{id:'t'}]}};
 const s=stallOf(NM,'food',2,'costly');
 assert(NM.writeStalls(state,[s]));eq(state.gmExtras.clocks,[{id:'c'}]);eq(state.gmExtras.rollTables,[{id:'t'}]);assert.equal(state.gmExtras.nightMarkets.length,1);
 assert(NM.writeStalls(state,[]));assert.equal('nightMarkets' in state.gmExtras,false,'an empty list leaves no key');
 assert.equal(NM.writeStalls(null,[]),false);assert.equal(NM.writeStalls({},'x'),false);
 const bare={};assert(NM.writeStalls(bare,[s]));assert.equal(bare.gmExtras.nightMarkets.length,1);
 eq(NM.readStalls({}),[]);eq(NM.readStalls({gmExtras:null}),[]);eq(NM.readStalls({gmExtras:{nightMarkets:'x'}}),[],'a save from before the feature');
 const dirty={gmExtras:{nightMarkets:[
  {id:'a',name:'<b>x</b>',category:'food',cap:'weird',lines:[{item:'gear-mre',name:'MRE',price:'12',evil:1},{price:5},{name:'N',price:-1},{name:'Own',price:7},'x',null],extra:'k'},
  {id:'a',name:'dup',category:'food'},{id:'bad id',category:'food'},{id:'b',category:'nope'},{id:'c',category:'cyberware'},null,5
 ]}};
 const out=NM.readStalls(dirty);
 eq(out.map(x=>x.id),['a','c']);
 eq(out[0],{id:'a',name:'<b>x</b>',category:'food',cap:'superluxury',lines:[{item:'gear-mre',name:'MRE',price:12},{name:'Own',price:7}]});
 eq(out[1].lines,[]);
 const many={gmExtras:{nightMarkets:Array.from({length:80},(_,i)=>({id:'m'+i,category:'food'}))}};assert.equal(NM.readStalls(many).length,30);
 const before=JSON.stringify(dirty);NM.readStalls(dirty);assert.equal(JSON.stringify(dirty),before,'reading never writes');
});

test('saved stalls: file round trip, hostile files and the import plan',()=>{
 const {NM}=load();
 const a=NM.keepStall([],stallOf(NM,'weapons',3)).list,b=NM.keepStall(a,stallOf(NM,'food',2,'costly')).list;
 const file=NM.buildFile(b,'  Friday   market ',new Date('2026-01-02T03:04:05Z'));
 assert.equal(file.format,'nightcity-red-night-market');assert.equal(file.version,1);assert.equal(file.title,'Friday market');assert.equal(file.exportedAt,'2026-01-02T03:04:05.000Z');assert.equal(file.stalls.length,2);
 const text=JSON.stringify(file),p=NM.parseFile(text);assert(p.ok);same(p.stalls,b);assert.equal(p.title,'Friday market');
 assert.equal(NM.parseFile('{').reason,'json');assert.equal(NM.parseFile('[]').reason,'format');assert.equal(NM.parseFile(JSON.stringify({format:'other',stalls:[]})).reason,'format');
 assert.equal(NM.parseFile(JSON.stringify({format:file.format,version:9,stalls:[]})).reason,'newer');
 assert.equal(NM.parseFile(JSON.stringify({format:file.format,version:1,stalls:[]})).reason,'empty');
 assert.equal(NM.parseFile('x'.repeat(400001)).reason,'size');assert.equal(NM.parseFile(5).reason,'size');
 const mixed=NM.parseFile(JSON.stringify({format:file.format,version:1,stalls:[b[0],b[0],{id:'q',category:'zzz'},7]}));
 assert(mixed.ok);assert.equal(mixed.stalls.length,1);eq(mixed.rejected.map(r=>r.reason),['twice','broken','broken']);
 const evil=NM.parseFile(JSON.stringify({format:file.format,version:1,stalls:[{id:'e',name:'<img onerror=x>',category:'food',lines:[{name:'<script>',price:'3'}],__proto__:{x:1}}]}));
 assert(evil.ok);eq(evil.stalls[0].lines,[{name:'<script>',price:3}]);
 // Plan: new, same, update, and the cap.
 const edited=plain(b[0]);edited.name='Changed';
 const plan=NM.planImport(a,{stalls:[b[0],b[1],NM.cleanStall(edited)].slice(0,2)});
 assert.equal(plan.same,1);assert.equal(plan.added,1);assert.equal(plan.list.length,2);
 const plan2=NM.planImport(b,{stalls:[NM.cleanStall(edited)]});assert.equal(plan2.updated,1);assert.equal(plan2.list[0].name,'Changed');assert.equal(plan2.list.length,2);
 let full=[];for(let i=0;i<30;i++)full=NM.keepStall(full,stallOf(NM,'survival',1,'superluxury')).list;
 const plan3=NM.planImport(full,{stalls:[b[0]]});assert.equal(plan3.overflow,1);assert.equal(plan3.list.length,30);assert.equal(plan3.rows[0].status,'overflow');
});

test('saved stalls: the card shows save buttons only with a store, and draws saved stalls escaped in both languages',()=>{
 const noApp=load({app:false});
 assert(!noApp.NM.render('en').includes('data-nm-s="save"'));assert(!noApp.NM.render('en').includes('data-nm-saved'));
 const {NM,state}=load();
 NM.reset();const seeded5=seeded(5);
 const root={dataset:{lang:'en'},querySelector:s=>({'[data-nm-field="categories"]':{value:'2'},'[data-nm-field="items"]':{value:'3'},'[data-nm-field="cap"]':{value:'luxury'}})[s]||null,isConnected:true,outerHTML:''};
 const gen={dataset:{nmAction:'generate'},closest:s=>s==='[data-nm-root]'?root:gen};
 assert(NM.handle({type:'click',target:gen},'en',seeded5));
 assert(root.outerHTML.includes('data-nm-s="save"'));assert(root.outerHTML.includes('No stalls')===false);
 assert(root.outerHTML.includes('Saved stalls · 0 of 30'));
 const save={dataset:{nmS:'save',nmStall:'0'},closest:s=>s==='[data-nm-root]'?root:s==='[data-nm-s]'?save:null};
 assert(NM.handle({type:'click',target:save},'en'));
 assert.equal(NM.readStalls(state).length,1);assert(root.outerHTML.includes('Saved stalls · 1 of 30'));assert(root.outerHTML.includes('data-nm-sfield="price"'));
 NM.writeStalls(state,[{id:'x1',name:'<img src=x onerror=alert(1)>',category:'cyberware',cap:'costly',lines:[{name:'<b>gone</b>',price:9}]}]);
 for(const lang of ['en','ru']){const html=NM.render(lang);assert(!html.includes('<img src=x'));assert(!html.includes('<b>gone'));assert(html.includes('&lt;b&gt;gone'));assert(!/<script/i.test(html))}
 assert(NM.render('ru').includes('Сохранённые прилавки'));assert(NM.render('ru').includes('Сохранить прилавок'));
 eq(Object.keys(NM.S.ru).sort(),Object.keys(NM.S.en).sort());
 // The summary and the controls carry names a screen reader can use.
 const html=NM.render('en');assert(/aria-label="Remove line: [^"]*"/.test(html)||html.includes('Remove line'));assert(html.includes('class="nm-hidden"'));
});

test('saved stalls: handle() edits, duplicates, deletes with undo and imports through events',async()=>{
 const {NM,state,calls}=load();
 NM.writeStalls(state,NM.keepStall([],stallOf(NM,'weapons',3)).list);
 const id=NM.readStalls(state)[0].id,root={dataset:{lang:'ru'},isConnected:true,outerHTML:'',querySelector:s=>s==='[data-nm-file]'?{click(){calls.push(['filedialog'])}}:null};
 const click=(action,ds={})=>{const b={dataset:{nmS:action,nmId:id,...ds},closest:s=>s==='[data-nm-root]'?root:s==='[data-nm-s]'?b:s==='[data-nm-open]'?{querySelector:()=>({value:pick})}:null};return NM.handle({type:'click',target:b},'ru',seeded(2))};
 const change=(f,value,ds={})=>{const t={value,dataset:{nmSfield:f,nmId:id,...ds},closest:s=>s==='[data-nm-root]'?root:null,};return NM.handle({type:'change',target:t},'ru')};
 let pick='';
 assert(click('line-remove',{nmLine:'0'}));assert.equal(NM.readStalls(state)[0].lines.length,2);
 assert(click('line-reroll',{nmLine:'0'}));assert.equal(NM.readStalls(state)[0].lines.length,2);
 pick=NM.pool('weapons','superluxury').find(x=>!NM.readStalls(state)[0].lines.some(l=>l.item===x.id)).id;
 assert(click('line-add'));assert.equal(NM.readStalls(state)[0].lines.length,3);assert.equal(NM.readStalls(state)[0].lines[2].item,pick);
 assert(change('price','777',{nmLine:'2'}));assert.equal(NM.readStalls(state)[0].lines[2].price,777);
 calls.length=0;assert(change('price','x',{nmLine:'2'}));assert.equal(NM.readStalls(state)[0].lines[2].price,777);assert(calls.some(c=>c[0]==='notify'&&/целым числом/.test(c[1])));
 assert(change('name','  Ripper  row '));assert.equal(NM.readStalls(state)[0].name,'Ripper row');
 assert(click('dup'));assert.equal(NM.readStalls(state).length,2);
 const before=JSON.stringify(NM.readStalls(state));
 calls.length=0;assert(click('del'));assert.equal(NM.readStalls(state).length,1);
 const act=calls.find(c=>c[0]==='action');assert(act);assert.match(act[1],/удалён/);assert.equal(act[2],'Вернуть');
 act[3]();assert.equal(JSON.stringify(NM.readStalls(state)),before,'undo brings the list back exactly');
 calls.length=0;assert(click('del'));const act2=calls.find(c=>c[0]==='action');
 NM.writeStalls(state,[]);act2[3]();assert.equal(NM.readStalls(state).length,0,'stale undo does not overwrite newer data');assert(calls.some(c=>c[0]==='notify'&&/изменились/.test(c[1])));
 // A stale button for a stall that is gone only reports.
 NM.writeStalls(state,[]);calls.length=0;assert(click('line-remove',{nmLine:'0'}));assert(calls.some(c=>c[0]==='notify'));
 // Import goes through a preview and can be undone.
 const src=NM.keepStall([],stallOf(NM,'food',2,'costly')).list;
 NM.writeStalls(state,[]);
 const input={dataset:{nmFile:''},files:[{size:100,text:()=>Promise.resolve(JSON.stringify(NM.buildFile(src,'t')))}],closest:s=>s==='[data-nm-root]'?root:null};
 assert(NM.handle({type:'change',target:input},'ru'));await until(()=>NM.ui.preview||NM.ui.fileError);
 assert(NM.ui.preview);assert.equal(NM.ui.preview.stalls.length,1);assert.equal(NM.readStalls(state).length,0,'nothing is kept before the user agrees');
 calls.length=0;assert(click('apply',{nmId:undefined}));assert.equal(NM.readStalls(state).length,1);
 const imp=calls.find(c=>c[0]==='action');assert(imp&&/новых — 1/.test(imp[1]));imp[3]();assert.equal(NM.readStalls(state).length,0);
 const bad={dataset:{nmFile:''},files:[{size:5,text:()=>Promise.resolve('nope')}],closest:input.closest};
 NM.handle({type:'change',target:bad},'ru');await until(()=>NM.ui.fileError);assert.equal(NM.ui.fileError,'json');assert.equal(NM.ui.preview,null);
 assert(click('import'));assert(calls.some(c=>c[0]==='filedialog'));
 assert(click('discard'));
});

test('saved stalls: the generator keeps working and old behaviour is unchanged',()=>{
 const src=read('night-market.js');
 assert.match(src,/MARKET_KEY='nc-night-market-v1'/);assert.match(src,/storeMarket\(\);\n const l=lang\|\|root\.dataset\.lang/);
 assert(!src.includes('\r'));
 const {NM}=load();
 assert.equal(NM.handle({type:'click',target:{closest:()=>null}},'en'),false);
 const lone={dataset:{nmAction:'generate'},closest:s=>s==='[data-nm-root]'?null:null};assert.equal(NM.handle({type:'click',target:lone},'en'),false);
 assert.equal(NM.MAX_STALLS,30);assert.equal(NM.MAX_LINES,40);
});

test('saved stalls: the default name uses a tier label in the language of the sheet, and the file input and layout are safe',()=>{
 const {NM}=load();
 const ru=stallOf(NM,'food',2,'superluxury');assert(ru);
 const m={cap:'superluxury',stalls:[{category:'food',count:2,items:NM.pickItems('food',2,'superluxury',seeded(3)).map(i=>i.id)}]};
 const nameRu=NM.stallFromMarket(m,0,'ru',ids).name,nameEn=NM.stallFromMarket(m,0,'en',ids).name;
 assert(!/Super|Luxury/.test(nameRu),'no English tier text in Russian: '+nameRu);assert(/Super Luxury/.test(nameEn));
 assert.equal(NM.tierLabel(NM.PRICE_TIERS[0],'ru'),'дешёвое');
 const js=read('night-market.js');assert(/data-nm-file[^>]*aria-label=/.test(js),'the file input has a name');
 assert(/\.night-market\{position:relative\}/.test(read('night-market-saved.css')),'the hidden input is anchored inside the card');
});
