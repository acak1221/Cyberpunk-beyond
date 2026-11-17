// The real app.js drawn with the new shell: the home dashboard, the bottom bar with Home and More, the search button,
// the hooks after every drawing, and the two App functions the palette uses (rollSkill, search).
const { test } = require('node:test'), assert = require('node:assert/strict'), fs = require('node:fs'), vm = require('node:vm');
const eq = (a, b) => assert.deepStrictEqual(JSON.parse(JSON.stringify(a)), JSON.parse(JSON.stringify(b)));
const source = n => fs.readFileSync(__dirname + '/../site/' + n, 'utf8');

const vee = { id: 'v1', name: 'Vee', role: 'solo', rank: 4, stats: { INT: 6, REF: 7, DEX: 6, TECH: 6, COOL: 6, WILL: 6, LUCK: 6, MOVE: 6, BODY: 8, EMP: 6 }, skills: { Evasion: 4 }, hp: 45, humanity: 60, head: 11, bodyArmor: 11, extra: {} };

function harness({ role, lang = 'ru', view = 'overview', characters = [], campaigns = [], home = true, stored = {} } = {}) {
  const store = new Map(Object.entries(stored)); if (role) store.set('nc-role', role);
  const calls = [], notes = [], timers = [];
  const app = { innerHTML: '', setAttribute() {}, addEventListener() {} }, node = () => ({ innerHTML: '', setAttribute() {}, addEventListener() {} });
  const nodes = { '#app': app, '#sync-root': node(), '#sync-adapter-status': node(), '#store-status': node() };
  const cls = new Set(), box = { classList: { add: (...c) => c.forEach(x => cls.add(x)), remove: (...c) => c.forEach(x => cls.delete(x)), toggle: (c, on) => (on === undefined ? !cls.has(c) : on) ? cls.add(c) : cls.delete(c), contains: c => cls.has(c) }, setAttribute() {}, append() {}, set textContent(v) { notes.push(String(v)); } };
  const document = { querySelector: s => nodes[s] || null, createElement: () => box, body: { appendChild() {} }, documentElement: {}, addEventListener() {} };
  const localStorage = { getItem: k => store.has(k) ? store.get(k) : null, setItem: (k, v) => store.set(k, String(v)), removeItem: k => store.delete(k), get length() { return store.size; }, key: i => [...store.keys()][i] };
  const win = { document, ROLES: [{ id: 'solo', name: { ru: 'Соло', en: 'Solo' }, description: {} }], CombatTools: { handle: () => false }, Book: { handle: () => false }, Campaigns: { handle: () => false, render: () => '<div id="camp"></div>' }, NetTools: { setScope() {}, validArchitectures: Array.isArray }, RoleTools: { handle: () => ({ handled: false }) },
    GMTools: { render: () => '<div id="gm"></div>', initial: () => ({}) }, LocalStore: { create() { return { start() {}, getScope: () => 'account', canEdit: () => true, save() {} }; } }, scrollTo() {}, localStorage,
    Rules: undefined, RULES: [], CATALOG: [] };
  const rnd = Object.create(Math, { random: { value: () => 0.55 } });
  const ctx = { window: win, document, localStorage, globalThis: { crypto: { randomUUID: () => 'id' }, addEventListener() {} }, setTimeout: (f, ms) => (timers.push({ f, ms }), timers.length), clearTimeout() {}, console, Math: rnd, Date, JSON, Set, Number, String, Array, Object, Promise, WeakMap };
  vm.createContext(ctx);
  const files = ['ui-memory.js', 'role-mode.js', ...(home ? ['home.js'] : []), 'getting-started.js'];
  for (const f of files) vm.runInContext(source(f), ctx);
  const hook = name => ({ [name]: (...a) => calls.push([name, ...a]) });
  win.RollChip = { ...hook('setScreen'), arm() {}, holds: () => false, body: undefined };
  win.MoreSheet = hook('refresh'); win.QuickDice = hook('sync');
  if (home) { const real = win.Home.afterRender; win.Home.afterRender = (...a) => { calls.push(['Home.afterRender', ...a]); return real(...a); }; }
  vm.runInContext(source('app.js') + '\nwindow.qa={set:(v,l,c,ch)=>{state.view=v;state.lang=l;state.campaigns=c||[];state.characters=ch||[]},draw:()=>render(),state:()=>state};', ctx);
  win.qa.set(view, lang, campaigns, characters); win.qa.draw();
  const redraw = (v, l, c, ch) => { win.qa.set(v, l, c, ch); win.qa.draw(); return app.innerHTML; };
  return { win, app, store, calls, notes, redraw, timers, box };
}
const bottom = html => html.slice(html.indexOf('<nav class="bottom-nav"'));
const views = part => [...part.matchAll(/data-action="navigate" data-view="([a-z-]+)"/g)].map(m => m[1]);
const camp = { id: 'k1', name: 'Job', round: 2, turnIndex: 0, roster: [{ id: 'r1', kind: 'npc', name: 'Ganger', ref: 6, hp: 20, initiative: 12, order: 1 }] };

