// The «More» sheet (site/more-sheet.js): tiles come from the section menu, the dialog traps the focus and gives it back.
const { test } = require('node:test'), assert = require('node:assert/strict'), fs = require('node:fs');
const { load, key } = require('./dialog-dom.cjs');
const eq = (a, b) => assert.deepStrictEqual(JSON.parse(JSON.stringify(a)), JSON.parse(JSON.stringify(b)));

const GROUPS = [
  { label: 'Игра', items: [{ view: 'overview', label: 'Обзор', icon: '<svg></svg>', active: true }, { view: 'dice', label: 'Кубики', icon: '<svg></svg>' }] },
  { label: 'Приложение', items: [{ view: 'news', label: 'Что нового', icon: '', extra: '<span class="wn-dot"></span>' }] },
  { label: 'Пусто', items: [] },
  { label: 'Плохие', items: [{ view: 'Bad View!', label: 'x' }, { view: 'rules', label: '   ' }, null] },
];

test('build: grouped tiles with names, the current one marked, empty groups and bad items dropped, everything escaped', () => {
  const M = load(['more-sheet.js']).win.MoreSheet;
  const html = M.build(GROUPS, { lang: 'ru' });
  assert.match(html, /<h2 id="more-sheet-title">Все разделы<\/h2>/); assert.match(html, /data-more-close aria-label="Закрыть"/);
  assert.equal((html.match(/class="more-group"/g) || []).length, 2, 'the empty and the broken groups are not drawn');
  assert.match(html, /<button type="button" class="more-tile active" data-more-view="overview" aria-current="page">/);
  assert.match(html, /data-more-view="dice"><span class="more-icon" aria-hidden="true"><svg><\/svg><\/span><span class="more-label">Кубики<\/span>/);
  assert.match(html, /<span class="wn-dot"><\/span>/, 'the marker the app drew stays');
  assert.doesNotMatch(html, /Bad View|data-more-view="rules"/);
  const evil = M.build([{ label: '<i>g</i>', items: [{ view: 'rules', label: '<script>x</script>' }] }], { lang: 'en' });
  assert.doesNotMatch(evil, /<script>|<i>g/); assert.match(evil, /All sections/);
  assert.match(M.build([], { role: '<div class="role-switch"></div>' }), /<div class="role-switch"><\/div>/);
  assert.equal(M.build(null).includes('more-group'), false);
});

test('read: the tiles are taken from the menu the app drew: groups, icons, markers, the settings item last', () => {
  const h = load(['more-sheet.js']), M = h.win.MoreSheet, doc = h.doc;
  const node = (cls, text, over = {}) => ({ classList: { contains: c => cls.includes(c) }, textContent: text, dataset: {}, children: [], querySelector() { return null; }, getAttribute: () => '', ...over });
  const item = (view, text, { active, icon = '<svg/>', extra = [], settings } = {}) => node(['nav-item', ...(active ? ['active'] : []), ...(settings ? ['drawer-settings'] : [])], '', { dataset: { view }, getAttribute: () => text, querySelector: s => s === '.nav-text' ? { textContent: ' ' + text + ' ' } : s === '.nav-icon' ? { innerHTML: icon } : null, children: [{ classList: { contains: c => c === 'nav-icon' } }, { classList: { contains: c => c === 'nav-text' } }, { classList: { contains: c => c === 'nav-arrow' } }, ...extra] });
  const side = { querySelectorAll: () => [node(['nav-group-label'], ' Игра '), item('overview', 'Обзор', { active: true }), item('news', 'Что нового', { extra: [{ classList: { contains: () => false }, outerHTML: '<i class="wn-dot"></i>' }] }), item('settings', 'Настройки', { settings: true })] };
  const root = { querySelector: s => s === '#app-sidebar' ? side : null };
  const g = M.read(root, 'ru');
  eq(g.map(x => x.label), ['Игра', 'Настройки']);
  eq(g[0].items.map(x => [x.view, x.label, x.active, x.extra]), [['overview', 'Обзор', true, ''], ['news', 'Что нового', false, '<i class="wn-dot"></i>']]);
  assert.equal(g[1].items[0].view, 'settings');
  eq(M.read({ querySelector: () => null }, 'ru'), []);
  assert.equal(M.read(root, 'en')[1].label, 'Settings');
  void doc;
});

function sheet() {
  const h = load(['more-sheet.js']), { doc, win } = h, M = win.MoreSheet, views = [];
  const appEl = doc.el('div'), main = doc.el('div'), opener = doc.el('button'), bottom = doc.el('button');
  opener.isConnected = true; bottom.isConnected = true;
  doc.queries['#app'] = appEl; doc.queries['#main-content'] = main; doc.queries['.bottom-nav [data-shell="menu"]'] = bottom;
  const menus = [doc.el('button'), doc.el('button')]; doc.queries['[data-shell="menu"]'] = menus;
  win.App = { lang: () => 'ru', setView: v => (views.push(v), true) };
  doc.queries['#app-sidebar'] = null;
  return { ...h, M, views, appEl, main, opener, bottom, menus, tile: () => doc.all.find(x => x.id === 'more-sheet') };
}

