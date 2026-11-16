// Program effects of the NETRUN tab (site/netrun-effects.js): the table is tied to the catalog text, Speedy Gonzalvez, the defenders
// on incoming damage (consumed, visible, switchable), the «destroyed» and «used» marks, the pending «-1 NET Action» marker,
// and old decks without any of the new fields behaving as before.
const { test } = require('node:test'), assert = require('node:assert/strict'), fs = require('node:fs'), vm = require('node:vm');
const read = f => fs.readFileSync(__dirname + '/../site/' + f, 'utf8');
const plain = x => JSON.parse(JSON.stringify(x));

const ALL = ['catalog.js', 'catalog-extra.js', 'role-tools.js', 'role-play.js', 'netrun-tab.js', 'netrun-deck.js', 'netrun-effects.js', 'netrun-console.js'];
function load({ mods = { wound: 0, effect: 0 }, withEffects = true } = {}) {
  const handlers = {}, notes = [], actions = [], checks = [], saves = [];
  const consoleRoot = { dataset: {}, isConnected: true, replaceWith() {} };
  const dmgRoot = { dataset: {}, replaceWith() {} };
  const dvField = { value: '' };
  let current = null;
  const doc = {
    addEventListener: (t, f, cap) => { (handlers[t] ||= []).push(f); },
    querySelector: s => (s === '[data-nc-root]' ? consoleRoot : s === '[data-rp-net-dv]' ? dvField : s === '[data-nx-dmg]' ? dmgRoot : null),
    querySelectorAll: () => [],
    createElement: () => ({ set innerHTML(v) { this._h = v; }, get firstElementChild() { return { html: this._h }; } }),
    getElementById: () => null, body: { appendChild() {} }, documentElement: { classList: { add() {}, remove() {} } },
  };
  const state = { characters: [] };
  const w = {
    document: doc,
    App: {
      active: () => current, lang: () => w.lang || 'en', save: () => saves.push(1), render: () => {}, notify: m => notes.push(m),
      notifyAction: (message, label, fn) => actions.push({ message, label, fn }), getState: () => state, editScope: () => 'owner',
      rollMods: () => ({ wound: mods.wound, effect: mods.effect }),
      check: (base, label, o = {}) => {
        const mod = (mods.wound + mods.effect) + (Number(o.mod) || 0), total = 5 + base + mod, dv = o.dv || 0;
        checks.push({ base, label, o });
        return { total, first: 5, extra: 0, dv, beat: dv ? total > dv : null };
      },
    },
    Rolls: { sum() { return true; } },
  };
  const ctx = { window: w, Math, Date, JSON, Object, Array, Number, String, Set, Map, setTimeout: f => { f(); return 0; } };
  vm.createContext(ctx);
  for (const f of ALL.filter(f => withEffects || f !== 'netrun-effects.js')) vm.runInContext(read(f), ctx);
  const fire = (type, target) => { for (const h of handlers[type] || []) h({ type, target }); };
  const act = (a, dataset = {}, extra = {}) => {
    const self = { dataset: { nxAct: a, ...dataset }, getAttribute: () => null, closest: s => (s === '[data-nx-act]' ? self : s === '[data-nc-root]' ? consoleRoot : extra[s] ?? null) };
    fire('click', self);
  };
  return {
    w, notes, actions, checks, saves, consoleRoot, act, fire, state, doc,
    use(c) { current = c; state.characters = [c]; return c; },
  };
}
const E = (id, cat, name, kind = 'program', slots = 1) => ({ id, catalogId: cat, name: { ru: name, en: name }, kind, slots });
function runner(entries, extra = {}, rank = 4) {
  return {
    id: 'n1', name: 'Nova', role: 'netrunner', rank, hp: 30, stats: {}, skills: {},
    extra: { cyberdecks: { version: 1, decks: [{ id: 'd1', name: 'Deck', slots: 9, hardwareOnly: 0, entries }] }, ...extra },
  };
}
const values = c => c.extra.roleTools.netrunner.values;
const cat = (x, id) => x.w.CATALOG.find(p => p.id === id);

