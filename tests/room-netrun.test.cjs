// «Показать нетраннеру» (site/room-netrun.js): the Game Master shows one run to ONE player of a room. What is not revealed is
// not in the bytes, a third member cannot read the run, garbage is dropped, a page that does not know the message type carries
// on, the player's roll and proposals travel back sealed, and stopping removes the retained copy.
const Idle = require('./helpers/idle.cjs');
const { test } = require('node:test'), assert = require('node:assert/strict'), fs = require('node:fs'), vm = require('node:vm'), path = require('node:path');
const read = f => fs.readFileSync(path.join(__dirname, '..', 'site', f), 'utf8');
const plain = x => JSON.parse(JSON.stringify(x));
const CODE = 'K7RQM2XAPZ9E';
const settle = Idle.settle;
const BRANCH_N = " }else if(m.t==='netrun'&&sub==='n'){\n  // «Показать нетраннеру» (room-netrun.js): sealed to one member's box and addressed to them; the receiving page checks both.\n  if(fromGM&&await global.RoomNetrun?.receive?.(m.d,at,p.retain))repaint();\n }else if(m.t==='netrun-up'&&sub==='e'){\n  if(session.role==='gm'&&fresh&&!p.retain&&m.d.to===session.memberId&&await global.RoomNetrun?.receiveUp?.(m.d,{fp,from:m.from}))repaint();\n";
const SECRETS = ['ТАЙНА-ИМЯ-АРХИТЕКТУРЫ', 'ТАЙНА-ЗАМЕТКИ', 'ТАЙНА-ЗАПИСЬ', 'ТАЙНА-ЭТАЖ', 'ТАЙНА-ВЕТКА', 'ТАЙНА-ГЛУБЬ', 'Dragon', 'Sabertooth'];

function loadTab({ old = false, name = 'tab' } = {}) {
  const listeners = {}, store = new Map(), notices = [], actions = [], sent = [], saves = [], checks = [];
  const document = { addEventListener(t, f) { (listeners[t] ||= []).push(f); }, querySelector: () => null, createElement: () => ({}), visibilityState: 'visible' };
  const session = new Map(), window = { document, sessionStorage: { getItem: k => (session.has(k) ? session.get(k) : null), setItem: (k, v) => session.set(k, String(v)), removeItem: k => session.delete(k) }, localStorage: { getItem: k => store.has(k) ? store.get(k) : null, setItem: (k, v) => store.set(k, String(v)), removeItem: k => store.delete(k) }, crypto: Idle.crypto, location: { hash: '#/sheet', origin: 'https://example.test', pathname: '/' }, addEventListener() {}, confirm: () => true, navigator: {}, btoa, atob };
  const ctx = { window, TextEncoder, TextDecoder, Uint8Array, ArrayBuffer, JSON, Math, Date, Number, String, Array, Object, Map, Set, Promise, Error, setTimeout: (f, ms) => { const h = Idle.timeout(f, ms); if (ms >= 1000) h.unref?.(); return h; }, clearTimeout: Idle.clear, setInterval, clearInterval, console, URL, Blob, Response: globalThis.Response, ReadableStream: globalThis.ReadableStream };
  let room = read('room.js');
  if (old) { assert.equal(room.split(BRANCH_N).length, 2); room = room.replace(BRANCH_N, ''); }
  const st = { lang: 'ru', characters: [], campaigns: [], netArchitectures: [] };
  window.App = {
    getState: () => st, lang: () => st.lang, notify: m => notices.push(m), notifyAction: (m, label, run) => actions.push({ m, label, run }), save: () => saves.push(1), render() {},
    active: () => st.characters.find(c => c.id === st.active) || null,
    check: (base, label, o = {}) => { checks.push({ base, label, o }); const total = 5 + base + (Number(o.mod) || 0); return { total, beat: o.dv ? total > o.dv : null }; },
  };
  vm.runInNewContext(['catalog.js', 'catalog-extra.js', 'role-tools.js', 'role-play.js', 'netrun-tab.js', 'room-transport.js', 'room-auth.js', 'room-gate.js', 'net-tools.js', 'net-editor.js', 'net-link.js'].map(read).join('\n') + '\n' + room + '\n' + read('room-netrun.js'), ctx);
  const R = window.Room._test;
  R.setApp(window.App); R.setTransport({ publish: (sub, bytes, retain) => { sent.push({ sub, bytes, retain }); return 1; }, close() {} });
  return { name, window, R, N: window.RoomNetrun, st, notices, actions, sent, saves, checks, listeners };
}
const bytesHave = (bytes, text) => Buffer.from(bytes).includes(Buffer.from(text, 'utf8'));
// One room: the Game Master, a runner (Аня), a third member (Ева), and optionally a page of the old version.
async function world({ third = true, oldRunner = false } = {}) {
  const gm = loadTab({ name: 'gm' }), ana = loadTab({ name: 'ana', old: oldRunner }), eve = third ? loadTab({ name: 'eve' }) : null, tabs = [gm, ana, eve].filter(Boolean);
  const room = await gm.R.deriveRoom(CODE);
  for (const t of tabs) { t.R.setKey(room.key); t.me = await t.R.ensureIdentity(); await t.R.ensureGMKeys(); t.box = t.R.gmPub(); }
  const id = (t, n) => t.me.fp + '.0000000' + n;
  gm.id = id(gm, 1); ana.id = id(ana, 2); if (eve) eve.id = id(eve, 3);
  gm.R.setSession({ code: CODE, role: 'gm', name: 'Мастер', memberId: gm.id, gmFp: gm.me.fp, gmPin: 'self', toasts: false }, room.topic);
  for (const [t, who] of [[ana, 'Аня'], [eve, 'Ева']]) if (t) t.R.setSession({ code: CODE, role: 'player', name: who, memberId: t.id, gmFp: gm.me.fp, gmPin: 'link', toasts: false, characterId: 'nova' }, room.topic);
  const now = Date.now(), member = (t, role, nm) => ({ fp: t.me.fp, role, name: nm, box: t.box, sentAt: 1, at: now, character: { name: nm }, pk: {} });
  for (const t of tabs) {
    if (t !== gm) t.R.members().set(gm.id, member(gm, 'gm', 'Мастер'));
    if (t === gm) { t.R.members().set(ana.id, member(ana, 'player', 'Аня')); if (eve) t.R.members().set(eve.id, member(eve, 'player', 'Ева')); }
  }
  let n = 0;
  const deliver = async (from, to, { keep = false } = {}) => {
    const batch = from.sent.splice(0);
    for (const m of batch) for (const t of [].concat(to)) await t.R.receive({ topic: room.topic + '/' + m.sub, retain: m.retain, payload: m.bytes });
    await settle(5); void keep; return batch;
  };
  return { gm, ana, eve, tabs, room, deliver, id, bump: () => ++n };
}
const E = (id, cat, name) => ({ id, catalogId: cat, name: { ru: name, en: name }, kind: 'program', slots: 1 });
function runnerSheet() {
  return { id: 'nova', name: 'Nova', role: 'netrunner', rank: 4, hp: 40, stats: {}, skills: {}, extra: { cyberdecks: { version: 1, decks: [{ id: 'd1', name: 'Deck', slots: 7, hardwareOnly: 0, entries: [E('worm', 'extra-program-worm', 'Worm'), E('shield', 'extra-program-shield', 'Shield')] }] } } };
}
const ent = (id, type, name, over = {}) => ({ id, type, name, dv: 0, state: type === 'ice' ? 'waiting' : 'closed', preset: '', rez: 0, maxRez: 0, per: 0, spd: 0, atk: 0, def: 0, notes: '', ...over });
// Floor 1 (entrance) → floor 2 (the runner is here, floor 1 passed) → floor 3 (not reached, a secret) ; floor 2b (a side branch not reached).
function architecture() {
  return {
    id: 'a1', name: 'ТАЙНА-ИМЯ-АРХИТЕКТУРЫ', access: 'ТАЙНА-ДОСТУП', notes: 'ТАЙНА-ЗАМЕТКИ', rank: 6, modifier: 0, dv: 8, remaining: 3, current: '2', runAt: 'f2', seen: ['f1', 'f2'],
    floors: [
      { id: 'f1', label: '1', branch: '', parent: '', entries: [ent('p1', 'password', 'ТАЙНА-ЗАПИСЬ-пароль', { dv: 14, rv: true, rl: 'Дверь', notes: 'ТАЙНА-ЗАМЕТКИ-записи' })] },
      { id: 'f2', label: '2', branch: 'ТАЙНА-ВЕТКА', parent: 'f1', entries: [
        ent('p2', 'password', 'ТАЙНА-ЗАПИСЬ-пароль-2', { dv: 12, rv: true, rl: 'Замок', sd: false }),
        ent('fl1', 'file', 'ТАЙНА-ЗАПИСЬ-файл', { dv: 11, rv: true, sd: true }),
        ent('i1', 'ice', 'Dragon', { preset: 'Dragon', rez: 30, maxRez: 30, per: 6, spd: 4, atk: 6, def: 6 }),
        ent('c1', 'control', 'ТАЙНА-ЗАПИСЬ-узел', { dv: 9, rv: true, state: 'open' })] },
      { id: 'f3', label: 'ТАЙНА-ЭТАЖ', branch: '', parent: 'f2', entries: [ent('deep', 'file', 'ТАЙНА-ГЛУБЬ', { dv: 15, rv: true, rl: 'Сейф' }), ent('i2', 'ice', 'Sabertooth', { preset: 'Sabertooth', rez: 25, maxRez: 25 })] },
    ],
  };
}

