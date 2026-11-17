// Clocks, part two: pools of dice, real-time timers, starter clocks and the clocks file.
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const dir=path.join(__dirname,'../site'),read=f=>fs.readFileSync(path.join(dir,f),'utf8');
const plain=x=>JSON.parse(JSON.stringify(x));
const eq=(a,b,m)=>assert.deepEqual(plain(a),plain(b),m);
const seq=values=>{let i=0;return ()=>values[i++%values.length]};
// A die that shows the given faces in turn: rng()*sides must floor to face-1.
const faces=(sides,list)=>seq(list.map(f=>(f-1+0.5)/sides));

function load({lang='ru',state,clock=1700000000000,withFile=true}={}){
 const st=state||{lang,campaigns:[{id:'k1',name:'Job'}]},notices=[],actions=[],buzz=[],nodes={};let saves=0,refreshed=0;
 class FakeDate extends Date{static now(){return ctx.clock.now}}
 const ctx={clock:{now:clock}};
 const listeners={},intervals=[],cleared=[];
 const document={visibilityState:'visible',querySelector:s=>nodes[s]||null,querySelectorAll:()=>[],addEventListener(type,fn){(listeners[type]=listeners[type]||[]).push(fn)}};
 const window={App:{getState:()=>st,save:()=>{saves++},lang:()=>st.lang,notify:m=>notices.push(m),notifyAction:(m,label,run)=>{notices.push(m);actions.push({label,run})}},DiceFeel:{haptic:k=>{buzz.push(k);return true}}};
 const context={window,document,setInterval:fn=>{intervals.push(fn);return intervals.length},clearInterval:h=>{cleared.push(h)},Math,Number,String,Array,Object,Set,Map,Infinity,JSON,Date:FakeDate,Blob:class{constructor(p,o){this.parts=p;this.type=o?.type}},URL:{createObjectURL:()=> 'blob:x',revokeObjectURL(){}}};
 for(const f of ['gm-extras.js','clock-triggers.js',...(withFile?['clock-file.js']:[])])vm.runInNewContext(read(f),context,{filename:f});
 const GX=window.GMExtras;const origRefresh=GX.refresh;GX.refresh=()=>{refreshed++};
 const root={dataset:{lang},querySelector:()=>null,isConnected:true,outerHTML:''};
 const click=(ds,rng)=>{const b={dataset:ds,closest:s=>s==='[data-gx-root]'?root:b};return GX.handle({type:'click',target:b},lang,rng)};
 const change=(ds,value)=>GX.handle({type:'change',target:{dataset:ds,value,closest:()=>root}},lang);
 return {listeners,intervals,cleared,document,window,GX,CT:window.ClockTriggers,CF:window.ClockFile,st,notices,actions,buzz,nodes,ctx,root,click,change,saves:()=>saves,refreshed:()=>refreshed,clocks:()=>GX.readClocks(st),origRefresh};
}
const pool=(over={})=>({id:'p1',name:'Запас',size:4,filled:0,shared:false,pool:{sides:6,face:1},...over});

