// Quick dice (site/quick-dice.js, Rolls.quickCheck / Rolls.quickDice) and the roll chip (site/roll-chip.js).
const { test } = require('node:test'), assert = require('node:assert/strict'), fs = require('node:fs');
const { load, key } = require('./dialog-dom.cjs');
const eq = (a, b) => assert.deepStrictEqual(JSON.parse(JSON.stringify(a)), JSON.parse(JSON.stringify(b)));

function setup({ view = 'overview', history = [], stored = {} } = {}) {
  const store = new Map(Object.entries(stored));
  const localStorage = { getItem: k => store.has(k) ? store.get(k) : null, setItem: (k, v) => store.set(k, String(v)), removeItem: k => store.delete(k), get length() { return store.size; }, key: i => [...store.keys()][i] };
  const h = load(['ui-memory.js', 'rolls.js', 'quick-dice.js'], { localStorage }), { doc, win } = h, rolls = [];
  const appEl = doc.el('div'), main = doc.el('div'), opener = doc.el('button'); opener.isConnected = true;
  doc.queries['#app'] = appEl; doc.queries['#main-content'] = main; doc.queries['dialog[open],[aria-modal="true"]'] = null;
  win.App = { lang: () => 'ru', getState: () => ({ diceValues: { stat: 3, skill: 2, modifier: -1 } }),
    check: (stat, label, o) => { rolls.push(['check', stat, label, o]); return { total: stat + o.skill + o.mod + 5 }; }, dice: (n, s, l) => { rolls.push(['dice', n, s, l]); return n * 3; } };
  win.RollHistory = { all: () => history, replay: r => rolls.push(['replay', r]) };
  return { ...h, store, rolls, appEl, main, opener, Q: win.QuickDice, view, sheet: () => doc.all.find(x => x.className === 'qd-sheet' && x.isConnected) };
}

test('Rolls.quickCheck clamps the numbers and rolls through the app engine; bad numbers or no app give null', () => {
  const s = setup(), R = s.win.Rolls;
  assert.equal(R.quickCheck({ stat: 6, skill: 4, mod: -2 }), 13); eq(s.rolls[0], ['check', 6, 'Проверка d10', { wounds: false, skill: 4, mod: -2 }]);
  R.quickCheck({ stat: 99, skill: -5, mod: 500 }); eq(s.rolls[1].slice(1, 2).concat(s.rolls[1][3]), [20, { wounds: false, skill: 0, mod: 100 }]);
  assert.equal(R.quickCheck({ stat: 'x' }), null); assert.equal(R.quickCheck({ stat: NaN }), null);
  assert.equal(R.quickCheck({ stat: 5, skill: 0, mod: 0, label: 'Бросок' }), 10); assert.equal(s.rolls.at(-1)[2], 'Бросок');
  s.win.App = undefined; assert.equal(R.quickCheck({ stat: 1 }), null);
});

test('Rolls.quickDice: 1..20 dice of 2..100 sides, through the app; anything else is refused', () => {
  const s = setup(), R = s.win.Rolls;
  assert.equal(R.quickDice(2, 6), 6); eq(s.rolls[0], ['dice', 2, 6, '']);
  R.quickDice(50, 6); assert.equal(s.rolls.at(-1)[1], 20, 'the count is clamped');
  R.quickDice(1, 1000); assert.equal(s.rolls.at(-1)[2], 100);
  assert.equal(R.quickDice('a', 6), null); assert.equal(R.quickDice(1, null), null);
  s.win.App = undefined; assert.equal(R.quickDice(1, 6), null);
});

test('visible: not on the Dice screen, not while a dialog is open, not in print, not when switched off', () => {
  const Q = setup().Q;
  assert.equal(Q.visible({ view: 'overview' }), true); assert.equal(Q.visible({ view: 'sheet' }), true); assert.equal(Q.visible({ view: 'combat' }), true);
  assert.equal(Q.visible({ view: 'dice' }), false); assert.equal(Q.visible({ view: 'overview', modal: true }), false);
  assert.equal(Q.visible({ view: 'overview', printing: true }), false); assert.equal(Q.visible({ view: 'overview', enabled: false }), false);
  eq(Q.HIDDEN_VIEWS, ['dice']);
});

