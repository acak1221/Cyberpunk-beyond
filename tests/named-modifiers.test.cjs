/* Named modifiers: «Smartgun +1», «Темнота −2». Written once on the sheet, switched on and off, counted by the
   effects layer for the checks they are for, asleep while the thing they are tied to is gone.
   A sheet can come from a file, a link or another device, so most of this is about what is NOT trusted. */
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const read=f=>fs.readFileSync(path.join(__dirname,'..','site',f),'utf8');
const plain=x=>JSON.parse(JSON.stringify(x));
const LABELS={Handgun:{ru:'Пистолеты',en:'Handgun'},Stealth:{ru:'Скрытность',en:'Stealth'},Brawling:{ru:'Драка',en:'Brawling'},'First Aid':{ru:'Первая помощь',en:'First Aid'}};
// The module next to the real effects layer, the way the page has them.
function load({effects=true,labels=LABELS,tools=false}={}){
 const window={};if(labels)window.SKILL_LABELS=labels;
 const ctx=vm.createContext({window});
 if(effects)vm.runInContext(read('effects.js'),ctx);
 vm.runInContext(read('named-modifiers.js'),ctx);
 if(tools)vm.runInContext(read('tool-effects.js'),ctx);
 return {window,N:window.NamedModifiers,E:window.Effects,TE:window.ToolEffects};
}
const entry=(id,more={})=>({id,name:'Smartgun',value:1,on:true,scope:'all',...more});
const hero=(list,extra={})=>({id:'v1',stats:{REF:7,BODY:8,MOVE:6},skills:{Handgun:4},extra:{items:[],weapons:[],...(list===undefined?{}:{namedModifiers:{version:1,list}}),...extra}});
const sum=parts=>parts.reduce((a,p)=>a+p.value,0);

test('a sheet without the record, or with a record this version cannot read, rolls exactly as before and is never written over',()=>{
 const {N,E}=load();
 for(const c of [null,undefined,7,{},{extra:null},{extra:{}},hero()]){assert.deepEqual(plain(N.list(c)),[]);assert.deepEqual(plain(N.active(c)),[])}
 assert.deepEqual(Object.keys(E.collect(hero())).sort(),['all','death','ignoreSerious','initiative','melee','move','ranged','skills','sources','stats'],'the sum keeps its old shape');
 // a record of a later version is another app's; anything else that is not a record is damage
 for(const [bad,why] of [[null,'damaged'],[[],'damaged'],['x','damaged'],[{version:1,list:{0:entry('a')}},'damaged'],[{version:1},'damaged'],[{list:[entry('a')]},'damaged'],[{version:0,list:[]},'damaged'],[{version:2,list:[entry('a')]},'foreign'],[{version:7},'foreign']]){
  const c=hero();c.extra.namedModifiers=bad;const before=JSON.stringify(c);
  assert.deepEqual(plain(N.list(c)),[]);assert.equal(E.checkModifier(c,'ranged','Handgun','REF'),0);
  for(const lang of ['ru','en']){
   for(const r of [N.add(c,{name:'A',value:1,scope:'all'},lang),N.toggle(c,'a',lang),N.update(c,'a',{name:'A',value:1,scope:'all'},lang),N.remove(c,'a',lang),N.detach(c,'a',lang),N.restore(c,{index:0,entry:entry('z')},lang)]){assert.equal(r.ok,false);assert.equal(r.message,N.t(lang,why))}
  }
  assert.equal(JSON.stringify(c),before,'the stored value is untouched');
  if(why==='foreign'){assert.match(N.bar(c,'ru'),/записаны другой версией/);assert.doesNotMatch(N.bar(c,'ru'),/data-nm-op/);assert.equal(N.reset(c,'ru').message,N.t('ru','foreign'));assert.equal(JSON.stringify(c),before)}
  else{assert.match(N.bar(c,'ru'),/повреждена/);assert.doesNotMatch(N.bar(c,'ru'),/другой версией/);assert.deepEqual(N.bar(c,'en').match(/data-nm-op="[a-z]+"/g),['data-nm-op="reset"'],'the only thing offered is to start over')}
 }
});

test('a damaged record can be started over, and the old one taken back as it was',()=>{
 const {N,E}=load();
 for(const bad of [null,'x',[1,2],{version:1,list:'no'}]){
  const c=hero();c.extra.namedModifiers=bad;const before=JSON.stringify(c);
  const r=N.reset(c,'ru');
  assert.equal(r.ok,true);assert.equal(r.message,'Запись модификаторов начата заново.');assert.deepEqual(plain(c.extra.namedModifiers),{version:1,list:[]});
  assert.match(N.bar(c,'ru'),/\+ Свой модификатор/);
  assert.equal(N.unreset(c,r.undo,'ru').message,'Прежняя запись возвращена.');assert.equal(JSON.stringify(c),before,'the old value is back, whatever it was');
  // started over and used: the way back is shut rather than taking the new modifier away
  const again=N.reset(c,'en');assert.equal(N.add(c,{name:'New',value:2,scope:'all'},'en').ok,true);
  assert.deepEqual([N.unreset(c,again.undo,'en').ok,N.unreset(c,again.undo,'en').message],[false,N.t('en','stale')]);assert.equal(E.checkModifier(c),2);
 }
 // nothing to start over on a healthy sheet, on one without the record, or with nonsense for an undo
 const fine=hero([entry('a')]),was=JSON.stringify(fine);assert.equal(N.reset(fine,'ru').ok,false);assert.equal(N.reset(hero(),'ru').ok,false);assert.equal(N.reset(null,'ru').ok,false);assert.equal(JSON.stringify(fine),was);
 for(const undo of [null,{},{left:''},{left:'{"version":1,"list":[]}',record:null}])assert.equal(N.unreset(fine,undo,'ru').ok,false);
 assert.equal(JSON.stringify(fine),was);
});

