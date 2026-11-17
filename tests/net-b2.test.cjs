// NET fixes and the architecture generator: REZ +1 on a Derezzed ICE, one NET Action rule for the desk (unlinked and linked) and the tab,
// multiclass netrunners in the combat calculator, Jack In / Jack Out as NET Actions, the GM inbox of player rolls that outlives the page
// (sessionStorage) and shows on every screen, one language in the headings, and site/net-generator.js with the empty state of #/net.
const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm'), test = require('node:test'), assert = require('node:assert/strict');
const read = f => fs.readFileSync(path.join(__dirname, '../site', f), 'utf8');
const plain = x => JSON.parse(JSON.stringify(x));
const FILES = ['catalog.js', 'catalog-extra.js', 'role-tools.js', 'role-play.js', 'netrun-tab.js', 'net-tools.js', 'net-editor.js', 'net-link.js', 'net-generator.js'];
const E = (id, cat, name, kind = 'program', slots = 1) => ({ id, catalogId: cat, name: { ru: name, en: name }, kind, slots });
function setup({ random = 0.5, lang = 'en', files = FILES } = {}) {
  const math = Object.create(Math); math.random = () => random;
  let n = 0;
  const checks = [], notes = [], rolls = [], opposed = [], store = new Map();
  const w = {
    confirm: () => true, document: { addEventListener() {}, querySelector: () => null },
    localStorage: { getItem: k => (store.has(k) ? store.get(k) : null), setItem: (k, v) => store.set(k, String(v)), removeItem: k => store.delete(k) },
    App: {
      lang: () => lang, save() {}, render() {}, notify: m => notes.push(m), rollMods: () => ({ wound: 0, effect: 0 }),
      check: (base, label, o = {}) => { checks.push({ base, label, o }); const total = 5 + base + (Number(o.mod) || 0), dv = o.dv || 0; return { total, beat: dv ? total > dv : null }; },
    },
    Rolls: { sum: () => true, opposed: (...a) => { opposed.push(a); return true; }, check: (label, r) => { rolls.push({ label, r }); return true; } },
  };
  const ctx = { window: w, Math: math, Date, Set, Map, Object, Number, String, Array, JSON, Promise, Uint32Array, setTimeout: () => 0, clearTimeout() {}, console, crypto: { randomUUID: () => 'u' + (++n) } };
  vm.createContext(ctx);
  for (const f of files) vm.runInContext(read(f), ctx, { filename: f });
  const c = {
    id: 'nova', name: 'Nova', role: 'netrunner', rank: 4, hp: 40, stats: {}, skills: {},
    extra: { cyberdecks: { version: 1, decks: [{ id: 'd1', name: 'Street deck', slots: 7, hardwareOnly: 0, entries: [E('worm', 'extra-program-worm', 'Worm'), E('sw', 'extra-program-sword', 'Sword')] }] } },
  };
  const state = { lang, architectures: [], characters: [c] };
  const N = w.NetTools; N.setScope('owner' + Math.random());
  return { w, N, c, state, checks, notes, rolls, opposed, store };
}
const click = (op, extra = {}) => ({ type: 'click', target: { closest: () => ({ dataset: { net: op, ...extra }, getAttribute: () => null, isConnected: true }) } });
const change = (dataset, value) => ({ type: 'change', target: { dataset, value, closest: () => null } });
const ent = (id, type, name, over = {}) => ({ id, type, name, dv: 0, state: type === 'ice' ? 'waiting' : 'closed', preset: '', rez: 0, maxRez: 0, per: 0, spd: 0, atk: 0, def: 0, notes: '', ...over });
function arch(over = {}) {
  return {
    id: 'a1', name: 'Arasaka', access: '', notes: '', rank: 6, modifier: 0, dv: 8, remaining: 3, current: '1',
    floors: [
      { id: 'f1', label: '1', branch: '', parent: '', entries: [ent('p1', 'password', 'Door', { dv: 10 }), ent('i1', 'ice', 'Dragon', { preset: 'Dragon', rez: 30, maxRez: 30, per: 6, spd: 4, atk: 6, def: 6 })] },
      { id: 'f2', label: '2', branch: '', parent: 'f1', entries: [] },
    ], ...over,
  };
}
const run = (s, a) => { s.state.architectures.push(a); s.N.handle(click('open', { id: a.id }), s.state); s.N.handle(click('run-mode-on'), s.state); };
const btn = (dataset = {}) => ({ dataset, getAttribute: () => null });

/* ---------- REZ +1 on a Derezzed ICE ---------- */
test('REZ +1 on a Derezzed ICE brings it back to waiting: the chip, the reset and the player view agree with the number', () => {
  const s = setup(), { w } = s, X = w.NetEditor, a = arch(); run(s, a);
  const ice = a.floors[0].entries[1], press = d => X.handle('run-rez', btn({ floor: 'f1', entry: 'i1', delta: String(d) }), a, 'en');
  ice.rez = 1; ice.state = 'pursuing';
  assert.equal(press(-1).dirty, true); assert.equal(ice.rez, 0); assert.equal(ice.state, 'derezzed');
  assert.match(X.runHtml(a, 'en', {}), /data-state="derezzed">Dragon · REZ 0 · Derezzed/);
  assert.equal(press(1).dirty, true); assert.equal(ice.rez, 1); assert.equal(ice.state, 'waiting', 'REZ above 0 on a derezzed ICE: active again');
  assert.match(X.runHtml(a, 'en', {}), /data-state="waiting">Dragon · REZ 1 · Lying in wait/);
  assert.equal(X.resetDefenses(a), 1, 'the reset sees the ICE as active (REZ 1 of 30), and puts it to full REZ');
  assert.equal(ice.rez, 30); assert.equal(ice.state, 'waiting');
  // an ICE destroyed or marked «other» by the Game Master keeps its own state
  ice.rez = 0; ice.state = 'destroyed'; press(1); assert.equal(ice.state, 'destroyed');
  ice.rez = 0; ice.state = 'other'; press(1); assert.equal(ice.state, 'other');
  ice.rez = 5; ice.state = 'waiting'; press(1); assert.equal(ice.state, 'waiting');
  assert.equal(w.NetTools.validArchitectures([a]), true);
});

