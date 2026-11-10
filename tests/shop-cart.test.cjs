// Catalog shopping cart (site/shop-cart.js): pure cart logic, HTML builders and the controller.
const { test } = require('node:test'), assert = require('node:assert/strict'), fs = require('node:fs'), vm = require('node:vm');
const read = name => fs.readFileSync(__dirname + '/../site/' + name, 'utf8');
const plain = value => JSON.parse(JSON.stringify(value));

function load() {
  let n = 0;
  const w = {}, ctx = { window: w, globalThis: { crypto: { randomUUID: () => 'id-' + (++n) } }, console, Math, JSON, Set, Map, Number, String, Array, Object, Date };
  vm.createContext(ctx);
  for (const file of ['catalog.js', 'catalog-extra.js', 'character-extra.js', 'equipment-tools.js', 'shop-cart.js']) vm.runInContext(read(file), ctx);
  return w;
}
const W = load(), SC = W.ShopCart, CATALOG = W.CATALOG;
const item = id => { const found = CATALOG.find(x => x.id === id); assert.ok(found, 'catalog item ' + id); return found; };
const person = (extra = {}) => ({ id: 'p1', name: 'Nova', role: 'solo', stats: { EMP: 6 }, skills: {}, hp: 40, humanity: 60, extra: { cash: 1000, gearBudget: 0, fashionBudget: 0, items: [], weapons: [], ...extra } });
const cartOf = (...ids) => { const cart = SC.emptyCart(); for (const id of ids) assert.equal(SC.add(cart, item(id), 'en').ok, true, id); return cart; };
const PISTOL = 'weapon-medium-pistol', HEAVY = 'weapon-heavy-pistol', AMMO = 'ammo-basic-ammunition', CHIP = 'cyberware-skill-chip', LINK = 'cyberware-neural-link';

test('totals: lines are priced in order and the plan reports what is paid and what remains', () => {
  const cart = cartOf(PISTOL, PISTOL, HEAVY), p = SC.plan(person(), cart, CATALOG, 'en');
  assert.equal(cart.lines.length, 2, 'the same item joins its line');
  assert.equal(p.ok, true); assert.equal(p.count, 3); assert.equal(p.total, 200); assert.equal(p.available, 1000); assert.equal(p.remaining, 800); assert.equal(p.mode, 'cash');
  assert.deepEqual(plain(p.lines.map(l => [l.itemId, l.quantity, l.unitPrice, l.total, l.ok])), [[PISTOL, 2, 50, 100, true], [HEAVY, 1, 100, 100, true]]);
  assert.equal(SC.toggleText('en', p), 'Cart: 3 · 200 eb'); assert.equal(SC.toggleText('ru', p), 'Корзина: 3 · 200 eb');
});

test('quantity limits: 1 to 50 per line, 50 lines per cart, per-room items start at their minimum', () => {
  const cart = cartOf(PISTOL), key = cart.lines[0].itemId + '||';
  SC.setQuantity(cart, key, 999, CATALOG); assert.equal(cart.lines[0].quantity, 50);
  const more = SC.add(cart, item(PISTOL), 'en'); assert.equal(more.ok, false); assert.equal(more.reason, 'maxQty'); assert.equal(cart.lines[0].quantity, 50);
  for (const bad of [0, -3, 'x', NaN, 1.9]) { SC.setQuantity(cart, key, bad, CATALOG); assert.equal(cart.lines[0].quantity, 1, String(bad)); }
  assert.equal(SC.setQuantity(cart, 'no-such-line', 2, CATALOG), false);
  const rooms = CATALOG.find(x => x.priceUnit?.en === 'per room' && x.stats?.minRooms > 1 && SC.buyable(x));
  if (rooms) { const c2 = cartOf(rooms.id); assert.equal(c2.lines[0].quantity, rooms.stats.minRooms); SC.setQuantity(c2, SC.lineKey(c2.lines[0]), 1, CATALOG); assert.equal(c2.lines[0].quantity, rooms.stats.minRooms); }
  const full = SC.emptyCart(), buyables = CATALOG.filter(SC.buyable);
  assert.ok(buyables.length > 60);
  for (const x of buyables.slice(0, 50)) assert.equal(SC.add(full, x, 'en').ok, true);
  const over = SC.add(full, buyables[55], 'ru'); assert.equal(over.ok, false); assert.equal(over.reason, 'full'); assert.equal(full.lines.length, 50); assert.match(over.message, /максимум/);
});

test('items that cannot be bought are refused with the shop reason and never enter the cart', () => {
  const service = CATALOG.find(x => x.category === 'services'), unpriced = CATALOG.find(x => x.price == null && x.category === 'gear') || CATALOG.find(x => x.price == null);
  for (const x of [service, unpriced].filter(Boolean)) {
    const cart = SC.emptyCart(), r = SC.add(cart, x, 'en');
    assert.equal(r.ok, false); assert.ok(r.message.length > 10); assert.equal(cart.lines.length, 0); assert.equal(SC.buyable(x), false);
  }
  assert.equal(SC.add(SC.emptyCart(), null, 'en').ok, false);
  assert.equal(SC.buyable(item(PISTOL)), true); assert.equal(SC.buyable(item(AMMO)), true); assert.equal(SC.buyable(item(CHIP)), true);
  // The card shows the cart button only where the cart can take the item; the free add is always there.
  const html = W.renderCatalog('ru', '', 'all', Infinity);
  assert.match(html, /data-action="cart-add" data-id="weapon-medium-pistol"/); assert.match(html, />В корзину</); assert.match(html, />Добавить бесплатно</);
  assert.doesNotMatch(html, new RegExp('data-action="cart-add" data-id="' + service.id + '"')); assert.match(html, new RegExp('data-action="catalog-add" data-id="' + service.id + '"'));
  assert.doesNotMatch(html, /catalog-buy/);
  assert.match(W.renderCatalog('en', 'Medium Pistol', 'weapon'), />Add to cart<[\s\S]*>Add for free</);
});