test('a list clogged with rows that cannot be read says so, and can be cleared without losing a modifier',()=>{
 const {N,E}=load();
 const junk=n=>Array.from({length:n},(_,i)=>i%2?{junk:i}:'x');
 const empty=hero(junk(200));
 assert.deepEqual(plain(N.list(empty)),[]);
 const no=N.add(empty,{name:'n',value:1,scope:'all'},'en');
 assert.equal(no.ok,false);assert.equal(no.message,N.t('en','clogged'));assert.doesNotMatch(no.message,/24/,'not «24 already»: none is shown');
 assert.match(N.bar(empty,'ru'),/не может прочитать[^<]*<\/p><span class="nm-form-actions nm-stuck"><button[^>]*data-nm-op="reset"[^>]*>Убрать нечитаемые записи</);
 // below the cap nothing is offered and nothing is touched
 const some=hero([...junk(50),entry('a')]);assert.doesNotMatch(N.bar(some,'ru'),/data-nm-op="reset"/);assert.equal(N.reset(some,'ru').ok,false);assert.equal(some.extra.namedModifiers.list.length,51);
 // readable rows survive, in order, the very same objects; a row past the first 200 is found too; twins and junk go
 const a=entry('a',{keepMe:1}),far=entry('far',{name:'Дальний',value:3});
 const c=hero([a,...junk(120),entry('a',{value:9}),...junk(100),far]),before=JSON.stringify(c);
 assert.deepEqual(plain(N.list(c)).map(m=>m.id),['a']);assert.equal(E.checkModifier(c),1);
 const r=N.reset(c,'ru');
 assert.equal(r.ok,true);assert.equal(r.message,'Нечитаемые записи убраны.');
 assert.equal(c.extra.namedModifiers.list.length,2);assert.equal(c.extra.namedModifiers.list[0],a);assert.equal(c.extra.namedModifiers.list[1],far);
 assert.equal(E.checkModifier(c),4);assert.equal(N.add(c,{name:'n',value:1,scope:'all'},'ru').ok,true,'there is room again');
 assert.equal(N.unreset(c,r.undo,'ru').ok,false,'changed since');
 const d=JSON.parse(before),r2=N.reset(d,'en');assert.equal(N.unreset(d,r2.undo,'en').ok,true);assert.equal(JSON.stringify(d),before);
 // full of readable modifiers is «24 already», as before, and is not «clogged»
 const full=hero([...Array.from({length:24},(_,i)=>entry('m'+i)),...junk(200)]);
 assert.equal(N.add(full,{name:'n',value:1,scope:'all'},'ru').message,N.t('ru','full'));assert.equal(N.reset(full,'ru').ok,false);
});

test('two rows with one id: deleting the shown one does not wake the hidden one, and «Вернуть» brings both back',()=>{
 const {N,E}=load();
 const c=hero([entry('z',{name:'Первый'}),entry('a',{value:1}),{junk:1},entry('a',{name:'Hidden twin',value:5}),entry('b',{value:2}),entry('a',{value:99}),entry('a',{value:7})]),before=JSON.stringify(c);
 assert.equal(E.checkModifier(c),4);
 const r=N.remove(c,'a','en');
 assert.equal(r.ok,true);assert.deepEqual(plain(N.active(c)).map(m=>m.id),['z','b'],'the twin did not become a live modifier');assert.equal(E.checkModifier(c),3);
 assert.deepEqual(plain(c.extra.namedModifiers.list),[entry('z',{name:'Первый'}),{junk:1},entry('b',{value:2})]);
 const back=N.restore(c,r.undo,'en');
 assert.equal(back.ok,true);assert.equal(back.message,'Modifier “Smartgun” is back.');assert.equal(JSON.stringify(c),before,'every row is where it was');assert.equal(E.checkModifier(c),4);
 assert.equal(N.restore(c,r.undo,'en').ok,false,'not twice');
 // a row that cannot be read and carries the same id does not shut the way back either
 const odd=hero([{id:'a',name:'',value:1,on:true,scope:'all'},entry('a')]),gone=N.remove(odd,'a','ru');
 assert.equal(odd.extra.namedModifiers.list.length,1);assert.equal(N.restore(odd,gone.undo,'ru').ok,true);assert.deepEqual(plain(N.list(odd)).map(m=>[m.id,m.index]),[['a',1]]);
 // an undo made up by someone else gets nothing extra in
 const plainSheet=hero([entry('k')]),got=N.restore(plainSheet,{index:0,entry:entry('n'),twins:[{index:1,entry:entry('other')},{index:1,entry:'x'},{index:0,entry:entry('n')},null]},'ru');
 assert.equal(got.ok,true);assert.deepEqual(plain(plainSheet.extra.namedModifiers.list).map(m=>m.id),['n','k']);
});

