// The player's fight on the sheet (site/play-combat.js): pure rules and the small DOM helpers.
const { test } = require('node:test'), assert = require('node:assert/strict'), fs = require('node:fs'), vm = require('node:vm');
const read = name => fs.readFileSync(__dirname + '/../site/' + name, 'utf8');
const plain = value => JSON.parse(JSON.stringify(value));

function load(extra = {}) {
  const w = { ...extra }, ctx = { window: w, console, Math, JSON, Set, Map, Number, String, Array, Object, Date };
  vm.createContext(ctx);
  vm.runInContext(read('play-combat.js'), ctx);
  return w;
}
const PC = load().PlayCombat;

test('the module is registered before app.js and its stylesheet is linked', () => {
  const index = read('index.html');
  assert.ok(index.indexOf('<script src="play-combat.js"></script>') > 0);
  assert.ok(index.indexOf('<script src="play-combat.js"></script>') < index.indexOf('<script src="app.js"></script>'));
  assert.ok(index.includes('<link rel="stylesheet" href="play-combat.css">'));
});

test('keeping the place: a control is found again by tag, data-attributes and its number among equals', () => {
  const el = { tagName: 'BUTTON', id: '', attributes: [{ name: 'class', value: 'cx-button' }, { name: 'data-cx-action', value: 'attack' }, { name: 'data-cx-index', value: '1' }], getAttribute: () => null };
  const root = { querySelectorAll: sel => { assert.equal(sel, 'button[data-cx-action="attack"][data-cx-index="1"]'); return [{}, el]; } };
  assert.deepEqual(plain(PC.markOf(el, root)), { sel: 'button[data-cx-action="attack"][data-cx-index="1"]', index: 1 });
  assert.equal(PC.markOf({ tagName: 'DIV', attributes: [], getAttribute: () => null }, root), null, 'nothing to find it by');
  assert.equal(PC.markOf({ tagName: 'INPUT', id: 'a"b', attributes: [], getAttribute: () => null }, { querySelectorAll: () => [] }).sel, 'input[id="a\\"b"]');
});

test('keeping the place: the page moves by exactly what the control moved', () => {
  assert.equal(PC.scrollFix(402, -344), -746);
  assert.equal(PC.scrollFix(402, 402.4), 0);
  assert.equal(PC.scrollFix(100, 206), 106);
});

test('keeping the place: the app asks for it around every redraw, and the sheet turns browser anchoring off', () => {
  const app = read('app.js');
  assert.ok(app.includes("const kept=window.PlayCombat?.keepPlace?.(state.view+'|'+(state.view==='sheet'?state.active:''));renderView();"));
  assert.ok(app.includes('kept?.();'));
  assert.match(read('play-combat.css'), /body:has\(\.sheet-layout\)\{overflow-anchor:none\}/);
});

test('keeping the place: a new screen is navigation and is left alone; the same screen is restored', () => {
  const calls = [];
  let top = 400;
  const button = { tagName: 'BUTTON', id: 'go', isConnected: true, attributes: [], getAttribute: () => null, getClientRects: () => [1], getBoundingClientRect: () => ({ top }), closest: () => button };
  const listeners = {};
  const body = { querySelectorAll: () => [button] };
  const w = load({ scrollY: 900, scrollBy: (x, y) => { calls.push(['by', y]); w.scrollY += y; }, scrollTo: (x, y) => { calls.push(['to', y]); w.scrollY = y; }, document: { body, querySelector: () => null, addEventListener: (type, fn) => { listeners[type] ||= fn; } } });
  listeners.click({ target: button });
  assert.equal(w.PlayCombat.keepPlace('sheet|a'), null, 'first draw of a screen');
  const after = w.PlayCombat.keepPlace('sheet|a'); assert.equal(typeof after, 'function');
  top = -346; after();
  assert.deepEqual(calls, [['by', -746]]); assert.equal(w.scrollY, 154);
  assert.equal(w.PlayCombat.keepPlace('combat|'), null, 'another screen');
});

