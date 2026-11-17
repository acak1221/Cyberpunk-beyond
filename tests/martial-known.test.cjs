// The character's own martial arts forms and moves: extra.martialArts, requirement check, combat-dock list, handlers.
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const source=n=>fs.readFileSync(__dirname+'/../site/'+n,'utf8');
const plain=x=>JSON.parse(JSON.stringify(x));
function load({app,doc}={}){
 const window={};if(app)window.App=app;
 const ctx={window,document:doc,Math,Number,String,Array,Object,JSON,Set,Map,RegExp,globalThis:{}};if(!doc)delete ctx.document;
 vm.createContext(ctx);vm.runInContext(source('martial-arts.js'),ctx,{filename:'martial-arts.js'});
 return {M:window.MartialArts,window};
}
const {M}=load();
const sheet=(over={})=>({id:'c1',stats:{DEX:6,WILL:7,MOVE:6},skills:{},extra:{},...over});
const spec=(name,level)=>({id:'s'+name,name,stat:'DEX',level,cost:2});

test('every requirement number is the one the text of the move states', () => {
 for (const m of M.moves) {
  assert.match(m.id, /^[a-z-]+$/);
  assert.equal(m.check.skill, 1);
  const en = m.req[0], ru = m.req[1];
  if (m.check.stat) {
   const [stat, need] = m.check.stat;
   assert.ok(en.includes(`${stat} ${need} or higher`), `${m.id}: ${en}`);
   assert.ok(ru.includes(`${stat} ${need} или выше`), `${m.id}: ${ru}`);
  } else assert.ok(!/\b(WILL|MOVE|BODY|DEX|REF)\s+\d/.test(en), m.id);
  // a requirement that is only numbers has no condition left for the table
  const numericOnly = /^(WILL|MOVE) \d+ or higher\.$/.test(en) || /^Any form; at least 1 rank/.test(en);
  assert.equal(m.check.situational, !numericOnly, m.id);
  if (m.dv) { assert.ok(m.effect[0].includes(`DV${m.dv}`), m.id); assert.ok(m.effect[1].includes(`DV${m.dv}`), m.id); }
  else assert.ok(!/DV\d/.test(m.effect[0]), m.id);
 }
 assert.equal(new Set(M.moves.map(m => m.id)).size, M.moves.length);
 assert.equal(M.moves.find(m => m.id === 'recovery').formId, null);
 assert.deepEqual(plain(M.forms.map(f => f.id)), [...new Set(M.moves.filter(m => m.formId).map(m => m.formId))]);
 assert.ok(M.render('en').includes('At least 1 rank in the move’s form is required'));
});

test('the saved record is rebuilt from a whitelist and never trusted', () => {
 assert.equal(M.clean(null), null); assert.equal(M.clean([]), null); assert.equal(M.clean({ v: 2, forms: [] }), null); assert.equal(M.clean({ v: 1 }), null);
 assert.deepEqual(plain(M.clean({ v: 1, forms: [] })), { v: 1, forms: [] });
 const dirty = { v: 1, evil: '<b>', forms: [
  { id: 'judo', moves: ['grab-escape', 'grab-escape', 'iron-grip', 'recovery', 'nope', 7, null], x: 1 },
  { id: 'aikido', moves: 'not a list' }, { id: 'judo', moves: ['counter-throw'] }, { id: 'kung-fu', moves: [] },
  { id: '__proto__', moves: [] }, 'x', null, { moves: [] } ] };
 assert.deepEqual(plain(M.clean(dirty)), { v: 1, forms: [{ id: 'aikido', moves: [] }, { id: 'judo', moves: ['recovery', 'grab-escape'] }] });
 assert.deepEqual(plain(M.read({})), { v: 1, forms: [] });
 assert.equal(M.read({ extra: { martialArts: 'x' } }), null);
 assert.deepEqual(plain(M.read({ extra: { martialArts: { v: 1, forms: [{ id: 'karate', moves: ['bone-breaking-strike'] }] } } })), { v: 1, forms: [{ id: 'karate', moves: ['bone-breaking-strike'] }] });
});