test('the value is read as typed: the app\'s own minus is a minus, and what is not a whole number is refused',()=>{
 const {N}=load();
 assert.deepEqual(['−2','-2','–3','—4','+1','2',' 20 ','-20','007'].map(N.parseValue),[-2,-2,-3,-4,1,2,20,-20,7]);
 for(const bad of ['','1,5','1.5','2e1','0x10','--2','−−2','2-','+','−','abc','1 2','1234',null,undefined,NaN])assert.ok(Number.isNaN(N.parseValue(bad)),String(bad));
 const c=hero([]);
 for(const [typed,ok] of [['−2',true],['1,5',false],['0',false],['21',false],['−20',true]])assert.equal(N.add(c,{name:'T',value:N.parseValue(typed),scope:'all'},'ru').ok,ok,typed);
 assert.deepEqual(plain(N.list(c)).map(m=>m.value),[-2,-20]);
 // a number field drops «−» before the code sees it, so the field is a text field
 const html=N.bar(hero([]),'ru');
 assert.match(html,/<input type="text" maxlength="6"[^>]*data-nm-field="value"/);assert.doesNotMatch(html,/type="number"/);assert.doesNotMatch(html,/inputmode/);
 assert.match(read('named-modifiers.js'),/value:parseValue\(d\.value\)/);
});

test('every entry is rebuilt from the known fields; one that fails a rule is skipped and left in storage',()=>{
 const {N,E}=load();
 const bad=[null,7,'x',[],{},entry(''),entry('has space'),entry('x'.repeat(41)),entry(5),entry('n1',{name:''}),entry('n2',{name:'   \u0000 '}),entry('n3',{name:9}),
  entry('v1',{value:0}),entry('v2',{value:21}),entry('v3',{value:-21}),entry('v4',{value:1.5}),entry('v5',{value:'1'}),entry('v6',{value:NaN}),
  entry('o1',{on:1}),entry('o2',{on:'true'}),entry('s1',{scope:'everything'}),entry('s2',{scope:'stat',key:'LUCK'}),entry('s3',{scope:'stat'}),
  entry('k1',{scope:'skill',key:'constructor'}),entry('k2',{scope:'skill',key:'__proto__'}),entry('k3',{scope:'skill',key:'x'.repeat(61)}),entry('k4',{scope:'skill',key:'No Such Skill'}),entry('k5',{scope:'skill'}),
  entry('i1',{itemId:''}),entry('i2',{itemId:7}),entry('i3',{itemId:'x'.repeat(161)})];
 const c=hero([...bad,entry('good',{name:'  Умное\n оружие\u202e ',junk:{deep:1}})]),before=plain(c.extra.namedModifiers.list);
 const view=plain(N.list(c));
 assert.deepEqual(view,[{id:'good',name:'Умное оружие',value:1,on:true,scope:'all',key:'',itemId:'',index:bad.length}]);
 assert.equal(E.checkModifier(c),1);
 assert.equal(N.toggle(c,'good','ru').ok,true);assert.equal(E.checkModifier(c),0);
 const after=plain(c.extra.namedModifiers.list);before[bad.length].on=false;
 assert.deepEqual(after,before,'the unreadable neighbours and the unknown field are still there');
 for(const id of ['n1','v1','k1','s1'])assert.equal(N.toggle(c,id,'ru').ok,false,'an entry that is not read cannot be changed either');
});

test('names: trimmed, control and direction characters out, single spaces, 32 characters, never half of a pair',()=>{
 const {N}=load();
 assert.equal(N.cleanName('  a \t\n b\u200b\u2028c  '),'a b c');assert.equal(N.cleanName(null),'');assert.equal(N.cleanName('\u202e\u2066'),'');
 const long='я'.repeat(31)+'😀😀';assert.equal(N.cleanName(long),'я'.repeat(31));
 assert.equal(N.cleanName('x'.repeat(40)).length,32);
 const c=hero();assert.equal(N.add(c,{name:' <b>Тест</b>  1 ',value:2,scope:'all'},'ru').ok,true);
 assert.equal(c.extra.namedModifiers.list[0].name,'<b>Тест</b> 1');
});

test('a Skill key no object has by birth; with the Skill table loaded only a Skill of the table or of the sheet',()=>{
 const withTable=load().N,bare=load({labels:null}).N;
 const c=hero([entry('a',{scope:'skill',key:'Handgun'}),entry('b',{scope:'skill',key:'Homebrew'}),entry('c',{scope:'skill',key:'toString'})]);
 assert.deepEqual(plain(withTable.list(c)).map(m=>m.id),['a']);
 assert.deepEqual(plain(bare.list(c)).map(m=>m.id),['a','b'],'without the table any plain key is taken, a built-in name never');
 c.skills.Homebrew=2;assert.deepEqual(plain(withTable.list(c)).map(m=>m.id),['a','b']);
});