test('the effect table agrees with the catalog text it came from (a number cannot drift away from it)', () => {
  const x = load(), F = x.w.NetrunEffects;
  const en = id => cat(x, id).details.en, ru = id => cat(x, id).details.ru;
  assert.match(en(F.SPEEDY), /\+2 Speed/); assert.equal(F.TABLE[F.SPEEDY].value, 2);
  assert.match(en(F.ARMOR), /Reduces brain damage by 4/); assert.equal(F.TABLE[F.ARMOR].brain, 4);
  assert.match(ru(F.ARMOR), /на 4/);
  assert.match(en(F.SHIELD), /first successful non-Black ICE brain-damage effect, then derezzes/); assert.equal(F.TABLE[F.SHIELD].block, true);
  assert.match(en(F.FLAK), /Sets ATK of incoming non-Black ICE attacker programs to 0/); assert.equal(F.TABLE[F.FLAK].zeroAtk, true);
  for (const id of [F.ARMOR, F.SHIELD, F.FLAK]) { assert.match(en(id), /each copy can be used once per Netrun/); assert.equal(F.isOnce(id), true); }
  assert.equal(F.isOnce(F.SPEEDY), false);
  for (const id of Object.keys(F.NET_CUT)) assert.match(en(id), /−1 NET Action next turn, minimum 2/);
  assert.equal(F.NET_FLOOR, 2); assert.deepEqual(Object.keys(F.NET_CUT).sort(), ['extra-ice-wisp', 'extra-program-vrizzbolt']);
  assert.equal(Object.keys(F.TABLE).every(id => cat(x, id)), true, 'every table id is a catalog program');
  for (const id of Object.keys(F.NET_CUT)) assert.ok(cat(x, id));
});

test('every string exists in Russian and English, with the same shape', () => {
  const T = load().w.NetrunEffects.T;
  assert.deepEqual(Object.keys(T.ru).sort(), Object.keys(T.en).sort());
  for (const k of Object.keys(T.ru)) assert.equal(typeof T.ru[k], typeof T.en[k], k);
  for (const [k, v] of Object.entries(T.ru)) if (typeof v === 'string') assert.ok(v.length > 0 && T.en[k].length > 0, k);
  const ruText = JSON.stringify(Object.values(T.ru).filter(v => typeof v === 'string'));
  assert.doesNotMatch(ruText, /\bты\b|\bтебе\b|\bтвой\b/i, 'formal «вы» only');
});

test('old data: an entry with no new field reads exactly as before', () => {
  const x = load(), R = x.w.RolePlay;
  const e = E('a', 'extra-program-armor', 'Armor'); e.active = true;
  assert.deepEqual(plain(R.progState(e)), { max: 7, active: true, down: false, rez: 7 });
  assert.deepEqual(plain(R.runState(E('h', 'extra-program-hellbolt', 'Hellbolt'))), { max: 0, active: false, down: false, rez: 0, attacker: true });
  const c = runner([e]);
  assert.deepEqual(plain(R.netBonus(c, 'Backdoor')), { value: 0, names: [] });
  assert.equal(R.armorUp(c), true);
  assert.deepEqual(plain(R.netLeft(c, 4)), { max: 3, used: 0, left: 3 });
  assert.equal(x.w.RoleTools.deckState(c).kind, 'ok');
});

test('destroyed: stays in the slot, is never active, cannot be activated, survives Jack Out; used marks clear on Jack Out', () => {
  const x = load(), R = x.w.RolePlay;
  const w = E('w', 'extra-program-worm', 'Worm'); w.active = true; w.destroyed = true;
  const hb = E('h', 'extra-program-hellbolt', 'Hellbolt'); hb.active = true; hb.destroyed = true;
  const ar = E('a', 'extra-program-armor', 'Armor'); ar.active = true; ar.spent = true;
  const c = runner([w, hb, ar]);
  assert.equal(R.progState(w).active, false); assert.equal(R.progState(w).destroyed, true);
  assert.equal(R.runState(hb).active, false); assert.equal(R.runState(hb).destroyed, true);
  assert.equal(R.netBonus(c, 'Backdoor').value, 0, 'a destroyed booster gives nothing');
  assert.equal(R.armorUp(c), false, 'a used Armor is not counted by the GM calculator either');
  assert.equal(x.w.RoleTools.deckState(c).kind, 'ok', 'the validator accepts the new fields');
  for (const op of ['toggle', 'rez-', 'rez+']) { const r = R.deckAct(c, 'd1', 'w', op, 4, 'en'); assert.equal(r.ok, false); assert.match(r.message, /destroyed/); }
  assert.equal(R.deckAct(c, 'd1', 'h', 'toggle', 4, 'ru').ok, false);
  assert.match(R.deckAct(c, 'd1', 'w', 'toggle', 4, 'ru').message, /уничтожена/);
  const out = R.deckAct(c, 'd1', '', 'jackout', 4, 'en');
  const e = out.extra.cyberdecks.decks[0].entries;
  assert.equal(e[0].destroyed, true); assert.equal(e[2].spent, undefined); assert.equal(e[2].active, undefined);
  assert.ok(R.deckEntryHtml(c, c.extra.cyberdecks.decks[0], w, 'en').includes('Destroyed'));
});

