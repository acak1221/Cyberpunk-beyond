// The reader remembers the person's own PDF and the text of its pages on this device — only after an opt-in, with the size shown,
// «Забыть книгу», and the book opening again on the last page. Nothing is sent anywhere.
const { test } = require('node:test'), assert = require('node:assert/strict'), fs = require('node:fs'), vm = require('node:vm'), path = require('node:path');
const read = f => fs.readFileSync(path.join(__dirname, '..', 'site', f), 'utf8');
const plain = x => JSON.parse(JSON.stringify(x));
const tick = () => new Promise(r => setTimeout(r, 3));
const until = async (f, what = 'condition') => { for (let i = 0; i < 1500; i++) { if (await f()) return; await new Promise(r => setTimeout(r, 2)); } assert.fail('timed out: ' + what); };

// The part of IndexedDB the module uses, with a store that survives "reloads" (a new page gets the same data).
function fakeIndexedDB({ failPut = null } = {}) {
  const stores = new Map(); // db name -> Map(key -> value)
  const log = [];
  return {
    log, stores,
    open(name) {
      const req = {};
      queueMicrotask(() => {
        const fresh = !stores.has(name); if (fresh) stores.set(name, new Map());
        const data = stores.get(name), db = {
          createObjectStore() { req.upgraded = true; },
          transaction(storeName, mode) {
            const t = { oncomplete: null, onerror: null, onabort: null, error: null };
            const objectStore = {
              get: k => { const r = { result: undefined }; log.push(['get', k]); queueMicrotask(() => { r.result = data.get(k); }); return r; },
              put: (v, k) => { if (failPut && failPut(k, v)) { queueMicrotask(() => { t.error = Object.assign(new Error('full'), { name: 'QuotaExceededError' }); t.onabort?.(); }); return {}; } const r = { result: k }; log.push(['put', k]); data.set(k, v); return r; },
              delete: k => { log.push(['delete', k]); data.delete(k); return {}; },
              clear: () => { log.push(['clear']); data.clear(); return {}; },
            };
            setTimeout(() => t.oncomplete?.(), 0);
            return Object.assign(t, { objectStore: () => objectStore });
          },
          close() {},
        };
        req.result = db; if (fresh) req.onupgradeneeded?.(); req.onsuccess?.();
      });
      return req;
    },
    deleteDatabase(name) { stores.delete(name); const r = {}; queueMicrotask(() => r.onsuccess?.()); return r; },
  };
}
class FakeBlob { constructor(parts, opts = {}) { this.size = parts.reduce((n, p) => n + (p.size ?? p.length ?? 0), 0); this.type = opts.type || ''; this.parts = parts; } async arrayBuffer() { return new ArrayBuffer(1); } }
const pdf = (size = 5 * 1048576, name = 'Corebook.pdf') => Object.assign(new FakeBlob([{ size }], { type: 'application/pdf' }), { name });
const pages = n => Array.from({ length: n }, (_, i) => ({ page: i + 1, text: 'Text of page ' + (i + 1) }));

function loadMemory({ idb, storage, withIdb = true } = {}) {
  const local = new Map(), window = { localStorage: { getItem: k => local.has(k) ? local.get(k) : null, setItem: (k, v) => local.set(k, String(v)), removeItem: k => local.delete(k) }, ...(withIdb ? { indexedDB: idb } : {}), navigator: { storage } };
  vm.runInNewContext(read('book-memory.js'), { window, Math, Number, String, Array, Object, Promise, Error, JSON, Date, Blob: FakeBlob, queueMicrotask, setTimeout });
  return { BM: window.BookMemory, window, local };
}

test('sizes are shown in plain units, in the language of the page', () => {
  const { BM } = loadMemory({ idb: fakeIndexedDB() });
  assert.equal(BM.formatSize(0, 'ru'), '0 КБ'); assert.equal(BM.formatSize(-5, 'ru'), '0 КБ'); assert.equal(BM.formatSize(NaN, 'ru'), '0 КБ');
  assert.equal(BM.formatSize(300, 'ru'), '1 КБ'); assert.equal(BM.formatSize(204800, 'ru'), '200 КБ');
  assert.equal(BM.formatSize(1572864, 'ru'), '1,5 МБ'); assert.equal(BM.formatSize(1572864, 'en'), '1.5 MB');
  assert.equal(BM.formatSize(5 * 1048576, 'en'), '5 MB'); assert.equal(BM.formatSize(84.4 * 1048576, 'ru'), '84,4 МБ'); assert.equal(BM.formatSize(120.6 * 1048576, 'ru'), '121 МБ');
  assert.equal(BM.clampPage(0), 1); assert.equal(BM.clampPage(9999), 457); assert.equal(BM.clampPage('222'), 222); assert.equal(BM.clampPage('x'), 1);
});

