// "/" focuses the page search field (site/search-key.js).
const { test } = require('node:test'), assert = require('node:assert/strict'), fs = require('node:fs'), vm = require('node:vm');
function load() {
  const w = { matchMedia: () => ({ matches: true }) };
  vm.runInContext(fs.readFileSync(__dirname + '/../site/search-key.js', 'utf8'), vm.createContext({ window: w, String, Array }));
  return w.SearchKey;
}
const field = (over = {}) => ({ nodeType: 1, tagName: 'INPUT', offsetParent: {}, closest: () => null, focused: 0, selected: 0, focus() { this.focused++; }, select() { this.selected++; }, ...over });
const doc = (fields, extra = {}) => ({ activeElement: null, querySelector: () => extra.dialog || null, querySelectorAll: () => fields });
const key = (over = {}) => ({ key: '/', target: { nodeType: 1, tagName: 'BODY' }, prevented: 0, preventDefault() { this.prevented++; }, ...over });

test('"/" focuses the first visible search field and is swallowed', () => {
  const S = load(), hidden = field({ offsetParent: null, getClientRects: () => [] }), a = field(), b = field();
  const e = key();
  assert.equal(S.handle(e, doc([hidden, a, b])), true);
  assert.equal(a.focused, 1); assert.equal(b.focused, 0); assert.equal(hidden.focused, 0); assert.equal(e.prevented, 1);
});

test('nothing happens while typing, with modifiers, with a dialog open or without a field', () => {
  const S = load(), a = field();
  assert.equal(S.handle(key({ target: { nodeType: 1, tagName: 'TEXTAREA' } }), doc([a])), false);
  assert.equal(S.handle(key({ target: { nodeType: 1, tagName: 'DIV', isContentEditable: true } }), doc([a])), false);
  assert.equal(S.handle(key({ ctrlKey: true }), doc([a])), false);
  assert.equal(S.handle(key({ key: 'a' }), doc([a])), false);
  assert.equal(S.handle(key(), doc([a], { dialog: {} })), false);
  assert.equal(S.handle(key(), doc([])), false);
  assert.equal(a.focused, 0);
  const e = key(); S.handle(e, doc([])); assert.equal(e.prevented, 0);
});
