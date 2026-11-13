// Sheet scrolling helpers (site/sheet-sticky.js): pure rules and registration.
const { test } = require('node:test'), assert = require('node:assert/strict'), fs = require('node:fs'), vm = require('node:vm');
function load() {
  const w = {}; w.window = w; // no document: only the pure part is exported
  vm.createContext(w); vm.runInContext(fs.readFileSync(__dirname + '/../site/sheet-sticky.js', 'utf8'), w);
  return w.SheetSticky;
}

test('the header turns compact after a short scroll and relaxes near the top', () => {
  const S = load();
  assert.equal(S.compactState(100, false), false);
  assert.equal(S.compactState(200, false), true);
  assert.equal(S.compactState(100, true), true);
  assert.equal(S.compactState(10, true), false);
});

test('the Top button appears after two screens', () => {
  const S = load();
  assert.equal(S.showTop(1000, 800), false);
  assert.equal(S.showTop(1700, 800), true);
  assert.equal(S.showTop(5000, 0), false);
});

test('the wide pinned strip carries the turn marker of the HUD', () => {
  const js = fs.readFileSync(__dirname + '/../site/sheet-sticky.js', 'utf8'), css = fs.readFileSync(__dirname + '/../site/sheet-sticky.css', 'utf8');
  assert.ok(js.includes('[data-room-turn]:not([hidden])'));
  assert.ok(css.includes('.sheet-pin .hud-turn'));
});

test('the compact HUD hides chips that do not fit whole and the Top button leaves room under the footer', () => {
  const js = fs.readFileSync(__dirname + '/../site/sheet-sticky.js', 'utf8'), css = fs.readFileSync(__dirname + '/../site/sheet-sticky.css', 'utf8');
  assert.ok(js.includes('function fitHud') && js.includes("'hud-cut'"));
  assert.ok(css.includes('.sheet-hud > .hud-cut { display: none; }'));
  assert.ok(/\.sheet-dock\) \.footer \{ padding-bottom/.test(css));
});

test('layout fixes: the DV ladder turns on its side on a phone, the wide skills caption is shorter', () => {
  const ref = fs.readFileSync(__dirname + '/../site/reference-tools.css', 'utf8'), board = fs.readFileSync(__dirname + '/../site/board.css', 'utf8');
  assert.ok(ref.includes('grid-auto-flow:column') && ref.includes('.sr-dv thead,.skill-reference .sr-dv tbody'));
  assert.ok(board.includes('#sheet-skills .skill-row small { text-transform: none;'));
});

test('files are registered before app.js', () => {
  const h = fs.readFileSync(__dirname + '/../site/index.html', 'utf8');
  assert.ok(h.indexOf('sheet-sticky.js') > 0 && h.indexOf('sheet-sticky.js') < h.indexOf('<script src="app.js">'));
  assert.ok(h.includes('sheet-sticky.css'));
});
