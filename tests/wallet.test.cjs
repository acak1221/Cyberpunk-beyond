// Wallet (site/wallet.js): pure money changes with a short ledger.
const { test } = require('node:test'), assert = require('node:assert/strict'), fs = require('node:fs'), vm = require('node:vm');
function load() {
  const w = {}, ctx = { window: w, Math, JSON, Number, String, Array, Object, Date };
  vm.createContext(ctx); vm.runInContext(fs.readFileSync(__dirname + '/../site/wallet.js', 'utf8'), ctx);
  return w.Wallet;
}
const at = { at: '2045-01-01T00:00:00.000Z' };

test('earn and spend return a staged extra and never mutate the character', () => {
  const W = load(), c = { id: 'a', extra: { cash: 100, luck: 3 } };
  const r = W.earn(c, 250, 'Gig', at);
  assert.equal(r.ok, true); assert.equal(r.balance, 350); assert.equal(r.extra.luck, 3);
  assert.equal(c.extra.cash, 100); assert.equal(c.extra.walletLog, undefined);
  assert.deepEqual(JSON.parse(JSON.stringify(r.extra.walletLog)), [{ at: at.at, delta: 250, balance: 350, note: 'Gig' }]);
  const s = W.spend({ extra: r.extra }, 50, 'Taxi', at);
  assert.equal(s.balance, 300); assert.equal(s.extra.walletLog.length, 2); assert.equal(s.extra.walletLog[0].delta, -50);
});

test('spend refuses when short and reports how much is missing', () => {
  const W = load(), r = W.spend({ extra: { cash: 30 } }, 100, 'x');
  assert.equal(r.ok, false); assert.equal(r.reason, 'short'); assert.equal(r.short, 70); assert.equal(r.balance, 30);
});

test('bad amounts are refused, not turned into zero', () => {
  const W = load(), c = { extra: { cash: 500 } };
  for (const bad of [0, -5, NaN, 'abc', Infinity, 0.4]) { assert.equal(W.earn(c, bad).ok, false, String(bad)); assert.equal(W.spend(c, bad).ok, false, String(bad)); }
  assert.equal(W.earn({ extra: { cash: W.MAX } }, 1).reason, 'max');
  assert.equal(W.change(null, 5).reason, 'noCharacter');
  assert.equal(W.cash({ extra: { cash: -40 } }), 0); assert.equal(W.cash({}), 0);
});

test('ledger keeps the newest entries only', () => {
  const W = load(); let c = { extra: { cash: 0 } };
  for (let i = 0; i < W.LOG_MAX + 5; i++) c = { extra: W.earn(c, 1, 'n' + i, at).extra };
  assert.equal(W.log(c).length, W.LOG_MAX); assert.equal(W.log(c)[0].note, 'n' + (W.LOG_MAX + 4)); assert.equal(W.cash(c), W.LOG_MAX + 5);
});

test('transfer is all or nothing and split reports the remainder', () => {
  const W = load(), a = { id: 'a', extra: { cash: 100 } }, b = { id: 'b', extra: { cash: 5 } };
  const t = W.transfer(a, b, 60, 'share', at);
  assert.equal(t.ok, true); assert.equal(t.from.balance, 40); assert.equal(t.to.balance, 65);
  assert.equal(W.transfer(a, b, 600).reason, 'short'); assert.equal(W.transfer(a, a, 10).ok, false);
  assert.deepEqual(JSON.parse(JSON.stringify(W.split(1000, 3))), { each: 333, rest: 1 });
  assert.equal(W.format(1234567), '1 234 567');
});
