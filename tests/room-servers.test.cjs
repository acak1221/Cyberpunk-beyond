// The «Серверы» section of the room (site/room-servers.js): the default relays with their live state, a server of one's own
// (wss only, no credentials), a test for each, a reset — and the room really connects to what the list says.
const Idle = require('./helpers/idle.cjs');
const { test } = require('node:test'), assert = require('node:assert/strict'), fs = require('node:fs'), vm = require('node:vm'), path = require('node:path');
const read = f => fs.readFileSync(path.join(__dirname, '..', 'site', f), 'utf8');
const plain = x => JSON.parse(JSON.stringify(x));
const KEY = 'nightcity-red-room-servers-v1', LEGACY = 'nightcity-red-room-brokers';

function load(extra = {}) {
  const store = new Map(), listeners = {}, sockets = [];
  class FakeWS {
    constructor(url, proto) { this.url = url; this.proto = proto; this.sent = []; this.closed = false; sockets.push(this); (extra.onSocket || (() => {}))(this); }
    send(b) { this.sent.push(b); }
    close() { this.closed = true; }
  }
  const document = { addEventListener(type, f) { (listeners[type] ||= []).push(f); }, querySelector: s => (extra.nodes || {})[s] || null, querySelectorAll: () => [], visibilityState: 'visible' };
  const window = { document, WebSocket: FakeWS, localStorage: { getItem: k => store.has(k) ? store.get(k) : null, setItem: (k, v) => store.set(k, String(v)), removeItem: k => store.delete(k) }, crypto: Idle.crypto, location: { hash: '', origin: 'https://example.test', pathname: '/' }, addEventListener() {}, confirm: () => true, navigator: {}, btoa, atob, ROLES: [] };
  const every = (f, ms) => { const h = setInterval(f, ms); h.unref?.(); return h; };
  const later = (f, ms) => { const h = Idle.timeout(f, ms); if (ms >= 1000) h.unref?.(); return h; };
  const ctx = { window, TextEncoder, TextDecoder, Uint8Array, ArrayBuffer, JSON, Math, Date, Number, String, Array, Object, Map, Set, Promise, Error, URL, setTimeout: later, clearTimeout: Idle.clear, setInterval: every, clearInterval, console };
  vm.runInNewContext(read('room-transport.js') + '\n' + read('room-servers.js') + '\n' + read('room.js'), ctx);
  const R = window.Room._test, notices = [];
  R.setApp({ getState: () => ({ lang: extra.lang || 'ru', view: 'room', characters: [], campaigns: [] }), notify: m => notices.push(m) });
  const press = async (action, data = {}) => { for (const f of listeners.click || []) await f({ target: { closest: sel => sel === '[data-room-action]' ? { dataset: { roomAction: action, ...data } } : null } }); };
  return { window, S: window.RoomServers, R, store, sockets, notices, press, FakeWS, listeners };
}
const DEFAULT_URLS = ['wss://public.cloud.shiftr.io', 'wss://broker.emqx.io:8084/mqtt', 'wss://broker.hivemq.com:8884/mqtt'];