test('NET Action marker: «New turn» moves it onto the turn (never below 2), then clears it; Jack Out drops both', () => {
  const x = load(), R = x.w.RolePlay, F = x.w.NetrunEffects;
  const c = x.use(runner([], {}, 6));
  assert.equal(R.netLeft(c, 6).max, 3);
  c.extra = F.setPending(c, true); assert.equal(F.pendingOn(c), true);
  assert.equal(R.netLeft(c, 6).max, 3, 'pending changes nothing until the next turn');
  x.act('pending');
  assert.equal(F.pendingOn(c), false, 'the same switch clears it');
  x.act('pending'); assert.equal(F.pendingOn(c), true); assert.match(x.notes.at(-1), /Marker set/);
  x.w.NetrunConsole.spend();
  x.w.NetrunConsole.newTurn();
  assert.equal(values(c).used, 0); assert.equal(values(c).netPenalty, undefined); assert.equal(values(c).cut, 1);
  const n = R.netLeft(c, 6); assert.equal(n.max, 2); assert.equal(n.left, 2); assert.match(x.notes.at(-1), /2 of 3/);
  x.w.NetrunConsole.newTurn(); assert.equal(values(c).cut, undefined, 'the next turn is whole again'); assert.equal(R.netLeft(c, 6).max, 3);
  // the floor: a character with 2 Actions keeps 2
  const low = x.use(runner([], { roleTools: { netrunner: { team: [], values: { netPenalty: 1 } } } }, 1));
  x.w.NetrunConsole.newTurn(); assert.equal(R.netLeft(low, 1).max, 2); assert.equal(R.netLeft(low, 1).cut, 0);
  // Jack Out clears the marker and the cut
  const run = x.use(runner([], { roleTools: { netrunner: { team: [], values: { netPenalty: 1, cut: 1, jackedIn: true, used: 1 } } } }, 6));
  x.w.NetrunConsole.jack('out');
  assert.equal(values(run).netPenalty, undefined); assert.equal(values(run).cut, undefined); assert.equal(values(run).jackedIn, undefined);
  // the old counter bar path uses the same function
  const old = R.turnExtra({ roleTools: { netrunner: { team: [], values: { netPenalty: 1, used: 2 } } } });
  assert.deepEqual(plain(old.roleTools.netrunner.values), { used: 0, cut: 1 });
});

test('boosters: one roll without it, named in the label, and the switch is spent by that roll only', () => {
  const x = load(), R = x.w.RolePlay, F = x.w.NetrunEffects;
  const w = E('w', 'extra-program-worm', 'Worm'); w.active = true; const er = E('e', 'extra-program-eraser', 'Eraser'); er.active = true;
  const c = x.use(runner([w, er], { roleTools: { netrunner: { team: [], values: { jackedIn: true } } } }));
  x.act('skip', { nxKey: 'extra-program-worm' }); assert.deepEqual(plain(F.skipList(c)), ['extra-program-worm']);
  const info = x.w.NetrunConsole.abilityInfo(c, 4, 'Backdoor');
  assert.equal(info.boost, 0); assert.equal(info.total, 4, 'the button shows the total without the switched-off booster');
  assert.deepEqual(plain(R.netBonus(c, 'Backdoor', ['extra-program-worm'])), { value: 0, names: [], off: ['extra-program-worm'], offNames: ['Worm'] });
  x.w.NetrunConsole.rollAbility('Cloak');
  assert.equal(x.checks.at(-1).label, 'Cloak (Interface 4 + Eraser 2)'); assert.deepEqual(plain(F.skipList(c)), ['extra-program-worm'], 'a roll of another ability keeps the switch');
  x.w.NetrunConsole.rollAbility('Backdoor');
  const k = x.checks.at(-1); assert.equal(k.label, 'Backdoor (Interface 4; Worm off)'); assert.equal(k.base, 4);
  assert.deepEqual(plain(F.skipList(c)), [], 'the switch is spent');
  x.w.NetrunConsole.rollAbility('Backdoor');
  assert.equal(x.checks.at(-1).label, 'Backdoor (Interface 4 + Worm 2)', 'the next roll has it again');
  x.w.NetrunConsole.newTurn(); x.w.lang = 'ru'; x.act('skip', { nxKey: 'extra-program-worm' }); x.w.NetrunConsole.rollAbility('Backdoor');
  assert.equal(x.checks.at(-1).label, 'Backdoor (Interface 4; Worm выкл.)');
});

