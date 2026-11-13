// Allies, loot and the player's Death Save in the GM tracker (site/tracker-allies.js).
const { test } = require('node:test'), assert = require('node:assert/strict'), fs = require('node:fs'), vm = require('node:vm');
const source = n => fs.readFileSync(__dirname + '/../site/' + n, 'utf8');
function load(extra) {
  const dice = [], math = Object.create(Math); math.random = () => dice.length ? dice.shift() : 0.5;
  const reports = [], journal = [], sent = [];
  const w = { App: { report: (...a) => { reports.push(a); return true; }, getState: () => ({ lang: 'ru' }) }, ...(extra || {}) };
  const ctx = { window: w, document: { addEventListener() {}, documentElement: { lang: 'ru' } }, Math: math, JSON, Number, String, Array, Object, Date, Set, Map, WeakMap, Proxy, Reflect, setTimeout: () => 0, console, crypto: undefined };
  ctx.globalThis = ctx; vm.createContext(ctx);
  for (const f of ['wallet.js', 'catalog.js', 'catalog-extra.js', 'defenses-extra.js', 'combat-tools.js', 'equipment-tools.js', 'damage-apply.js', 'character-extra.js', 'effects.js', 'play-combat.js', 'gm-tools.js', 'role-tools.js', 'role-kit.js', 'campaigns.js', 'gm-table.js', 'tracker-allies.js']) {
    try { vm.runInContext(source(f), ctx); } catch (e) { if (!['equipment-tools.js', 'defenses-extra.js', 'effects.js', 'damage-apply.js', 'combat-tools.js'].includes(f)) throw new Error(f + ': ' + e.message); }
  }
  return { w, TA: w.TrackerAllies, K: w.RoleKit, G: w.GMTable, CE: w.CharacterExtra, dice, reports, journal, sent };
}
const JOB = 'bodyguard';
const member = (id, roll = 3, name = 'Рик') => ({ id, name, execProfile: { version: 1, job: JOB, roll } });
const exec = (team, backup) => ({ id: 'ex', name: 'Босс', role: 'exec', hp: 35, stats: { BODY: 6, WILL: 6, REF: 7, DEX: 6, LUCK: 5 }, extra: { roleTools: { exec: { team } }, ...(backup ? { roleKit: { version: 1, backup } } : {}) } });
const campaign = (...rows) => ({ id: 'c1', name: 'Test', roster: rows });
const pcRow = c => ({ id: 'row-' + c.id, kind: 'pc', characterId: c.id });
const button = (dataset, more) => { const el = { dataset, isConnected: true, ...(more || {}) }; el.closest = sel => /data-ta-action/.test(sel) ? el : /ta-loot/.test(sel) && more?.box ? more.box : null; return el; };
const click = (h, c, ctx, dataset, more) => h.TA.handle({ type: 'click', target: button(dataset, more) }, c, { lang: 'ru', characters: [], ...ctx });

test('an Exec team member joins the fight with the stat block of the book profile', () => {
  const h = load(), m = member('m1'), pc = exec([m, { id: 'm2', name: 'Без профиля' }]), c = campaign(pcRow(pc));
  const found = h.TA.allyRowsFor(pc, c.roster, 'ru');
  assert.equal(found.exec.length, 1);
  assert.equal(found.exec[0].inFight, false);
  const r = h.TA.addAllies(c, pc, { memberId: 'm1' }, 'ru');
  assert.equal(r.ok, true); assert.equal(c.roster.length, 2);
  const row = c.roster[1];
  assert.equal(row.kind, 'npc'); assert.equal(row.name, 'Рик'); assert.equal(row.ref, 8); assert.equal(row.hp, 45); assert.equal(row.maxHp, 45);
  assert.deepEqual({ ...row.sp }, { head: 11, body: 11 }); assert.equal(row.body, 6); assert.equal(row.initiative, 0);
  assert.equal(row.ally.from, 'exec'); assert.equal(row.ally.characterId, 'ex'); assert.equal(row.ally.memberId, 'm1');
  assert.deepEqual(JSON.parse(JSON.stringify(row.ally.attacks)), [{ name: 'Very Heavy Pistol', base: 14, damage: '4d6' }, { name: 'Brawling', base: 11, damage: '2d6' }]);
  assert.equal(h.TA.addAllies(c, pc, { memberId: 'm1' }, 'ru').ok, false, 'a second add is refused');
  assert.equal(c.roster.length, 2);
  assert.equal(h.TA.allyRowsFor(pc, c.roster, 'ru').exec[0].inFight, true);
  assert.equal(h.TA.addAllies(c, pc, { memberId: 'm2' }, 'ru').ok, false, 'no profile, no stat block');
});

