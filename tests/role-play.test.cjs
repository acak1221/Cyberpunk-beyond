// Role play at the table (site/role-play.js): the result under the pressed button, the Role summary,
// a finished Maker project on the sheet, NET damage, the programs of a deck during a run, the Solo round.
const { test } = require('node:test'), assert = require('node:assert/strict'), fs = require('node:fs'), vm = require('node:vm');
const read = f => fs.readFileSync(__dirname + '/../site/' + f, 'utf8');
function load(files, random = () => 0.5) {
  const math = Object.create(Math); math.random = random;
  const w = { confirm: () => true }, ctx = { window: w, Math: math, Date, JSON, Object, Array, Number, String, setTimeout, globalThis: { crypto: { randomUUID: () => 'id-' + Math.random() } } };
  vm.createContext(ctx);
  for (const f of files) vm.runInContext(read(f), ctx);
  return w;
}
const plain = x => JSON.parse(JSON.stringify(x));
// A small stand-in for the sheet module: the two functions the Maker delivery uses.
function sheetStub(w) {
  let n = 0;
  const init = c => { c.extra ||= {}; c.extra.items ||= []; c.extra.weapons ||= []; return c.extra; };
  w.CharacterExtra = {
    addItem(c, item) { const x = init(c); x.items.push({ id: 'i' + (++n), name: item.name, category: item.category, quantity: item.quantity ?? 1, notes: item.notes || '' }); return x.items[x.items.length - 1]; },
    addCatalog(c, item, l) { const x = init(c); if (item.category === 'weapon') { const r = { id: 'w' + (++n), catalogId: item.id, name: item.name[l], damage: item.stats.damage, notes: 'p. 1' }; x.weapons.push(r); return { kind: 'weapon', record: r }; } const r = this.addItem(c, { name: item.name[l], category: 'equipment', notes: 'p. 1' }); r.catalogId = item.id; return { kind: 'item', record: r }; }
  };
}
const tech = () => ({ id: 't', name: 'Tech', role: 'tech', rank: 4, stats: { TECH: 7 }, extra: { cash: 2000, keep: { me: 1 }, makerProjects: { version: 1, projects: [{ id: 'p1', name: 'Heavy Pistol', op: 'fabricate', category: 'premium', price: 0, status: 'passed', rolls: [{ tech: 7, skill: 6, specialty: 2, modifier: 0, die: 6, extra: 0, total: 21, dv: 17, success: true }] }] } } });

test('the result line goes right after the pressed button, and nowhere when there is no such button', () => {
  const R = load(['role-play.js']).RolePlay;
  const html = '<div><button data-rt-action="net-spend">a</button><button type="button" class="rt-button" data-rt-action="tech-roll">Roll</button><p>help</p></div>';
  const out = R.placeLast(html, 'tech-roll', 'Total <19>');
  assert.equal(out, '<div><button data-rt-action="net-spend">a</button><button type="button" class="rt-button" data-rt-action="tech-roll">Roll</button><div class="rt-last rt-last-inline" role="status">Total &lt;19&gt;</div><p>help</p></div>');
  assert.equal(R.placeLast(html, 'rock-roll', 'x'), null);
  assert.equal(R.placeLast(html, 'tech-roll', ''), null);
  assert.equal(R.placeLast(html, 'tech-roll"><script>', 'x'), null);
  assert.equal(R.placeLast(html, undefined, 'x'), null);
});