test('forms and moves are switched one at a time, in book order, and put back exactly', () => {
 const c = sheet({ extra: { keep: 1 } });
 let r = M.setForm(c, 'karate', true); assert.equal(r.ok, true); assert.equal(r.before, undefined);
 assert.deepEqual(plain(c.extra.martialArts), { v: 1, forms: [{ id: 'karate', moves: [] }] }); assert.equal(c.extra.keep, 1);
 assert.equal(M.setForm(c, 'karate', true).reason, 'same');
 assert.equal(M.setMove(c, 'karate', 'iron-grip', true).reason, 'move');
 assert.equal(M.setMove(c, 'judo', 'counter-throw', true).reason, 'invalid');
 assert.equal(M.setMove(c, 'karate', 'nope', true).reason, 'move');
 assert.equal(M.setForm(c, 'sumo', true).reason, 'form');
 M.setMove(c, 'karate', 'recovery', true); const two = M.setMove(c, 'karate', 'armor-breaking-combination', true);
 assert.deepEqual(plain(c.extra.martialArts.forms[0].moves), ['recovery', 'armor-breaking-combination']);
 M.setForm(c, 'aikido', true);
 assert.deepEqual(plain(c.extra.martialArts.forms.map(f => f.id)), ['aikido', 'karate']);
 const off = M.setForm(c, 'karate', false); assert.deepEqual(plain(c.extra.martialArts.forms.map(f => f.id)), ['aikido']);
 assert.equal(M.restore(c, off.before).ok, true); assert.deepEqual(plain(c.extra.martialArts), plain(off.before));
 assert.equal(M.restore(c, two.before).ok, true); assert.deepEqual(plain(c.extra.martialArts.forms[0].moves), ['recovery']);
 const fresh = sheet(); const on = M.setForm(fresh, 'judo', true); M.restore(fresh, on.before);
 assert.equal('martialArts' in fresh.extra, false, 'no value at all after undoing the first tick');
 M.setForm(c, 'aikido', true); M.setMove(c, 'aikido', 'iron-grip', true); M.setMove(c, 'aikido', 'iron-grip', false);
 assert.deepEqual(plain(c.extra.martialArts.forms.find(f => f.id === 'aikido').moves), []);
});

test('a record of an unknown shape is never written over; a sheet without extra gets one', () => {
 for (const bad of ['x', 5, [], { v: 2, forms: [] }, { v: 1, forms: 'x' }]) {
  const c = sheet({ extra: { martialArts: bad } }); const keep = JSON.stringify(c);
  assert.equal(M.setForm(c, 'judo', true).reason, 'foreign'); assert.equal(JSON.stringify(c), keep);
 }
 const c = sheet({ extra: 'x' }); assert.equal(M.setForm(c, 'judo', true).reason, 'foreign'); assert.equal(c.extra, 'x');
 const bare = { id: 'b', stats: {}, skills: {} }; assert.equal(M.setForm(bare, 'judo', true).ok, true); assert.equal(bare.extra.martialArts.forms[0].id, 'judo');
 assert.equal(M.setForm(null, 'judo', true).reason, 'stale');
 assert.equal(M.restore(sheet({ extra: { martialArts: 'x' } }), { v: 3 }).reason, 'invalid');
 const old = sheet({ extra: { weapons: [] } }); const copy = JSON.stringify(old); M.known(old); M.render('en'); assert.equal(JSON.stringify(old), copy, 'reading changes nothing');
});

test('the rank of a form comes from its specialization, a plain Martial Arts one or the sheet skill', () => {
 assert.equal(M.formRank(sheet(), 'karate'), 0);
 assert.equal(M.formRank(sheet({ skills: { 'Martial Arts': 2 } }), 'judo'), 2);
 const c = sheet({ extra: { specializations: [spec('Martial Arts (Karate)', 3), spec('Дзюдо', 2), spec('Martial Arts', 1), spec('Karate', '4'), spec('Aikido', 99), { name: 5, level: 4 }, null] } });
 assert.equal(M.formRank(c, 'karate'), 4); assert.equal(M.formRank(c, 'judo'), 2); assert.equal(M.formRank(c, 'taekwondo'), 1); assert.equal(M.formRank(c, 'aikido'), 1);
 assert.equal(M.formRank(sheet({ extra: { specializations: [spec('Тхэквондо', 5)] } }), 'taekwondo'), 5);
});

