// City map: search, districts, rooms inside a pin, NPCs at a place, faction. All of it is the Game Master's own data:
// rebuilt by clean(), never sent to players.
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const read=f=>fs.readFileSync(path.join(__dirname,'..','site',f),'utf8');
const plain=x=>JSON.parse(JSON.stringify(x));
const eq=(a,b)=>assert.deepEqual(plain(a),plain(b));

function load({factions=false}={}){
 const notices=[],actions=[];let saves=0;
 const st={lang:'ru',characters:[],campaigns:[],gmExtras:{npcLibrary:[
  {id:'n1',name:'Ганк',ref:7,hp:25,head:4,torso:4,weapons:'',notes:''},{id:'n2',name:'Фиксер',ref:5,hp:20,head:0,torso:0,weapons:'',notes:''}]}};
 const window={confirm:()=>true};
 const ctx={window,TextEncoder,Date,Math,JSON,Number,String,Array,Object,Map,Set,Promise,Error,Uint8Array,RegExp,setTimeout,clearTimeout,console,crypto:globalThis.crypto};
 for(const f of ['city-map.js','npc-library.js'])vm.runInNewContext(read(f),ctx,{filename:f});
 window.App={getState:()=>st,lang:()=>st.lang,save:()=>{saves++},render:()=>{},notify:m=>notices.push(m),notifyAction:(m,label,run)=>actions.push({m,label,run})};
 window.CityMap._test.setStore({get:async()=>undefined,put:async()=>{},del:async()=>{},keys:async()=>[]});
 if(factions)window.Factions={read:()=>[{id:'f1',name:'Ржавые голуби'},{id:'f2',name:'Арасака'}]};
 return {window,C:window.CityMap,st,notices,actions,saves:()=>saves};
}
const W=load(),C=W.C;
const pin=(id,t,x,y,name,more={})=>({id,t,x,y,name,...more});
let seq=0;
const camp=(cityMap,extra={})=>({id:'k'+(++seq),name:'Job',notes:'',round:1,turnIndex:0,roster:[],...(cityMap?{cityMap}:{}),...extra});
function scene(campaign,page=W){
 const body={innerHTML:''},fields={},root={querySelector:s=>s==='[data-cm-body]'?body:fields[s]||null,contains:()=>false};
 const ctx={lang:'ru',characters:[],notify:m=>page.notices.push(m)};
 const el=(data,sel,more={})=>({dataset:data,closest:s=>s==='[data-cm-root]'?root:s===sel?{dataset:data,...more}:null,...more});
 const fire=(type,target,extra={})=>page.C.handle({type,target,...extra},campaign,ctx);
 return {body,fields,
  act:(a,value)=>fire('click',el({cmAct:a,...(value!==undefined?{cmValue:value}:{})},'[data-cm-act]')),
  row:id=>fire('click',el({cmRow:id},'[data-cm-row]')),
  input:(data,value)=>fire('input',{...el(data,null),value}),
  change:(data,value)=>fire('change',{...el(data,null),value}),
  view:()=>page.C._view(campaign)};
}
const base=()=>({v:1,ratio:1.5,pins:[pin('a','bar',1,1,'Бар «Тихий час»',{note:'Хозяин знает Ганка'}),pin('b','clinic',2,2,'Клиника'),pin('c','bar',3,3,'Ночной рынок')]});

test('clean keeps districts (cap 20, name 30) and drops a district that is not there', () => {
 const raw={v:1,pins:[pin('a','bar',1,1,'A',{d:'d1'}),pin('b','bar',1,1,'B',{d:'ghost'}),pin('c','bar',1,1,'C',{d:7})],
  districts:[{id:'d1',name:' Нижний \u0000 город '+'я'.repeat(60)},{id:'d1',name:'дубль'},{id:'bad id',name:'x'},{id:'d2',name:'  '},null,'x',{id:'d3',name:'Порт'}]};
 const m=C.clean(raw);
 eq(m.districts.map(d=>d.id),['d1','d3']);assert.ok(m.districts[0].name.length<=C.MAX_DNAME);assert.equal(m.districts[0].name.includes('\u0000'),false);
 eq(m.pins.map(p=>p.d),['d1',undefined,undefined]);
 const many=C.clean({v:1,pins:[],districts:Array.from({length:40},(_,i)=>({id:'x'+i,name:'R'+i}))});
 assert.equal(many.districts.length,20);assert.equal(C.MAX_DISTRICTS,20);
 assert.equal('districts' in C.clean({v:1,pins:[],districts:[]}),false,'an empty list is not stored');
 eq(C.clean({v:1}),{v:1,ratio:1.5,pins:[]});
});

