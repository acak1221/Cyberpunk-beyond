// The one HP control (site/hp-pad.js): pure rules, markup, the dialog for any target, the line after a change.
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const src=f=>fs.readFileSync(__dirname+'/../site/'+f,'utf8');
const same=(a,b,m)=>assert.deepEqual(JSON.parse(JSON.stringify(a)),b,m);

// A small DOM: enough for the pad's own elements and for the things it reacts to.
function node(attrs={}){
 const o={attrs:{...attrs},dataset:{},hidden:false,innerHTML:'',isConnected:true,children:[],focused:0,classes:new Set(),className:'',value:'',
  setAttribute(k,v){this.attrs[k]=String(v)},getAttribute(k){return this.attrs[k]??null},hasAttribute(k){return k in this.attrs},removeAttribute(k){delete this.attrs[k]},
  appendChild(c){this.children.push(c)},contains(x){return x===this||this.children.includes(x)},querySelector(){return null},querySelectorAll(){return []},
  focus(){this.focused++;o.doc.activeElement=this},click(){this.clicked=(this.clicked||0)+1},closest(){return null}};
 return o;
}
function load({SheetTabs,App,DamageApply,PlayCombat}={}){
 const listeners={},created=[],messages=[];
 const body=node(),doc={documentElement:{lang:'ru',classList:{add:c=>body.classes.add(c),remove:c=>body.classes.delete(c)}},body,activeElement:body,pads:[],
  addEventListener(type,fn){(listeners[type]||=[]).push(fn)},createElement(){const e=node();e.doc=doc;created.push(e);return e},
  querySelector:()=>null,querySelectorAll(sel){return sel==='[data-hp-pad]'?this.pads:[]}};
 body.doc=doc;
 const win={document:doc,App:{lang:()=>doc.documentElement.lang,notify:m=>messages.push(m),save(){},...App},SheetTabs,DamageApply,PlayCombat};
 vm.runInNewContext(src('hp-pad.js'),{window:win});
 return {P:win.HpPad,win,doc,listeners,created,messages,body,backdrop:()=>created[0],root:()=>created[1]};
}
// A target that keeps its HP in a variable.
function target({hp=30,max=40,sp={body:11,head:9},id='t1',name='Ganger',set,relabel}={}){
 const t={id,name,hp:()=>hp,max:()=>max,sp:()=>sp,calls:[],setHp(next,meta){t.calls.push([next,meta?.reason]);if(set)return set(next,meta);hp=next;return {ok:true}}};
 if(relabel)t.relabel=relabel;
 return t;
}
const ev=(el,sel)=>({target:{closest:s=>sel.includes(s)||s.split(',').some(x=>sel.includes(x.trim()))?el:null},type:'click'});
// An element the click handler can find through closest(): the pad root and the target element.
function press(h,attr,pad,extra={}){
 const el=node({[attr]:''});el.doc=h.doc;Object.assign(el.dataset,extra);el.closest=s=>s==='[data-hp-pad]'?pad:s.includes('['+attr+']')||s.includes('['+attr+'=')?el:null;
 return {el,event:{target:el,type:'click'}};
}

// ---------- pure rules ----------
test('wound state and the bar follow the sheet thresholds',()=>{
 const {P}=load();
 assert.equal(P.wound(40,40),'full');assert.equal(P.wound(39,40),'light');assert.equal(P.wound(19,40),'serious','below half of 40 is serious');assert.equal(P.wound(20,40),'light');
 assert.equal(P.wound(0,40),'mortal');assert.equal(P.wound(-3,40),'mortal');
 assert.equal(P.fill(20,40),50);assert.equal(P.fill(-5,40),0);assert.equal(P.fill(99,40),100);assert.equal(P.fill(5,0),0);
});

test('steps: a heal stops at the maximum and never lowers a value above it; damage goes down to −999',()=>{
 const {P}=load();
 assert.equal(P.stepHp(38,40,5),40);assert.equal(P.stepHp(40,40,1),40);assert.equal(P.stepHp(45,40,5),45,'above the maximum stays');
 assert.equal(P.stepHp(10,40,-5),5);assert.equal(P.stepHp(-990,40,-5),-995);assert.equal(P.stepHp(-998,40,-5),-999);
 assert.equal(P.stepHp('10','40','-1'),9,'strings from the DOM');assert.equal(P.stepHp(10,40,'x'),10);
});