test('a Role roll reports itself for the toast and is drawn under its button; old saves keep the bottom line', () => {
  const w = load(['role-play.js', 'role-tools.js']), T = w.RoleTools;
  const c = { role: 'tech', rank: 4, stats: { TECH: 7 }, skills: { 'Basic Tech': 4 }, extra: { roleTools: { tech: { values: { field: 2 }, team: [] } } } };
  const click = a => T.handle({ type: 'click', target: { closest: () => ({ dataset: { rtAction: a } }) } }, c, 'ru');
  const r = click('tech-roll');
  assert.equal(r.rerender, true);
  assert.equal(r.roll.total, 7 + 4 + 2 + 6);
  assert.deepEqual(plain(r.roll.faces), [{ v: 6, s: 10 }]);
  assert.match(r.roll.text, /Basic Tech \+ field 2 · 1d10 6 → 19 > 9 · успех/);
  assert.equal(c.extra.roleTools.tech.lastAction, 'tech-roll');
  const html = T.render(c, 'ru'), at = html.indexOf('data-rt-action="tech-roll"'), line = html.indexOf('rt-last-inline');
  assert.ok(at > 0 && line > at && line - at < 200, 'the line stands next to the button');
  assert.match(html, /<div class="rt-last" aria-live="polite"><\/div><\/section>/);
  // A character saved before this change has `last` but no `lastAction`: the old line at the bottom still shows it.
  const old = { role: 'rockerboy', rank: 4, extra: { roleTools: { rockerboy: { values: {}, team: [], last: 'old result' } } } };
  const oldHtml = T.render(old, 'ru');
  assert.doesNotMatch(oldHtml, /rt-last-inline/);
  assert.match(oldHtml, /<div class="rt-last" aria-live="polite">old result<\/div>/);
  // An action that is not a roll does not ask for a toast.
  const net = { role: 'netrunner', rank: 4, extra: {} };
  assert.equal(T.handle({ type: 'click', target: { closest: () => ({ dataset: { rtAction: 'net-spend' } }) } }, net, 'ru').roll, undefined);
});

test('the «Особенности» summary shows the numbers of the Role and what its tools hold', () => {
  const w = load(['role-play.js', 'role-tools.js']), R = w.RolePlay;
  const med = { role: 'medtech', rank: 4, extra: { roleTools: { medtech: { values: { surgery: 2, pharma: 1, cryo: 1 }, team: [] } }, pharmacy: { version: 1, doses: { speedheal: 2, stim: 0, junk: 5 } } } };
  const html = R.summary(med, 'ru');
  assert.match(html, /data-rp-summary/);
  assert.match(html, /rt-summary|rt-derived/);
  assert.match(html, /<strong>Speedheal<\/strong> × 2/);
  assert.doesNotMatch(html, /Stim|junk/);
  assert.match(html, /data-rp-open="medical"/);
  assert.match(html, /data-rp-open="role"/);
  assert.match(R.summary(med, 'en'), /Open the Role tools/);
  assert.deepEqual(plain(R.doses({ extra: { pharmacy: { doses: 'bad' } } })), []);
  const t = tech(); t.extra.makerProjects.projects.push({ id: 'p2', name: 'Done', op: 'fabricate', category: 'cheap', price: 0, status: 'complete', rolls: [] });
  const ledger = R.ledger(t, 'ru');
  assert.match(ledger, /Heavy Pistol/); assert.doesNotMatch(ledger, /Done/); assert.match(ledger, /data-rp-open="repair"/);
  assert.equal(R.ledger({ role: 'rockerboy', rank: 4 }, 'ru'), '');
  assert.equal(R.summary(null, 'ru'), '');
});

test('a finished fabrication puts the catalog weapon on the sheet and pays for the materials through the wallet', () => {
  const w = load(['wallet.js', 'crafting-tools.js', 'role-play.js']); sheetStub(w);
  w.CATALOG = [{ id: 'weapon-heavy-pistol', category: 'weapon', price: 100, name: { ru: 'Тяжёлый пистолет', en: 'Heavy Pistol' }, stats: { damage: '3d6', skill: 'Handgun' } }, { id: 'x-100', category: 'equipment', price: 100, name: { ru: 'Сканер', en: 'Scanner' } }, { id: 'cy', category: 'cyberware', price: 100, name: { ru: 'Имплант', en: 'Implant' } }, { id: 'x-50', category: 'equipment', price: 50, name: { ru: 'Фонарь', en: 'Torch' } }];
  const R = w.RolePlay, c = tech(), before = JSON.stringify(c);
  assert.deepEqual(plain(R.makerCandidates(c.extra.makerProjects.projects[0], 'en')), [{ id: 'weapon-heavy-pistol', name: 'Heavy Pistol', exact: true }, { id: 'x-100', name: 'Scanner', exact: false }]);
  const form = R.makerForm(c, c.extra.makerProjects.projects[0], 'en');
  assert.match(form, /<option value="weapon-heavy-pistol" selected>Heavy Pistol<\/option>/);
  assert.match(form, /Pay 50 eb for materials/); assert.match(form, /2 000 eb now, 1 950 eb left/);
  const r = R.makerDeliver(c, 'p1', { record: true, item: 'weapon-heavy-pistol', pay: true }, 'en');
  assert.equal(JSON.stringify(c), before, 'the character is not mutated');
  assert.equal(r.ok, true);
  assert.equal(r.extra.cash, 1950);
  assert.equal(r.extra.walletLog[0].delta, -50); assert.match(r.extra.walletLog[0].note, /Heavy Pistol/);
  assert.equal(r.extra.weapons.length, 1); assert.equal(r.extra.weapons[0].damage, '3d6'); assert.match(r.extra.weapons[0].notes, /^Fabricated: a Maker project · p\. 1/);
  assert.equal(r.extra.makerProjects.projects[0].status, 'complete');
  assert.deepEqual(plain(r.extra.makerProjects.projects[0].delivered).paid, 50);
  assert.deepEqual(plain(r.extra.keep), { me: 1 });
  assert.match(r.message, /Heavy Pistol.*weapons.*50 eb paid, 1 950 eb left/);
  // A second delivery of the same project is refused.
  c.extra = r.extra;
  assert.equal(R.makerDeliver(c, 'p1', { record: true, pay: true }, 'en').ok, false);
  assert.match(R.makerDeliveredLine(c.extra.makerProjects.projects[0], 'ru'), /в оружии · материалы 50 eb списаны/);
});

