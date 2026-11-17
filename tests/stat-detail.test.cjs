// «Из чего складывается число» in every look (site/stat-detail.js): the dialog that opens from a STAT box or a Skill row.
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const src=f=>fs.readFileSync(__dirname+'/../site/'+f,'utf8');
const same=(a,b,m)=>assert.deepEqual(JSON.parse(JSON.stringify(a)),b,m);

function node(attrs={}){
 const o={attrs:{...attrs},dataset:{},hidden:false,innerHTML:'',isConnected:true,tagName:'DIV',classes:new Set(),focused:0,children:[],
  setAttribute(k,v){this.attrs[k]=String(v)},getAttribute(k){return this.attrs[k]??null},hasAttribute(k){return k in this.attrs},
  appendChild(c){this.children.push(c)},contains(x){return x===this||this.found?.includes(x)},querySelectorAll(){return this.found||[]},querySelector(){return null},
  focus(){this.focused++;o.doc.activeElement=this},click(){this.clicked=(this.clicked||0)+1},closest(){return null}};
 return o;
}
function load({board=false,character={id:'c',stats:{REF:7},skills:{}},dossier,app={}}={}){
 const listeners={},winListeners={},created=[],checks=[],messages=[],found={};
 const body=node(),doc={documentElement:{lang:'ru',classList:{add:c=>body.classes.add(c),remove:c=>body.classes.delete(c),contains:c=>board&&c==='ui-board'}},body,activeElement:body,
  addEventListener(t,fn){(listeners[t]||=[]).push(fn)},createElement(){const e=node();e.doc=doc;created.push(e);return e},
  querySelector:s=>found[s]||null,querySelectorAll:()=>[]};
 body.doc=doc;
 let closedBoard=0;
 const D=dossier||{
  statBreakdown:(c,o)=>o.stat==='LUCK'?null:({kind:'stat',key:o.stat,title:o.stat,rolls:[{label:'Roll',check:{base:7,label:'REF check'},primary:true}]}),
  skillBreakdown:(c,o)=>o.stat?({kind:'skill',key:o.skill,title:o.skill,rolls:[{label:'Roll',selector:`[data-action="skill-roll"][data-skill="${o.skill}"]`,primary:true}]}):null,
  render:m=>`<header class="dossier-head"><h2 id="dossier-title">${m.title}</h2><button type="button" class="dossier-close" data-dossier-close>x</button></header><footer>${m.rolls.map(r=>r.selector?`<button data-dossier-roll="${r.selector}"${r.disabled?' disabled':''}>r</button>`:`<button data-dossier-check="${r.check.base}" data-dossier-label="${r.check.label}">c</button>`).join('')}</footer>`,
  close(){closedBoard++}};
 const win={document:doc,addEventListener(t,fn){(winListeners[t]||=[]).push(fn)},App:{lang:()=>doc.documentElement.lang,active:()=>character,skillInfo:n=>n==='Handgun'?{stat:'REF'}:null,check:(b,l,o)=>checks.push([b,l,o]),...app},DossierPanel:D,SheetTabs:{takeDV:()=>win.dv||0}};
 vm.runInNewContext(src('stat-detail.js'),{window:win});
 return {S:win.StatDetail,win,doc,listeners,winListeners,created,checks,found,body,closedBoard:()=>closedBoard,pop:()=>created[1],backdrop:()=>created[0]};
}
const key=(h,k,extra={})=>{let stopped=0;for(const fn of h.listeners.keydown||[])fn({key:k,shiftKey:false,preventDefault(){},stopPropagation(){stopped++},...extra});return stopped};
const click=(h,target)=>h.listeners.click.forEach(fn=>fn({target}));

test('parse reads the trigger: a known STAT or any Skill name, nothing else',()=>{
 const {S}=load();
 same(S.parse('stat:REF'),{kind:'stat',key:'REF'});same(S.parse('skill:Handgun'),{kind:'skill',key:'Handgun'});same(S.parse('skill:Language (Other)'),{kind:'skill',key:'Language (Other)'});
 for(const bad of ['stat:XYZ','stat:','skill:','thing:REF','REF',null,undefined,'skill:'+'x'.repeat(81)])assert.equal(S.parse(bad),null,String(bad));
});

test('model: a Skill takes its STAT from the sheet\'s list; unknown things give nothing and the builder is the dossier\'s own',()=>{
 const {S,win}=load(),c=win.App.active();
 assert.equal(S.model(c,{kind:'stat',key:'REF'},'ru').title,'REF');assert.equal(S.model(c,{kind:'stat',key:'LUCK'},'ru'),null);
 assert.equal(S.model(c,{kind:'skill',key:'Handgun'},'ru').title,'Handgun');assert.equal(S.model(c,{kind:'skill',key:'Unknown'},'ru'),null,'a Skill the sheet does not list');
 assert.equal(S.model(null,{kind:'stat',key:'REF'},'ru'),null);assert.equal(S.model(c,null,'ru'),null);assert.equal(S.model(c,{kind:'x',key:'y'},'ru'),null);
 assert.equal(S.model(c,{kind:'stat',key:'REF'},'ru',null)?.title,'REF');
 assert.equal(S.model(c,{kind:'stat',key:'REF'},'ru',{statBreakdown:()=>({title:'own'})}).title,'own','a builder can be handed in');
});