test('clean keeps rooms at depth 1: self, unknown, chains and cycles are cut', () => {
 const m=C.clean({v:1,pins:[pin('a','bar',1,1,'A'),pin('r1','other',1,1,'R1',{par:'a'}),pin('r2','other',1,1,'R2',{par:'a'}),
  pin('s','other',1,1,'S',{par:'s'}),pin('g','other',1,1,'G',{par:'ghost'}),pin('x','other',1,1,'X',{par:7})]});
 eq(Object.fromEntries(m.pins.map(p=>[p.id,p.par])),{a:undefined,r1:'a',r2:'a',s:undefined,g:undefined,x:undefined});
 // A pin that holds rooms cannot itself be a room: chain a <- b <- c leaves c a room of b, b on its own.
 const ch=C.clean({v:1,pins:[pin('a','bar',1,1,'A'),pin('b','bar',1,1,'B',{par:'a'}),pin('c','bar',1,1,'C',{par:'b'})]});
 eq(Object.fromEntries(ch.pins.map(p=>[p.id,p.par])),{a:undefined,b:undefined,c:'b'});
 const cyc=C.clean({v:1,pins:[pin('a','bar',1,1,'A',{par:'b'}),pin('b','bar',1,1,'B',{par:'a'})]});
 assert.ok(cyc.pins.every(p=>p.par===undefined));
});

test('clean keeps up to 8 library ids and a faction id, as plain checked strings', () => {
 const m=C.clean({v:1,pins:[pin('a','bar',1,1,'A',{npc:['n1','n1','bad id',5,null,...Array.from({length:20},(_,i)=>'m'+i)],f:'fac-1'}),
  pin('b','bar',1,1,'B',{npc:'n1',f:'bad id'}),pin('c','bar',1,1,'C',{npc:[],f:5})]});
 assert.equal(m.pins[0].npc.length,C.MAX_NPC);assert.equal(C.MAX_NPC,8);eq(m.pins[0].npc.slice(0,2),['n1','m0']);assert.equal(m.pins[0].f,'fac-1');
 assert.equal('npc' in m.pins[1],false);assert.equal('f' in m.pins[1],false);assert.equal('npc' in m.pins[2],false);assert.equal('f' in m.pins[2],false);
 // a saved map from before these fields loads unchanged
 const old=base();eq(C.clean(old),{...old});
 // idempotent
 eq(C.clean(C.clean({v:1,pins:[pin('a','bar',1,1,'A',{npc:['n1'],f:'q'})],districts:[{id:'d',name:'Д'}]})),{v:1,ratio:1.5,pins:[{id:'a',t:'bar',x:1,y:1,name:'A',f:'q',npc:['n1']}],districts:[{id:'d',name:'Д'}]});
});

test('search finds pins by name and note, every word, any case', () => {
 const m=base();
 const ids=(types,o)=>C.filterPins(m,types,o).map(p=>p.id);
 eq(ids(null),['a','b','c']);eq(ids(new Set()),['a','b','c']);
 eq(ids(null,{q:'тихий'}),['a']);eq(ids(null,{q:'  ТИХИЙ   час '}),['a']);
 eq(ids(null,{q:'ганка'}),['a'],'note is searched');eq(ids(null,{q:'час ганка'}),['a']);eq(ids(null,{q:'час клиника'}),[]);
 eq(ids(null,{q:'<b>'}),[]);eq(ids(null,{q:''}),['a','b','c']);eq(ids(null,{q:'   '}),['a','b','c']);
 eq(ids(new Set(['bar']),{q:'рынок'}),['c']);eq(ids(new Set(['clinic']),{q:'рынок'}),[]);
 eq(ids(null,{q:'я'.repeat(500)}),[]);
});