test('a move is checked against the sheet: numbers decide met / not met, the rest stays with the table', () => {
 const c = sheet({ extra: { specializations: [spec('Karate', 2)] } });
 let e = M.evaluate(c, 'bone-breaking-strike', 'karate');
 assert.equal(e.status, 'unmet'); assert.deepEqual(plain(e.items), [{ kind: 'skill', need: 1, have: 2, ok: true }, { kind: 'stat', stat: 'WILL', need: 8, have: 7, ok: false }]);
 c.stats.WILL = 8; assert.equal(M.evaluate(c, 'bone-breaking-strike', 'karate').status, 'met');
 assert.equal(M.evaluate(c, 'armor-breaking-combination', 'karate').status, 'check');
 assert.equal(M.evaluate(c, 'iron-grip', 'aikido').status, 'unmet', 'no rank in Aikido');
 assert.equal(M.evaluate(c, 'flying-kick', 'taekwondo').status, 'unmet');
 const kick = sheet({ stats: { MOVE: 8 }, skills: { 'Martial Arts': 1 } }); assert.equal(M.evaluate(kick, 'flying-kick', 'taekwondo').status, 'check');
 assert.equal(M.evaluate(kick, 'nope', 'judo'), null);
 // «any form»: the best known form counts
 const rec = sheet({ extra: { martialArts: { v: 1, forms: [{ id: 'judo', moves: [] }, { id: 'karate', moves: [] }] }, specializations: [spec('Karate', 2)] } });
 assert.equal(M.evaluate(rec, 'recovery', 'judo').status, 'met'); assert.equal(M.evaluate(rec, 'recovery').rank, 2);
 assert.equal(M.evaluate(sheet(), 'recovery').status, 'unmet');
 // the stat is read through the dossier when it is there
 const w = load({}).window; w.DossierPanel = { statBase: () => ({ value: 9 }) };
});

test('known() lists the learned moves once each, in book order, for the combat dock', () => {
 const c = sheet({ stats: { DEX: 6, WILL: 8, MOVE: 6 }, extra: { specializations: [spec('Karate', 2), spec('Judo', 1)], martialArts: { v: 1, forms: [
  { id: 'karate', moves: ['bone-breaking-strike', 'recovery'] }, { id: 'judo', moves: ['recovery', 'grab-escape'] }] } } });
 const k = plain(M.known(c));
 assert.deepEqual(k.map(x => x.id), ['recovery', 'bone-breaking-strike', 'grab-escape']);
 assert.deepEqual(k.map(x => x.status), ['met', 'met', 'check']);
 assert.equal(k[0].form, 'Shared'); assert.equal(k[0].dv, 13); assert.equal(k[2].formId, 'judo'); assert.equal(k[1].rank, 2);
 assert.deepEqual(plain(M.known(sheet())), []); assert.deepEqual(plain(M.known(sheet({ extra: { martialArts: 'x' } }))), []); assert.deepEqual(plain(M.known(null)), []);
 const html = { ru: M.renderKnown(c, 'ru'), en: M.renderKnown(c, 'en') };
 assert.match(html.ru, /Восстановление/); assert.match(html.ru, /Условия выполнены/); assert.match(html.en, /Grab Escape/); assert.match(html.en, /Numbers fit; the rest depends on the situation/);
 assert.equal((html.en.match(/data-ma-roll=/g) || []).length, 3); assert.equal(M.renderKnown(sheet(), 'en'), '');
 assert.match(M.renderKnown(sheet({ extra: { martialArts: { v: 1, forms: [{ id: 'taekwondo', moves: ['flying-kick'] }] } } }), 'en'), /Missing: form rank 1\+ \(you have 0\), MOVE 8\+ \(you have 6\)/);
});

test('the «Ваши приёмы» block has a named checkbox per form and move, both languages, nothing unescaped', () => {
 const c = sheet({ id: 'a"<b>', extra: { martialArts: { v: 1, forms: [{ id: 'karate', moves: ['bone-breaking-strike'] }] } } });
 const app = { active: () => c };
 for (const lang of ['ru', 'en']) {
  const { M: m } = load({ app }); const html = m.render(lang);
  assert.ok(html.includes(lang === 'ru' ? 'ВАШИ ПРИЁМЫ' : 'YOUR MOVES')); assert.ok(!html.includes('a"<b>')); assert.ok(html.includes('data-ma-char="a&quot;&lt;b&gt;"'));
  for (const f of ['aikido', 'karate', 'judo', 'taekwondo']) assert.ok(html.includes(`data-ma-form="${f}"`));
  assert.equal((html.match(/data-ma-in="karate"/g) || []).length, 3, 'Recovery, Armor Breaking and Bone Breaking');
  assert.equal((html.match(/data-action="book-page"/g) || []).length, 9, 'the reference below is unchanged');
  assert.equal((html.match(/<label class="ma-check">/g) || []).length, 4 + 3);
 }
 assert.match(load({ app: { active: () => null } }).M.render('en'), /Create a character/);
 assert.match(load({ app: { active: () => sheet({ extra: { martialArts: 'x' } }) } }).M.render('en'), /unknown format/);
});

