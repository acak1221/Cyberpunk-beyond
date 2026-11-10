// «Досье» look: the details panel (what a number is made of) and the filter chips of the «Бой» tab.
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const source=n=>fs.readFileSync(__dirname+'/../site/'+n,'utf8');
const html=source('index.html'),css=source('dossier-panel.css');

function classList(initial=[]){const set=new Set(initial);return {set,contains:c=>set.has(c),add:c=>set.add(c),remove:c=>set.delete(c)}}
// A tiny element: enough for the panel's own elements and for something that opens it.
function element(attrs={}){
 const el={attrs:{...attrs},dataset:{},hidden:false,innerHTML:'',focused:0,isConnected:true,
  setAttribute(k,v){this.attrs[k]=String(v)},getAttribute(k){return this.attrs[k]??null},removeAttribute(k){delete this.attrs[k]},hasAttribute(k){return k in this.attrs},
  contains(){return false},querySelector(){return null},querySelectorAll(){return []},focus(){this.focused++;el.doc.activeElement=this}};
 return el;
}
function load({board=true,phone=false,character=null,app={},extra={}}={}){
 const listeners={},created=[],clicked=[],checks=[],stored={};
 const body=element();
 const doc={documentElement:{lang:'ru',classList:classList(board?['ui-native','ui-board']:['ui-native'])},body,activeElement:body,readyState:'complete',
  addEventListener(type,fn){listeners[type]=fn},createElement(){const el=element();el.doc=doc;created.push(el);return el},
  found:{},querySelector(s){return this.found[s]||null},querySelectorAll(){return []}};
 body.doc=doc;body.appendChild=()=>{};
 const window={document:doc,localStorage:{getItem:k=>stored[k]??null,setItem(k,v){stored[k]=v}},matchMedia:()=>({matches:phone}),setTimeout:()=>0,clearTimeout(){},
  SkillReference:{SKILLS:[['Handgun','ranged','REF',1,1,'Пистолеты','Стрельба из пистолетов.','Shooting handguns.'],['Perception','awareness','INT',1,1,'Восприятие','Заметить скрытое.','Notice hidden things.']]},
  App:{active:()=>character,lang:()=>doc.documentElement.lang,check:(base,label)=>checks.push([base,label]),...app},...extra};
 vm.runInNewContext(source('effects.js'),{window,globalThis:{window}});
 vm.runInNewContext(source('dossier-panel.js'),{window});
 const opener=(kind,key)=>{const el=element();el.doc=doc;doc.found[`[data-dossier="${kind}"][data-dossier-key="${key}"]`]=el;return el};
 const target=selector=>{const el=element();el.click=()=>clicked.push(selector);doc.found['.sheet-layout '+selector]=el;return el};
 return {D:window.DossierPanel,window,doc,listeners,created,clicked,checks,stored,opener,target,panel:()=>created[1],backdrop:()=>created[0]};
}
const V=(over={})=>({id:'v',name:'V',hp:40,humanity:60,stats:{INT:6,REF:7,DEX:6,TECH:5,COOL:6,WILL:6,LUCK:6,MOVE:6,BODY:8,EMP:6},skills:{Handgun:5,Perception:4,Brawling:2,'Human Perception':3},...over});
// The sheet's own sum (checkBonus in app.js), kept here so the panel is checked against the real rule.
function checkBonus(window){
 return (c,stat,level,kind,skill)=>{
  const x=c.extra||{},max=10+5*Math.ceil((c.stats.BODY+c.stats.WILL)/2),wound=c.hp<1?-4:c.hp<Math.ceil(max/2)?(window.Effects.ignoresSerious(c)?0:-2):0;
  const base=stat==='EMP'?Math.max(0,Math.floor(c.humanity/10)):c.stats[stat],pool=x.luck===undefined||x.luck===''?c.stats.LUCK:Math.max(0,Number(x.luck)||0);
  return base+(Number(level)||0)+wound+window.Effects.checkModifier(c,kind,skill,stat)+Math.max(-100,Math.min(100,Number(x.modifier)||0))+Math.min(pool,Math.max(0,Number(x.luckUse)||0));
 };
}
// Values made inside the vm context have other prototypes, so they are compared as plain data.
const same=(actual,expected,message)=>assert.deepEqual(JSON.parse(JSON.stringify(actual)),expected,message);
const total=parts=>parts.reduce((a,p)=>a+p.value,0);
const row=(m,label)=>m.parts.find(p=>p.label===label);