test('counts: every chip shows what a tap would leave, under the other filters', () => {
 const m={...base(),districts:[{id:'d1',name:'Порт'},{id:'d2',name:'Центр'}]};
 m.pins[0].d='d1';m.pins[1].d='d1';
 let k=C.counts(m,{});
 eq(k.types.bar,2);eq(k.types.clinic,1);eq(k.types.gang,0);eq(k.all,3);eq(k.districts,{'':3,'-':1,d1:2,d2:0});
 k=C.counts(m,{district:'d1'});eq(k.types.bar,1);eq(k.types.clinic,1);eq(k.all,2);
 k=C.counts(m,{q:'клиника'});eq(k.types.bar,0);eq(k.districts.d1,1);eq(k.districts['-'],0);
 k=C.counts(m,{types:new Set(['bar'])});eq(k.districts.d1,1);eq(k.districts['-'],1);eq(k.all,2);
 eq(C.filterPins(m,null,{district:'-'}).map(p=>p.id),['c']);eq(C.filterPins(m,null,{district:'d2'}),[]);
});

test('districts: add, rename, remove and bring back; names are unique and the list is capped', () => {
 const m=base();
 const a=C.addDistrict(m,'  Порт  ');assert.equal(a.ok,true);eq(m.districts.map(d=>d.name),['Порт']);
 assert.equal(C.addDistrict(m,'порт').reason,'dup');assert.equal(C.addDistrict(m,'  ').reason,'name');
 assert.equal(C.addDistrict(m,'Я'.repeat(80)).district.name.length,C.MAX_DNAME);
 assert.equal(C.setDistrict(m,'a',a.district.id),true);assert.equal(m.pins[0].d,a.district.id);
 assert.equal(C.setDistrict(m,'b','ghost'),false);assert.equal(C.setDistrict(m,'ghost',a.district.id),false);
 assert.equal(C.renameDistrict(m,a.district.id,'Старый порт').ok,true);assert.equal(C.renameDistrict(m,a.district.id,'я'.repeat(30)).reason,'dup');
 eq(C.renameDistrict(m,'ghost','x').reason,'missing');
 const snap=C.removeDistrict(m,a.district.id);assert.equal(m.pins[0].d,undefined);assert.equal(m.districts.length,1);
 assert.equal(C.restoreDistrict(m,snap),true);assert.equal(m.pins[0].d,a.district.id);assert.equal(C.restoreDistrict(m,snap),false);
 assert.equal(C.setDistrict(m,'a',''),true);assert.equal('d' in m.pins[0],false);
 for(let i=0;i<30;i++)C.addDistrict(m,'R'+i);
 assert.equal(m.districts.length,C.MAX_DISTRICTS);assert.equal(C.addDistrict(m,'ещё').reason,'full');
 const only=base();const o=C.addDistrict(only,'Один');C.removeDistrict(only,o.district.id);assert.equal('districts' in only,false);
});

test('rooms: depth 1, the holder cannot become a room, deleting the holder frees the rooms and undo returns them', () => {
 const m=base();
 assert.equal(C.setParent(m,'b','a').ok,true);eq(C.kidsOf(m,'a').map(p=>p.id),['b']);
 assert.equal(C.setParent(m,'a','c').reason,'depth','a pin with rooms cannot become a room');
 assert.equal(C.setParent(m,'c','b').reason,'depth','a room cannot hold rooms');
 assert.equal(C.setParent(m,'a','a').ok,false);assert.equal(C.setParent(m,'c','ghost').ok,false);
 assert.equal(C.setParent(m,'c','a').ok,true);
 const snap=C.removePin(m,'a');
 assert.ok(m.pins.every(p=>!('par' in p)));eq(snap.kids,['b','c']);
 assert.equal(C.restorePin(m,snap),true);eq(Object.fromEntries(m.pins.map(p=>[p.id,p.par||''])),{a:'',b:'a',c:'a'});
 // the room was moved in the meantime: undo does not take it back
 const s2=C.removePin(m,'a');C.setParent(m,'b','c');
 C.restorePin(m,s2);assert.equal(m.pins.find(p=>p.id==='b').par,'c');
 assert.equal(C.setParent(m,'b','').ok,true);assert.equal('par' in m.pins.find(p=>p.id==='b'),false);
});

