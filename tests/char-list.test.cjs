// The character list (char-list.js): sort, remembered per device, the card, the «⋯» menu and the selecting mode.
const { test } = require('node:test'), assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path'), vm = require('node:vm');
const source = fs.readFileSync(path.join(__dirname, '..', 'site', 'char-list.js'), 'utf8');
function load({ storage = {}, broken = false, cards = [] } = {}) {
  const store = { ...storage };
  const el = (id, over = {}) => ({ hidden: false, dataset: { characterCard: id }, classList: { toggle() {} }, ...over });
  const win = {
    CardInfo: { wound: (hp, max) => (hp < 1 ? 'mortal' : hp < Math.ceil(max / 2) ? 'serious' : hp < max ? 'light' : 'full'), html: () => '<span class="char-money">€$ <strong>500 eb</strong></span>' },
    localStorage: broken ? { getItem() { throw new Error('blocked'); }, setItem() { throw new Error('blocked'); } } : { getItem: k => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); } },
    document: { addEventListener() {}, querySelector: () => null, querySelectorAll: () => cards.map(c => el(c.id, c)) },
  };
  win.window = win;
  vm.runInNewContext(source, { window: win, JSON, Math, Date, Object, Array, Set, Number, String, console });
  return { C: win.CharList, store, win };
}
const plain = x => JSON.parse(JSON.stringify(x));
const ch = (id, name, role, rank, hp = 20) => ({ id, name, role, rank, hp, humanity: 40, extra: {} });
const click = (kind, extra = {}) => ({ type: 'click', target: { closest: s => (s === '[data-cl]' ? { getAttribute: () => kind, dataset: { cl: kind }, closest: () => null, ...extra } : null) } });
const change = (attrs, extra = {}) => ({ type: 'change', target: { matches: s => Object.keys(attrs).some(k => s === `[${k}]`), getAttribute: k => attrs[k], ...extra } });
const list = () => [ch('a', 'Vee', 'solo', 4), ch('b', 'rook', 'netrunner', 6), ch('c', 'Ash', 'fixer', 4), ch('d', 'Zed', 'solo', 7)];

test('sort: name, role, rank and last opened; a new array each time and ties keep the list order', () => {
  const { C } = load(), l = list(), names = a => a.map(c => c.name).join(',');
  assert.equal(names(C.sortList(l, 'name', {}, 'en')), 'Ash,rook,Vee,Zed', 'names ignore case');
  assert.equal(names(C.sortList(l, 'rank', {}, 'en')), 'Zed,rook,Ash,Vee', 'highest rank first, ties by name');
  assert.equal(names(C.sortList(l, 'role', {}, 'en', c => c.role)), 'Ash,rook,Vee,Zed', 'fixer, netrunner, solo, solo');
  assert.equal(names(C.sortList(l, 'opened', { c: 30, a: 10 }, 'en')), 'Ash,Vee,rook,Zed', 'opened ones first (latest first), the rest in list order');
  assert.equal(names(l), 'Vee,rook,Ash,Zed', 'the original list is untouched');
  assert.notEqual(C.sortList(l, 'name', {}, 'en'), l);
  assert.equal(names(C.sortList(l, 'nonsense', {}, 'en')), 'Vee,rook,Ash,Zed', 'an unknown mode falls back to last opened');
  assert.deepEqual(plain(C.sortList(null, 'name', {}, 'en')), []);
  assert.deepEqual(plain(C.sortList([null, 5, ch('x', 'X', 'solo', 1)], 'name', {}, 'en').map(c => c.id)), ['x']);
});

test('Russian names sort by the Russian alphabet', () => {
  const { C } = load();
  const l = [ch('1', 'Яна', 'solo', 1), ch('2', 'Артём', 'solo', 1), ch('3', 'Борис', 'solo', 1)];
  assert.deepEqual(plain(C.sortList(l, 'name', {}, 'ru').map(c => c.name)), ['Артём', 'Борис', 'Яна']);
});

