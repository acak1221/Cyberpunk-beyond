// Two tabs of one browser: an edit that another tab replaces is set aside and said so; one tab at a time writes (Web Locks),
// the others only show the data and can take over with «Открыть здесь».
const { test } = require('node:test'), assert = require('node:assert/strict'), fs = require('node:fs'), vm = require('node:vm'), path = require('node:path');
const code = fs.readFileSync(path.join(__dirname, '../site/local-store.js'), 'utf8');
const plain = x => JSON.parse(JSON.stringify(x));
const KEY = 'nightcity-red-v1', OTHER = 'nightcity-red-v1:other-tab';
const tick = () => new Promise(r => setImmediate(r));

// A browser with one storage and a lock manager shared by its tabs, like the real thing.
function browser({ quota = null, withLocks = true } = {}) {
  const data = new Map(), tabs = [], held = new Map(), queue = [];
  const locks = {
    request(name, opts, cb) {
      if (typeof opts === 'function') { cb = opts; opts = {}; }
      return new Promise((resolve, reject) => {
        const grant = () => {
          const h = { reject }; held.set(name, h);
          Promise.resolve(cb({ name })).then(v => { if (held.get(name) === h) held.delete(name); resolve(v); next(); }, e => { if (held.get(name) === h) held.delete(name); reject(e); next(); });
        };
        const next = () => { if (!held.has(name) && queue.length) queue.shift()(); };
        if (opts.steal) { const cur = held.get(name); if (cur) { held.delete(name); cur.reject(Object.assign(new Error('stolen'), { name: 'AbortError' })); } grant(); return; }
        if (!held.has(name)) { grant(); return; }
        if (opts.ifAvailable) { Promise.resolve(cb(null)).then(resolve, reject); return; }
        queue.push(grant);
      });
    },
    release(name) { const h = held.get(name); if (h) { held.delete(name); } if (queue.length) queue.shift()(); },
  };
  function tab(label, { lang = 'ru', applied = [] } = {}) {
    const listeners = {}, timers = [], created = [], focused = [];
    const localStorage = {
      getItem: k => data.has(k) ? data.get(k) : null,
      setItem(k, v) { if (quota && quota(k, v)) throw Error('quota'); data.set(k, String(v)); if (k === KEY) for (const o of tabs) if (o !== me) o.listeners.storage?.({ key: KEY, newValue: String(v), storageArea: o.win.localStorage }); },
      removeItem: k => data.delete(k), get length() { return data.size; }, key: i => [...data.keys()][i],
    };
    const status = { hidden: true, innerHTML: '', listeners: {}, addEventListener(t, fn) { this.listeners[t] = fn; }, querySelector: sel => sel === 'button' && status.innerHTML.includes('<button') ? { focus() { focused.push('status button'); } } : null };
    const app = { inert: true, attrs: {}, setAttribute(k, v) { this.attrs[k] = v; } };
    const heading = { attrs: {}, hasAttribute(k) { return k in this.attrs; }, setAttribute(k, v) { this.attrs[k] = v; }, focus() { focused.push('h1'); } };
    const win = { localStorage, addEventListener(t, fn) { listeners[t] = fn; }, confirm: () => true, navigator: withLocks ? { locks } : {}, location: { reload() {} } };
    const doc = { querySelector: s => s === 'h1' ? heading : null, addEventListener() {}, visibilityState: 'visible', createElement: () => { const a = { click() { created.push(a.download); }, remove() {} }; return a; }, body: { appendChild() {} } };
    const ctx = { window: win, document: doc, setTimeout: fn => { timers.push(fn); return timers.length; }, clearTimeout() {}, JSON, Promise, Error, Date, URL: { createObjectURL: () => 'blob:x', revokeObjectURL() {} }, Blob };
    vm.runInNewContext(code, ctx);
    const calls = { scope: [], apply: [], ext: 0, aside: [] };
    const store = win.LocalStore.create({ app, status, language: () => lang, validate: x => !!x && Array.isArray(x.characters), isNewer: x => x?.schemaVersion > 1, apply: x => { calls.apply.push(x); applied.push(x); }, onScopeChange: s => calls.scope.push(s), onExternalChange: () => calls.ext++, onSetAside: id => calls.aside.push(id) });
    const me = { label, store, status, app, calls, win, listeners, timers, focused, created, LocalStore: win.LocalStore, runTimers() { const t = timers.splice(0); for (const f of t) f(); }, click: action => status.listeners.click({ target: { closest: () => ({ dataset: { storeAction: action } }) } }) };
    tabs.push(me);
    return me;
  }
  return { data, tab, locks, copies: () => [...data.keys()].filter(k => k.startsWith(OTHER)) };
}