test('Lawman backup joins officer by officer; en route officers are out of the turn order', () => {
  const h = load(), pc = exec([], { tier: 5, rounds: 2, hp: [35, 20] }), c = campaign(pcRow(pc));
  const r = h.TA.addAllies(c, pc, { backup: true }, 'ru');
  assert.equal(r.ok, true); assert.equal(c.roster.length, 3);
  const row = c.roster[2];
  assert.equal(row.ref, 6); assert.equal(row.hp, 20); assert.equal(row.maxHp, 35); assert.equal(row.body, 4); assert.deepEqual({ ...row.sp }, { head: 13, body: 13 });
  assert.equal(row.out, true); assert.match(row.combatNote.text, /2 раунд/);
  assert.deepEqual(JSON.parse(JSON.stringify(row.ally.attacks)), [{ name: 'Heavy Pistol', base: 14, damage: '3d6' }, { name: 'Assault Rifle', base: 14, damage: '5d6' }]);
  assert.equal(h.TA.addAllies(c, pc, { backup: true }, 'ru').ok, false);
  c.roster.pop(); // one officer leaves: only that one is added again
  const again = h.TA.addAllies(c, pc, { backup: true }, 'ru');
  assert.equal(again.added.length, 1); assert.equal(again.added[0].ally.index, 1);
  const arrived = exec([], { tier: 1, rounds: 0, hp: [20] });
  assert.equal(h.TA.addAllies(campaign(), arrived, { backup: true }, 'ru').added[0].out, undefined);
});

test('attacksOf returns the attacks of an allied row and skips malformed ones', () => {
  const h = load();
  const row = { kind: 'npc', ally: { attacks: [{ name: 'Gun', base: 10, damage: '3d6' }, { name: 'Bad', base: 99, damage: '3d6' }, { name: 'Bad2', base: 5, damage: 'lots' }, null, { name: 'Fist', base: 8, damage: '1d6' }] } };
  const list = h.G.attacksOf(row, [], []);
  assert.deepEqual(JSON.parse(JSON.stringify(list.map(a => a.name + ':' + a.base + ':' + a.damage))), ['Gun:10:3d6', 'Fist:8:1d6']);
});

test('sync pushes tracker damage to the sheet, for a team member and for a backup officer', () => {
  const h = load(), m = member('m1'), pc = exec([m], { tier: 5, rounds: 0, hp: [35, 35] }), c = campaign(pcRow(pc));
  h.TA.addAllies(c, pc, { memberId: 'm1' }, 'ru'); h.TA.addAllies(c, pc, { backup: true }, 'ru');
  assert.equal(h.TA.sync(c, [pc], () => false).changed, false);
  const ally = c.roster[1], officer = c.roster[3];
  const hit = h.G.hitNpc(ally, { raw: 20, location: 'body', type: 'standard', lang: 'ru' });
  assert.equal(hit.ok, true); assert.equal(ally.hp, 45 - 9); assert.equal(ally.sp.body, 10);
  h.G.hitNpc(officer, { raw: 20, location: 'body', type: 'standard', lang: 'ru' });
  assert.equal(h.TA.sync(c, [pc], () => false).changed, true);
  assert.equal(m.hp, ally.hp); assert.equal(pc.extra.roleKit.team.m1.sp, 10); assert.equal(pc.extra.roleKit.backup.hp[1], officer.hp);
  assert.equal(h.TA.sync(c, [pc], () => false).changed, false, 'settled');
});

