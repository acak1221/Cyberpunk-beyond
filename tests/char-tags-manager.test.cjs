// The folder and tag manager (char-tags.js): rename, merge and delete everywhere, one undo step, the string-on-sheet model untouched.
const { test } = require('node:test'), assert = require('node:assert/strict'), fs = require('node:fs'), vm = require('node:vm'), path = require('node:path');
const source = fs.readFileSync(path.join(__dirname, '..', 'site', 'char-tags.js'), 'utf8');
const plain = x => JSON.parse(JSON.stringify(x));
function load() {
  const listeners = {}, notices = [], actions = [], saved = [];
  const state = { view: 'characters', lang: 'ru', characters: [] };
  let renders = 0, canEdit = true;
  const focusLog = [];
  const document = {
    addEventListener(t, f) { (listeners[t] ||= []).push(f); },
    activeElement: null,
    querySelector: s => (s === '[data-ctm-summary]' ? { focus() { focusLog.push('summary'); } } : null),
    querySelectorAll: () => [],
  };
  const window = { document, App: { getState: () => state, save: () => saved.push(plain(state.characters)), render: () => { renders++; }, notify: m => notices.push(m), notifyAction: (m, l, f) => actions.push({ m, l, f }), archive: { canEdit: () => canEdit } } };
  vm.runInNewContext(source, { window, setTimeout() { return 1; }, clearTimeout() {}, console });
  const C = window.CharTags;
  const row = (kind, key, value = '', merge = '') => {
    const r = { dataset: { ctmKind: kind, ctmKey: key }, querySelector: s => (s === '[data-ctm-input]' ? { value, focus() {} } : s === '[data-ctm-merge]' ? { value: merge } : null) };
    return r;
  };
  const press = (how, r) => { const b = { dataset: { ctm: how }, closest: s => (s === '[data-ctm-row]' ? r : s === 'button[data-ctm]' ? b : null) }; for (const f of listeners.click || []) f({ target: b }); };
  const choose = (r, value) => { const t = { value, matches: s => s === '[data-ctm-merge]', closest: s => (s === '[data-ctm-row]' ? r : null) }; for (const f of listeners.change || []) f({ target: t }); };
  return { choose, listeners, C, state, notices, actions, saved, row, press, renders: () => renders, pause: () => { canEdit = false; }, focusLog, window };
}
const who = (id, name, extra) => ({ id, name, role: 'solo', ...(extra === undefined ? {} : { extra }) });
const fresh = () => [
  who('a', 'Vee', { folder: 'Банда', tags: ['долг', 'босс'], uid: 'a' }),
  who('b', 'Rook', { folder: 'банда', tags: ['Долг'] }),
  who('c', 'Ash', { folder: 'Семья' }),
  who('d', 'Zed', {}),
  who('e', 'Old'),
];

test('change(): rename a folder everywhere, any spelling of it', () => {
  const { C } = load(), l = fresh();
  const r = C.change(l, 'folder', C.key('Банда'), 'Банды');
  assert.equal(r.ok, true); assert.equal(r.changed.length, 2);
  assert.equal(l[0].extra.folder, 'Банды'); assert.equal(l[1].extra.folder, 'Банды');
  assert.equal(l[2].extra.folder, 'Семья'); assert.equal('folder' in l[3].extra, false);
  assert.equal(l[0].extra.uid, 'a', 'nothing else on the sheet moves');
});

test('change(): merging a folder into another unifies the spelling', () => {
  const { C } = load(), l = fresh();
  const r = C.change(l, 'folder', C.key('Семья'), 'Банда');
  assert.equal(r.changed.length, 1); assert.equal(l[2].extra.folder, 'Банда');
  assert.equal(C.index(l).folders.length, 1, 'one folder is left');
});

test('change(): delete a folder everywhere, the characters stay and the key is gone', () => {
  const { C } = load(), l = fresh();
  const r = C.change(l, 'folder', C.key('Банда'), null);
  assert.equal(r.changed.length, 2); assert.equal(l.length, 5);
  assert.equal('folder' in l[0].extra, false, 'a deleted folder leaves no empty key');
  assert.deepEqual(plain(l[0].extra.tags), ['долг', 'босс'], 'the tags are not touched');
});

