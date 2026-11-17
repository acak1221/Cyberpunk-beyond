/* The combat page (site/combat-dock.js): turn order with groups, one initiative roll per group, hits and bulk hits, removing the fallen
   with an undo, the quick combat, the tools drawer, the page markup in both languages and the event handler. */
const {test} = require('node:test'), assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path'), vm = require('node:vm');
const read = f => fs.readFileSync(path.join(__dirname, '..', 'site', f), 'utf8');
const plain = x => JSON.parse(JSON.stringify(x));
const deep = (a, b, m) => assert.deepStrictEqual(plain(a), b, m); // values made inside the vm are copied first
function load(extra = {}, files = ['rolls.js', 'crit-injuries.js', 'combat-tools.js', 'hp-pad.js', 'campaigns.js', 'combat-dock.js']) {
  const window = {...extra}; const ctx = vm.createContext({window, globalThis: {window}, Math, Date, console, JSON});
  ctx.globalThis.window = window;
  for (const f of files) vm.runInContext(read(f), ctx, {filename: f});
  return window;
}
// A queue of d10/d6 faces for the injected dice.
const faces = (...v) => () => { assert.ok(v.length, 'an unexpected extra die'); return v.shift(); };
const npc = (id, init, extra = {}) => ({id, kind: 'npc', name: id.toUpperCase(), ref: 6, hp: 10, maxHp: 10, initiative: init, order: init, ...extra});
const fixture = () => ({id: 'k', name: 'Job', round: 1, turnIndex: 0, roster: [
  npc('a', 15), npc('g1', 12, {grp: 'G', order: 1}), npc('g2', 12, {grp: 'G', order: 2}), npc('g3', 12, {grp: 'G', order: 3}), npc('b', 5)], groups: [{id: 'G', name: 'Boosters', ref: 6, sp: {head: 4, body: 7}, note: ''}]});
const vega = () => ({id: 'p1', name: 'Vega', role: 'solo', stats: {BODY: 8, WILL: 6, REF: 7, DEX: 6}, hp: 40, bodyArmor: 11, head: 7, skills: {}});

test('the turn walks the order: a group acts once, rows that are out are skipped, a new round starts after the last', () => {
  const w = load(), D = w.CombatDock, c = fixture();
  const ids = () => D.ordered(c).map(r => r.id);
  deep(ids(), ['a', 'g1', 'g2', 'g3', 'b']);
  let s = D.advance(c, 1); assert.equal(D.ordered(c)[c.turnIndex].id, 'g1'); assert.equal(s.newRound, false);
  s = D.advance(c, 1); assert.equal(D.ordered(c)[c.turnIndex].id, 'b', 'g2 and g3 act with g1');
  s = D.advance(c, 1); assert.equal(D.ordered(c)[c.turnIndex].id, 'a'); assert.equal(c.round, 2); assert.equal(s.newRound, true);
  D.advance(c, 1); D.advance(c, 1); s = D.advance(c, -1); assert.equal(D.ordered(c)[c.turnIndex].id, 'g1', 'back from b lands on the lead of the group'); assert.equal(c.round, 2);
  c.round = 1; c.turnIndex = 0; assert.equal(D.advance(c, -1).moved, false, 'there is nothing before the first turn of the first round');
  // the first member who is out hands the lead to the next one; a row that is out never acts
  c.roster.find(r => r.id === 'g1').out = true; c.roster.find(r => r.id === 'b').out = true;
  D.advance(c, 1); assert.equal(D.ordered(c)[c.turnIndex].id, 'g2'); D.advance(c, 1); assert.equal(D.ordered(c)[c.turnIndex].id, 'a'); assert.equal(c.round, 2);
  const solo = {round: 1, turnIndex: 0, roster: []}; assert.equal(D.advance(solo, 1).moved, false);
});

test('advancing drops the held mark of whoever acts next', () => {
  const D = load().CombatDock, c = fixture(); c.roster[0].held = true; c.roster[4].held = true;
  D.advance(c, 1); D.advance(c, 1); assert.equal(D.ordered(c)[c.turnIndex].id, 'b'); assert.equal(c.roster[4].held, undefined); assert.equal(c.roster[0].held, true);
});

test('which campaign is shown: the open one, else the last used, else the first with people, else the first', () => {
  const D = load().CombatDock, a = {id: 'a', roster: []}, b = {id: 'b', roster: [{}]}, c = {id: 'c', roster: [{}]};
  assert.equal(D.pickCampaign([a, b, c], 'c', 'b'), c); assert.equal(D.pickCampaign([a, b, c], 'x', 'b'), b);
  assert.equal(D.pickCampaign([a, b, c], null, null), b); assert.equal(D.pickCampaign([a], null, null), a); assert.equal(D.pickCampaign([], 'a', 'a'), null); assert.equal(D.pickCampaign(null), null);
});

test('adding opponents: one stays a lone row, several make a numbered group with one stat block', () => {
  const D = load().CombatDock, c = {id: 'k', round: 1, turnIndex: 0, roster: []};
  let r = D.addNpcs(c, {name: 'Thug', count: '1', ref: '5', hp: '25', spHead: '', spBody: '4', note: 'Bat 3d6'}, 'en');
  assert.equal(r.ok, true); assert.equal(r.rows.length, 1); assert.equal(r.rows[0].name, 'Thug'); assert.equal(r.rows[0].grp, undefined); deep(plain(r.rows[0].sp), {head: 0, body: 4}); assert.equal(r.rows[0].combatNote.text, 'Bat 3d6'); assert.equal(c.groups, undefined);
  r = D.addNpcs(c, {name: 'Booster', count: 3, ref: 6, hp: 12, spHead: 2, spBody: 4}, 'ru');
  deep(r.rows.map(x => x.name), ['Booster 1', 'Booster 2', 'Booster 3']); assert.equal(new Set(r.rows.map(x => x.grp)).size, 1); assert.ok(r.rows[0].grp);
  assert.equal(c.groups.length, 1); assert.equal(c.groups[0].name, 'Booster'); deep(plain(c.groups[0].sp), {head: 2, body: 4}); assert.equal(c.roster.length, 4);
  r = D.addNpcs(c, {name: 'Booster', count: 2, ref: 6, hp: 12}, 'en'); deep(r.rows.map(x => x.name), ['Booster 4', 'Booster 5'], 'numbering continues');
  r = D.addNpcs(c, {name: '', count: 1, ref: 6, hp: 8}, 'ru'); assert.equal(r.rows[0].name, 'Противник');
  for (const bad of [{count: 0, ref: 6, hp: 5}, {count: 21, ref: 6, hp: 5}, {count: 1, ref: 21, hp: 5}, {count: 1, ref: 6, hp: 0}, {count: 1, ref: 6, hp: 'x'}, {count: 1, ref: 6, hp: 5, spBody: 31}, {count: 1, ref: -1, hp: 5}]) {
    const n = c.roster.length; assert.equal(D.addNpcs(c, {name: 'X', ...bad}, 'en').ok, false); assert.equal(c.roster.length, n);
  }
  const big = {roster: Array.from({length: 2044}, (_, i) => ({id: 'r' + i, kind: 'npc'}))}; assert.equal(D.addNpcs(big, {name: 'X', count: 2, ref: 1, hp: 1}, 'en').reason, 'full');
});

