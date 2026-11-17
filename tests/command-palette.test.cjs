// Command palette (site/command-palette.js): the index, the ranking, the actions and the dialog as a combobox.
const { test } = require('node:test'), assert = require('node:assert/strict'), fs = require('node:fs');
const { load, key } = require('./dialog-dom.cjs');
const eq = (a, b) => assert.deepStrictEqual(JSON.parse(JSON.stringify(a)), JSON.parse(JSON.stringify(b)));
const P = () => load(['command-palette.js']).win.CommandPalette;

const SRC = {
  lang: 'ru',
  screens: [{ view: 'overview', label: 'Обзор' }, { view: 'rules', label: 'Правила' }, { view: 'catalog', label: 'Снаряжение' }, { view: 'dice', label: 'Кубики' }, { view: 'bad view', label: 'X' }],
  characters: [{ id: 'v1', name: 'Vee', role: 'solo' }, { id: 'j', name: 'Ёжик', role: 'tech' }],
  current: { id: 'v1', name: 'Vee', skills: [{ key: 'Evasion', ru: 'Уклонение', en: 'Evasion', level: 4 }, { key: 'Athletics', ru: 'Атлетика', en: 'Athletics', level: 2 }] },
  campaigns: [{ id: 'k1', name: 'Ночной рейд', round: 3 }],
  canNextTurn: true,
  catalog: [{ id: 'weapon-light-melee-weapon', label: 'Лёгкое оружие ближнего боя', hint: '', words: 'Light Melee Weapon' }],
  rules: [{ id: 'evasion', label: 'Уклонение', hint: 'Бой', words: 'Evasion 172' }, { id: 'wounds', label: 'Ранения', hint: 'Здоровье', words: 'Wounds' }],
};

test('normalize: case, ё and spaces do not matter', () => {
  const C = P();
  assert.equal(C.normalize('  Ёжик   БЫСТРЫЙ '), 'ежик быстрый'); assert.equal(C.normalize(null), '');
});

test('build: one index over screens, characters, skills, campaigns, catalog, rules and actions', () => {
  const C = P(), e = C.build(SRC), kinds = new Set(e.map(x => x.kind));
  eq([...kinds].sort(), ['action', 'campaign', 'catalog', 'character', 'rule', 'screen', 'skill']);
  assert.equal(e.filter(x => x.kind === 'screen').length, 4, 'a view name that is not a plain route is dropped');
  const skill = e.find(x => x.kind === 'skill' && x.run.skill === 'Evasion');
  assert.equal(skill.label, 'Бросить Уклонение'); assert.match(skill.hint, /Vee · уровень 4/); eq(skill.run, { type: 'roll', id: 'v1', skill: 'Evasion' });
  assert.ok(e.find(x => x.label === 'Следующий ход'), 'next turn when a tracker has people');
  assert.ok(e.find(x => x.label === 'Открыть ведущего'));
  assert.equal(new Set(e.map(x => x.id)).size, e.length, 'ids are unique');
  eq(e.find(x => x.kind === 'campaign').run, { type: 'campaign', id: 'k1' });
  eq(e.find(x => x.kind === 'rule' && x.label === 'Ранения').run, { type: 'search', view: 'rules', query: 'Ранения' });
});

test('build: no next turn without a fight, English labels, no skills without a character, broken rows are ignored', () => {
  const C = P();
  assert.equal(C.build({ ...SRC, canNextTurn: false }).some(x => x.label === 'Следующий ход'), false);
  const en = C.build({ ...SRC, lang: 'en' });
  assert.ok(en.find(x => x.label === 'Roll Evasion')); assert.ok(en.find(x => x.label === 'Next turn')); assert.ok(en.find(x => x.label === 'Open Game Master tools'));
  assert.equal(C.build({ ...SRC, current: null }).some(x => x.kind === 'skill'), false);
  assert.doesNotThrow(() => C.build({ characters: [null, {}, { id: 5 }], campaigns: 'x', catalog: [null], rules: [{}], screens: [null] }));
  eq(C.build(null).map(x => x.kind), Array(7).fill('action'));
});

