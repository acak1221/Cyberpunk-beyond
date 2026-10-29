const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const source=fs.readFileSync('public/game/campaigns.js','utf8');
function setup(lang='en'){
 let saves=0,renders=0,current=true,next=0,onConfirm=()=>true;const messages=[];
 const template={id:'boost',name:{ru:'Бустер',en:'Booster'},stats:{REF:6},hp:30,page:412};
 const row={id:'gm1',template:'boost',name:'Veteran',hp:8,notes:'Secret',armorTrack:{version:1,head:3,body:4},future:{v:1}};
 const workspace={roster:[row],future:{data:1}};
 const window={GMTools:{NPC_TEMPLATES:[template],validWorkspace:w=>!!w&&Array.isArray(w.roster)&&w.roster.every(n=>n&&typeof n.id==='string'&&typeof n.template==='string'&&typeof n.name==='string'&&typeof n.notes==='string'&&Number.isInteger(n.hp))}};
 const campaign={id:'c',name:'A',notes:'N',round:4,turnIndex:1,roster:[{id:'one',kind:'npc',name:'One',hp:10,ref:4,initiative:-1,order:1},{id:'two',kind:'npc',name:'Two',hp:20,ref:5,initiative:-3,order:2}]};
 const ctx={campaigns:[campaign],characters:[],gmWorkspace:workspace,lang,scope:'account',save:()=>saves++,render:()=>renders++,notify:m=>messages.push(m),isCurrent:c=>current&&c===campaign&&ctx.gmWorkspace===workspace};
 const select={value:'gm1',isConnected:true},refInput={value:'6',isConnected:true},root={isConnected:true,dataset:{campaignGmEpoch:'1'},querySelector:s=>s==='[data-campaign-gm-npc]'?select:s==='[data-campaign-gm-ref]'?refInput:null},button={isConnected:true,dataset:{campaignAction:'add-gm-npc'},closest:s=>s==='[data-campaign-gm-root]'?root:null};
 const sandbox={window,document:{querySelector:()=>null},globalThis:{crypto:{randomUUID:()=>`id-${++next}`}},confirm:()=>onConfirm(),Date,Math};vm.runInNewContext(source,sandbox);
 window.Campaigns.setScope('account');const click=b=>window.Campaigns.handle({type:'click',target:{closest:()=>b}},ctx);click({dataset:{campaignAction:'open',id:'c'}});
 return {ctx,campaign,workspace,row,template,window,button,root,select,refInput,click,messages,get saves(){return saves},get renders(){return renders},setConfirm(fn){onConfirm=fn},stale(){current=false}};
}
test('copies prepared NPC current HP and name with template REF, preserving original and active turn',()=>{
 const h=setup(),before=JSON.stringify(h.workspace),html=h.window.Campaigns.render(h.ctx.campaigns,[],'en',h.workspace);assert.match(html,/Prepared NPC/);assert.match(html,/Veteran.*HP 8.*REF 6/);assert.match(html,/Armor, effects and notes are not copied/);
 h.click(h.button);assert.equal(h.saves,1);assert.equal(h.renders,2);assert.equal(JSON.stringify(h.workspace),before);assert.equal(h.campaign.round,4);assert.equal(h.campaign.turnIndex,2);
 const n=h.campaign.roster[2];assert.equal(n.name,'Veteran');assert.equal(n.hp,8);assert.equal(n.ref,6);assert.equal(n.sourceTemplate,'boost');assert.equal(n.sourcePage,412);assert.equal(n.notes,undefined);assert.equal(n.armorTrack,undefined);
 n.hp=1;n.name='Change';assert.equal(h.row.hp,8);assert.equal(h.row.name,'Veteran');
});
test('Russian text and name fall back to template without mutating the source',()=>{const h=setup('ru');h.row.name='';const html=h.window.Campaigns.render(h.ctx.campaigns,[],'ru',h.workspace);assert.match(html,/Подготовленный NPC/);assert.match(html,/Бустер/);h.click(h.button);assert.equal(h.campaign.roster[2].name,'Бустер');assert.equal(h.row.name,'')});
test('cancellation and changes to campaign, source, scope or selection during confirmation reject copy',()=>{
 for(const change of ['cancel','campaign','source','account','selection','replace','template']){const h=setup();h.setConfirm(()=>{if(change==='cancel')return false;if(change==='campaign')h.campaign.round=5;if(change==='source')h.row.hp=9;if(change==='account'){h.window.Campaigns.setScope('other');h.window.Campaigns.setScope('account')}if(change==='selection')h.select.value='other';if(change==='replace')h.workspace.roster[0]={...h.row};if(change==='template')h.template.stats.REF=7;return true});h.click(h.button);assert.equal(h.saves,0,change);assert.equal(h.campaign.roster.length,2,change)}
});
test('incompatible, ambiguous, detached and stale inputs leave all records intact',()=>{
 for(const change of ['invalid-workspace','ambiguous','detached','stale','collision','invalid-campaign','scope']){const h=setup();if(change==='invalid-workspace')h.ctx.gmWorkspace.roster=null;if(change==='ambiguous')h.workspace.roster.push({...h.row});if(change==='detached')h.select.isConnected=false;if(change==='stale')h.stale();if(change==='collision'){h.campaign.roster[0].id='id-1';h.campaign.roster[1].id='id-2';h.campaign.roster.push({id:'id-3',kind:'npc',name:'X',initiative:0})}if(change==='invalid-campaign')h.campaign.roster[1].id='one';if(change==='scope')h.ctx.scope='other';const before=JSON.stringify(h.campaign);h.click(h.button);assert.equal(h.saves,0,change);assert.equal(JSON.stringify(h.campaign),before,change)}
});
test('selection uses armor-adjusted REF and allows a manually corrected value',()=>{
 const h=setup();h.template.stats.REF=8;h.template.effectiveStats={REF:6};h.select.dataset={campaignGmNpc:''};h.select.closest=s=>s==='[data-campaign-gm-root]'?h.root:null;h.refInput.value='';
 h.window.Campaigns.handle({type:'change',target:h.select},h.ctx);assert.equal(h.refInput.value,'6');h.refInput.value='7';h.click(h.button);assert.equal(h.saves,1);assert.equal(h.campaign.roster[2].ref,7);
});
test('invalid REF and a changed REF during confirmation do not copy a combatant',()=>{
 for(const value of ['', '-1', '21', '2.5']){const h=setup();h.refInput.value=value;h.click(h.button);assert.equal(h.saves,0,value);assert.equal(h.campaign.roster.length,2,value)}
 const h=setup();h.setConfirm(()=>{h.refInput.value='8';return true});h.click(h.button);assert.equal(h.saves,0);assert.equal(h.campaign.roster.length,2);
});