test('sync pulls a heal made on the sheet into the row and lifts the dead mark', () => {
  const h = load(), m = member('m1'), pc = exec([m]), c = campaign(pcRow(pc));
  h.TA.addAllies(c, pc, { memberId: 'm1' }, 'ru');
  const row = c.roster[1];
  row.hp = 0; row.dead = true; row.deathPenalty = 2; h.TA.sync(c, [pc], () => false);
  assert.equal(m.hp, 0);
  h.K.memberHeal(pc, m, 10);
  assert.equal(h.TA.sync(c, [pc], () => false).changed, true);
  assert.equal(row.hp, 10); assert.equal(row.ally.hp, 10); assert.equal(row.dead, undefined); assert.equal(row.deathPenalty, undefined);
});

test('sync leaves rows alone when the owner is online or the link is stale', () => {
  const h = load(), m = member('m1'), pc = exec([m], { tier: 5, rounds: 0, hp: [35, 35] }), c = campaign(pcRow(pc));
  h.TA.addAllies(c, pc, { memberId: 'm1' }, 'ru'); h.TA.addAllies(c, pc, { backup: true }, 'ru');
  const ally = c.roster[1], officer = c.roster[2];
  ally.hp = 5; officer.hp = 7;
  const before = JSON.stringify(c);
  h.TA.sync(c, [pc], () => true); assert.equal(JSON.stringify(c), before); assert.equal(m.hp, undefined);
  pc.extra.roleTools.exec.team = []; pc.extra.roleKit.backup.tier = 8; pc.extra.roleKit.backup.hp = [50];
  const sheet = JSON.stringify(pc);
  h.TA.sync(c, [pc], () => false); assert.equal(JSON.stringify(c), before); assert.equal(JSON.stringify(pc), sheet);
  h.TA.sync(c, [], () => false); assert.equal(JSON.stringify(c), before);
});

const row = (template, more) => ({ id: 'n1', kind: 'npc', name: 'Ганк 2', sourceTemplate: template, hp: 0, ...(more || {}) });
test('loot items come from the template; matches are certain, the rest is a plain item', () => {
  const h = load(), T = h.w.GMTools.NPC_TEMPLATES, C = h.w.CATALOG;
  const items = h.TA.lootItems(row('security-operative'), T, [], C, 'en'), by = n => items.find(i => i.name === n);
  assert.equal(by('Poor Quality Assault Rifle').catalogId, '');
  assert.equal(by('Very Heavy Pistol').catalogId, 'weapon-very-heavy-pistol');
  assert.equal(by('Kevlar').catalogId, 'armor-kevlar'); assert.equal(by('Kevlar').kind, 'armor');
  assert.deepEqual({ ...by('Rifle Ammo') }, { key: by('Rifle Ammo').key, name: 'Rifle Ammo', qty: 40, catalogId: '', kind: 'gear' });
  assert.equal(by('Radio Communicator').catalogId, 'gear-radio-communicator');
  const boost = h.TA.lootItems(row('boosterganger'), T, [], C, 'en').map(i => i.name);
  assert.ok(!boost.includes('Rippers') && !boost.includes('Techhair')); assert.ok(h.TA.lootItems(row('boosterganger'), T, [], C, 'en').some(i => i.catalogId === 'armor-leathers'));
  const psycho = h.TA.lootItems(row('cyberpsycho'), T, [], C, 'en').map(i => i.name);
  assert.ok(!psycho.some(n => /cyber|popup|wolver|subdermal|grafted|neural/i.test(n)), psycho.join('|'));
  assert.ok(psycho.includes('Heavy Pistol Ammo')); assert.equal(h.TA.lootItems(row('security-officer'), T, [], C, 'en').find(i => i.name === 'Handcuffs').qty, 2);
  const keys = h.TA.lootItems(row('security-operative'), T, [], C, 'en').map(i => i.key);
  assert.deepEqual(keys, items.map(i => i.key), 'deterministic');
  const rest = h.TA.lootItems(row('security-operative', { lootTaken: [keys[0], keys[1]] }), T, [], C, 'en');
  assert.equal(rest.length, items.length - 2); assert.ok(!rest.some(i => i.key === keys[0]));
  assert.equal(h.TA.lootItems(row('security-operative'), T, [], C, 'ru').find(i => i.catalogId === 'armor-kevlar').name, 'Кевлар');
  assert.equal(h.TA.lootItems({ kind: 'npc', hp: 0 }, T, [], C, 'en').length, 0);
  const lib = h.TA.lootItems({ kind: 'npc', sourceLibrary: 'l1' }, T, [{ id: 'l1', weapons: 'Very Heavy Pistol 4d6; Baseball bat 2d6' }], C, 'en');
  assert.deepEqual(JSON.parse(JSON.stringify(lib.map(i => [i.name, i.kind, i.catalogId]))), [['Very Heavy Pistol', 'weapon', 'weapon-very-heavy-pistol'], ['Baseball bat', 'gear', '']]);
});

