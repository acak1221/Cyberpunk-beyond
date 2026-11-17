/* Review fixes of the combat page: undo after leaving the page, GM-secret rolls, the sheet's damage rules for a player's hit,
   groups kept together, the quick combat bound, focus fallbacks, the turn counter. */
const {test} = require('node:test'), assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path'), vm = require('node:vm');
const read = f => fs.readFileSync(path.join(__dirname, '..', 'site', f), 'utf8');
const plain = x => JSON.parse(JSON.stringify(x));
const deep = (a, b, m) => assert.deepStrictEqual(plain(a), b, m);
const BASE = ['rolls.js', 'crit-injuries.js', 'combat-tools.js', 'hp-pad.js', 'campaigns.js', 'combat-dock.js'];
const FULL = ['wallet.js', 'rolls.js', 'crit-injuries.js', 'combat-tools.js', 'equipment-tools.js', 'damage-apply.js', 'gm-tools.js', 'hp-pad.js', 'campaigns.js', 'gm-table.js', 'combat-dock.js'];
function load(extra = {}, files = BASE) {
  const window = {...extra}; const ctx = vm.createContext({window, globalThis: {window}, Math, Date, console, JSON}); ctx.globalThis.window = window;
  for (const f of files) vm.runInContext(read(f), ctx, {filename: f}); return window;
}
const npc = (id, init, extra = {}) => ({id, kind: 'npc', name: id.toUpperCase(), ref: 6, hp: 10, maxHp: 10, initiative: init, order: init, ...extra});
const fixture = () => ({id: 'k', name: 'Job', round: 1, turnIndex: 0, roster: [npc('a', 15), npc('g1', 12, {grp: 'G', order: 1}), npc('g2', 12, {grp: 'G', order: 2}), npc('g3', 12, {grp: 'G', order: 3}), npc('b', 5)], groups: [{id: 'G', name: 'Boosters', ref: 6, sp: {head: 4, body: 7}, note: ''}]});
function ctxOf(c, extra = {}) {
  const log = {saves: 0, renders: 0, notes: [], actions: []};
  return {log, ctx: {lang: 'en', campaigns: c ? [c] : [], characters: [], save: () => { log.saves++; }, render: () => { log.renders++; }, notify: m => log.notes.push(m), notifyAction: (m, l, fn) => log.actions.push({m, l, fn}), isCurrent: k => k === c, sameData: k => k === c, ...extra}};
}
function fake(action, dataset = {}, fields = {}) {
  const root = {contains: () => true, querySelector: s => fields[s] || null, querySelectorAll: () => []}, panel = {querySelector: s => fields[s] || null};
  const b = {dataset: {cdAction: action, ...dataset}, closest: s => (s === '[data-cd-action]' ? b : s === '[data-combat-dock]' ? root : s === '[data-cd-panel]' ? panel : null), matches: () => false};
  return {type: 'click', target: b};
}

test('an undo toast still works after the person left the combat page (only the data must be the same)', () => {
  const D = load().CombatDock, c = fixture(), {ctx, log} = ctxOf(c); D.resetUi();
  D.handle(fake('remove', {id: 'a'}), ctx); assert.equal(c.roster.length, 4);
  ctx.isCurrent = () => false; // the view changed
  log.actions[0].fn(); assert.equal(c.roster.length, 5); assert.match(log.notes.at(-1), /Restored: 1/);
  ctx.isCurrent = k => k === c; D.handle(fake('remove', {id: 'a'}), ctx); ctx.isCurrent = () => false; ctx.sameData = () => false; log.actions.at(-1).fn(); assert.equal(c.roster.length, 4); assert.match(log.notes.at(-1), /try again/i);
});