test('the sort is remembered on this device and survives a blocked storage', () => {
  const a = load();
  assert.equal(a.C.sortMode(), 'opened', 'the default');
  assert.equal(a.C.setSortMode('rank'), true);
  assert.equal(a.store['nc-char-sort'], 'rank');
  assert.equal(load({ storage: a.store }).C.sortMode(), 'rank', 'a new page reads it back');
  assert.equal(a.C.setSortMode('bogus'), false);
  assert.equal(load({ storage: { 'nc-char-sort': '<script>' } }).C.sortMode(), 'opened', 'a bad value is ignored');
  const b = load({ broken: true });
  assert.equal(b.C.sortMode(), 'opened'); assert.equal(b.C.setSortMode('name'), false);
  assert.doesNotThrow(() => b.C.touch('a')); assert.deepEqual(JSON.parse(JSON.stringify(b.C.openedMap())), {});
});

test('opening a sheet is remembered per device, throttled, capped and validated', () => {
  const { C, store } = load();
  assert.equal(C.touch('a', 1000), true);
  assert.equal(C.touch('a', 2000), false, 'the same sheet within half a minute is not written again');
  assert.equal(C.touch('a', 40000), true);
  assert.equal(JSON.parse(store['nc-char-opened']).a, 40000);
  assert.equal(C.touch('', 1), false); assert.equal(C.touch(5, 1), false); assert.equal(C.touch('x'.repeat(200), 1), false);
  for (let i = 0; i < 450; i++) { C.touch('id' + i, 100000 + i * 40000); }
  const kept = JSON.parse(store['nc-char-opened']);
  assert(Object.keys(kept).length <= 400, 'the memory stays small'); assert('id449' in kept); assert(!('id0' in kept), 'the oldest go first');
  const h = load({ storage: { 'nc-char-opened': JSON.stringify({ ok: 5, bad: 'x', neg: -4, nan: null }) } });
  assert.deepEqual(JSON.parse(JSON.stringify(h.C.openedMap())), { ok: 5 });
  assert.deepEqual(JSON.parse(JSON.stringify(load({ storage: { 'nc-char-opened': '[1,2]' } }).C.openedMap())), {});
});

test('hp bar percent is clamped and safe', () => {
  const { C } = load();
  assert.equal(C.hpPercent(15, 30), 50); assert.equal(C.hpPercent(40, 30), 100); assert.equal(C.hpPercent(-3, 30), 0);
  assert.equal(C.hpPercent(5, 0), 0); assert.equal(C.hpPercent('x', 'y'), 0);
});

test('the card: Open is the main action; copy, folder and delete are in the menu; names are escaped', () => {
  const { C } = load();
  const c = ch('a"b', '<img onerror=x>', 'solo', 4, 12);
  const html = C.card(c, { lang: 'en', roleName: 'Solo', hpMax: 30, portrait: '', extra: '<div data-char-tags-card="a"></div>' });
  assert.doesNotMatch(html, /<img onerror/); assert.match(html, /&lt;img onerror=x&gt;/); assert.match(html, /data-character-card="a&quot;b"/);
  assert.match(html, /class="cl-hp" data-wound="serious" role="img" aria-label="HP 12 of 30"/); assert.match(html, /width:40%/);
  assert.match(html, /Solo <span> \/ rank 4<\/span>/); assert.match(html, /500 eb/);
  const open = html.indexOf('data-action="open"'), menu = html.indexOf('data-cl-menu'), del = html.indexOf('data-action="delete-card"');
  assert(open > 0 && menu > open && del > menu, 'Open comes first and Delete only inside the menu');
  assert.match(html, /<summary class="cl-more" aria-label="More actions: &lt;img onerror=x&gt;">/);
  assert.match(html, /data-action="duplicate"/); assert.match(html, /data-cl="folder"/);
  const panel = html.slice(menu, html.indexOf('</details>', menu));
  assert(panel.indexOf('duplicate') < panel.indexOf('data-cl="folder"') && panel.indexOf('data-cl="folder"') < panel.indexOf('delete-card'), 'delete is the last item');
  assert.match(html, /data-char-tags-card="a"/, 'the folder line and editor ride along');
  assert.doesNotMatch(C.card(ch('z', '', 'solo', 1), { lang: 'ru', hpMax: 10 }), /undefined|NaN/);
  assert.match(C.card(ch('z', '', 'solo', 1), { lang: 'ru', hpMax: 10 }), /Без имени/);
});