test('at most 24 count; the 25th is refused in both languages; of two entries with one id the first wins',()=>{
 const {N,E}=load(),c=hero();
 for(let i=0;i<24;i++)assert.equal(N.add(c,{name:'M'+i,value:1,scope:'all'},'ru').ok,true);
 assert.equal(new Set(c.extra.namedModifiers.list.map(m=>m.id)).size,24);
 const ru=N.add(c,{name:'Лишний',value:1,scope:'all'},'ru'),en=N.add(c,{name:'Extra',value:1,scope:'all'},'en');
 assert.deepEqual([ru.ok,en.ok],[false,false]);assert.match(ru.message,/уже 24 модификатора/);assert.match(en.message,/already has 24 modifiers/);
 assert.equal(c.extra.namedModifiers.list.length,24);assert.equal(E.checkModifier(c),24);
 const many=hero(Array.from({length:40},(_,i)=>entry('m'+i)));assert.equal(N.list(many).length,24);assert.equal(E.checkModifier(many),24);
 const twins=hero([entry('same',{value:2}),entry('same',{value:5})]);assert.deepEqual(plain(N.list(twins)).map(m=>m.value),[2]);assert.equal(E.checkModifier(twins),2);
});

test('add, change, switch, delete and put back',()=>{
 const {N,E}=load(),c={id:'v1',skills:{}};
 for(const [draft,key] of [[{name:'',value:1,scope:'all'},'errName'],[{name:'A',value:0,scope:'all'},'errValue'],[{name:'A',value:NaN,scope:'all'},'errValue'],[{name:'A',value:21,scope:'all'},'errValue'],[{name:'A',value:1.5,scope:'all'},'errValue'],
  [{name:'A',value:1,scope:'nope'},'errWhen'],[{name:'A',value:1,scope:'stat',key:'LUCK'},'errWhen'],[{name:'A',value:1,scope:'skill',key:'constructor'},'errWhen'],[{name:'A',value:1,scope:'all',itemId:'gone'},'errItem']]){
  const r=N.add(c,draft,'ru');assert.equal(r.ok,false);assert.equal(r.message,N.t('ru',key));
 }
 assert.equal(c.extra,undefined,'a refused modifier creates nothing');
 const a=N.add(c,{name:'Smartgun',value:1,scope:'ranged'},'en');
 assert.equal(a.ok,true);assert.match(a.message,/“Smartgun” added/);assert.match(a.id,/^[A-Za-z0-9_-]{1,40}$/);
 assert.deepEqual(plain(c.extra.namedModifiers),{version:1,list:[{id:a.id,name:'Smartgun',value:1,on:true,scope:'ranged'}]},'the record appears with the first modifier, with the known fields only');
 const b=N.add(c,{name:'Темнота',value:-2,scope:'skill',key:'Stealth'},'ru');assert.equal(b.ok,true);
 c.extra.namedModifiers.list[0].keepMe=1;
 const u=N.update(c,a.id,{name:'Smartgun II',value:2,scope:'stat',key:'REF'},'ru');
 assert.equal(u.ok,true);assert.deepEqual(plain(c.extra.namedModifiers.list[0]),{id:a.id,name:'Smartgun II',value:2,on:true,scope:'stat',key:'REF',keepMe:1});
 assert.equal(N.update(c,a.id,{name:'x',value:2,scope:'all'},'ru').ok,true);assert.equal('key' in c.extra.namedModifiers.list[0],false,'a scope without a key drops the old key');
 assert.equal(N.update(c,a.id,{name:'',value:2,scope:'all'},'ru').ok,false);assert.equal(c.extra.namedModifiers.list[0].name,'x');
 for(const r of [N.update(c,'nope',{name:'x',value:1,scope:'all'},'ru'),N.toggle(c,'nope','ru'),N.remove(c,'nope','ru'),N.detach(c,'nope','ru')]){assert.equal(r.ok,false);assert.equal(r.message,N.t('ru','stale'))}
 assert.deepEqual([N.toggle(c,a.id).on,N.toggle(c,a.id).on],[false,true]);
 const gone=N.remove(c,a.id,'ru');
 assert.equal(gone.ok,true);assert.match(gone.message,/Модификатор «x» удалён\./);assert.deepEqual([...c.extra.namedModifiers.list.map(m=>m.id)],[b.id]);
 assert.equal(gone.undo.characterId,'v1');assert.equal(gone.undo.index,0);
 const back=N.restore(c,gone.undo,'ru');
 assert.equal(back.ok,true);assert.deepEqual([...c.extra.namedModifiers.list.map(m=>m.id)],[a.id,b.id],'back in its old place');assert.equal(c.extra.namedModifiers.list[0].keepMe,1);
 assert.equal(N.restore(c,gone.undo,'ru').ok,false,'not twice');
 const full=hero(Array.from({length:24},(_,i)=>entry('m'+i)));assert.equal(N.restore(full,{index:0,entry:entry('new')},'ru').message,N.t('ru','full'));
 assert.equal(N.restore(hero([]),{index:0,entry:entry('bad',{value:99})},'ru').ok,false,'what comes back is checked like everything else');
 const fresh={id:'x'};assert.equal(N.restore(fresh,{index:5,entry:entry('new')},'ru').ok,true);assert.equal(E.checkModifier(fresh),1);
});

