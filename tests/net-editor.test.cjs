const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),test=require('node:test'),assert=require('node:assert/strict');
// NetTools and NetEditor in one context, as on the page. Rolls is a stub that records what would reach the shared feed.
let uidN=0;const rolls=[];
const ctx={window:{confirm:()=>true,Rolls:{check:(label,r,l)=>rolls.push({label,r,l})}},crypto:{randomUUID:()=>'u'+(++uidN)},Math:Object.create(Math)};vm.createContext(ctx);
for(const f of ['net-tools.js','net-editor.js'])vm.runInContext(fs.readFileSync(path.join(__dirname,'../site',f),'utf8'),ctx);
const N=ctx.window.NetTools,E=ctx.window.NetEditor;
const entry=(id,type,more={})=>({id,type,name:'',dv:8,state:type==='ice'?'waiting':'closed',preset:'',rez:0,maxRez:0,per:0,spd:0,atk:0,def:0,notes:'',...more});
const floor=(id,label,parent,entries=[])=>({id,label:String(label),branch:'',entries,...(parent===undefined?{}:{parent})});
const arch=(floors,more={})=>({id:'a1',name:'Vault',access:'',notes:'',rank:4,modifier:0,dv:8,remaining:3,current:'1',floors,...more});
const legacy=()=>arch([floor('f1',1),floor('f2',2),floor('f3',3)]);
// f1 → f2 → (f3 → f5, f4)
const branched=()=>arch([floor('f1',1,''),floor('f2',2,'f1'),floor('f3',3,'f2'),floor('f5',4,'f3'),floor('f4',3,'f2')]);
const shape=a=>{const t=E.tree(a);return t.list.map(n=>`${n.floor.id}@${n.depth}${n.parent?'<'+n.parent.floor.id:''}`).join(' ')};
const ids=a=>a.floors.map(f=>f.id).join(',');
const btn=(data={},disabled=false)=>({dataset:data,getAttribute:k=>k==='aria-disabled'&&disabled?'true':null});
const plain=x=>JSON.parse(JSON.stringify(x));