test('an address typed by a person: wss only, no credentials, no repeats', () => {
  const { S } = load();
  assert.deepEqual(plain(S.validate('wss://relay.example.org/mqtt')), { ok: true, url: 'wss://relay.example.org/mqtt' });
  assert.deepEqual(plain(S.validate('  WSS://Relay.Example.org:8884/mqtt  ')), { ok: true, url: 'wss://relay.example.org:8884/mqtt' }, 'spaces around, host in lower case');
  assert.equal(S.validate('wss://relay.example.org/').url, 'wss://relay.example.org', 'a bare slash is not part of the address');
  assert.equal(S.validate('wss://[2001:db8::1]:8884/mqtt').ok, true);
  const bad = (x, reason) => assert.equal(S.validate(x).reason, reason, String(x));
  bad('', 'empty'); bad('   ', 'empty'); bad(undefined, 'empty'); bad(42, 'empty');
  bad('ws://relay.example.org/mqtt', 'scheme'); bad('https://relay.example.org', 'scheme'); bad('relay.example.org', 'scheme'); bad('javascript:alert(1)', 'scheme'); bad('mqtt://relay.example.org', 'scheme');
  bad('wss://user:pass@relay.example.org', 'credentials'); bad('wss://user@relay.example.org', 'credentials'); bad('wss://:pass@relay.example.org', 'credentials');
  bad('wss://relay.example.org/mqtt?token=abc', 'credentials'); bad('wss://relay.example.org/mqtt?x=1&apikey=2', 'credentials'); bad('wss://relay.example.org/?password=1', 'credentials');
  bad('wss://relay.example.org/mqtt#frag', 'invalid'); bad('wss://relay example.org', 'invalid'); bad('wss://', 'invalid'); bad('wss://bad_host.example.org', 'invalid'); bad('wss://-bad.example.org', 'invalid');
  bad('wss://' + 'a'.repeat(250) + '.example.org', 'long');
  bad('wss://public.cloud.shiftr.io', 'dup'); bad('WSS://BROKER.EMQX.IO:8084/mqtt', 'dup');
  assert.equal(S.validate('wss://relay.example.org', ['wss://relay.example.org']).reason, 'dup');
  assert.equal(S.validate('wss://relay.example.org?region=eu').ok, true, 'a harmless query is allowed');
});

test('the saved list is checked again when it is read: nothing insecure or hand-edited gets in', () => {
  const { S } = load();
  const c = S.clean({ custom: [{ url: 'wss://ok.example.org' }, { url: 'ws://insecure.example.org' }, { url: 'wss://u:p@creds.example.org' }, 'wss://string.example.org', { url: 7 }, null, { url: 'wss://ok.example.org' }, ...Array.from({ length: 20 }, (_, i) => ({ url: 'wss://many' + i + '.example.org' }))], off: [DEFAULT_URLS[1], 'wss://unknown.example.org', 5, DEFAULT_URLS[1]] });
  assert.equal(c.custom.length, 5, 'at most five of their own');
  assert.deepEqual(plain(c.custom.slice(0, 2)), [{ url: 'wss://ok.example.org' }, { url: 'wss://string.example.org' }]);
  assert.deepEqual(plain(c.off), [DEFAULT_URLS[1]], 'only default servers can be off, each once');
  assert.deepEqual(plain(S.clean({ off: DEFAULT_URLS }).off), [], 'never all of them off');
  for (const junk of [null, undefined, 5, 'x', [], { custom: 'a', off: 'b' }]) assert.deepEqual(plain(S.clean(junk)), { custom: [], off: [] });
});

