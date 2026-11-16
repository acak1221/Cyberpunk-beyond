// The link between a net architecture and the netrunner who runs it, on the same device (site/net-link.js, with the hooks in
// net-tools.js and net-editor.js): the saved shape, the run-mode roll from the runner's sheet with its one counter, the
// calculator that starts with the runner and deck picked, and damage to a program of the linked deck with an undo.
const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm'), test = require('node:test'), assert = require('node:assert/strict');
const read = f => fs.readFileSync(path.join(__dirname, '../site', f), 'utf8');
const plain = x => JSON.parse(JSON.stringify(x));
const FILES = ['catalog.js', 'catalog-extra.js', 'role-tools.js', 'role-play.js', 'netrun-tab.js', 'net-tools.js', 'net-editor.js', 'net-link.js'];
const E = (id, cat, name, kind = 'program', slots = 1) => ({ id, catalogId: cat, name: { ru: name, en: name }, kind, slots });
function setup({ random = 0.5, wound = 0, effect = 0 } = {}) {
  const math = Object.create(Math); math.random = () => random;
  const checks = [], notes = [];
  const w = {
    confirm: () => true, document: { addEventListener() {}, querySelector: () => null },
    App: {
      lang: () => 'en', save() {}, render() {}, notify: m => notes.push(m), rollMods: () => ({ wound, effect }),
      check: (base, label, o = {}) => { checks.push({ base, label, o }); const total = 5 + base + (Number(o.mod) || 0), dv = o.dv || 0; return { total, beat: dv ? total > dv : null }; },
    },
    Rolls: { sum: () => true, opposed: () => true, check: () => true },
  };
  const ctx = { window: w, Math: math, Date, Set, Map, Object, Number, String, Array, JSON, Promise, setTimeout: () => 0, clearTimeout() {}, console };
  vm.createContext(ctx);
  for (const f of FILES) vm.runInContext(read(f), ctx, { filename: f });
  const c = {
    id: 'nova', name: 'Nova', role: 'netrunner', rank: 4, hp: 40, stats: {}, skills: {},
    extra: { cyberdecks: { version: 1, decks: [{ id: 'd1', name: 'Street deck', slots: 7, hardwareOnly: 0, entries: [E('worm', 'extra-program-worm', 'Worm'), E('shield', 'extra-program-shield', 'Shield'), E('armor', 'extra-program-armor', 'Armor')] }] } },
  };
  const state = { lang: 'en', architectures: [], characters: [c] };
  const N = w.NetTools; N.setScope('owner');
  return { w, N, c, state, checks, notes };
}
const click = (op, extra = {}) => ({ type: 'click', target: { closest: () => ({ dataset: { net: op, ...extra }, getAttribute: () => null }) } });
const change = (dataset, value) => ({ type: 'change', target: { dataset, value, closest: () => null } });
function arch(over = {}) {
  return {
    id: 'a1', name: 'Arasaka', access: '', notes: '', rank: 6, modifier: 0, dv: 8, remaining: 3, current: '1',
    floors: [
      { id: 'f1', label: '1', branch: '', parent: '', entries: [
        { id: 'p1', type: 'password', name: 'Door', dv: 10, state: 'closed', preset: '', rez: 0, maxRez: 0, per: 0, spd: 0, atk: 0, def: 0, notes: '' },
        { id: 'i1', type: 'ice', name: 'Dragon', dv: 0, state: 'waiting', preset: 'Dragon', rez: 30, maxRez: 30, per: 6, spd: 4, atk: 6, def: 6, notes: '' }] },
      { id: 'f2', label: '2', branch: '', parent: 'f1', entries: [] },
    ], ...over,
  };
}
const open = (s, a) => { s.state.architectures.push(a); s.N.handle(click('open', { id: a.id }), s.state); };
const run = (s, a) => { open(s, a); s.N.handle(click('run-mode-on'), s.state); };