test('insufficient budget: the line that passes the budget is marked, the shortfall is negative, checkout pays nothing', () => {
  const c = person({ cash: 120 }), cart = cartOf(PISTOL, HEAVY, PISTOL), before = plain(c);
  const p = SC.plan(c, cart, CATALOG, 'en');
  assert.equal(p.ok, false); assert.equal(p.total, 200); assert.equal(p.remaining, -80);
  assert.deepEqual(plain(p.lines.map(l => [l.ok, l.reason])), [[true, ''], [false, 'noFunds']]);
  assert.match(p.lines[1].message, /does not stretch to this line/); assert.match(p.blockers[0].message, /^Short by 80 eb/); assert.equal(p.blockers[0].reason, 'noFunds'); assert.equal(p.blockers[0].key, HEAVY + '||');
  assert.match(SC.moneyHTML({ lang: 'ru', buyer: c, plan: SC.plan(c, cart, CATALOG, 'ru') }), /shop-after is-short[^>]*>Не хватает <b>80 eb/);
  const r = SC.checkout(c, cart, CATALOG, 'en', { confirmed: true, signature: p.signature });
  assert.equal(r.ok, false); assert.equal(r.reason, 'noFunds'); assert.deepEqual(plain(c), before);
});

test('a budget that is missing or not a whole number is reported, never shown as NaN', () => {
  for (const cash of [undefined, '500', 12.5, -1, null]) {
    const c = person({ cash }), cart = cartOf(PISTOL), p = SC.plan(c, cart, CATALOG, 'en');
    assert.equal(p.ok, false); assert.equal(p.available, null); assert.equal(p.remaining, null); assert.equal(p.blockers[0].reason, 'badFunds');
    const html = SC.moneyHTML({ lang: 'en', buyer: c, plan: p }) + SC.panelHTML({ lang: 'en', buyer: c, plan: p });
    assert.doesNotMatch(html, /NaN|undefined|null eb/); assert.match(html, /not set/);
  }
  const none = SC.plan({ id: 'x' }, cartOf(PISTOL), CATALOG, 'ru'); assert.equal(none.blockers[0].reason, 'badFunds');
});

test('all-or-nothing checkout: every line is bought with one assignment, or the character stays deep-equal', () => {
  const c = person({ cash: 1000 }), cart = cartOf(PISTOL, PISTOL, HEAVY);
  const p = SC.plan(c, cart, CATALOG, 'en'), oldExtra = c.extra;
  assert.equal(SC.checkout(c, cart, CATALOG, 'en', { signature: p.signature }).reason, 'confirmNeeded'); assert.equal(c.extra, oldExtra);
  const r = SC.checkout(c, cart, CATALOG, 'en', { confirmed: true, signature: p.signature });
  assert.equal(r.ok, true); assert.equal(r.dirty, true); assert.equal(r.total, 200); assert.equal(r.remaining, 800); assert.equal(r.mode, 'cash');
  assert.notEqual(c.extra, oldExtra); assert.equal(c.extra.cash, 800); assert.equal(c.extra.weapons.length, 3, 'weapons are one record per copy');
  assert.deepEqual(plain(c.extra.weapons.map(x => x.purchase.total)), [50, 50, 100]); assert.equal(r.created.length, 3); assert.equal(r.bought.length, 2);
  // A failure on a later line: nothing of the earlier lines stays.
  const d = person({ cash: 1000 }), broken = cartOf(PISTOL, HEAVY), good = SC.plan(d, broken, CATALOG, 'en'), snapshot = plain(d), extra = d.extra;
  const ET = W.EquipmentTools, real = ET.purchase; let calls = 0;
  ET.purchase = (...a) => (++calls === 2 ? { ok: false, reason: 'purchaseFail', message: 'boom' } : real(...a));
  try {
    const f = SC.checkout(d, broken, CATALOG, 'en', { confirmed: true, signature: good.signature });
    assert.equal(f.ok, false); assert.equal(f.reason, 'purchaseFail'); assert.equal(f.key, HEAVY + '||'); assert.match(f.message, /Heavy Pistol: boom/);
  } finally { ET.purchase = real; }
  assert.equal(calls, 2); assert.equal(d.extra, extra); assert.deepEqual(plain(d), snapshot);
});

test('stale checkout: a changed budget, cart or buyer no longer matches the reviewed summary', () => {
  const c = person(), cart = cartOf(PISTOL), p = SC.plan(c, cart, CATALOG, 'en');
  c.extra.cash = 900; let before = plain(c);
  assert.equal(SC.checkout(c, cart, CATALOG, 'en', { confirmed: true, signature: p.signature }).reason, 'stale'); assert.deepEqual(plain(c), before);
  const p2 = SC.plan(c, cart, CATALOG, 'en'); SC.add(cart, item(PISTOL), 'en');
  assert.equal(SC.checkout(c, cart, CATALOG, 'en', { confirmed: true, signature: p2.signature }).reason, 'stale');
  const other = { ...person(), id: 'p2' }, p3 = SC.plan(c, cart, CATALOG, 'en'); before = plain(other);
  assert.equal(SC.checkout(other, cart, CATALOG, 'en', { confirmed: true, signature: p3.signature }).reason, 'stale'); assert.deepEqual(plain(other), before);
  // A changed catalog price is caught too.
  const copy = plain(CATALOG), p4 = SC.plan(c, cart, copy, 'en'); copy.find(x => x.id === PISTOL).price = 60;
  assert.equal(SC.checkout(c, cart, copy, 'en', { confirmed: true, signature: p4.signature }).reason, 'stale'); assert.equal(c.extra.cash, 900);
  assert.equal(SC.checkout(c, SC.emptyCart(), CATALOG, 'en', { confirmed: true, signature: '' }).reason, 'empty');
  assert.equal(SC.checkout(null, cart, CATALOG, 'en', { confirmed: true, signature: '' }).reason, 'noBuyer');
});

test('re-pricing on buyer change: the same lines are valued against the new buyer and blocked lines carry the reason', () => {
  const cart = cartOf(PISTOL, 'cyberware-neural-link'), rich = person({ cash: 5000 }), poor = { ...person({ cash: 60 }), id: 'p2' }, nobody = null;
  const a = SC.plan(rich, cart, CATALOG, 'en'), b = SC.plan(poor, cart, CATALOG, 'en'), n = SC.plan(nobody, cart, CATALOG, 'ru');
  assert.equal(a.ok, true); assert.equal(a.remaining, 4450);
  assert.equal(b.ok, false); assert.equal(b.total, 550); assert.equal(b.remaining, -490); assert.equal(b.lines[0].ok, true); assert.equal(b.lines[1].reason, 'noFunds');
  assert.equal(n.ok, false); assert.equal(n.total, 550); assert.equal(n.available, null); assert.equal(n.blockers[0].reason, 'noBuyer'); assert.match(n.blockers[0].message, /выберите/i);
  assert.notEqual(a.signature, b.signature); assert.equal(cart.lines.length, 2, 'lines are kept');
  // The fashion budget only takes fashion: other lines say so.
  SC.setMode(cart, 'fashionBudget');
  const f = SC.plan(person({ fashionBudget: 800 }), cart, CATALOG, 'en');
  assert.equal(f.mode, 'fashionBudget'); assert.equal(f.lines[0].reason, 'badBudget'); assert.match(f.lines[0].message, /budget cannot be used/i); assert.equal(f.ok, false);
  assert.equal(SC.setMode(cart, 'bank'), false); assert.equal(cart.mode, 'fashionBudget');
  // An inventory that is already full blocks the line for that buyer only.
  SC.setMode(cart, 'cash');
  const stuffed = person({ cash: 5000, items: Array.from({ length: 500 }, (_, i) => ({ id: 'i' + i })) }), s = SC.plan(stuffed, cart, CATALOG, 'en');
  assert.equal(s.ok, false); assert.equal(s.lines[0].reason, 'badQuantity'); assert.equal(s.lines[1].reason, 'badQuantity'); assert.equal(SC.plan(rich, cart, CATALOG, 'en').ok, true);
});