test('the text of pages is checked before it is stored or used', () => {
  const { BM } = loadMemory({ idb: fakeIndexedDB() });
  assert.deepEqual(plain(BM.validIndex(pages(3))), pages(3));
  assert.deepEqual(plain(BM.validIndex([{ page: 1, text: 'a', extra: 'dropped' }])), [{ page: 1, text: 'a' }]);
  for (const bad of [null, [], 'x', {}, [{ page: 0, text: 'a' }], [{ page: 1.5, text: 'a' }], [{ page: 1, text: 5 }], [{ page: 2, text: 'a' }, { page: 1, text: 'b' }], [{ page: 1, text: 'a' }, { page: 1, text: 'b' }], [null], [{ page: 1001, text: 'a' }], [{ page: 1, text: 'x'.repeat(200001) }]])
    assert.equal(BM.validIndex(bad), null, JSON.stringify(bad)?.slice(0, 40));
  assert.equal(BM.validIndex(Array.from({ length: 1001 }, (_, i) => ({ page: i + 1, text: '' }))), null, 'a thousand pages at most');
});

test('nothing is stored until the person opts in; the flag is a plain switch', () => {
  const { BM, local } = loadMemory({ idb: fakeIndexedDB() });
  assert.equal(BM.optedIn(), false);
  assert.equal(BM.setOptIn(true), true); assert.equal(BM.optedIn(), true); assert.equal(local.get('nightcity-red-book-keep-v1'), '1');
  BM.setOptIn(false); assert.equal(BM.optedIn(), false); assert.equal(local.has('nightcity-red-book-keep-v1'), false);
  const broken = { localStorage: { getItem() { throw Error('blocked'); }, setItem() { throw Error('blocked'); }, removeItem() { throw Error('blocked'); } } };
  assert.equal(BM.optedIn(broken.localStorage), false); assert.equal(BM.setOptIn(true, broken.localStorage), false);
});

test('the file, the page text and the last page are stored, read back, measured and forgotten', async () => {
  const idb = fakeIndexedDB(), { BM } = loadMemory({ idb });
  assert.equal(await BM.load(), null); assert.equal(await BM.info(), null);
  const file = pdf(84 * 1048576);
  assert.deepEqual(plain(await BM.save(file)), { ok: true, size: 84 * 1048576 });
  assert.deepEqual(plain(await BM.saveIndex(pages(3))), { ok: true, chars: 'Text of page 1'.length * 3 - 0 });
  assert.equal(await BM.savePage(222), true);
  const info = await BM.info();
  assert.deepEqual(plain({ ...info, at: 0 }), { name: 'Corebook.pdf', size: 84 * 1048576, indexChars: 42, page: 222, at: 0 });
  const rec = await BM.load();
  assert.equal(rec.blob, file); assert.equal(rec.name, 'Corebook.pdf'); assert.equal(rec.page, 222); assert.deepEqual(plain(rec.index), pages(3));
  // a different book replaces the first and its text, and opens on page 1
  const other = pdf(10 * 1048576, 'Other.pdf'); await BM.save(other);
  const again = await BM.load(); assert.equal(again.name, 'Other.pdf'); assert.equal(again.index, null, 'the text of the old book does not belong to the new one'); assert.equal(again.page, 1);
  // text without a stored book is refused
  await BM.forget(); assert.equal(await BM.load(), null); assert.equal(await BM.info(), null);
  assert.deepEqual(plain(await BM.saveIndex(pages(2))), { ok: false, reason: 'nofile' });
  assert.ok(idb.log.some(e => e[0] === 'clear'));
});

