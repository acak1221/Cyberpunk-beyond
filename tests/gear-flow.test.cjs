// Gear flow (site/gear-flow.js), wizard autosave (site/wizard-autosave.js) and the role set-up reminder (site/role-setup.js).
const { test } = require('node:test'), assert = require('node:assert/strict'), fs = require('node:fs'), vm = require('node:vm');
const read = name => fs.readFileSync(__dirname + '/../site/' + name, 'utf8');

function load() {
  let n = 0;
  const w = {}, ctx = { window: w, globalThis: { crypto: { randomUUID: () => 'id-' + (++n) } }, console, Math, JSON, Set, Map, Number, String, Array, Object, Date };
  w.crypto = { randomUUID: () => 'gf-' + (++n) };
  vm.createContext(ctx);
  for (const file of ['catalog.js', 'catalog-extra.js', 'character-extra.js', 'equipment-tools.js', 'wallet.js', 'shop-cart.js', 'wizard-autosave.js', 'role-setup.js', 'gear-flow.js']) vm.runInContext(read(file), ctx);
  return w;
}
const W = load(), GF = W.GearFlow, ET = W.EquipmentTools, WA = W.WizardAutosave, RS = W.RoleSetup;
const item = id => { const x = W.CATALOG.find(z => z.id === id); assert.ok(x, id); return x; };
const person = (extra = {}, more = {}) => ({ id: 'p1', name: 'Nova', role: 'solo', rank: 4, stats: { EMP: 6 }, skills: {}, hp: 40, humanity: 60, head: 0, bodyArmor: 0, extra: { cash: 100, gearBudget: 0, fashionBudget: 0, items: [], weapons: [], ...extra }, ...more });
const buy = (c, id, options = {}) => { const r = ET.purchase(c, item(id), 'cash', 'en', { confirmed: true, ...options }); assert.equal(r.ok, true, id + ' ' + r.message); return r; };
const memory = () => { const m = new Map(); return { getItem: k => (m.has(k) ? m.get(k) : null), setItem: (k, v) => { m.set(k, String(v)); } }; };

test('sell: the offered price is what was paid, the money goes through the Wallet with a ledger note', () => {
  const c = person({ cash: 1000 }); buy(c, 'weapon-medium-pistol');
  const w = c.extra.weapons[0], q = GF.sellQuote(w, 'weapons', 1);
  assert.equal(q.price, 50); assert.equal(q.max, 1);
  const cash = c.extra.cash, r = GF.sell(c, 'weapons', w.id, 1, 30, 'ru');
  assert.equal(r.ok, true); assert.equal(c.extra.weapons.length, 0); assert.equal(c.extra.cash, cash + 30); assert.equal(r.balance, cash + 30);
  assert.match(r.message, /Продано/);
  const log = W.Wallet.log(c); assert.ok(log.some(e => /Продажа/.test(e.note || '')), 'ledger entry');
});

test('sell: part of a stack, bad prices and counts change nothing', () => {
  const c = person({ cash: 10, items: [{ id: 'a', name: 'Rope', category: 'equipment', quantity: 5 }] });
  for (const [n, price, reason] of [[0, 5, 'badCount'], [6, 5, 'badCount'], [1.5, 5, 'badCount'], [1, -1, 'badPrice'], [1, 2.5, 'badPrice'], [1, NaN, 'badPrice']]) {
    const r = GF.sell(c, 'items', 'a', n, price, 'en'); assert.equal(r.ok, false); assert.equal(r.reason, reason);
  }
  assert.equal(c.extra.cash, 10); assert.equal(c.extra.items[0].quantity, 5);
  assert.equal(GF.sell(c, 'items', 'nope', 1, 5, 'en').reason, 'stale');
  const r = GF.sell(c, 'items', 'a', 2, 7, 'en'); assert.equal(r.ok, true); assert.equal(c.extra.items[0].quantity, 3); assert.equal(c.extra.cash, 17);
  const free = GF.sell(c, 'items', 'a', 3, 0, 'en'); assert.equal(free.ok, true); assert.equal(c.extra.items.length, 0); assert.equal(c.extra.cash, 17);
});

test('sell quote: catalog price for things without a purchase record, ammunition per round', () => {
  assert.equal(GF.unitPrice({ catalogId: 'weapon-heavy-pistol' }, item('weapon-heavy-pistol')), 100);
  assert.equal(GF.unitPrice({ name: 'Homebrew' }, undefined), 0);
  assert.equal(GF.unitPrice({ purchase: { total: 100, quantity: 4 } }, undefined), 25);
  const ammo = item('ammo-basic-ammunition');
  assert.equal(GF.unitPrice({ catalogId: ammo.id, ammoType: 'medium-pistol' }, ammo), ammo.price / 10);
});

