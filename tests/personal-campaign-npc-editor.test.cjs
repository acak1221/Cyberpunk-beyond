const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const source=fs.readFileSync('public/game/campaigns.js','utf8');
function setup(){
 let saves=0,renders=0,allowed=true;const messages=[],math=Object.create(Math);math.random=()=>0.25;
 const npc={id:'n',kind:'npc',name:'Merc',ref:6,hp:12,initiative:11,bonus:2,order:2,notes:{future:true}},pc={id:'p',name:'Player',stats:{REF:4},hp:18},pcEntry={id:'p1',kind:'pc',characterId:'p',initiative:15,bonus:0,order:1};
 const campaign={id:'campaign',name:'A',notes:'',round:5,turnIndex:1,roster:[pcEntry,npc]},window={};
 const ctx={campaigns:[campaign],characters:[pc],lang:'en',scope:'account',save:()=>saves++,render:()=>renders++,notify:m=>messages.push(m),isCurrent:c=>allowed&&c===campaign};
 const sandbox={window,document:{querySelector:()=>null},globalThis:{crypto:{randomUUID:()=> 'unique'}},confirm:()=>true,Date,Math:math};vm.runInNewContext(source,sandbox);window.Campaigns.setScope('account');
 const action=a=>window.Campaigns.handle({type:'click',target:{closest:s=>s==='[data-campaign-action]'?{dataset:{campaignAction:a,id:'campaign'}}:null}},ctx);action('open');
 const html=window.Campaigns.render([campaign],[pc],'en'),token=html.match(/data-camp-npc-token="(\d+)"/)[1],heading={textContent:'Merc'},row={isConnected:true,querySelector:s=>s==='.combat-name strong'?heading:null},editor={isConnected:true,dataset:{campNpcEpoch:'1',campNpcToken:token},closest:s=>s==='.combatant'?row:null};
 const name={isConnected:true,value:'Merc',dataset:{campNpcName:'n',campNpcOriginal:'Merc'}},ref={isConnected:true,value:'6',dataset:{campNpcRef:'n',campNpcOriginal:'6'}};
 editor.querySelector=s=>s==='[data-camp-npc-name]'?name:s==='[data-camp-npc-ref]'?ref:null;
 for(const el of [name,ref])el.closest=s=>s==='[data-camp-npc-editor]'?editor:s==='.combatant'?row:null;
 const edit=(el,type='input')=>window.Campaigns.handle({type,target:el},ctx);
 return {window,ctx,campaign,npc,pc,pcEntry,html,heading,row,editor,name,ref,action,edit,messages,stale:()=>allowed=false,get saves(){return saves},get renders(){return renders}};
}
test('NPC name and REF edits preserve the current encounter and apply REF on next initiative roll',()=>{
 const h=setup(),originalPc=JSON.stringify(h.pc),originalNotes=JSON.stringify(h.npc.notes);assert.match(h.html,/Edit name and REF/);assert.match(h.html,/next initiative roll/);
 h.name.value='Renamed';assert.equal(h.edit(h.name),true);assert.equal(h.npc.name,'Renamed');assert.equal(h.heading.textContent,'Renamed');
 h.ref.value='8';assert.equal(h.edit(h.ref),true);assert.equal(h.npc.ref,8);assert.equal(h.npc.initiative,11);assert.equal(h.npc.hp,12);assert.equal(h.npc.bonus,2);assert.equal(h.campaign.turnIndex,1);assert.equal(h.campaign.round,5);assert.equal(JSON.stringify(h.pc),originalPc);assert.equal(JSON.stringify(h.npc.notes),originalNotes);assert.equal(h.saves,2);
 h.action('roll-all');assert.equal(h.npc.initiative,13);assert.equal(h.pcEntry.initiative,7);
});
test('invalid and incomplete values cannot corrupt an NPC; change restores the previous value',()=>{
 for(const raw of ['', '-1', '21', '1.5', '999']){const h=setup();h.ref.value=raw;h.edit(h.ref);assert.equal(h.npc.ref,6,raw);assert.equal(h.saves,0,raw);h.edit(h.ref,'change');assert.equal(h.ref.value,'6',raw)}
 const h=setup();h.name.value=' ';h.edit(h.name);assert.equal(h.npc.name,'Merc');h.edit(h.name,'change');assert.equal(h.name.value,'Merc');assert.equal(h.saves,0);
});
test('stale account, detached editor, replacement or concurrent edit cannot overwrite data',()=>{
 for(const kind of ['account','aba','detached','replace','modified','scope','stale']){const h=setup();h.ref.value='8';if(kind==='account')h.window.Campaigns.setScope('other');if(kind==='aba'){h.window.Campaigns.setScope('other');h.window.Campaigns.setScope('account')}if(kind==='detached')h.editor.isConnected=false;if(kind==='replace')h.campaign.roster[1]={...h.npc};if(kind==='modified')h.npc.ref=9;if(kind==='scope')h.ctx.scope='other';if(kind==='stale')h.stale();const before=JSON.stringify(h.campaign);h.edit(h.ref);assert.equal(JSON.stringify(h.campaign),before,kind);assert.equal(h.saves,0,kind);assert.ok(h.messages.length,kind)}
});
test('player records, ambiguous IDs and unsupported data are protected',()=>{
 const h=setup();h.npc.kind='pc';const before=JSON.stringify(h.campaign);h.ref.value='8';h.edit(h.ref);assert.equal(JSON.stringify(h.campaign),before);assert.equal(h.saves,0);
 const a=setup();a.campaign.roster.push({...a.npc});a.ref.value='8';a.edit(a.ref);assert.equal(a.saves,0);
 const b=setup();b.npc.ref={future:true};const html=b.window.Campaigns.render([b.campaign],[b.pc],'en');assert.match(html,/format is incompatible/);assert.doesNotMatch(html,/data-camp-npc-ref="n"/);
});