// ---------- pool ----------
test('cleanPool and cleanExtra: a pool drops the die, bad faces fall back',()=>{
 const {CT}=load();
 eq(CT.cleanPool({sides:6,face:2}),{sides:6,face:2});
 eq(CT.cleanPool({sides:6,face:9}),{sides:6,face:1});eq(CT.cleanPool({sides:6,face:0}),{sides:6,face:1});eq(CT.cleanPool({sides:12,face:'11',x:1}),{sides:12,face:11});
 for(const bad of [null,5,'x',[],{},{sides:7},{sides:'a'}])assert.equal(CT.cleanPool(bad),null);
 const x=CT.cleanExtra({pool:{sides:8,face:3},die:{sides:6,need:0}},5);
 eq(Object.keys(x),['pool']);eq(x.pool,{sides:8,face:3});
 eq(Object.keys(CT.cleanExtra({triggers:[{at:2,text:'t'}],tick:{camp:'k'},pool:{sides:4},countdown:{ms:60000}},5)),['triggers','tick','pool','countdown']);
});
test('a pool holds 2..12 dice, other clocks keep the fixed sizes, old data is untouched',()=>{
 const {GX}=load();
 for(const n of [2,5,7,12]){const c=GX.readClocks({gmExtras:{clocks:[pool({size:n})]}});assert.equal(c.length,1,'size '+n);eq(c[0].pool,{sides:6,face:1})}
 for(const n of [1,13,0,4.5])assert.equal(GX.readClocks({gmExtras:{clocks:[pool({size:n})]}}).length,0,'size '+n);
 assert.equal(GX.readClocks({gmExtras:{clocks:[{id:'a',name:'x',size:5,filled:0}]}}).length,0,'5 segments is still not a clock');
 assert.equal(GX.readClocks({gmExtras:{clocks:[{id:'a',name:'x',size:5,filled:0,pool:{sides:7}}]}}).length,0,'a broken pool does not open the sizes');
 eq(GX.readClocks({gmExtras:{clocks:[{id:'a',name:'Old',size:6,filled:2,shared:true}]}}),[{id:'a',name:'Old',size:6,filled:2,shared:true}]);
 const lone=load({withFile:false});
 lone.window.ClockTriggers=undefined;
 eq(lone.GX.readClocks({gmExtras:{clocks:[pool({size:7})]}}),[],'a page without the module cannot read a pool');
});
test('addClock makes a pool, the form creates one from the kind select',()=>{
 const {GX,click,change,clocks,st}=load();
 const r=GX.addClock([],'  Гвардия ',5,'p9',{pool:{sides:10,face:3}});
 eq(r.clocks,[{id:'p9',name:'Гвардия',size:5,filled:0,shared:false,pool:{sides:10,face:3}}]);
 assert.equal(GX.addClock([],'x',40,'q',{pool:{sides:6}}).clocks[0].size,12);
 assert.equal(GX.addClock([],'x',1,'q',{pool:{sides:6}}).clocks[0].size,2);
 eq(GX.addClock([],'x',5,'q',{pool:{sides:3}}).clocks[0].size,6,'a broken pool is an ordinary clock of the default size');
 change({gxField:'kind'},'pool');change({gxField:'dice'},'7');change({gxField:'poolSides'},'8');
 const root={dataset:{lang:'ru'},isConnected:true,outerHTML:'',querySelector:s=>({'[data-gx-field="draft"]':{value:'Охрана'},'[data-gx-field="kind"]':{value:'pool'},'[data-gx-field="dice"]':{value:'7'},'[data-gx-field="poolSides"]':{value:'8'}})[s]||null};
 const b={dataset:{gxAction:'add'},closest:s=>s==='[data-gx-root]'?root:b};
 GX.handle({type:'click',target:b},'ru');
 const c=clocks()[0];assert.equal(c.size,7);eq(c.pool,{sides:8,face:1});assert.equal(c.name,'Охрана');
 assert.ok(st.gmExtras.clocks.length===1);
});
test('poolRoll: dice that show the face leave, the rest stay',()=>{
 const {CT}=load();
 const c=pool({size:5,filled:1,pool:{sides:6,face:2}});
 const r=CT.poolRoll(c,faces(6,[2,5,2,1]));
 eq(r.rolls,[2,5,2,1]);assert.equal(r.out,2);assert.equal(r.left,2);
 assert.equal(CT.poolRoll(pool({size:3,filled:3}),()=>0).rolls.length,0);
 const bad=CT.poolRoll(c,()=>NaN);assert.ok(bad.rolls.every(x=>x>=1&&x<=6));
 assert.equal(CT.poolRoll({size:4,filled:0},()=>0.99).sides,6);
});
test('rolling the pool: segments fill, reminders fire on dice left, empty pool says so, undo restores',()=>{
 const t=load();
 t.GX.writeClocks(t.st,[pool({size:4,triggers:[{at:3,text:'Остался один'},{at:4,text:'Тревога'}]})]);
 // 4 dice: faces 1,1,1,5 -> 3 out, 1 left, the reminder at "1 left" fires
 assert.equal(t.click({gxAction:'ct-pool-roll',gxId:'p1'},faces(6,[1,1,1,5])),true);
 assert.equal(t.clocks()[0].filled,3);
 assert.match(t.notices.at(-1),/Запас: Выпало 1, 1, 1, 5 — убрано 3, осталось 1/);
 assert.match(t.notices.at(-1),/В пуле «Запас» осталось 1: Остался один/);
 assert.equal(t.actions.at(-1).label,'Отменить');
 t.actions.at(-1).run();assert.equal(t.clocks()[0].filled,0);
 // empty at 0 left
 t.click({gxAction:'ct-pool-roll',gxId:'p1'},faces(6,[1,1,1,1]));
 assert.equal(t.clocks()[0].filled,4);
 assert.match(t.notices.at(-1),/Тревога/);assert.match(t.notices.at(-1),/не осталось кубиков/);
 // a press on an empty pool answers and changes nothing
 const n=t.notices.length;t.click({gxAction:'ct-pool-roll',gxId:'p1'},faces(6,[1]));
 assert.equal(t.clocks()[0].filled,4);assert.equal(t.notices.length,n+1);assert.match(t.notices.at(-1),/не осталось/);
 // nothing removed: no undo notice, the pool stays
 t.GX.writeClocks(t.st,[pool()]);const a=t.actions.length;
 t.click({gxAction:'ct-pool-roll',gxId:'p1'},faces(6,[2,3,4,5]));
 assert.equal(t.clocks()[0].filled,0);assert.equal(t.actions.length,a);assert.match(t.notices.at(-1),/ничего не убрано, осталось 4/);
 // an undo after the pool changed by hand does not trample it
 t.click({gxAction:'ct-pool-roll',gxId:'p1'},faces(6,[1,1,5,5]));const undo=t.actions.at(-1).run;
 t.click({gxAction:'plus',gxId:'p1'});undo();assert.equal(t.clocks()[0].filled,3,'kept');
});
test('rolling the pool in English and for a clock that is gone',()=>{
 const t=load({lang:'en'});t.GX.writeClocks(t.st,[pool({name:'Guards',triggers:[{at:4,text:'Alarm'}]})]);
 t.click({gxAction:'ct-pool-roll',gxId:'p1'},faces(6,[1,1,1,1]));
 assert.match(t.notices.at(-1),/Guards: Rolled 1, 1, 1, 1 — 4 out, 0 left/);assert.match(t.notices.at(-1),/Pool “Guards” is down to 0: Alarm/);
 assert.equal(t.click({gxAction:'ct-pool-roll',gxId:'zz'}),true);
});
test('pool settings: die, face, and the pool is shown to players as a clock',()=>{
 const t=load();t.GX.writeClocks(t.st,[pool({size:6,filled:2,shared:true,pool:{sides:6,face:5}})]);
 t.change({gxField:'ct-pool-sides',gxId:'p1'},'4');eq(t.clocks()[0].pool,{sides:4,face:4});
 t.change({gxField:'ct-pool-face',gxId:'p1'},'2');eq(t.clocks()[0].pool,{sides:4,face:2});
 t.change({gxField:'ct-pool-face',gxId:'p1'},'9');eq(t.clocks()[0].pool,{sides:4,face:2});
 t.change({gxField:'ct-pool-sides',gxId:'p1'},'7');eq(t.clocks()[0].pool,{sides:4,face:2});
 eq(t.GX.sharedClocks(t.st),[{name:'Запас',size:6,filled:2}]);
});
test('pool markup: dice row, labels, no wheel, escaped',()=>{
 const t=load();t.GX.writeClocks(t.st,[pool({name:'<b>x</b>',size:5,filled:2,triggers:[{at:4,text:'<i>t</i>'}]})]);
 const html=t.GX.render('ru');
 assert.ok(!html.includes('gx-clock-svg'),'no wheel');assert.ok(html.includes('class="ct-pool'));
 assert.equal((html.match(/ct-chip on/g)||[]).length,3);assert.equal((html.match(/class="ct-chip"/g)||[]).length,2);
 assert.ok(html.includes('aria-label="Осталось 3 из 5, кость d6"'));
 assert.ok(html.includes('Убрать кубик')&&html.includes('Вернуть кубик'));
 assert.ok(html.includes('data-gx-action="ct-pool-roll"'));
 assert.ok(!html.includes('<b>x</b>')&&!html.includes('<i>t</i>'));
 const open=t.CT._test.ui().open;open.add('p1');
 const panel=t.GX.render('en');assert.ok(panel.includes('data-gx-field="ct-pool-face"')&&panel.includes('1 left'));
 assert.ok(!panel.includes('data-gx-field="ct-die"'));
});

