// The run console of the NETRUN tab (site/netrun-console.js): one Interface roll path, jack in / out with undo, the own modifier,
// attacker programs with their attack and damage, Zap in one flow, and the role panel that no longer repeats the Interface block.
const { test } = require('node:test'), assert = require('node:assert/strict'), fs = require('node:fs'), vm = require('node:vm');
const read = f => fs.readFileSync(__dirname + '/../site/' + f, 'utf8');
const plain = x => JSON.parse(JSON.stringify(x));

const ALL = ['catalog.js', 'catalog-extra.js', 'role-tools.js', 'role-play.js', 'netrun-tab.js', 'netrun-deck.js', 'netrun-console.js'];
function load({ files = ALL, mods = { wound: 0, effect: 0 }, dv = null } = {}) {
  const handlers = {}, notes = [], actions = [], checks = [], sums = [], saves = [], redraws = { console: 0, deck: 0 };
  const consoleRoot = { dataset: {}, isConnected: true, replaceWith() { redraws.console++; } };
  const deckRoot = { dataset: {}, isConnected: true, replaceWith() { redraws.deck++; } };
  const dvField = { value: dv === null ? '' : String(dv) };
  let current = null;
  const doc = {
    addEventListener: (t, f) => { (handlers[t] ||= []).push(f); },
    querySelector: s => (s === '[data-nc-root]' ? consoleRoot : s === '[data-nd-root]' ? deckRoot : s === '[data-rp-net-dv]' ? dvField : null),
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
    Rolls: { sum: (label, dice, sides, o) => { sums.push({ label, dice, sides, o }); return true; } },
  };
  const ctx = { window: w, Math, Date, JSON, Object, Array, Number, String, Set, setTimeout: f => { f(); return 0; } };
  vm.createContext(ctx);
  for (const f of files) vm.runInContext(read(f), ctx);
  const fire = (type, target) => { for (const h of handlers[type] || []) h({ type, target }); };
  const el = (sel, dataset = {}, extra = {}) => {
    const self = { dataset, getAttribute: () => null, closest: s => (s === sel ? self : extra[s] ?? null), ...(extra.props || {}) };
    return self;
  };
  return {
    w, notes, actions, checks, sums, saves, redraws, consoleRoot, deckRoot, dvField, handlers, fire, el, state,
    use(c) { current = c; state.characters = [c]; return c; },
    setDv(n) { dvField.value = String(n); fire('input', { closest: s => (s === '[data-rp-net-dv]' ? dvField : null) }); },
    click(sel, dataset, extra) { fire('click', el(sel, dataset, extra)); },
  };
}
const E = (id, cat, name, kind = 'program', slots = 1) => ({ id, catalogId: cat, name: { ru: name, en: name }, kind, slots });
function runner(extra = {}, rank = 4) {
  return {
    id: 'n1', name: 'Nova', role: 'netrunner', rank, hp: 40, stats: {}, skills: {},
    extra: {
      cyberdecks: { version: 1, decks: [{ id: 'd1', name: 'Deck', slots: 7, hardwareOnly: 0, entries: [
        E('e1', 'extra-program-worm', 'Worm'), E('e2', 'extra-program-hellbolt', 'Hellbolt'), E('e3', 'extra-program-sword', 'Sword'),
        E('e4', 'extra-program-deckkrash', 'DeckKRASH'), E('e5', 'extra-program-banhammer', 'Banhammer'), E('e6', 'extra-program-armor', 'Armor'),
      ] }] },
      ...extra,
    },
  };
}
const values = c => c.extra.roleTools.netrunner.values;
const jackIn = x => x.click('[data-nc-act]', { ncAct: 'jack-in' });

test('one roll path: the button total, the label and the check all agree (booster, own modifier, wound penalty)', () => {
  const x = load({ mods: { wound: -2, effect: 1 } }), c = x.use(runner({ roleTools: { netrunner: { team: [], values: { modifier: 3, jackedIn: true } } } }));
  c.extra.cyberdecks.decks[0].entries[0].active = true;
  const C = x.w.NetrunConsole, info = C.abilityInfo(c, 4, 'Backdoor');
  assert.equal(info.total, 4 + 2 + 3 - 2 + 1); assert.deepEqual(plain(info.boosters), ['Worm']);
  assert.equal(C.abilityInfo(c, 4, 'Cloak').total, 4 + 3 - 2 + 1, 'a booster only helps its own ability');
  x.setDv(12);
  const r = C.rollAbility('Backdoor');
  assert.equal(r.ok, true); assert.equal(x.checks.length, 1);
  const k = x.checks[0];
  assert.equal(k.label, 'Backdoor (Interface 4 + Worm 2)'); assert.equal(k.base, 6); assert.equal(k.o.dv, 12); assert.equal(k.o.mod, 3);
  assert.deepEqual(plain(k.o.parts), [{ k: 'sheet', v: 3 }]);
  assert.equal(r.out.total, 5 + info.total, 'the total on the button is what the check rolls');
  assert.equal(values(c).used, 1); assert.equal(x.saves.length >= 1, true);
  assert.equal(x.w.NetrunConsole.abilityInfo(c, 4, 'Scanner').free, true);
});