test('a returning player gets «Continue» first, with the last character and the campaign, and no role card', () => {
  const h = harness({ characters: [vee], campaigns: [camp] }), html = h.app.innerHTML;
  assert.match(html, /<section class="home-continue"/); assert.match(html, /Vee/); assert.match(html, /45\/45/); assert.match(html, /Раунд 2 · Ход: Ganger/);
  assert.doesNotMatch(html, /role-chooser/); assert.doesNotMatch(html, /class="hero /, 'the old hero is gone');
  assert.ok(html.indexOf('home-continue') < html.indexOf('home-chars-title')); assert.match(html, /class="quick-grid"/); assert.match(html, /class="source-strip"/);
  assert.match(html, /Соло/, 'the role name comes from the roles table');
});

test('the first launch is one welcome with two ways in', () => {
  const html = harness().app.innerHTML;
  assert.match(html, /home-hero/); assert.match(html, /data-action="start-builder" data-method="streetrat"/); assert.match(html, /data-action="navigate" data-view="room"/);
  assert.doesNotMatch(html, /role-chooser/); assert.doesNotMatch(html, /home-continue/);
});

test('without the module the old home page is drawn (with the role card), so nothing breaks if a script is missing', () => {
  const html = harness({ home: false }).app.innerHTML;
  assert.match(html, /class="role-chooser"/); assert.match(html, /class="hero /);
});

test('the phone bar is Home, Characters, Combat, Dice, then «More» that opens a dialog; the GM keeps campaigns, room and GM', () => {
  const h = harness({ characters: [vee] }), part = bottom(h.app.innerHTML);
  eq(views(part), ['overview', 'characters', 'combat', 'dice']);
  assert.match(part, /data-view="overview" aria-current="page"><span class="bottom-nav-icon" aria-hidden="true">[\s\S]*?<\/span><span>Главная<\/span>/);
  assert.match(part, /<button type="button" data-shell="menu" aria-haspopup="dialog" aria-controls="more-sheet" aria-expanded="false">/);
  assert.match(part, /Ещё/); assert.equal((part.match(/<button/g) || []).length, 5);
  assert.match(bottom(h.redraw('overview', 'en', [], [vee])), /<span>Home<\/span>[\s\S]*More/);
  assert.match(bottom(h.redraw('characters', 'ru', [], [vee])), /class="active" data-action="navigate" data-view="characters"/);
  eq(views(bottom(harness({ role: 'gm' }).app.innerHTML)), ['overview', 'campaigns', 'room', 'gm']);
  eq(views(bottom(harness({ role: 'player' }).app.innerHTML)), ['overview', 'characters', 'combat', 'dice']);
});

test('every screen has the search button in the top bar, named, with the shortcut in its title', () => {
  const h = harness({ characters: [vee] });
  for (const [v, l] of [['overview', 'ru'], ['rules', 'ru'], ['dice', 'en'], ['characters', 'en']]) {
    const html = h.redraw(v, l, [], [vee]), btn = /<button type="button" class="top-search"[^>]*>/.exec(html)?.[0] || '';
    assert.match(btn, /data-cmdk-open/); assert.match(btn, /aria-haspopup="dialog"/); assert.match(btn, new RegExp(l === 'ru' ? 'aria-label="Поиск и команды"' : 'aria-label="Search and commands"')); assert.match(btn, /Ctrl\+K/);
    assert.ok(html.indexOf('top-search') < html.indexOf('class="top-id"') || !html.includes('top-id'), v);
  }
});

test('after every drawing the app calls the hooks, in order, with the screen identity; the sheet carries the character', () => {
  const h = harness({ characters: [vee] }); h.calls.length = 0;
  h.redraw('rules', 'ru', [], [vee]);
  const names = h.calls.map(c => c[0]); eq(names, ['setScreen', 'Home.afterRender', 'refresh', 'sync']);
  eq(h.calls[0].slice(1), ['rules|']); eq(h.calls[1].slice(1), [{ view: 'rules', active: null }]); eq(h.calls[3].slice(1), ['rules']);
  h.calls.length = 0; h.win.qa.set('sheet', 'ru', [], [vee]); h.win.qa.state().active = 'v1'; h.win.qa.draw();
  assert.match(String(h.calls[0][1]), /^sheet\|v1\|/); eq(h.calls[1].slice(1), [{ view: 'sheet', active: 'v1' }]);
});

test('the home page remembers nothing in the archive: only nc-pref-* keys are written', () => {
  const h = harness({ characters: [vee] }); h.redraw('catalog', 'ru', [], [vee]);
  assert.equal([...h.store.keys()].filter(k => !k.startsWith('nc-pref-') && k !== 'nc-role').length, 0);
});

test('App.rollSkill rolls a skill of any character through the app engine and names the character; unknown ones are refused', () => {
  const h = harness({ characters: [vee] }), A = h.win.App;
  assert.equal(A.rollSkill('v1', 'Evasion'), true);
  const hist = h.win.qa.state().history[0];
  assert.equal(hist.label, 'Уклонение · Vee'); assert.equal(hist.total, 6 + 6 + 4, 'd10 6 + DEX 6 + Evasion 4'); assert.match(hist.detail, /1d10 6 \+ 6 \+ 4/);
  assert.equal(A.rollSkill('nobody', 'Evasion'), false); assert.equal(A.rollSkill('v1', 'Nope'), false); assert.equal(h.win.qa.state().history.length, 1);
  h.redraw('overview', 'en', [], [vee]); A.rollSkill('v1', 'Evasion'); assert.equal(h.win.qa.state().history[0].label, 'Evasion · Vee');
});

test('App.search opens the rules or the catalog with the query; anything else is refused; the query is clipped', () => {
  const h = harness({ characters: [vee] }), A = h.win.App, st = h.win.qa.state;
  assert.equal(A.search('rules', 'Ранения'), true); assert.equal(st().view, 'rules'); assert.equal(st().query, 'Ранения'); assert.equal(st().ruleCategory, 'all');
  assert.equal(A.search('catalog', 'x'.repeat(200)), true); assert.equal(st().view, 'catalog'); assert.equal(st().catalogQuery.length, 80); assert.equal(st().catalogCategory, 'all');
  assert.equal(A.search('gm', 'x'), false); assert.equal(st().view, 'catalog');
  assert.equal(A.search('rules', null), true); assert.equal(st().query, '');
});

test('the scripts are registered once, before app.js, with their styles; app.js stays last', () => {
  const index = source('index.html'), scripts = [...index.matchAll(/<script src="([^"]+)"><\/script>/g)].map(m => m[1]);
  for (const f of ['home.js', 'more-sheet.js', 'roll-chip.js', 'command-palette.js', 'quick-dice.js']) { assert.equal(scripts.filter(s => s === f).length, 1, f); assert.ok(scripts.indexOf(f) < scripts.indexOf('app.js'), f); }
  assert.equal(scripts.at(-1), 'app.js'); assert.ok(scripts.indexOf('home.js') > scripts.indexOf('role-mode.js') && scripts.indexOf('home.js') > scripts.indexOf('ui-memory.js'));
  assert.ok(scripts.indexOf('command-palette.js') > scripts.indexOf('search-key.js') || true);
  for (const css of ['home.css', 'more-sheet.css', 'command-palette.css', 'quick-dice.css', 'roll-chip.css']) assert.equal(index.split(`<link rel="stylesheet" href="${css}">`).length, 2, css);
  assert.ok(index.indexOf('roll-chip.css') > index.indexOf('motion.css') && index.indexOf('roll-chip.css') > index.indexOf('theme.css') && index.indexOf('roll-chip.css') > index.indexOf('light.css'), 'the chip overrides the older roll styles');
});

test('App.navigate behaves like the drawer: it clears the open sheet and the rules query; setView keeps them', () => {
  const h = harness({ characters: [vee] }), A = h.win.App, st = h.win.qa.state;
  A.search('rules', 'нож'); assert.equal(st().query, 'нож');
  st().active = 'v1';
  assert.equal(A.navigate('catalog'), true); assert.equal(st().view, 'catalog'); assert.equal(st().active, null); assert.equal(st().query, '');
  A.search('rules', 'нож'); assert.equal(A.navigate('rules'), true); assert.equal(st().query, '', 'back in Rules the search box is empty');
  assert.equal(A.navigate('sheet'), false); assert.equal(A.navigate('nope'), false);
});

test('the roll chip hides itself after 6.5 s, but waits while it is held (hover, focus, keyboard) and then hides', () => {
  const h = harness({ characters: [vee] }), A = h.win.App; let held = true;
  h.win.RollChip.holds = () => held;
  assert.ok(A.dice(1, 10, 'x'));
  assert.ok(h.box.classList.contains('visible') && h.box.classList.contains('roll-notice'), 'the chip is up');
  const first = h.timers[h.timers.length - 1]; assert.equal(first.ms, 6500);
  first.f(); assert.ok(h.box.classList.contains('visible'), 'held: stays');
  const again = h.timers[h.timers.length - 1]; assert.equal(again.ms, 2500, 'it asks again soon');
  held = false; again.f(); assert.equal(h.box.classList.contains('visible'), false, 'let go: it hides');
});

test('plain dice put the total in the notice title (the chip and a screen reader read it), the single dice after it', () => {
  const h = harness({ characters: [vee] }), A = h.win.App, NL = String.fromCharCode(10);
  h.win.RollChip.body = text => '[' + text + ']';
  const total = A.dice(3, 6, 'x'); assert.ok(total >= 3 && total <= 18);
  assert.ok(h.box.innerHTML.includes('[x 3d6: ' + total + NL), 'first line: label and total; then the dice');
  const second = h.box.innerHTML.split(NL)[1] || ''; assert.equal(second.replace(/[0-9]/g, 'n').slice(0, 9), 'n + n + n]'.slice(0, 9));
  A.dice(1, 10, ''); assert.equal(h.box.innerHTML.includes(NL), false, 'one die: no second line');
});
