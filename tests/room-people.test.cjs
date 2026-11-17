// The room screen: the code and link can be hidden (kept in memory only; copy and QR still work), and a member can bring up to
// four characters into the room — the presence message carries a short validated list and the Game Master sees them grouped.
const Idle = require('./helpers/idle.cjs');
const { test } = require('node:test'), assert = require('node:assert/strict'), fs = require('node:fs'), vm = require('node:vm'), path = require('node:path');
const read = f => fs.readFileSync(path.join(__dirname, '..', 'site', f), 'utf8');
const plain = x => JSON.parse(JSON.stringify(x));
const settle = Idle.settle;

function loadRoom({ lang = 'ru', boxes = [] } = {}) {
  const store = new Map(), listeners = {}, copied = [], qr = [];
  const document = { addEventListener(type, f) { (listeners[type] ||= []).push(f); }, querySelector: () => null, querySelectorAll: () => boxes, visibilityState: 'visible' };
  const later = (f, ms) => { const h = Idle.timeout(f, ms); if (ms >= 1000) h.unref?.(); return h; };
  const window = { document, localStorage: { getItem: k => store.has(k) ? store.get(k) : null, setItem: (k, v) => store.set(k, String(v)), removeItem: k => store.delete(k) }, crypto: Idle.crypto, location: { hash: '', origin: 'https://example.test', pathname: '/' }, addEventListener() {}, confirm: () => true, navigator: { clipboard: { writeText: async v => { copied.push(v); } } }, btoa, atob, ROLES: [{ id: 'solo', name: { ru: 'Соло', en: 'Solo' } }], ShareLink: { qrSvg: async link => { qr.push(link); return '<svg data-qr></svg>'; } } };
  const ctx = { window, TextEncoder, TextDecoder, Uint8Array, ArrayBuffer, JSON, Math, Date, Number, String, Array, Object, Map, Set, Promise, Error, setTimeout: later, clearTimeout: Idle.clear, setInterval, clearInterval, console };
  vm.runInNewContext(read('room-transport.js') + '\n' + read('room-servers.js') + '\n' + read('room.js'), ctx);
  const R = window.Room._test, notices = [], sent = [];
  window.chars = []; window.camps = [];
  R.setApp({ getState: () => ({ lang, view: 'room', characters: window.chars, campaigns: window.camps }), notify: m => notices.push(m) });
  R.setTransport({ publish: (sub, bytes) => { sent.push({ sub, bytes }); return 1; }, close() {} });
  const press = async (action, data = {}) => { for (const f of listeners.click || []) await f({ target: { closest: sel => sel === '[data-room-action]' ? { dataset: { roomAction: action, ...data }, disabled: false } : null } }); };
  const change = async (field, target = {}) => { for (const f of listeners.change || []) await f({ target: { dataset: { roomField: field }, ...target } }); };
  return { window, R, notices, sent, press, change, store, copied, qr };
}
const CODE = 'K7RQM2XAPZ9E';
const SUM = { name: 'Ви', role: 'solo', rank: 4, hp: 45, max: 45, humanity: 60, luck: 6, luckMax: 6, head: 11, body: 11, ref: 7, dex: 6, rep: 0 };
const sheet = (id, name, hp = 40) => ({ id, name, role: 'solo', hp, humanity: 60, head: 0, bodyArmor: 0, rank: 1, stats: { BODY: 6, WILL: 6, LUCK: 5, REF: 6, DEX: 6 }, extra: {} });
async function table() {
  const maker = loadRoom().R, r = await maker.deriveRoom(CODE), keys = {};
  for (const n of ['gm', 'ann']) { const key = await maker.newIdentity(); keys[n] = { key, id: key.fp + '.0000000' + Object.keys(keys).length }; }
  const page = (n, role, extra = {}) => { const p = loadRoom(extra.load); p.R.setKey(r.key); p.R.setIdentity(keys[n].key); p.R.setSession({ code: CODE, role, name: n, memberId: keys[n].id, gmFp: keys.gm.key.fp, ...(extra.session || {}) }, r.topic); return p; };
  const msg = (from, t, d, sub = 'e') => maker.signedEnvelope(keys[from].key, keys[from].id, r.topic, r.key, sub, t, d, Date.now(), Math.random().toString(16).slice(2, 14));
  const give = async (to, bytes, sub = 'e') => { await to.R.receive({ topic: r.topic + '/' + sub, retain: false, payload: bytes }); await settle(); };
  return { r, keys, page, msg, give };
}
const DEV_A = 'a'.repeat(16);

