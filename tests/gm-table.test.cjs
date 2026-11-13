// The Game Master's table (site/gm-table.js): attacks from a tracker row, damage through armor, the party reward, giving loot.
const { test } = require('node:test'), assert = require('node:assert/strict'), fs = require('node:fs'), vm = require('node:vm');
const src = f => fs.readFileSync(__dirname + '/../site/' + f, 'utf8');
function load(files = ['wallet.js', 'combat-tools.js', 'equipment-tools.js', 'damage-apply.js', 'gm-tools.js', 'gm-table.js']) {
  const w = {}, ctx = { window: w, console, document: undefined, navigator: {} };
  vm.createContext(ctx);
  for (const f of files) vm.runInContext(src(f), ctx);
  return w;
}
const seq = list => { let i = 0; return () => list[i++ % list.length]; };
const pc = (id, extra) => ({ id, name: id, role: 'solo', stats: { BODY: 8, WILL: 6 }, hp: 34, head: 11, bodyArmor: 11, ...(extra ? { extra } : {}) });
const plain = x => JSON.parse(JSON.stringify(x));

test('a book NPC attacks with the skill its weapon needs, at the template value', () => {
  const w = load(), G = w.GMTable;
  assert.equal(G.weaponSkill('Poor Quality Very Heavy Pistol'), 'Handgun');
  assert.equal(G.weaponSkill('Assault Rifle'), 'Shoulder Arms');
  assert.equal(G.weaponSkill('Rippers'), 'Melee Weapon');
  assert.equal(G.weaponSkill('Crossbow'), 'Archery');
  assert.equal(G.weaponSkill('Popup Grenade Launcher'), 'Heavy Weapons');
  const list = plain(G.attacksOf({ kind: 'npc', sourceTemplate: 'boosterganger' }, w.GMTools.NPC_TEMPLATES, []));
  assert.deepEqual(list, [{ name: 'Poor Quality Very Heavy Pistol', skill: 'Handgun', base: 12, damage: '4d6', melee: false }, { name: 'Rippers', skill: 'Melee Weapon', base: 11, damage: '2d6', melee: true }]);
  // every weapon of every template gets a skill value, armored where the book gives one
  for (const t of w.GMTools.NPC_TEMPLATES) for (const a of G.attacksOf({ kind: 'npc', sourceTemplate: t.id }, w.GMTools.NPC_TEMPLATES, [])) assert.ok(Number.isSafeInteger(a.base), t.id + ' ' + a.name);
  assert.equal(G.attacksOf({ kind: 'npc', sourceTemplate: 'security-officer' }, w.GMTools.NPC_TEMPLATES, [])[0].base, 8, 'armored Shoulder Arms');
  // a library NPC brings its own attacks; a player row and an unknown source have none
  assert.deepEqual(plain(G.attacksOf({ kind: 'npc', sourceLibrary: 'x' }, [], [{ id: 'x', attacks: [{ name: 'Katana', base: 14, damage: '3d6' }, { name: 'bad', base: 1, damage: 'lots' }] }])), [{ name: 'Katana', skill: '', base: 14, damage: '3d6', melee: true }]);
  assert.equal(G.attacksOf({ kind: 'pc', sourceTemplate: 'boosterganger' }, w.GMTools.NPC_TEMPLATES, []).length, 0);
  assert.equal(G.attacksOf({ kind: 'npc', name: 'Handmade' }, w.GMTools.NPC_TEMPLATES, []).length, 0);
});

test('attack and damage rolls: critical d10, wound penalty, two sixes', () => {
  const G = load().GMTable;
  assert.deepEqual(plain(G.rollAttack(12, 0, seq([0.45]))), { first: 5, extra: 0, base: 12, wound: 0, total: 17 });
  assert.equal(G.rollAttack(12, -2, seq([0.95, 0.35])).total, 12 - 2 + 10 + 4);
  assert.equal(G.rollAttack(12, 0, seq([0, 0.65])).total, 12 + 1 - 7);
  assert.equal(G.rollAttack(12, 0, () => NaN), null);
  assert.equal(G.woundPenalty('serious'), -2); assert.equal(G.woundPenalty('mortal'), -4); assert.equal(G.woundPenalty(''), 0);
  assert.deepEqual(plain(G.rollDamage('4d6', seq([0.9, 0.9, 0.1, 0.4]))), { dice: [6, 6, 1, 3], sides: 6, total: 16, critical: true });
  assert.equal(G.rollDamage('2d6', seq([0.9, 0.1])).critical, false);
  assert.equal(G.rollDamage('nope'), null);
});

