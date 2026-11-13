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

test('files are registered before app.js', () => {
  const h = fs.readFileSync(__dirname + '/../site/index.html', 'utf8');
  assert.ok(h.indexOf('sheet-sticky.js') > 0 && h.indexOf('sheet-sticky.js') < h.indexOf('<script src="app.js">'));
  assert.ok(h.includes('sheet-sticky.css'));
});
