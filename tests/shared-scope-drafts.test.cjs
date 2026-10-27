const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const code=fs.readFileSync(path.join(__dirname,'../public/game/shared-campaigns.js'),'utf8');
const response=(body,status=200)=>({ok:status>=200&&status<300,status,json:async()=>body});
const tick=()=>new Promise(resolve=>setImmediate(resolve));
function deferred(){let resolve;const promise=new Promise(r=>resolve=r);return {promise,resolve}}
function setup(){
 let current='scope-a',language='en',waitList=null,failList=false,authError=null,notesConflict=false,visible=true,saveGate=null;const handlers={},calls=[],unload={};
 const makeRoot=()=>({innerHTML:'',inert:false,addEventListener:(type,fn)=>handlers[type]=fn,querySelector:()=>null});let root=makeRoot();
 const fetch=async(url,options)=>{
  const scope=current;calls.push({scope,url,method:options.method,body:options.body&&JSON.parse(options.body)});
  if(authError)return response({error:authError===401?'authentication_required':'forbidden'},authError);
  if(options.method==='GET'&&url==='/api/campaigns'){
   if(failList)throw Error('offline');if(waitList){let wait=waitList;waitList=null;return wait.promise}
   return response({scope,campaigns:scope==='scope-a'&&visible?[{id:'c',name:'Crew',role:'owner'}]:[]});
  }
  if(options.method==='GET'&&url==='/api/campaigns/c')return response({scope,id:'c',name:'Crew',role:'owner',revision:3,shared:{description:'Original'},members:[{id:'member',role:'owner',mine:true}]});
  if(options.method==='GET'&&url.endsWith('/notes'))return response({scope,notes:'Private original',revision:1});
  if(options.method==='GET'&&url.endsWith('/invites'))return response({scope,invites:[]});
  if(options.method==='GET'&&url.endsWith('/shares'))return response({scope,shares:[]});
  if(options.method==='PUT'&&url.endsWith('/notes'))return notesConflict?response({error:'revision_conflict'},409):response({revision:2});
  if(options.method==='PUT'&&url==='/api/campaigns/c')return saveGate?saveGate.promise:response({revision:4});
  throw Error('unexpected '+url);
 };
 const box={window:{},document:{querySelector:s=>s==='#shared-campaigns'?root:null},location:{hash:'',pathname:'/game/index.html',search:'',origin:'https://site.test'},history:{replaceState(){}},navigator:{onLine:true},confirm:()=>true,fetch,Date,crypto:{randomUUID:()=> 'combat-id'},addEventListener:(type,fn)=>unload[type]=fn,console};
 vm.runInNewContext(code,box);const api=box.window.SharedCampaigns;
 const mount=()=>api.mount({scope:current,lang:language,getScope:()=>current,characters:[]});mount();
 return {get root(){return root},calls,unload,api,mount,replaceRoot(){root=makeRoot();mount()},async click(action,id){await handlers.click({target:{closest:()=>({dataset:{shared:action,...id?{id}:{}}})},stopPropagation(){}})},input(id,value){handlers.input({target:{id,value}})},inputCombat(id,key,value){handlers.input({target:{value,dataset:{id,combatField:key}}})},changeCombat(id,key,value){handlers.change({target:{value,dataset:{id,combatField:key}}})},scope(s){current=s;api.setScope(s);mount()},language(s){language=s;mount()},holdList(){waitList=deferred();return waitList},failList(v){failList=v},authError(v){authError=v},notesConflict(v){notesConflict=v},visible(v){visible=v},holdSave(){saveGate=deferred();return saveGate}};
}
async function prepare(x){await x.click('toggle');await x.click('open','c');x.input('shared-name','Draft title');x.input('shared-description','Draft plan');x.input('shared-notes','GM SECRET DRAFT');x.input('shared-combat-name','DRAFT FOE');await x.click('combat-add');}
test('reconnect hides all prior fields until a fresh matching account response and then restores drafts',async()=>{
 const x=setup();await prepare(x);assert(x.root.innerHTML.includes('GM SECRET DRAFT'));x.scope(null);assert(!x.root.innerHTML.includes('GM SECRET DRAFT'));assert(!x.root.innerHTML.includes('DRAFT FOE'));
 let hiddenPrevented=false;x.unload.beforeunload({preventDefault(){hiddenPrevented=true},set returnValue(v){}});assert.equal(hiddenPrevented,true);
 let gate=x.holdList();x.scope('scope-a');assert(x.root.innerHTML.includes('Reconnect to verify'));assert(!x.root.innerHTML.includes('GM SECRET DRAFT'));gate.resolve(response({scope:'scope-a',campaigns:[{id:'c'}]}));await tick();
 for(const text of ['Draft title','Draft plan','GM SECRET DRAFT','DRAFT FOE'])assert(x.root.innerHTML.includes(text),text);
 let prevented=false;x.unload.beforeunload({preventDefault(){prevented=true},set returnValue(v){}});assert.equal(prevented,true);
});
test('language rerender, scope loss and switching accounts never expose A drafts in B',async()=>{
 const x=setup();await prepare(x);x.language('ru');assert(x.root.innerHTML.includes('GM SECRET DRAFT'));x.scope(null);x.scope('scope-b');await tick();for(const s of ['Draft title','GM SECRET DRAFT','DRAFT FOE'])assert(!x.root.innerHTML.includes(s));
 x.scope(null);x.scope('scope-a');await tick();for(const s of ['Draft title','Draft plan','GM SECRET DRAFT','DRAFT FOE'])assert(x.root.innerHTML.includes(s),s);
});
test('failed reconnection keeps drafts hidden and retry restores only after account verification',async()=>{
 const x=setup();await prepare(x);x.scope(null);x.failList(true);x.scope('scope-a');await tick();assert(x.root.innerHTML.includes('Reconnect to verify'));assert(!x.root.innerHTML.includes('GM SECRET DRAFT'));x.failList(false);await x.click('verify-draft');assert(x.root.innerHTML.includes('GM SECRET DRAFT'));
});
test('repeated scope loss while a verification request is pending cannot replace the original draft',async()=>{
 const x=setup();await prepare(x);x.scope(null);let first=x.holdList();x.scope('scope-a');assert(!x.root.innerHTML.includes('GM SECRET DRAFT'));x.scope(null);x.scope('scope-a');await tick();assert(x.root.innerHTML.includes('GM SECRET DRAFT'));
 first.resolve(response({scope:'scope-a',campaigns:[{id:'c'}]}));await tick();assert(x.root.innerHTML.includes('DRAFT FOE'));assert(x.root.innerHTML.includes('Draft plan'));
});
test('loss of access keeps authored drafts available for copying without revealing stale campaign detail',async()=>{
 const x=setup();await prepare(x);x.scope(null);x.visible(false);x.scope('scope-a');await tick();assert(x.root.innerHTML.includes('GM SECRET DRAFT'));assert(x.root.innerHTML.includes('DRAFT FOE'));assert(x.root.innerHTML.includes('campaign_no_longer_accessible'));assert(!x.root.innerHTML.includes('data-shared="combat-add"'));
});
test('a delayed response from before scope loss cannot acknowledge a restored unsaved draft',async()=>{
 const x=setup();await prepare(x);const gate=x.holdSave(),pending=x.click('save-shared');assert.equal(x.root.inert,true);x.scope(null);x.scope('scope-a');await tick();assert(x.root.innerHTML.includes('GM SECRET DRAFT'));gate.resolve(response({revision:4}));await pending;assert(x.root.innerHTML.includes('Draft plan'));assert(!x.root.innerHTML.includes('Saved.'));assert.equal(x.root.inert,false);
});
test('401 or 403 immediately hide private drafts even before the sync status updates and recover them only after same-account verification',async()=>{
 for(const status of [401,403]){
  const x=setup();await prepare(x);assert(x.root.innerHTML.includes('GM SECRET DRAFT'));
  x.authError(status);await x.click('refresh');assert.equal(x.root.inert,false);assert(!x.root.innerHTML.includes('GM SECRET DRAFT'));assert(!x.root.innerHTML.includes('DRAFT FOE'));assert(x.root.innerHTML.includes('Sign in and wait'));
  let prevented=false;x.unload.beforeunload({preventDefault(){prevented=true},set returnValue(v){}});assert.equal(prevented,true);
  x.authError(null);x.scope('scope-a');await tick();assert(x.root.innerHTML.includes('GM SECRET DRAFT'));assert(x.root.innerHTML.includes('DRAFT FOE'));
 }
});
test('a stale request cannot release the inert guard belonging to a newer in-flight request',async()=>{
 const x=setup();await prepare(x);const first=x.holdSave(),old=x.click('save-shared');assert.equal(x.root.inert,true);
 x.scope(null);assert.equal(x.root.inert,false);x.scope('scope-a');await tick();assert.equal(x.root.inert,false);
 const second=x.holdSave(),fresh=x.click('save-shared');assert.equal(x.root.inert,true);
 first.resolve(response({revision:4}));await old;assert.equal(x.root.inert,true);
 second.resolve(response({revision:4}));await fresh;assert.equal(x.root.inert,false);
});
test('a new DOM root stays inert during its in-flight operation and is released when it finishes',async()=>{
 const x=setup();await prepare(x);const gate=x.holdSave(),pending=x.click('save-shared');assert.equal(x.root.inert,true);
 x.replaceRoot();assert.equal(x.root.inert,true);gate.resolve(response({revision:4}));await pending;assert.equal(x.root.inert,false);assert(x.root.innerHTML.includes('Saved.'));
});
test('unfinished combat numbers survive reconnect, block save, warn on unload, and commit only on valid change',async()=>{
 const x=setup();await prepare(x);x.inputCombat('combat-id','hp','27');
 let prevented=false;x.unload.beforeunload({preventDefault(){prevented=true},set returnValue(v){}});assert.equal(prevented,true);
 x.scope(null);x.scope('scope-a');await tick();assert.match(x.root.innerHTML,/data-combat-field="hp" data-id="combat-id"[^>]*value="27"/);
 await x.click('save-shared');assert.equal(x.calls.filter(c=>c.method==='PUT'&&c.url==='/api/campaigns/c').length,0);
 x.changeCombat('combat-id','hp','27');await x.click('save-shared');const last=x.calls.filter(c=>c.method==='PUT'&&c.url==='/api/campaigns/c').at(-1);assert.equal(last.body.shared.combat.roster[0].hp,27);
});
test('invalid combat input survives rerender and conflict export contains the uncommitted text',async()=>{
 const x=setup();await prepare(x);x.inputCombat('combat-id','hp','10000');x.changeCombat('combat-id','hp','10000');assert.match(x.root.innerHTML,/data-combat-field="hp" data-id="combat-id"[^>]*value="10000"/);
 x.input('shared-notes','Unsaved private');x.notesConflict(true);await x.click('save-notes');assert(x.root.innerHTML.includes('pendingCombatFields'));assert(x.root.innerHTML.includes('10000'));assert(x.root.innerHTML.includes('Unsaved private'));
});
test('an unfinished minus sign remains visible after reconnect and is never applied as a number',async()=>{
 const x=setup();await prepare(x);x.inputCombat('combat-id','hp','-');x.scope(null);x.scope('scope-a');await tick();assert.match(x.root.innerHTML,/data-combat-field="hp" data-id="combat-id"[^>]*value="-"/);x.changeCombat('combat-id','hp','-');await x.click('save-shared');assert.equal(x.calls.filter(c=>c.method==='PUT'&&c.url==='/api/campaigns/c').length,0);assert.match(x.root.innerHTML,/data-combat-field="hp" data-id="combat-id"[^>]*value="-"/);
});