test('the alias table points to catalog items and no template item maps to cyberware', () => {
  const h = load(), C = h.w.CATALOG;
  for (const [k, id] of Object.entries(h.TA.ALIASES)) assert.ok(C.some(x => x.id === id), k);
  for (const t of h.w.GMTools.NPC_TEMPLATES) for (const i of h.TA.lootItems({ kind: 'npc', sourceTemplate: t.id }, h.w.GMTools.NPC_TEMPLATES, [], C, 'en')) assert.notEqual(C.find(x => x.id === i.catalogId)?.category, 'cyberware', t.id + ' ' + i.name);
});

test('giveLocal stages a copy: catalog weapons, quantities, plain items, and nothing on failure', () => {
  const h = load(), T = h.w.GMTools.NPC_TEMPLATES, C = h.w.CATALOG;
  const pc = { id: 'p', name: 'Мира', stats: {}, extra: {} }, before = JSON.stringify(pc);
  const officer = h.TA.lootItems(row('security-officer'), T, [], C, 'en'), op = h.TA.lootItems(row('security-operative'), T, [], C, 'en');
  const pick = (list, n) => list.find(i => i.name === n);
  const r = h.TA.giveLocal(pc, [pick(op, 'Very Heavy Pistol'), pick(officer, 'Handcuffs'), pick(op, 'Rifle Ammo')], 'Ганк 2', 'en');
  assert.equal(r.ok, true); assert.equal(JSON.stringify(pc), before, 'the character itself is not changed');
  assert.equal(r.extra.weapons[0].catalogId, 'weapon-very-heavy-pistol'); assert.match(r.extra.weapons[0].notes, /Loot: Ганк 2/);
  assert.equal(r.extra.items.find(i => i.catalogId === 'gear-handcuffs').quantity, 2);
  const ammo = r.extra.items.find(i => i.name === 'Rifle Ammo');
  assert.equal(ammo.quantity, 40); assert.equal(ammo.category, 'equipment'); assert.match(ammo.notes, /Loot/);
  h.CE.addCatalog = () => null;
  assert.equal(h.TA.giveLocal(pc, [pick(op, 'Very Heavy Pistol')], 'x', 'en').ok, false);
});