function env(c) {
 const listeners = {}, log = [], focused = [], boxes = {};
 const doc = { addEventListener: (t, f) => { listeners[t] = f }, querySelector: sel => (boxes[sel] ? { disabled: false, focus: () => focused.push(sel) } : null) };
 const chars = [c], app = { lang: () => 'en', active: () => c, getState: () => ({ characters: chars }), save: () => log.push('save'), render: () => { log.push('render'); for (const k of Object.keys(boxes)) delete boxes[k]; boxes['input[data-ma-form="karate"]'] = 1; boxes['input[data-ma-move="recovery"][data-ma-in="karate"]'] = 1; }, notify: m => log.push('notify:' + m),
  notifyAction: (m, label, fn) => { log.push('action:' + m + '|' + label); app.undo = fn }, checkBonus: () => 9, check: (base, label, o) => { log.push('check:' + base + '|' + label + '|' + JSON.stringify(o)); return { total: 12 } } };
 return { doc, app, log, focused, listeners, chars };
}
const input = (data, checked, root) => ({ dataset: data, checked, matches: s => s.startsWith('input'), closest: () => root });
test('ticking a form saves, redraws, keeps the focus on the same box and offers undo', () => {
 const c = sheet(), e = env(c), { M: m } = load({ app: e.app, doc: e.doc }), root = { dataset: { maChar: 'c1' } };
 e.listeners.change({ target: input({ maForm: 'karate' }, true, root) });
 assert.deepEqual(plain(c.extra.martialArts), { v: 1, forms: [{ id: 'karate', moves: [] }] });
 assert.deepEqual(e.log, ['save', 'render', 'action:Form added: Karate|Undo']); assert.deepEqual(e.focused, ['input[data-ma-form="karate"]']);
 e.log.length = 0; e.listeners.change({ target: input({ maMove: 'recovery', maIn: 'karate' }, true, root) });
 assert.deepEqual(plain(c.extra.martialArts.forms[0].moves), ['recovery']); assert.match(e.log[2], /Move learned: Recovery/);
 e.log.length = 0; e.app.undo(); assert.deepEqual(plain(c.extra.martialArts.forms[0].moves), []); assert.deepEqual(e.log, ['save', 'render']);
 assert.equal(e.focused.at(-1), 'input[data-ma-move="recovery"][data-ma-in="karate"]');
});

test('a tick from another character or a stale page changes nothing and says so', () => {
 const c = sheet(), e = env(c); load({ app: e.app, doc: e.doc });
 e.listeners.change({ target: input({ maForm: 'karate' }, true, { dataset: { maChar: 'other' } }) });
 assert.equal(c.extra.martialArts, undefined); assert.match(e.log[0], /^notify:The sheet changed/); assert.equal(e.log[1], 'render');
 e.log.length = 0; e.listeners.change({ target: input({ maForm: 'sumo' }, true, { dataset: { maChar: 'c1' } }) });
 assert.equal(c.extra.martialArts, undefined); assert.match(e.log[0], /^notify:/);
 e.listeners.change({ target: { matches: () => false } }); e.listeners.click({ target: { closest: () => null } });
});

