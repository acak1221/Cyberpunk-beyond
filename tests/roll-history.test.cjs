// Roll history (site/roll-history.js): persisted per device, capped, undoable, replayable.
const { test } = require('node:test'), assert = require('node:assert/strict'), fs = require('node:fs'), vm = require('node:vm');
function load(store = {}, app = null) {
  const w = {}; w.localStorage = { getItem: k => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); } };
  w.App = app; w.document = undefined;
  const ctx = { window: w, JSON, Number, String, Array, Object, Date, Math };
  vm.createContext(ctx); vm.runInContext(fs.readFileSync(__dirname + '/../site/roll-history.js', 'utf8'), ctx);
  return { H: w.RollHistory, store };
}
const roll = (n, extra = {}) => ({ label: 'Roll ' + n, detail: 'd', total: n, ...extra });

test('rolls survive a reload and keep only the last 50', () => {
  const a = load();
  for (let i = 1; i <= 55; i++) a.H.add(roll(i));
  assert.equal(a.H.all().length, 50); assert.equal(a.H.all()[0].total, 55);
  const b = load(a.store);
  assert.equal(b.H.all().length, 50); assert.equal(b.H.all()[49].total, 6);
});

test('broken storage and junk entries are ignored', () => {
  assert.equal(load({ 'nc-roll-history': '{not json' }).H.all().length, 0);
  const s = { 'nc-roll-history': JSON.stringify([{ label: 'ok', total: 3 }, { label: '', total: 1 }, null, { label: 'x', total: 'a' }]) };
  assert.equal(load(s).H.all().length, 1);
});

test('clear can be undone; a new roll drops the undo', () => {
  const { H, store } = load();
  H.add(roll(1)); H.add(roll(2));
  assert.equal(H.clear(), true); assert.equal(H.all().length, 0);
  assert.equal(JSON.parse(store['nc-roll-history']).length, 0);
  assert.match(H.rows(), /data-rh-undo/);
  assert.equal(H.undo(), true); assert.equal(H.all().length, 2);
  H.clear(); H.add(roll(3)); assert.equal(H.undo(), false);
});

test('replay calls App with the same numbers; unknown recipes are refused', () => {
  const calls = [], app = { check: (...a) => calls.push(['check', ...a]), dice: (...a) => calls.push(['dice', ...a]) };
  const { H } = load({}, app);
  assert.equal(H.replay({ kind: 'check', stat: 8, skill: 4, mod: -2, dv: 13, label: 'Aim' }), true);
  assert.deepEqual(JSON.parse(JSON.stringify(calls[0])), ['check', 8, 'Aim', { wounds: false, dv: 13, skill: 4, mod: -2, ignoreFumble: false }]);
  assert.equal(H.replay({ kind: 'dice', n: 2, sides: 6, label: '' }), true);
  assert.deepEqual(JSON.parse(JSON.stringify(calls[1])), ['dice', 2, 6, '']);
  assert.equal(H.replay({ kind: 'dice', n: 999, sides: 6 }), false);
  assert.equal(H.replay({ kind: 'x' }), false);
  H.add(roll(5, { replay: { kind: 'dice', n: 1, sides: 10 } })); H.add(roll(6));
  assert.ok(H.rows().includes('data-rh-again="1"')); assert.equal(H.rows().split('data-rh-again').length, 2);
});

test('labels are escaped in the list', () => {
  const { H } = load(); H.add({ label: '<img onerror=1>', detail: '"x"', total: 1 });
  assert.ok(!H.rows().includes('<img'));
});