test('old saves stay valid and the new optional fields are accepted only in their shape', () => {
  const { N } = setup(), v = x => N.validArchitectures([x]);
  assert.equal(v(arch()), true, 'an architecture without any new field');
  const full = arch({ runner: { cid: 'nova', deck: 'd1' }, pub: 'Public title', seen: ['f1'] });
  full.floors[0].rv = true; full.floors[0].entries[0].rv = true; full.floors[0].entries[0].rl = 'A door'; full.floors[0].entries[0].sd = true;
  assert.equal(v(full), true);
  assert.equal(v(arch({ runner: { cid: 'nova' } })), true, 'a link without a deck');
  for (const bad of [{ runner: { cid: '' } }, { runner: [] }, { runner: 'nova' }, { runner: { cid: 'a', deck: 3 } }, { pub: 5 }, { pub: 'x'.repeat(81) }, { seen: 'f1' }, { seen: [1] }, { seen: Array(101).fill('f') }])
    assert.equal(v(arch(bad)), false, JSON.stringify(bad));
  for (const [k, val] of [['rv', 'yes'], ['sd', 1], ['rl', 5], ['rl', 'x'.repeat(81)]]) { const a = arch(); a.floors[0].entries[0][k] = val; assert.equal(v(a), false, k + String(val)); }
  const f = arch(); f.floors[0].rv = 'show'; assert.equal(v(f), false);
});

test('the link needs a character with an Interface rank; a missing, duplicated or rankless one is not used', () => {
  const { w, c, state } = setup(), L = w.NetLink, a = arch({ runner: { cid: 'nova', deck: 'd1' } });
  const r = L.resolve(a, state.characters); assert.equal(r.c, c); assert.equal(r.rank, 4); assert.equal(r.deck.id, 'd1');
  assert.equal(L.resolve({ ...a, runner: { cid: 'nova', deck: 'gone' } }, state.characters).deck, null, 'an unknown deck is just no deck');
  assert.equal(L.resolve(a, []), null);
  assert.equal(L.resolve(a, [c, { ...c }]), null, 'two characters with one id');
  assert.equal(L.resolve(a, [{ ...c, role: 'solo', rank: 4 }]), null, 'no netrunner role');
  const multi = { ...c, role: 'solo', extra: { ...c.extra, additionalRoles: [{ role: 'netrunner', rank: 3 }] } };
  assert.equal(L.resolve(a, [multi]).rank, 3, 'a multiclass netrunner counts');
  assert.equal(L.resolve({ ...a, runner: undefined }, state.characters), null);
});

test('run mode: one NET Action counter, the sheet is the source; New turn, Spend and Restore go to it', () => {
  const s = setup(), { N, c, state } = s, a = arch({ runner: { cid: 'nova' } }); run(s, a);
  let html = N.render(state);
  assert.match(html, /NET Actions: 3 \/ 3/, 'the sheet counter: rank 4 has 3 actions');
  assert.match(html, /Interface 4/); assert.match(html, /Nova/);
  const r = N.handle(click('spend'), state); assert.equal(r.dirty, true);
  assert.equal(c.extra.roleTools.netrunner.values.used, 1); assert.equal(a.remaining, 3, 'the architecture counter is not touched');
  assert.match(N.render(state), /NET Actions: 2 \/ 3/);
  N.handle(click('refund'), state); assert.equal(c.extra.roleTools.netrunner.values.used, 0);
  N.handle(click('refund'), state); assert.equal(c.extra.roleTools.netrunner.values.used, 0, 'never below zero');
  for (let i = 0; i < 5; i++) N.handle(click('spend'), state);
  assert.equal(c.extra.roleTools.netrunner.values.used, 3, 'never above the actions of the rank');
  N.handle(click('reset'), state); assert.equal(c.extra.roleTools.netrunner.values.used, 0);
  // Without a link the old counter works as before.
  delete a.runner; a.remaining = 3; N.handle(click('spend'), state); assert.equal(a.remaining, 2); assert.equal(c.extra.roleTools.netrunner.values.used, 0);
  html = N.render(state); assert.match(html, /NET Actions: 2 \/ 3/); assert.match(html, /Interface 6/);
});

