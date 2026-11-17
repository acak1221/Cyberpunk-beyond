// Tracker NPC rows open the shared HP pad (SP from the row's armor) and the add-template form has a threat level select.
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const source=fs.readFileSync(__dirname+'/../site/campaigns.js','utf8'),css=fs.readFileSync(__dirname+'/../site/gm-table.css','utf8');
const tpl={id:'bodyguard',name:{ru:'Телохранитель',en:'Bodyguard'},stats:{REF:6},hp:35,page:412,armor:{name:'Kevlar',headSP:7,bodySP:11}};
function setup({lang='en',levels=true,pad=true}={}){
 let next=0,saves=0,renders=0;const opened=[],added=[];
 const window={GMTools:{NPC_TEMPLATES:[tpl]},HpPad:pad?{open:(t,o)=>{opened.push({t,o})}}:undefined};
 if(levels){window.GMTools.LEVELS=['mook','lieutenant','miniboss','boss'];window.GMTools.LEVEL_NAMES={ru:{mook:'Рядовой',lieutenant:'Лейтенант',miniboss:'Мини-босс',boss:'Босс'},en:{mook:'Mook',lieutenant:'Lieutenant',miniboss:'Mini boss',boss:'Boss'}};
  window.GMTools.addToCampaign=(c,id,n,l,lv)=>{added.push([id,n,l,lv]);return window.Campaigns.addTemplates(c,id,n,l)}}
 const campaign={id:'c',name:'Job',notes:'',round:1,turnIndex:0,roster:[{id:'n1',kind:'npc',name:'Thug',hp:20,ref:5,initiative:3,order:1,sp:{head:4,body:9}}]};
 const ctx={lang,campaigns:[campaign],characters:[],isCurrent:x=>x===campaign,scope:'account',save:()=>saves++,render:()=>renders++,notify(){}};
 vm.runInNewContext(source,{window,document:{querySelector:()=>null},confirm:()=>true,Math,Date,globalThis:{crypto:{randomUUID:()=>`new-${++next}`}}});
 const click=btn=>window.Campaigns.handle({type:'click',target:{closest:s=>s==='[data-camp-hp-pad]'?btn:(btn?.__root&&s==='[data-campaign-template-root]'?btn.__root:null)}},ctx);
 window.Campaigns.handle({type:'click',target:{closest:()=>({dataset:{campaignAction:'open',id:'c'}})}},ctx);
 return {window,ctx,campaign,opened,added,click,get saves(){return saves},get renders(){return renders}};
}
test('an NPC row has the «Change HP» button and the pad gets the SP of its armor',()=>{
 const h=setup(),html=h.window.Campaigns.render(h.ctx.campaigns,[],'en');
 assert.match(html,/data-camp-hp-pad="n1"/);
 assert.match(html,/data-camp-hp="n1"/,'the old plain HP field is still there');
 assert.equal(h.click({dataset:{campHpPad:'n1'}}),true);
 assert.equal(h.opened.length,1);
 const t=h.opened[0].t;assert.deepEqual(JSON.parse(JSON.stringify(t.sp())),{body:9,head:4});assert.equal(t.hp(),20);
});
test('the pad writes the NPC HP like the plain field: max is kept, revival clears the dead mark',()=>{
 const h=setup();h.click({dataset:{campHpPad:'n1'}});const t=h.opened[0].t,r=h.campaign.roster[0];
 assert.deepEqual(JSON.parse(JSON.stringify(t.setHp(0))),{ok:true,hp:0});
 assert.equal(r.hp,0);assert.equal(r.maxHp,20);assert.equal(h.saves,1);
 r.dead=true;r.deathPenalty=2;t.setHp(5);assert.equal(r.hp,5);assert.equal(r.dead,undefined);assert.equal(r.deathPenalty,undefined);
 assert.equal(t.setHp(-3).hp,0,'below zero is not written');
});
test('a stale campaign does not take the NPC pad write',()=>{
 const h=setup();h.click({dataset:{campHpPad:'n1'}});const t=h.opened[0].t;h.ctx.isCurrent=()=>false;
 assert.equal(t.setHp(3),false);assert.equal(h.campaign.roster[0].hp,20);
});
test('old rows without sp or maxHp still work',()=>{
 const h=setup();delete h.campaign.roster[0].sp;h.click({dataset:{campHpPad:'n1'}});const t=h.opened[0].t;
 assert.deepEqual(JSON.parse(JSON.stringify(t.sp())),{body:0,head:0});assert.equal(t.max(),20);
});
test('the add-template form has the level select in both languages and passes the level on',()=>{
 for(const [lang,label,mook] of [['en','Threat level','Mook'],['ru','Уровень угрозы','Рядовой']]){
  const h=setup({lang}),html=h.window.Campaigns.render(h.ctx.campaigns,[],lang);
  assert.match(html,/data-campaign-template-level/);assert.ok(html.includes(label));assert.ok(html.includes(mook));
 }
 const h=setup(),select={isConnected:true,value:'bodyguard'},level={value:'boss'},count={value:'2'};
 const root={isConnected:true,querySelector:s=>s==='[data-campaign-template-count]'?count:s==='[data-campaign-template-level]'?level:select};
 const btn={dataset:{campaignAction:'add-template'},isConnected:true,closest:s=>s==='[data-campaign-template-root]'?root:null};
 h.window.Campaigns.handle({type:'click',target:{closest:()=>btn}},h.ctx);
 assert.deepEqual(h.added,[['bodyguard',2,'en','boss']]);assert.equal(h.campaign.roster.length,3);
 level.value='';h.added.length=0;h.window.Campaigns.handle({type:'click',target:{closest:()=>btn}},h.ctx);
 assert.equal(h.added.length,0,'no level: the old path');assert.equal(h.campaign.roster.length,5);
 level.value='nonsense';h.window.Campaigns.handle({type:'click',target:{closest:()=>btn}},h.ctx);assert.equal(h.added.length,0);
});
test('without the GM tools levels the form shows no level select',()=>{const h=setup({levels:false});assert.doesNotMatch(h.window.Campaigns.render(h.ctx.campaigns,[],'en'),/data-campaign-template-level/)});
test('compact GM-table rows do not hide the «Change HP» button',()=>{
 assert.match(css,/> \.camp-hp-reason:not\(\.camp-hp-pad\)/);
 assert.match(css,/\.camp-hp-pad \{ grid-area: pad;[^}]*min-height: 44px/);
 assert.doesNotMatch(css.replace(/\.camp-hp-reason:not\(\.camp-hp-pad\)/g,''),/not\(\.gt-open\) > \.camp-hp-reason[,{ ]/);
});
