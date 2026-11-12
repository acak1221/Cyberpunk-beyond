// Everyday words in catalog search (site/catalog-search.js).
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const window={};
for(const f of ['catalog.js','catalog-search.js'])vm.runInNewContext(fs.readFileSync(__dirname+'/../site/'+f,'utf8'),{window});
const find=(q,c='all')=>window.catalogMatches(q,c).map(x=>x.id);
test('ammunition words',()=>{
 for(const q of ['патрон','патроны','Патронов','ammo','боеприпасы'])assert.ok(find(q).includes('ammo-basic-ammunition'),q);
});
test('armor words',()=>{
 for(const q of ['броня','бронежилет','armor'])assert.ok(find(q).includes('armor-kevlar'),q);
 assert.ok(find('куртка').includes('armor-leathers'));
});
test('knife, grenade, guns, medkit, implants',()=>{
 assert.ok(find('нож').includes('weapon-light-melee-weapon'));assert.ok(find('knife').includes('weapon-light-melee-weapon'));
 assert.ok(find('граната').includes('weapon-grenade-launcher'));assert.ok(find('grenades').includes('weapon-grenade-launcher'));
 assert.ok(find('пистолет').includes('weapon-heavy-pistol'));
 assert.ok(find('винтовка').includes('weapon-assault-rifle'));
 assert.ok(find('дробовик').includes('weapon-shotgun'));
 assert.ok(find('аптечка').includes('gear-medtech-bag'));
 assert.ok(find('имплант').includes('cyberware-cyberarm'));assert.ok(find('кибер').includes('cyberware-cyberarm'));
});
test('category filter still applies, exact names and junk still work',()=>{
 assert.equal(find('патроны','armor').length,0);
 assert.ok(find('Kevlar').includes('armor-kevlar'));
 assert.equal(find('zzzz qqq').length,0);
 assert.equal(find('').length,window.CATALOG.length);
});