test('rows added one by one (a book template ×N) can become a group; the shared stat block reaches every member; the group can be disbanded', () => {
  const D = load().CombatDock, c = {id: 'k', round: 1, turnIndex: 0, roster: [npc('t1', 0), npc('t2', 0), npc('t3', 0)]};
  const g = D.groupRows(c, c.roster, 'Gang'); assert.ok(g); deep(c.roster.map(r => r.grp), [g, g, g]); assert.equal(c.groups[0].name, 'Gang');
  assert.equal(D.groupRows(c, [c.roster[0]], 'X'), null, 'one row is not a group');
  assert.equal(D.setGroupStat(c, g, 'ref', '9'), true); deep(c.roster.map(r => r.ref), [9, 9, 9]);
  assert.equal(D.setGroupStat(c, g, 'spBody', '5'), true); deep(plain(c.roster[2].sp), {head: 0, body: 5});
  assert.equal(D.setGroupStat(c, g, 'spHead', '3'), true); deep(plain(c.roster[1].sp), {head: 3, body: 5});
  assert.equal(D.setGroupStat(c, g, 'note', 'Knife'), true); assert.equal(c.roster[0].combatNote.text, 'Knife'); assert.equal(D.setGroupStat(c, g, 'note', ''), true); assert.equal(c.roster[0].combatNote, undefined);
  for (const bad of [['ref', '21'], ['ref', 'x'], ['spBody', '-1'], ['spHead', '31']]) assert.equal(D.setGroupStat(c, g, bad[0], bad[1]), false);
  assert.equal(D.setGroupStat(c, 'nope', 'ref', 1), false);
  assert.equal(D.ungroup(c, g), 3); assert.equal(c.roster[0].grp, undefined); assert.equal(c.groups, undefined);
});

test('initiative: 1d10 + base + bonus through the injected die; a group rolls once and stays together; the turn stays with whoever had it', () => {
  const D = load().CombatDock, c = fixture(); c.roster[0].bonus = 2;
  const one = D.rollInit(c.roster[0], [], faces(4)); deep(plain(one), {die: 4, bonus: 8, total: 12}); assert.equal(c.roster[0].initiative, 12);
  c.turnIndex = D.ordered(c).findIndex(r => r.id === 'b');
  const res = D.rollGroup(c, 'G', [], faces(10)); assert.equal(res.total, 16); assert.equal(res.count, 3);
  deep(c.roster.filter(r => r.grp).map(r => r.initiative), [16, 16, 16]);
  const order = D.ordered(c).map(r => r.id); deep(order.slice(0, 3), ['g1', 'g2', 'g3'], 'the group is together at the top');
  assert.equal(D.ordered(c)[c.turnIndex].id, 'b', 'the turn did not move');
  assert.equal(D.rollGroup(c, 'nope', [], faces()), null);
});

test('roll for everyone: a group takes one die, the round restarts, held marks are cleared', () => {
  const D = load().CombatDock, c = fixture(); c.round = 3; c.turnIndex = 2; c.roster[0].held = true;
  const res = D.rollAll(c, [], faces(3, 8, 1)); assert.equal(res.length, 3, 'a, the group, b');
  assert.equal(c.roster.find(r => r.id === 'a').initiative, 9); deep(c.roster.filter(r => r.grp).map(r => r.initiative), [14, 14, 14]); assert.equal(c.roster.find(r => r.id === 'b').initiative, 7);
  assert.equal(c.round, 1); assert.equal(c.turnIndex, 0); assert.equal(c.roster[0].held, undefined);
  deep(D.ordered(c).map(r => r.id).slice(0, 3), ['g1', 'g2', 'g3']);
});

test('a hit on an opponent: SP stops it, one point wears off, the head takes double, a critical adds 5, mortal is noticed', () => {
  const D = load().CombatDock, r = npc('x', 0, {sp: {head: 4, body: 7}});
  let h = D.hitRow(r, 10, {loc: 'body'}); assert.equal(h.through, 3); assert.equal(h.hp, 7); deep(plain(r.sp), {head: 4, body: 6});
  h = D.hitRow(r, 5, {loc: 'head'}); assert.equal(h.dealt, 2); assert.equal(r.hp, 5); assert.equal(r.sp.head, 3);
  h = D.hitRow(r, 3, {loc: 'body'}); assert.equal(h.stopped, true); assert.equal(r.hp, 5);
  h = D.hitRow(r, 8, {loc: 'body', crit: true}); assert.equal(h.dealt, 7); assert.equal(r.hp, 0); assert.equal(h.nowMortal, true);
  h = D.hitRow(r, 9, {loc: 'body'}); assert.equal(r.deathPenalty, 1, 'a hit on someone already at 0 raises the death penalty');
  for (const bad of [0, 1000, 2.5, NaN, '5']) assert.equal(D.hitRow(npc('y', 0), bad, {}).ok, false);
  assert.equal(D.hitRow({kind: 'pc'}, 5, {}).ok, false);
});