// ---------- countdown ----------
test('cleanCountdown keeps one state and clamps nonsense',()=>{
 const {CT}=load();
 eq(CT.cleanCountdown({ms:600000}),{ms:600000});
 eq(CT.cleanCountdown({ms:600000,end:1700000600000,left:5,done:false}),{ms:600000,end:1700000600000});
 eq(CT.cleanCountdown({ms:600000,left:5000}),{ms:600000,left:5000});
 eq(CT.cleanCountdown({ms:600000,left:600001}),{ms:600000},'left longer than the timer is dropped');
 eq(CT.cleanCountdown({ms:600000,done:true,end:5}),{ms:600000,done:true});
 eq(CT.cleanCountdown({ms:'600000',end:'1700000600000'}),{ms:600000,end:1700000600000});
 for(const bad of [null,5,[],{},{ms:59999},{ms:604800001},{ms:1.5},{ms:'x'}])assert.equal(CT.cleanCountdown(bad),null);
 eq(CT.cleanCountdown({ms:60000,end:-5}),{ms:60000});eq(CT.cleanCountdown({ms:60000,end:1e30}),{ms:60000});
 eq(CT.cleanCountdown({ms:60000,secret:'x'}),{ms:60000});
 // an end later than the timer's own length from now can only be a mistake: it is cut back, never shown as running for ever
 const now=1700000000000;
 eq(CT.cleanCountdown({ms:60000,end:8e15}),{ms:60000,end:now+60000+60000});
 assert.ok(CT.cdRemaining(CT.cleanCountdown({ms:60000,end:8e15}),now)<=60000);
 assert.equal(CT.cdState(CT.cleanCountdown({ms:60000,end:8e15}),now+130000),'due');
});
test('timer rules: start, pause, resume, reset, expire, format',()=>{
 const {CT}=load();
 const cd={ms:600000},t0=1000000;
 assert.equal(CT.cdState(cd,t0),'idle');assert.equal(CT.cdRemaining(cd,t0),600000);
 const run=CT.cdStart(cd,t0);eq(run,{ms:600000,end:t0+600000});assert.equal(CT.cdState(run,t0+1),'running');
 assert.equal(CT.cdRemaining(run,t0+100000),500000);
 assert.equal(CT.cdStart(run,t0+5),run,'starting a running timer changes nothing');
 const paused=CT.cdPause(run,t0+100000);eq(paused,{ms:600000,left:500000});assert.equal(CT.cdState(paused,t0+900000),'paused');
 assert.equal(CT.cdRemaining(paused,t0+999999),500000,'a pause does not run');
 eq(CT.cdStart(paused,t0+200000),{ms:600000,end:t0+700000});
 assert.equal(CT.cdState(run,t0+600000),'due');assert.equal(CT.cdRemaining(run,t0+700000),0);
 eq(CT.cdExpire(run),{ms:600000,done:true});assert.equal(CT.cdState({ms:600000,done:true},t0),'done');assert.equal(CT.cdRemaining({ms:600000,done:true},t0),0);
 eq(CT.cdStart({ms:600000,done:true},t0),{ms:600000,end:t0+600000},'after the end Start runs it again');
 eq(CT.cdReset(run),{ms:600000});
 assert.equal(CT.cdPause(run,t0+600001),run,'a timer that is due is not paused');
 assert.equal(CT.cdRemaining({ms:600000,end:t0+99999999},t0),600000,'a clock set back cannot give more than the length');
 assert.equal(CT.cdPause({ms:60000,end:t0+60000+99999},t0).left,60000);
 assert.equal(CT.cdFormat(90000),'1:30');assert.equal(CT.cdFormat(3700000),'1:01:40');assert.equal(CT.cdFormat(0),'0:00');assert.equal(CT.cdFormat(1),'0:01');assert.equal(CT.cdFormat(-5),'0:00');assert.equal(CT.cdFormat(NaN),'0:00');
 assert.equal(CT.cdMinutes({ms:600000}),10);assert.equal(CT.cdMinutes(null),0);
});
test('the timer is set in minutes, started, paused and reset from the card',()=>{
 const t=load();t.GX.writeClocks(t.st,[{id:'c1',name:'Срок',size:6,filled:0,shared:false}]);
 t.change({gxField:'ct-cd-min',gxId:'c1'},'15');eq(t.clocks()[0].countdown,{ms:900000});
 t.change({gxField:'ct-cd-min',gxId:'c1'},'0');eq(t.clocks()[0].countdown,{ms:900000},'a bad number keeps the timer');
 t.change({gxField:'ct-cd-min',gxId:'c1'},'abc');eq(t.clocks()[0].countdown,{ms:900000});
 t.change({gxField:'ct-cd-min',gxId:'c1'},'10081');eq(t.clocks()[0].countdown,{ms:900000});t.change({gxField:'ct-cd-min',gxId:'c1'},'');assert.equal(t.clocks()[0].countdown,undefined);
 t.change({gxField:'ct-cd-min',gxId:'c1'},'10080');assert.equal(t.clocks()[0].countdown.ms,10080*60000);
 t.change({gxField:'ct-cd-min',gxId:'c1'},'10');
 const now=t.ctx.clock.now;
 t.click({gxAction:'ct-cd-toggle',gxId:'c1'});eq(t.clocks()[0].countdown,{ms:600000,end:now+600000});
 t.ctx.clock.now=now+120000;
 t.click({gxAction:'ct-cd-toggle',gxId:'c1'});eq(t.clocks()[0].countdown,{ms:600000,left:480000});
 t.ctx.clock.now=now+999999;
 t.click({gxAction:'ct-cd-toggle',gxId:'c1'});eq(t.clocks()[0].countdown,{ms:600000,end:now+999999+480000});
 t.click({gxAction:'ct-cd-reset',gxId:'c1'});eq(t.clocks()[0].countdown,{ms:600000});
 assert.equal(t.click({gxAction:'ct-cd-toggle',gxId:'nope'}),true);
 t.CT.reset();
});
test('a timer that ran out is closed once: toast, vibration, figures updated in place',()=>{
 const t=load();const now=t.ctx.clock.now;
 t.GX.writeClocks(t.st,[{id:'c1',name:'Срок <b>',size:6,filled:0,shared:false,countdown:{ms:600000,end:now-1}},{id:'c2',name:'Ещё',size:6,filled:0,shared:false,countdown:{ms:600000,end:now+90000}}]);
 const time={textContent:''},live={textContent:''};t.nodes['[data-ct-time="c2"]']=time;t.nodes['[data-ct-live="c2"]']=live;
 const r=t.CT.tick(now);
 eq(r.expired,['c1']);eq(t.clocks()[0].countdown,{ms:600000,done:true});eq(t.clocks()[1].countdown,{ms:600000,end:now+90000});
 assert.match(t.notices.at(-1),/Время вышло: «Срок <b>»\./);eq(t.buzz,['crit']);assert.equal(t.refreshed(),0,'the card is not drawn again: a field being typed in keeps its caret');
 assert.equal(time.textContent,'1:30');assert.equal(live.textContent,'Осталось 1:30');
 // the live region speaks once a minute, the figures every second
 t.CT.tick(now+1000);assert.equal(time.textContent,'1:29');assert.equal(live.textContent,'Осталось 1:30');
 t.CT.tick(now+31000);assert.equal(live.textContent,'Осталось 0:59');
 // closed once: another look does not repeat it
 const n=t.notices.length;t.CT.tick(now+2000);assert.equal(t.notices.length,n);eq(t.buzz,['crit']);
 // and the saved state is plain numbers, so a reload sees the same
 eq(plain(t.st.gmExtras.clocks[0].countdown),{ms:600000,done:true});
});
test('a timer that ran out while the page was closed ends on the first look; no timers, no work',()=>{
 const t=load({lang:'en'});const now=t.ctx.clock.now;
 t.GX.writeClocks(t.st,[{id:'c1',name:'Deadline',size:6,filled:0,shared:false,countdown:{ms:60000,end:now-3600000}}]);
 t.CT.tick(now);assert.match(t.notices.at(-1),/Time is up: “Deadline”\./);
 const s=t.saves();t.CT.tick(now+1);assert.equal(t.saves(),s);
 const empty=load();eq(empty.CT.tick(),{expired:[]});
});
test('timer markup: time, state word, one toggle button, live region, escaped',()=>{
 const t=load();const now=t.ctx.clock.now;
 t.GX.writeClocks(t.st,[{id:'c1',name:'<i>Срок</i>',size:6,filled:0,shared:false,countdown:{ms:600000,end:now+61000}}]);
 let html=t.GX.render('ru');
 assert.ok(html.includes('data-ct-time="c1">1:01<'));assert.ok(html.includes('идёт'));
 assert.ok(html.includes('data-gx-action="ct-cd-toggle"')&&html.includes('>Пауза<'));
 assert.ok(html.includes('role="status" aria-live="polite" data-ct-live="c1"'));
 assert.ok(!html.includes('<i>Срок</i>'));
 t.GX.writeClocks(t.st,[{id:'c1',name:'x',size:6,filled:0,shared:false,countdown:{ms:600000,left:30000}}]);
 html=t.GX.render('en');assert.ok(html.includes('>0:30<')&&html.includes('paused')&&html.includes('>Resume<'));
 t.GX.writeClocks(t.st,[{id:'c1',name:'x',size:6,filled:0,shared:false,countdown:{ms:600000,done:true}}]);
 html=t.GX.render('en');assert.ok(html.includes('time is up')&&html.includes('Start again')&&html.includes('ct-cd done'));
 t.GX.writeClocks(t.st,[{id:'c1',name:'x',size:6,filled:0,shared:false}]);
 assert.ok(!t.GX.render('en').includes('ct-cd'),'no timer, no timer controls');
});
test('the timer is private: the room gets name, size and filled only',()=>{
 const t=load();t.GX.writeClocks(t.st,[{id:'c1',name:'S',size:6,filled:1,shared:true,countdown:{ms:60000,end:5}}]);
 eq(t.GX.sharedClocks(t.st),[{name:'S',size:6,filled:1}]);
});

