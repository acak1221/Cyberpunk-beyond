// Clocks with triggers: reminders, a die, a link to the rounds of a campaign, and the promise that
// the reminder texts never leave the GM's device.
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const dir=path.join(__dirname,'../site'),read=f=>fs.readFileSync(path.join(dir,f),'utf8');
const plain=x=>JSON.parse(JSON.stringify(x));
const eq=(a,b,m)=>assert.deepEqual(plain(a),plain(b),m);
function seq(values){let i=0;return ()=>values[i++%values.length]}

// One page with the real clocks module and this feature, and an app stub that records what it is told.
function load({lang='ru',withTriggers=true,state,document}={}){
 const st=state||{lang,campaigns:[{id:'k1',name:'Job <i>'},{id:'k2',name:'Other'}]},notices=[],actions=[];let saves=0;
 const window={App:{getState:()=>st,save:()=>{saves++},lang:()=>st.lang,notify:m=>notices.push(m),notifyAction:(m,label,run)=>{notices.push(m);actions.push({label,run})}}};
 const context={window,Math,Number,String,Array,Object,Set,Map,Infinity,JSON,Date,...(document?{document}:{})};
 for(const f of ['gm-extras.js',...(withTriggers?['clock-triggers.js']:[])])vm.runInNewContext(read(f),context,{filename:f});
 const root={dataset:{lang},querySelector:()=>null,isConnected:true,outerHTML:''};
 const click=(ds,rng)=>{const b={dataset:ds,closest:s=>s==='[data-gx-root]'?root:b};return window.GMExtras.handle({type:'click',target:b},lang,rng)};
 const change=(ds,value)=>window.GMExtras.handle({type:'change',target:{dataset:ds,value,closest:()=>root}},lang);
 return {window,GX:window.GMExtras,CT:window.ClockTriggers,st,notices,actions,root,click,change,saves:()=>saves,clock:i=>st.gmExtras.clocks[i||0]};
}
const base=(over={})=>({id:'c1',name:'Тревога',size:6,filled:0,shared:false,...over});

test('cleanExtra rebuilds the three fields from known keys and drops garbage',()=>{
 const {CT}=load();
 assert.equal(CT.cleanExtra({id:'a',name:'old',size:6,filled:1,shared:true},6),null,'a clock from before the feature has no extras');
 for(const bad of [null,7,'x',[1],{triggers:'x',die:5,tick:[]},{triggers:[],die:{sides:5},tick:{camp:''}}])assert.equal(CT.cleanExtra(bad,6),null);
 const x=CT.cleanExtra({triggers:[{at:2,text:'  Копы\n едут  ',evil:'<script>'},{at:99,text:'x'.repeat(500)},{at:0,text:'zero'},{at:'3',text:42},{at:1.5,text:'half'},null,'x',{at:1},{at:2},{at:3},{at:4},{at:5}],
  die:{sides:6,need:4,extra:1},tick:{camp:'k1',hist:[1,2.5,'3',-1,10000,4],secret:'x'},other:'no'},6);
 eq(Object.keys(x),['triggers','die','tick']);
 assert.equal(x.triggers.length,6,'at most six reminders');
 eq(x.triggers.slice(0,3),[{at:2,text:'Копы едут'},{at:6,text:'x'.repeat(160)},{at:3,text:''}]);
 eq(x.die,{sides:6,need:4});eq(x.tick,{camp:'k1',hist:[1,4]});
 eq(CT.cleanExtra({die:{sides:5,need:2}},6),null);
 eq(CT.cleanExtra({die:{sides:4,need:1}},6),{die:{sides:4,need:0}});eq(CT.cleanExtra({die:{sides:4,need:5}},6),{die:{sides:4,need:0}});eq(CT.cleanExtra({die:{sides:10,need:10}},6),{die:{sides:10,need:10}});
 eq(CT.cleanExtra({tick:{camp:7}},6),null);eq(CT.cleanExtra({tick:{camp:'x'.repeat(81)}},6),null);eq(CT.cleanExtra({tick:{camp:'a\u0000b'}},6),null);
 assert.equal(CT.cleanExtra({tick:{camp:'k',hist:Array.from({length:30},(_,i)=>i+1)}},6).tick.hist.length,12);
});

test('old data stays as it was; new fields survive a write and a read',()=>{
 const {GX}=load();
 const old={gmExtras:{clocks:[{id:'a',name:'Old',size:6,filled:2,shared:true}]}};
 eq(GX.readClocks(old),[{id:'a',name:'Old',size:6,filled:2,shared:true}]);
 const st={};GX.writeClocks(st,[base({triggers:[{at:2,text:'x'}],die:{sides:6,need:0},tick:{camp:'k1',hist:[2]}})]);
 eq(GX.readClocks(st),[{id:'c1',name:'Тревога',size:6,filled:0,shared:false,triggers:[{at:2,text:'x'}],die:{sides:6,need:0},tick:{camp:'k1',hist:[2]}}]);
 // a page without the module behaves as before the feature
 const lone=load({withTriggers:false});
 eq(lone.GX.readClocks({gmExtras:{clocks:[base({triggers:[{at:1,text:'x'}]})]}}),[base()]);
 assert.ok(lone.GX.render('ru').includes('ЧАСЫ ПРОГРЕССА'));
});

test('the reminder texts are not in what goes to the room',()=>{
 const {GX,st}=load();
 GX.writeClocks(st,[base({shared:true,filled:3,triggers:[{at:1,text:'СЕКРЕТ-ТРИГГЕР'}],die:{sides:6,need:0},tick:{camp:'k1',hist:[2]}})]);
 const shared=GX.sharedClocks(st);
 assert.equal(shared.length,1);eq(Object.keys(shared[0]).sort(),['filled','name','size']);
 assert.ok(!JSON.stringify(shared).includes('СЕКРЕТ'));assert.ok(!JSON.stringify(shared).includes('k1'));
});

