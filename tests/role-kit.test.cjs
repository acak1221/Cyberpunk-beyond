// Role kit (site/role-kit.js): what the Media, Exec, Lawman, Fixer and Nomad tools write to the sheet.
const { test } = require('node:test'), assert = require('node:assert/strict'), fs = require('node:fs'), vm = require('node:vm');
const source = n => fs.readFileSync(__dirname + '/../site/' + n, 'utf8');
// Loads wallet.js, role-tools.js and role-kit.js into one fake window. `dice` feeds Math.random.
function load(app) {
  const dice = [], math = Object.create(Math); math.random = () => dice.length ? dice.shift() : 0.5;
  const reports = [], w = { CATALOG: [
    { id: 'extra-upgrade-nos', page: 163, name: { ru: 'NOS', en: 'NOS' }, stats: { type: 'upgrade', motoRank: 1 } },
    { id: 'extra-upgrade-heavy-chassis', page: 164, name: { ru: 'Усиленное шасси', en: 'Heavy Chassis' }, stats: { type: 'upgrade', motoRank: 1 } },
    { id: 'extra-upgrade-armored-chassis', page: 163, name: { ru: 'Бронированное шасси', en: 'Armored Chassis' }, stats: { type: 'upgrade', motoRank: 5 } }
  ], App: { report: (...a) => { reports.push(a); return true; }, ...(app || {}) }, Rolls: { check: (...a) => { reports.push(a); return true; } } };
  const ctx = { window: w, document: { addEventListener() {}, documentElement: { lang: 'ru' } }, Math: math, JSON, Number, String, Array, Object, Date, Set, Map, WeakMap, Proxy, Reflect, setTimeout: () => 0, console };
  ctx.globalThis = ctx; vm.createContext(ctx);
  for (const f of ['wallet.js', 'role-tools.js', 'role-kit.js']) vm.runInContext(source(f), ctx);
  return { K: w.RoleKit, RT: w.RoleTools, W: w.Wallet, w, dice, reports };
}
const sheet = (role, more) => ({ id: role, name: role, role, rank: 4, stats: { INT: 6, REF: 7, DEX: 6, TECH: 6, COOL: 7, WILL: 6, LUCK: 6, MOVE: 6, BODY: 6, EMP: 6 }, skills: { Trading: 6, 'Drive Land Vehicle': 6 }, hp: 35, humanity: 60, extra: { cash: 2000 }, ...(more || {}) });
// A DOM-free stand-in for the pressed control: closest() finds itself or the box around it.
function control(dataset, fields) {
  const box = { querySelector: sel => { const k = /data-rk-input="(\w+)"/.exec(sel)?.[1]; return k && fields && k in fields ? { value: fields[k] } : null; } };
  const el = { dataset, isConnected: true, textContent: 'x', parentElement: box, value: fields?.value };
  el.closest = sel => /data-rk-action|data-rk-field|data-rk-input/.test(sel) ? el : /rk-box|data-rk-pay/.test(sel) ? box : null;
  return el;
}
const click = (h, c, dataset, fields) => h.K.handle({ type: 'click', target: control(dataset, fields) }, c, 'ru', { isCurrent: () => true });
const change = (h, c, dataset, value) => h.K.handle({ type: 'change', target: control(dataset, { value }) }, c, 'ru', { isCurrent: () => true });

test('role checks take the wound penalty, effects, the sheet modifier and LUCK set aside, and spend them like a sheet roll', () => {
  const h = load({ rollMods: () => ({ wound: -2, effect: 1 }) }), c = sheet('fixer', { extra: { cash: 0, modifier: 3, luckUse: 2, luck: 5 } });
  assert.deepEqual({ ...h.K.sheetMods(c, 'Trading', 'COOL') }, { wound: -2, effect: 1, modifier: 3, luck: 2, pool: 5, total: 4 });
  const m = h.K.takeMods(c, 'Trading', 'COOL', 'ru');
  assert.equal(m.total, 4); assert.equal(m.text, ' · ранение −2, эффекты +1, модификатор листа +3, LUCK +2');
  assert.equal(c.extra.luck, 3); assert.equal(c.extra.luckUse, 0); assert.equal(c.extra.modifier, 0);
  const held = sheet('fixer', { extra: { modifier: 1, modifierHold: true } });
  h.K.takeMods(held, 'Trading', 'COOL', 'en'); assert.equal(held.extra.modifier, 1);
  assert.equal(load().K.takeMods(sheet('fixer'), 'Trading', 'COOL', 'en').text, '');
  assert.equal(h.K.modsText({ wound: -4, effect: 0, modifier: 0, luck: 0 }, 'en'), ' · wound −4');
});

