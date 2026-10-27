const {test}=require('node:test'),assert=require('node:assert/strict');
global.window={};require('../public/game/catalog.js');require('../public/game/catalog-extra.js');
const get=id=>{const matches=window.CATALOG.filter(x=>x.id===id);assert.equal(matches.length,1);return matches[0]};
test('teleoptics includes single shots, distance, vision, and stacking limits in both languages',()=>{
 const x=get('cyberware-teleoptics');assert.equal(x.page,361);assert.match(x.details.en,/single-shot/);assert.match(x.details.en,/51 m\/yd/);assert.match(x.details.en,/Sniping Scope/);assert.match(x.details.en,/800/);assert.match(x.details.ru,/одиночному/);assert.match(x.details.ru,/51/);
});
test('implant armor explains simultaneous ablation and repair through natural healing',()=>{
 for(const [id,sp] of [['cyberware-skin-weave',7],['cyberware-subdermal-armor',11]]){const x=get(id);assert.equal(x.page,364);assert.match(x.details.en,new RegExp('SP '+sp));assert.match(x.details.en,/all sources.*ablate/i);assert.match(x.details.en,/natural healing/i);assert.match(x.details.ru,/все источники SP/);assert.match(x.details.ru,/естественного исцеления/)}
});
test('chip, cybereye, cyberlimb and neuralware prerequisites are explicit',()=>{
 const chip=get('cyberware-chipware-socket'),jump=get('cyberware-jump-booster'),scope=get('cyberware-low-light-infrared-uv'),audio=get('cyberware-audiovox');assert.equal(chip.page,359);assert.match(chip.details.en,/does not take a Neural Link slot/);assert.match(chip.details.en,/first time/i);assert.match(chip.details.en,/later reinstallation/i);assert.equal(jump.page,366);assert.match(jump.details.en,/2 option slots in each leg/);assert.match(scope.details.en,/cannot see through cover/);assert.match(scope.details.en,/2 slots in each eye/);assert.equal(audio.page,362);assert.match(audio.details.en,/Acting and \+2 to Play Instrument while singing/);
});
test('selected foundational and limb entries have bilingual source descriptions',()=>{
 for(const id of ['cyberware-neural-link','cyberware-interface-plugs','cyberware-grapple-hand','cyberware-popup-shield','cyberware-quick-change-mount','cyberware-techscanner-implant','cyberware-sensor-array']){const x=get(id);assert.ok(x.page>=359&&x.page<=367,id);assert.ok(x.details.ru.length>40,id);assert.ok(x.details.en.length>40,id)}
});