/* ---------- One NET Action rule for the desk ---------- */
test('an unlinked desk spends its own NET Action on every roll, and with none left it does not roll', () => {
  const s = setup({ random: 0.8 }), { N, state, rolls } = s, a = arch({ remaining: 2 }); run(s, a);
  let r = N.handle(click('run-roll', { floor: 'f1', entry: 'p1' }), state);
  assert.equal(a.remaining, 1); assert.equal(r.dirty, true); assert.equal(rolls.length, 1);
  assert.equal(a.floors[0].entries[0].state, 'open', 'a success still opens the record');
  a.floors[0].entries[0].state = 'closed';
  N.handle(click('run-roll', { floor: 'f1', entry: 'p1' }), state);
  assert.equal(a.remaining, 0); assert.equal(rolls.length, 2);
  a.floors[0].entries[0].state = 'closed';
  r = N.handle(click('run-roll', { floor: 'f1', entry: 'p1' }), state);
  assert.equal(rolls.length, 2, 'no third roll'); assert.equal(a.remaining, 0); assert.match(r.notify, /No NET Actions remain/);
  N.handle(click('reset'), state); assert.equal(a.remaining, 3, 'New turn refills it');
  assert.match(N.render(state), /NET Actions: 3 \/ 3/);
});

test('the settings roll «Interface against a DV» follows the same rule: unlinked spends the desk counter, linked the sheet', () => {
  const s = setup({ random: 0.5 }), { N, c, state, rolls, checks } = s, a = arch(); s.state.architectures.push(a); N.handle(click('open', { id: a.id }), state);
  let r = N.handle(click('roll'), state);
  assert.equal(r.dirty, true); assert.equal(a.remaining, 2); assert.equal(rolls.length, 1); assert.equal(checks.length, 0);
  a.remaining = 0; r = N.handle(click('roll'), state);
  assert.match(r.notify, /No NET Actions remain/); assert.equal(rolls.length, 1); assert.equal(r.dirty, undefined);
  // linked: the sheet of the runner rolls (rank 4, not the architecture's 6) and its counter is the one that moves
  a.remaining = 3; a.runner = { cid: 'nova' };
  r = N.handle(click('roll'), state);
  assert.equal(r.dirty, true); assert.equal(checks.length, 1); assert.equal(checks[0].base, 4); assert.match(checks[0].label, /^Interface \(Interface 4\)/);
  assert.equal(c.extra.roleTools.netrunner.values.used, 1); assert.equal(a.remaining, 3, 'the desk counter stays out of it');
  assert.match(N.render(state), /INTERFACE CHECK: \d+\s+(?:&gt;|≤)/);
  c.extra.roleTools.netrunner.values.used = 3; r = N.handle(click('roll'), state);
  assert.match(r.notify, /No NET Actions remain/); assert.equal(checks.length, 1);
});

/* ---------- Multiclass netrunners in the calculator ---------- */
test('a multiclass netrunner (additional role) counts in the combat calculator like a primary one', () => {
  const s = setup(), { N, c, state, opposed } = s, w = s.w;
  const fixer = { ...plain(c), id: 'fx', name: 'Fixer Fay', role: 'fixer', rank: 6, extra: { ...plain(c.extra), additionalRoles: [{ role: 'netrunner', rank: 5 }] } };
  state.characters.push(fixer);
  assert.equal(N.runnerRank(c), 4); assert.equal(N.runnerRank(fixer), 5); assert.equal(N.runnerRank({ id: 'x', role: 'solo', rank: 5 }), 0);
  assert.equal(N.runnerRank({ id: 'x', role: 'netrunner', rank: 4.5 }), 0, 'the primary role keeps its strict check');
  assert.equal(N.linkedRunner(state.characters, 'fx'), fixer); assert.equal(N.linkedRunner([{ ...fixer, extra: {} }], 'fx'), null, 'no netrunner role at all');
  assert.equal(w.NetLink.rank({ runner: { cid: 'fx' } }, state.characters), 5, 'the desk link and the calculator now agree');
  const a = arch(); s.state.architectures.push(a); N.handle(click('open', { id: a.id }), state);
  assert.match(N.render(state), /<option value="fx" ?>Fixer Fay<\/option>/, 'listed among the Netrunners of the calculator');
  assert.equal(N.handle(change({ netCombat: 'runner' }, 'fx'), state).handled, true);
  N.handle(change({ netCombat: 'deck' }, 'd1'), state);
  assert.match(N.render(state), /data-net-combat="deck">[^]*<option value="d1" selected>/, 'the deck of the multiclass sheet is chosen');
  N.handle(change({ netCombat: 'copy' }, 'sw'), state);
  assert.match(N.render(state), /<option value="sw" selected>/, 'the installed attacker copy of the multiclass sheet is chosen');
  N.handle(click('combat-roll'), state);
  const html = N.render(state);
  assert.match(html, /Interface rank comes from the selected Netrunner’s sheet: 5/);
  const p = w.CATALOG.find(x => x.id === 'extra-program-sword').stats.atk;
  assert.match(html, new RegExp(': ' + (5 + p) + ' \\+ \\('), 'rank 5 of the additional role + the ATK of the program');
  assert.equal(opposed.length, 1);
});