// ---------- templates and the file ----------
test('starter clocks: every one is valid in both languages and adds with a new id',()=>{
 for(const lang of ['ru','en']){
  const t=load({lang});let list=[];
  for(const tpl of t.CF.TEMPLATES){
   const r=t.CF.addTemplate(list,tpl.id,lang);assert.equal(r.ok,true,tpl.id);
   const c=r.clocks.find(x=>x.id===r.id);
   assert.ok(c.name&&c.name===(lang==='en'?tpl.en:tpl.ru));assert.equal(c.shared,false);
   assert.equal(t.GX.cleanClock(c).id,c.id);
   for(const tr of c.triggers||[]){assert.ok(tr.text.length>0&&tr.at>=1&&tr.at<=c.size)}
   assert.equal((c.triggers||[]).length,tpl.triggers.length);
   list=r.clocks;
  }
  assert.equal(new Set(list.map(c=>c.id)).size,list.length);
  assert.equal(list.length,t.CF.TEMPLATES.length);
  assert.ok(list.some(c=>c.pool)&&list.some(c=>c.countdown)&&list.some(c=>c.die));
  assert.equal(list.find(c=>c.countdown).countdown.ms,600000);
 }
 const t=load();eq(Object.keys(t.CF.TEMPLATES.map(x=>x.ru).reduce((a,n)=>({...a,[n]:1}),{})).sort(),['Запас скрытности','Подкрепление','Розыск','Срок','Таймер сцены'].sort());
 assert.equal(t.CF.addTemplate([],'nope','ru').ok,false);
 const full=Array.from({length:30},(_,i)=>({id:'k'+i,name:'n',size:4,filled:0,shared:false}));
 const f=t.CF.addTemplate(full,'wanted','ru');assert.equal(f.ok,false);assert.equal(f.reason,'full');assert.equal(f.clocks.length,30);
});
test('the toolbar adds a starter from its menu and says so',()=>{
 const t=load();
 assert.ok(t.GX.render('ru').includes('data-cf-action="tpl-toggle"'));
 assert.ok(!t.GX.render('ru').includes('data-cf-action="tpl"'),'the menu is closed at first');
 assert.equal(t.CF.act('tpl-toggle',{dataset:{}},'ru'),true);
 const html=t.GX.render('ru');assert.ok(html.includes('aria-expanded="true"')&&html.includes('data-cf-tpl="wanted"')&&html.includes('Розыск'));
 t.CF.act('tpl',{dataset:{cfTpl:'deadline'}},'ru');
 assert.equal(t.clocks().length,1);assert.equal(t.clocks()[0].name,'Срок');assert.match(t.notices.at(-1),/Добавлены часы «Срок»/);
 assert.ok(t.GX.render('ru').includes('data-cf-action="tpl"'),'the menu stays open: several starters can be added in a row');
});
test('the clocks file: what goes in and what is left out',()=>{
 const t=load();
 const list=[
  {id:'a',name:'Один',size:6,filled:2,shared:true,triggers:[{at:2,text:'x'}],die:{sides:6,need:0},tick:{camp:'k1',hist:[2]},countdown:{ms:600000,end:5}},
  pool({id:'b',filled:1,countdown:{ms:60000,left:100}})];
 const f=t.CF.buildFile(list,new Date('2026-01-02T03:04:05Z'));
 assert.equal(f.format,'nightcity-red-clocks');assert.equal(f.version,1);assert.equal(f.exportedAt,'2026-01-02T03:04:05.000Z');
 eq(f.clocks[0],{id:'a',name:'Один',size:6,filled:2,shared:false,triggers:[{at:2,text:'x'}],die:{sides:6,need:0},countdown:{ms:600000}});
 eq(f.clocks[1],{id:'b',name:'Запас',size:4,filled:1,shared:false,pool:{sides:6,face:1},countdown:{ms:60000}});
 assert.equal(t.CF.buildFile(null).clocks.length,0);
 assert.equal(t.CF.buildFile(Array.from({length:50},(_,i)=>({id:'k'+i,name:'n',size:4,filled:0}))).clocks.length,30);
 const back=t.CF.parseFile(JSON.stringify(f));assert.equal(back.ok,true);eq(back.clocks,f.clocks);
 // the file is the same twice
 assert.equal(JSON.stringify(t.CF.buildFile(list,new Date(0))),JSON.stringify(t.CF.buildFile(back.clocks,new Date(0))).replace(/"shared":false/g,'"shared":false'));
});
test('reading a clocks file: every refusal has a reason',()=>{
 const t=load(),P=t.CF.parseFile;
 assert.equal(P(5).reason,'size');assert.equal(P('x'.repeat(200001)).reason,'size');
 assert.equal(P('{nope').reason,'json');assert.equal(P('[]').reason,'format');assert.equal(P('{"format":"other","clocks":[]}').reason,'format');
 assert.equal(P('{"format":"nightcity-red-clocks"}').reason,'format');
 assert.equal(P('{"format":"nightcity-red-clocks","version":2,"clocks":[]}').reason,'newer');
 assert.equal(P('{"format":"nightcity-red-clocks","version":1,"clocks":[]}').reason,'empty');
 const r=P(JSON.stringify({format:'nightcity-red-clocks',version:1,clocks:[{id:'a',name:'ok',size:6,filled:9,evil:'<script>'},{id:'a',name:'dup',size:6},{id:'<x>',name:'bad id',size:6},{id:'c',size:5},null,'x',{id:'p',name:'P',size:3,pool:{sides:6}},{id:'q',name:'Q',size:2,pool:{sides:6}}]}));
 assert.equal(r.ok,true);eq(r.clocks.map(c=>c.id),['a','p','q']);assert.equal(r.clocks[0].filled,6);assert.equal(r.clocks[0].evil,undefined);
 assert.equal(r.rejected.length,5);assert.equal(r.rejected.filter(x=>x.reason==='twice').length,1);
 const many=P(JSON.stringify({format:'nightcity-red-clocks',version:1,clocks:Array.from({length:100},(_,i)=>({id:'k'+i,name:'n',size:4}))}));
 assert.equal(many.clocks.length,60,'only the first sixty entries are looked at');
 // an old pre-version file without a version still reads
 assert.equal(P('{"format":"nightcity-red-clocks","clocks":[{"id":"a","name":"x","size":4}]}').ok,true);
});
test('importing: new, replaced (your own switches stay), unchanged, over the limit',()=>{
 const t=load();
 const mine=[{id:'a',name:'Мои',size:6,filled:1,shared:true,tick:{camp:'k1',hist:[1]}},{id:'s',name:'Same',size:4,filled:0,shared:true}];
 const pack={clocks:[{id:'a',name:'Новые',size:6,filled:4,shared:false},{id:'s',name:'Same',size:4,filled:0,shared:false},{id:'n',name:'N',size:8,filled:0,shared:false}]};
 const p=t.CF.planImport(mine,pack);
 eq(p.rows.map(r=>r.status),['update','same','new']);assert.equal(p.added,1);assert.equal(p.updated,1);assert.equal(p.same,1);
 const a=p.list.find(c=>c.id==='a');assert.equal(a.name,'Новые');assert.equal(a.filled,4);assert.equal(a.shared,true,'sharing stays as you set it');eq(a.tick,{camp:'k1',hist:[1]});
 assert.equal(p.list.find(c=>c.id==='n').shared,false);assert.equal(p.list.length,3);
 const full=Array.from({length:30},(_,i)=>({id:'k'+i,name:'n',size:4,filled:0,shared:false}));
 const o=t.CF.planImport(full,{clocks:[{id:'k3',name:'changed',size:4,filled:2,shared:false},{id:'new',name:'x',size:4,filled:0,shared:false}]});
 eq(o.rows.map(r=>r.status),['update','overflow']);assert.equal(o.list.length,30);assert.equal(o.overflow,1);
 // a pool survives the trip
 const q=t.CF.planImport([],{clocks:[pool({id:'z'})]});eq(q.list[0].pool,{sides:6,face:1});
});
test('the file flow: open, preview, apply with undo, discard, errors',()=>{
 const t=load();t.GX.writeClocks(t.st,[{id:'a',name:'Мои',size:6,filled:1,shared:false}]);
 const text=JSON.stringify({format:'nightcity-red-clocks',version:1,clocks:[{id:'a',name:'Мои',size:6,filled:3},{id:'b',name:'Б',size:4,filled:0}]});
 t.CF.openFile(text);
 let html=t.GX.render('ru');assert.ok(html.includes('data-cf-preview')&&html.includes('Новых: 1, обновится: 1')&&html.includes('data-cf-action="apply"'));
 t.CF.act('apply',{dataset:{}},'ru');
 eq(t.clocks().map(c=>[c.id,c.filled]),[['a',3],['b',0]]);assert.match(t.notices.at(-1),/Импортировано часов: новых 1, обновлено 1/);
 assert.ok(!t.GX.render('ru').includes('data-cf-preview'));
 t.actions.at(-1).run();eq(t.clocks().map(c=>[c.id,c.filled]),[['a',1]]);assert.match(t.notices.at(-1),/Импорт отменён/);
 // an undo after later changes is refused, nothing is lost
 t.CF.openFile(text);t.CF.act('apply',{dataset:{}},'ru');const undo=t.actions.at(-1).run;t.click({gxAction:'plus',gxId:'a'});undo();
 assert.equal(t.clocks().length,2);assert.match(t.notices.at(-1),/Отменить не удалось/);
 // discard and errors
 t.CF.openFile(text);t.CF.act('discard',{dataset:{}},'ru');assert.equal(t.CF._test.ui().preview,null);
 t.CF.openFile('nope');html=t.GX.render('ru');assert.ok(html.includes('role="alert"')&&html.includes('это не JSON'));
 t.CF.openFile('{"format":"nightcity-red-clocks","version":9,"clocks":[]}');assert.ok(t.GX.render('en').includes('newer version'));
 t.CF.reset();assert.ok(!t.GX.render('ru').includes('data-cf-error'));
 // nothing to add: no apply button
 t.CF.openFile(JSON.stringify({format:'nightcity-red-clocks',version:1,clocks:[t.CF.buildFile(t.clocks()).clocks[0]]}));
 html=t.GX.render('ru');assert.ok(html.includes('Нечего добавлять')&&!html.includes('data-cf-action="apply"'));
});
test('export: empty says so, otherwise a file is built and named by the day',()=>{
 const t=load();
 t.CF.act('export',{dataset:{}},'ru');assert.match(t.notices.at(-1),/Часов для экспорта пока нет/);
 t.GX.writeClocks(t.st,[{id:'a',name:'x',size:6,filled:0,shared:false}]);
 // the download itself needs a page; without one it fails softly and says so
 t.CF.act('export',{dataset:{}},'ru');assert.match(t.notices.at(-1),/Не удалось сохранить файл/);
});

