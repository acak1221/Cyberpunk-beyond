// DoseStock (site/dose-stock.js): doses are inventory rows.
const { test } = require('node:test'), assert = require('node:assert/strict'), fs = require('node:fs'), vm = require('node:vm');
function load() {
  const w = {}, ctx = { window: w, Math, JSON, Number, String, Array, Object, Date, Set, console, crypto: { randomUUID: () => 'id' + Math.random().toString(36).slice(2) } };
  ctx.globalThis = ctx; vm.createContext(ctx);
  for (const f of ['catalog.js', 'catalog-extra.js', 'character-extra.js', 'dose-stock.js']) vm.runInContext(fs.readFileSync(__dirname + '/../site/' + f, 'utf8'), ctx);
  return w;
}
const row = (o) => Object.assign({ id: 'r' + Math.random(), name: 'x', category: 'equipment', quantity: 1, notes: '' }, o);
test('keyOf: catalogId, bare name, foreign id, bad quantity', () => {
  const D = load().DoseStock;
  assert.equal(D.keyOf({ catalogId: 'extra-drug-boost', name: 'whatever' }), 'boost');
  assert.equal(D.keyOf({ name: ' synthCOKE ' }), 'synthcoke');
  assert.equal(D.keyOf({ name: 'Boost (fake)' }), null);
  assert.equal(D.keyOf({ catalogId: 'weapon-x', name: 'Boost' }), null);
  assert.equal(D.count({ extra: { items: [row({ name: 'Boost', quantity: 2.5 }), row({ name: 'Boost', quantity: 0 })] } }, 'boost'), 0);
});
test('count sums rows and legacy; take spends legacy first, then rows, then removes the row', () => {
  const D = load().DoseStock, c = { extra: { items: [row({ catalogId: 'extra-pharmaceutical-speedheal', quantity: 2 }), row({ name: 'Speedheal', quantity: 1 })], pharmacy: { version: 1, doses: { speedheal: 1 }, history: [] } } };
  assert.equal(D.count(c, 'speedheal'), 4);
  assert.deepEqual(JSON.parse(JSON.stringify(D.take(c, 'speedheal'))), { ok: true, left: 3 });
  assert.equal(c.extra.pharmacy.doses.speedheal, 0); assert.equal(c.extra.items[0].quantity, 2);
  D.take(c, 'speedheal'); assert.equal(c.extra.items[0].quantity, 1);
  D.take(c, 'speedheal'); assert.equal(c.extra.items.length, 1);
  D.take(c, 'speedheal');
  const snap = JSON.stringify(c); assert.equal(D.take(c, 'speedheal').reason, 'none'); assert.equal(JSON.stringify(c), snap);
});
test('add tops up, creates, refuses full and invalid; leaves the rest untouched', () => {
  const D = load().DoseStock, c = { extra: { cash: 5, items: [row({ name: 'Rope', notes: 'n' })] } };
  const a = D.add(c, 'synthcoke', 3, 'ru'); assert.equal(a.ok, true);
  const r = c.extra.items[1]; assert.equal(r.catalogId, 'extra-drug-synthcoke'); assert.equal(r.quantity, 3); assert.equal(r.category, 'equipment');
  D.add(c, 'synthcoke', 2, 'en'); assert.equal(c.extra.items.length, 2); assert.equal(r.quantity, 5);
  assert.equal(c.extra.cash, 5); assert.equal(c.extra.items[0].notes, 'n');
  for (const bad of [0, -1, 1.5, 10000, '3']) assert.equal(D.canAdd(c, 'synthcoke', bad).reason, 'invalid');
  r.quantity = 99999; assert.equal(D.canAdd(c, 'synthcoke', 1).reason, 'full');
  const big = { extra: { items: Array.from({ length: 500 }, () => row({ name: 'a' })) } };
  const snap = JSON.stringify(big); assert.equal(D.add(big, 'boost', 1).reason, 'full'); assert.equal(JSON.stringify(big), snap);
  assert.equal(D.canAdd(c, 'nope', 1).reason, 'invalid');
});
test('migrate moves legacy pharmacy doses into inventory rows once', () => {
  const D = load().DoseStock;
  const c = { extra: { items: [], pharmacy: { version: 1, doses: { speedheal: 2, stim: 1 }, history: [] } } };
  assert.equal(D.migrate(c, 'en'), 3);
  assert.equal(c.extra.pharmacy.doses.speedheal, 0);
  assert.equal(D.legacy(c, 'speedheal'), 0);
  assert.equal(D.count(c, 'speedheal'), 2);
  assert.equal(D.count(c, 'stim'), 1);
  assert.equal(D.migrate(c, 'en'), 0);
  assert.equal(D.count(c, 'speedheal'), 2);
});