/* ---------- Jack In / Jack Out are NET Actions ---------- */
test('Jack In and a safe Jack Out each spend one NET Action and never refill the counter', () => {
  const { w } = setup(), R = w.RolePlay, c = { id: 'n', role: 'netrunner', rank: 4, extra: {} };
  const used = x => x.extra?.roleTools?.netrunner?.values?.used, inn = x => R.jackedIn(x);
  let r = R.jackAct(c, 'in', '', 4, 'en'); assert.equal(r.ok, true); c.extra = r.extra;
  assert.equal(used(c), 1); assert.equal(inn(c), true); assert.match(r.message, /Jack In is a NET Action: 2 of 3 left/);
  assert.equal(R.jackAct(c, 'in', '', 4, 'en').ok, false, 'already in');
  r = R.jackAct(c, 'out', '', 4, 'ru'); assert.equal(r.ok, true); c.extra = r.extra;
  assert.equal(used(c), 2, 'the exit costs one more and does not reset the counter'); assert.equal(inn(c), false); assert.match(r.message, /Jack Out — NET-действие: осталось 1 из 3/);
  // in again (third action), then no action left for a safe exit
  r = R.jackAct(c, 'in', '', 4, 'en'); c.extra = r.extra; assert.equal(used(c), 3);
  const before = JSON.stringify(c); r = R.jackAct(c, 'out', '', 4, 'en');
  assert.equal(r.ok, false); assert.equal(r.reason, 'actions'); assert.match(r.message, /safe Jack Out needs a NET Action/); assert.equal(JSON.stringify(c), before);
  // no action left to jack in
  const d = { id: 'd', role: 'netrunner', rank: 4, extra: { roleTools: { netrunner: { team: [], values: { used: 3 } } } } };
  r = R.jackAct(d, 'in', '', 4, 'ru'); assert.equal(r.ok, false); assert.equal(r.reason, 'actions'); assert.match(r.message, /исчерпаны/);
  // New turn is the only refill
  c.extra = R.turnExtra(c.extra); assert.equal(used(c), 0);
  // leaving the net of a character who is not in it only cleans the decks and costs nothing
  const e = { id: 'e', role: 'netrunner', rank: 4, extra: { roleTools: { netrunner: { team: [], values: { used: 2 } } } } };
  r = R.jackAct(e, 'out', '', 4, 'en'); assert.equal(r.ok, true); assert.equal(used({ extra: r.extra }), 2);
});

test('Jack Out of a character with decks resets the programs without touching the counter (deckAct) and takes one action (jackAct)', () => {
  const { w, c } = setup(), R = w.RolePlay;
  c.extra.cyberdecks.decks[0].entries[0].active = true; c.extra.cyberdecks.decks[0].entries[0].rez = 7;
  c.extra.roleTools = { netrunner: { team: [], values: { jackedIn: true, used: 1 } } };
  const r = R.jackAct(c, 'out', 'd1', 4, 'en');
  assert.equal(r.ok, true); assert.equal(r.extra.roleTools.netrunner.values.used, 2); assert.equal(r.extra.roleTools.netrunner.values.jackedIn, undefined);
  assert.equal(r.extra.cyberdecks.decks[0].entries[0].active, undefined);
  assert.match(r.message, /programs deactivated, REZ restored\. Jack Out is a NET Action: 1 of 3 left\./);
  assert.equal(R.deckAct(c, 'd1', '', 'jackout', 4, 'en').extra.roleTools.netrunner.values.used, 1, 'the bare deck reset keeps the counter');
});

/* ---------- Mixed-language headings ---------- */
test('the Russian page has no half-English headings; the English page keeps its own', () => {
  const s = setup({ lang: 'ru' }), { N, state } = s; state.lang = 'ru';
  let html = N.render(state);
  assert.doesNotMatch(html, /NET ARCHITECTURE|COREBOOK/); assert.match(html, /НЕТРАННИНГ \/ АРХИТЕКТУРА СЕТИ/); assert.match(html, /НЕТРАННИНГ \/ ПРАВИЛА, СТР\. 197–211/);
  state.architectures.push(arch()); html = N.render(state);
  assert.doesNotMatch(html, /NET ARCHITECTURE/); assert.match(html, /АРХИТЕКТУРА СЕТИ/);
  const en = setup(), e = en.N.render(en.state); assert.match(e, /NETRUNNING \/ NET ARCHITECTURE/); assert.match(e, /NETRUNNING \/ COREBOOK 197–211/);
});

