/* Named modifiers in the page: where the module is registered, the places of the app that name a modifier in the text
   of a roll, and the other modules that show one (the sheet's roll detail, the «Досье» panel, the next-roll bar). */
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const read=f=>fs.readFileSync(path.join(__dirname,'..','site',f),'utf8');
const plain=x=>JSON.parse(JSON.stringify(x));
const count=(text,needle)=>text.split(needle).length-1;
const entry=(id,more={})=>({id,name:'Smartgun',value:1,on:true,scope:'all',...more});
const hero=(list,extra={})=>({id:'v1',stats:{REF:7,DEX:6,BODY:8},skills:{Handgun:4},extra:{items:[],weapons:[],namedModifiers:{version:1,list},...extra}});

test('the page loads the module after the implants and before the tools, the sheet tabs and the app; the styles after the looks',()=>{
 const html=read('index.html'),at=s=>html.indexOf(s);
 assert.equal(count(html,'<script src="named-modifiers.js"></script>'),1);assert.equal(count(html,'<link rel="stylesheet" href="named-modifiers.css">'),1);
 assert.ok(at('<script src="effects.js"></script>')>0&&at('<script src="implants.js"></script>')<at('<script src="named-modifiers.js"></script>'));
 for(const later of ['tool-effects.js','sheet-tabs.js','app.js'])assert.ok(at('<script src="named-modifiers.js"></script>')<at(`<script src="${later}"></script>`),later);
 assert.match(html,/<script src="app\.js"><\/script>\s*<\/body>/,'app.js stays last');
 for(const look of ['theme.css','board.css','native.css'])assert.ok(at(`href="${look}"`)>0&&at(`href="${look}"`)<at('href="named-modifiers.css"'),look);
});