test('run mode roll: the runner’s rank, a rezzed booster, the wound penalty and the sheet modifier; the counter is spent; a success opens the record', () => {
  const s = setup({ wound: -2, effect: 1 }), { N, c, state, checks } = s, a = arch({ runner: { cid: 'nova' }, runAt: 'f1' }); run(s, a);
  c.extra.cyberdecks.decks[0].entries[0].active = true; // Worm: +2 to Backdoor
  c.extra.roleTools = { netrunner: { team: [], values: { modifier: 3 } } };
  const r = N.handle(click('run-roll', { floor: 'f1', entry: 'p1' }), state);
  assert.equal(r.dirty, true); assert.equal(checks.length, 1);
  assert.equal(checks[0].base, 4 + 2, 'Interface 4 + Worm 2, not the architecture rank 6');
  assert.equal(checks[0].o.mod, 3 - 2 + 1, 'sheet modifier + wound penalty + effects');
  assert.equal(checks[0].o.wounds, false, 'the active character is not the runner: the penalty is added by hand');
  assert.equal(checks[0].o.dv, 0, 'the DV is compared here and never given to the check: its history line goes to the room feed');
  assert.match(checks[0].label, /^Backdoor \(Interface 4 \+ Worm 2\)/); assert.doesNotMatch(checks[0].label, /Door|Arasaka/);
  assert.equal(c.extra.roleTools.netrunner.values.used, 1, 'one action spent on the sheet');
  assert.equal(a.floors[0].entries[0].state, 'open', 'total 5+6+2=13 beats DV 10');
  assert.match(N.render(state), /Interface \+ 1d10: 13 &gt; DV 10/);
});

test('a failed roll leaves the record closed; no actions left refuses the roll without rolling', () => {
  const s = setup(), { N, c, state, checks } = s, a = arch({ runner: { cid: 'nova' } }); a.floors[0].entries[0].dv = 30; run(s, a);
  N.handle(click('run-roll', { floor: 'f1', entry: 'p1' }), state);
  assert.equal(a.floors[0].entries[0].state, 'closed'); assert.equal(checks.length, 1);
  c.extra.roleTools.netrunner.values.used = 3;
  const r = N.handle(click('run-roll', { floor: 'f1', entry: 'p1' }), state);
  assert.equal(checks.length, 1, 'no second roll'); assert.match(r.notify, /No NET Actions remain/);
});

test('an unlinked architecture rolls as before: nothing on any sheet', () => {
  const s = setup(), { N, c, state, checks } = s, a = arch({ modifier: 2 }); run(s, a);
  N.handle(click('run-roll', { floor: 'f1', entry: 'p1' }), state);
  assert.equal(checks.length, 0, 'the old roll goes through Rolls.check, not through the sheet');
  assert.equal(c.extra.roleTools, undefined);
});

test('stepping through the run records the floors passed, once each', () => {
  const s = setup(), { N, state } = s, a = arch(); run(s, a);
  assert.equal(a.seen, undefined, 'nothing is written by reading');
  N.handle(click('run-go', { floor: 'f2' }), state); N.handle(click('run-go', { floor: 'f1' }), state); N.handle(click('run-go', { floor: 'f2' }), state);
  assert.deepEqual(plain(a.seen), ['f2', 'f1']); assert.equal(a.runAt, 'f2');
  assert.equal(N.validArchitectures([a]), true);
});

test('the architecture’s link is chosen with two selects and checked', () => {
  const s = setup(), { N, c, state } = s, a = arch(); run(s, a);
  assert.match(N.render(state), /data-net-link="runner"/);
  assert.equal(N.handle(change({ netLink: 'runner' }, 'ghost'), state).dirty, undefined, 'an unknown character is refused');
  assert.equal(a.runner, undefined);
  const r = N.handle(change({ netLink: 'runner' }, 'nova'), state); assert.equal(r.dirty, true); assert.deepEqual(plain(a.runner), { cid: 'nova' });
  assert.match(N.render(state), /data-net-link="deck"/);
  N.handle(change({ netLink: 'deck' }, 'nope'), state); assert.equal(a.runner.deck, undefined, 'an unknown deck is refused');
  N.handle(change({ netLink: 'deck' }, 'd1'), state); assert.equal(a.runner.deck, 'd1'); assert.equal(N.validArchitectures([a]), true);
  N.handle(change({ netLink: 'deck' }, ''), state); assert.equal('deck' in a.runner, false);
  N.handle(change({ netLink: 'runner' }, ''), state); assert.equal('runner' in a, false);
  // A character that was deleted afterwards: the card says so and nothing is used.
  a.runner = { cid: 'deleted' };
  assert.match(N.render(state), /no longer available/);
  void c;
});