/* ---------- The generator ---------- */
const gen = (s, o) => s.w.NetGenerator.generate({ lang: 'en', ...o });
function depths(a) { const by = new Map(a.floors.map(f => [f.id, f])), d = new Map(); const depth = f => d.get(f.id) ?? (d.set(f.id, f.parent === '' ? 1 : depth(by.get(f.parent)) + 1), d.get(f.id)); a.floors.forEach(depth); return d; }

test('every draft is a valid, editable architecture whose pieces come only from the repository data', () => {
  const s = setup(), { w } = s, G = w.NetGenerator, NT = w.NetTools;
  const bands = G.bands(), steps = G.dvSteps(), demons = G.demons();
  assert.deepEqual(plain(bands), { small: [3, 6], medium: [7, 12], large: [13, 18] }, 'the bands of the three architecture sizes in the catalog');
  assert.deepEqual(plain(steps), [6, 8, 10, 12]);
  assert.deepEqual(plain(demons), { imp: { rez: 15, interface: 3, netActions: 2, combatNumber: 14, name: 'Imp' }, efreet: { rez: 25, interface: 4, netActions: 3, combatNumber: 14, name: 'Efreet' }, balron: { rez: 30, interface: 7, netActions: 4, combatNumber: 14, name: 'Balron' } });
  for (const level of G.ORDER) {
    const L = G.LEVELS[level], band = bands[L.size], pool = new Set(G.icePool(level).map(x => x[0]));
    for (let seed = 1; seed <= 120; seed++) {
      const a = gen(s, { difficulty: level, seed }), tag = level + ' ' + seed;
      assert.ok(a, tag); assert.equal(NT.validArchitectures([a]), true, tag);
      assert.ok(a.floors.length >= band[0] && a.floors.length <= band[1], tag + ' floor count in the band');
      const d = depths(a), deepest = Math.max(...d.values());
      assert.equal([...d.values()].filter(x => x === deepest).length, 1, tag + ': one definite deepest floor');
      assert.equal(a.floors.filter(f => f.parent === '').length, 1, tag + ': one entrance'); assert.equal(a.floors[0].parent, '');
      a.floors.forEach((f, i) => { if (f.parent !== '') assert.ok(a.floors.findIndex(x => x.id === f.parent) < i, tag + ': top-down order'); assert.equal(f.label, String(d.get(f.id)), tag + ': a floor is named by its depth, none skipped'); });
      for (let k = 2; k <= deepest; k++) assert.ok([...d.values()].includes(k), tag + ': no skipped depth');
      let controls = 0;
      for (const f of a.floors) {
        if (f.parent !== '') assert.ok(f.entries.length >= 1, tag + ': no empty floor below the entrance');
        for (const e of f.entries) {
          if (['password', 'file', 'control'].includes(e.type)) { assert.ok(steps.includes(e.dv), tag + ' DV ' + e.dv); assert.ok(e.dv >= steps[L.dvs[0]] && e.dv <= steps[L.dvs[1]], tag + ' DV within the level'); }
          if (e.type === 'control') controls++;
          if (e.type === 'ice') { assert.ok(pool.has(e.preset), tag + ' ICE ' + e.preset); assert.deepEqual(plain([e.per, e.spd, e.atk, e.def, e.maxRez]), plain(NT.ICE[e.preset])); assert.equal(e.rez, e.maxRez); assert.equal(e.state, 'waiting'); assert.equal(e.name, e.preset); }
          if (e.type === 'other') { const dm = Object.values(demons).find(x => x.name === e.name); assert.ok(dm, tag + ' demon'); assert.ok(L.demons.includes(e.name.toLowerCase()), tag + ' demon allowed at the level'); assert.ok(e.notes.includes(`REZ ${dm.rez}; Interface ${dm.interface}; NET Actions ${dm.netActions}; Combat Number ${dm.combatNumber}`)); }
        }
      }
      assert.ok(controls <= L.controls, tag + ' control nodes');
      assert.ok(a.floors.find(f => d.get(f.id) === deepest).entries.some(e => e.type === 'file'), tag + ': the goal floor holds the file');
    }
  }
});