test('the haggle, the vehicle check and the rumor search of role-tools.js add the sheet modifiers', () => {
  const h = load({ rollMods: () => ({ wound: -2, effect: 0 }) }), c = sheet('fixer');
  const button = { dataset: { rtAction: 'fixer-roll' }, isConnected: true, closest: sel => /data-rt-action/.test(sel) ? button : null, hasAttribute: () => false, matches: () => false };
  h.dice.push(0.45); // 1d10 = 5
  const r = h.RT.handle({ type: 'click', target: button }, c, 'ru', { isCurrent: () => true });
  assert.equal(r.handled, true);
  assert.match(c.extra.roleTools.fixer.last, /Operator 4 · ранение −2 · 1d10 5 → 20 > 10/); // 7 + 6 + 4 − 2 + 5
  assert.match(source('role-tools.js'), /window\.RoleKit\?\.takeMods\?\.\(c,skill\[0\],skill\[3\],l\)/);
  assert.match(source('role-tools.js'), /window\.RoleKit\?\.takeMods\?\.\(c,skill,stat,l\)/);
  assert.match(source('app.js'), /rollMods:\(c,kind,skill,stat\)=>\(\{wound:woundPenalty\(c\),effect:effectModifier\(c,kind,skill,stat\)\}\)/);
});

test('believability, Loyalty and backup calls are written to the roll history', () => {
  const h = load();
  assert.equal(h.K.log('Loyalty', '1d6 2 < 4', 2, 6), true);
  assert.deepEqual(JSON.parse(JSON.stringify(h.reports[0])), ['Loyalty', '1d6 2 < 4', 2, [{ v: 2, s: 6 }]]);
  for (const label of ["window.RoleKit?.log?.(ru?'Достоверность':'Credibility',s.last,roll,10)", "window.RoleKit?.log?.('Loyalty',s.last,roll,6)", "window.RoleKit?.log?.(ru?'Подкрепление':'Backup',s.last,call,10)"]) assert.ok(source('role-tools.js').includes(label));
});

test('money goes through Wallet: a perk is offered, paid, refused when short and undone', () => {
  const h = load(), c = sheet('exec');
  c.extra.roleTools = { exec: { values: {}, team: [{ id: 'm1', name: 'Джуди', loyalty: 4 }] } };
  assert.equal(h.K.suggestPay(c, { kind: 'perk', member: 'm1', amount: 200 }), true);
  const p = h.K.pays(c)[0];
  assert.match(h.K.memberBlock(c, c.extra.roleTools.exec.team[0], 0, 'ru'), /Бонус сотруднику: Джуди[\s\S]*Списать с кошелька[\s\S]*Не списывать/);
  let r = click(h, c, { rkAction: 'pay', rkId: p.id }, { amount: '5000' });
  assert.match(r.notify, /Не хватает 3 000 eb/); assert.equal(c.extra.cash, 2000); assert.equal(h.K.pays(c).length, 1);
  r = click(h, c, { rkAction: 'pay', rkId: p.id }, { amount: '200' });
  assert.equal(r.dirty, true); assert.equal(c.extra.cash, 1800); assert.equal(h.K.pays(c).length, 0);
  assert.equal(c.extra.walletLog[0].delta, -200); assert.equal(c.extra.walletLog[0].note, 'Бонус сотруднику: Джуди');
  assert.match(h.K.walletLine(c, 'ru'), /Последняя операция: −200 eb[\s\S]*Отменить/);
  const undo = control({ rkAction: 'undo' });
  assert.equal(h.K.handle({ type: 'click', target: undo }, c, 'ru', {}).dirty, undefined); // the first press only arms the button
  assert.equal(c.extra.cash, 1800);
  assert.equal(h.K.handle({ type: 'click', target: undo }, c, 'ru', {}).dirty, true);
  assert.equal(c.extra.cash, 2000); assert.equal(c.extra.roleKit.last, undefined);
  h.K.suggestPay(c, { kind: 'replacement', member: 'm1' });
  click(h, c, { rkAction: 'pay-skip', rkId: h.K.pays(c)[0].id });
  assert.equal(c.extra.cash, 2000); assert.equal(h.K.pays(c).length, 0);
});

