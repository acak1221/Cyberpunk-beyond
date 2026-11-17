// Home: the «Continue» dashboard, the first-launch welcome, what is remembered, the next-turn helper (site/home.js).
const { test } = require('node:test'), assert = require('node:assert/strict'), fs = require('node:fs');
const { load } = require('./dialog-dom.cjs');
const eq = (a, b) => assert.deepStrictEqual(JSON.parse(JSON.stringify(a)), JSON.parse(JSON.stringify(b)));
function setup({ stored = {}, app = {}, campaigns: C } = {}) {
  const store = new Map(Object.entries(stored));
  const localStorage = { getItem: k => store.has(k) ? store.get(k) : null, setItem: (k, v) => store.set(k, String(v)), removeItem: k => store.delete(k), get length() { return store.size; }, key: i => [...store.keys()][i] };
  const h = load(['ui-memory.js', 'home.js'], { localStorage });
  h.win.App = { lang: () => 'ru', getState: () => ({ characters: [], campaigns: [] }), ...app };
  if (C) h.win.Campaigns = C;
  return { ...h, store, H: h.win.Home };
}
const vee = (over = {}) => ({ id: 'v1', name: 'Vee', role: 'solo', rank: 4, hp: 45, stats: { BODY: 8, WILL: 6, LUCK: 6 }, extra: {}, ...over });
const job = (over = {}) => ({ id: 'k1', name: 'Job', round: 2, turnIndex: 0, roster: [{ id: 'r1', kind: 'npc', name: 'Ganger', initiative: 12, order: 1 }], ...over });

test('model: the last character, the campaign with a turn, the room and the way back', () => {
  const { H } = setup();
  const m = H.model({ characters: [vee(), vee({ id: 'v2', name: 'Jax' })], campaigns: [job()], lastChar: 'v2', lastCampaign: 'k1', lastView: 'catalog', roomPill: '<button class="room-pill ok" data-room-pill>Комната · 3</button>' });
  assert.equal(m.first, false); assert.equal(m.character.id, 'v2'); assert.equal(m.character.hpMax, 45);
  eq(m.campaign, { id: 'k1', name: 'Job', round: 2, count: 1, turnName: 'Ganger' });
  assert.equal(m.lastView, 'catalog'); assert.equal(m.room.online, true);
});

test('model: an unknown last character falls back to the first; nothing at all is a first launch', () => {
  const { H } = setup();
  assert.equal(H.model({ characters: [vee()], campaigns: [], lastChar: 'gone' }).character.id, 'v1');
  const empty = H.model({}); assert.equal(empty.first, true); assert.equal(empty.character, null); assert.equal(empty.campaign, null);
  assert.equal(H.model(null).first, true);
  assert.equal(H.model({ characters: [], campaigns: [job()] }).first, false, 'a campaign alone is not a first launch');
  assert.equal(H.model({ characters: [vee()], lastView: 'sheet' }).lastView, null, 'a sheet and the home page are not offered as a way back');
  assert.equal(H.model({ characters: [vee()], lastView: 'overview' }).lastView, null);
  assert.equal(H.model({ characters: [{ nope: 1 }, null, vee()] }).character.id, 'v1', 'broken records are skipped');
});

test('model: wound state and LUCK follow the sheet', () => {
  const { H } = setup();
  const w = hp => H.model({ characters: [vee({ hp })] }).character.wound;
  assert.equal(w(45), ''); assert.equal(w(22), 'serious'); assert.equal(w(23), ''); assert.equal(w(0), 'mortal'); assert.equal(w(-3), 'mortal');
  eq(H.luckOf(vee()), { now: 6, max: 6 });
  eq(H.luckOf(vee({ extra: { luck: 2 } })), { now: 2, max: 6 });
  eq(H.luckOf(vee({ extra: { luck: 99 } })), { now: 6, max: 6 });
  eq(H.luckOf(vee({ extra: { luck: 'x' } })), { now: 6, max: 6 });
});

test('model: the active campaign is the remembered one, else the first with people in it', () => {
  const { H } = setup();
  const a = job({ id: 'a', roster: [] }), b = job({ id: 'b' });
  assert.equal(H.model({ characters: [vee()], campaigns: [a, b] }).campaign.id, 'b');
  assert.equal(H.model({ characters: [vee()], campaigns: [a, b], lastCampaign: 'a' }).campaign.id, 'a');
  assert.equal(H.model({ campaigns: [a] }).campaign.count, 0);
});