test('change(): rename, merge and delete a tag; a merge never makes a repeat; the limit is kept', () => {
  const { C } = load(), l = fresh();
  assert.equal(C.change(l, 'tag', C.key('босс'), 'главный').changed.length, 1);
  assert.deepEqual(plain(l[0].extra.tags), ['долг', 'главный']);
  const r = C.change(l, 'tag', C.key('главный'), 'Долг'); // merge into an existing tag
  assert.deepEqual(plain(l[0].extra.tags), ['долг'], 'the first spelling stays, no repeat'); assert.equal(r.changed.length, 1);
  assert.equal(C.change(l, 'tag', C.key('долг'), null).changed.length, 2);
  assert.equal('tags' in l[0].extra, false, 'an emptied list removes the key'); assert.equal('tags' in l[1].extra, false);
  assert.equal(C.index(l).tags.length, 0);
});

test('change(): refuses a blank name, bad arguments, and touches nothing', () => {
  const { C } = load(), l = fresh(), before = JSON.stringify(l);
  for (const to of ['', '   ', '​', 5, {}, undefined]) assert.equal(C.change(l, 'folder', C.key('Банда'), to).ok, false, String(to));
  assert.equal(C.change(l, 'tag', 'x', '#').ok, false);
  assert.equal(C.change(l, 'color', 'x', 'y').ok, false); assert.equal(C.change('nope', 'folder', 'x', 'y').ok, false);
  assert.equal(JSON.stringify(l), before);
});

test('change(): overlong names are cut like everywhere else; hostile data on a sheet is skipped', () => {
  const { C } = load(), l = [who('a', 'A', { folder: 'F' }), { id: 'x', name: 'Broken', extra: 'text' }, null, who('b', 'B', { folder: 'F', tags: 'oops' })];
  const r = C.change(l, 'folder', C.key('F'), 'N'.repeat(90));
  assert.equal(r.changed.length, 2); assert.equal(l[0].extra.folder.length, C.LIMITS.FOLDER_MAX); assert.equal(l[1].extra, 'text');
});

test('revert() puts back exactly what the sheets had, including a missing key', () => {
  const { C } = load(), l = fresh(), before = JSON.stringify(l);
  const r1 = C.change(l, 'folder', C.key('Банда'), null), r2 = C.change(l, 'tag', C.key('долг'), 'x');
  assert.notEqual(JSON.stringify(l), before);
  C.revert(r2.changed, l); C.revert(r1.changed, l);
  assert.deepEqual(plain(l), JSON.parse(before));
  assert.equal(C.revert([{ c: { id: 'gone', extra: {} }, before: { folder: 'x' } }], l), 0, 'a sheet that is no longer in the list is skipped');
  assert.equal(C.revert(null, l), 0);
});

test('the manager lists every folder and tag with its count and escapes the names', () => {
  const { C } = load(), l = fresh(); l.push(who('z', 'Z', { folder: '<b>x</b>', tags: ['"quote"'] }));
  const html = C.managerRows(C.index(l), 'ru');
  assert.match(html, /data-ctm-kind="folder" data-ctm-key="банда"/); assert.match(html, /<b><span class="char-tags-sr">листов: <\/span>2<\/b>/);
  assert.doesNotMatch(html, /<b>x<\/b>/); assert.match(html, /&lt;b&gt;x&lt;\/b&gt;/); assert.match(html, /&quot;quote&quot;/);
  assert.match(html, /data-ctm="rename"/); assert.match(html, /data-ctm-merge/); assert.match(html, /data-ctm="delete"/);
  assert.match(html, /aria-label="Удалить везде: Банда"/);
  assert.match(C.managerRows(C.index([]), 'en'), /No folders or tags yet/);
  const bar = C.toolbar(l, 'en', 's1');
  assert.match(bar, /data-ctm-root/); assert.match(bar, /<summary data-ctm-summary>Manage folders<\/summary>/);
});

test('both languages have the same manager strings and Russian is formal', () => {
  const { C } = load();
  assert.deepEqual(Object.keys(C.MT.ru).sort(), Object.keys(C.MT.en).sort());
  for (const [k, v] of Object.entries(C.MT.ru)) { assert.ok(/[а-яё]/i.test(v), k); assert.doesNotMatch(v, /(^|[^а-яё])(ты|тебя|тебе|твой|измени|удали|верни)([^а-яё]|$)/i, k); }
});