test('a plain hit: SP of the place stops damage, through armor ignores it, the head multiplier is a parameter, a critical is a flag',()=>{
 const {P}=load();
 same(P.simpleHit({hp:30,amount:15,zone:'body',sp:11}),{ok:true,raw:15,zone:'body',armor:11,damage:4,hpBefore:30,hpAfter:26,critical:false,blocked:false});
 assert.equal(P.simpleHit({hp:30,amount:15,zone:'through',sp:11}).damage,15,'through armor');
 assert.equal(P.simpleHit({hp:30,amount:10,zone:'body',sp:11}).blocked,true);assert.equal(P.simpleHit({hp:30,amount:10,zone:'body',sp:11}).hpAfter,30);
 assert.equal(P.simpleHit({hp:30,amount:15,zone:'head',sp:9,headMultiplier:2}).damage,12,'(15 − 9) × 2');
 assert.equal(P.simpleHit({hp:30,amount:15,zone:'head',sp:9}).damage,6,'no multiplier given: the pad does not make one up');
 assert.equal(P.simpleHit({hp:30,amount:5,zone:'head',sp:9,headMultiplier:2}).damage,0,'nothing got through, nothing is doubled');
 assert.equal(P.simpleHit({hp:30,amount:15,zone:'body',sp:11,crit:true}).critical,true);
 assert.equal(P.simpleHit({hp:30,amount:'abc'}).ok,false);assert.equal(P.simpleHit({hp:30,amount:0}).ok,false);assert.equal(P.simpleHit({hp:30,amount:-4}).ok,false);
 assert.equal(P.simpleHit({hp:30,amount:9999,zone:'through'}).hpAfter,-999,'floor of the sheet');
 assert.equal(P.simpleHit({hp:30,amount:15,zone:'oops',sp:11}).zone,'body','an unknown place is the body');
 assert.equal(P.simpleHit({hp:30,amount:15,zone:'body',sp:-5}).armor,0,'negative SP is none');
});

test('naming the reason afterwards: a correction gives the stabilization back, damage takes it away again',()=>{
 const {P}=load();
 const before={version:1,stabilized:true,stabilizedHp:10},cleared={version:1,stabilized:false,stabilizedHp:10};
 same(P.relabelMedical(before,cleared,'correction'),before);
 same(P.relabelMedical(before,before,'damage'),cleared);
 assert.equal(P.relabelMedical(before,cleared,'damage'),cleared,'already as damage leaves it');
 assert.equal(P.relabelMedical(null,cleared,'correction'),cleared,'nothing was stabilized before: nothing to give back');
 assert.equal(P.relabelMedical({version:2,stabilized:true},cleared,'correction'),cleared,'an unknown record is not touched');
 assert.equal(P.relabelMedical(before,{version:3},'correction').version,3);
 assert.equal(P.relabelMedical(before,cleared,'other'),cleared);
});

// ---------- markup ----------
test('the pad has the steps, the damage form with SP filled in, the critical tick, the exact field and the line after a change, in both languages',()=>{
 const {P}=load(),t=target();
 const ru=P.html(t,'ru','modal'),en=P.html(t,'en','modal');
 for(const d of ['−5','−1','+1','+5'])assert.ok(ru.includes(`>${d}<`),d);
 assert.match(ru,/data-wound="light"/);assert.match(ru,/Тело · SP 11/);assert.match(ru,/Голова · SP 9/);assert.match(ru,/Мимо брони/);assert.match(ru,/Критическое попадание/);assert.match(ru,/data-hp-exact/);assert.doesNotMatch(ru,/data-field="hp"/);
 assert.match(en,/Body · SP 11/);assert.match(en,/Head · SP 9/);assert.match(en,/Through armor/);assert.match(en,/Critical hit/);assert.match(en,/Set exactly/);
 assert.match(ru,/aria-label="HP −5"/);assert.match(ru,/role="radiogroup" aria-label="Куда попали"/);
 assert.match(P.html(t,'xx','modal'),/Тело/,'an unknown language is Russian');
 assert.doesNotMatch(ru,/select/,'no reason select before the change');
});

