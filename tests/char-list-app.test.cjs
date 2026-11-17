// The list page and the sheet in app.js with char-list.js, char-tags.js and char-todo.js: sorted cards, the bulk bin with one undo,
// the «Дополнить» card on a quick-built sheet and its handlers.
const { test } = require('node:test'), assert = require('node:assert/strict'), fs = require('node:fs'), vm = require('node:vm');
const source = n => fs.readFileSync(__dirname + '/../site/' + n, 'utf8');
const plain = x => JSON.parse(JSON.stringify(x));
function harness({ list = true, todo = true } = {}) {
  const events = {}, saved = [], notices = [], undo = { fn: null }, store = {};
  const button = () => ({ className: '', set textContent(v) { this.label = v; }, addEventListener: (k, f) => { undo.fn = f; } });
  const node = () => ({ innerHTML: '', setAttribute() {}, addEventListener: (k, f) => events[k] = f });
  const nodes = { '#app': node(), '#sync-root': node(), '#sync-adapter-status': node(), '#app-notice': { set textContent(v) { notices.push(v); }, classList: { add() {}, remove() {} }, append() {} } };
  const win = { ROLES: [{ id: 'solo', name: { ru: 'Соло', en: 'Solo' }, description: { ru: '', en: '' } }, { id: 'fixer', name: { ru: 'Решала', en: 'Fixer' }, description: { ru: '', en: '' } }], CombatTools: { handle: () => false }, Book: { handle: () => false }, Campaigns: { handle: () => false }, NetTools: { setScope() {}, validArchitectures: Array.isArray }, RoleTools: new Proxy({ handle: () => ({ handled: false }) }, { get: (t, k) => (k in t ? t[k] : () => '') }), LocalStore: { create() { return { start() {}, getScope: () => 'account', canEdit: () => true, stateLabel: () => 'ok', save: s => { saved.push(JSON.parse(JSON.stringify(s))); } }; } }, scrollTo() {}, localStorage: { getItem: k => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); } } };
  const ctx = { window: win, document: { querySelector: s => nodes[s] || null, querySelectorAll: () => [], createElement: () => button(), addEventListener() {}, documentElement: {} }, localStorage: win.localStorage, globalThis: { crypto: { randomUUID: () => 'x' }, addEventListener() {} }, setTimeout: () => 0, clearTimeout() {}, console, Math, Date, JSON, Set, Number, String, Array, Object, Promise, WeakMap };
  vm.createContext(ctx);
  win.document = ctx.document;
  for (const f of ['character-extra.js', 'equipment-tools.js', 'char-tags.js']) vm.runInContext(source(f), ctx);
  if (list) vm.runInContext(source('char-list.js'), ctx);
  if (todo) vm.runInContext(source('char-todo.js'), ctx);
  vm.runInContext(source('app.js') + '\nconst realRender=render;render=()=>{renders++};let renders=0;window.qa={realRender,renders:()=>renders,set:(c,v,lang)=>{state.characters=c;state.view=v;state.lang=lang||"ru";state.active=null},setActive:id=>{state.active=id},state:()=>state,characters,sheet,builderChoice,save};', ctx);
  const mk = (id, name, over = {}, extra = {}) => ({ id, name, role: 'solo', rank: 4, stats: { INT: 6, REF: 6, DEX: 6, TECH: 6, COOL: 6, WILL: 6, LUCK: 6, MOVE: 6, BODY: 8, EMP: 6 }, skills: { Handgun: 4 }, hp: 27, humanity: 52, head: 7, bodyArmor: 8, extra: { items: [], weapons: [], specializations: [], ipLog: [], uid: id, updatedAt: 1000, ...extra }, ...over });
  const fire = (type, target) => events[type]({ type, target });
  const press = kind => fire('click', { closest: s => (s === '[data-cl]' ? { getAttribute: () => kind, dataset: { cl: kind }, closest: () => null } : null) });
  const pick = (id, checked = true) => fire('change', { matches: s => s === '[data-cl-pick]', getAttribute: () => id, checked });
  return { win, ctx, qa: win.qa, mk, saved, notices, undo, store, press, pick, fire, events };
}