test('damage to an NPC row: armor, head, melee, critical bonus, HP stops at 0', () => {
  const G = load().GMTable, npc = () => ({ kind: 'npc', name: 'B', hp: 20, sp: { head: 4, body: 4 } });
  let n = npc(), r = G.hitNpc(n, { raw: 14, location: 'body' });
  assert.deepEqual([r.through, r.dealt, n.hp, n.sp.body, n.maxHp], [10, 10, 10, 3, 20]);
  r = G.hitNpc(n, { raw: 12, location: 'head', critical: true });
  assert.deepEqual([r.through, r.dealt, n.hp, n.sp.head, r.nowMortal], [8, 21, 0, 3, true], '(12 − 4) × 2 + 5, never below 0');
  r = G.hitNpc(n, { raw: 5, location: 'body' });
  assert.deepEqual([n.hp, n.deathPenalty, plain(r.penalty)], [0, 1, [0, 1]], 'a hit on a Mortally Wounded NPC raises the penalty');
  n = npc(); r = G.hitNpc(n, { raw: 3, location: 'body' });
  assert.deepEqual([r.stopped, n.hp, n.sp.body], [true, 20, 4]);
  n = npc(); r = G.hitNpc(n, { raw: 3, location: 'body', type: 'melee' });
  assert.deepEqual([r.sp, r.dealt, n.sp.body], [2, 1, 3], 'melee halves SP');
  n = npc(); r = G.hitNpc(n, { raw: 6, type: 'direct' });
  assert.deepEqual([n.hp, n.sp.body], [14, 4]);
  assert.equal(G.hitNpc(npc(), { raw: 0 }).ok, false); assert.equal(G.hitNpc({ kind: 'pc' }, { raw: 5 }).ok, false);
});

test('damage to a player character goes through the armor on the sheet, by the sheet rules', () => {
  const w = load(), G = w.GMTable, c = pc('v');
  let r = G.hitPc(c, { raw: 15, location: 'body' });
  assert.deepEqual([r.ok, r.dealt, c.hp, c.bodyArmor, c.head], [true, 4, 30, 10, 11], '15 − SP 11 = 4, SP 11 → 10');
  r = G.hitPc(c, { raw: 12, location: 'head', critical: true });
  assert.deepEqual([r.dealt, c.hp, c.head], [7, 23, 10], '(12 − 11) × 2 + 5');
  r = G.hitPc(c, { raw: 5, location: 'body' });
  assert.deepEqual([r.stopped, c.hp, c.bodyArmor], [true, 23, 10]);
  r = G.hitPc(c, { raw: 9, location: 'body', type: 'melee' });
  assert.deepEqual([r.sp, r.dealt, c.bodyArmor], [5, 4, 9]);
  // the same numbers as the sheet's own quote
  const twin = pc('t'), q = w.DamageApply.quote(twin, { type: 'standard', location: 'body', raw: 20, critical: false, source: '' });
  G.hitPc(twin, { raw: 20, location: 'body' });
  assert.deepEqual([twin.hp, twin.bodyArmor], [q.hpAfter, q.spAfter]);
  // a hit on a Mortally Wounded character: Death Save penalty +1
  const down = pc('d', { deathPenalty: 0, baseDeathPenalty: 0 }); down.hp = 0;
  r = G.hitPc(down, { raw: 20, location: 'body' });
  assert.equal(r.ok, true); assert.equal(down.extra.deathPenalty, 1);
  // unreadable sheet: nothing changes
  const odd = pc('o'); odd.hp = 'many'; const before = JSON.stringify(odd);
  assert.equal(G.hitPc(odd, { raw: 5 }).ok, false); assert.equal(JSON.stringify(odd), before);
  assert.match(G.hitText('ru', 'Ви', { raw: 15, sp: 11, through: 4, dealt: 4, from: 34, hp: 30, spFrom: 11, spTo: 10 }), /Ви: 15 − SP 11 = 4\. HP 34 → 30, SP 11 → 10\./);
});

