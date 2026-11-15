/* Item groups (site/item-groups.js): the player's own groups in the inventory. A group changes no rule: it is a name,
   things point to it, and armor still goes on and off only through EquipmentTools. What is stored may come from an
   imported file, so reading rebuilds it from known fields and never changes it. */
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const read=f=>fs.readFileSync(path.join(__dirname,'..','site',f),'utf8');
// The real catalog and the real EquipmentTools, so the armor rules under test are the ones the app uses.
function load({tools=true}={}){
 let n=0;const window={crypto:{randomUUID:()=>'0000'+(++n).toString(16).padStart(4,'0')+'-aaaa-bbbb'}};
 const ctx={window,console,Math,JSON,Set,Map,WeakMap,Number,String,Array,Object,Date};vm.createContext(ctx);
 for(const f of ['catalog.js',...(tools?['equipment-tools.js']:[]),'inventory-cards.js','inventory-filter.js','item-groups.js'])vm.runInContext(read(f),ctx);
 return {window,G:window.ItemGroups,ET:window.EquipmentTools,C:window.InventoryCards,F:window.InventoryFilter};
}
const armor=(id,catalogId,more={})=>({id,catalogId,name:catalogId,category:'armor',quantity:1,...more});
const person=(extra={})=>({id:'p1',name:'Nova',head:0,bodyArmor:0,extra:{items:[],weapons:[],...extra}});
const plain=x=>JSON.parse(JSON.stringify(x));
function grouped(G,c,name='Рюкзак'){const r=G.create(c,name,'ru');assert.equal(r.ok,true,r.message);return r.id}

test('both languages have the same strings, and Russian addresses the reader formally',()=>{
 const {G}=load();
 assert.deepEqual(Object.keys(G.T.ru).sort(),Object.keys(G.T.en).sort());
 for(const [k,v] of Object.entries(G.T.ru)){const text=typeof v==='function'?v('X','Y',1):Array.isArray(v)?v.join(' '):v;assert.ok(text&&typeof text==='string',k);assert.doesNotMatch(text,/(^|[^а-яё])(ты|тебя|тебе|твой|твоя|твои|выбери|назови|нажми)([^а-яё]|$)/i,k)}
 assert.deepEqual([...G.T.ru.picks],['Рюкзак','Тайник','В машине']);assert.equal(G.T.en.picks.length,3);
});

test('a sheet saved before groups existed reads as before and is not changed by reading or drawing',()=>{
 const {G,F}=load();
 for(const c of [{id:'a'},{id:'a',extra:{}},{id:'a',extra:{items:[{id:'i1',name:'Rope',quantity:2}],weapons:[{id:'w1',name:'Knife'}]}},{id:'a',extra:'broken'},null]){
  const before=JSON.stringify(c),entries=[{record:c?.extra?.items?.[0],html:'<i>1</i>'},{record:{},html:'<i>2</i>'}];
  assert.deepEqual(plain(G.groups(c)),[]);assert.equal(G.groupOf(c,c?.extra?.items?.[0]),'');assert.equal(G.has(c,'g-1'),false);assert.deepEqual(plain(G.members(c,'g-1')),[]);
  assert.equal(G.arrange(c,'ru',entries),'<i>1</i><i>2</i>','without groups the cards come back exactly as they were');
  const chips=G.chips(c,'ru','all');
  assert.equal(chips.split('<button').length-1,1,'only the button that makes a group');assert.match(chips,/data-ig-action="new"/);assert.doesNotMatch(chips,/data-inventory-filter="group"/);
  assert.equal(G.field(c,'weapons',{id:'w1'},'ru'),'','a weapon card stays as it was until a group exists');
  assert.deepEqual(plain(G.wearPlan(c,'g-1').steps),[]);assert.equal(G.wearAll(c,'g-1','ru',true).ok,false);assert.equal(G.takeOffAll(c,'g-1','ru',true).ok,false);
  if(c)F.render(c,'ru','s',1);
  assert.equal(JSON.stringify(c),before);
 }
 const c={id:'a',extra:{items:[{id:'i1',name:'Rope'}]}},f=G.field(c,'items',c.extra.items[0],'en');
 assert.match(f,/<select data-ig-assign data-ig-kind="items" data-ig-rid="i1"><option value="" selected>No group<\/option><option value="__new">＋ New group…<\/option><\/select>/);
 assert.equal(G.field(c,'items',{name:'no id'},'ru'),'','a record without an id cannot be pointed at');assert.equal(G.field(c,'spells',{id:'x'},'ru'),'');
});

test('create: the name is trimmed and clipped, must be new, and there are at most twelve groups',()=>{
 const {G}=load(),c={id:'a'};
 const r=G.create(c,'  Рюкзак \n ','ru');
 assert.equal(r.ok,true);assert.equal(r.name,'Рюкзак');assert.match(r.id,/^g-[a-z0-9-]+$/);assert.equal(r.message,'Группа создана: Рюкзак.');
 assert.deepEqual(plain(c.extra.itemGroups),[{id:r.id,name:'Рюкзак'}]);
 assert.equal(G.create(c,'   ','ru').reason,'badName');assert.equal(G.create(c,null,'ru').reason,'badName');assert.equal(G.create(c,{},'en').message,'Give the group a name.');
 assert.equal(G.create(c,'рюкзак','ru').reason,'duplicate');assert.equal(G.create(c,'ＲЮКЗАК'.replace('Ｒ','Р'),'ru').reason,'duplicate');assert.equal(G.create(c,'Ｓtash','en').ok,true);assert.equal(G.create(c,'stash','en').reason,'duplicate','full-width letters are the same name');
 const long=G.create(c,'x'.repeat(200),'ru');assert.equal(long.name.length,G.NAME_MAX);
 for(let i=0;G.groups(c).length<G.MAX_GROUPS;i++)assert.equal(G.create(c,'Группа '+i,'ru').ok,true);
 assert.equal(G.groups(c).length,12);assert.equal(new Set(G.groups(c).map(g=>g.id)).size,12);
 const full=G.create(c,'Тринадцатая','ru');assert.equal(full.reason,'limit');assert.equal(full.message,'Групп может быть не больше 12.');assert.equal(c.extra.itemGroups.length,12);
 for(const broken of [{id:'b',extra:'text'},{id:'b',extra:[]},{id:'b',extra:null},null,'x']){const before=JSON.stringify(broken);assert.equal(G.create(broken,'A','ru').reason,'stale');assert.equal(JSON.stringify(broken),before)}
});