test('a Fixer deal can be paid, received or split into an instalment with a debt', () => {
  const h = load(), c = sheet('fixer'), q = d => h.RT.quoteFixerDeal({ rank: 9, unit: 500, quantity: 1, direction: 'buy', priceChange: 'decrease', category: 'luxury', danger: false, success: true, ...d });
  assert.deepEqual({ ...h.K.dealMoney(q({ deal: 'percent10' })) }, { delta: -450, kind: 'buy' });
  assert.deepEqual({ ...h.K.dealMoney(q({ deal: 'percent20', direction: 'sell', priceChange: 'increase' })) }, { delta: 600, kind: 'sell' });
  assert.deepEqual({ ...h.K.dealMoney(q({ deal: 'job20' })) }, { delta: 600, kind: 'job' });
  assert.deepEqual({ ...h.K.dealMoney(q({ deal: 'installments', unit: 3000 })) }, { delta: -1500, later: 1500, kind: 'installments' });
  assert.equal(h.K.dealMoney({ ok: false }), null);
  assert.match(h.K.dealActions(c, q({ deal: 'percent10' }), 'ru'), /Списать 450 eb с кошелька/);
  assert.match(h.K.dealActions(c, q({ deal: 'percent10' }), 'en'), /Pay 450 eb from wallet/);
  click(h, c, { rkAction: 'deal-apply', rkDelta: '-450', rkLater: '0', rkKind: 'buy' });
  assert.equal(c.extra.cash, 1550);
  click(h, c, { rkAction: 'deal-apply', rkDelta: '-1500', rkLater: '1500', rkKind: 'installments' });
  assert.equal(c.extra.cash, 50); assert.equal(h.K.debts(c).length, 1); assert.equal(h.K.debts(c)[0].amount, 1500);
  assert.match(h.K.fixerBlock(c, 'ru'), /Долг: 1 500 eb[\s\S]*Оплатить/);
  const short = click(h, c, { rkAction: 'debt-pay', rkId: h.K.debts(c)[0].id });
  assert.match(short.notify, /Не хватает 1 450 eb/); assert.equal(h.K.debts(c).length, 1);
  c.extra.cash = 5000;
  click(h, c, { rkAction: 'debt-pay', rkId: h.K.debts(c)[0].id });
  assert.equal(c.extra.cash, 3500); assert.equal(h.K.debts(c).length, 0);
  assert.equal(h.K.undoLast(c).ok, true); assert.equal(c.extra.cash, 5000); assert.equal(h.K.debts(c).length, 1); // the debt is back
  assert.ok(!source('role-tools.js').includes('деньги, инвентарь и долг не меняются'));
});