test('each hook is in its file exactly once, and the long files keep their line endings',()=>{
 const hooks={
  'effects.js':['globalThis.window?.NamedModifiers?.contribute?.(c,total)','isObject(t.checkStats)&&Object.hasOwn(t.checkStats,stat)','Object.entries(p.checkStats||{})'],
  'tool-effects.js':["else if(s.kind==='named')value=","label:isObject(c)?tail(c,opts,n,l):'',"],
  'dossier-panel.js':["named:['свой модификатор','named modifier']","if(kind==='named'&&q.check)"],
  'sheet-tabs.js':["${global.NamedModifiers?.bar?.(c,lang())||''}</div>`"],
  'sheet-leftovers.js':["named:['модификатор','modifier']","p.k==='named'&&typeof p.n==='string'"],
  'inventory-cards.js':["global.NamedModifiers?.itemChips?.(c,record,lang)","global.NamedModifiers?.itemChips?.(c,w,lang)"],
  'app.js':['function namedParts(c,kind,skill,stat){','function effectSplit(c,kind,skill,stat){','function namedTail(named){','function effectTail(c,kind,skill,stat){','function effectParts(c,kind,skill,stat){',
   "(q.plain?'':effectLabel(effectSplit(c,q.attackKind,q.skillKey,q.statKey).rest)+namedTail(namedParts(c,q.attackKind,q.skillKey,q.statKey)))",'...effectParts(c,q.attackKind,q.skillKey,q.statKey),...exParts',
   "+effectTail(c,'',s[0],s[2]),{dv:","...effectParts(c,'',s[0],s[2]),{k:'sheet',v:modifier}",'...effectParts(c),...parts]','rollNamed:(c,kind,skill,stat)=>namedParts(c,kind,skill,stat),'],
  'play-combat.js':["named=namedIn(A,c,o),","+namedTail(A,named);","{k:'effects',v:num(rm.effect)-named.reduce((a,p)=>a+p.value,0)},...named.map(p=>({k:'named',v:p.value,n:p.name})),"],
  'role-kit.js':["global.App?.rollNamed?.(c, '', skill, stat)"],
 };
 for(const [file,list] of Object.entries(hooks)){const text=read(file);assert.equal(text.includes('\r'),false,file+' keeps LF');for(const h of list)assert.equal(count(text,h),1,`${file}: ${h}`)}
 const app=read('app.js');
 assert.doesNotMatch(app,/\{k:'effects',v:effectModifier\(/,'no roll writes the whole sum under «эффекты» any more');
 // the number of a roll is still the whole sum: the modifiers reach it through the effects layer, nowhere else
 assert.equal(count(app,'+effectModifier(c,kind,skill,stat)+'),1);assert.doesNotMatch(app,/NamedModifiers\?\.(contribute|active|list)/);
});

// The few lines of app.js that split the effects into «эффекты» and the named modifiers, run as they are.
function appHelpers({effects=true,module=true,lang='ru'}={}){
 const window={SKILL_LABELS:{Handgun:{ru:'Пистолеты',en:'Handgun'},Stealth:{ru:'Скрытность',en:'Stealth'}}};
 const ctx=vm.createContext({window});
 if(effects){vm.runInContext(read('crit-injuries.js'),ctx);vm.runInContext(read('effects.js'),ctx)}
 if(module)vm.runInContext(read('named-modifiers.js'),ctx);
 vm.runInContext(read('sheet-leftovers.js'),ctx);
 const lines=read('app.js').split('\n').filter(l=>/^(function (effectModifier|namedParts|effectSplit|namedTail|effectTail|effectParts)\(|const effectLabel=)/.test(l));
 assert.equal(lines.length,7);
 vm.runInContext(`const state={lang:${JSON.stringify(lang)}};${lines.join('\n')}\nwindow.qa={effectModifier,effectTail,effectParts,effectSplit};`,ctx);
 return {window,qa:window.qa,L:window.SheetLeftovers};
}
const injury={criticalInjuries:{version:1,entries:[{id:'i',location:'head',score:5,status:'active'}]}};

test('a roll names each modifier in its label and its detail; «эффекты» keeps only injuries, implants and drugs',()=>{
 const {qa,L}=appHelpers();
 const c=hero([entry('a',{scope:'ranged'}),entry('b',{name:'Темнота',value:-2}),entry('c',{scope:'skill',key:'Stealth',value:3}),entry('d',{scope:'stat',key:'REF',value:1,name:'Допинг'})],injury);
 assert.equal(qa.effectModifier(c,'ranged','Handgun','REF'),-2+1-2+1);
 assert.equal(qa.effectTail(c,'ranged','Handgun','REF'),' · эффекты −2 · Smartgun +1 · Темнота −2 · Допинг +1');
 assert.equal(qa.effectTail(c,'','Stealth','DEX'),' · эффекты −2 · Темнота −2 · Smartgun +3');
 const parts=plain(qa.effectParts(c,'ranged','Handgun','REF'));
 assert.deepEqual(parts,[{k:'effects',v:-2},{k:'named',v:1,n:'Smartgun'},{k:'named',v:-2,n:'Темнота'},{k:'named',v:1,n:'Допинг'}]);
 assert.equal(parts.reduce((a,p)=>a+p.v,0),qa.effectModifier(c,'ranged','Handgun','REF'),'the parts add up to the number in the roll');
 assert.equal(L.partsText(parts,-2,'ru'),' − 2 (эффекты) + 1 (Smartgun) − 2 (Темнота) + 1 (Допинг)');
 // the check a tool makes with no Skill: only the modifiers for every check
 assert.deepEqual(plain(qa.effectParts(c)),[{k:'effects',v:-2},{k:'named',v:-2,n:'Темнота'}]);
 // no injury: nothing is said about «эффекты» at all
 const clean=hero([entry('a')]);assert.equal(qa.effectTail(clean),' · Smartgun +1');assert.deepEqual(plain(qa.effectParts(clean)),[{k:'effects',v:0},{k:'named',v:1,n:'Smartgun'}]);
 assert.equal(appHelpers({lang:'en'}).qa.effectTail(hero([1,2,3,4,5].map(i=>entry('m'+i,{name:'M'+i})),injury)),' · effects −2 · M1 +1 · M2 +1 · M3 +1 · more modifiers +2');
});

test('without a modifier, without the module or without the effects layer a roll reads exactly as before',()=>{
 const c=hero([],injury),named=hero([entry('a')],injury);
 const base=appHelpers();
 assert.equal(base.qa.effectTail(c,'ranged','Handgun','REF'),' · эффекты −2');assert.deepEqual(plain(base.qa.effectParts(c,'ranged','Handgun','REF')),[{k:'effects',v:-2}]);
 assert.equal(base.qa.effectTail(hero([])),'');
 const noModule=appHelpers({module:false});
 assert.equal(noModule.qa.effectTail(named),' · эффекты −2');assert.deepEqual(plain(noModule.qa.effectParts(named)),[{k:'effects',v:-2}]);
 // the module alone must not name what the number does not hold
 const noEffects=appHelpers({effects:false});
 assert.equal(noEffects.qa.effectModifier(named),0);assert.equal(noEffects.qa.effectTail(named),'');assert.deepEqual(plain(noEffects.qa.effectParts(named)),[{k:'effects',v:0}]);
 // a module that answers nonsense is ignored
 const odd=appHelpers();odd.window.NamedModifiers.forCheck=()=>[{name:5,value:1},{name:'x',value:0},{name:'y',value:1.5},null,{name:'ok',value:2}];
 assert.deepEqual(plain(odd.qa.effectSplit(named).named),[{name:'ok',value:2}]);
 odd.window.NamedModifiers.forCheck=()=>{throw new Error('boom')};assert.deepEqual(plain(odd.qa.effectSplit(named)),{rest:-1,named:[]});
});

test('the detail of a roll gives a named part its own name and keeps every older line as it was',()=>{
 const {L}=appHelpers();
 assert.equal(L.partsText([{k:'named',v:1,n:'Smartgun'}],1,'ru'),' + 1 (Smartgun)');
 assert.equal(L.partsText([{k:'named',v:-2,n:'  Темнота  '}],-2,'en'),' − 2 (Темнота)');
 assert.equal(L.partsText([{k:'named',v:1,n:'x'.repeat(50)}],1,'ru'),` + 1 (${'x'.repeat(32)})`);
 assert.equal(L.partsText([{k:'named',v:1}],1,'ru'),' + 1 (модификатор)');assert.equal(L.partsText([{k:'named',v:1,n:'  '}],1,'en'),' + 1 (modifier)');assert.equal(L.partsText([{k:'named',v:1,n:7}],1,'en'),' + 1 (modifier)');
 assert.equal(L.partsText([{k:'wound',v:-2,n:'not a name'},{k:'effects',v:-2},{k:'sheet',v:1}],-3,'ru'),' − 2 (ранение) − 2 (эффекты) + 1 (модификатор)','only a named part carries a name');
 assert.equal(L.partsText([{k:'named',v:1,n:'Smartgun'}],3,'ru'),' + 1 (Smartgun) + 2 (прочее)','the remainder is still worked out');
 assert.equal(L.partsText(undefined,2,'ru'),' + 2');assert.equal(L.partsText([],0,'ru'),'');
});

test('the «Досье» panel shows a named modifier as its own row, only for the check it is for',()=>{
 const el=()=>({attrs:{},dataset:{},setAttribute(){},getAttribute(){return null},addEventListener(){},appendChild(){},querySelector(){return null},querySelectorAll(){return []},classList:{contains:()=>false,add(){},remove(){}}});
 const doc={documentElement:{lang:'ru',classList:{contains:()=>true}},body:el(),readyState:'complete',addEventListener(){},createElement:el,querySelector:()=>null,querySelectorAll:()=>[]};
 const window={document:doc,localStorage:{getItem:()=>null,setItem(){}},matchMedia:()=>({matches:false}),setTimeout:()=>0,clearTimeout(){},App:{lang:()=>'ru'}};
 const ctx=vm.createContext({window});
 vm.runInContext(read('crit-injuries.js'),ctx);vm.runInContext(read('effects.js'),ctx);vm.runInContext(read('named-modifiers.js'),ctx);vm.runInNewContext(read('dossier-panel.js'),{window});
 const D=window.DossierPanel,c=hero([entry('a',{scope:'ranged'}),entry('b',{name:'Темнота',value:-2}),entry('c',{name:'Допинг',scope:'stat',key:'REF',value:3}),entry('d',{name:'Тишина',scope:'skill',key:'Stealth',value:1})]);
 const rows=q=>plain(D.effectRows(c,q,'ru').rows??D.effectRows(c,q,'ru'));
 assert.deepEqual(rows({check:true,kind:'ranged',skill:'Handgun',stat:'REF'}),[{label:'Smartgun',source:'свой модификатор',value:1},{label:'Темнота',source:'свой модификатор',value:-2},{label:'Допинг',source:'свой модификатор',value:3}]);
 assert.deepEqual(rows({check:true,kind:'',skill:'Stealth',stat:'DEX'}),[{label:'Темнота',source:'свой модификатор',value:-2},{label:'Тишина',source:'свой модификатор',value:1}]);
 assert.deepEqual(rows({check:true,kind:'melee',skill:'Brawling',stat:'DEX'}),[{label:'Темнота',source:'свой модификатор',value:-2}]);
 assert.deepEqual(rows({move:true,stat:'MOVE'}),[],'MOVE is not a check');assert.deepEqual(rows({stat:'REF',check:false}),[]);
 const en=D.effectRows(c,{check:true},'en');assert.equal(plain(en.rows??en)[0].source,'named modifier');
});

test('the next-roll bar of the sheet ends with the switches, and stays as it was without the module',()=>{
 const tabs=read('sheet-tabs.js');
 assert.match(tabs,/<\/select><\/label>\$\{global\.NamedModifiers\?\.bar\?\.\(c,lang\(\)\)\|\|''\}<\/div>`;\n\}\nfunction quickRolls/,'the block is the last child of the bar');
 // the bar gives the focus back by data-keep and strips everything but [\w-] from the key: the module's keys survive that
 assert.match(tabs,/String\(keep\)\.replace\(\/\[\^\\w-\]\/g,''\)/);
 const mod=read('named-modifiers.js');
 for(const key of mod.matchAll(/data-keep="([^"$]+)(\$\{[^}]+\})?"/g))assert.match(key[1],/^[\w-]+$/);
 // the module listens on its own (no branch in app.js) and steps in before the page redraws the bar
 assert.match(mod,/doc\.addEventListener\('click',onClick,true\)/);assert.doesNotMatch(read('app.js'),/data-nm-/);
 const css=read('named-modifiers.css');
 assert.doesNotMatch(css.replace(/#131010|#fff\b/g,''),/#[0-9a-f]{3,8}\b/i,'only the colours of the looks, but for the two pressed-state texts');
});

test('README names the feature once, in the list of what is inside',()=>{
 const readme=fs.readFileSync(path.join(__dirname,'..','README.md'),'utf8'),start=readme.indexOf('### Что внутри'),end=readme.indexOf('\n#',start+5);
 const inside=readme.slice(start,end<0?undefined:end);
 assert.equal(count(readme,'**Именованные модификаторы:**'),1);assert.ok(inside.includes('- **Именованные модификаторы:**'));
});

/* The rolls that do not go through app.js's own roll code: a burst, suppressive fire and a thrown grenade
   (play-combat.js), the checks of the role tools (role-kit.js). They get the number from App.rollMods and the names
   from App.rollNamed, both stood in for here by the real effects layer and the real module. */
function sheetApp(window,lang){
 const E=window.Effects,N=window.NamedModifiers,calls=[];
 const named=(c,kind,skill,stat)=>N?N.forCheck(c,{kind,skill,stat}):[];
 window.App={lang:()=>lang,rollMods:(c,kind,skill,stat)=>({wound:0,effect:E.checkModifier(c,kind,skill,stat)}),rollNamed:named,
  checkBonus:(c,stat,level,kind,skill)=>c.stats[stat]+level+E.checkModifier(c,kind,skill,stat),
  check:(base,label,o)=>{calls.push({base,label,mod:o.mod,parts:plain(o.parts)});return {total:20}}};
 window.CharacterExtra={init:c=>c.extra};
 return calls;
}
function combat({module=true,lang='ru',rollNamed=true}={}){
 const window={SKILL_LABELS:{Autofire:{ru:'Автоматический огонь',en:'Autofire'}}},ctx=vm.createContext({window});
 vm.runInContext(read('crit-injuries.js'),ctx);vm.runInContext(read('effects.js'),ctx);if(module)vm.runInContext(read('named-modifiers.js'),ctx);
 vm.runInContext(read('sheet-leftovers.js'),ctx);vm.runInContext(read('play-combat.js'),ctx);
 const calls=sheetApp(window,lang);if(!rollNamed)delete window.App.rollNamed;
 return {P:window.PlayCombat,L:window.SheetLeftovers,calls,window};
}
const burst={stat:'REF',level:4,kind:'ranged',skillKey:'Autofire',label:'Очередь: SMG',dv:17,extra:0};

test('a burst, suppressive fire and a thrown grenade name the modifiers too: nothing of the player\'s own hides under «эффекты»',()=>{
 const {P,L,calls}=combat();
 const c=hero([entry('a',{scope:'ranged'}),entry('b',{name:'Темнота',value:-2}),entry('m',{name:'Кастет',scope:'melee',value:4})]);
 P.sheetCheck(c,burst);
 assert.equal(calls[0].label,'Очередь: SMG · Smartgun +1 · Темнота −2');
 assert.deepEqual(calls[0].parts,[{k:'wound',v:0},{k:'effects',v:0},{k:'named',v:1,n:'Smartgun'},{k:'named',v:-2,n:'Темнота'},{k:'sheet',v:0},{k:'luck',v:0},{k:'weapon',v:0},{k:'precision',v:0}]);
 assert.equal(calls[0].mod,-1,'the number of the roll is what it was: the names are only names');
 const text=L.partsText(calls[0].parts,calls[0].mod,'ru');
 assert.equal(text,' + 1 (Smartgun) − 2 (Темнота)');assert.doesNotMatch(text,/эффекты|прочее/);
 // with an injury «эффекты» is the injury alone
 const hurt=hero([entry('a',{scope:'ranged'})],injury);P.sheetCheck(hurt,burst);
 assert.equal(calls[1].label,'Очередь: SMG · Smartgun +1');assert.deepEqual(calls[1].parts.slice(1,3),[{k:'effects',v:-2},{k:'named',v:1,n:'Smartgun'}]);
 assert.equal(L.partsText(calls[1].parts,calls[1].mod,'ru'),' − 2 (эффекты) + 1 (Smartgun)');
});

test('a burst without a modifier, without the module or with an older app reads exactly as before',()=>{
 const plainParts=v=>[{k:'wound',v:0},{k:'effects',v},{k:'sheet',v:0},{k:'luck',v:0},{k:'weapon',v:0},{k:'precision',v:0}];
 const a=combat();a.P.sheetCheck(hero([],injury),burst);
 assert.equal(a.calls[0].label,'Очередь: SMG');assert.deepEqual(a.calls[0].parts,plainParts(-2));
 const b=combat({module:false});b.P.sheetCheck(hero([entry('a')],injury),burst);
 assert.equal(b.calls[0].label,'Очередь: SMG');assert.deepEqual(b.calls[0].parts,plainParts(-2));
 const old=combat({rollNamed:false});old.P.sheetCheck(hero([entry('a')],injury),burst);
 assert.equal(old.calls[0].label,'Очередь: SMG');assert.deepEqual(old.calls[0].parts,plainParts(-1),'the whole sum stays under «эффекты» when nobody can name its parts');
 // an app that answers nonsense is not believed
 const odd=combat();odd.window.App.rollNamed=()=>[{name:5,value:1},null,{name:'x',value:0},{name:'y',value:1.5}];odd.P.sheetCheck(hero([entry('a')]),burst);
 assert.equal(odd.calls[0].label,'Очередь: SMG');assert.deepEqual(odd.calls[0].parts,plainParts(1));
 odd.window.App.rollNamed=()=>{throw new Error('boom')};odd.P.sheetCheck(hero([entry('a')]),burst);assert.deepEqual(odd.calls[1].parts,plainParts(1));
});

test('a Role ability check names the modifiers after «эффекты», and the sum does not change',()=>{
 const window={SKILL_LABELS:{Trading:{ru:'Торговля',en:'Trading'}}},ctx=vm.createContext({window,document:{addEventListener(){},documentElement:{lang:'ru'}}});
 vm.runInContext(read('crit-injuries.js'),ctx);vm.runInContext(read('effects.js'),ctx);vm.runInContext(read('named-modifiers.js'),ctx);vm.runInContext(read('role-kit.js'),ctx);
 sheetApp(window,'ru');
 const K=window.RoleKit,c=hero([entry('a'),entry('t',{name:'Связи',scope:'skill',key:'Trading',value:2}),entry('r',{scope:'ranged',value:5})],injury);
 const m=K.sheetMods(c,'Trading','COOL');
 assert.equal(m.effect,1);assert.equal(m.total,1);assert.deepEqual(plain(m.named),[{name:'Smartgun',value:1},{name:'Связи',value:2}]);
 assert.equal(K.modsText(m,'ru'),' · эффекты −2, Smartgun +1, Связи +2');assert.equal(K.takeMods(c,'Trading','COOL','en').text,' · effects −2, Smartgun +1, Связи +2');
 const clean=hero([entry('a')]);assert.equal(K.takeMods(clean,'Trading','COOL','ru').text,' · Smartgun +1');
 // no modifier: the very object and text of before
 assert.deepEqual(plain(K.sheetMods(hero([],injury),'Trading','COOL')),{wound:0,effect:-2,modifier:0,luck:0,pool:0,total:-2});assert.equal(K.takeMods(hero([],injury),'Trading','COOL','ru').text,' · эффекты −2');
 assert.equal(K.modsText({wound:0,effect:3,modifier:0,luck:0},'ru'),' · эффекты +3');
 window.App.rollNamed=()=>[{name:7,value:1},{name:'x'.repeat(60),value:1}];
 assert.equal(K.takeMods(hero([entry('a')]),'Trading','COOL','ru').text,' · '+'x'.repeat(32)+' +1');
});
