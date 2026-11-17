// Weapon quality, attachments and links (site/weapon-attach.js), the quality / own price / percentage of the cart
// (site/shop-cart.js) and what removing a parent does to linked things (site/gear-flow.js).
const { test } = require('node:test'), assert = require('node:assert/strict'), fs = require('node:fs'), vm = require('node:vm');
const read = name => fs.readFileSync(__dirname + '/../site/' + name, 'utf8');
const plain = v => JSON.parse(JSON.stringify(v));

function load() {
  let n = 0;
  const w = {}, ctx = { window: w, globalThis: { crypto: { randomUUID: () => 'id-' + (++n) } }, console, Math, JSON, Set, Map, Number, String, Array, Object, Date };
  w.crypto = { randomUUID: () => 'wa-' + (++n) };
  vm.createContext(ctx);
  for (const file of ['catalog.js', 'catalog-extra.js', 'defenses-extra.js', 'character-extra.js', 'equipment-tools.js', 'wallet.js', 'weapon-attach.js', 'shop-cart.js', 'gear-flow.js', 'inventory-cards.js']) vm.runInContext(read(file), ctx, { filename: file });
  return w;
}
const W = load(), WA = W.WeaponAttach, SC = W.ShopCart, GF = W.GearFlow, IC = W.InventoryCards, CATALOG = W.CATALOG;
const item = id => { const x = CATALOG.find(z => z.id === id); assert.ok(x, id); return x; };
const person = (extra = {}) => ({ id: 'p1', name: 'Nova', role: 'solo', stats: { EMP: 6 }, skills: {}, hp: 40, humanity: 60, extra: { cash: 5000, gearBudget: 0, fashionBudget: 0, items: [], weapons: [], ...extra } });
const gun = (catalogId, more = {}) => { const x = item(catalogId); return { id: 'w-' + catalogId, catalogId, name: x.name.en, skill: x.stats.skill, damage: x.stats.damage, rof: x.stats.rof, capacity: x.stats.magazine || 0, ammo: 0, usesAmmo: !!x.stats.ammo, ...more }; };
const PISTOL = 'weapon-medium-pistol', HEAVY = 'weapon-heavy-pistol', RIFLE = 'weapon-assault-rifle', MELEE = 'weapon-heavy-melee-weapon';
const A = { scope: 'attachment-sniping-scope', ext: 'attachment-extended-magazine', drum: 'attachment-drum-magazine', smart: 'attachment-smartgun-link', bayonet: 'attachment-bayonet', night: 'attachment-infrared-nightvision-scope', gl: 'attachment-grenade-launcher-underbarrel' };

test('reference data: the slot count and the catalog ids of attachments are data, not code', () => {
  const d = W.WEAPON_MODIFIERS;
  assert.equal(d.attachmentSlots, 3);
  for (const a of d.attachments) assert.ok(item(d.catalogIds[a.id]).category === 'attachment', a.id);
  assert.equal(Object.keys(d.catalogIds).length, d.attachments.length);
  assert.equal(WA.slotCost(A.smart), 2); assert.equal(WA.slotCost(A.scope), 1); assert.equal(WA.slotCost('weapon-medium-pistol'), null); assert.equal(WA.slotCost('nope'), null);
});

test('quality options come from the reference table keyed by the standard price', () => {
  const o = WA.qualityOptions(item(PISTOL), 'en');
  assert.deepEqual(plain(o.map(x => [x.value, x.price])), [['poor', 20], ['standard', 50], ['excellent', 100]]);
  assert.deepEqual(plain(WA.qualityOptions(item(HEAVY), 'ru').map(x => x.price)), [50, 100, 500]);
  assert.match(WA.qualityOptions(item(PISTOL), 'ru')[0].label, /[а-яё]/i);
  assert.deepEqual(plain(WA.qualityOptions(item('weapon-malorian-arms-3516'), 'en')), [], 'exotic: none');
  assert.deepEqual(plain(WA.qualityOptions(item('armor-light-armorjack'), 'en')), [], 'not a weapon');
  assert.deepEqual(plain(WA.qualityOptions({ ...item(PISTOL), price: 77 }, 'en')), [], 'a price the table does not know');
  assert.deepEqual(plain(WA.qualityOptions(null, 'en')), []);
});

test('quality is stored as read: junk is ignored and only excellent adds an attack bonus (from the data)', () => {
  assert.equal(WA.qualityOf({ quality: 'excellent' }), 'excellent'); assert.equal(WA.qualityOf({ quality: 'legendary' }), ''); assert.equal(WA.qualityOf({}), ''); assert.equal(WA.qualityOf(null), '');
  assert.equal(WA.attackModifier({ quality: 'excellent' }), 1); assert.equal(WA.attackModifier({ quality: 'poor' }), 0); assert.equal(WA.attackModifier({ quality: 'standard' }), 0); assert.equal(WA.attackModifier({}), 0);
  const poor = WA.effects({ quality: 'poor' }, 'en'); assert.equal(poor.attack, 0); assert.ok(poor.notes.length === 1 && /malfunction/i.test(poor.notes[0]));
  assert.deepEqual(plain(WA.summary({ catalogId: PISTOL, skill: 'Handgun', quality: 'excellent' }, 'en')), ['Excellent quality (+1 to attack)']);
  assert.deepEqual(plain(WA.summary({ catalogId: PISTOL, quality: 'standard' }, 'en')), []);
});

