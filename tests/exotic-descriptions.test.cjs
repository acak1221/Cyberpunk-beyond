const {test}=require('node:test');
const assert=require('node:assert/strict');
global.window={};
require('../public/game/catalog.js');
require('../public/game/catalog-extra.js');
const get=id=>{const list=window.CATALOG.filter(x=>x.id===id);assert.equal(list.length,1);return list[0]};
test('Air Pistol and Battleglove describe their nonstandard handling',()=>{
 const air=get('weapon-air-pistol'),glove=get('weapon-battleglove');assert.equal(air.page,347);assert.equal(glove.page,347);
 for(const l of ['ru','en']){assert.match(air.details[l],/SP/);assert.match(air.details[l],/1/);assert.match(glove.details[l],/Cyberarm/);assert.match(glove.details[l],/Action/);}
 assert.match(air.details.en,/no damage/);assert.match(glove.details.en,/three slots/);assert.match(glove.details.en,/inaccessible/);
});
test('Shrieker and Helix describe hit effects, ammunition and restrictions',()=>{
 const shriek=get('weapon-shrieker'),helix=get('weapon-tsunami-arms-helix');assert.equal(shriek.page,349);assert.equal(helix.page,349);
 for(const l of ['ru','en']){assert.match(shriek.details[l],/DV15/);assert.match(shriek.details[l],/Damaged Ear/);assert.match(helix.details[l],/Autofire/);assert.match(helix.details[l],/×5/);assert.match(helix.details[l],/20/);assert.match(helix.details[l],/BODY 11/);}
 assert.match(shriek.details.en,/ear protection/);assert.match(helix.details.en,/two Actions/);assert.match(helix.details.en,/no single shots or Aimed Shots/);
});