test('what is not revealed is not in the view: floors, names, notes, DVs, ICE, the tree beyond', () => {
  const { N } = loadTab(), view = N.build(architecture(), null), json = JSON.stringify(view);
  assert.deepEqual(plain(view.floors.map(f => f.i)), ['f1', 'f2'], 'the floors passed and the one the runner is on; floor 3 is not');
  assert.equal(view.cur, 'f2'); assert.equal(view.title, undefined, 'the name of the architecture is never sent');
  for (const s of SECRETS) assert.equal(json.includes(s), false, s);
  assert.equal(json.includes('"dv":14'), false, 'a DV that was not ticked stays home'); assert.equal(json.includes('"dv":12'), false);
  assert.match(json, /"dv":11/, 'the one ticked «show the DV»');
  const f2 = view.floors[1];
  assert.deepEqual(plain(f2.e[2]), { i: 'i1', u: 1 }, 'an ICE that was not revealed is «unknown»: no kind, no state, no stats');
  assert.deepEqual(plain(f2.e[0]), { i: 'p2', k: 'password', s: 'c', l: 'Замок' });
  assert.deepEqual(plain(f2.e[1]), { i: 'fl1', k: 'file', s: 'c', dv: 11 }, 'revealed without a label: the name of the record is never used as one');
  assert.equal(f2.e[3].s, 'o'); assert.equal(f2.p, 'f1'); assert.equal(f2.d, 2);
  assert.equal(view.floors.some(f => f.i === 'f3'), false);
});

test('revealing: one floor turned on, one turned off, the public title, the state codes and the limits', () => {
  const { N } = loadTab(), a = architecture();
  a.floors[2].rv = true; a.pub = '  Склад «Ночь»\n';
  let v = N.build(a, null); assert.deepEqual(plain(v.floors.map(f => f.i)), ['f1', 'f2', 'f3']); assert.equal(v.title, 'Склад «Ночь»');
  assert.equal(JSON.stringify(v).includes('ТАЙНА-ЭТАЖ'), false, 'the label of a floor is never sent, only its depth');
  assert.deepEqual(plain(v.floors[2].e.map(e => !!e.u)), [false, true], 'the entry marked revealed shows, the ICE does not');
  a.floors[0].rv = false; v = N.build(a, null); assert.deepEqual(plain(v.floors.map(f => f.i)), ['f2', 'f3']); assert.equal(v.floors[0].p, '', 'the parent is not revealed: no pointer to it');
  a.floors[1].rv = false; v = N.build(a, null); assert.equal(v.cur, 'f2', 'the floor the runner is on is still named (the path needs it)'); assert.deepEqual(plain(v.floors.find(f => f.i === 'f2').e), [], 'but a floor turned off carries no records');
  delete a.floors[1].rv;
  a.floors[1].entries[3].state = 'destroyed'; assert.equal(N.build(a, null).floors.find(f => f.i === 'f2').e[3].s, 'd');
  // No runAt: the entrance. An architecture without floors: nothing to show.
  const b = architecture(); delete b.runAt; delete b.seen; assert.deepEqual(plain(N.build(b, null).floors.map(f => f.i)), ['f1']);
  assert.equal(N.build({ ...b, floors: [] }, null), null); assert.equal(N.build(null, null), null);
  // A big architecture fits the cap; the floor of the runner always stays.
  const big = { id: 'big', name: 'x', runAt: 'g0', seen: [], floors: Array.from({ length: 100 }, (_, i) => ({ id: 'g' + i, label: String(i), branch: '', parent: i ? 'g' + (i - 1) : '', rv: true, entries: Array.from({ length: 50 }, (_, j) => ent('e' + i + '_' + j, 'password', 'n', { rv: true, rl: 'Подпись-' + 'я'.repeat(50) })) })) };
  v = N.build(big, null); assert.ok(v.floors.length <= N.MAX_FLOORS); assert.ok(v.floors.every(f => f.e.length <= N.MAX_ENTRIES));
  assert.ok(Buffer.byteLength(JSON.stringify(v)) <= N.MAX_BYTES); assert.ok(v.floors.some(f => f.i === 'g0'));
});

test('ids that are not plain tokens get names made from their place, the same on both ends', () => {
  const { N } = loadTab(), a = architecture(); a.floors[0].id = 'этаж один!'; a.floors[1].parent = 'этаж один!'; a.floors[0].entries[0].id = 'запись!'; a.seen = ['этаж один!', 'f2'];
  const v = N.build(a, null); assert.equal(v.floors[0].i, 'f0'); assert.equal(v.floors[0].e[0].i, 'e0'); assert.equal(v.floors[1].p, 'f0');
  assert.match(JSON.stringify(v), /^[\x00-\x7f]*?"Дверь"|Дверь/); assert.equal(N._test.wid('x y', 'f', 4), 'f4');
});

// The envelope the Game Master puts on the wire, opened with the runner's own box.
async function share(w, { archive = architecture() } = {}) {
  w.gm.st.netArchitectures.push(archive);
  const r = w.gm.N.start('a1', w.ana.me.fp); assert.equal(r.ok, true); await r.done; await settle(10);
  return w.gm.sent.filter(m => m.sub === 'n');
}

