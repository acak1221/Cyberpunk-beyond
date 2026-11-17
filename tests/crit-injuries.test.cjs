/* The one table of Critical Injuries (site/crit-injuries.js) and the places that read it: the combat tools, the effects layer,
   the injury tracker and the medicine tool. The mapping between them is pinned here so the copies cannot drift apart again. */
const {test} = require('node:test'), assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path'), vm = require('node:vm');
const read = f => fs.readFileSync(path.join(__dirname, '..', 'site', f), 'utf8');
const plain = x => JSON.parse(JSON.stringify(x));
function page(files) {
  const window = {}; const ctx = vm.createContext({window, globalThis: {window}, Math, Date, console});
  ctx.globalThis.window = window;
  for (const f of files) vm.runInContext(read(f), ctx, {filename: f});
  return window;
}
const ALL = ['crit-injuries.js', 'combat-tools.js', 'effects.js', 'medical-tools.js', 'critical-injury-tools.js'];
const load = () => { try { return page(ALL); } catch (e) { return page(ALL.filter(f => f !== 'medical-tools.js' && f !== 'critical-injury-tools.js')); } };

test('the table has eleven rows for the body and eleven for the head, one per 2d6 total', () => {
  const C = page(['crit-injuries.js']).CritInjuries;
  for (const loc of ['body', 'head']) {
    assert.equal(C.ROWS[loc].length, 11);
    C.ROWS[loc].forEach((r, i) => {
      assert.equal(r.score, i + 2);
      for (const k of ['en', 'ru', 'quick', 'treatment']) assert.equal(typeof r[k], 'string', `${loc} ${r.score} ${k}`);
      assert.ok(r.en && r.ru && r.effect.en && r.effect.ru);
      assert.deepEqual(C.row(loc, r.score), r);
    });
  }
  assert.equal(C.row('body', 1), null); assert.equal(C.row('body', 13), null); assert.equal(C.row('leg', 5), null); assert.equal(C.row('body', 5.5), null);
});

test('the rows of the table are pinned (names and numbers)', () => {
  const C = page(['crit-injuries.js']).CritInjuries, line = r => `${r.score} ${r.en} d${r.mods.death || 0} m${r.mods.move || 0} a${r.mods.all || 0} r${r.mods.ranged || 0} c${r.mods.melee || 0}`;
  assert.deepEqual(plain(C.ROWS.body.map(line)), [
    '2 Dismembered Arm d1 m0 a0 r0 c0', '3 Dismembered Hand d1 m0 a0 r0 c0', '4 Collapsed Lung d1 m-2 a0 r0 c0', '5 Broken Ribs d0 m0 a0 r0 c0', '6 Broken Arm d0 m0 a0 r0 c0',
    '7 Foreign Object d0 m0 a0 r0 c0', '8 Broken Leg d0 m-4 a0 r0 c0', '9 Torn Muscle d0 m0 a0 r0 c-2', '10 Spinal Injury d1 m0 a0 r0 c0', '11 Crushed Fingers d0 m0 a0 r0 c0', '12 Dismembered Leg d1 m-6 a0 r0 c0']);
  assert.deepEqual(plain(C.ROWS.head.map(line)), [
    '2 Lost Eye d1 m0 a0 r-4 c0', '3 Brain Injury d1 m0 a-2 r0 c0', '4 Damaged Eye d0 m0 a0 r-2 c0', '5 Concussion d0 m0 a-2 r0 c0', '6 Broken Jaw d0 m0 a0 r0 c0', '7 Foreign Object d0 m0 a0 r0 c0',
    '8 Whiplash d1 m0 a0 r0 c0', '9 Cracked Skull d1 m0 a0 r0 c0', '10 Damaged Ear d0 m0 a0 r0 c0', '11 Crushed Windpipe d1 m0 a0 r0 c0', '12 Lost Ear d1 m0 a0 r0 c0']);
});

test('the combat tool shows exactly the table (names, effect text, Quick Fix and Treatment)', () => {
  const w = load(), C = w.CritInjuries;
  assert.deepEqual(plain(w.CombatTools.INJURIES), plain(C.table()));
  for (const loc of ['body', 'head']) for (const r of C.ROWS[loc]) {
    const row = w.CombatTools.injuryFor(loc, r.score);
    assert.equal(row.en, r.en); assert.equal(row.ru, r.ru); assert.equal(row.effect.en, r.effect.en); assert.equal(row.quick, r.quick); assert.equal(row.treatment, r.treatment);
  }
  assert.equal(w.CombatTools.injuryFor('body', 1), null);
});