test('an edit that another tab replaces is kept in the set-aside list and the tab says so', async () => {
  const b = browser(), A = b.tab('A'), B = b.tab('B');
  A.store.start(); B.store.start(); await tick();
  const pending = A.store.save({ characters: [{ id: 'A-edit', name: 'Ви' }] });
  assert.equal(A.store.stateLabel().includes('СОХРАНЕНИЕ'), true);
  // the other tab writes before this tab's delay is over (this tab holds the lock; the other writes on purpose here)
  b.data.set(KEY, JSON.stringify({ characters: [{ id: 'B-edit' }] }));
  A.listeners.storage({ key: KEY, newValue: b.data.get(KEY), storageArea: A.win.localStorage });
  assert.deepEqual(plain(await pending), { ok: false, reason: 'replaced' }, 'the answer to the caller is the same as before');
  assert.deepEqual(plain(A.calls.apply.at(-1)), { characters: [{ id: 'B-edit' }] }, 'the other tab\'s data is shown');
  const copies = b.copies();
  assert.equal(copies.length, 1, 'the lost snapshot is kept');
  assert.deepEqual(JSON.parse(b.data.get(copies[0])), { characters: [{ id: 'A-edit', name: 'Ви' }] });
  assert.deepEqual(plain(A.store.copies().map(c => [c.kind, c.id === copies[0]])), [['other-tab', true]]);
  assert.equal(A.store.readCopy(copies[0]).includes('A-edit'), true);
  assert.deepEqual(A.calls.aside, [copies[0]]);
  assert.equal(A.status.hidden, false);
  assert.match(A.status.innerHTML, /Изменено в другой вкладке/);
  assert.match(A.status.innerHTML, /role="status"/);
  assert.match(A.status.innerHTML, /data-store-action="download-notice"/);
  assert.match(A.status.innerHTML, /Корзина и отложенные данные/);
  assert.equal(JSON.parse(b.data.get(KEY)).characters[0].id, 'B-edit', 'the other tab\'s data is not overwritten');
  // the copy can be downloaded
  A.click('download-notice'); assert.equal(A.created.length, 1); assert.match(A.created[0], /^nightcity-red-other-tab-\d{4}-\d{2}-\d{2}\.json$/);
  // «Понятно» closes the message and focus does not fall to the page
  A.click('dismiss-notice');
  assert.equal(A.status.hidden, true); assert.equal(A.status.innerHTML, ''); assert.equal(A.store.notice(), null);
  assert.equal(A.focused.at(-1), 'h1', 'focus moves to the page heading, not to the body');
  assert.equal(A.store.copies().length, 1, 'dismissing the message keeps the copy');
});

test('the message and the buttons speak English too, and a copy is counted among the others', async () => {
  const b = browser({ withLocks: false }), A = b.tab('A', { lang: 'en' });
  A.store.start();
  A.store.save({ characters: [{ id: 'x' }] });
  A.listeners.storage({ key: KEY, newValue: JSON.stringify({ characters: [] }), storageArea: A.win.localStorage });
  assert.match(A.status.innerHTML, /Changed in another tab/); assert.match(A.status.innerHTML, />Download the edit</); assert.match(A.status.innerHTML, />Got it</);
  assert.doesNotMatch(A.status.innerHTML, /[А-Яа-я]/);
});