test('the room code and link hide on this screen and come back; copy and the QR code still work', async () => {
  const { page } = await table(), gm = page('gm', 'gm');
  const word = gm.R.codeHidden;
  assert.equal(word(), false);
  const shown = gm.R.roomView();
  assert.match(shown, /K7RQ-M2XA-PZ9E/);
  assert.match(shown, /data-room-action="hide-code"[^>]*aria-pressed="false"[^>]*aria-label="Скрыть код и ссылку"/);
  await gm.press('hide-code');
  assert.equal(word(), true);
  const hidden = gm.R.roomView();
  assert.doesNotMatch(hidden, /K7RQ|M2XA|PZ9E|K7RQM2XAPZ9E/, 'no part of the code is on the screen');
  assert.match(hidden, /aria-pressed="true"/);
  assert.match(hidden, /aria-label="Код скрыт"/);
  assert.match(gm.notices.at(-1), /скрыты на этом экране/);
  // copy puts the real link on the clipboard, and the QR code is made from it
  await gm.press('copy');
  assert.equal(gm.copied.length, 1);
  assert.match(gm.copied[0], /K7RQ-?M2XA-?PZ9E|K7RQM2XAPZ9E/);
  await gm.press('qr');
  assert.equal(gm.qr.length, 1);
  assert.match(gm.qr[0], /K7RQ/);
  // hiding again closes an open QR code; showing brings the code back
  await gm.press('hide-code'); assert.equal(word(), false);
  assert.match(gm.R.roomView(), /K7RQ-M2XA-PZ9E/);
  await gm.press('hide-code'); assert.doesNotMatch(gm.R.roomView(), /data-qr/, 'hiding closes the QR code');
  // memory only: nothing about it is stored, and a new page shows the code
  assert.equal([...gm.store.values()].some(v => /hidden|codeHidden/i.test(v)), false);
  const again = (await table()).page('gm', 'gm');
  assert.equal(again.R.codeHidden(), false);
});

test('the hide control and its texts exist in English too', async () => {
  const { page } = await table(), gm = page('gm', 'gm', { load: { lang: 'en' } });
  assert.match(gm.R.roomView(), /aria-label="Hide the code and link"/);
  await gm.press('hide-code');
  assert.match(gm.R.roomView(), /aria-label="Code hidden"/);
  assert.match(gm.notices.at(-1), /hidden on this screen/);
});

test('a short list of other characters is rebuilt from known fields: at most three, no repeats, no main character', () => {
  const R = loadRoom().R;
  const good = n => ({ cid: 'c' + n, character: { ...SUM, name: 'Перс ' + n } });
  assert.equal(R.cleanMore([good(1), good(2), good(3), good(4), good(5)], 'main').length, 3, 'three besides the main one make four');
  assert.deepEqual(plain(R.cleanMore([good(1), good(1), { cid: 'main', character: SUM }], 'main').map(x => x.cid)), ['c1'], 'no repeat and never the main character');
  const dirty = R.cleanMore([{ cid: 'x', character: { name: '<img src=x onerror=1>'.repeat(10), hp: '1e9', role: { evil: 1 }, extra: 'drop' } }, null, 7, 'text', { cid: '', character: SUM }, { cid: 'y', character: null }, { cid: 'z', character: [1] }], '');
  assert.equal(dirty.length, 1); assert.equal(dirty[0].character.name.length, 60); assert.equal(dirty[0].character.hp, 9999); assert.equal(dirty[0].character.role, ''); assert.equal('extra' in dirty[0].character, false);
  assert.deepEqual(plain(R.cleanMore('nope', '')), []); assert.deepEqual(plain(R.cleanMore({ length: 3 }, '')), []);
  assert.equal(R.cleanMore(Array.from({ length: 500 }, (_, i) => good(i)), '').length, 3, 'a huge list is cut before it is read');
});

