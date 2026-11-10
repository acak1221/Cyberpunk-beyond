const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const source=fs.readFileSync(__dirname+'/../site/campaigns.js','utf8');
const plain=x=>JSON.parse(JSON.stringify(x));
const bodyguard={id:'bodyguard',name:{ru:'Телохранитель',en:'Bodyguard'},stats:{REF:6},hp:35,page:412,armor:{name:'Kevlar',headSP:7,bodySP:7},weapons:[{name:'Poor Quality Shotgun',damage:'5d6'},{name:'Very Heavy Pistol',damage:'4d6'}]};
function setup({lang='ru',round=1,turnIndex=0,count='1',journal}={}){
 let next=0,saves=0;const window={GMTools:{NPC_TEMPLATES:[bodyguard]}},notices=[];
 const campaign={id:'c',name:'Job',notes:'',round,turnIndex,roster:[{id:'a',kind:'npc',name:'A',hp:10,ref:6,initiative:9,order:1},{id:'b',kind:'npc',name:'B',hp:5,ref:5,initiative:4,order:2}]};
 if(journal)campaign.journal=journal;
 const ctx={lang,campaigns:[campaign],characters:[],isCurrent:x=>x===campaign,scope:'account',save:()=>saves++,render(){},notify:s=>notices.push(s)};
 const select={isConnected:true,value:'bodyguard'},countField={value:count},root={isConnected:true,querySelector:s=>s==='[data-campaign-template-count]'?countField:select};
 const addButton={dataset:{campaignAction:'add-template'},isConnected:true,closest:s=>s==='[data-campaign-template-root]'?root:null};
 vm.runInNewContext(source,{window,document:{querySelector:()=>null},confirm:()=>true,Math,Date,globalThis:{crypto:{randomUUID:()=>`new-${++next}`}}});
 const click=button=>window.Campaigns.handle({type:'click',target:{closest:()=>button}},ctx);
 const act=name=>click({dataset:{campaignAction:name}});
 click({dataset:{campaignAction:'open',id:'c'}});
 return {C:window.Campaigns,ctx,campaign,act,add:()=>click(addButton),countField,notices,get saves(){return saves}};
}

test('Back gives the turn to the previous participant',()=>{
 const h=setup({turnIndex:1});h.act('prev');
 assert.equal(h.campaign.turnIndex,0);assert.equal(h.campaign.round,1);assert.equal(h.saves,1);
});

test('Back on the first turn returns to the end of the previous round and takes the round entry back',()=>{
 const h=setup();h.act('next');h.act('next');
 assert.equal(h.campaign.round,2);assert.equal(h.campaign.turnIndex,0);assert.equal(h.C.readJournal(h.campaign)[0].text,'Начался раунд 2');
 h.act('prev');
 assert.equal(h.campaign.round,1);assert.equal(h.campaign.turnIndex,1);assert.equal(h.C.readJournal(h.campaign).length,0);
});

test('Back keeps a journal entry the GM wrote after the round started',()=>{
 const h=setup({round:2,journal:[{id:'m',at:2,text:'Засада на мосту',auto:false},{id:'r',at:1,text:'Начался раунд 2',auto:true}]});
 h.act('prev');
 assert.equal(h.campaign.round,1);assert.deepEqual(plain(h.C.readJournal(h.campaign).map(x=>x.text)),['Засада на мосту','Начался раунд 2']);
});

test('Back does nothing on the first turn of round 1, and the button says so',()=>{
 const h=setup();
 assert.match(h.C.render(h.ctx.campaigns,[],'ru'),/data-campaign-action="prev" disabled/);
 h.act('prev');assert.equal(h.campaign.round,1);assert.equal(h.campaign.turnIndex,0);
 h.act('next');assert.doesNotMatch(h.C.render(h.ctx.campaigns,[],'ru'),/data-campaign-action="prev" disabled/);
});

test('the turn bar names the round, the turn and the participant',()=>{
 const h=setup({round:3,turnIndex:1});
 assert.match(h.C.render(h.ctx.campaigns,[],'ru'),/class="turn-now"[^>]*>Раунд 3 · ход 2 из 2 · B</);
 assert.match(h.C.render(h.ctx.campaigns,[],'en'),/class="turn-now"[^>]*>Round 3 · turn 2 of 2 · B</);
});

test('a lone book NPC keeps the plain name; copies are numbered and continue after the highest number',()=>{
 const {C}=setup();
 assert.deepEqual(plain(C.templateNames('Bodyguard',1,[])),['Bodyguard']);
 assert.deepEqual(plain(C.templateNames('Bodyguard',3,[])),['Bodyguard 1','Bodyguard 2','Bodyguard 3']);
 assert.deepEqual(plain(C.templateNames('Bodyguard',1,[{kind:'npc',name:'Bodyguard'}])),['Bodyguard 2'],'the unnumbered one counts as the first');
 assert.deepEqual(plain(C.templateNames('Bodyguard',2,[{kind:'npc',name:'Bodyguard 4'},{kind:'npc',name:'Bodyguard 12 (wounded)'},{kind:'pc',name:'Bodyguard 9'}])),['Bodyguard 5','Bodyguard 6']);
 assert.deepEqual(plain(C.templateNames('A+B (x)',2,[])),['A+B (x) 1','A+B (x) 2'],'names are matched literally');
});