// ---------- wiring ----------
test('the page loads the script before app.js and the stylesheet after board.css',()=>{
 assert.ok(html.indexOf('src="dossier-panel.js"')>0&&html.indexOf('src="dossier-panel.js"')<html.indexOf('src="app.js"'));
 assert.ok(html.indexOf('src="effects.js"')<html.indexOf('src="dossier-panel.js"'));
 assert.ok(html.indexOf('href="board.css"')<html.indexOf('href="dossier-panel.css"'));
});

test('every rule of the stylesheet is scoped to the «Досье» look; outside it the pieces are not displayed',()=>{
 const plain=css.replace(/\/\*[\s\S]*?\*\//g,'').replace(/@keyframes[^{]+\{[^{}]*\{[^{}]*\}\s*\}/g,'');
 const selectors=[...plain.matchAll(/(^|[{}])\s*([^{}@]+?)\s*\{/g)].flatMap(m=>m[2].split(/,(?![^()]*\))/)).map(s=>s.trim()).filter(Boolean);
 assert.ok(selectors.length>40);
 const loose=selectors.filter(s=>!s.startsWith('html.ui-native.ui-board '));
 same(loose.sort(),['.dossier-backdrop','.dossier-filter','.dossier-panel']);
 assert.match(css,/\.dossier-panel, \.dossier-backdrop, \.dossier-filter \{ display: none; \}/);
});

test('on a phone the panel is a bottom sheet with full touch targets; print ignores the filter',()=>{
 const phone=css.slice(css.indexOf('@media (max-width: 820px)'),css.indexOf('@media screen and (min-width: 1024px)'));
 assert.match(phone,/\.dossier-panel:not\(\[hidden\]\) \{\s*top: auto; left: 0;/);
 assert.match(phone,/\.dossier-filter button \{ min-height: 44px; \}/);
 assert.match(css,/\.dossier-close \{[^}]*width: 44px; height: 44px;/);
 assert.match(css,/\.dossier-actions \.btn \{[^}]*min-height: 44px;/);
 assert.match(css,/@media print \{[\s\S]*\[data-dossier-off\] \{ display: revert !important; \}/);
});

// ---------- the chips ----------
test('the chips: all, attacks, quick rolls, limited use — with labels in both languages',()=>{
 const {D}=load();
 same([...D.FILTERS],['all','attacks','quick','limited']);
 const ru=D.barHtml('attacks','ru'),en=D.barHtml('attacks','en');
 for(const label of ['Все','Атаки','Быстрые броски','С боезапасом'])assert.ok(ru.includes(`>${label}</button>`),label);
 for(const label of ['All','Attacks','Quick rolls','Limited use'])assert.ok(en.includes(`>${label}</button>`),label);
 assert.match(ru,/data-dossier-filter="attacks" aria-pressed="true"/);assert.match(ru,/data-dossier-filter="all" aria-pressed="false"/);
 assert.match(ru,/role="group" aria-label="Фильтр раздела «Бой»"/);assert.match(en,/aria-label="Combat tab filter"/);
});

test('what each chip leaves on screen',()=>{
 const {D}=load(),gun={type:'weapon',ammo:true},knife={type:'weapon',ammo:false},brawl={type:'quick',attack:true},save={type:'quick',attack:false};
 const seen=id=>[gun,knife,brawl,save].map(x=>D.visible(id,x));
 same(seen('all'),[true,true,true,true]);
 same(seen('attacks'),[true,true,true,false]);
 same(seen('quick'),[false,false,true,true]);
 same(seen('limited'),[true,false,false,false]);
 same(seen('nonsense'),[true,true,true,true],'an unknown filter hides nothing');
 assert.equal(D.visible('limited',{type:'other'}),true);
});

test('the chosen chip is remembered on the device only, and an unknown one is refused',()=>{
 const h=load();
 assert.equal(h.D.filter(),'all');
 assert.equal(h.D.setFilter('limited'),true);assert.equal(h.D.filter(),'limited');assert.equal(h.stored['nc-dossier-combat-filter'],'limited');
 assert.equal(h.D.setFilter('everything'),false);assert.equal(h.D.filter(),'limited');
 assert.equal(h.D.countLine('all',{shown:2,total:2},{shown:5,total:5},'ru'),'');
 assert.equal(h.D.countLine('limited',{shown:1,total:2},{shown:0,total:5},'ru'),'Показано: оружие 1 из 2, быстрые броски 0 из 5');
 assert.equal(h.D.countLine('limited',{shown:1,total:2},{shown:0,total:5},'en'),'Shown: weapons 1 of 2, quick rolls 0 of 5');
});

test('the filter never writes to the character',()=>{
 const c=V({extra:{weapons:[{id:'w',name:'Pistol',skill:'Handgun',capacity:8,ammo:8}]}}),before=JSON.stringify(c),h=load({character:c});
 for(const id of ['attacks','quick','limited','all'])h.D.setFilter(id);
 assert.equal(JSON.stringify(c),before);
 assert.doesNotMatch(source('dossier-panel.js'),/\.save\?*\.?\(|nightcity-red-v1/);
});

// ---------- what a number is made of ----------
test('a Skill: STAT + level, and the total is the sheet\'s own number',()=>{
 const h=load(),c=V();h.window.App.checkBonus=checkBonus(h.window);
 const m=h.D.skillBreakdown(c,{skill:'Handgun',stat:'REF'},'ru');
 same(m.parts.map(p=>[p.label,p.value]),[['REF',7],['Handgun',5]]);
 assert.equal(m.total,'+12');assert.equal(m.value,12);assert.equal(total(m.parts),12);
 assert.equal(m.formula,'1d10 + REF + Handgun');
 assert.match(m.pages,/с\. 128–130/);assert.match(h.D.skillBreakdown(c,{skill:'Handgun',stat:'REF'},'en').pages,/pp\. 128–130/);
 assert.equal(m.rolls[0].selector,'[data-action="skill-roll"][data-skill="Handgun"]');
});

test('wounds, the next-roll modifier and LUCK each get their own row',()=>{
 const h=load(),c=V({hp:10,extra:{modifier:-3,luckUse:4,luck:2}});h.window.App.checkBonus=checkBonus(h.window);
 const m=h.D.skillBreakdown(c,{skill:'Perception',stat:'INT'},'ru');
 assert.equal(row(m,'Тяжёлое ранение').value,-2);
 assert.equal(row(m,'Модификатор').value,-3);
 assert.equal(row(m,'LUCK').value,2,'never more LUCK than is left in the pool');
 assert.equal(m.value,6+4-2-3+2);assert.equal(total(m.parts),m.value);
 const dying=h.D.skillBreakdown(V({hp:0}),{skill:'Perception',stat:'INT'},'en');
 assert.equal(row(dying,'Mortally Wounded').value,-4);
});

test('effects come with their sources: a Critical Injury, an implant, a drug',()=>{
 const c=V({extra:{criticalInjuries:{version:1,entries:[{location:'head',score:5,status:'active'},{location:'head',score:3,status:'healed'}]},
  equipment:{installs:[{catalogId:'cyberware-voice-stress-analyzer'}]},streetDrugs:{version:1,records:{synthcoke:{status:'active',remainingHours:2}}}}});
 const h=load({extra:{CATALOG:[{id:'cyberware-voice-stress-analyzer',name:{ru:'Анализатор стресса',en:'Voice Stress Analyzer'}}],CombatTools:{INJURIES:{head:[0,0,0,{ru:'Сотрясение',en:'Concussion'}]}}}});
 h.window.App.checkBonus=checkBonus(h.window);
 const social=h.D.skillBreakdown(c,{skill:'Human Perception',stat:'EMP'},'ru');
 same(social.parts.map(p=>[p.label,p.source,p.value]),[
  ['EMP','от текущей Человечности (60)',6],['Human Perception','уровень навыка',3],['Анализатор стресса','киберимплант',2],['Сотрясение','критическая травма',-2]]);
 assert.equal(social.value,9);
 const shot=h.D.skillBreakdown(c,{skill:'Handgun',stat:'REF'},'en');
 same(shot.parts.slice(2).map(p=>[p.label,p.source,p.value]),[['Synthcoke (in effect)','street drug',1],['Concussion','Critical Injury',-2]]);
 assert.equal(shot.value,7+5+1-2);
 assert.ok(shot.notes.some(n=>n.startsWith('Synthcoke (in effect): ')),'situational reminders are listed, not applied');
});

test('a rule the panel does not know about shows up as «Прочее», so the rows always add up to the sheet\'s number',()=>{
 const h=load({app:{checkBonus:()=>15}}),m=h.D.skillBreakdown(V(),{skill:'Handgun',stat:'REF'},'ru');
 assert.equal(m.value,15);assert.equal(row(m,'Прочее').value,3);assert.equal(total(m.parts),15);
 assert.equal(row(h.D.skillBreakdown(V(),{skill:'Handgun',stat:'REF'},'en'),'Other').value,3);
});

test('REF and DEX are taken after worn armor; Perception gets the Solo bonus',()=>{
 const h=load({extra:{EquipmentTools:{armorRollAdjustment:(c,stat)=>({ok:true,enabled:true,value:c.stats[stat]-2})},RoleTools:{soloRollBonuses:()=>({ok:true,enabled:true,threat:3})}}});
 const m=h.D.skillBreakdown(V(),{skill:'Handgun',stat:'REF'},'ru');
 assert.equal(row(m,'Броня').value,-2);assert.equal(m.value,10);
 const p=h.D.skillBreakdown(V(),{skill:'Perception',stat:'INT'},'ru');
 assert.equal(row(p,'Обнаружение угроз').value,3);assert.equal(p.value,13);
});

test('a weapon: the attack Skill, the weapon\'s own modifier, the kind of attack and its pages',()=>{
 const c=V({skills:{Handgun:5,'Melee Weapon':3},extra:{criticalInjuries:{version:1,entries:[{location:'body',score:9,status:'active'}]},
  weapons:[{id:'a',name:'Pistol',skill:'Handgun',stat:'REF',damage:'3d6',rof:2,capacity:8,ammo:5,modifier:1},{id:'b',name:'Knife',skill:'Melee Weapon',stat:'DEX',damage:'1d6'}]}});
 const h=load({extra:{WeaponAmmo:{tracks:w=>w.capacity>0}}});h.window.App.checkBonus=checkBonus(h.window);
 h.window.CharacterExtra={attackBonus:(ch,i)=>{const w=ch.extra.weapons[i];return h.window.App.checkBonus(ch,w.stat,ch.skills[w.skill],h.window.Effects.attackKind(w.skill),w.skill)+(w.modifier||0)}};
 const gun=h.D.weaponBreakdown(c,{index:0,title:'Pistol'},'ru');
 same(gun.parts.map(p=>[p.label,p.value]),[['REF',7],['Handgun',5],['Модификатор оружия',1]]);
 assert.equal(gun.total,'+13');assert.match(gun.pages,/с\. 170–173/);assert.match(gun.eyebrow,/дальний бой/);
 same(gun.facts,[['Урон','3d6'],['ROF','2'],['Патроны в магазине','5 / 8']]);
 same(gun.rolls.map(r=>r.selector),['[data-cx-action="attack"][data-cx-index="0"]','[data-cx-action="damage"][data-cx-index="0"]']);
 const knife=h.D.weaponBreakdown(c,{index:1,title:'Knife'},'en');
 assert.equal(knife.parts.at(-1).value,-2,'a torn muscle counts for melee only');assert.equal(knife.parts.at(-1).source,'Critical Injury');
 assert.equal(knife.value,6+3-2);assert.match(knife.pages,/pp\. 175–178/);assert.match(knife.eyebrow,/melee/);
 assert.equal(h.D.weaponBreakdown(c,{index:7},'ru'),null);
});

test('a weapon that attacks with a specialization uses its STAT and level',()=>{
 const c=V({extra:{specializations:[{id:'s1',name:'Karate',stat:'DEX',level:4}],weapons:[{name:'Fist',skill:'Martial Arts',skillSpecializationId:'s1'}]}});
 const m=load().D.weaponBreakdown(c,{index:0,title:'Fist'},'en');
 same(m.parts.map(p=>[p.label,p.source,p.value]),[['DEX','STAT on the sheet',6],['Karate','specialization level',4]]);
});

test('a STAT box: the sheet value, what checks take now, and what hangs on it',()=>{
 const h=load(),c=V({humanity:45,extra:{luck:3,deathPenalty:1,streetDrugs:{version:1,records:{boost:{status:'active',remainingHours:1}}}}});
 const emp=h.D.statBreakdown(c,{stat:'EMP'},'ru');
 assert.equal(emp.total,'4');same(emp.parts.map(p=>p.value),[6,-2]);assert.equal(emp.title,'EMP · Эмпатия');
 const int=h.D.statBreakdown(c,{stat:'INT'},'en');
 assert.equal(int.value,8);assert.equal(int.parts[1].label,'Boost (in effect)');assert.equal(int.rolls[0].check.base,8);
 const body=h.D.statBreakdown(c,{stat:'BODY'},'ru');
 same(body.facts.slice(0,2),[['Максимум HP','45 = 10 + 5 × ⌈(BODY + WILL) / 2⌉'],['Спасбросок от смерти','1d10 + 1 должно быть ниже 8']]);
 const luck=h.D.statBreakdown(c,{stat:'LUCK'},'ru');
 same(luck.facts[0],['Осталось в запасе','3 / 6']);assert.equal(luck.rolls.length,0,'LUCK is spent, not rolled');
 assert.equal(h.D.statBreakdown(c,{stat:'MOVE'},'ru').rolls.length,0);
 assert.match(body.pages,/с\. 72–73/);
 assert.equal(h.D.statBreakdown(c,{stat:'CHARISMA'},'ru'),null);
});

// What App.check in app.js puts on top of the number it is given.
const appAdds=(window,c)=>{const max=10+5*Math.ceil((c.stats.BODY+c.stats.WILL)/2);return (c.hp<1?-4:c.hp<Math.ceil(max/2)?(window.Effects.ignoresSerious(c)?0:-2):0)+window.Effects.checkModifier(c)};
test('a STAT check: wounds and «all Actions» injuries are rows, and the total and the button are the number that is rolled',()=>{
 const h=load({extra:{CombatTools:{INJURIES:{head:[0,0,0,{ru:'Сотрясение',en:'Concussion'}]}}}});
 const hurt=V({hp:10}),ref=h.D.statBreakdown(hurt,{stat:'REF'},'ru');
 same(ref.parts.map(p=>[p.label,p.source,p.value]),[['REF','значение на листе',7],['Тяжёлое ранение','состояние ранения',-2]]);
 assert.equal(ref.value,5);assert.equal(ref.total,'5');assert.equal(ref.rolls[0].label,'Бросить 1d10 +5');
 assert.equal(ref.rolls[0].check.base+appAdds(h.window,hurt),5,'App.check adds the wound penalty to what the button hands over');
 const dying=V({hp:0}),body=h.D.statBreakdown(dying,{stat:'BODY'},'en');
 assert.equal(row(body,'Mortally Wounded').value,-4);assert.equal(body.rolls[0].label,'Roll 1d10 +4');assert.equal(body.rolls[0].check.base+appAdds(h.window,dying),4);
 const injured=V({extra:{criticalInjuries:{version:1,entries:[{location:'head',score:5,status:'active'}]}}}),int=h.D.statBreakdown(injured,{stat:'INT'},'ru');
 same(int.parts.map(p=>[p.label,p.source,p.value]),[['INT','значение на листе',6],['Сотрясение','критическая травма',-2]]);
 assert.equal(int.total,'4');assert.equal(int.rolls[0].label,'Бросить 1d10 +4');assert.equal(int.rolls[0].check.base+appAdds(h.window,injured),4);
 const both=V({hp:10,extra:injured.extra}),cool=h.D.statBreakdown(both,{stat:'COOL'},'en');
 assert.equal(cool.value,6-2-2);assert.equal(total(cool.parts),cool.value);assert.equal(cool.rolls[0].check.base+appAdds(h.window,both),cool.value);
 // What is not rolled keeps its own number: no wound row for MOVE or LUCK.
 assert.equal(h.D.statBreakdown(hurt,{stat:'LUCK'},'ru').parts.length,1);assert.equal(h.D.statBreakdown(hurt,{stat:'MOVE'},'ru').value,6);
});

test('a STAT check is switched off while the armor record does not add up, as the sheet\'s rolls are',()=>{
 const broken={EquipmentTools:{armorRollAdjustment:()=>({ok:false})}},c=V();
 const h=load({character:c,extra:broken});h.opener('stat','REF');
 const ref=h.D.statBreakdown(c,{stat:'REF'},'ru');
 assert.equal(ref.rolls[0].disabled,true);assert.ok(ref.notes.some(n=>/проверьте экипированную броню/.test(n)));
 assert.ok(h.D.statBreakdown(c,{stat:'DEX'},'en').notes.some(n=>/check equipped armor/.test(n)));
 assert.equal(!!h.D.statBreakdown(c,{stat:'INT'},'ru').rolls[0].disabled,false,'only REF and DEX wait for the armor');
 h.D.open('stat','REF');assert.match(h.panel().innerHTML,/data-dossier-check="7"[^>]* disabled/);
 // Even a click that gets through does not roll.
 h.listeners.click({target:{closest:s=>s.includes('[data-dossier-check]')?{disabled:false,dataset:{dossierCheck:'7',dossierLabel:'Проверка REF'}}:null}});
 same(h.checks,[]);
 // Automation is switched on in the character, but the armor module is missing: the sheet refuses too.
 assert.equal(load().D.statBreakdown(V({extra:{armorRollAutomation:{version:1,enabled:true}}}),{stat:'REF'},'ru').rolls[0].disabled,true);
 assert.equal(!!load().D.statBreakdown(V(),{stat:'REF'},'ru').rolls[0].disabled,false);
});

test('a STAT roll uses, and uses up, the DV set for the next check, and rolls the numbers of the moment',()=>{
 const calls=[],c=V();let dv=15,taken=0;
 const h=load({character:c,app:{check:(...a)=>calls.push(a)},extra:{SheetTabs:{takeDV:()=>{taken++;const v=dv;dv=0;return v}}}});h.opener('stat','COOL');
 const click=()=>h.listeners.click({target:{closest:s=>s.includes('[data-dossier-check]')?{disabled:false,dataset:{dossierCheck:'6',dossierLabel:'Проверка COOL'}}:null}});
 h.D.open('stat','COOL');click();
 same(calls,[[6,'Проверка COOL',{dv:15}]]);assert.equal(taken,1);
 c.hp=10;c.stats.COOL=4;h.D.open('stat','COOL');click();
 same(calls[1],[4,'Проверка COOL',{}],'no DV is left, and the STAT is read again at the click');
 assert.match(source('app.js'),/check\(base,label,\{wounds=true,dv=0\}=\{\}\)\{[^}]*checkRoll\(Number\(base\)\|\|0,0,mod,String\(label\|\|''\),\{dv\}\)/,'App.check passes the DV on to the roll');
});

test('a weapon: Solo Precision Attack is a row, and the total and the button include it',()=>{
 const c=V({extra:{weapons:[{name:'Pistol',skill:'Handgun',stat:'REF',damage:'3d6'}]}});
 const h=load({extra:{RoleTools:{soloRollBonuses:()=>({ok:true,enabled:true,precision:2,threat:1})}}});h.window.App.checkBonus=checkBonus(h.window);
 h.window.CharacterExtra={attackBonus:(ch,i)=>{const w=ch.extra.weapons[i];return h.window.App.checkBonus(ch,w.stat,ch.skills[w.skill],h.window.Effects.attackKind(w.skill),w.skill)}};
 const gun=h.D.weaponBreakdown(c,{index:0,title:'Pistol'},'ru');
 same(gun.parts.map(p=>[p.label,p.source,p.value]),[['REF','характеристика на листе',7],['Handgun','уровень навыка атаки',5],['Точность атаки','способность Соло',2]]);
 assert.equal(gun.total,'+14');assert.equal(gun.rolls[0].label,'Атака 1d10 +14');assert.equal(row(gun,'Прочее'),undefined);
 assert.equal(row(h.D.weaponBreakdown(c,{index:0},'en'),'Precision Attack').value,2);
 // Without the sheet's own number the rows still carry it; with automation off there is no row.
 delete h.window.CharacterExtra;assert.equal(h.D.weaponBreakdown(c,{index:0},'ru').value,14);
 h.window.RoleTools={soloRollBonuses:()=>({ok:true,enabled:false,precision:2})};assert.equal(h.D.weaponBreakdown(c,{index:0},'ru').value,12);
});

test('a Stim set up for the next roll takes the wound penalty out of a Skill and a weapon, not out of a STAT check',()=>{
 const c=V({hp:10,extra:{weapons:[{name:'Pistol',skill:'Handgun',stat:'REF'}]}});let primed=true;
 const h=load({extra:{StimRoll:{primed:x=>primed&&x===c}}});h.window.App.checkBonus=checkBonus(h.window);
 h.window.CharacterExtra={attackBonus:(ch,i)=>{const w=ch.extra.weapons[i];return h.window.App.checkBonus(ch,w.stat,ch.skills[w.skill],h.window.Effects.attackKind(w.skill),w.skill)}};
 const skill=h.D.skillBreakdown(c,{skill:'Handgun',stat:'REF'},'ru'),gun=h.D.weaponBreakdown(c,{index:0},'en');
 same(skill.parts.map(p=>[p.label,p.value]),[['REF',7],['Handgun',5]]);assert.equal(skill.rolls[0].label,'Бросить 1d10 +12');
 assert.ok(skill.notes.some(n=>/^Stim учтён в этом броске: штраф ранения −2 не действует/.test(n)));
 assert.equal(gun.total,'+12');assert.equal(row(gun,'Seriously Wounded'),undefined);assert.equal(row(gun,'Other'),undefined);
 assert.ok(gun.notes.some(n=>/^Stim is counted in this roll/.test(n)));
 assert.equal(h.D.statBreakdown(c,{stat:'REF'},'ru').value,5,'App.check does not use the Stim');
 primed=false;assert.equal(h.D.skillBreakdown(c,{skill:'Handgun',stat:'REF'},'ru').value,10);
});

test('StimRoll.primed answers without spending the Stim',()=>{
 const w={},context={window:w,Math,Date,JSON,Object,Array,Number,String,Set};
 for(const f of ['pharmacy-tools.js','stim-roll.js'])vm.runInNewContext(source(f),context);
 const m=w.StimRoll,c={id:'p',hp:20,stats:{BODY:8,WILL:6},extra:{timedPharmaceuticals:{version:1,entries:[{drug:'stim',day:'2045-05-01',time:'12:00'}]}}};
 const ctx={scope:'account',isCurrent:(x,s)=>x===c&&s==='account'},v={day:'2045-05-01',time:'12:30'},root={isConnected:true,querySelector:q=>({value:v[q.includes('day')?'day':'time']})};
 m.render(c,'en','account');assert.equal(m.primed(c),false);
 for(const k of ['day','time'])m.handle({type:'input',target:{dataset:{stimField:k},value:v[k],isConnected:true,closest:q=>q==='[data-stim-root]'?root:null}},c,'en',ctx);
 const b={dataset:{stimAction:'arm'},isConnected:true,closest:q=>q==='[data-stim-root]'?root:null};
 m.handle({type:'click',target:{closest:q=>q==='[data-stim-action]'?b:null}},c,'en',ctx);
 assert.equal(m.primed(c),true);assert.equal(m.primed(c),true);assert.equal(m.primed({...c}),false);
 assert.equal(m.take(c,'account',true).applied,true,'asking did not spend it');
 c.hp=30;assert.equal(m.primed(c),false,'no longer Seriously Wounded');c.hp=20;
 assert.equal(m.take(c,'account').applied,true);assert.equal(m.primed(c),false);
});

test('the panel markup: a titled dialog body, signed rows, pages and a roll button; text is escaped',()=>{
 const h=load(),c=V({hp:10,extra:{weapons:[{name:'<b>Gun</b>',skill:'Handgun',damage:'3d6'}]}});
 const out=h.D.render(h.D.weaponBreakdown(c,{index:0,title:'<b>Gun</b>'},'ru'),'ru');
 assert.match(out,/<h2 id="dossier-title">&lt;b&gt;Gun&lt;\/b&gt;<\/h2>/);
 assert.match(out,/data-dossier-close data-keep="close" aria-label="Закрыть подробности"/);
 assert.match(out,/<b class="neg">−2<\/b>/);assert.match(out,/<li class="dossier-sum"><span>Итого<\/span><b>\+10<\/b>/);
 assert.match(out,/class="btn primary" data-keep="roll0" data-dossier-roll="\[data-cx-action=&quot;attack&quot;\]\[data-cx-index=&quot;0&quot;\]"/);
 assert.match(out,/class="dossier-pages">Дальний бой/);
 assert.match(h.D.render(h.D.statBreakdown(c,{stat:'REF'},'en'),'en'),/aria-label="Close details"[\s\S]*What it is made of[\s\S]*data-dossier-check="7" data-dossier-label="REF check"/);
 assert.equal(h.D.render(null,'ru'),'');
});

// ---------- opening and closing ----------
test('the panel opens only in the «Досье» look',()=>{
 const h=load({board:false,character:V()});h.opener('stat','REF');
 assert.equal(h.D.open('stat','REF'),false);assert.equal(h.created.length,0);assert.equal(h.D.opened(),null);
});

test('opening moves focus into the panel; Escape closes it and focus returns to what opened it',()=>{
 const h=load({character:V()}),from=h.opener('stat','REF');
 assert.equal(h.D.open('stat','REF'),true);
 const panel=h.panel();
 assert.equal(panel.attrs.role,'dialog');assert.equal(panel.attrs['aria-labelledby'],'dossier-title');assert.equal(panel.attrs['aria-modal'],'false');
 assert.equal(panel.hidden,false);assert.equal(h.backdrop().hidden,true,'a side panel does not dim the page');
 assert.equal(h.doc.activeElement,panel);assert.equal(from.attrs['aria-expanded'],'true');
 assert.match(panel.innerHTML,/REF · Рефлексы/);
 let prevented=0;h.listeners.keydown({key:'Escape',preventDefault(){prevented++}});
 assert.equal(prevented,1);assert.equal(panel.hidden,true);assert.equal(h.D.opened(),null);
 assert.equal(h.doc.activeElement,from);assert.equal('aria-expanded' in from.attrs,false);
 h.listeners.keydown({key:'Escape',preventDefault(){prevented++}});assert.equal(prevented,1,'Escape is left alone when nothing is open');
});

test('on a phone it is a modal bottom sheet with a backdrop that closes it',()=>{
 const h=load({character:V(),phone:true}),from=h.opener('skill','Handgun');
 assert.equal(h.D.open('skill','Handgun'),true);
 assert.equal(h.panel().attrs['aria-modal'],'true');assert.equal(h.backdrop().hidden,false);assert.equal('data-dossier-close' in h.backdrop().attrs,true);
 h.listeners.click({target:{closest:s=>s==='[data-dossier-close]'?h.backdrop():null}});
 assert.equal(h.D.opened(),null);assert.equal(h.doc.activeElement,from);
});

test('Enter or Space on a name opens the panel; a second click on the same name closes it',()=>{
 const h=load({character:V()}),from=h.opener('skill','Perception');from.dataset={dossier:'skill',dossierKey:'Perception'};from.closest=s=>s==='[data-dossier]'?from:null;
 let prevented=0;h.listeners.keydown({key:' ',target:from,preventDefault(){prevented++}});
 assert.equal(prevented,1);same(h.D.opened(),{kind:'skill',key:'Perception'});
 h.listeners.click({target:from});assert.equal(h.D.opened(),null);
 h.listeners.keydown({key:'Enter',target:from,preventDefault(){}});same(h.D.opened(),{kind:'skill',key:'Perception'});
});

test('the roll button presses the sheet\'s own roll button and closes the panel',()=>{
 const h=load({character:V()}),from=h.opener('skill','Handgun'),selector='[data-action="skill-roll"][data-skill="Handgun"]';h.target(selector);
 h.D.open('skill','Handgun');
 assert.doesNotMatch(h.panel().innerHTML,/data-keep="roll0"[^>]* disabled/);
 const button={disabled:false,dataset:{dossierRoll:selector}};
 h.listeners.click({target:{closest:s=>s.includes('[data-dossier-roll]')?button:null}});
 same(h.clicked,[selector]);assert.equal(h.D.opened(),null);assert.equal(h.doc.activeElement,from);
});

test('without the sheet button the roll is switched off; a STAT rolls through App.check',()=>{
 const h=load({character:V()});h.opener('skill','Handgun');h.opener('stat','COOL');
 h.D.open('skill','Handgun');assert.match(h.panel().innerHTML,/data-keep="roll0"[^>]* disabled/);
 h.D.close();h.D.open('stat','COOL');
 h.listeners.click({target:{closest:s=>s.includes('[data-dossier-check]')?{disabled:false,dataset:{dossierCheck:'6',dossierLabel:'Проверка COOL'}}:null}});
 same(h.checks,[[6,'Проверка COOL']]);assert.equal(h.D.opened(),null);
});

test('leaving the look or the sheet closes the panel without moving focus',()=>{
 const h=load({character:V()}),from=h.opener('stat','REF');
 h.D.open('stat','REF');const before=from.focused;
 h.doc.documentElement.classList.remove('ui-board');h.D.sync();
 assert.equal(h.D.opened(),null);assert.equal(h.panel().hidden,true);assert.equal(from.focused,before);
});