test('this page sends the main character and up to three more, and only sheets that exist', async () => {
  const { page } = await table(), ann = page('ann', 'player', { session: { characterId: 'a', moreIds: ['b', 'c', 'gone', 'a', 'd', 'e'] } });
  ann.window.chars.push(sheet('a', 'Ви'), sheet('b', 'Джонни'), sheet('c', 'Пэнам'), sheet('d', 'Ривер'), sheet('e', 'Кирю'));
  assert.deepEqual(plain(ann.R.moreIdsOf()), ['b', 'c', 'gone'], 'at most three others, never the main one');
  const d = ann.R.auth.memberPayload();
  assert.equal(d.cid, 'a'); assert.equal(d.character.name, 'Ви');
  assert.deepEqual(plain(d.more.map(x => [x.cid, x.character.name])), [['b', 'Джонни'], ['c', 'Пэнам']], 'a sheet that was deleted is not sent');
  // nobody else: no list at all
  const solo = page('ann', 'player', { session: { characterId: 'a' } }); solo.window.chars.push(sheet('a', 'Ви'));
  assert.equal('more' in solo.R.auth.memberPayload(), false, 'a member with one character sends exactly what they sent before');
  // an invalid saved list does not break anything
  const bad = page('ann', 'player', { session: { characterId: 'a', moreIds: 'text' } }); bad.window.chars.push(sheet('a', 'Ви'));
  assert.deepEqual(plain(bad.R.moreIdsOf()), []); assert.equal('more' in bad.R.auth.memberPayload(), false);
});

test('choosing and removing other characters during the session republishes the status', async () => {
  const boxes = [{ dataset: { roomField: 'more' }, value: 'b', checked: true }, { dataset: { roomField: 'more' }, value: 'c', checked: true }, { dataset: { roomField: 'more' }, value: 'a', checked: true }, { dataset: { roomField: 'more' }, value: 'd', checked: true }, { dataset: { roomField: 'more' }, value: 'e', checked: true }];
  const { r, keys, page } = await table(), ann = page('ann', 'player', { session: { characterId: 'a' }, load: { boxes } });
  ann.window.chars.push(sheet('a', 'Ви'), sheet('b', 'Джонни'), sheet('c', 'Пэнам'), sheet('d', 'Ривер'), sheet('e', 'Кирю'));
  await ann.change('more', { checked: true, value: 'b' });
  assert.deepEqual(plain(ann.R.session().moreIds), ['b', 'c', 'd'], 'a fourth other character is not taken');
  assert.match(ann.window.localStorage.getItem('nightcity-red-room-v1'), /"moreIds":\["b","c","d"\]/, 'kept with the session');
  // the main character cannot also be an extra: choosing it as main removes it from the list
  await ann.change('character', { value: 'b' });
  assert.equal(ann.R.session().characterId, 'b'); assert.deepEqual(plain(ann.R.session().moreIds), ['c', 'd']);
  boxes.splice(0, boxes.length, { dataset: { roomField: 'more' }, value: 'c', checked: false }, { dataset: { roomField: 'more' }, value: 'd', checked: true });
  await ann.change('more', { checked: false, value: 'c' });
  assert.deepEqual(plain(ann.R.session().moreIds), ['d'], 'removing one in the middle of the session');
  assert.equal(ann.R.auth.memberPayload().more.length, 1);
});