test('the sheet\'s pad keeps the HP field inside [data-sheet-hp-root] and shows the sheet\'s own damage form when there is one',()=>{
 const {P}=load();
 const t={...target(),kind:'sheet',hitForm:()=>'<div class="pc-hit" data-pc-hit-root>FORM</div>'};
 const h=P.html(t,'ru','sheet');
 assert.match(h,/data-sheet-hp-root/);assert.match(h,/data-field="hp"/);assert.match(h,/>FORM</);assert.doesNotMatch(h,/data-hp-take/,'one damage form, not two');
 const plain=P.html({...t,hitForm:()=>''},'ru','sheet');assert.match(plain,/data-hp-take/);
});

test('a target name cannot break out of the markup',()=>{
 const {P,doc,created}=load(),t=target({name:'<img src=x onerror=1>"'});
 assert.equal(P.open(t),true);
 assert.doesNotMatch(created[1].innerHTML,/<img/);assert.match(created[1].innerHTML,/&lt;img/);
});

test('for the sheet\'s character the pad is built from its numbers: max from BODY and WILL, SP from the worn armor',()=>{
 const {P}=load();
 const c={id:'c',name:'V',hp:20,head:7,bodyArmor:12,stats:{BODY:8,WILL:6},extra:{}},t=P.forCharacter(c);
 assert.equal(t.max(),45);assert.equal(t.hp(),20);same(t.sp(),{body:12,head:7});assert.equal(t.kind,'sheet');assert.equal(t.dock,true);
 assert.equal(P.forCharacter({id:'x',stats:{BODY:'q'}}).max(),10,'a broken stat is 0');
});

// ---------- the dialog ----------
test('open refuses what is not a target; the sheet\'s own target opens the dock\'s pad, not a dialog',()=>{
 let opened=null;const h=load({SheetTabs:{openHp:v=>{opened=v}}});
 assert.equal(h.P.open(null),false);assert.equal(h.P.open({}),false);assert.equal(h.P.open({hp:()=>1,max:()=>2}),false,'needs setHp');
 assert.equal(h.P.open(h.P.forCharacter({id:'c',stats:{BODY:6,WILL:6}})),true);assert.equal(opened,true);assert.equal(h.created.length,0);
});

test('the dialog: opens on the first field, traps Tab, closes on Escape and gives the focus back to the opener',()=>{
 const h=load(),opener=node();opener.doc=h.doc;h.doc.activeElement=opener;
 const t=target();
 assert.equal(h.P.open(t,{opener}),true);
 assert.equal(h.P.isOpen(),true);assert.equal(h.root().hidden,false);assert.equal(h.backdrop().hidden,false);assert.equal(h.root().attrs['aria-modal'],'true');assert.equal(h.root().attrs.role,'dialog');
 assert.ok(h.body.classes.has('hp-pad-open'));assert.ok(h.root().focused>=1);
 // Tab wraps inside
 const a=node(),b=node();a.doc=b.doc=h.doc;h.root().querySelectorAll=()=>[a,b];h.root().contains=x=>x===a||x===b;
 let prevented=0;const key=(k,shift=false)=>h.listeners.keydown.forEach(fn=>fn({key:k,shiftKey:shift,preventDefault(){prevented++},stopPropagation(){}}));
 h.doc.activeElement=b;key('Tab');assert.equal(a.focused,1,'forward from the last goes to the first');
 h.doc.activeElement=a;key('Tab',true);assert.equal(b.focused,1,'back from the first goes to the last');
 key('Escape');assert.equal(h.P.isOpen(),false);assert.equal(h.root().hidden,true);assert.equal(h.root().innerHTML,'');assert.equal(opener.focused,1,'focus returns to the opener');
 assert.ok(!h.body.classes.has('hp-pad-open'));
 // an opener that is gone: focus goes somewhere real, never nowhere
 const gone=node();gone.doc=h.doc;gone.isConnected=false;const fallback=node();fallback.doc=h.doc;h.doc.querySelector=s=>s==='[data-hud-hp]'?fallback:null;
 h.P.open(t,{opener:gone});h.P.close();assert.equal(fallback.focused,1);
 assert.equal(h.P.close(),false,'closing twice is harmless');
});

