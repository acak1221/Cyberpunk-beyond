// The role question, asked once in a small dialog (site/role-mode.js firstRun) instead of a permanent card;
// and the one-line tour banner of the first launch (site/onboarding.js banner / tour).
const { test } = require('node:test'), assert = require('node:assert/strict'), fs = require('node:fs'), vm = require('node:vm');
const { load, key } = require('./dialog-dom.cjs');
const eq = (a, b) => assert.deepStrictEqual(JSON.parse(JSON.stringify(a)), JSON.parse(JSON.stringify(b)));

function setup({ role, asked } = {}) {
  const store = new Map(); if (role) store.set('nc-role', role); if (asked) store.set('nc-pref-role-asked', 'true');
  const localStorage = { getItem: k => store.has(k) ? store.get(k) : null, setItem: (k, v) => store.set(k, String(v)), removeItem: k => store.delete(k), get length() { return store.size; }, key: i => [...store.keys()][i] };
  const h = load(['ui-memory.js', 'role-mode.js'], { localStorage }), { doc, win } = h, renders = [];
  const appEl = doc.el('div'), main = doc.el('div'), opener = doc.el('button'); opener.isConnected = true;
  doc.queries['#app'] = appEl; doc.queries['#main-content'] = main;
  win.App = { render: () => renders.push(1), lang: () => 'ru' };
  const make = doc.createElement;
  doc.createElement = tag => { const e = make(tag); let first = null, all = []; Object.defineProperty(e, 'innerHTML', { get() { return this._html; }, set(v) { this._html = v; first = doc.el('button'); all = [first, doc.el('button'), doc.el('button')]; e.queries['[data-role-set]'] = first; e.queries['button:not([disabled]),[href],input:not([disabled]),select:not([disabled]),[tabindex]:not([tabindex="-1"])'] = all; all.forEach(x => { x.parent = e; }); } }); return e; };
  return { ...h, store, renders, appEl, main, opener, R: win.RoleMode, dlg: () => doc.all.find(x => x.className === 'role-first-run' && x.isConnected) };
}

test('firstRun: a modal dialog with a name, the page behind inert, the focus on the first answer', () => {
  const s = setup(); s.doc.activeElement = s.opener;
  assert.equal(s.R.firstRun('ru'), true); const d = s.dlg();
  assert.equal(d.attrs.role, 'dialog'); assert.equal(d.attrs['aria-modal'], 'true'); assert.equal(d.attrs['aria-labelledby'], 'role-first-title');
  assert.match(d.innerHTML, /<h2 id="role-first-title">Кто вы за столом\?<\/h2>/); assert.match(d.innerHTML, /data-role-set="player"/); assert.match(d.innerHTML, /data-role-set="gm"/); assert.match(d.innerHTML, /data-role-later>Решу позже/);
  assert.equal(s.appEl.inert, true); assert.ok(s.doc.activeElement && d.contains(s.doc.activeElement));
  assert.equal(s.R.firstRun('ru'), false, 'one dialog at a time');
});

test('firstRun asks once: not when a role is chosen, not after «Later», not twice', () => {
  assert.equal(setup({ role: 'gm' }).R.firstRun('ru'), false); assert.equal(setup({ role: 'player' }).R.firstRun('ru'), false);
  assert.equal(setup({ asked: true }).R.firstRun('ru'), false);
  const s = setup(); s.R.firstRun('ru'); s.doc.fire('click', { target: { closest: q => q === '[data-role-later]' ? {} : null } });
  assert.equal(s.dlg(), undefined); assert.equal(s.store.get('nc-pref-role-asked'), 'true'); assert.equal(s.store.has('nc-role'), false, '«Later» chooses no role');
  assert.equal(s.appEl.inert, false); assert.equal(s.R.firstRun('ru'), false);
});

test('an answer sets the role, closes the dialog, redraws the page and puts the focus on the content', () => {
  const s = setup(); s.R.firstRun('en'); assert.match(s.dlg().innerHTML, /Who are you at the table\?/); assert.match(s.dlg().innerHTML, /Decide later/);
  const btn = { dataset: { roleSet: 'gm' }, closest: q => q.includes('.role-first-run') ? {} : null };
  s.doc.fire('click', { target: { closest: q => q === '[data-role-set]' ? btn : null } });
  assert.equal(s.store.get('nc-role'), 'gm'); assert.equal(s.dlg(), undefined); assert.equal(s.appEl.inert, false); assert.equal(s.renders.length, 1); assert.equal(s.doc.activeElement, s.main);
});