test('Net speed: Interface + Speedy Gonzalvez + own modifier, labelled, switchable, not stacking, no NET Action spent', () => {
  const x = load({ mods: { wound: -2, effect: 0 } }), F = x.w.NetrunEffects;
  const s1 = E('s1', 'extra-program-speedy-gonzalvez', 'Speedy Gonzalvez'), s2 = E('s2', 'extra-program-speedy-gonzalvez', 'Speedy Gonzalvez');
  s1.active = true; s2.active = true;
  const c = x.use(runner([s1, s2], { roleTools: { netrunner: { team: [], values: { modifier: 3 } } } }));
  let i = F.speedInfo(c, 4, []);
  assert.equal(i.bonus, 2, 'two copies are one bonus'); assert.equal(i.total, 4 + 2 + 3 - 2);
  const r = F.speedRoll();
  const k = x.checks.at(-1);
  assert.equal(k.label, 'Speed (Interface 4 + Speedy Gonzalvez 2)'); assert.equal(k.base, 6); assert.equal(k.o.dv, 0); assert.equal(k.o.mod, 3);
  assert.deepEqual(plain(k.o.parts), [{ k: 'sheet', v: 3 }]);
  assert.equal(r.out.total, 5 + 6 + 3 - 2); assert.equal(c.extra.roleTools?.netrunner?.values?.used, undefined, 'no NET Action');
  assert.match(plain(x.w.NetrunConsole.render(c, 'en')), /Net speed/);
  x.act('skip', { nxKey: F.SPEEDY });
  F.speedRoll(); assert.equal(x.checks.at(-1).label, 'Speed (Interface 4; Speedy Gonzalvez off)'); assert.equal(x.checks.at(-1).base, 4);
  assert.deepEqual(plain(F.skipList(c)), []);
  // not rezzed: no bonus, no mention
  s1.active = s2.active = false; F.speedRoll(); assert.equal(x.checks.at(-1).label, 'Speed (Interface 4)');
  assert.equal(c.extra.cyberdecks.decks[0].entries[0].active, false);
});

test('incoming brain damage: Armor takes 4 and is used up, shown in the line, undone exactly', () => {
  const x = load(), F = x.w.NetrunEffects;
  const ar = E('a', 'extra-program-armor', 'Armor'); ar.active = true;
  const c = x.use(runner([ar], { medical: { stabilized: true } }));
  let p = F.planDamage(c, { amount: 9, to: 'brain', src: 'program', off: [] }, 'en');
  assert.equal(p.ok, true); assert.equal(p.taken, 5); assert.equal(p.after, 25); assert.match(p.text, /Armor −4/); assert.match(p.text, /HP 30 → 25/);
  assert.deepEqual(plain(p.offered.map(o => [o.id, o.ticked])), [['extra-program-armor', true]]);
  const off = F.planDamage(c, { amount: 9, to: 'brain', src: 'program', off: ['extra-program-armor'] }, 'en');
  assert.equal(off.taken, 9); assert.doesNotMatch(off.text, /Armor/); assert.equal(off.offered[0].ticked, false);
  assert.equal(F.planDamage(c, { amount: 3, to: 'brain', src: 'program', off: [] }, 'en').taken, 0, 'never below zero');
  const before = F.snapC(c), r = F.applyDamage(c, p, 'en');
  assert.equal(r.ok, true); assert.equal(c.hp, 25); assert.equal(c.extra.cyberdecks.decks[0].entries[0].spent, true);
  assert.equal(c.extra.medical.stabilized, false, 'new damage reopens stabilization, as in the calculator');
  assert.equal(x.w.RolePlay.armorUp(c), false); assert.equal(F.defenders(c)[F.ARMOR], undefined, 'a used copy is not offered again');
  assert.equal(F.planDamage(c, { amount: 9, to: 'brain', src: 'program', off: [] }, 'en').taken, 9);
  F.restoreC(c, r.before); assert.equal(F.snapC(c), before); assert.equal(c.hp, 30);
  assert.equal(c.extra.medical.stabilized, true);
});

test('Shield: blocks non-Black ICE brain damage whole and derezzes; does nothing against Black ICE; wins over Armor', () => {
  const x = load(), F = x.w.NetrunEffects;
  const sh = E('s', 'extra-program-shield', 'Shield'); sh.active = true; const ar = E('a', 'extra-program-armor', 'Armor'); ar.active = true;
  const c = x.use(runner([sh, ar], {}));
  let p = F.planDamage(c, { amount: 8, to: 'brain', src: 'program', off: [] }, 'en');
  assert.equal(p.taken, 0); assert.match(p.text, /Shield blocks the damage/); assert.equal(p.armor, null, 'Armor is kept for the next hit');
  F.applyDamage(c, p, 'en');
  const e = c.extra.cyberdecks.decks[0].entries;
  assert.equal(c.hp, 30); assert.equal(e[0].down, true); assert.equal(e[0].spent, true); assert.equal(e[0].active, undefined); assert.equal(e[1].spent, undefined);
  assert.equal(x.w.RolePlay.progState(e[0]).down, true);
  p = F.planDamage(c, { amount: 8, to: 'brain', src: 'program', off: [] }, 'en');
  assert.equal(p.taken, 4, 'with the Shield used up, Armor takes its 4');
  // Black ICE: Shield is not offered as active, Armor still works
  const sh2 = E('s2', 'extra-program-shield', 'Shield'); sh2.active = true;
  const c2 = x.use(runner([sh2, E('a2', 'extra-program-armor', 'Armor')], {})); c2.extra.cyberdecks.decks[0].entries[1].active = true;
  const q = F.planDamage(c2, { amount: 8, to: 'brain', src: 'ice', off: [] }, 'en');
  assert.equal(q.shield, null); assert.equal(q.taken, 4); assert.equal(q.offered.find(o => o.id === F.SHIELD).disabled, true);
  assert.equal(F.planDamage(c2, { amount: 8, to: 'brain', src: 'extra-ice-wisp', off: [], penalty: false }, 'en').shield, null);
});