// ---------- wounds, death, Death Save ----------
const withEffects = () => { const w = {}, ctx = { window: w, globalThis: {}, console, Math, JSON, Set, Map, Number, String, Array, Object, Date }; ctx.globalThis.window = w; vm.createContext(ctx); vm.runInContext(read('effects.js'), ctx); vm.runInContext(read('play-combat.js'), ctx); return w; };
const solo = (extra = {}, hp = 45) => ({ id: 'v', stats: { BODY: 8, WILL: 6 }, hp, extra });
const lung = () => ({ version: 1, entries: [{ id: 'a', location: 'body', score: 4, status: 'active', detail: '' }] });

test('condition: the worst state first, with the penalty a check takes', () => {
  assert.deepEqual(plain(PC.condition(solo())), { state: '', penalty: 0 });
  assert.deepEqual(plain(PC.condition(solo({}, 22))), { state: 'serious', penalty: -2 });
  assert.deepEqual(plain(PC.condition(solo({}, 23))), { state: '', penalty: 0 }, 'half of 45 rounds up');
  assert.deepEqual(plain(PC.condition(solo({}, 0))), { state: 'mortal', penalty: -4 });
  assert.deepEqual(plain(PC.condition(solo({ deathRecord: { version: 1, dead: true } }, 0))), { state: 'dead', penalty: 0 });
  assert.equal(PC.condition(solo({ medical: { version: 1, unconscious: true } }, 30)).unconscious, true);
});

test('Death Save: a Critical Injury raises the base penalty, healing takes it away, a hand-set base is not raised twice', () => {
  assert.deepEqual(plain(PC.deathPlan(solo({ baseDeathPenalty: 0, deathPenalty: 0 }), 1)), { ok: true, base: 0, penalty: 0, need: 1, nextBase: 1, nextPenalty: 1, changed: true });
  const byHand = PC.deathPlan(solo({ baseDeathPenalty: 1, deathPenalty: 3 }), 1);
  assert.equal(byHand.nextBase, 1); assert.equal(byHand.nextPenalty, 3); assert.equal(byHand.changed, true, 'only the note of what is counted is new');
  const healed = PC.deathPlan(solo({ baseDeathPenalty: 2, deathPenalty: 4, deathInjuryBase: 1 }), 0);
  assert.equal(healed.nextBase, 1); assert.equal(healed.nextPenalty, 3);
  assert.equal(PC.deathPlan(solo({}), 0).changed, false, 'an old sheet without injuries is left as it is');
  assert.equal(PC.deathPlan({ id: 'x' }, 2).ok, false);
});

test('Death Save: the sheet follows the injuries and the button shows the number that will be used', () => {
  const w = withEffects(), c = solo({ baseDeathPenalty: 0, deathPenalty: 0, criticalInjuries: lung() }, 0);
  assert.equal(w.PlayCombat.deathTarget(c), 7, 'BODY 8 minus the Collapsed Lung');
  assert.equal(w.PlayCombat.syncDeathBaseAll([c], 'ru'), 'Базовый штраф Death Save: 0 → 1 (критические ранения)');
  assert.deepEqual([c.extra.baseDeathPenalty, c.extra.deathPenalty, c.extra.deathInjuryBase], [1, 1, 1]);
  assert.equal(w.PlayCombat.syncDeathBase(c).changed, false, 'the second time changes nothing');
  c.extra.deathPenalty = 3; c.extra.criticalInjuries.entries[0].status = 'resolved';
  assert.equal(w.PlayCombat.syncDeathBaseAll([c], 'en'), 'Base Death Save Penalty: 1 → 0 (Critical Injuries)');
  assert.deepEqual([c.extra.baseDeathPenalty, c.extra.deathPenalty, c.extra.deathInjuryBase], [0, 2, 0]);
  const app = read('app.js');
  assert.equal(app.split("window.PlayCombat?.syncDeathBaseAll?.(state.characters,state.lang)").length - 1, 3, 'after injuries, medicine and applied damage');
  assert.ok(app.includes("if((action==='death-save'||action==='death-save-lifestyle')&&window.PlayCombat?.syncDeathBase?.(c)?.changed)save();"));
});