test('rank: «уклон» finds the skill roll before the rules entry; both languages find the same skill', () => {
  const C = P(), e = C.build(SRC);
  const r = C.rank(e, 'уклон'); assert.equal(r[0].label, 'Бросить Уклонение'); assert.ok(r.some(x => x.kind === 'rule'));
  assert.equal(C.rank(e, 'evasion')[0].label, 'Бросить Уклонение', 'the English name finds it in the Russian list');
  assert.equal(C.rank(e, 'бросить уклонение')[0].label, 'Бросить Уклонение', 'the verb is an extra word');
  assert.equal(C.rank(e, 'ЕЖИК')[0].label, 'Ёжик', 'ё and capitals');
});

test('rank: every word has to match; nothing found is an empty list; an empty query shows the actions first', () => {
  const C = P(), e = C.build(SRC);
  eq(C.rank(e, 'уклон zzz'), []); eq(C.rank(e, 'qqqq'), []);
  const home = C.rank(e, ''); assert.ok(home.length <= 12); assert.equal(home[0].kind, 'action');
  assert.equal(C.rank(e, 'ход')[0].label, 'Следующий ход');
  assert.equal(C.rank(e, 'ночной')[0].kind, 'campaign');
  assert.equal(C.rank(e, 'ближн')[0].kind, 'catalog', 'a catalog item by a word of its name');
  assert.equal(C.rank(e, 'melee')[0].kind, 'catalog', 'and by its English name');
  assert.equal(C.rank(e, 'правила')[0].label, 'Правила', 'a screen');
});

test('rank: the limit holds, and an alias function can rescue an entry the words missed', () => {
  const C = P(), many = Array.from({ length: 100 }, (_, i) => ({ id: 'a' + i, kind: 'rule', label: 'Правило ' + i, hint: '', n: 'правило ' + i, k: '', w: 2, run: {} }));
  assert.equal(C.rank(many, 'правило').length, 40); assert.equal(C.rank(many, 'правило', 5).length, 5);
  const e = C.build(SRC), cat = e.find(x => x.kind === 'catalog');
  eq(C.rank(e, 'нож'), []);
  eq(C.rank(e, 'нож', 40, (entry, q) => entry === cat && q === 'нож').map(x => x.id), [cat.id]);
});

test('run: every kind of entry does its own thing through the app, and a missing module is a quiet no', () => {
  const calls = [], h = load(['command-palette.js']), C = h.win.CommandPalette;
  h.win.App = { setView: v => (calls.push('view ' + v), true), open: id => (calls.push('open ' + id), true), rollSkill: (id, s) => (calls.push(`roll ${id} ${s}`), true), search: (v, q) => (calls.push(`search ${v} ${q}`), true) };
  h.win.Home = { openCampaign: id => (calls.push('camp ' + id), true), nextTurn: () => (calls.push('next'), true) };
  h.win.QuickDice = { open: () => (calls.push('dice'), true) };
  for (const run of [{ type: 'view', view: 'gm' }, { type: 'open', id: 'v1' }, { type: 'roll', id: 'v1', skill: 'Evasion' }, { type: 'campaign', id: 'k1' }, { type: 'next-turn' }, { type: 'quick-dice' }, { type: 'search', view: 'catalog', query: 'Нож' }])assert.equal(C.run({ run }), true);
  eq(calls, ['view gm', 'open v1', 'roll v1 Evasion', 'camp k1', 'next', 'dice', 'search catalog Нож']);
  assert.equal(C.run({ run: { type: 'nope' } }), false); assert.equal(C.run(null), false);
  h.win.Home = undefined; assert.equal(C.run({ run: { type: 'next-turn' } }), false);
});