// ---------- acting ----------
function opened(over={}){
 const h=load(over.load),t=target(over.target);
 h.P.open(t);
 const pad=node();pad.dataset.hpPad='modal';pad.doc=h.doc;pad.querySelector=sel=>pad.parts?.[sel]||null;h.root().contains=x=>x===pad;h.doc.pads=[pad];
 const amount=node();amount.doc=h.doc;amount.value='';pad.parts={'[data-hp-amount]':amount};
 return {h,t,pad,amount};
}
test('step buttons change HP through the target; a heal is capped, and the line after the change offers the undo',()=>{
 const {h,t,pad}=opened();
 const s=press(h,'data-hp-step',pad,{hpStep:'-5'});h.P.onClick(s.event);
 same(t.calls,[[25,'damage']]);same(h.P.last(),{id:'t1',from:30,to:25,reason:'damage',medical:null});
 const u=press(h,'data-hp-step',pad,{hpStep:'5'});h.P.onClick(u.event);h.P.onClick(press(h,'data-hp-step',pad,{hpStep:'5'}).event);h.P.onClick(press(h,'data-hp-step',pad,{hpStep:'5'}).event);
 assert.equal(t.hp(),40,'25 → 30 → 35 → 40 and no more');
 const before=t.calls.length;h.P.onClick(press(h,'data-hp-step',pad,{hpStep:'5'}).event);assert.equal(t.calls.length,before,'at the maximum a heal does not even call the target');
});

test('«take damage» uses the SP of the chosen place, empties the field and says what to roll on a critical',()=>{
 const {h,t,pad,amount}=opened();
 const take=press(h,'data-hp-take',pad);
 amount.value='';h.P.onClick(take.event);assert.equal(t.calls.length,0,'an empty field changes nothing');assert.ok(amount.focused>=1,'and sends you to it');
 amount.value='15';h.P.onClick(take.event);same(t.calls,[[26,'damage']]);assert.equal(amount.value,'');
 // through armor: all of it
 h.P.onClick(press(h,'data-hp-zone',pad,{hpZone:'through'}).event);amount.value='6';h.P.onClick(take.event);assert.equal(t.hp(),20);
 // a critical hit: the reminder, and the tick is cleared for the next hit
 const crit=press(h,'data-hp-crit',pad);pad.querySelectorAll=s=>s==='[data-hp-crit]'?[crit.el]:[];
 h.P.onClick(crit.event);assert.equal(crit.el.attrs['aria-checked'],'true');
 amount.value='1';h.P.onClick(take.event);assert.equal(t.hp(),19);assert.ok(h.messages.some(m=>/Критическое попадание/.test(m)));assert.equal(crit.el.attrs['aria-checked'],'false');
 // an unknown place is the body: 15 against SP 11 is 4
 h.P.onClick(press(h,'data-hp-zone',pad,{hpZone:'bogus'}).event);amount.value='15';h.P.onClick(take.event);assert.equal(t.hp(),15);
});

test('a target that refuses the change leaves the pad as it was and says so',()=>{
 const {h,t,pad}=opened({target:{set:()=>false}});
 h.P.onClick(press(h,'data-hp-step',pad,{hpStep:'-1'}).event);
 assert.equal(h.P.last(),null);assert.ok(h.messages.some(m=>/Не удалось изменить HP/.test(m)));
 h.win.App.lang=()=>'en';h.messages.length=0;h.P.onClick(press(h,'data-hp-step',pad,{hpStep:'-1'}).event);assert.ok(h.messages.some(m=>/Could not change HP/.test(m)));
});

