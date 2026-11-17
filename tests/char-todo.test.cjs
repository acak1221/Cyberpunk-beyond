// The «Дополнить» checklist (char-todo.js) and its link to the quick builder: the native language and the specialization names wait.
const { test } = require('node:test'), assert = require('node:assert/strict'), fs = require('node:fs'), vm = require('node:vm'), path = require('node:path');
const base = path.join(__dirname, '..', 'site');
const read = f => fs.readFileSync(path.join(base, f), 'utf8');
function load() {
  const win = { document: { addEventListener() {}, querySelector: () => null } };
  win.window = win;
  const ctx = { window: win, console, JSON, Math, Date, Object, Array, Set, Number, String };
  vm.createContext(ctx);
  vm.runInContext(read('archetypes.js'), ctx);
  vm.runInContext(read('char-todo.js'), ctx);
  return win;
}
const W = load(), T = W.CharTodo;
const plain = x => JSON.parse(JSON.stringify(x));
const quick = (over = {}, extra = {}) => ({ id: 'q', name: 'Case', role: 'medtech', native: '', extra: { startingPack: { method: 'streetrat', role: 'medtech' }, specializations: [], ...extra }, ...over });

test('a sheet that was not quick-built has no checklist', () => {
  assert.deepEqual(plain(T.items({ id: 'p', name: 'P', role: 'solo', native: '', extra: {} })), []);
  assert.equal(T.html({ id: 'p', extra: {} }, 'en'), '');
  assert.deepEqual(plain(T.items(null)), []); assert.deepEqual(plain(T.items({ extra: 'x' })), []);
});

test('the open items: native language, bare specializations, Lifepath; in that order', () => {
  const tpl = W.Archetypes.getTemplate('medtech'), skill = tpl.streetratSkills.find(s => s.needsSpecialty).name;
  const c = quick({}, { specializations: [{ id: 's1', name: skill, level: 2 }, { id: 's2', name: 'Other (named)', level: 1 }] });
  assert.deepEqual(plain(T.items(c)).map(i => i.id), ['native', 'spec', 'life']);
  assert.equal(T.items(c)[1].specId, 's1');
  c.native = 'Русский'; c.extra.specializations[0].name = skill + ' (Biology)'; c.extra.life = { culture: { roll: 3 } };
  assert.deepEqual(plain(T.items(c)), [], 'all done: the card goes away');
  c.extra.life = {}; assert.deepEqual(plain(T.items(c)).map(i => i.id), ['life'], 'an empty life object is not a Lifepath');
  assert.deepEqual(plain(T.items({ ...c, extra: { ...c.extra, todoHidden: true } })), [], 'hidden');
  assert.deepEqual(plain(T.items({ ...c, extra: { ...c.extra, todoHidden: 'yes' } })).map(i => i.id), ['life'], 'only true hides');
});

test('the card has labelled fields, a heading and works in both languages', () => {
  const c = quick();
  for (const lang of ['ru', 'en']) {
    const html = T.html(c, lang);
    assert.match(html, /<section class="card char-todo" data-todo-root tabindex="-1" aria-labelledby="char-todo-head">/);
    assert.match(html, /<label for="todo-native">/); assert.match(html, /<input id="todo-native" data-todo-input="native"/);
    assert.match(html, /data-todo="life"/); assert.match(html, /data-todo="hide"/); assert.doesNotMatch(html, /undefined|NaN/);
  }
  assert.match(T.html(c, 'ru'), /Родной язык/); assert.match(T.html(c, 'en'), /Native language/);
});