test('the room connects to the defaults, to the defaults without the ones switched off plus the person\'s own, or to the older list', () => {
  const { S, store, window } = load(), ls = window.localStorage;
  assert.equal(S.brokers(ls), null, 'nothing set: the transport\'s own defaults');
  S.save(ls, { custom: [{ url: 'wss://mine.example.org/mqtt' }], off: [DEFAULT_URLS[0]] });
  const list = plain(S.brokers(ls));
  assert.deepEqual(list.map(b => b.url), [DEFAULT_URLS[1], DEFAULT_URLS[2], 'wss://mine.example.org/mqtt']);
  assert.equal(list.some(b => b.password), false, 'no default credentials are carried to a server of their own');
  assert.deepEqual(plain(S.load(ls)), { custom: [{ url: 'wss://mine.example.org/mqtt' }], off: [DEFAULT_URLS[0]], old: false });
  // an empty list is not stored
  S.save(ls, { custom: [], off: [] }); assert.equal(store.has(KEY), false); assert.equal(S.brokers(ls), null);
  // a hand-damaged value is ignored and the defaults are used
  store.set(KEY, '{broken'); assert.equal(S.brokers(ls), null);
  store.set(KEY, JSON.stringify({ custom: [{ url: 'ws://nope' }], off: [] })); assert.equal(S.brokers(ls), null);
  // the list the console instructions made keeps working exactly as before
  store.delete(KEY);
  store.set(LEGACY, JSON.stringify([{ url: 'wss://old.example.org/mqtt', username: 'u', password: 'p' }, { url: 'ws://localhost:9001' }]));
  assert.deepEqual(plain(S.brokers(ls)), [{ url: 'wss://old.example.org/mqtt', username: 'u', password: 'p' }, { url: 'ws://localhost:9001' }]);
  const shown = S.load(ls);
  assert.equal(shown.old, true); assert.equal(shown.custom.length, 2); assert.deepEqual(plain(shown.off), DEFAULT_URLS, 'the defaults it did not name are shown as off');
  store.set(LEGACY, 'not json'); assert.equal(S.brokers(ls), null);
  store.set(LEGACY, JSON.stringify([{ url: 'https://x' }])); assert.equal(S.brokers(ls), null);
  // saving through the new section replaces the older list; reset removes both
  store.set(LEGACY, JSON.stringify([{ url: 'wss://old.example.org/mqtt' }]));
  assert.equal(S.save(ls, S.addCustom(S.load(ls), 'wss://new.example.org').cfg), true);
  assert.equal(store.has(LEGACY), false); assert.equal(S.load(ls).old, false);
  S.reset(ls); assert.equal(store.has(KEY), false); assert.equal(store.has(LEGACY), false); assert.equal(S.brokers(ls), null);
});

test('adding, removing, switching a default off: the limits', () => {
  const { S } = load();
  let cfg = { custom: [], off: [], old: false };
  for (let i = 0; i < 5; i++) cfg = S.addCustom(cfg, 'wss://own' + i + '.example.org').cfg;
  assert.equal(S.addCustom(cfg, 'wss://own6.example.org').reason, 'many');
  assert.equal(S.addCustom(cfg, 'wss://own1.example.org').reason, 'many', 'the limit comes first');
  cfg = S.removeCustom(cfg, 'WSS://OWN0.example.org').cfg; assert.equal(cfg.custom.length, 4);
  assert.equal(S.addCustom(cfg, 'wss://own1.example.org').reason, 'dup');
  const bare = { custom: [], off: [], old: false };
  let r = S.setDefault(bare, DEFAULT_URLS[0], false); assert.equal(r.ok, true); r = S.setDefault(r.cfg, DEFAULT_URLS[1], false); assert.equal(r.ok, true);
  assert.equal(S.setDefault(r.cfg, DEFAULT_URLS[2], false).reason, 'last', 'the last enabled server cannot be switched off');
  assert.equal(S.setDefault({ ...r.cfg, custom: [{ url: 'wss://mine.example.org' }] }, DEFAULT_URLS[2], false).ok, true, 'with a server of their own there is something left');
  assert.deepEqual(plain(S.setDefault(r.cfg, DEFAULT_URLS[0], true).cfg.off), [DEFAULT_URLS[1]]);
  assert.equal(S.setDefault(bare, 'wss://unknown.example.org', false).ok, false);
});

// A socket that answers like a broker, or does not.
const sockWith = behaviour => ws => queueMicrotask(() => {
  if (behaviour.open === false) { ws.onerror?.(); return; }
  ws.onopen?.();
  if (behaviour.reply === undefined) return;
  ws.onmessage?.({ data: behaviour.reply });
});
function testRun(behaviour, opts = {}) {
  let clock = 1000;
  const { S, sockets, FakeWS } = load({ onSocket: sockWith(behaviour) });
  const timers = [];
  const p = S.test(opts.broker || 'wss://relay.example.org', { WebSocketImpl: FakeWS, now: () => (clock += 37), setTimeout: (f, ms) => { timers.push({ f, ms }); return timers.length; }, clearTimeout: id => { timers[id - 1] && (timers[id - 1].cleared = true); } });
  return { p, sockets, timers };
}