test('crossings: each reminder comes up once on the way up, "full" on the step that fills the clock',()=>{
 const {CT}=load();
 const c=f=>[base({filled:f,triggers:[{at:4,text:'Второй'},{at:2,text:'Первый'},{at:6,text:''}]})];
 eq(CT.crossings(c(0),c(5)).map(e=>[e.kind,e.at,e.text]),[['trigger',2,'Первый'],['trigger',4,'Второй']]);
 eq(CT.crossings(c(2),c(3)),[]);eq(CT.crossings(c(5),c(1)),[]);eq(CT.crossings(c(4),c(4)),[]);
 eq(CT.crossings(c(5),c(6)).map(e=>e.kind),['trigger','full']);eq(CT.crossings(c(6),c(6)),[]);
 eq(CT.crossings([],c(6)),[],'a clock that was not there before is not a clock that moved');
 const ru=CT.message(CT.crossings(c(0),c(6)),'ru'),en=CT.message(CT.crossings(c(0),c(6)),'en');
 assert.equal(ru,'Часы «Тревога» дошли до 2: Первый · Часы «Тревога» дошли до 4: Второй · Часы «Тревога» дошли до 6. · Часы «Тревога» заполнены.');
 assert.equal(en,'Clock “Тревога” reached 2: Первый · Clock “Тревога” reached 4: Второй · Clock “Тревога” reached 6. · Clock “Тревога” is full.');
 assert.equal(CT.message([{kind:'full',id:'x',name:''}],'en'),'Clock “Untitled” is full.');
 const long=CT.message(Array.from({length:9},()=>({kind:'trigger',id:'x',name:'n'.repeat(60),at:1,text:'t'.repeat(160)})),'ru');
 assert.equal(long.length,400);assert.equal(CT.message([],'ru'),'');
});

test('the die: all that was rolled, or one segment on N+; never past the last segment',()=>{
 const {CT}=load();
 eq(CT.rollAdvance(base({die:{sides:6,need:0}}),()=>0.5),{roll:4,sides:6,need:0,add:4});
 eq(CT.rollAdvance(base({filled:4,die:{sides:6,need:0}}),()=>0.99),{roll:6,sides:6,need:0,add:2});
 eq(CT.rollAdvance(base({die:{sides:6,need:4}}),()=>0.5).add,1);eq(CT.rollAdvance(base({die:{sides:6,need:4}}),()=>0.4).add,0);
 eq(CT.rollAdvance(base({filled:6,die:{sides:6,need:0}}),()=>0.5).add,0);
 eq(CT.rollAdvance(base({die:{sides:10,need:0}}),()=>1).roll,1,'a broken generator gives a 1, not a number off the die');
 for(let i=0;i<50;i++){const r=CT.rollAdvance(base({die:{sides:4,need:0}}),Math.random);assert.ok(r.roll>=1&&r.roll<=4)}
});

test('rolling the die from the card: saved, announced with the reminder, and the undo puts the segments back',()=>{
 const h=load();h.GX.writeClocks(h.st,[base({filled:1,triggers:[{at:3,text:'Копы'}],die:{sides:6,need:0}})]);
 assert.ok(h.root.outerHTML===''&&h.GX.render('ru').includes('data-gx-action="ct-roll"'));
 assert.equal(h.click({gxAction:'ct-roll',gxId:'c1'},seq([0.5])),true);
 assert.equal(h.clock().filled,5);assert.equal(h.saves(),1);
 assert.equal(h.notices[0],'Тревога: Выпало 4 — +4 сегмента · Часы «Тревога» дошли до 3: Копы');assert.equal(h.actions[0].label,'Отменить');
 assert.match(h.root.outerHTML,/class="ct-last">Выпало 4 — \+4 сегмента</);
 h.actions[0].run();assert.equal(h.clock().filled,1);assert.equal(h.notices.at(-1),'Бросок отменён.');
 // the undo of an older roll does nothing once the clock has moved on
 h.click({gxAction:'ct-roll',gxId:'c1'},seq([0]));assert.equal(h.clock().filled,2);
 h.click({gxAction:'plus',gxId:'c1'});assert.equal(h.clock().filled,3);
 h.actions.at(-1).run();assert.equal(h.clock().filled,3);
 // "one segment on 5+": a low roll leaves the clock alone and offers nothing to undo
 h.change({gxField:'ct-need',gxId:'c1'},'5');eq(h.clock().die,{sides:6,need:5});
 const n=h.actions.length;h.click({gxAction:'ct-roll',gxId:'c1'},seq([0.1]));
 assert.equal(h.clock().filled,3);assert.equal(h.actions.length,n);assert.equal(h.notices.at(-1),'Тревога: Выпало 1 — часы стоят (нужно 5+)');
 h.click({gxAction:'ct-roll',gxId:'c1'},seq([0.9]));assert.equal(h.clock().filled,4);
 // a full clock cannot be rolled
 h.click({gxAction:'reset',gxId:'c1'});h.click({gxAction:'seg',gxId:'c1',gxSeg:'5'});assert.equal(h.clock().filled,6);
 assert.match(h.root.outerHTML,/data-gx-action="ct-roll" data-gx-id="c1" aria-disabled="true">/,'still focusable: a disabled button would drop the keyboard focus');
 const before=h.actions.length;h.click({gxAction:'ct-roll',gxId:'c1'},seq([0.9]));assert.equal(h.clock().filled,6);assert.equal(h.actions.length,before);assert.equal(h.notices.at(-1),'Часы «Тревога» заполнены.');
});

