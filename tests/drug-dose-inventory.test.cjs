// Drug doses come from the inventory; end/undo, strip, HUD chip, take button.
const { test } = require('node:test'), assert = require('node:assert/strict');
const shopCalls = [];
global.window = { confirm: () => true, App: { shopFor: (id, o) => { shopCalls.push([id, o]); return true } } };
require('../site/dose-stock.js'); require('../site/drug-tools.js');
const D = window.DrugTools;
const row = (key, q, extra) => Object.assign({ id: 'r-' + key, catalogId: 'extra-drug-' + key, name: key, category: 'equipment', quantity: q, notes: '' }, extra);
const person = (items = [row('synthcoke', 3), row('black-lace', 2)]) => ({ id: 'p', hp: 30, humanity: 55, stats: { WILL: 6, EMP: 6 }, skills: { 'Resist Torture/Drugs': 4 }, extra: { cash: 100, equipment: { maxHumanity: 60 }, items } });
function setup(c) {
  D.setScope(null); D.setScope('s'); D.render(c, 'en');
  const root = { isConnected: true }, cur = { yes: true };
  return {
    root, cur,
    act(op, key) { const b = { isConnected: true, dataset: { drugAction: op, ...(key ? { drugKey: key } : {}) }, closest: s => s === '[data-drug-root]' ? root : null }; return D.handle({ type: 'click', target: { closest: s => s === '[data-drug-root]' ? root : s === '[data-drug-action]' ? b : null } }, c, 'en', { isCurrent: () => cur.yes }) },
    shop() { const b = { isConnected: true, dataset: {}, closest: s => s === '[data-drug-root]' ? root : null }; return D.handle({ type: 'click', target: { closest: s => s === '[data-drug-root]' ? root : s === '[data-drug-shop]' ? b : null } }, c, 'en', { isCurrent: () => cur.yes }) },
    field(k, v) { return D.handle({ type: 'change', target: { dataset: { drugField: k }, value: v, closest: s => s === '[data-drug-root]' ? root : null } }, c, 'en', { isCurrent: () => cur.yes }) }
  };
}
test('a dose takes one from the inventory and activates the record', () => {
  const c = person(), h = setup(c); h.field('drug', 'synthcoke');
  let said = ''; window.confirm = m => { said = m; return true };
  const r = h.act('dose'); window.confirm = () => true;
  assert.match(said, /Synthcoke/); assert.match(said, /4 h/); assert.match(said, /2/);
  assert.equal(r.dirty, true); assert.match(r.notify, /dose taken, lasts 4 h\. 2 left/);
  assert.equal(c.extra.items[0].quantity, 2); assert.equal(c.extra.streetDrugs.records.synthcoke.remainingHours, 4);
  h.act('dose'); h.act('dose'); assert.equal(c.extra.items.length, 1);
  assert.equal(c.extra.streetDrugs.records.synthcoke.remainingHours, 12);
});
test('no stock: refused, no confirm, nothing changed', () => {
  const c = person([]), h = setup(c); h.field('drug', 'smash'); const before = JSON.stringify(c);
  window.confirm = () => { throw Error('confirm must not be called') };
  try { const r = h.act('dose'); assert.equal(r.dirty, undefined); assert.equal(r.notify, 'No Smash doses in the inventory.') } finally { window.confirm = () => true }
  assert.equal(JSON.stringify(c), before);
});
test('a dose while the check is due is refused with the check message and spends nothing', () => {
  const c = person(), h = setup(c); h.field('drug', 'synthcoke'); h.act('dose'); h.act('end', 'synthcoke');
  const q = c.extra.items[0].quantity, before = JSON.stringify(c), r = h.act('dose');
  assert.equal(r.notify, 'Roll the Secondary Effect check for Synthcoke first.'); assert.equal(JSON.stringify(c), before); assert.equal(c.extra.items[0].quantity, q);
});
test('end needs no confirm, goes to awaiting, undo restores, stale undo is refused', () => {
  const c = person(), h = setup(c); h.field('drug', 'synthcoke'); h.act('dose');
  const was = JSON.stringify(c.extra.streetDrugs.records.synthcoke);
  window.confirm = () => { throw Error('no confirm for end') };
  let r; try { r = h.act('end', 'synthcoke') } finally { window.confirm = () => true }
  const rec = c.extra.streetDrugs.records.synthcoke; assert.equal(rec.status, 'awaiting'); assert.equal(rec.remainingHours, 0);
  assert.match(r.notify, /Synthcoke: the effect ended/); assert.equal(typeof r.undo.run, 'function');
  const u = r.undo.run(); assert.equal(u.dirty, true); assert.equal(JSON.stringify(c.extra.streetDrugs.records.synthcoke), was);
  const r2 = h.act('end', 'synthcoke'); c.extra.streetDrugs.records.synthcoke.addicted = true;
  const u2 = r2.undo.run(); assert.equal(u2.dirty, undefined); assert.match(u2.notify, /changed/);
  assert.equal(c.extra.streetDrugs.records.synthcoke.status, 'awaiting');
});
test('data-drug-key switches the draft; unknown key is refused', () => {
  const c = person([row('smash', 1), row('synthcoke', 1)]), h = setup(c);
  h.act('dose', 'smash'); assert.equal(c.extra.streetDrugs.records.smash.status, 'active');
  assert.match(D.render(c, 'en'), /<option value="smash" selected>/);
  assert.equal(h.act('dose', 'nope').notify, 'Check the drug, elapsed time and check parameters.');
});
test('shop button opens the catalog on drugs filtered by the drug name', () => {
  const c = person([]), h = setup(c); h.shop();
  assert.deepEqual(JSON.parse(JSON.stringify(shopCalls.at(-1))), ['p', { category: 'drugs', query: 'Black Lace' }]);
});
test('render shows the strip, the stock, and no dose button at 0', () => {
  const c = person(), h = setup(c); h.field('drug', 'synthcoke'); h.act('dose');
  let html = D.render(c, 'en');
  assert.match(html, /class="drug-now"/); assert.match(html, /4 h left/); assert.match(html, /data-drug-action="end" data-drug-key="synthcoke"/);
  assert.match(html, /In inventory: 2/); assert.match(html, /Synthcoke · 2</);
  h.act('dose'); h.act('dose'); html = D.render(c, 'ru'); const ru = html;
  assert.doesNotMatch(ru, /data-drug-action="dose"/); assert.match(ru, /В инвентаре нет доз Synthcoke\./); assert.match(ru, /data-drug-shop/);
  h.act('end', 'synthcoke'); html = D.render(c, 'en');
  assert.match(html, /class="drug-due"/); assert.match(html, /WILL 6 \+ Resist Torture\/Drugs 4 \+ 1d10 against DV 15/); assert.match(html, /data-drug-action="resolve" data-drug-key="synthcoke"/);
});
test('hudChip shows hours left, check, and +N', () => {
  const c = person(), h = setup(c); h.field('drug', 'synthcoke'); h.act('dose');
  assert.match(D.hudChip(c, 'ru'), /Synthcoke<\/small><b>12 ч|Synthcoke<\/small><b>4 ч/); assert.match(D.hudChip(c, 'en'), /data-hud-jump="sheet-drugs"/);
  h.act('end', 'synthcoke'); assert.match(D.hudChip(c, 'en'), /hud-pending[^>]*>.*check/);
  assert.equal(D.hudChip(person(), 'en'), '');
  const many = person(); many.extra.streetDrugs = { version: 1, records: Object.fromEntries(['black-lace', 'blue-glass', 'boost', 'smash'].map(k => [k, { status: 'active', remainingHours: 4, addicted: false, yearVulnerability: false, lastCheck: null }])) };
  assert.match(D.hudChip(many, 'en'), /\+1/);
  const bad = person(); bad.extra.streetDrugs = { version: 9, records: {} }; assert.equal(D.hudChip(bad, 'en'), ''); assert.equal(D.nowStrip(bad, 'en'), '');
});
test('takeButton: only for drug rows; tracked-dose for ready Black Lace', () => {
  const c = person(); setup(c);
  assert.equal(D.takeButton(c, { id: 'x', name: 'Rope', quantity: 1 }, 'en'), '');
  assert.equal(D.takeButton(c, { id: 'x', catalogId: 'extra-pharmaceutical-stim', quantity: 1 }, 'en'), '');
  assert.match(D.takeButton(c, c.extra.items[0], 'en'), /data-drug-action="dose" data-drug-key="synthcoke"/);
  assert.match(D.takeButton(c, c.extra.items[1], 'ru'), /data-drug-action="tracked-dose" data-drug-key="black-lace"[^>]*>Принять дозу/);
  D.setScope(null); assert.equal(D.takeButton(c, c.extra.items[0], 'en'), '');
});
test('tracked-dose spends one dose and keeps humanity text', () => {
  const c = person(), h = setup(c), old = Math.random; Math.random = () => 0.5;
  try { const r = h.act('tracked-dose', 'black-lace'); assert.match(r.notify, /Black Lace: dose taken, lasts 24 h\. 1 left/); assert.match(r.notify, /Humanity 47/) } finally { Math.random = old }
  assert.equal(c.extra.items.find(x => x.id === 'r-black-lace').quantity, 1);
});
