// The player's fight on the sheet (site/play-combat.js): pure rules and the small DOM helpers.
const { test } = require('node:test'), assert = require('node:assert/strict'), fs = require('node:fs'), vm = require('node:vm');
const read = name => fs.readFileSync(__dirname + '/../site/' + name, 'utf8');
const plain = value => JSON.parse(JSON.stringify(value));

function load(extra = {}) {
  const w = { ...extra }, ctx = { window: w, console, Math, JSON, Set, Map, Number, String, Array, Object, Date };
  vm.createContext(ctx);
  vm.runInContext(read('play-combat.js'), ctx);
  return w;
}
const PC = load().PlayCombat;

test('the module is registered before app.js and its stylesheet is linked', () => {
  const index = read('index.html');
  assert.ok(index.indexOf('<script src="play-combat.js"></script>') > 0);
  assert.ok(index.indexOf('<script src="play-combat.js"></script>') < index.indexOf('<script src="app.js"></script>'));
  assert.ok(index.includes('<link rel="stylesheet" href="play-combat.css">'));
});

test('keeping the place: a control is found again by tag, data-attributes and its number among equals', () => {
  const el = { tagName: 'BUTTON', id: '', attributes: [{ name: 'class', value: 'cx-button' }, { name: 'data-cx-action', value: 'attack' }, { name: 'data-cx-index', value: '1' }], getAttribute: () => null };
  const root = { querySelectorAll: sel => { assert.equal(sel, 'button[data-cx-action="attack"][data-cx-index="1"]'); return [{}, el]; } };
  assert.deepEqual(plain(PC.markOf(el, root)), { sel: 'button[data-cx-action="attack"][data-cx-index="1"]', index: 1 });
  assert.equal(PC.markOf({ tagName: 'DIV', attributes: [], getAttribute: () => null }, root), null, 'nothing to find it by');
  assert.equal(PC.markOf({ tagName: 'INPUT', id: 'a"b', attributes: [], getAttribute: () => null }, { querySelectorAll: () => [] }).sel, 'input[id="a\\"b"]');
});

test('keeping the place: the page moves by exactly what the control moved', () => {
  assert.equal(PC.scrollFix(402, -344), -746);
  assert.equal(PC.scrollFix(402, 402.4), 0);
  assert.equal(PC.scrollFix(100, 206), 106);
});

test('keeping the place: the app asks for it around every redraw, and the sheet turns browser anchoring off', () => {
  const app = read('app.js');
  assert.ok(app.includes("const kept=window.PlayCombat?.keepPlace?.(state.view+'|'+(state.view==='sheet'?state.active:''));renderView();"));
  assert.ok(app.includes('kept?.();'));
  assert.match(read('play-combat.css'), /body:has\(\.sheet-layout\)\{overflow-anchor:none\}/);
});

test('keeping the place: a new screen is navigation and is left alone; the same screen is restored', () => {
  const calls = [];
  let top = 400;
  const button = { tagName: 'BUTTON', id: 'go', isConnected: true, attributes: [], getAttribute: () => null, getClientRects: () => [1], getBoundingClientRect: () => ({ top }), closest: () => button };
  const listeners = {};
  const body = { querySelectorAll: () => [button] };
  const w = load({ scrollY: 900, scrollBy: (x, y) => { calls.push(['by', y]); w.scrollY += y; }, scrollTo: (x, y) => { calls.push(['to', y]); w.scrollY = y; }, document: { body, querySelector: () => null, addEventListener: (type, fn) => { listeners[type] = fn; } } });
  listeners.click({ target: button });
  assert.equal(w.PlayCombat.keepPlace('sheet|a'), null, 'first draw of a screen');
  const after = w.PlayCombat.keepPlace('sheet|a'); assert.equal(typeof after, 'function');
  top = -346; after();
  assert.deepEqual(calls, [['by', -746]]); assert.equal(w.scrollY, 154);
  assert.equal(w.PlayCombat.keepPlace('combat|'), null, 'another screen');
});