test('Wisp and Vrizzbolt put the pending marker; a blocked effect does not; Flak is marked used and shown', () => {
  const x = load(), F = x.w.NetrunEffects;
  const c = x.use(runner([], {}));
  const p = F.planDamage(c, { amount: 3, to: 'brain', src: 'extra-ice-wisp', off: [], penalty: true }, 'en');
  assert.equal(p.penalty, true); assert.match(p.text, /marker −1 NET Action/);
  F.applyDamage(c, p, 'en'); assert.equal(F.pendingOn(c), true); assert.equal(c.hp, 27);
  const sh = E('s', 'extra-program-shield', 'Shield'); sh.active = true;
  const fl = E('f', 'extra-program-flak', 'Flak'); fl.active = true;
  const c2 = x.use(runner([sh, fl], {}));
  const b = F.planDamage(c2, { amount: 2, to: 'brain', src: 'extra-program-vrizzbolt', off: [], penalty: true }, 'en');
  assert.equal(b.penalty, false, 'a blocked effect is stopped whole'); assert.match(b.text, /Flak: ATK 0/);
  F.applyDamage(c2, b, 'en'); assert.equal(F.pendingOn(c2), false); assert.equal(c2.extra.cyberdecks.decks[0].entries[1].spent, true);
  assert.equal(F.planDamage(c2, { amount: 2, to: 'brain', src: 'ice', off: [] }, 'en').offered.some(o => o.id === F.FLAK), false, 'Flak does not work against Black ICE');
});

test('damage to a program: REZ down, Derezzed at 0, destroyed only when the box says so; Armor does not touch it', () => {
  const x = load(), F = x.w.NetrunEffects;
  const w = E('w', 'extra-program-worm', 'Worm'); w.active = true; const ar = E('a', 'extra-program-armor', 'Armor'); ar.active = true;
  const c = x.use(runner([w, ar], {}));
  let p = F.planDamage(c, { amount: 3, to: 'program', src: 'program', entryId: 'w', off: [] }, 'en');
  assert.equal(p.after, 4); assert.match(p.text, /REZ 7 → 4/);
  F.applyDamage(c, p, 'en'); assert.equal(c.extra.cyberdecks.decks[0].entries[0].rez, 4); assert.equal(c.hp, 30); assert.equal(c.extra.cyberdecks.decks[0].entries[1].spent, undefined);
  p = F.planDamage(c, { amount: 9, to: 'program', src: 'ice', entryId: 'w', off: [] }, 'en');
  assert.equal(p.after, 0); assert.equal(p.derez, true); assert.equal(p.gone, false); assert.match(p.text, /Derezzed/);
  const keep = JSON.stringify(c.extra.cyberdecks);
  F.applyDamage(c, p, 'en'); let e = c.extra.cyberdecks.decks[0].entries[0];
  assert.equal(e.down, true); assert.equal(e.rez, 0); assert.equal(e.active, undefined); assert.equal(e.destroyed, undefined);
  F.restoreC(c, JSON.stringify({ hp: 30, cd: JSON.parse(keep), med: null, rt: null })); assert.equal(JSON.stringify(c.extra.cyberdecks), keep);
  p = F.planDamage(c, { amount: 9, to: 'program', src: 'extra-ice-dragon', entryId: 'w', off: [], destroy: true }, 'en');
  assert.equal(p.gone, true); assert.match(p.text, /Destroyed/);
  F.applyDamage(c, p, 'en'); e = c.extra.cyberdecks.decks[0].entries[0];
  assert.equal(e.destroyed, true); assert.equal(e.active, undefined); assert.equal(x.w.RoleTools.deckState(c).kind, 'ok');
  assert.equal(F.planDamage(c, { amount: 1, to: 'program', src: 'ice', entryId: 'w', off: [] }, 'en').ok, false, 'a destroyed program is not a target');
});