test('nothing lost, nothing said: no pending edit, or the same data written twice', async () => {
  const b = browser({ withLocks: false }), A = b.tab('A');
  A.store.start();
  A.listeners.storage({ key: KEY, newValue: JSON.stringify({ characters: [{ id: 'B' }] }), storageArea: A.win.localStorage });
  assert.equal(b.copies().length, 0); assert.equal(A.status.hidden, true); assert.equal(A.store.notice(), null);
  const p = A.store.save({ characters: [{ id: 'same' }] });
  A.listeners.storage({ key: KEY, newValue: JSON.stringify({ characters: [{ id: 'same' }] }), storageArea: A.win.localStorage });
  assert.equal(b.copies().length, 0, 'the other tab already holds exactly this edit'); assert.equal(A.store.notice(), null);
  await p;
  // an event for another key, another storage, or a removal is ignored
  A.listeners.storage({ key: 'other', newValue: '{}', storageArea: A.win.localStorage });
  A.listeners.storage({ key: KEY, newValue: null, storageArea: A.win.localStorage });
  assert.equal(b.copies().length, 0);
});

test('only the newest three lost edits are kept, and a full browser is said plainly', async () => {
  const b = browser({ withLocks: false }), A = b.tab('A');
  A.store.start();
  for (let i = 1; i <= 5; i++) {
    A.store.save({ characters: [{ id: 'lost-' + i }] });
    A.listeners.storage({ key: KEY, newValue: JSON.stringify({ characters: [{ id: 'theirs-' + i }] }), storageArea: A.win.localStorage });
  }
  const kept = b.copies().map(k => JSON.parse(b.data.get(k)).characters[0].id).sort();
  assert.deepEqual(kept, ['lost-3', 'lost-4', 'lost-5']);
  // no room: the message says that nothing could be kept
  const full = browser({ withLocks: false, quota: k => k.startsWith(OTHER) }), F = full.tab('F');
  F.store.start();
  F.store.save({ characters: [{ id: 'x' }] });
  F.listeners.storage({ key: KEY, newValue: JSON.stringify({ characters: [] }), storageArea: F.win.localStorage });
  assert.deepEqual(plain(F.store.notice()), { kind: 'other-tab', id: '', pushed: false });
  assert.match(F.status.innerHTML, /не хватает места/); assert.doesNotMatch(F.status.innerHTML, /download-notice/);
});

test('the first tab writes; the second only shows the data and offers «Открыть здесь»', { timeout: 8000 }, async () => {
  const b = browser(), A = b.tab('A'), B = b.tab('B');
  A.store.start(); await tick();
  B.store.start(); await tick();
  B.runTimers(); await tick(); await tick();
  assert.equal(A.store.canEdit(), true); assert.equal(A.store.getScope(), 'local'); assert.equal(A.store.isFollower(), false);
  assert.equal(B.store.isFollower(), true); assert.equal(B.store.canEdit(), false); assert.equal(B.store.getScope(), null);
  assert.deepEqual(plain(B.calls.scope), ['local', null], 'modules are told the tab cannot edit');
  assert.deepEqual(plain(await B.store.save({ characters: [{ id: 'nope' }] })), { ok: false, reason: 'follower' });
  assert.equal(b.data.has(KEY), false, 'a follower writes nothing');
  assert.match(B.store.stateLabel(), /ТОЛЬКО ПРОСМОТР/);
  assert.equal(B.status.hidden, false); assert.match(B.status.innerHTML, /data-store-action="take-over"/); assert.match(B.status.innerHTML, />Открыть здесь</);
  assert.equal(B.app.inert, false, 'the data can still be read');
  // the writing tab saves; the follower shows it
  A.store.save({ characters: [{ id: 'from-A' }] }); A.store.flush();
  assert.deepEqual(plain(B.calls.apply.at(-1)), { characters: [{ id: 'from-A' }] });
  assert.equal(b.copies().length, 0, 'a follower has nothing pending, so nothing is set aside');
});