test('the markup carries the dialog\'s own marks, so the «Досье» panel never reacts to them',()=>{
 const {S}=load(),html=S.markup({title:'T',rolls:[{selector:'[a]'},{check:{base:3,label:'L'}}]},'ru');
 assert.match(html,/data-detail-close/);assert.match(html,/data-detail-roll=/);assert.match(html,/data-detail-check=/);assert.match(html,/data-detail-label=/);assert.match(html,/id="detail-title"/);
 assert.doesNotMatch(html,/data-dossier/);assert.doesNotMatch(html,/id="dossier-title"/);
});

test('opening: a modal dialog with a name, the focus inside it, the board panel closed, and the page told',()=>{
 const h=load(),opener=node();opener.doc=h.doc;
 assert.equal(h.S.open('stat:REF',opener),true);
 const p=h.pop();assert.equal(p.hidden,false);assert.equal(h.backdrop().hidden,false);
 assert.equal(p.attrs.role,'dialog');assert.equal(p.attrs['aria-modal'],'true');assert.equal(p.attrs['aria-labelledby'],'detail-title');assert.ok(p.focused>=1);
 assert.ok(h.body.classes.has('detail-open'));assert.equal(h.closedBoard(),1);same(h.S.opened(),{kind:'stat',key:'REF'});
 assert.match(p.innerHTML,/<h2 id="detail-title">REF<\/h2>/);
 assert.equal(h.S.open('stat:NOPE'),false);assert.equal(h.S.open('skill:Unknown'),false);assert.equal(load({character:null}).S.open('stat:REF'),false,'no sheet, no dialog');
});

test('closing returns the focus to the trigger, found again by what it opens when the sheet was drawn anew',()=>{
 const h=load(),opener=node();opener.doc=h.doc;
 h.S.open('skill:Handgun',opener);assert.equal(h.S.close(),true);
 assert.equal(h.pop().hidden,true);assert.equal(h.pop().innerHTML,'');assert.equal(h.backdrop().hidden,true);assert.ok(!h.body.classes.has('detail-open'));assert.equal(opener.focused,1);
 // the old trigger was replaced by a re-render: the new one is found by its mark
 const old=node();old.doc=h.doc;old.isConnected=false;const fresh=node();fresh.doc=h.doc;h.found['[data-detail-open="skill:Handgun"]']=fresh;
 h.S.open('skill:Handgun',old);h.S.close();assert.equal(fresh.focused,1);
 // nothing to return to: still not the page
 delete h.found['[data-detail-open="skill:Handgun"]'];const tab=node();tab.doc=h.doc;h.found['.sheet-tabs .active']=tab;
 h.S.open('skill:Handgun',old);h.S.close();assert.equal(tab.focused,1);
 assert.equal(h.S.close(),false);
 h.S.open('skill:Handgun',old);assert.equal(h.S.close({focus:false}),true);
});

test('Escape closes; Tab wraps inside the dialog; Enter or Space on a role=button Skill name opens it',()=>{
 const h=load(),opener=node();opener.doc=h.doc;
 const name=node();name.doc=h.doc;name.dataset.detailOpen='skill:Handgun';name.closest=s=>s==='[data-detail-open]'?name:null;
 let prevented=0;key(h,'Enter',{target:name,preventDefault(){prevented++}});
 assert.equal(h.S.opened()?.key,'Handgun');assert.equal(prevented,1);
 const a=node(),b=node();a.doc=b.doc=h.doc;h.pop().found=[a,b];
 h.doc.activeElement=b;key(h,'Tab',{target:b});assert.equal(a.focused,1);
 h.doc.activeElement=a;key(h,'Tab',{target:a,shiftKey:true});assert.equal(b.focused,1);
 h.doc.activeElement=h.body;key(h,'Tab',{target:h.body});assert.equal(a.focused,2,'from outside the dialog Tab comes back in');
 assert.equal(key(h,'Escape',{target:a}),1);assert.equal(h.S.opened(),null);
 // a button is a button: the browser does the work, the module does not open it twice
 const btn=node();btn.tagName='BUTTON';btn.dataset.detailOpen='stat:REF';btn.closest=s=>s==='[data-detail-open]'?btn:null;key(h,' ',{target:btn});assert.equal(h.S.opened(),null);
 // Enter on something else does nothing
 key(h,'Enter',{target:h.body});assert.equal(h.S.opened(),null);
});