test('party reward: the same sum to each or an even split, IP per character', () => {
  const G = load().GMTable, team = [pc('a', { cash: 100 }), pc('b'), pc('c', { cash: 5, ipLog: [{ id: 'x', delta: 10 }] })];
  let p = G.awardPlan(team, { cash: '500', mode: 'each', ip: '30', ipBy: { b: '40' }, off: {} });
  assert.deepEqual(plain(p.rows), [{ id: 'a', name: 'a', cash: 500, ip: 30 }, { id: 'b', name: 'b', cash: 500, ip: 40 }, { id: 'c', name: 'c', cash: 500, ip: 30 }]);
  p = G.awardPlan(team, { cash: '1000', mode: 'split', ip: '', off: { b: true } });
  assert.deepEqual([p.each, p.rest, p.rows.length], [500, 0, 2]);
  p = G.awardPlan(team, { cash: '1000', mode: 'split', ip: '20' });
  assert.deepEqual([p.each, p.rest], [333, 1]);
  assert.equal(G.awardPlan(team, { cash: '', ip: '' }).reason, 'empty');
  assert.equal(G.awardPlan(team, { cash: '-5' }).reason, 'invalid');
  assert.equal(G.awardPlan(team, { cash: '10', ipBy: { a: 'x' } }).reason, 'invalid');
  assert.equal(G.awardPlan(team, { cash: '10', off: { a: true, b: true, c: true } }).reason, 'empty');
  const before = JSON.stringify(team), s = G.awardStage(team, p, 'Watson job', { at: '2045-01-01T00:00:00.000Z', id: () => 'ip1' });
  assert.equal(s.ok, true); assert.equal(JSON.stringify(team), before, 'staging changes nothing');
  assert.deepEqual(plain(s.changes.map(c => c.extra.cash)), [433, 333, 338]);
  assert.deepEqual(plain(s.changes[2].extra.ipLog), [{ id: 'x', delta: 10 }, { id: 'ip1', date: '2045-01-01', reason: 'Watson job', delta: 20 }]);
  assert.equal(s.changes[0].extra.walletLog[0].note, 'Watson job');
  // all or nothing
  const rich = [pc('a'), pc('r', { cash: 999999999 })];
  assert.deepEqual(plain(G.awardStage(rich, G.awardPlan(rich, { cash: '5' }), '')), { ok: false, reason: 'max', name: 'r' });
  const odd = [pc('a'), { id: 'z', name: 'z', extra: { ipLog: 'no' } }];
  assert.equal(G.awardStage(odd, G.awardPlan(odd, { ip: '5' }), '').reason, 'unsupported');
});

test('undo restores only the fields the action changed', () => {
  const G = load().GMTable, keys = [['hp'], ['extra', 'cash'], ['extra', 'ipLog']], c = { hp: 5, extra: { cash: 10, other: 1 } };
  const before = G.snap(c, keys);
  c.hp = 1; c.extra.cash = 99; c.extra.ipLog = [{ delta: 5 }]; c.extra.updatedAt = 'later';
  G.restore(c, keys, before);
  assert.deepEqual(c, { hp: 5, extra: { cash: 10, other: 1, updatedAt: 'later' } });
});