test('the view is sealed to the runner: the bytes carry none of the secrets, only the runner reads them, a third member and old pages do not', async () => {
  const w = await world({ oldRunner: false }), sent = await share(w);
  assert.equal(sent.length, 1); assert.equal(sent[0].retain, true, 'retained: a reloaded page gets it back');
  for (const s of SECRETS.concat(['Дверь', 'Замок', 'password'])) assert.equal(bytesHave(sent[0].bytes, s), false, 'not in the bytes: ' + s);
  // Even with the room key (everyone has it) the body holds only an address and a sealed box.
  const outer = (await w.eve.R.gate.openAny(sent[0].bytes)).outer, msg = JSON.parse(outer.b);
  assert.equal(msg.t, 'netrun'); assert.equal(msg.d.to, w.ana.id); assert.deepEqual(Object.keys(msg.d).sort(), ['ct', 'epk', 'iv', 'to']);
  for (const s of ['Дверь', 'Замок', 'floors', 'password', 'ТАЙНА']) assert.equal(JSON.stringify(msg).includes(s), false, 'the readable layer: ' + s);
  await assert.rejects(() => w.eve.R.openFromPeer(msg.d), 'a third member cannot open the box');
  await assert.rejects(() => w.gm.R.openFromPeer(msg.d), 'not even the Game Master’s own page: sealed to the runner');
  const inner = await w.ana.R.openFromPeer(msg.d); assert.equal(inner.to, w.ana.id); assert.equal(inner.gm, w.gm.me.fp); assert.equal(inner.floors.length, 2);
  // The runner’s page shows it; the third member's shows nothing.
  await w.deliver(w.gm, [w.ana, w.eve]);
  assert.ok(w.ana.N._test.shown(), 'the runner sees the run'); assert.equal(w.eve.N._test.shown(), null);
  w.ana.st.characters.push(runnerSheet()); w.ana.st.active = 'nova'; w.eve.st.characters.push(runnerSheet()); w.eve.st.active = 'nova';
  const panel = w.ana.N.panel(w.ana.st.characters[0], 'ru');
  assert.match(panel, /Дверь|Замок/); assert.match(panel, /data-rn-target="p2"/); assert.match(panel, /неизвестно/); assert.match(panel, /Этаж 2/);
  for (const s of SECRETS) assert.equal(panel.includes(s), false, s);
  assert.equal(w.eve.N.panel(w.eve.st.characters[0], 'ru'), '', 'nothing for a third member');
  assert.equal(w.gm.N.panel(runnerSheet(), 'ru'), '', 'the Game Master has no player panel');
});

test('the Game Master’s desk: the card names what is sent, shows it whole, and has no other participant than the players', async () => {
  const w = await world(), a = architecture(); w.gm.st.netArchitectures.push(a);
  const html = w.gm.N.gmHtml(a, 'ru');
  assert.match(html, /<option value="[0-9a-f]{24}">Аня/); assert.match(html, /<option value="[0-9a-f]{24}">Ева/); assert.doesNotMatch(html, /Мастер<\/option>/);
  assert.match(html, /этажей 2, записей 5 \(из них неизвестных 1\), DV показывается у 1/);
  const pre = html.match(/<pre>([\s\S]*?)<\/pre>/)[1]; for (const s of SECRETS) assert.equal(pre.includes(s), false, s);
  assert.match(w.ana.N.gmHtml(a, 'ru'), /только ведущий комнаты/, 'a player cannot show a run');
  assert.match(loadTab().N.gmHtml(a, 'ru'), /Комната не открыта/);
});

test('garbage and oversized messages are dropped; a view for another member or from a wrong sender shows nothing', async () => {
  const w = await world(), N = w.ana.N, now = Date.now();
  for (const d of [null, undefined, 7, 'x', [], {}, { to: 'x' }, { to: w.ana.id }, { to: w.ana.id, epk: 1, iv: 2, ct: 3 }, { to: w.ana.id, epk: { x: 'a', y: 'b' }, iv: 'zz', ct: 'zz' }, { clear: 'yes' }, { to: w.ana.id, epk: {}, iv: 'x'.repeat(1e5), ct: 'y'.repeat(1e6) }])
    assert.equal(await N.receive(d, now), false, JSON.stringify(d)?.slice(0, 40));
  assert.equal(N._test.shown(), null);
  // The message is signed by the Game Master and sealed to the runner, but its content is not what a view looks like.
  const gmLink = w.gm.window.Room.netrunLink;
  for (const inner of [{ v: 2, id: 'a'.repeat(16), gm: w.gm.me.fp, to: w.ana.id, cur: 'f', floors: [] }, 'text', [], { v: 1, id: 'nothex', gm: w.gm.me.fp, to: w.ana.id, floors: [{ i: 'f', d: 1, e: [] }], cur: 'f' }, { v: 1, id: 'a'.repeat(16), gm: w.gm.me.fp, to: w.ana.id, floors: [{ i: 'f', d: 1, e: [] }], cur: 'nope' }, { v: 1, id: 'a'.repeat(16), gm: 'f'.repeat(24), to: w.ana.id, floors: [{ i: 'f', d: 1, e: [] }], cur: 'f' }, { v: 1, id: 'a'.repeat(16), gm: w.gm.me.fp, to: w.eve.id, floors: [{ i: 'f', d: 1, e: [] }], cur: 'f' }]) {
    const sealed = await gmLink.seal(w.ana.box, inner);
    assert.equal(await N.receive({ to: w.ana.id, ...sealed }, Date.now()), false, JSON.stringify(inner).slice(0, 50));
  }
  assert.equal(N._test.shown(), null);
  // A copy kept by a relay for more than a quarter of an hour, and one older than what is shown, are dropped.
  const good = await share(w); await w.deliver(w.gm, [w.ana]); assert.ok(N._test.shown());
  const msg = JSON.parse((await w.ana.R.gate.openAny(good[0].bytes)).outer.b);
  assert.equal(await N.receive(msg.d, now - 1000), false, 'older than what is shown'); assert.ok(N._test.shown());
  const fresh = loadTab(); assert.equal(await fresh.N.receive(msg.d, now - N.TTL - 1000, true), false);
});