test('the calculator starts with the runner and the deck of the link already picked', () => {
  const s = setup(), { N, state } = s, a = arch({ runner: { cid: 'nova', deck: 'd1' } }); open(s, a);
  const html = N.render(state);
  assert.match(html, /<option value="nova" selected>/); assert.match(html, /<option value="d1" selected>/);
  assert.match(html, /Interface rank comes from the linked Netrunner’s sheet: 4/);
  // A choice made by hand afterwards stays.
  N.handle(change({ netCombat: 'runner' }, ''), state);
  assert.doesNotMatch(N.render(state), /<option value="nova" selected>/);
  // Without a link the three selects start empty, as before.
  const b = arch({ id: 'a2' }); state.architectures.push(b); N.handle(click('back'), state); N.handle(click('open', { id: 'a2' }), state);
  const plainHtml = N.render(state);
  assert.doesNotMatch(plainHtml, /<option value="nova" selected>/); assert.match(plainHtml, /field above: 6/);
});

// A Black ICE of the architecture hits a program: the damage lands on a program of the linked deck.
function iceHit({ link = true } = {}) {
  const s = setup(), a = arch(link ? { runner: { cid: 'nova', deck: 'd1' } } : {}); open(s, a);
  s.N.handle(change({ netCombat: 'mode' }, 'ice'), s.state);
  s.N.handle(change({ netCombat: 'ice' }, 'f1:i1'), s.state);
  s.N.handle(click('combat-roll'), s.state);
  return { ...s, a };
}
test('damage that an ICE deals to a program lowers that program’s REZ on the linked deck, and the undo puts it back', () => {
  const { N, c, state } = iceHit();
  const html = N.render(state);
  assert.match(html, /data-net-link-damage/); assert.match(html, /Shield · REZ \d+\/\d+/); assert.doesNotMatch(html, /Take REZ off the program on the deck/, 'the button waits for a choice');
  assert.doesNotMatch(html, /Lower the REZ of the program on the Netrunner’s sheet: NETRUN tab/, 'the hint that told the Game Master to do it by hand is replaced by the choice');
  // No program chosen yet: nothing happens.
  let r = N.handle(click('combat-apply'), state);
  assert.equal(r.dirty, undefined); assert.ok(r.notify);
  N.handle(change({ netCombat: 'victimProgram' }, 'shield'), state);
  assert.match(N.render(state), /Take REZ off the program on the deck/);
  const shield = c.extra.cyberdecks.decks[0].entries[1], before = JSON.parse(JSON.stringify(shield));
  r = N.handle(click('combat-apply'), state);
  assert.equal(r.dirty, true); assert.match(r.notify, /Shield: REZ \d+ → 0 · Derezzed/);
  assert.equal(shield.rez, 0); assert.equal(shield.down, true); assert.equal('active' in shield, false);
  assert.equal(c.extra.cyberdecks.decks[0].entries.length, 3);
  assert.match(N.render(state), /data-net="combat-undo"/);
  // A second press is refused (already applied).
  assert.equal(N.handle(click('combat-apply'), state).dirty, undefined);
  // Undo only while the program is as the damage left it.
  shield.rez = 1; assert.match(N.handle(click('combat-undo'), state).notify, /Data changed/); shield.rez = 0;
  r = N.handle(click('combat-undo'), state); assert.equal(r.dirty, true);
  assert.deepEqual(plain(shield), before, 'exactly as before');
});

test('damage to a program with no link keeps the old hint and changes nothing', () => {
  const { N, c, state } = iceHit({ link: false });
  const html = N.render(state);
  assert.doesNotMatch(html, /data-net-link-damage/); assert.match(html, /Lower the REZ of the program on the Netrunner’s sheet/);
  const snap = JSON.stringify(c);
  assert.equal(N.handle(click('combat-apply'), state).dirty, undefined); assert.equal(JSON.stringify(c), snap);
});