test('the names of the player are escaped', () => {
  const tpl = W.Archetypes.getTemplate('medtech'), skill = tpl.streetratSkills.find(s => s.needsSpecialty).name;
  const html = T.html(quick({}, { specializations: [{ id: '"><x>', name: skill, level: 2 }] }), 'en');
  assert.doesNotMatch(html, /"><x>/); assert.match(html, /data-todo-spec="&quot;&gt;&lt;x&gt;"/);
});

const press = (kind, root, attrs = {}) => ({ type: 'click', target: { closest: s => (s === '[data-todo]' ? { getAttribute: k => (k === 'data-todo' ? kind : attrs[k]), dataset: { todo: kind }, closest: () => root } : null) } });
const field = (value, attrs = {}) => ({ value, getAttribute: k => attrs[k] });

test('saving the native language trims, cuts, asks for a redraw and focuses the list', () => {
  const c = quick();
  let r = T.handle(press('native', { querySelector: () => field('  English   ') }), c, 'en', { isCurrent: () => true });
  assert.equal(c.native, 'English'); assert.equal(r.dirty, true); assert.equal(r.rerender, true); assert.equal(r.focus, '[data-todo-input]'); assert.equal(r.notify, 'Saved.');
  r = T.handle(press('native', { querySelector: () => field('x'.repeat(300)) }), c, 'en', { isCurrent: () => true });
  assert.equal(c.native.length, 100);
  r = T.handle(press('native', { querySelector: () => field('   ') }), c, 'ru', { isCurrent: () => true });
  assert.equal(r.dirty, undefined); assert.equal(r.notify, 'Введите текст.'); assert.equal(c.native.length, 100, 'blank input keeps the old value');
  assert.equal(r.focus, '[data-todo-input="native"]');
});

test('saving a specialization renames only the waiting record and keeps its level', () => {
  const skill = W.Archetypes.getTemplate('medtech').streetratSkills.find(s => s.needsSpecialty).name;
  const c = quick({}, { specializations: [{ id: 's1', name: skill, level: 3, stat: 'INT', cost: 2 }] });
  const root = { querySelectorAll: () => [field('Surgery', { 'data-todo-spec': 's1' })] };
  const r = T.handle(press('spec', root, { 'data-todo-spec': 's1' }), c, 'en', { isCurrent: () => true });
  assert.equal(r.dirty, true); assert.equal(c.extra.specializations[0].name, skill + ' (Surgery)'); assert.equal(c.extra.specializations[0].level, 3);
  const again = T.handle(press('spec', root, { 'data-todo-spec': 's1' }), c, 'en', { isCurrent: () => true });
  assert.equal(again.dirty, undefined, 'a second press does not stack a second name'); assert.equal(c.extra.specializations[0].name, skill + ' (Surgery)');
  const none = T.handle(press('spec', root, { 'data-todo-spec': 'gone' }), c, 'en', { isCurrent: () => true });
  assert.equal(none.dirty, undefined);
});

test('a stale page writes nothing; hide sets the flag; Lifepath only navigates', () => {
  const c = quick();
  const stale = T.handle(press('native', { querySelector: () => field('English') }), c, 'en', { isCurrent: () => false });
  assert.equal(c.native, ''); assert.equal(stale.dirty, undefined); assert.equal(stale.notify, 'The data changed. Try again.');
  const hide = T.handle(press('hide', null), c, 'ru', { isCurrent: () => true });
  assert.equal(c.extra.todoHidden, true); assert.equal(hide.dirty, true); assert.equal(hide.rerender, true);
  const life = T.handle(press('life', null), c, 'ru', {});
  assert.equal(life.navigate, 'lifepath'); assert.equal(life.dirty, undefined);
  assert.equal(T.handle({ type: 'click', target: { closest: () => null } }, c, 'en', {}).handled, false);
  assert.equal(T.handle({ type: 'input', target: {} }, c, 'en', {}).handled, false);
});

test('strings: same keys in both languages, Russian is formal', () => {
  assert.deepEqual(Object.keys(T.T.ru).sort(), Object.keys(T.T.en).sort());
  for (const [k, v] of Object.entries(T.T.ru)) { assert.ok(/[а-яёa-z]/i.test(v), k); assert.doesNotMatch(v, /(^|[^а-яё])(ты|тебя|тебе|твой|впиши|введи|нажми)([^а-яё]|$)/i, k); }
});

test('the sample character of the first run has no checklist, and the card shows one item with the rest folded', () => {
  assert.deepEqual(plain(T.items(quick({}, { sample: true }))), []);
  const html = T.html(quick(), 'en');
  assert.match(html, /<details class="char-todo-more">/);
  assert(html.indexOf('char-todo-more') > html.indexOf('todo-native'), 'the first item is outside the fold');
  assert(html.indexOf('data-todo="life"') > html.indexOf('char-todo-more'), 'the later items are inside it');
  assert.doesNotMatch(T.html(quick({ native: 'x' }, { life: { a: 1 } }), 'en'), /char-todo-more/);
});
