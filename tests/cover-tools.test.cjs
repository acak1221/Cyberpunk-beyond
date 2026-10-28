const {test}=require('node:test'),assert=require('node:assert/strict');
global.window={};require('../public/game/combat-tools.js');
const C=window.CombatTools,base={kind:'cover',hp:'10',damage:'15',attack:'normal',cyber:false};
test('a shield that absorbs or is destroyed by a blast follows cover and cannot be combined with a dodge',()=>{
 for(const lang of ['en','ru']){
  const html=C.render(lang);
  assert.match(html,lang==='ru'?/Уклонение от взрыва проверяют до расчёта/:/Resolve any dodge from the blast before calculating/);
  assert.match(html,lang==='ru'?/если щит подставлен, уклоняться от этой атаки нельзя/:/interposing a shield prevents dodging that attack/);
  assert.match(html,lang==='ru'?/укрытие всё равно получает урон/:/cover still takes damage/);
  const f={'[data-ct-cover-kind]':{value:'shield'},'[data-ct-cover-hp]':{value:'10'},'[data-ct-cover-damage]':{value:'10'},'[data-ct-cover-attack]':{value:'blast'},'[data-ct-cover-cyber]':{checked:false},'[data-ct-cover-result]':{}};
  const root={querySelector:s=>f[s]},button={dataset:{ctAction:'cover'}},target={closest:s=>s==='[data-combat-tool]'?root:s==='[data-ct-action]'?button:null};
  assert.equal(C.coverDamage({...base,kind:'shield',attack:'blast',damage:'10'}).target,'full');
  C.handle({type:'click',target},lang);assert.match(f['[data-ct-cover-result]'].innerHTML,lang==='ru'?/Щит уничтожен взрывом/:/blast destroys the shield/);assert.match(f['[data-ct-cover-result]'].innerHTML,lang==='ru'?/уклоняться от этой атаки нельзя/:/cannot dodge this attack/);
  f['[data-ct-cover-damage]'].value='9';assert.equal(C.coverDamage({...base,kind:'shield',attack:'blast',damage:'9'}).target,'none');C.handle({type:'click',target},lang);assert.match(f['[data-ct-cover-result]'].innerHTML,lang==='ru'?/Щит выдержал/:/shield survives/);assert.doesNotMatch(f['[data-ct-cover-result]'].innerHTML,lang==='ru'?/полный исходный урон/:/full original damage/);
 }
});
test('living shield rules include equip prerequisites and persistent ranged dodge restriction',()=>{
 const en=C.render('en'),ru=C.render('ru');
 for(const phrase of [/not already wielding a shield/,/using the same hand/,/cannot dodge ranged attacks/,/Aimed Shots to your head/])assert.match(en,phrase);
 for(const phrase of [/у вас ещё нет экипированного щита/,/той же рукой/,/не может уклоняться от дальних атак/,/прицельные выстрелы в голову/])assert.match(ru,phrase);
});
test('an ordinary attack destroys cover without carrying excess damage through',()=>{const r=C.coverDamage(base);assert.equal(r.after,0);assert.equal(r.destroyed,true);assert.equal(r.target,'none');});
test('an explosion that destroys cover exposes target to full damage even at exact HP',()=>{for(const damage of ['10','15']){const r=C.coverDamage({...base,attack:'blast',damage});assert.equal(r.after,0);assert.equal(r.target,'full');}const r=C.coverDamage({...base,attack:'blast',damage:'9'});assert.equal(r.after,1);assert.equal(r.target,'none');});
test('steel resists Brawling and Martial Arts without BODY 10 or Cyberarm',()=>{for(const attack of ['brawling','martial']){const r=C.coverDamage({...base,kind:'steel',attack});assert.equal(r.after,10);assert.equal(r.blocked,true);const k=C.coverDamage({...base,kind:'steel',attack,cyber:true});assert.equal(k.after,0);assert.equal(k.blocked,false);}assert.equal(C.coverDamage({...base,kind:'steel',attack:'normal'}).after,0);});
test('bulletproof and corpse shields use their supplied remaining HP',()=>{const r=C.coverDamage({...base,kind:'shield',hp:'10',damage:'7'});assert.equal(r.after,3);assert.equal(r.destroyed,false);assert.equal(C.coverDamage({...base,kind:'shield',hp:'3',damage:'3'}).destroyed,true);});
test('material reference matches corebook p.182 including thin material that is not cover',()=>{assert.deepEqual(C.COVER_HP,{steel:{thin:25,thick:50},stone:{thin:20,thick:40},glass:{thin:15,thick:30},concrete:{thin:10,thick:25},wood:{thin:5,thick:20},plastic:{thin:0,thick:15}})});
test('invalid and already-destroyed cover are rejected without creating state',()=>{for(const patch of [{hp:'0'},{hp:'-1'},{hp:'1e2'},{hp:''},{damage:'1.5'},{damage:'-1'},{damage:'1001'},{kind:'human'},{attack:'other'},{cyber:'yes'}])assert.equal(C.coverDamage({...base,...patch}),null);});
test('both languages render and handle confirmed cover hits with correct blast outcome',()=>{for(const lang of ['en','ru']){const html=C.render(lang);assert.match(html,/data-ct-action="cover"/);assert.match(html,lang==='ru'?/Живой щит/:/Living shield/);const f={'[data-ct-cover-kind]':{value:'cover'},'[data-ct-cover-hp]':{value:'10'},'[data-ct-cover-damage]':{value:'10'},'[data-ct-cover-attack]':{value:'blast'},'[data-ct-cover-cyber]':{checked:false},'[data-ct-cover-result]':{}};const root={querySelector:s=>f[s]},button={dataset:{ctAction:'cover'}},target={closest:s=>s==='[data-combat-tool]'?root:s==='[data-ct-action]'?button:null};assert.equal(C.handle({type:'click',target},lang),true);assert.match(f['[data-ct-cover-result]'].innerHTML,/<strong>0<\/strong>/);assert.match(f['[data-ct-cover-result]'].innerHTML,lang==='ru'?/полный исходный урон/:/full original blast damage/);assert.equal(f['[data-ct-cover-hp]'].value,'10');}});