test('clean() rebuilds everything: tokens, kinds, numbers, limits, links between floors, proposals', () => {
  const { N } = loadTab(), fp = 'a'.repeat(24), to = fp + '.00000001', head = { v: 1, id: '0123456789abcdef', gm: fp, to };
  assert.equal(N.clean(null, { to, from: fp }), null);
  const hostile = {
    ...head, title: '  <img src=x onerror=alert(1)>\n\u0007  '.padEnd(300, 'я'), cur: 'f2', __proto__: { evil: 1 },
    floors: [
      { i: 'f1', d: 1, p: 'f1', e: [{ i: 'a', k: 'password', s: 'c', l: '<b>Дверь</b>\u0000', dv: 5, extra: 'x' }, { i: 'a', k: 'file', s: 'c' }, { i: 'b', k: 'laser', s: 'c' }, { i: 'c', k: 'ice', s: 'x' }, { i: 'd', u: 1, k: 'ice', s: 'c', l: 'secret', dv: 3 }, null, 7, { i: 'bad id', k: 'file', s: 'c' }, { i: 'e', k: 'ice', s: 'c', dv: 4 }, { i: 'g', k: 'file', s: 'o', dv: 1.5 }, { i: 'h', k: 'file', s: 'o', dv: 1000 }] },
      { i: 'f2', d: 2, p: 'nope', e: Array.from({ length: 80 }, (_, i) => ({ i: 'z' + i, u: 1 })) },
      { i: 'f1', d: 3, e: [] }, { i: 'f9', d: 0, e: [] }, { i: 'f8', d: 100, e: [] }, { i: 'x'.repeat(65), d: 1, e: [] }, 'floor', null,
      ...Array.from({ length: 80 }, (_, i) => ({ i: 'q' + i, d: 1, p: 'f2', e: [] })),
    ],
    res: [{ e: 'a', ok: true }, { e: 'unknown', ok: true }, { e: 'a', ok: 'yes' }, ...Array.from({ length: 30 }, () => ({ e: 'z1', ok: false }))],
    prop: [{ i: '0123456789abcdef', k: 'net', n: 5 }, { i: '0123456789abcdef', k: 'net' }, { i: 'fedcba9876543210', k: 'rez', n: 3, c: 'extra-program-worm', t: 5 }, { i: '1111111111111111', k: 'rez', n: 3, c: 'extra-ice-dragon' }, { i: '2222222222222222', k: 'rez', n: 0, c: 'extra-program-worm' }, { i: '3333333333333333', k: 'rez', n: 3, c: 'extra-program-nonexistent' }, { i: '4444444444444444', k: 'rez', n: 100, c: 'extra-program-worm' }, { i: '5555555555555555', k: 'boom', n: 1 }],
  };
  const v = N.clean(hostile, { to, from: fp });
  assert.ok(v); assert.equal(v.id, head.id); assert.ok(v.title.length <= 80); assert.doesNotMatch(v.title, /[\u0000-\u001f]/);
  assert.equal(v.floors.length, 34, 'only the first 40 floors are looked at; the duplicate id, bad depth and bad tokens among them are gone');
  assert.equal(v.floors[0].p, '', 'a floor is not its own parent'); assert.equal(v.floors[1].p, '', 'a parent that does not exist');
  assert.deepEqual(plain(v.floors[0].e), [{ i: 'a', k: 'password', s: 'c', l: '<b>Дверь</b>', dv: 5 }, { i: 'd', u: true }, { i: 'e', k: 'ice', s: 'c' }, { i: 'g', k: 'file', s: 'o' }, { i: 'h', k: 'file', s: 'o' }], 'unknown records carry nothing; an ICE carries no DV; a DV that is not a whole number in range is dropped');
  assert.equal(v.floors[1].e.length, 20);
  assert.deepEqual(plain(v.res.slice(0, 1)), [{ e: 'a', ok: true }]); assert.ok(v.res.length <= 8);
  assert.deepEqual(plain(v.prop), [{ i: '0123456789abcdef', k: 'net', n: 1, t: 0 }, { i: 'fedcba9876543210', k: 'rez', n: 3, c: 'extra-program-worm', t: 5 }], 'one «net» (the amount is not the sender’s to choose), a rez only for a known program with 1..99');
  assert.equal(({}).evil, undefined);
  // Addressing and sender.
  for (const bad of [{ ...head, to: 'other' }, { ...head, gm: 'b'.repeat(24) }, { ...head, v: 2 }, { ...head, id: 'x' }, { ...head, cur: 'zz' }]) assert.equal(N.clean({ ...hostile, ...bad }, { to, from: fp }), null);
  assert.equal(N.clean({ ...head, cur: 'f', floors: [{ i: 'f', d: 1, e: [] }] }, { to, from: fp }).floors.length, 1);
});

test('a page that does not know the message type carries on as before', async () => {
  const w = await world({ oldRunner: true }); await share(w); const before = w.ana.R.state(), noticesBefore = w.ana.notices.length;
  await w.deliver(w.gm, [w.ana, w.eve]);
  assert.equal(w.ana.notices.length, noticesBefore); assert.equal(JSON.stringify(w.ana.R.state().combat), JSON.stringify(before.combat)); assert.equal(w.ana.R.members().size, 1);
  assert.equal(w.ana.N._test.shown(), null, 'the old page has the module but never gets the message: nothing is shown');
  // The other members' ordinary traffic still works on that page.
});

test('the waiting-room layer seals the view: a page that has only the room code cannot even read the envelope', async () => {
  const w = await world({ third: false });
  assert.equal(await w.gm.R.gate.setGate(true), true); w.gm.sent.length = 0;
  const sent = await share(w, {}); assert.equal(sent.length, 1);
  assert.equal((await w.gm.R.gate.openAny(sent[0].bytes)).deep, true, 'sealed with the second key of the room');
  const outsider = loadTab(); outsider.R.setKey((await outsider.R.deriveRoom(CODE)).key);
  await assert.rejects(() => outsider.R.gate.openAny(sent[0].bytes), 'the code alone opens nothing');
  assert.equal(w.gm.R.gate.layerKey('netrun') === w.gm.R.gate.roomKey(), true); assert.equal(w.gm.R.gate.layerKey('netrun-up') === w.gm.R.gate.roomKey(), true);
});

test('stopping removes the retained copy; a replaced runner, a removed runner and a Game Master who leaves stop seeing it', async () => {
  const w = await world(); await share(w); await w.deliver(w.gm, [w.ana, w.eve]); assert.ok(w.ana.N._test.shown());
  await w.gm.N.stop(); await settle(5);
  const stop = w.gm.sent.filter(m => m.sub === 'n'); assert.equal(stop.length, 1); assert.equal(stop[0].retain, true);
  assert.equal(JSON.parse((await w.ana.R.gate.openAny(stop[0].bytes)).outer.b).d.clear, true, 'an empty marker replaces the retained view');
  await w.deliver(w.gm, [w.ana, w.eve]); assert.equal(w.ana.N._test.shown(), null);
  assert.equal(w.gm.N.sharing(), false);
  // Replaced: the same architecture to another player; the old runner's page drops it, the new one shows it.
  w.gm.sent.length = 0; assert.equal(w.gm.N.start('a1', w.ana.me.fp).ok, true); await settle(15); await w.deliver(w.gm, [w.ana, w.eve]); assert.ok(w.ana.N._test.shown());
  assert.equal(w.gm.N.start('a1', w.eve.me.fp).ok, true); await settle(15); await w.deliver(w.gm, [w.ana, w.eve]);
  assert.equal(w.ana.N._test.shown(), null, 'the replaced runner stops seeing it'); assert.ok(w.eve.N._test.shown());
  // Removed from the room: the Game Master replaces the copy at once; it is not sent to anyone else.
  w.gm.R.members().delete(w.eve.id); await w.gm.N.publish(true); await settle(5);
  const gone = w.gm.sent.filter(m => m.sub === 'n').pop(); assert.equal(JSON.parse((await w.eve.R.gate.openAny(gone.bytes)).outer.b).d.clear, true);
  w.gm.sent.length = 0; await w.gm.N.publish(true); await settle(5); assert.equal(w.gm.sent.length, 0, 'nothing more is sent while the runner is away');
  // Back (a new key): it is sent again.
  w.gm.R.members().set(w.eve.id, { fp: w.eve.me.fp, role: 'player', name: 'Ева', box: w.eve.box, sentAt: 2, at: Date.now(), pk: {} }); await w.gm.N.publish(false); await settle(10);
  assert.equal(w.gm.sent.filter(m => m.sub === 'n').length, 1);
  // The architecture is deleted: the copy is taken away.
  w.gm.sent.length = 0; w.gm.st.netArchitectures.length = 0; await w.gm.N.publish(true); await settle(5); assert.equal(w.gm.N.sharing(), false); assert.equal(w.gm.sent.filter(m => m.sub === 'n').length, 1);
  // A view that is not renewed is dropped by the player's own page.
  const w2 = await world({ third: false }); await share(w2); await w2.deliver(w2.gm, [w2.ana]); const shown = w2.ana.N._test.shown(); shown.seen = Date.now() - w2.ana.N.TTL - 5;
  w2.ana.st.characters.push(runnerSheet()); assert.equal(w2.ana.N.panel(w2.ana.st.characters[0], 'ru'), '');
});

test('only the Game Master starts a share, only for a player who is in the room, only when there is something to show', async () => {
  const w = await world({ third: false }); w.gm.st.netArchitectures.push(architecture()); w.ana.st.netArchitectures.push(architecture());
  assert.equal(w.ana.N.start('a1', w.gm.me.fp).ok, false); assert.equal(w.gm.N.start('nope', w.ana.me.fp).reason, 'arch'); assert.equal(w.gm.N.start('a1', 'f'.repeat(24)).reason, 'peer');
  assert.equal(w.gm.N.start('a1', w.gm.me.fp).reason, 'peer', 'the Game Master cannot pick themselves');
  w.gm.st.netArchitectures[0].floors = []; assert.equal(w.gm.N.start('a1', w.ana.me.fp).reason, 'empty');
});