test('what cannot be stored is said plainly: too big, no room, the browser refuses, junk', async () => {
  let idb = fakeIndexedDB(), { BM } = loadMemory({ idb });
  assert.deepEqual(plain(await BM.save(pdf(401 * 1048576))), { ok: false, reason: 'big' });
  assert.deepEqual(plain(await BM.save(null)), { ok: false, reason: 'error' }); assert.deepEqual(plain(await BM.save({ size: 0 })), { ok: false, reason: 'error' });
  assert.deepEqual(plain(await BM.save(pdf(50 * 1048576), { storage: { estimate: async () => ({ quota: 60 * 1048576, usage: 20 * 1048576 }) } })), { ok: false, reason: 'quota' }, 'the browser says there is not enough room');
  assert.equal((await BM.save(pdf(50 * 1048576), { storage: { estimate: async () => { throw Error('no'); } } })).ok, true, 'an estimate that fails does not block saving');
  idb = fakeIndexedDB({ failPut: k => k === 'file' }); BM = loadMemory({ idb }).BM;
  assert.deepEqual(plain(await BM.save(pdf())), { ok: false, reason: 'quota' });
  BM = loadMemory({ withIdb: false }).BM;
  assert.equal(BM.supported(), false); assert.deepEqual(plain(await BM.save(pdf())), { ok: false, reason: 'error' }); assert.equal(await BM.load(), null); assert.equal(await BM.forget(), false);
  // a damaged record is not a book
  idb = fakeIndexedDB(); BM = loadMemory({ idb }).BM; await BM.save(pdf());
  idb.stores.get('nightcity-red-book').set('file', { blob: 'text', name: 5 }); assert.equal(await BM.load(), null);
  idb.stores.get('nightcity-red-book').set('file', { blob: { size: -1 } }); assert.equal(await BM.load(), null);
  idb.stores.get('nightcity-red-book').set('file', { blob: pdf(), name: 'x' }); idb.stores.get('nightcity-red-book').set('index', { pages: [{ page: 'a', text: 1 }], chars: 5 });
  assert.equal((await BM.load()).index, null, 'a damaged text index is not used; the book still opens');
});

test('the card shows the switch, the size, what it is for and «Забыть книгу»', () => {
  const { BM } = loadMemory({ idb: fakeIndexedDB() });
  let html = BM.card({ remember: false, info: null, supported: true, lang: 'ru', note: '' });
  assert.match(html, /<input type="checkbox" id="book-keep">/); assert.match(html, /Помнить мою книгу на этом устройстве/); assert.match(html, /никуда не отправляются/); assert.doesNotMatch(html, /Забыть книгу/);
  html = BM.card({ remember: true, info: { size: 84 * 1048576, indexChars: 1200000, page: 222 }, supported: true, lang: 'ru', note: 'Книга сохранена на этом устройстве' });
  assert.match(html, /id="book-keep" checked/); assert.match(html, /<b>85,1 МБ<\/b> \(файл 84 МБ \+ текст для поиска 1,1 МБ\)/); assert.match(html, /последняя страница 222/);
  assert.match(html, /data-book-action="forget"[^>]*>Забыть книгу/); assert.match(html, /role="status" aria-live="polite">Книга сохранена/);
  const en = BM.card({ remember: true, info: { size: 5 * 1048576, indexChars: 0, page: 1 }, supported: true, lang: 'en', note: '' });
  assert.match(en, /Remember my book on this device/); assert.match(en, />Forget the book</); assert.match(en, /Used on this device/); assert.doesNotMatch(en, /[А-Яа-я]/);
  assert.match(BM.card({ remember: true, info: null, supported: true, lang: 'ru' }), /Пока ничего не сохранено/);
  const off = BM.card({ remember: false, info: null, supported: false, lang: 'ru' }); assert.match(off, /disabled/); assert.match(off, /не позволяет хранить файл/);
  assert.match(BM.card({ remember: true, info: { size: 1, indexChars: 0, page: 1 }, supported: true, lang: 'ru', note: '<script>x</script>' }), /&lt;script&gt;/);
  assert.deepEqual(Object.keys(BM.TEXT.ru).sort(), Object.keys(BM.TEXT.en).sort());
  assert.doesNotMatch(Object.values(BM.TEXT.ru).join(' '), /\bты\b|\bтвой|\bтебе\b/i);
});