test('the list page draws the new cards sorted by the remembered mode, with the bar above the filter', () => {
  const h = harness();
  const a = h.mk('a', 'Vee'), b = h.mk('b', 'Ash', { rank: 7 }), c = h.mk('c', 'Rook', { role: 'fixer', rank: 2 });
  h.qa.set([a, b, c], 'characters', 'en');
  h.store['nc-char-sort'] = 'name';
  let html = h.qa.characters();
  assert(html.indexOf('data-cl-root') > html.indexOf('class="countbar"') && html.indexOf('data-cl-root') < html.indexOf('data-char-tags-root'));
  const order = () => [...h.qa.characters().matchAll(/<article class="character-card cl-card" data-character-card="(\w)"/g)].map(m => m[1]).join('');
  assert.equal(order(), 'bca', 'by name: Ash, Rook, Vee');
  h.store['nc-char-sort'] = 'rank'; assert.equal(order(), 'bac', 'by rank');
  h.store['nc-char-sort'] = 'role'; assert.equal(order(), 'cba', 'by role name: Fixer before Solo');
  assert.deepEqual(plain(h.qa.state().characters.map(x => x.id)), ['a', 'b', 'c'], 'the saved order of the list is not changed');
  assert.match(html, /data-action="open" data-id="a"/); assert.match(html, /Solo <span> \/ rank 4<\/span>/);
});

test('without the module the page keeps its old cards, with it they carry Open and a menu', () => {
  const bare = harness({ list: false, todo: false }), a = bare.mk('a', 'Vee');
  bare.qa.set([a], 'characters');
  const html = bare.qa.characters();
  assert.match(html, /<article class="character-card" data-character-card="a">/); assert.doesNotMatch(html, /cl-menu|data-cl-root|undefined/);
  const full = harness(); full.qa.set([a], 'characters');
  const f = full.qa.characters();
  assert.match(f, /data-cl-menu/); assert.match(f, /data-action="delete-card"/);
  assert(f.indexOf('data-action="open"') < f.indexOf('data-cl-menu') && f.indexOf('data-cl-menu') < f.indexOf('data-action="delete-card"'));
});

test('bulk bin: several sheets leave together, one notice, one undo brings them all back to their places', () => {
  const h = harness();
  const l = [h.mk('a', 'A'), h.mk('b', 'B'), h.mk('c', 'C'), h.mk('d', 'D')];
  h.qa.set(l, 'characters', 'en'); h.qa.save();
  h.press('select'); h.pick('b'); h.pick('d');
  h.press('bin');
  const s = h.qa.state();
  assert.deepEqual(plain(s.characters.map(x => x.id)), ['a', 'c']);
  assert.equal(s.bin.length, 2, 'both are in the bin');
  assert.equal(h.notices.at(-1), 'Moved to the bin: 2.');
  assert.equal(h.ctx.window.CharList.isSelecting(), false, 'the selecting mode ends');
  assert.equal(h.saved.at(-1).characters.length, 2, 'saved');
  assert.equal(typeof h.undo.fn, 'function', 'the notice has an undo button');
  h.undo.fn();
  assert.deepEqual(plain(s.characters.map(x => x.id)), ['a', 'b', 'c', 'd'], 'back where they were');
  assert.equal(s.bin.length, 0);
  assert.equal(h.notices.at(-1), 'Characters restored: 2.');
});

test('bulk bin: an empty or stale pick does nothing harmful and Russian text is used', () => {
  const h = harness();
  h.qa.set([h.mk('a', 'A')], 'characters', 'ru'); h.press('select'); h.press('bin');
  assert.equal(h.qa.state().characters.length, 1, 'nothing picked, nothing binned');
  h.pick('ghost'); h.press('bin');
  assert.equal(h.qa.state().characters.length, 1, 'an id that is not in the list is skipped');
  h.press('select'); h.pick('a'); h.press('bin');
  assert.equal(h.notices.at(-1), 'В корзину перемещено: 1.');
});

test('selecting ends when the list page is left', () => {
  const h = harness();
  h.qa.set([h.mk('a', 'A')], 'characters'); h.press('select'); assert.equal(h.ctx.window.CharList.isSelecting(), true);
  h.qa.set([h.mk('a', 'A')], 'overview'); h.qa.realRender();
  assert.equal(h.ctx.window.CharList.isSelecting(), false);
});