test('model: the turn name is the character for a player and the order follows initiative', () => {
  const { H } = setup();
  const c = job({ turnIndex: 1, roster: [{ id: 'x', kind: 'npc', name: 'Fast', initiative: 20 }, { id: 'y', kind: 'pc', characterId: 'v1', initiative: 15 }, { id: 'z', kind: 'npc', name: 'Slow', initiative: 3 }] });
  assert.equal(H.model({ characters: [vee()], campaigns: [c] }).campaign.turnName, 'Vee');
  assert.equal(H.model({ characters: [vee()], campaigns: [job({ turnIndex: 99 })] }).campaign.turnName, '', 'a stale index names nobody');
});

test('roomState reads the pill: nothing joined, online, offline, my turn', () => {
  const { H } = setup();
  assert.equal(H.roomState(''), null); assert.equal(H.roomState('<span data-room-pill hidden></span>'), null); assert.equal(H.roomState(undefined), null);
  const on = H.roomState('<button type="button" class="room-pill ok turn" data-room-pill><span class="room-dot on"></span>▶ Ваш ход · 2</button>');
  assert.equal(on.online, true); assert.equal(on.turn, true); assert.match(on.label, /Ваш ход/);
  const off = H.roomState('<button type="button" class="room-pill " data-room-pill>Комната · 1</button>');
  assert.equal(off.online, false); assert.equal(off.turn, false);
});

const ctx = (over = {}) => ({ state: { characters: [vee()], campaigns: [job()], lang: 'ru' }, lang: 'ru', quick: '<a class="quick-card" data-view="rules"></a>', strip: '<div id="strip"></div>', entry: '<details id="entry"></details>', guide: '<div id="guide"></div>', source: '<div id="source"></div>', tour: '', roleName: () => 'Соло', viewLabel: v => ({ catalog: 'Снаряжение' }[v] || v), roomPill: '', ...over });

test('render, returning player: «Continue» first with Open and Roll, then the list, the quick cards and the existing blocks', () => {
  const { H } = setup({ stored: { 'nc-pref-home-char': '"v1"', 'nc-pref-home-view': '"catalog"' } });
  const html = H.render(ctx());
  assert.match(html, /<h1 id="home-continue-title">Продолжить<\/h1>/);
  assert.match(html, /data-action="open" data-id="v1"/); assert.match(html, /data-quick-dice-open/);
  assert.match(html, /45\/45/); assert.match(html, /LUCK/); assert.match(html, /6\/6/);
  assert.match(html, /Раунд 2 · Ход: Ganger/); assert.match(html, /data-home-campaign="k1"/); assert.match(html, /data-home-next="k1"/);
  assert.match(html, /Вы остановились: Снаряжение/); assert.match(html, /data-action="navigate" data-view="catalog"/);
  assert.doesNotMatch(html, /home-hero/, 'no welcome for someone with data');
  const at = s => html.indexOf(s);
  assert.ok(at('home-continue') < at('home-chars-title') && at('home-chars-title') < at('quick-grid') && at('quick-grid') < at('id="strip"') && at('id="strip"') < at('id="entry"') && at('id="entry"') < at('id="guide"') && at('id="guide"') < at('id="source"'));
  assert.match(html, /<div class="quick-grid"><a class="quick-card"/);
});