test('giving an item: free or sold through the wallet, never half done', () => {
  const w = load(), G = w.GMTable, item = { id: 'gear-x', name: { ru: 'Фонарь', en: 'Flashlight' }, category: 'gear', price: 20 };
  w.CharacterExtra = { addCatalog(c, i, l) { c.extra.items = [...(c.extra.items || []), { name: i.name[l] }]; return { kind: 'item', record: c.extra.items.at(-1) }; } };
  const c = pc('a', { cash: 50 }), before = JSON.stringify(c);
  let r = G.giveItem(c, item, 'ru');
  assert.equal(r.ok, true); assert.equal(JSON.stringify(c), before); assert.deepEqual([r.extra.cash, r.extra.items[0].name, r.price], [50, 'Фонарь', 0]);
  r = G.giveItem(c, item, 'en', { sell: true, note: 'Night Market' });
  assert.deepEqual([r.extra.cash, r.balance, r.extra.items[0].name, r.extra.walletLog[0].delta], [30, 30, 'Flashlight', -20]);
  r = G.giveItem(pc('p', { cash: 5 }), item, 'ru', { sell: true });
  assert.deepEqual(plain(r), { ok: false, reason: 'short', short: 15 });
  assert.equal(G.giveItem({ id: 'q', extra: 'bad' }, item, 'ru').ok, false);
  assert.equal(G.giveButton({ item: 'gear-x' }, 'ru').includes('data-gt-give="gear-x"'), true);
  assert.equal(G.giveButton({ cash: 330 }, 'en').includes('data-gt-give-cash="330"'), true);
  assert.equal(G.giveButton({}, 'ru'), '');
});

test('the tracker renders compact rows, a row attack box and the party reward; old campaigns still render', () => {
  const w = load(['wallet.js', 'combat-tools.js', 'equipment-tools.js', 'damage-apply.js', 'gm-tools.js', 'campaigns.js', 'gm-table.js']);
  const chars = [pc('v', { cash: 500 })], c = { id: 'c', name: 'Job', round: 1, turnIndex: 1, roster: [{ id: 'r1', kind: 'pc', characterId: 'v', initiative: 9, order: 1 }, { id: 'n1', kind: 'npc', name: 'Boosterganger', ref: 6, hp: 20, initiative: 5, order: 2, sourceTemplate: 'boosterganger' }, { id: 'n2', kind: 'npc', name: 'Old', ref: 6, hp: 20, initiative: 1, order: 3 }] };
  w.Campaigns.setScope('s');
  const ctx = { lang: 'ru', campaigns: [c], characters: chars, scope: 's', isCurrent: () => true, save() {}, render() {}, notify() {} };
  w.Campaigns.handle({ type: 'click', target: { closest: s => s === '[data-campaign-action]' ? { dataset: { campaignAction: 'open', id: 'c' } } : null } }, ctx);
  const html = w.Campaigns.render([c], chars, 'ru', null);
  assert.equal((html.match(/class="combatant[^"]* gt-row/g) || []).length, 3);
  assert.equal((html.match(/gt-row gt-open/g) || []).length, 1, 'only the opponent whose turn it is opens on its own');
  assert.match(html, /data-gt-action="attack" data-id="n1" data-i="0">⬡ Атака \+12</);
  assert.match(html, /data-gt-action="dmg-roll" data-id="n1" data-i="1">⬡ Урон 2d6</);
  assert.match(html, /data-gt-action="pc-damage" data-id="r1"/);
  assert.match(html, /id="gt-party"[\s\S]*data-gt-award-pc="v"/);
  assert.match(html, /<details class="gt-help">/);
  for (const l of ['ru', 'en']) for (const [k, v] of Object.entries(w.GMTable.text[l])) assert.equal(typeof v, typeof w.GMTable.text[l === 'ru' ? 'en' : 'ru'][k], 'both languages have ' + k);
  const index = src('index.html');
  assert.ok(index.indexOf('src="gm-table.js"') > index.indexOf('src="wallet.js"') && index.indexOf('src="gm-table.js"') < index.indexOf('src="app.js"'));
  assert.ok(index.includes('href="gm-table.css"'));
  assert.doesNotMatch(src('gm-table.js'), /\b(confirm|alert|prompt)\(/);
});