// ---------- campaign file keeps pools and timers (idle) ----------
test('the campaign file carries pools and timers of clocks, never a running timer',()=>{
 const win={document:{addEventListener(){},querySelector:()=>null,querySelectorAll:()=>[]},crypto:{randomUUID:()=>'u1'}};
 const ctx={window:win,document:win.document,globalThis:win,Math,Number,String,Array,Object,Set,Map,WeakMap,JSON,Date,Promise,RegExp,Error,Infinity,console,TextEncoder,URL,Blob};
 for(const f of ['beat-chart.js','campaigns.js','gm-tools.js','gm-extras.js','clock-triggers.js','npc-library.js','room-journal.js','rumors.js','campaign-io.js'])vm.runInNewContext(read(f),ctx,{filename:f});
 const IO=win.CampaignIO,st={lang:'ru',characters:[],campaigns:[{id:'c1',name:'Кампания',notes:'',roster:[],round:1,turnIndex:0,rumors:[{id:'r1',text:'Слух',truth:'false',where:'бар',at:5},{id:'bad',text:'',truth:'x'}]}],gmWorkspace:win.GMTools.initial()};
 win.GMExtras.writeClocks(st,[pool({id:'p1',countdown:{ms:60000,end:123456}}),{id:'s1',name:'Сег',size:6,filled:0,shared:false}]);
 const out=IO.buildExport(st);
 const back=IO.parse(JSON.stringify(out));assert.equal(back.ok,true);
 const pc=back.bundle.clocks.find(c=>c.name==='Запас');eq(pc.pool,{sides:6,face:1});eq(pc.countdown,{ms:60000});
 eq(back.bundle.campaigns[0].rumors,[{id:'r1',text:'Слух',truth:'false',where:'бар',at:5}]);
 assert.ok(back.bundle.dropped>=1,'the broken rumor is counted');
});

