const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const source=fs.readFileSync(__dirname+'/../site/campaigns.js','utf8'),combat=fs.readFileSync(__dirname+'/../site/combat-tools.js','utf8');
const plain=x=>JSON.parse(JSON.stringify(x));
const bodyguard={id:'bodyguard',name:{ru:'Телохранитель',en:'Bodyguard'},stats:{REF:6,BODY:6},hp:35,page:412,armor:{name:'Kevlar',headSP:7,bodySP:7},weapons:[{name:'Very Heavy Pistol',damage:'4d6'}]};
// rolls: a list of d10 faces to return in order (Math.random is mapped from them).
function setup({roster,characters=[],round=1,turnIndex=0,rolls=[5],app}={}){
 let saves=0,i=0;const notices=[],window={GMTools:{NPC_TEMPLATES:[bodyguard]}};if(app)window.App=app;
 const math=Object.create(Math);math.random=()=>((rolls[i++%rolls.length])-1)/10+0.001;
 const ctxVm={window,document:{querySelector:()=>null},confirm:()=>true,Math:math,Date,globalThis:{crypto:{randomUUID:()=>'new-'+(++i)}}};
 vm.runInNewContext(combat,ctxVm);vm.runInNewContext(source,ctxVm);
 const campaign={id:'c',name:'Job',notes:'',round,turnIndex,roster:roster||[{id:'a',kind:'npc',name:'A',hp:30,maxHp:30,ref:6,initiative:9,order:1},{id:'b',kind:'npc',name:'B',hp:20,maxHp:20,ref:5,initiative:4,order:2},{id:'p',kind:'pc',characterId:'v1',initiative:2,order:3}]};
 const ctx={lang:'ru',campaigns:[campaign],characters,isCurrent:x=>x===campaign,scope:'account',save:()=>saves++,render(){},notify:s=>notices.push(s)};
 const C=window.Campaigns,click=(button)=>C.handle({type:'click',target:{closest:()=>button}},ctx);
 click({dataset:{campaignAction:'open',id:'c'}});
 const row=(fields={})=>({querySelector:s=>s==='[data-camp-dmg]'?{value:fields.dmg??''}:s==='[data-camp-dmg-loc]'?{value:fields.loc??'body'}:s==='[data-camp-body]'?(fields.body===undefined?null:{value:fields.body}):null});
 const act=(name,id,fields)=>click({dataset:{campaignAction:name,...(id?{id}:{})},closest:s=>s==='.combatant'?row(fields):null});
 const by=id=>campaign.roster.find(r=>r.id===id);
 return {C,ctx,campaign,act,by,notices,render:(lang='ru')=>C.render(ctx.campaigns,characters,lang),get saves(){return saves}};
}
const vi=(over={})=>({id:'v1',name:'Ви',hp:45,stats:{REF:7,BODY:8,WILL:6},...over});

test('a character rolls initiative with the same base as the sheet; an NPC with REF',()=>{
 const h=setup({characters:[vi()],rolls:[4],app:{initiativeBonus:c=>c.stats.REF-2+3}});
 assert.equal(h.C.initiativeBase(h.by('p'),h.ctx.characters),8,'REF 7 − 2 armor + 3 Initiative Reaction (pp. 146, 184)');
 assert.equal(h.C.initiativeBase(h.by('a'),h.ctx.characters),6);
 h.act('roll-all');assert.equal(h.by('p').initiative,4+8);assert.equal(h.by('a').initiative,4+6);
 const plainApp=setup({characters:[vi()]});assert.equal(plainApp.C.initiativeBase(plainApp.by('p'),plainApp.ctx.characters),7,'without the sheet bridge it falls back to REF');
});

test('Wound States follow HP (p. 186)',()=>{
 const {C}=setup();
 assert.equal(C.woundOf({hp:30,maxHp:30},null),'');assert.equal(C.woundOf({hp:15,maxHp:30},null),'');assert.equal(C.woundOf({hp:14,maxHp:30},null),'serious');
 assert.equal(C.woundOf({hp:17,maxHp:35},null),'serious','half of 35 rounds up to 18');assert.equal(C.woundOf({hp:18,maxHp:35},null),'');
 assert.equal(C.woundOf({hp:0,maxHp:30},null),'mortal');assert.equal(C.woundOf({hp:-4},null),'mortal');assert.equal(C.woundOf({hp:3},null),'','without a known full HP only Mortally Wounded can be told');
 assert.equal(C.woundOf({},vi({hp:22})),'serious','a character: 10 + 5 × ceil((8+6)/2) = 45, half is 23');assert.equal(C.woundOf({},vi({hp:23})),'');assert.equal(C.woundOf({},vi({hp:0})),'mortal');
});