test('a test opens one connection, says hello and waits for the answer: the time, a refusal, silence, a closed door, nonsense', async () => {
  let t = testRun({ reply: Uint8Array.of(0x20, 2, 0, 0).buffer });
  assert.deepEqual(plain(await t.p), { ok: true, ms: 37 });
  assert.equal(t.sockets.length, 1); assert.equal(t.sockets[0].proto, 'mqtt'); assert.equal(t.sockets[0].closed, true, 'the connection is closed again');
  assert.equal(t.sockets[0].sent.length, 1, 'only one packet is sent'); assert.equal(t.sockets[0].sent[0][0] >> 4, 1, 'a CONNECT, nothing subscribed or published');
  assert.equal(t.timers[0].cleared, true, 'the timeout is cleared');
  t = testRun({ reply: Uint8Array.of(0x20, 2, 0, 5).buffer }); assert.deepEqual(plain(await t.p), { ok: false, reason: 'refused' });
  t = testRun({ open: false }); assert.deepEqual(plain(await t.p), { ok: false, reason: 'open' });
  t = testRun({}); await new Promise(r => setImmediate(r)); t.timers[0].f(); assert.deepEqual(plain(await t.p), { ok: false, reason: 'timeout' });
  assert.equal(t.timers[0].ms, 6000);
  // nonsense does not look like an answer: the parser fails or nothing is a CONNACK — the attempt ends, in time
  t = testRun({ reply: Uint8Array.of(0xff, 0xff, 0xff, 0xff, 0xff, 0xff).buffer }); assert.deepEqual(plain(await t.p), { ok: false, reason: 'proto' });
  // the default with its public login sends it; an address of their own sends none
  const { S, FakeWS } = load({ onSocket: sockWith({ reply: Uint8Array.of(0x20, 2, 0, 0).buffer }) });
  let seen = null; const Spy = class extends FakeWS { send(b) { seen = b; super.send(b); } };
  await S.test({ url: 'wss://public.cloud.shiftr.io', username: 'public', password: 'public' }, { WebSocketImpl: Spy });
  assert.match(Buffer.from(seen).toString('latin1'), /public/);
  await S.test('wss://relay.example.org', { WebSocketImpl: Spy });
  assert.doesNotMatch(Buffer.from(seen).toString('latin1'), /public/);
  assert.deepEqual(plain(await S.test('wss://x', { WebSocketImpl: function () { throw new Error('no'); } })), { ok: false, reason: 'open' });
  const bare = load(); delete bare.window.WebSocket; assert.deepEqual(plain(await bare.S.test('wss://x', { setTimeout: () => 0 })), { ok: false, reason: 'open' }, 'a browser without web sockets');
});

