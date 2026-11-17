// The bottom bar that follows the screen: sheet and campaign tracker get their own items; everything else keeps the usual bar.
const { test } = require('node:test'), assert = require('node:assert/strict');
const { load } = require('./dialog-dom.cjs');
const fs = require('node:fs');
const eq = (a, b) => assert.deepStrictEqual(JSON.parse(JSON.stringify(a)), JSON.parse(JSON.stringify(b)));

test('items: sheet and an open tracker have their own set; every other screen gets null', () => {
  const C = load(['context-bar.js']).win.ContextBar;
  eq(C.items({ view: 'sheet' }).map(i => i.key), ['rolls', 'skills', 'gear', 'health']);
  eq(C.items({ view: 'campaigns', tracker: true }).map(i => i.key), ['list', 'prev', 'next', 'init']);
  for (const v of ['overview', 'characters', 'combat', 'dice', 'rules']) assert.equal(C.items({ view: v, tracker: true }), null, v);
  assert.equal(C.items({ view: 'campaigns', tracker: false }), null, 'the campaign list keeps the usual bar'); assert.equal(C.items(null), null);
});

test('html: buttons named in both languages, icons hidden from readers, nothing for the other screens', () => {
  const C = load(['context-bar.js']).win.ContextBar, icons = { combat: '<svg>c</svg>' };
  const ru = C.html({ view: 'sheet', lang: 'ru' }, icons), en = C.html({ view: 'campaigns', tracker: true, lang: 'en' }, icons);
  assert.match(ru, /data-ctx="health"[^>]*>[\s\S]*Здоровье/); assert.match(ru, /<span class="bottom-nav-icon" aria-hidden="true"><svg>c<\/svg><\/span>/);
  assert.equal((ru.match(/<button/g) || []).length, 4); assert.match(en, /Next turn/); assert.match(en, /Initiative/);
  assert.equal(C.html({ view: 'rules', lang: 'ru' }, icons), '');
});

test('press: presses the page control; a missing or disabled one is a quiet false; the focus never ends on the body', () => {
  const h = load(['context-bar.js']), C = h.win.ContextBar, doc = h.doc; let clicks = 0;
  const target = doc.el('button'); target.click = () => { clicks++; doc.activeElement = doc.body; };
  doc.queries['[data-campaign-action="next"]'] = target;
  const main = doc.el('div'); doc.queries['#main-content'] = main;
  assert.equal(C.press('next'), true); assert.equal(clicks, 1); assert.equal(doc.activeElement, main, 'after a redraw the focus goes to the content');
  const bar = doc.el('button'); doc.queries['.bottom-nav [data-ctx="next"]'] = bar; doc.activeElement = doc.body; C.press('next'); assert.equal(doc.activeElement, bar, 'or to the same item of the new bar');
  target.disabled = true; assert.equal(C.press('next'), false); assert.equal(C.press('nope'), false); assert.equal(C.press('rolls'), false);
});

test('app.js asks the module for the bar and falls back to the usual one; the script is registered before app.js', () => {
  const app = fs.readFileSync(__dirname + '/../site/app.js', 'utf8'), html = fs.readFileSync(__dirname + '/../site/index.html', 'utf8');
  assert.ok(app.includes("window.ContextBar?.html?.({view:state.view,lang:state.lang,tracker:!!window.Campaigns?.selectedId?.()}"));
  assert.ok(html.indexOf('context-bar.js') > 0 && html.indexOf('context-bar.js') < html.indexOf('app.js'));
});