test('the condition line: wound, death and unconsciousness in both languages', () => {
  const w = withEffects();
  assert.equal(w.PlayCombat.statusLine(solo(), 'ru'), '');
  assert.match(w.PlayCombat.statusLine(solo({}, 20), 'ru'), /data-pc-state="serious".*Тяжело ранен.*−2 ко всем проверкам/);
  assert.match(w.PlayCombat.statusLine(solo({}, 20), 'en'), /Seriously wounded.*−2 to all checks/);
  const mortal = w.PlayCombat.statusLine(solo({ deathPenalty: 2 }, 0), 'ru');
  assert.match(mortal, /При смерти/); assert.match(mortal, /data-proxy-roll='\[data-cx-action="death-save"\]'>Спасбросок от смерти &lt; 6</);
  const dead = w.PlayCombat.statusLine(solo({ deathRecord: { version: 1, dead: true } }, 0), 'en');
  assert.match(dead, /data-pc-state="dead".*The character is dead.*data-pc-go="death-fix"/); assert.doesNotMatch(dead, /Mortally/);
  assert.match(w.PlayCombat.statusLine(solo({ medical: { version: 1, unconscious: true } }, 40), 'ru'), /Без сознания.*data-pc-go="medical"/);
  assert.ok(read('sheet-tabs.js').includes("${global.PlayCombat?.statusLine?.(c,lang())||''}"));
});

// ---------- a hit taken ----------
const withDamage = () => { const w = { confirm: () => { throw new Error('no browser dialogs here'); } }, ctx = { window: w, globalThis: {}, console, Math, JSON, Set, Map, Number, String, Array, Object, Date }; ctx.globalThis.window = w; vm.createContext(ctx); for (const f of ['combat-tools.js', 'equipment-tools.js', 'effects.js', 'damage-apply.js', 'play-combat.js']) vm.runInContext(read(f), ctx); return w; };
const target = (over = {}) => ({ id: 'v', stats: { BODY: 8, WILL: 6 }, hp: 40, head: 10, bodyArmor: 8, extra: {}, ...over });
const blow = (over = {}) => ({ raw: '20', location: 'body', melee: false, ap: false, crit: false, ...over });

test('a hit: the same arithmetic as the full form — armor, armor-piercing, head ×2, melee halves SP, +5 injury', () => {
  const P = withDamage().PlayCombat, q = s => P.hitQuote(target(), blow(s)).q;
  assert.deepEqual([q().damage, q().hpAfter, q().spAfter], [12, 28, 7]);
  assert.deepEqual([q({ ap: true, crit: true }).damage, q({ ap: true, crit: true }).spAfter], [17, 6]);
  assert.deepEqual([q({ location: 'head', raw: '14' }).damage, q({ location: 'head', raw: '14' }).spAfter], [8, 9]);
  assert.deepEqual([q({ melee: true }).damage, q({ melee: true }).type], [16, 'melee']);
  assert.deepEqual([q({ location: 'direct' }).damage, q({ location: 'direct' }).type], [20, 'direct']);
  assert.equal(q({ melee: true, ap: true }).ammo, 'standard', 'armor-piercing is ammunition, not for a melee weapon');
  assert.equal(P.hitQuote(target(), blow({ raw: '' })).reason, 'empty'); assert.equal(P.hitQuote(target(), blow({ raw: '2.5' })).reason, 'empty');
  assert.equal(P.hitQuote(target({ hp: 'x' }), blow()).reason, 'manual');
  assert.equal(P.hitText(q({ ap: true, crit: true }), 'ru'), 'По HP: 17 · HP 40 → 23 · SP 8 → 6 · ранение +5');
  assert.equal(P.hitText(q({ raw: '5' }), 'en'), 'The armor stopped the hit · HP 40 → 40 · SP 8 → 8');
});