test('the card shows each server with its state, never trusts a stored address and keeps both languages in step', () => {
  const { S, window } = load(), ls = window.localStorage;
  let html = S.card({ lang: 'ru', storage: ls, states: null, connected: false });
  for (const u of ['public.cloud.shiftr.io', 'broker.emqx.io:8084/mqtt', 'broker.hivemq.com:8884/mqtt']) assert.ok(html.includes('<b>' + u + '</b>'), u);
  assert.equal((html.match(/data-room-action="srv-test"/g) || []).length, 3);
  assert.match(html, /по умолчанию · не подключён/);
  assert.match(html, /Добавить свой сервер \(wss:\/\/…\)/);
  assert.match(html, /data-room-action="srv-add"[^>]*data-room-field="srv-add"/);
  assert.match(html, /data-room-action="srv-reset"/);
  assert.match(html, /role="status" data-rs-msg/);
  assert.match(html, /тип сообщения/, 'the card says what a server can see');
  S.save(ls, { custom: [{ url: 'wss://mine.example.org/mqtt' }], off: [DEFAULT_URLS[2]] });
  html = S.card({ lang: 'ru', storage: ls, states: { [DEFAULT_URLS[0]]: 'online', [DEFAULT_URLS[1]]: 'offline', 'wss://mine.example.org/mqtt': 'refused' }, connected: true });
  assert.match(html, /shiftr\.io<\/b><small>по умолчанию · на связи/);
  assert.match(html, /emqx\.io:8084\/mqtt<\/b><small>по умолчанию · нет связи/);
  assert.match(html, /hivemq\.com:8884\/mqtt<\/b><small>по умолчанию · выключен/);
  assert.match(html, /mine\.example\.org\/mqtt<\/b><small>свой · сервер отказал/);
  assert.match(html, /data-room-action="srv-remove" data-url="wss:\/\/mine\.example\.org\/mqtt"/);
  assert.match(html, /data-on="1"[^>]*>Включить/); assert.match(html, /data-on="0"[^>]*>Отключить/);
  // every button that can be pressed has a name of its own for a screen reader, and the field has a visible label
  assert.equal((html.match(/<button[^>]*>\s*<\/button>/g) || []).length, 0);
  assert.match(html, /<label class="field">Добавить свой сервер/);
  // English
  const en = S.card({ lang: 'en', storage: ls, states: null, connected: true });
  assert.match(en, /Add your own server \(wss:\/\/…\)/); assert.match(en, /Reset to default servers/); assert.doesNotMatch(en, /[А-Яа-я]/, 'no Russian leaks into the English card');
  // the same strings exist in both languages, and Russian addresses the reader formally
  assert.deepEqual(Object.keys(S.TEXT.ru).sort(), Object.keys(S.TEXT.en).sort());
  assert.doesNotMatch(Object.values(S.TEXT.ru).join(' '), /\bты\b|\bтвой|\bтебе\b|\bтвоего/i);
  // a hand-edited stored value cannot put markup or an insecure address on the page
  window.localStorage.setItem(KEY, JSON.stringify({ custom: [{ url: 'wss://"><img src=x onerror=alert(1)>.example.org' }, { url: 'ws://plain.example.org' }], off: [] }));
  const safe = S.card({ lang: 'ru', storage: ls, states: null, connected: false });
  assert.doesNotMatch(safe, /<img/); assert.doesNotMatch(safe, /plain\.example/);
});