test('Escape means «Later»; Tab stays inside the dialog', () => {
  const s = setup(); s.R.firstRun('ru'); const d = s.dlg(), items = d.queries['button:not([disabled]),[href],input:not([disabled]),select:not([disabled]),[tabindex]:not([tabindex="-1"])'];
  s.doc.activeElement = items[2]; const t = key('Tab'); s.doc.fire('keydown', t); assert.equal(s.doc.activeElement, items[0]); assert.equal(t.prevented, 1);
  s.doc.activeElement = items[0]; const u = key('Tab', { shiftKey: true }); s.doc.fire('keydown', u); assert.equal(s.doc.activeElement, items[2]);
  s.doc.activeElement = s.opener; const out = key('Tab'); s.doc.fire('keydown', out); assert.equal(s.doc.activeElement, items[0]);
  const esc = key('Escape'); s.doc.fire('keydown', esc); assert.equal(esc.prevented, 1); assert.equal(s.dlg(), undefined); assert.equal(s.store.get('nc-pref-role-asked'), 'true');
  const free = key('Escape'); s.doc.fire('keydown', free); assert.equal(free.prevented, 0);
});

test('the chooser card is still there for the code that asks for it, the bottom bar has Home and the GM keeps its three', () => {
  const R = setup().R;
  assert.match(R.chooser('ru'), /role-chooser/);
  eq(R.bottom(['overview', 'characters', 'combat', 'dice']), ['overview', 'characters', 'combat', 'dice']);
  const gm = setup({ role: 'gm' }).R; eq(gm.bottom(['x']), ['overview', 'campaigns', 'room', 'gm']);
  assert.equal(R.firstRunHTML('ru').includes('role-first-box'), true);
});

test('the dialog styles: 48 px answers, a dark backdrop, LF', () => {
  const css = fs.readFileSync(__dirname + '/../site/role-mode.css', 'utf8');
  assert.match(css, /\.role-first-actions \.btn,\.role-first-later\{min-height:48px\}/); assert.match(css, /\.role-first-run\{[^}]*position:fixed;inset:0/); assert.equal(css.includes('\r'), false);
});

// ---- the tour banner ----
function tour({ characters = [], campaigns = [], lang = 'ru', stored } = {}) {
  const storage = new Map(stored ? [['nc-onboarding', stored]] : []), state = { lang, characters, campaigns };
  const window = { GMTools: { NPC_TEMPLATES: [] }, App: { getState: () => state, render() {}, notify() {}, save() {} } };
  vm.runInNewContext(fs.readFileSync(__dirname + '/../site/onboarding.js', 'utf8'), { window, localStorage: { getItem: k => storage.has(k) ? storage.get(k) : null, setItem: (k, v) => storage.set(k, String(v)) }, confirm: () => true, Math, Date, globalThis: { crypto: { randomUUID: () => 'id' } } });
  return { O: window.Onboarding, state, storage, click: a => window.Onboarding.handle({ type: 'click', target: { closest: s => s === '[data-ob]' ? { dataset: { ob: a }, closest: () => null } : null } }) };
}

test('banner: on a truly empty app one line with «Start» and «Hide»; nothing for a returning player or after it was dismissed', () => {
  const t = tour(), html = t.O.banner(t.state);
  assert.match(html, /class="ob-banner" role="note" data-ob-banner/); assert.match(html, /Впервые здесь\?/); assert.match(html, /data-ob="reopen"/); assert.match(html, /data-ob="skip"/);
  assert.equal((html.match(/<button/g) || []).length, 2); assert.equal(html.includes('ob-card'), false, 'a line, not the card');
  assert.match(tour({ lang: 'en' }).O.banner({ lang: 'en', characters: [], campaigns: [] }), /New here\?/);
  assert.equal(tour({ characters: [{ id: 'c' }] }).O.banner({ characters: [{ id: 'c' }], campaigns: [], lang: 'ru' }), '');
  assert.equal(tour({ campaigns: [{ id: 'k' }] }).O.banner({ characters: [], campaigns: [{ id: 'k' }], lang: 'ru' }), '');
  const d = tour(); d.click('skip'); assert.equal(d.O.banner(d.state), ''); assert.equal(d.O.tour(d.state), '');
});

test('tour: the banner until the introduction is asked for, then the full card; skipping closes both', () => {
  const t = tour();
  assert.match(t.O.tour(t.state), /data-ob-banner/); assert.equal(t.O.tour(t.state).includes('data-ob-intro'), false);
  t.click('reopen'); const html = t.O.tour(t.state);
  assert.match(html, /data-ob-intro/); assert.equal(html.includes('data-ob-banner'), false); assert.equal(t.O.banner(t.state), '', 'no banner while the card is open');
  t.click('skip'); assert.equal(t.O.tour(t.state), '');
  const r = tour({ characters: [{ id: 'c' }] }); r.click('reopen'); assert.match(r.O.tour(r.state), /data-ob-intro/, 'a returning player can still ask for it');
});

test('the old introduction() still opens by itself on an empty app (kept for the code that calls it)', () => {
  const t = tour(); assert.match(t.O.intro(t.state), /data-ob-intro/);
});

test('skip() counts as answered without showing anything', () => {
  const s = setup(); assert.equal(s.R.asked(), false); s.R.skip(); assert.equal(s.R.asked(), true); assert.equal(s.R.firstRun('ru'), false); assert.equal(s.dlg(), undefined);
});