test('bad input changes nothing: no amount, no HP, a program that is gone, a stale stamp', () => {
  const x = load(), F = x.w.NetrunEffects;
  const c = x.use(runner([], {}));
  for (const a of [0, -3, 1000, 2.5, NaN, '5']) assert.equal(F.planDamage(c, { amount: a, to: 'brain', src: 'program', off: [] }, 'en').ok, false, String(a));
  assert.match(F.planDamage(c, { amount: 0, to: 'brain', src: 'program', off: [] }, 'ru').message, /от 1 до 999/);
  const noHp = x.use(runner([], {})); delete noHp.hp;
  assert.match(F.planDamage(noHp, { amount: 3, to: 'brain', src: 'program', off: [] }, 'en').message, /no HP/);
  assert.equal(F.planDamage(c, { amount: 3, to: 'program', src: 'program', entryId: 'nope', off: [] }, 'en').ok, false);
  const snap = F.snapC(c);
  assert.equal(F.applyDamage(c, { ok: false, message: 'x' }, 'en').ok, false);
  assert.equal(F.snapC(c), snap);
  // a plan made for a program that disappeared before the press
  const w = E('w', 'extra-program-worm', 'Worm'); const c2 = x.use(runner([w], {}));
  const p = F.planDamage(c2, { amount: 2, to: 'program', src: 'program', entryId: 'w', off: [] }, 'en');
  c2.extra.cyberdecks.decks[0].entries.length = 0;
  const r = F.applyDamage(c2, p, 'en'); assert.equal(r.ok, false); assert.equal(c2.extra.cyberdecks.decks[0].entries.length, 0);
});

test('the Apply button: stale stamp refused, success saves, offers Undo, and Undo applies only to what it left', () => {
  const x = load(), F = x.w.NetrunEffects;
  const ar = E('a', 'extra-program-armor', 'Armor'); ar.active = true;
  const c = x.use(runner([ar], {}));
  const f = F.formFor(c); f.amount = '9';
  const html = x.w.NetrunConsole.render(c, 'en');
  const stamp = /data-nx-stamp="([^"]+)"/.exec(html)?.[1]; assert.ok(stamp, 'the stamp is on the button');
  assert.match(html, /data-nx-f="def" data-nx-def="extra-program-armor" checked/, 'Armor is ticked in advance');
  c.hp = 29; // the sheet moved on after the card was drawn
  x.act('apply', { nxStamp: stamp }); assert.equal(c.hp, 29); assert.match(x.notes.at(-1), /Data changed/); assert.equal(x.actions.length, 0);
  const fresh = /data-nx-stamp="([^"]+)"/.exec(x.w.NetrunConsole.render(c, 'en'))[1];
  x.act('apply', { nxStamp: fresh });
  assert.equal(c.hp, 24); assert.equal(x.actions.length, 1); assert.equal(x.actions[0].label, 'Undo'); assert.match(x.actions[0].message, /Armor −4/);
  assert.equal(f.amount, '', 'the form is cleared after it was applied');
  c.hp = 10; x.actions[0].fn(); assert.equal(c.hp, 10); assert.match(x.notes.at(-1), /Data changed/);
  c.hp = 24; x.actions[0].fn(); assert.equal(c.hp, 29); assert.equal(c.extra.cyberdecks.decks[0].entries[0].spent, undefined); assert.match(x.notes.at(-1), /Restored/);
  x.act('apply', { nxStamp: '' }); assert.equal(c.hp, 29, 'a button with no stamp does nothing');
});

test('the strip lists what changes the numbers now, with switches for the boosters; an empty deck still has the marker switch', () => {
  const x = load({ mods: { wound: -2, effect: 0 } }), C = x.w.NetrunConsole;
  const empty = x.use(runner([], {}));
  let h = C.render(empty, 'en');
  assert.match(h, /What changes the numbers now/); assert.match(h, /role="switch" aria-checked="false" data-nx-act="pending"/);
  assert.match(h, /Wound penalty and sheet effects[\s\S]*?−2/);
  const w = E('w', 'extra-program-worm', 'Worm'); w.active = true; const sp = E('s', 'extra-program-speedy-gonzalvez', 'Speedy Gonzalvez'); sp.active = true;
  const ar = E('a', 'extra-program-armor', 'Armor'); ar.active = true;
  const c = x.use(runner([w, sp, ar], { roleTools: { netrunner: { team: [], values: { modifier: 1, cut: 1 } } } }, 6));
  h = C.render(c, 'ru');
  assert.match(h, /aria-checked="true" data-nx-act="skip" data-nx-key="extra-program-worm"/); assert.match(h, /Выключить на один бросок/);
  assert.match(h, /data-nx-key="extra-program-speedy-gonzalvez"/); assert.match(h, /−4 к урону мозгу, один раз за забег/);
  assert.match(h, /Свой модификатор/); assert.match(h, /На 1 NET-действие меньше|В этом ходу на 1 NET-действие меньше/);
  x.act('skip', { nxKey: 'extra-program-worm' });
  assert.match(C.render(c, 'en'), /aria-checked="false" data-nx-act="skip" data-nx-key="extra-program-worm"[\s\S]*?off for 1 roll/);
  x.act('skip', { nxKey: 'extra-program-worm' }); assert.deepEqual(plain(x.w.NetrunEffects.skipList(c)), []);
});