test('a family vehicle has a stat block, takes damage to SDP, is repaired and keeps structured upgrades', () => {
  const h = load(), c = sheet('nomad'), bike = { id: 'v1', name: 'Ласточка', type: 'roadbike', out: false, notes: '' };
  c.extra.roleTools = { nomad: { values: {}, team: [], motorpool: { version: 1, vehicles: [bike] } } };
  assert.deepEqual([h.K.vehicleState(c, bike).sdp, h.K.vehicleState(c, bike).max, h.K.vehicleState(c, bike).seats, h.K.vehicleState(c, bike).move], [35, 35, 2, 20]);
  assert.equal(h.K.vehicleState(c, { id: 'x', type: 'nope' }), null);
  assert.match(h.K.vehicleBlock(c, bike, 'ru'), /<b>SDP<\/b> 35 \/ 35[\s\S]*<b>Мест<\/b> 2[\s\S]*<b>MOVE<\/b> 20[\s\S]*Нанести урон/);
  let r = click(h, c, { rkAction: 'veh-hit', rkId: 'v1' }, { amount: '14' });
  assert.equal(r.dirty, true); assert.match(r.notify, /SDP 35 → 21/); assert.equal(c.extra.roleKit.vehicles.v1.sdp, 21);
  assert.equal(click(h, c, { rkAction: 'veh-hit', rkId: 'v1' }, { amount: '' }).dirty, undefined);
  click(h, c, { rkAction: 'veh-fix', rkId: 'v1' }, { amount: '4' }); assert.equal(h.K.vehicleState(c, bike).sdp, 25);
  click(h, c, { rkAction: 'veh-hit', rkId: 'v1' }, { amount: '99' });
  assert.equal(h.K.vehicleState(c, bike).destroyed, true); assert.match(h.K.vehicleBlock(c, bike, 'ru'), /Оплатить ремонт семье: 500 eb/);
  click(h, c, { rkAction: 'veh-family', rkId: 'v1' });
  assert.equal(c.extra.cash, 1500); assert.equal(h.K.vehicleState(c, bike).sdp, 35);
  // upgrades: saved at once, locked by rank, Heavy Chassis adds 20 SDP
  r = change(h, c, { rkField: 'veh-upgrade', rkId: 'v1' }, 'extra-upgrade-heavy-chassis');
  assert.equal(r.dirty, true); assert.deepEqual([...c.extra.roleKit.vehicles.v1.ups], ['extra-upgrade-heavy-chassis']);
  assert.deepEqual([h.K.vehicleState(c, bike).sdp, h.K.vehicleState(c, bike).max], [55, 55]);
  r = change(h, c, { rkField: 'veh-upgrade', rkId: 'v1' }, 'extra-upgrade-armored-chassis');
  assert.match(r.notify, /нужен ранг 5/); assert.equal(h.K.vehicleState(c, bike).ups.length, 1);
  assert.match(h.K.vehicleBlock(c, bike, 'ru'), /value="extra-upgrade-armored-chassis" disabled/);
  assert.deepEqual({ ...h.K.motoChoices(c, [bike], 4) }, { used: 2, limit: 4, over: false });
  assert.equal(h.K.motoChoices(c, [bike, { ...bike, id: 'v2' }], 2).over, true);
  assert.match(h.K.motoCount(c, 'ru'), /занято 2 из 4/);
  const x = control({ rkAction: 'veh-up-remove', rkId: 'v1', rkIndex: '0' });
  h.K.handle({ type: 'click', target: x }, c, 'ru', {}); assert.equal(h.K.vehicleState(c, bike).ups.length, 1); // armed only
  h.K.handle({ type: 'click', target: x }, c, 'ru', {}); assert.deepEqual([h.K.vehicleState(c, bike).ups.length, h.K.vehicleState(c, bike).sdp], [0, 35]);
  // an old save without roleKit simply shows a full vehicle
  assert.equal(h.K.vehicleState({ extra: {} }, bike).sdp, 35);
  // the manoeuvre list sets the DV of the Nomad check
  r = change(h, c, { rkField: 'maneuver' }, 'bootleg');
  assert.equal(c.extra.roleTools.nomad.values.vehicleDv, 17); assert.match(h.K.maneuverSelect(c, 'ru'), /value="bootleg" selected/);
});

