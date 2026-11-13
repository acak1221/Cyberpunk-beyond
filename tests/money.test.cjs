// Money on the sheet (site/money.js) and the shop's pay source (site/shop-cart.js).
const { test } = require('node:test'), assert = require('node:assert/strict'), fs = require('node:fs'), vm = require('node:vm');
const read = name => fs.readFileSync(__dirname + '/../site/' + name, 'utf8');
const plain = value => JSON.parse(JSON.stringify(value));

function load() {
  let n = 0;
  const w = {}, ctx = { window: w, globalThis: { crypto: { randomUUID: () => 'id-' + (++n) } }, console, Math, JSON, Set, Map, Number, String, Array, Object, Date };
  vm.createContext(ctx);
  for (const file of ['catalog.js', 'catalog-extra.js', 'character-extra.js', 'equipment-tools.js', 'wallet.js', 'money.js', 'shop-cart.js']) vm.runInContext(read(file), ctx);
  return w;
}
const W = load(), M = W.Money, SC = W.ShopCart, CATALOG = W.CATALOG;
const person = (extra = {}, id = 'p1', name = 'Nova') => ({ id, name, role: 'solo', stats: { EMP: 6 }, skills: {}, hp: 40, humanity: 60, extra: { cash: 880, gearBudget: 0, fashionBudget: 0, items: [], weapons: [], ...extra } });
const item = id => { const found = CATALOG.find(x => x.id === id); assert.ok(found, id); return found; };
const PISTOL = 'weapon-medium-pistol';
const FASHION = CATALOG.find(x => x.category === 'fashion' && Number.isSafeInteger(x.price) && x.price > 0 && x.price <= 800 && SC.buyable(x));
const cartOf = (...ids) => { const cart = SC.emptyCart(); for (const id of ids) assert.equal(SC.add(cart, item(id), 'en').ok, true, id); return cart; };

test('typed sums: a plain number sets, a signed one adds or subtracts, anything else is refused', () => {
  assert.deepEqual(plain(M.parseEntry('500')), { kind: 'set', value: 500 });
  assert.deepEqual(plain(M.parseEntry(' 1 300 eb ')), { kind: 'set', value: 1300 });
  assert.deepEqual(plain(M.parseEntry('+1000')), { kind: 'delta', value: 1000 });
  assert.deepEqual(plain(M.parseEntry('-200')), { kind: 'delta', value: -200 });
  assert.deepEqual(plain(M.parseEntry('−200')), { kind: 'delta', value: -200 });
  for (const junk of ['', '12.5', 'abc', '1e3', '--5', '9999999999', null, undefined]) assert.equal(M.parseEntry(junk).kind, 'bad', String(junk));
  assert.equal(M.parseAmount('250'), 250); assert.equal(M.parseAmount('-250'), 0); assert.equal(M.parseAmount('0'), 0); assert.equal(M.parseAmount('x'), 0);
});

test('the sheet field never wipes the balance: negative and garbage entries keep it and say why', () => {
  const c = person();
  for (const typed of ['12.5', 'abc', '', '1e9x']) {
    const r = M.fieldEntry(c, 'cash', typed, 'ru');
    assert.equal(r.dirty, false, typed); assert.equal(r.value, '880'); assert.match(r.notify, /не изменена/); assert.equal(r.extra, undefined);
  }
  let r = M.fieldEntry(c, 'cash', '-200', 'ru');
  assert.equal(r.dirty, true); assert.equal(r.value, '680'); assert.equal(r.extra.cash, 680); assert.equal(r.extra.walletLog[0].delta, -200); assert.equal(c.extra.cash, 880, 'nothing is assigned by the pure helper');
  r = M.fieldEntry(c, 'cash', '+1000', 'en'); assert.equal(r.extra.cash, 1880); assert.match(r.notify, /Got 1 000 eb/);
  r = M.fieldEntry(c, 'cash', '-900', 'en'); assert.equal(r.dirty, false); assert.equal(r.value, '880'); assert.match(r.notify, /Short by 20 eb/);
  r = M.fieldEntry(c, 'cash', '1300', 'ru'); assert.equal(r.extra.cash, 1300); assert.equal(r.extra.walletLog[0].delta, 420);
  r = M.fieldEntry(c, 'cash', '880', 'ru'); assert.equal(r.dirty, false);
  // starting budgets: whole numbers from 0 only, no signed sums
  const b = person({ gearBudget: 2550 });
  r = M.fieldEntry(b, 'gearBudget', '-200', 'ru'); assert.equal(r.dirty, false); assert.equal(r.value, '2550'); assert.match(r.notify, /Бюджет не изменён/);
  r = M.fieldEntry(b, 'gearBudget', '', 'en'); assert.equal(r.dirty, false); assert.equal(r.value, '2550');
  r = M.fieldEntry(b, 'gearBudget', '2000', 'en'); assert.equal(r.dirty, true); assert.equal(r.extra.gearBudget, 2000); assert.equal(r.extra.cash, 880);
});