test('a click on the clock itself brings the reminder up too',()=>{
 const h=load({lang:'en'});h.GX.writeClocks(h.st,[base({size:4,triggers:[{at:2,text:'Backup <b>'}]})]);
 h.click({gxAction:'plus',gxId:'c1'});eq(h.notices,[]);
 h.click({gxAction:'plus',gxId:'c1'});eq(h.notices,['Clock “Тревога” reached 2: Backup <b>']);
 assert.match(h.root.outerHTML,/class="ct-fired"[^>]*><li><b>2<\/b><span>Backup &lt;b&gt;<\/span>/);
 h.click({gxAction:'minus',gxId:'c1'});assert.equal(h.notices.length,1);assert.ok(!h.root.outerHTML.includes('ct-fired'));
 h.click({gxAction:'seg',gxId:'c1',gxSeg:'3'});assert.equal(h.notices.at(-1),'Clock “Тревога” reached 2: Backup <b> · Clock “Тревога” is full.');
 // a throwing notice never stops the change from being saved
 h.window.App.notify=()=>{throw new Error('no box')};h.click({gxAction:'reset',gxId:'c1'});h.click({gxAction:'seg',gxId:'c1',gxSeg:'3'});assert.equal(h.clock().filled,4);
});

test('rounds: one segment per new round of the linked campaign, and the step back returns it',()=>{
 const {CT}=load();
 const list=[base({tick:{camp:'k1',hist:[]}}),base({id:'c2',tick:{camp:'k2',hist:[]}}),base({id:'c3'}),base({id:'c4',filled:6,tick:{camp:'k1',hist:[]}})];
 let r=CT.tickForward(list,'k1',2);eq(r.ticked,['c1']);eq(r.clocks.map(c=>c.filled),[1,0,0,6]);eq(r.clocks[0].tick.hist,[2]);eq(r.clocks[3].tick.hist,[],'a full clock notes nothing');
 r=CT.tickForward(r.clocks,'k1',3);eq(r.clocks[0].filled,2);eq(r.clocks[0].tick.hist,[2,3]);
 let b=CT.tickBack(r.clocks,'k1',3);eq(b.ticked,['c1']);eq(b.clocks[0].filled,1);eq(b.clocks[0].tick.hist,[2]);
 eq(CT.tickBack(b.clocks,'k1',3).ticked,[],'a round that gave nothing takes nothing');
 eq(CT.tickBack([base({filled:0,tick:{camp:'k1',hist:[5]}})],'k1',5).clocks[0].filled,0);
 // a new combat counts its rounds from 1 again
 const stale=CT.tickForward([base({filled:3,tick:{camp:'k1',hist:[2,3,4]}})],'k1',2);eq(stale.clocks[0].filled,4);eq(stale.clocks[0].tick.hist,[2],'the rounds of the old combat are forgotten');
 let many=[base({size:12,tick:{camp:'k1',hist:[]}})];for(let i=2;i<=40;i++)many=CT.tickForward(many,'k1',i).clocks;assert.equal(many[0].tick.hist.length,12);assert.equal(many[0].filled,12);
});

test('round(): the hook of the tracker changes the clocks, says so once and can never throw',()=>{
 const h=load();h.GX.writeClocks(h.st,[base({size:4,filled:2,triggers:[{at:3,text:'Подкрепление'},{at:4,text:'Взрыв'}],tick:{camp:'k1',hist:[]}}),base({id:'c2',name:'Чужие',tick:{camp:'k2',hist:[]}})]);
 let ev=h.CT.round('k1',1,2);
 eq(ev.map(e=>e.kind),['tick','trigger']);eq(h.notices,['Раунд 2: часы «Тревога» — 3/4 · Часы «Тревога» дошли до 3: Подкрепление']);
 assert.equal(h.clock(0).filled,3);assert.equal(h.clock(1).filled,0);
 ev=h.CT.round('k1',2,3);eq(ev.map(e=>e.kind),['tick','trigger','full']);assert.equal(h.notices.length,2);
 eq(h.CT.round('k1',3,4),[],'a full clock stays full and silent');assert.equal(h.notices.length,2);
 eq(h.CT.round('k1',4,3),[]);assert.equal(h.clock(0).filled,4,'round 4 gave nothing, so nothing is taken back');
 h.CT.round('k1',3,2);assert.equal(h.clock(0).filled,3);h.CT.round('k1',2,1);assert.equal(h.clock(0).filled,2);eq(h.clock(0).tick.hist,[]);
 assert.equal(h.notices.length,2,'stepping back says nothing');
 for(const bad of [[null,1,2],['k1','1',2],['k1',2,2],['nope',1,2]])eq(h.CT.round(...bad),[]);
 h.window.App.notify=()=>{throw new Error('boom')};assert.doesNotThrow(()=>h.CT.round('k1',1,2));assert.equal(h.clock(0).filled,3);
 h.window.App.getState=()=>{throw new Error('boom')};eq(h.CT.round('k1',2,3),[]);
});