test('the buttons: a bad address says why and keeps the text, a good one is kept and the room reconnects with it', async () => {
  const input = { value: '', focus() { input.focused = true; } };
  const h = load({ nodes: { '#room-server-url': input } });
  const { S, R, press, store, sockets, window } = h;
  // not in a room: nothing is reconnected
  input.value = 'ws://plain.example.org';
  await press('srv-add');
  assert.equal(S.takeMessage().kind, 'bad'); assert.match(S.takeMessage().text, /wss:\/\//); assert.equal(store.has(KEY), false); assert.equal(input.value, 'ws://plain.example.org', 'what was typed is kept'); assert.equal(input.focused, true, 'focus goes back to the field');
  input.value = 'wss://user:secret@relay.example.org'; await press('srv-add');
  assert.match(S.takeMessage().text, /логина, пароля или ключа/);
  input.value = 'wss://relay.example.org/mqtt'; input.focused = false;
  await press('srv-add');
  assert.equal(S.takeMessage().kind, 'ok'); assert.match(S.takeMessage().text, /добавлен/); assert.equal(input.value, ''); assert.equal(input.focused, true);
  assert.deepEqual(JSON.parse(store.get(KEY)), { v: 1, custom: [{ url: 'wss://relay.example.org/mqtt' }], off: [] });
  input.value = 'wss://relay.example.org/mqtt'; await press('srv-add'); assert.match(S.takeMessage().text, /уже в списке/);
  await press('srv-default', { url: DEFAULT_URLS[0], on: '0' }); assert.deepEqual(JSON.parse(store.get(KEY)).off, [DEFAULT_URLS[0]]); assert.match(S.takeMessage().text, /отключён/);
  await press('srv-default', { url: DEFAULT_URLS[0], on: '1' }); assert.deepEqual(JSON.parse(store.get(KEY)).off, []); assert.match(S.takeMessage().text, /включён/);
  await press('srv-remove', { url: 'wss://relay.example.org/mqtt' }); assert.equal(store.has(KEY), false, 'an empty list is not stored'); assert.match(S.takeMessage().text, /убран/);
  await press('srv-add'); input.value = 'wss://relay.example.org/mqtt'; await press('srv-add');
  await press('srv-reset'); assert.equal(store.has(KEY), false); assert.match(S.takeMessage().text, /восстановлены/);
  await press('srv-reset'); assert.match(S.takeMessage().text, /Уже стоят/);
  assert.equal(sockets.length, 0, 'outside a room no connection is made by editing the list');
  // inside a room: the list change makes the room connect again, to the new list
  const { r, keys } = await (async () => { const maker = R; const room = await maker.deriveRoom('K7RQM2XAPZ9E'), key = await maker.newIdentity(); return { r: room, keys: key }; })();
  R.setKey(r.key); R.setIdentity(keys); R.setSession({ code: 'K7RQM2XAPZ9E', role: 'gm', name: 'gm', memberId: keys.fp + '.00000001', gmFp: keys.fp }, r.topic);
  R.setTransport({ publish: () => 1, close() {} });
  input.value = 'wss://relay.example.org/mqtt'; await press('srv-add'); await Idle.settle();
  const urls = sockets.map(s => s.url);
  assert.deepEqual(urls.sort(), [...DEFAULT_URLS, 'wss://relay.example.org/mqtt'].sort(), 'the defaults and the new one');
  sockets.length = 0;
  await press('srv-default', { url: DEFAULT_URLS[1], on: '0' }); await Idle.settle();
  assert.equal(sockets.map(s => s.url).includes(DEFAULT_URLS[1]), false, 'a server switched off is no longer used');
  assert.equal(sockets.length, 3);
  R.disconnect(false);
});

test('the test button tries one address, says the result in the status line and cannot be pressed twice at once', async () => {
  const answer = Uint8Array.of(0x20, 2, 0, 0).buffer;
  const h = load({ onSocket: sockWith({ reply: answer }) });
  const { S, press, sockets } = h;
  const run = press('srv-test', { url: DEFAULT_URLS[1] });
  assert.equal(S.isRunning(DEFAULT_URLS[1]), true, 'busy while it runs');
  await press('srv-test', { url: DEFAULT_URLS[1] });
  await run; await Idle.settle();
  assert.equal(sockets.length, 1, 'a second press while the first runs does nothing');
  assert.equal(S.isRunning(DEFAULT_URLS[1]), false);
  assert.equal(S.takeMessage().kind, 'ok'); assert.match(S.takeMessage().text, /^broker\.emqx\.io:8084\/mqtt: Ответил за \d+ мс$/);
  const html = S.card({ lang: 'ru', storage: h.window.localStorage, states: null, connected: false });
  assert.match(html, /emqx\.io:8084\/mqtt<\/b><small>по умолчанию · не подключён · Ответил за/);
  // a refused connection
  const h2 = load({ onSocket: sockWith({ reply: Uint8Array.of(0x20, 2, 0, 4).buffer }) });
  await h2.press('srv-test', { url: DEFAULT_URLS[0] }); assert.equal(h2.S.takeMessage().kind, 'bad'); assert.match(h2.S.takeMessage().text, /отказал/);
  // the test of a server that is not on the list at all still only opens that one address
  const h3 = load({ onSocket: sockWith({ open: false }) });
  await h3.press('srv-test', { url: 'wss://not-listed.example.org' }); assert.match(h3.S.takeMessage().text, /Не удалось открыть/);
});

test('the module is registered before the room, and the style file exists', () => {
  const html = read('index.html'), at = n => html.indexOf('<script src="' + n + '"></script>');
  assert.ok(at('room-servers.js') > at('room-transport.js') && at('room-servers.js') < at('room.js'), 'after the transport, before the room page');
  assert.ok(html.includes('<link rel="stylesheet" href="room-servers.css">'));
  assert.ok(fs.existsSync(path.join(__dirname, '..', 'site', 'room-servers.css')));
  assert.equal(html.lastIndexOf('<script src="'), html.lastIndexOf('<script src="app.js"></script>'), 'app.js stays the last script');
});

test('the older console list survives the first edit: logins, ws:// and a deliberate «no public relays» choice', () => {
  const { S, store, window } = load(), ls = window.localStorage;
  const old = [{ url: 'wss://my.priv/mqtt', username: 'u', password: 'p' }, { url: 'ws://10.0.0.5:9001' }];
  store.set(LEGACY, JSON.stringify(old));
  assert.equal(S.save(ls, S.load(ls)), true, 'saving what is shown, without any change');
  assert.equal(store.has(LEGACY), false);
  assert.deepEqual(plain(S.brokers(ls)), old, 'the same servers with the same logins, and no public relay switched back on');
  assert.deepEqual(plain(S.load(ls).off), DEFAULT_URLS);
  // adding one more server keeps the earlier ones as they were
  assert.equal(S.save(ls, S.addCustom(S.load(ls), 'wss://new.example.org').cfg), true);
  assert.deepEqual(plain(S.brokers(ls)).map(b => b.url), ['wss://my.priv/mqtt', 'ws://10.0.0.5:9001', 'wss://new.example.org']);
  assert.equal(plain(S.brokers(ls))[0].password, 'p');
  // removing one of them works, and the default relays can be all off while an own server remains
  S.save(ls, S.removeCustom(S.load(ls), 'ws://10.0.0.5:9001').cfg);
  assert.deepEqual(plain(S.brokers(ls)).map(b => b.url), ['wss://my.priv/mqtt', 'wss://new.example.org']);
  // a hand-written ws:// entry without the carry-over mark is still refused
  store.set(KEY, JSON.stringify({ custom: [{ url: 'ws://nope.example.org', username: 'x' }], off: [] }));
  assert.equal(S.brokers(ls), null);
});

test('Enter in the server field adds the server; testing says so in the status line', async () => {
  const input = { value: 'wss://enter.example.org/mqtt', id: 'room-server-url', focus() { input.focused = true; }, closest: () => null };
  const h = load({ nodes: { '#room-server-url': input }, onSocket: () => {} });
  const { S, store, listeners } = h;
  let prevented = false;
  for (const f of listeners.keydown || []) await f({ key: 'Enter', target: input, preventDefault() { prevented = true; } });
  await Idle.settle();
  assert.equal(prevented, true);
  assert.deepEqual(JSON.parse(store.get(KEY)).custom, [{ url: 'wss://enter.example.org/mqtt' }]);
  assert.equal(S.takeMessage().kind, 'ok'); assert.equal(input.value, ''); assert.equal(input.focused, true);
  // another key or another field does nothing
  input.value = 'wss://other.example.org'; input.focused = false;
  for (const f of listeners.keydown || []) await f({ key: 'a', target: input, preventDefault() {} });
  assert.equal(JSON.parse(store.get(KEY)).custom.length, 1);
  // the status line changes the moment a test starts
  S.note('ok', 'Сервер добавлен');
  const run = h.press('srv-test', { url: DEFAULT_URLS[1] });
  assert.match(S.takeMessage().text, /Проверяем/);
  h.sockets.at(-1)?.onerror?.(); await run;
});