test('stash moves the rest of a dead NPC to the flat loot pile and ignores the living', () => {
  const h = load(), c = campaign(); h.w.App.getState = () => ({ lang: 'ru' });
  assert.equal(h.TA.stash(c, [row('security-operative', { hp: 12 })], 'en'), 0); assert.equal(c.lootPile, undefined);
  const n = h.TA.stash(c, [row('security-operative', { dead: true, hp: 9, lootTaken: [] })], 'en');
  assert.ok(n >= 5); assert.equal(c.lootPile.length, n);
  for (const e of c.lootPile) { assert.equal(e.from, 'Ганк 2'); assert.equal(e.fromId, 'n1'); assert.equal(typeof e.name, 'string'); assert.ok(e.qty >= 1); assert.ok(!Object.values(e).some(v => v && typeof v === 'object')); }
  c.lootPile = Array.from({ length: 119 }, (_, i) => ({ id: 'o' + i, from: 'x', fromId: 'x', name: 'x', qty: 1, kind: 'gear', catalogId: '', at: 1 }));
  h.TA.stash(c, [row('security-operative', { out: true })], 'en');
  assert.equal(c.lootPile.length, 120); assert.ok(!c.lootPile.some(e => e.id === 'o0')); assert.equal(c.lootPile.at(-1).fromId, 'n1');
  assert.equal(h.TA.lootable({ kind: 'npc', own: 'x', hp: 0 }, [1]), false); assert.equal(h.TA.lootable({ kind: 'npc', ally: {}, hp: 0 }, [1]), false);
});

test('the Death Save from the sheet functions: penalty, natural 10, record', () => {
  const h = load(), pc = { id: 'p', name: 'Мира', hp: 0, stats: { BODY: 8 }, extra: { baseDeathPenalty: 1, deathPenalty: 1 } };
  const s = h.CE.deathSaveStart(pc, 'mortal', 'en');
  assert.equal(s.ok, true); assert.equal(s.q.penalty, 1); assert.equal(s.q.body, 8); assert.equal(pc.extra.deathPenalty, 2);
  const ok = h.CE.deathSaveResolve(pc, s.q, 5, 'en');
  assert.equal(ok.success, true); assert.equal(ok.total, 6); assert.match(ok.detail, /1d10 5 \+ 1 < BODY 8 — success/); assert.equal(pc.extra.deathRecord.dead, false);
  const s2 = h.CE.deathSaveStart(pc, 'mortal', 'ru'), bad = h.CE.deathSaveResolve(pc, s2.q, 10, 'ru');
  assert.equal(s2.q.penalty, 2); assert.equal(bad.success, false); assert.match(bad.detail, /натуральная 10/); assert.equal(pc.extra.deathRecord.dead, true);
  const dead = h.CE.deathSaveStart(pc, 'mortal', 'en'); assert.equal(dead.ok, false); assert.equal(dead.key, 'deathDead'); assert.ok(dead.text);
  assert.equal(h.CE.deathSaveStart({ hp: 5, stats: { BODY: 5 }, extra: {} }, 'mortal', 'en').key, 'deathOnly');
});

test('pc-death rolls through the sheet functions, reports and journals; an online player gets only a hint', () => {
  const h = load(), pc = { id: 'p', name: 'Мира', hp: 0, stats: { BODY: 8 }, extra: { baseDeathPenalty: 0, deathPenalty: 0 } }, r = pcRow(pc), c = campaign(r);
  const entries = []; h.w.Campaigns.journalAdd = (cc, text, auto) => { entries.push([text, auto]); return true; };
  assert.equal(h.TA.deathButtonState(pc).show, true); assert.equal(h.TA.deathButtonState(pc).target, 8);
  h.dice.push(0.3); // 1d10 = 4
  const res = click(h, c, { characters: [pc] }, { taAction: 'pc-death', id: r.id });
  assert.equal(res.dirty, true); assert.equal(pc.extra.deathPenalty, 1); assert.equal(pc.extra.deathRecord.lastRoll.die, 4);
  assert.equal(h.reports.length, 1); assert.match(h.reports[0][0], /^Мира · /); assert.deepEqual(JSON.parse(JSON.stringify(h.reports[0][3])), [{ v: 4, s: 10 }]);
  assert.equal(entries.length, 1); assert.equal(entries[0][1], true); assert.equal(r.out, undefined);
  h.dice.push(0.95); // 10: fails
  click(h, c, { characters: [pc] }, { taAction: 'pc-death', id: r.id });
  assert.equal(pc.extra.deathRecord.dead, true); assert.equal(r.out, true); assert.equal(h.TA.deathButtonState(pc).show, false);
  const online = { id: 'q', name: 'Он', hp: 0, stats: { BODY: 8 }, extra: { baseDeathPenalty: 0, deathPenalty: 0 } }, oc = campaign(pcRow(online)), snapshot = JSON.stringify(online);
  h.w.Room = { grantLink: { memberFor: () => 'm-1' } }; h.w.RoomGrants = { sendTo: () => ({ ok: true }) };
  const o = click(h, oc, { characters: [online] }, { taAction: 'pc-death', id: oc.roster[0].id });
  assert.equal(JSON.stringify(online), snapshot); assert.match(o.notify, /в комнате/);
  assert.match(h.TA.pcHTML(oc.roster[0], online, oc, [online], 'ru'), /Игрок в комнате/);
});