test('cleanMemory keeps three whole numbers inside their limits and drops everything else', () => {
  const Q = setup().Q;
  eq(Q.cleanMemory({ stat: 6.9, skill: '4', mod: -3 }), { stat: 6, skill: 4, mod: -3 });
  eq(Q.cleanMemory({ stat: 99, skill: -1, mod: 1e9 }), { stat: 20, skill: 0, mod: 100 });
  eq(Q.cleanMemory({}), { stat: 0, skill: 0, mod: 0 }); assert.equal(Q.cleanMemory(null), null); assert.equal(Q.cleanMemory([1]), null); assert.equal(Q.cleanMemory('x'), null);
});

test('sync: the button is made once, named, and hidden on the Dice screen', () => {
  const s = setup(); assert.equal(s.Q.sync('overview'), true);
  const fab = s.doc.all.find(x => x.className === 'qd-fab'); assert.ok(fab); assert.equal(fab.attrs['aria-label'], 'Быстрые кубики'); assert.equal(fab.attrs['aria-haspopup'], 'dialog'); assert.equal('data-quick-dice-open' in fab.attrs, true);
  assert.equal(fab.hidden, false); assert.equal(s.Q.sync('dice'), false); assert.equal(fab.hidden, true); assert.equal(s.Q.sync('combat'), true);
  assert.equal(s.doc.all.filter(x => x.className === 'qd-fab').length, 1, 'never a second button');
  s.doc.queries['dialog[open],[aria-modal="true"]'] = s.doc.el('div'); assert.equal(s.Q.sync(), false, 'hidden while some other dialog is open');
});

test('the sheet: d10 check fields from the last use, six plain dice, the last five rolls, a switch for the button; labelled, modal, inert page', () => {
  const s = setup({ history: [{ label: '2d6', detail: '4 + 2', total: 6, replay: { kind: 'dice', n: 2, sides: 6 } }, { label: '<b>x</b>', detail: 'd', total: 3 }] });
  const html = s.Q.sheetHTML('ru');
  assert.match(html, /<h2 id="qd-title">Быстрые кубики<\/h2>/); assert.match(html, /data-qd-field="stat"[^>]*value="3"/); assert.match(html, /data-qd-field="skill"[^>]*value="2"/); assert.match(html, /data-qd-field="mod"[^>]*value="-1"/);
  for (const d of ['1d6', '2d6', '3d6', '4d6', '1d10', '1d100']) assert.match(html, new RegExp(`data-qd-dice="${d}"`));
  assert.match(html, />d100<\/button>/); assert.match(html, /data-qd-again="0"/); assert.doesNotMatch(html, /data-qd-again="1"/, 'only a roll with a recipe can be repeated');
  assert.match(html, /&lt;b&gt;x&lt;\/b&gt;/); assert.match(html, /data-qd-fab checked/);
  assert.equal(setup().Q.rowsHTML('en').includes('No rolls yet.'), true);
  assert.equal(setup({ history: Array.from({ length: 9 }, (_, i) => ({ label: 'r' + i, detail: '', total: i })) }).Q.rowsHTML('ru').split('<li>').length - 1, 5, 'five at most');
  assert.match(setup().Q.sheetHTML('en'), /Quick dice/); assert.match(setup().Q.sheetHTML('en'), /Show the floating button/);
  assert.match(setup({ stored: { 'nc-pref-quick-dice': '{"stat":9,"skill":8,"mod":7}' } }).Q.sheetHTML('ru'), /data-qd-field="stat"[^>]*value="9"/);
});

test('open and close: a modal dialog; the page is inert; the focus goes into the sheet and comes back', () => {
  const s = setup(); s.doc.activeElement = s.opener; s.Q.sync('overview');
  assert.equal(s.Q.open(s.opener), true); const el = s.sheet();
  assert.equal(el.attrs.role, 'dialog'); assert.equal(el.attrs['aria-modal'], 'true'); assert.equal(el.attrs['aria-labelledby'], 'qd-title'); assert.equal(s.appEl.inert, true);
  assert.equal(s.Q.open(), false);
  assert.equal(s.Q.close(), true); assert.equal(s.appEl.inert, false); assert.equal(s.doc.activeElement, s.opener); assert.equal(s.sheet(), undefined);
});