test('each kind of modifier counts for its own checks only, and several add up',()=>{
 const {N,E}=load();
 const one=m=>hero([entry('a',m)]);
 const all=one({value:2});for(const args of [[],['ranged'],['melee','Brawling','DEX'],['','Stealth','DEX']])assert.equal(E.checkModifier(all,...args),2);
 const ranged=one({scope:'ranged'});assert.deepEqual([E.checkModifier(ranged,'ranged','Handgun','REF'),E.checkModifier(ranged,'melee'),E.checkModifier(ranged,'','Handgun','REF')],[1,0,0]);
 const melee=one({scope:'melee',value:-3});assert.deepEqual([E.checkModifier(melee,'melee'),E.checkModifier(melee,'ranged'),E.checkModifier(melee)],[-3,0,0]);
 const skill=one({scope:'skill',key:'Stealth',value:-2});assert.deepEqual([E.checkModifier(skill,'','Stealth','DEX'),E.checkModifier(skill,'','Handgun','REF'),E.checkModifier(skill)],[-2,0,0]);
 const stat=one({scope:'stat',key:'REF',value:3});assert.deepEqual([E.checkModifier(stat,'ranged','Handgun','REF'),E.checkModifier(stat,'','Stealth','DEX'),E.checkModifier(stat)],[3,0,0]);
 assert.equal(E.checkModifier(one({on:false})),0,'switched off adds nothing');
 // on top of an injury (−2 to everything) and an implant's Skill bonus (+2 First Aid)
 const c=hero([entry('a',{value:1}),entry('b',{scope:'skill',key:'First Aid',value:3}),entry('c',{scope:'skill',key:'First Aid',value:-1}),entry('d',{scope:'ranged',value:4})],
  {criticalInjuries:{version:1,entries:[{id:'i',location:'head',score:5,status:'active'}]},equipment:{installs:[{catalogId:'cyberware-medscanner-implant'}]}});
 assert.equal(E.checkModifier(c,'','First Aid','TECH'),-2+2+1+3-1);assert.equal(E.checkModifier(c,'ranged','Handgun','REF'),-2+1+4);
 assert.equal(E.collect(c).sources.filter(s=>s.kind==='named').length,4);
 assert.equal(N.contribute(c,null),undefined);assert.equal(N.contribute(c,{sources:'x'}),undefined,'a sum of another shape is left alone');
});

test('a modifier to checks with a STAT is not a change of the STAT: Initiative, MOVE and Death Saves do not move',()=>{
 const {E}=load(),c=hero([entry('a',{scope:'stat',key:'REF',value:5}),entry('b',{scope:'stat',key:'REF',value:-2}),entry('c',{scope:'stat',key:'BODY',value:1})]),t=E.collect(c);
 assert.deepEqual(plain(t.stats),{});assert.deepEqual(plain(t.checkStats),{REF:3,BODY:1});
 assert.equal(E.initiative(c),0);assert.equal(E.move(c,6),6);assert.equal(t.death,0);assert.equal(t.move,0);
 assert.equal('checkStats' in E.collect(hero([entry('a')])),false,'the extra key appears only with such a modifier');
});

test('tied to a thing: counts while the thing is on the sheet, sleeps without it, wakes when it is back',()=>{
 const {N,E}=load(),c=hero([],{items:[{id:'it1',name:'Очки',quantity:1}],weapons:[{id:'w1',name:'Пистолет'}]});
 const a=N.add(c,{name:'Очки',value:2,scope:'all',itemId:'it1'},'ru'),b=N.add(c,{name:'Smartgun',value:1,scope:'ranged',itemId:'w1'},'ru');
 assert.deepEqual([a.ok,b.ok],[true,true]);assert.equal(c.extra.namedModifiers.list[0].itemId,'it1');
 assert.deepEqual([N.owned(c,'it1'),N.owned(c,'w1'),N.owned(c,'nope'),N.owned(c,''),N.owned(null,'it1')],[true,true,false,false,false]);
 assert.equal(E.checkModifier(c,'ranged'),3);assert.equal(N.itemName(c,'it1','ru'),'Очки');
 c.extra.items[0].quantity=0;assert.equal(E.checkModifier(c,'ranged'),1,'none left: asleep');assert.equal(N.list(c).length,2,'but kept');
 c.extra.items[0].quantity=3;assert.equal(E.checkModifier(c,'ranged'),3);
 const [item]=c.extra.items.splice(0,1),[weapon]=c.extra.weapons.splice(0,1);
 assert.equal(E.checkModifier(c,'ranged'),0);assert.deepEqual(plain(N.active(c)),[]);assert.equal(c.extra.namedModifiers.list.length,2,'nothing is deleted with the thing');
 assert.match(N.bar(c,'ru'),/nm-asleep/);assert.match(N.bar(c,'ru'),/вещи нет/);assert.match(N.bar(c,'ru'),/data-nm-op="detach"/);
 c.extra.items.push(item);c.extra.weapons.push(weapon);assert.equal(E.checkModifier(c,'ranged'),3,'the same record back: awake');
 c.extra.items.length=0;
 assert.equal(N.update(c,a.id,{name:'Очки',value:3,scope:'all',itemId:'it1'},'ru').ok,true,'a link to a thing that is gone may stay as it was');
 assert.equal(N.update(c,b.id,{name:'Smartgun',value:1,scope:'ranged',itemId:'it1'},'ru').message,N.t('ru','errItem'),'a new link has to lead to a thing on the sheet');
 const d=N.detach(c,a.id,'ru');assert.equal(d.ok,true);assert.equal('itemId' in c.extra.namedModifiers.list[0],false);assert.equal(E.checkModifier(c),3,'untied: counts always');
 delete c.extra.items;delete c.extra.weapons;assert.equal(N.owned(c,'w1'),false);
});