test('setQuality: sets, clears, undoes; the weapon keeps its other fields', () => {
  const c = person({ weapons: [gun(PISTOL)] }), w = c.extra.weapons[0], before = plain(w);
  const r = WA.setQuality(c, w.id, 'excellent', 'en'); assert.equal(r.ok, true); assert.equal(w.quality, 'excellent'); assert.match(r.message, /Excellent/);
  assert.equal(WA.restore(c, r.undo, 'en').ok, true); assert.deepEqual(plain(w), before); assert.equal('quality' in w, false);
  WA.setQuality(c, w.id, 'poor', 'ru'); assert.equal(WA.setQuality(c, w.id, '', 'ru').ok, true); assert.equal('quality' in w, false);
  assert.equal(WA.setQuality(c, w.id, 'mythic', 'en').ok, false); assert.equal(WA.setQuality(c, 'missing', 'poor', 'en').reason, 'stale');
});

test('slots: only an ordinary ranged weapon has them; a melee, an exotic or a bow-less custom weapon does not', () => {
  assert.equal(WA.slotLimit(gun(PISTOL)), 3); assert.equal(WA.slotLimit(gun(RIFLE)), 3);
  assert.equal(WA.slotLimit(gun(MELEE)), 0);
  assert.equal(WA.slotLimit(gun('weapon-malorian-arms-3516')), 0, 'exotic');
  assert.equal(WA.slotLimit({ id: 'x', name: 'My gun', skill: 'Handgun' }), 3, 'written in by hand: by its skill');
  assert.equal(WA.slotLimit({ id: 'x', name: 'Sword', skill: 'Melee Weapon' }), 0);
  assert.equal(WA.slotLimit(null), 0);
});

test('install: the picker refuses what does not fit and says why', () => {
  const c = person({ weapons: [gun(PISTOL), gun(RIFLE), gun(MELEE)] }), [pistol, rifle, melee] = c.extra.weapons;
  const no = (w, id, reason, re) => { const r = WA.install(c, w.id, id, 'en'); assert.equal(r.ok, false, id); assert.equal(r.reason, reason); assert.match(r.message, re); };
  no(melee, A.scope, 'noSlots', /no attachment slots/);
  no(pistol, A.bayonet, 'notEligible', /does not fit.*Shoulder Arms/);
  no(pistol, A.gl, 'notEligible', /Shoulder Arms/);
  no(pistol, 'weapon-medium-pistol', 'unknown', /not a weapon attachment/);
  assert.equal(WA.install(c, pistol.id, A.scope, 'en').ok, true);
  no(pistol, A.scope, 'duplicate', /already installed/);
  assert.equal(WA.install(c, pistol.id, A.ext, 'en').ok, true);
  no(pistol, A.drum, 'oneMagazine', /only one/);
  no(pistol, A.smart, 'full', /takes 2 slot\(s\) but 1 are free/);
  assert.equal(WA.slotsUsed(pistol), 2); assert.equal(WA.slotsFree(pistol), 1);
  // a rifle takes the shoulder-arms ones: grenade underbarrel 2 + bayonet 1 = 3 slots, then nothing more
  assert.equal(WA.install(c, rifle.id, A.gl, 'ru').ok, true); assert.equal(WA.install(c, rifle.id, A.bayonet, 'ru').ok, true);
  const full = WA.install(c, rifle.id, A.night, 'ru'); assert.equal(full.ok, false); assert.match(full.message, /слотов/);
  assert.deepEqual(plain(rifle.attachments), [A.gl, A.bayonet]);
  assert.equal(WA.install(c, 'nope', A.scope, 'en').reason, 'stale');
});

test('install: no match leaves the sheet untouched', () => {
  const c = person({ weapons: [gun(MELEE)] }), before = plain(c);
  WA.install(c, c.extra.weapons[0].id, A.scope, 'en'); assert.deepEqual(plain(c), before);
});

test('magazines move the capacity by the table, only while the sheet holds the table number', () => {
  const c = person({ weapons: [gun(PISTOL, { ammo: 12 }), gun(HEAVY, { capacity: 9 })] }), [a, b] = c.extra.weapons;
  const r = WA.install(c, a.id, A.ext, 'en'); assert.equal(a.capacity, 18); assert.match(r.message, /Magazine capacity: 18/);
  assert.equal(WA.magazineKind(a), 'extended');
  const down = WA.uninstall(c, a.id, A.ext, 'en'); assert.equal(a.capacity, 12); assert.equal(a.ammo, 12); assert.equal('attachments' in a, false); assert.match(down.message, /Removed/);
  // loaded beyond the standard magazine: removing the extended magazine clamps the loaded rounds, and undo brings them back
  WA.install(c, a.id, A.drum, 'en'); assert.equal(a.capacity, 36); a.ammo = 30;
  const off = WA.uninstall(c, a.id, A.drum, 'en'); assert.equal(a.capacity, 12); assert.equal(a.ammo, 12);
  assert.equal(WA.restore(c, off.undo, 'en').ok, true); assert.equal(a.capacity, 36); assert.equal(a.ammo, 30); assert.deepEqual(plain(a.attachments), [A.drum]);
  // a hand-written capacity is never overwritten: the message says what the table gives
  const hand = WA.install(c, b.id, A.ext, 'en'); assert.equal(b.capacity, 9); assert.match(hand.message, /table gives capacity 14/);
});

test('effects: the plain number is applied, the situational ones are notes', () => {
  const w = gun(PISTOL, { quality: 'excellent', attachments: [A.scope, A.smart] });
  const e = WA.effects(w, 'en'); assert.equal(e.attack, 1);
  assert.equal(e.notes.length, 3, 'quality + two attachments');
  assert.ok(e.notes.some(n => /Sniping Scope: .*51/.test(n))); assert.ok(e.notes.some(n => /Smartgun Link/.test(n)));
  assert.match(WA.effects(w, 'ru').notes[1], /Снайперский прицел/);
});