test('the settings panel: reminders, the die and the combat link are edited in the card',()=>{
 const h=load();h.GX.writeClocks(h.st,[base({filled:1})]);
 let html=h.GX.render('ru');
 assert.match(html,/data-gx-action="ct-open" data-gx-id="c1" aria-expanded="false"><span>▸ Триггеры и автоход<\/span><small>не настроены</);assert.ok(!html.includes('ct-panel'));
 assert.equal(h.click({gxAction:'ct-open',gxId:'c1'}),true);
 assert.match(h.root.outerHTML,/aria-expanded="true" aria-controls="ct-panel-c1"/);assert.match(h.root.outerHTML,/id="ct-panel-c1" role="group" aria-label="Триггеры и автоход: Тревога"/);
 assert.match(h.root.outerHTML,/Тексты напоминаний видите только вы/);
 h.click({gxAction:'ct-add-trig',gxId:'c1'});eq(h.clock().triggers,[{at:2,text:''}],'the new reminder waits at the next segment');
 h.click({gxAction:'ct-add-trig',gxId:'c1'});eq(h.clock().triggers.map(x=>x.at),[2,3]);
 // the text saves without drawing the card again, a select draws it again
 h.root.outerHTML='untouched';assert.equal(h.change({gxField:'ct-text',gxId:'c1',gxSeg:'1'},'  Копы <i>едут</i> '),true);
 assert.equal(h.clock().triggers[1].text,'Копы <i>едут</i>');assert.equal(h.root.outerHTML,'untouched');
 assert.equal(h.change({gxField:'ct-at',gxId:'c1',gxSeg:'1'},'5'),true);eq(h.clock().triggers[1],{at:5,text:'Копы <i>едут</i>'});
 assert.match(h.root.outerHTML,/value="Копы &lt;i&gt;едут&lt;\/i&gt;"/);assert.ok(!h.root.outerHTML.includes('<i>'));
 assert.match(h.root.outerHTML,/data-gx-field="ct-at" data-gx-id="c1" data-gx-seg="1" aria-label="На каком сегменте">.*<option value="5" selected>5\/6</);
 h.change({gxField:'ct-at',gxId:'c1',gxSeg:'1'},'99');assert.equal(h.clock().triggers[1].at,5,'a segment off the clock is refused');
 h.change({gxField:'ct-at',gxId:'c1',gxSeg:'7'},'2');h.change({gxField:'ct-text',gxId:'c1',gxSeg:'7'},'x');assert.equal(h.clock().triggers.length,2,'a row that is not there changes nothing');
 eq(h.notices,[],'editing reminders announces nothing');
 // delete and undo
 h.click({gxAction:'ct-del-trig',gxId:'c1',gxSeg:'0'});eq(h.clock().triggers,[{at:5,text:'Копы <i>едут</i>'}]);assert.equal(h.notices.at(-1),'Напоминание удалено.');
 h.actions.at(-1).run();eq(h.clock().triggers.map(x=>x.at),[2,5]);assert.equal(h.notices.at(-1),'Напоминание возвращено.');
 // no more than six
 for(let i=0;i<8;i++)h.click({gxAction:'ct-add-trig',gxId:'c1'});assert.equal(h.clock().triggers.length,6);
 assert.match(h.root.outerHTML,/data-gx-action="ct-add-trig" data-gx-id="c1" aria-disabled="true">/);assert.match(h.root.outerHTML,/Не больше 6 напоминаний на часы\./);
 assert.equal(h.notices.at(-1),'Не больше 6 напоминаний на часы.','a press on the button that cannot add says why');
 assert.ok(!/data-gx-action="ct-[a-z-]+"[^>]* disabled/.test(h.root.outerHTML),'no control of the panel is ever disabled outright');
 // the die
 assert.ok(!h.root.outerHTML.includes('ct-need'));
 h.change({gxField:'ct-die',gxId:'c1'},'10');eq(h.clock().die,{sides:10,need:0});assert.match(h.root.outerHTML,/Бросить d10/);assert.match(h.root.outerHTML,/1 сегмент при 10\+/);
 h.change({gxField:'ct-need',gxId:'c1'},'8');h.change({gxField:'ct-die',gxId:'c1'},'6');eq(h.clock().die,{sides:6,need:0},'a threshold the smaller die cannot reach is dropped');
 h.change({gxField:'ct-die',gxId:'c1'},'7');assert.equal(h.clock().die,undefined);
 // the combat link
 h.change({gxField:'ct-camp',gxId:'c1'},'k1');eq(h.clock().tick,{camp:'k1',hist:[]});
 assert.match(h.root.outerHTML,/<option value="k1" selected>Job &lt;i&gt;<\/option>/);assert.match(h.root.outerHTML,/напоминаний: 6 · бой: Job &lt;i&gt;</);
 h.st.gmExtras.clocks[0].tick.hist=[2];h.change({gxField:'ct-camp',gxId:'c1'},'k1');eq(h.clock().tick.hist,[2],'choosing the same campaign again keeps what it has noted');
 h.change({gxField:'ct-camp',gxId:'c1'},'unknown');assert.equal(h.clock().tick,undefined);
 h.change({gxField:'ct-camp',gxId:'c1'},'k2');h.change({gxField:'ct-camp',gxId:'c1'},'');assert.equal(h.clock().tick,undefined);
 // a link to a campaign that is gone reads as no link
 h.st.gmExtras.clocks[0].tick={camp:'gone',hist:[]};assert.match(h.GX.render('ru'),/<option value="" *>Не связаны с боем<\/option><option value="k1">/);
 assert.equal(h.click({gxAction:'ct-open',gxId:'c1'}),true);assert.ok(!h.root.outerHTML.includes('ct-panel'));
 assert.equal(h.click({gxAction:'ct-nope',gxId:'c1'}),false);assert.equal(h.change({gxField:'ct-nope',gxId:'c1'},'1'),false);assert.equal(h.change({gxField:'other'},'1'),false);
});