test('when the writing tab goes away the waiting tab takes over and starts from what was saved', { timeout: 8000 }, async () => {
  const b = browser(), A = b.tab('A'), B = b.tab('B');
  A.store.start(); await tick(); B.store.start(); await tick(); B.runTimers(); await tick(); await tick();
  A.store.save({ characters: [{ id: 'last' }] }); A.store.flush();
  const before = B.calls.apply.length;
  b.locks.release('nightcity-red-writer-v1'); // tab A is closed
  await tick(); await tick();
  assert.equal(B.store.isFollower(), false); assert.equal(B.store.canEdit(), true); assert.equal(B.store.getScope(), 'local');
  assert.equal(B.calls.scope.at(-1), 'local');
  assert.equal(B.status.hidden, true, 'the banner goes away');
  assert.ok(B.focused.length > 0, 'focus is put somewhere: the button that went away must not drop it to the page');
  const saved = B.store.save({ characters: [{ id: 'B-now' }] }); B.store.flush();
  assert.deepEqual(plain(await saved), { ok: true });
  assert.equal(JSON.parse(b.data.get(KEY)).characters[0].id, 'B-now');
  assert.ok(B.calls.apply.length >= before, 'what the other tab saved is read before editing');
});

test('«Открыть здесь» takes the lock; the other tab becomes view only and loses nothing', { timeout: 8000 }, async () => {
  const b = browser(), A = b.tab('A'), B = b.tab('B');
  A.store.start(); await tick(); B.store.start(); await tick(); B.runTimers(); await tick(); await tick();
  assert.equal(B.store.isFollower(), true);
  const queuedEdit = A.store.save({ characters: [{ id: 'A-unsaved' }] });
  B.click('take-over');
  await tick(); await tick(); await tick();
  assert.equal(B.store.isFollower(), false); assert.equal(B.store.canEdit(), true);
  assert.equal(A.store.isFollower(), true); assert.equal(A.store.canEdit(), false); assert.equal(A.store.getScope(), null);
  assert.deepEqual(plain(await queuedEdit), { ok: true }, 'the edit that was queued in the tab that gave way is written before it stops');
  assert.match(A.status.innerHTML, /Открыть здесь/);
  assert.equal(b.data.has(KEY), true);
  // and back again
  A.click('take-over'); await tick(); await tick(); await tick();
  assert.equal(A.store.canEdit(), true); assert.equal(B.store.canEdit(), false);
});

test('without Web Locks nothing about editing changes', async () => {
  const b = browser({ withLocks: false }), A = b.tab('A'), B = b.tab('B');
  A.store.start(); B.store.start(); await tick(); B.runTimers(); await tick();
  assert.equal(A.store.canEdit(), true); assert.equal(B.store.canEdit(), true); assert.equal(B.store.isFollower(), false);
  assert.deepEqual(plain(B.calls.scope), ['local']);
  assert.match(A.store.stateLabel(), /СОХРАНЕНО/);
  B.click('take-over'); assert.equal(B.store.canEdit(), true);
});

test('the module and its texts: both languages, formal Russian, the set-aside kind is part of the public API', () => {
  const b = browser(), A = b.tab('A');
  assert.equal(A.LocalStore.OTHER_TAB_KEY, OTHER); assert.equal(A.LocalStore.LOCK_NAME, 'nightcity-red-writer-v1');
  assert.doesNotMatch(code, /\bтвой\b|\bтебе\b|\bтвоя\b/i);
  assert.equal(code.includes('\r'), false, 'LF line endings');
});

test('an edit accepted before the tab learned it is not the writer is set aside and said, not dropped', { timeout: 8000 }, async () => {
  const b = browser(), A = b.tab('A'), B = b.tab('B');
  A.store.start(); await tick();
  B.store.start(); await tick();
  const answer = B.store.save({ characters: [{ id: 'early-edit' }] });
  B.timers[0](); // the second lock request runs now and finds the lock taken
  assert.deepEqual(plain(await answer), { ok: false, reason: 'follower' });
  await tick();
  const copies = b.copies();
  assert.equal(copies.length, 1, 'the early edit is kept');
  assert.equal(JSON.parse(b.data.get(copies[0])).characters[0].id, 'early-edit');
  assert.match(B.status.innerHTML, /Изменено в другой вкладке/);
  assert.equal(b.data.has(KEY), false, 'nothing was written by the follower');
});

test('losing a third copy tells the person that the oldest one was removed', { timeout: 8000 }, async () => {
  const b = browser({ withLocks: false }), A = b.tab('A');
  A.store.start();
  for (let i = 1; i <= 4; i++) {
    A.store.save({ characters: [{ id: 'lost-' + i }] });
    A.listeners.storage({ key: KEY, newValue: JSON.stringify({ characters: [{ id: 'theirs-' + i }] }), storageArea: A.win.localStorage });
    if (i < 4) assert.equal(A.store.notice().pushed, false, 'nothing removed while there is room');
  }
  assert.equal(A.store.notice().pushed, true);
  assert.match(A.status.innerHTML, /Самая старая/);
});