// The book screen with the real book.js, book-search.js and book-memory.js on one fake browser.
function loadBook({ idb, local = new Map(), confirmAnswer = true } = {}) {
  const nodes = {}, calls = { render: 0, confirm: 0, focus: [], revoked: [], urls: [], loads: 0 };
  const url = { createObjectURL: b => { calls.urls.push(b); return 'blob:book-' + calls.urls.length; }, revokeObjectURL: u => calls.revoked.push(u) };
  const document = { querySelector: s => nodes[s] || null, documentElement: { lang: 'ru' } };
  const window = { localStorage: { getItem: k => local.has(k) ? local.get(k) : null, setItem: (k, v) => local.set(k, String(v)), removeItem: k => local.delete(k) }, indexedDB: idb, navigator: {}, App: { render() { calls.render++; } } };
  const ctx = { window, document, URL: url, Blob: FakeBlob, confirm: () => { calls.confirm++; return confirmAnswer; }, queueMicrotask, setTimeout, Promise, Math, Number, String, Array, Object, JSON, Date, Error, Map, Set, Uint8Array, fetch: async () => ({ ok: false }) };
  ctx.loader = async () => { calls.loads++; return { promise: Promise.resolve({ numPages: 4, getPage: async n => ({ getTextContent: async () => ({ items: [{ str: 'Read page ' + (n - 1) }] }), cleanup() {} }) }), destroy() {} }; };
  for (const f of ['book-memory.js', 'book-toc.js', 'book-search.js', 'book.js']) vm.runInNewContext(f === 'book-search.js' ? read(f).replace('const engine=create();', 'const engine=create(loader);') : read(f), ctx);
  const notices = [];
  const showKeep = () => { nodes['#book-keep'] = { id: 'book-keep', focus() { calls.focus.push('book-keep'); } }; nodes['[data-book-memory]'] = {}; nodes['#book-page'] = { value: '1' }; };
  const search = text => { const field = { value: text, isConnected: true, matches: x => x === '[data-bs-query]', closest: () => ({ isConnected: true }) }; return window.BookSearch.handle({ type: 'keydown', key: 'Enter', target: field, preventDefault() {} }, 'ru'); };
  const change = (id, extra = {}) => window.Book.handle({ type: 'change', target: { id, closest: () => null, ...extra } }, 'ru', () => { calls.render++; showKeep(); }, m => notices.push(m));
  const click = action => window.Book.handle({ type: 'click', target: { id: '', closest: sel => sel === `[data-book-action="${action}"]` ? { dataset: {} } : null } }, 'ru', () => { calls.render++; showKeep(); }, m => notices.push(m));
  return { search, window, B: window.Book, BM: window.BookMemory, BS: window.BookSearch, local, calls, notices, nodes, showKeep, change, click, chooseFile: file => change('book-file', { files: [file] }) };
}

test('book screen: without the opt-in nothing is stored and a reload starts empty', async () => {
  const idb = fakeIndexedDB(), h = loadBook({ idb });
  const html = h.B.render('ru'); h.showKeep();
  assert.match(html, /data-book-memory/); assert.match(html, /id="book-keep">/); assert.match(html, /выбрать снова — или включите ниже/);
  h.chooseFile(pdf()); await tick(); await tick();
  assert.equal(idb.stores.size, 0, 'no database was even opened');
  assert.equal(h.B._test.state().filename, 'Corebook.pdf');
  const next = loadBook({ idb, local: h.local });
  next.B.render('ru'); await tick(); await tick();
  assert.equal(next.B._test.state().fileUrl, '');
});

test('book screen: opting in with a book open saves it; the page text and the last page follow; a reload opens the same book on the same page without reading it again', async () => {
  const idb = fakeIndexedDB(), h = loadBook({ idb });
  h.B.render('ru'); h.showKeep();
  h.chooseFile(pdf(84 * 1048576)); // opened, not yet remembered
  assert.equal(idb.stores.size, 0);
  h.change('book-keep', { checked: true });
  assert.equal(h.local.get('nightcity-red-book-keep-v1'), '1'); assert.equal(h.calls.focus.at(-1), 'book-keep', 'focus stays on the switch');
  await until(() => h.B._test.state().memInfo?.size === 84 * 1048576, 'the book is stored');
  assert.match(h.B._test.state().note, /Книга сохранена на этом устройстве/);
  assert.match(h.B.render('ru'), /Занято на устройстве: <b>84 МБ<\/b>/);
  // the first search reads the book once; the text of the pages is kept
  h.search('read'); await until(async () => (await h.BM.info())?.indexChars > 0, 'the page text is stored');
  assert.equal(h.calls.loads, 1);
  assert.deepEqual(plain((await h.BM.load()).index), [{ page: 1, text: 'Read page 1' }, { page: 2, text: 'Read page 2' }, { page: 3, text: 'Read page 3' }]);
  assert.match(h.B.render('ru'), /текст для поиска/);
  // going to a page is remembered, by the button and by the contents
  h.nodes['#book-page'].value = '222'; h.click('go'); assert.equal(h.B.getPage(), 222);
  await until(async () => (await h.BM.info()).page === 222, 'the page is stored');
  h.B.go(301); await until(async () => (await h.BM.info()).page === 301, 'the page from the contents is stored');
  // a new page load of the same browser
  const next = loadBook({ idb, local: h.local });
  const first = next.B.render('ru'); next.showKeep();
  assert.match(first, /id="book-keep" checked/);
  await until(() => next.B._test.state().fileUrl !== '', 'the stored book is opened');
  const s = next.B._test.state();
  assert.equal(s.filename, 'Corebook.pdf'); assert.equal(s.page, 301, 'it opens on the last page'); assert.match(s.note, /Открыта сохранённая книга: Corebook\.pdf/);
  assert.ok(next.calls.render >= 1, 'the screen is drawn again when the book arrives');
  assert.match(next.B.render('ru'), /iframe[^>]*src="blob:book-1#page=302"/);
  assert.match(next.B.render('ru'), /сохранена на устройстве и откроется сама/);
  // search has the text already: the PDF is not read a second time
  assert.equal(next.BS.getIndex().length, 3);
  next.search('read'); await tick(); await tick(); await tick();
  assert.equal(next.calls.loads, 0, 'no second reading of the book');
});