test('the card and the tracker strip in both languages; what is still ahead is not on the tracker',()=>{
 const h=load({lang:'en'});h.GX.writeClocks(h.st,[base({filled:2,triggers:[{at:1,text:'Was <b>'},{at:2,text:'Latest'},{at:2,text:''},{at:5,text:'AHEAD-SECRET'}],die:{sides:4,need:3},tick:{camp:'k1',hist:[]}}),base({id:'c2',name:'',size:4,filled:4,tick:{camp:'k1',hist:[]}}),base({id:'c3',name:'Free'}),base({id:'c5',name:'N <i>',filled:1,triggers:[{at:1,text:'<b>x</b> & "q"'}],tick:{camp:'k1',hist:[]}})]);
 const card=h.CT.cardHTML(h.GX.readClocks(h.st)[0],'en');
 assert.match(card,/Roll d4/);assert.match(card,/reminders: 4 · d4 · combat: Job &lt;i&gt;/);assert.match(card,/aria-label="Reminders that have come up"><li><b>1<\/b><span>Was &lt;b&gt;<\/span><\/li><li><b>2<\/b><span>Latest<\/span><\/li><\/ul>/);
 assert.ok(!card.includes('AHEAD-SECRET'),'a closed card does not show what is ahead');
 assert.match(h.CT.cardHTML(h.GX.readClocks(h.st)[0],'ru'),/Бросить d4/);
 assert.equal(h.CT.cardHTML(null,'en'),'');
 const strip=h.CT.trackerHTML({id:'k1'},'en');
 assert.match(strip,/^<div class="ct-strip" role="group" aria-label="Combat clocks">/);assert.match(strip,/<b>Тревога<\/b><span class="ct-strip-count">2\/6<\/span><span class="ct-dots" aria-hidden="true">●●○○○○<\/span><span class="ct-strip-note">Latest<\/span>/);
 assert.match(strip,/class="ct-strip-clock full"><b>Untitled<\/b><span class="ct-strip-count">4\/4<\/span>.*<span class="ct-badge">Full<\/span>/);
 assert.match(strip,/<b>N &lt;i&gt;<\/b>.*<span class="ct-strip-note">&lt;b&gt;x&lt;\/b&gt; &amp; &quot;q&quot;<\/span>/,'a reminder text is drawn as text on the tracker');assert.ok(!strip.includes('<b>x')&&!strip.includes('<i>'));
 assert.ok(!strip.includes('AHEAD-SECRET'));assert.ok(!strip.includes('Free'));assert.ok(!/<button|<select|<input/.test(strip));
 assert.match(h.CT.trackerHTML({id:'k1'},'ru'),/aria-label="Часы боя"/);assert.match(h.CT.trackerHTML({id:'k1'},'ru'),/Заполнено/);
 assert.equal(h.CT.trackerHTML({id:'k2'},'en'),'');assert.equal(h.CT.trackerHTML(null,'en'),'');assert.equal(h.CT.trackerHTML({id:7},'en'),'');
});

// ---- the tracker calls the hook at the round boundary ----
function tracker({withHook=true,hook}={}){
 const calls=[],window=hook?{ClockTriggers:hook}:withHook?{ClockTriggers:{round:(...a)=>calls.push(a),restart:id=>calls.push(['restart',id]),trackerHTML:(c,l)=>`<div class="ct-strip" data-for="${c.id}" data-lang="${l}"></div>`}}:{};
 const campaign={id:'c',name:'Job',notes:'',round:1,turnIndex:0,roster:[{id:'a',kind:'npc',name:'A',hp:10,ref:6,initiative:9,order:1},{id:'b',kind:'npc',name:'B',hp:5,ref:5,initiative:4,order:2}]};
 const ctx={lang:'ru',campaigns:[campaign],characters:[],isCurrent:x=>x===campaign,scope:'account',save(){},render(){},notify(){}};
 vm.runInNewContext(read('campaigns.js'),{window,document:{querySelector:()=>null},confirm:()=>true,Math,Date,globalThis:{crypto:{randomUUID:()=>'u'}}});
 const act=name=>window.Campaigns.handle({type:'click',target:{closest:()=>({dataset:{campaignAction:name}})}},ctx);
 window.Campaigns.handle({type:'click',target:{closest:()=>({dataset:{campaignAction:'open',id:'c'}})}},ctx);
 return {C:window.Campaigns,ctx,campaign,act,calls};
}
test('campaigns.js tells the clocks about a new round and about a step back over it',()=>{
 const h=tracker();
 h.act('next');eq(h.calls,[],'a turn inside the round is not a new round');
 h.act('next');eq(h.calls,[['c',1,2]]);assert.equal(h.campaign.round,2);
 h.act('next');eq(h.calls.length,1);
 h.act('prev');eq(h.calls.length,1,'a step back inside the round');
 h.act('prev');eq(h.calls,[['c',1,2],['c',2,1]]);assert.equal(h.campaign.round,1);
 const html=h.C.render([h.campaign],[],'ru');
 assert.match(html,/<\/div><div class="ct-strip" data-for="c" data-lang="ru"><\/div><div class="combat-list">/,'the strip sits between the controls and the list');
 // without the module the tracker works as before
 const lone=tracker({withHook:false});lone.act('next');lone.act('next');assert.equal(lone.campaign.round,2);lone.act('prev');assert.equal(lone.campaign.round,1);
 assert.ok(!lone.C.render([lone.campaign],[],'ru').includes('ct-strip'));
});

test('a new combat: reset and "roll for everyone" tell the clocks, and round 2 ticks again',()=>{
 const s=tracker();
 s.act('next');s.act('next');s.act('reset');eq(s.calls,[['c',1,2],['restart','c']]);assert.equal(s.campaign.round,1);
 s.act('next');s.act('next');s.act('roll-all');eq(s.calls.slice(2),[['c',1,2],['restart','c']]);assert.equal(s.campaign.round,1);
 // the pure rules
 const {CT}=load();
 const f=CT.forget([base({filled:3,tick:{camp:'k1',hist:[2]}}),base({id:'c2',filled:2,tick:{camp:'k2',hist:[2]}}),base({id:'c3'}),base({id:'c4',tick:{camp:'k1',hist:[]}})],'k1');
 assert.equal(f.any,true);eq(f.clocks.map(c=>c.tick?.hist),[[],[2],undefined,[]]);eq(f.clocks.map(c=>c.filled),[3,2,0,0],'the segments stay');
 assert.equal(CT.forget(f.clocks,'k1').any,false);
 // even when nobody said that the combat started over, the round entered again ticks, and the
 // step back takes exactly that segment
 let r=CT.tickForward([base({filled:1,tick:{camp:'k1',hist:[2]}})],'k1',2);eq(r.ticked,['c1']);assert.equal(r.clocks[0].filled,2);eq(r.clocks[0].tick.hist,[2]);
 r=CT.tickBack(r.clocks,'k1',2);assert.equal(r.clocks[0].filled,1);eq(r.clocks[0].tick.hist,[]);
 // the real tracker with the real clocks: the previous fight ended in round 2
 const h=load();h.GX.writeClocks(h.st,[base({tick:{camp:'c',hist:[]}})]);
 for(const how of ['reset','roll-all']){
  h.GX.writeClocks(h.st,[base({tick:{camp:'c',hist:[]}})]);
  const t=tracker({hook:h.CT});
  t.act('next');t.act('next');assert.equal(t.campaign.round,2);assert.equal(h.clock().filled,1,how);
  t.act(how);assert.equal(t.campaign.round,1);assert.equal(h.clock().filled,1,'starting over keeps the segments');eq(h.clock().tick.hist,[]);
  // "roll for everyone" may have changed the order: walk to the round boundary whatever it is
  t.act('prev');assert.equal(h.clock().filled,1,'nothing to take back in round 1');
  while(t.campaign.round<2)t.act('next');assert.equal(h.clock().filled,2,how+': round 2 of the new combat ticks');
  while(t.campaign.round>1)t.act('prev');assert.equal(h.clock().filled,1,how+': the step back returns the segment of the new combat only');
  while(t.campaign.round<3)t.act('next');assert.equal(h.clock().filled,3);
 }
 // restart() can never throw and ignores what is not a campaign id
 assert.doesNotThrow(()=>{h.CT.restart(null);h.CT.restart('nope')});h.window.App.getState=()=>{throw new Error('boom')};assert.doesNotThrow(()=>h.CT.restart('c'));
});