test('rolls for opponents are kept out of the online room feed; a player roll is not', () => {
  const calls = []; const w = load({App: {report: (...a) => { calls.push(a); return true; }}}), D = w.CombatDock;
  const c = {id: 'k', name: 'J', round: 1, turnIndex: 0, roster: [npc('x', 9), npc('z', 3, {hp: 0})]}, {ctx} = ctxOf(c); D.resetUi(); w.Rolls.setRng(() => 0.45);
  D.handle(fake('roll-one', {id: 'x'}), ctx); assert.equal(calls.at(-1)[5], true, 'initiative of an opponent is secret');
  D.handle(fake('crit-roll', {id: 'x', loc: 'body'}), ctx); assert.equal(calls.at(-1)[5], true);
  D.handle(fake('death-save', {id: 'z'}, {'[data-cd-body]': {value: '5'}}), ctx); assert.equal(calls.at(-1)[5], true);
  D.handle(fake('roll-all'), ctx); assert.equal(calls.at(-1)[5], true);
  const pcOnly = {id: 'k2', name: 'P', round: 1, turnIndex: 0, roster: [{id: 'r', kind: 'pc', characterId: 'p1', initiative: 0, order: 1}]};
  const {ctx: c2} = ctxOf(pcOnly, {characters: [{id: 'p1', name: 'V', stats: {REF: 5}}]}); D.handle(fake('roll-all'), c2); assert.equal(calls.at(-1)[5], false);
  w.Rolls.setRng(null);
});

test('Rolls passes the secret flag to the app; the default stays public; the app skips the room feed for it', () => {
  const calls = []; const w = load({App: {report: (...a) => { calls.push(a); return true; }}});
  w.Rolls.sum('x', [3], 10, {secret: true}); w.Rolls.sum('y', [3], 10); w.Rolls.report('z', 'd', 5);
  assert.equal(calls[0][5], true); assert.equal(calls[1][5], false); assert.equal(calls[2][5], false);
  const app = read('app.js'); assert.match(app, /if\(meta\?\.secret!==true\)window\.Room\?\.roll\?\./); assert.match(app, /report\(label,detail,total,faces,show,secret\)/);
});

test('a hit on a player goes through the sheet damage rules and the sheet is the one that changes; an online player gets an offer', () => {
  const w = load({}, FULL), D = w.CombatDock;
  const pc = {id: 'p1', name: 'Vega', role: 'solo', stats: {BODY: 8, WILL: 6, REF: 7, DEX: 6}, hp: 40, bodyArmor: 11, head: 7, skills: {}};
  const c = {id: 'k', name: 'J', round: 1, turnIndex: 0, roster: [{id: 'r', kind: 'pc', characterId: 'p1', initiative: 5, order: 1}]}, {ctx, log} = ctxOf(c, {characters: [pc]}); D.resetUi();
  const f = {'[data-cd-raw]': {value: '15'}, '[data-cd-loc]': {value: 'body'}, '[data-cd-crit]': {checked: false}};
  const expected = w.GMTable.hitPc(JSON.parse(JSON.stringify(pc)), {raw: 15, location: 'body', type: 'standard'});
  assert.equal(D.handle(fake('hit', {id: 'r'}, f), ctx), true);
  assert.equal(pc.hp, expected.hp, 'same result as the GM table'); assert.ok(pc.hp < 40); assert.equal(log.saves, 1); assert.ok(log.notes.length >= 1);
  const sent = []; const w2 = load({RoomGrants: {sendTo: (...a) => { sent.push(a); return {ok: true, text: 'ok'}; }}}, FULL);
  w2.GMTable.onlineMember = () => 'member-1'; const pc2 = {...pc, hp: 40}, c2 = JSON.parse(JSON.stringify(c)), {ctx: x2} = ctxOf(c2, {characters: [pc2]}); w2.CombatDock.resetUi();
  w2.CombatDock.handle(fake('hit', {id: 'r'}, f), x2); assert.equal(sent.length, 1); assert.equal(sent[0][1].n, 15); assert.equal(pc2.hp, 40);
});

test('rolling or moving one member of a group moves the whole group', () => {
  const w = load(), D = w.CombatDock, c = fixture(), {ctx} = ctxOf(c); D.resetUi(); w.Rolls.setRng(() => 0.45);
  D.handle(fake('roll-one', {id: 'g2'}), ctx); deep(c.roster.filter(r => r.grp).map(r => r.initiative), [11, 11, 11]);
  D.handle(fake('to-top', {id: 'g3'}), ctx); const top = c.roster.filter(r => r.grp).map(r => r.initiative); assert.equal(new Set(top).size, 1); assert.ok(top[0] > 15);
  w.Rolls.setRng(null);
});

