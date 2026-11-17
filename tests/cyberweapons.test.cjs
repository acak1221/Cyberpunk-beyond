// Installed cyberware weapons in combat: every number is pinned to the catalog data of this repo.
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const source=n=>fs.readFileSync(__dirname+'/../site/'+n,'utf8');
const plain=x=>JSON.parse(JSON.stringify(x));
function load({app=null,doc,withSlots=true}={}){
 const window={confirm:()=>true};if(app)window.App=app;
 const ctx={window,document:doc,Math,Number,String,Array,Object,JSON,Set,Map,RegExp,globalThis:{},console};if(!doc)delete ctx.document;vm.createContext(ctx);
 for(const f of ['catalog.js','catalog-extra.js',...(withSlots?['cyber-slots.js']:[]),'rolls.js','cyberweapons.js'])vm.runInContext(source(f),ctx,{filename:f});
 return window;
}
const W=load(),CW=W.Cyberweapons,CAT=W.CATALOG,find=id=>CAT.find(i=>i.id===id);
const withInstalls=(...ids)=>({id:'c1',stats:{DEX:7,REF:6},skills:{'Melee Weapon':3,'Heavy Weapons':2},extra:{equipment:{installs:ids.map((catalogId,i)=>({id:'n'+i,catalogId}))}}});

test('every number of the table is the one the catalog states for that item',()=>{
 const ids=Object.keys(CW.TABLE);assert.equal(ids.length,9);
 for(const id of ids){
  const spec=CW.TABLE[id],item=find(id),base=find(spec.base);assert.ok(item,id);assert.ok(base,spec.base);assert.equal(item.category,'cyberware');assert.equal(base.category,'weapon');
  const en=item.details.en,ru=item.details.ru;
  if(spec.dice!==null){
   const m=/(\d+)d6\b[^.;]*?ROF (\d+)/.exec(en),r=/(\d+)d6[^.;]*?ROF (\d+)/.exec(ru);
   assert.ok(m&&r,id);assert.equal(Number(m[1]),spec.dice,id);assert.equal(Number(m[2]),spec.rof,id);assert.equal(Number(r[1]),spec.dice,id);assert.equal(Number(r[2]),spec.rof,id);
   assert.equal(base.stats.damage,`${spec.dice}d6`,`${id}: class weapon damage`);assert.equal(base.stats.rof,spec.rof,`${id}: class weapon ROF`);
   assert.match(en,/melee weapon/i);
  }else{assert.equal(id,'cyberware-popup-grenade-launcher');assert.doesNotMatch(en,/\d+d6/);assert.match(en,/grenade/i)}
  assert.equal(base.stats.skill,spec.skill,id);
  assert.equal(spec.stat,spec.skill==='Melee Weapon'?'DEX':'REF',`${id}: the same rule as the weapons of the sheet`);
  assert.equal(spec.kind,spec.skill==='Melee Weapon'?'melee':'ranged');
  assert.match(en,/conceal/i,id);
  assert.equal(spec.handBusy,/hand (?:cannot hold anything|is occupied)/i.test(en),`${id}: hand busy`);
  assert.ok(item.page>=114&&item.page<=367,id);
 }
 assert.deepEqual(Object.keys(CW.TABLE).sort(),Object.keys(CW.TABLE).filter(id=>find(id)).sort());
});

test('the sources of the numbers: catalog texts of the reference in both languages',()=>{
 for(const id of Object.keys(CW.TABLE))for(const lang of ['ru','en'])assert.ok(find(id).details[lang].length>20,id);
 const src=source('cyberweapons.js');assert.ok(!/Math\.random\(\)/.test(src.replace('rng=Math.random','')));
});