test('a roll without any own modifier passes no extra parts, and the DV of a result-only ability is dropped', () => {
  const x = load({ dv: 15 }), c = x.use(runner());
  jackIn(x);
  x.w.NetrunConsole.rollAbility('Pathfinder');
  assert.equal(x.checks[0].o.dv, 0); assert.equal(x.checks[0].o.mod, 0); assert.equal(x.checks[0].o.parts, undefined);
  assert.equal(x.checks[0].label, 'Pathfinder (Interface 4)');
  assert.equal(values(c).used, 2, 'Jack In took one NET Action and Pathfinder another');
});

test('jacked out (also an old save with no flag): abilities explain themselves, Scanner still rolls', () => {
  const x = load(), c = x.use(runner());
  assert.equal(x.w.RolePlay.jackedIn(c), false);
  const r = x.w.NetrunConsole.rollAbility('Backdoor');
  assert.equal(r.ok, false); assert.equal(r.reason, 'jack'); assert.match(r.message, /not jacked in/);
  assert.equal(x.checks.length, 0); assert.equal(c.extra.roleTools, undefined, 'nothing is spent or written');
  assert.match(x.notes.at(-1), /Jack In/);
  const s = x.w.NetrunConsole.rollAbility('Scanner');
  assert.equal(s.ok, true); assert.equal(x.checks.length, 1); assert.equal(c.extra.roleTools?.netrunner?.values?.used, undefined, 'Scanner spends no action');
  x.w.lang = 'ru'; const ru = x.w.NetrunConsole.rollAbility('Control');
  assert.match(ru.message, /Вы не в сети/);
});

test('Jack In is a NET Action and no refill; with no actions left an ability explains that instead of rolling', () => {
  const x = load(), c = x.use(runner({ roleTools: { netrunner: { team: [], values: { used: 0 } } } }));
  jackIn(x);
  assert.equal(values(c).jackedIn, true); assert.equal(values(c).used, 1, 'the app reference says Jack In is a NET Action');
  assert.match(x.notes.at(-1), /Jack In is a NET Action: 2 of 3 left/);
  assert.equal(x.w.NetrunConsole.rollAbility('Virus').ok, true);
  x.w.NetrunConsole.rollAbility('Virus');
  const r = x.w.NetrunConsole.rollAbility('Virus');
  assert.equal(r.ok, false); assert.equal(r.reason, 'actions'); assert.match(r.message, /No NET Actions remain/);
  x.click('[data-nc-act]', { ncAct: 'turn' }); assert.equal(values(c).used, 0);
  assert.equal(x.w.NetrunConsole.rollAbility('Virus').ok, true);
  x.click('[data-nc-act]', { ncAct: 'jack-in' });
  assert.match(x.notes.at(-1), /already jacked in/);
});

test('Jack Out asks nothing, does what it did before, clears the flag and offers an exact undo', () => {
  const x = load(), c = x.use(runner());
  jackIn(x);
  x.click('[data-rp-deck]', { rpDeck: 'toggle', deckEntry: 'e1' }, { '[data-deck-id]': { dataset: { deckId: 'd1' } } });
  assert.equal(c.extra.cyberdecks.decks[0].entries[0].active, true); assert.equal(values(c).used, 2);
  x.w.NetrunConsole.setMod(2);
  x.click('[data-nc-act]', { ncAct: 'jack-out' });
  const e = c.extra.cyberdecks.decks[0].entries[0];
  assert.ok(e.active === undefined && e.rez === undefined && e.down === undefined);
  assert.equal(values(c).used, 3, 'Jack In 1 + Sword toggle 1 + the safe Jack Out 1: leaving the net does not refill the counter'); assert.equal(values(c).jackedIn, undefined); assert.equal(values(c).modifier, 2, 'the modifier is kept');
  assert.equal(x.actions.length, 1); assert.equal(x.actions[0].label, 'Undo'); assert.match(x.actions[0].message, /Jack Out/);
  assert.equal(x.w.RoleTools.deckState(c).kind, 'ok');
  x.actions[0].fn();
  assert.equal(c.extra.cyberdecks.decks[0].entries[0].active, true); assert.equal(values(c).jackedIn, true); assert.equal(values(c).used, 2);
  assert.equal(x.w.RoleTools.deckState(c).kind, 'ok');
});