test('the same hit on a whole group touches only the members still standing; «remove the fallen» takes the rest', () => {
  const D = load().CombatDock, c = fixture(); c.roster.forEach(r => { if (r.grp) { r.sp = {head: 0, body: 2}; } });
  c.roster.find(r => r.id === 'g1').hp = 0;
  let res = D.groupHit(c, 'G', 8, {loc: 'body'}); deep(plain(res), {ok: true, targets: 2, hit: 2, fell: 0});
  assert.equal(c.roster.find(r => r.id === 'g2').hp, 4); assert.equal(c.roster.find(r => r.id === 'g1').hp, 0);
  res = D.groupHit(c, 'G', 9, {loc: 'body'}); assert.equal(res.fell, 2);
  assert.equal(D.groupHit(c, 'G', 5, {}).reason, 'none'); assert.equal(D.groupHit(c, 'nope', 5, {}).ok, false); assert.equal(D.groupHit(c, 'G', 0, {}).ok, false);
  const g = D.groupsOf(c).get('G'); assert.equal(D.standing(g).length, 0); deep(g.members.filter(D.isFallen).map(r => r.id), ['g1', 'g2', 'g3']);
});

test('a hit on a player character uses the sheet SP and the pad arithmetic', () => {
  const w = load(), D = w.CombatDock, pc = vega();
  let h = D.pcHit(pc, 15, {loc: 'body'}); assert.equal(h.sp, 11); assert.equal(h.dealt, 4); assert.equal(h.to, 36);
  h = D.pcHit(pc, 10, {loc: 'head'}); assert.equal(h.dealt, 6, 'head: (10 − 7) × 2');
  h = D.pcHit(pc, 20, {loc: 'body', crit: true}); assert.equal(h.dealt, 9 + 5);
  assert.equal(D.pcHit(pc, 0, {}).ok, false);
});

test('removing rows keeps the turn with the same actor, and the undo puts them back where they were', () => {
  const D = load().CombatDock, c = fixture(); c.turnIndex = 4; // b
  const groups = plain(c.groups), taken = D.removeRows(c, ['a', 'g2']);
  assert.equal(taken.length, 2); assert.equal(c.roster.length, 3); assert.equal(D.ordered(c)[c.turnIndex].id, 'b'); assert.equal(c.groups.length, 1);
  assert.equal(D.restoreRows(c, taken, groups), 2); deep(c.roster.map(r => r.id), ['a', 'g1', 'g2', 'g3', 'b']); assert.equal(D.ordered(c)[c.turnIndex].id, 'b');
  assert.equal(D.restoreRows(c, taken, groups), 0, 'a second undo changes nothing');
  const rest = D.removeRows(c, ['g1', 'g2', 'g3']); assert.equal(c.groups, undefined, 'an empty group is dropped'); D.restoreRows(c, rest, groups); assert.equal(c.groups.length, 1);
  deep(D.removeRows(c, ['zzz']), []);
});

test('critical injury roll: 2d6 on the table of the place, from the single table', () => {
  const w = load(), D = w.CombatDock;
  const r = D.critRoll('body', 'en', faces(3, 4)); assert.equal(r.total, 7); assert.equal(r.name, 'Foreign Object'); assert.equal(r.effect, w.CritInjuries.row('body', 7).effect.en);
  const h = D.critRoll('head', 'ru', faces(6, 6)); assert.equal(h.name, 'Потеря уха'); assert.equal(D.critRoll('leg', 'en', faces(1, 1)).location, 'body');
});

test('the model of a row: wound states, SP of the row or of the sheet, HP bar', () => {
  const D = load().CombatDock, pc = vega();
  const m = D.modelOf({id: 'r1', kind: 'pc', characterId: 'p1', initiative: 11}, [pc], 'en', {}, null);
  assert.equal(m.name, 'Vega'); assert.equal(m.max, 45); assert.equal(m.hp, 40); assert.equal(m.pct, 89); assert.equal(m.wound, 'light'); deep(plain(m.sp), {body: 11, head: 7});
  pc.hp = 20; assert.equal(D.modelOf({id: 'r1', kind: 'pc', characterId: 'p1'}, [pc], 'en', {}, null).wound, 'serious'); pc.hp = 0;
  const mm = D.modelOf({id: 'r1', kind: 'pc', characterId: 'p1'}, [pc], 'en', {}, null); assert.equal(mm.wound, 'mortal'); deep(plain(mm.chips), [['mortal', 'mortal']]);
  const lost = D.modelOf({id: 'r2', kind: 'pc', characterId: 'gone'}, [pc], 'ru', {}, null); assert.equal(lost.name, 'Лист не найден');
  const n = D.modelOf(npc('n', 3, {hp: 4, maxHp: 10, out: true, held: true, sp: {head: 1, body: 2}}), [], 'en', {}, null);
  assert.equal(n.wound, 'serious'); assert.equal(n.pct, 40); deep(plain(n.chips).map(x => x[0]), ['serious', 'out', 'held']); deep(plain(n.sp), {body: 2, head: 1});
  assert.equal(D.modelOf(npc('d', 0, {dead: true, hp: 0}), [], 'en', {}, null).wound, 'dead');
});

test('the tools: search by name or by what you want to do; the actor fills in the numbers it knows', () => {
  const D = load().CombatDock;
  assert.equal(D.filterTools('', 'ru').length, 8); deep(plain(D.filterTools('автоогонь', 'ru')), ['autofire']); deep(plain(D.filterTools('Grenade', 'en')), ['area']);
  deep(plain(D.filterTools('qwerty', 'en')), []); assert.ok(D.filterTools('крит', 'ru').includes('overview'));
  const pc = D.modelOf({id: 'r1', kind: 'pc', characterId: 'p1'}, [vega()], 'en', {}, null), f = Object.fromEntries(D.prefillFor(pc));
  assert.equal(f['[data-ct-sp]'], '11'); assert.equal(f['[data-af-sp]'], '11'); assert.equal(f['[data-ct-cover-hp]'], '40'); assert.equal(f['[data-ct-check-stat]'], '7'); assert.equal(f['[data-ct-check-dex]'], '6');
  const n = D.modelOf(npc('n', 3, {sp: {head: 1, body: 6}, ref: 9}), [], 'en', {}, null), g = Object.fromEntries(D.prefillFor(n));
  assert.equal(g['[data-area-sp]'], '6'); assert.equal(g['[data-af-target-ref]'], '9'); assert.equal(g['[data-ct-check-stat]'], undefined, 'an opponent does not give an attack stat');
  deep(D.prefillFor(null), []);
});