test('tree: floors saved before the feature form one chain in array order, and reading changes nothing',()=>{
 const a=legacy(),before=JSON.stringify(a),t=E.tree(a);
 assert.equal(shape(a),'f1@1 f2@2<f1 f3@3<f2');assert.equal(t.roots.length,1);assert.deepEqual([...t.list.map(n=>n.index)],[0,1,2]);
 assert.equal(JSON.stringify(a),before);assert.equal(E.tree({}).list.length,0);assert.equal(E.tree(null).list.length,0);
});
test('tree: explicit parents make branches, children follow array order, the order is top-down',()=>{
 const a=branched(),t=E.tree(a);
 assert.equal(shape(a),'f1@1 f2@2<f1 f3@3<f2 f5@4<f3 f4@3<f2');assert.deepEqual([...t.nodes.get('f2').children.map(n=>n.floor.id)],['f3','f4']);
 assert.deepEqual([...t.order.map(f=>f.id)],['f1','f2','f3','f5','f4']);assert.equal(t.nodes.get('f4').index,4);
});
test('tree: broken parents never throw or loop and every floor appears once',()=>{
 const cases=[
  [floor('a',1,''),floor('b',2,'nope'),floor('c',3,'c')],
  [floor('a',1,'b'),floor('b',2,'a')],
  [floor('a',1,'c'),floor('b',2,'a'),floor('c',3,'b')],
  [floor('a',1,''),floor('b',2),floor('c',3,'a'),floor('d',4)],
  [floor('a',1,''),floor('b',2,''),floor('c',3,'b')],
  [floor('a',1,7),floor('b',2,'')]
 ];
 for(const floors of cases){const a=arch(floors),t=E.tree(a);assert.equal(t.list.length,floors.length);assert.equal(new Set(t.order).size,floors.length);for(const n of t.list){let hops=0;for(let x=n;x;x=x.parent)assert.ok(++hops<=floors.length,'a loop')}}
 assert.equal(shape(arch(cases[0])),'a@1 b@2<a c@3<b');
 assert.equal(shape(arch(cases[3])),'a@1 b@2<a c@2<a d@3<c','a floor without a parent hangs under the floor before it in the array');
 assert.equal(E.tree(arch(cases[4])).roots.length,2);
});
test('materialize: writes a parent on every floor, keeps objects and array, and is stable',()=>{
 const a=legacy(),floors=a.floors,objs=[...floors];E.materialize(a);
 assert.deepEqual(a.floors.map(f=>f.parent),['','f1','f2']);assert.equal(a.floors,floors);assert.ok(a.floors.every((f,i)=>f===objs[i]));
 const once=JSON.stringify(a);E.materialize(a);assert.equal(JSON.stringify(a),once);assert.equal(N.validArchitectures([a]),true);
});
test('addChild: the new floor is numbered one deeper, a second one starts a branch, 100 floors is the limit',()=>{
 const a=legacy(),floors=a.floors;
 assert.equal(E.addChild(a,'f3'),true);assert.equal(a.floors.length,4);assert.equal(a.floors[3].label,'4');assert.equal(a.floors[3].parent,'f3');
 assert.equal(E.addChild(a,'f1'),true);assert.equal(a.floors,floors);
 const added=a.floors.at(-1);assert.equal(added.label,'2');assert.equal(E.tree(a).nodes.get('f1').children.length,2);
 assert.deepEqual(ids(a),E.tree(a).order.map(f=>f.id).join(),'the array stays top-down');
 assert.equal(E.addChild(a,'missing'),false);
 const full=arch(Array.from({length:100},(_,i)=>floor('x'+i,i+1))),before=JSON.stringify(full);assert.equal(E.addChild(full,'x5'),false);assert.equal(JSON.stringify(full),before);
});
test('swapUp and swapDown: a floor and the one above it exchange places; number labels follow, typed labels stay',()=>{
 let a=legacy();a.floors[2].label='Vault door';
 assert.equal(E.swapUp(a,'f3'),true);assert.equal(shape(a),'f1@1 f3@2<f1 f2@3<f3');assert.equal(ids(a),'f1,f3,f2');
 assert.equal(a.floors[1].label,'Vault door');assert.equal(a.floors[2].label,'3','the number 2 became 3');
 a=legacy();assert.equal(E.swapDown(a,'f1'),true);assert.equal(shape(a),'f2@1 f1@2<f2 f3@3<f1');assert.deepEqual(a.floors.map(f=>f.label),['1','2','3']);
 a=legacy();let before=JSON.stringify(a);assert.equal(E.swapUp(a,'f1'),false,'the entrance cannot go up');assert.equal(E.swapDown(a,'f3'),false,'the last floor cannot go down');assert.equal(E.swapUp(a,'zz'),false);
 assert.equal(JSON.stringify(a),before,'a refused move writes nothing, not even parents');
 a=branched();assert.equal(E.swapUp(a,'f3'),true);
 assert.equal(shape(a),'f1@1 f3@2<f1 f2@3<f3 f5@4<f2 f4@3<f3','the other branch of the upper floor now hangs under the floor that moved up');
});
test('shift: whole branches change places among siblings, and the edges refuse',()=>{
 const a=branched(),floors=a.floors;
 assert.equal(E.shift(a,'f4',-1),true);assert.equal(ids(a),'f1,f2,f4,f3,f5');assert.equal(a.floors,floors);
 assert.equal(E.shift(a,'f4',-1),false);assert.equal(E.shift(a,'f3',1),false);assert.equal(E.shift(a,'f5',1),false,'an only child has no neighbour');assert.equal(E.shift(a,'f3',2),false);
 assert.equal(E.shift(a,'f3',-1),true);assert.equal(ids(a),'f1,f2,f3,f5,f4');
});
test('reparent: a floor moves with everything below it; itself, its own branch and unknown floors are refused',()=>{
 const a=branched();
 assert.equal(E.reparent(a,'f3','f4'),true);assert.equal(shape(a),'f1@1 f2@2<f1 f4@3<f2 f3@4<f4 f5@5<f3');
 assert.deepEqual(a.floors.map(f=>f.label),['1','2','3','4','5'],'number labels follow the new depth');
 const before=JSON.stringify(a);
 for(const [x,y] of [['f3','f3'],['f4','f5'],['f3','nope'],['nope','f1'],['f5','f3']])assert.equal(E.reparent(a,x,y),false,x+'→'+y);
 assert.equal(JSON.stringify(a),before);
 assert.equal(E.reparent(a,'f5','f1'),true);assert.equal(shape(a),'f1@1 f2@2<f1 f4@3<f2 f3@4<f4 f5@2<f1');
});
test('removeFloor: what was below moves up, a removed entrance hands over to the first floor below, runAt follows',()=>{
 let a=branched();a.runAt='f2';const keep=a.floors.find(f=>f.id==='f5');keep.entries.push(entry('e1','password'));
 assert.equal(E.removeFloor(a,a.floors[1]),true);assert.equal(shape(a),'f1@1 f3@2<f1 f5@3<f3 f4@2<f1');assert.equal(a.runAt,'f1');
 assert.equal(keep.entries.length,1);assert.equal(N.validArchitectures([a]),true);
 a=branched();a.floors.splice(1,0,floor('g',2,'f1'));a.runAt='f1';
 assert.equal(E.removeFloor(a,a.floors[0]),true);assert.equal(E.tree(a).roots.length,1);assert.equal(shape(a),'g@1 f2@2<g f3@3<f2 f5@4<f3 f4@3<f2');assert.equal(a.runAt,'');
 assert.equal(E.removeFloor(a,{id:'g'}),false,'only the saved object itself can be removed');assert.equal(E.removeFloor(a,null),false);
 a=arch([floor('only',1)]);assert.equal(E.removeFloor(a,a.floors[0]),true);assert.equal(a.floors.length,0);
});
test('adopt: a floor appended the old way hangs under the floor before it once parents exist',()=>{
 const a=legacy();assert.equal(E.adopt(a),false,'legacy data is left alone');assert.equal(a.floors.some(f=>'parent' in f),false);
 E.materialize(a);a.floors.push(floor('f9',4));assert.equal(E.adopt(a),true);assert.equal(a.floors[3].parent,'f3');assert.equal(shape(a),'f1@1 f2@2<f1 f3@3<f2 f9@4<f3');
});
test('random edits keep the data valid and never lose or duplicate a floor or a record',()=>{
 let seed=20261114;const rnd=n=>{seed=(seed*1103515245+12345)&0x7fffffff;return seed%n};
 for(let round=0;round<40;round++){
  const a=arch([floor('r0',1)]);a.floors[0].entries.push(entry('e-r0','password'));let made=0;
  for(let step=0;step<40;step++){
   const pick=()=>a.floors[rnd(a.floors.length)].id,before=a.floors.length,all=new Set(a.floors.map(f=>f.id)),op=rnd(7);
   if(op===0){E.addChild(a,pick());if(a.floors.length>before){const f=a.floors.find(x=>!all.has(x.id));f.entries.push(entry('e-'+(++made),made%2?'ice':'file'))}}
   else if(op===1)E.swapUp(a,pick());else if(op===2)E.swapDown(a,pick());else if(op===3)E.shift(a,pick(),rnd(2)?1:-1);else if(op===4)E.reparent(a,pick(),pick());
   else if(op===5&&a.floors.length>1){const f=a.floors[rnd(a.floors.length)];assert.equal(E.removeFloor(a,f),true);all.delete(f.id)}
   else if(op===6&&a.floors.length<100){a.floors.push(floor('old'+round+'-'+step,9));E.adopt(a);all.add('old'+round+'-'+step)}
   assert.equal(N.validArchitectures([plain(a)]),true);
   const t=E.tree(a);assert.equal(t.list.length,a.floors.length);assert.equal(ids(a),t.order.map(f=>f.id).join(),'top-down order');
   if(op!==0)assert.deepEqual(new Set(a.floors.map(f=>f.id)),all);
   assert.equal(t.roots.length,1,'one entrance');
  }
 }
});
test('editHtml: escapes what the GM typed, marks impossible moves, shows branch buttons only to siblings',()=>{
 const a=branched();a.floors[0].label='<script>x</script>';a.floors[1].branch='<img src=x>';a.floors[2].entries.push(entry('e1','ice',{name:'<b>Dog</b>',rez:20,maxRez:20}));
 const seen=[];
 for(const l of ['ru','en']){
  const html=E.editHtml(a,l,(f,i)=>{seen.push([f.id,i]);return `<i data-body="${i}"></i>`});
  assert.equal(/<script>|<img|<b>Dog/.test(html),false);assert.match(html,/&lt;script&gt;x/);assert.match(html,/&lt;b&gt;Dog&lt;\/b&gt; · REZ 20/);
  const card=id=>html.split('<article').find(x=>x.includes(`data-net="ed-up" data-floor="${id}"`));
  assert.match(card('f1'),/data-net="ed-up" data-floor="f1"[^>]*aria-disabled="true"/);assert.doesNotMatch(card('f2'),/data-net="ed-up"[^>]*aria-disabled/);
  assert.match(card('f5'),/data-net="ed-down" data-floor="f5"[^>]*aria-disabled="true"/);
  assert.equal(card('f1').includes('ed-prev'),false);assert.equal(card('f3').includes('ed-prev'),true);
  assert.match(card('f3'),/data-net="ed-prev"[^>]*aria-disabled="true"/);assert.match(card('f4'),/data-net="ed-next"[^>]*aria-disabled="true"/);
  assert.match(card('f4'),/data-net="remove-floor" data-floor="f4" data-index="4"/);assert.equal(html.includes('ed-move-here'),false);
  assert.equal(/disabled(?!=")/.test(html.replace(/aria-disabled="true"/g,'')),false,'the native disabled attribute would drop the focus');
  assert.equal((html.match(/class="net-ed-branch"/g)||[]).length,2);
 }
 assert.deepEqual(seen.slice(0,5),[['f1',0],['f2',1],['f3',2],['f5',3],['f4',4]],'the body gets the place of the floor in the saved array');
 assert.match(E.editHtml(arch([]),'ru',()=>''),/data-net="add-floor"/);
});
test('editor clicks: unknown floors, disabled buttons and missing architectures change nothing',()=>{
 const a=branched(),before=JSON.stringify(a);
 assert.equal(E.handle('ed-up',btn({floor:'nope'}),a,'ru'),null);assert.equal(E.handle('ed-up',btn({floor:'f3'},true),a,'ru'),null);
 assert.equal(E.handle('ed-up',btn({floor:'f1'}),a,'ru'),null);assert.equal(E.handle('ed-add',btn({floor:'f1'}),null,'ru'),null);assert.equal(E.handle('ed-move-here',btn({floor:'f1'}),a,'ru'),null,'nothing was picked');
 assert.equal(E.handle('ed-what',btn({floor:'f1'}),a,'ru'),null);assert.equal(JSON.stringify(a),before);
 assert.deepEqual(plain(E.handle('ed-next',btn({floor:'f3'}),a,'ru')),{dirty:true,rerender:true});assert.equal(ids(a),'f1,f2,f4,f3,f5');
});
test('pick mode: «Сюда» appears only where the floor may go, and the move ends the mode',()=>{
 E.reset();const a=branched();
 assert.deepEqual(plain(E.handle('ed-move',btn({floor:'f3'}),a,'ru')),{rerender:true});
 let html=E.editHtml(a,'ru',()=>'');const here=[...html.matchAll(/data-net="ed-move-here" data-floor="(\w+)"/g)].map(m=>m[1]);
 assert.deepEqual(here,['f1','f2','f4'],'not itself, not its own branch; its present place is offered only when it would change the order');
 assert.match(html,/role="status">Выберите этаж, под который перенести «Этаж 3»/);assert.match(html,/data-net="ed-move" data-floor="f3"[^>]*aria-pressed="true"/);assert.match(html,/Отменить перенос/);
 assert.equal(E.handle('ed-move-here',btn({floor:'f5'}),a,'ru'),null);
 const r=E.handle('ed-move-here',btn({floor:'f4'}),a,'ru');assert.equal(r.dirty,true);assert.equal(r.notify,'Этаж перенесён.');assert.equal(shape(a),'f1@1 f2@2<f1 f4@3<f2 f3@4<f4 f5@5<f3');
 assert.equal(E.editHtml(a,'ru',()=>'').includes('ed-move-here'),false);
 E.handle('ed-move',btn({floor:'f3'}),a,'en');E.handle('ed-move',btn({floor:'f3'}),a,'en');assert.equal(E.editHtml(a,'en',()=>'').includes('ed-move-here'),false,'the same button cancels');
 E.handle('ed-move',btn({floor:'f3'}),a,'en');assert.equal(E.editHtml({...a,id:'other'},'en',()=>'').includes('ed-move-here'),false,'the pick belongs to one architecture');E.reset();
});
const runArch=()=>{const a=branched();a.floors[0].entries.push(entry('p1','password',{name:'<u>Gate</u>',dv:8,notes:'<i>hint</i>'}),entry('o1','other',{name:'Camera'}));a.floors[1].entries.push(entry('i1','ice',{name:'Hellhound',preset:'Hellhound',per:6,spd:6,atk:6,def:2,rez:20,maxRez:20}),entry('c1','control',{dv:10,state:'open'}));a.floors[1].branch='<b>lab</b>';return a};
test('runHtml: the current floor with its records, DV and state words, in both languages and escaped',()=>{
 E.reset();const a=runArch();assert.equal(E.running(a),false);E.handle('run-mode-on',btn(),a,'ru');assert.equal(E.running(a),true);assert.equal(E.running({id:'zz'}),false);
 let ru=E.runHtml(a,'ru',{actions:3,remaining:2}),en=E.runHtml(a,'en',{actions:3,remaining:2});
 assert.match(ru,/NET-действия: 2 \/ 3/);assert.match(en,/NET Actions: 2 \/ 3/);assert.match(ru,/Interface 4 · модификатор 0/);
 assert.match(ru,/Пароль<\/span><strong>&lt;u&gt;Gate&lt;\/u&gt;<\/strong><span class="net-run-dv">DV 8<\/span><span class="net-ed-chip" data-state="closed">Закрыто/);
 assert.match(en,/Password<\/span>.*DV 8<\/span><span class="net-ed-chip" data-state="closed">Closed/);
 assert.equal(/<u>|<i>hint|<b>lab/.test(ru+en),false);assert.match(ru,/&lt;i&gt;hint/);
 assert.match(ru,/data-net="run-go" data-floor="f1" aria-current="step"/);assert.match(ru,/data-net="run-go" data-floor="f2">↓ Этаж 2 · &lt;b&gt;lab&lt;\/b&gt;/);
 assert.match(ru,/На этаже закрытый пароль/);assert.match(en,/closed password/);
 assert.match(ru,/data-net="run-roll" data-floor="f1" data-entry="p1"/);assert.equal(ru.includes('data-net="run-roll" data-floor="f1" data-entry="o1"'),false,'«other» is toggled, not rolled');
 a.floors[0].entries[0].state='open';ru=E.runHtml(a,'ru',{});assert.equal(ru.includes('На этаже закрытый пароль'),false);assert.equal(ru.includes('data-net="run-roll"'),false);assert.match(ru,/Закрыть снова/);
 a.runAt='f2';ru=E.runHtml(a,'ru',{});
 assert.match(ru,/PER 6 · SPD 6 · ATK 6 · DEF 2 · <span data-net-run-rez>REZ <strong>20<\/strong> \/ 20/);assert.match(ru,/<select data-net-entry="state" data-index="1" data-entry="0">/);
 assert.match(ru,/data-net="run-go" data-floor="f1">↑ Этаж 1/);assert.equal((ru.match(/class="btn" data-net="run-go"/g)||[]).length,2,'one button per floor below');
 assert.equal(ru.includes('data-net="run-toggle" data-floor="f2" data-entry="i1"'),false);assert.match(ru,/data-net="run-go" data-floor="f2" aria-current="location"/);
 assert.match(E.runHtml(arch([]),'ru',{}),/пока нет этажей/);E.reset();
});
test('run-go and run-start: the place is saved, the old field follows, unknown floors are ignored',()=>{
 E.reset();const a=runArch();a.floors[2].label='Архив';
 assert.match(E.runHtml({...a,runAt:'gone'},'ru',{}),/data-net-run-floor aria-label="Этаж 1"/);assert.match(E.runHtml(a,'ru',{}),/data-net-run-floor aria-label="Этаж 1"/);
 assert.deepEqual(plain(E.handle('run-go',btn({floor:'f3'}),a,'ru')),{dirty:true,rerender:true});assert.equal(a.runAt,'f3');assert.equal(a.current,'Архив');
 assert.equal(E.handle('run-go',btn({floor:'nope'}),a,'ru'),null);assert.equal(a.runAt,'f3');
 E.handle('run-start',btn(),a,'ru');assert.equal(a.runAt,'f1');assert.equal(a.current,'1');assert.equal(N.validArchitectures([a]),true);
});
test('run-roll: success opens the lock, failure leaves it, and the label never carries the GM’s names',()=>{
 E.reset();const a=runArch();a.name='Secret Vault';rolls.length=0;const real=ctx.Math.random;
 ctx.Math.random=()=>0;let r=E.handle('run-roll',btn({floor:'f1',entry:'p1'}),a,'ru');
 assert.equal(a.floors[0].entries[0].state,'closed');assert.equal(r.dirty,false);assert.equal(r.rerender,true);assert.match(E.runHtml(a,'ru',{}),/role="status">Interface \+ 1d10: 4 ≤ DV 8\. Не выше DV/);
 ctx.Math.random=()=>0.8;r=E.handle('run-roll',btn({floor:'f1',entry:'p1'}),a,'en');
 assert.equal(a.floors[0].entries[0].state,'open');assert.equal(r.dirty,true);assert.match(E.runHtml(a,'en',{}),/role="status">Interface \+ 1d10: 13 &gt; DV 8\. Success: marked “Open”/);
 ctx.Math.random=real;
 assert.equal(rolls.length,2);assert.equal(rolls[0].label,'Interface · Пароль · этаж 1 · DV 8');assert.equal(rolls[1].label,'Interface · password · floor 1 · DV 8');assert.equal(rolls[1].r.success,true);
 for(const x of rolls)assert.equal(/Gate|Secret|Vault/.test(x.label),false);
 assert.equal(E.handle('run-roll',btn({floor:'f1',entry:'p1'}),a,'ru'),null,'already open');assert.equal(E.handle('run-roll',btn({floor:'f1',entry:'o1'}),a,'ru'),null);assert.equal(E.handle('run-roll',btn({floor:'f2',entry:'i1'}),a,'ru'),null);
 assert.equal(E.handle('run-roll',btn({floor:'f2',entry:'p1'}),a,'ru'),null,'the record is looked up on its own floor');assert.equal(rolls.length,2);
});
test('run-toggle: closed to open and back, never for ICE',()=>{
 const a=runArch(),o=a.floors[0].entries[1];
 assert.equal(E.handle('run-toggle',btn({floor:'f1',entry:'o1'}),a,'ru').dirty,true);assert.equal(o.state,'open');E.handle('run-toggle',btn({floor:'f1',entry:'o1'}),a,'ru');assert.equal(o.state,'closed');
 assert.equal(E.handle('run-toggle',btn({floor:'f2',entry:'i1'}),a,'ru'),null);assert.equal(a.floors[1].entries[0].state,'waiting');
});
test('run-rez: one step at a time within 0..999; zero makes waiting or pursuing ICE Derezzed, destroyed stays',()=>{
 const a=runArch(),ice=a.floors[1].entries[0],press=d=>E.handle('run-rez',btn({floor:'f2',entry:'i1',delta:String(d)}),a,'ru');
 assert.equal(press(-1).dirty,true);assert.equal(ice.rez,19);assert.equal(press(5),null);assert.equal(press(0),null);assert.equal(ice.rez,19);
 ice.rez=1;ice.state='pursuing';press(-1);assert.equal(ice.rez,0);assert.equal(ice.state,'derezzed');assert.equal(press(-1),null,'not below zero');
 press(1);assert.equal(ice.rez,1);assert.equal(ice.state,'derezzed','the GM decides when it is back');
 ice.rez=999;assert.equal(press(1),null);ice.rez=1;ice.state='destroyed';press(-1);assert.equal(ice.state,'destroyed');
 assert.equal(E.handle('run-rez',btn({floor:'f1',entry:'p1',delta:'-1'}),a,'ru'),null);
});
test('run-ice: hands the calculator its own key and a fitting check',()=>{
 const a=runArch();a.floors[1].id='f 2/x';a.floors[2].parent='f 2/x';a.floors[4].parent='f 2/x';
 let r=E.handle('run-ice',btn({floor:'f 2/x',entry:'i1'}),a,'ru');assert.deepEqual(plain(r),{rerender:true,ice:{key:'f%202%2Fx:i1',mode:'encounter'}});
 a.floors[1].entries[0].state='pursuing';assert.equal(E.handle('run-ice',btn({floor:'f 2/x',entry:'i1'}),a,'ru').ice.mode,'ice');
 assert.equal(E.handle('run-ice',btn({floor:'f 2/x',entry:'c1'}),a,'ru'),null);
});
test('reset of the defences and its one-step undo',()=>{
 E.reset();const a=runArch(),[p,o]=a.floors[0].entries,[ice,c]=a.floors[1].entries;
 a.floors[2].entries.push(entry('d1','ice',{state:'destroyed',rez:0,maxRez:15}),entry('x1','ice',{state:'other',rez:3,maxRez:15}),entry('w1','ice',{state:'derezzed',rez:0,maxRez:15}),entry('s1','file',{state:'other'}));
 p.state='open';ice.rez=7;ice.state='pursuing';const before=JSON.stringify(a);
 assert.equal(E.handle('run-reset',btn(),a,'ru').notify,'Защита сброшена.');
 assert.deepEqual([p.state,o.state,c.state,ice.state,ice.rez],['closed','closed','closed','waiting',20]);
 assert.deepEqual(a.floors[2].entries.map(e=>[e.state,e.rez]),[['destroyed',0],['other',3],['waiting',15],['other',0]]);
 assert.match(E.runHtml(a,'ru',{}),/data-net="run-reset-undo"/);assert.equal(E.runHtml({...a,id:'b'},'ru',{}).includes('run-reset-undo'),false);
 assert.equal(E.handle('run-reset-undo',btn(),{...a,id:'b'},'ru'),null,'another architecture');
 assert.equal(E.handle('run-reset-undo',btn(),a,'ru').dirty,true);assert.equal(JSON.stringify(a),before);assert.equal(E.handle('run-reset-undo',btn(),a,'ru'),null);
 const again=E.handle('run-reset',btn(),a,'ru');assert.equal(again.dirty,true);const idle=E.handle('run-reset',btn(),a,'en');assert.equal(idle.dirty,undefined);assert.match(idle.notify,/Nothing to reset/);
 E.handle('run-reset-undo',btn(),a,'ru');E.handle('run-reset',btn(),a,'ru');E.reset();assert.equal(E.handle('run-reset-undo',btn(),a,'ru'),null,'forgotten with the scope');
});
test('reset: leaves run mode, pick mode and the undo behind',()=>{
 const a=runArch();E.handle('run-mode-on',btn(),a,'ru');E.handle('ed-move',btn({floor:'f3'}),a,'ru');assert.equal(E.running(a),true);
 E.reset();assert.equal(E.running(a),false);assert.equal(E.editHtml(a,'ru',()=>'').includes('ed-move-here'),false);
 E.handle('run-mode-on',btn(),a,'ru');E.handle('run-mode-off',btn(),a,'ru');assert.equal(E.running(a),false);
 assert.match(E.toggleHtml(a,'ru'),/data-net="run-mode-off" aria-pressed="true">Редактор.*data-net="run-mode-on" aria-pressed="false">Проход/);
});
test('a deep tree stops shifting sideways after four levels',()=>{
 const floors=[floor('r',1,'')];for(let i=0;i<7;i++){floors.push(floor('a'+i,i+2,i?'a'+(i-1):'r'),floor('b'+i,i+2,i?'a'+(i-1):'r'))}
 const html=E.editHtml(arch(floors),'en',()=>'');assert.ok((html.match(/class="net-ed-branch flat"/g)||[]).length>=4);assert.equal((html.match(/class="net-ed-branch"/g)||[]).length,8);
});
test('run map: floor labels and branch notes typed by the GM are escaped there too',()=>{
 E.reset();const a=branched();a.floors[2].label='<img src=x onerror=1>';a.floors[4].branch='<svg onload=1>';
 for(const l of ['ru','en']){
  const map=E.runHtml(a,l,{}).split('net-run-map')[1];
  assert.equal(/<img|<svg/.test(map),false);assert.match(map,/ · &lt;img src=x onerror=1&gt;/);assert.match(map,/ · &lt;svg onload=1&gt;/);
 }
});
test('the reset undo is forgotten when NetTools changes scope',()=>{
 N.setScope('undo-a');const a=runArch();a.floors[0].entries[0].state='open';
 E.handle('run-reset',btn(),a,'ru');assert.match(E.runHtml(a,'ru',{}),/data-net="run-reset-undo"/);
 N.setScope('undo-b');assert.equal(E.runHtml(a,'ru',{}).includes('run-reset-undo'),false);assert.equal(E.handle('run-reset-undo',btn(),a,'ru'),null);
 assert.equal(a.floors[0].entries[0].state,'closed');
});
test('the reset undo refuses once a record it would touch has moved on, and the button goes away',()=>{
 const make=()=>{E.reset();const a=runArch(),[p]=a.floors[0].entries,[ice]=a.floors[1].entries;p.state='open';ice.rez=4;ice.state='pursuing';E.handle('run-reset',btn(),a,'ru');return {a,p,ice}};
 // REZ taken off after the reset, down to Derezzed.
 let {a,p,ice}=make();for(let i=0;i<20;i++)E.handle('run-rez',btn({floor:'f2',entry:'i1',delta:'-1'}),a,'ru');
 assert.deepEqual([ice.state,ice.rez],['derezzed',0]);assert.equal(E.runHtml(a,'ru',{}).includes('run-reset-undo'),false,'no button for a stale undo');
 let r=E.handle('run-reset-undo',btn(),a,'ru');assert.deepEqual(plain(r),{rerender:true,notify:'Данные изменились: вернуть прежнее состояние уже нельзя.'});
 assert.deepEqual([ice.state,ice.rez,p.state],['derezzed',0,'closed'],'nothing is written, not even the records that did not change');
 assert.equal(E.handle('run-reset-undo',btn(),a,'ru'),null,'the stale undo is dropped');
 // A record whose type changed must not get a state of the other kind.
 ({a,p,ice}=make());p.type='ice';p.state='waiting';
 assert.match(E.handle('run-reset-undo',btn(),a,'en').notify,/can no longer be put back/);assert.deepEqual([p.type,p.state,ice.state,ice.rez],['ice','waiting','waiting',20]);
 // A state changed by hand, and a record that was removed.
 ({a,p,ice}=make());ice.state='destroyed';assert.equal(E.handle('run-reset-undo',btn(),a,'ru').dirty,undefined);assert.equal(p.state,'closed');
 ({a,p,ice}=make());a.floors[0].entries.shift();assert.equal(E.handle('run-reset-undo',btn(),a,'ru').dirty,undefined);assert.equal(ice.rez,20);
 // Records the reset did not touch may change freely; leaving and re-entering the run does not matter.
 ({a,p,ice}=make());E.handle('run-mode-off',btn(),a,'ru');E.handle('run-mode-on',btn(),a,'ru');E.handle('run-toggle',btn({floor:'f1',entry:'o1'}),a,'ru');
 assert.match(E.runHtml(a,'ru',{}),/data-net="run-reset-undo"/);assert.equal(E.handle('run-reset-undo',btn(),a,'ru').notify,'Состояние возвращено.');
 assert.deepEqual([p.state,ice.state,ice.rez,a.floors[0].entries[1].state],['open','pursuing',4,'open']);E.reset();
});
test('a step keeps «Текущий этаж» in step only while it holds a floor label or number, never over the GM’s own text',()=>{
 E.reset();let a=runArch();a.current='Серверная, после лифта';
 E.handle('run-go',btn({floor:'f3'}),a,'ru');assert.equal(a.runAt,'f3');assert.equal(a.current,'Серверная, после лифта');
 E.handle('run-start',btn(),a,'ru');assert.equal(a.current,'Серверная, после лифта');
 a=runArch();a.current='';E.handle('run-go',btn({floor:'f2'}),a,'ru');assert.equal(a.current,'2','an empty field is filled');
 a.floors[1].label='Lab';E.handle('run-go',btn({floor:'f3'}),a,'ru');assert.equal(a.current,'3','the number of the floor that was current counts as written by the run');
 a=runArch();a.current='7';E.handle('run-go',btn({floor:'f2'}),a,'ru');assert.equal(a.current,'7','a number that is not the current floor is the GM’s');
});
test('«Перенести…» is off where there is nowhere to go, and pressing it starts nothing',()=>{
 E.reset();const a=legacy();
 let html=E.editHtml(a,'ru',()=>'');
 assert.match(html,/data-net="ed-move" data-floor="f1"[^>]*aria-label="Этаж 1: перенести некуда[^"]*"[^>]*aria-disabled="true"/,'the entrance has every floor below it');
 assert.match(html,/data-net="ed-move" data-floor="f2"[^>]*aria-disabled="true"/,'already the last floor under the only floor above');
 assert.doesNotMatch(html,/data-net="ed-move" data-floor="f3"[^>]*aria-disabled/);
 assert.equal(E.handle('ed-move',btn({floor:'f1'}),a,'ru'),null);assert.equal(E.editHtml(a,'ru',()=>'').includes('net-ed-pick'),false);
 assert.match(E.editHtml(a,'en',()=>''),/aria-label="Floor 1: nowhere to move it/);
 // The picked floor keeps its button enabled, because the same button cancels.
 E.handle('ed-move',btn({floor:'f3'}),a,'ru');assert.doesNotMatch(E.editHtml(a,'ru',()=>''),/data-net="ed-move" data-floor="f3"[^>]*aria-disabled/);E.reset();
});
test('pick mode shrinks the cards to their headings and puts the instruction in the card being moved',()=>{
 E.reset();const a=branched();let bodies=0;const body=()=>{bodies++;return '<i data-body></i>'};
 E.editHtml(a,'ru',body);assert.equal(bodies,5);bodies=0;
 E.handle('ed-move',btn({floor:'f4'}),a,'ru');const html=E.editHtml(a,'ru',body);
 assert.equal(bodies,0,'the long record forms are not drawn while a target is chosen');assert.equal(html.includes('data-body'),false);
 assert.match(html,/<ul class="net-ed-tree is-picking">/);
 const cards=html.split('<article').slice(1),mine=cards.filter(c=>c.includes('net-ed-pick'));
 assert.equal(mine.length,1);assert.match(mine[0],/is-moving/);assert.match(mine[0],/role="status">Выберите этаж, под который перенести «Этаж 3»/);assert.match(mine[0],/data-net="ed-move" data-floor="f4"[^>]*aria-pressed="true"/);
 for(const c of cards.filter(c=>!c.includes('net-ed-pick'))){assert.equal(c.includes('net-ed-bar'),false,'only the moved card keeps its toolbar');assert.match(c,/net-ed-title/)}
 assert.equal((html.match(/data-net="ed-move-here"/g)||[]).length,3);
 E.handle('ed-move',btn({floor:'f4'}),a,'ru');bodies=0;E.editHtml(a,'ru',body);assert.equal(bodies,5,'cancelling brings the forms back');E.reset();
});
test('branch order buttons point up and down, like the branches on screen, and differ from the swap arrows',()=>{
 const html=E.editHtml(branched(),'ru',()=>'');
 assert.match(html,/data-net="ed-prev"[^>]*><span aria-hidden="true">⇡</);assert.match(html,/data-net="ed-next"[^>]*><span aria-hidden="true">⇣</);
 assert.match(html,/data-net="ed-up"[^>]*><span aria-hidden="true">↑</);assert.equal(/[←→]/.test(html),false);
});
test('run-rez: +1 stops at the maximum REZ of the record; a record without a maximum is not cut',()=>{
 E.reset();const a=runArch(),ice=a.floors[1].entries[0],press=d=>E.handle('run-rez',btn({floor:'f2',entry:'i1',delta:String(d)}),a,'ru');
 assert.equal(press(1),null,'20 / 20 stays');assert.equal(ice.rez,20);press(-1);assert.equal(press(1).dirty,true);assert.equal(ice.rez,20);assert.equal(press(1),null);
 ice.rez=25;assert.equal(press(1),null,'already above the maximum: not raised further');assert.equal(press(-1).dirty,true);assert.equal(ice.rez,24,'and not cut down to it either');
 ice.maxRez=0;ice.rez=3;press(1);assert.equal(ice.rez,4);
});
test('the run and the editor call an ICE state by the same English and Russian words',()=>{
 E.reset();const a=runArch();a.runAt='f2';
 // The words live in two tables (net-tools.js for the record form, net-editor.js for the run); this keeps them equal.
 const src=fs.readFileSync(path.join(__dirname,'../site/net-tools.js'),'utf8');
 for(const [key,ru,en] of [['waiting','Ожидает','Lying in wait'],['pursuing','Преследует','Pursuing'],['derezzed','Derezzed','Derezzed'],['destroyed','Уничтожен','Destroyed']]){
  assert.ok(src.includes(`${key}:'${ru}'`)&&src.includes(`${key}:'${en}'`),key);
  a.floors[1].entries[0].state=key;assert.match(E.runHtml(a,'ru',{}),new RegExp('REZ 20 · '+ru));assert.match(E.runHtml(a,'en',{}),new RegExp('REZ 20 · '+en));
  assert.match(E.runHtml(a,'en',{}),new RegExp(`<option value="${key}" selected>${en}<`));
 }
 assert.equal(/Waiting/.test(E.runHtml(a,'en',{})),false);
});
test('focus is placed by hand where the pressed button disappears: a successful roll, the undo, a removed floor, a move',()=>{
 // A page stub: focusLater asks for a selector after the redraw; the test records which one.
 const asked=[];let n=0;
 const c={window:{confirm:()=>true,Rolls:{check(){}}},crypto:{randomUUID:()=>'v'+(++n)},Math:Object.create(Math),document:{querySelector:s=>{asked.push(s);return null}},setTimeout:f=>f()};
 vm.createContext(c);for(const f of ['net-tools.js','net-editor.js'])vm.runInContext(fs.readFileSync(path.join(__dirname,'../site',f),'utf8'),c);
 const X=c.window.NetEditor,a=runArch();
 c.Math.random=()=>0;X.handle('run-roll',btn({floor:'f1',entry:'p1'}),a,'ru');assert.deepEqual(asked,[],'after a failed roll the button is still there');
 c.Math.random=()=>0.8;X.handle('run-roll',btn({floor:'f1',entry:'p1'}),a,'ru');assert.deepEqual(asked.splice(0),['[data-net="run-toggle"][data-floor="f1"][data-entry="p1"]']);
 X.handle('run-reset',btn(),a,'ru');X.handle('run-reset-undo',btn(),a,'ru');assert.deepEqual(asked.splice(0),['[data-net="run-reset"]']);
 X.handle('run-reset',btn(),a,'ru');a.floors[0].entries[0].state='other';X.handle('run-reset-undo',btn(),a,'ru');assert.deepEqual(asked.splice(0),['[data-net="run-reset"]'],'also when the undo is refused');
 X.handle('ed-move',btn({floor:'f4'}),a,'ru');assert.deepEqual(asked.splice(0),['[data-net="ed-move"][data-floor="f4"]']);X.handle('ed-move',btn({floor:'f4'}),a,'ru');asked.length=0;
 // A removed floor: the floor above it; a removed entrance: the floor that became the entrance; the last floor: the plain add button.
 assert.equal(X.removeFloor(a,a.floors.find(f=>f.id==='f3')),true);assert.deepEqual(asked.splice(0),['[data-net="ed-add"][data-floor="f2"]']);
 assert.equal(X.removeFloor(a,a.floors[0]),true);assert.deepEqual(asked.splice(0),['[data-net="ed-add"][data-floor="f2"]']);
 assert.equal(X.removeFloor(a,{id:'f2'}),false);assert.deepEqual(asked,[],'a refused removal moves nothing');
 const one=arch([floor('only',1)]);assert.equal(X.removeFloor(one,one.floors[0]),true);assert.deepEqual(asked.splice(0),['[data-net="add-floor"]']);
 const odd=arch([floor('a"b',1,''),floor('c',2,'a"b')]);X.removeFloor(odd,odd.floors[1]);assert.deepEqual(asked.splice(0),['[data-net="ed-add"][data-floor="a\\"b"]'],'ids are quoted for the selector');
});