test('undoing a deleted reminder puts back that one row and keeps what was done since',()=>{
 const h=load();h.GX.writeClocks(h.st,[base({triggers:[{at:1,text:'one'},{at:2,text:'two'},{at:3,text:'three'}]})]);
 h.click({gxAction:'ct-del-trig',gxId:'c1',gxSeg:'1'});const undo=h.actions.at(-1).run;
 h.change({gxField:'ct-text',gxId:'c1',gxSeg:'0'},'one EDITED');h.click({gxAction:'ct-add-trig',gxId:'c1'});h.change({gxField:'ct-text',gxId:'c1',gxSeg:'2'},'brand new');
 eq(h.clock().triggers,[{at:1,text:'one EDITED'},{at:3,text:'three'},{at:2,text:'brand new'}]);
 undo();eq(h.clock().triggers,[{at:1,text:'one EDITED'},{at:2,text:'two'},{at:3,text:'three'},{at:2,text:'brand new'}],'back at its old place, nothing else touched');
 assert.equal(h.notices.at(-1),'Напоминание возвращено.');
 // the list got shorter than the old place: the row goes to the end
 h.GX.writeClocks(h.st,[base({triggers:[{at:1,text:'a'},{at:2,text:'b'},{at:3,text:'c'}]})]);
 h.click({gxAction:'ct-del-trig',gxId:'c1',gxSeg:'2'});const late=h.actions.at(-1).run;
 h.click({gxAction:'ct-del-trig',gxId:'c1',gxSeg:'0'});h.click({gxAction:'ct-del-trig',gxId:'c1',gxSeg:'0'});assert.equal(h.clock().triggers,undefined);
 late();eq(h.clock().triggers,[{at:3,text:'c'}]);
 // six reminders are there again: no room, the list is left alone and the GM is told
 h.GX.writeClocks(h.st,[base({triggers:Array.from({length:6},(_,i)=>({at:i+1,text:'t'+i}))})]);
 h.click({gxAction:'ct-del-trig',gxId:'c1',gxSeg:'5'});const full=h.actions.at(-1).run;h.click({gxAction:'ct-add-trig',gxId:'c1'});
 const six=plain(h.clock().triggers);assert.equal(six.length,6);full();eq(h.clock().triggers,six);assert.equal(h.notices.at(-1),'Не больше 6 напоминаний на часы.');
 // a clock that is gone
 h.click({gxAction:'ct-del-trig',gxId:'c1',gxSeg:'0'});const gone=h.actions.at(-1).run;h.GX.writeClocks(h.st,[]);assert.doesNotThrow(gone);eq(h.GX.readClocks(h.st),[]);
});

test('keyboard focus is never left on the page body after a press',async()=>{
 // A page just deep enough for the focus rules: a list of controls and the element that has the focus.
 const body={},doc={body,activeElement:body,controls:[],addEventListener(){},querySelector:()=>null,querySelectorAll(){return this.controls}};
 const el=(name,seg)=>({dataset:{gxAction:name,gxId:'c1',...(seg===undefined?{}:{gxSeg:String(seg)})},isConnected:true,focus(){doc.activeElement=this},closest:()=>null});
 const other={dataset:{gxAction:'ct-open',gxId:'other'},focus(){doc.activeElement=this}};
 const tick=()=>new Promise(r=>setTimeout(r,0));
 const h=load({document:doc});h.GX.writeClocks(h.st,[base({filled:1,die:{sides:6,need:0},triggers:[{at:1,text:'a'},{at:2,text:'b'}]})]);
 // the last row is deleted: the delete button of the row above takes the focus
 const del0=el('ct-del-trig',0),add=el('ct-add-trig'),open=el('ct-open'),roll=el('ct-roll');
 doc.controls=[other,roll,open,del0,add];
 h.click({gxAction:'ct-del-trig',gxId:'c1',gxSeg:'1'});assert.equal(doc.activeElement,body,'the redraw comes first');
 await tick();assert.equal(doc.activeElement,del0);
 // no rows left: the add button
 doc.activeElement=body;doc.controls=[other,roll,open,add];
 h.click({gxAction:'ct-del-trig',gxId:'c1',gxSeg:'0'});await tick();assert.equal(doc.activeElement,add);
 // a focus that is somewhere is left where it is
 h.GX.writeClocks(h.st,[base({filled:1,die:{sides:6,need:0},triggers:[{at:1,text:'a'},{at:2,text:'b'}]})]);
 doc.activeElement=open;h.click({gxAction:'ct-del-trig',gxId:'c1',gxSeg:'1'});await tick();assert.equal(doc.activeElement,open);
 // the undo buttons live in the notice, which goes away: the focus returns to the card
 const text1=el(undefined,1);text1.dataset={gxField:'ct-text',gxId:'c1',gxSeg:'1'};doc.controls=[other,roll,open,text1,add];
 const notice={isConnected:true,closest:s=>s==='#app-notice'?{}:null};
 doc.activeElement=notice;h.actions.at(-1).run();assert.equal(doc.activeElement,text1,'the row that came back');
 doc.activeElement=body;h.click({gxAction:'ct-roll',gxId:'c1'},seq([0]));assert.equal(h.clock().filled,2);
 doc.activeElement=notice;h.actions.at(-1).run();assert.equal(h.clock().filled,1);assert.equal(doc.activeElement,roll);
 // a closed panel has no row to go to: the toggle of the card
 doc.controls=[other,open];doc.activeElement=body;h.click({gxAction:'ct-del-trig',gxId:'c1',gxSeg:'0'});await tick();assert.equal(doc.activeElement,open);
 // a page that throws from its queries never breaks the press
 doc.querySelectorAll=()=>{throw new Error('boom')};doc.activeElement=body;assert.doesNotThrow(()=>h.click({gxAction:'ct-del-trig',gxId:'c1',gxSeg:'0'}));await tick();
});

