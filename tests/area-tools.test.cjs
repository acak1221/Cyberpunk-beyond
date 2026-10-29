const {test}=require('node:test'),assert=require('node:assert/strict');
global.window={};require('../public/game/area-tools.js');const A=window.AreaTools;
const base={type:'blast',attack:18,hit:true,damage:20,sixes:0};
const target={ref:6,dodge:'no',evasion:0,sp:11,cover:0};
test('cover survives only when HP exceeds the blast; destroyed cover does not reduce the damage',()=>{
 let r=A.resolveTarget({...base,target:{...target,cover:21}});assert.deepEqual(r,{status:'cover',coverAfter:1});
 r=A.resolveTarget({...base,target:{...target,cover:20}});assert.equal(r.status,'hit');assert.equal(r.penetration,9);assert.equal(r.coverAfter,0);assert.equal(r.spAfter,10);assert.equal(r.coverDestroyed,true);
 r=A.resolveTarget({...base,target:{...target,cover:5}});assert.equal(r.penetration,9);assert.equal(r.coverDestroyed,true);
});
test('a dodge needs REF 8 and must beat the attack; cover still takes the blast',()=>{
 assert.equal(A.resolveTarget({...base,target:{...target,ref:7,dodge:'yes',evasion:20}}),null);
 assert.equal(A.resolveTarget({...base,target:{...target,ref:8,dodge:'yes',evasion:18}}).status,'hit');
 assert.deepEqual(A.resolveTarget({...base,target:{...target,ref:8,dodge:'yes',evasion:19,cover:25}}),{status:'dodged',coverAfter:5});
});
test('shotgun shell requires a successful check and visible targets',()=>{
 assert.equal(A.resolveTarget({...base,type:'shell',hit:false,target}).status,'miss');
 assert.equal(A.resolveTarget({...base,type:'shell',hit:true,target:{...target,cover:5}}).status,'invalid');
 assert.equal(A.resolveTarget({...base,type:'shell',hit:true,target:{...target,ref:8,dodge:'yes',evasion:19}}).status,'dodged');
});
test('a tie favors the defender against shotgun shells but not against explosions',()=>{
 const defending={...target,ref:8,dodge:'yes'};
 for(const type of ['shell','blast']){
  assert.equal(A.resolveTarget({...base,type,target:{...defending,evasion:17}}).status,'hit');
  assert.equal(A.resolveTarget({...base,type,target:{...defending,evasion:18}}).status,type==='shell'?'dodged':'hit');
  assert.equal(A.resolveTarget({...base,type,target:{...defending,evasion:19}}).status,'dodged');
 }
 assert.match(A.render('ru'),/При ничьей уклонение от дроби удаётся, а от взрыва — нет/);
 assert.match(A.render('en'),/A tie evades shotgun shells, but not an explosion/);
});
test('the area calculator displays the tied shotgun dodge in both languages',()=>{
 for(const lang of ['ru','en']){
  const output={innerHTML:''};
  const row={querySelector:s=>({value:({'[data-area-name]':'Target','[data-area-ref]':'8','[data-area-dodge]':'yes','[data-area-evasion]':'18','[data-area-sp]':'11','[data-area-cover]':'0'})[s]})};
  const container={querySelectorAll:()=>[row]},values={'[data-area-type]':'shell','[data-area-attack]':'18','[data-area-dv]':'13','[data-area-dice]':'6,4,1'};
  const root={querySelector:s=>s==='[data-area-targets]'?container:s==='[data-area-result]'?output:{value:values[s]}};
  const button={dataset:{areaAction:'calculate'},closest:()=>root};
  assert.equal(A.handle({type:'click',target:{closest:()=>button}},lang),true);
  assert.match(output.innerHTML,lang==='ru'?/Уклонение удалось/:/Dodge succeeded/);
 }
});
test('two sixes add direct critical damage even when armor blocks the ordinary damage',()=>{
 const r=A.resolveTarget({...base,damage:12,sixes:2,target:{...target,sp:20}});assert.equal(r.status,'hit');assert.equal(r.penetration,0);assert.equal(r.bonus,5);assert.equal(r.total,5);assert.equal(r.spAfter,20);
});
test('dice inputs are bounded, numeric, and shells use exactly 3d6',()=>{
 assert.deepEqual(A.diceList('6, 4,1','shell'),[6,4,1]);assert.equal(A.diceList('6,4','shell'),null);assert.equal(A.diceList('6,4,7','blast'),null);assert.equal(A.diceList(Array(51).fill('1').join(','),'blast'),null);assert.equal(A.diceList('','blast'),null);
});
test('the interactive calculation uses one blast for each target and escapes labels',()=>{
 const row=(name,cover)=>({querySelector:s=>({value:({'[data-area-name]':name,'[data-area-ref]':'6','[data-area-dodge]':'no','[data-area-evasion]':'0','[data-area-sp]':'11','[data-area-cover]':String(cover)})[s]})});
 for(const lang of ['ru','en']){const output={innerHTML:''},rows=[row('<img src=x>',21),row('Second',20)],container={querySelectorAll:()=>rows},values={'[data-area-type]':'blast','[data-area-attack]':'18','[data-area-dv]':'13','[data-area-dice]':'6,6,4,4'},root={querySelector:s=>s==='[data-area-targets]'?container:s==='[data-area-result]'?output:{value:values[s]}},button={dataset:{areaAction:'calculate'},closest:()=>root};assert.equal(A.handle({type:'click',target:{closest:()=>button}},lang),true);assert.match(output.innerHTML,/20 \(6 \+ 6 \+ 4 \+ 4\)/);assert.match(output.innerHTML,/&lt;img src=x&gt;/);assert.doesNotMatch(output.innerHTML,/<img/);assert.match(output.innerHTML,/Second/);assert.match(output.innerHTML,/9/);}
});
test('bilingual interface refers to source and does not access storage',()=>{for(const lang of ['ru','en']){const html=A.render(lang);assert.match(html,/data-page="174"/);assert.equal((html.match(/data-area-target>/g)||[]).length,2);assert.doesNotMatch(html,/localStorage|fetch\(/)}});