test('the undo of Jack Out does nothing when the data moved on meanwhile', () => {
  const x = load(), c = x.use(runner());
  jackIn(x); x.click('[data-nc-act]', { ncAct: 'jack-out' });
  const act = x.actions[0]; x.w.NetrunConsole.setMod(5);
  const before = JSON.stringify(c); act.fn();
  assert.equal(JSON.stringify(c), before); assert.match(x.notes.at(-1), /Data changed/);
});

test('the Jack Out button of the deck card goes the same way (with the undo), for a character with a deck or without', () => {
  const x = load(), c = x.use(runner());
  jackIn(x);
  x.click('[data-rp-deck]', { rpDeck: 'jackout' }, { '[data-deck-id]': { dataset: { deckId: 'd1' } } });
  assert.equal(x.actions.length, 1); assert.equal(values(c).jackedIn, undefined);
  const y = load(), d = y.use({ id: 'z', role: 'netrunner', rank: 2, extra: {} });
  jackIn(y); assert.equal(d.extra.roleTools.netrunner.values.jackedIn, true);
  y.click('[data-nc-act]', { ncAct: 'jack-out' });
  assert.equal(d.extra.roleTools.netrunner.values.jackedIn, undefined); assert.equal(y.actions.length, 1);
  y.actions[0].fn(); assert.equal(d.extra.roleTools.netrunner.values.jackedIn, true);
});

test('spend and new turn work the counter by hand', () => {
  const x = load(), c = x.use(runner());
  const N = x.w.NetrunConsole;
  assert.equal(N.spend(), true); assert.equal(values(c).used, 1);
  N.spend(); N.spend(); assert.equal(values(c).used, 3);
  assert.equal(N.spend(), false); assert.match(x.notes.at(-1), /No NET Actions remain/);
  N.newTurn(); assert.equal(values(c).used, 0);
});

test('the own modifier is the persisted field of the Role tools: kept in the sheet, clamped, typed values update the buttons', () => {
  const x = load(), c = x.use(runner({ roleTools: { netrunner: { team: [], values: { modifier: -4, netDv: 10 } } } }));
  assert.match(x.w.NetrunConsole.render(c, 'ru'), /Свой модификатор[\s\S]*data-nc-mod value="-4"/);
  assert.equal(x.w.NetrunConsole.setMod('7'), 7); assert.equal(values(c).modifier, 7); assert.equal(values(c).netDv, 10, 'other saved fields stay');
  assert.equal(x.w.NetrunConsole.setMod('500'), 100); assert.equal(x.w.NetrunConsole.setMod('-500'), -100);
  assert.equal(x.w.NetrunConsole.setMod('abc'), false); assert.equal(values(c).modifier, -100);
  assert.equal(x.w.NetrunConsole.abilityInfo(c, 4, 'Zap').total, 4 - 100);
  // the field persists through the same value the Role tools read
  assert.equal(x.w.RolePlay.netMod(c), -100);
});