test('book screen: a new file replaces the stored book and its text; without the opt-in the text is not stored', async () => {
  const idb = fakeIndexedDB(), h = loadBook({ idb });
  h.B.render('ru'); h.showKeep(); h.chooseFile(pdf(10 * 1048576, 'First.pdf')); h.search('read'); await until(() => h.calls.loads === 1, 'read once'); await tick(); await tick();
  assert.equal(idb.stores.size, 0, 'nothing stored without the opt-in, text included');
  h.change('book-keep', { checked: true }); await until(async () => (await h.BM.info())?.indexChars > 0, 'book and text stored');
  h.chooseFile(pdf(20 * 1048576, 'Second.pdf')); await until(async () => (await h.BM.info())?.name === 'Second.pdf', 'replaced');
  const info = await h.BM.info(); assert.equal(info.indexChars, 0, 'the text of the first book does not stay with the second'); assert.equal((await h.BM.load()).index, null);
  assert.equal(h.BS.getIndex(), null);
});

test('the search engine takes a stored text for its file, and refuses one that is not a list of pages', () => {
  const win = {}, ctx = { window: win, document: { querySelector: () => null, documentElement: { lang: 'ru', dataset: {} } }, Uint8Array, URL, Promise, Map, Set, Object, Array, String, Number, Math, fetch: async () => ({ ok: false }), navigator: {}, setTimeout, Error };
  vm.runInNewContext(read('book-search.js'), ctx);
  const BS = win.BookSearch; assert.equal(BS.getIndex(), null);
  const stored = [{ page: 1, text: 'a' }, { page: 2, text: 'b' }];
  BS.setFile({ arrayBuffer: async () => { throw Error('must not be read'); } }, stored); assert.deepEqual(plain(BS.getIndex()), stored);
  BS.setFile({ arrayBuffer: async () => new ArrayBuffer(1) }, [{ page: 'x' }]); assert.equal(BS.getIndex(), null);
  BS.setFile({ arrayBuffer: async () => new ArrayBuffer(1) }, 'text'); assert.equal(BS.getIndex(), null);
  BS.setFile({ arrayBuffer: async () => new ArrayBuffer(1) }); assert.equal(BS.getIndex(), null);
  assert.equal(typeof BS.setIndexHook, 'function'); BS.setIndexHook('not a function'); BS.setIndexHook(null);
});