test('the page loads the new modules before the app and their styles',()=>{
 const html=read('index.html'),at=n=>html.indexOf(`<script src="${n}"></script>`);
 assert.ok(at('clock-triggers.js')>0&&at('clock-file.js')>at('clock-triggers.js')&&at('factions.js')>at('clock-file.js')&&at('rumors.js')>at('factions.js'));
 assert.ok(at('app.js')>at('rumors.js'));
 for(const c of ['clock-file','factions','rumors'])assert.ok(html.includes(`<link rel="stylesheet" href="${c}.css">`)&&fs.existsSync(path.join(dir,c+'.css')));
 for(const f of ['clock-triggers.js','clock-file.js','factions.js','rumors.js','clock-triggers.css','clock-file.css','factions.css','rumors.css'])assert.ok(!read(f).includes('\r'),f+' is LF');
});
test('the texts of the clock file module are the same in both languages',()=>{
 const {CF}=load();
 const walk=(a,b,p='')=>{eq(Object.keys(a).sort(),Object.keys(b).sort(),p);for(const k of Object.keys(a))if(a[k]&&typeof a[k]==='object')walk(a[k],b[k],p+k+'.');else assert.equal(typeof a[k],typeof b[k],p+k)};
 walk(CF.T.ru,CF.T.en);
 for(const k of Object.keys(CF.T.ru).filter(k=>typeof CF.T.ru[k]==='string'))assert.ok(CF.T.ru[k]&&CF.T.en[k],k);
});

