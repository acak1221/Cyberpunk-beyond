const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const source=n=>fs.readFileSync(__dirname+'/../site/'+n,'utf8');
global.window=global;
window.SKILL_LABELS={'Language (Streetslang)':{ru:'Язык (уличный сленг)',en:'Language (Streetslang)'},'Language (Other)':{ru:'Язык (другой)',en:'Language (Other)'},Science:{ru:'Наука',en:'Science'},'Martial Arts':{ru:'Боевые искусства',en:'Martial Arts'},'Play Instrument':{ru:'Игра на инструменте',en:'Play Instrument'}};
require('../site/character-extra.js');require('../site/sheet-leftovers.js');
const S=window.SheetLeftovers;

test('specParent maps names to base skills',()=>{
 assert.equal(S.specParent('Language (Japanese)'),'Language (Other)');
 assert.equal(S.specParent('Язык (японский)'),'Language (Other)');
 assert.equal(S.specParent('Local Expert (Watson)'),'Local Expert (Other)');
 assert.equal(S.specParent('Science (Chemistry)'),'Science');
 assert.equal(S.specParent('Karate'),'Martial Arts');
 assert.equal(S.specParent('Martial Arts (Judo)'),'Martial Arts');
 assert.equal(S.specParent('Play Instrument (Guitar)'),'Play Instrument');
 assert.equal(S.specParent('Language (Streetslang)'),'Language (Streetslang)');
 assert.equal(S.specParent('Хакерство'),null);
});
test('specLabel keeps the inner part',()=>{
 assert.equal(S.specLabel('Science (Chemistry)','Science'),'Chemistry');
 assert.equal(S.specLabel('Karate','Martial Arts'),'Karate');
 assert.equal(S.specLabel('Foo (Bar)',null),'Foo (Bar)');
});
const person=()=>({extra:{specializations:[{id:'a',name:'Language (Japanese)',stat:'INT',level:4},{id:'b',name:'Martial Arts (Karate)',stat:'DEX',level:3,cost:2},{id:'c',name:'Weird <b>',stat:'XYZ',level:2},{id:'d',name:'  ',stat:'INT',level:1},{id:'e',name:'Хакерство',level:1}]}});
test('specRowsHTML renders rows for one parent, other rows for the rest',()=>{
 const c=person(),before=JSON.stringify(c),tf=(st,lv)=>lv+3;
 const html=S.specRowsHTML(c,'Language (Other)','ru',tf);
 assert.match(html,/data-cx-action="roll-skill" data-cx-index="0"/);assert.match(html,/data-skill-level="4"/);assert.match(html,/\+7/);assert.match(html,/↳ Japanese/);
 assert.doesNotMatch(html,/Karate/);
 assert.match(S.specRowsHTML(c,'Martial Arts','en',tf),/data-cx-index="1"/);
 const other=S.otherSpecRowsHTML(c,'en',tf);
 assert.match(other,/data-cx-index="2"[\s\S]*<b data-spec-total="2">—<\/b>/);assert.match(other,/data-cx-index="4"/);
 assert.doesNotMatch(other,/data-cx-index="3"/);assert.match(other,/Weird &lt;b&gt;/);
 assert.equal(JSON.stringify(c),before);assert.equal(S.specRowsHTML({},'Science','en',tf),'');
});
test('ipBalanceOf is pure and ipChipHTML links to the IP block',()=>{
 const c={extra:{ipOpening:10,ipLog:[{delta:20},{delta:-5}]}};assert.equal(S.ipBalanceOf(c),25);
 const d={};assert.equal(S.ipBalanceOf(d),null);assert.equal(d.extra,undefined);
 assert.equal(S.ipBalanceOf({extra:{ipLog:'x'}}),null);assert.equal(S.ipChipHTML({extra:{ipLog:'x'}},'en'),'');
 assert.match(S.ipChipHTML(c,'ru'),/data-hud-jump="sheet-ip"[\s\S]*<b>25<\/b>/);
 assert.ok(source('sheet-tabs.js').indexOf('Money?.chipHTML')<source('sheet-tabs.js').indexOf('SheetLeftovers?.ipChipHTML'));
});
test('restore-luck button sits once, next to the LUCK field',()=>{
 const c={role:'solo',stats:{LUCK:6},skills:{},extra:{luck:3}};window.CharacterExtra.init(c);
 const html=window.CharacterExtra.render(c,'en');
 assert.equal((html.match(/data-cx-action="restore-luck"/g)||[]).length,1);
 assert.match(html,/<div class="cx-luck-pair">[\s\S]*data-cx-field="luck"[\s\S]*restore-luck[\s\S]*?<\/div>/);
});
test('partsText names the parts, drops zeros, reports a mismatch as other, falls back to the lumped form',()=>{
 assert.equal(S.partsText([{k:'wound',v:-2},{k:'luck',v:2},{k:'sheet',v:0}],0,'ru'),' \u2212 2 (ранение) + 2 (LUCK)');
 assert.equal(S.partsText([{k:'luck',v:2}],3,'en'),' + 2 (LUCK) + 1 (other)');
 assert.equal(S.partsText([{k:'luck',v:2.5}],2,'en'),' + 2 (other)');
 assert.equal(S.partsText([],0,'en'),'');
 assert.equal(S.partsText('x',-3,'ru'),' \u2212 3');assert.equal(S.partsText(undefined,0,'ru'),'');
});