test('Maker delivery: a custom item, not enough money, an upgrade mark, closing without the sheet', () => {
  const w = load(['wallet.js', 'crafting-tools.js', 'role-play.js']); sheetStub(w); w.CATALOG = [];
  const R = w.RolePlay;
  let c = tech();
  let r = R.makerDeliver(c, 'p1', { record: true, item: '', pay: false }, 'ru');
  assert.equal(r.ok, true); assert.equal(r.extra.cash, 2000); assert.equal(r.extra.walletLog, undefined);
  assert.equal(r.extra.items[0].name, 'Heavy Pistol'); assert.match(r.message, /в инвентаре/);
  c = tech(); c.extra.cash = 20;
  assert.match(R.makerForm(c, c.extra.makerProjects.projects[0], 'ru'), /data-maker-deliver-pay disabled/);
  r = R.makerDeliver(c, 'p1', { record: true, pay: true }, 'ru');
  assert.equal(r.ok, false); assert.equal(r.reason, 'short'); assert.match(r.message, /Не хватает 30 eb/);
  assert.equal(c.extra.cash, 20); assert.equal(c.extra.makerProjects.projects[0].status, 'passed'); assert.equal(c.extra.items, undefined);
  assert.equal(R.makerDeliver(c, 'p1', { record: true, item: 'nope' }, 'ru').reason, 'item');
  c = tech(); c.extra.makerProjects.projects[0].op = 'upgrade'; c.extra.weapons = [{ name: 'Rifle', notes: 'old' }];
  assert.deepEqual(plain(R.makerTargets(c)), [{ key: 'w0', name: 'Rifle' }]);
  r = R.makerDeliver(c, 'p1', { record: true, target: 'w0', pay: true }, 'en');
  assert.equal(r.ok, true); assert.equal(r.extra.weapons[0].notes, 'old · Upgrade: Heavy Pistol'); assert.equal(r.extra.cash, 1900);
  assert.equal(R.makerDeliver(c, 'p1', { record: true, target: 'w9' }, 'en').reason, 'target');
  c = tech();
  r = R.makerDeliver(c, 'p1', { record: false, item: 'x', pay: true }, 'ru');
  assert.equal(r.ok, true); assert.equal(r.extra.cash, 2000); assert.equal(r.extra.items, undefined); assert.equal(r.extra.makerProjects.projects[0].status, 'complete');
  assert.match(R.makerDeliveredLine(r.extra.makerProjects.projects[0], 'ru'), /без записи/);
  // Not ready, unknown or broken input.
  c = tech(); c.extra.makerProjects.projects[0].status = 'planned';
  assert.equal(R.makerDeliver(c, 'p1', {}, 'ru').ok, false);
  assert.equal(R.makerDeliver(c, 'zz', {}, 'ru').ok, false);
  assert.equal(R.makerDeliver(null, 'p1', {}, 'ru').ok, false);
});