test('the runner’s roll: no DV, the label names the target, the result goes to the Game Master sealed, and only that runner is believed', async () => {
  const w = await world(), sheet = runnerSheet(); w.ana.st.characters.push(sheet); w.ana.st.active = 'nova';
  w.ana.R.members().set(w.gm.id, { fp: w.gm.me.fp, role: 'gm', name: 'Мастер', box: w.gm.box, sentAt: 1, at: Date.now(), pk: {} });
  w.eve.R.members().set(w.gm.id, { fp: w.gm.me.fp, role: 'gm', name: 'Мастер', box: w.gm.box, sentAt: 1, at: Date.now(), pk: {} });
  await share(w); await w.deliver(w.gm, [w.ana, w.eve]);
  assert.equal(w.ana.N.rollTarget('Backdoor'), false, 'no target chosen: nothing is rolled'); assert.equal(w.ana.checks.length, 0);
  w.ana.N._test.select('p2');
  const r = w.ana.N.rollTarget('Backdoor'); assert.ok(r && r.ok); await settle(15);
  assert.equal(w.ana.checks.length, 1); assert.equal(w.ana.checks[0].o.dv, 0, 'no DV leaves the Game Master’s device and none is used here');
  assert.match(w.ana.checks[0].label, /^Backdoor \(Interface 4\) → цель \d+ на этаже 2$/, 'the roll goes to the open feed: the target is named by its place');
  assert.equal(/Замок/.test(w.ana.checks[0].label), false, 'the label typed for the runner stays out of the open feed'); assert.equal(sheet.extra.roleTools.netrunner.values.used, 1);
  w.ana.N._test.select('i1'); w.ana.N.rollTarget('Scanner'); assert.match(w.ana.checks[1].label, /→ цель 3 на этаже 2$/, 'an unknown target is named by its place');
  assert.equal(w.ana.N.rollTarget('Nonsense'), false);
  await settle(15);
  const up = w.ana.sent.filter(m => m.sub === 'e'); assert.ok(up.length >= 2);
  for (const m of up) { assert.equal(bytesHave(m.bytes, 'Backdoor'), false); assert.equal(bytesHave(m.bytes, 'ТАЙНА-ЗАПИСЬ'), false); assert.equal(bytesHave(m.bytes, 'Замок'), false); }
  // Only the chosen runner's roll is accepted.
  const note = w.gm.notices.length; await w.deliver(w.ana, [w.gm]);
  const inbox = w.gm.N._test.inbox(); assert.equal(inbox.length, 2); assert.equal(inbox[0].ab, 'Backdoor'); assert.equal(inbox[0].entry, 'p2'); assert.equal(inbox[0].who, 'Аня'); assert.ok(w.gm.notices.length > note);
  // The inbox is kept for the session: what arrived is in sessionStorage, with the room, and nothing but known fields.
  const kept = JSON.parse(w.gm.window.sessionStorage.getItem('nc-netrun-inbox')); assert.equal(kept.items.length, 2); assert.deepEqual(kept.items.map(r => r.id), plain(inbox.map(r => r.id))); assert.ok(kept.room.length > 0);
  // Replayed: the same bytes again add nothing.
  await w.deliver({ sent: up.slice(0, 1).map(m => ({ ...m })), R: w.ana.R }, [w.gm]); assert.equal(w.gm.N._test.inbox().length, 2);
  // Eve forges a roll: she is not the chosen runner.
  w.eve.R.setSession({ ...w.eve.R.session(), gmFp: w.gm.me.fp }, (await w.gm.R.deriveRoom(CODE)).topic);
  assert.equal(await w.eve.N.receive({ clear: true }, Date.now()), false);
  const forged = await w.eve.window.Room.netrunLink.up({ k: 'roll', run: w.gm.N._test.share().id, f: 'f2', e: 'p2', ab: 'Backdoor', total: 99, rid: '0123456789abcdef' }); assert.ok(forged);
  await w.deliver(w.eve, [w.gm]); assert.equal(w.gm.N._test.inbox().length, 2);
  // A roll on a floor that was not shown, or a record that does not exist, is dropped.
  for (const bad of [{ f: 'f3', e: 'deep' }, { f: 'f2', e: 'nothing' }]) {
    await w.ana.window.Room.netrunLink.up({ k: 'roll', run: w.gm.N._test.share().id, ab: 'Backdoor', total: 7, rid: Math.random().toString(16).slice(2, 18).padEnd(16, '0'), ...bad }); await w.deliver(w.ana, [w.gm]);
  }
  assert.equal(w.gm.N._test.inbox().length, 2);
  // The Game Master presses «it worked»: the lock opens, the answer travels in the next view.
  const a = w.gm.st.netArchitectures[0], f2 = a.floors[1], e = f2.entries[0], first = inbox[0];
  assert.deepEqual(plain(w.gm.N.verdict(true, a, f2, e, first.id)), { dirty: true, rerender: true }); assert.equal(e.state, 'open');
  assert.equal(w.gm.N.verdict(true, a, f2, e, first.id), null, 'once');
  await settle(300); await w.deliver(w.gm, [w.ana]);
  w.ana.N._test.select('p2'); const view = w.ana.N._test.shown().view; assert.deepEqual(plain(view.res), [{ e: 'p2', rid: view.res[0].rid, ok: true }]); assert.match(view.res[0].rid, /^[0-9a-f]{16}$/, 'the answer names the roll it answers'); assert.equal(view.floors[1].e[0].s, 'o');
  assert.match(w.ana.N.panel(sheet, 'ru'), /Ведущий: получилось|Backdoor/);
  // A failure does not open anything.
  const e2 = f2.entries[1]; w.gm.N._test.inbox().push({ id: 'z1', arch: 'a1', floor: 'f2', entry: 'fl1', ab: 'Eye-Dee', total: 3, pos: 2, depth: 2, who: 'Аня', at: 1 });
  w.gm.N.verdict(false, a, f2, e2, 'z1'); assert.equal(e2.state, 'closed');
});