test('Escape closes; Tab stays inside', () => {
  const s = setup(); s.Q.open(s.opener); const el = s.sheet(), a = s.doc.el('button'), b = s.doc.el('button'); a.parent = el; b.parent = el;
  el.queries['button:not([disabled]),input:not([disabled]),[tabindex]:not([tabindex="-1"])'] = [a, b];
  s.doc.activeElement = b; const t = key('Tab'); s.doc.fire('keydown', t); assert.equal(s.doc.activeElement, a); assert.equal(t.prevented, 1);
  const e = key('Escape'); s.doc.fire('keydown', e); assert.equal(e.prevented, 1); assert.equal(s.sheet(), undefined);
});

test('the d10 button rolls the check through Rolls with the typed numbers, remembers them, and redraws the list of last rolls', () => {
  const hist = [];
  const s = setup({ history: hist }); s.Q.open(s.opener); const el = s.sheet();
  const field = v => ({ value: v }); const fields = { stat: field('7'), skill: field('5'), mod: field('-2') };
  el.querySelector = sel => { const m = /data-qd-field="(\w+)"/.exec(sel); if (m) return fields[m[1]]; if (sel === '#qd-last') return last; return null; };
  const last = { innerHTML: '' };
  s.doc.fire('click', { target: { closest: q => q === '[data-qd-check]' ? {} : null } });
  eq(s.rolls[0], ['check', 7, 'Проверка d10', { wounds: false, skill: 5, mod: -2 }]);
  assert.equal(s.store.get('nc-pref-quick-dice'), '{"stat":7,"skill":5,"mod":-2}'); assert.match(last.innerHTML, /Бросков пока нет/);
  fields.stat.value = 'abc'; s.Q.rollCheck(); assert.equal(s.rolls[1][1], 0, 'a field that is not a number counts as 0');
});

test('a plain die button rolls n dice of that size; a bad spec rolls nothing; Enter in a field rolls the check', () => {
  const s = setup(); s.Q.open(s.opener);
  s.doc.fire('click', { target: { closest: q => q === '[data-qd-dice]' ? { dataset: { qdDice: '3d6' } } : null } });
  eq(s.rolls[0], ['dice', 3, 6, '']);
  s.doc.fire('click', { target: { closest: q => q === '[data-qd-dice]' ? { dataset: { qdDice: '1d100' } } : null } }); eq(s.rolls[1], ['dice', 1, 100, '']);
  assert.equal(s.Q.rollDice('evil'), null); assert.equal(s.Q.rollDice('1d'), null); assert.equal(s.rolls.length, 2);
  const enter = key('Enter', { target: { dataset: { qdField: 'stat' } } }); s.doc.fire('keydown', enter); assert.equal(enter.prevented, 1); assert.equal(s.rolls.at(-1)[0], 'check');
});

test('«Roll again» in the list repeats a roll that has a recipe', () => {
  const recipe = { kind: 'dice', n: 2, sides: 6, label: '' }, s = setup({ history: [{ label: '2d6', detail: '', total: 6, replay: recipe }] });
  s.Q.open(s.opener); s.doc.fire('click', { target: { closest: q => q === '[data-qd-again]' ? { dataset: { qdAgain: '0' } } : null } });
  eq(s.rolls[0], ['replay', recipe]);
});

test('the button on the home page and the close button; the switch hides the floating button on this device only', () => {
  const s = setup(); const home = s.doc.el('button'); home.isConnected = true;
  s.doc.fire('click', { target: { closest: q => q === '[data-quick-dice-open]' ? home : null }, preventDefault() {} }); assert.ok(s.sheet());
  s.doc.fire('click', { target: { closest: q => q === '[data-qd-close]' ? {} : null } }); assert.equal(s.sheet(), undefined);
  s.Q.sync('overview'); s.doc.fire('change', { target: { matches: q => q === '[data-qd-fab]', checked: false } });
  assert.equal(s.store.get('nc-pref-quick-dice-off'), 'true'); assert.equal(s.doc.all.find(x => x.className === 'qd-fab').hidden, true);
  s.doc.fire('change', { target: { matches: q => q === '[data-qd-fab]', checked: true } }); assert.equal(s.doc.all.find(x => x.className === 'qd-fab').hidden, false);
  assert.equal([...s.store.keys()].every(k => k.startsWith('nc-pref-')), true);
});