test('Maker projects page: «Завершить» opens the form instead of a system dialog, and the delivery is saved', () => {
  let confirms = 0;
  const w = load(['wallet.js', 'crafting-tools.js', 'role-play.js', 'maker-projects.js']); sheetStub(w); w.CATALOG = []; w.confirm = () => { confirms++; return true; };
  const M = w.MakerProjects, c = tech(), chars = [{ id: 's', name: 'Solo', role: 'solo', rank: 4 }, c];
  M.setScope('user:1');
  const ctx = { lang: 'ru', characters: chars, isCurrent: (x, s) => chars.includes(x) && s === 'user:1' };
  let html = M.render(ctx);
  assert.match(html, /<option value="t" selected>Tech<\/option>/, 'the Tech is preselected, not the first character');
  assert.doesNotMatch(html, /Сначала создайте персонажа/);
  const values = { 'deliver-item': '', 'deliver-target': '' }, pay = { checked: true };
  const root = { isConnected: true, querySelector: () => null };
  const box = { dataset: { makerProject: 'p1' }, closest: s => s === '[data-maker-root]' ? root : null, querySelector: s => s === '[data-maker-deliver-pay]' ? pay : (m => m ? { value: values[m[1]] } : null)(/^\[data-maker-(.+)\]$/.exec(s)) };
  const act = a => { const b = { isConnected: true, dataset: { makerAction: a }, closest: s => s === '[data-maker-action]' ? b : s === '[data-maker-root]' ? root : s === '[data-maker-project]' ? box : null }; return M.handle({ type: 'click', target: b }, ctx); };
  let r = act('complete');
  assert.equal(r.rerender, true); assert.equal(r.dirty, undefined); assert.equal(c.extra.makerProjects.projects[0].status, 'passed');
  html = M.render(ctx);
  assert.match(html, /data-maker-action="deliver"/); assert.match(html, /Списать 50 eb за материалы/);
  assert.equal(act('deliver-cancel').rerender, true);
  assert.doesNotMatch(M.render(ctx), /data-maker-deliver>/);
  act('complete'); r = act('deliver');
  assert.equal(r.dirty, true); assert.match(r.notify, /в инвентаре; списано 50 eb, осталось 1 950 eb/);
  assert.equal(c.extra.cash, 1950); assert.equal(c.extra.items[0].name, 'Heavy Pistol'); assert.equal(c.extra.makerProjects.projects[0].status, 'complete');
  assert.equal(confirms, 0);
  assert.equal(M.state(plain(c)).kind, 'ok', 'the saved shape is still valid after a reload');
  html = M.render(ctx);
  assert.match(html, /class="rp-done">На листе: «Heavy Pistol» в инвентаре · материалы 50 eb списаны/);
  assert.doesNotMatch(html, /data-maker-action="complete"/);
  // A project completed before this change can still be put on the sheet.
  c.extra.makerProjects.projects.push({ id: 'p0', name: 'Old', op: 'fabricate', category: 'cheap', price: 0, status: 'complete', rolls: [{ tech: 7, skill: 6, specialty: 2, modifier: 0, die: 6, extra: 0, total: 21, dv: 9, success: true }] });
  assert.match(M.render(ctx), /data-maker-action="complete">Записать на лист/);
});

test('a tool page starts with the character who has the Role', () => {
  const R = load(['role-play.js']).RolePlay;
  const chars = [{ id: 'a', role: 'solo' }, { id: 'b', role: 'solo', extra: { advancement: { additionalRoles: [{ role: 'medtech', rank: 2 }] } } }, { id: 'c', role: 'medtech' }];
  assert.equal(R.firstWithRole(chars, 'medtech').id, 'b');
  assert.equal(R.firstWithRole(chars, 'tech'), null);
  assert.equal(R.firstWithRole(null, 'tech'), null);
});

test('the module is loaded before the app and after the tools it ties together', () => {
  const index = read('index.html');
  assert.ok(index.indexOf('src="role-play.js"') > index.indexOf('src="wallet.js"'));
  assert.ok(index.indexOf('src="role-play.js"') < index.indexOf('src="app.js"'));
  assert.ok(index.indexOf('href="role-play.css"') > index.indexOf('href="board.css"'));
});