test('the exact field takes only whole numbers; a lower value is a correction',()=>{
 const {h,t,pad}=opened();
 const field=node();field.value='12.5';pad.parts['[data-hp-exact]']=field;
 const set=press(h,'data-hp-exact-set',pad);
 h.P.onClick(set.event);assert.equal(t.calls.length,0);assert.ok(h.messages.length>0);
 field.value='12';h.P.onClick(set.event);same(t.calls,[[12,'correction']]);
 field.value='99999';h.P.onClick(set.event);assert.equal(t.calls.at(-1)[0],1000,'clamped to the sheet\'s ceiling');
});

test('reason chips and undo: the reason is optional, undo takes the change back through the target',()=>{
 const labelled=[];const {h,t,pad}=opened({target:{relabel:(c,r)=>{labelled.push([c.from,c.to,r]);return true}}});
 h.P.onClick(press(h,'data-hp-step',pad,{hpStep:'-5'}).event);
 h.P.onClick(press(h,'data-hp-reason',pad,{hpReason:'correction'}).event);same(labelled,[[30,25,'correction']]);assert.equal(h.P.last().reason,'correction');
 h.P.onClick(press(h,'data-hp-reason',pad,{hpReason:'nonsense'}).event);assert.equal(labelled.at(-1)[2],'damage','anything but «correction» is damage');
 h.P.onClick(press(h,'data-hp-undo',pad).event);assert.equal(t.hp(),30);assert.equal(h.P.last(),null);assert.ok(h.messages.some(m=>/Возвращено/.test(m)));
 h.P.onClick(press(h,'data-hp-undo',pad).event);assert.equal(t.calls.length,2,'a second undo has nothing to take back');
});

test('the line after a change is for the target it belongs to',()=>{
 const {h,t,pad}=opened();
 h.P.onClick(press(h,'data-hp-step',pad,{hpStep:'-1'}).event);
 const other=target({id:'t2'});
 h.P.forget();assert.equal(h.P.last(),null);
 h.P.noted({id:'t2',hp:10},12,'damage',{version:1,stabilized:true,stabilizedHp:5});
 same(h.P.last(),{id:'t2',from:12,to:10,reason:'damage',medical:{version:1,stabilized:true,stabilizedHp:5}});
 h.P.noted({id:'t2',hp:10},10,'damage');same(h.P.last().to,10,'no change, nothing new is remembered');
 h.P.noted({id:'t2',hp:15},10,'damage');assert.equal(h.P.last().reason,'heal','going up is a heal');
 h.P.noted({id:'t2',hp:3},10,'correction');assert.equal(h.P.last().reason,'correction');
 h.P.noted(null,1,'damage');
});

test('the sheet\'s relabel gives back or takes away the stabilization and refuses another character or a changed HP',()=>{
 const saved=[];const {P}=load({App:{save:()=>saved.push(1)}});
 const c={id:'c',name:'V',hp:15,stats:{BODY:6,WILL:6},extra:{medical:{version:1,stabilized:false,stabilizedHp:10}}},t=P.forCharacter(c);
 const change={id:'c',from:20,to:15,medical:{version:1,stabilized:true,stabilizedHp:10}};
 assert.equal(t.relabel(change,'correction'),true);assert.equal(c.extra.medical.stabilized,true);assert.equal(saved.length,1);
 assert.equal(t.relabel(change,'damage'),true);assert.equal(c.extra.medical.stabilized,false);
 assert.equal(t.relabel({...change,id:'other'},'correction'),false);
 c.hp=12;assert.equal(t.relabel(change,'correction'),false,'HP moved on since: no longer that change');assert.equal(c.extra.medical.stabilized,false);
 c.hp=15;c.extra=undefined;assert.equal(t.relabel(change,'correction'),false);
});

test('the sheet\'s setHp goes through App.applyHp with the reason; without it the call fails safely',()=>{
 const calls=[],c={id:'c',hp:10,stats:{BODY:6,WILL:6}};
 const {P}=load({App:{applyHp:(v,r,ch)=>{calls.push([v,r,ch===c]);return {ok:true}}}});
 const t=P.forCharacter(c);assert.deepEqual(t.setHp(7.9,{reason:'correction'}).ok,true);assert.deepEqual(calls,[[7,'correction',true]]);t.setHp(3);assert.equal(calls[1][1],'damage');
 assert.equal(load().P.forCharacter(c).setHp(5),false);
});

