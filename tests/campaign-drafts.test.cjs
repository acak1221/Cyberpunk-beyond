const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const src=name=>fs.readFileSync(__dirname+'/../site/'+name,'utf8');
const unescape=s=>s.replace(/&(amp|lt|gt|quot|#39);/g,(_,x)=>({amp:'&',lt:'<',gt:'>',quot:'"','#39':"'"}[x]));
const KEY='nightcity-red-campaign-drafts';
function memoryStorage(){const m=new Map();return {getItem:k=>m.has(k)?m.get(k):null,setItem:(k,v)=>m.set(k,String(v)),removeItem:k=>m.delete(k)}}
// The journal box and new-opponent form as a browser would show them after parsing the rendered HTML.
const fields=html=>{const m=html.match(/<textarea id="campaign-journal-text"[^>]*>([^]*?)<\/textarea>/),v=id=>unescape(html.match(new RegExp(`<input id="${id}"[^>]*? value="([^"]*)"`))[1]);return {journal:unescape(m[1]).replace(/^\n/,''),name:v('campaign-npc-name'),ref:v('campaign-npc-ref'),hp:v('campaign-npc-hp')}};
function setup({session,campaigns}={}){
 const nodes={'#campaign-journal-text':{value:'',focus(){}},'#campaign-npc-name':{value:'',focus(){}},'#campaign-npc-ref':{value:'6'},'#campaign-npc-hp':{value:'30'}};let open=null;
 const scope={window:{sessionStorage:session},globalThis:{crypto:{randomUUID:(()=>{let i=0;return()=>'id'+(++i)})()}},document:{querySelector:s=>nodes[s]||null},confirm:()=>true,Math,Date,Number,String,Array,Object,JSON,Set,Map,WeakMap,Promise,isNaN};
 vm.createContext(scope);vm.runInContext(src('campaigns.js'),scope);
 const list=campaigns||[{id:'a',name:'Alpha',notes:'',round:1,turnIndex:0,roster:[{id:'x',kind:'npc',name:'X',ref:5,initiative:9,order:1},{id:'y',kind:'npc',name:'Y',ref:5,initiative:3,order:2}]},{id:'b',name:'Beta',notes:'',round:1,turnIndex:0,roster:[]}];
 const ctx={lang:'en',campaigns:list,characters:[],save(){},render(){},isCurrent:c=>list.includes(c)},C=scope.window.Campaigns;
 const click=(action,data={})=>{if(action==='open')open=data.id;if(action==='back')open=null;return C.handle({type:'click',target:{closest:s=>s==='[data-campaign-action]'?{dataset:{campaignAction:action,...data}}:null}},ctx)};
 // Typing into a field that was rendered for campaign `owner` (the open one unless a stale view is simulated).
 const type=(id,value,owner=open)=>{nodes['#'+id].value=value;return C.handle({type:'input',target:{id,value,dataset:{},closest:s=>s==='[data-campaign-view]'?{dataset:{campaignView:owner}}:null}},ctx)};
 return {C,scope,ctx,list,click,type,html:(lang='en')=>C.render(list,[],lang),fields:(lang='en')=>({...fields(C.render(list,[],lang))})};
}

test('journal and new-opponent drafts survive the tracker buttons and a language switch',()=>{
 const h=setup();h.click('open',{id:'a'});
 const note='\nLine <b>&"\'\n— second';
 assert.equal(h.type('campaign-journal-text',note),true);h.type('campaign-npc-name','Merc <i>');h.type('campaign-npc-ref','8');h.type('campaign-npc-hp','');
 for(const action of ['next','roll-all','reset','next']){h.click(action);assert.deepEqual(h.fields(),{journal:note,name:'Merc <i>',ref:'8',hp:''},action)}
 assert.deepEqual(h.fields('ru'),{journal:note,name:'Merc <i>',ref:'8',hp:''});
 assert.match(h.html('ru'),/placeholder="Что произошло/);assert.match(h.html('en'),/placeholder="What happened/);
 assert.equal(h.list[0].journal.length,2);assert(h.list[0].journal.every(e=>e.auto));
});

test('a fresh form renders the defaults and the existing empty markup',()=>{
 const h=setup();h.click('open',{id:'a'});const html=h.html();
 assert.deepEqual(h.fields(),{journal:'',name:'',ref:'6',hp:'30'});
 assert.match(html,/<textarea id="campaign-journal-text" rows="2" maxlength="2000" placeholder="[^"]*"><\/textarea>/);
 assert.match(html,/<div class="campaign-layout" data-campaign-view="a">/);
});

test('submitting clears only the submitted form; a rejected submit keeps the draft',()=>{
 const h=setup();h.click('open',{id:'a'});
 h.type('campaign-npc-name','  ');h.type('campaign-journal-text','   ');h.click('add-npc');h.click('journal-add');
 assert.equal(h.list[0].roster.length,2);assert.equal(h.list[0].journal,undefined);assert.deepEqual(h.fields(),{journal:'   ',name:'  ',ref:'6',hp:'30'});
 h.type('campaign-journal-text','Body found');h.type('campaign-npc-name','Guard');h.type('campaign-npc-ref','7');h.type('campaign-npc-hp','35');
 h.click('journal-add');assert.equal(h.list[0].journal[0].text,'Body found');assert.deepEqual(h.fields(),{journal:'',name:'Guard',ref:'7',hp:'35'});
 h.type('campaign-journal-text','Next note');h.click('add-npc');
 const added=h.list[0].roster.at(-1);assert.deepEqual([added.name,added.ref,added.hp],['Guard',7,35]);
 assert.deepEqual(h.fields(),{journal:'Next note',name:'',ref:'6',hp:'30'});
});

test('drafts are kept per campaign and per scope; a stale field of another campaign is ignored',()=>{
 const h=setup();h.click('open',{id:'a'});h.type('campaign-journal-text','alpha');
 h.click('back');h.click('open',{id:'b'});assert.equal(h.fields().journal,'');
 assert.equal(h.type('campaign-journal-text','typed into the old view','a'),true);assert.equal(h.fields().journal,'');
 h.type('campaign-journal-text','beta');h.click('back');h.click('open',{id:'a'});assert.equal(h.fields().journal,'alpha');
 h.C.setScope('account-b');assert.equal(h.fields().journal,'');h.type('campaign-journal-text','other account');
 h.C.setScope(null);assert.equal(h.fields().journal,'alpha');h.C.setScope('account-b');assert.equal(h.fields().journal,'other account');
});

test('drafts are mirrored to sessionStorage, restored by a fresh load, and dropped with the campaign',()=>{
 const session=memoryStorage(),h=setup({session});h.click('open',{id:'a'});
 h.type('campaign-journal-text','x'.repeat(2500));h.type('campaign-npc-ref','9');
 const stored=JSON.parse(session.getItem(KEY));assert.deepEqual(Object.keys(stored),['\na']);assert.equal(stored['\na'].journal.length,2000);assert.equal(stored['\na'].npcRef,'9');
 const again=setup({session});again.click('open',{id:'a'});assert.deepEqual(again.fields(),{journal:'x'.repeat(2000),name:'',ref:'9',hp:'30'});
 again.type('campaign-journal-text','');again.type('campaign-npc-ref','6');assert.equal(session.getItem(KEY),null);
 again.type('campaign-npc-name','keep');assert.notEqual(session.getItem(KEY),null);again.click('delete');assert.equal(again.list.length,1);assert.equal(session.getItem(KEY),null);
});

test('malformed or blocked sessionStorage never breaks the tracker, and old drafts are capped',()=>{
 for(const raw of ['{bad json','[1,2]','"text"',JSON.stringify({'\na':{journal:5,npcName:{},npcRef:null},'\nb':'x','__proto__':{journal:'p'}})]){const session=memoryStorage();session.setItem(KEY,raw);const h=setup({session});h.click('open',{id:'a'});assert.deepEqual(h.fields(),{journal:'',name:'',ref:'6',hp:'30'});h.type('campaign-journal-text','ok');assert.equal(h.fields().journal,'ok')}
 const blocked={getItem(){throw Error('denied')},setItem(){throw Error('denied')},removeItem(){throw Error('denied')}},h=setup({session:blocked});h.click('open',{id:'a'});h.type('campaign-journal-text','memory only');h.click('next');assert.equal(h.fields().journal,'memory only');
 const session=memoryStorage(),m=setup({session,campaigns:Array.from({length:60},(_,i)=>({id:'c'+i,name:'C'+i,roster:[]}))});for(let i=0;i<60;i++){m.click('open',{id:'c'+i});m.type('campaign-journal-text','n'+i)}
 const kept=Object.keys(JSON.parse(session.getItem(KEY)));assert.equal(kept.length,50);assert.equal(kept[0],'\nc10');assert.equal(kept.at(-1),'\nc59');
});

test('after a re-render, focus and caret return to the journal box and keyboard focus to the pressed tracker button',async()=>{
 const h=setup();h.click('open',{id:'a'});const body={},oldView={dataset:{campaignView:'a'}},log=[];
 const element=(id,dataset={})=>({id,dataset,disabled:false,selectionStart:2,selectionEnd:5,selectionDirection:'backward',scrollTop:40,closest:s=>s==='[data-campaign-view]'?oldView:null,focus(o){log.push(['focus',id||dataset.campaignAction,o?.preventScroll])},setSelectionRange(...a){log.push(['range',...a])}});
 const page=(active,fresh)=>{const doc={activeElement:active,body,querySelector:s=>s==='[data-campaign-view]'?fresh:null};h.scope.document=doc;return doc};
 const newView=(...els)=>({dataset:{campaignView:'a'},querySelector:s=>els.find(e=>'#'+e.id===s)||null,querySelectorAll:s=>s==='[data-campaign-action]'?els.filter(e=>e.dataset.campaignAction):[]});
 // journal box: same caret and scroll after app.js swaps in the new HTML
 let fresh=element('campaign-journal-text');fresh.scrollTop=0;let doc=page(element('campaign-journal-text'),newView(fresh));h.html();doc.activeElement=body;await Promise.resolve();await Promise.resolve();
 assert.deepEqual(log,[['focus','campaign-journal-text',true],['range',2,5,'backward']]);assert.equal(fresh.scrollTop,40);
 // tracker button: focus returns to the new "next" button, not to a row button with an id
 log.length=0;const next=element('',{campaignAction:'next'});doc=page(element('',{campaignAction:'next'}),newView(element('',{campaignAction:'remove',id:'x'}),next));h.html();doc.activeElement=body;await Promise.resolve();await Promise.resolve();
 assert.deepEqual(log,[['focus','next',true]]);
 // nothing is stolen when something else took focus, the view changed campaign, or focus was outside the view
 log.length=0;doc=page(element('campaign-journal-text'),newView(element('campaign-journal-text')));h.html();doc.activeElement={};await Promise.resolve();await Promise.resolve();
 const other=element('campaign-journal-text');other.closest=()=>({dataset:{campaignView:'b'}});doc=page(other,newView(element('campaign-journal-text')));h.html();doc.activeElement=body;await Promise.resolve();
 doc=page(element('campaign-journal-text'),{...newView(element('campaign-journal-text')),dataset:{campaignView:'b'}});h.html();doc.activeElement=body;await Promise.resolve();
 doc=page(element('',{campaignAction:'remove',id:'x'}),newView(element('',{campaignAction:'remove',id:'x'})));h.html();doc.activeElement=body;await Promise.resolve();
 assert.deepEqual(log,[]);
});

// B3: every cell of a tracker row sits in a named grid area, and HP has its own area in every layout.
// Top-level cells of each rendered `.combatant` row (void and <option> tags do not change the nesting depth).
function rowCells(html){const rows=[];let i=0;while((i=html.indexOf('<div class="combatant',i))>=0){const re=/<(\/?)([a-z]+)([^>]*)>/g;re.lastIndex=i;let depth=0,m,cells=[],rowClass;for(;(m=re.exec(html));){const [,close,tag,attrs]=m;if(['input','br','img','option'].includes(tag))continue;if(close){depth--;if(depth===0)break;continue}if(depth===0)rowClass=(attrs.match(/class="([^"]*)"/)||[])[1];if(depth===1)cells.push(((attrs.match(/class="([^"]*)"/)||[])[1]||tag).trim());depth++}rows.push({rowClass,cells});i=re.lastIndex}return rows}
const tracks=v=>{v=v.replace(/repeat\((\d+),([^()]*(?:\([^()]*\))?[^()]*)\)/g,(_,n,x)=>Array(+n).fill(x.trim()).join(' '));const out=[];let depth=0,cur='';for(const ch of v.trim()){if(ch==='(')depth++;if(ch===')')depth--;if(ch===' '&&!depth){if(cur)out.push(cur);cur=''}else cur+=ch}if(cur)out.push(cur);return out.length};
test('tracker rows: PC and NPC cells all have grid areas and HP keeps its own column in every layout',()=>{
 const scope={window:{},globalThis:{},document:{querySelector:()=>null},confirm:()=>true,Math,Date,Number,String,Array,Object,JSON,Set,Map,WeakMap,Promise,isNaN};vm.createContext(scope);vm.runInContext(src('campaigns.js'),scope);const C=scope.window.Campaigns;
 const campaign={id:'k',name:'K',roster:[{id:'p',kind:'pc',characterId:'v',initiative:12,order:1},{id:'n',kind:'npc',name:'Goon',ref:6,hp:120,initiative:8,order:2}]};
 C.handle({type:'click',target:{closest:s=>s==='[data-campaign-action]'?{dataset:{campaignAction:'open',id:'k'}}:null}},{lang:'en',campaigns:[campaign],characters:[],render(){}});
 const css=src('styles.css'),areaOf=new Map([...css.matchAll(/\.combatant>\.([a-z-]+)\{grid-area:([a-z]+)/g)].map(m=>[m[1],m[2]]));
 const rules=[...css.matchAll(/(?<=^|[{}\n])\s*(\.combatant(?:\.has-hp-reason)?)\{([^}]*)\}/g)].map(m=>({sel:m[1],cols:(m[2].match(/grid-template-columns:([^;]+)/)||[])[1],areas:(m[2].match(/grid-template-areas:([^;]+)/)||[])[1]})).filter(r=>r.areas);
 assert(rules.length>=4);let columns;
 let base;for(const r of rules){const rows=[...r.areas.matchAll(/"([^"]+)"/g)].map(m=>m[1].trim().split(/\s+/));if(r.cols)columns=tracks(r.cols);assert(rows.every(x=>x.length===columns),r.areas);for(const name of ['ord','name','init','bonus','hp','del'])assert(rows.flat().includes(name),r.areas);assert.equal(rows.flat().includes('reason'),r.sel==='.combatant.has-hp-reason',r.areas);
  // a PC row starts exactly like an NPC row, so HP stays in the same column for everyone
  if(r.sel==='.combatant')base=rows;else assert.deepEqual(rows.slice(0,base.length),base,r.areas)}
 for(const lang of ['en','ru']){const rows=rowCells(C.render([campaign],[{id:'v',name:'Nova',hp:45}],lang));assert.equal(rows.length,2);
  const [pc,npc]=rows;assert.match(pc.rowClass,/\bhas-hp-reason\b/);assert.doesNotMatch(npc.rowClass,/has-hp-reason/);
  for(const row of rows)for(const cell of row.cells){if(/\bcampaign-combat-note\b/.test(cell))continue;const area=cell.split(/\s+/).map(c=>areaOf.get(c)).find(Boolean);assert(area,`cell "${cell}" has no grid area`)}
  assert(pc.cells.some(c=>/\bcamp-hp-reason\b/.test(c))&&pc.cells.some(c=>/\bcamp-hp\b/.test(c))&&npc.cells.some(c=>/\bcamp-hp\b/.test(c)))}
});

