// Role and rank line on the sheet header (site/role-line.js).
const { test } = require('node:test'), assert = require('node:assert/strict'), fs = require('node:fs'), vm = require('node:vm');
function load() {
  const w = {}; w.window = w;
  vm.createContext(w);
  for (const f of ['rules.js', 'role-line.js']) vm.runInContext(fs.readFileSync(__dirname + '/../site/' + f, 'utf8'), w);
  return w.RoleLine;
}

test('one role: name and rank, in both languages', () => {
  const R = load(), c = { role: 'solo', rank: 4 };
  assert.equal(R.text(c, 'ru'), 'Соло, ранг 4');
  assert.equal(R.text(c, 'en'), 'Solo, rank 4');
});

test('a multiclass character gets one short line, the full form stays in the tooltip', () => {
  const R = load(), c = { role: 'solo', rank: 4, extra: { advancement: { primaryRole: 'solo', additionalRoles: [{ role: 'netrunner', rank: '2' }, { role: 'solo', rank: 9 }, null], latestRole: 'netrunner' } } };
  assert.equal(R.text(c, 'ru'), 'Соло 4 · Нетраннер 2');
  assert.match(R.html(c, 'ru'), /title="Соло, ранг 4 · Нетраннер, ранг 2"/);
});

test('old and broken saves do not break the line', () => {
  const R = load();
  assert.equal(R.html(null, 'ru'), '');
  assert.equal(R.html({}, 'ru'), '');
  assert.equal(R.text({ role: 'solo' }, 'ru'), 'Соло');
  assert.equal(R.text({ role: 'solo', rank: 4, extra: { advancement: { additionalRoles: 'x' } } }, 'ru'), 'Соло, ранг 4');
});

test('files are registered', () => {
  const h = fs.readFileSync(__dirname + '/../site/index.html', 'utf8');
  assert.ok(h.includes('role-line.js') && h.includes('role-line.css'));
});