test('NPCs at a pin: up to 8, no repeats, ids that left the library are reported as gone', () => {
 const m=base();
 assert.equal(C.addNpc(m,'a','n1').ok,true);assert.equal(C.addNpc(m,'a','n1').reason,'dup');assert.equal(C.addNpc(m,'a','bad id').reason,'bad');assert.equal(C.addNpc(m,'ghost','n1').reason,'missing');
 for(let i=0;i<10;i++)C.addNpc(m,'a','m'+i);
 assert.equal(m.pins[0].npc.length,C.MAX_NPC);assert.equal(C.addNpc(m,'a','zz').reason,'full');
 assert.equal(C.removeNpc(m,'a','m0'),true);assert.equal(C.removeNpc(m,'a','m0'),false);
 const lib=[{id:'n1',name:'Ганк'},{id:'m1',name:'М1'}];
 const r=C.npcOf(m.pins[0],lib);eq(r.found.map(e=>e.id),['n1','m1']);assert.equal(r.gone.length,m.pins[0].npc.length-2);
 // after a library delete the id stays in the pin (not guessed away) and is simply reported
 eq(C.npcOf(m.pins[0],[]).found,[]);eq(C.npcOf(null,lib),{found:[],gone:[]});eq(C.npcOf({npc:['n1']},null),{found:[],gone:['n1']});
 assert.equal(C.clean(m).pins[0].npc.includes('n1'),true);
 const one=base();C.addNpc(one,'a','n1');C.removeNpc(one,'a','n1');assert.equal('npc' in one.pins[0],false);
 assert.equal(C.setFaction(one,'a','fac-1'),true);assert.equal(one.pins[0].f,'fac-1');assert.equal(C.setFaction(one,'a','bad id'),false);assert.equal(C.setFaction(one,'a',''),true);assert.equal('f' in one.pins[0],false);
});