test('render, first launch: one welcome with two ways in, the tour banner under it, no continue block', () => {
  const { H } = setup();
  const html = H.render(ctx({ state: { characters: [], campaigns: [], lang: 'ru' }, tour: '<div class="ob-banner" data-ob-banner></div>' }));
  assert.match(html, /home-hero/); assert.match(html, /Создать персонажа за две минуты/); assert.match(html, /Присоединиться к игре по ссылке/);
  assert.match(html, /data-action="start-builder" data-method="streetrat"/); assert.match(html, /data-action="navigate" data-view="room"/);
  assert.ok(html.indexOf('home-hero') < html.indexOf('ob-banner')); assert.doesNotMatch(html, /home-continue/);
  assert.equal((html.match(/<button type="button" class="home-path/g) || []).length, 2, 'exactly two paths');
  assert.doesNotMatch(html, /role-chooser/, 'the role question is a dialog, not a card');
});

test('render: an introduction that was asked for comes first, also for a returning player', () => {
  const { H } = setup();
  const html = H.render(ctx({ tour: '<section class="ob-card ob-intro" data-ob-intro></section>' }));
  assert.ok(html.indexOf('data-ob-intro') < html.indexOf('home-continue'));
  assert.equal(html.split('data-ob-intro').length, 2);
});

test('render, Game Master: the campaign card comes before the character; English strings; everything escaped', () => {
  const { H } = setup();
  const gm = H.render(ctx({ role: 'gm' })); assert.ok(gm.indexOf('home-camp') < gm.indexOf('home-char'));
  const pl = H.render(ctx({ role: 'player' })); assert.ok(pl.indexOf('home-char') < pl.indexOf('home-camp'));
  const en = H.render(ctx({ lang: 'en', roleName: () => 'Solo' }));
  assert.match(en, /Continue/); assert.match(en, /Round 2 · Turn: Ganger/); assert.match(en, /Next turn/); assert.match(en, /Open tracker/);
  const evil = H.render(ctx({ state: { characters: [vee({ name: '<img src=x onerror=1>', id: 'a"b' })], campaigns: [job({ name: '<b>x</b>', id: 'k"1' })], lang: 'ru' } }));
  assert.doesNotMatch(evil, /<img|<b>x/); assert.match(evil, /&lt;img/); assert.match(evil, /data-id="a&quot;b"/); assert.match(evil, /data-home-campaign="k&quot;1"/);
  assert.equal(H.render(null), ''); assert.equal(H.render({}), '');
});

test('render: the room line says connected or offline and offers the room; a campaign without people has no «Next turn»', () => {
  const { H } = setup();
  const on = H.render(ctx({ roomPill: '<button class="room-pill ok" data-room-pill>Комната · 2</button>' }));
  assert.match(on, /Комната<\/b> · на связи/); assert.match(on, /data-view="room"/);
  assert.match(H.render(ctx({ roomPill: '<button class="room-pill " data-room-pill>x</button>' })), /нет связи/);
  assert.doesNotMatch(H.render(ctx()), /home-room/, 'not in a room: no line');
  const none = H.render(ctx({ state: { characters: [vee()], campaigns: [job({ roster: [] })], lang: 'ru' } }));
  assert.match(none, /В списке пока никого/); assert.doesNotMatch(none, /data-home-next/);
});

test('render: touch targets and names. Every button of the block is a real button with text', () => {
  const css = fs.readFileSync(__dirname + '/../site/home.css', 'utf8');
  assert.match(css, /\.home-actions \.btn\{[^}]*min-height:44px/); assert.match(css, /\.home-row\{[^}]*min-height:48px/); assert.match(css, /\.home-line \.btn\{[^}]*min-height:44px/);
  assert.equal(css.includes('\r'), false); assert.match(css, /prefers-reduced-motion/);
  const html = setup().H.render(ctx());
  for (const m of html.matchAll(/<button[^>]*>([\s\S]*?)<\/button>/g)) assert.ok(m[1].replace(/<[^>]+>/g, '').trim().length > 0, 'a button without a name: ' + m[0].slice(0, 60));
});

test('afterRender remembers the last sheet, the last tool and the open campaign; never the home page or a sheet as a tool', () => {
  const { H, store } = setup({ campaigns: { selectedId: () => 'k1' } });
  H.afterRender({ view: 'sheet', active: 'v1' }); assert.equal(store.get('nc-pref-home-char'), '"v1"');
  H.afterRender({ view: 'catalog' }); assert.equal(store.get('nc-pref-home-view'), '"catalog"');
  H.afterRender({ view: 'overview' }); H.afterRender({ view: 'sheet', active: 'v1' }); H.afterRender({ view: 'settings' });
  assert.equal(store.get('nc-pref-home-view'), '"catalog"');
  H.afterRender({ view: 'campaigns' }); assert.equal(store.get('nc-pref-home-campaign'), '"k1"'); assert.equal(store.get('nc-pref-home-view'), '"campaigns"');
  H.afterRender({ view: 'sheet', active: 42 }); H.afterRender({ view: 'sheet', active: '' }); assert.equal(store.get('nc-pref-home-char'), '"v1"', 'a bad id is not remembered');
  H.afterRender(null);
  assert.equal([...store.keys()].every(k => k.startsWith('nc-pref-')), true, 'only per-device preferences, never the archive');
});

test('afterRender on the home page asks the role through RoleMode once the person has data and has seen the welcome; a broken module changes nothing', () => {
  const state = { characters: [], campaigns: [] }, { H, win, store } = setup({ app: { getState: () => state } }); const asked = []; let skipped = 0;
  win.RoleMode = { firstRun: l => (asked.push(l), true), skip: () => skipped++ };
  H.afterRender({ view: 'overview' }); eq(asked, [], 'first launch: the welcome is alone on the screen'); assert.equal(store.get('nc-pref-home-welcomed'), 'true');
  state.characters.push(vee()); H.afterRender({ view: 'overview' }); H.afterRender({ view: 'catalog' });
  eq(asked, ['ru'], 'after the first move it is asked'); assert.equal(skipped, 0);
  win.RoleMode = { firstRun() { throw new Error('x'); } };
  assert.doesNotThrow(() => H.afterRender({ view: 'overview' }));
});

test('a person who had data before the question existed is never asked: it counts as answered', () => {
  const { H, win } = setup({ app: { getState: () => ({ characters: [vee()], campaigns: [] }) } }); const asked = []; let skipped = 0;
  win.RoleMode = { firstRun: l => asked.push(l), skip: () => skipped++, isSet: () => false, asked: () => false };
  H.afterRender({ view: 'overview' }); eq(asked, []); assert.equal(skipped, 1);
  win.RoleMode = { firstRun: l => asked.push(l), skip: () => skipped++, isSet: () => true };
  H.afterRender({ view: 'overview' }); assert.equal(skipped, 1, 'a chosen role is left alone');
});

test('nextTurn opens the tracker of the campaign and presses its own button; the focus stays on that button', () => {
  const calls = [];
  const { H, doc } = setup({
    campaigns: { select: id => calls.push('select ' + id), selectedId: () => null },
    app: { getState: () => ({ characters: [], campaigns: [job()] }), setView: v => { calls.push('view ' + v); return true; } },
  });
  const btn = doc.el('button'); btn.click = () => calls.push('click'); doc.queries['[data-campaign-action="next"]'] = btn;
  assert.equal(H.nextTurn('k1'), true);
  eq(calls, ['select k1', 'view campaigns', 'click']); assert.equal(doc.activeElement, btn);
  calls.length = 0; assert.equal(H.nextTurn('nope'), false, 'an unknown campaign does nothing'); eq(calls, []);
  btn.disabled = true; assert.equal(H.nextTurn('k1'), true); assert.equal(calls.includes('click'), false, 'a disabled button is not pressed');
  calls.length = 0; assert.equal(H.nextTurn(), true, 'no id: the first campaign with people'); assert.equal(calls[0], 'select k1');
});

test('a click on the campaign buttons of the block is handled', () => {
  const calls = [];
  const { doc } = setup({ campaigns: { select: id => calls.push('select ' + id) }, app: { getState: () => ({ characters: [], campaigns: [job()] }), setView: v => { calls.push(v); return true; } } });
  const btn = attr => ({ closest: s => s === `[${attr}]` ? { getAttribute: () => 'k1' } : null });
  doc.fire('click', { target: btn('data-home-campaign') });
  eq(calls, ['select k1', 'campaigns']);
  doc.fire('click', { target: { closest: () => null } }); eq(calls.length, 2);
});

test('home.js keeps LF endings, ends like the other modules and has no network or storage of its own', () => {
  const code = fs.readFileSync(__dirname + '/../site/home.js', 'utf8');
  assert.equal(code.includes('\r'), false); assert.match(code, /\}\)\(typeof window!=='undefined'\?window:globalThis\);\s*$/);
  assert.doesNotMatch(code, /fetch\(|XMLHttpRequest|localStorage|sessionStorage|indexedDB|WebSocket/);
});

test('«Next turn» offers «Undo» in the notice, which presses the tracker\'s own previous-turn button', () => {
  const calls = []; let undo = null, label = '', msg = '';
  const { H, doc } = setup({
    campaigns: { select: id => calls.push('select ' + id), selectedId: () => null },
    app: { getState: () => ({ characters: [], campaigns: [job()] }), setView: v => { calls.push('view ' + v); return true; }, notifyAction: (m, l, f) => { msg = m; label = l; undo = f; } },
  });
  const next = doc.el('button'); next.click = () => calls.push('next'); doc.queries['[data-campaign-action="next"]'] = next;
  const prev = doc.el('button'); prev.click = () => calls.push('prev'); doc.queries['[data-campaign-action="prev"]'] = prev;
  H.nextTurn('k1'); assert.equal(msg, 'Ход передан.'); assert.equal(label, 'Вернуть'); calls.length = 0;
  undo(); eq(calls, ['select k1', 'view campaigns', 'prev']); assert.equal(doc.activeElement, next, 'the focus stays on a tracker button');
});