test('proposals: program damage and the NET Action marker reach only the runner, change nothing until accepted, and are applied on the runner’s own sheet', async () => {
  const w = await world({ third: false }), sheet = runnerSheet(); w.ana.st.characters.push(sheet); w.ana.st.active = 'nova';
  w.ana.R.members().set(w.gm.id, { fp: w.gm.me.fp, role: 'gm', name: 'Мастер', box: w.gm.box, sentAt: 1, at: Date.now(), pk: {} });
  await share(w); await w.deliver(w.gm, [w.ana]);
  const before = JSON.stringify(sheet);
  assert.equal(w.gm.N.propose('rez', { c: 'extra-program-worm', n: 3 }).ok, true); assert.equal(w.gm.N.propose('rez', { c: 'extra-ice-dragon', n: 3 }).ok, false); assert.equal(w.gm.N.propose('rez', { c: 'extra-program-worm', n: 0 }).ok, false);
  assert.equal(w.gm.N.propose('net').ok, true);
  await settle(20); const out = w.gm.sent.filter(m => m.sub === 'n').slice(-1); w.gm.sent.length = 0; for (const m of out) w.gm.sent.push(m); await w.deliver(w.gm, [w.ana]);
  assert.equal(JSON.stringify(sheet), before, 'nothing changes by itself');
  const panel = w.ana.N.panel(sheet, 'ru'); assert.match(panel, /Программа Worm: REZ −3/); assert.match(panel, /−1 NET-действие на следующий ход/); assert.match(panel, /data-rn-accept/);
  const v = w.ana.N._test.shown().view, pid = v.prop.find(p => p.k === 'rez').i, nid = v.prop.find(p => p.k === 'net').i;
  const r = w.ana.N.accept(pid); assert.equal(r.ok, true); const worm = sheet.extra.cyberdecks.decks[0].entries[0];
  assert.equal(worm.rez, 4, 'Worm has REZ 7: 7 − 3'); assert.equal(w.ana.N.accept(pid).ok, false, 'a proposal is applied once');
  assert.equal(w.ana.actions.length, 1); w.ana.actions[0].run(); assert.equal('rez' in worm, false, 'the undo puts it back');
  assert.equal(w.ana.N.accept(pid).ok, false, 'and it is not offered again after an undo; the Game Master sends it again if it still stands');
  assert.equal(w.ana.N.accept(nid).ok, true); assert.equal(sheet.extra.roleTools.netrunner.values.netPenalty, 1);
  // The answer goes back sealed: the Game Master drops the proposals.
  await settle(10); await w.deliver(w.ana, [w.gm]); assert.equal(w.gm.N._test.share().prop.length, 0);
  // Declining; a program that is not rezzed here; a deck that would not validate.
  assert.equal(w.gm.N.propose('rez', { c: 'extra-program-armor', n: 2 }).ok, true); await settle(20); const o2 = w.gm.sent.filter(m => m.sub === 'n').slice(-1); w.gm.sent.length = 0; w.gm.sent.push(...o2); await w.deliver(w.gm, [w.ana]);
  const aid = w.ana.N._test.shown().view.prop.find(p => p.c === 'extra-program-armor').i;
  assert.equal(w.ana.N.accept(aid).ok, false); assert.match(w.ana.N.panel(sheet, 'ru'), /нет подходящей активной программы/);
  assert.equal(w.ana.N.decline(aid), true); assert.doesNotMatch(w.ana.N.panel(sheet, 'ru'), /Armor/);
});

test('a proposal that is not the Game Master’s own is not shown; what the runner’s page stored as applied survives a reload', async () => {
  const w = await world({ third: false }), sheet = runnerSheet(); w.ana.st.characters.push(sheet); w.ana.st.active = 'nova';
  await share(w); w.gm.N.propose('net'); await settle(20); const last = w.gm.sent.filter(m => m.sub === 'n').slice(-1); w.gm.sent.length = 0; w.gm.sent.push(...last); await w.deliver(w.gm, [w.ana]);
  const pid = w.ana.N._test.shown().view.prop[0].i; assert.equal(w.ana.N.accept(pid).ok, true);
  assert.match(w.ana.window.localStorage.getItem('nc-netrun-applied'), new RegExp(pid));
  w.ana.N._test.reset(); // a reload: memory is gone, the local copy stays
  w.ana.R.setSession(w.ana.R.session(), (await w.gm.R.deriveRoom(CODE)).topic);
  await w.gm.N.publish(true); await settle(5); await w.deliver(w.gm, [w.ana]);
  assert.doesNotMatch(w.ana.N.panel(sheet, 'ru'), /data-rn-accept/);
});

test('the Game Master’s buttons: reveal fields are saved on the architecture, only in their shape; the verdict and the proposal go through the run mode', async () => {
  const w = await world({ third: false }), a = architecture(), N = w.gm.N; w.gm.st.netArchitectures.push(a);
  const el = (k, extra = {}) => ({ dataset: { netRn: k, index: '1', entry: '3', ...extra.dataset }, value: extra.value, checked: extra.checked });
  assert.equal(N.change(el('e-rv', { checked: true }), a).dirty, true); assert.equal(a.floors[1].entries[3].rv, true);
  N.change(el('e-rv', { checked: false }), a); assert.equal('rv' in a.floors[1].entries[3], false);
  N.change(el('e-rl', { value: '  Узел\n<b>  ' }), a); assert.equal(a.floors[1].entries[3].rl, 'Узел <b>');
  N.change(el('e-sd', { checked: true }), a); assert.equal(a.floors[1].entries[3].sd, true);
  a.floors[1].entries[2].sd = undefined; N.change(el('e-sd', { checked: true, dataset: { entry: '2' } }), a); assert.equal('sd' in a.floors[1].entries[2], false, 'a DV can only be shown for a lock');
  N.change(el('floor-rv', { value: 'hide', dataset: { entry: undefined } }), a); assert.equal(a.floors[1].rv, false); N.change(el('floor-rv', { value: 'show', dataset: {} }), a); assert.equal(a.floors[1].rv, true); N.change(el('floor-rv', { value: 'auto', dataset: {} }), a); assert.equal('rv' in a.floors[1], false);
  N.change(el('pub', { value: 'Склад' }), a); assert.equal(a.pub, 'Склад'); N.change(el('pub', { value: '' }), a); assert.equal('pub' in a, false);
  assert.deepEqual(plain(N.change({ dataset: { netRn: 'e-rv', index: '99', entry: '0' }, checked: true }, a)), { handled: true });
  assert.deepEqual(plain(N.change({ dataset: { netRn: 'whatever', index: '0' } }, a)), { handled: true });
});