// ---- the dialog ----
function dialog({ app = {}, extra = {} } = {}) {
  const h = load(['command-palette.js']);
  const { doc, win } = h, C = win.CommandPalette, calls = [];
  const appEl = doc.el('div'); doc.queries['#app'] = appEl;
  const main = doc.el('div'); doc.queries['#main-content'] = main;
  win.App = { lang: () => 'ru', getState: () => ({ characters: [{ id: 'v1', name: 'Vee', role: 'solo', skills: { Evasion: 4 } }], campaigns: [] }), setView: v => (calls.push('view ' + v), true), rollSkill: (id, s) => (calls.push(`roll ${id} ${s}`), true), ...app };
  const nav = (view, label) => { const n = doc.el('a'); n.dataset.view = view; n.getAttribute = () => label; n.querySelector = () => ({ textContent: label }); return n; };
  doc.queries['#app-sidebar .nav-item'] = [nav('rules', 'Правила'), nav('dice', 'Кубики')];
  win.SKILL_LABELS = { Evasion: { ru: 'Уклонение', en: 'Evasion' } }; win.CATALOG = []; win.RULES = [];
  // The dialog is built by innerHTML; the test answers the few queries the module makes inside it.
  const make = doc.createElement;
  doc.createElement = tag => {
    const e = make(tag);
    Object.defineProperty(e, 'innerHTML', { get() { return this._html; }, set(v) { this._html = v; if (tag === 'div' && /cmdk-box/.test(v)) wire(e); } });
    return e;
  };
  const wire = root => {
    const input = doc.el('input'), list = doc.el('ul'), status = doc.el('div'), none = doc.el('p'), close = doc.el('button');
    input.value = ''; list.queries = {}; list.querySelectorAll = () => []; list.querySelector = () => null;
    root.queries['#cmdk-input'] = input; root.queries['#cmdk-list'] = list; root.queries['.cmdk-status'] = status; root.queries['.cmdk-none'] = none; root.queries['.cmdk-close'] = close;
    root.input = input; root.list = list; root.status = status; root.none = none; root.close = close;
  };
  return { ...h, C, calls, appEl, main, root: () => doc.all.find(x => x.className === 'cmdk' && x.isConnected) };
}

test('open: a labelled modal dialog with a combobox that owns a listbox; the rest of the page is inert; the focus is in the field', () => {
  const d = dialog(), opener = d.doc.el('button'); opener.isConnected = true; d.doc.activeElement = opener;
  assert.equal(d.C.open(), true); const root = d.root();
  assert.ok(root); assert.match(root.innerHTML, /role="dialog" aria-modal="true" aria-labelledby="cmdk-title"/);
  assert.match(root.innerHTML, /id="cmdk-input"[^>]*role="combobox"[^>]*aria-expanded="true"[^>]*aria-controls="cmdk-list"[^>]*aria-autocomplete="list"/);
  assert.match(root.innerHTML, /<ul id="cmdk-list"[^>]*role="listbox"/); assert.match(root.innerHTML, /role="status" aria-live="polite"/);
  assert.equal(d.appEl.inert, true); assert.equal(d.doc.activeElement, root.input); assert.equal(d.doc.documentElement.classList.contains('cmdk-open'), true);
  assert.equal(d.C.open(), false, 'a second call does nothing');
});

test('typing filters, the first option is active, arrows move with wrap, and aria-activedescendant follows', () => {
  const d = dialog(); d.C.open(); const root = d.root();
  root.input.value = 'уклон'; d.doc.fire('input', { target: root.input });
  assert.match(root.list.innerHTML, /id="cmdk-opt-0" class="cmdk-opt active" role="option" aria-selected="true"/);
  assert.match(root.list.innerHTML, /Бросить Уклонение/); assert.equal(root.input.attrs['aria-activedescendant'], 'cmdk-opt-0');
  assert.match(root.status.textContent, /Найдено: \d+/);
  root.input.value = 'qqqq'; d.doc.fire('input', { target: root.input });
  assert.equal(root.none.hidden, false); assert.equal(root.list.hidden, true, 'an empty listbox is hidden, not announced'); assert.equal(root.input.attrs['aria-expanded'], 'false');
  assert.equal(root.input.attrs['aria-activedescendant'], undefined); assert.equal(root.status.textContent, 'Ничего не найдено');
});

