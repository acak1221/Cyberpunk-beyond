const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
const root=path.join(__dirname,'..');
const ruleSource=fs.readFileSync(path.join(root,'public/game/rules.js'),'utf8');
const appSource=fs.readFileSync(path.join(root,'public/game/app.js'),'utf8');
function load(){const ctx={window:{}};vm.runInNewContext(ruleSource,ctx);return ctx.window;}
const sheetSkills=vm.runInNewContext(appSource.match(/const SKILLS = (\[[\s\S]*?\n\]);/)[1]);
test('every character-sheet skill has one bilingual rule with the matching STAT and cost',()=>{
 const {RULES,SKILL_REFERENCE}=load();assert.equal(SKILL_REFERENCE.length,66);
 for(const [sheetName,,stat,multiplier] of sheetSkills){
  const match=SKILL_REFERENCE.filter(x=>x.name===sheetName||sheetName.startsWith(x.name+' ('));
  assert.equal(match.length,1,sheetName);const x=match[0];assert.equal(x.stat,stat,sheetName);assert.equal(x.multiplier,multiplier,sheetName);
  const cards=RULES.filter(r=>r.category.en==='Skills'&&r.title.en===x.name);
  assert.equal(cards.length,1,sheetName);assert.ok(cards[0].title.ru&&cards[0].text.ru&&cards[0].text.en,sheetName);
  assert.equal(cards[0].page,x.page);assert.ok(x.page>=131&&x.page<=142);assert.match(cards[0].text.en,new RegExp('^'+stat+'\\b'));
  assert.equal(cards[0].text.en.includes('×2'),multiplier===2,sheetName);
 }
 assert.equal(new Set(RULES.map(x=>x.id)).size,RULES.length);
});
test('distinct skill rules preserve important restrictions and printed page links',()=>{
 const {RULES}=load();const get=name=>RULES.find(r=>r.category.en==='Skills'&&r.title.en===name);
 assert.match(get('Perception').text.en,/Conceal\/Reveal Object/);assert.match(get('Evasion').text.en,/REF 8/);
 assert.match(get('Local Expert').text.en,/one neighborhood or community/);assert.match(get('Martial Arts').text.en,/separately/);
 assert.match(get('Paramedic').text.en,/not requiring Surgery/);assert.equal(get('Weaponstech').page,142);
});
test('real reference filter finds English and Russian skill names and skill category',()=>{
 const w=load(),filterSource=appSource.slice(appSource.indexOf('function filteredRules()'),appSource.indexOf('function rules()'));
 const c={window:w,state:{query:'',ruleCategory:'Skills'}};vm.runInNewContext(filterSource,c);
 c.state.query='evasion';assert.ok(c.filteredRules().some(r=>r.title.en==='Evasion'));
 c.state.query='уклонение';assert.ok(c.filteredRules().some(r=>r.title.en==='Evasion'));
 c.state.query='';assert.equal(c.filteredRules().length,66);
});