test('NetLink.applyProgram refuses a destroyed or unknown entry, and the undo is guarded', () => {
  const { w, c, state } = setup(), L = w.NetLink, a = arch({ runner: { cid: 'nova', deck: 'd1' } });
  const e = c.extra.cyberdecks.decks[0].entries[1];
  e.destroyed = true; assert.equal(L.applyProgram(a, state.characters, 'shield', 3, 'en').ok, false); delete e.destroyed;
  assert.equal(L.applyProgram(a, state.characters, 'nope', 3, 'en').ok, false);
  assert.equal(L.applyProgram({ ...a, runner: { cid: 'nova' } }, state.characters, 'shield', 3, 'en'), null, 'no deck chosen: not handled here');
  assert.equal(L.applyProgram(a, state.characters, 'shield', -1, 'en').ok, false);
  const max = w.RolePlay.progState(e).max, ok = L.applyProgram(a, state.characters, 'shield', 1, 'en');
  assert.equal(ok.ok, true); assert.equal(e.rez, max - 1);
  assert.equal(L.undoProgram(ok.undo, state.characters), true); assert.equal('rez' in e, false);
  assert.equal(L.undoProgram(ok.undo, state.characters), false, 'the program is no longer as the damage left it');
  assert.equal(L.undoProgram({ kind: 'x' }, state.characters), false);
});

test('index.html loads the new module before app.js, after net-editor.js', () => {
  const index = read('index.html');
  assert.ok(index.includes('<script src="net-link.js"></script>') && index.indexOf('net-link.js') > index.indexOf('net-editor.js') && index.indexOf('net-link.js') < index.indexOf('src="app.js"'));
  assert.doesNotMatch(read('net-link.js'), /\r/);
});

// Review round: the loss of REZ is offered only for what an ICE does to the runner, never for the runner's own attack.
test('the runner’s own attack never offers REZ loss on the runner’s own deck, in the calculator or on the apply button', () => {
  const { w, c, state, N } = setup(), L = w.NetLink, a = arch({ runner: { cid: 'nova', deck: 'd1' } });
  const hit = (mode, extra = {}) => ({ mode, damage: { to: 'rez', source: 'Sword', total: 7, iceKey: '', applied: null, ...extra } });
  assert.match(L.damageHtml(a, hit('ice'), state.characters, 'en', {}), /data-net-link-damage/, 'an ICE that hits the runner: the picker');
  for (const mode of ['program', 'zap']) assert.equal(L.damageHtml(a, hit(mode), state.characters, 'en', {}), '', mode + ': the attacker is the runner');
  // Through the real buttons: a zap by the linked runner at a target that is not in the architecture.
  open({ N, state }, a); N.handle(change({ netCombat: 'mode' }, 'zap'), state); N.handle(click('combat-roll'), state);
  const html = N.render(state), shield = c.extra.cyberdecks.decks[0].entries[1], snap = JSON.stringify(c);
  assert.match(html, /data-rp-net-damage/, 'the zap hit and rolled damage to REZ'); assert.match(html, /Lower the target’s REZ by hand/, 'the old hint stays'); assert.doesNotMatch(html, /data-net-link-damage/);
  N.handle(change({ netCombat: 'victimProgram' }, 'shield'), state); N.handle(click('combat-apply'), state);
  assert.equal(JSON.stringify(c), snap, 'the attacker’s own program is not touched'); assert.equal('rez' in shield, false);
});

test('the deck is validated again after the REZ change, and a state that fails leaves the deck as it was', () => {
  const { w, c, state } = setup(), L = w.NetLink, a = arch({ runner: { cid: 'nova', deck: 'd1' } });
  const real = w.RoleTools.deckState; let calls = 0;
  w.RoleTools.deckState = x => ++calls > 1 ? { kind: 'bad' } : real(x);
  const e = c.extra.cyberdecks.decks[0].entries[1], snap = JSON.stringify(c);
  const r = L.applyProgram(a, state.characters, 'shield', 3, 'en');
  assert.equal(r.ok, false); assert.match(r.message, /failed validation/); assert.equal(JSON.stringify(c), snap); assert.equal('rez' in e, false);
  w.RoleTools.deckState = real;
});