// ---- the campaign file ----
function io(state){
 const listeners={};let n=0;
 const document={addEventListener(t,f){(listeners[t]||=[]).push(f)},querySelector:()=>null,querySelectorAll:()=>[]};
 const store=new Map(),storage={getItem:k=>store.has(k)?store.get(k):null,setItem:(k,v)=>store.set(k,String(v)),removeItem:k=>store.delete(k)};
 const window={document,crypto:{randomUUID:()=>'u-'+(++n)},confirm:()=>true,sessionStorage:storage,localStorage:storage};
 const ctx={window,document,globalThis:window,sessionStorage:storage,localStorage:storage,Math,Number,String,Array,Object,Set,Map,WeakMap,JSON,Date,Promise,RegExp,Error,Infinity,setTimeout,clearTimeout,console,TextEncoder,URL,Blob};
 for(const f of ['beat-chart.js','campaigns.js','gm-tools.js','gm-extras.js','clock-triggers.js','npc-library.js','room-journal.js','campaign-io.js'])vm.runInNewContext(read(f),ctx,{filename:f});
 const st=state||{lang:'ru',characters:[],campaigns:[],gmExtras:undefined,gmWorkspace:window.GMTools.initial()};
 window.App={getState:()=>st,lang:()=>st.lang,save:()=>Promise.resolve({ok:true}),render(){},notify(){},findImport:()=>null,importCharacter:()=>({ok:false})};
 return {window,IO:window.CampaignIO,GX:window.GMExtras,st};
}
const deps=x=>({lang:'ru',getState:()=>x.st,findImport:x.window.App.findImport,importCharacter:x.window.App.importCharacter});
test('the campaign file carries reminders and the die, never the combat link; importing twice adds nothing',()=>{
 const from=io();from.st.campaigns=[{id:'k1',name:'Арасака',notes:'',roster:[],round:1,turnIndex:0}];
 from.GX.writeClocks(from.st,[base({shared:true,filled:2,triggers:[{at:3,text:'Копы'}],die:{sides:6,need:4},tick:{camp:'k1',hist:[2]}}),base({id:'c2',name:'Простые',size:4})]);
 const file=from.IO.buildExport(from.st,{});
 eq(file.clocks[0].triggers,[{at:3,text:'Копы'}]);eq(file.clocks[0].die,{sides:6,need:4});
 const text=JSON.stringify(file),to=io(),r=to.IO.parse(text);assert.equal(r.ok,true);
 eq(r.bundle.clocks,[{name:'Тревога',size:6,filled:2,triggers:[{at:3,text:'Копы'}],die:{sides:6,need:4}},{name:'Простые',size:4,filled:0}]);
 const plan=to.IO.plan(r.bundle,to.st,to.IO.defaultSelect(r.bundle),{});eq(plan.clocks.map(c=>c.status),['add','add']);
 const done=to.IO.apply(r.bundle,to.IO.defaultSelect(r.bundle),deps(to));assert.equal(done.ok,true);assert.equal(done.counts.clocks,2);
 const got=to.GX.readClocks(to.st);
 eq(got.map(({id,...c})=>c),[{name:'Тревога',size:6,filled:2,shared:false,triggers:[{at:3,text:'Копы'}],die:{sides:6,need:4}},{name:'Простые',size:4,filled:0,shared:false}]);
 // the GM links the imported clock to a combat; the same file is still recognised as already here
 to.GX.writeClocks(to.st,got.map((c,i)=>i?c:{...c,tick:{camp:to.st.campaigns[0].id,hist:[3]}}));
 const r2=to.IO.parse(text);eq(to.IO.plan(r2.bundle,to.st,to.IO.defaultSelect(r2.bundle),{}).clocks.map(c=>c.status),['same','same']);
 // a hostile file cannot smuggle anything through the new fields
 file.clocks[0].triggers=[{at:1,text:'<img src=x onerror=1>',run:'x'},{at:'x'}];file.clocks[0].die={sides:99};file.clocks[0].tick={camp:'k1',hist:[1]};
 const bad=to.IO.parse(JSON.stringify(file));eq(bad.bundle.clocks[0],{name:'Тревога',size:6,filled:2,triggers:[{at:1,text:'<img src=x onerror=1>'}]});
 // a file made before the feature imports as it always did
 const old=io(),o=old.IO.parse(JSON.stringify({...file,clocks:[{id:'a',name:'Старые',size:8,filled:3,shared:true}]}));
 eq(o.bundle.clocks,[{name:'Старые',size:8,filled:3}]);old.IO.apply(o.bundle,old.IO.defaultSelect(o.bundle),deps(old));
 eq(old.GX.readClocks(old.st).map(({id,...c})=>c),[{name:'Старые',size:8,filled:3,shared:false}]);
});