test('the page: rename saves once, redraws, offers one undo, and undo restores everything', () => {
  const h = load(); h.state.characters = fresh(); const before = JSON.stringify(h.state.characters);
  h.press('rename', h.row('folder', 'банда', 'Крыша'));
  assert.equal(h.saved.length, 1); assert.equal(h.renders(), 1);
  assert.equal(h.state.characters[0].extra.folder, 'Крыша');
  assert.equal(h.actions.length, 1); assert.equal(h.actions[0].m, 'Готово: «Банда» теперь «Крыша», листов: 2.'); assert.equal(h.actions[0].l, 'Вернуть');
  assert.deepEqual(h.focusLog, ['summary'], 'the focus stays in the manager');
  h.actions[0].f();
  assert.equal(JSON.stringify(h.state.characters), before); assert.equal(h.saved.length, 2); assert.match(h.notices.at(-1), /Возвращено: листов 2\./);
});

test('the page: typing the name of another folder merges; the select merges; delete removes with undo', () => {
  let h = load(); h.state.characters = fresh();
  h.press('rename', h.row('folder', 'семья', 'банда')); // same as an existing one -> merge, spelled like the existing folder
  assert.equal(h.state.characters[2].extra.folder, 'Банда'); assert.match(h.actions[0].m, /слито в «Банда»/);
  h = load(); h.state.characters = fresh();
  h.press('delete', h.row('tag', 'долг'));
  assert.equal(h.state.characters.every(c => !c.extra || !('tags' in c.extra) || !c.extra.tags.some(x => x.toLowerCase() === 'долг')), true);
  assert.match(h.actions[0].m, /убрано с листов: 2/);
});

test('the page: choosing a folder in «Слить в…» merges at once, with undo', () => {
  const h = load(); h.state.characters = fresh();
  h.choose(h.row('folder', 'семья', '', 'банда'), 'банда');
  assert.equal(h.state.characters[2].extra.folder, 'Банда'); assert.match(h.actions[0].m, /слито в «Банда»/);
  h.choose(h.row('folder', 'банда', '', ''), ''); assert.equal(h.actions.length, 1, 'the empty option does nothing');
  h.actions[0].f(); assert.equal(h.state.characters[2].extra.folder, 'Семья');
});

test('the page: nothing happens for a same name, a blank name, a stale row, a paused page or another view', () => {
  const h = load(); h.state.characters = fresh();
  h.press('rename', h.row('folder', 'банда', 'Банда')); assert.equal(h.saved.length, 0); assert.equal(h.notices.at(-1), 'Название не изменилось.');
  h.press('rename', h.row('folder', 'банда', '   ')); assert.equal(h.saved.length, 0); assert.equal(h.notices.at(-1), 'Введите название.');
  h.press('delete', h.row('folder', 'нет-такой')); assert.equal(h.saved.length, 0); assert.equal(h.notices.at(-1), 'Список изменился. Повторите действие.');
  h.pause(); h.press('delete', h.row('folder', 'банда')); assert.equal(h.saved.length, 0);
  assert.equal(h.state.characters[0].extra.folder, 'Банда', 'a paused page changes nothing');
  const g = load(); g.state.characters = fresh(); g.state.view = 'sheet'; g.press('delete', g.row('folder', 'банда')); assert.equal(g.saved.length, 0);
});

test('undo is refused when the list was replaced meanwhile', () => {
  const h = load(); h.state.characters = fresh();
  h.press('delete', h.row('folder', 'банда'));
  h.state.characters = fresh(); // another account or a restore replaced the list
  h.actions[0].f();
  assert.equal(h.notices.at(-1), 'Список изменился. Повторите действие.');
    assert.equal(h.state.characters[0].extra.folder, 'Банда');
});

test('the exported sheet is the same shape as before: folder is a string, tags a list of strings', () => {
  const { C } = load(), l = fresh();
  C.change(l, 'folder', C.key('Банда'), 'Крыша'); C.change(l, 'tag', C.key('долг'), 'должник');
  for (const c of l.filter(x => x.extra)) { if ('folder' in c.extra) assert.equal(typeof c.extra.folder, 'string'); if ('tags' in c.extra) assert(Array.isArray(c.extra.tags) && c.extra.tags.every(x => typeof x === 'string')); }
  assert.deepEqual(plain(C.read(l[0])), { folder: 'Крыша', tags: ['должник', 'босс'] });
});