test('the picker offers the other sheets, stops at the limit and names each box', async () => {
  const { page } = await table(), ann = page('ann', 'player', { session: { characterId: 'a', moreIds: ['b', 'c', 'd'] } });
  ann.window.chars.push(sheet('a', 'Ви'), sheet('b', 'Джонни'), sheet('c', 'Пэнам'), sheet('d', 'Ривер'), sheet('e', 'Кирю <b>'));
  const html = ann.R.morePicker(ann.window.chars);
  assert.match(html, /<fieldset class="room-more"><legend>Ещё персонажи в комнате<\/legend>/);
  assert.equal((html.match(/data-room-field="more"/g) || []).length, 4, 'every sheet but the main one');
  assert.equal((html.match(/ checked /g) || []).length, 3);
  assert.match(html, /id="room-more-3"[^>]*value="e"[^>]*disabled/, 'at the limit the others cannot be added');
  assert.match(html, /Кирю &lt;b&gt;/, 'names are escaped');
  assert.match(html, /до 4 персонажей/);
  assert.match(html, /Это предел/);
  assert.equal(page('ann', 'player', { session: { characterId: 'a' } }).R.morePicker([sheet('a', 'Ви')]), '', 'one sheet: nothing to choose');
});

test('the Game Master sees every character of a member together, under the member', async () => {
  const { keys, msg, give, page } = await table(), gm = page('gm', 'gm');
  const status = (extra = {}) => msg('ann', 'member', { name: 'Аня', role: 'player', dev: DEV_A, cid: 'a', character: SUM, more: [{ cid: 'b', character: { ...SUM, name: 'Джонни <i>', hp: 10, max: 40, rank: 2 } }, { cid: 'c', character: { ...SUM, name: 'Пэнам', hp: 0, max: 40 } }], ...extra }, 'm/' + keys.ann.id);
  await give(gm, await status(), 'm/' + keys.ann.id);
  const m = [...gm.R.members().values()].find(x => x.name === 'Аня');
  assert.equal(m.more.length, 2);
  const card = gm.R.memberCard(keys.ann.id, m);
  assert.match(card, /room-more-chars/); assert.match(card, /Персонажи: 3/);
  assert.match(card, /Джонни &lt;i&gt;/); assert.doesNotMatch(card, /Джонни <i>/);
  assert.match(card, /data-wound="serious"/); assert.match(card, /data-wound="mortal"/);
  assert.equal((card.match(/<article/g) || []).length, 1, 'one card per member');
  // a member with no main character but another one: the card shows that one, not the «no character» line
  await give(gm, await status({ cid: '', character: null, more: [{ cid: 'b', character: { ...SUM, name: 'Джонни' } }] }), 'm/' + keys.ann.id);
  const m2 = [...gm.R.members().values()].find(x => x.name === 'Аня');
  assert.doesNotMatch(gm.R.memberCard(keys.ann.id, m2), /нет персонажа|не выбран/i);
  assert.match(gm.R.memberCard(keys.ann.id, m2), /Джонни/);
  // an old page sends nothing of the kind: nothing is shown
  await give(gm, await status({ more: undefined }), 'm/' + keys.ann.id);
  const m3 = [...gm.R.members().values()].find(x => x.name === 'Аня');
  assert.deepEqual(plain(m3.more), []); assert.doesNotMatch(gm.R.memberCard(keys.ann.id, m3), /room-more-chars/);
  // junk in the list is dropped, not shown
  await give(gm, await status({ more: [{ cid: 'a', character: SUM }, { cid: 'q', character: 'text' }, null] }), 'm/' + keys.ann.id);
  assert.deepEqual(plain([...gm.R.members().values()].find(x => x.name === 'Аня').more), []);
});