test('rows: one per installed copy, from installs and starting implants, nothing else',()=>{
 const c=withInstalls('cyberware-big-knucks','cyberware-big-knucks','cyberware-neural-link','cyberware-cybersnake','cyberware-popup-melee-weapon');
 c.extra.equipment.installs.push({id:'gone',catalogId:'cyberware-wolvers',removedAt:'2026-01-01'});
 c.extra.items=[{id:'p1',catalogId:'cyberware-talon-foot',humanityLossIncluded:true,quantity:1},{id:'p2',catalogId:'cyberware-rippers',quantity:1}];
 const rows=plain(CW.rows(c,'en'));
 assert.deepEqual(rows.map(r=>[r.catalogId,r.key]),[['cyberware-big-knucks','i:n0'],['cyberware-big-knucks','i:n1'],['cyberware-cybersnake','i:n3'],['cyberware-talon-foot','r:p1:0']]);
 assert.match(rows[0].name,/ #1$/);assert.match(rows[1].name,/ #2$/);assert.equal(rows[2].name,find('cyberware-cybersnake').name.en);
 assert.equal(rows[0].damage,'2d6');assert.equal(rows[0].rof,2);assert.equal(rows[2].damage,'4d6');assert.equal(rows[2].rof,1);assert.equal(rows[3].damage,'1d6');
 assert.equal(plain(CW.rows(c,'ru'))[2].name,find('cyberware-cybersnake').name.ru);
 assert.deepEqual(plain(CW.rows(withInstalls(),'ru')),[]);assert.deepEqual(plain(CW.rows(null,'ru')),[]);assert.deepEqual(plain(CW.rows({extra:'x'},'en')),[]);
 // without the slots module the same two saved lists are read
 const w=load({withSlots:false});assert.equal(w.Cyberweapons.rows(c,'en').length,4);
});

test('the attack number is the sheet number: stat + skill, or the sheet calculation when the app has one',()=>{
 const c=withInstalls('cyberware-wolvers','cyberware-popup-grenade-launcher');
 let r=plain(CW.rows(c,'en'));assert.equal(r[0].attack,7+3);assert.equal(r[0].skill,'Melee Weapon');assert.equal(r[1].attack,6+2);assert.equal(r[1].stat,'REF');assert.equal(r[1].damage,null);
 const w=load({app:{checkBonus:(ch,stat,level,kind,skill)=>stat==='DEX'?`${kind}|${skill}`.length:level+20}});
 r=plain(w.Cyberweapons.rows(c,'en'));assert.equal(r[0].attack,'melee|Melee Weapon'.length);assert.equal(r[1].attack,22);
 const noSkill={id:'x',stats:{DEX:5},skills:{},extra:withInstalls('cyberware-rippers').extra};assert.equal(CW.rows(noSkill,'en')[0].attack,5);
 const dossier=load();dossier.DossierPanel={statBase:()=>({value:9})};assert.equal(dossier.Cyberweapons.rows(c,'en')[0].attack,9+3);
});

test('the block shows dice, ROF, skill and page in both languages, escapes, and has a named button per roll',()=>{
 const c=withInstalls('cyberware-wolvers','cyberware-popup-grenade-launcher');c.id='a"<i>';
 for(const lang of ['ru','en']){
  const html=CW.render(c,lang);
  assert.ok(html.includes(lang==='ru'?'КИБЕРОРУЖИЕ':'CYBERWEAPONS'));assert.ok(!html.includes('a"<i>'));assert.ok(html.includes('data-cw-char="a&quot;&lt;i&gt;"'));
  assert.ok(html.includes('3d6'));assert.ok(html.includes('ROF 2'));assert.ok(html.includes(String(find('cyberware-wolvers').page)));
  assert.equal((html.match(/data-cw-attack=/g)||[]).length,2);assert.equal((html.match(/data-cw-damage=/g)||[]).length,1,'the launcher has no damage of its own');
  assert.ok(html.includes(lang==='ru'?'Урон — по заряженной гранате':'Damage comes from the loaded grenade'));
  assert.ok(html.includes(lang==='ru'?'рука не может ничего держать':'the hand cannot hold anything'));
 }
 assert.equal(CW.render(withInstalls(),'en'),'');assert.equal(CW.render(null,'en'),'');
});

test('the attack rolls through rolls.js and the sheet history; the damage sums the table dice',()=>{
 const sent=[],checks=[];
 const app={lang:()=>'en',report:(label,detail,total,faces)=>{sent.push(plain({label,detail,total,faces}));return true},check:(base,label,o)=>{checks.push(plain({base,label,o}));return {total:14}}};
 const w=load({app}),C=w.Cyberweapons,c=withInstalls('cyberware-wolvers','cyberware-popup-grenade-launcher');
 assert.deepEqual(plain(C.attack(c,'i:n0','en')),{ok:true,total:14});
 assert.deepEqual(checks,[{base:7,label:find('cyberware-wolvers').name.en+' · Attack',o:{wounds:false,skill:3,mod:0}}]);
 {const ch=[];const w2=load({app:{lang:()=>'en',checkBonus:(c0,st,lv)=>7+lv+2,check:(base,label,o)=>{ch.push(plain({base,o}));return {total:1}}}});
  w2.Cyberweapons.attack(c,'i:n0','en');assert.equal(ch[0].o.mod,2);assert.equal(ch[0].o.skill,3);assert.equal(ch[0].base,7)}
 const seq=[0.0,0.99,0.5];let i=0;const rng=()=>seq[i++];
 const d=plain(C.damage(c,'i:n0','en',rng));assert.deepEqual(d,{ok:true,total:1+6+4,dice:[1,6,4],crit:false});
 assert.equal(sent.length,1);assert.equal(sent[0].total,11);assert.match(sent[0].label,/ · Damage$/);assert.match(sent[0].detail,/^3d6: 1 \+ 6 \+ 4 = 11/);
 i=0;const six=[0.99,0.99,0.1];const d2=plain(C.damage(c,'i:n0','en',()=>six[i++]));assert.equal(d2.crit,true);assert.match(sent[1].detail,/Critical Injury/);
 assert.equal(C.damage(c,'i:n1','en').reason,'none','the launcher has no damage of its own');
 assert.equal(C.damage(c,'i:gone','en').reason,'stale');assert.equal(C.attack(c,'nope','en').reason,'stale');assert.equal(C.attack(c,7,'en').reason,'stale');
 assert.equal(C.damage(c,'i:n0','en',()=>NaN).reason,'roll');
 assert.equal(load().Cyberweapons.attack(c,'i:n0','en').reason,'roll','without the app nothing rolls');
});

test('the buttons roll for the active character only; a changed sheet says so',()=>{
 const log=[],c=withInstalls('cyberware-slice-n-dice');let click=null;const focused=[];
 const doc={addEventListener:(t,f)=>{if(t==='click')click=f},querySelector:s=>({focus:()=>focused.push(s)}),activeElement:null};
 const app={lang:()=>'ru',active:()=>c,render:()=>log.push('render'),notify:m=>log.push('notify:'+m),report:(l,d,t)=>{log.push('report:'+l+'|'+t);return true},check:(b,l)=>{log.push('check:'+l);return {total:9}}};
 load({app,doc});
 const btn=(data,root)=>({target:{closest:s=>s.includes('button')?{disabled:false,dataset:data,closest:()=>root}:null}});
 click(btn({cwAttack:'i:n0'},{dataset:{cwChar:'c1'}}));assert.match(log[0],/^check:.*Атака$/);assert.deepEqual(focused,['button[data-cw-attack="i:n0"]']);
 log.length=0;click(btn({cwDamage:'i:n0'},{dataset:{cwChar:'c1'}}));assert.match(log[0],/^report:.* · Урон\|\d+$/);
 log.length=0;click(btn({cwAttack:'i:n0'},{dataset:{cwChar:'other'}}));assert.match(log[0],/^notify:Имплант изменился/);assert.equal(log[1],'render');
 log.length=0;click(btn({cwAttack:'i:zz'},{dataset:{cwChar:'c1'}}));assert.equal(log[1],'render');
 log.length=0;click({target:{closest:()=>null}});assert.deepEqual(log,[]);
});

test('the files are registered: script after the roll service, before the app; styles linked',()=>{
 const html=source('index.html');
 const at=n=>html.indexOf(`src="${n}"`);assert.ok(at('cyberweapons.js')>at('rolls.js')&&at('cyberweapons.js')>at('catalog-extra.js')&&at('cyberweapons.js')<at('app.js'));
 assert.ok(html.includes('href="cyberweapons.css"')&&html.includes('href="martial-arts.css"'));
 for(const f of ['cyberweapons.js','cyberweapons.css','martial-arts.css','martial-arts.js'])assert.ok(!source(f).includes('\r'),f+' has LF line endings');
 assert.ok(/min-height: 44px/.test(source('cyberweapons.css'))&&/min-height: 44px/.test(source('martial-arts.css')));
});