test('ammo and Skill Chip options live on the line; a missing type blocks checkout with the shop message', () => {
  const cart = SC.emptyCart(), first = SC.add(cart, item(AMMO), 'en');
  assert.equal(first.ok, true); assert.equal(first.needsOption, true); assert.equal(first.key, AMMO + '||');
  const c = person({ cash: 3000 });
  let p = SC.plan(c, cart, CATALOG, 'en'); assert.equal(p.ok, false); assert.equal(p.lines[0].reason, 'ammoManual'); assert.equal(p.lines[0].total, null);
  assert.match(SC.panelHTML({ lang: 'ru', buyer: c, plan: SC.plan(c, cart, CATALOG, 'ru') }), /data-cart-option="ammo-basic-ammunition\|\|"[^>]*aria-invalid="true"/);
  const key = SC.setOption(cart, first.key, 'medium-pistol', CATALOG); assert.equal(key, AMMO + '|medium-pistol|');
  assert.equal(SC.setOption(cart, key, 'not-a-type', CATALOG), AMMO + '||', 'an unknown type clears the choice'); SC.setOption(cart, AMMO + '||', 'medium-pistol', CATALOG);
  SC.setQuantity(cart, key, 2, CATALOG);
  // A second line of the same item with another type; choosing the same type merges them.
  SC.add(cart, item(AMMO), 'en'); assert.equal(cart.lines.length, 2); SC.setOption(cart, AMMO + '||', 'arrow', CATALOG);
  p = SC.plan(c, cart, CATALOG, 'en');
  assert.equal(p.ok, true); assert.equal(p.lines[0].ammoCount, 20); assert.equal(p.lines[1].ammoCount, 10); assert.equal(p.total, 30); assert.match(p.lines[0].notes[0], /Medium Pistol.*20 units/);
  assert.equal(SC.setOption(cart, AMMO + '|arrow|', 'medium-pistol', CATALOG), key); assert.equal(cart.lines.length, 1); assert.equal(cart.lines[0].quantity, 3);
  // An ammo item with a single possible type needs no choice; grenades are sold one at a time.
  const smoke = SC.emptyCart(), one = SC.add(smoke, item('ammo-smoke-ammunition'), 'en');
  assert.equal(one.needsOption, false); assert.equal(smoke.lines[0].ammoType, 'grenade'); assert.equal(SC.plan(c, smoke, CATALOG, 'en').lines[0].ammoCount, 1);
  SC.add(cart, item(CHIP), 'en'); assert.equal(SC.plan(c, cart, CATALOG, 'en').lines[1].reason, 'skillChipManual');
  SC.setOption(cart, CHIP + '||', 'double', CATALOG);
  p = SC.plan(c, cart, CATALOG, 'en'); assert.equal(p.lines[1].unitPrice, 1000); assert.equal(p.total, 1030); assert.match(p.lines[1].notes.join(' '), /specific skill/);
  const r = SC.checkout(c, cart, CATALOG, 'en', { confirmed: true, signature: p.signature });
  assert.equal(r.ok, true); assert.equal(c.extra.cash, 1970);
  const ammo = c.extra.items.find(x => x.ammoType === 'medium-pistol'), chip = c.extra.items.find(x => x.skillChipType === 'double');
  assert.equal(ammo.quantity, 30); assert.equal(ammo.purchase.total, 30); assert.equal(chip.purchase.unitPrice, 1000); assert.equal(chip.purchase.installationIncluded, true);
});

test('cyberware: the review states the Humanity loss and installation, and buying leaves Humanity alone', () => {
  const c = person({ cash: 2000 }), cart = cartOf(LINK), p = SC.plan(c, cart, CATALOG, 'en');
  assert.equal(p.lines[0].humanityLoss, '2d6'); assert.equal(p.lines[0].installation, 'Clinic');
  const en = SC.panelHTML({ lang: 'en', buyer: c, buyerName: 'Nova', plan: p, review: true, open: true });
  assert.match(en, /Review the purchase/); assert.match(en, /Buyer: <b>Nova<\/b>/); assert.match(en, /Humanity loss on installation: 2d6 · installation: Clinic/); assert.match(en, /Buying does not change Humanity/);
  assert.match(en, /500 eb will be paid from “Cash”\. It holds 2000 eb now and 1500 eb will remain\./); assert.match(en, /data-action="cart-pay"[^>]*>Pay 500 eb</); assert.match(en, /data-action="cart-back"/);
  const ru = SC.panelHTML({ lang: 'ru', buyer: c, buyerName: 'Нова', plan: SC.plan(c, cart, CATALOG, 'ru'), review: true, open: true });
  assert.match(ru, /Проверьте покупку/); assert.match(ru, /Потеря Humanity при установке: 2d6/); assert.match(ru, /Будет списано 500 eb из бюджета «Деньги»\. Сейчас там 2000 eb, останется 1500 eb\./); assert.match(ru, />Оплатить 500 eb</);
  const r = SC.checkout(c, cart, CATALOG, 'en', { confirmed: true, signature: p.signature });
  assert.equal(r.ok, true); assert.equal(c.humanity, 60); assert.equal(c.extra.equipment, undefined); assert.equal(c.extra.cash, 1500); assert.equal(c.extra.items[0].purchase.installationIncluded, true);
  // A blocked cart never shows the payment step, even if a review was asked for.
  const poor = person({ cash: 10 }), blocked = SC.panelHTML({ lang: 'en', buyer: poor, plan: SC.plan(poor, cartOf(LINK), CATALOG, 'en'), review: true, open: true });
  assert.doesNotMatch(blocked, /cart-pay/); assert.match(blocked, /The purchase cannot be completed: Short by 490 eb in the chosen budget\./);
});