test('the console draws the status line, DV and modifier fields and nine buttons with their totals, in both languages', () => {
  const x = load({ mods: { wound: -2, effect: 0 } }), c = x.use(runner({ roleTools: { netrunner: { team: [], values: { modifier: 1, used: 1, jackedIn: true } } } }));
  c.extra.cyberdecks.decks[0].entries[0].active = true;
  for (const l of ['en', 'ru']) {
    const h = x.w.NetrunConsole.render(c, l);
    assert.equal((h.match(/data-netrun-roll="/g) || []).length, 9);
    assert.match(h, /netrun-grid nc-grid/); assert.match(h, /data-nc-act="jack-out"/); assert.doesNotMatch(h, /data-nc-act="jack-in"/);
    assert.equal((h.match(/class="nc-pip is-on"/g) || []).length, 2); assert.equal((h.match(/class="nc-pip"/g) || []).length, 1);
    assert.match(h, /data-rp-net-dv/); assert.match(h, /data-nc-mod/); assert.match(h, /data-nc-act="turn"/);
    assert.match(h, /data-netrun-roll="Backdoor"[^>]*data-nc-total="5"/, 'Interface 4 + Worm 2 + 1 − 2');
    assert.match(h, /data-netrun-roll="Cloak"[^>]*data-nc-total="3"/);
    assert.match(h, l === 'ru' ? /Scanner<\/b><em>[^<]*<\/em><small>без действия/ : /Scanner<\/b><em>[^<]*<\/em><small>no action/);
    assert.doesNotMatch(h, /undefined|NaN|\[object/);
    assert.match(h, l === 'ru' ? /NET-действий осталось 2 из 3/ : /2 of 3 NET Actions left/);
  }
  const off = x.w.NetrunConsole.render(runner(), 'en');
  assert.match(off, /data-nc-act="jack-in"/); assert.match(off, /nc-ab is-off" data-netrun-roll="Backdoor"/); assert.doesNotMatch(off, /nc-ab is-off" data-netrun-roll="Scanner"/);
  assert.equal(x.w.NetrunConsole.render({ id: 'q', role: 'solo', rank: 3, extra: {} }, 'en'), '');
});

test('the tab shows the console, then the deck; without the console module the plain block still works', () => {
  const x = load(), c = x.use(runner());
  const h = x.w.NetrunTab.render(c, 'en');
  assert.ok(h.indexOf('data-nc-root') >= 0 && h.indexOf('data-nc-root') < h.indexOf('data-nd-root'));
  assert.doesNotMatch(h, /data-netrun-zap/, 'Zap is one flow in the grid, not a separate dice button');
  const bare = load({ files: ALL.filter(f => f !== 'netrun-console.js') }), p = bare.use(runner());
  assert.match(bare.w.NetrunTab.render(p, 'en'), /data-netrun-zap/);
  bare.click('[data-netrun-roll]', { netrunRoll: 'Backdoor' }); assert.equal(bare.checks.length, 1, 'the plain tab rolls without the jack gate');
});

test('Zap is one flow: roll, and a hit offers 1d6 right there; a miss does not; no DV leaves the call to the player', () => {
  const x = load({ dv: 8 }), c = x.use(runner({ roleTools: { netrunner: { team: [], values: { jackedIn: true } } } }));
  const N = x.w.NetrunConsole;
  let r = N.rollAbility('Zap'); assert.equal(r.out.beat, true);
  let h = N.render(c, 'en'); assert.match(h, /data-nc-act="zap-dmg">Damage 1d6/); assert.match(h, /On a success, roll the damage/);
  const d = N.zapDamage(() => 0.99);
  assert.deepEqual(plain(x.sums.at(-1)), { label: 'NET · damage · Zap', dice: [6], sides: 6 });
  assert.equal(d.total, 6); h = N.render(c, 'en'); assert.match(h, /Zap damage: 1d6 = 6/); assert.doesNotMatch(h, /data-nc-act="zap-dmg"/);
  x.setDv(40); r = N.rollAbility('Zap'); assert.equal(r.out.beat, false);
  h = N.render(c, 'en'); assert.doesNotMatch(h, /data-nc-act="zap-dmg"/); assert.match(h, /A miss: no damage/);
  assert.equal(N.zapDamage(), false, 'no damage after a miss');
  x.setDv(0); N.rollAbility('Zap'); h = N.render(c, 'ru');
  assert.match(h, /data-nc-act="zap-dmg">Урон 1d6/); assert.match(h, /DV не задан: бросайте урон/);
  assert.equal(x.w.NetrunConsole.zapDamage(() => 0).total, 1);
});

test('attacker programs have run state: activation costs a NET Action, there is no REZ to keep', () => {
  const x = load(), c = x.use(runner()), R = x.w.RolePlay;
  const hell = c.extra.cyberdecks.decks[0].entries[1];
  assert.equal(R.progState(hell), null, 'progState itself did not change');
  assert.deepEqual(plain(R.runState(hell)), { max: 0, active: false, down: false, rez: 0, attacker: true });
  assert.equal(R.runState(c.extra.cyberdecks.decks[0].entries[5]).attacker, undefined, 'a defender keeps its REZ state');
  let r = R.deckAct(c, 'd1', 'e2', 'toggle', 4, 'en'); assert.equal(r.ok, true);
  c.extra = r.extra; assert.equal(c.extra.cyberdecks.decks[0].entries[1].active, true); assert.equal(c.extra.cyberdecks.decks[0].entries[1].rez, undefined);
  assert.equal(c.extra.roleTools.netrunner.values.used, 1);
  assert.equal(R.runState(c.extra.cyberdecks.decks[0].entries[1]).active, true);
  assert.equal(R.deckAct(c, 'd1', 'e2', 'rez-', 4, 'en').ok, false); assert.equal(R.deckAct(c, 'd1', 'e2', 'rez+', 4, 'en').ok, false);
  assert.equal(x.w.RoleTools.deckState(c).kind, 'ok');
  r = R.deckAct(c, 'd1', 'e2', 'toggle', 4, 'en'); c.extra = r.extra;
  assert.equal(c.extra.cyberdecks.decks[0].entries[1].active, undefined); assert.equal(c.extra.roleTools.netrunner.values.used, 2);
  assert.equal(R.netBonus(c, 'Backdoor').value, 0, 'an attacker is no booster');
});

test('Атака: Interface + ATK + the own modifier through the same check, needs a jacked-in character and an active program', () => {
  const x = load({ dv: 11 }), c = x.use(runner({ roleTools: { netrunner: { team: [], values: { modifier: 2 } } } })), N = x.w.NetrunConsole;
  let r = N.attack('d1', 'e2'); assert.equal(r.ok, false); assert.equal(r.reason, 'jack'); assert.equal(x.checks.length, 0);
  jackIn(x);
  r = N.attack('d1', 'e2'); assert.equal(r.reason, 'idle'); assert.match(r.message, /not rezzed/);
  c.extra = x.w.RolePlay.deckAct(c, 'd1', 'e2', 'toggle', 4, 'en').extra;
  const used = values(c).used;
  r = N.attack('d1', 'e2'); assert.equal(r.ok, true);
  const k = x.checks.at(-1);
  assert.equal(k.base, 4 + 2); assert.equal(k.label, 'Hellbolt (Interface 4 + ATK 2)'); assert.equal(k.o.dv, 11); assert.equal(k.o.mod, 2); assert.deepEqual(plain(k.o.parts), [{ k: 'sheet', v: 2 }]);
  assert.equal(values(c).used, used, 'the attack itself spends no NET Action');
  assert.equal(N.attackInfo(c, 4, c.extra.cyberdecks.decks[0].entries[1]).total, 8);
  assert.equal(N.attack('d1', 'nope').reason, 'stale'); assert.equal(N.attack('x', 'e2').reason, 'stale'); assert.equal(N.attack('d1', 'e1').reason, 'stale', 'a booster cannot attack');
});

test('the damage of an attacker comes from the data when it is there: Hellbolt 2d6 to the brain, Sword and Banhammer by target', () => {
  const x = load({ dv: 5 }), c = x.use(runner({ roleTools: { netrunner: { team: [], values: { jackedIn: true } } } })), N = x.w.NetrunConsole, R = x.w.RolePlay;
  assert.deepEqual(plain(R.attackDamage('extra-program-hellbolt', false)), { fixed: true, plan: { dice: 2, to: 'brain' }, dice: 2, to: 'brain', byTarget: false });
  assert.equal(R.attackDamage('extra-program-vrizzbolt', false).dice, 1);
  assert.equal(R.attackDamage('extra-program-sword', true).dice, 3); assert.equal(R.attackDamage('extra-program-sword', false).dice, 2);
  assert.equal(R.attackDamage('extra-program-banhammer', true).dice, 2); assert.equal(R.attackDamage('extra-program-banhammer', false).dice, 3);
  assert.equal(R.attackDamage('extra-program-deckkrash', false).fixed, false);
  for (const id of ['e2', 'e3', 'e4', 'e5']) { c.extra = R.withRun(c.extra, { used: 0 }); c.extra = R.deckAct(c, 'd1', id, 'toggle', 4, 'en').extra; }
  c.extra = R.withRun(c.extra, { used: 0 });
  N.attack('d1', 'e2');
  let card = N.attackHtml(c, c.extra.cyberdecks.decks[0].entries[1], 'en');
  assert.match(card, /data-nc-act="attack-dmg"[^>]*>Damage 2d6 · to the brain/);
  const d = N.attackDamageRoll('dmg', 'd1', 'e2', () => 0.5);
  assert.equal(d.total, 8); assert.deepEqual(plain(x.sums.at(-1).dice), [4, 4]); assert.match(x.sums.at(-1).label, /^NET · damage · Hellbolt$/); assert.equal(x.sums.at(-1).o.note, 'to the brain, straight to HP');
  assert.match(N.attackHtml(c, c.extra.cyberdecks.decks[0].entries[1], 'en'), /Damage 2d6 \(4 \+ 4\) = 8 to the brain/);
  // Sword: the dice follow the target
  N.attack('d1', 'e3');
  card = N.attackHtml(c, c.extra.cyberdecks.decks[0].entries[2], 'en'); assert.match(card, /Damage 2d6 · to REZ/); assert.match(card, /data-nc-vs/);
  x.fire('change', { closest: s => (s === '[data-nc-vs]' ? { value: 'ice' } : null) });
  assert.match(N.attackHtml(c, c.extra.cyberdecks.decks[0].entries[2], 'en'), /Damage 3d6 · to REZ/);
  assert.equal(N.attackDamageRoll('dmg', 'd1', 'e3', () => 0).total, 3);
  // the Russian card
  assert.match(N.attackHtml(c, c.extra.cyberdecks.decks[0].entries[2], 'ru'), /Урон 3d6 по REZ|Урон 3d6 · по REZ/);
});

test('an attacker whose effect has dice only in its text gets a neutral dice picker (no default, not called damage); one with no dice gets none', () => {
  const x = load({ dv: 5 }), c = x.use(runner({ roleTools: { netrunner: { team: [], values: { jackedIn: true } } } })), N = x.w.NetrunConsole, R = x.w.RolePlay;
  c.extra.cyberdecks.decks[0].slots = 9;
  c.extra.cyberdecks.decks[0].entries.push(E('e7', 'extra-program-nervescrub', 'Nervescrub'));
  c.extra = R.deckAct(c, 'd1', 'e7', 'toggle', 4, 'en').extra; c.extra = R.deckAct(c, 'd1', 'e4', 'toggle', 4, 'en').extra;
  N.attack('d1', 'e7');
  const entry = id => c.extra.cyberdecks.decks[0].entries.find(e => e.id === id);
  let card = N.attackHtml(c, entry('e7'), 'en');
  assert.match(card, /data-nc-dice value="" placeholder/, 'no invented default number of dice'); assert.match(card, /data-nc-act="attack-dice"/); assert.match(card, /not necessarily damage/);
  const before = x.notes.length;
  assert.equal(N.attackDamageRoll('dice', 'd1', 'e7', () => 0), false); assert.match(x.notes.at(-1), /number of dice from 1 to 6/); assert.equal(x.notes.length, before + 1);
  x.fire('input', { closest: s => (s === '[data-nc-dice]' ? { value: '3' } : null) });
  const d = N.attackDamageRoll('dice', 'd1', 'e7', () => 0); assert.equal(d.total, 3); assert.equal(x.sums.at(-1).dice.length, 3);
  assert.equal(x.sums.at(-1).label, 'NET · dice · Nervescrub', 'the roll is not logged as damage'); assert.doesNotMatch(x.sums.at(-1).label, /damage/);
  assert.match(N.attackHtml(c, entry('e7'), 'ru'), /3d6 \(1 \+ 1 \+ 1\) = 3/);
  x.fire('input', { closest: s => (s === '[data-nc-dice]' ? { value: '99' } : null) });
  assert.equal(N.attackDamageRoll('dice', 'd1', 'e7', () => 0).total, 6, 'at most six dice');
  // DeckKRASH names no dice at all: no picker, and the roll is refused even if called directly
  N.attack('d1', 'e4');
  card = N.attackHtml(c, entry('e4'), 'en'); assert.doesNotMatch(card, /attack-dice|data-nc-dice/); assert.match(card, /names no dice/);
  assert.equal(N.attackDamageRoll('dice', 'd1', 'e4', () => 0), false);
  // a miss
  x.setDv(60); N.attack('d1', 'e7');
  card = N.attackHtml(c, entry('e7'), 'en'); assert.match(card, /A miss: no damage/); assert.doesNotMatch(card, /data-nc-act="attack-dice"/);
  assert.equal(N.attackDamageRoll('dice', 'd1', 'e7'), false);
  // damage of a program that did not attack, or a stale entry, is refused
  assert.equal(N.attackDamageRoll('dmg', 'd1', 'e2'), false);
});

test('Jack Out leaves the net on every deck, and Jack In spends one action of a counter that is already running (old save mid-run)', () => {
  const x = load(), c = x.use(runner({ roleTools: { netrunner: { team: [], values: { jackedIn: true, used: 1 } } } })), R = x.w.RolePlay;
  c.extra.cyberdecks.decks.push({ id: 'd2', name: 'Deck 2', slots: 7, hardwareOnly: 0, entries: [E('f1', 'extra-program-worm', 'Worm2')] });
  c.extra.cyberdecks.decks[1].entries[0].active = true; c.extra.cyberdecks.decks[1].entries[0].rez = 7;
  assert.equal(R.netBonus(c, 'Backdoor').value, 2);
  x.click('[data-nc-act]', { ncAct: 'jack-out' });
  assert.equal(R.netBonus(c, 'Backdoor').value, 0, 'no stale booster of the other deck');
  assert.equal(c.extra.cyberdecks.decks[1].entries[0].active, undefined); assert.equal(values(c).jackedIn, undefined); assert.equal(values(c).used, 2, 'the safe Jack Out cost one action and refilled nothing');
  assert.match(x.actions[0].message, /all decks/);
  assert.equal(x.w.NetrunConsole.abilityInfo(c, 4, 'Backdoor').total, 4);
  x.actions[0].fn(); assert.equal(c.extra.cyberdecks.decks[1].entries[0].active, true, 'the undo brings both decks back');
  // an old save: counter spent, no flag
  const y = load(), o = y.use(runner({ roleTools: { netrunner: { team: [], values: { used: 2 } } } }));
  jackIn(y);
  assert.equal(values(o).jackedIn, true); assert.equal(values(o).used, 3, 'the turn in progress is not refilled: one more action is spent');
  assert.equal(y.w.NetrunConsole.rollAbility('Virus').reason, 'actions');
  y.click('[data-nc-act]', { ncAct: 'turn' }); assert.equal(values(o).used, 0);
  // no action left: Jack In and a safe Jack Out both explain themselves and change nothing
  const z = load(), p = z.use(runner({ roleTools: { netrunner: { team: [], values: { used: 3 } } } }));
  const snap = JSON.stringify(p); jackIn(z);
  assert.match(z.notes.at(-1), /No NET Actions remain/); assert.equal(JSON.stringify(p), snap);
  const q = load(), s = q.use(runner({ roleTools: { netrunner: { team: [], values: { used: 3, jackedIn: true } } } })), snap2 = JSON.stringify(s);
  q.click('[data-nc-act]', { ncAct: 'jack-out' });
  assert.match(q.notes.at(-1), /safe Jack Out needs a NET Action/); assert.equal(JSON.stringify(s), snap2); assert.equal(q.actions.length, 0);
});

test('focus follows a replaced control, the message is not announced twice, attackers get no REZ hint, no dimming by opacity', () => {
  const src = read('netrun-console.js'), css = read('netrun-console.css');
  assert.match(src, /refreshAll\(succ\)/); assert.match(src, /atkSel\(entryId,'attack'\)/); assert.match(src, /data-nc-dmg tabindex="-1"/);
  assert.doesNotMatch(css, /\.nc-ab\.is-off \{[^}]*opacity/);
  const x = load(), c = x.use(runner()), N = x.w.NetrunConsole;
  x.setDv(5);
  N.rollAbility('Backdoor');
  const h = N.render(c, 'en');
  assert.match(h, /<p class="nc-msg">[^<]*not jacked in[^<]*<\/p><div class="nc-result"/, 'the message sits outside the live region');
  assert.doesNotMatch(N.attackHtml(c, c.extra.cyberdecks.decks[0].entries[1], 'en'), /role="status"><p class="nc-msg"/);
  const d = x.w.NetrunDeck;
  const only = runner(); only.extra.cyberdecks.decks[0].entries = [E('e2', 'extra-program-hellbolt', 'Hellbolt')];
  assert.doesNotMatch(d.render(only, 'en'), /Derezzed: deactivate/); assert.match(d.render(only, 'en'), /Activating, deactivating and Jack Out cost a NET Action\./);
  assert.match(d.render(c, 'en'), /At REZ 0 a program is Derezzed/);
  assert.doesNotMatch(x.w.RoleTools.derived(c, 'en'), /Remaining this turn/, 'the read-only counter is not repeated in the role panel');
});

test('the deck draws an attacker with its ATK (no REZ), a booster keeps its REZ, and its card carries the attack block', () => {
  const x = load(), c = x.use(runner({ roleTools: { netrunner: { team: [], values: { jackedIn: true } } } }));
  c.extra = x.w.RolePlay.deckAct(c, 'd1', 'e2', 'toggle', 4, 'en').extra; c.extra = x.w.RolePlay.deckAct(c, 'd1', 'e1', 'toggle', 4, 'en').extra;
  const h = x.w.NetrunDeck.render(c, 'en');
  assert.match(h, /Hellbolt<\/span><small>ATK 2</); assert.match(h, /Worm<\/span><small>REZ 7\/7</);
  assert.match(h, /nd-cell nd-filled nd-k-program is-on[^>]*aria-label="Hellbolt, slots: 1, Rezzed\. Details"/);
  const card = x.w.NetrunConsole.attackHtml(c, c.extra.cyberdecks.decks[0].entries[1], 'en');
  assert.match(card, /data-nc-act="attack" data-deck-entry="e2">Attack <b>\+6<\/b>/); assert.doesNotMatch(card, /data-rp-deck="rez/);
  assert.equal(x.w.NetrunConsole.attackHtml(c, c.extra.cyberdecks.decks[0].entries[0], 'en'), '', 'only attackers have the block');
  assert.match(read('netrun-deck.js'), /NetrunConsole\?\.attackHtml/);
});

test('the role panel no longer repeats the Interface block for a character with the NETRUN tab, and keeps it for the rest', () => {
  const withTab = load(), c = withTab.use(runner());
  const h = withTab.w.RoleTools.render(c, 'en');
  assert.doesNotMatch(h, /data-rt-action="net-roll"/); assert.doesNotMatch(h, /data-rt-field="netDv"/); assert.doesNotMatch(h, /data-rt-field="netAbility"/);
  assert.match(h, /data-netrun-open/); assert.match(h, /now on the NETRUN tab/);
  const multi = withTab.use({ id: 'm', role: 'solo', rank: 5, stats: {}, skills: {}, extra: { additionalRoles: [{ role: 'netrunner', rank: 3 }] } });
  assert.equal(withTab.w.NetrunTab.interfaceRank(multi), 3);
  const noTab = load({ files: ['catalog.js', 'catalog-extra.js', 'role-tools.js', 'role-play.js'] });
  assert.match(noTab.w.RoleTools.render(runner(), 'en'), /data-rt-action="net-roll"/);
  assert.match(noTab.w.RoleTools.render(runner(), 'ru'), /data-rt-field="modifier"/);
});

test('old data keeps working: no flag, no modifier, attackers without state; validators accept both old and new records', () => {
  const x = load(), c = x.use(runner());
  const before = JSON.stringify(c);
  x.w.NetrunConsole.render(c, 'en'); x.w.NetrunTab.render(c, 'ru');
  assert.equal(JSON.stringify(c), before, 'drawing changes nothing');
  assert.equal(x.w.RoleTools.deckState(c).kind, 'ok');
  c.extra = x.w.RolePlay.deckAct(c, 'd1', 'e2', 'toggle', 4, 'en').extra;
  c.extra = x.w.RolePlay.withRun(c.extra, { jackedIn: true, modifier: 3 });
  assert.equal(x.w.RoleTools.deckState(c).kind, 'ok');
  assert.equal(x.w.RolePlay.netMod({ extra: { roleTools: { netrunner: { values: { modifier: 'x' } } } } }), 0);
  assert.equal(x.w.RolePlay.jackedIn({ extra: { roleTools: { netrunner: { values: { jackedIn: 'yes' } } } } }), false, 'only a real true counts');
});

test('the 32 px REZ buttons are 44 px now, and the console targets are 44 px', () => {
  assert.match(read('role-play.css'), /\.rp-prog-row \.rt-button \{ min-height:44px; min-width:44px;/);
  const css = read('netrun-console.css');
  assert.match(css, /\.nc-btn \{[^}]*min-height: 44px; min-width: 44px;/); assert.match(css, /\.nc-card \.nc-field input[^}]*min-height: 44px/);
  assert.match(css, /\.nc-ab \{[^}]*min-height: 56px/);
  assert.match(css, /\.nc-grid \{ grid-template-columns: repeat\(3, minmax\(0, 1fr\)\)/, 'three columns on a phone');
});

test('the module is registered, loaded after the tab and before app.js, never uses a dialog or the network', () => {
  const index = read('index.html');
  assert.ok(index.includes('<script src="netrun-console.js"></script>') && index.includes('<link rel="stylesheet" href="netrun-console.css">'));
  assert.ok(index.indexOf('src="netrun-console.js"') > index.indexOf('src="netrun-tab.js"') && index.indexOf('src="netrun-console.js"') < index.indexOf('src="app.js"'));
  const src = read('netrun-console.js').replace(/\/\*[\s\S]*?\*\//, '');
  assert.doesNotMatch(src, /\bconfirm\s*\(|\balert\s*\(|\bprompt\s*\(/); assert.doesNotMatch(src, /fetch\(|XMLHttpRequest|WebSocket|localStorage|innerHTML\s*=\s*[^;]*\+\s*\w+\.name/);
  assert.doesNotMatch(read('netrun-console.js'), /\r/);
});