test('the quick combat survives a reload only as clean data', () => {
  const D = load().CombatDock;
  assert.equal(D.newQuick('en').quick, true); assert.equal(D.newQuick('ru').name, 'Быстрый бой');
  assert.equal(D.readQuick('{not json', 'en').roster.length, 0); assert.equal(D.readQuick(null, 'en').roster.length, 0); assert.equal(D.readQuick({roster: 'x'}, 'en').roster.length, 0);
  const q = D.readQuick(JSON.stringify({name: 'Alley', round: 3, turnIndex: 9, groups: [{id: 'G', name: 'Boosters', ref: 4}, {id: 'ghost'}], roster: [
    {id: 'a', kind: 'npc', name: 'A', hp: 12, maxHp: 12, ref: 99, initiative: 9999, sp: {head: 40, body: 3}, grp: 'G', out: true, combatNote: {version: 1, text: 'x'}, evil: '<script>'},
    {id: 'a', kind: 'npc'}, {id: 'p', kind: 'pc'}, null, {kind: 'npc'}, {id: 'b', kind: 'npc', hp: -4}]}), 'en');
  assert.equal(q.name, 'Alley'); assert.equal(q.round, 3); assert.equal(q.roster.length, 2); assert.equal(q.turnIndex, 1);
  const a = q.roster[0]; assert.equal(a.ref, 20); assert.equal(a.initiative, 999); deep(plain(a.sp), {head: 30, body: 3}); assert.equal(a.evil, undefined); assert.equal(a.out, true); assert.equal(q.roster[1].hp, 0);
  assert.equal(q.groups.length, 1); assert.equal(q.groups[0].id, 'G');
  assert.equal(D.readQuick({roster: Array.from({length: 201}, (_, i) => ({id: 'r' + i, kind: 'npc'}))}, 'en').roster.length, 201, 'a long fight is kept, not wiped');
});