test('a click on the trigger, on the close button or on the backdrop, and the keyboard-free paths all work',()=>{
 const h=load();
 const trigger=node();trigger.doc=h.doc;trigger.dataset.detailOpen='stat:REF';
 click(h,{closest:s=>s==='[data-detail-open]'?trigger:null});assert.equal(h.S.opened()?.key,'REF');
 click(h,{closest:s=>s==='[data-detail-close]'?node():null});assert.equal(h.S.opened(),null);
 h.S.open('stat:REF');click(h,{closest:s=>s==='[data-detail-close]'?h.backdrop():null});assert.equal(h.S.opened(),null,'the backdrop closes it');
 click(h,{closest:()=>null});
});

test('a roll button closes the dialog first, then presses the sheet\'s own button; a disabled one does nothing',()=>{
 const h=load(),target=node();h.found['.sheet-layout [data-action="skill-roll"][data-skill="Handgun"]']=target;
 h.S.open('skill:Handgun');
 const btn=node();btn.dataset.detailRoll='[data-action="skill-roll"][data-skill="Handgun"]';btn.disabled=false;h.pop().found=[btn];
 click(h,{closest:s=>s.includes('data-detail-roll')?btn:null});
 assert.equal(target.clicked,1);assert.equal(h.S.opened(),null);
 // a sheet button that is off
 h.S.open('skill:Handgun');target.disabled=true;click(h,{closest:s=>s.includes('data-detail-roll')?btn:null});assert.equal(target.clicked,1);
 // a disabled dialog button
 h.S.open('skill:Handgun');btn.disabled=true;click(h,{closest:s=>s.includes('data-detail-roll')?btn:null});assert.equal(target.clicked,1);assert.equal(h.S.opened()?.key,'Handgun','still open');
});

test('a STAT roll is a check with the numbers as they are now and uses up the DV set for the next check',()=>{
 const h=load();h.win.dv=15;
 h.S.open('stat:REF');
 const btn=node();btn.dataset.detailCheck='7';btn.dataset.detailLabel='REF check';h.pop().found=[btn];
 click(h,{closest:s=>s.includes('data-detail-check')?btn:null});
 same(h.checks,[[7,'REF check',{dv:15}]]);assert.equal(h.S.opened(),null);
 // no DV chosen: no options at all
 h.win.dv=0;h.S.open('stat:REF');click(h,{closest:s=>s.includes('data-detail-check')?btn:null});same(h.checks.at(-1),[7,'REF check',{}]);
 // the breakdown says the roll is off (an armor record that does not add up): no check
 const off=load({dossier:{statBreakdown:()=>({title:'R',rolls:[{label:'x',check:{base:1,label:'l'},disabled:true}]}),skillBreakdown:()=>null,render:()=>'<b></b>',close(){}}});
 off.S.open('stat:REF');const b2=node();b2.dataset.detailCheck='1';off.pop().found=[b2];click(off,{closest:s=>s.includes('data-detail-check')?b2:null});assert.equal(off.checks.length,0);
});

test('a change of page closes it without moving the focus; an error in the page is not thrown at the player',()=>{
 const h=load(),opener=node();opener.doc=h.doc;
 h.S.open('stat:REF',opener);assert.equal(typeof h.winListeners.hashchange?.[0],'function');
 h.winListeners.hashchange[0]();assert.equal(h.S.opened(),null);assert.equal(opener.focused,0);
 assert.doesNotThrow(()=>click(h,{closest(){throw new Error('boom')}}));
});

test('the page wires the dialog: the stylesheet is for the dialog only, in a phone sheet and on a wide screen, with 44 px targets',()=>{
 const css=src('stat-detail.css'),html=src('index.html');
 assert.ok(html.indexOf('src="stat-detail.js"')>html.indexOf('src="dossier-panel.js"'),'after the builder it uses');
 assert.ok(html.indexOf('href="stat-detail.css"')>html.indexOf('href="board.css"'));
 assert.match(css,/\.detail-pop \.dossier-close \{[^}]*width: 44px; height: 44px/);assert.match(css,/\.dossier-actions \.btn \{[^}]*min-height: 44px/);
 assert.match(css,/@media \(max-width: 820px\)/);assert.match(css,/@media print/);
 const plain=css.replace(/\/\*[\s\S]*?\*\//g,'');
 const loose=[...plain.matchAll(/(^|[{}])\s*([^{}@]+?)\s*\{/g)].flatMap(m=>m[2].split(',')).map(s=>s.trim()).filter(s=>s&&!/^(from|to)$/.test(s)&&!/^\.detail-(pop|backdrop)\b/.test(s)&&!/^\.detail-pop\b/.test(s));
 same(loose,[],'every rule belongs to the dialog');
});

test('the app wires the triggers: a STAT name button and a Skill name with role=button, outside the «Досье» look (which has its own)',()=>{
 const app=src('app.js');
 assert.match(app,/class="stat-name stat-info" data-detail-open="stat:\$\{s\}" aria-haspopup="dialog"/);
 assert.match(app,/boardLook\(\)\?'':` role="button" tabindex="0" data-detail-open="skill:/);
 assert.match(app,/skillInfo:name=>/);
});