test('the shared limit of set-aside copies (unreadable data) stays at five', { timeout: 8000 }, () => {
  assert.match(code, /MAX_COPIES=5,/);
  const b = browser({ withLocks: false });
  for (let i = 1; i <= 7; i++) {
    b.data.set(KEY, 'not json ' + i);
    const T = b.tab('T' + i, {});
    // each start finds different unreadable data; at most five are kept
    const store = T.LocalStore.create({ app: T.app, status: T.status, language: () => 'ru', validate: () => true, apply() {}, initialIssue: { kind: 'unreadable', raw: 'not json ' + i } });
    store.start();
  }
  const kept = [...b.data.keys()].filter(k => k.includes(':recovery:'));
  assert.equal(kept.length, 5);
});

test('erase in one tab: the other tab stops writing, says so, and the erased data never comes back', async () => {
  const b = browser(), A = b.tab('A'), B = b.tab('B');
  A.store.start(); B.store.start(); await tick();
  A.store.save({ characters: [{ id: 'x' }] }); A.runTimers();
  assert.ok(b.data.has(KEY));
  // tab B (a follower here) has the archive in memory; tab A erases it the way the settings page does
  b.data.delete(KEY);
  for (const t of [B]) t.listeners.storage({ key: KEY, newValue: null, storageArea: t.win.localStorage });
  assert.equal(B.store.isErased(), true);
  assert.equal(B.store.canEdit(), false);
  assert.match(B.status.innerHTML, /Данные стёрты в другой вкладке — обновите страницу/);
  assert.match(B.status.innerHTML, /data-store-action="reload"/);
  assert.equal(B.app.inert, true);
  assert.equal(B.focused.includes('status button'), true, 'focus moves to the reload button, not to the body');
  const r = await B.store.save({ characters: [{ id: 'back' }] });
  assert.deepEqual(plain(r), { ok: false, reason: 'erased' });
  B.runTimers(); B.store.flush();
  assert.equal(b.data.has(KEY), false, 'nothing was written back');
  // the leader tab itself (it still holds the data in memory) does not write after the key is gone either
  const w = A.store.save({ characters: [{ id: 'again' }] }); A.runTimers();
  assert.deepEqual(plain(await w), { ok: false, reason: 'erased' });
  assert.equal(b.data.has(KEY), false);
  assert.match(A.status.innerHTML, /стёрты/);
});

test('English message, clear() event, and a later write from the other tab does not revive the erased tab', async () => {
  const b = browser(), A = b.tab('A', { lang: 'en' });
  A.store.start(); await tick();
  A.store.save({ characters: [] }); A.runTimers();
  A.listeners.storage({ key: null, newValue: null, storageArea: A.win.localStorage });
  assert.match(A.status.innerHTML, /Data was erased in another tab — reload the page/);
  assert.equal(A.store.stateLabel(), 'DATA ERASED');
  A.listeners.storage({ key: KEY, newValue: JSON.stringify({ characters: [{ id: 'z' }] }), storageArea: A.win.localStorage });
  assert.equal(A.calls.apply.length, 0, 'an erased tab does not apply other data');
});

test('a tab that opened with an archive does not write once the archive is gone, even without the storage event', async () => {
  const b = browser();
  b.data.set(KEY, JSON.stringify({ characters: [] }));
  const A = b.tab('A');
  A.store.start(); await tick();
  b.data.delete(KEY);
  const w = A.store.save({ characters: [{ id: 'ghost' }] }); A.runTimers();
  assert.deepEqual(plain(await w), { ok: false, reason: 'erased' });
  assert.equal(b.data.has(KEY), false);
});

test('a brand new browser (no archive yet) still saves normally', async () => {
  const b = browser(), A = b.tab('A');
  A.store.start(); await tick();
  const w = A.store.save({ characters: [] }); A.runTimers();
  assert.equal((await w).ok, true);
  assert.ok(b.data.has(KEY));
});