test('whatever an imported file holds, reading gives at most twelve clean groups and markup stays text',()=>{
 const {G}=load(),evil='<script>alert(1)</script>"\'&';
 const raw=[null,7,'x',[],{id:'all',name:'A'},{id:'none',name:'B'},{id:'__new',name:'C'},{id:'g-1',name:''},{id:'g-1',name:evil,collapsed:'yes'},{id:'g-1',name:'duplicate id'},{id:'g-<x>',name:'bad id'},{id:42,name:'number id'},{id:'g-2',name:'y'.repeat(5000),collapsed:true},{id:'g-3',name:7},
  ...Array.from({length:200},(_,i)=>({id:'g-n'+i,name:'N'+i}))];
 const c={id:'a',extra:{itemGroups:raw,items:[{id:'i1',name:evil,group:'g-1'},{id:'i2',name:'x',group:'all'},{id:'i3',name:'x',group:{}}],weapons:[{id:'w1',name:'w',group:'g-2'}]}},before=JSON.stringify(c);
 const list=G.groups(c);
 assert.equal(list.length,12);assert.deepEqual(plain(list[0]),{id:'g-1',name:evil,collapsed:false});assert.equal(list[1].id,'g-2');assert.equal(list[1].name.length,40);assert.equal(list[1].collapsed,true);
 assert.equal(G.groupOf(c,c.extra.items[1]),'');assert.equal(G.groupOf(c,c.extra.items[2]),'');assert.equal(G.groupOf(c,null),'');assert.equal(G.has(c,'all'),false);assert.equal(G.has(c,'g-n150'),false,'past the limit');
 const html=G.chips(c,'ru','g-1')+G.arrange(c,'ru',[{record:c.extra.items[0],html:'<i>card</i>'}])+G.field(c,'items',c.extra.items[0],'ru')+G.field(c,'weapons',c.extra.weapons[0],'ru')+G.newPanel(c,'ru',{kind:'items',rid:'"><b>'})+G.editPanel(c,'g-1','ru');
 assert.doesNotMatch(html,/<script/);assert.doesNotMatch(html,/alert\(1\)<\/script>"/);assert.match(html,/&lt;script&gt;alert\(1\)&lt;\/script&gt;&quot;&#39;&amp;/);assert.doesNotMatch(html,/data-ig-rid=""><b>/);
 assert.equal(JSON.stringify(c),before,'reading and drawing never change what is stored');
 for(const junk of ['text',{a:1},null,7])assert.deepEqual(plain(G.groups({extra:{itemGroups:junk}})),[]);
 // Entries nobody can see or delete must not lock the feature: once they fill the list they are dropped on a write.
 const z={id:'z',extra:{itemGroups:Array.from({length:40},()=>({junk:true}))}},made=G.create(z,'A','ru');
 assert.equal(made.ok,true);assert.deepEqual(plain(z.extra.itemGroups),[{id:made.id,name:'A'}],'a list full of unreadable entries is cleaned, not grown');
 const nulls={id:'n',extra:{itemGroups:[null,null,null,null,null,null,{id:'g-keep',name:'Тайник',collapsed:true,later:7},null,null,null,null,null,null]}};
 const more=G.create(nulls,'Рюкзак','ru');assert.equal(more.ok,true);
 assert.deepEqual(plain(nulls.extra.itemGroups),[{id:'g-keep',name:'Тайник',collapsed:true,later:7},{id:more.id,name:'Рюкзак'}],'the readable group stays as it was stored, unknown fields included');
 const few={id:'f',extra:{itemGroups:[null,{junk:1}]}};assert.equal(G.create(few,'A','ru').ok,true);assert.equal(few.extra.itemGroups.length,3,'a short list is left alone');
 // «Вернуть» after a delete works on such a sheet too.
 const u={id:'u',extra:{itemGroups:[{id:'g-x',name:'X'},...Array.from({length:12},()=>null)]}},del=G.remove(u,'g-x','ru');
 assert.equal(del.ok,true);assert.equal(G.restore(u,del.undo,'ru').ok,true);assert.deepEqual(plain(G.groups(u)),[{id:'g-x',name:'X',collapsed:false}]);
});

test('assign: a thing or a weapon goes into a group and out of it; everything else on the record stays',()=>{
 const {G}=load(),c={id:'a',extra:{items:[{id:'i1',name:'Rope',quantity:3,future:{keep:1}},{id:'dup',name:'A'},{id:'dup',name:'B'}],weapons:[{id:'w1',name:'Knife',damage:'1d6'}]}};
 const g=grouped(G,c),g2=grouped(G,c,'Тайник');c.extra.itemGroups[0].future='kept';
 const r=G.assign(c,'items','i1',g,'ru');
 assert.equal(r.ok,true);assert.equal(r.dirty,true);assert.equal(r.message,'Rope → Рюкзак');assert.deepEqual(plain(c.extra.items[0]),{id:'i1',name:'Rope',quantity:3,future:{keep:1},group:g});
 assert.equal(G.assign(c,'items','i1',g,'ru').dirty,false,'the same group again is not a change');
 assert.equal(G.assign(c,'weapons','w1',g2,'en').ok,true);assert.equal(c.extra.weapons[0].group,g2);assert.equal(G.groupOf(c,c.extra.weapons[0]),g2);
 assert.deepEqual(plain(G.members(c,g).map(m=>[m.kind,m.record.id])),[['items','i1']]);assert.deepEqual(plain(G.members(c,g2).map(m=>[m.kind,m.record.id])),[['weapons','w1']]);
 const before=JSON.stringify(c);
 for(const [kind,id,to] of [['items','i1','g-nope'],['items','i1','all'],['items','missing',g],['items','dup',g],['weapons','i1',g],['spells','i1',g],['items','',g],['items',null,g]])assert.equal(G.assign(c,kind,id,to,'ru').reason,'stale',[kind,id,to].join());
 assert.equal(JSON.stringify(c),before,'a refused move changes nothing');
 const out=G.assign(c,'items','i1','','ru');assert.equal(out.ok,true);assert.equal(out.message,'Rope: без группы');assert.equal('group' in c.extra.items[0],false,'the key is removed, not emptied');assert.deepEqual(plain(c.extra.items[0].future),{keep:1});
 assert.equal(c.extra.itemGroups[0].future,'kept');
 // A thing moved into a folded group opens it, so the thing does not seem to vanish.
 G.setCollapsed(c,g,true);assert.equal(G.assign(c,'items','i1',g,'ru').ok,true);assert.equal(G.groups(c)[0].collapsed,false);
});

test('rename keeps the id and the members; a fold is stored as `true` only',()=>{
 const {G}=load(),c={id:'a',extra:{items:[{id:'i1',name:'Rope'}]}},g=grouped(G,c),g2=grouped(G,c,'Тайник');
 G.assign(c,'items','i1',g,'ru');
 const r=G.rename(c,g,'  В машине ','ru');
 assert.equal(r.ok,true);assert.equal(r.message,'Группа теперь называется «В машине».');assert.equal(c.extra.itemGroups[0].id,g);assert.equal(G.groupOf(c,c.extra.items[0]),g);
 assert.equal(G.rename(c,g,'тайник','ru').reason,'duplicate');assert.equal(G.rename(c,g,'','ru').reason,'badName');assert.equal(G.rename(c,'g-nope','A','ru').reason,'stale');
 const same=G.rename(c,g,'В МАШИНЕ','ru');assert.equal(same.ok,true,'a group may change the case of its own name');
 assert.equal(G.rename(c,g,'В МАШИНЕ','ru').dirty,false);
 assert.equal(G.setCollapsed(c,g2,true).dirty,true);assert.equal(c.extra.itemGroups[1].collapsed,true);assert.equal(G.setCollapsed(c,g2,true).dirty,false);
 assert.equal(G.setCollapsed(c,g2,false).dirty,true);assert.equal('collapsed' in c.extra.itemGroups[1],false);assert.equal(G.setCollapsed(c,'g-nope',true).ok,false);
});

test('deleting a group deletes no thing, and «Вернуть» puts the group and its members back',()=>{
 const {G}=load(),c={id:'a',extra:{items:[{id:'i1',name:'Rope',quantity:5},{id:'i2',name:'Lamp',quantity:1},{id:'i3',name:'Tape',quantity:2}],weapons:[{id:'w1',name:'Knife'}]}};
 const g1=grouped(G,c),g2=grouped(G,c,'Тайник'),g3=grouped(G,c,'В машине');
 G.assign(c,'items','i1',g2,'ru');G.assign(c,'items','i2',g2,'ru');G.assign(c,'items','i3',g2,'ru');G.assign(c,'weapons','w1',g2,'ru');G.setCollapsed(c,g2,true);c.extra.itemGroups[1].future=1;
 const r=G.remove(c,g2,'ru');
 assert.equal(r.ok,true);assert.equal(r.message,'Группа удалена: Тайник. Вещи остались в инвентаре.');
 assert.deepEqual(plain(G.groups(c).map(g=>g.id)),[g1,g3]);assert.deepEqual(plain(c.extra.items),[{id:'i1',name:'Rope',quantity:5},{id:'i2',name:'Lamp',quantity:1},{id:'i3',name:'Tape',quantity:2}]);assert.deepEqual(plain(c.extra.weapons),[{id:'w1',name:'Knife'}]);
 assert.equal(G.remove(c,g2,'ru').reason,'stale');
 // Meanwhile one thing was sold and another was put into a different group: neither is pulled back.
 c.extra.items.splice(1,1);G.assign(c,'items','i3',g3,'ru');
 assert.equal(G.restore({id:'other',extra:{}},r.undo,'ru').reason,'stale','not on another character');
 const back=G.restore(c,r.undo,'ru');
 assert.equal(back.ok,true);assert.equal(back.message,'Группа возвращена: Тайник.');
 assert.deepEqual(plain(c.extra.itemGroups.map(g=>g.id)),[g1,g2,g3],'at the place it had');assert.deepEqual(plain(c.extra.itemGroups[1]),{id:g2,name:'Тайник',collapsed:true,future:1});
 assert.equal(c.extra.items[0].group,g2);assert.equal(c.extra.items[1].group,g3);assert.equal(c.extra.weapons[0].group,g2);assert.equal(c.extra.items.length,2);
 assert.equal(G.restore(c,r.undo,'ru').reason,'stale','the group is there again');
 // The name was taken, or the list filled up, while the notice was shown.
 const again=G.remove(c,g2,'ru');grouped(G,c,'тайник');assert.equal(G.restore(c,again.undo,'ru').reason,'duplicate');
 const d={id:'d',extra:{}},gone=G.remove(d,grouped(G,d,'Первая'),'ru');for(let i=0;i<12;i++)grouped(G,d,'G'+i);
 assert.equal(G.restore(d,gone.undo,'en').reason,'limit');assert.equal(G.groups(d).length,12);
 for(const junk of [null,{},{group:{id:'all',name:'x'}},{group:{id:'g-1',name:''}}])assert.equal(G.restore({id:'e'},junk,'ru').ok,false);
});

test('«Надеть всё»: two pieces go on the body and then the head, through EquipmentTools',()=>{
 const {G}=load(),c=person({items:[armor('a1','armor-leathers'),armor('a2','armor-kevlar'),armor('a3','armor-flak'),{id:'rope',name:'Rope',quantity:1}]}),g=grouped(G,c);
 for(const id of ['a1','a2','a3','rope'])G.assign(c,'items',id,g,'ru');
 assert.deepEqual(plain(G.armorIn(c,g).map(r=>r.id)),['a1','a2','a3']);
 const plan=G.wearPlan(c,g);
 assert.deepEqual(plain(plan.steps.map(s=>[s.recordId,s.location,s.sp,s.replaces])),[['a1','body',4,false],['a2','head',7,false]]);assert.deepEqual(plain(plan.kept),['a3']);assert.equal(plan.replaces,false);assert.equal(plan.dropSuit,false);
 const r=G.wearAll(c,g,'ru',false);
 assert.equal(r.ok,true);assert.equal(r.dirty,true);assert.equal(c.bodyArmor,4);assert.equal(c.head,7);
 assert.deepEqual(plain(c.extra.equipment.armor),{body:{recordId:'a1',piece:0,catalogId:'armor-leathers'},head:{recordId:'a2',piece:0,catalogId:'armor-kevlar'}});
 assert.equal(r.message,'Надето: тело — Кожа (SP 4), голова — Кевлар (SP 7). Не надето: armor-flak (свободного места нет).');
 // Pressed again: what is worn from this group is left alone, and the third piece still has no place.
 const again=G.wearAll(c,g,'ru',true);assert.equal(again.ok,false);assert.equal(again.reason,'noPlace');assert.equal(c.bodyArmor,4);assert.equal(c.head,7);
 assert.deepEqual(plain(G.wearPlan(c,g).already),[{recordId:'a2',location:'head'},{recordId:'a1',location:'body'}]);
 c.extra.items.pop();c.extra.items.pop();assert.equal(G.wearAll(c,g,'en',true).reason,'allWorn');assert.equal(G.wearAll(c,g,'en',true).message,'All armor of this group is already on.');
});

test('«Надеть всё»: one thing with a quantity of two covers both places; a starter piece keeps its place',()=>{
 const {G}=load(),c=person({items:[armor('pair','armor-leathers',{quantity:2})]}),g=grouped(G,c);G.assign(c,'items','pair',g,'ru');
 assert.equal(G.wearAll(c,g,'ru').ok,true);
 assert.deepEqual(plain(c.extra.equipment.armor),{body:{recordId:'pair',piece:0,catalogId:'armor-leathers'},head:{recordId:'pair',piece:1,catalogId:'armor-leathers'}});assert.equal(c.head,4);assert.equal(c.bodyArmor,4);
 const s=person({items:[armor('helmet','armor-light-armorjack',{starterArmor:{version:1,location:'head'}}),armor('second','armor-leathers'),armor('third','armor-kevlar'),armor('broken','armor-light-armorjack',{starterArmor:{version:9}}),armor('shield','armor-bulletproof-shield'),armor('many','armor-kevlar',{quantity:0}),{id:'own',name:'Своя броня',category:'armor',quantity:1}]}),gs=grouped(G,s);
 for(const it of s.extra.items)G.assign(s,'items',it.id,gs,'ru');
 assert.deepEqual(plain(G.armorIn(s,gs).map(r=>r.id)),['helmet','second','third'],'only what EquipmentTools can put on');
 assert.deepEqual(plain(G.wearPlan(s,gs).steps.map(x=>[x.recordId,x.location])),[['helmet','head'],['second','body']]);assert.deepEqual(plain(G.wearPlan(s,gs).kept),['third']);
 assert.equal(G.wearAll(s,gs,'en').ok,true);assert.equal(s.head,11);assert.equal(s.bodyArmor,4);
});

test('«Надеть всё»: a starter piece is placed first, so a free piece listed before it does not leave a location bare',()=>{
 const {G}=load(),c=person({items:[armor('x','armor-leathers'),armor('y','armor-light-armorjack',{starterArmor:{version:1,location:'body'}})]}),g=grouped(G,c);
 for(const id of ['x','y'])G.assign(c,'items',id,g,'ru');
 const plan=G.wearPlan(c,g);
 assert.deepEqual(plain(plan.steps.map(s=>[s.recordId,s.location])),[['y','body'],['x','head']]);assert.deepEqual(plain(plan.kept),[]);
 const r=G.wearAll(c,g,'ru');assert.equal(r.ok,true);assert.equal(c.bodyArmor,11);assert.equal(c.head,4);assert.doesNotMatch(r.message,/Не надето/);
 // Two starter pieces for the same location: the first in the list goes on, the other stays, the free piece takes the head.
 const d=person({items:[armor('free','armor-kevlar'),armor('b1','armor-light-armorjack',{starterArmor:{version:1,location:'body'}}),armor('b2','armor-light-armorjack',{starterArmor:{version:1,location:'body'}})]}),gd=grouped(G,d);
 for(const it of d.extra.items)G.assign(d,'items',it.id,gd,'ru');
 assert.deepEqual(plain(G.wearPlan(d,gd).steps.map(s=>[s.recordId,s.location])),[['b1','body'],['free','head']]);assert.deepEqual(plain(G.wearPlan(d,gd).kept),['b2']);
});

test('the question of «Надеть всё» names the locations whose armor is replaced, and no others',()=>{
 const {G,ET}=load(),c=person({items:[armor('l','armor-leathers'),armor('k','armor-kevlar'),armor('j','armor-light-armorjack'),armor('f','armor-flak')]}),a=grouped(G,c,'A'),b=grouped(G,c,'B');
 G.assign(c,'items','l',a,'ru');G.assign(c,'items','k',a,'ru');G.assign(c,'items','j',b,'ru');
 assert.equal(G.wearAll(c,a,'ru').ok,true);
 // One piece in B: it goes on the body only, and the kevlar on the head stays.
 assert.equal(G.wearAll(c,b,'ru',false).message,'Надеть броню группы «B»? На теле она заменит то, что надето сейчас. Повреждённый SP останется за снятой бронёй.');
 assert.equal(G.wearAll(c,b,'en',false).message,'Put on the armor of the group “B”? It replaces what is worn on the body. The damaged SP stays with the piece that comes off.');
 assert.equal(G.wearAll(c,b,'ru',true).ok,true);assert.equal(c.head,7,'the head keeps what it wore');assert.equal(c.bodyArmor,11);
 // Two pieces in B against two worn from A: both locations are named.
 assert.equal(G.takeOffAll(c,b,'ru',true).ok,true);assert.equal(ET.equip(c,'l','body','ru',true).ok,true);G.assign(c,'items','f',b,'ru');
 assert.match(G.wearAll(c,b,'ru',false).message,/\? На голове и на теле она заменит/);assert.match(G.wearAll(c,b,'en',false).message,/worn on the head and the body\./);
 // Only the head is covered and the body is bare: one piece fills the body and asks nothing.
 const h=person({items:[armor('k','armor-kevlar'),armor('j','armor-light-armorjack'),armor('f','armor-flak')]}),gh=grouped(G,h,'H');
 assert.equal(ET.equip(h,'k','head','ru',true).ok,true);G.assign(h,'items','j',gh,'ru');assert.equal(G.wearAll(h,gh,'ru',false).ok,true);assert.equal(h.head,7);
 // With the body now taken by the group, the next piece can only replace the head: the question names the head.
 G.assign(h,'items','f',gh,'ru');assert.match(G.wearAll(h,gh,'ru',false).message,/\? На голове она заменит/);assert.match(G.wearAll(h,gh,'en',false).message,/worn on the head\./);
});

test('«Надеть всё» asks before it replaces worn armor, and the damaged SP of the replaced piece is kept',()=>{
 const {G,ET}=load(),c=person({items:[armor('old','armor-kevlar'),armor('new','armor-leathers')]}),g=grouped(G,c);G.assign(c,'items','new',g,'ru');
 assert.equal(ET.equip(c,'old','body','ru',true).ok,true);c.bodyArmor=5;
 const before=JSON.stringify(c),ask=G.wearAll(c,g,'ru',false);
 assert.equal(ask.ok,false);assert.equal(ask.reason,'confirmNeeded');assert.match(ask.message,/^Надеть броню группы «Рюкзак»\? На [а-я ]+ она заменит то, что надето сейчас\. Повреждённый SP останется за снятой бронёй\.$/);assert.equal(JSON.stringify(c),before,'nothing changes before the answer');
 assert.equal(G.wearPlan(c,g).replaces,true);
 const r=G.wearAll(c,g,'ru',true);
 assert.equal(r.ok,true);assert.equal(c.bodyArmor,4);assert.equal(c.extra.equipment.armor.body.recordId,'new');
 assert.deepEqual(plain(c.extra.equipment.armorHistory),[{recordId:'old',piece:0,location:'body',sp:5}]);
 assert.equal(ET.equip(c,'old','body','ru',true).ok,true);assert.equal(c.bodyArmor,5,'the worn-down piece comes back with the SP it had');
 // SP typed in by hand on a bare location is also something to ask about.
 const m=person({items:[armor('x','armor-leathers')]}),gm=grouped(G,m);G.assign(m,'items','x',gm,'ru');m.bodyArmor=9;
 assert.equal(G.wearAll(m,gm,'en',false).reason,'confirmNeeded');assert.equal(m.bodyArmor,9);
});

test('«Надеть всё» and the Bodyweight Suit: it takes both places only when both are free, and a suit from outside comes off first',()=>{
 const {G,ET}=load(),SUIT='armor-bodyweight-suit';
 const a=person({items:[armor('suit',SUIT),armor('l','armor-leathers')]}),ga=grouped(G,a);G.assign(a,'items','suit',ga,'ru');G.assign(a,'items','l',ga,'ru');
 assert.deepEqual(plain(G.wearPlan(a,ga).steps.map(s=>[s.recordId,s.location])),[['suit','both']]);assert.deepEqual(plain(G.wearPlan(a,ga).kept),['l']);
 const ra=G.wearAll(a,ga,'ru');assert.equal(ra.ok,true);assert.equal(a.head,11);assert.equal(a.bodyArmor,11);assert.match(ra.message,/^Надето: голова и тело — Бронекостюм нетраннера \(SP 11\)\./);
 assert.equal(G.wearAll(a,ga,'ru',true).reason,'noPlace');
 const b=person({items:[armor('l','armor-leathers'),armor('suit',SUIT)]}),gb=grouped(G,b);G.assign(b,'items','l',gb,'ru');G.assign(b,'items','suit',gb,'ru');
 assert.deepEqual(plain(G.wearPlan(b,gb).steps.map(s=>[s.recordId,s.location])),[['l','body']],'the suit needs both places');assert.deepEqual(plain(G.wearPlan(b,gb).kept),['suit']);
 // A suit worn from outside the group: ordinary pieces cannot go over it, so it comes off (after the question).
 const c=person({items:[armor('suit',SUIT),armor('l','armor-leathers'),armor('k','armor-kevlar')]}),gc=grouped(G,c);G.assign(c,'items','l',gc,'ru');G.assign(c,'items','k',gc,'ru');
 assert.equal(ET.equip(c,'suit','both','ru',true).ok,true);
 const plan=G.wearPlan(c,gc);assert.equal(plan.dropSuit,true);assert.equal(plan.replaces,true);
 assert.equal(G.wearAll(c,gc,'ru').reason,'confirmNeeded');assert.equal(c.extra.equipment.armor.head.recordId,'suit');
 const rc=G.wearAll(c,gc,'ru',true);assert.equal(rc.ok,true);assert.equal(c.extra.equipment.armor.body.recordId,'l');assert.equal(c.extra.equipment.armor.head.recordId,'k');assert.equal(c.bodyArmor,4);assert.equal(c.head,7);
});

test('«Снять всё» takes off only what this group wears, asks first, and a suit leaves both places at once',()=>{
 const {G,ET}=load(),c=person({items:[armor('mine','armor-leathers'),armor('other','armor-kevlar')]}),g=grouped(G,c),g2=grouped(G,c,'Тайник');
 G.assign(c,'items','mine',g,'ru');G.assign(c,'items','other',g2,'ru');
 assert.equal(G.takeOffAll(c,g,'ru',true).reason,'noArmor');assert.equal(G.takeOffAll(c,g,'ru',true).message,'Из этой группы ничего не надето.');
 ET.equip(c,'mine','body','ru',true);ET.equip(c,'other','head','ru',true);
 assert.deepEqual(plain(G.wornOf(c,g)),['body']);assert.deepEqual(plain(G.wornOf(c,g2)),['head']);
 const before=JSON.stringify(c),ask=G.takeOffAll(c,g,'ru');
 assert.equal(ask.reason,'confirmNeeded');assert.equal(ask.message,'Снять всю броню группы «Рюкзак»?');assert.equal(JSON.stringify(c),before);
 const r=G.takeOffAll(c,g,'ru',true);
 assert.equal(r.ok,true);assert.equal(r.message,'Снято: тело — Кожа.');assert.equal(c.bodyArmor,0);assert.equal(c.head,7,'armor of another group stays on');assert.deepEqual(Object.keys(c.extra.equipment.armor),['head']);
 const s=person({items:[armor('suit','armor-bodyweight-suit')]}),gs=grouped(G,s);G.assign(s,'items','suit',gs,'ru');ET.equip(s,'suit','both','ru',true);
 const rs=G.takeOffAll(s,gs,'en',true);assert.equal(rs.ok,true);assert.equal(rs.removed.length,1);assert.equal(rs.message,'Taken off: head and body: Bodyweight Suit.','English uses the same pattern as the put-on notice');assert.equal(s.head,0);assert.equal(s.bodyArmor,0);
});

test('without EquipmentTools the bulk actions refuse cleanly and their buttons are not drawn',()=>{
 const {G}=load({tools:false}),c=person({items:[armor('a1','armor-leathers')],equipment:{armor:{body:{recordId:'a1',piece:0,catalogId:'armor-leathers'}}}}),g=grouped(G,c);G.assign(c,'items','a1',g,'ru');
 const before=JSON.stringify(c);
 assert.deepEqual(plain(G.armorIn(c,g)),[]);assert.equal(G.wearAll(c,g,'ru',true).reason,'stale');assert.equal(G.takeOffAll(c,g,'ru',true).reason,'stale');assert.equal(JSON.stringify(c),before);
 const html=G.arrange(c,'ru',[{record:c.extra.items[0],html:'<i>a1</i>'}]);
 assert.doesNotMatch(html,/wear-all|off-all/);assert.match(html,/data-ig-action="edit"/);
});

test('the list is drawn group by group: loose things first, then every group with its header, tools and cards',()=>{
 const {G,ET}=load(),c=person({items:[armor('a1','armor-leathers'),{id:'rope',name:'Rope',quantity:1},{id:'tape',name:'Tape',quantity:1}],weapons:[{id:'w1',name:'Knife'}]});
 const g1=grouped(G,c),g2=grouped(G,c,'Тайник'),g3=grouped(G,c,'В машине <b>');
 G.assign(c,'items','a1',g1,'ru');G.assign(c,'weapons','w1',g1,'ru');G.assign(c,'items','tape',g2,'ru');G.setCollapsed(c,g2,true);
 const entries=[{record:c.extra.weapons[0],html:'<i>w1</i>'},...c.extra.items.map(r=>({record:r,html:`<i>${r.id}</i>`})),null,{record:{},html:7}];
 const html=G.arrange(c,'ru',entries);
 assert.ok(html.startsWith('<div class="ig-none" data-ig-none><p class="ig-title">Без группы</p><i>rope</i></div><div class="ig-group" role="group" aria-label="Рюкзак" data-ig-group="'+g1+'">'),html.slice(0,200));
 assert.deepEqual([...html.matchAll(/data-ig-group="([^"]+)"/g)].map(m=>m[1]),[g1,g2,g3],'in the stored order');
 assert.match(html,new RegExp(`data-ig-action="toggle" data-ig-id="${g1}" aria-expanded="true" aria-controls="ig-body-${g1}"><span class="ig-caret" aria-hidden="true">▸</span><strong>Рюкзак</strong><b class="ig-count" data-ig-count>2</b>`));
 assert.match(html,new RegExp(`<div class="ig-body" id="ig-body-${g1}"><i>w1</i><i>a1</i></div>`),'weapons and things of a group together, in the order of the list');
 assert.match(html,new RegExp(`data-ig-collapsed="1"><div class="ig-head"><button type="button" class="ig-toggle" data-ig-action="toggle" data-ig-id="${g2}" aria-expanded="false"`));assert.match(html,new RegExp(`id="ig-body-${g2}" hidden><i>tape</i>`));
 assert.match(html,new RegExp(`id="ig-body-${g3}"><p class="cx-empty ig-empty">В группе пока ничего нет\\. Выберите группу в карточке предмета\\.</p>`));assert.match(html,/aria-label="В машине &lt;b&gt;"/);
 for(const id of [g1,g2,g3])assert.equal(html.split(`id="ig-body-${id}"`).length,2,'every aria-controls has exactly one target');
 // «Надеть всё» only where something can go on, «Снять всё» only where something of the group is worn.
 const tools=id=>html.split(`data-ig-group="${id}"`)[1].split('class="ig-body"')[0];
 assert.match(tools(g1),/data-ig-action="wear-all" data-ig-id="[^"]+" aria-label="Надеть всю броню группы «Рюкзак»">Надеть всё</);assert.doesNotMatch(tools(g1),/off-all/);
 assert.doesNotMatch(tools(g2),/wear-all|off-all/);assert.match(tools(g2),/aria-label="Изменить группу «Тайник»">Изменить</);
 ET.equip(c,'a1','body','ru',true);
 const worn=G.arrange(c,'en',entries).split(`data-ig-group="${g1}"`)[1].split('class="ig-body"')[0];
 assert.doesNotMatch(worn,/wear-all/,'nothing more of this group can go on');assert.match(worn,/data-ig-action="off-all" data-ig-id="[^"]+" aria-label="Take off all armor of the group “Рюкзак”">Take off all</);
 // With every thing in a group there is no «Без группы» block.
 G.assign(c,'items','rope',g1,'ru');assert.doesNotMatch(G.arrange(c,'ru',entries),/data-ig-none/);
});

test('the «Группа» select and the chips name every group and mark the current one',()=>{
 const {G}=load(),c={id:'a',extra:{items:[{id:'i1',name:'Rope'}],weapons:[{id:'w1',name:'Knife'}]}},g1=grouped(G,c),g2=grouped(G,c,'Тайник');
 G.assign(c,'items','i1',g2,'ru');
 const f=G.field(c,'items',c.extra.items[0],'ru');
 assert.equal(f,`<label class="field ig-field">Группа<select data-ig-assign data-ig-kind="items" data-ig-rid="i1"><option value="">Без группы</option><option value="${g1}">Рюкзак</option><option value="${g2}" selected>Тайник</option><option value="__new">＋ Новая группа…</option></select></label>`);
 assert.match(G.field(c,'weapons',c.extra.weapons[0],'en'),/data-ig-kind="weapons" data-ig-rid="w1"><option value="" selected>No group</);
 const chips=G.chips(c,'ru',g2);
 assert.match(chips,/^<div class="inventory-chips inventory-groups" role="group" aria-label="Группа предметов" data-ig-chips>/);
 assert.deepEqual([...chips.matchAll(/data-inventory-filter="group" value="([^"]+)" aria-pressed="([^"]+)"><span>([^<]+)</g)].map(m=>m.slice(1)),[['none','false','Без группы'],[g1,'false','Рюкзак'],[g2,'true','Тайник']]);
 assert.match(chips,/data-ig-action="new"><span aria-hidden="true">＋<\/span><span>Группа<\/span><\/button><\/div>$/);
 // The panel offers the names that are not taken yet, and remembers the card that asked for it.
 const panel=G.newPanel(c,'ru',{kind:'items',rid:'i1'});
 assert.match(panel,/data-ig-panel="new" data-ig-kind="items" data-ig-rid="i1" role="group" aria-label="Новая группа"/);assert.match(panel,/<input type="text" maxlength="40" autocomplete="off" data-ig-name>/);
 assert.deepEqual([...panel.matchAll(/data-ig-action="pick" value="([^"]+)"/g)].map(m=>m[1]),['В машине']);assert.match(panel,/role="alert" data-ig-error hidden/);
 assert.doesNotMatch(G.newPanel(c,'en',null),/data-ig-rid/);assert.doesNotMatch(G.newPanel(c,'en',{kind:'spells',rid:'x'}),/data-ig-rid/);
 assert.match(G.editPanel(c,g1,'ru'),new RegExp(`data-ig-panel="edit" data-ig-id="${g1}" role="group" aria-label="Группа «Рюкзак»"`));assert.match(G.editPanel(c,g1,'ru'),/value="Рюкзак" data-ig-name>.*data-ig-action="rename">Сохранить<.*data-ig-action="delete">Удалить группу</);
 assert.equal(G.editPanel(c,'g-nope','ru'),'');
});

/* ---------- The list after a filter: a small stand-in for the page ---------- */
function page(groups){
 const make=(id,collapsed,rows)=>{const count={textContent:''},body={hidden:collapsed},attrs={},toggle={setAttribute:(k,v)=>{attrs[k]=v}};
  return {dataset:id?{igGroup:id,...(collapsed?{igCollapsed:'1'}:{})}:{},hidden:false,rows:rows.map(h=>({hidden:h})),count,body,attrs,querySelectorAll(){return this.rows},querySelector:s=>s==='[data-ig-count]'?count:s==='.ig-body'?body:toggle}};
 const boxes=groups.map(g=>make(g.id,g.collapsed===true,g.rows)),none=boxes.filter(b=>!b.dataset.igGroup),named=boxes.filter(b=>b.dataset.igGroup);
 return {boxes,root:{querySelectorAll:s=>s==='[data-ig-group]'?named:s==='[data-ig-none]'?none:[]}};
}
test('after a filter: the headers count what is seen, a folded group opens for a search or its own chip, an emptied group steps aside',()=>{
 const {G}=load(),h=page([{id:'',rows:[false,true]},{id:'g-a',rows:[false,false]},{id:'g-b',collapsed:true,rows:[false]},{id:'g-c',rows:[]}]),[none,a,b,c]=h.boxes;
 G.afterFilter(h.root,{query:false,group:'all',filtered:false});
 assert.deepEqual(h.boxes.map(x=>x.hidden),[false,false,false,false],'nothing is filtered: an empty group stays, to be renamed or deleted');
 assert.deepEqual([a,b,c].map(x=>x.count.textContent),['2','1','0']);assert.deepEqual([a,b,c].map(x=>x.body.hidden),[false,true,false]);assert.deepEqual([a,b,c].map(x=>x.attrs['aria-expanded']),['true','false','true']);
 // A search: the folded group shows its hit, groups with nothing to show step aside.
 none.rows[0].hidden=true;a.rows[0].hidden=true;a.rows[1].hidden=true;
 G.afterFilter(h.root,{query:true,group:'all',filtered:true});
 assert.deepEqual(h.boxes.map(x=>x.hidden),[true,true,false,true]);assert.equal(b.body.hidden,false);assert.equal(b.attrs['aria-expanded'],'true');assert.equal(a.count.textContent,'0');
 // The search is cleared: folded again, everything back.
 for(const x of h.boxes)for(const r of x.rows)r.hidden=false;
 G.afterFilter(h.root,{query:false,group:'all',filtered:false});
 assert.deepEqual(h.boxes.map(x=>x.hidden),[false,false,false,false]);assert.equal(b.body.hidden,true);assert.equal(b.attrs['aria-expanded'],'false');
 // Its own chip opens a folded group.
 G.afterFilter(h.root,{query:false,group:'g-b',filtered:true});assert.equal(b.body.hidden,false);
 // A type chip alone opens it too: the status line counts its cards, so they must be on screen.
 G.afterFilter(h.root,{query:false,group:'all',filtered:false});assert.equal(b.body.hidden,true);
 G.afterFilter(h.root,{query:false,group:'all',filtered:true});assert.equal(b.hidden,false);assert.equal(b.body.hidden,false);assert.equal(b.attrs['aria-expanded'],'true');
 // Another group's chip leaves it with nothing to show: it steps aside whole.
 b.rows[0].hidden=true;G.afterFilter(h.root,{query:false,group:'g-a',filtered:true});assert.equal(b.hidden,true);
 assert.doesNotThrow(()=>{G.afterFilter(null,{});G.afterFilter({},{});G.afterFilter(h.root)});
});

test('the feature is registered: styles and script in index.html in the right order, and the three hooks in the sheet',()=>{
 const index=read('index.html'),scripts=[...index.matchAll(/<script src="([^"]+)"><\/script>/g)].map(m=>m[1]);
 assert.match(index,/<link rel="stylesheet" href="inventory-cards\.css"><link rel="stylesheet" href="item-groups\.css">/);
 assert.equal(scripts.filter(s=>s==='item-groups.js').length,1);
 assert.ok(scripts.indexOf('item-groups.js')>scripts.indexOf('inventory-filter.js'));assert.ok(scripts.indexOf('item-groups.js')<scripts.indexOf('character-extra.js'));assert.equal(scripts.at(-1),'app.js');
 const sheet=read('character-extra.js');
 for(const hook of ["data-inventory-group=\"${html(window.ItemGroups?.groupOf(c,it)||'')}\"","${window.ItemGroups?.field(c,'items',it,l)||''}","window.ItemGroups.arrange(c,l,["])assert.equal(sheet.split(hook).length,2,hook);
 assert.match(read('inventory-filter.js'),/global\.ItemGroups\?\.chips\?\.\(c,lang,group\)/);assert.match(read('inventory-filter.js'),/global\.ItemGroups\?\.afterFilter\?\./);
 for(const f of ['item-groups.js','item-groups.css'])assert.equal(read(f).includes('\r'),false,f+' keeps LF line endings');
 // A group never leaves the device through a room: room.js drops the two fields from a sheet on sending and on arrival
 // (tests/room-sheets.test.cjs sends a real sheet), and no other room module knows them.
 assert.equal(read('room.js').split('dropItemGroups(').length-1,3,'defined once, used on packing and on receipt');
 for(const f of fs.readdirSync(path.join(__dirname,'..','site')).filter(f=>/^room.*\.js$/.test(f)&&f!=='room.js'))assert.doesNotMatch(read(f),/itemGroups|ItemGroups/,f);
});