test('the page loads the pad before the sheet tabs, with its stylesheet after the looks',()=>{
 const html=src('index.html');
 assert.ok(html.indexOf('src="hp-pad.js"')>0&&html.indexOf('src="hp-pad.js"')<html.indexOf('src="app.js"'));
 assert.ok(html.indexOf('href="hp-pad.css"')>html.indexOf('href="board.css"'));
 assert.ok(html.indexOf('href="sheet-compact.css"')>html.indexOf('href="board.css"')&&html.indexOf('href="sheet-compact.css"')>html.indexOf('href="light.css"')&&html.indexOf('href="sheet-compact.css"')>html.indexOf('href="native.css"'));
 const css=src('hp-pad.css');assert.match(css,/min-height: 44px/);assert.match(css,/@media print/);
});

// ---------- review fixes ----------
test('wound threshold on an odd maximum: below half rounded UP is serious (45: 22 serious, 23 light)',()=>{
 const {P}=load();
 assert.equal(P.wound(22,45),'serious');assert.equal(P.wound(23,45),'light');assert.equal(P.wound(44,45),'light');assert.equal(P.wound(0,45),'mortal');
});
test('undo refuses when HP was changed another way since: no silent heal, and the stale line is dropped',()=>{
 const {h,t,pad}=opened();
 h.P.onClick(press(h,'data-hp-step',pad,{hpStep:'-5'}).event);assert.equal(t.hp(),25);
 // a hit from the damage tool (not the pad) takes it to 11
 t.setHp(11,{});const before=t.calls.length;
 h.P.onClick(press(h,'data-hp-undo',pad).event);
 assert.equal(t.hp(),11,'the older value is not written back');assert.equal(t.calls.length,before);
 assert.equal(h.P.last(),null);assert.ok(h.messages.some(m=>/HP уже изменилось/.test(m)));
});
test('the line after a change shows only while HP is still what that change made it',()=>{
 const {h,t,pad}=opened();pad.closest=s=>s==='[data-hp-pad]'?pad:null;const line=node();line.doc=h.doc;pad.parts['[data-hp-last]']=line;
 h.P.onClick(press(h,'data-hp-step',pad,{hpStep:'-5'}).event);h.P.refresh();assert.match(line.innerHTML,/data-hp-undo/);
 t.setHp(3,{});h.P.refresh();assert.equal(line.innerHTML,'','a stale line (and its Undo) is gone');
});
test('a hostile hp or max (a string with markup) is turned into a number before it reaches the markup',()=>{
 const {P}=load(),t=target();t.hp=()=>'"><img src=x onerror=alert(1)>';t.max=()=>'<b>40';
 const out=P.html(t,'ru','modal');
 assert.ok(!/<img/.test(out)&&!/<b>40/.test(out));assert.match(out,/data-hp-exact value="0"/);
});
test('when the screen redraws and the opener is gone, the focus goes to the same button of the new page, then to the page; never to nothing',()=>{
 const h=load(),gone=node();gone.doc=h.doc;gone.isConnected=false;gone.attributes=[{name:'data-camp-hp-pad',value:'r1'}];
 const fresh=node();fresh.doc=h.doc;
 h.doc.querySelector=s=>s==='[data-camp-hp-pad="r1"]'?fresh:null;
 h.P.open(target(),{opener:gone});h.P.close();assert.equal(fresh.focused,1,'the redrawn button gets the focus');
 // no such button either: the heading of the page takes it (made focusable)
 const h2=load(),gone2=node();gone2.doc=h2.doc;gone2.isConnected=false;const heading=node();heading.doc=h2.doc;heading.tagName='H1';
 h2.doc.querySelector=s=>s==='#app h1'?heading:null;
 h2.P.open(target(),{opener:gone2});h2.P.close();assert.equal(heading.focused,1);assert.equal(heading.attrs.tabindex,'-1');
});