test('a quick combat keeps up to the roster limit and the tie order across a reload', () => {
  const D = load().CombatDock, big = {roster: Array.from({length: 300}, (_, i) => ({id: 'r' + i, kind: 'npc', ties: [3, 1, 'x']}))};
  const q = D.readQuick(big, 'en'); assert.equal(q.roster.length, 300); deep(q.roster[0].ties, [3, 1, 0]);
  assert.equal(D.readQuick({roster: Array.from({length: 2100}, (_, i) => ({id: 'r' + i, kind: 'npc'}))}, 'en').roster.length, 2045);
});

test('the turn counter counts actors (a group once) and the first turn skips an out lead', () => {
  const D = load().CombatDock, c = fixture();
  deep(D.turnCount(c), {pos: 1, total: 3}); D.advance(c, 1); deep(D.turnCount(c), {pos: 2, total: 3}); D.advance(c, 1); deep(D.turnCount(c), {pos: 3, total: 3});
  c.turnIndex = 0; c.roster.find(r => r.id === 'a').out = true; assert.equal(D.firstTurn(c), 1);
  c.roster.find(r => r.id === 'a').out = false; c.roster.find(r => r.id === 'g1').out = true; D.rollAll(c, [], () => 5);
  assert.ok(!D.ordered(c)[c.turnIndex].out, 'the turn starts on a row that acts');
  c.turnIndex = 0; assert.match(D.page(ctxOf(c).ctx), /Turn 1\/3/);
});

test('focus fallbacks: starting or ending a quick combat lands on the heading, not on BODY; the hover state keeps its contrast', () => {
  const D = load().CombatDock, {ctx} = ctxOf(null); D.resetUi();
  D.handle(fake('quick-new'), ctx); deep(D.ui.focus, {act: 'h1', id: null});
  D.ui.focus = null; D.handle(fake('quick-end'), ctx); deep(D.ui.focus, {act: 'h1', id: null});
  const css = read('combat-dock.css'); assert.match(css, /\.cd-next:hover:not\(:disabled\)[^{]*\{[^}]*background:\s*#b0302f/);
});

test('groups survive the campaign export: row.grp and the stat blocks are kept by the file cleaner', () => {
  const read2 = f => fs.readFileSync(path.join(__dirname, '..', 'site', f), 'utf8');
  const window = {document: {addEventListener() {}, querySelector: () => null, querySelectorAll: () => []}, crypto: {randomUUID: () => 'u'}, confirm: () => true};
  const ctx = vm.createContext({window, document: window.document, globalThis: window, Math, Number, String, Array, Object, Set, Map, WeakMap, JSON, Date, Promise, RegExp, Error, Infinity, setTimeout, clearTimeout, console, TextEncoder, URL, Blob});
  for (const f of ['beat-chart.js', 'campaigns.js', 'gm-tools.js', 'gm-extras.js', 'npc-library.js', 'room-journal.js', 'campaign-io.js']) vm.runInContext(read2(f), ctx, {filename: f});
  const c = window.CampaignIO.cleanCampaign(plain(fixture()))?.campaign;
  assert.ok(c, 'the campaign is accepted'); assert.equal(c.roster.filter(r => r.grp === 'G').length, 3); assert.equal(c.groups.length, 1); assert.equal(c.groups[0].name, 'Boosters');
});

test('after a redraw focus skips a disabled «Next turn» and lands on the More menu (never on BODY)', () => {
  const focused = [], mk = name => ({disabled: false, name, focus() { focused.push(name); }});
  const next = {...mk('next'), disabled: true}, summary = mk('summary'), h1 = mk('h1');
  const root = {querySelector: s => (s === '[data-cd-action="next"]:not([disabled])' ? null : s.startsWith('[data-cd-action="next"]') ? next : s === '.cd-menu summary' ? summary : s === 'h1' ? h1 : null)};
  const w = load({document: {querySelector: s => (s === '[data-combat-dock]' ? root : null)}}), D = w.CombatDock;
  D.ui.focus = {act: 'next', id: null}; D.after(null); deep(focused, ['summary']);
  D.ui.focus = {act: 'h1', id: null}; D.after(null); deep(focused, ['summary', 'h1']);
});
