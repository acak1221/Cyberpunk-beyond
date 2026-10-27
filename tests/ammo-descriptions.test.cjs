const {test}=require('node:test');
const assert=require('node:assert/strict');
global.window={};
require('../public/game/catalog.js');
require('../public/game/catalog-extra.js');
const get=id=>{const all=window.CATALOG.filter(x=>x.id==='ammo-'+id+'-ammunition');assert.equal(all.length,1);return all[0]};
test('poison, biotoxin, EMP and flashbang replace ordinary damage',()=>{
 for(const id of ['poison','biotoxin','emp','flashbang']){const entry=get(id);assert.match(entry.details.en,/no (?:ordinary )?damage/);assert.match(entry.details.ru,/не наносит/);assert.match(entry.details.en,/DV1[35]/);}
 assert.match(get('poison').details.en,/2d6 directly to HP/);assert.match(get('biotoxin').details.en,/3d6 directly to HP/);assert.match(get('emp').details.en,/Cybertech/);assert.match(get('flashbang').details.en,/Damaged Eye and Damaged Ear/);
});
test('rubber and expansive ammunition preserve special injury and HP rules',()=>{
 const rubber=get('rubber'),expansive=get('expansive');assert.match(rubber.details.en,/more than 1 HP below 0/);assert.match(rubber.details.en,/cannot cause Critical Injuries or ablate armor/);assert.match(expansive.details.en,/second injury deals no bonus damage/);assert.match(expansive.details.ru,/не наносит бонусные/);
});
test('smart, incendiary, sleep and teargas specify trigger, timing and exceptions',()=>{
 const smart=get('smart'),fire=get('incendiary'),sleep=get('sleep'),gas=get('teargas');assert.match(smart.details.en,/miss by 4 or less/);assert.match(smart.details.en,/1d10 \+ 10/);assert.match(smart.details.en,/Targeting Scope/);assert.match(fire.details.en,/2 direct HP at the end of each turn/);assert.match(fire.details.en,/do not stack/);assert.match(sleep.details.en,/one minute/);assert.match(sleep.details.en,/until damaged/);assert.match(gas.details.en,/meat eyes/);assert.match(gas.details.en,/without bonus damage/);
});
