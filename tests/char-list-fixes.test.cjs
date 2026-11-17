// Review fixes of the character list: new sheets are not buried, hidden cards are not binned, the menu closes on Escape and outside clicks,
// and the CSS promises (44 px targets, one folder editor entry, a visible tick).
const { test } = require('node:test'), assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path'), vm = require('node:vm');
const base = path.join(__dirname, '..', 'site');
const code = fs.readFileSync(path.join(base, 'char-list.js'), 'utf8');
function load({ storage = {}, cards = [], menus = [] } = {}) {
  const store = { ...storage }, listeners = {};
  const doc = {
    addEventListener: (k, f) => { (listeners[k] ||= []).push(f); },
    querySelector: s => (s === '[data-cl-menu][open]' ? menus[0] || null : null),
    querySelectorAll: s => (s === '[data-character-card]' ? cards.map(c => ({ hidden: !!c.hidden, dataset: { characterCard: c.id }, classList: { toggle() {} } })) : s === '[data-cl-menu][open]' ? menus : []),
  };
  const win = { localStorage: { getItem: k => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); } }, document: doc };
  win.window = win;
  vm.runInNewContext(code, { window: win, JSON, Math, Date, Object, Array, Set, Number, String, console });
  return { C: win.CharList, store, listeners };
}
const plain = x => JSON.parse(JSON.stringify(x));
const click = kind => ({ type: 'click', target: { closest: s => (s === '[data-cl]' ? { getAttribute: () => kind, dataset: { cl: kind }, closest: () => null } : null) } });

test('noteNew: the first draw only learns the list; later a new sheet gets a time that keeps the list order', () => {
  const { C } = load(), l = [{ id: 'n1' }, { id: 'n2' }, { id: 'old' }];
  const first = plain(C.noteNew(l, null, {}, 1000));
  assert.deepEqual(first.known, ['n1', 'n2', 'old']); assert.deepEqual(first.opened, {});
  const next = plain(C.noteNew(l, ['old'], { old: 500 }, 1000));
  assert.equal(next.opened.n1, 1000); assert.equal(next.opened.n2, 999); assert.equal(next.opened.old, 500);
  assert.equal(plain(C.noteNew(l, ['n1', 'n2', 'old'], {}, 1000)).changed, false);
});

test('a copied or imported sheet sorts first under «recently opened», not last', () => {
  const { C, store } = load({ storage: { 'nc-char-known': '["a","b"]', 'nc-char-opened': '{"a":100,"b":50}' } });
  const l = [{ id: 'a', name: 'A' }, { id: 'b', name: 'B' }, { id: 'new', name: 'New' }];
  assert.deepEqual(plain(C.sorted(l, 'en').map(c => c.id)), ['new', 'a', 'b'], 'the sheet that appeared since the last draw is on top');
  assert(JSON.parse(store['nc-char-known']).includes('new'));
  assert.deepEqual(plain(C.sorted(l, 'en').map(c => c.id)), ['new', 'a', 'b'], 'stable on the next draw');
  assert.deepEqual(plain(l.map(c => c.id)), ['a', 'b', 'new'], 'the saved list is untouched');
});

test('«В корзину» only moves what is on screen: a filter that hid ticked cards drops them from the pick', () => {
  const { C } = load({ cards: [{ id: 'a' }, { id: 'b', hidden: true }, { id: 'c' }] });
  C.handle(click('select'), { lang: 'en' });
  for (const id of ['a', 'b', 'c']) C._test.picked.add(id);
  const r = C.handle(click('bin'), { lang: 'en' });
  assert.deepEqual(plain(r.bin).sort(), ['a', 'c']);
  assert.deepEqual(plain(C.pickedIds()).sort(), ['a', 'c']);
});

test('with no cards on the page nothing is dropped (the pick of a list that is not drawn yet)', () => {
  const { C } = load({ cards: [] });
  C.handle(click('select'), { lang: 'en' }); C._test.picked.add('a');
  assert.deepEqual(plain(C.handle(click('bin'), { lang: 'en' }).bin), ['a']);
});

test('the «⋯» menu closes on Escape (focus back on «⋯») and ignores other keys', () => {
  let opened = true, focused = 0;
  const summary = { focus: () => { focused++; } };
  const menu = { removeAttribute: n => { if (n === 'open') opened = false; }, querySelector: s => (s === 'summary' ? summary : null) };
  const { listeners } = load({ menus: [menu] });
  const keydown = listeners.keydown[0];
  keydown({ key: 'a', target: { closest: () => menu } });
  assert.equal(opened, true); assert.equal(focused, 0);
  keydown({ key: 'Escape', target: { closest: () => menu } });
  assert.equal(opened, false); assert.equal(focused, 1);
});

test('an outside click closes every open menu except the one that was pressed', () => {
  const closed = [];
  const m1 = { removeAttribute: () => closed.push('m1') }, m2 = { removeAttribute: () => closed.push('m2') };
  const { listeners } = load({ menus: [m1, m2] });
  listeners.click[0]({ target: { closest: () => null } });
  assert.deepEqual(closed, ['m1', 'm2'], 'a click elsewhere closes both');
  closed.length = 0;
  listeners.click[0]({ target: { closest: () => m1 } });
  assert.deepEqual(closed, ['m2'], 'the pressed menu stays');
});

test('CSS: one folder editor entry per card, visible tick, 44 px targets, a portrait strip in every look', () => {
  const css = fs.readFileSync(path.join(base, 'char-list.css'), 'utf8');
  assert.match(css, /\.cl-card \.char-tags-edit > summary \{ display: none; \}/);
  assert.match(css, /\.cl-pick input:checked \+ span::after/);
  assert.match(css, /\[data-cl-folder-done\][^{]*\{ min-height: 44px; \}/);
  assert.match(css, /\.cl-item \{[^}]*min-height: 44px/); assert.match(css, /\.cl-more \{[^}]*min-height: 44px/);
  assert.match(css, /ui-native \.cl-card \.char-art:not\(:has\(\.char-art-photo\)\) \{ display: block/);
  const tags = fs.readFileSync(path.join(base, 'char-tags.js'), 'utf8');
  assert.match(tags, /manage:'Управление папками'/); assert.match(tags, /manage:'Manage folders'/);
});