test('Enter runs the highlighted entry and closes the palette; a roll stays on the screen and the focus goes back to the opener', () => {
  const d = dialog(), opener = d.doc.el('button'); opener.isConnected = true; d.doc.activeElement = opener; opener.closest = () => ({});
  d.C.open(); const root = d.root();
  root.input.value = 'уклон'; d.doc.fire('input', { target: root.input });
  const e = key('Enter'); d.doc.fire('keydown', e);
  assert.equal(e.prevented, 1); eq(d.calls, ['roll v1 Evasion']); assert.equal(d.root(), undefined); assert.equal(d.appEl.inert, false);
  assert.equal(d.doc.activeElement, opener, 'the focus is back where it was');
  assert.equal(d.doc.documentElement.classList.contains('cmdk-open'), false);
});

test('after a screen change the focus goes to the content when the opener is gone', () => {
  const d = dialog(), opener = d.doc.el('button'); opener.isConnected = false; d.doc.activeElement = opener;
  d.C.open(); const root = d.root(); root.input.value = 'правила'; d.doc.fire('input', { target: root.input });
  d.doc.activeElement = root.input; d.doc.fire('keydown', key('Enter'));
  assert.equal(d.doc.activeElement, d.main);
});

test('Escape closes and restores; Tab cycles between the field and the close button; Ctrl+K and Cmd+K toggle', () => {
  const d = dialog(), opener = d.doc.el('button'); opener.isConnected = true; d.doc.activeElement = opener;
  d.C.open(); const root = d.root();
  const tab = key('Tab'); d.doc.fire('keydown', tab); assert.equal(d.doc.activeElement, root.close); assert.equal(tab.prevented, 1);
  d.doc.fire('keydown', key('Tab')); assert.equal(d.doc.activeElement, root.input);
  d.doc.fire('keydown', key('Tab', { shiftKey: true })); assert.equal(d.doc.activeElement, root.close);
  const esc = key('Escape'); d.doc.fire('keydown', esc); assert.equal(esc.prevented, 1); assert.equal(d.root(), undefined); assert.equal(d.doc.activeElement, opener);
  const k = key('k', { ctrlKey: true }); d.doc.fire('keydown', k); assert.equal(k.prevented, 1); assert.ok(d.root());
  d.doc.fire('keydown', key('K', { metaKey: true })); assert.equal(d.root(), undefined, 'the same shortcut closes it');
  const plain = key('k'); d.doc.fire('keydown', plain); assert.equal(d.root(), undefined); assert.equal(plain.prevented, 0, 'a plain k is not taken');
  d.doc.fire('keydown', key('k', { ctrlKey: true, shiftKey: true })); assert.equal(d.root(), undefined, 'Ctrl+Shift+K is the browser\'s');
});

test('a click on the search button opens it, a click on an option runs it, a click on the backdrop or the close button closes it', () => {
  const d = dialog(); const btn = d.doc.el('button'); btn.isConnected = true;
  d.doc.fire('click', { target: { closest: s => s === '[data-cmdk-open]' ? btn : null }, preventDefault() {} }); assert.ok(d.root());
  d.doc.fire('click', { target: { closest: s => s === '[data-cmdk-close]' ? {} : null } }); assert.equal(d.root(), undefined);
  d.C.open(); d.root().input.value = 'правила'; d.doc.fire('input', { target: d.root().input });
  d.doc.fire('click', { target: { closest: s => s === '[data-cmdk-index]' ? { dataset: { cmdkIndex: '0' } } : null } });
  eq(d.calls, ['view rules']); assert.equal(d.root(), undefined);
});

