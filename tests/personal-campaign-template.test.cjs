const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const source=fs.readFileSync('public/game/campaigns.js','utf8');
const makeTemplate=(id='boosterganger')=>({id,name:{ru:'Бустергангер',en:'Boosterganger'},stats:{REF:6},hp:20,page:412});
function setup(lang='en',templates=[makeTemplate()]){
 let saveCount=0,renderCount=0,current=true,next=0;const window={GMTools:{NPC_TEMPLATES:templates}}, notices=[];
 const campaign={id:'c',name:'Test',notes:'',round:3,turnIndex:1,future:{keep:true},roster:[{id:'a',kind:'npc',name:'A',hp:10,ref:6,initiative:-5,order:1},{id:'b',kind:'npc',name:'B',hp:5,ref:5,initiative:-10,order:2}]};
 const ctx={lang,campaigns:[campaign],characters:[],isCurrent:x=>current&&x===campaign,scope:'account',save:()=>saveCount++,render:()=>renderCount++,notify:s=>notices.push(s)};
 const root={isConnected:true,querySelector:()=>select},select={isConnected:true,value:'boosterganger'},button={dataset:{campaignAction:'add-template'},isConnected:true,closest:s=>s==='[data-campaign-template-root]'?root:null};
 const sandbox={window,document:{querySelector:()=>null},confirm:()=>true,Math,Date,globalThis:{crypto:{randomUUID:()=>`new-${++next}`}}};vm.runInNewContext(source,sandbox);
 const click=btn=>window.Campaigns.handle({type:'click',target:{closest:()=>btn}},ctx);
 click({dataset:{campaignAction:'open',id:'c'}});
 return {window,ctx,campaign,root,select,button,click,notices,get saves(){return saveCount},get renders(){return renderCount},stale(){current=false}};
}
test('copies the chosen book template and preserves the active turn and existing campaign data',()=>{
 const h=setup();const before=h.window.Campaigns.render(h.ctx.campaigns,[],'en');assert.match(before,/NPC from the book/);assert.match(before,/Boosterganger/);assert.match(before,/records are independent/i);
 h.click(h.button);assert.equal(h.saves,1);assert.equal(h.campaign.round,3);assert.equal(h.campaign.turnIndex,2);assert.equal(h.campaign.roster[1].id,'b');assert.equal(h.campaign.future.keep,true);const added=h.campaign.roster[2];assert.equal(added.kind,'npc');assert.equal(added.name,'Boosterganger');assert.equal(added.ref,6);assert.equal(added.hp,20);assert.equal(added.sourceTemplate,'boosterganger');assert.equal(added.sourcePage,412);assert.match(h.window.Campaigns.render(h.ctx.campaigns,[],'en'),/Book, p\. 412/);
});
test('Russian output uses translated name and can add multiple independent enemies',()=>{const h=setup('ru');h.click(h.button);h.click(h.button);assert.equal(h.campaign.roster.length,4);assert.equal(h.campaign.roster[2].name,'Бустергангер');assert.notEqual(h.campaign.roster[2].id,h.campaign.roster[3].id);assert.match(h.window.Campaigns.render(h.ctx.campaigns,[],'ru'),/Книга, стр\. 412/)});
test('unsupported or ambiguous templates are not offered or added',()=>{for(const rows of [[],[makeTemplate(),makeTemplate()],[{...makeTemplate(),hp:-10}],[{...makeTemplate(),stats:{REF:30}}]]){const h=setup('en',rows);h.click(h.button);assert.equal(h.campaign.roster.length,2);assert.equal(h.saves,0);assert(h.notices.length);assert.doesNotMatch(h.window.Campaigns.render(h.ctx.campaigns,[],'en'),/data-campaign-template-root/)} });
test('stale or detached controls never modify the campaign',()=>{for(const which of ['scope','button','root','select']){const h=setup();if(which==='scope')h.stale();else h[which].isConnected=false;h.click(h.button);assert.equal(h.campaign.roster.length,2);assert.equal(h.saves,0);assert(h.notices.length)}});
test('a generated ID collision leaves the existing roster intact',()=>{const h=setup();h.campaign.roster[0].id='new-1';h.click(h.button);assert.equal(h.campaign.roster.length,2);assert.equal(h.campaign.roster[0].name,'A');assert.equal(h.saves,0)});