test('the module is registered after room.js, is plain LF text and its retained type and subtopic are new', () => {
  const index = read('index.html'), src = read('room-netrun.js'), room = read('room.js');
  assert.ok(index.includes('<script src="room-netrun.js"></script>') && index.indexOf('room-netrun.js') > index.indexOf('src="room.js"') && index.indexOf('room-netrun.js') < index.indexOf('src="app.js"'));
  assert.ok(index.includes('<link rel="stylesheet" href="room-netrun.css">'));
  assert.doesNotMatch(src, /\r/); assert.doesNotMatch(read('room-netrun.css'), /\r/);
  const subs = [...room.matchAll(/send\('([a-z])',/g)].map(m => m[1]); assert.ok(subs.includes('n'));
  assert.equal([...room.matchAll(/sub==='n'/g)].length, 1); assert.equal(subs.filter(s => s === 'n').length, 2, 'sent in two places: the view and its clearing');
  assert.match(room, /m\.t==='netrun'&&sub==='n'/);
});

test('the Game Master’s desk end to end: the buttons of the run mode share, answer, propose and stop; a change of the architecture is sent on its own', async () => {
  const w = await world({ third: false }), a = architecture(), N = w.gm.window.NetTools, ctx = { lang: 'ru', architectures: w.gm.st.netArchitectures, characters: w.gm.st.characters };
  w.gm.st.netArchitectures.push(a); N.setScope('owner');
  const click = (op, extra = {}) => ({ type: 'click', target: { closest: () => ({ dataset: { net: op, ...extra }, getAttribute: () => null, closest: () => ({ querySelector: () => ({ value: w.ana.me.fp }) }) }) } });
  N.handle(click('open', { id: 'a1' }), ctx); N.handle(click('run-mode-on'), ctx);
  const html = N.render(ctx); assert.match(html, /data-rn-box/); assert.match(html, /data-net-rn="e-rv"/); assert.match(html, /data-net-rn="floor-rv"/);
  assert.match(N.handle(click('run-rn-share'), { ...ctx }).notify || '', /NETRUN/, 'the button starts a share'); assert.equal(w.gm.N.sharing(), true);
  await settle(15); assert.equal(w.gm.sent.filter(m => m.sub === 'n').length, 1);
  // A change made on the desk (the runner steps down) is sent without any other press.
  w.gm.sent.length = 0; a.floors[1].entries.length = 4; const r = N.handle(click('run-go', { floor: 'f3' }), ctx); assert.equal(r.dirty, true);
  await settle(350); assert.equal(w.gm.sent.filter(m => m.sub === 'n').length, 1, 'one message for the change'); assert.deepEqual(plain(a.seen), ['f1', 'f2', 'f3']);
  // The incoming roll shows next to its record and the buttons answer it.
  w.gm.N._test.inbox().push({ id: 'abababababababab', arch: 'a1', floor: 'f2', entry: 'p2', ab: 'Backdoor', total: 15, pos: 1, depth: 2, who: 'Аня', at: 1 });
  N.handle(click('run-go', { floor: 'f2' }), ctx);
  const withRoll = N.render(ctx); assert.match(withRoll, /Бросок нетраннера<\/strong>: Backdoor · 15 против DV 12: выше DV/);
  const res = N.handle(click('run-rn-ok', { floor: 'f2', entry: 'p2', roll: 'abababababababab' }), ctx); assert.equal(res.dirty, true); assert.equal(a.floors[1].entries[0].state, 'open');
  assert.equal(N.handle(click('run-rn-no', { floor: 'f2', entry: 'p2', roll: 'abababababababab' }), ctx).handled, true, 'a second answer to the same roll changes nothing');
  // A proposal goes through the same buttons.
  const prop = { type: 'click', target: { closest: () => ({ dataset: { net: 'run-rn-prop', n: '3' }, getAttribute: () => null, closest: () => ({ querySelector: () => ({ value: 'extra-program-worm' }) }) }) } };
  assert.match(N.handle(prop, ctx).notify || '', /Предложение отправлено/); assert.equal(w.gm.N._test.share().prop.length, 1);
  N.handle(click('run-rn-stop'), ctx); assert.equal(w.gm.N.sharing(), false);
  assert.match(N.handle(prop, ctx).notify || '', /Сначала покажите/);
});

test('under the calculator’s damage the proposal buttons appear only while a run is shown, and only for the effects that exist', async () => {
  const w = await world({ third: false }), a = architecture(), N = w.gm.N; w.gm.st.netArchitectures.push(a);
  const hit = (to, source, total = 5, extra = {}, mode = 'ice') => ({ mode, damage: { to, source, total, iceKey: '', applied: null, ...extra } });
  assert.equal(N.proposalHtml(a, hit('rez', 'Dragon'), [], 'ru'), '', 'nothing is shown to nobody');
  assert.equal(N.start('a1', w.ana.me.fp).ok, true);
  const rez = N.proposalHtml(a, hit('rez', 'Dragon', 7), [], 'ru'); assert.match(rez, /data-rn-prop/); assert.match(rez, /REZ −7/); assert.match(rez, /<option value="extra-program-worm">/); assert.doesNotMatch(rez, /−1 NET-действие/);
  assert.equal(N.proposalHtml(a, hit('rez', 'Dragon', 7, { iceKey: 'f1:i1' }), [], 'ru'), '', 'damage to an ICE of the architecture is not a proposal to a player');
  assert.equal(N.proposalHtml(a, hit('rez', 'Dragon', 7, { applied: 'done' }), [], 'ru'), '');
  assert.equal(N.proposalHtml(a, hit('rez', 'Dragon', 0), [], 'ru'), '');
  assert.match(N.proposalHtml(a, hit('brain', 'Wisp', 1), [], 'en'), /−1 NET Action|Send to the player: −1 NET Action/);
  assert.equal(N.proposalHtml(a, hit('brain', 'Hellhound', 2), [], 'ru'), '', 'only Wisp and Vrizzbolt have this effect in the data');
  assert.equal(N.proposalHtml({ ...a, id: 'other' }, hit('rez', 'Dragon'), [], 'ru'), '', 'only for the architecture that is shown');
});

// ---------- Review round ----------
async function rollWorld() {
  const w = await world({ third: false }), sheet = runnerSheet(); w.ana.st.characters.push(sheet); w.ana.st.active = 'nova';
  w.ana.R.members().set(w.gm.id, { fp: w.gm.me.fp, role: 'gm', name: 'Мастер', box: w.gm.box, sentAt: 1, at: Date.now(), pk: {} });
  await share(w); await w.deliver(w.gm, [w.ana]); return { w, sheet };
}

test('proposals follow only what an ICE does to the runner: the runner’s own program or zap, and own Vrizzbolt, offer nothing', async () => {
  const w = await world({ third: false }), a = architecture(), N = w.gm.N; w.gm.st.netArchitectures.push(a);
  assert.equal(N.start('a1', w.ana.me.fp).ok, true);
  const hit = (mode, to, source, total = 5) => ({ mode, damage: { to, source, total, iceKey: '', applied: null } });
  assert.match(N.proposalHtml(a, hit('ice', 'rez', 'Dragon', 7), [], 'ru'), /REZ −7/);
  for (const mode of ['program', 'zap']) assert.equal(N.proposalHtml(a, hit(mode, 'rez', 'Sword', 7), [], 'ru'), '', mode);
  assert.match(N.proposalHtml(a, hit('ice', 'brain', 'Wisp', 1), [], 'en'), /−1 NET Action/);
  assert.equal(N.proposalHtml(a, hit('program', 'brain', 'Vrizzbolt', 1), [], 'en'), '', 'the runner’s own Vrizzbolt does not cost the runner an action');
  assert.equal(N.proposalHtml(a, { damage: hit('ice', 'rez', 'Dragon', 7).damage }, [], 'ru'), '', 'no mode: nothing');
});

test('a new roll on a record does not show the old answer of the Game Master', async () => {
  const { w, sheet } = await rollWorld(), a = w.gm.st.netArchitectures[0], f2 = a.floors[1], e = f2.entries[0];
  const roll = async () => { w.ana.N._test.select('p2'); assert.ok(w.ana.N.rollTarget('Backdoor').ok); await settle(15); await w.deliver(w.ana, [w.gm]); };
  await roll(); const first = w.gm.N._test.inbox()[0];
  w.gm.N.verdict(false, a, f2, e, first.id); await settle(300); await w.deliver(w.gm, [w.ana]);
  assert.match(w.ana.N.panel(sheet, 'ru'), /Ведущий: не получилось/);
  await roll(); assert.equal(w.gm.N._test.inbox().length, 1, 'the second roll waits for an answer');
  assert.doesNotMatch(w.ana.N.panel(sheet, 'ru'), /Ведущий:/, 'before the answer to THIS roll, no answer is shown');
  w.gm.N.verdict(true, a, f2, e, w.gm.N._test.inbox()[0].id); await settle(300); await w.deliver(w.gm, [w.ana]);
  assert.match(w.ana.N.panel(sheet, 'ru'), /Ведущий: получилось/); assert.doesNotMatch(w.ana.N.panel(sheet, 'ru'), /не получилось/);
  // An answer without a roll id (an older view) names no roll: it is kept in the view, shown to none.
  const old = w.ana.N.clean({ v: 1, id: '0123456789abcdef', gm: w.gm.me.fp, to: w.ana.id, cur: 'f', floors: [{ i: 'f', d: 1, p: '', e: [{ i: 'x', u: 1 }] }], res: [{ e: 'x', ok: true }] }, { to: w.ana.id, from: w.gm.me.fp });
  assert.deepEqual(plain(old.res), [{ e: 'x', ok: true }]);
});

test('a floor the Game Master turned off carries no records even when the runner stands on it, and rolls on its records are dropped', async () => {
  const a = architecture(); a.floors[1].rv = false;
  const w = await world({ third: false }); w.gm.st.netArchitectures.push(a);
  const v = w.gm.N.build(a, null); assert.equal(v.cur, 'f2'); assert.deepEqual(plain(v.floors.find(f => f.i === 'f2').e), []);
  assert.equal(JSON.stringify(v).includes('Замок'), false); assert.equal(JSON.stringify(v).includes('"dv":11'), false);
  const r = w.gm.N.start('a1', w.ana.me.fp); assert.equal(r.ok, true); await r.done; await settle(10); await w.deliver(w.gm, [w.ana]);
  w.ana.R.members().set(w.gm.id, { fp: w.gm.me.fp, role: 'gm', name: 'Мастер', box: w.gm.box, sentAt: 1, at: Date.now(), pk: {} });
  await w.ana.window.Room.netrunLink.up({ k: 'roll', run: w.gm.N._test.share().id, f: 'f2', e: 'p2', ab: 'Backdoor', total: 9, rid: 'abcdefabcdefabcd' }); await w.deliver(w.ana, [w.gm]);
  assert.equal(w.gm.N._test.inbox().length, 0);
  a.floors[1].rv = true; const v2 = w.gm.N.build(a, null); assert.equal(v2.floors.find(f => f.i === 'f2').e.length, 4, 'turned on again: the records are back');
});

test('the label and the public title are sent when the field is left, not while the Game Master is typing', async () => {
  const w = await world({ third: false }), a = architecture(), N = w.gm.window.NetTools, ctx = { lang: 'ru', architectures: w.gm.st.netArchitectures, characters: w.gm.st.characters };
  w.gm.st.netArchitectures.push(a); N.setScope('owner');
  const click = op => ({ type: 'click', target: { closest: () => ({ dataset: { net: op }, getAttribute: () => null, closest: () => ({ querySelector: () => ({ value: w.ana.me.fp }) }) }) } });
  N.handle({ type: 'click', target: { closest: () => ({ dataset: { net: 'open', id: 'a1' }, getAttribute: () => null }) } }, ctx); N.handle(click('run-mode-on'), ctx); N.handle(click('run-rn-share'), ctx);
  await settle(20); w.gm.sent.length = 0;
  const field = (type, key, value) => ({ type, target: { dataset: { netRn: key, index: '1', entry: '0' }, value, closest: () => null } });
  for (const [key, getter] of [['e-rl', () => a.floors[1].entries[0].rl], ['pub', () => a.pub]]) {
    for (const t of ['Се', 'Секретный сер']) { const r = N.handle(field('input', key, t), ctx); assert.equal(r.dirty, true); await settle(320); assert.equal(getter(), t, 'saved at once'); }
    assert.equal(w.gm.sent.filter(m => m.sub === 'n').length, 0, key + ': nothing leaves while typing');
    const r = N.handle(field('change', key, 'Дверь'), ctx); assert.equal(r.dirty, true); await settle(320);
    assert.equal(w.gm.sent.filter(m => m.sub === 'n').length, 1, key + ': one message when the field is left'); w.gm.sent.length = 0;
  }
});

test('starting the run again forgets the floors passed before', async () => {
  const w = await world({ third: false }), a = architecture(); a.seen = ['f1', 'f2', 'f3']; a.runAt = 'f3'; a.floors[2].entries[0].rv = true;
  const N = w.gm.window.NetTools, ctx = { lang: 'ru', architectures: w.gm.st.netArchitectures, characters: w.gm.st.characters };
  w.gm.st.netArchitectures.push(a); N.setScope('owner');
  const click = (op, extra = {}) => ({ type: 'click', target: { closest: () => ({ dataset: { net: op, ...extra }, getAttribute: () => null }) } });
  N.handle(click('open', { id: 'a1' }), ctx); N.handle(click('run-mode-on'), ctx);
  assert.deepEqual(plain(w.gm.N.build(a, null).floors.map(f => f.i)), ['f1', 'f2', 'f3'], 'before: all passed');
  N.handle(click('run-start'), ctx);
  assert.equal(a.runAt, 'f1'); assert.deepEqual(plain(a.seen), ['f1']);
  const v = w.gm.N.build(a, null); assert.deepEqual(plain(v.floors.map(f => f.i)), ['f1']); assert.equal(JSON.stringify(v).includes('Сейф'), false);
  N.handle(click('run-go', { floor: 'f2' }), ctx); assert.deepEqual(plain(a.seen), ['f1', 'f2'], 'walking on adds floors again');
});

test('cleanUp believes only the member it was addressed by, and only for this Game Master', () => {
  const { N } = loadTab(), FPA = 'a'.repeat(24), FPB = 'b'.repeat(24), roll = { v: 1, to: 'gm1', from: FPA, run: '0123456789abcdef', k: 'roll', f: 'f2', e: 'p2', ab: 'Backdoor', total: 5, rid: '0123456789abcdef' };
  assert.ok(N.cleanUp(roll, { to: 'gm1', from: FPA }));
  assert.equal(N.cleanUp({ ...roll, from: FPB }, { to: 'gm1', from: FPA }), null, 'signed by someone else');
  assert.equal(N.cleanUp(roll, { to: 'gm1', from: FPB }), null); assert.equal(N.cleanUp(roll, { to: 'gm2', from: FPA }), null);
});

test('the runner’s panel: no repeated heading, and the focus is put back after a roll or an answer redraws the page', async () => {
  const { w, sheet } = await rollWorld(), html = w.ana.N.panel(sheet, 'ru');
  assert.equal((html.match(/Архитектура/g) || []).length, 0, 'the title word is not repeated'); assert.match(html, /АРХИТЕКТУРА/); assert.match(html, /data-rn-panel tabindex="-1"/);
  const doc = w.ana.window.document, body = { tag: 'body' }, focused = []; doc.body = body; doc.activeElement = body;
  doc.querySelector = s => s.includes('data-rn-roll="Backdoor"') || s.includes('[data-rn-panel] [data-rn-target]') ? { focus() { focused.push(s); doc.activeElement = this; } } : null;
  w.ana.N._test.select('p2');
  const press = (sel, data) => ({ target: { closest: s => s === sel ? { dataset: data, closest: () => ({}) } : null } });
  w.ana.N.onClick(press('[data-rn-roll]', { rnRoll: 'Backdoor' })); await settle(550);
  assert.equal(focused.length, 1, 'once, then the focus is where it was put'); assert.match(focused[0], /data-rn-roll="Backdoor"/);
  doc.activeElement = { tag: 'removed', isConnected: false }; w.ana.N.onClick(press('[data-rn-decline]', { rnDecline: 'nothing' })); await settle(550);
  assert.equal(focused.length, 2); assert.match(focused[1], /data-rn-target/);
  doc.activeElement = { tag: 'button' }; w.ana.N.onClick(press('[data-rn-roll]', { rnRoll: 'Backdoor' })); await settle(550);
  assert.equal(focused.length, 2, 'focus that is already somewhere is left alone');
});

test('Undo of a verdict given from the inbox panel takes the answer out of the runner’s view and sends the view again', async () => {
  const { w, sheet } = await rollWorld(), a = w.gm.st.netArchitectures[0];
  w.ana.N._test.select('p2'); assert.ok(w.ana.N.rollTarget('Backdoor').ok); await settle(15); await w.deliver(w.ana, [w.gm]);
  const first = w.gm.N._test.inbox()[0];
  w.gm.N.inboxAct('no', first.id); await settle(300); await w.deliver(w.gm, [w.ana]);
  assert.match(w.ana.N.panel(sheet, 'ru'), /Ведущий: не получилось/);
  assert.equal(w.gm.actions.length, 1, 'the panel offers Undo');
  w.gm.actions[0].run(); await settle(300); await w.deliver(w.gm, [w.ana]);
  assert.equal(w.gm.N._test.inbox().length, 1, 'the roll is back in the inbox');
  assert.doesNotMatch(w.ana.N.panel(sheet, 'ru'), /Ведущий:/, 'the runner no longer sees the taken-back answer');
  assert.equal(w.gm.N._test.share().res.some(r => r.rid === first.id), false);
  void a;
});