test('persistence: own key, a small versioned shape, and anything malformed is dropped on load', () => {
  assert.equal(SC.KEY, 'nightcity-red-cart-v1'); assert.notEqual(SC.KEY, 'nightcity-red-v1');
  const cart = cartOf(PISTOL, AMMO); SC.setOption(cart, AMMO + '||', 'medium-pistol', CATALOG); SC.setMode(cart, 'gearBudget');
  const box = new Map(), storage = { getItem: k => (box.has(k) ? box.get(k) : null), setItem: (k, v) => box.set(k, v), removeItem: k => box.delete(k) };
  assert.equal(SC.store(storage, cart), true);
  assert.deepEqual([...box.keys()], [SC.KEY]);
  assert.deepEqual(JSON.parse(box.get(SC.KEY)), { v: 1, mode: 'gearBudget', lines: [{ itemId: PISTOL, quantity: 1 }, { itemId: AMMO, quantity: 1, ammoType: 'medium-pistol' }] });
  assert.deepEqual(plain(SC.load(storage, CATALOG)), plain(cart));
  box.set(SC.KEY, JSON.stringify({ v: 1, mode: 'bank', lines: [{ itemId: 'no-such-item', quantity: 2 }, null, 7, { itemId: PISTOL, quantity: 1e9, ammoType: 'medium-pistol', extra: { cash: 1 } }, { itemId: PISTOL, quantity: 2 }, { itemId: AMMO, quantity: -4, ammoType: 'rocket-from-mars' }, { itemId: CHIP, skillChipType: 'double', __proto__: { x: 1 } }] }));
  assert.deepEqual(plain(SC.load(storage, CATALOG)), { mode: 'cash', lines: [{ itemId: PISTOL, quantity: 50 }, { itemId: AMMO, quantity: 1 }, { itemId: CHIP, quantity: 1, skillChipType: 'double' }] });
  for (const junk of ['{', '[]', '"x"', 'null', '{"lines":{"length":3}}', JSON.stringify({ characters: [{ id: 'p1' }], lang: 'en' })]) { box.set(SC.KEY, junk); assert.deepEqual(plain(SC.load(storage, CATALOG)), { mode: 'cash', lines: [] }); }
  assert.deepEqual(plain(SC.load({ getItem() { throw Error('blocked'); } }, CATALOG)), { mode: 'cash', lines: [] });
  assert.equal(SC.store({ setItem() { throw Error('full'); } }, cart), false); assert.equal(SC.store(null, cart), true);
  SC.store(storage, SC.emptyCart()); assert.equal(box.size, 0, 'an empty cart leaves nothing behind');
  assert.deepEqual(plain(SC.sanitize({ lines: Array.from({ length: 80 }, (_, i) => ({ itemId: CATALOG.filter(SC.buyable)[i].id, quantity: 1 })) }, CATALOG)).lines.length, 50);
});