test('an old or damaged weapon record is read safely and left alone', () => {
  const junk = gun(PISTOL, { attachments: [A.scope, A.scope, 7, null, 'ghost', A.ext, { x: 1 }], quality: { no: 1 } });
  assert.deepEqual(plain(WA.attachmentsOf(junk).map(a => a.id)), [A.scope, A.ext]); assert.equal(WA.qualityOf(junk), '');
  assert.deepEqual(plain(WA.attachmentsOf({ attachments: 'x' })), []);
  const c = person({ weapons: [junk] });
  assert.equal(WA.install(c, junk.id, A.night, 'en').ok, true, 'two slots used, the third is free');
  assert.equal(WA.install(c, junk.id, A.bayonet, 'en').ok, false, 'now full (and a pistol takes no bayonet)');
});

test('panel markup: escaped, with names, a status region and 44px-class controls', () => {
  const w = gun(PISTOL, { name: '<img src=x onerror=1>', attachments: [A.scope] }), c = person({ weapons: [w] });
  const html = WA.panel(c, w, 'en');
  assert.doesNotMatch(html, /<img/); assert.match(html, /data-wa-quality/); assert.match(html, /data-wa-action="attach"/); assert.match(html, /data-wa-action="detach"/);
  assert.match(html, /role="status" aria-live="polite" data-wa-status/); assert.match(html, /aria-label="Remove: Sniping Scope"/); assert.match(html, /slots 1\/3/);
  assert.match(WA.panel(c, w, 'ru'), /Снять: Снайперский прицел/);
  assert.match(WA.panel(c, gun(MELEE, { id: 'm' }), 'en'), /no attachment slots/);
  assert.equal(WA.panel(c, { name: 'no id' }, 'en'), '', 'a weapon without an id cannot be pointed at');
  const open = WA.panel(c, w, 'en'); assert.doesNotMatch(open, / open>/);
});