test('an old deck with none of the new fields draws and rolls as before, and without the module nothing breaks', () => {
  const x = load(), C = x.w.NetrunConsole;
  const w = E('w', 'extra-program-worm', 'Worm'); w.active = true;
  const c = x.use(runner([w], { roleTools: { netrunner: { team: [], values: { jackedIn: true } } } }));
  x.w.NetrunConsole.rollAbility('Backdoor');
  assert.equal(x.checks.at(-1).label, 'Backdoor (Interface 4 + Worm 2)'); assert.equal(x.checks.at(-1).base, 6);
  assert.equal(values(c).used, 1); assert.equal(x.w.RolePlay.netLeft(c, 4).max, 3);
  const bare = load({ withEffects: false }), c2 = bare.use(runner([w], { roleTools: { netrunner: { team: [], values: { jackedIn: true } } } }));
  const html = bare.w.NetrunConsole.render(c2, 'en');
  assert.doesNotMatch(html, /data-nx-/); bare.w.NetrunConsole.rollAbility('Backdoor'); assert.equal(bare.checks.at(-1).label, 'Backdoor (Interface 4 + Worm 2)');
  const noMeta = x.use(runner([], {})); delete noMeta.extra.cyberdecks;
  assert.doesNotThrow(() => C.render(noMeta, 'en'));
  assert.match(C.render(noMeta, 'en'), /Incoming damage/);
});

test('the deck: destroy, restore and used marks go through the same guarded, validated, undoable path; the rack shows them', () => {
  const x = load(), D = x.w.NetrunDeck;
  const w = E('w', 'extra-program-worm', 'Worm'); w.active = true; const ar = E('a', 'extra-program-armor', 'Armor');
  const c = x.use(runner([w, ar], {}));
  const rev = D.rev(c);
  let r = D.markEntry(c, 'en', { op: 'destroy', deckId: 'd1', entryId: 'w', rev });
  assert.equal(r.ok, true); assert.match(r.message, /Destroyed: Worm/);
  let e = c.extra.cyberdecks.decks[0].entries[0]; assert.equal(e.destroyed, true); assert.equal(e.active, undefined);
  assert.equal(x.w.RoleTools.deckState(c).kind, 'ok');
  let html = D.render(c, 'en'); assert.match(html, /is-gone/); assert.match(html, /Destroyed/);
  assert.equal(D.markEntry(c, 'en', { op: 'destroy', deckId: 'd1', entryId: 'w', rev }).ok, false, 'a stale stamp is refused');
  assert.equal(D.markEntry(c, 'en', { op: 'spend', deckId: 'd1', entryId: 'w', rev: D.rev(c) }).ok, false, 'Worm is not a once-per-run program');
  const back = D.restore(c, r.undo, 'en'); assert.equal(back.ok, true); assert.equal(c.extra.cyberdecks.decks[0].entries[0].destroyed, undefined);
  assert.equal(c.extra.cyberdecks.decks[0].entries[0].active, true, 'the undo returns everything');
  r = D.markEntry(c, 'en', { op: 'destroy', deckId: 'd1', entryId: 'w', rev: D.rev(c) });
  const rs = D.markEntry(c, 'en', { op: 'restore', deckId: 'd1', entryId: 'w', rev: D.rev(c) });
  assert.equal(rs.ok, true); e = c.extra.cyberdecks.decks[0].entries[0];
  assert.equal(e.destroyed, undefined); assert.equal(e.active, undefined); assert.equal(e.rez, undefined);
  assert.equal(D.markEntry(c, 'en', { op: 'restore', deckId: 'd1', entryId: 'w', rev: D.rev(c) }).ok, false, 'nothing to restore');
  const sp = D.markEntry(c, 'ru', { op: 'spend', deckId: 'd1', entryId: 'a', rev: D.rev(c) });
  assert.equal(sp.ok, true); assert.match(sp.message, /Использована: Armor/); assert.equal(c.extra.cyberdecks.decks[0].entries[1].spent, true);
  html = D.render(c, 'ru'); assert.match(html, /is-spent/);
  assert.equal(D.markEntry(c, 'en', { op: 'unspend', deckId: 'd1', entryId: 'a', rev: D.rev(c) }).ok, true); assert.equal(c.extra.cyberdecks.decks[0].entries[1].spent, undefined);
  assert.equal(D.markEntry(c, 'en', { op: 'destroy', deckId: 'd1', entryId: 'nope', rev: D.rev(c) }).ok, false);
});