test('the check button of a known move rolls DEX + rank through the sheet against the DV of the move', () => {
 const c = sheet({ stats: { DEX: 7 }, extra: { specializations: [spec('Judo', 2)], martialArts: { v: 1, forms: [{ id: 'judo', moves: ['grab-escape', 'recovery'] }] } } });
 const e = env(c); load({ app: e.app, doc: e.doc });
 e.listeners.click({ target: { closest: () => ({ dataset: { maRoll: 'grab-escape' } }) } });
 assert.equal(e.log[0], 'check:7|Grab Escape · Judo|{"wounds":false,"dv":15,"skill":2,"mod":0}');
 e.log.length = 0; e.listeners.click({ target: { closest: () => ({ dataset: { maRoll: 'recovery' } }) } });
 assert.match(e.log[0], /^check:7\|Recovery\|.*"dv":13/);
 e.log.length = 0; e.listeners.click({ target: { closest: () => ({ dataset: { maRoll: 'iron-grip' } }) } }); assert.match(e.log[0], /^notify:The sheet changed/);
 const rookie = sheet({ extra: { martialArts: { v: 1, forms: [{ id: 'judo', moves: ['grab-escape'] }] } } }), r = env(rookie); load({ app: r.app, doc: r.doc });
 r.listeners.click({ target: { closest: () => ({ dataset: { maRoll: 'grab-escape' } }) } }); assert.match(r.log[0], /at least 1 rank/); assert.equal(r.log.length, 1);
});

test('on the combat page, where no sheet is open, the block works for the only character or the one picked in the list', () => {
 const a = sheet({ id: 'a', name: 'Vee' }), b = sheet({ id: 'b', name: 'Jo<b>' });
 const one = load({ app: { active: () => null, getState: () => ({ characters: [a] }) } }).M;
 assert.equal(one.subject(), a); assert.ok(!one.render('en').includes('data-ma-pick')); assert.ok(one.render('en').includes('data-ma-char="a"'));
 const list = [a, b], app = { lang: () => 'en', active: () => null, getState: () => ({ characters: list }), render() { app.drawn = (app.drawn || 0) + 1 } };
 let change = null; const doc = { addEventListener: (t, f) => { if (t === 'change') change = f }, querySelector: () => ({ focus() { app.focused = true } }) };
 const { M: m } = load({ app, doc });
 assert.equal(m.subject(), null); let html = m.render('en');
 assert.ok(html.includes('data-ma-pick') && html.includes('Choose a character') && html.includes('Jo&lt;b&gt;') && !html.includes('data-ma-form='));
 change({ target: { matches: s => s.includes('data-ma-pick'), value: 'zzz' } }); assert.equal(m.subject(), null, 'an unknown id is ignored');
 change({ target: { matches: s => s.includes('data-ma-pick'), value: 'b' } }); assert.equal(m.subject(), b); assert.equal(app.drawn, 1); assert.equal(app.focused, true);
 html = m.render('en'); assert.ok(html.includes('<option value="b" selected>') && html.includes('data-ma-char="b"') && html.includes('data-ma-form="judo"'));
 assert.ok(load({ app: { active: () => a, getState: () => ({ characters: list }) } }).M.render('en').indexOf('data-ma-pick') === -1, 'an open sheet needs no list');
});

test('badge classes do not collide with the checkbox label class; unmet moves cannot be rolled', () => {
 const c = sheet({ stats: { DEX: 6, WILL: 6, MOVE: 6 }, extra: { specializations: [spec('Karate', 2)], martialArts: { v: 1, forms: [{ id: 'karate', moves: ['bone-breaking-strike', 'recovery'] }] } } });
 const html = M.renderKnown(c, 'en');
 assert.match(html, /class="ma-badge ma-st-unmet"/); assert.match(html, /class="ma-badge ma-st-met"/); assert.doesNotMatch(html, /ma-badge ma-(met|check|unmet)"/);
 const css = source('martial-arts.css'); assert.match(css, /\.ma-badge\.ma-st-check/); assert.doesNotMatch(css, /\.ma-badge\.ma-check/);
 const btn = id => html.match(new RegExp(`<button[^>]*data-ma-roll="${id}"[^>]*>`))[0];
 assert.match(btn('bone-breaking-strike'), / disabled /); assert.doesNotMatch(btn('recovery'), / disabled /);
 const calls = []; const app = { check: (...a) => calls.push(a), checkBonus: () => 8, lang: () => 'en' };
 const w = load({ app }).M;
 assert.equal(w.rollMove(c, 'bone-breaking-strike', 'en').reason, 'unmet'); assert.equal(calls.length, 0);
 assert.equal(w.rollMove(c, 'recovery', 'en').ok, true); assert.equal(calls.length, 1);
 assert.match(M.render('en') + '', /<span aria-label="YOUR MOVES: 0 \/ 4">0\/4<\/span>|ma-mine/);
});