test('the roster shows the Wound State and reminds of the Death Save on that turn',()=>{
 const h=setup({characters:[vi()]});h.by('a').hp=0;
 const html=h.render();
 assert.match(html,/camp-chip-mortal">Смертельно ранен · −4, Death Save в начале хода</);assert.match(html,/class="turn-death">Death Save в начале хода \(стр\. 188\)</);
 h.by('a').hp=14;assert.match(h.render(),/camp-chip-serious">Тяжело ранен · −2 ко всем действиям</);assert.doesNotMatch(h.render(),/turn-death/);
 assert.match(h.render('en'),/Seriously Wounded · −2 to all Actions/);
});

test('damage to an NPC goes through armor, ablates it by 1 and doubles on the head (pp. 170, 186–187)',()=>{
 const h=setup();h.by('a').sp={head:7,body:11};
 h.act('damage','a',{dmg:'9'});assert.equal(h.by('a').hp,30);assert.deepEqual(plain(h.by('a').sp),{head:7,body:11});assert.match(h.notices.at(-1),/не пробивает SP 11/);
 h.act('damage','a',{dmg:'17'});assert.equal(h.by('a').hp,24);assert.deepEqual(plain(h.by('a').sp),{head:7,body:10});assert.match(h.notices.at(-1),/A: 17 − SP 11 = 6 · HP 30 → 24 · SP 10/);
 h.act('damage','a',{dmg:'12',loc:'head'});assert.equal(h.by('a').hp,14,'(12 − 7) × 2 = 10');assert.deepEqual(plain(h.by('a').sp),{head:6,body:10});assert.match(h.notices.at(-1),/12 − SP 7 = 5 ×2 = 10/);
 const bare=setup();bare.act('damage','b',{dmg:'5'});assert.equal(bare.by('b').hp,15);assert.equal(bare.by('b').sp,undefined,'no armor, nothing to ablate');
 for(const bad of ['','0','abc','-3','1.5','1000']){const before=h.saves;h.act('damage','a',{dmg:bad});assert.equal(h.by('a').hp,14);assert.equal(h.saves,before,`"${bad}" changes nothing`)}
});

test('damage to a Mortally Wounded NPC raises its Death Save Penalty (p. 188)',()=>{
 const h=setup();h.by('b').hp=0;h.act('damage','b',{dmg:'4'});
 assert.equal(h.by('b').hp,-4);assert.equal(h.by('b').deathPenalty,1);assert.match(h.notices.at(-1),/критическое ранение/);
});

test('an NPC Death Save: under BODY to live, 10 always fails, the penalty grows by 1 each time (p. 188)',()=>{
 let h=setup({rolls:[5]});h.by('a').hp=0;h.by('a').body=6;
 h.act('death-save','a',{});assert.equal(h.by('a').dead,undefined);assert.equal(h.by('a').deathPenalty,1);assert.match(h.notices.at(-1),/1d10 5 \+ 0 < BODY 6 — жив/);
 h.act('death-save','a',{});assert.equal(h.by('a').dead,true,'5 + 1 is not under 6');assert.equal(h.by('a').out,true);assert.match(h.C.readJournal(h.campaign)[0].text,/мёртв/);
 h=setup({rolls:[6]});h.by('a').hp=0;h.act('death-save','a',{body:'6'});assert.equal(h.by('a').dead,true,'a roll equal to BODY fails');
 h=setup({rolls:[10]});h.by('a').hp=0;h.act('death-save','a',{body:'20'});assert.equal(h.by('a').dead,true);assert.match(h.notices.at(-1),/выпало 10/);
 h=setup({rolls:[1]});h.by('a').hp=0;h.act('death-save','a',{});assert.equal(h.by('a').deathPenalty,undefined);assert.match(h.notices.at(-1),/Укажите BODY/);
 h=setup({rolls:[1]});h.act('death-save','a',{body:'6'});assert.equal(h.by('a').deathPenalty,undefined,'only a Mortally Wounded NPC rolls');
});

test('a participant who is out is skipped in both directions; the round still counts',()=>{
 const h=setup({characters:[vi()]});h.act('out','b');
 assert.equal(h.by('b').out,true);
 h.act('next');assert.equal(h.campaign.turnIndex,2,'A → Ви, B is skipped');h.act('next');assert.equal(h.campaign.turnIndex,0);assert.equal(h.campaign.round,2);
 h.act('prev');assert.equal(h.campaign.turnIndex,2);assert.equal(h.campaign.round,1);h.act('prev');assert.equal(h.campaign.turnIndex,0);
 h.act('out','b');assert.equal(h.by('b').out,undefined);h.act('next');assert.equal(h.campaign.turnIndex,1);
 const lone=setup({roster:[{id:'a',kind:'npc',name:'A',hp:1,ref:5,initiative:3,order:1,out:true}]});lone.act('next');assert.equal(lone.campaign.round,1,'nobody left: the turn does not move');
});

test('to the top of the queue, one roll, and a held Action',()=>{
 const h=setup({characters:[vi()],rolls:[7]});
 h.act('next');assert.equal(h.campaign.turnIndex,1);
 h.act('to-top','p');assert.equal(h.by('p').initiative,10,'one above the highest (p. 169)');assert.equal(h.campaign.turnIndex,2,'B still has the turn');
 h.act('roll-one','b');assert.equal(h.by('b').initiative,7+5);
 h.act('hold','a');assert.equal(h.by('a').held,true);assert.match(h.render(),/camp-chip-held">Держит действие</);
 const order=()=>h.C.render(h.ctx.campaigns,h.ctx.characters,'ru');assert.ok(order());
 for(let n=0;n<3;n++)h.act('next');assert.equal(h.by('a').held,undefined,'the mark is cleared when their turn comes again');
});

test('book NPCs carry armor, BODY and full HP; all NPCs can be removed at once',()=>{
 const h=setup({characters:[vi()]});
 h.C.addTemplates(h.campaign,'bodyguard',2,'ru');
 const g=h.campaign.roster.at(-1);assert.deepEqual(plain(g.sp),{head:7,body:7});assert.equal(g.body,6);assert.equal(g.maxHp,35);
 h.act('next');h.act('next');assert.equal(h.campaign.roster[h.campaign.turnIndex]?.id!==undefined,true);
 h.act('clear-npcs');assert.deepEqual(plain(h.campaign.roster.map(r=>r.id)),['p']);assert.equal(h.campaign.turnIndex,0);
});