test('online: tracker hits and rewards for a player in the room are sent as grants, not written to the stale copy', () => {
  const fs = require('node:fs'), src = fs.readFileSync(__dirname + '/../site/gm-table.js', 'utf8'), camp = fs.readFileSync(__dirname + '/../site/campaigns.js', 'utf8'), rg = fs.readFileSync(__dirname + '/../site/room-grants.js', 'utf8');
  assert.match(src, /const pc=pcOf\(target\),to=onlineMember\(pc\)\|\|onlineMember\(target\);\s*if\(to\)\{\s*const sent=window\.RoomGrants\.sendTo\(to,\{kind:'damage'/);
  assert.match(src, /plan\.rows=plan\.rows\.filter\(r=>!away\.has\(r\.id\)&&!list\.find\(x=>x\.id===r\.id\)\?\.room\)/);
  assert.match(camp, /if\(to\)\{[\s\S]{0,400}RoomGrants\.sendTo\(to,\{kind:'damage'/);
  assert.match(rg, /function sendTo\(memberId, v, l\)/); assert.match(rg, /trackerButton, sendTo,/);
});

test('a player added from the room is offered the party reward and shows no stale balance', () => {
  const w = load(['wallet.js', 'combat-tools.js', 'equipment-tools.js', 'damage-apply.js', 'gm-tools.js', 'campaigns.js', 'gm-table.js']);
  const chars = [pc('v', { cash: 700 })], c = { id: 'c', name: 'Job', round: 1, turnIndex: 0, roster: [{ id: 'r1', kind: 'pc', characterId: 'v', initiative: 9, order: 1 }, { id: 'o1', kind: 'npc', name: 'Джонни', own: 'a'.repeat(16), hp: 30, initiative: 5, order: 2 }] };
  w.Campaigns.setScope('s');
  const sent = [];
  // offline: the room row is not in the party list
  let html = w.Campaigns.render([c], chars, 'ru', null);
  assert.doesNotMatch(html, /data-gt-award-pc="o1"/);
  w.Room = { grantLink: { memberFor: x => (x.own ? 'm1' : 'm2') }, liveRow: () => null };
  w.RoomGrants = { sendTo: (to, g) => { sent.push([to, g.kind, g.n]); return { ok: true }; } };
  const open = { id: 'c', name: 'Job', round: 1, turnIndex: 0, roster: c.roster };
  w.Campaigns.handle({ type: 'click', target: { closest: s => s === '[data-campaign-action]' ? { dataset: { campaignAction: 'open', id: 'c' } } : null } }, { lang: 'ru', campaigns: [open], characters: chars, scope: 's', isCurrent: () => true, save() {}, render() {}, notify() {} });
  html = w.Campaigns.render([open], chars, 'ru', null);
  assert.match(html, /data-gt-award-pc="o1"/);
  assert.doesNotMatch(html, /700 eb/, 'an online player shows no old balance');
  assert.match(html, /в комнате/);
});

test('a critical hit on an NPC rolls the injury table and writes the result into the note', () => {
  const G = load().GMTable, npc = extra => ({ kind: 'npc', name: 'B', hp: 40, sp: { head: 0, body: 0 }, ...extra });
  let n = npc(), r = G.hitNpc(n, { raw: 5, critical: true, rng: seq([0.99, 0.0]), lang: 'en' });
  assert.equal(r.injury.total, 7);
  assert.equal(n.combatNote.version, 1);
  assert.match(n.combatNote.text, /^Critical Injury \(7\): /);
  assert.ok(n.combatNote.text.length <= 300);
  assert.match(G.hitText('ru', 'B', r), /Крит\. ранение \(2d6 = 7\)/);
  n = npc({ combatNote: { version: 1, text: 'старое' } });
  G.hitNpc(n, { raw: 5, critical: true, rng: seq([0.5]), lang: 'ru' });
  assert.match(n.combatNote.text, /^старое\nКрит\. ранение/);
  n = npc({ combatNote: { weird: 1 } });
  r = G.hitNpc(n, { raw: 5, critical: true, rng: seq([0.5]) });
  assert.deepEqual(plain(n.combatNote), { weird: 1 }, 'an unsupported note is left alone');
  assert.equal(r.injury, null);
  n = npc(); r = G.hitNpc(n, { raw: 5, rng: seq([0.5]) });
  assert.equal(n.combatNote, undefined, 'no critical, no roll');
});