test('a team member made by the book has HP, armor and rolls; the rank limits the team', () => {
  const h = load(), c = sheet('exec'), m = { id: 'm1', name: 'Джуди', loyalty: 4, hp: 40, execProfile: { version: 1, job: 'bodyguard', roll: 1 } };
  c.extra.roleTools = { exec: { values: {}, team: [m] } };
  const st = h.K.memberState(c, m), handgun = h.K.memberSkills(st.profile).find(s => s.name === 'Handgun');
  assert.equal(st.sp, 11); assert.equal(handgun.level, 6); assert.equal(handgun.stat, 'REF'); assert.equal(handgun.total, st.profile.stats.REF + 6);
  assert.equal(h.K.memberSkills(st.profile).find(s => s.key === 'Language').stat, 'INT');
  assert.match(h.K.memberBlock(c, m, 0, 'ru'), /<b>HP<\/b> 40 \/ \d+[\s\S]*<b>SP<\/b> 11[\s\S]*Бросить навык[\s\S]*Атака: пистолет[\s\S]*Урон пистолета 4d6/);
  assert.equal(h.K.memberBlock(c, { id: 'm2', name: 'manual' }, 1, 'ru'), '');
  let r = click(h, c, { rkAction: 'member-hit', rkIndex: '0' }, { amount: '17' });
  assert.equal(m.hp, 34); assert.equal(h.K.memberState(c, m).sp, 10); assert.match(r.notify, /HP 40 → 34, SP 11 → 10/);
  r = click(h, c, { rkAction: 'member-hit', rkIndex: '0' }, { amount: '5' });
  assert.equal(m.hp, 34); assert.match(r.notify, /броня выдержала/);
  click(h, c, { rkAction: 'member-heal', rkIndex: '0' }, { amount: '999' }); assert.equal(m.hp, st.max);
  h.dice.push(0.45);
  r = click(h, c, { rkAction: 'member-attack', rkIndex: '0' });
  assert.match(r.notify, new RegExp(`Джуди · .*: REF ${st.profile.stats.REF} \\+ 6 · 1d10 5 → ${handgun.total + 5}`));
  m.hp = 1; h.dice.push(0.45);
  r = click(h, c, { rkAction: 'member-attack', rkIndex: '0' });
  assert.match(r.notify, new RegExp(`−2 \\(ранение\\) · 1d10 5 → ${handgun.total + 3}`));
  h.dice.push(0, 0.2, 0.99, 0.99);
  r = click(h, c, { rkAction: 'member-damage', rkIndex: '0', rkDice: '4' });
  assert.match(r.notify, /4d6: 1 \+ 2 \+ 6 \+ 6 = 15 · критическая травма/);
  change(h, c, { rkField: 'member-sp', rkIndex: '0' }, '7'); assert.equal(h.K.memberState(c, m).sp, 7);
  assert.deepEqual([0, 3, 4, 5, 9].map(h.K.teamLimit), [0, 1, 1, 2, 3]);
  assert.equal(h.K.teamFull(0, 4, 'ru'), ''); assert.match(h.K.teamFull(1, 4, 'ru'), /не больше 1/); assert.match(h.K.teamFull(0, 2, 'en'), /from rank 3/);
  assert.match(h.K.teamBlock(c, 'ru'), /В кошельке[\s\S]*Мест в команде по рангу: 1\. Занято: 1\./);
});

test('successful backup is stored with rounds to arrival and HP for every officer', () => {
  const h = load(), c = sheet('lawman');
  assert.equal(h.K.backupBlock(c, 'ru'), ''); assert.equal(h.K.backupTier(c), null);
  assert.equal(h.K.backupArrive(c, { tier: 3, rounds: 2, two: false }), true);
  assert.deepEqual([...h.K.backupState(c).hp], [25, 25, 25, 25]); assert.equal(h.K.backupTier(c), 3);
  assert.match(h.K.backupBlock(c, 'ru'), /раундов до прибытия: 2[\s\S]*Прошёл раунд/);
  click(h, c, { rkAction: 'backup-round' }); click(h, c, { rkAction: 'backup-round' });
  assert.equal(h.K.backupState(c).rounds, 0); assert.match(h.K.backupBlock(c, 'ru'), /на месте/);
  change(h, c, { rkField: 'backup-hp', rkIndex: '1' }, '9'); assert.deepEqual([...h.K.backupState(c).hp], [25, 9, 25, 25]);
  h.K.backupArrive(c, { tier: 10, rounds: 6, two: true }); assert.equal(h.K.backupState(c).hp.length, 4);
  const gone = control({ rkAction: 'backup-dismiss' });
  h.K.handle({ type: 'click', target: gone }, c, 'ru', {}); assert.ok(h.K.backupState(c));
  h.K.handle({ type: 'click', target: gone }, c, 'ru', {}); assert.equal(h.K.backupState(c), null);
});

test('stale sheets and foreign events are refused; the page loads the module before app.js', () => {
  const h = load(), c = sheet('fixer');
  const r = h.K.handle({ type: 'click', target: control({ rkAction: 'deal-apply', rkDelta: '-10', rkKind: 'buy' }) }, c, 'ru', { isCurrent: () => false });
  assert.equal(r.handled, true); assert.equal(r.dirty, undefined); assert.equal(c.extra.cash, 2000);
  assert.equal(h.K.handle({ type: 'click', target: { closest: () => null } }, c, 'ru', {}).handled, false);
  assert.match(source('index.html'), /<script src="role-kit\.js"><\/script>.*<script src="app\.js">/);
  assert.match(source('index.html'), /href="role-kit\.css"/);
  assert.ok(!/\b(confirm|alert|prompt)\(/.test(source('role-kit.js')));
});