test('the same seed gives the same draft, another seed another one; the level changes the size, the ICE and the demons', () => {
  const s = setup(), norm = a => JSON.stringify(a.floors.map(f => ({ ...f, id: 0, parent: a.floors.findIndex(x => x.id === f.parent), entries: f.entries.map(e => ({ ...e, id: 0 })) })));
  const a = gen(s, { difficulty: 'standard', seed: 7 }), b = gen(s, { difficulty: 'standard', seed: 7 }), c = gen(s, { difficulty: 'standard', seed: 8 });
  assert.equal(norm(a), norm(b)); assert.notEqual(norm(a), norm(c));
  assert.notEqual(a.id, b.id, 'two drafts are two architectures'); assert.equal(new Set(a.floors.map(f => f.id)).size, a.floors.length);
  const sizes = lvl => Array.from({ length: 60 }, (_, i) => gen(s, { difficulty: lvl, seed: i + 1 }).floors.length);
  assert.ok(Math.max(...sizes('easy')) <= 6 && Math.min(...sizes('standard')) >= 7 && Math.max(...sizes('standard')) <= 12 && Math.min(...sizes('hard')) >= 13);
  const iceNames = lvl => new Set(Array.from({ length: 80 }, (_, i) => gen(s, { difficulty: lvl, seed: i + 1 }).floors.flatMap(f => f.entries.filter(e => e.type === 'ice').map(e => e.name))).flat());
  for (const n of iceNames('easy')) assert.ok(s.N.ICE[n][4] <= 15, 'easy: no ICE above REZ 15 (' + n + ')');
  assert.ok([...iceNames('hard')].some(n => s.N.ICE[n][4] > 25), 'hard may use the strongest ICE');
  const demon = lvl => Array.from({ length: 40 }, (_, i) => gen(s, { difficulty: lvl, seed: i + 1 }).floors.flatMap(f => f.entries).filter(e => e.type === 'other').length);
  assert.equal(Math.max(...demon('easy')), 0); assert.ok(Math.max(...demon('hard')) === 1 && Math.min(...demon('hard')) === 1);
  // an unknown level or a bad seed falls back to the standard level and a fresh seed; the text says the rules are the app's
  const d = gen(s, { difficulty: 'nope', seed: -3 }); assert.ok(d.floors.length >= 7 && d.floors.length <= 12);
  assert.match(a.notes, /app’s own rules, not the book’s/); assert.match(a.notes, /seed 7/);
  const ru = s.w.NetGenerator.generate({ lang: 'ru', difficulty: 'easy', seed: 3 }); assert.match(ru.notes, /правила приложения, а не книги/); assert.match(ru.name, /^Заготовка: лёгкая, \d+ эт\.$/);
  assert.ok(ru.floors.every(f => !/[A-Za-z]/.test(f.branch)), 'Russian branch notes are Russian');
});

test('the draft is read by the editor as the explicit tree it was built as, and survives the editor’s own edits', () => {
  const s = setup(), { w } = s, a = gen(s, { difficulty: 'hard', seed: 11 }), X = w.NetEditor;
  const before = JSON.stringify(a.floors.map(f => f.parent)), t = X.tree(a);
  assert.deepEqual(plain(t.order.map(f => f.id)), plain(a.floors.map(f => f.id)), 'the array order is already the top-down order of the tree');
  X.materialize(a); assert.equal(JSON.stringify(a.floors.map(f => f.parent)), before, 'nothing to write: every parent is explicit');
  const fork = t.list.find(n => n.children.length > 1), leaf = t.list.find(n => !n.children.length);
  assert.ok(fork, 'a hard architecture has a fork');
  assert.equal(X.addChild(a, leaf.floor.id), true); assert.equal(w.NetTools.validArchitectures([a]), true);
});

test('the list: «Создать пустую» and «Сгенерировать» in an honest empty state, the generator button next to the list, and a draft opens for editing', () => {
  const s = setup({ lang: 'ru' }), { N, state, w } = s; state.lang = 'ru';
  let html = N.render(state);
  assert.match(html, /data-net-empty/); assert.match(html, /Архитектур пока нет/);
  assert.match(html, /data-net="new"[^>]*>Создать пустую</); assert.match(html, /data-net="gen">Сгенерировать</); assert.match(html, /data-net-gen="difficulty"/);
  assert.match(html, /Лёгкая · 3–6 этажей/); assert.match(html, /Тяжёлая · 13–18 этажей/); assert.match(html, /<option value="standard" selected>/);
  assert.equal((html.match(/data-net="new"/g) || []).length, 1, 'one «new» button in the empty state, not two');
  // choosing a level, then generating
  assert.equal(N.handle(change({ netGen: 'difficulty' }, 'hard'), state).handled, true); assert.equal(w.NetGenerator.level(), 'hard');
  assert.equal(s.w.localStorage.getItem('nc-net-gen-level'), 'hard'); assert.match(N.render(state), /<option value="hard" selected>/);
  N.handle(change({ netGen: 'difficulty' }, 'bogus'), state); assert.equal(w.NetGenerator.level(), 'hard', 'an unknown level is ignored');
  const r = N.handle(click('gen'), state);
  assert.equal(r.dirty, true); assert.equal(r.rerender, true); assert.match(r.notify, /Заготовка создана/);
  assert.equal(state.architectures.length, 1); const a = state.architectures[0]; assert.ok(a.floors.length >= 13 && a.floors.length <= 18);
  assert.equal(N.validArchitectures(state.architectures), true);
  html = N.render(state); assert.match(html, /data-net-field="name"/); assert.ok(html.includes(a.name), 'the draft is open for editing');
  N.handle(click('back'), state); html = N.render(state);
  assert.doesNotMatch(html, /data-net-empty/); assert.match(html, /data-net="gen"/); assert.match(html, /data-net="new"/);
  // the limit of 100 architectures
  while (state.architectures.length < 100) state.architectures.push(arch({ id: 'x' + state.architectures.length }));
  const n = state.architectures.length; assert.match(N.handle(click('gen'), state).notify, /Достигнут предел/); assert.equal(state.architectures.length, n);
});

test('without the generator module the list and the empty state still work, with no «Generate» button', () => {
  const s = setup({ files: FILES.filter(f => f !== 'net-generator.js') }), { N, state } = s;
  const html = N.render(state); assert.match(html, /data-net-empty/); assert.match(html, /data-net="new"/); assert.doesNotMatch(html, /data-net="gen"/);
  assert.equal(N.handle(click('gen'), state).notify, 'Select an architecture and valid values.');
  assert.equal(state.architectures.length, 0);
});