test('opening a sheet is remembered for «Недавно открытые»', () => {
  const h = harness();
  const a = h.mk('a', 'A'), b = h.mk('b', 'B');
  h.qa.set([a, b], 'sheet'); h.qa.setActive('b');
  try { h.qa.sheet(b); } catch {}
  assert('b' in JSON.parse(h.store['nc-char-opened'] || '{}'));
});

test('the creation choice compares the three methods and keeps the actions', () => {
  const h = harness(), ru = (h.qa.set([], 'builder-choice', 'ru'), h.qa.builderChoice()), en = (h.qa.set([], 'builder-choice', 'en'), h.qa.builderChoice());
  for (const m of ['streetrat', 'edgerunner', 'complete']) { assert.match(ru, new RegExp(`data-action="start-builder" data-method="${m}"`)); assert.match(en, new RegExp(`data-action="start-builder" data-method="${m}"`)); }
  assert.equal((ru.match(/<dl>/g) || []).length, 3); assert.match(ru, /Для первого раза/); assert.match(en, /For a first time/);
  assert.match(ru, /Характеристики/); assert.match(en, /Starter kit/); assert.match(ru, /data-action="new-blank"/);
  assert.doesNotMatch(ru + en, /undefined|NaN/);
});

test('the checklist card sits on a quick-built sheet and not on others', () => {
  const h = harness();
  const q = h.mk('q', 'Case', { native: '' }, { startingPack: { method: 'streetrat', role: 'solo' } }), p = h.mk('p', 'Plain');
  h.qa.set([q, p], 'sheet', 'en'); h.qa.setActive('q');
  const html = h.qa.sheet(q);
  assert.match(html, /data-todo-root/); assert.match(html, /data-todo-input="native"/);
  assert(html.indexOf('data-todo-root') < html.indexOf('class="sheet-layout"'), 'above the sheet');
  assert.doesNotMatch(h.qa.sheet(p), /data-todo-root/);
  const bare = harness({ todo: false }); bare.qa.set([q], 'sheet'); bare.qa.setActive('q');
  assert.doesNotMatch(bare.qa.sheet(q), /data-todo|undefined/);
});

test('the checklist handlers save the native language, hide the card and open Lifepath', () => {
  const h = harness();
  const q = h.mk('q', 'Case', { native: '' }, { startingPack: { method: 'streetrat', role: 'solo' } });
  h.qa.set([q], 'sheet', 'en'); h.qa.setActive('q'); h.qa.save();
  const root = value => ({ querySelector: () => ({ value }), querySelectorAll: () => [] });
  const press = (kind, value = '') => h.fire('click', { closest: s => (s === '[data-todo]' ? { getAttribute: () => kind, dataset: { todo: kind }, closest: () => root(value) } : null) });
  const before = h.saved.length, renders = h.qa.renders();
  press('native', '   ');
  assert.equal(q.native, ''); assert.equal(h.saved.length, before, 'an empty value saves nothing'); assert.equal(h.notices.at(-1), 'Enter some text.');
  press('native', 'Russian');
  assert.equal(q.native, 'Russian'); assert(h.saved.length > before); assert(h.qa.renders() > renders, 'redrawn'); assert.equal(h.notices.at(-1), 'Saved.');
  press('hide'); assert.equal(q.extra.todoHidden, true);
  h.qa.set([q], 'sheet', 'en'); h.qa.setActive('q');
  assert.doesNotMatch(h.qa.sheet(q), /data-todo-root/, 'hidden stays hidden');
  press('life'); assert.equal(h.qa.state().view, 'lifepath');
});

test('bulk bin: the sheet that was open is closed when it is binned', () => {
  const h = harness();
  h.qa.set([h.mk('a', 'A'), h.mk('b', 'B')], 'characters', 'en'); h.qa.save();
  h.qa.setActive('b');
  h.press('select'); h.pick('b'); h.press('bin');
  assert.equal(h.qa.state().active, null, 'no binned sheet stays open');
});