test('loot-give gives to a local sheet, to a player in the room, and marks only what was sent', () => {
  const h = load(), T = h.w.GMTools.NPC_TEMPLATES; h.w.App.getState = () => ({ lang: 'ru' });
  const pc = { id: 'p', name: 'Мира', stats: {}, extra: {} }, npc = row('security-operative', { dead: true, hp: 0 }), c = campaign(pcRow(pc), npc);
  const entries = []; h.w.Campaigns.journalAdd = (cc, text) => { entries.push(text); return true; };
  const items = h.TA.lootItems(npc, T, [], h.w.CATALOG, 'ru');
  const box = (keys, to) => ({ querySelectorAll: () => items.map(i => ({ checked: keys.includes(i.key), dataset: { taItem: i.key } })), querySelector: () => ({ value: to }) });
  const give = (keys, to, chars) => click(h, c, { characters: chars || [pc] }, { taAction: 'loot-give', src: 'row:n1' }, { box: box(keys, to) });
  const vhp = items.find(i => i.catalogId === 'weapon-very-heavy-pistol'), ammo = items.find(i => i.name === 'Патроны для винтовки');
  assert.match(give([], 'c:p').notify, /Отметьте/);
  const r = give([vhp.key, ammo.key], 'c:p');
  assert.equal(r.dirty, true); assert.equal(pc.extra.weapons.length, 1); assert.equal(pc.extra.items.length, 1);
  assert.deepEqual([...npc.lootTaken].sort(), [vhp.key, ammo.key].sort()); assert.match(entries[0], /Добыча \(Ганк 2\) → Мира: /);
  // a player in the room
  const own = { id: 'o1', kind: 'npc', own: 'x', name: 'Гость', hp: 10 }; c.roster.push(own);
  const calls = []; h.w.Room = { grantLink: { memberFor: x => x === own ? 'm-9' : '' } };
  h.w.RoomGrants = { sendTo: (m, v) => { calls.push([m, v]); return { ok: v.name !== 'Radio Communicator' && !/Радио/.test(v.name) }; } };
  const left = h.TA.lootItems(npc, T, [], h.w.CATALOG, 'ru'), kev = left.find(i => i.catalogId === 'armor-kevlar'), radio = left.find(i => i.catalogId === 'gear-radio-communicator');
  const box2 = { querySelectorAll: () => [kev, radio].map(i => ({ checked: true, dataset: { taItem: i.key } })), querySelector: () => ({ value: 'm:o1' }) };
  const r2 = click(h, c, { characters: [pc] }, { taAction: 'loot-give', src: 'row:n1' }, { box: box2 });
  assert.equal(calls.length, 2); assert.equal(calls[0][0], 'm-9'); assert.equal(calls[0][1].kind, 'item'); assert.equal(calls[0][1].n, 1); assert.match(calls[0][1].note, /Добыча: Ганк 2/);
  assert.ok(npc.lootTaken.includes(kev.key)); assert.ok(!npc.lootTaken.includes(radio.key)); assert.match(r2.notify, /Не отправлено/);
  // from the pile
  c.lootPile = [{ id: 'e1', from: 'Старый', fromId: 'gone', name: 'Фонарь', qty: 1, catalogId: '', kind: 'gear', at: 1 }, { id: 'e2', from: 'Старый', fromId: 'gone', name: 'Верёвка', qty: 2, catalogId: '', kind: 'gear', at: 1 }];
  h.w.Room = undefined;
  const box3 = { querySelectorAll: () => [{ checked: true, dataset: { taItem: 'e1' } }, { checked: false, dataset: { taItem: 'e2' } }], querySelector: () => ({ value: 'c:p' }) };
  click(h, c, { characters: [pc] }, { taAction: 'loot-give', src: 'pile:gone' }, { box: box3 });
  assert.deepEqual(c.lootPile.map(e => e.id), ['e2']); assert.ok(pc.extra.items.some(i => i.name === 'Фонарь'));
  const pile = h.TA.pileHTML(c, [pc], 'ru'); assert.match(pile, /ДОБЫЧА/); assert.match(pile, /Верёвка ×2/);
  assert.equal(click(h, c, { characters: [pc] }, { taAction: 'pile-drop', src: 'pile:gone' }).dirty, undefined);
  assert.equal(click(h, c, { characters: [pc] }, { taAction: 'pile-drop', src: 'pile:gone' }).dirty, true); assert.equal(c.lootPile.length, 0); assert.equal(h.TA.pileHTML(c, [pc], 'ru'), '');
});