test('the note of a book NPC lists armor and weapons and fits the note limit',()=>{
 const {C}=setup();
 assert.equal(C.templateNote(bodyguard),'SP 7/7 · Poor Quality Shotgun 5d6; Very Heavy Pistol 4d6');
 assert.equal(C.templateNote({}),'');
 assert.equal(C.templateNote({armor:{headSP:'7',bodySP:7},weapons:[{name:'Knife'}]}),'','malformed data is left out');
 assert.ok(C.templateNote({weapons:Array.from({length:40},(_,i)=>({name:'Weapon '+i,damage:'2d6'}))}).length<=300);
});

test('adding several book NPCs at once numbers them, notes them and keeps the turn',()=>{
 const h=setup({turnIndex:1,count:'3'});h.add();
 const added=h.campaign.roster.slice(2);
 assert.deepEqual(plain(added.map(r=>r.name)),['Телохранитель 1','Телохранитель 2','Телохранитель 3']);
 assert.equal(new Set(h.campaign.roster.map(r=>r.id)).size,5);
 for(const r of added){assert.equal(r.ref,6);assert.equal(r.hp,35);assert.equal(r.sourcePage,412);assert.deepEqual(plain(r.combatNote),{version:1,text:'SP 7/7 · Poor Quality Shotgun 5d6; Very Heavy Pistol 4d6'})}
 assert.equal(h.campaign.turnIndex,1,'B still has the turn');
 h.countField.value='1';h.add();assert.equal(h.campaign.roster.at(-1).name,'Телохранитель 4');
});

test('the count is limited to 1–10 and bad input means one',()=>{
 for(const [value,expected] of [['0',1],['-3',1],['abc',1],['2.5',1],['99',10]]){const h=setup({count:value});h.add();assert.equal(h.campaign.roster.length-2,expected,`count ${value}`)}
});

test('notes are collapsed with a one-line preview',()=>{
 const h=setup({count:'1'});h.add();
 const out=h.C.render(h.ctx.campaigns,[],'ru');
 assert.match(out,/<details class="campaign-combat-note"><summary>Заметка<span class="note-preview" data-camp-note-preview>SP 7\/7 · Poor Quality Shotgun 5d6; Very Heavy Pistol 4d6<\/span><\/summary>/);
 assert.doesNotMatch(out,/<details class="campaign-combat-note" open/);
});

test('addTemplates puts numbered book NPCs with their note into a roster and refuses bad input',()=>{
 const h=setup(),other={id:'k2',name:'Other',roster:[]};
 const r=h.C.addTemplates(other,'bodyguard',3,'en');
 assert.equal(r.ok,true);assert.equal(r.name,'Bodyguard');assert.deepEqual(plain(other.roster.map(x=>x.name)),['Bodyguard 1','Bodyguard 2','Bodyguard 3']);
 assert.equal(new Set(other.roster.map(x=>x.id)).size,3);assert.equal(other.roster[0].combatNote.text,'SP 7/7 · Poor Quality Shotgun 5d6; Very Heavy Pistol 4d6');
 assert.equal(h.C.addTemplates(other,'nobody',1,'en').ok,false);assert.equal(h.C.addTemplates(null,'bodyguard',1,'en').ok,false);assert.equal(h.C.addTemplates({id:'x'},'bodyguard',1,'en').ok,false);
 assert.equal(other.roster.length,3,'a refused call adds nothing');
 assert.equal(h.C.addTemplates(other,'bodyguard',999,'en').added.length,20,'at most 20 at a time');
});

test('a rolled encounter offers the book template named in its row',()=>{
 global.window={};global.document={addEventListener(){}};
 delete require.cache[require.resolve('../site/gm-tools.js')];require('../site/gm-tools.js');
 const G=global.window.GMTools,ids=new Set(G.NPC_TEMPLATES.map(x=>x.id));
 assert.equal(G.encounterTemplate([1,5,417,'','','','A patrol demands ID. Template: Security Operative.']),'security-operative');
 assert.equal(G.encounterTemplate([1,5,417,'','','','Use Security Officers without the shield.']),'security-officer');
 assert.equal(G.encounterTemplate([1,5,417,'','','','Techs. Template: Bodyguard with Tool Hand.']),'bodyguard');
 assert.equal(G.encounterTemplate([1,5,417,'','','','A stray dog.']),'');
 let named=0,total=0;for(const rows of Object.values(G.ENCOUNTERS))for(const row of rows){total++;const id=G.encounterTemplate(row);if(id){named++;assert.ok(ids.has(id))}}
 assert.ok(named>=total/2,`most encounter rows name a template (${named} of ${total})`);
 const html=G.render({lang:'ru',workspace:{...G.initial(),roll:8,party:4},campaigns:[{id:'k',name:'Работа',roster:[]}]});
 assert.match(html,/data-gm-enc-count data-gm-enc-party="4"/);assert.match(html,/data-gm="enc-add"/);
 assert.doesNotMatch(G.render({lang:'ru',workspace:G.initial(),campaigns:[{id:'k',name:'Работа',roster:[]}]}),/data-gm-enc\b/,'nothing to add before a roll');
 assert.match(G.render({lang:'ru',workspace:{...G.initial(),roll:8},campaigns:[]}),/Сначала создайте кампанию/);
});