test('book screen: «Забыть книгу» removes everything and turns the switch off; the book on screen stays open', async () => {
  const idb = fakeIndexedDB(), h = loadBook({ idb });
  h.local.set('nightcity-red-book-keep-v1', '1'); h.B.render('ru'); h.showKeep();
  h.chooseFile(pdf()); await until(() => h.B._test.state().memInfo, 'stored');
  const asked = loadBook({ idb, local: h.local, confirmAnswer: false }); asked.B.render('ru'); await until(() => asked.B._test.state().fileUrl, 'restored'); asked.showKeep();
  asked.click('forget'); assert.equal(asked.calls.confirm, 1); await tick(); assert.ok(await asked.BM.info(), 'a «no» to the question forgets nothing'); assert.equal(asked.local.get('nightcity-red-book-keep-v1'), '1');
  h.click('forget'); assert.equal(h.calls.confirm, 1);
  await until(() => /удалена/.test(h.B._test.state().note), 'forgotten');
  assert.equal(await h.BM.load(), null); assert.equal(h.local.has('nightcity-red-book-keep-v1'), false); assert.equal(h.B._test.state().remember, false); assert.equal(h.B._test.state().memInfo, null);
  assert.equal(h.B._test.state().filename, 'Corebook.pdf', 'the book that is open stays open'); assert.equal(h.calls.focus.at(-1), 'book-keep', 'focus goes to the switch, not to the page');
  assert.doesNotMatch(h.B.render('ru'), /Забыть книгу/);
  // turning the switch off does the same
  h.change('book-keep', { checked: true }); await until(() => h.B._test.state().memInfo, 'stored again');
  h.change('book-keep', { checked: false }); await until(() => /удалена/.test(h.B._test.state().note), 'forgotten by the switch');
  assert.equal(await h.BM.load(), null); assert.equal(h.local.has('nightcity-red-book-keep-v1'), false);
});

test('book screen: when the device has no room the switch goes back off and says so', async () => {
  const idb = fakeIndexedDB({ failPut: k => k === 'file' }), h = loadBook({ idb });
  h.B.render('ru'); h.showKeep(); h.chooseFile(pdf());
  h.change('book-keep', { checked: true });
  await until(() => /Не удалось сохранить/.test(h.B._test.state().note), 'failure said');
  assert.equal(h.B._test.state().remember, false); assert.equal(h.local.has('nightcity-red-book-keep-v1'), false);
  const big = loadBook({ idb: fakeIndexedDB() }); big.B.render('ru'); big.showKeep(); big.chooseFile(pdf(450 * 1048576)); big.change('book-keep', { checked: true });
  await until(() => /слишком большой/.test(big.B._test.state().note), 'too big said');
});

test('book screen: without IndexedDB or without the module the reader works as before', async () => {
  const h = loadBook({ idb: undefined }); const html = h.B.render('ru');
  assert.match(html, /disabled/); assert.match(html, /не позволяет хранить файл/);
  h.chooseFile(pdf()); assert.equal(h.B._test.state().filename, 'Corebook.pdf');
  // the older contents test builds the reader without the memory module at all
  const w = {}, ctx = { window: w, document: { querySelector: () => null }, URL: { createObjectURL: () => '', revokeObjectURL() {} }, Number, Math, String };
  for (const f of ['book-toc.js', 'book.js']) vm.runInNewContext(read(f), ctx);
  assert.match(w.Book.render('en'), /BOOK CONTENTS/); assert.doesNotMatch(w.Book.render('en'), /data-book-memory/);
});

test('both files are registered, the module before the reader, and the style exists', () => {
  const html = read('index.html'), at = n => html.indexOf('<script src="' + n + '"></script>');
  assert.ok(at('book-memory.js') > -1 && at('book-memory.js') < at('book.js'));
  assert.ok(html.includes('<link rel="stylesheet" href="book-memory.css">')); assert.ok(fs.existsSync(path.join(__dirname, '..', 'site', 'book-memory.css')));
  assert.equal(html.lastIndexOf('<script src="'), html.lastIndexOf('<script src="app.js"></script>'));
  for (const f of ['book-memory.js', 'book.js', 'book-search.js']) assert.equal(read(f).includes('\r'), false, f + ' uses LF');
  assert.doesNotMatch(read('book-memory.js'), /fetch\(|XMLHttpRequest|sendBeacon|WebSocket/, 'nothing leaves the device');
});

test('book screen: when the next book cannot be stored the earlier stored one is erased too, not left behind unseen', async () => {
  const idb = fakeIndexedDB(), h = loadBook({ idb });
  h.B.render('ru'); h.showKeep(); h.chooseFile(pdf()); h.change('book-keep', { checked: true });
  await until(() => idb.stores.get('nightcity-red-book')?.has('file'), 'first book stored');
  await until(() => h.B._test.state().memInfo, 'size known');
  h.chooseFile(pdf(450 * 1048576));
  await until(() => /слишком большой/.test(h.B._test.state().note), 'too big said');
  assert.equal(h.B._test.state().remember, false);
  await until(() => !idb.stores.get('nightcity-red-book')?.has('file'), 'earlier book erased');
});
