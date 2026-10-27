const {test}=require('node:test');
const assert=require('node:assert/strict');
global.window={};require('../public/game/catalog.js');require('../public/game/catalog-extra.js');
const gear=id=>{const list=window.CATALOG.filter(x=>x.id===id);assert.equal(list.length,1);return list[0]};
test('each core gear entry has bilingual effects and a source description page',()=>{
 const items=window.CATALOG.filter(x=>x.id.startsWith('gear-'));assert.equal(items.length,53);
 for(const item of items){assert.ok(item.details.ru.length>15,item.id);assert.ok(item.details.en.length>15,item.id);assert.ok(item.page>=352&&item.page<=355,item.id)}
 assert.ok(gear('cyberware-contraceptive-implant').details.en.length>15);
});
test('healing, information and poison equipment retain corebook constraints',()=>{
 const pump=gear('gear-cryopump'),tank=gear('gear-cryotank'),scanner=gear('gear-medscanner'),poison=gear('gear-vial-of-poison'),agent=gear('gear-agent');
 assert.match(pump.details.en,/Medtech/);assert.match(pump.details.en,/15 HP/);assert.match(pump.details.en,/50 eb/);assert.match(tank.details.en,/DV13/);assert.match(tank.details.en,/twice/);assert.match(scanner.details.en,/\+2/);assert.match(scanner.details.en,/do not stack/);assert.match(poison.details.en,/DV13/);assert.match(poison.details.en,/2d6/);assert.match(poison.details.en,/without ablating armor/);assert.match(agent.details.en,/Library Search/);assert.match(agent.details.en,/seasonal/);
});
test('frame requirements retain the source contradiction rather than inventing an interpretation',()=>{
 const beta=gear('gear-linear-frame-beta'),sigma=gear('gear-linear-frame-sigma');assert.match(beta.details.en,/BODY to 14/);assert.match(beta.details.en,/two installations/);assert.match(sigma.details.en,/BODY to 12/);assert.match(sigma.details.en,/both one and two/);assert.match(sigma.details.en,/GM/);
});
