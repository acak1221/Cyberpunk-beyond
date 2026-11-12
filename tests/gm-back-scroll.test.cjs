// «Back» from a sheet opened on a campaign page returns to the same scroll position (site/gm-table.js).
const { test } = require('node:test'), assert = require('node:assert/strict'), fs = require('node:fs'), vm = require('node:vm');

function setup() {
  let click = null; const scrolls = [], timers = [];
  const win = { scrollY: 640, scrollTo: o => scrolls.push(o) };
  const document = { addEventListener: (t, f, cap) => { if (t === 'click' && cap) click = f; }, body: {}, createElement: () => ({}) };
  const ctx = { window: win, document, console, navigator: {}, setTimeout: f => timers.push(f) };
  win.window = win;
  vm.createContext(ctx);
  for (const f of ['wallet.js', 'combat-tools.js', 'equipment-tools.js', 'damage-apply.js', 'gm-tools.js', 'gm-table.js']) vm.runInContext(fs.readFileSync(__dirname + '/../site/' + f, 'utf8'), ctx);
  const target = sel => ({ closest: s => s.split(',').map(x => x.trim()).includes(sel) ? { dataset: { id: 'v1', view: 'campaigns' } } : null });
  return { win, scrolls, timers, click: sel => click({ target: target(sel) }) };
}

test('the sheet remembers where the tracker was and scrolls back there', () => {
  const s = setup();
  s.click('.camp-open[data-action="open"]');
  s.win.scrollY = 0; // the sheet is shown at the top
  s.click('.sheet-top .back-link[data-view="campaigns"]');
  s.timers.forEach(f => f());
  assert.ok(s.scrolls.length >= 1);
  assert.ok(s.scrolls.every(o => o.top === 640 && o.behavior === 'instant'));
});

test('a sheet opened from the characters list does not scroll anything on «Back»', () => {
  const s = setup();
  s.click('.sheet-top .back-link[data-view="campaigns"]');
  s.timers.forEach(f => f());
  assert.equal(s.scrolls.length, 0);
});
