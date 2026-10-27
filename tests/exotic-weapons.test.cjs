const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const root=__dirname+'/../public/game/',w={},scope={window:w,console,Math,Date,globalThis:{crypto:{randomUUID:()=>Math.random().toString(36)}}};vm.createContext(scope);
for(const f of ['catalog.js','catalog-extra.js','character-extra.js'])vm.runInContext(fs.readFileSync(root+f,'utf8'),scope,{filename:f});
const expected={
 'weapon-constitution-arms-hurricane':['5d6','Shoulder Arms',2,16,'Slug or Shotgun Shell'],
 'weapon-dartgun':['4d6','Handgun',1,8,'Non-Basic Arrow'],
 'weapon-flamethrower':['3d6','Heavy Weapons',1,4,'Incendiary Shotgun Shell'],
 'weapon-kendachi-mono-three':['4d6','Melee Weapon',1,null,null],
 'weapon-malorian-arms-3516':['5d6','Handgun',1,8,'VH Pistol'],
 'weapon-militech-cowboy-u-56':['6d6','Heavy Weapons',2,4,'Grenade'],
 'weapon-rhinemetall-emg-86-railgun':['5d6','Heavy Weapons',1,4,'Rifle'],
 'weapon-stun-baton':['2d6','Melee Weapon',2,null,null],
 'weapon-stun-gun':['3d6','Handgun',2,8,'Battery']
};
test('source-checked exotic profiles become usable weapon records while preserving special rules',()=>{
 for(const [id,[damage,skill,rof,magazine,ammo]] of Object.entries(expected)){
  const item=w.CATALOG.find(v=>v.id===id);assert(item,id);assert.deepEqual([item.stats.damage,item.stats.skill,item.stats.rof,item.stats.magazine,item.stats.ammo],[damage,skill,rof,magazine,ammo],id);
  assert.match(item.details.ru,/вручную/i,id);assert.match(item.details.en,/manual/i,id);
  const c={stats:{LUCK:6},skills:{},extra:{}};const result=w.CharacterExtra.addCatalog(c,item,'en');assert.equal(result.kind,'weapon',id);assert.equal(c.extra.weapons.length,1,id);assert.equal(result.record.damage,damage,id);assert.equal(result.record.skill,skill,id);assert.equal(result.record.capacity,magazine||0,id);assert.equal(result.record.usesAmmo,!!ammo,id);assert.equal(result.record.ammo,0,id);assert.match(result.record.notes,/manual/i,id);
 }
});
test('non-damaging and special-only weapons remain manual instead of receiving a fabricated damage roll',()=>{
 for(const id of ['weapon-air-pistol','weapon-battleglove','weapon-microwaver','weapon-shrieker','weapon-tsunami-arms-helix']){
  const item=w.CATALOG.find(v=>v.id===id),c={stats:{LUCK:6},skills:{},extra:{}};assert(item,id);assert.equal(item.stats.damage,undefined,id);const result=w.CharacterExtra.addCatalog(c,item,'en');assert.equal(result.kind,'item',id);assert.equal(c.extra.weapons.length,0,id);
 }
});