test('page: search box filters the stage and the list, announces the result and keeps the typed text', () => {
 const c=camp(base()),s=scene(c);
 s.input({cmSearch:''},'тихий');
 assert.equal(s.view().q,'тихий');
 assert.ok(s.body.innerHTML.includes('data-cm-search'));assert.ok(s.body.innerHTML.includes('value="тихий"'));
 assert.equal((s.body.innerHTML.match(/data-cm-pin="/g)||[]).length,1);
 assert.equal((s.body.innerHTML.match(/data-cm-row="/g)||[]).length,1);
 s.input({cmSearch:''},'  <img src=x> ');assert.equal(s.body.innerHTML.includes('<img src=x>'),false,'search text is escaped');
 assert.equal((s.body.innerHTML.match(/data-cm-pin="/g)||[]).length,0);
 s.input({cmSearch:''},'');assert.equal((s.body.innerHTML.match(/data-cm-pin="/g)||[]).length,3);
 assert.equal(W.window.CityMap._view(c).say,'Найдено меток: 3 из 3.');
});

test('page: type chips carry counts; districts add, assign, filter and remove with undo', () => {
 const c=camp(base()),s=scene(c);
 s.act('mode');s.fields['[data-cm-dname]']={value:'  Порт '};
 let r=s.act('district-add');assert.equal(r.dirty,true);eq(c.cityMap.districts.map(d=>d.name),['Порт']);
 const did=c.cityMap.districts[0].id;
 s.fields['[data-cm-dname]']={value:'порт'};r=s.act('district-add');assert.equal(r.dirty,false);assert.ok(W.notices.includes('Район с таким названием уже есть.'));
 s.fields['[data-cm-dname]']={value:''};s.act('district-add');assert.ok(W.notices.includes('Введите название района.'));
 s.row('a');r=s.change({cmField:'d'},did);assert.equal(r.dirty,true);assert.equal(c.cityMap.pins[0].d,did);
 assert.ok(/class="cm-filter"[^>]*data-cm-act="filter" data-cm-value="bar"[^>]*>[\s\S]*?<span class="cm-count">2<\/span>/.test(s.body.innerHTML),'bar chip shows 2');
 s.act('district',did);assert.equal(s.view().district,did);
 assert.equal((s.body.innerHTML.match(/data-cm-pin="/g)||[]).length,1);
 s.act('district','-');assert.equal((s.body.innerHTML.match(/data-cm-pin="/g)||[]).length,2);
 s.act('district',did);
 // rename through the field
 r=s.change({cmDfield:did},'Старый порт');assert.equal(c.cityMap.districts[0].name,'Старый порт');
 r=s.change({cmDfield:did},'   ');assert.equal(r.dirty,false);assert.equal(c.cityMap.districts[0].name,'Старый порт');
 // remove: the filter falls back, pins keep existing, undo brings the district and the assignment back
 r=s.act('district-remove',did);assert.equal(r.dirty,true);assert.equal('districts' in c.cityMap,false);assert.equal('d' in c.cityMap.pins[0],false);assert.equal(s.view().district,'');
 const undo=W.actions.pop();assert.equal(undo.label,'Вернуть');
 W.st.campaigns=[c];undo.run();assert.equal(c.cityMap.districts[0].id,did);assert.equal(c.cityMap.pins[0].d,did);
});

test('page: a room is added to a pin; a pin put on the map under a district joins it', () => {
 const c=camp({...base(),districts:[{id:'d1',name:'Порт'}]}),s=scene(c);
 s.row('a');s.change({cmField:'d'},'d1');
 let r=s.act('room-add');assert.equal(r.dirty,true);
 const room=c.cityMap.pins.find(p=>p.par==='a');assert.ok(room);assert.equal(room.d,'d1');assert.equal(room.x,1);assert.equal(s.view().sel,room.id);
 assert.equal(s.act('room-add').dirty,false,'a room cannot hold rooms');
 s.row('a');
 r=s.change({cmField:'par'},'c');assert.equal(r.dirty,false,'a pin with rooms cannot be made a room');assert.ok(W.notices.includes('Сюда метку поместить нельзя: помещение внутри помещения не бывает.'));assert.equal('par' in c.cityMap.pins[0],false);
 assert.ok(s.body.innerHTML.includes('disabled'));
 s.act('district','d1');s.act('add-centre');
 const added=c.cityMap.pins[c.cityMap.pins.length-1];assert.equal(added.d,'d1');
});

test('page: NPCs at a pin are picked from the library, and «в бой» puts a numbered copy into the roster', () => {
 const c=camp(base()),s=scene(c);W.st.campaigns=[c];
 s.row('a');
 s.fields['[data-cm-npcpick]']={value:''};assert.equal(s.act('npc-add').dirty,false);
 s.fields['[data-cm-npcpick]']={value:'n1'};let r=s.act('npc-add');assert.equal(r.dirty,true);eq(c.cityMap.pins[0].npc,['n1']);
 assert.ok(s.body.innerHTML.includes('Ганк'));assert.ok(s.body.innerHTML.includes('data-cm-act="npc-fight"'));
 r=s.act('npc-fight','n1');assert.equal(r.dirty,true);assert.equal(c.roster.length,1);assert.equal(c.roster[0].name,'Ганк 1');assert.equal(c.roster[0].kind,'npc');
 s.act('npc-fight','n1');eq(c.roster.map(x=>x.name),['Ганк 1','Ганк 2']);
 assert.equal(s.act('npc-fight','n2').dirty,false,'only an NPC of this pin can be sent to combat');
 // the NPC is deleted from the library: the id stays, is shown as gone, cannot be fought, can be removed
 W.st.gmExtras.npcLibrary=W.st.gmExtras.npcLibrary.filter(e=>e.id!=='n1');
 s.row('a');assert.ok(s.body.innerHTML.includes('Удалён из библиотеки'));assert.equal(s.body.innerHTML.includes('data-cm-act="npc-fight"'),false);
 assert.equal(s.act('npc-fight','n1').dirty,false);assert.ok(W.notices.includes('Этого NPC уже нет в библиотеке.'));assert.equal(c.roster.length,2);
 r=s.act('npc-del','n1');assert.equal(r.dirty,true);assert.equal('npc' in c.cityMap.pins[0],false);
 W.st.gmExtras.npcLibrary=[];s.row('a');assert.ok(s.body.innerHTML.includes('В библиотеке NPC пока никого нет'));
 W.st.gmExtras.npcLibrary=[{id:'n1',name:'Ганк',ref:7,hp:25,head:0,torso:0,weapons:'',notes:''}];
});

test('page: the faction list shows only where Factions exists; a deleted faction is marked', () => {
 const c=camp({...base()}),s=scene(c);s.row('a');
 assert.equal(s.body.innerHTML.includes('data-cm-field="f"'),false);
 const w=load({factions:true}),c2=camp(base({}),{}),s2=scene(c2,w);w.st.campaigns=[c2];
 s2.row('a');assert.ok(s2.body.innerHTML.includes('data-cm-field="f"'));assert.ok(s2.body.innerHTML.includes('Ржавые голуби'));
 let r=s2.change({cmField:'f'},'f2');assert.equal(r.dirty,true);assert.equal(c2.cityMap.pins[0].f,'f2');
 c2.cityMap.pins[0].f='f-gone';s2.row('a');assert.ok(s2.body.innerHTML.includes('Фракция удалена'));
 r=s2.change({cmField:'f'},'');assert.equal('f' in c2.cityMap.pins[0],false);
});

test('players never get the new GM-only fields: the room payload is the same four things', () => {
 const m={v:1,ratio:1.5,districts:[{id:'dz',name:'Секретный район'}],pins:[
  pin('a','bar',10,20,'Бар',{shown:true,d:'dz',npc:['npc-secret'],f:'fac-secret',note:'тайна'}),pin('r','other',10,20,'Комната 7',{shown:true,par:'a',d:'dz'}),pin('h','gang',5,5,'Скрытая',{d:'dz'})],crew:'a',crewShown:true};
 const c=camp(m),p=C.payload(c);
 eq(Object.keys(p.data).sort(),['campaign','crew','pins','ratio']);
 eq(p.data.pins,[['bar',10,20,'Бар'],['other',10,20,'Комната 7']]);
 const wire=JSON.stringify(p.data);
 for(const secret of ['dz','Секретный','npc-secret','fac-secret','тайна','"par"','districts','Скрытая'])assert.equal(wire.includes(secret),false,secret);
 // whatever a hostile sender adds is dropped on receipt
 const got=C.cleanShared({campaign:'K',ratio:1.5,pins:[['bar',1,2,'Бар',{d:'dz',npc:['x']},'dz'],['bar',3,4,'Б','dz']],crew:null,districts:[{id:'dz',name:'Z'}],npc:['x']});
 eq(got,{campaign:'K',ratio:1.5,pins:[['bar',1,2,'Бар'],['bar',3,4,'Б']],crew:null});
});

test('review fixes: a new room and a district change never hide the selected pin', () => {
 const c=camp({...base(),districts:[{id:'d1',name:'Порт'}]}),s=scene(c);
 s.act('filter','bar');s.input({cmSearch:''},'тихий');
 s.row('a');s.act('room-add');
 const room=c.cityMap.pins.find(p=>p.par==='a');
 assert.equal(s.view().q,'');assert.ok(s.body.innerHTML.includes('data-cm-pin="'+room.id+'"'),'the room is on the map');
 assert.ok(s.body.innerHTML.includes('data-cm-row="'+room.id+'"'),'the room is in the list');
 const c2=camp({...base(),districts:[{id:'d1',name:'Порт'},{id:'d2',name:'Рынок'}]}),s2=scene(c2);
 s2.act('district','d1');s2.row('a');s2.change({cmField:'d'},'d2');
 assert.ok(s2.body.innerHTML.includes('data-cm-row="a"'),'a pin moved out of the district filter stays visible');
});

test('review fixes: hostile district ids and duplicate names; a new pin clears the search', () => {
 const m=C.clean({v:1,ratio:1.5,pins:[],districts:[{id:'__proto__',name:'x'},{id:'d1',name:'Порт'},{id:'d2',name:'  порт '}]});
 eq(m.districts,[{id:'d1',name:'Порт'}]);
 const cnt=C.counts({...base(),districts:[{id:'d1',name:'Порт'}]},{});assert.equal(typeof cnt.districts.d1,'number');assert.equal(cnt.districts['__proto__'],undefined);
 const c=camp(base()),s=scene(c);s.input({cmSearch:''},'тихий');
 s.act('add-centre');assert.equal(s.view().q,'');
 assert.equal((s.body.innerHTML.match(/data-cm-pin="/g)||[]).length,4);
});

test('review fixes: focus stays on the NPC list after the last library NPC is added; faction badge in the list', () => {
 const c=camp(base()),s=scene(c);W.st.campaigns=[c];
 s.row('a');
 s.fields['[data-cm-npcpick]']={value:'n1'};s.act('npc-add');s.fields['[data-cm-npcpick]']={value:'n2'};
 const orig=W.window.CityMap;assert.ok(orig);
 s.act('npc-add');
 assert.ok(s.body.innerHTML.includes('data-cm-act="npc-fight"'));assert.equal(s.body.innerHTML.includes('data-cm-npcpick'),false);
 const w=load({factions:true}),c2=camp(base()),s2=scene(c2,w);w.st.campaigns=[c2];
 s2.row('a');s2.change({cmField:'f'},'f2');
 assert.ok(s2.body.innerHTML.includes('Арасака'));
 assert.ok(/aria-label="Название района: /.test((()=>{const c3=camp({...base(),districts:[{id:'d1',name:'Порт'}]}),s3=scene(c3);s3.act('district','d1');return s3.body.innerHTML})()));
});