test('the effects layer uses the numbers of the table: ids are location + score, nothing else', () => {
  const w = load(), C = w.CritInjuries, E = w.Effects;
  assert.deepEqual(plain(E.INJURY), plain(C.effects()));
  for (const loc of ['body', 'head']) for (const r of C.ROWS[loc]) {
    const e = E.INJURY[loc][r.score] || {};
    for (const k of ['all', 'melee', 'ranged', 'move', 'death']) assert.equal(e[k], r.mods[k], `${loc} ${r.score} ${k}`);
    assert.deepEqual(e.note || null, r.note);
    if (r.note) assert.equal(r.note.length, 2);
  }
  // and the sheet names a recorded injury by the same row
  const hero = (loc, score) => ({extra: {criticalInjuries: {version: 1, entries: [{id: 'x', location: loc, score, status: 'active', detail: ''}]}}});
  assert.equal(E.lines(hero('head', 5), 'ru')[0].name, C.row('head', 5).ru);
  assert.equal(E.lines(hero('body', 12), 'en')[0].name, C.row('body', 12).en);
});

test('every number or reminder the table gives agrees with the effect text that players read', () => {
  const C = page(['crit-injuries.js']).CritInjuries;
  for (const loc of ['body', 'head']) for (const r of C.ROWS[loc]) {
    if (r.mods.move) assert.match(r.effect.en, new RegExp(`MOVE [−-]${Math.abs(r.mods.move)}`), `${loc} ${r.score}`);
    if (r.mods.death) assert.match(r.effect.en, /Death Save Penalty \+1/, `${loc} ${r.score}`);
    if (!r.mods.death) assert.doesNotMatch(r.effect.en, /Death Save Penalty \+1/, `${loc} ${r.score}`);
    if (r.mods.melee) assert.match(r.effect.en, /melee/, `${loc} ${r.score}`);
    if (r.mods.ranged) assert.match(r.effect.en, /ranged/, `${loc} ${r.score}`);
    if (r.mods.all) assert.match(r.effect.en, /all Actions/, `${loc} ${r.score}`);
  }
});

test('the medicine tool and the injury tracker name every injury as the table does', () => {
  const w = load(); if (!w.MedicalTools) return;
  const C = w.CritInjuries;
  // Every name in the medicine tool is the name in the table.
  for (const loc of ['body', 'head']) for (const r of C.ROWS[loc]) {
    const m = w.MedicalTools.INJURIES[loc][r.score - 2];
    assert.equal(m[1], r.en, `${loc} ${r.score} (English name)`);
    assert.equal(m[0], r.ru, `${loc} ${r.score} (Russian name)`);
  }
  // The tracker reads the effect text through CombatTools.INJURIES, i.e. from the table.
  const src = read('critical-injury-tools.js');
  assert.match(src, /window\.CombatTools\?\.INJURIES\?\.\[r\.location\]\?\.\[r\.score-2\]\?\.effect/);
});

test('the quick-fix and treatment rules of the medicine tool name the same DVs as the table text', () => {
  const w = load(); if (!w.MedicalTools) return;
  for (const loc of ['body', 'head']) for (const r of w.CritInjuries.ROWS[loc]) {
    const m = w.MedicalTools.INJURIES[loc][r.score - 2], quick = m[2], treat = m[3];
    if (quick === null) assert.equal(r.quick, '—', `${loc} ${r.score}`);
    else assert.match(r.quick, new RegExp(`DV${quick[0]}\\b`), `${loc} ${r.score} quick`);
    const dvs = Array.isArray(treat) ? treat.filter(x => typeof x === 'number') : [];
    for (const dv of dvs) assert.match(r.treatment, new RegExp(`DV${dv}\\b`), `${loc} ${r.score} treatment`);
  }
});

test('index.html loads the table before the tools that read it, and combat-tools stays right before effects', () => {
  const html = read('index.html'), at = f => html.indexOf(`<script src="${f}"></script>`);
  assert.ok(at('crit-injuries.js') > 0 && at('crit-injuries.js') < at('combat-tools.js') && at('combat-tools.js') < at('effects.js'));
});

test('a test that loads a tool on its own loads the table first, and then the tool shows it', () => {
  const dir = path.join(__dirname, '..', 'site'), saved = global.window;
  try {
    global.window = {}; require(path.join(dir, 'crit-injuries.js')); require(path.join(dir, 'combat-tools.js'));
    assert.equal(global.window.CombatTools.INJURIES.body.length, 11); assert.equal(global.window.CombatTools.injuryFor('head', 12).en, 'Lost Ear');
  } finally { global.window = saved; }
});

test('the wording of the table is pinned: a changed name or effect text is a deliberate edit that updates this hash', () => {
  const R = page(['crit-injuries.js']).CritInjuries.ROWS, text = JSON.stringify(['body', 'head'].map(l => R[l].map(r => [r.score, r.en, r.ru, r.effect.en, r.effect.ru])));
  assert.equal(require('node:crypto').createHash('sha256').update(text).digest('hex'), 'c73d9c9fda60facd310ec83baa5f683e08c0a2b2fbfff486d5ddbe1da604308b');
});
