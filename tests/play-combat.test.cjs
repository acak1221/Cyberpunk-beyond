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
// ---------- next section ----------