test('every character of a member can go to the tracker, follows its own HP and the turn is theirs', async () => {
  const { keys, msg, give, page } = await table(), gm = page('gm', 'gm', { session: { campaignId: 'c1', toasts: false } });
  gm.window.camps.push({ id: 'c1', name: 'Ночной рейс', round: 1, turnIndex: 0, roster: [{ id: 'n1', kind: 'npc', name: 'Бандит', ref: 6, hp: 20, initiative: 12, order: 1 }] });
  gm.window.App = { save() {}, render() {} };
  await give(gm, await msg('ann', 'member', { name: 'Аня', role: 'player', dev: DEV_A, cid: 'a', character: SUM, more: [{ cid: 'b', character: { ...SUM, name: 'Джонни', hp: 30, max: 40, ref: 6 } }] }, 'm/' + keys.ann.id), 'm/' + keys.ann.id);
  const camp = gm.window.camps[0], card = gm.window.Room.rosterCard(camp);
  assert.match(card, /data-id="[^"]+" data-cid="a"/); assert.match(card, /data-id="[^"]+" data-cid="b"/); assert.match(card, /REF 6 · HP 30\/40/);
  await gm.press('roster-add', { id: keys.ann.id, cid: 'b' });
  assert.equal(camp.roster.length, 2); assert.equal(camp.roster[1].own, DEV_A + ':b'); assert.equal(camp.roster[1].name, 'Джонни'); assert.equal(camp.roster[1].hp, 30);
  await gm.press('roster-add', { id: keys.ann.id, cid: 'b' }); assert.equal(camp.roster.length, 2, 'not twice');
  await gm.press('roster-add', { id: keys.ann.id, cid: 'a' }); assert.equal(camp.roster.length, 3, 'the main one is a separate row');
  assert.doesNotMatch(gm.window.Room.rosterCard(camp), /roster-add/, 'both are in the tracker now');
  // the other character's HP changes: its row follows
  await give(gm, await msg('ann', 'member', { name: 'Аня', role: 'player', dev: DEV_A, cid: 'a', character: SUM, more: [{ cid: 'b', character: { ...SUM, name: 'Джонни', hp: 12, max: 40, ref: 6 } }] }, 'm/' + keys.ann.id), 'm/' + keys.ann.id);
  await settle();
  assert.equal(camp.roster.find(x => x.own === DEV_A + ':b').hp, 12);
  // an initiative roll for the other character lands on its own row
  await give(gm, await msg('ann', 'roll', { who: 'Аня', character: 'Джонни', label: 'Инициатива', detail: '', total: 17, init: true, cid: 'b' }));
  assert.equal(camp.roster.find(x => x.own === DEV_A + ':b').initiative, 17);
  assert.equal(gm.R.liveFor({ extra: { sourceKey: 'room-dev:' + DEV_A + ':b' } }).hp, 12);
});

test('the player\'s page calls the turn of any of its characters its own, and sends their initiative', async () => {
  const { page } = await table(), ann = page('ann', 'player', { session: { characterId: 'a', moreIds: ['b'] } }), dev = ann.R.deviceId();
  ann.window.chars.push(sheet('a', 'Ви'), sheet('b', 'Джонни'));
  assert.equal(ann.R.isMine({ pc: true, own: dev + ':a', name: 'x' }), true);
  assert.equal(ann.R.isMine({ pc: true, own: dev + ':b', name: 'x' }), true);
  assert.equal(ann.R.isMine({ pc: true, own: dev + ':c', name: 'x' }), false);
  assert.equal(ann.R.isMine({ pc: true, name: 'джонни' }), true, 'by name when the row has no owner');
  assert.equal(ann.R.isMine({ pc: true, name: 'Кто-то' }), false);
  ann.window.Room.roll({ label: 'Инициатива', detail: '', total: 14, character: 'Джонни', initiative: true, characterId: 'b' });
  await settle();
  assert.equal(ann.R.state().feed[0].init, true); assert.equal(ann.R.state().feed[0].cid, 'b');
  ann.window.Room.roll({ label: 'Инициатива', detail: '', total: 14, character: 'Чужой', initiative: true, characterId: 'zzz' });
  assert.equal(ann.R.state().feed[0].init, undefined, 'a character that is not in the room is not put on the tracker');
});
