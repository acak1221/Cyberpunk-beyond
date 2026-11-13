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
  c = fixer({ fixerDv: 0 }); click(RT, c, 'fixer-roll');
  assert.match(c.extra.roleTools.fixer.last, /→ -?\d+$/, 'total only');
  assert.doesNotMatch(c.extra.roleTools.fixer.last, / · (success|failure)/);
});

test('the role hint is short for non-Solo roles', () => {
  const src = read('role-tools.js');
  assert.ok(src.includes('Apply role bonuses, LUCK and other modifiers manually'));
  assert.ok(src.includes("c.role==='solo'?(ru?'Ранг берётся"));
});

test('#/repair preselects the Tech instead of the first character', () => {
  assert.ok(read('repair-tools.js').includes("firstWithRole?.(characters,'tech')||characters[0]"));
});
