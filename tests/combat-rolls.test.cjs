/* Every die of the combat tools goes through rolls.js (one random source, the critical rule, the history and the room feed). */
const {test} = require('node:test'), assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path'), vm = require('node:vm');
const read = f => fs.readFileSync(path.join(__dirname, '..', 'site', f), 'utf8');
function page(files, extra = {}, math = Math) {
  const window = {...extra}, ctx = vm.createContext({window, globalThis: {window, crypto: {randomUUID: () => 'id-' + Math.floor(Math.random() * 1e9)}}, Math: math, Date, console, JSON, document: {querySelector: () => null}, confirm: () => true});
  for (const f of files) vm.runInContext(read(f), ctx, {filename: f});
  return window;
}

test('rolls.js has one random source: setRng replaces it, null brings Math.random back, a stubbed Math.random is honoured', () => {
  const math = Object.create(Math); let face = 0.55; math.random = () => face;
  const w = page(['rolls.js'], {}, math), R = w.Rolls;
  assert.equal(R.d(10), 6); face = 0.05; assert.equal(R.d(10), 1);
  assert.equal(R.setRng(() => 0.95), true); assert.equal(R.d(10), 10); assert.equal(R.rand(), 0.95);
  assert.equal(R.setRng('nope'), false); assert.equal(R.d(6), 1, 'a bad source leaves no source: the default (the stubbed Math.random, 0.05) is used again');
  assert.equal(R.d(10, () => 0.25), 3, 'an injected die still wins');
  R.setRng(null); face = 0.35; assert.equal(R.d(6), 3);
  R.setRng(() => NaN); assert.equal(R.d(10), null, 'a source that misbehaves gives null, never a wrong face');
  R.setRng(() => 1); assert.equal(R.d(10), null); R.setRng(null);
  const seq = [0.95, 0.35]; R.setRng(() => seq.shift()); assert.deepEqual(JSON.parse(JSON.stringify(R.d10())), {first: 10, extra: 4, value: 14}); R.setRng(null);
});

// the files of the combat lane: a die is never made by Math.random directly; only ids may fall back to it
const FILES = ['combat-tools.js', 'area-tools.js', 'autofire-tools.js', 'grapple-tools.js', 'critical-injury-tools.js', 'play-combat.js', 'tracker-allies.js', 'campaigns.js', 'combat-dock.js', 'damage-apply.js'];
test('no combat file makes a die with Math.random', () => {
  for (const f of FILES) {
    const lines = read(f).split('\n');
    lines.forEach((line, i) => {
      for (const m of line.matchAll(/Math\.random/g)) {
        const around = line.slice(Math.max(0, m.index - 80), m.index + 80);
        const isId = /randomUUID|toString\(36\)/.test(around), isHelper = /window\.Rolls\?window\.Rolls\.rand:Math\.random/.test(around) || /\(global\.Rolls\?\.rand \|\| Math\.random\)/.test(around) || /Rolls\?\.rand\)\s*\|\|\s*Math\.random/.test(around);
        assert.ok(isId || isHelper, `${f}:${i + 1} uses Math.random for something that is not an id: ${around.trim()}`);
      }
    });
  }
});

test('the default random source of every combat calculator is the shared one', () => {
  const math = Object.create(Math); let calls = 0; math.random = () => { calls++; return 0.45; };
  const w = page(['rolls.js', 'crit-injuries.js', 'combat-tools.js', 'area-tools.js', 'autofire-tools.js', 'grapple-tools.js'], {}, math);
  let seen = 0; w.Rolls.setRng(() => { seen++; return 0.45; });
  const check = w.CombatTools.attackCheck({kind: 'ranged', weapon: 'assault', distance: '14', stat: '8', skill: '6', mod: '0', aim: false, defense: 'range', ref: '8', dex: '6', evasion: '6', defmod: '0'});
  assert.equal(check.attackDice.first, 5); assert.ok(seen >= 1); assert.equal(calls, 0, 'Math.random itself is not touched');
  const before = seen; w.CombatTools.rollAttackDamage?.({count: 3, sp: 0, location: 'body', type: 'standard'}); w.GrappleTools.grabCheck({dex: 6, skill: 4, mod: 0}, {dex: 6, skill: 4, mod: 0}); assert.ok(seen > before); assert.equal(calls, 0);
  w.Rolls.setRng(null);
});

test('the tracker buttons that roll (initiative, Death Save, tie-breaks) use the shared die and report nothing odd when rolls.js is missing', () => {
  for (const withRolls of [true, false]) {
    const math = Object.create(Math); let direct = 0; math.random = () => { direct++; return 0.45; };
    const w = page(withRolls ? ['rolls.js', 'campaigns.js'] : ['campaigns.js'], {}, math); let used = 0;
    if (withRolls) w.Rolls.setRng(() => { used++; return 0.45; });
    const camp = {id: 'c', name: 'J', round: 1, turnIndex: 0, roster: [{id: 'a', kind: 'npc', name: 'A', hp: 0, ref: 6, initiative: 0, order: 1}, {id: 'b', kind: 'npc', name: 'B', hp: 5, ref: 6, initiative: 0, order: 2}]};
    const ctx = {lang: 'en', campaigns: [camp], characters: [], isCurrent: () => true, scope: 's', save() {}, render() {}, notify() {}};
    const click = (action, id, dom = {}) => w.Campaigns.handle({type: 'click', target: {closest: s => (s === '.combatant' ? {querySelector: q => dom[q] || null} : {dataset: {campaignAction: action, id}})}}, ctx);
    w.Campaigns.handle({type: 'click', target: {closest: () => ({dataset: {campaignAction: 'open', id: 'c'}})}}, ctx);
    click('roll-one', 'a'); assert.equal(camp.roster[0].initiative, 11);
    click('roll-all'); assert.ok(camp.roster.every(r => r.initiative >= 7));
    camp.roster[0].body = 6; click('death-save', 'a'); assert.ok(camp.roster[0].deathPenalty >= 1 || camp.roster[0].dead === true);
    if (withRolls) { assert.ok(used >= 4); assert.equal(direct, 0, 'with rolls.js loaded Math.random is not called for dice'); w.Rolls.setRng(null); } else assert.ok(direct >= 4);
  }
});

test('the page of the dock reports its dice to the history through rolls.js', () => {
  const reports = [], w = page(['rolls.js', 'crit-injuries.js', 'combat-tools.js', 'campaigns.js', 'combat-dock.js'], {App: {report: (...a) => { reports.push(a); return true; }}});
  w.Rolls.setRng(() => 0.45);
  const c = {id: 'k', name: 'J', round: 1, turnIndex: 0, roster: [{id: 'a', kind: 'npc', name: 'A', hp: 4, ref: 6, initiative: 0, order: 1}]}, notes = [];
  const ctx = {lang: 'en', campaigns: [c], characters: [], save() {}, render() {}, notify: m => notes.push(m), isCurrent: () => true};
  const click = (action, id) => { const b = {dataset: {cdAction: action, id}, closest: s => (s === '[data-cd-action]' ? b : s === '[data-combat-dock]' ? {contains: () => true, querySelector: () => null} : null)}; return w.CombatDock.handle({type: 'click', target: b}, ctx); };
  click('roll-one', 'a'); click('crit-roll', 'a'); assert.equal(reports.length, 2); assert.match(reports[0][0], /Initiative/); assert.match(reports[1][0], /Critical Injury/);
});