test('fieldChange: only a committed change is applied, the field shows what is stored', () => {
  const c = person(), el = { value: '-200' };
  assert.deepEqual(plain(M.fieldChange(el, c, 'cash', 'input', 'ru')), { handled: true }); assert.equal(c.extra.cash, 880);
  let r = M.fieldChange(el, c, 'cash', 'change', 'ru');
  assert.equal(r.handled, true); assert.equal(r.dirty, true); assert.equal(c.extra.cash, 680); assert.equal(el.value, '680'); assert.equal(r.rerender, false);
  el.value = 'oops'; r = M.fieldChange(el, c, 'cash', 'change', 'ru');
  assert.equal(r.dirty, undefined); assert.equal(c.extra.cash, 680); assert.equal(el.value, '680'); assert.ok(r.notify);
  const old = { id: 'o', name: 'Old' }; el.value = '50';
  r = M.fieldChange(el, old, 'cash', 'change', 'en'); assert.equal(old.extra.cash, 50, 'a save without extra still works');
});

test('wallet operations are staged: earn, spend, exact amount, give, split and undo', () => {
  const a = person(), b = person({ cash: 500 }, 'p2', 'Rook'), nameOf = c => c.name;
  let op = M.opChange(a, 500, 'job', 'en'); assert.equal(op.ok, true); assert.equal(op.changes[0].extra.cash, 1380); assert.equal(a.extra.cash, 880);
  op = M.opChange(a, -900, '', 'ru'); assert.equal(op.ok, false); assert.match(op.text, /Не хватает 20 eb/);
  op = M.opSet(a, '1300', '', 'ru'); assert.equal(op.changes[0].extra.cash, 1300); assert.equal(op.changes[0].delta, 420);
  assert.equal(M.opSet(a, '-5', '', 'ru').ok, false); assert.equal(M.opSet(a, '880', '', 'ru').same, true);
  op = M.opGive(a, b, '300', 'debt', 'en', nameOf);
  assert.equal(op.ok, true); assert.deepEqual(plain(op.changes.map(x => [x.character.id, x.extra.cash, x.delta])), [['p1', 580, -300], ['p2', 800, 300]]);
  assert.match(op.changes[0].extra.walletLog[0].note, /Given to: Rook · debt/); assert.match(op.changes[1].extra.walletLog[0].note, /Received from: Nova/);
  assert.equal(M.opGive(a, b, '5000', '', 'en', nameOf).ok, false); assert.equal(M.opGive(a, null, '5', '', 'en', nameOf).ok, false); assert.equal(M.opGive(a, a, '5', '', 'en', nameOf).ok, false);
  op = M.opSplit([a, b], '1001', '', 'ru'); assert.equal(op.ok, true); assert.deepEqual(plain(op.changes.map(x => x.extra.cash)), [1380, 1000]); assert.match(op.text, /Остаток 1 eb/);
  assert.equal(M.opSplit([], '100', '', 'ru').ok, false); assert.equal(M.opSplit([a, b], '1', '', 'ru').ok, false);
  for (const ch of op.changes) ch.character.extra = ch.extra;
  const back = M.opUndo(op.changes.map(x => ({ character: x.character, delta: x.delta })), 'en');
  assert.equal(back.ok, true); assert.deepEqual(plain(back.changes.map(x => x.extra.cash)), [880, 500]);
  b.extra = { ...b.extra, cash: 100 };
  assert.equal(M.opUndo(op.changes.map(x => ({ character: x.character, delta: x.delta })), 'en').ok, false, 'an undo that would go below zero is refused as a whole');
});

