// The +1 of an excellent weapon reaches the attack bonus, and deleting a weapon or a thing unlinks what pointed at it.
const { test } = require('node:test'), assert = require('node:assert/strict'), fs = require('node:fs'), vm = require('node:vm');
const read = name => fs.readFileSync(__dirname + '/../site/' + name, 'utf8');
function load(withAttach = true) {
  let n = 0;
  const w = {}, ctx = { window: w, globalThis: { crypto: { randomUUID: () => 'id-' + (++n) } }, console, Math, JSON, Set, Map, Number, String, Array, Object, Date };
  w.crypto = { randomUUID: () => 'wa-' + (++n) };
  vm.createContext(ctx);
  for (const file of ['catalog.js', 'catalog-extra.js', 'defenses-extra.js', 'character-extra.js', ...(withAttach ? ['weapon-attach.js'] : [])]) vm.runInContext(read(file), ctx);
  return w;
}
const person = extra => ({ id: 'p', name: 'Nova', role: 'solo', stats: { REF: 6, DEX: 6, INT: 6, WILL: 6, COOL: 6, TECH: 6, LUCK: 6, MOVE: 6, BODY: 6, EMP: 6 }, skills: { Handgun: 3 }, hp: 40, humanity: 60, extra: { items: [], weapons: [], ...extra } });
const gun = (quality, more) => ({ id: 'w1', name: 'Gun', skill: 'Handgun', stat: 'REF', modifier: 0, damage: '3d6', rof: 1, capacity: 8, ammo: 8, ...(quality ? { quality } : {}), ...more });
const click = (W, c, action, index) => W.CharacterExtra.handle({ type: 'click', target: { closest: s => s === '[data-cx-action]' ? { dataset: { cxAction: action, cxIndex: String(index) } } : null, dataset: {}, hasAttribute: () => false } }, c, 'en');

test('an excellent weapon adds its +1 to the attack bonus; poor and standard add nothing; the bonus is the same without the module', () => {
  const W = load(), bare = load(false);
  const base = bare.CharacterExtra.attackBonus(person({ weapons: [gun()] }), 0);
  assert.equal(W.CharacterExtra.attackBonus(person({ weapons: [gun('excellent')] }), 0), base + 1);
  assert.equal(W.CharacterExtra.attackBonus(person({ weapons: [gun('standard')] }), 0), base);
  assert.equal(W.CharacterExtra.attackBonus(person({ weapons: [gun('poor')] }), 0), base);
  assert.equal(W.CharacterExtra.attackBonus(person({ weapons: [gun()] }), 0), base);
  assert.equal(bare.CharacterExtra.attackBonus(person({ weapons: [gun('excellent')] }), 0), base, 'without weapon-attach.js nothing changes');
});

test('deleting a weapon or a thing drops the links that pointed at it', () => {
  const W = load(), c = person({ weapons: [gun('excellent')], items: [{ id: 'i1', name: 'Scope', linkedTo: 'w1' }, { id: 'i2', name: 'Strap', linkedTo: 'i1' }, { id: 'i3', name: 'Free' }] });
  click(W, c, 'remove-weapon', 0);
  assert.equal(c.extra.weapons.length, 0);
  assert.equal('linkedTo' in c.extra.items[0], false, 'the scope no longer points at the deleted gun');
  assert.equal(c.extra.items[1].linkedTo, 'i1', 'a link to something that still exists stays');
  click(W, c, 'remove-item', 0);
  assert.equal(c.extra.items.length, 2);
  assert.equal('linkedTo' in c.extra.items[0], false, 'the strap no longer points at the deleted scope');
});