test('the detail card of an opened program offers the right buttons', () => {
  const x = load(), D = x.w.NetrunDeck;
  const ar = E('a', 'extra-program-armor', 'Armor'); ar.active = true; const hw = E('h', 'extra-deck-range-upgrade', 'Range Upgrade', 'hardware');
  const c = x.use(runner([ar, hw], {}));
  x.w.NetrunConsole.render(c, 'en');
  // open the card the way a press does
  const root = { dataset: { ndChar: 'n1', ndRev: D.rev(c), ndScope: 'owner' }, isConnected: true, closest: () => null, querySelector: () => null };
  const btn = { dataset: { ndAct: 'entry', ndEntry: 'a' }, closest: s => (s === '[data-nd-act]' ? btn : s === '[data-nd-root]' ? root : s === '[data-deck-id]' ? { dataset: { deckId: 'd1' } } : null) };
  x.fire('click', btn);
  const html = D.render(c, 'en');
  assert.match(html, /data-nd-act="spend"/); assert.match(html, /Mark as used/); assert.match(html, /data-nd-act="destroy"/); assert.match(html, /Mark destroyed/);
  ar.destroyed = true; delete ar.active;
  const gone = D.render(c, 'en'); assert.match(gone, /data-nd-act="restore"/); assert.doesNotMatch(gone, /data-rp-deck="toggle"/); assert.doesNotMatch(gone, /data-nd-act="destroy"/);
});

test('plain brain damage does not depend on the deck data passing validation; a changed entry still does', () => {
  const x = load(), F = x.w.NetrunEffects;
  const w = E('w', 'extra-program-worm', 'Worm'), z = E('z', 'extra-program-sword', 'Sword');
  const c = x.use(runner([w, z]));
  c.extra.cyberdecks.decks[0].slots = 1; // two one-slot entries in a one-slot deck: deckState refuses it
  assert.notEqual(x.w.RoleTools.deckState(c).kind, 'ok');
  const snap = JSON.stringify(c.extra.cyberdecks);
  const r = F.applyDamage(c, F.planDamage(c, { amount: 3, to: 'brain', src: 'program', off: [] }, 'en'), 'en');
  assert.equal(r.ok, true); assert.equal(c.hp, 27); assert.equal(JSON.stringify(c.extra.cyberdecks), snap, 'the deck is left as it was');
  const bad = F.applyDamage(c, F.planDamage(c, { amount: 3, to: 'program', src: 'program', entryId: 'w', off: [] }, 'en'), 'en');
  assert.equal(bad.ok, false); assert.equal(JSON.stringify(c.extra.cyberdecks), snap, 'a refused change leaves the deck alone');
});

test('the empty damage form shows a neutral hint, not the error text; the preview region is kept', () => {
  const x = load(), F = x.w.NetrunEffects;
  const c = x.use(runner([]));
  const h = F.render(c, 'en').damage;
  assert.match(h, /nx-idle/); assert.match(h, /Type the damage/); assert.doesNotMatch(h, /Enter damage from 1 to 999/);
  assert.match(F.render(c, 'ru').damage, /Введите урон, и здесь появится расчёт/);
  F.formFor(c).amount = '0';
  assert.match(F.render(c, 'en').damage, /Enter damage from 1 to 999/, 'a typed bad number is still named');
  assert.equal((F.render(c, 'en').damage.match(/data-nx-preview/g) || []).length, 1);
});

test('after Undo the focus goes to the damage form summary, not to the body', () => {
  const x = load(), F = x.w.NetrunEffects, focused = [], old = x.doc.querySelector;
  x.doc.querySelector = s => (s === '[data-nx-dmg] summary' ? { focus: () => focused.push(s) } : old(s));
  const ar = E('a', 'extra-program-armor', 'Armor'); ar.active = true;
  const c = x.use(runner([ar], {}));
  F.formFor(c).amount = '9';
  x.act('apply', { nxStamp: /data-nx-stamp="([^"]+)"/.exec(x.w.NetrunConsole.render(c, 'en'))[1] });
  focused.length = 0;
  x.actions[0].fn();
  assert.equal(c.hp, 30); assert.deepEqual(focused, ['[data-nx-dmg] summary']);
});