test('what the roll text names is exactly what the number has: forCheck mirrors Effects.checkModifier',()=>{
 const {N,E}=load();
 const mods=[entry('a',{value:1}),entry('b',{scope:'ranged',value:2}),entry('c',{scope:'melee',value:-3}),entry('d',{scope:'skill',key:'Handgun',value:4}),entry('e',{scope:'skill',key:'Stealth',value:-5}),
  entry('f',{scope:'stat',key:'REF',value:6}),entry('g',{scope:'stat',key:'DEX',value:-7}),entry('h',{value:8,on:false}),entry('i',{value:9,itemId:'gone'}),entry('j',{scope:'ranged',value:10,itemId:'w1'})];
 const injury={criticalInjuries:{version:1,entries:[{id:'i',location:'head',score:3,status:'active'}]}};
 for(const extra of [{},injury,{weapons:[{id:'w1'}]},{...injury,weapons:[{id:'w1'}]}]){
  const c=hero(mods,extra),bare=plain(c);delete bare.extra.namedModifiers;
  for(const kind of ['','ranged','melee','nonsense'])for(const skill of ['','Handgun','Stealth','Brawling',undefined])for(const stat of ['','REF','DEX','BODY',undefined]){
   const parts=N.forCheck(c,{kind,skill,stat});
   assert.equal(sum(parts),E.checkModifier(c,kind,skill,stat)-E.checkModifier(bare,kind,skill,stat),`${kind}/${skill}/${stat}`);
   for(const p of parts)assert.deepEqual(Object.keys(p),['name','value']);
  }
 }
 assert.deepEqual(plain(N.forCheck(hero([entry('a')]))),[{name:'Smartgun',value:1}]);assert.deepEqual(plain(N.forCheck(null,null)),[]);
});

test('the tail of a roll label: a real minus, three names at most, the rest as one sum',()=>{
 const {N}=load(),p=(name,value)=>({name,value});
 assert.equal(N.tail([],'ru'),'');assert.equal(N.tail(null,'ru'),'');assert.equal(N.tail([p('x',0),{name:5,value:1},null],'ru'),'');
 assert.equal(N.tail([p('Smartgun',1),p('Темнота',-2)],'ru'),' · Smartgun +1 · Темнота −2');
 assert.equal(N.tail([p('a',1),p('b',1),p('c',1),p('d',2),p('e',-5)],'ru'),' · a +1 · b +1 · c +1 · ещё модификаторы −3');
 assert.equal(N.tail([p('a',1),p('b',1),p('c',1),p('d',2)],'en'),' · a +1 · b +1 · c +1 · more modifiers +2');
 assert.equal(N.tail([p('a',1),p('b',1),p('c',1),p('d',2),p('e',-2)],'en'),' · a +1 · b +1 · c +1 · more modifiers 0');
 const long=N.tail([p('я'.repeat(32),1)],'ru');assert.ok(long.length<=28,'a long name is cut so the label still fits a room message');assert.match(long,/… \+1$/);
});

test('the sheet lists each one by name, and the tools (medicine, repairs, NET) do too',()=>{
 const {E,TE}=load({tools:true});
 const c=hero([entry('a',{name:'Умное оружие',scope:'ranged'}),entry('b',{name:'Темнота',value:-2}),entry('c',{name:'Набор',scope:'skill',key:'First Aid',value:1}),entry('d',{name:'Допинг',scope:'stat',key:'REF',value:-2}),entry('e',{name:'Кастет',scope:'melee',value:1})]);
 assert.deepEqual(plain(E.lines(c,'ru')),[{name:'Умное оружие',text:'+1 к дальним атакам'},{name:'Темнота',text:'−2 ко всем проверкам'},{name:'Набор',text:'+1 к навыкам: Первая помощь'},{name:'Допинг',text:'−2 к проверкам REF'},{name:'Кастет',text:'+1 к атакам ближнего боя'}]);
 assert.deepEqual(plain(E.lines(c,'en')).map(l=>l.text),['+1 to ranged attacks','−2 to all checks','+1 to Skills: First Aid','−2 to checks with REF','+1 to melee attacks']);
 // one phrase for one thing: the list of the sheet says what the editor and the switch say; an injury keeps the wording of the injuries
 assert.equal(load().N.T.ru.tagAll,'все проверки');
 const hurt=hero([entry('b',{name:'Темнота',value:-2})],{criticalInjuries:{version:1,entries:[{id:'i',location:'head',score:5,status:'active'}]}});
 assert.deepEqual(plain(E.lines(hurt,'ru')).map(l=>l.text),['−2 ко всем действиям','−2 ко всем проверкам']);assert.deepEqual(plain(E.lines(hurt,'en')).map(l=>l.text),['−2 to all Actions','−2 to all checks']);
 // the label a tool gives its roll names them too; «эффекты» is only what is left
 assert.equal(TE.use(c,{kind:'ranged',stat:'REF'},'ru').label,' · Умное оружие +1 · Темнота −2 · Допинг −2');
 assert.equal(TE.label(c,{skill:'First Aid',stat:'TECH'},'en'),' · Темнота −2 · Набор +1');
 assert.equal(TE.use(hurt,{skill:'First Aid'},'ru').label,' · эффекты −2 · Темнота −2');assert.equal(TE.label(hurt,{},'en'),' · effects −2 · Темнота −2');
 const even=hero([entry('up',{name:'Прицел',value:2})],{criticalInjuries:hurt.extra.criticalInjuries});
 assert.equal(TE.use(even,{},'ru').mod,0);assert.equal(TE.use(even,{},'ru').label,' · эффекты −2 · Прицел +2','a bonus that evens out an injury is still said');
 const one=hero([entry('a')]);assert.equal(TE.use(one,{},'ru').label,' · Smartgun +1');assert.doesNotMatch(TE.use(one,{},'ru').label,/эффекты/);
 for(const lang of ['ru','en'])for(const o of [{},{kind:'ranged',skill:'Handgun',stat:'REF'}]){assert.equal(TE.use(hero([]),o,lang).label,'');assert.equal(TE.label(null,o,lang),'')}
 for(const opts of [{skill:'First Aid',stat:'TECH'},{kind:'ranged',skill:'Handgun',stat:'REF'},{kind:'melee'},{}]){
  const d=TE.detail(c,opts);
  assert.equal(d.mod,E.checkModifier(c,opts.kind,opts.skill,opts.stat));assert.equal(sum(d.parts),d.mod);
  assert.equal(d.parts.some(p=>p.name.ru==='Прочие эффекты'),false,'nothing is left over as «other»');assert.deepEqual(plain(d.reminders),[]);
 }
 assert.deepEqual(plain(TE.detail(c,{skill:'First Aid',stat:'TECH'}).parts),[{name:{ru:'Темнота',en:'Темнота'},value:-2},{name:{ru:'Набор',en:'Набор'},value:1}]);
 assert.match(TE.use(c,{kind:'ranged',stat:'REF'},'ru').line,/Эффекты листа: −3 \(Умное оружие \+1; Темнота −2; Допинг −2\)/);
});