test('a hit: applying changes HP and armor without a browser dialog, and undo takes exactly that back', () => {
  const P = withDamage().PlayCombat, c = target({ extra: { medical: { version: 1, stabilized: true, stabilizedHp: 40, note: 'kept' } } }), was = plain(c);
  const r = P.hitApply(c, blow({ ap: true }));
  assert.equal(r.ok, true); assert.equal(r.injury, '');
  assert.deepEqual([c.hp, c.bodyArmor, c.head], [28, 6, 10]); assert.equal(c.extra.medical.stabilized, false); assert.equal(c.extra.medical.note, 'kept');
  assert.equal(P.hitUndo(c, r.undo), true); assert.deepEqual(plain(c), was);
  const again = P.hitApply(c, blow()); c.hp -= 1;
  assert.equal(P.hitUndo(c, again.undo), false, 'the sheet changed after the hit'); assert.equal(c.hp, 27);
  assert.equal(P.hitUndo({ ...c, id: 'other' }, again.undo), false);
});

test('a hit on a mortally wounded character: the Death Save penalty grows and the injury roll is offered', () => {
  const P = withDamage().PlayCombat, c = target({ hp: 0, extra: { baseDeathPenalty: 0, deathPenalty: 1 } });
  const r = P.hitApply(c, blow({ raw: '12' }));
  assert.equal(r.ok, true); assert.equal(r.injury, 'body'); assert.equal(c.extra.deathPenalty, 2); assert.equal(c.hp, -9);
  assert.match(P.hitText(r.q, 'ru'), /штраф Death Save 1 → 2 · при смерти/);
  assert.equal(P.hitApply(target(), blow({ location: 'head', crit: true })).injury, 'head');
});

