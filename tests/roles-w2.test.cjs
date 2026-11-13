// Wave 2 role-area fixes: roll without a DV, short role hint, Tech preselected on #/repair.
const { test } = require('node:test'), assert = require('node:assert/strict'), fs = require('node:fs'), vm = require('node:vm');
const read = name => fs.readFileSync(__dirname + '/../site/' + name, 'utf8');
function tools() {
  const w = { confirm: () => true }, ctx = { window: w, globalThis: {}, console, Math, JSON, Set, Map, Number, String, Array, Object, Date };
  vm.createContext(ctx); vm.runInContext(read('role-tools.js'), ctx); return w.RoleTools;
}
const click = (RT, c, action) => RT.handle({ type: 'click', target: { closest: sel => sel === '[data-rt-action]' ? { dataset: { rtAction: action } } : null, hasAttribute: () => false, dataset: {} } }, c, 'en', { isCurrent: () => true });
const fixer = values => ({ id: 'f', role: 'fixer', rank: 4, hp: 35, stats: { COOL: 6, BODY: 8, WILL: 6 }, skills: { Trading: 4 }, extra: { roleTools: { fixer: { values, team: [] } } } });

test('haggle with a DV shows a verdict, without a DV only the total', () => {
  const RT = tools();
  let c = fixer({ fixerDv: 10 }); click(RT, c, 'fixer-roll');
  assert.match(c.extra.roleTools.fixer.last, /[>≤] 10 · (success|failure)/);
  c = fixer({ fixerDv: null }); click(RT, c, 'fixer-roll');
  assert.match(c.extra.roleTools.fixer.last, /→ -?\d+$/, 'total only');
  assert.doesNotMatch(c.extra.roleTools.fixer.last, / · (success|failure)/);
});

test('the role hint is short for non-Solo roles and long for Solo', () => {
  const RT = tools(), help = c => (RT.render(c, 'en').match(/class="rt-help"[^>]*>(.*?)<\/p>/) || [])[1] || '';
  const mk = role => ({ id: role, role, rank: 4, hp: 35, stats: { COOL: 6 }, skills: {}, extra: {} });
  assert.match(help(mk('fixer')), /Apply role bonuses, LUCK and other modifiers manually/);
  assert.match(help(mk('solo')), /except for explicitly enabled/);
  assert.notEqual(help(mk('fixer')), help(mk('solo')));
});

test('#/repair preselects the Tech instead of the first character', () => {
  const w = { confirm: () => true, addEventListener() {} }, ctx = { window: w, globalThis: {}, console, Math, JSON, Set, Map, Number, String, Array, Object, Date, document: {} };
  vm.createContext(ctx); vm.runInContext(read('role-play.js'), ctx); vm.runInContext(read('repair-tools.js'), ctx);
  const mk = (id, role) => ({ id, role, rank: 4, hp: 35, name: id, stats: { TECH: 6 }, skills: {}, extra: {} });
  w.RepairTools.setScope('t1');
  const html = w.RepairTools.render({ lang: 'en', characters: [mk('solo1', 'solo'), mk('tech1', 'tech')] });
  assert.match(html, /<option[^>]*value="tech1"[^>]*selected|<option[^>]*selected[^>]*value="tech1"/);
  assert.doesNotMatch(html, /value="solo1"[^>]*selected/);
});

test('a cleared DV means no DV, but 0 or a negative opposing result still gets a verdict', () => {
  const RT = tools();
  let c = fixer({ fixerDv: -7 }); click(RT, c, 'fixer-roll');
  assert.match(c.extra.roleTools.fixer.last, /> -7 · (success|failure)|≤ -7 · (success|failure)/);
  c = fixer({ fixerDv: 0 }); click(RT, c, 'fixer-roll');
  assert.match(c.extra.roleTools.fixer.last, / · (success|failure)/);
  c = fixer({ fixerDv: null }); click(RT, c, 'fixer-roll');
  assert.doesNotMatch(c.extra.roleTools.fixer.last, / · (success|failure)/);
});

test('clearing the DV field stores null and the field shows empty', () => {
  const RT = tools(), c = fixer({ fixerDv: 12 });
  RT.handle({ type: 'input', target: { value: '', dataset: { rtField: 'fixerDv' }, hasAttribute: a => a === 'data-rt-field', closest: () => null } }, c, 'en', { isCurrent: () => true });
  assert.equal(c.extra.roleTools.fixer.values.fixerDv, null);
  assert.match(RT.render(c, 'en'), /data-rt-field="fixerDv"[^>]*value=""/);
});

test('Medtech cannot tick more drugs than Pharmaceuticals points', () => {
  const RT = tools();
  const med = { id: 'm', role: 'medtech', rank: 4, hp: 35, stats: {}, skills: {}, extra: { roleTools: { medtech: { values: { pharma: 1 }, team: [] } } } };
  const tick = key => RT.handle({ type: 'change', target: { checked: true, value: 'on', dataset: { rtField: key }, hasAttribute: a => a === 'data-rt-field', closest: () => null } }, med, 'en', { isCurrent: () => true });
  assert.equal(tick('drug-antibiotic').notify, undefined);
  const r = tick('drug-stim');
  assert.match(r.notify, /already learned/);
  assert.ok(!med.extra.roleTools.medtech.values['drug-stim']);
  assert.equal(med.extra.roleTools.medtech.values['drug-antibiotic'], true);
});