test('the module is registered after net-link.js and before app.js, with its stylesheet; plain LF text; targets of 44 px', () => {
  const index = read('index.html'), src = read('net-generator.js'), css = read('net-generator.css');
  assert.ok(index.includes('<script src="net-generator.js"></script>') && index.indexOf('net-generator.js') > index.indexOf('net-link.js') && index.indexOf('net-generator.js') < index.indexOf('<script src="app.js">'));
  assert.ok(index.includes('<link rel="stylesheet" href="net-generator.css">'));
  for (const f of [src, css, read('net-tools.js'), read('net-link.js'), read('role-play.js'), read('room-netrun.js'), read('room-netrun.css')]) assert.doesNotMatch(f, /\r/);
  assert.match(css, /min-height: 44px/); assert.doesNotMatch(src, /fetch\(|XMLHttpRequest|WebSocket|https?:\/\//, 'no network access');
});

/* ---------- The GM inbox of player rolls ---------- */
function inboxPage({ role = 'gm', room = 'R1', storage = new Map(), hash = '#/sheet' } = {}) {
  const focusable = name => ({ name, focus() { document.activeElement = this; } });
  const handlers = {}, notes = [], saves = [], renders = [], undos = [], observers = [];
  let host = null;
  const document = {
    body: { appendChild(h) { host = h; } }, addEventListener: (t, f) => { (handlers[t] ||= []).push(f); },
    createElement: () => ({ innerHTML: '', id: '', className: '' }), documentElement: {}, activeElement: null,
    getElementById: id => (host && id === 'rn-inbox-host' ? host : id === 'app' ? {} : null),
    querySelector: s => (s === '[data-rn-inbox-roll] button' && host && /data-rn-inbox-roll/.test(host.innerHTML) ? focusable('btn') : s === 'main' ? Object.assign(focusable('main'), { hasAttribute: () => true }) : null),
  };
  const st = { lang: 'en', netArchitectures: [{
    id: 'a1', name: 'Arasaka', access: '', notes: '', rank: 4, modifier: 0, dv: 8, remaining: 3, current: '1', runAt: 'f1',
    floors: [{ id: 'f1', label: '1', branch: '', parent: '', entries: [ent('p1', 'password', 'Door', { dv: 10 }), ent('p2', 'file', 'Vault', { dv: 12 })] }, { id: 'f2', label: '2', branch: '', parent: 'f1', entries: [ent('p3', 'password', 'Deep', { dv: 9 })] }],
  }] };
  const window = {
    document, location: { hash }, sessionStorage: { getItem: k => (storage.has(k) ? storage.get(k) : null), setItem: (k, v) => storage.set(k, String(v)), removeItem: k => storage.delete(k) },
    crypto: globalThis.crypto, Room: { netrunLink: { who: () => ({ role, room, memberId: 'm1' }), peers: () => [], send: () => 0 } },
    App: { getState: () => st, lang: () => st.lang, notify: m => notes.push(m), save: () => saves.push(1), render: () => renders.push(1), notifyAction: (m, label, fn) => { undos.push({ m, label, fn }); } },
    MutationObserver: function (cb) { observers.push(cb); this.observe = () => {}; },
  };
  const ctx = { window, TextEncoder, TextDecoder, Uint8Array, JSON, Math, Date, Number, String, Array, Object, Map, Set, Promise, setTimeout, clearTimeout, console };
  vm.createContext(ctx); vm.runInContext(read('room-netrun.js'), ctx);
  const N = window.RoomNetrun, host_ = () => host;
  const press = (op, roll) => { const b = { dataset: { rnInbox: op, roll } }; return handlers.click.map(h => h({ target: { closest: s => (s === '[data-rn-inbox]' ? b : null) } })).some(Boolean); };
  return { N, st, storage, notes, saves, renders, host: host_, window, press, handlers, undos, observers, document };
}
const roll = (over = {}) => ({ id: 'abababababababab', arch: 'a1', floor: 'f1', entry: 'p1', ab: 'Backdoor', total: 15, pos: 1, depth: 1, who: 'Аня', at: 1000, ...over });

test('the inbox is kept for the session: a page that reloads in the same room gets the rolls back, field by field', async () => {
  const storage = new Map(), a = inboxPage({ storage });
  await a.N.publish(false); // the page sees its room
  a.N._test.inbox().push(roll(), roll({ id: 'cdcdcdcdcdcdcdcd', entry: 'p2', ab: 'Eye-Dee', total: 4, pos: 2 })); a.N._test.persist();
  const saved = JSON.parse(storage.get('nc-netrun-inbox')); assert.equal(saved.room, 'R1'); assert.equal(saved.items.length, 2);
  const b = inboxPage({ storage }); await b.N.publish(false);
  assert.deepEqual(plain(b.N._test.inbox().map(r => r.id)), ['abababababababab', 'cdcdcdcdcdcdcdcd']);
  assert.equal(b.N._test.inbox()[0].who, 'Аня'); assert.equal(b.N._test.inbox()[1].ab, 'Eye-Dee');
  assert.match(b.host().innerHTML, /Netrunner rolls: 2/);
  // another room, a damaged blob, foreign fields and bad rolls never come back
  const other = inboxPage({ storage, room: 'R2' }); await other.N.publish(false); assert.equal(other.N._test.inbox().length, 0); assert.equal(storage.has('nc-netrun-inbox'), false, 'a different room drops the stored inbox');
  storage.set('nc-netrun-inbox', '{not json'); const bad = inboxPage({ storage }); await bad.N.publish(false); assert.equal(bad.N._test.inbox().length, 0); assert.equal(storage.has('nc-netrun-inbox'), false);
  storage.set('nc-netrun-inbox', JSON.stringify({ v: 1, room: 'R1', seen: ['abababababababab', 'zz', 5], items: [roll({ extra: '<img>', x: 1 }), roll({ id: 'nothex' }), roll({ ab: 'Hack' }), roll({ total: 1000 }), roll({ pos: 0 }), roll({ who: 7 }), null, 'x', roll({ id: 'efefefefefefefef', who: 'W'.repeat(100) })] }));
  const mix = inboxPage({ storage }); await mix.N.publish(false);
  assert.deepEqual(plain(mix.N._test.inbox().map(r => r.id)), ['abababababababab', 'efefefefefefefef']);
  assert.deepEqual(Object.keys(mix.N._test.inbox()[0]).sort(), ['ab', 'arch', 'at', 'depth', 'entry', 'floor', 'id', 'pos', 'total', 'who']);
  assert.equal(mix.N._test.inbox()[1].who.length, 40);
});

test('the panel is on every screen: not tied to a floor or to #/net, only for the Game Master, and it answers like the buttons under a record', async () => {
  const p = inboxPage({ hash: '#/characters' }); await p.N.publish(false);
  assert.equal(p.N.inboxHtml('en'), '', 'empty inbox: nothing');
  p.N._test.inbox().push(roll(), roll({ id: 'cdcdcdcdcdcdcdcd', floor: 'f2', entry: 'p3', depth: 2, ab: 'Control', total: 7 })); p.N._test.persist(); p.N.paintInbox();
  let html = p.host().innerHTML;
  assert.match(html, /Netrunner rolls: 2/); assert.match(html, /Аня<\/strong>: Backdoor · target 1, floor 1 · Door · Arasaka<br>15 against DV 10: above the DV/);
  assert.match(html, /Control · target 1, floor 2 · Deep · Arasaka<br>7 against DV 9: not above the DV/);
  p.st.netArchitectures[0].runAt = 'f2'; assert.match(p.N.inboxHtml('en'), /data-rn-inbox-roll="abababababababab"/, 'the runner moved to another floor: the roll is still there');
  assert.match(html, /aria-label="Netrunner rolls waiting for an answer"/); assert.equal((html.match(/data-rn-inbox="(ok|no|drop)"/g) || []).length, 6);
  assert.match(p.N.inboxHtml('ru'), /Броски нетраннера: 2/); assert.match(p.N.inboxHtml('ru'), /Получилось/);
  // «it worked» on a lock opens the record, removes the roll everywhere, saves
  assert.equal(p.press('ok', 'abababababababab'), true);
  assert.equal(p.st.netArchitectures[0].floors[0].entries[0].state, 'open'); assert.equal(p.N._test.inbox().length, 1); assert.equal(p.saves.length, 1);
  assert.equal(JSON.parse(p.storage.get('nc-netrun-inbox')).items.length, 1); assert.match(p.host().innerHTML, /Netrunner rolls: 1/); assert.equal(p.renders.length, 0, 'not on #/net: no redraw of the page');
  p.window.location.hash = '#/net'; p.N._test.inbox().push(roll({ id: '0101010101010101' })); p.press('no', '0101010101010101');
  assert.equal(p.st.netArchitectures[0].floors[0].entries[0].state, 'open', '«did not work» changes nothing in the record'); assert.equal(p.renders.length, 1, 'on #/net the page is redrawn');
  p.press('drop', 'cdcdcdcdcdcdcdcd'); assert.equal(p.N._test.inbox().length, 0); assert.equal(p.storage.has('nc-netrun-inbox'), false, 'an empty inbox leaves nothing behind');
  assert.equal(p.host().innerHTML, '', 'and no panel');
  // a roll whose record is gone is removed with an explanation
  p.N._test.inbox().push(roll({ entry: 'missing' })); p.press('ok', 'abababababababab'); assert.equal(p.N._test.inbox().length, 0); assert.match(p.notes.at(-1), /no longer exists/);
  // «Open NET» goes to the desk
  p.press('open'); assert.equal(p.window.location.hash, '#/net');
  // a player never sees the Game Master's inbox
  const pl = inboxPage({ role: 'player' }); pl.N._test.inbox().push(roll()); assert.equal(pl.N.inboxHtml('en'), '');
});

test('leaving the room forgets the stored inbox; a page without sessionStorage still works', async () => {
  const storage = new Map(), p = inboxPage({ storage }); await p.N.publish(false);
  p.N._test.inbox().push(roll()); p.N._test.persist(); assert.equal(storage.has('nc-netrun-inbox'), true);
  p.N.forget(); assert.equal(storage.has('nc-netrun-inbox'), false); assert.equal(p.N._test.inbox().length, 0);
  const q = inboxPage({ storage }); delete q.window.sessionStorage; await q.N.publish(false);
  q.N._test.inbox().push(roll()); q.N._test.persist(); assert.equal(q.N.inboxHtml('en').includes('abababababababab'), true);
});

/* ---------- Review fixes ---------- */
test('the settings roll never sends the name of the architecture to the roll feed (linked or not)', () => {
  const s = setup(), { N, state, checks, rolls } = s;
  state.architectures.push(arch({ name: 'SECRET-NAME', rank: 6 })); N.handle(click('open', { id: 'a1' }), state);
  N.handle(click('roll'), state); assert.equal(rolls.length, 1); assert.doesNotMatch(rolls[0].label, /SECRET/); assert.match(rolls[0].label, /DV 8/);
  state.architectures[0].runner = { cid: 'nova' }; state.architectures[0].remaining = 3; N.handle(click('roll'), state);
  assert.ok(checks.length >= 1); for (const c of checks) assert.doesNotMatch(String(c.label), /SECRET/);
});

test('the inbox panel: focus never stays on the page body after an answer, an undo is offered, and it repaints for a language or role change', async () => {
  const p = inboxPage({ hash: '#/characters' }); await p.N.publish(false);
  p.N._test.inbox().push(roll(), roll({ id: 'cdcdcdcdcdcdcdcd', floor: 'f2', entry: 'p3', depth: 2, ab: 'Control', total: 7 }), roll({ id: '0101010101010101', entry: 'p2' })); p.N._test.persist(); p.N.paintInbox();
  const alive = () => { assert.ok(p.document.activeElement, 'focus was moved to a control'); };
  p.press('ok', 'abababababababab'); alive(); p.document.activeElement = null;
  p.press('no', 'cdcdcdcdcdcdcdcd'); alive(); p.document.activeElement = null;
  p.press('drop', '0101010101010101'); assert.equal(p.document.activeElement.name, 'main', 'an empty panel hands the focus to the page'); p.document.activeElement = null;
  p.press('ok', 'ffffffffffffffff'); alive(); // a stale roll
  assert.equal(p.undos.length, 3, 'every answer offers an undo');
  assert.equal(p.st.netArchitectures[0].floors[0].entries[0].state, 'open'); p.undos[0].fn();
  assert.equal(p.st.netArchitectures[0].floors[0].entries[0].state, 'closed'); assert.ok(p.N._test.inbox().some(r => r.id === 'abababababababab'));
  assert.match(p.host().innerHTML, /data-rn-inbox-roll="abababababababab"/);
  assert.match(p.host().innerHTML, /Netrunner rolls/); p.st.lang = 'ru'; p.observers.forEach(f => f()); assert.match(p.host().innerHTML, /Броски нетраннера/);
});

test('the panel starts collapsed when several rolls wait, so it does not cover the page; one roll on a wide screen starts open', async () => {
  const p = inboxPage(); await p.N.publish(false);
  p.N._test.inbox().push(roll()); assert.match(p.N.inboxHtml('en'), /<details data-rn-inbox-details open>/);
  p.N._test.inbox().push(roll({ id: 'cdcdcdcdcdcdcdcd' })); assert.doesNotMatch(p.N.inboxHtml('en'), /<details data-rn-inbox-details open>/);
  assert.match(read('room-netrun.css'), /max-height: 42vh/);
});

test('the generated entrance holds a password at the first DV step, the current floor is real, and deeper floors get stronger ICE', () => {
  const s = setup(), G = s.w.NetGenerator, steps = G.dvSteps();
  const lowSum = [], highSum = [];
  for (let seed = 1; seed <= 200; seed++) {
    const a = gen(s, { difficulty: 'hard', seed }), d = depths(a), deepest = Math.max(...d.values());
    assert.ok(a.floors.some(f => f.id === a.current || f.label === a.current), 'current is a real floor');
    const ent0 = a.floors[0].entries.find(e => e.type === 'password'); assert.ok(ent0 && ent0.dv === steps[G.LEVELS.hard.dvs[0]]);
    for (const f of a.floors) for (const e of f.entries) if (e.type === 'ice') { const r = (d.get(f.id) - 1) / (deepest - 1); (r <= 0.34 ? lowSum : r >= 0.67 ? highSum : []).push(e.maxRez); }
  }
  const mean = x => x.reduce((p, c) => p + c, 0) / x.length;
  assert.ok(lowSum.length > 20 && highSum.length > 20); assert.ok(mean(lowSum) < mean(highSum), 'ICE gets stronger with depth');
});

test('the generator reads the DV steps by value: an extra net-feature with another DV does not shift the levels', () => {
  const s = setup(), G = s.w.NetGenerator;
  s.w.CATALOG.push({ id: 'extra-net-feature-x', category: 'extra', stats: { type: 'net-feature', dv: 7 } });
  assert.deepEqual(plain(G.dvSteps()), [6, 8, 10, 12]);
});

test('the ICE pool includes an ICE whose REZ equals the cap and excludes anything above it', () => {
  const s = setup(), G = s.w.NetGenerator, table = s.w.NetTools.ICE;
  for (const level of G.ORDER) {
    const cap = G.LEVELS[level].iceRez, names = G.icePool(level).map(x => x[0]);
    assert.ok(names.every(n => table[n][4] <= cap), level + ': nothing above the cap');
    assert.deepEqual(names.slice().sort(), Object.keys(table).filter(n => table[n][4] <= cap).sort(), level + ': everything at or under the cap');
  }
  assert.ok(G.icePool('easy').some(x => x[1][4] === 15), 'REZ equal to the easy cap is allowed');
  assert.ok(G.icePool('standard').some(x => x[1][4] === 25), 'REZ equal to the standard cap is allowed');
  assert.ok(!G.icePool('standard').some(x => x[1][4] === 30), 'REZ above the standard cap is not');
});
