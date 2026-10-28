const {test}=require('node:test');
const assert=require('node:assert/strict');
const vm=require('node:vm');
const fs=require('node:fs');

const window={},context=vm.createContext({window});
for(const file of ['catalog.js','catalog-extra.js'])
  vm.runInContext(fs.readFileSync(`${__dirname}/../public/game/${file}`,'utf8'),context);
const hardware=id=>{
  const matches=window.CATALOG.filter(item=>item.id===`extra-deck-${id}`);
  assert.equal(matches.length,1,id);
  return matches[0];
};

test('all six hardware modules preserve their price, slots, source and bilingual installation rule',()=>{
  for(const [id,slots] of [['backup-drive',2],['dna-lock',2],['hardened-circuitry',1],['insulated-wiring',1],['krash-barrier',2],['range-upgrade',1]]){
    const item=hardware(id);
    assert.equal(item.price,100,id);
    assert.equal(item.page,368,id);
    assert.equal(item.stats.type,'hardware',id);
    assert.equal(item.stats.slots,slots,id);
    assert.match(item.details.ru,/установка или снятие занимает 1 час/i,id);
    assert.match(item.details.en,/installation or removal takes 1 hour/i,id);
    assert.match(item.details.en,new RegExp(`Takes ${slots} slots?`),id);
  }
});

test('backup drive explains what it saves and prevents resetting limited-use programs',()=>{
  const {ru,en}=hardware('backup-drive').details;
  assert.match(en,/non-Black ICE Attacker, Defender and Booster/i);
  assert.match(en,/Meat Action.*all saved programs.*enough slots/i);
  assert.match(en,/restrictions on use during the current Netrun remain/i);
  assert.match(en,/Removing the drive erases/i);
  assert.match(ru,/Физическим действием.*все сохранённые программы.*свободные слоты/i);
  assert.match(ru,/ограничения на использование в текущем Netrun сохраняются/i);
  assert.match(ru,/извлечении накопителя.*стираются/i);
});

test('hardware describes access, protection and range in both languages',()=>{
  assert.match(hardware('dna-lock').details.en,/biometric key or a DV17 Electronics\/Security Tech/i);
  assert.match(hardware('dna-lock').details.ru,/биометрическому ключу.*DV17/i);
  assert.match(hardware('hardened-circuitry').details.en,/temporary disabling.*inoperable.*destruction.*EMP.*non-Black ICE/i);
  assert.match(hardware('hardened-circuitry').details.ru,/временного отключения.*вывода из строя.*уничтожения.*ЭМИ/i);
  assert.match(hardware('krash-barrier').details.en,/safe or unsafe Jack Out/i);
  assert.match(hardware('krash-barrier').details.ru,/безопасный или небезопасный выход/i);
  assert.match(hardware('range-upgrade').details.en,/8 m/i);
  assert.match(hardware('range-upgrade').details.ru,/8 м/i);
});

test('the actual bilingual catalog finds the newly documented restoration rules',()=>{
  assert.match(window.renderCatalog('en','restrictions on use during the current Netrun','programs'),/Backup Drive/);
  assert.match(window.renderCatalog('ru','при извлечении накопителя','programs'),/Резервный накопитель/);
});