test('chip, row and the next-step banner', () => {
  const fresh = person({ cash: 0, gearBudget: 2550, fashionBudget: 800 });
  let html = M.chipHTML(fresh, 'ru');
  assert.match(html, /data-money-open="p1"/); assert.match(html, /<b>0<\/b>/); assert.match(html, /старт 2 550 · одежда 800/);
  assert.doesNotMatch(M.chipHTML(person(), 'ru'), /<em>/); assert.match(M.chipHTML(person(), 'en'), /Money: 880 eb/);
  assert.match(M.rowHTML(fresh, 'en'), /Starting gear<\/small> <b>2 550 eb/); assert.doesNotMatch(M.rowHTML(person(), 'en'), /Starting/);
  html = M.nextStepHTML(fresh, 'ru'); assert.match(html, /Следующий шаг/); assert.match(html, /2 550 eb на снаряжение и 800 eb на одежду/); assert.match(html, /data-sheet-shop/);
  assert.match(M.nextStepHTML(fresh, 'en'), /Next step: buy your gear/);
  assert.equal(M.nextStepHTML(person(), 'ru'), '', 'no starting budget: nothing to say');
  assert.equal(M.nextStepHTML(person({ gearBudget: 2450, weapons: [{ name: 'x' }] }), 'ru'), '', 'has a weapon');
  assert.equal(M.nextStepHTML(person({ gearBudget: 2450, items: [{ catalogId: 'armor-kevlar' }] }), 'ru'), '', 'has armor');
  assert.equal(M.nextStepHTML(person({ gearBudget: 2450, moneyNextHidden: true }), 'ru'), '');
  assert.equal(M.nextStepHTML(person({ gearBudget: 2450, startingBudgetCompletion: { version: 1 } }), 'ru'), '');
  assert.equal(M.nextStepHTML({ id: 'x' }, 'ru'), ''); assert.equal(M.chipHTML(null, 'ru'), '');
  const evil = person({}, 'p"1', '<img src=x>');
  assert.doesNotMatch(M.panelHTML({ lang: 'en', character: evil, others: [evil], nameOf: c => c.name }), /<img/);
  const panel = M.panelHTML({ lang: 'ru', character: fresh, others: [person({}, 'p2', 'Rook')], nameOf: c => c.name, status: { text: 'ok', ok: true, undo: true } });
  for (const need of ['data-money-do="earn"', 'data-money-do="spend"', 'data-money-do="set"', 'data-money-do="give"', 'data-money-do="split"', 'data-money-do="undo"', 'Стартовое снаряжение: <b>2 550 eb']) assert.ok(panel.includes(need), need);
});

test('shop: starting budgets pay first while they can, cash when they cannot', () => {
  const cart = cartOf(PISTOL);
  assert.equal(SC.pickMode(person({ cash: 0, gearBudget: 2550, fashionBudget: 800 }), cart, CATALOG), 'gearBudget');
  assert.equal(SC.pickMode(person({ cash: 500 }), cart, CATALOG), 'cash');
  assert.equal(SC.pickMode(person({ cash: 500, gearBudget: 10 }), cart, CATALOG), 'cash', 'a budget too small for the cart gives way to cash');
  assert.equal(SC.pickMode(person({ cash: 0, gearBudget: 10 }), cart, CATALOG), 'gearBudget', 'nothing covers: the fuller purse is shown');
  assert.equal(SC.pickMode(person({ cash: 0 }), cart, CATALOG), 'cash');
  assert.equal(SC.pickMode(null, cart, CATALOG), 'cash');
  assert.equal(SC.pickMode(person({ cash: 0, gearBudget: 2550, fashionBudget: 800 }), SC.emptyCart(), CATALOG), 'gearBudget');
  assert.ok(FASHION, 'a fashion item to test with');
  const clothes = cartOf(FASHION.id);
  assert.equal(SC.pickMode(person({ cash: 900, gearBudget: 2550, fashionBudget: 800 }), clothes, CATALOG), 'fashionBudget');
  assert.equal(SC.pickMode(person({ cash: 900, gearBudget: 2550, fashionBudget: 800 }), cartOf(FASHION.id, PISTOL), CATALOG), 'gearBudget', 'a mixed cart cannot use the fashion budget');
  // the offer to switch
  const stuck = { mode: 'cash', lines: cart.lines };
  assert.equal(SC.alternative(person({ cash: 0, gearBudget: 2550 }), stuck, CATALOG), 'gearBudget');
  assert.equal(SC.alternative(person({ cash: 500, gearBudget: 2550 }), stuck, CATALOG), '');
  assert.equal(SC.alternative(person({ cash: 0 }), stuck, CATALOG), '');
});