// ---- the room ----
function room(lang){
 // A document just deep enough for the room's toasts, which are kept so the test can read them.
 const toasts=[],el=()=>({className:'',innerHTML:'',children:[],setAttribute(){},prepend(x){toasts.push(x)},appendChild(){},remove(){},classList:{add(){}}});
 const store=new Map(),document={addEventListener(){},querySelector:()=>null,visibilityState:'visible',createElement:el,body:el()};
 const window={document,localStorage:{getItem:k=>store.has(k)?store.get(k):null,setItem:(k,v)=>store.set(k,String(v)),removeItem:k=>store.delete(k)},crypto:globalThis.crypto,location:{hash:'',origin:'https://example.test',pathname:'/'},addEventListener(){},navigator:{},btoa,atob};
 vm.runInNewContext(read('room-transport.js')+'\n'+read('room.js'),{window,TextEncoder,TextDecoder,Uint8Array,ArrayBuffer,JSON,Math,Date,Number,String,Array,Object,Map,Set,Promise,Error,setTimeout:()=>0,clearTimeout(){},setInterval:()=>0,clearInterval(){},console});
 window.Room.toasts=toasts;
 window.Room._test.setApp({getState:()=>({lang,characters:[],campaigns:[]}),lang:()=>lang});
 return window.Room;
}
test('the room takes only name, size and filled of a clock, whatever else a device sends',()=>{
 const R=room('ru')._test;
 eq(R.cleanClocks([{name:'Тревога',size:4,filled:1,triggers:[{at:1,text:'secret'}],die:{sides:6,need:0},tick:{camp:'k1',hist:[1]},id:'c1',shared:true}]),[{name:'Тревога',size:4,filled:1}]);
});
for(const [lang,word,moved] of [['ru','Счётчик заполнен','Счётчик'],['en','Clock is full','Clock']])test(`players see that a clock has run out (${lang})`,async()=>{
 const Room=room(lang),R=Room._test,derived=await R.deriveRoom('K7RQM2XAPZ9E');R.setKey(derived.key);
 const gm=await R.newIdentity(),gm1=gm.fp+'.000000a1',me=await R.ensureIdentity();
 R.setSession({code:'K7RQM2XAPZ9E',role:'player',name:'V',memberId:me.fp+'.000000b1',gmFp:gm.fp},derived.topic);
 let n=0;const send=async(list,at)=>R.receive({topic:derived.topic+'/k',retain:false,payload:await R.signedEnvelope(gm,gm1,derived.topic,derived.key,'k','clocks',{list},at,'m'+(n++))});
 const now=Date.now();
 await send([{name:'Тревога <b>',size:4,filled:3,triggers:[{at:1,text:'СЕКРЕТ'}]}],now-2000);
 eq(R.state().clocks,[{name:'Тревога <b>',size:4,filled:3}]);
 let html=R.roomView();
 assert.match(html,/<div class="room-clock">/);assert.match(html,/<small>3 \/ 4<\/small>/);assert.ok(!html.includes(word));
 await send([{name:'Тревога <b>',size:4,filled:4}],now-1000);
 html=R.roomView();
 assert.match(html,/<div class="room-clock full">/);assert.ok(html.includes(`<small>4 / 4 · ${word}</small>`));
 assert.ok(!html.includes('СЕКРЕТ'));assert.ok(!html.includes('<b>Тревога <b>'));
 // the toast names the moment too
 const said=Room.toasts.map(x=>x.innerHTML);assert.equal(said.length,2);
 assert.ok(said[0].includes(`<strong>${moved}</strong>`)&&said[0].includes('<b>3/4</b>'),said[0]);assert.ok(said[1].includes(`<strong>${word}</strong>`)&&said[1].includes('Тревога &lt;b&gt;'),said[1]);
});

// ---- registration ----
test('the page loads the module after the clocks and before the app, the styles after the looks; README names the feature',()=>{
 const html=read('index.html');
 const at=s=>{const i=html.indexOf(s);assert.ok(i>=0,s);return i};
 assert.ok(at('<script src="gm-extras.js"></script>')<at('<script src="clock-triggers.js"></script>'));
 assert.ok(at('<script src="clock-triggers.js"></script>')<at('<script src="app.js"></script>'));
 for(const look of ['theme.css','light.css','board.css','gm-extras.css','room.css'])assert.ok(at(`href="${look}"`)<at('<link rel="stylesheet" href="clock-triggers.css">'),look);
 assert.equal(html.split('clock-triggers.js').length,2);assert.equal(html.split('clock-triggers.css').length,2);
 const css=read('clock-triggers.css');
 for(const cls of ['ct-box','ct-roll','ct-last','ct-fired','ct-toggle','ct-panel','ct-head','ct-row','ct-del','ct-add','ct-note','ct-strip','ct-strip-clock','ct-strip-count','ct-dots','ct-badge','ct-strip-note'])assert.ok(read('clock-triggers.js').includes(cls),cls);
 assert.match(css,/\.room-clock\.full/);
 assert.match(css,/\.gm-extras \.ct-box \.btn,html\.ui-native\.ui-board \.gm-extras \.ct-box \.btn\{min-height:44px/,'«Досье» has a stronger button rule of its own');assert.match(css,/\.btn\[aria-disabled="true"\]\{opacity/);assert.ok(!/#[0-9a-f]{3,6}\b/i.test(css.replace(/\/\*[\s\S]*?\*\//g,'')),'colours come from the theme variables');
 assert.match(fs.readFileSync(path.join(__dirname,'../README.md'),'utf8'),/\*\*Часы с триггерами:\*\*/);
 // the two languages have the same set of texts
 const src=read('clock-triggers.js'),keys=l=>[...src.slice(src.indexOf(` ${l}:{toggle`),src.indexOf(l==='ru'?' en:{toggle':'// ---------- stored fields')).matchAll(/(?:[{,]|\n\s*)([a-zA-Z]+):/g)].map(m=>m[1]).sort();
 assert.ok(keys('ru').length>25);eq(keys('ru'),keys('en'));
});