test('a hit: the form is offered in the HP panel and the full form switches its one-hit options off after applying', () => {
  const P = withDamage().PlayCombat, form = P.hitForm(target(), 'ru');
  for (const piece of ['data-pc-hit="raw"', 'data-value="body" aria-checked="true">Тело · SP 8<', 'Голова · SP 10', 'Мимо брони', 'data-pc-hit="ap"', 'data-pc-hit="crit"', 'data-pc-hit="melee"', 'data-pc-hit="apply"', 'data-hud-jump="sheet-damage"']) assert.ok(form.includes(piece), piece);
  assert.match(P.hitForm(target(), 'en'), /Armor-piercing.*Crit\. Injury \+5.*Apply.*Full calculation/);
  assert.equal(PC.hitForm(target(), 'ru'), null, 'without the damage rules the old row stays');
  const tabs = read('sheet-tabs.js');
  assert.ok(tabs.includes("const hit=global.PlayCombat?.hitForm?.(c,lang())||'';")); assert.ok(tabs.includes("${hit?'':`<div class=\"hud-hp-row\"><label>${ru?'Урон':'Damage'}"));
  assert.ok(read('damage-apply.js').includes("d.pending=null;d.ammo='standard';d.critical=false;c.hp=q.hpAfter;"));
  assert.doesNotMatch(read('play-combat.js'), /\b(confirm|alert|prompt)\(/);
});

// ---------- aimed shot, burst, suppressive fire, unarmed, grenade ----------
function fight(over = {}) {
  const calls = [], listeners = {}, w = { confirm: () => { throw new Error('no browser dialogs here'); } }, ctx = { window: w, globalThis: {}, console, Math, JSON, Set, Map, Number, String, Array, Object, Date, setTimeout: () => 0, clearTimeout: () => {} };
  w.document = { documentElement: { lang: 'ru' }, addEventListener: (type, fn) => (listeners[type] ||= []).push(fn), querySelector: () => null };
  ctx.document = w.document; ctx.globalThis.window = w; vm.createContext(ctx);
  for (const f of ['combat-tools.js', 'weapon-ammo.js', 'play-combat.js']) vm.runInContext(read(f), ctx);
  const c = { id: 'v', stats: { REF: 8, DEX: 7, BODY: 8, WILL: 6, LUCK: 6 }, skills: { Autofire: 4, Brawling: 4, Athletics: 4, 'Martial Arts': 3 }, hp: 45, extra: { luck: 4, luckUse: 1, modifier: -1, weapons: [
    { id: 'ar', catalogId: 'weapon-assault-rifle', name: 'AR', skill: 'Shoulder Arms', modifier: 1, capacity: 25, ammo: 25, usesAmmo: true },
    { id: 'pistol', catalogId: 'weapon-heavy-pistol', name: 'Pistol', skill: 'Handgun', capacity: 8, ammo: 8, usesAmmo: true }],
    items: [{ id: 'g', name: 'Frag', quantity: 2, ammoType: 'grenade' }], ...over } };
  w.CharacterExtra = { init: x => x.extra, rangeType: x => /assault/.test(x.catalogId) ? 'assault' : /smg/.test(x.catalogId) ? 'smg' : /pistol/.test(x.catalogId) ? 'pistol' : '' };
  w.App = { active: () => c, lang: () => 'ru', save: () => calls.push(['save']), render: () => calls.push(['render']), notify: m => calls.push(['notify', m]), report: (...a) => { calls.push(['report', ...a]); return true; },
    // the sheet's layer: STAT + level + wounds + the pending modifier and LUCK
    checkBonus: (ch, stat, level) => ch.stats[stat] + level + ch.extra.modifier + Math.min(ch.extra.luck, ch.extra.luckUse),
    check: (base, label, o) => { calls.push(['check', base, label, plain(o)]); return { total: over.total ?? 20, dv: o.dv, beat: o.dv ? (over.total ?? 20) > o.dv : null }; } };
  // a tap on a button of the card; `range` is what the card's range select holds
  const press = (data, range, box) => { const card = { querySelector: sel => sel === '[data-cx-range]' && range !== undefined ? { value: range } : null }, b = { dataset: data, disabled: false, closest: sel => sel === '.cx-weapon' ? card : sel === '.pc-unarmed' ? box || null : null }, e = { target: { closest: sel => sel === 'button[data-pc-mode]' ? b : null } }; for (const fn of listeners.click) fn(e); };
  return { w, P: w.PlayCombat, c, calls, press };
}

test('burst: the margin over the DV gives the multiplier, capped by the weapon', () => {
  assert.deepEqual(plain(PC.burstResult(20, 17, 4)), { hit: true, mult: 3, max: 4 });
  assert.deepEqual(plain(PC.burstResult(30, 17, 4)), { hit: true, mult: 4, max: 4 });
  assert.deepEqual(plain(PC.burstResult(30, 17, 3)), { hit: true, mult: 3, max: 3 });
  assert.deepEqual(plain(PC.burstResult(17, 17, 4)), { hit: false, mult: 0, max: 4 }, 'a tie misses');
  assert.deepEqual(plain(PC.burstResult(20, 0, 4)), { hit: null, mult: 0, max: 4 }, 'no DV chosen: the target dodges or the range is not set');
  assert.deepEqual(plain(PC.burstDamage([3, 5], 3, 4, 'ru')), { total: 24, detail: '(3 + 5) × 3 = 24' });
  assert.equal(PC.burstDamage([6, 6], 2, 4, 'en').detail, '(6 + 6) × 2 = 24 / Critical Injury: +5 damage directly to the target’s HP');
  assert.equal(PC.burstDamage([1, 4], 0, 3, 'ru').detail, '1 + 4 = 5; по превышению: ×1 = 5 · ×2 = 10 · ×3 = 15');
});

test('unarmed damage follows BODY; a cyberarm gives 2d6 at least', () => {
  assert.deepEqual([4, 5, 6, 7, 10, 11].map(b => PC.unarmedDice(b, false)), [1, 2, 2, 3, 3, 4]);
  assert.equal(PC.unarmedDice(3, true), 2); assert.equal(PC.unarmedDice(12, true), 4);
});

test('a burst is a roll of the character: sheet numbers, weapon modifier, LUCK and modifier used up, 10 rounds spent, the autofire DV', () => {
  const { w, P, c, calls } = fight(), ar = c.extra.weapons[0];
  assert.equal(P.autoDV(ar, 2), 17); assert.equal(P.autoDV(ar, 6), null); assert.equal(P.rangeNote(ar, 0, 'ru'), ' · очередь DV 22'); assert.equal(P.rangeNote(c.extra.weapons[1], 0, 'ru'), '');
  const out = P.sheetCheck(c, { stat: 'REF', level: 4, kind: 'ranged', skillKey: 'Autofire', label: 'Очередь: AR', dv: 17, extra: ar.modifier, solo: { precision: 1, fumble: true } });
  assert.equal(out.total, 20);
  assert.deepEqual(calls[0], ['check', 8, 'Очередь: AR · Precision Attack +1 · LUCK +1', { wounds: false, dv: 17, skill: 4, mod: 2, ignoreFumble: true }], 'REF 8 + Autofire 4, then −1 modifier +1 LUCK +1 weapon +1 Precision');
  assert.deepEqual([c.extra.luck, c.extra.luckUse, c.extra.modifier], [3, 0, 0], 'LUCK and the modifier are used up like on any sheet roll');
  c.extra.modifierHold = true; c.extra.modifier = -2; P.sheetCheck(c, { stat: 'REF', level: 4, label: 'x' }); assert.equal(c.extra.modifier, -2, 'a kept modifier stays');
});

test('tapping «Очередь» and «Подавление»: 10 rounds leave the magazine, the result stays on the card, the damage button knows the multiplier', () => {
  const { P, c, calls, press } = fight({ modifier: 0, luckUse: 0 }), ar = c.extra.weapons[0];
  press({ pcMode: 'burst', pcWeapon: 'ar' }, '2');
  assert.equal(ar.ammo, 15);
  assert.deepEqual(calls[0], ['check', 8, 'Очередь: AR', { wounds: false, dv: 17, skill: 4, mod: 1, ignoreFumble: false }]);
  assert.deepEqual(calls.slice(1).map(x => x[0]), ['save', 'render']);
  const card = P.weaponModes(c, ar, 'ru');
  assert.match(card, /Очередь 20 против DV 17: попадание, урон 2d6 × 3\./); assert.match(card, /data-pc-mode="burst-damage" data-pc-weapon="ar">⬡ Урон очереди 2d6 × 3</);
  calls.length = 0; press({ pcMode: 'burst-damage', pcWeapon: 'ar' });
  const [, label, detail, total, faces, show] = calls[0];
  assert.equal(calls[0][0], 'report'); assert.equal(label, 'Урон очереди: AR'); assert.equal(show, true); assert.equal(faces.length, 2);
  assert.equal(total, (faces[0].v + faces[1].v) * 3); assert.ok(detail.startsWith(`(${faces[0].v} + ${faces[1].v}) × 3 = ${total}`));
  // a range autofire cannot reach: nothing is rolled or spent
  calls.length = 0; press({ pcMode: 'burst', pcWeapon: 'ar' }, '6');
  assert.deepEqual(calls, [['notify', 'На этой дистанции очередью стрелять нельзя: автоматический огонь бьёт до 100 м.']]); assert.equal(ar.ammo, 15);
  calls.length = 0; press({ pcMode: 'suppress', pcWeapon: 'ar' });
  assert.equal(ar.ammo, 5); assert.equal(calls[0][2], 'Подавляющий огонь: AR'); assert.equal(calls[0][3].dv, 0);
  assert.match(P.weaponModes(c, ar, 'ru'), /Подавление 20\. Все в 25 м вне укрытия бросают WILL \+ Концентрация \+ 1d10; у кого меньше 20, /);
  calls.length = 0; press({ pcMode: 'burst', pcWeapon: 'ar' }, '2');
  assert.deepEqual(calls, [['notify', 'Для очереди нужно 10 патронов в магазине.']]); assert.equal(ar.ammo, 5);
  // a missed burst offers no damage roll; an aimed single shot then replaces the note on the card
  const miss = fight({ modifier: 0, luckUse: 0, total: 15 }); miss.press({ pcMode: 'burst', pcWeapon: 'ar' }, '2');
  assert.match(miss.P.weaponModes(miss.c, miss.c.extra.weapons[0], 'en'), /Burst 15 against DV 17: miss\./); assert.doesNotMatch(miss.P.weaponModes(miss.c, miss.c.extra.weapons[0], 'en'), /burst-damage/);
});

test('a thrown grenade leaves the inventory and rolls DEX + Athletics against the range DV', () => {
  const { c, calls, press, w } = fight({ modifier: 0, luckUse: 0 });
  press({ pcMode: 'throw' }, undefined, { querySelector: sel => sel === '[data-pc-grenade]' ? { value: 'g' } : sel === '[data-pc-throw-range]' ? { value: '1' } : null });
  void w;
  assert.equal(c.extra.items[0].quantity, 1);
  assert.deepEqual(calls[0], ['check', 7, 'Бросок гранаты: Frag (осталось 1)', { wounds: false, dv: 15, skill: 4, mod: 0, ignoreFumble: false }]);
});

test('the weapon card: aimed shot is −8 once and names the damage rule; burst and suppression buttons only for automatic weapons', () => {
  const { P, c } = fight(), [ar, pistol] = c.extra.weapons;
  const select = P.aimSelect(c, pistol, 'ru');
  assert.match(select, /data-pc-aim="pistol".*<option value="">нет<\/option><option value="head">в голову · −8<\/option>.*по предмету в руке · −8.*в ногу · −8/);
  assert.equal(P.takeAim(c, pistol, 'ru'), null, 'nothing chosen');
  assert.equal(P.weaponModes(c, pistol, 'ru'), '');
  const modes = P.weaponModes(c, ar, 'ru');
  assert.match(modes, /data-pc-mode="burst" data-pc-weapon="ar"[^>]*>⬡ Очередь −10 <b>\+13<\/b>/, 'REF 8 + Autofire 4 − 1 modifier + 1 LUCK + 1 weapon');
  assert.match(modes, /data-pc-mode="suppress"/);
  ar.ammo = 9; assert.match(P.weaponModes(c, ar, 'en'), /data-pc-mode="burst"[^>]* disabled>⬡ Burst −10/);
  const ce = read('character-extra.js');
  for (const piece of ["${window.PlayCombat?.aimSelect?.(c,w,l)||''}${action('attack',", "aim=window.PlayCombat?.takeAim?.(c,w,language(lang))||null", "+luck+(aim?aim.mod:0),luckSpent:luck", "${window.PlayCombat?.weaponModes?.(c,w,l)||''}", "${window.PlayCombat?.unarmed?.(c,l)||''}", "${window.PlayCombat?.rangeNote?.(w,b.band,l)||''}", "${window.PlayCombat?.loadedLine?.(w,l)||''}"]) assert.ok(ce.includes(piece), piece);
});

test('the unarmed block: Brawling and Martial Arts damage by BODY, a grenade only when one is in the inventory', () => {
  const { P, c } = fight();
  const html = P.unarmed(c, 'ru');
  assert.match(html, /Без оружия.*Урон по BODY 8 <b>3d6<\/b>/);
  assert.match(html, /data-proxy-roll='\[data-action="skill-roll"\]\[data-skill="Brawling"\]'>⬡ Рукопашный бой <b>\+11<\/b>/);
  assert.match(html, /data-pc-mode="brawl-damage">⬡ Урон 3d6</); assert.match(html, /data-pc-mode="martial-damage"[^>]*>⬡ Урон 3d6 · SP ÷ 2</);
  assert.match(html, /data-pc-grenade><option value="g">Frag · 2<\/option>.*0–6 м · DV 16.*13–25 м · DV 15.*data-pc-mode="throw">⬡ Бросить <b>\+11<\/b>/);
  c.extra.items[0].quantity = 0; c.skills['Martial Arts'] = 0;
  const bare = P.unarmed(c, 'en');
  assert.doesNotMatch(bare, /data-pc-grenade|martial-damage/); assert.match(bare, /Unarmed.*Damage by BODY 8 <b>3d6<\/b>.*Brawling/);
});

test('App.check and App.report took what the sheet rolls need', () => {
  const app = read('app.js');
  assert.ok(app.includes("check(base,label,{wounds=true,dv=0,skill=0,mod:more=0,ignoreFumble=false}={})"));
  assert.ok(app.includes("report(label,detail,total,faces,show){")); assert.ok(app.includes("if(show!==true)pendingRoll=null;"));
});

test('Role Ability checks take the wound penalty of the character', () => {
  assert.equal(PC.woundMod(solo({}, 45)), 0); assert.equal(PC.woundMod(solo({}, 20)), -2); assert.equal(PC.woundMod(solo({}, 0)), -4);
  assert.equal(PC.woundMod(solo({ deathRecord: { version: 1, dead: true } }, 0)), 0);
  const w = { PlayCombat: PC, confirm: () => true }, ctx = { window: w, globalThis: {}, console, Math, JSON, Set, Map, Number, String, Array, Object, Date };
  vm.createContext(ctx); vm.runInContext(read('role-tools.js'), ctx);
  const fixer = hp => ({ id: 'f', role: 'fixer', rank: 4, hp, stats: { COOL: 6, BODY: 8, WILL: 6 }, skills: { Trading: 4 }, extra: {} });
  const roll = hp => { const c = fixer(hp), b = { dataset: { rtAction: 'fixer-roll' } }; const r = w.RoleTools.handle({ type: 'click', target: { closest: sel => sel === '[data-rt-action]' ? b : null, hasAttribute: () => false, dataset: {} } }, c, 'en', { isCurrent: () => true }); assert.equal(r.handled, true); const m = String(c.extra.roleTools.fixer.last).match(/1d10 (\d+)(?: ([+−]) (\d+))?[^→]*→ (-?\d+)/); return Number(m[4]) - (Number(m[1]) + (m[2] ? (m[2] === '+' ? 1 : -1) * Number(m[3]) : 0)); };
  assert.equal(roll(45), 14, 'COOL 6 + Trading 4 + Operator 4');
  assert.equal(roll(20), 12, 'Seriously Wounded: −2');
  assert.equal(roll(0), 10, 'Mortally Wounded: −4');
  const source = read('role-tools.js');
  assert.ok(source.includes('mod=clamp(v.modifier??0,-100,100)+woundMod(c);')); assert.ok(source.includes('check(base+level,modifier+km.total,dv)'), 'the Media check takes wound and effects through RoleKit.takeMods');
});
// ---------- next section ----------

test('undo of a hit never puts old equipment or medical data over newer changes', () => {
  const P = withDamage().PlayCombat;
  // The hit does not touch armor (direct damage): equipment changed afterwards must survive the undo.
  const c = target({ extra: { equipment: { version: 1, installs: [] } } });
  const r = P.hitApply(c, blow({ location: 'direct', raw: '5' }));
  assert.equal(r.ok, true); assert.equal(c.hp, 35);
  c.extra.equipment = { version: 1, installs: [{ id: 'eye' }], maxHumanity: 58 };
  assert.equal(P.hitUndo(c, r.undo), true); assert.equal(c.hp, 40);
  assert.equal(c.extra.equipment.installs.length, 1, 'the implant installed after the hit is still installed');
  assert.equal(c.extra.equipment.maxHumanity, 58);
});