test('shop bar: sources are buttons, an empty purse offers the wallet, a short cart offers another source', () => {
  const cart = cartOf(PISTOL), fresh = person({ cash: 0, gearBudget: 2550, fashionBudget: 800 });
  let html = SC.moneyHTML({ lang: 'ru', buyer: fresh, plan: SC.plan(fresh, cart, CATALOG, 'ru') });
  assert.match(html, /<button type="button" data-action="cart-mode" data-mode="gearBudget" aria-pressed="false"/); assert.match(html, /shop-add-money" data-money-open="p1"[^>]*>＋ Добавить деньги/);
  const broke = person({ cash: 0 });
  html = SC.moneyHTML({ lang: 'en', buyer: broke, plan: SC.plan(broke, SC.emptyCart(), CATALOG, 'en') }); assert.match(html, />Set money</);
  html = SC.moneyHTML({ lang: 'en', buyer: person(), plan: SC.plan(person(), cart, CATALOG, 'en') }); assert.doesNotMatch(html, /shop-add-money/);
  const p = SC.plan(fresh, cart, CATALOG, 'ru');
  html = SC.panelHTML({ lang: 'ru', buyer: fresh, plan: p, alt: 'gearBudget' });
  assert.match(html, /shop-switch" data-action="cart-mode" data-mode="gearBudget">Оплатить из «Стартовое снаряжение» \(2\s?550 eb\)/);
  // a closed budget is not offered in the select
  const done = person({ cash: 2450 });
  html = SC.panelHTML({ lang: 'ru', buyer: done, plan: SC.plan(done, cart, CATALOG, 'ru') }); assert.doesNotMatch(html, /option value="gearBudget"|option value="fashionBudget"/);
});

function rig(people) {
  const nodes = { '#shop-money': { innerHTML: '' }, '#shop-toggle': { textContent: '', setAttribute() {}, focus() {} }, '#shop-cart': { innerHTML: '', hidden: true }, '#shop-dock': {} };
  const notices = [], saved = [], listeners = {}, box = new Map();
  const doc = { querySelector: sel => nodes[sel] || { focus() {} }, addEventListener: (type, fn) => { listeners[type] = fn; } };
  const world = { buyerId: people[0].id, people };
  const storage = { getItem: k => (box.has(k) ? box.get(k) : null), setItem: (k, v) => box.set(k, v), removeItem: k => box.delete(k) };
  const ctl = SC.controller({ lang: () => 'ru', characters: () => world.people, buyerId: () => world.buyerId, nameOf: c => c.name, catalog: () => CATALOG, scope: () => 's', epoch: () => 1, current: () => true, stale: () => notices.push('STALE'), notify: m => notices.push(m), save: () => saved.push(1), needBuyer() {}, openSheet() {}, document: doc, storage });
  return { ctl, nodes, world, notices, saved, listeners, click: (action, data = {}) => ctl.click(action, { dataset: data }), bar: () => nodes['#shop-money'].innerHTML, panel: () => nodes['#shop-cart'].innerHTML };
}
const paying = html => /data-mode="(\w+)" aria-pressed="true"/.exec(html)?.[1];

test('controller: a fresh character buys from the starting budget straight away', () => {
  const fresh = person({ cash: 0, gearBudget: 2550, fashionBudget: 800 }), r = rig([fresh]);
  r.click('cart-add', { id: PISTOL });
  assert.equal(paying(r.bar()), 'gearBudget'); assert.doesNotMatch(r.bar(), /is-short/);
  r.click('cart-review'); assert.match(r.panel(), /cart-pay/); r.click('cart-pay');
  assert.equal(fresh.extra.gearBudget, 2500); assert.equal(fresh.extra.cash, 0); assert.equal(fresh.extra.weapons.length, 1); assert.equal(r.saved.length, 1);
  assert.equal(fresh.extra.walletLog, undefined, 'a budget purchase is not a cash movement');
});

test('controller: the source does not stick to a closed budget and does not carry to another buyer', () => {
  const fresh = person({ cash: 0, gearBudget: 2550, fashionBudget: 800 }), rook = person({ cash: 500 }, 'p2', 'Rook'), r = rig([fresh, rook]);
  r.click('cart-add', { id: PISTOL });
  r.click('cart-mode', { mode: 'cash' });
  assert.equal(paying(r.bar()), 'cash', 'a choice made by hand is kept'); assert.match(r.bar(), /is-short/);
  r.click('cart-toggle'); assert.match(r.panel(), /shop-switch/);
  r.click('cart-mode', { mode: 'gearBudget' }); assert.equal(paying(r.bar()), 'gearBudget');
  // creation is finished on the sheet: the budget is closed
  fresh.extra = { ...fresh.extra, cash: 2550, gearBudget: 0, fashionBudget: 0, startingBudgetCompletion: { version: 1 } };
  r.ctl.changed();
  assert.equal(paying(r.bar()), 'cash'); assert.doesNotMatch(r.bar(), /is-short|Стартовое/);
  // another buyer gets their own source
  fresh.extra = { ...fresh.extra, cash: 0, gearBudget: 2550 }; delete fresh.extra.startingBudgetCompletion;
  r.ctl.changed(); r.click('cart-mode', { mode: 'gearBudget' }); assert.equal(paying(r.bar()), 'gearBudget');
  r.world.buyerId = 'p2'; r.ctl.changed();
  assert.equal(paying(r.bar()), 'cash'); assert.match(r.bar(), /Останется <b>450 eb/); assert.doesNotMatch(r.bar(), /не указано/);
  // the wallet changed somebody's money: the bar follows
  rook.extra = { ...rook.extra, cash: 20 }; r.listeners['nc-money']();
  assert.match(r.bar(), /is-short/); assert.match(r.bar(), /shop-add-money/);
});

test('controller: cash spent in the shop lands in the wallet ledger', () => {
  const c = person({ cash: 1000 }), r = rig([c]);
  r.click('cart-add', { id: PISTOL }); r.click('cart-add', { id: PISTOL }); r.click('cart-review'); r.click('cart-pay');
  assert.equal(c.extra.cash, 900); assert.equal(c.extra.walletLog.length, 1);
  assert.equal(c.extra.walletLog[0].delta, -100); assert.equal(c.extra.walletLog[0].balance, 900); assert.match(c.extra.walletLog[0].note, /^Каталог: .+ ×2$/);
});

test('wiring: the module is loaded before the shop and the sheet calls into it', () => {
  const index = read('index.html');
  assert.ok(index.indexOf('wallet.js') < index.indexOf('money.js') && index.indexOf('money.js') < index.indexOf('shop-cart.js') && index.indexOf('shop-cart.js') < index.indexOf('"app.js"'));
  assert.match(index, /href="money\.css"/);
  const tabs = read('sheet-tabs.js'); assert.match(tabs, /Money\?\.chipHTML/); assert.match(tabs, /Money\?\.rowHTML/); assert.match(tabs, /Money\?\.nextStepHTML/);
  assert.match(read('character-extra.js'), /Money\.fieldChange\(el,c,key,e\.type,lang\)/);
  assert.doesNotMatch(read('money.js'), /\b(confirm|alert|prompt)\(/);
});