test('HTML: caption, escaped names and the hooks in the existing files', () => {
  const h = load(), m = member('m1', 3, '<b>Рик</b>'), pc = exec([m]), c = campaign(pcRow(pc));
  h.TA.addAllies(c, pc, { memberId: 'm1' }, 'ru');
  assert.equal(h.TA.label(c.roster[1], [pc], 'ru'), 'СОЮЗНИК · Босс'); assert.equal(h.TA.label(c.roster[0], [pc], 'ru'), '');
  const html = h.TA.pcHTML(c.roster[0], pc, c, [pc], 'ru');
  assert.match(html, /КОМАНДА/); assert.match(html, /в бою/); assert.ok(!html.includes('<b>Рик'));
  const free = exec([member('a'), member('b', 2)]), cc = campaign(pcRow(free));
  assert.match(h.TA.pcHTML(cc.roster[0], free, cc, [free], 'ru'), /Вся команда в бой/);
  const gm = source('gm-table.js'), camp = source('campaigns.js');
  assert.ok(gm.includes('window.TrackerAllies?.handle?.(e,c,ctx)')); assert.ok(gm.includes('window.TrackerAllies?.lootHTML?.(r,c,characters,lang)'));
  for (const s of ['TrackerAllies?.sync?.(c,characters)', 'TrackerAllies.sync(c,ctx.characters)', 'TrackerAllies?.stash?.(c,c.roster.filter(x=>x.id===target)', "TrackerAllies?.stash?.(c,c.roster.filter(x=>x.kind==='npc')", 'TrackerAllies?.pileHTML?.(c,characters,lang)', 'TrackerAllies?.label?.(r,characters,lang)']) assert.ok(camp.includes(s), s);
  assert.ok(source('index.html').indexOf('tracker-allies.js') > source('index.html').indexOf('gm-table.js'));
  assert.ok(source('index.html').indexOf('tracker-allies.js') < source('index.html').indexOf('"app.js"'));
});