test('real app: Next and a language switch re-render the campaign without losing the typed journal and opponent drafts',()=>{
 const handlers={},node=()=>({innerHTML:'',addEventListener(type,fn){handlers[type]=fn},setAttribute(){}}),nodes={'#app':node(),'#sync-root':node(),'#sync-adapter-status':node(),'#app-notice':{textContent:'',classList:{add(){},remove(){}}}};
 const campaign={id:'campaign',name:'First job',notes:'',round:1,turnIndex:0,roster:[{id:'a',kind:'npc',name:'Guard',ref:5,initiative:9,order:1},{id:'b',kind:'npc',name:'Boss',ref:7,initiative:3,order:2}]};
 const w={ROLES:[],CombatTools:{handle:()=>false},Book:{handle:()=>false},NetTools:{setScope(){},validArchitectures:Array.isArray},LocalStore:{create(){return{start(){},getScope:()=>'local',stateLabel:()=>'',canEdit:()=>true,refreshLanguage(){},save(){return Promise.resolve({ok:true})}}}},scrollTo(){}};
 const context={window:w,document:{querySelector:key=>nodes[key]||null,documentElement:{},title:''},localStorage:{getItem:()=>JSON.stringify({characters:[],campaigns:[campaign],lang:'en'})},globalThis:{crypto:{randomUUID:()=>'uuid'}},confirm:()=>true,setTimeout:()=>0,clearTimeout(){},console,Math,Date,JSON,Set,Map,WeakMap,Number,String,Array,Object,Promise};vm.createContext(context);
 vm.runInContext(src('campaigns.js'),context);vm.runInContext(src('app.js')+'\nwindow.qa={go:view=>{state.view=view;render()},state:()=>state};',context);
 const dispatch=(type,target)=>handlers[type]({type,target}),click=(attr,dataset)=>dispatch('click',{closest:s=>s===attr?{dataset}:null});
 const type=(id,value)=>dispatch('input',{id,value,dataset:{},hasAttribute:()=>false,closest:s=>s==='[data-campaign-view]'?{dataset:{campaignView:'campaign'}}:null});
 w.qa.go('campaigns');click('[data-campaign-action]',{campaignAction:'open',id:'campaign'});
 type('campaign-journal-text','Boss fled <north>');type('campaign-npc-name','Sniper');type('campaign-npc-hp','25');
 click('[data-campaign-action]',{campaignAction:'next'});assert.equal(w.qa.state().campaigns[0].turnIndex,1);
 assert.deepEqual({...fields(nodes['#app'].innerHTML)},{journal:'Boss fled <north>',name:'Sniper',ref:'6',hp:'25'});
 click('[data-action]',{action:'lang',lang:'ru'});assert.equal(w.qa.state().lang,'ru');
 assert.deepEqual({...fields(nodes['#app'].innerHTML)},{journal:'Boss fled <north>',name:'Sniper',ref:'6',hp:'25'});assert.match(nodes['#app'].innerHTML,/Что произошло/);
});