// ---------- the page ----------
function ctxOf(c, extra = {}) {
  const log = {saves: 0, renders: 0, notes: [], actions: []};
  return {log, ctx: {lang: 'en', campaigns: c ? [c] : [], characters: [], save: () => { log.saves++; }, render: () => { log.renders++; }, notify: m => log.notes.push(m), notifyAction: (m, l, fn) => log.actions.push({m, l, fn}), isCurrent: k => k === c, ...extra}};
}
test('the page: banner with the current actor and a big next button, one-line rows, a group with a pip for each member, the tools drawer', () => {
  const w = load(), D = w.CombatDock, c = fixture(), {ctx} = ctxOf(c); D.resetUi();
  const html = D.page(ctx);
  assert.match(html, /data-combat-dock/); assert.match(html, /class="cd-banner"[^>]*aria-label="Current turn"/); assert.match(html, /data-cd-action="next"[^>]*>Next turn/);
  assert.match(html, /<h1 tabindex="-1">Combat · Job<\/h1>/); assert.match(html, /<b>1<\/b>/, 'round 1');
  assert.equal((html.match(/data-cd-row="/g) || []).length, 2, 'a and b are rows; the three members of G are one group');
  assert.match(html, /data-cd-group="G"/); assert.match(html, /Boosters ×3/); assert.equal((html.match(/class="cd-pip"/g) || []).length, 3);
  assert.match(html, /aria-label="G1: HP 10 of 10"/); assert.match(html, /role="group" aria-label="Members of the group"/);
  assert.match(html, /aria-expanded="false" aria-controls="cd-act-a"/); assert.doesNotMatch(html, /data-cd-panel/, 'no actions are open at first');
  assert.match(html, /data-cd-tools[\s\S]*aria-expanded="false"/); assert.doesNotMatch(html, /undefined|NaN|\[object/);
  assert.match(html, /data-cd-campaign[\s\S]*<option value="k" selected>Job<\/option>[\s\S]*Quick combat \(temporary\)/);
});

test('the open row shows its actions; the open group shows the bulk hit and the stat block; both languages have no gaps', () => {
  const D = load().CombatDock, c = fixture(), {ctx} = ctxOf(c); c.roster[0].sp = {head: 1, body: 6};
  for (const lang of ['en', 'ru']) {
    ctx.lang = lang; D.resetUi(); D.ui.sel = 'a'; D.ui.tools = true; D.ui.tool = 'weapons';
    let html = D.page(ctx);
    assert.match(html, /data-cd-panel="a"/); assert.match(html, /data-cd-action="hp-pad"/); assert.match(html, /data-cd-raw/); assert.match(html, /data-cd-action="hit"/); assert.match(html, /data-cd-action="crit-roll"[^>]*data-loc="head"/);
    assert.match(html, lang === 'en' ? /SP: Body 6, Head 1/ : /SP: Тело 6, Голова 1/); assert.match(html, /data-cd-init="a"/); assert.match(html, /data-cd-tool-body="weapons"/);
    D.ui.sel = 'g:G'; html = D.page(ctx);
    assert.match(html, /data-cd-panel="g:G"/); assert.match(html, /data-cd-action="group-hit"/); assert.match(html, /data-cd-action="remove-fallen"/); assert.match(html, /data-cd-g="spBody"/); assert.match(html, /data-cd-g="note"/);
    D.ui.sel = 'g2'; html = D.page(ctx); assert.match(html, /data-cd-panel="g:G"[\s\S]*data-cd-panel="g2"/, 'a member opens inside its group');
    assert.doesNotMatch(html, /undefined|NaN|\[object/);
    const text = D.page(ctx).replace(/<[^>]*>/g, ' '); if (lang === 'en') assert.doesNotMatch(text.replace(/G\d|Boosters/g, ''), /[А-Яа-я]/, 'no Russian words on the English page');
  }
});

test('names are escaped; a mortal opponent gets the Death Save row; an out row is marked', () => {
  const D = load().CombatDock, c = {id: 'k', name: '<b>Job</b>', round: 1, turnIndex: 0, roster: [npc('x', 9, {name: '<img src=x onerror=alert(1)>', hp: 0, maxHp: 10}), npc('y', 3, {out: true})]}, {ctx} = ctxOf(c);
  D.resetUi(); D.ui.sel = 'x'; const html = D.page(ctx);
  assert.doesNotMatch(html, /<img src=x/); assert.match(html, /&lt;img src=x onerror=alert\(1\)&gt;/); assert.match(html, /&lt;b&gt;Job&lt;\/b&gt;/);
  assert.match(html, /data-cd-body/); assert.match(html, /data-cd-action="death-save"/); assert.match(html, /data-out="true"/);
});

test('without a campaign the page offers the quick combat; the quick combat is its own fight and is kept out of the saved campaigns', () => {
  const D = load().CombatDock, {ctx, log} = ctxOf(null); D.resetUi();
  assert.match(D.page(ctx), /data-cd-mode="empty"[\s\S]*data-cd-action="quick-new"/);
  const click = fake('quick-new'); assert.equal(D.handle(click.e, ctx), true); assert.equal(D.ui.camp, 'quick'); assert.equal(log.renders, 1); assert.equal(log.saves, 0);
  const html = D.page(ctx); assert.match(html, /data-cd-mode="quick"/); assert.match(html, /Quick combat/); assert.match(html, /data-cd-action="quick-save"/); assert.doesNotMatch(html, /data-cd-pc/, 'no sheets are added to a quick combat');
});

// ---------- the event handler ----------
function fake(action, dataset = {}, fields = {}, panelFields = fields) {
  const root = {contains: () => true, querySelector: s => fields[s] || null, querySelectorAll: () => []};
  const panel = {querySelector: s => panelFields[s] || null};
  const b = {dataset: {cdAction: action, ...dataset}, closest: s => (s === '[data-cd-action]' ? b : s === '[data-combat-dock]' ? root : s === '[data-cd-panel]' ? panel : null), matches: () => false};
  return {e: {type: 'click', target: b}, b, root};
}
const change = (dataset, value = '', matches = []) => { const root = {querySelector: () => null}, el = {dataset, value, closest: s => (s === '[data-combat-dock]' ? root : null), matches: s => matches.includes(s)}; return {type: 'change', target: el}; };

test('next turn moves the order, saves, redraws, puts the round into the journal and moves focus back to the button', () => {
  const w = load({ClockTriggers: {round() { w.ClockTriggers.calls.push([...arguments]); }, calls: []}}), D = w.CombatDock, c = fixture(), {ctx, log} = ctxOf(c); D.resetUi();
  assert.equal(D.handle(fake('next').e, ctx), true); assert.equal(D.ordered(c)[c.turnIndex].id, 'g1'); assert.equal(log.saves, 1); assert.equal(log.renders, 1);
  D.handle(fake('next').e, ctx); D.handle(fake('next').e, ctx); assert.equal(c.round, 2); assert.equal(w.ClockTriggers.calls.length, 1); deep(plain(w.ClockTriggers.calls[0]), ['k', 1, 2]);
  assert.match(c.journal[0].text, /Round 2 started/); deep(plain(D.ui.focus), {act: 'next', id: null});
  D.handle(fake('prev').e, ctx); assert.equal(c.round, 1, 'back from the first turn of round 2 is the last turn of round 1'); assert.equal(w.ClockTriggers.calls.length, 2); deep(plain(D.ui.focus), {act: 'next', id: null}, 'a button of the closed menu hands focus to «Next turn»');
});

test('a stale tracker (the data changed since the page was drawn) does nothing and says so', () => {
  const D = load().CombatDock, c = fixture(), {ctx, log} = ctxOf(c, {isCurrent: () => false}); D.resetUi();
  assert.equal(D.handle(fake('next').e, ctx), true); assert.equal(c.round, 1); assert.equal(c.turnIndex, 0); assert.equal(log.saves, 0); assert.equal(log.notes.length, 1);
});

test('the quick combat is saved in the tab, never through the app save', () => {
  const store = {}, D = load({sessionStorage: {getItem: k => store[k] ?? null, setItem: (k, v) => { store[k] = v; }, removeItem: k => { delete store[k]; }}}).CombatDock, {ctx, log} = ctxOf(null); D.resetUi();
  D.handle(fake('quick-new').e, ctx);
  D.handle(fake('add-npc', {}, {'[data-cd-new="name"]': {value: 'Ganger'}, '[data-cd-new="count"]': {value: '2'}, '[data-cd-new="ref"]': {value: '6'}, '[data-cd-new="hp"]': {value: '10'}, '[data-cd-new="spHead"]': {value: ''}, '[data-cd-new="spBody"]': {value: '3'}, '[data-cd-new="note"]': {value: ''}}).e, ctx);
  assert.equal(D.ui.quick.roster.length, 2); assert.equal(log.saves, 0); assert.equal(JSON.parse(store['nightcity-red-quick-combat']).roster.length, 2);
  D.handle(fake('next').e, ctx); assert.equal(log.saves, 0);
  // a reload: the module starts empty and finds the same fight in the tab
  const D2 = load({sessionStorage: {getItem: k => store[k] ?? null, setItem() {}, removeItem() {}}}).CombatDock; D2.resetUi();
  assert.equal(D2.target({lang: 'en', campaigns: []}).roster.length, 2);
  // saved as a campaign: it joins the list once and the temporary one is gone
  D.handle(fake('quick-save').e, ctx); assert.equal(ctx.campaigns.length, 1); assert.equal(log.saves, 1); assert.equal(ctx.campaigns[0].quick, undefined); assert.equal(ctx.campaigns[0].roster.length, 2); assert.equal(D.ui.quick, null); assert.equal(store['nightcity-red-quick-combat'], undefined);
  D.handle(fake('quick-new').e, ctx); D.handle(fake('quick-end').e, ctx); assert.equal(D.ui.quick, null);
});

test('a hit on an opponent through the row: damage field, place, critical; SP comes from the row', () => {
  const w = load(), D = w.CombatDock, c = {id: 'k', name: 'J', round: 1, turnIndex: 0, roster: [npc('x', 9, {sp: {head: 2, body: 5}})]}, {ctx, log} = ctxOf(c); D.resetUi();
  const panel = {'[data-cd-raw]': {value: '12'}, '[data-cd-loc]': {value: 'body'}, '[data-cd-crit]': {checked: false}};
  D.handle(fake('hit', {id: 'x'}, {}, panel).e, ctx); assert.equal(c.roster[0].hp, 3); assert.equal(c.roster[0].sp.body, 4); assert.equal(log.saves, 1); assert.match(log.notes.at(-1), /X: hit 12, armor 5, through 7, HP 3/);
  panel['[data-cd-raw]'].value = 'abc'; D.handle(fake('hit', {id: 'x'}, {}, panel).e, ctx); assert.equal(c.roster[0].hp, 3); assert.match(log.notes.at(-1), /Enter damage/);
  panel['[data-cd-raw]'].value = '3'; D.handle(fake('hit', {id: 'x'}, {}, panel).e, ctx); assert.match(log.notes.at(-1), /stopped/); assert.equal(c.roster[0].hp, 3);
});

test('a hit on a player character goes through the sheet rules and the campaign HP guard', () => {
  const w = load(), D = w.CombatDock, pc = vega(), c = {id: 'k', name: 'J', round: 1, turnIndex: 0, roster: [{id: 'r1', kind: 'pc', characterId: 'p1', initiative: 9}]}, {ctx, log} = ctxOf(c, {characters: [pc]}); D.resetUi();
  const panel = {'[data-cd-raw]': {value: '15'}, '[data-cd-loc]': {value: 'body'}, '[data-cd-crit]': {checked: false}};
  D.handle(fake('hit', {id: 'r1'}, {}, panel).e, ctx); assert.equal(pc.hp, 36); assert.equal(log.saves, 1); assert.match(log.notes.at(-1), /Vega: hit 15, armor 11, through 4, HP 36/);
  panel['[data-cd-raw]'].value = '9'; D.handle(fake('hit', {id: 'r1'}, {}, panel).e, ctx); assert.equal(pc.hp, 36); assert.match(log.notes.at(-1), /stopped/);
});

test('the health pad opens for a row with its SP; a pad hit on an opponent changes only that row', () => {
  const opened = [], w = load({HpPad: {open: (t, o) => { opened.push({t, o}); return true; }}}, ['rolls.js', 'crit-injuries.js', 'combat-tools.js', 'campaigns.js', 'combat-dock.js']);
  const D = w.CombatDock, c = {id: 'k', name: 'J', round: 1, turnIndex: 0, roster: [npc('x', 9, {sp: {head: 1, body: 6}}), npc('y', 3)]}, {ctx, log} = ctxOf(c); D.resetUi();
  D.handle(fake('hp-pad', {id: 'x'}).e, ctx); assert.equal(opened.length, 1);
  const t = opened[0].t; assert.equal(t.hp(), 10); assert.equal(t.max(), 10); deep(plain(t.sp()), {body: 6, head: 1}); assert.equal(opened[0].o.lang, 'en');
  deep(plain(t.setHp(4, {reason: 'damage'})), {ok: true, hp: 4}); assert.equal(c.roster[0].hp, 4); assert.equal(c.roster[1].hp, 10); assert.equal(log.saves, 1);
  t.setHp(99999, {}); assert.equal(c.roster[0].hp, 999); t.setHp(-5, {}); assert.equal(c.roster[0].hp, 0, 'an opponent never goes below 0');
  const stale = ctxOf(c, {isCurrent: () => false}); const t2 = (() => { D.handle(fake('hp-pad', {id: 'x'}).e, ctx); return opened[1].t; })(); ctx.isCurrent = () => false;
  assert.equal(t2.setHp(1, {}), false); assert.equal(c.roster[0].hp, 0); assert.ok(stale.log);
});

test('a bulk hit and «remove the fallen» with an undo that works once and refuses when the fight changed', () => {
  const D = load().CombatDock, c = fixture(), {ctx, log} = ctxOf(c); D.resetUi(); c.roster.forEach(r => { if (r.grp) { r.sp = {head: 0, body: 0}; } }); c.roster.find(r => r.id === 'g3').hp = 4;
  const panel = {'[data-cd-raw]': {value: '6'}, '[data-cd-loc]': {value: 'body'}, '[data-cd-crit]': {checked: false}};
  D.handle(fake('group-hit', {grp: 'G'}, {}, panel).e, ctx); deep(c.roster.filter(r => r.grp).map(r => r.hp), [4, 4, 0]); assert.match(D.ui.result.text, /Hit: 3, fell: 1/);
  D.handle(fake('remove-fallen', {grp: 'G'}).e, ctx); assert.equal(c.roster.length, 4); assert.equal(log.actions.length, 1); assert.match(log.actions[0].m, /Removed: 1/);
  log.actions[0].fn(); assert.equal(c.roster.length, 5); assert.match(log.notes.at(-1), /Restored: 1/);
  log.actions[0].fn(); assert.match(log.notes.at(-1), /try again/i, 'the second press finds nothing to restore');
  D.handle(fake('remove-fallen', {grp: 'G'}).e, ctx); assert.equal(c.roster.length, 4, 'the fallen member is removed again');
  c.roster.length = 0; c.roster.push(...fixture().roster); c.groups = fixture().groups; D.handle(fake('remove-fallen', {grp: 'G'}).e, ctx); assert.match(D.ui.result.text, /Nobody has fallen/);
  // an undo of a fight that has been replaced does nothing
  c.roster.find(r => r.id === 'g3').hp = 0; D.handle(fake('remove-fallen', {grp: 'G'}).e, ctx); const n = c.roster.length; assert.equal(n, 4); ctx.isCurrent = () => false; log.actions.at(-1).fn(); assert.equal(c.roster.length, n);
});

test('removing one row can be undone from the notice; the turn follows the actor', () => {
  const D = load().CombatDock, c = fixture(), {ctx, log} = ctxOf(c); D.resetUi(); c.turnIndex = 4;
  D.handle(fake('remove', {id: 'a'}).e, ctx); assert.equal(c.roster.length, 4); assert.equal(D.ordered(c)[c.turnIndex].id, 'b'); log.actions[0].fn(); assert.equal(c.roster.length, 5); assert.equal(D.ordered(c)[c.turnIndex].id, 'b');
  D.handle(fake('clear-npcs').e, ctx); assert.equal(c.roster.length, 0); log.actions.at(-1).fn(); assert.equal(c.roster.length, 5); assert.equal(c.groups.length, 1);
});

test('initiative rolls go through rolls.js: the die, the history line, the group shares one number', () => {
  const reports = [], w = load({App: {report: (...a) => { reports.push(a); return true; }}}), D = w.CombatDock, c = fixture(), {ctx} = ctxOf(c); D.resetUi();
  w.Rolls.setRng(() => 0.45); // d10 = 5
  D.handle(fake('roll-one', {id: 'a'}).e, ctx); assert.equal(c.roster[0].initiative, 11); assert.equal(reports.length, 1); assert.match(reports[0][0], /Initiative · A/); assert.equal(reports[0][2], 11);
  D.handle(fake('roll-group', {grp: 'G'}).e, ctx); deep(c.roster.filter(r => r.grp).map(r => r.initiative), [11, 11, 11]); assert.equal(reports.length, 2); assert.match(reports[1][0], /Boosters ×3/);
  D.handle(fake('roll-all').e, ctx); assert.equal(reports.length, 3); assert.equal(c.round, 1);
  w.Rolls.setRng(null);
});

test('critical injury and Death Save rolls go through rolls.js and land in the note / journal', () => {
  const reports = [], w = load({App: {report: (...a) => { reports.push(a); return true; }}}), D = w.CombatDock, c = {id: 'k', name: 'J', round: 1, turnIndex: 0, roster: [npc('x', 9), npc('z', 3, {hp: 0})]}, {ctx, log} = ctxOf(c); D.resetUi();
  let n = 0; w.Rolls.setRng(() => [0.5, 0.17][n++ % 2]); // 4 then 2 → total 6
  D.handle(fake('crit-roll', {id: 'x', loc: 'body'}).e, ctx); assert.match(D.ui.result.text, /Critical Injury \(2d6 = 6\): Broken Arm/); assert.match(c.roster[0].combatNote.text, /Broken Arm \(6\)/); assert.equal(reports.length, 1);
  w.Rolls.setRng(() => 0.45);
  D.handle(fake('death-save', {id: 'z'}, {}, {'[data-cd-body]': {value: '30'}}).e, ctx); assert.match(log.notes.at(-1), /BODY from 1 to 20/);
  D.handle(fake('death-save', {id: 'z'}, {}, {'[data-cd-body]': {value: '5'}}).e, ctx);
  assert.match(log.notes.at(-1), /Death Save failed \(d10 5 \+ penalty 0, BODY 5\)/); assert.equal(c.roster[1].dead, true); assert.equal(c.roster[1].out, true); assert.equal(reports.length, 2);
  w.Rolls.setRng(null);
});

test('adding a character and a book template; a campaign selector change; stat fields of a group', () => {
  const tpl = {id: 't', name: {ru: 'Бандит', en: 'Bandit'}, stats: {REF: 6, BODY: 6}, hp: 20, page: 1, armor: {headSP: 4, bodySP: 4}, weapons: []};
  const w = load({GMTools: {NPC_TEMPLATES: [tpl]}}), D = w.CombatDock, pc = vega(), c = fixture(), c2 = {id: 'k2', name: 'Other', round: 1, turnIndex: 0, roster: []}, {ctx, log} = ctxOf(c, {characters: [pc], campaigns: [c, c2]}); D.resetUi();
  D.handle(fake('add-pc', {}, {'[data-cd-pc]': {value: 'p1'}}).e, ctx); assert.equal(c.roster.filter(r => r.kind === 'pc').length, 1);
  D.handle(fake('add-pc', {}, {'[data-cd-pc]': {value: 'p1'}}).e, ctx); assert.equal(c.roster.filter(r => r.kind === 'pc').length, 1, 'the same sheet is not added twice');
  D.handle(fake('add-template', {}, {'[data-cd-tpl]': {value: 't'}, '[data-cd-tpl-count]': {value: '3'}}).e, ctx);
  const added = c.roster.filter(r => r.sourceTemplate === 't'); assert.equal(added.length, 3); assert.equal(new Set(added.map(r => r.grp)).size, 1); assert.ok(added[0].grp);
  assert.equal(D.handle(change({cdG: 'ref', grp: 'G'}, '8'), ctx), true); deep(c.roster.filter(r => r.grp === 'G').map(r => r.ref), [8, 8, 8]); assert.equal(log.notes.at(-1), 'Saved');
  assert.equal(D.handle(change({cdG: 'ref', grp: 'G'}, '99'), ctx), true); deep(c.roster.filter(r => r.grp === 'G').map(r => r.ref), [8, 8, 8]);
  D.handle(change({cdInit: 'a'}, '20'), ctx); assert.equal(c.roster.find(r => r.id === 'a').initiative, 20);
  const sel = change({}, 'k2', ['[data-cd-campaign]']); assert.equal(D.handle(sel, ctx), true); assert.equal(D.ui.camp, 'k2'); assert.equal(D.target(ctx), c2);
});

test('selecting a row opens it and puts the picked character where the sheet blocks look; tools open with the actor', () => {
  const state = {view: 'combat', active: null}, w = load({App: {getState: () => state}}), D = w.CombatDock, pc = vega(), c = {id: 'k', name: 'J', round: 1, turnIndex: 0, roster: [{id: 'r1', kind: 'pc', characterId: 'p1', initiative: 9}, npc('x', 3)]}, {ctx} = ctxOf(c, {characters: [pc]}); D.resetUi();
  D.handle(fake('select', {id: 'r1'}).e, ctx); assert.equal(D.ui.sel, 'r1'); assert.equal(state.active, 'p1');
  D.handle(fake('select', {id: 'x'}).e, ctx); assert.equal(state.active, null); D.handle(fake('select', {id: 'x'}).e, ctx); assert.equal(D.ui.sel, null);
  D.handle(fake('tools-for', {id: 'x'}).e, ctx); assert.equal(D.ui.tools, true); assert.equal(D.ui.tool, 'overview');
  D.handle(fake('tool', {tool: 'autofire'}).e, ctx); assert.equal(D.ui.tool, 'autofire'); D.handle(fake('tool', {tool: 'autofire'}).e, ctx); assert.equal(D.ui.tool, '');
  D.handle(fake('tools-toggle').e, ctx); assert.equal(D.ui.tools, false);
});

test('the sheet blocks are optional: moves, cyberweapons and programs show only when their modules give something', () => {
  const D0 = load().CombatDock, pc = vega(), c = {id: 'k', name: 'J', round: 1, turnIndex: 0, roster: [{id: 'r1', kind: 'pc', characterId: 'p1', initiative: 9}]}, {ctx} = ctxOf(c, {characters: [pc]});
  D0.resetUi(); D0.ui.sel = 'r1'; assert.doesNotMatch(D0.page(ctx), /ma-known|cw-block|cd-programs/);
  const w = load({MartialArts: {renderKnown: () => '<section class="ma-known">MOVES</section>'}, Cyberweapons: {render: () => '<section class="cw-block">CYBER</section>'},
    NetrunDeck: {decksOf: () => [{name: 'Street deck', entries: [{name: {ru: 'Меч', en: 'Sword'}}, {name: {ru: 'Щит', en: 'Shield'}}]}]}}), D = w.CombatDock; D.resetUi(); D.ui.sel = 'r1';
  let html = D.page(ctx); assert.match(html, /MOVES/); assert.match(html, /CYBER/); assert.match(html, /<b>Street deck<\/b>: Sword, Shield/);
  ctx.lang = 'ru'; html = D.page(ctx); assert.match(html, /Меч, Щит/);
  const boom = load({MartialArts: {renderKnown() { throw new Error('x'); }}, NetrunDeck: {decksOf() { throw new Error('y'); }}}).CombatDock; boom.resetUi(); boom.ui.sel = 'r1'; assert.doesNotThrow(() => boom.page(ctx));
  // opponents have none of these
  c.roster = [npc('x', 1)]; D.ui.sel = 'x'; assert.doesNotMatch(D.page(ctx), /MOVES|CYBER|cd-programs/);
});

test('the search box hides tool buttons in place', () => {
  const D = load().CombatDock, c = fixture(), {ctx} = ctxOf(c); D.resetUi();
  const btns = D.TOOLS.map(t => ({dataset: {tool: t.id}, hidden: false})), none = {hidden: true};
  const root = {querySelectorAll: () => btns, querySelector: s => (s === '[data-cd-tools-none]' ? none : null)};
  const el = {value: 'граната', matches: s => s === '[data-cd-tools-search]', closest: s => (s === '[data-combat-dock]' ? root : null)};
  assert.equal(D.handle({type: 'input', target: el}, ctx), true); deep(btns.filter(b => !b.hidden).map(b => b.dataset.tool), ['area']); assert.equal(none.hidden, true);
  el.value = 'zzz'; D.handle({type: 'input', target: el}, ctx); assert.equal(btns.every(b => b.hidden), true); assert.equal(none.hidden, false); assert.equal(D.ui.q, 'zzz');
});

test('events outside the page are not taken, and a failing handler does not break the app', () => {
  const D = load().CombatDock, {ctx} = ctxOf(fixture());
  assert.equal(D.handle({type: 'click', target: {closest: () => null}}, ctx), false); assert.equal(D.handle({type: 'click', target: null}, ctx), false); assert.equal(D.handle({}, ctx), false);
  const f = fake('next'); f.b.closest = s => { if (s === '[data-cd-action]') throw new Error('boom'); return f.root; };
  assert.equal(D.handle(f.e, ctx), true);
});

test('both languages have the same words, every function word gives text, nothing is empty', () => {
  const D = load().CombatDock, ru = Object.keys(D.T.ru).sort(), en = Object.keys(D.T.en).sort();
  deep(ru, en);
  for (const k of ru) {
    assert.equal(typeof D.T.ru[k], typeof D.T.en[k], k);
    for (const l of ['ru', 'en']) { const v = typeof D.T[l][k] === 'function' ? D.T[l][k]('A', 2, 3, 4, 5) : D.T[l][k]; assert.ok(typeof v === 'string' && v.trim().length, `${l}.${k}`); assert.doesNotMatch(v, /undefined|NaN/, `${l}.${k}`); }
  }
  for (const t of D.TOOLS) assert.ok(t.ru && t.en);
});

test('the page works for a campaign of 200 rows without a slow draw', () => {
  const D = load().CombatDock, c = {id: 'k', name: 'Big', round: 1, turnIndex: 0, roster: Array.from({length: 200}, (_, i) => npc('n' + i, i % 20, {order: i}))}, {ctx} = ctxOf(c); D.resetUi();
  const t0 = Date.now(), html = D.page(ctx); assert.ok(Date.now() - t0 < 2000); assert.equal((html.match(/data-cd-row="/g) || []).length, 200);
});

test('files: the page is registered before app.js, the styles keep 44 px targets, and the page is the route of #/combat', () => {
  const html = read('index.html'), at = f => html.indexOf(`<script src="${f}"></script>`);
  assert.ok(at('combat-dock.js') > at('campaigns.js') && at('combat-dock.js') < at('app.js') && html.lastIndexOf('<script src=') === at('app.js') - '<script src="'.length + 0 || html.trim().endsWith('</html>'));
  assert.match(html, /<link rel="stylesheet" href="combat-dock\.css">/);
  const css = read('combat-dock.css');
  for (const sel of ['.cd-next', '.cd-pip', '.cd-tool', '.cd-menu summary', '.cd-add > summary']) assert.match(css, new RegExp(sel.replace(/[.>+()]/g, '\\$&') + '[^{]*\\{[^}]*min-(?:height|width): (?:4[4-9]|5\\d)px'), sel);
  assert.match(css, /\.cd \.btn, \.cd button\.btn \{ min-height: 44px; \}/); assert.match(css, /\.cd-hit input\[type="number"\][^{]*\{ min-height: 44px; \}/);
  const app = read('app.js');
  assert.match(app, /function combatView\(\)\{if\(window\.CombatDock\)\{try\{return window\.CombatDock\.page\(combatContext\(\)\)\}/);
  assert.equal((app.match(/window\.CombatDock\?\.handle\(e,combatContext\(\)\)\|\|window\.Campaigns\?\.handle/g) || []).length, 3, 'click, change and input reach the page');
  assert.match(app, /if\(state\.view==='combat'\)window\.CombatDock\?\.after\?\.\(combatContext\(\)\)/);
});