// ---------- review fixes ----------
test('crossings: a reminder at the old value does not fire again; the full message only at the top',()=>{
 const {CT}=load();
 const seg=(filled,size=6)=>({id:'a',name:'x',size,filled,triggers:[{at:2,text:'two'},{at:4,text:'four'}]});
 eq(CT.crossings([seg(2)],[seg(3)]),[],'at 2 was passed before');
 eq(CT.crossings([seg(2)],[seg(4)]).map(e=>e.at),[4]);
 eq(CT.crossings([seg(0)],[seg(2)]).map(e=>e.at),[2],'a reminder fires when it is reached');
 const p=(filled)=>pool({size:4,filled,triggers:[{at:3,text:'one left'}]});
 eq(CT.crossings([p(3)],[p(3)]),[]);
 assert.equal(CT.crossings([p(2)],[p(3)]).filter(e=>e.kind==='full').length,0,'one die left is not empty');
 assert.equal(CT.crossings([p(2)],[p(4)]).filter(e=>e.kind==='full').length,1);
 eq(CT.crossings([p(3)],[p(4)]).map(e=>e.kind),['full'],'the reminder at 3 is not repeated');
 const t=load();t.GX.writeClocks(t.st,[pool({size:4,filled:0})]);
 t.click({gxAction:'ct-pool-roll',gxId:'p1'},faces(6,[1,1,1,5]));
 assert.doesNotMatch(t.notices.at(-1),/не осталось кубиков/);
 t.click({gxAction:'ct-pool-roll',gxId:'p1'},faces(6,[1]));
 assert.match(t.notices.at(-1),/не осталось кубиков/);
});
test('the ticker runs only while a timer runs and is picked up again when the tab comes back',()=>{
 const t=load();const now=t.ctx.clock.now;
 t.GX.writeClocks(t.st,[{id:'c1',name:'T',size:6,filled:0,shared:false,countdown:{ms:600000}}]);
 assert.equal(t.CT._test.timer(),null);
 t.click({gxAction:'ct-cd-toggle',gxId:'c1'});
 assert.notEqual(t.CT._test.timer(),null,'starting a timer starts the ticker');
 t.CT.tick(now+1000);assert.notEqual(t.CT._test.timer(),null);assert.equal(t.cleared.length,0);
 t.click({gxAction:'ct-cd-toggle',gxId:'c1'});
 t.CT.tick(now+2000);assert.equal(t.CT._test.timer(),null,'nothing runs: the ticker stops');assert.equal(t.cleared.length,1);
 t.GX.writeClocks(t.st,[{id:'c1',name:'T',size:6,filled:0,shared:false,countdown:{ms:600000,end:now-5}}]);
 assert.ok(t.listeners.visibilitychange&&t.listeners.visibilitychange.length,'the page listens for the tab coming back');
 for(const fn of t.listeners.visibilitychange)fn();
 eq(t.clocks()[0].countdown,{ms:600000,done:true});assert.match(t.notices.at(-1),/Время вышло/);
 t.GX.writeClocks(t.st,[{id:'c1',name:'T',size:6,filled:0,shared:false,countdown:{ms:600000,end:now-5}}]);
 t.document.visibilityState='hidden';for(const fn of t.listeners.visibilitychange)fn();
 assert.equal(t.clocks()[0].countdown.done,undefined);
});
test('an expired timer is shown as finished in place, not by drawing the card again',()=>{
 const t=load();const now=t.ctx.clock.now;
 t.GX.writeClocks(t.st,[{id:'c1',name:'T',size:6,filled:0,shared:false,countdown:{ms:600000,end:now-1}}]);
 const cls=new Set(),word={textContent:'идёт'},btn={textContent:'Пауза'};
 const time={textContent:'9:59',parentNode:{classList:{add:c=>cls.add(c)},querySelector:q=>q==='.ct-cdword'?word:q.includes('ct-cd-toggle')?btn:null}};
 t.nodes['[data-ct-time="c1"]']=time;
 t.CT.tick(now);
 assert.equal(t.refreshed(),0);assert.equal(time.textContent,'0:00');assert.ok(cls.has('done'));assert.equal(word.textContent,'время вышло');assert.equal(btn.textContent,'Старт заново');
});
test('a timer length that does not fit keeps the timer and says so; an empty field removes it',()=>{
 const t=load();const now=t.ctx.clock.now;
 t.GX.writeClocks(t.st,[{id:'c1',name:'T',size:6,filled:0,shared:false,countdown:{ms:600000,end:now+300000}}]);
 for(const v of ['20000','0','99999','abc','-5']){
  t.change({gxField:'ct-cd-min',gxId:'c1'},v);
  eq(t.clocks()[0].countdown,{ms:600000,end:now+300000},'kept for '+v);assert.match(t.notices.at(-1),/от 1 до 10080 минут/);
 }
 t.change({gxField:'ct-cd-min',gxId:'c1'},'15');eq(t.clocks()[0].countdown,{ms:900000});
 t.change({gxField:'ct-cd-min',gxId:'c1'},'');assert.equal(t.clocks()[0].countdown,undefined);
 const en=load({lang:'en'});en.GX.writeClocks(en.st,[{id:'c1',name:'T',size:6,filled:0,shared:false,countdown:{ms:600000}}]);
 en.change({gxField:'ct-cd-min',gxId:'c1'},'0');assert.match(en.notices.at(-1),/1 to 10080 minutes/);
});
test('importing a clock you have keeps its running timer when the length is the same',()=>{
 const t=load();const now=t.ctx.clock.now;
 const mine=[{id:'a',name:'Мои',size:6,filled:1,shared:true,countdown:{ms:600000,end:now+1000}}];
 const same=t.CF.planImport(mine,{clocks:[{id:'a',name:'Новые',size:6,filled:2,shared:false,countdown:{ms:600000}}]});
 eq(same.list[0].countdown,{ms:600000,end:now+1000});
 const other=t.CF.planImport(mine,{clocks:[{id:'a',name:'Новые',size:6,filled:2,shared:false,countdown:{ms:900000}}]});
 eq(other.list[0].countdown,{ms:900000});
});
test('pool card: minus removes a die and plus puts it back, with a visible caption',()=>{
 const t=load();t.GX.writeClocks(t.st,[pool({size:4,filled:0})]);
 const html=t.GX.render('ru');
 assert.match(html,/data-gx-action="plus"[^>]*aria-label="Убрать кубик">−</,'the minus sign takes a die out');
 assert.match(html,/data-gx-action="minus"[^>]*aria-label="Вернуть кубик">\+</);
 assert.match(html,/4\/4<small class="gx-cap"> осталось<\/small>/);
 t.click({gxAction:'plus',gxId:'p1'});assert.equal(t.clocks()[0].filled,1);
 t.click({gxAction:'minus',gxId:'p1'});assert.equal(t.clocks()[0].filled,0);
 const seg=load();seg.GX.writeClocks(seg.st,[{id:'s',name:'x',size:6,filled:0,shared:false}]);
 assert.match(seg.GX.render('ru'),/data-gx-action="minus"[^>]*>−</);
});
test('the hub shows the factions and rumors cards',()=>{
 const src=read('gm-extras.js');
 assert.ok(src.includes('window.Factions?.render?.(l)')&&src.includes('window.Rumors?.render?.(l)'));
});