test('RU and EN strings: every key exists in both languages and the panel has no stray placeholders', () => {
  const src = read('shop-cart.js'), block = lang => src.slice(src.indexOf(`    ${lang}: {`), src.indexOf('\n    }', src.indexOf(`    ${lang}: {`)));
  const keys = text => [...text.matchAll(/(?:^|[,{]\s*)([a-zA-Z]+): (?=['(a-z])/gm)].map(m => m[1]).sort();
  const ru = keys(block('ru')), en = keys(block('en'));
  assert.ok(ru.length > 45); assert.deepEqual(ru, en);
  for (const key of ru) for (const lang of ['ru', 'en']) { const v = SC.text(lang, key, 1, 2, 3, 4); assert.equal(typeof v, 'string', key); assert.ok(v.length > 0, key); assert.doesNotMatch(v, /undefined|NaN/, key); }
  for (const key of ru) { const a = SC.text('ru', key, 1, 2, 3, 4), b = SC.text('en', key, 1, 2, 3, 4); assert.match(a, /[а-яё]/i, 'RU text for ' + key); assert.doesNotMatch(b, /[а-яё]/i, 'EN text for ' + key); }
  assert.doesNotMatch(block('ru'), /\b(ты|тебя|твой|выбери|нажми)\b/i, 'formal address');
  const c = person(), cart = cartOf(PISTOL, AMMO, LINK);
  for (const lang of ['ru', 'en']) for (const review of [false, true]) {
    const view = { lang, buyer: c, buyerName: 'Nova', characters: [c], nameOf: x => x.name, plan: SC.plan(c, cart, CATALOG, lang), open: true, review };
    const html = SC.shellHTML(view);
    assert.doesNotMatch(html, /undefined|NaN|\[object/); assert.match(html, /id="catalog-target"/); assert.match(html, /id="shop-money" role="status" aria-live="polite"/); assert.match(html, /aria-expanded="true" aria-controls="shop-cart"/);
  }
  const empty = SC.shellHTML({ lang: 'ru', buyer: null, characters: [], plan: SC.plan(null, SC.emptyCart(), CATALOG, 'ru'), open: false });
  assert.match(empty, /Выберите, кто покупает/); assert.match(empty, />Корзина пуста</); assert.match(empty, /id="shop-cart"[^>]* hidden/); assert.match(empty, /select id="catalog-target" class="is-empty"/);
  // Names are escaped wherever they are printed.
  const evil = { ...person(), name: '<img src=x onerror=1>' }, shown = SC.shellHTML({ lang: 'en', buyer: evil, buyerName: evil.name, characters: [evil], nameOf: x => x.name, plan: SC.plan(evil, cart, CATALOG, 'en'), open: true, review: false });
  assert.doesNotMatch(shown, /<img/);
});

test('money bar: cash always, starting budgets only when they hold money or are being paid from', () => {
  const cart = cartOf(PISTOL), bar = (c, lang = 'en') => SC.moneyHTML({ lang, buyer: c, plan: SC.plan(c, cart, CATALOG, lang) });
  let html = bar(person({ cash: 300 }));
  assert.match(html, /Cash<\/span> <b>300 eb/); assert.doesNotMatch(html, /Starting gear|Starting fashion/); assert.match(html, /Left after <b>250 eb/); assert.doesNotMatch(html, /is-short/);
  html = bar(person({ cash: 300, gearBudget: 2550, fashionBudget: 800 }), 'ru');
  assert.match(html, /Деньги<\/span> <b>300 eb/); assert.match(html, /Стартовое снаряжение<\/span> <b>2550 eb/); assert.match(html, /Стартовая одежда<\/span> <b>800 eb/); assert.match(html, /Останется <b>250 eb/);
  SC.setMode(cart, 'gearBudget');
  html = bar(person({ cash: 300 })); assert.match(html, /is-paying[^>]*><span class="shop-chip-name">Starting gear<\/span> <b>0 eb/); assert.match(html, /Short by <b>50 eb/);
  assert.match(SC.moneyHTML({ lang: 'en', buyer: null, plan: SC.plan(null, cart, CATALOG, 'en') }), /Choose who is buying/);
  assert.deepEqual(plain(SC.budgets(person({ cash: 5, gearBudget: 'x' }))), { cash: 5, gearBudget: null, fashionBudget: 0 });
});

// ---- Controller, driven with a stub DOM ----
function rig(options = {}) {
  const nodes = { '#shop-money': { innerHTML: '' }, '#shop-toggle': { textContent: '', attrs: {}, setAttribute(k, v) { this.attrs[k] = v; } }, '#shop-cart': { innerHTML: '', hidden: true }, '#shop-dock': {} };
  const focused = [], notices = [], saved = [], opened = [], box = new Map(), listeners = {};
  const doc = { querySelector: sel => nodes[sel] || { focus: () => focused.push(sel) }, addEventListener: (type, fn) => { listeners[type] = fn; } };
  for (const sel of ['#shop-toggle']) nodes[sel].focus = () => focused.push(sel);
  const people = options.people || [person({ cash: 1000 }), { ...person({ cash: 40 }), id: 'p2', name: 'Rook' }];
  const world = { lang: 'en', buyerId: 'p1', scope: 'account', epoch: 1, people };
  const storage = { getItem: k => (box.has(k) ? box.get(k) : null), setItem: (k, v) => box.set(k, v), removeItem: k => box.delete(k) };
  if (options.stored) box.set(SC.KEY, JSON.stringify(options.stored));
  const ctl = SC.controller({ lang: () => world.lang, characters: () => world.people, buyerId: () => world.buyerId, nameOf: c => c.name, catalog: () => CATALOG, scope: () => world.scope, epoch: () => world.epoch, current: (c, scope) => !!scope && scope === world.scope && world.people.includes(c), stale: () => notices.push('STALE'), notify: m => notices.push(m), save: () => saved.push(plain(world.people)), needBuyer: () => notices.push('NEED BUYER'), openSheet: id => opened.push(id), document: doc, storage });
  const click = (action, data = {}) => ctl.click(action, { dataset: data });
  return { ctl, nodes, focused, notices, saved, opened, box, world, listeners, click, panel: () => nodes['#shop-cart'].innerHTML, bar: () => nodes['#shop-money'].innerHTML, toggle: () => nodes['#shop-toggle'].textContent };
}

test('controller: add, change quantity, review, pay — the bar, the cart, storage and the character all follow', () => {
  const r = rig();
  r.click('cart-add', { id: PISTOL }); r.click('cart-add', { id: HEAVY });
  assert.equal(r.toggle(), 'Cart: 2 · 150 eb'); assert.match(r.bar(), /Cash<\/span> <b>1000 eb/); assert.match(r.bar(), /Left after <b>850 eb/); assert.match(r.notices.at(-1), /Added to cart: Heavy Pistol/);
  assert.equal(JSON.parse(r.box.get(SC.KEY)).lines.length, 2); assert.equal(r.nodes['#shop-cart'].hidden, true);
  r.click('cart-toggle'); assert.equal(r.nodes['#shop-cart'].hidden, false); assert.equal(r.nodes['#shop-toggle'].attrs['aria-expanded'], 'true'); assert.equal(r.focused.at(-1), '#shop-cart-title', 'opening moves focus into the panel');
  r.click('cart-inc', { key: PISTOL + '||' }); assert.equal(r.toggle(), 'Cart: 3 · 200 eb'); assert.match(r.panel(), /50 eb × 2 = <b>100 eb/); assert.match(r.panel(), /Total: <b>200 eb/); assert.match(r.panel(), /Left after: <b>800 eb/);
  r.ctl.field({ dataset: { cartQty: HEAVY + '||' }, value: '3' }); assert.equal(r.toggle(), 'Cart: 5 · 400 eb');
  r.click('cart-dec', { key: HEAVY + '||' }); assert.equal(r.toggle(), 'Cart: 4 · 300 eb');
  r.click('cart-review'); assert.match(r.panel(), /Review the purchase/); assert.match(r.panel(), /300 eb will be paid from “Cash”\. It holds 1000 eb now and 700 eb will remain\./); assert.equal(r.saved.length, 0); assert.equal(r.world.people[0].extra.cash, 1000);
  r.click('cart-pay');
  assert.equal(r.saved.length, 1); assert.equal(r.world.people[0].extra.cash, 700); assert.equal(r.world.people[0].extra.weapons.length, 4);
  assert.equal(r.toggle(), 'Cart is empty'); assert.equal(r.box.has(SC.KEY), false); assert.equal(r.ctl.cart.lines.length, 0);
  assert.match(r.bar(), /Cash<\/span> <b>700 eb/); assert.doesNotMatch(r.bar(), /Left after/);
  assert.match(r.notices.at(-1), /Bought: 2 line\(s\) for 300 eb\. “Cash” has 700 eb left\./);
  assert.match(r.panel(), /Purchase complete/); assert.match(r.panel(), /data-action="cart-open-sheet" data-id="p1"[^>]*>Open sheet: Nova</);
  r.click('cart-open-sheet', { id: 'p1' }); assert.deepEqual(r.opened, ['p1']);
  r.click('cart-pay'); assert.equal(r.saved.length, 1, 'a second payment does nothing'); assert.equal(r.notices.at(-1), 'STALE');
});

test('controller: changing the buyer keeps the lines, re-prices them and marks what the new buyer cannot afford', () => {
  const r = rig(); r.click('cart-add', { id: PISTOL }); r.click('cart-add', { id: HEAVY }); r.click('cart-toggle');
  r.world.buyerId = 'p2'; r.ctl.changed();
  assert.equal(r.ctl.cart.lines.length, 2); assert.match(r.bar(), /Cash<\/span> <b>40 eb/); assert.match(r.bar(), /Short by <b>110 eb/);
  assert.match(r.panel(), /shop-line is-bad/); assert.match(r.panel(), /The chosen budget does not stretch to this line/); assert.match(r.panel(), /cannot be completed: Short by 110 eb in the chosen budget/);
  r.click('cart-review'); assert.match(r.notices.at(-1), /cannot be completed: Short by 110 eb/); assert.doesNotMatch(r.panel(), /cart-pay/); assert.equal(r.saved.length, 0);
  r.world.buyerId = ''; r.ctl.changed(); assert.match(r.bar(), /Choose who is buying/); assert.equal(r.toggle(), 'Cart: 2 · 150 eb');
  r.click('cart-review'); assert.equal(r.notices.at(-1), 'NEED BUYER');
  r.world.buyerId = 'p1'; r.ctl.changed(); r.click('cart-review'); assert.match(r.panel(), /cart-pay/);
});

test('controller: a stale buyer, scope or data between review and payment buys nothing', () => {
  const cases = { scope: r => { r.world.scope = 'other'; }, epoch: r => { r.world.epoch++; }, replaced: r => { r.world.people = plain(r.world.people); }, buyer: r => { r.world.buyerId = 'p2'; }, edited: r => { r.click('cart-inc', { key: PISTOL + '||' }); }, budget: r => { r.world.people[0].extra.cash = 999; }, mode: r => { r.ctl.setMode('gearBudget'); } };
  for (const [name, mutate] of Object.entries(cases)) {
    const r = rig(); r.click('cart-add', { id: PISTOL }); r.click('cart-review'); assert.match(r.panel(), /cart-pay/, name);
    mutate(r); r.click('cart-pay');
    assert.equal(r.saved.length, 0, name); assert.ok(r.world.people.every(c => c.extra.weapons.length === 0), name); assert.ok(r.ctl.cart.lines.length >= 1, name + ': the cart is kept');
    assert.match(String(r.notices.at(-1)), /STALE|changed/, name); assert.doesNotMatch(r.panel(), /cart-pay/, name);
  }
  const r = rig(); r.world.scope = null; r.click('cart-add', { id: PISTOL }); r.click('cart-review'); assert.equal(r.notices.at(-1), 'STALE'); assert.doesNotMatch(r.panel(), /cart-pay/);
});

test('controller: Escape and close return focus to the cart button; remove and clear keep the keyboard in the panel', () => {
  const r = rig(); r.click('cart-add', { id: PISTOL }); r.click('cart-add', { id: HEAVY });
  assert.equal(r.ctl.key({ key: 'Escape' }), false, 'nothing to close');
  r.click('cart-toggle'); r.click('cart-review');
  let prevented = 0; r.listeners.keydown({ key: 'Escape', preventDefault: () => prevented++ });
  assert.equal(prevented, 1); assert.equal(r.ctl.state().review, false); assert.equal(r.ctl.state().open, true, 'first Escape leaves the review'); assert.equal(r.focused.at(-1), '[data-action="cart-review"]');
  assert.equal(r.ctl.key({ key: 'Escape' }), true); assert.equal(r.ctl.state().open, false); assert.equal(r.nodes['#shop-cart'].hidden, true); assert.equal(r.focused.at(-1), '#shop-toggle');
  assert.equal(r.ctl.key({ key: 'Enter' }), false);
  r.click('cart-toggle'); r.click('cart-remove', { key: PISTOL + '||' });
  assert.equal(r.ctl.cart.lines.length, 1); assert.equal(r.focused.at(-1), `[data-action="cart-remove"][data-key="${HEAVY}||"]`); assert.match(r.notices.at(-1), /Removed from cart: Medium Pistol/);
  r.click('cart-clear'); assert.equal(r.ctl.cart.lines.length, 0); assert.equal(r.box.has(SC.KEY), false); assert.match(r.panel(), /The cart is empty/); assert.equal(r.focused.at(-1), '#shop-cart-title');
  r.click('cart-close'); assert.equal(r.focused.at(-1), '#shop-toggle');
  assert.equal(r.ctl.click('navigate', {}), false, 'other actions are not swallowed');
});

test('controller: an ammo line opens the cart on its type select; the cart is restored from storage and survives a missing DOM', () => {
  const r = rig(); r.click('cart-add', { id: AMMO });
  assert.equal(r.ctl.state().open, true); assert.equal(r.focused.at(-1), `[data-cart-option="${AMMO}||"]`); assert.match(r.notices.at(-1), /Choose a type in the cart/);
  r.ctl.field({ dataset: { cartOption: AMMO + '||' }, value: 'medium-pistol' }); assert.equal(r.ctl.cart.lines[0].ammoType, 'medium-pistol'); assert.equal(r.focused.at(-1), `[data-cart-option="${AMMO}|medium-pistol|"]`);
  const again = rig({ stored: JSON.parse(r.box.get(SC.KEY)) }); assert.equal(again.ctl.cart.lines.length, 1); assert.match(again.ctl.shell(), /Cart: 1 · 10 eb/);
  // No document at all (unit harnesses): nothing throws, and the logic still works.
  const solo = [person()], bare = SC.controller({ lang: () => 'ru', characters: () => solo, buyerId: () => 'p1', nameOf: c => c.name, catalog: () => CATALOG, scope: () => 's', epoch: () => 1, current: () => true, stale() {}, notify() {}, save() {}, needBuyer() {}, openSheet() {}, document: null, storage: null });
  bare.click('cart-add', { dataset: { id: PISTOL } }); bare.click('cart-review', { dataset: {} }); bare.click('cart-pay', { dataset: {} }); assert.equal(bare.cart.lines.length, 0); assert.equal(solo[0].extra.cash, 950);
  assert.match(bare.shell(), /Корзина пуста/);
});

test('wiring: index.html loads the cart before app.js and its stylesheet after the theme sheets; app.js has one way to pay', () => {
  const index = read('index.html'), app = read('app.js');
  assert.ok(index.indexOf('<script src="shop-cart.js">') > 0 && index.indexOf('<script src="shop-cart.js">') < index.indexOf('<script src="app.js">'));
  assert.ok(index.indexOf('href="shop-cart.css"') > index.indexOf('href="board.css"'));
  assert.doesNotMatch(app, /catalog-buy|catalog-quantity|catalogAmmoType|catalogSkillChipType|catalogMode/);
  assert.match(app, /a\.startsWith\('cart-'\)/); assert.doesNotMatch(app.slice(app.indexOf('function snapshotAppState'), app.indexOf('function snapshotAppState') + 1500), /cart/i, 'the cart is not part of the saved state');
  assert.doesNotMatch(read('shop-cart.js'), /nightcity-red-v1'|confirm\(/);
});

// ---- Regressions found in review: two tabs, lost clicks, focus, phone layout ----
// A second rig with the parts of a browser the fixes touch: a shared storage box, a window with a
// storage event, a queue for deferred work, a focused element, and a dock with a position on screen.
function rig2(options = {}) {
  const box = options.box || new Map(), queue = [], scrolled = [], vars = {}, marks = [], focused = [], notices = [], saved = [], listeners = {}, winListeners = {};
  const dock = { top: options.dockTop ?? 56, height: 130, getBoundingClientRect() { return { top: this.top, bottom: this.top + this.height, height: this.height }; } };
  const nodes = { '#shop-money': { innerHTML: '' }, '#shop-toggle': { textContent: '', setAttribute() {}, focus: () => focused.push('#shop-toggle') }, '#shop-cart': { innerHTML: '', hidden: true }, '#shop-dock': dock, '#catalog-target': { classList: { toggle: (name, on) => marks.push([name, on]) } } };
  const doc = { activeElement: null, documentElement: { style: { setProperty: (k, v) => { vars[k] = v; } } }, querySelector: sel => nodes[sel] || { focus: () => focused.push(sel) }, addEventListener: (type, fn) => { listeners[type] = fn; } };
  const win = { innerHeight: 780, getComputedStyle: () => ({ top: '56px' }), scrollBy: o => scrolled.push(o), addEventListener: (type, fn) => { winListeners[type] = fn; } };
  const storage = { getItem: k => (box.has(k) ? box.get(k) : null), setItem: (k, v) => box.set(k, v), removeItem: k => box.delete(k) };
  const world = { buyerId: 'p1', people: [person({ cash: 1000, gearBudget: 500 })] };
  const ctl = SC.controller({ lang: () => 'en', characters: () => world.people, buyerId: () => world.buyerId, nameOf: c => c.name, catalog: () => CATALOG, scope: () => 's', epoch: () => 1, current: () => true, stale: () => notices.push('STALE'), notify: m => notices.push(m), save: () => saved.push(1), needBuyer: () => notices.push('NEED BUYER'), openSheet() {}, document: doc, storage, window: win, defer: fn => queue.push(fn) });
  const run = () => { while (queue.length) queue.shift()(); };
  return { ctl, nodes, doc, dock, box, queue, run, scrolled, vars, marks, focused, notices, saved, world, listeners, winListeners, click: (action, data = {}) => ctl.click(action, { dataset: data }), panel: () => nodes['#shop-cart'].innerHTML, toggle: () => nodes['#shop-toggle'].textContent };
}

test('two tabs: a cart paid for in one tab is gone from the other and cannot be paid again or written back', () => {
  const box = new Map(), a = rig2({ box });
  a.click('cart-add', { id: PISTOL }); a.click('cart-add', { id: HEAVY });
  const b = rig2({ box }); assert.equal(b.ctl.cart.lines.length, 2, 'tab B loads the shared cart');
  b.click('cart-review'); assert.match(b.panel(), /cart-pay/);
  a.click('cart-review'); a.click('cart-pay'); assert.equal(a.world.people[0].extra.cash, 850); assert.equal(box.has(SC.KEY), false);
  // The storage event reaches tab B: its cart, bar and panel follow.
  b.winListeners.storage({ key: SC.KEY });
  assert.equal(b.ctl.cart.lines.length, 0); assert.equal(b.toggle(), 'Cart is empty'); assert.doesNotMatch(b.panel(), /cart-pay|cart-review/);
  // Even if the event has not arrived, every action re-reads the stored cart first.
  const c = rig2({ box }); a.click('cart-add', { id: PISTOL }); c.click('cart-review'); assert.match(c.panel(), /cart-pay/);
  a.click('cart-review'); a.click('cart-pay'); assert.equal(a.world.people[0].extra.cash, 800);
  c.click('cart-pay');
  assert.equal(c.saved.length, 0); assert.equal(c.world.people[0].extra.cash, 1000); assert.equal(c.world.people[0].extra.weapons.length, 0); assert.equal(c.notices.at(-1), 'STALE'); assert.equal(c.ctl.cart.lines.length, 0);
  c.click('cart-inc', { key: PISTOL + '||' }); c.ctl.field({ dataset: { cartQty: PISTOL + '||' }, value: '4' }); c.ctl.setMode('cash');
  assert.equal(box.has(SC.KEY), false, 'a stale tab does not write the bought lines back');
  // A cart built in one tab after the other was opened is joined, not overwritten.
  a.click('cart-add', { id: HEAVY }); c.click('cart-add', { id: PISTOL });
  assert.deepEqual(JSON.parse(box.get(SC.KEY)).lines.map(l => l.itemId), [HEAVY, PISTOL]);
  a.winListeners.storage({ key: SC.KEY }); assert.equal(a.toggle(), 'Cart: 2 · 150 eb');
  a.winListeners.storage({ key: 'nightcity-red-v1' }); assert.equal(a.ctl.cart.lines.length, 2, 'other keys are ignored');
});

test('typed quantity: the panel is not rebuilt under a pressed pointer, so Buy all, Remove and +/- still get their click', () => {
  const r = rig2(); r.click('cart-add', { id: PISTOL }); r.click('cart-add', { id: HEAVY }); r.click('cart-toggle');
  const before = r.panel();
  r.listeners.pointerdown(); r.listeners.mousedown();
  r.ctl.field({ dataset: { cartQty: PISTOL + '||' }, value: '7' });
  assert.equal(r.toggle(), 'Cart: 8 · 450 eb', 'the bar follows at once'); assert.equal(r.panel(), before, 'the panel under the pointer is left alone'); assert.equal(r.queue.length, 0);
  r.listeners.pointerup(); r.listeners.mouseup(); assert.equal(r.panel(), before, 'still there when the click is dispatched');
  r.click('cart-review'); r.listeners.click();
  assert.match(r.panel(), /Pay 450 eb/); r.run(); assert.match(r.panel(), /Pay 450 eb/, 'the late repaint does not undo the review');
  // A press that never becomes a click (released elsewhere) still ends in an up-to-date panel.
  r.click('cart-back'); r.listeners.pointerdown(); r.ctl.field({ dataset: { cartQty: PISTOL + '||' }, value: '2' }); const stale = r.panel();
  r.listeners.pointerup(); r.run(); assert.notEqual(r.panel(), stale); assert.match(r.panel(), /50 eb × 2 = <b>100 eb/);
});

test('typed quantity and Tab: focus is not forced back into the field; the control that got focus keeps it', () => {
  const r = rig2(); r.click('cart-add', { id: PISTOL }); r.click('cart-toggle');
  const at = r.focused.length, before = r.panel();
  r.ctl.field({ dataset: { cartQty: PISTOL + '||' }, value: '3' });
  assert.equal(r.focused.length, at, 'no focus call while the keyboard is leaving the field'); assert.equal(r.panel(), before); assert.equal(r.queue.length, 1);
  // By the time the deferred repaint runs, Tab has moved focus to the + button.
  r.doc.activeElement = { closest: sel => sel === '#shop-cart', dataset: { action: 'cart-inc', key: PISTOL + '||' } };
  r.run();
  assert.match(r.panel(), /50 eb × 3 = <b>150 eb/); assert.equal(r.focused.at(-1), `[data-action="cart-inc"][data-key="${PISTOL}||"]`);
  // Enter leaves focus in the field, and the repaint keeps it there.
  r.doc.activeElement = { closest: sel => sel === '#shop-cart', dataset: { cartQty: PISTOL + '||' } };
  r.ctl.field({ dataset: { cartQty: PISTOL + '||' }, value: '4' }); r.run(); assert.equal(r.focused.at(-1), `[data-cart-qty="${PISTOL}||"]`);
});

test('Pay from: changing the budget keeps focus on the select, so Escape still closes the cart', () => {
  const r = rig2(); r.click('cart-add', { id: PISTOL }); r.click('cart-toggle');
  r.ctl.setMode('gearBudget'); assert.equal(r.focused.at(-1), '#catalog-mode');
  assert.equal(r.ctl.key({ key: 'Escape', target: { closest: () => ({}) } }), true); assert.equal(r.ctl.state().open, false);
});

test('buyer select: the "nobody chosen" mark follows the buyer on every repaint', () => {
  const r = rig2(); r.world.buyerId = ''; r.ctl.changed(); assert.deepEqual(r.marks.at(-1), ['is-empty', true]);
  r.world.buyerId = 'p1'; r.ctl.changed(); assert.deepEqual(r.marks.at(-1), ['is-empty', false]);
});

test('opening the cart while the dock is not stuck yet scrolls the page so the panel is on screen', () => {
  const low = rig2({ dockTop: 367 }); low.dock.height = 500; low.click('cart-add', { id: PISTOL }); assert.equal(low.scrolled.length, 0);
  low.click('cart-toggle'); assert.deepEqual(plain(low.scrolled), [{ top: 311, behavior: 'instant' }]);
  low.click('cart-inc', { key: PISTOL + '||' }); assert.equal(low.scrolled.length, 1, 'only when it opens');
  const stuck = rig2({ dockTop: 56 }); stuck.dock.height = 500; stuck.click('cart-toggle'); assert.equal(stuck.scrolled.length, 0, 'a stuck dock stays put');
  const fits = rig2({ dockTop: 300 }); fits.dock.height = 200; fits.click('cart-toggle'); assert.equal(fits.scrolled.length, 0, 'a panel that fits is left alone');
  // The dock reports how much of the top of the screen it covers (its sticky offset plus its height, capped).
  assert.equal(fits.vars['--shop-dock-h'], '256px'); assert.equal(low.vars['--shop-dock-h'], '468px');
});

test('stylesheet: phone dock without the page-wide shadow, readable red in the cyberpunk look, room for focus and toast', () => {
  const css = read('shop-cart.css'), phone = css.slice(css.indexOf('@media (max-width: 820px)'), css.indexOf('/* Original cyberpunk look'));
  // The default look removes every clip-path, so nothing in the cart may rely on one to hide a huge shadow.
  assert.match(read('native.css'), /html\.ui-native \* \{ clip-path: none !important; \}/);
  assert.doesNotMatch(css, /clip-path\s*:/); assert.doesNotMatch(css, /box-shadow:[^;]*100vmax/);
  assert.match(phone, /\.shop-dock \{[^}]*box-shadow: none;[^}]*border-image: [^;}]*var\(--panel\)[^;}]*100vmax/);
  // Shortage and error text in the cyberpunk look: at least 4.5:1 on both dock backgrounds.
  const red = css.match(/html:not\(\.ui-native\) :is\(\.shop-after\.is-short, \.shop-after\.is-short b, \.shop-total \.is-short, \.shop-total \.is-short b, \.shop-line-error, \.shop-blocker\) \{ color: (#[0-9a-f]{6}); \}/);
  assert.ok(red, 'cyberpunk override for red text');
  const lum = hex => { const [r, g, b] = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16) / 255).map(v => (v <= .03928 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4)); return .2126 * r + .7152 * g + .0722 * b; };
  const ratio = (a, b) => (Math.max(lum(a), lum(b)) + .05) / (Math.min(lum(a), lum(b)) + .05);
  const base = read('styles.css'), v = name => base.match(new RegExp(name + ':\\s*(#[0-9a-f]{6})'))[1];
  assert.ok(ratio(v('--red'), v('--panel-2')) < 4.5, 'the look\'s own red is too dim, hence the override');
  for (const bg of ['--panel', '--panel-2']) assert.ok(ratio(red[1], v(bg)) >= 4.5, bg + ' ' + ratio(red[1], v(bg)).toFixed(2));
  // Card controls scrolled into view by the keyboard stop below the sticky dock.
  assert.match(css, /#catalog-list :is\(button, a, \[tabindex\]\) \{ scroll-margin-top: calc\(var\(--shop-dock-h, 96px\) \+ 8px\); \}/);
  assert.match(phone, /#catalog-list :is\(button, a, \[tabindex\]\) \{ scroll-margin-top: calc\(var\(--shop-dock-h, 240px\) \+ 8px\); \}/);
  assert.doesNotMatch(css, /scroll-padding/, 'page padding would also move focus inside the dock');
  // Phone: the toast leaves the bottom of the screen while the cart is open.
  assert.match(phone, /html:has\(#shop-cart:not\(\[hidden\]\)\) \.app-notice:not\(\.roll-notice\) \{ top: [^;]+; bottom: auto; \}/);
});

test('paying never resets the current LUCK of a character whose sheet was not opened yet', () => {
  const c = person(); c.stats = { EMP: 6, LUCK: 6 }; delete c.extra.luck;
  const cart = cartOf(PISTOL), p = SC.plan(c, cart, CATALOG, 'en');
  const paid = SC.checkout(c, cart, CATALOG, 'en', { confirmed: true, signature: p.signature });
  assert.equal(paid.ok, true); assert.equal(c.extra.cash, 950);
  assert.ok(c.extra.luck === undefined || c.extra.luck === 6, 'LUCK is ' + c.extra.luck);
  const kept = person({ luck: 2 }); kept.stats = { EMP: 6, LUCK: 6 };
  const cart2 = cartOf(PISTOL), p2 = SC.plan(kept, cart2, CATALOG, 'en');
  assert.equal(SC.checkout(kept, cart2, CATALOG, 'en', { confirmed: true, signature: p2.signature }).ok, true); assert.equal(kept.extra.luck, 2);
});
