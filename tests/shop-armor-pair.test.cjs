// Armor in the shop: one piece covers one location; «Тело + голова» adds two (site/shop-cart.js, site/catalog.js).
const { test } = require('node:test'), assert = require('node:assert/strict'), fs = require('node:fs'), vm = require('node:vm');
const read = name => fs.readFileSync(__dirname + '/../site/' + name, 'utf8');
function load() {
  let n = 0;
  const w = {}, ctx = { window: w, globalThis: { crypto: { randomUUID: () => 'id-' + (++n) } }, console, Math, JSON, Set, Map, Number, String, Array, Object, Date };
  vm.createContext(ctx);
  for (const file of ['catalog.js', 'catalog-extra.js', 'character-extra.js', 'equipment-tools.js', 'shop-cart.js']) vm.runInContext(read(file), ctx);
  return w;
}
const W = load(), SC = W.ShopCart, CATALOG = W.CATALOG;
const person = () => ({ id: 'p1', name: 'Nova', role: 'solo', stats: { EMP: 6 }, skills: {}, hp: 40, humanity: 60, extra: { cash: 5000, gearBudget: 0, fashionBudget: 0, items: [], weapons: [] } });

function rig() {
  const nodes = { '#shop-money': { innerHTML: '' }, '#shop-toggle': { textContent: '', setAttribute() {}, focus() {} }, '#shop-cart': { innerHTML: '', hidden: true }, '#shop-dock': {} };
  const notices = [], people = [person()], box = new Map();
  const doc = { querySelector: sel => nodes[sel] || { focus() {} }, addEventListener() {} };
  const storage = { getItem: k => (box.has(k) ? box.get(k) : null), setItem: (k, v) => box.set(k, v), removeItem: k => box.delete(k) };
  const ctl = SC.controller({ lang: () => 'ru', characters: () => people, buyerId: () => 'p1', nameOf: c => c.name, catalog: () => CATALOG, scope: () => 's', epoch: () => 1, current: (c, s) => s === 's' && people.includes(c), stale() {}, notify: m => notices.push(m), save() {}, needBuyer() {}, openSheet() {}, document: doc, storage, window: {}, defer: fn => fn() });
  return { ctl, nodes, notices, click: (action, data = {}) => ctl.click(action, { dataset: data }) };
}

test('an armor card offers «Тело + голова», the full-body suit and other goods do not', () => {
  const kevlar = W.renderCatalog('ru', 'Кевлар', 'armor'), suit = W.renderCatalog('ru', 'Бронекостюм нетраннера', 'armor');
  assert.match(kevlar, /data-action="cart-add-set" data-id="armor-kevlar"[^>]*>Тело \+ голова</);
  assert.doesNotMatch(suit, /cart-add-set/);
  assert.doesNotMatch(W.renderCatalog('ru', 'Агент', 'gear'), /cart-add-set/);
  assert.match(W.renderCatalog('en', 'Kevlar', 'armor'), />Body \+ head</);
});

test('«Тело + голова» puts two pieces in one cart line and says so', () => {
  const r = rig();
  r.click('cart-add-set', { id: 'armor-kevlar' });
  assert.equal(r.ctl.cart.lines.length, 1); assert.equal(r.ctl.cart.lines[0].quantity, 2);
  assert.match(r.notices.at(-1), /×2 \(тело и голова\)/);
  r.click('cart-add', { id: 'armor-kevlar' });
  assert.equal(r.ctl.cart.lines[0].quantity, 3);
});

test('an armor line in the cart says that one piece covers one location', () => {
  const r = rig();
  r.click('cart-add', { id: 'armor-kevlar' }); r.click('cart-toggle');
  assert.match(r.nodes['#shop-cart'].innerHTML, /data-armor-note>Одна часть брони закрывает одну часть тела/);
  const g = rig(); g.click('cart-add', { id: 'gear-agent' }); g.click('cart-toggle');
  assert.doesNotMatch(g.nodes['#shop-cart'].innerHTML, /data-armor-note/);
});