test('the bar: a switch per modifier, everything a player typed escaped, keys the sheet can give the focus back by',()=>{
 const {N}=load();
 const evil='<img src=x onerror=1>"\'&',c=hero([entry('a',{name:evil}),entry('b',{name:'Темнота',value:-2,on:false,scope:'skill',key:'Stealth'}),entry('c',{scope:'stat',key:'REF',itemId:'w"1'}),entry('d',{scope:'ranged',itemId:'gone'})],
  {weapons:[{id:'w"1',name:'<b>Gun</b>'},{name:'no id'}],items:[{id:'it1',name:'Очки',quantity:2},{id:'',name:'old'},null]});
 N._test.reset();
 const html=N.bar(c,'ru');
 assert.doesNotMatch(html,/<img|<b>Gun|onerror=1>"/);assert.match(html,/&lt;img src=x onerror=1&gt;&quot;&#39;&amp;/);
 const chips=html.match(/<button type="button" class="nm-chip[^>]*>/g);
 assert.equal(chips.length,4);
 for(const b of chips){assert.match(b,/role="switch"/);assert.match(b,/aria-checked="(true|false)"/);assert.match(b,/data-nm-op="toggle"/);assert.match(b,/aria-label="[^"]+"/)}
 assert.match(chips[1],/aria-checked="false"/);assert.match(chips[1],/aria-label="Темнота, −2, Скрытность"/);
 assert.match(chips[2],/aria-label="Smartgun, \+1, REF, пока есть: &lt;b&gt;Gun&lt;\/b&gt;"/);
 assert.match(chips[3],/nm-asleep/);assert.match(chips[3],/дальние атаки, вещи нет/);
 for(const m of html.matchAll(/data-keep="([^"]*)"/g))assert.match(m[1],/^[\w-]+$/);
 assert.equal(new Set([...html.matchAll(/data-keep="([^"]*)"/g)].map(m=>m[1])).size,[...html.matchAll(/data-keep="/g)].length,'every key is its own');
 assert.match(html,/^<div class="nm-bar" data-nm-root role="group" aria-label="Свои модификаторы">/);
 assert.match(html,/<details class="nm-edit" data-nm-edit><summary[^>]*>Настроить модификаторы<\/summary>/);
 // the form: every control inside a label, the Skills by their names, only things that have an id
 assert.equal((html.match(/<label class="nm-field/g)||[]).length,4);
 assert.match(html,/<option value="skill:Stealth">Скрытность<\/option>/);assert.match(html,/<option value="stat:REF">REF<\/option>/);
 assert.match(html,/<optgroup label="Оружие"><option value="w&quot;1">&lt;b&gt;Gun&lt;\/b&gt;<\/option><\/optgroup><optgroup label="Вещи"><option value="it1">Очки ×2<\/option><\/optgroup>/);
 assert.doesNotMatch(html,/no id|>old</);
 assert.match(N.bar(c,'en'),/Set up modifiers/);assert.match(N.bar(c,'en'),/thing missing/);
 // an unused sheet gets one folded line and no switches
 const empty=N.bar(hero(),'ru');assert.doesNotMatch(empty,/nm-chip/);assert.match(empty,/<summary[^>]*>\+ Свой модификатор<\/summary>/);
 assert.equal(N.bar(null,'ru'),'');
 // what is open and what is typed is remembered across redraws, per character
 N._test.open(true);N._test.draft(c,{name:'<i>черновик',value:'-3',when:'skill:Stealth',item:'it1'});
 const again=N.bar(c,'ru');
 assert.match(again,/data-nm-edit open>/);assert.match(again,/value="&lt;i&gt;черновик"/);assert.match(again,/value="-3"/);assert.match(again,/<option value="skill:Stealth" selected>/);assert.match(again,/<option value="it1" selected>/);
 assert.doesNotMatch(N.bar({...hero(),id:'other'},'ru'),/черновик/);
 // a draft that edits a modifier which is gone falls back to a new one
 N._test.draft(c,{id:'nope',name:'x'});assert.match(N.bar(c,'ru'),/Новый модификатор/);assert.equal(N._test.draft(c).id,'');
 N._test.draft(c,{id:'b',name:'Темнота'});assert.match(N.bar(c,'ru'),/Изменение: Темнота/);assert.match(N.bar(c,'ru'),/data-nm-op="cancel"/);
 N._test.reset();
});

test('an inventory card names what is tied to the thing, to read only',()=>{
 const {N,window}=load(),c=hero([entry('a',{name:'<i>Очки',value:2,itemId:'it1'}),entry('b',{on:false,itemId:'it1'}),entry('c',{itemId:'w1'})],{items:[{id:'it1',quantity:1}]});
 assert.equal(N.itemChips(c,{id:'it1'},'ru'),'<span class="nm-item-chip">Модификатор: &lt;i&gt;Очки +2 (включён)</span><span class="nm-item-chip nm-off">Модификатор: Smartgun +1 (выключен)</span>');
 assert.match(N.itemChips(c,{id:'w1'},'en'),/^<span class="nm-item-chip">Modifier: Smartgun \+1 \(on\)<\/span>$/);
 for(const rec of [{id:'other'},{},null,{id:7}])assert.equal(N.itemChips(c,rec,'ru'),'');
 // the cards themselves: unchanged without the module, one more line with it
 const cards=(withModule)=>{const w={};if(withModule)w.NamedModifiers=N;vm.runInNewContext(read('inventory-cards.js'),{window:w});return w.InventoryCards};
 const rec={id:'it1',name:'Своя вещь'},w={id:'w1',name:'Пистолет',damage:'2d6',rof:2};
 assert.equal(cards(false).quick(c,rec,'ru'),'');
 assert.equal(cards(true).quick(c,rec,'ru'),'<div class="inv-quick">'+N.itemChips(c,rec,'ru')+'</div>');
 assert.equal(cards(true).quick(c,{id:'zz',name:'x'},'ru'),'');
 const without=cards(false).weaponRow(c,w,'ru','Пистолет'),withIt=cards(true).weaponRow(c,w,'ru','Пистолет');
 assert.doesNotMatch(without,/nm-item-chip/);assert.equal(withIt.replace(N.itemChips(c,w,'ru'),''),without);assert.match(withIt,/<\/span><span class="nm-item-chip">/);
 assert.equal(window.InventoryCards,undefined);
});

test('both languages have the same strings; Russian speaks formally; the module stands alone',()=>{
 const {N}=load({effects:false,labels:null});
 assert.deepEqual(Object.keys(N.T.ru).sort(),Object.keys(N.T.en).sort());
 for(const [k,v] of Object.entries(N.T.ru)){assert.ok(v&&typeof v==='string',k);assert.doesNotMatch(v,/(^|[^А-Яа-яЁё])(ты|тебя|тебе|твой|твои|введи|выбери|удали|попробуй|задавай)([^А-Яа-яЁё]|$)/i,k)}
 for(const v of Object.values(N.T.en))assert.ok(v&&typeof v==='string');
 assert.match(N.T.ru.help,/пока вы их не выключите/);
 assert.deepEqual([...N.SCOPES],['all','ranged','melee','stat','skill']);assert.deepEqual(plain(N.LIMITS),{max:24,name:32,value:20});
 const c=hero([entry('a')]);assert.equal(N.active(c).length,1);assert.match(N.bar(c,'en'),/role="switch"/);
 const css=read('named-modifiers.css');
 for(const cls of ['.nm-bar','.nm-chip','.nm-asleep','.nm-edit','.nm-form','.nm-row','.nm-item-chip'])assert.ok(css.includes(cls),cls);
 assert.match(css,/\.nm-chip \{[^}]*min-height: 44px/);
 // the parts of a switch wrap as whole pieces and the tag may shrink: rigid on one line, a long tag squeezed a long name into a column a few letters wide
 assert.match(css,/\.nm-chip \{[^}]*flex-wrap: wrap/);assert.doesNotMatch(css,/\.nm-chip::before/,'the dot belongs to the name, so it is never left alone on a line');
 assert.match(css,/\.nm-chip small \{ flex: 0 1 auto; min-width: 0;/);assert.doesNotMatch(css,/\.nm-chip small \{[^}]*flex: none/);assert.match(css,/\.nm-btn\.cx-button \{[^}]*min-height: 44px/);assert.match(css,/overflow-wrap: anywhere/);
 for(const f of ['named-modifiers.js','named-modifiers.css'])assert.equal(read(f).includes('\r'),false,f+' keeps LF line endings');
 assert.doesNotMatch(read('named-modifiers.js'),/[\u200b-\u200f\u2028-\u202e\u2066-\u2069\ufeff]/,'no invisible characters in the source');
});