test('the styles: a 44 px floating button above the bottom bar, hidden in print; no collision with the Dice screen classes', () => {
  const css = fs.readFileSync(__dirname + '/../site/quick-dice.css', 'utf8'), code = fs.readFileSync(__dirname + '/../site/quick-dice.js', 'utf8');
  assert.match(css, /\.qd-fab\{[^}]*width:52px;height:52px/); assert.match(css, /@media \(max-width:820px\)\{\.qd-fab\{bottom:calc\(72px/); assert.match(css, /@media print\{[^}]*\.qd-fab/);
  assert.match(css, /\.qd-die\{min-height:48px/); assert.match(css, /\.qd-close\{min-width:44px;min-height:44px/);
  assert.equal(/\.quick-dice\b/.test(css.replace(/\/\*[\s\S]*?\*\//g, '')), false,'the Dice screen has its own .quick-dice');
  assert.equal(code.includes('\r') || css.includes('\r'), false); assert.doesNotMatch(code, /fetch\(|XMLHttpRequest|WebSocket|Math\.random/, 'no dice of its own: everything goes through Rolls');
});

// ---- the roll chip ----
const chip = () => load(['roll-chip.js']);

test('parse: the first line is the title, the rest the detail; a verdict is read only from the end of the detail', () => {
  const C = chip().win.RollChip;
  eq(C.parse('Проверка: 17\n1d10 7 + 6 + 4 = 17 > DV 15 — успех'), { title: 'Проверка: 17', detail: '1d10 7 + 6 + 4 = 17 > DV 15 — успех', verdict: 'ok' });
  assert.equal(C.parse('x\n… ≤ DV 15 — провал').verdict, 'bad'); assert.equal(C.parse('x\n… — success').verdict, 'ok'); assert.equal(C.parse('x\n… — Failure').verdict, 'bad');
  assert.equal(C.parse('Атака: 22\n1d10 10 + 4 (Критический успех) + 8').verdict, '', 'a critical success in the middle is not a verdict');
  eq(C.parse('2d6: 4 · 2'), { title: '2d6: 4 · 2', detail: '', verdict: '' }); eq(C.parse(null), { title: '', detail: '', verdict: '' });
});

test('body: title with the verdict as words, the dice, a hidden detail and a «Details» button wired to it; all text escaped', () => {
  const C = chip().win.RollChip;
  const html = C.body('A <b>: 17\nd — успех', 'ru', '<span class="roll-dice">F</span>');
  assert.match(html, /<span class="roll-title">A &lt;b&gt;: 17<b class="roll-verdict ok">успех<\/b><\/span>/); assert.ok(html.indexOf('roll-dice') > html.indexOf('roll-title'));
  assert.match(html, /<span class="roll-detail" id="roll-detail" hidden>d — успех<\/span>/);
  assert.match(html, /<button type="button" class="btn small ghost roll-more" data-roll-more aria-expanded="false" aria-controls="roll-detail">Подробнее<\/button>/);
  assert.match(html, /<span class="roll-actions">/); assert.match(C.body('x\ny', 'en'), />Details</);
  const plain = C.body('2d6: 4 · 2', 'ru'); assert.doesNotMatch(plain, /roll-detail|roll-more/, 'nothing to show: no button');
});

test('«Details» toggles the detail, the label and aria-expanded', () => {
  const h = chip(), C = h.win.RollChip, doc = h.doc;
  const detail = { hidden: true }, box = { querySelector: () => detail, classList: { toggle() {} } }, attrs = {}, btn = { closest: () => box, setAttribute: (k, v) => { attrs[k] = v; }, textContent: '' };
  assert.equal(C.toggleDetail(btn), true); assert.equal(detail.hidden, false); assert.equal(attrs['aria-expanded'], 'true'); assert.equal(btn.textContent, 'Скрыть');
  C.toggleDetail(btn); assert.equal(detail.hidden, true); assert.equal(btn.textContent, 'Подробнее');
  assert.equal(C.toggleDetail({ closest: () => null }), false); void doc;
});

test('the chip never stays over another screen or tab: a new screen, a tab click, a menu click or a navigation take it away', () => {
  const h = chip(), C = h.win.RollChip, doc = h.doc, box = doc.el('div'); box.classList.add('roll-notice', 'visible'); doc.queries['#app-notice'] = box;
  C.setScreen('overview|'); C.arm(); C.setScreen('overview|'); assert.equal(box.classList.contains('visible'), true, 'the same screen: it stays');
  C.setScreen('sheet|v1|skills'); assert.equal(box.classList.contains('visible'), false, 'another screen: gone');
  for (const sel of ['[data-sheet-tab]', '[role="tab"]', '.nav-item', '[data-action="navigate"]', '[data-more-view]', '.bottom-nav button']) {
    box.classList.add('visible'); C.setScreen('x'); C.arm();
    doc.fire('click', { target: { closest: q => q.includes(sel) ? {} : null } });
    assert.equal(box.classList.contains('visible'), false, sel);
  }
  box.classList.add('visible'); C.arm(); doc.fire('click', { target: { closest: () => null } }); assert.equal(box.classList.contains('visible'), true, 'an ordinary click elsewhere leaves it');
  const plain = doc.el('div'); plain.classList.add('visible'); doc.queries['#app-notice'] = plain; C.dismiss(); assert.equal(plain.classList.contains('visible'), true, 'only a roll chip is taken away, not another notice');
});

test('holds: kept while the pointer is over it or the focus is inside; the app asks before hiding', () => {
  const h = chip(), C = h.win.RollChip;
  assert.equal(C.holds({ matches: () => true, contains: () => false }), true); assert.equal(C.holds({ matches: () => false, contains: () => true }), true);
  assert.equal(C.holds({ matches: () => false, contains: () => false }), false); assert.equal(C.holds(null), false);
});

test('app.js wires the chip: the body, arming, the screen key, and a timer that asks before hiding; the hooks are optional', () => {
  const app = fs.readFileSync(__dirname + '/../site/app.js', 'utf8');
  assert.ok(app.includes("window.RollChip?.body?.(text,state.lang,diceFaces(roll.faces))||`<span>${esc(text)}</span>${diceFaces(roll.faces)}`"));
  assert.ok(app.includes('window.RollHistory?.decorate?.(box,roll);window.RollChip?.arm?.()'));
  assert.ok(app.includes("window.RollChip?.holds?.(box)")); assert.ok(app.includes("window.RollChip?.setScreen?.(state.view+'|'"));
  for (const m of app.matchAll(/window\.(RollChip|Home|MoreSheet|QuickDice|CommandPalette)(.)/g)) assert.equal(m[2], '?', `the app reaches ${m[1]} only through optional chaining`);
  const css = fs.readFileSync(__dirname + '/../site/roll-chip.css', 'utf8');
  assert.match(css, /\.app-notice\.roll-notice\{top:calc\(64px/); assert.match(css, /min-height:44px/); assert.match(css, /prefers-reduced-motion/); assert.match(css, /@media print/);
  const hist = fs.readFileSync(__dirname + '/../site/roll-history.js', 'utf8'); assert.match(hist, /chipAgain:'Повторить'/); assert.match(hist, /querySelector\('\.roll-actions'\)/);
});

test('the floating button can sit on the left so it never hides the right end of a row; the choice is remembered per device', () => {
  const s = setup(), Q = s.Q; assert.equal(Q.onLeft(), false);
  Q.sync('overview'); const fab = s.doc.all.find(x => x.className === 'qd-fab'); assert.equal(fab.classList.contains('qd-left'), false);
  Q.open(s.opener); const html = s.sheet().innerHTML; assert.match(html, /data-qd-side/); assert.match(html, /Кнопка слева/);
  s.doc.fire('change', { target: { matches: q => q === '[data-qd-side]', checked: true } });
  assert.equal(Q.onLeft(), true); assert.equal(fab.classList.contains('qd-left'), true); assert.equal(s.store.get('nc-pref-quick-dice-left'), 'true');
  assert.match(fs.readFileSync(__dirname + '/../site/quick-dice.css', 'utf8'), /\.qd-fab\.qd-left\{right:auto;left:14px\}/);
});