test('give: the thing moves to the other character with a new id; old sheets without lists work', () => {
  const a = person({ items: [{ id: 'a', name: 'Rope', category: 'equipment', quantity: 5 }] }), b = { id: 'p2', name: 'Rook', role: 'tech', stats: { EMP: 5 }, skills: {} };
  const r = GF.give(a, b, 'items', 'a', 2, 'en');
  assert.equal(r.ok, true); assert.equal(a.extra.items[0].quantity, 3); assert.equal(b.extra.items.length, 1); assert.equal(b.extra.items[0].quantity, 2); assert.notEqual(b.extra.items[0].id, 'a');
  assert.match(r.message, /Rook/);
  assert.equal(GF.give(a, a, 'items', 'a', 1, 'en').ok, false);
  assert.equal(GF.give(a, b, 'items', 'a', 9, 'en').reason, 'badCount'); assert.equal(a.extra.items[0].quantity, 3);
});

test('delete can be undone at the same place; a second undo or a foreign sheet is refused', () => {
  const c = person({ items: [{ id: 'a', name: 'A', quantity: 1 }, { id: 'b', name: 'B', quantity: 1 }, { id: 'c', name: 'C', quantity: 1 }] });
  const r = GF.remove(c, 'items', 'b', 'en');
  assert.equal(r.ok, true); assert.deepEqual(c.extra.items.map(x => x.id), ['a', 'c']);
  assert.equal(GF.restore(person(), r.undo, 'en').ok, true, 'same character id');
  assert.equal(GF.restore({ ...person(), id: 'other' }, r.undo, 'en').ok, false);
  assert.equal(GF.restore(c, r.undo, 'en').ok, true); assert.deepEqual(c.extra.items.map(x => x.id), ['a', 'b', 'c']);
  assert.equal(GF.restore(c, r.undo, 'en').ok, false);
  const w = person({ weapons: [{ id: 'w', name: 'Gun' }] }), rw = GF.remove(w, 'weapons', 'w', 'ru');
  assert.equal(rw.ok, true); assert.equal(w.extra.weapons.length, 0); assert.match(rw.message, /Удалено/);
  assert.equal(GF.restore(w, rw.undo, 'ru').ok, true); assert.equal(w.extra.weapons[0].id, 'w');
});

test('bought armor goes onto bare locations, body first; nothing worn is replaced', () => {
  const armor = W.CATALOG.find(x => x.category === 'armor' && Number.isSafeInteger(x.stats?.sp) && x.id !== 'armor-bodyweight-suit');
  const c = person({ cash: 100000 });
  const one = buy(c, armor.id), created = [{ kind: 'item', id: c.extra.items.at(-1).id }];
  const r = GF.wearBought(c, created, 'ru');
  assert.equal(r.worn.length, 1); assert.equal(r.worn[0].location, 'body'); assert.equal(c.bodyArmor, armor.stats.sp); assert.equal(c.head, 0);
  assert.deepEqual([...r.bare], ['head']); assert.ok(r.lines.some(l => /Голова не защищена/.test(l)));
  assert.match(GF.receiptHTML(r), /gf-warn/);
  buy(c, armor.id); const second = c.extra.items.find(x => x.catalogId === armor.id && !created.some(k => k.id === x.id)) || c.extra.items.at(-1);
  const r2 = GF.wearBought(c, [{ kind: 'item', id: second.id }], 'en');
  assert.equal(c.head, armor.stats.sp); assert.equal(r2.bare.length, 0);
  const st = GF.armorState(c, 'en'); assert.equal(st.head.bare, false); assert.equal(st.body.sp, armor.stats.sp);
  buy(c, armor.id); const third = c.extra.items.at(-1), before = [c.head, c.bodyArmor];
  const r3 = GF.wearBought(c, [{ kind: 'item', id: third.id }], 'en');
  assert.deepEqual([c.head, c.bodyArmor], before); assert.equal(r3.kept.length + r3.worn.length >= 1, true);
  assert.equal(GF.wearBought(c, [{ kind: 'weapon', id: 'x' }], 'en'), null);
  assert.equal(GF.receiptHTML(null), '');
  void one;
});