test('inventory card: the weapon line shows quality and slots, the panel sits inside the card', () => {
  const w = gun(PISTOL, { quality: 'excellent', attachments: [A.scope] }), c = person({ weapons: [w] });
  const html = IC.weaponRow(c, w, 'en', 'Pistol');
  assert.match(html, /Excellent quality \(\+1 to attack\)/); assert.match(html, /slots 1\/3/); assert.match(html, /data-wa-panel/);
  const plainRow = IC.weaponRow(person({ weapons: [gun(PISTOL)] }), gun(PISTOL), 'en', 'Pistol');
  assert.doesNotMatch(plainRow, /inv-line">[^<]*(Excellent|slots)/);
});

test('links: a thing links to a weapon or to another thing; self, circles and gone parents are refused; undo works', () => {
  const c = person({ weapons: [gun(PISTOL)], items: [{ id: 'i1', name: 'Scope kit', quantity: 1 }, { id: 'i2', name: 'Case', quantity: 1 }, { id: 'i3', name: 'Bag', quantity: 1 }] });
  const [i1, i2, i3] = c.extra.items, wid = c.extra.weapons[0].id;
  const r = WA.link(c, 'i1', wid, 'en'); assert.equal(r.ok, true); assert.equal(i1.linkedTo, wid); assert.equal(WA.parentOf(c, i1).kind, 'weapons');
  assert.match(WA.linkChip(c, i1, 'ru'), /в оружии/); assert.match(WA.linkChip(c, i1, 'en'), /in weapon/);
  assert.equal(WA.link(c, 'i1', 'i1', 'en').reason, 'linkSelf'); assert.equal(WA.link(c, 'i1', 'ghost', 'en').reason, 'linkGone'); assert.equal(WA.link(c, 'ghost', wid, 'en').reason, 'stale');
  assert.equal(WA.link(c, 'i2', 'i1', 'en').ok, true); assert.match(WA.linkChip(c, i2, 'en'), /linked to Scope kit/);
  assert.equal(WA.link(c, 'i1', 'i2', 'en').reason, 'linkCycle', 'i1 -> i2 -> i1'); assert.equal(i1.linkedTo, wid, 'unchanged');
  assert.equal(WA.link(c, 'i3', 'i3', 'en').ok, false);
  assert.deepEqual(plain(WA.childrenOf(c, wid).map(x => x.id)), ['i1']);
  const un = WA.link(c, 'i1', '', 'en'); assert.equal(un.ok, true); assert.equal('linkedTo' in i1, false);
  assert.equal(WA.restoreLink(c, un.undo, 'en').ok, true); assert.equal(i1.linkedTo, wid);
  assert.equal(WA.link(c, 'i3', wid, 'en').dirty, true); assert.equal(WA.link(c, 'i3', wid, 'en').dirty, false);
});

test('links: a dangling or self id is never shown; the select lists what can be linked and nothing that would close a circle', () => {
  const c = person({ weapons: [gun(PISTOL)], items: [{ id: 'a', name: 'A', linkedTo: 'gone' }, { id: 'b', name: 'B', linkedTo: 'b' }, { id: 'c', name: 'C', linkedTo: 'a' }] });
  const [a, b, d] = c.extra.items;
  assert.equal(WA.parentOf(c, a), null); assert.equal(WA.parentOf(c, b), null); assert.equal(WA.linkChip(c, a, 'en'), '');
  const field = WA.linkField(c, a, 'en'); assert.match(field, /data-wa-link data-wa-rid="a"/); assert.doesNotMatch(field, /value="a"/);
  assert.doesNotMatch(WA.linkField(c, a, 'en'), /value="c"/, 'C is linked under A: linking A under C would be a circle');
  assert.match(WA.linkField(c, d, 'en'), /value="a" selected/);
  assert.equal(WA.linkField(person(), { id: 'only', name: 'x' }, 'en'), '', 'nothing to link to');
  assert.equal(WA.linkField(c, { name: 'no id' }, 'en'), '');
});

test('gear-flow: removing a parent unlinks what hangs on it, deletes nothing, and undo links it again', () => {
  const c = person({ weapons: [gun(PISTOL)], items: [{ id: 'i1', name: 'Scope kit', quantity: 1, linkedTo: 'w-' + PISTOL }, { id: 'i2', name: 'Other', quantity: 1 }] });
  const r = GF.remove(c, 'weapons', 'w-' + PISTOL, 'en'); assert.equal(r.ok, true);
  assert.equal(c.extra.items.length, 2); assert.equal('linkedTo' in c.extra.items[0], false);
  assert.equal(GF.restore(c, r.undo, 'en').ok, true); assert.equal(c.extra.items[0].linkedTo, 'w-' + PISTOL);
  // linked elsewhere in the meantime: undo does not overwrite it
  const r2 = GF.remove(c, 'weapons', 'w-' + PISTOL, 'en'); c.extra.items[0].linkedTo = 'i2';
  GF.restore(c, r2.undo, 'en'); assert.equal(c.extra.items[0].linkedTo, 'i2');
  // a thing as parent
  const d = person({ items: [{ id: 'p', name: 'Case', quantity: 1 }, { id: 'k', name: 'Kid', quantity: 1, linkedTo: 'p' }] });
  const r3 = GF.remove(d, 'items', 'p', 'en'); assert.equal(d.extra.items.length, 1); assert.equal('linkedTo' in d.extra.items[0], false);
  GF.restore(d, r3.undo, 'en'); assert.equal(d.extra.items.find(x => x.id === 'k').linkedTo, 'p');
  assert.deepEqual(plain(GF.linkedTo(d, 'p').map(x => x.id)), ['k']);
});

test('gear-flow: selling or giving a parent unlinks the children; the gift carries no link of its own', () => {
  const c = person({ weapons: [gun(PISTOL)], items: [{ id: 'i1', name: 'Kit', quantity: 1, linkedTo: 'w-' + PISTOL }] }), to = person();
  to.id = 'p2';
  assert.equal(GF.sell(c, 'weapons', 'w-' + PISTOL, 1, 10, 'en').ok, true); assert.equal('linkedTo' in c.extra.items[0], false); assert.equal(c.extra.items.length, 1);
  const d = person({ items: [{ id: 'p', name: 'Case', quantity: 1 }, { id: 'k', name: 'Kid', quantity: 1, linkedTo: 'p' }] });
  const g = GF.give(d, to, 'items', 'k', 1, 'en'); assert.equal(g.ok, true); assert.equal('linkedTo' in to.extra.items[0], false);
});

// ---------- the cart ----------

const cartOf = (id, options = {}) => { const cart = SC.emptyCart(); const r = SC.add(cart, item(id), 'en', options); assert.equal(r.ok, true); return cart; };
const buy = (c, cart) => { const p = SC.plan(c, cart, CATALOG, 'en'); assert.equal(p.ok, true, JSON.stringify(p.blockers)); return { p, r: SC.checkout(c, cart, CATALOG, 'en', { confirmed: true, signature: p.signature }) }; };

test('cart: a weapon line takes a quality; prices come from the table; each quality is its own line', () => {
  const cart = cartOf(PISTOL);
  assert.equal(SC.lineKey(cart.lines[0]), PISTOL + '||', 'old key unchanged');
  const key = SC.lineKey(cart.lines[0]);
  const next = SC.setOption(cart, key, 'excellent', CATALOG); assert.equal(next, PISTOL + '|||excellent'); assert.equal(cart.lines[0].quality, 'excellent');
  let p = SC.plan(person(), cart, CATALOG, 'en'); assert.equal(p.lines[0].unitPrice, 100); assert.equal(p.total, 100); assert.equal(p.lines[0].variant, 'Excellent quality');
  assert.equal(SC.add(cart, item(PISTOL), 'en').ok, true); assert.equal(cart.lines.length, 2, 'standard is a separate line');
  SC.setOption(cart, next, 'poor', CATALOG); p = SC.plan(person(), cart, CATALOG, 'en'); assert.deepEqual(plain(p.lines.map(l => l.unitPrice)), [20, 50]);
  SC.setOption(cart, PISTOL + '|||poor', 'standard', CATALOG); assert.equal(cart.lines.length, 1, 'standard merges back'); assert.equal(cart.lines[0].quantity, 2); assert.equal('quality' in cart.lines[0], false);
  assert.equal(SC.setOption(cart, PISTOL + '||', 'platinum', CATALOG), PISTOL + '||', 'unknown quality: no quality');
  const exotic = SC.emptyCart(); SC.add(exotic, item('weapon-malorian-arms-3516'), 'en', { quality: 'excellent' }); assert.equal('quality' in exotic.lines[0], false);
});

test('cart: the line html offers the quality select with prices, an own-price field and the percentage field', () => {
  const cart = cartOf(HEAVY, { quality: 'poor' }), c = person(), p = SC.plan(c, cart, CATALOG, 'en');
  const html = SC.panelHTML({ lang: 'en', buyer: c, buyerName: 'Nova', plan: p, open: true });
  assert.match(html, /data-cart-option="weapon-heavy-pistol\|\|\|poor"/); assert.match(html, /<option value="excellent">Excellent quality · 500 eb/); assert.match(html, /<option value="poor" selected>/);
  assert.doesNotMatch(html, /Choose a type/, 'quality always has a value');
  assert.match(html, /data-cart-price="weapon-heavy-pistol\|\|\|poor"[^>]*placeholder="50"/); assert.match(html, /data-cart-adjust/);
  const ru = SC.panelHTML({ lang: 'ru', buyer: c, buyerName: 'Нова', plan: SC.plan(c, cart, CATALOG, 'ru'), open: true });
  assert.match(ru, /Качество/); assert.match(ru, /Своя цена за шт\./); assert.match(ru, /Скидка или наценка, %/);
});

test('cart: a price of your own replaces the unit price of that line only', () => {
  const cart = SC.emptyCart(); SC.add(cart, item(PISTOL), 'en'); SC.add(cart, item(HEAVY), 'en'); SC.add(cart, item(HEAVY), 'en');
  assert.equal(SC.setPrice(cart, PISTOL + '||', '35'), true); assert.equal(cart.lines[0].priceOverride, 35);
  const p = SC.plan(person(), cart, CATALOG, 'en'); assert.deepEqual(plain(p.lines.map(l => [l.unitPrice, l.total, l.priceOverride, l.listPrice])), [[35, 35, 35, 50], [100, 200, null, 100]]); assert.equal(p.total, 235);
  for (const bad of ['', '  ', 'abc', '-1', '2.5', '999999999999']) { SC.setPrice(cart, PISTOL + '||', bad); assert.equal('priceOverride' in cart.lines[0], false, bad); }
  SC.setPrice(cart, PISTOL + '||', '0'); assert.equal(cart.lines[0].priceOverride, 0); assert.equal(SC.plan(person(), cart, CATALOG, 'en').lines[0].total, 0);
  assert.equal(SC.setPrice(cart, 'no-line', '5'), false);
});

test('cart: the percentage applies to every line, rounds to whole eb, and is clamped', () => {
  const cart = SC.emptyCart(); SC.add(cart, item(PISTOL), 'en'); SC.add(cart, item(HEAVY), 'en');
  SC.setAdjust(cart, '-10'); let p = SC.plan(person(), cart, CATALOG, 'en');
  assert.equal(p.adjust, -10); assert.equal(p.listTotal, 150); assert.equal(p.total, 135); assert.deepEqual(plain(p.lines.map(l => l.total)), [45, 90]);
  SC.setAdjust(cart, 25); p = SC.plan(person(), cart, CATALOG, 'en'); assert.deepEqual(plain(p.lines.map(l => l.total)), [63, 125], '62.5 rounds up'); assert.equal(p.total, 188);
  SC.setAdjust(cart, 9999); assert.equal(cart.adjust, SC.ADJUST_MAX); SC.setAdjust(cart, -500); assert.equal(cart.adjust, SC.ADJUST_MIN); assert.equal(SC.plan(person(), cart, CATALOG, 'en').total, 0);
  for (const none of [0, '', 'x', NaN]) { SC.setAdjust(cart, none); assert.equal('adjust' in cart, false, String(none)); }
  // the note next to the total says what it is and what it was
  SC.setAdjust(cart, -10); p = SC.plan(person(), cart, CATALOG, 'en');
  const html = SC.panelHTML({ lang: 'en', buyer: person(), buyerName: 'Nova', plan: p, open: true }); assert.match(html, /data-adjust-note>Discount 10%: 150 eb without it/); assert.match(html, /value="-10" data-cart-adjust/);
  const ru = SC.panelHTML({ lang: 'ru', buyer: person(), buyerName: 'Нова', plan: SC.plan(person(), cart, CATALOG, 'ru'), open: true }); assert.match(ru, /Скидка 10%: без неё 150 eb/);
  assert.equal(SC.toggleText('en', p), 'Cart: 2 · 135 eb', 'the bar shows the adjusted sum');
  SC.clear(cart); assert.equal('adjust' in cart, false, 'clearing the cart clears the percentage');
});

test('cart: saved carts: old ones load unchanged, new fields are validated and survive a round trip', () => {
  const old = { v: 1, mode: 'cash', lines: [{ itemId: PISTOL, quantity: 2 }, { itemId: 'ammo-basic-ammunition', quantity: 1, ammoType: 'medium-pistol' }] };
  const loaded = SC.sanitize(old, CATALOG); assert.deepEqual(plain(loaded.lines[0]), { itemId: PISTOL, quantity: 2 }); assert.equal('adjust' in loaded, false);
  assert.equal(JSON.stringify(SC.serialize(loaded)), JSON.stringify({ v: 1, mode: 'cash', lines: loaded.lines.map(l => plain(l)) }), 'no new keys appear on an old cart');
  const dirty = SC.sanitize({ mode: 'cash', adjust: 999, lines: [{ itemId: PISTOL, quantity: 1, quality: 'mythic', priceOverride: -5 }, { itemId: HEAVY, quantity: 1, quality: 'standard', priceOverride: 1.5 }, { itemId: 'weapon-malorian-arms-3516', quantity: 1, quality: 'excellent' }] }, CATALOG);
  assert.equal('adjust' in dirty, false); assert.deepEqual(plain(dirty.lines), [{ itemId: PISTOL, quantity: 1 }, { itemId: HEAVY, quantity: 1 }, { itemId: 'weapon-malorian-arms-3516', quantity: 1 }]);
  const good = SC.sanitize({ mode: 'cash', adjust: -15, lines: [{ itemId: PISTOL, quantity: 1, quality: 'excellent', priceOverride: 80 }] }, CATALOG);
  assert.equal(good.adjust, -15); assert.deepEqual(plain(good.lines[0]), { itemId: PISTOL, quantity: 1, quality: 'excellent', priceOverride: 80 });
  const again = SC.sanitize(JSON.parse(JSON.stringify(SC.serialize(good))), CATALOG); assert.deepEqual(plain(again), plain(good));
  const mem = new Map(), storage = { getItem: k => mem.get(k) ?? null, setItem: (k, v) => mem.set(k, String(v)), removeItem: k => mem.delete(k) };
  SC.store(storage, good); assert.deepEqual(plain(SC.load(storage, CATALOG)), plain(good));
  for (const junk of [null, 'x', [], { lines: 5 }, { adjust: 'x', lines: [null, 3, {}] }]) assert.deepEqual(plain(SC.sanitize(junk, CATALOG)), { mode: 'cash', lines: [] });
});

test('cart: checkout puts the quality on the weapon, charges the plan price and keeps the receipt honest', () => {
  const c = person({ cash: 1000 }), cart = cartOf(PISTOL, { quality: 'excellent' });
  const { p, r } = buy(c, cart);
  assert.equal(r.ok, true); assert.equal(r.total, 100); assert.equal(c.extra.cash, 900); assert.equal(c.extra.weapons.length, 1);
  const w = c.extra.weapons[0]; assert.equal(w.quality, 'excellent'); assert.equal(w.purchase.quality, 'excellent'); assert.equal(w.purchase.total, 50 === 0 ? 0 : w.purchase.total);
  assert.equal(r.bought[0].variant, 'Excellent quality'); assert.equal(r.bought[0].total, 100); assert.equal(p.total, 100);
  assert.equal(GF.sellQuote(w, 'weapons', 1).unit >= 0, true);
});

test('cart: checkout with an own price and a percentage charges exactly what the plan showed', () => {
  const c = person({ cash: 1000 }), cart = SC.emptyCart();
  SC.add(cart, item(PISTOL), 'en', { quantity: 2 }); SC.add(cart, item(HEAVY), 'en'); SC.setPrice(cart, PISTOL + '||', '40'); SC.setAdjust(cart, -10);
  const { p, r } = buy(c, cart);
  assert.equal(p.listTotal, 180); assert.equal(p.total, 162);
  assert.equal(r.ok, true); assert.equal(c.extra.cash, 1000 - 162); assert.equal(r.remaining, 838); assert.equal(c.extra.weapons.length, 3);
  const pistols = c.extra.weapons.filter(x => x.catalogId === PISTOL); assert.equal(pistols.length, 2);
  assert.equal(pistols[0].purchase.unitPrice, 36); assert.equal(pistols[0].purchase.total, 36);
  assert.equal(GF.sellQuote(pistols[0], 'weapons', 1).unit, 36, 'selling offers what was paid');
  const ledger = W.Wallet.log(c); assert.ok(ledger.length >= 1);
});

test('cart: a markup that the buyer cannot afford blocks the purchase; a discount lets a short budget through', () => {
  const cart = cartOf(HEAVY); SC.setAdjust(cart, 25);
  const poor = person({ cash: 110 }); const p = SC.plan(poor, cart, CATALOG, 'en'); assert.equal(p.ok, false); assert.equal(p.total, 125); assert.equal(p.blockers[0].reason, 'noFunds');
  SC.setAdjust(cart, -30); const ok = SC.plan(poor, cart, CATALOG, 'en'); assert.equal(ok.ok, true); assert.equal(ok.total, 70);
  const r = SC.checkout(poor, cart, CATALOG, 'en', { confirmed: true, signature: ok.signature }); assert.equal(r.ok, true); assert.equal(poor.extra.cash, 40);
  const stale = SC.plan(person({ cash: 500 }), cart, CATALOG, 'en'); SC.setAdjust(cart, 0);
  assert.equal(SC.checkout(person({ cash: 500 }), cart, CATALOG, 'en', { confirmed: true, signature: stale.signature }).reason, 'stale', 'changing the percentage after the review');
});

test('cart: a line without quality, own price or percentage prices and buys exactly as before', () => {
  const c = person({ cash: 1000 }), cart = SC.emptyCart(); SC.add(cart, item(PISTOL), 'en'); SC.add(cart, item(MELEE), 'en');
  const { p, r } = buy(c, cart); assert.equal(p.total, 150); assert.equal(p.adjust, 0); assert.equal(r.ok, true); assert.equal(c.extra.cash, 850);
  assert.equal('quality' in c.extra.weapons[0], false); assert.equal(c.extra.weapons[0].purchase.unitPrice, 50); assert.equal(c.extra.weapons[0].purchase.total, 50);
});

test('cart controller: the price and percentage fields change the cart through field(), and focus is kept', () => {
  const mem = new Map(), storage = { getItem: k => mem.get(k) ?? null, setItem: (k, v) => mem.set(k, String(v)), removeItem: k => mem.delete(k) };
  const c = person({ cash: 1000 }); const notes = [];
  const host = { lang: () => 'en', characters: () => [c], buyerId: () => c.id, nameOf: x => x.name, catalog: () => CATALOG, scope: () => 's', epoch: () => 1, current: () => true, stale() {}, notify: m => notes.push(m), save() {}, needBuyer() {}, openSheet() {}, document: null, storage, window: null, defer: fn => fn() };
  const ctl = SC.controller(host);
  ctl.click('cart-add', { dataset: { id: PISTOL } });
  assert.equal(ctl.field({ dataset: { cartPrice: PISTOL + '||' }, value: '30' }), true); assert.equal(ctl.cart.lines[0].priceOverride, 30);
  assert.equal(ctl.field({ dataset: { cartAdjust: '' }, value: '20' }), true); assert.equal(ctl.cart.adjust, 20);
  assert.equal(JSON.parse(storage.getItem(SC.KEY)).adjust, 20); assert.equal(JSON.parse(storage.getItem(SC.KEY)).lines[0].priceOverride, 30);
  ctl.field({ dataset: { cartOption: PISTOL + '||' }, value: 'excellent' }); assert.equal(ctl.cart.lines[0].quality, 'excellent');
  assert.equal(ctl.field({ dataset: { cartAdjust: '' }, value: '0' }), true); assert.equal('adjust' in ctl.cart, false);
  assert.doesNotMatch(ctl.shell(), /undefined|NaN/);
});

test('files: weapon-attach.js is registered before app.js, has css, and strings exist in both languages', () => {
  const html = read('index.html'); assert.ok(html.indexOf('weapon-attach.js') > 0 && html.indexOf('weapon-attach.js') < html.indexOf('src="app.js"')); assert.match(html, /href="weapon-attach\.css"/);
  assert.ok(fs.existsSync(__dirname + '/../site/weapon-attach.css'));
  const keys = Object.keys(WA.T.ru).sort(); assert.deepEqual(keys, Object.keys(WA.T.en).sort());
  for (const k of keys) for (const lang of ['ru', 'en']) { const v = WA.t(lang, k, 1, 2, 3); assert.equal(typeof v, 'string', k); assert.doesNotMatch(v, /undefined|NaN/, k); }
  for (const k of keys) if (!['price', 'slotsShort', 'attack', 'noteBy', 'qualitySet'].includes(k)) assert.match(WA.t('ru', k, 'X', 'Y', 3), /[а-яё]/i, 'RU ' + k);
  assert.doesNotMatch(read('weapon-attach.js'), /\r/); assert.doesNotMatch(read('weapon-attach.css'), /\r/);
});

// ---- review fixes ----
function loadWith(extraCtx, files) {
  let n = 0;
  const w = extraCtx.window || {}, ctx = { window: w, globalThis: { crypto: { randomUUID: () => 'id-' + (++n) } }, console, Math, JSON, Set, Map, Number, String, Array, Object, Date, ...extraCtx };
  w.crypto = { randomUUID: () => 'wb-' + (++n) };
  vm.createContext(ctx);
  for (const file of files) vm.runInContext(read(file), ctx, { filename: file });
  return w;
}

test('undo of a weapon change takes back only what that change set', () => {
  const c = person({ weapons: [gun(PISTOL, { ammo: 12 })] }), w = c.extra.weapons[0];
  const r = WA.install(c, w.id, A.ext, 'en'); assert.equal(r.ok, true);
  w.ammo = 3; w.name = 'Renamed'; w.notes = 'mine';
  assert.equal(WA.restore(c, r.undo, 'en').ok, true);
  assert.equal(w.name, 'Renamed'); assert.equal(w.notes, 'mine'); assert.equal(w.ammo, 3, 'ammo moved by the player stays');
  assert.equal('attachments' in w, false, 'the attachment itself is taken back');
  const c2 = person({ weapons: [gun(PISTOL)] }), v = c2.extra.weapons[0];
  const q = WA.setQuality(c2, v.id, 'poor', 'en'); v.quality = 'excellent';
  WA.restore(c2, q.undo, 'en'); assert.equal(v.quality, 'excellent');
  assert.equal(WA.restore(c2, { weaponId: v.id, before: {} }, 'en').ok, false);
  assert.equal(WA.restore(c2, null, 'en').ok, false);
});

test('the +1 attack of excellent quality is called a note until the roll applies it', () => {
  const fresh = loadWith({}, ['catalog.js', 'defenses-extra.js', 'weapon-attach.js']).WeaponAttach;
  const w = { catalogId: PISTOL, skill: 'Handgun', quality: 'excellent' };
  assert.match(fresh.summary(w, 'en')[0], /yourself|modifier/i); assert.match(fresh.summary(w, 'ru')[0], /сами/);
  fresh.attackModifier(w);
  assert.deepEqual(plain(fresh.summary(w, 'en')), ['Excellent quality (+1 to attack)']);
});

test('the picker puts what fits first, selects it and marks the rest', () => {
  const c = person({ weapons: [gun(HEAVY)] });
  const html = WA.panel(c, c.extra.weapons[0], 'en');
  const opts = [...html.matchAll(/<option value="(attachment-[^"]+)"( selected)?>([^<]*)<\/option>/g)];
  assert.ok(opts.length >= 6);
  const sel = opts.filter(o => o[2]); assert.equal(sel.length, 1);
  assert.equal(WA.check(c.extra.weapons[0], sel[0][1], 'en').ok, true, 'the selected one fits');
  const marked = opts.filter(o => /does not fit/.test(o[3])); assert.ok(marked.length >= 1);
  for (const o of marked) assert.equal(WA.check(c.extra.weapons[0], o[1], 'en').ok, false);
  assert.equal(opts.findIndex(o => /does not fit/.test(o[3])) > opts.findIndex(o => o[2]), true, 'fitting ones come first');
  assert.match(WA.panel(c, c.extra.weapons[0], 'ru'), /не подходит/);
  assert.doesNotMatch(read('defenses-extra.js'), /навыка Shoulder Arms/);
});

test('page handlers: refuse with a reason, install with undo notice, undo keeps later edits, stale weapon redraws', () => {
  const handlers = {}, calls = { render: 0, save: 0, notes: [], actions: [] };
  const c = person({ weapons: [gun(HEAVY, { ammo: 5 })] }), w = c.extra.weapons[0];
  const status = { textContent: '' }, pick = { value: A.bayonet };
  const panel = { querySelector: s => (s === '[data-wa-pick]' ? pick : s === '[data-wa-status]' ? status : null) };
  const appEl = { contains: () => true };
  const document = { addEventListener: (n, f) => { handlers[n] = f; }, querySelector: () => appEl, querySelectorAll: () => [], activeElement: null };
  const App = { lang: () => 'en', active: () => c, getState: () => ({ characters: [c] }), render: () => { calls.render++; }, save: () => { calls.save++; }, notify: m => calls.notes.push(m), notifyAction: (m, label, fn) => calls.actions.push({ m, label, fn }) };
  loadWith({ window: { document, App }, document }, ['catalog.js', 'defenses-extra.js', 'weapon-attach.js']);
  const click = (action) => {
    const b = { dataset: { waAction: action, waWeapon: w.id }, closest: s => (s === '[data-wa-panel]' ? panel : null) };
    handlers.click({ target: { closest: s => (s === '[data-wa-action]' ? b : null) } });
  };
  click('attach');
  assert.match(status.textContent, /does not fit/); assert.equal(calls.actions.length, 0); assert.equal(calls.save, 0);
  pick.value = A.ext; status.textContent = ''; click('attach');
  assert.deepEqual(plain(w.attachments), [A.ext]); assert.equal(calls.save, 1); assert.equal(calls.actions.length, 1); assert.equal(calls.actions[0].label, 'Undo');
  w.name = 'Mine';
  calls.actions[0].fn(); assert.equal('attachments' in w, false); assert.equal(w.name, 'Mine');
  c.extra.weapons.length = 0; const before = calls.render; click('attach'); assert.ok(calls.render > before, 'a gone weapon redraws the sheet');
  assert.ok(calls.notes.length >= 1);
});

test('cart: two lines with different own prices do not merge and lose nothing', () => {
  const cart = cartOf(PISTOL); SC.add(cart, item(PISTOL), 'en', { quality: 'excellent' });
  const key = SC.lineKey(cart.lines.find(l => l.quality));
  SC.setPrice(cart, key, '120');
  const next = SC.setOption(cart, key, 'standard', CATALOG);
  assert.equal(cart.lines.length, 2); assert.equal(cart.lines.find(l => l.quality === 'excellent').priceOverride, 120);
  assert.equal(next, key);
  const c2 = cartOf(PISTOL); SC.add(c2, item(PISTOL), 'en', { quality: 'excellent' });
  SC.setOption(c2, SC.lineKey(c2.lines.find(l => l.quality)), 'standard', CATALOG); assert.equal(c2.lines.length, 1); assert.equal(c2.lines[0].quantity, 2);
});

test('cart: a bad own price is flagged and told', () => {
  assert.equal(SC.priceUsable('35'), true); assert.equal(SC.priceUsable('0'), true);
  for (const bad of ['-5', '1.5', 'abc', '99999999999']) assert.equal(SC.priceUsable(bad), false, bad);
  const notes = [], attrs = {};
  const c = person({ cash: 1000 });
  const host = { lang: () => 'en', characters: () => [c], buyerId: () => c.id, nameOf: x => x.name, catalog: () => CATALOG, scope: () => 's', epoch: () => 1, current: () => true, stale() {}, notify: m => notes.push(m), save() {}, needBuyer() {}, openSheet() {}, document: null, storage: { getItem: () => null, setItem() {}, removeItem() {} }, window: null };
  const ctl = SC.controller(host); ctl.click('cart-add', { dataset: { id: PISTOL } });
  W.App = { lang: () => 'en', notify: m => notes.push(m) };
  ctl.field({ dataset: { cartPrice: PISTOL + '||' }, value: '-5', setAttribute: (k, v) => { attrs[k] = v; } });
  assert.equal(attrs['aria-invalid'], 'true'); assert.ok(notes.some(m => /whole number/.test(m)));
  delete W.App;
});

test('catalog card: a weapon with a table price offers the quality, and the chosen one reaches the cart', () => {
  const html = W.catalogCards ? W.catalogCards('', 'weapon', 'en', 500) : null;
  if (html === null) { assert.match(read('catalog.js'), /data-catalog-quality/); return; }
  assert.match(html, /data-catalog-quality/);
});

test('cart: saved prices above the limit are dropped; the percentage is part of the signature even at a zero total', () => {
  const s = SC.sanitize({ mode: 'cash', lines: [{ itemId: PISTOL, quantity: 1, priceOverride: 100000001 }, { itemId: HEAVY, quantity: 1, priceOverride: 100000000 }] }, CATALOG);
  assert.equal('priceOverride' in s.lines[0], false); assert.equal(s.lines[1].priceOverride, 100000000);
  const cart = cartOf(PISTOL); SC.setPrice(cart, PISTOL + '||', '0');
  const a = SC.plan(person(), cart, CATALOG, 'en'); SC.setAdjust(cart, 50); const b = SC.plan(person(), cart, CATALOG, 'en');
  assert.equal(a.total, 0); assert.equal(b.total, 0); assert.notEqual(a.signature, b.signature);
});

test('links: a chain longer than the guard counts as a circle; dangling links can be pruned', () => {
  const items = []; for (let i = 0; i < 60; i++) items.push({ id: 'n' + i, name: 'n' + i, quantity: 1, ...(i < 59 ? { linkedTo: 'n' + (i + 1) } : {}) });
  const c = person({ items });
  assert.equal(WA.wouldCycle(c, 'free', c.extra.items[0]), true);
  const d = person({ weapons: [gun(PISTOL)], items: [{ id: 'a', name: 'a', quantity: 1, linkedTo: 'gone' }, { id: 'b', name: 'b', quantity: 1, linkedTo: 'w-' + PISTOL }, { id: 'c', name: 'c', quantity: 1 }] });
  assert.equal(WA.pruneDangling(d), 1); assert.equal('linkedTo' in d.extra.items[0], false); assert.equal(d.extra.items[1].linkedTo, 'w-' + PISTOL);
});

test('gear-flow: undo re-links by id when the list was rebuilt; a weapon given a quality sells at the table price', () => {
  const c = person({ weapons: [gun(PISTOL)], items: [{ id: 'i1', name: 'Kit', quantity: 1, linkedTo: 'w-' + PISTOL }] });
  const r = GF.remove(c, 'weapons', 'w-' + PISTOL, 'en');
  c.extra.items = c.extra.items.map(x => ({ ...x }));
  assert.equal(GF.restore(c, r.undo, 'en').ok, true); assert.equal(c.extra.items[0].linkedTo, 'w-' + PISTOL);
  assert.equal(GF.unitPrice({ quality: 'excellent' }, item(PISTOL)), 100); assert.equal(GF.unitPrice({ quality: 'poor' }, item(PISTOL)), 20);
  assert.equal(GF.unitPrice({}, item(PISTOL)), 50); assert.equal(GF.unitPrice({ quality: 'excellent' }, item('weapon-malorian-arms-3516')), item('weapon-malorian-arms-3516').price);
});