test('an exported and re-imported campaign keeps the ally, the taken keys and the loot pile', () => {
  const read = f => fs.readFileSync(__dirname + '/../site/' + f, 'utf8'), plain = x => JSON.parse(JSON.stringify(x));
  const listeners = {}, document = { addEventListener(t, f) { (listeners[t] ||= []).push(f); }, querySelector: () => null, querySelectorAll: () => [] };
  const w = { document, crypto: { randomUUID: () => 'u-1' }, confirm: () => true }, ctx = { window: w, document, globalThis: w, Math, Number, String, Array, Object, Set, Map, WeakMap, JSON, Date, Promise, RegExp, Error, Infinity, setTimeout, clearTimeout, console, TextEncoder, URL, Blob };
  for (const f of ['beat-chart.js', 'campaigns.js', 'gm-tools.js', 'gm-extras.js', 'npc-library.js', 'room-journal.js', 'campaign-io.js']) vm.runInNewContext(read(f), ctx, { filename: f });
  const ally = { v: 1, from: 'exec', characterId: 'ex', memberId: 'm1', hp: 5, sp: 11, attacks: [{ name: 'Very Heavy Pistol', base: 14, damage: '4d6' }] };
  const st = { lang: 'ru', characters: [], gmWorkspace: w.GMTools.initial(), campaigns: [{ id: 'c1', name: 'T', notes: '', round: 1, turnIndex: 0, roster: [{ id: 'a', kind: 'npc', name: 'Рик', ref: 8, hp: 5, maxHp: 45, initiative: 0, order: 1, sp: { head: 11, body: 11 }, body: 6, ally, lootTaken: ['weapon:x:0'] }], lootPile: [{ id: 'e1', from: 'Ганк', fromId: 'n1', name: 'Kevlar', qty: 1, catalogId: 'armor-kevlar', kind: 'armor', at: 1 }] }] };
  w.App = { getState: () => st, lang: () => 'ru', save: () => Promise.resolve({ ok: true }), render() {}, notify() {}, findImport: () => null, importCharacter: () => ({ ok: false }) };
  const file = JSON.stringify(w.CampaignIO.buildExport(st)), r = w.CampaignIO.parse(file);
  assert.equal(r.ok, true);
  const text = JSON.stringify(plain(r));
  assert.ok(text.includes('"memberId":"m1"') && text.includes('Very Heavy Pistol') && text.includes('weapon:x:0') && text.includes('armor-kevlar'), 'kept: ' + text.slice(0, 600));
});

test('an en-route backup row follows the sheet round count and comes into the turn order on arrival', () => {
  const h = load(), pc = exec([], { tier: 5, rounds: 2, hp: [35, 20] }), c = campaign(pcRow(pc));
  h.TA.addAllies(c, pc, { backup: true }, 'ru');
  const row = c.roster[2]; assert.match(row.combatNote.text, /2 раунд/);
  pc.extra.roleKit.backup.rounds = 1;
  assert.equal(h.TA.sync(c, [pc], () => false).changed, true); assert.match(row.combatNote.text, /1 раунд/); assert.equal(row.out, true);
  pc.extra.roleKit.backup.rounds = 0;
  assert.equal(h.TA.sync(c, [pc], () => false).changed, true); assert.equal(row.out, undefined); assert.equal(row.combatNote, undefined);
});

test('a declined loot offer returns the item to the loot pile; the caption is escaped where it is inserted', () => {
  const h = load(), c = campaign(), hooks = [];
  h.w.Room = { grantLink: { memberFor: () => 'm-9' } };
  h.w.RoomGrants = { sendTo: (m, v, l, hk) => { hooks.push(hk); return { ok: true }; } };
  const own = { id: 'o1', kind: 'npc', own: 'x', name: 'Гость', hp: 10 }; c.roster.push(own);
  const it = { key: 'k1', name: 'Фонарь', qty: 1, catalogId: '', kind: 'gear' };
  assert.equal(typeof h.TA.giveBack, 'function');
  let saved = 0; h.TA.giveBack(c, { id: 'n1' }, 'Ганк', it, { lang: 'ru', save: () => saved++ });
  assert.equal(c.lootPile.length, 1); assert.equal(c.lootPile[0].name, 'Фонарь'); assert.equal(c.lootPile[0].fromId, 'n1'); assert.equal(saved, 1);
  const camp = fs.readFileSync(__dirname + '/../site/campaigns.js', 'utf8');
  assert.ok(camp.includes('esc(window.TrackerAllies?.label?.(r,characters,lang)||t.npcs)'));
  assert.ok(fs.readFileSync(__dirname + '/../site/campaign-io.js', 'utf8').includes('r.ally.characterId=to'));
});
