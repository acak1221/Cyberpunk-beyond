// Dice in the hazard, vehicle, medical and GM-table tools come from Rolls (one random source), and the medical tool
// reads injury names from CritInjuries.ROWS.
const { test } = require('node:test'), assert = require('node:assert/strict'), fs = require('node:fs'), vm = require('node:vm');
const src = f => fs.readFileSync(__dirname + '/../site/' + f, 'utf8');
function load(files, rolls) {
  const w = { Rolls: rolls }, ctx = { window: w, console, document: undefined, navigator: {}, Math: Object.create(Math, { random: { value: () => { throw new Error('Math.random used'); } } }) };
  vm.createContext(ctx);
  for (const f of files) vm.runInContext(src(f), ctx);
  return w;
}
// A Rolls double that records where the numbers came from.
function rolls(values) { const calls = []; let i = 0; const next = () => values[i++ % values.length]; return { calls, rand() { calls.push('rand'); return next(); }, d(n) { calls.push('d' + n); return 1 + Math.floor(next() * n); } }; }

test('no tool rolls with a bare Math.random any more (only the fallback when Rolls is absent)', () => {
  for (const f of ['hazard-tools.js', 'vehicle-tools.js', 'medical-tools.js', 'gm-table.js']) {
    const bare = src(f).split('\n').filter(l => /Math\.random/.test(l) && !/\|\|Math\.random\)/.test(l) && !/^\/\//.test(l) && !/randomUUID/.test(l));
    assert.deepEqual(bare, [], f);
  }
});
test('vehicle tools: the dice are Rolls dice', () => {
  const r = rolls([0.5]), w = load(['vehicle-tools.js'], r);
  const out = w.VehicleTools.check({ ref: 6, skill: 2, modifier: 0, task: 'basic' });
  assert.ok(out);assert.ok(r.calls.length > 0 && r.calls.every(c => c === 'd10'), r.calls.join());
  const before = r.calls.length;w.VehicleTools.dodgeRam({ dex: 6, evasion: 2, modifier: 0 });w.VehicleTools.ramDamage('standard');
  assert.ok(r.calls.length > before);
});
test('without Rolls the vehicle tool still rolls (fallback)', () => {
  const w = {}, ctx = { window: w, Math, console };vm.createContext(ctx);vm.runInContext(src('vehicle-tools.js'), ctx);
  const o = w.VehicleTools.check({ ref: 6, skill: 2, modifier: 0, task: 'basic' });assert.ok(o);
});
test('medical check rolls through Rolls.rand', () => {
  const r = rolls([0.5]), w = load(['crit-injuries.js', 'medical-tools.js'], r);
  const out = w.MedicalTools.check(6, 2, 0, 13);
  assert.ok(out && out.die === 6);assert.ok(r.calls.includes('rand'));
});
test('GM table attack and damage dice come from Rolls.rand', () => {
  const r = rolls([0.5]), w = load(['wallet.js', 'crit-injuries.js', 'combat-tools.js', 'equipment-tools.js', 'damage-apply.js', 'gm-tools.js', 'gm-table.js'], r);
  assert.ok(w.GMTable.rollAttack(10, 0));assert.ok(w.GMTable.rollDamage('2d6'));
  assert.ok(r.calls.length >= 3 && r.calls.every(c => c === 'rand'));
});
test('medical injury names are CritInjuries.ROWS names, read at the moment they are used', () => {
  const w = load(['medical-tools.js'], undefined);
  assert.equal(w.MedicalTools.INJURIES.body[0][1], '?', 'before crit-injuries.js has loaded there is no own copy of the names');
  const ctx2 = { window: w, console };vm.createContext(ctx2);vm.runInContext(src('crit-injuries.js'), ctx2);
  for (const loc of ['body', 'head']) w.MedicalTools.INJURIES[loc].forEach((row, i) => {
    assert.equal(row[0], w.CritInjuries.ROWS[loc][i].ru);assert.equal(row[1], w.CritInjuries.ROWS[loc][i].en);
    assert.ok(row.length === 4, 'quick fix and treatment data are still there');
  });
});