test('open: a modal dialog with a name; the page behind is inert; the menu buttons say expanded; close undoes all of it and focuses the opener', () => {
  const s = sheet(); s.doc.activeElement = s.opener;
  assert.equal(s.M.open(s.opener), true);
  const el = s.tile(); assert.ok(el.isConnected);
  assert.equal(el.attrs.role, 'dialog'); assert.equal(el.attrs['aria-modal'], 'true'); assert.equal(el.attrs['aria-labelledby'], 'more-sheet-title');
  assert.equal(s.appEl.inert, true); assert.equal(s.doc.documentElement.classList.contains('more-open'), true);
  assert.equal(s.menus.every(b => b.attrs['aria-expanded'] === 'true'), true); assert.equal(s.M.isOpen(), true);
  assert.equal(s.M.open(), false, 'opening twice does nothing');
  assert.equal(s.M.close(), true);
  assert.equal(s.M.isOpen(), false); assert.equal(el.isConnected, false); assert.equal(s.appEl.inert, false);
  assert.equal(s.menus.every(b => b.attrs['aria-expanded'] === 'false'), true);
  assert.equal(s.doc.activeElement, s.opener, 'the focus goes back to the button that opened it');
  assert.equal(s.M.close(), false);
});

test('the focus falls back to the bottom bar button, then to the content, never to the page body', () => {
  const s = sheet(); s.opener.isConnected = false;
  s.M.open(s.opener); s.M.close(); assert.equal(s.doc.activeElement, s.bottom);
  s.doc.queries['.bottom-nav [data-shell="menu"]'] = null; s.M.open(s.opener); s.M.close(); assert.equal(s.doc.activeElement, s.main);
});

test('toggle opens and closes; Escape closes and is swallowed; Tab wraps inside the sheet', () => {
  const s = sheet(); s.doc.activeElement = s.opener;
  s.M.toggle(s.opener); assert.equal(s.M.isOpen(), true);
  const el = s.tile(), a = s.doc.el('button'), b = s.doc.el('button'); a.parent = el; b.parent = el;
  el.queries['button:not([disabled]),a[href],input:not([disabled]),select:not([disabled]),[tabindex]:not([tabindex="-1"])'] = [a, b];
  s.doc.activeElement = b; const t = key('Tab'); s.doc.fire('keydown', t); assert.equal(t.prevented, 1); assert.equal(s.doc.activeElement, a, 'forward from the last goes to the first');
  s.doc.activeElement = a; const u = key('Tab', { shiftKey: true }); s.doc.fire('keydown', u); assert.equal(s.doc.activeElement, b, 'back from the first goes to the last');
  s.doc.activeElement = s.opener; const out = key('Tab'); s.doc.fire('keydown', out); assert.equal(s.doc.activeElement, a, 'a focus that got outside is pulled back in');
  s.doc.activeElement = a; const mid = key('Tab'); s.doc.fire('keydown', mid); assert.equal(mid.prevented, 0, 'in the middle the browser moves the focus');
  const esc = key('Escape'); s.doc.fire('keydown', esc); assert.equal(esc.prevented, 1); assert.equal(s.M.isOpen(), false);
  const free = key('Escape'); s.doc.fire('keydown', free); assert.equal(free.prevented, 0, 'closed: Escape is not taken');
});

test('a tile opens its screen through the app and closes the sheet; the content gets the focus when nothing has it', () => {
  const s = sheet(); s.M.open(s.opener); const el = s.tile();
  const tile = { dataset: { moreView: 'dice' }, parent: el };
  s.doc.activeElement = null;
  s.doc.fire('click', { target: { closest: q => q === '[data-more-view]' ? tile : null }, preventDefault() {} });
  assert.equal(s.M.isOpen(), false); eq(s.views, ['dice']); assert.equal(s.doc.activeElement, s.main);
  void el;
  assert.equal(s.M.go('Bad View'), false); assert.equal(s.M.go(undefined), false); eq(s.views, ['dice']);
});

test('the backdrop and the close button close it; a click while it is closed is ignored', () => {
  const s = sheet(); s.doc.fire('click', { target: { closest: () => ({}) } });
  s.M.open(s.opener); s.doc.fire('click', { target: { closest: q => q === '[data-more-close]' ? {} : null } }); assert.equal(s.M.isOpen(), false);
});

test('refresh draws the tiles again while it is open (the role changed) and does nothing when closed', () => {
  const s = sheet(); assert.equal(s.M.refresh(), false);
  s.M.open(s.opener); s.win.RoleMode = { switchHTML: () => '<div class="role-switch"></div>' };
  assert.equal(s.M.refresh(), true); assert.match(s.tile().innerHTML, /role-switch/);
});

test('the sheet has a role switch, touch targets of 44 px or more, a print rule, LF endings and no network', () => {
  const code = fs.readFileSync(__dirname + '/../site/more-sheet.js', 'utf8'), css = fs.readFileSync(__dirname + '/../site/more-sheet.css', 'utf8');
  assert.match(code, /RoleMode\?\.switchHTML/); assert.match(css, /\.more-tile\{[^}]*min-height:76px/); assert.match(css, /\.more-close\{[^}]*min-height:44px/);
  assert.match(css, /@media print/); assert.match(css, /prefers-reduced-motion/);
  assert.equal(code.includes('\r') || css.includes('\r'), false); assert.doesNotMatch(code, /fetch\(|XMLHttpRequest|WebSocket|localStorage/);
});

test('shell-ui sends a phone menu press to the sheet and keeps the drawer for the rest', () => {
  const src = fs.readFileSync(__dirname + '/../site/shell-ui.js', 'utf8');
  assert.match(src, /if\(phone\(\)&&global\.MoreSheet\)\{global\.MoreSheet\.toggle\(el\);return\}/);
  assert.match(src, /aria-expanded',String\(open\|\|!!global\.MoreSheet\?\.isOpen\?\.\(\)\)/);
});

test('a tile goes through App.navigate (the drawer behaviour: clears the open sheet and the search) when the app has it', () => {
  const s = sheet(); const seen = []; s.win.App = { lang: () => 'ru', navigate: v => (seen.push('navigate ' + v), true), setView: v => (seen.push('setView ' + v), true) };
  assert.equal(s.M.go('rules'), true); eq(seen, ['navigate rules']);
});