test('both languages have the same strings and Russian is formal', () => {
  const { C } = load();
  assert.deepEqual(Object.keys(C.T.ru).sort(), Object.keys(C.T.en).sort());
  for (const [k, v] of Object.entries(C.T.ru)) { assert.ok(v.length > 0, k); assert.doesNotMatch(v, /(^|[^а-яё])(ты|тебя|тебе|твой|выбери|удали|открой)([^а-яё]|$)/i, k); }
  const { C: D } = load(); D.SORTS.forEach(k => assert.ok(D.T.ru[k] && D.T.en[k], k));
});

test('select mode: pick, count, select all visible, bulk bin request, leave', () => {
  const { C } = load({ cards: [{ id: 'a' }, { id: 'b' }, { id: 'c', hidden: true }] }), l = list();
  assert.doesNotMatch(C.bar(l, 'en'), /data-cl-pick|data-cl="bin"/);
  let r = C.handle(click('select'), { lang: 'en' });
  assert.deepEqual({ ...r }, { handled: true, rerender: true, focus: '[data-cl="done"]' }); assert.equal(C.isSelecting(), true);
  let bar = C.bar(l, 'en'); assert.match(bar, /Selected: 0/); assert.match(bar, /data-cl-bin disabled/);
  assert.match(C.card(l[0], { lang: 'en', hpMax: 30 }), /<input type="checkbox" data-cl-pick="a" aria-label="Select: Vee">/);
  assert.doesNotMatch(C.card(l[0], { lang: 'en', hpMax: 30 }), /data-cl-menu/, 'no menu while selecting');
  r = C.handle(change({ 'data-cl-pick': 'b' }, { checked: true }), { lang: 'en' }); assert.equal(r.handled, true); assert.equal(r.rerender, undefined);
  assert.deepEqual(plain(C.pickedIds()), ['b']);
  C.handle(click('all'), { lang: 'en' }); assert.deepEqual(plain(C.pickedIds()).sort(), ['a', 'b'], 'the hidden card is not picked');
  C.handle(change({ 'data-cl-pick': 'a' }, { checked: false }), { lang: 'en' }); assert.deepEqual(plain(C.pickedIds()), ['b']);
  assert.match(C.bar(l, 'en'), /Selected: 1/); assert.doesNotMatch(C.bar(l, 'en'), /data-cl-bin disabled/);
  r = C.handle(click('bin'), { lang: 'en' }); assert.deepEqual(plain(r.bin), ['b']);
  C.handle(click('none'), { lang: 'en' }); assert.equal(C.handle(click('bin'), { lang: 'en' }).bin, undefined, 'nothing picked, nothing to bin');
  r = C.handle(click('done'), { lang: 'en' }); assert.equal(r.focus, '[data-cl="select"]'); assert.equal(C.isSelecting(), false); assert.deepEqual(plain(C.pickedIds()), []);
});

test('a picked sheet that is gone from the list is forgotten', () => {
  const { C } = load();
  C.handle(click('select'), { lang: 'en' }); C.handle(change({ 'data-cl-pick': 'x' }, { checked: true }), { lang: 'en' });
  C.bar(list(), 'en'); assert.deepEqual(plain(C.pickedIds()), []);
});

test('the sort field changes the mode, saves it and asks the page to keep the focus on it', () => {
  const { C, store } = load();
  const r = C.handle(change({ 'data-cl-sort': '' }, { value: 'name' }), { lang: 'en' });
  assert.deepEqual({ ...r }, { handled: true, rerender: true, focus: '[data-cl-sort]' }); assert.equal(store['nc-char-sort'], 'name');
  assert.equal(C.handle(change({ 'data-cl-sort': '' }, { value: 'evil' }), { lang: 'en' }).rerender, undefined);
  assert.match(C.bar([], 'en'), /<option value="name" selected>By name<\/option>/);
});

test('events that are not ours are not handled', () => {
  const { C } = load();
  assert.equal(C.handle({ type: 'click', target: { closest: () => null } }, {}).handled, false);
  assert.equal(C.handle({ type: 'input', target: {} }, {}).handled, false);
  assert.equal(C.handle({ type: 'click' }, {}).handled, false);
});