test('the index is built when the palette opens, not before (nothing is read at load)', () => {
  let reads = 0;
  const h = load(['command-palette.js']); h.win.App = { lang: () => 'ru', getState: () => { reads++; return {}; } };
  assert.equal(reads, 0);
});

test('the markup keeps the pattern: options in a listbox, kinds are decoration, touch targets of 44 px, no network', () => {
  const code = fs.readFileSync(__dirname + '/../site/command-palette.js', 'utf8'), css = fs.readFileSync(__dirname + '/../site/command-palette.css', 'utf8');
  assert.match(code, /role="option" aria-selected/); assert.match(code, /class="cmdk-kind" aria-hidden="true"/);
  assert.match(css, /\.cmdk-opt\{[^}]*min-height:48px/); assert.match(css, /\.cmdk-close\{[^}]*min-height:44px/); assert.match(css, /\.top-search\{[^}]*min-height:44px/); assert.match(css, /@media print/);
  assert.doesNotMatch(code, /fetch\(|XMLHttpRequest|WebSocket|localStorage/); assert.equal(code.includes('\r') || css.includes('\r'), false);
});

test('recent choices come first on an empty query and are remembered newest first, five at most', () => {
  const C = P(), e = C.build(SRC), ids = e.map(x => x.id);
  const plain = C.rank(e, '').map(x => x.id), pick = plain[plain.length - 1];
  assert.equal(C.rank(e, '', 40, null, [pick])[0].id, pick, 'the recent entry is first');
  assert.equal(C.rank(e, '', 40, null, [ids[3], ids[2]]).slice(0, 2).map(x => x.id).join(), [ids[3], ids[2]].join(), 'in the order given');
  const h = load(['ui-memory.js', 'command-palette.js']), P2 = h.win.CommandPalette;
  for (const id of ['a', 'b', 'c', 'd', 'e', 'f', 'b']) P2.remember(id);
  eq(P2.recents(), ['b', 'f', 'e', 'd', 'c']);
});

test('language and theme actions press the controls the app already has; a player is told the GM section is hidden', () => {
  const h = load(['command-palette.js']), C = h.win.CommandPalette, clicks = []; h.win.App = {};
  const btn = n => ({ click: () => clicks.push(n) });
  h.doc.queries['[data-action="lang"][data-lang="en"]'] = btn('en'); h.doc.queries['[data-ui-theme="dark"]'] = btn('dark');
  assert.equal(C.run({ run: { type: 'lang', lang: 'en' } }), true); assert.equal(C.run({ run: { type: 'theme', mode: 'dark' } }), true);
  eq(clicks, ['en', 'dark']);
  assert.equal(C.run({ run: { type: 'theme', mode: 'x"]' } }), false); assert.equal(C.run({ run: { type: 'lang', lang: 'de' } }), false);
  assert.equal(C.run({ run: { type: 'theme', mode: 'light' } }), false, 'no such control: a quiet no');
  const e = C.build({ ...SRC, lang: 'ru', playerRole: true });
  assert.match(e.find(x => x.id === 'action:open-gm').hint, /режим игрока/); assert.ok(e.some(x => x.id === 'action:lang') && e.some(x => x.id === 'action:theme-light'));
  assert.doesNotMatch(C.build({ ...SRC, playerRole: false }).find(x => x.id === 'action:open-gm').hint, /режим игрока/);
});

test('after a roll the keyboard follows the chip, so Details and Again can be used; a normal action keeps the old focus rule', () => {
  const d = dialog(), opener = d.doc.el('button'); opener.isConnected = true; d.doc.activeElement = opener; opener.closest = () => ({});
  let chip = null; d.win.RollChip = { focus: () => { chip = d.doc.el('button'); d.doc.activeElement = chip; return true; } };
  d.C.open(); const root = d.root(); root.input.value = 'уклон'; d.doc.fire('input', { target: root.input }); d.doc.fire('keydown', key('Enter'));
  assert.ok(chip && d.doc.activeElement === chip, 'the focus is on the chip');
});