test('armor cards say a piece covers one location; the strip and the row tags are escaped', () => {
  const armor = W.CATALOG.find(x => x.category === 'armor' && Number.isSafeInteger(x.stats?.sp) && x.id !== 'armor-bodyweight-suit');
  assert.match(armor.details.ru, /На одну часть тела/); assert.match(armor.details.en, /Covers one location/);
  assert.equal(GF.annotateCatalog(W.CATALOG), 0, 'annotating twice adds nothing');
  const c = person({ items: [{ id: 'a', name: '<b>x</b>', category: 'other', quantity: 3 }] });
  assert.match(GF.armorStrip(c, 'ru'), /голова: <b>SP 0<\/b>/);
  const meta = GF.rowMeta(c, c.extra.items[0], 'en'); assert.match(meta, /× 3/); assert.match(meta, /Other/);
  const panel = GF.panelHTML('sell', 'items', c.extra.items[0], 0, 'en', []);
  assert.ok(!panel.includes('<b>x</b>')); assert.match(panel, /data-gf-price/); assert.match(panel, /data-gf-count/);
  assert.match(GF.panelHTML('give', 'items', c.extra.items[0], 0, 'ru', []), /нет других персонажей/);
  assert.match(GF.panelHTML('give', 'items', c.extra.items[0], 0, 'ru', [{ id: 'p2', name: 'Rook' }]), /<option value="p2">Rook/);
});

test('Humanity maximum is worked out from EMP and implants when the sheet has none stored', () => {
  const c = person(); assert.equal(ET.humanityMax(c), 60);
  assert.equal(ET.humanityMax({ ...c, stats: { EMP: null } }), null);
  const stored = person({ equipment: { maxHumanity: 54 } }); assert.equal(ET.humanityMax(stored), 54);
});

test('wizard autosave: write, list, offer and clear per scope and method', () => {
  const storage = memory(), o = { storage };
  assert.equal(WA.list('s1', o).length, 0); assert.equal(WA.offerHTML('s1', 'ru', o), '');
  assert.equal(WA.write('s1', 'complete', { name: ' Nova <x> ', step: 2 }, { storage, at: '2026-01-01T00:00:00Z' }), true);
  assert.equal(WA.write('s1', 'streetrat', { name: '', step: 0 }, { storage, at: '2026-01-02T00:00:00Z' }), true);
  assert.equal(WA.write('s1', 'nope', { a: 1 }, o), false); assert.equal(WA.write('s1', 'complete', null, o), false);
  const l = WA.list('s1', o); assert.equal(l.map(x => x.method).join(), 'streetrat,complete'); assert.equal(l[1].step, 3); assert.equal(l[1].name, 'Nova <x>');
  assert.equal(WA.list('s2', o).length, 0);
  assert.equal(WA.read('s1', 'complete', o).step, 2); assert.equal(WA.read('s2', 'complete', o), null);
  const html = WA.offerHTML('s1', 'ru', o); assert.match(html, /Продолжить черновик: Nova &lt;x&gt;/); assert.match(html, /data-method="streetrat"/); assert.match(html, /без имени/);
  assert.match(WA.offerHTML('s1', 'en', o), /Continue draft/);
  assert.equal(WA.clear('s1', 'complete', o), true); assert.equal(WA.read('s1', 'complete', o), null); assert.equal(WA.clear('s1', 'complete', o), false);
  storage.setItem(WA.KEY, '{broken'); assert.equal(WA.list('s1', o).length, 0);
  WA.rememberQuick('edgerunner', o); assert.equal(WA.quickMethod(o), 'edgerunner'); WA.rememberQuick('x', o); assert.equal(WA.quickMethod(o), 'edgerunner');
});

test('role set-up: points to place for Solo, Medtech and Tech; nothing for other roles', () => {
  assert.equal(RS.status({ role: 'rockerboy', rank: 4 }), null);
  const solo = { role: 'solo', rank: 4, extra: {} }; let s = RS.status(solo);
  assert.deepEqual([s.spent, s.total, s.done], [0, 4, false]);
  assert.match(RS.cardHTML(solo, 'ru'), /Распределите очки способности: 0 \/ 4/); assert.match(RS.cardHTML(solo, 'en'), /data-hud-jump="sheet-role"/);
  solo.extra.roleTools = { solo: { values: { initiative: 2, deflect: 1 } } }; s = RS.status(solo); assert.deepEqual([s.spent, s.done], [4, true]);
  assert.match(RS.cardHTML(solo, 'en'), /data-role-setup="done"/);
  const tech = { role: 'tech', rank: 4, extra: { roleTools: { tech: { values: { field: 3 } } } } }; s = RS.status(tech); assert.deepEqual([s.spent, s.total, s.left], [3, 8, 5]);
  assert.equal(RS.createdHint('nomad', 'ru'), ''); assert.match(RS.createdHint('medtech', 'ru'), /распределите 4 очк/); assert.match(RS.createdHint('tech', 'en'), /place the 8 points/);
});
