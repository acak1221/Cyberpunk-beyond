// Role kit: what the role tools of Media, Exec, Lawman, Fixer and Nomad need to reach the sheet.
// Sheet modifiers on role checks, money through Wallet, a vehicle stat block with SDP, team members usable in play,
// backup that arrives and takes damage. Pure helpers first (tested in tests/role-kit.test.cjs); the DOM hooks at the
// bottom are called from site/role-tools.js. Everything this module stores lives in character.extra.roleKit.
(function (global) {
  'use strict';

  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const obj = x => !!x && typeof x === 'object' && !Array.isArray(x);
  const int = (v, min, max, fallback = 0) => { const n = Math.floor(Number(v)); return Number.isFinite(n) ? Math.max(min, Math.min(max, n)) : fallback; };
  const lng = l => l === 'en' ? 'en' : 'ru';
  const signed = n => `${n < 0 ? '−' : '+'}${Math.abs(n)}`;
  const die = n => Math.floor(Math.random() * n) + 1;
  const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  const eb = n => `${global.Wallet?.format ? global.Wallet.format(n) : String(n)} eb`;

  // ---- Stored state -------------------------------------------------------------------------
  const read = c => obj(c?.extra?.roleKit) ? c.extra.roleKit : {};
  function ensure(c) {
    if (!obj(c.extra)) c.extra = {};
    if (!obj(c.extra.roleKit)) c.extra.roleKit = { version: 1 };
    return c.extra.roleKit;
  }
  const bag = (k, key) => { if (!obj(k[key])) k[key] = {}; return k[key]; };
  const list = (k, key) => { if (!Array.isArray(k[key])) k[key] = []; return k[key]; };

  // ---- Sheet modifiers on role checks -------------------------------------------------------
  // The same parts a skill roll on the sheet adds: wound state, active effects, the «Модификатор» field and LUCK set aside.
  function sheetMods(c, skill, stat) {
    if (!obj(c)) return { wound: 0, effect: 0, modifier: 0, luck: 0, pool: 0, total: 0 };
    const x = obj(c.extra) ? c.extra : {};
    let app = null; try { app = global.App?.rollMods?.(c, '', skill, stat) || null; } catch { app = null; }
    const wound = int(app?.wound, -100, 100), effect = int(app?.effect, -100, 100), modifier = int(x.modifier, -100, 100);
    const pool = x.luck === undefined || x.luck === '' ? int(c.stats?.LUCK, 0, 100) : int(x.luck, 0, 100);
    const luck = Math.min(pool, int(x.luckUse, 0, 100));
    return { wound, effect, modifier, luck, pool, total: wound + effect + modifier + luck };
  }
  function modsText(m, lang) {
    const ru = lng(lang) === 'ru', parts = [];
    if (m.wound) parts.push(`${ru ? 'ранение' : 'wound'} ${signed(m.wound)}`);
    if (m.effect) parts.push(`${ru ? 'эффекты' : 'effects'} ${signed(m.effect)}`);
    if (m.modifier) parts.push(`${ru ? 'модификатор листа' : 'sheet modifier'} ${signed(m.modifier)}`);
    if (m.luck) parts.push(`LUCK ${signed(m.luck)}`);
    return parts.length ? ` · ${parts.join(', ')}` : '';
  }
  // Reads the modifiers and spends what a sheet roll spends: LUCK set aside and a one-off modifier.
  function takeMods(c, skill, stat, lang) {
    const m = sheetMods(c, skill, stat);
    if (obj(c) && (m.luck || m.modifier)) {
      if (!obj(c.extra)) c.extra = {};
      const x = c.extra;
      if (m.luck) x.luck = m.pool - m.luck;
      x.luckUse = 0;
      if (x.modifierHold !== true) x.modifier = 0;
    }
    return { ...m, text: modsText(m, lang) };
  }
  // A roll that is not a STAT + skill check (1d10 against a chance, 1d6 Loyalty) still belongs in the roll history.
  function log(label, detail, total, sides) {
    try { return global.App?.report?.(String(label), String(detail), Number(total), [{ v: Number(total), s: sides || 10 }]) === true; } catch { return false; }
  }
  // 1d10 that explodes on 10 and drops on 1, as every check in the game does.
  function d10(base) {
    const first = die(10), extra = first === 1 || first === 10 ? die(10) : 0;
    return { first, extra, total: int(base, -999, 999) + first + (first === 1 ? -extra : extra) };
  }
  function rollText(r, lang) {
    const ru = lng(lang) === 'ru';
    return `1d10 ${r.first}${r.extra ? ` ${r.first === 1 ? '−' : '+'} ${r.extra} (${r.first === 1 ? (ru ? 'критический провал' : 'critical failure') : (ru ? 'критический успех' : 'critical success')})` : ''} → ${r.total}`;
  }

  // ---- Money: always through Wallet ---------------------------------------------------------
  const cash = c => global.Wallet?.cash ? global.Wallet.cash(c) : int(c?.extra?.cash, 0, 999999999);
  // delta < 0 spends, delta > 0 earns. On success the staged extra is assigned; the caller saves.
  function charge(c, delta, note) {
    const W = global.Wallet, d = int(delta, -999999999, 999999999);
    if (!W || !obj(c)) return { ok: false, reason: 'noWallet' };
    const r = d < 0 ? W.spend(c, -d, note) : W.earn(c, d, note);
    if (r.ok) c.extra = r.extra;
    return r;
  }
  function moneyFail(r, lang) {
    const ru = lng(lang) === 'ru';
    if (r?.reason === 'short') return ru ? `Не хватает ${eb(r.short)}. В кошельке ${eb(r.balance)}.` : `${eb(r.short)} short. The wallet holds ${eb(r.balance)}.`;
    if (r?.reason === 'max') return ru ? 'В кошельке не поместится столько денег.' : 'The wallet cannot hold that much.';
    return ru ? 'Введите сумму больше нуля.' : 'Enter an amount above zero.';
  }
  // One money step with an undo: the last operation is remembered on the sheet.
  function pay(c, delta, note, more) {
    const r = charge(c, delta, note);
    if (!r.ok) return r;
    ensure(c).last = { delta: int(delta, -999999999, 999999999), note: String(note).slice(0, 120), ...(more || {}) };
    return r;
  }
  function undoLast(c) {
    const last = read(c).last;
    if (!obj(last) || !int(last.delta, -999999999, 999999999)) return { ok: false, reason: 'invalid' };
    const r = charge(c, -last.delta, `↩ ${last.note || ''}`.trim());
    if (!r.ok) return r;
    const k = ensure(c);
    if (typeof last.debtId === 'string') k.debts = list(k, 'debts').filter(d => d?.id !== last.debtId);
    if (obj(last.paidDebt)) list(k, 'debts').push(last.paidDebt);
    if (obj(last.repaired) && typeof last.repaired.id === 'string') bag(bag(k, 'vehicles'), last.repaired.id).sdp = int(last.repaired.sdp, 0, 9999);
    delete k.last;
    return r;
  }
  // A cost the rules attach to something the player just did (a perk for a team member, a replacement).
  function suggestPay(c, entry) {
    if (!obj(c) || !obj(entry) || !['perk', 'replacement'].includes(entry.kind)) return false;
    const pays = list(ensure(c), 'pay');
    if (pays.length >= 20) pays.shift();
    pays.push({ id: uid(), kind: entry.kind, member: typeof entry.member === 'string' ? entry.member : '', amount: int(entry.amount, 1, 999999999, 200) });
    return true;
  }
  const pays = c => (Array.isArray(read(c).pay) ? read(c).pay : []).filter(p => obj(p) && typeof p.id === 'string' && ['perk', 'replacement'].includes(p.kind));
  const payNote = (p, name, lang) => lng(lang) === 'ru'
    ? `${p.kind === 'perk' ? 'Бонус сотруднику' : 'Замена сотрудника'}${name ? ': ' + name : ''}`
    : `${p.kind === 'perk' ? 'Team member perk' : 'Team member replacement'}${name ? ': ' + name : ''}`;

  // What a Fixer deal means for the wallet, in whole eb. `q` is RoleTools.quoteFixerDeal().
  function dealMoney(q) {
    if (!obj(q) || q.ok !== true) return null;
    const whole = cents => Math.round(Number(cents) / 100);
    if (q.deal === 'job20' || q.deal === 'dangerous') return { delta: whole(q.perPersonCents), kind: 'job' };
    if (q.deal === 'installments') return { delta: -whole(q.nowCents), later: whole(q.laterCents), kind: 'installments' };
    return { delta: q.direction === 'sell' ? whole(q.totalCents) : -whole(q.totalCents), kind: q.direction === 'sell' ? 'sell' : 'buy' };
  }
  const debts = c => (Array.isArray(read(c).debts) ? read(c).debts : []).filter(d => obj(d) && typeof d.id === 'string' && int(d.amount, 0, 999999999) > 0);

  // ---- Nomad: vehicle stat block ------------------------------------------------------------
  // Corebook vehicle table (p. 190–191), keyed by the motorpool type ids of role-tools.js.
  const VEHICLES = Object.freeze({
    compact: { sdp: 50, seats: 4, move: 20, kph: 161 }, gyro: { sdp: 35, seats: 2, move: 20, kph: 161 }, jetski: { sdp: 35, seats: 2, move: 20, kph: 97 }, roadbike: { sdp: 35, seats: 2, move: 20, kph: 161 },
    helicopter: { sdp: 60, seats: 4, move: 40, kph: 322 }, performance: { sdp: 50, seats: 4, move: 40, kph: 322 }, speedboat: { sdp: 50, seats: 4, move: 20, kph: 97 },
    av4: { sdp: 100, seats: 6, move: 40, kph: 322 }, cabin: { sdp: 60, seats: 2, perRoom: true, move: 10, kph: 24 }, superbike: { sdp: 35, seats: 2, move: 60, kph: 483 },
    aerozep: { sdp: 100, seats: 2, perRoom: true, move: 20, kph: 161 }, av9: { sdp: 60, seats: 2, move: 60, kph: 483 }, supercar: { sdp: 50, seats: 2, move: 60, kph: 483 }, yacht: { sdp: 100, seats: 4, perRoom: true, move: 10, kph: 24 }
  });
  const HEAVY_CHASSIS = 'extra-upgrade-heavy-chassis', ARMORED_CHASSIS = 'extra-upgrade-armored-chassis';
  function upgradeCatalog() {
    const out = [];
    for (const item of Array.isArray(global.CATALOG) ? global.CATALOG : []) {
      const rank = item?.stats?.motoRank;
      if (typeof item?.id !== 'string' || item.stats?.type !== 'upgrade' || !Number.isSafeInteger(rank) || rank < 1 || rank > 10) continue;
      out.push({ id: item.id, rank, page: item.page, ru: item.name?.ru || String(item.name), en: item.name?.en || String(item.name) });
    }
    return out;
  }
  function vehicleState(c, vehicle) {
    const base = VEHICLES[vehicle?.type]; if (!base || typeof vehicle?.id !== 'string') return null;
    const saved = obj(read(c).vehicles) && obj(read(c).vehicles[vehicle.id]) ? read(c).vehicles[vehicle.id] : {};
    const ups = (Array.isArray(saved.ups) ? saved.ups : []).filter(x => typeof x === 'string').slice(0, 30);
    const max = base.sdp + 20 * ups.filter(x => x === HEAVY_CHASSIS).length;
    const sdp = saved.sdp === undefined ? max : int(saved.sdp, 0, max, max);
    return { ...base, max, sdp, ups, sp: ups.includes(ARMORED_CHASSIS) ? 13 : 0, destroyed: sdp <= 0 };
  }
  function vehicleSlot(c, id) { return bag(bag(ensure(c), 'vehicles'), id); }
  // Damage goes to SDP (after the vehicle's own SP when it has an armored chassis); repair brings SDP back.
  function vehicleDamage(c, vehicle, amount) {
    const st = vehicleState(c, vehicle), n = int(amount, 0, 9999); if (!st || n < 1) return null;
    const through = Math.max(0, n - st.sp), after = Math.max(0, st.sdp - through);
    vehicleSlot(c, vehicle.id).sdp = after;
    return { before: st.sdp, after, through, sp: st.sp, destroyed: after <= 0 };
  }
  function vehicleRepair(c, vehicle, amount) {
    const st = vehicleState(c, vehicle); if (!st) return null;
    const n = amount === 'full' ? st.max : int(amount, 0, 9999); if (n < 1) return null;
    const after = Math.min(st.max, st.sdp + n);
    vehicleSlot(c, vehicle.id).sdp = after;
    return { before: st.sdp, after };
  }
  function vehicleAddUpgrade(c, vehicle, upgradeId, rank) {
    const st = vehicleState(c, vehicle), item = upgradeCatalog().find(u => u.id === upgradeId);
    if (!st || !item) return { ok: false, reason: 'invalid' };
    if (item.rank > int(rank, 1, 10, 1)) return { ok: false, reason: 'rank', need: item.rank };
    if (st.ups.length >= 30) return { ok: false, reason: 'full' };
    const slot = vehicleSlot(c, vehicle.id);
    slot.ups = [...st.ups, upgradeId];
    if (upgradeId === HEAVY_CHASSIS && slot.sdp !== undefined) slot.sdp = int(slot.sdp, 0, 9999) + 20;
    return { ok: true, item };
  }
  function vehicleRemoveUpgrade(c, vehicle, index) {
    const st = vehicleState(c, vehicle), i = int(index, -1, 99, -1);
    if (!st || i < 0 || i >= st.ups.length) return { ok: false };
    const slot = vehicleSlot(c, vehicle.id), removed = st.ups[i];
    slot.ups = st.ups.filter((_, n) => n !== i);
    const now = vehicleState(c, vehicle);
    if (slot.sdp !== undefined) slot.sdp = Math.min(now.max, int(slot.sdp, 0, 9999));
    return { ok: true, removed };
  }
  // Each Moto rank gives one vehicle or one upgrade.
  function motoChoices(c, vehicles, rank) {
    const all = Array.isArray(vehicles) ? vehicles : [];
    const used = all.length + all.reduce((n, v) => n + (vehicleState(c, v)?.ups.length || 0), 0), limit = int(rank, 1, 10, 1);
    return { used, limit, over: used > limit };
  }
  const MANEUVERS_FALLBACK = { basic: { dv: 10, ru: 'Обычное управление', en: 'Basic driving' }, swerve: { dv: 13, ru: 'Резкий объезд', en: 'Swerve' }, bootleg: { dv: 17, ru: 'Полицейский разворот', en: 'Bootleg turn' } };
  const maneuvers = () => obj(global.VehicleTools?.MANEUVERS) ? global.VehicleTools.MANEUVERS : MANEUVERS_FALLBACK;

  // ---- Exec: a team member as a small sheet -------------------------------------------------
  const SKILL_STATS = Object.freeze({
    Concentration: 'WILL', Conversation: 'EMP', Education: 'INT', 'First Aid': 'TECH', 'Human Perception': 'EMP', Language: 'INT', 'Local Expert': 'INT', Persuasion: 'COOL', Stealth: 'DEX',
    Athletics: 'DEX', Evasion: 'DEX', Interrogation: 'COOL', Perception: 'INT', 'Resist Torture/Drugs': 'WILL', Tactics: 'INT', Handgun: 'REF', Brawling: 'DEX', Bribery: 'COOL', Bureaucracy: 'INT',
    Business: 'INT', 'Pick Lock': 'TECH', Streetwise: 'COOL', Trading: 'COOL', 'Wardrobe & Style': 'COOL', Endurance: 'WILL', 'Land Vehicle Tech': 'TECH', 'Pilot Air Vehicle': 'REF', 'Pilot Sea Vehicle': 'REF',
    'Sea Vehicle Tech': 'TECH', Tracking: 'INT', 'Drive Land Vehicle': 'REF', 'Basic Tech': 'TECH', Cryptography: 'INT', Cybertech: 'TECH', 'Electronics/Security Tech': 'TECH', Forgery: 'TECH', 'Library Search': 'INT', Weaponstech: 'TECH'
  });
  const LIGHT_ARMORJACK = 11;
  function memberProfile(m) {
    const t = m?.execProfile, RT = global.RoleTools;
    if (!obj(t) || t.version !== 1 || !RT?.execProfile) return null;
    const p = RT.execProfile(t.job, t.roll), job = RT.data?.execJobs?.[t.job];
    return p && job ? { ...p, jobData: job } : null;
  }
  // -> [{ name, key, stat, level, total }] with the STAT already added; Interface is a role rank and has no STAT.
  function memberSkills(profile) {
    const out = [];
    for (const [level, text] of [[6, profile?.jobData?.s6], [4, profile?.jobData?.s4], [2, profile?.jobData?.s2]]) {
      for (const raw of String(text || '').split(', ')) {
        if (!raw || raw === '—') continue;
        const name = raw.replace(/ \(x2\)$/, ''), key = name.replace(/ \(.*\)$/, ''), stat = Object.hasOwn(SKILL_STATS, key) ? SKILL_STATS[key] : null;
        out.push({ name, key, stat, level, total: (stat ? int(profile.stats?.[stat], 0, 20) : 0) + level });
      }
    }
    return out;
  }
  function memberState(c, m) {
    const p = memberProfile(m); if (!p) return null;
    const saved = obj(read(c).team) && typeof m.id === 'string' && obj(read(c).team[m.id]) ? read(c).team[m.id] : {};
    const hp = m.hp === undefined ? p.hp : int(m.hp, -999, 1000, p.hp), sp = saved.sp === undefined ? LIGHT_ARMORJACK : int(saved.sp, 0, 30, LIGHT_ARMORJACK);
    const wound = hp < 1 ? -4 : hp < Math.ceil(p.hp / 2) ? -2 : 0;
    return { profile: p, hp, max: p.hp, sp, wound };
  }
  // Damage before armor: SP is subtracted, armor that was penetrated loses 1 SP.
  function memberDamage(c, m, amount) {
    const st = memberState(c, m), n = int(amount, 0, 9999); if (!st || n < 1 || typeof m.id !== 'string') return null;
    const through = Math.max(0, n - st.sp), hp = Math.max(-999, st.hp - through), sp = through > 0 ? Math.max(0, st.sp - 1) : st.sp;
    m.hp = hp; bag(bag(ensure(c), 'team'), m.id).sp = sp;
    return { through, hpBefore: st.hp, hp, spBefore: st.sp, sp };
  }
  function memberHeal(c, m, amount) {
    const st = memberState(c, m), n = int(amount, 0, 9999); if (!st || n < 1) return null;
    m.hp = Math.min(st.max, st.hp + n);
    return { hpBefore: st.hp, hp: m.hp };
  }
  const skillLabel = (s, lang) => { const t = global.SKILL_LABELS?.[s.key === 'Local Expert' ? 'Local Expert (Home)' : s.name]?.ru; return lng(lang) === 'ru' && typeof t === 'string' && t ? t : s.name; };
  const teamLimit = rank => { const r = int(rank, 0, 10); return r >= 9 ? 3 : r >= 5 ? 2 : r >= 3 ? 1 : 0; };
  // -> '' when one more member fits, otherwise the reason to show.
  function teamFull(size, rank, lang) {
    const limit = teamLimit(rank), ru = lng(lang) === 'ru';
    if (int(size, 0, 9999) < limit) return '';
    if (!limit) return ru ? 'Команда появляется с ранга 3.' : 'A team is available from rank 3.';
    return ru ? `На этом ранге в команде не больше ${limit}. Сначала удалите сотрудника.` : `This rank allows a team of ${limit}. Remove a member first.`;
  }

  // ---- Lawman: backup on its way and on the scene -------------------------------------------
  const BACKUP_COUNT = Object.freeze({ 1: 4, 3: 4, 5: 2, 8: 1, 9: 2, 10: 2 });
  function backupTierData(min) { return (global.RoleTools?.data?.backup || []).find(t => t.min === min) || null; }
  function backupArrive(c, call) {
    const tier = backupTierData(int(call?.tier, 1, 10)); if (!obj(c) || !tier) return false;
    const count = (BACKUP_COUNT[tier.min] || 1) * (call.two ? 2 : 1);
    ensure(c).backup = { tier: tier.min, rounds: int(call.rounds, 0, 6), hp: Array.from({ length: count }, () => tier.hp) };
    return true;
  }
  function backupState(c) {
    const b = read(c).backup; if (!obj(b)) return null;
    const tier = backupTierData(int(b.tier, 1, 10)); if (!tier || !Array.isArray(b.hp)) return null;
    return { tier, rounds: int(b.rounds, 0, 99), hp: b.hp.slice(0, 12).map(v => int(v, -999, 1000, tier.hp)) };
  }
  const backupTier = c => backupState(c)?.tier.min ?? null;

  // ---- Rendering hooks ----------------------------------------------------------------------
  let flash = null; // { key, text, at }: the result of the last action, shown where it was made after the redraw.
  const flashFor = key => flash && flash.key === key && Date.now() - flash.at < 120000 ? `<div class="rk-result" role="status">${esc(flash.text)}</div>` : '';
  const say = (key, text) => { flash = { key, text, at: Date.now() }; };
  const button = (action, text, attrs = '', cls = '') => `<button type="button" class="rt-button ${cls}" data-rk-action="${action}" ${attrs}>${esc(text)}</button>`;
  const amountField = (label, value = '') => `<label class="rt-field rk-amount">${esc(label)}<input type="number" inputmode="numeric" min="1" max="999999" step="1" data-rk-input="amount" value="${esc(value)}"></label>`;

  function walletLine(c, lang) {
    const ru = lng(lang) === 'ru', last = read(c).last;
    const undo = obj(last) && int(last.delta, -999999999, 999999999)
      ? `<span class="rk-last">${ru ? 'Последняя операция' : 'Last operation'}: ${last.delta < 0 ? '−' : '+'}${esc(eb(Math.abs(last.delta)))}${last.note ? ' · ' + esc(last.note) : ''}</span>${button('undo', ru ? 'Отменить' : 'Undo')}` : '';
    return `<div class="rk-wallet" data-rk-wallet><span>${ru ? 'В кошельке' : 'Wallet'}: <strong>${esc(eb(cash(c)))}</strong></span>${undo}</div>`;
  }
  function payRow(c, p, name, lang) {
    const ru = lng(lang) === 'ru';
    return `<div class="rk-pay" data-rk-pay="${esc(p.id)}"><strong>${esc(payNote(p, name, lang))}</strong><span class="rt-help">${p.kind === 'perk' ? (ru ? 'Бонус стоит от 200 eb.' : 'A perk costs at least 200 eb.') : (ru ? 'Замена стоит 200 eb.' : 'A replacement costs 200 eb.')}</span><div class="rk-row">${amountField(ru ? 'Сумма, eb' : 'Amount, eb', p.amount)}${button('pay', ru ? 'Списать с кошелька' : 'Pay from wallet', `data-rk-id="${esc(p.id)}"`)}${button('pay-skip', ru ? 'Не списывать' : 'Do not charge', `data-rk-id="${esc(p.id)}"`)}</div></div>`;
  }
  // Exec: above the team list — wallet, the rank limit and costs that belong to no listed member.
  function teamBlock(c, lang) {
    const ru = lng(lang) === 'ru', team = Array.isArray(c?.extra?.roleTools?.exec?.team) ? c.extra.roleTools.exec.team : [];
    const ids = new Set(team.map(m => m?.id)), loose = pays(c).filter(p => !ids.has(p.member)), limit = teamLimit(c?.rank);
    const over = team.length > limit ? `<p class="rt-warning">${ru ? `В команде ${team.length}, а ранг позволяет ${limit}.` : `The team has ${team.length}; this rank allows ${limit}.`}</p>` : '';
    return `<div class="rk-box" data-rk-team-top>${walletLine(c, lang)}<p class="rt-help">${ru ? `Мест в команде по рангу: ${limit}. Занято: ${team.length}.` : `Team size at this rank: ${limit}. In use: ${team.length}.`}</p>${over}${loose.map(p => payRow(c, p, '', lang)).join('')}${flashFor('team')}</div>`;
  }
  // Exec: under each member — costs waiting for a decision and, for a member made by the book, HP, armor and rolls.
  function memberBlock(c, m, index, lang) {
    const ru = lng(lang) === 'ru', l = lng(lang), i = int(index, 0, 9999), key = 'member:' + (m?.id || i);
    let h = pays(c).filter(p => p.member && p.member === m?.id).map(p => payRow(c, p, m.name || '', lang)).join('');
    const st = memberState(c, m);
    if (!st) return h ? `<div class="rk-box">${h}</div>` : '';
    const skills = memberSkills(st.profile), label = s => skillLabel(s, lang);
    const state = st.wound === -4 ? (ru ? 'Смертельно ранен · −4' : 'Mortally Wounded · −4') : st.wound === -2 ? (ru ? 'Тяжело ранен · −2' : 'Seriously Wounded · −2') : (ru ? 'В строю' : 'Fit');
    const options = [6, 4, 2].map(level => { const group = skills.filter(s => s.level === level); return group.length ? `<optgroup label="+${level}">${group.map(s => `<option value="${esc(s.name)}">${esc(label(s))} · ${s.stat ? `${s.stat} ${st.profile.stats[s.stat]} + ${level}` : `${level}`} = ${s.total}</option>`).join('')}</optgroup>` : ''; }).join('');
    const body = int(st.profile.stats.BODY, 0, 20), brawl = body <= 4 ? 1 : body <= 6 ? 2 : body <= 10 ? 3 : 4;
    h += `<div class="rk-stats"><span><b>HP</b> ${st.hp} / ${st.max}</span><span><b>SP</b> ${st.sp}</span><span class="${st.wound ? 'rk-bad' : ''}">${esc(state)}</span></div>`
      + `<div class="rk-row">${amountField(ru ? 'Урон или лечение' : 'Damage or healing')}${button('member-hit', ru ? 'Урон' : 'Damage', `data-rk-index="${i}"`)}${button('member-heal', ru ? 'Лечение' : 'Heal', `data-rk-index="${i}"`)}<label class="rt-field rk-amount">${ru ? 'Броня, SP' : 'Armor, SP'}<input type="number" min="0" max="30" step="1" data-rk-field="member-sp" data-rk-index="${i}" value="${st.sp}"></label></div>`
      + `<p class="rt-help">${ru ? 'Урон вводится до брони: SP вычитается, пробитая броня теряет 1 SP.' : 'Enter damage before armor: SP is subtracted and penetrated armor loses 1 SP.'}</p>`
      + `<div class="rk-row"><label class="rt-field rk-skill">${ru ? 'Навык сотрудника' : 'Team member skill'}<select data-rk-input="skill">${options}</select></label>${button('member-skill', ru ? 'Бросить навык' : 'Roll skill', `data-rk-index="${i}"`)}</div>`
      + `<div class="rk-row">${button('member-attack', ru ? 'Атака: пистолет' : 'Attack: pistol', `data-rk-index="${i}"`)}${button('member-damage', ru ? 'Урон пистолета 4d6' : 'Pistol damage 4d6', `data-rk-index="${i}" data-rk-dice="4"`)}${button('member-damage', ru ? `Урон в драке ${brawl}d6` : `Brawling damage ${brawl}d6`, `data-rk-index="${i}" data-rk-dice="${brawl}" data-rk-brawl="1"`)}${button('member-death', ru ? `Спасбросок от смерти (${st.profile.deathSave})` : `Death Save (${st.profile.deathSave})`, `data-rk-index="${i}"`)}</div>`
      + flashFor(key);
    return `<div class="rk-box" data-rk-member="${i}">${h}</div>`;
  }

  // Fixer: under the deal result — what to do with the sum.
  function dealActions(c, q, lang) {
    const m = dealMoney(q), ru = lng(lang) === 'ru'; if (!m || !m.delta && !m.later) return '';
    const text = m.kind === 'installments' ? (ru ? `Списать ${eb(-m.delta)} сейчас и записать долг ${eb(m.later)}` : `Pay ${eb(-m.delta)} now and record a debt of ${eb(m.later)}`)
      : m.delta < 0 ? (ru ? `Списать ${eb(-m.delta)} с кошелька` : `Pay ${eb(-m.delta)} from wallet`)
      : m.kind === 'job' ? (ru ? `Получить свою долю: ${eb(m.delta)}` : `Take your share: ${eb(m.delta)}`) : (ru ? `Получить ${eb(m.delta)} в кошелёк` : `Add ${eb(m.delta)} to wallet`);
    return `<div class="rk-row rk-deal">${button('deal-apply', text, `data-rk-delta="${m.delta}" data-rk-later="${m.later || 0}" data-rk-kind="${m.kind}"`)}<span class="rt-help">${ru ? `В кошельке ${eb(cash(c))}.` : `The wallet holds ${eb(cash(c))}.`}</span></div>`;
  }
  function fixerBlock(c, lang) {
    const ru = lng(lang) === 'ru', all = debts(c);
    const rows = all.map(d => `<div class="rk-pay" data-rk-debt="${esc(d.id)}"><strong>${ru ? 'Долг' : 'Debt'}: ${esc(eb(d.amount))}</strong><span class="rt-help">${esc(d.note || '')}${d.at ? ` · ${esc(String(d.at).slice(0, 10))}` : ''}</span><div class="rk-row">${button('debt-pay', ru ? 'Оплатить' : 'Pay off', `data-rk-id="${esc(d.id)}"`)}${button('debt-drop', ru ? 'Убрать запись' : 'Remove entry', `data-rk-id="${esc(d.id)}"`, 'rt-danger')}</div></div>`).join('');
    return `<div class="rk-box" data-rk-fixer><div class="rt-subhead">${ru ? 'ДЕНЬГИ ПО СДЕЛКАМ' : 'DEAL MONEY'}</div>${walletLine(c, lang)}${rows || `<p class="rt-help">${ru ? 'Долгов по рассрочке нет.' : 'No instalment debts.'}</p>`}${flashFor('fixer')}</div>`;
  }

  // Nomad
  function maneuverSelect(c, lang) {
    const ru = lng(lang) === 'ru', v = c?.extra?.roleTools?.nomad?.values || {}, list = maneuvers(), dv = int(v.vehicleDv ?? 13, -100, 200);
    const chosen = Object.hasOwn(list, v.maneuver) && list[v.maneuver].dv === dv ? v.maneuver : '';
    return `<label class="rt-field">${ru ? 'Манёвр' : 'Maneuver'}<select data-rk-field="maneuver"><option value="">${ru ? 'Свой DV' : 'Custom DV'}</option>${Object.entries(list).map(([k, m]) => `<option value="${esc(k)}" ${k === chosen ? 'selected' : ''}>${esc(ru ? m.ru : m.en)} · DV ${m.dv}</option>`).join('')}</select></label>`;
  }
  function motoCount(c, lang) {
    const ru = lng(lang) === 'ru', vehicles = global.RoleTools?.motorpool?.(c)?.vehicles || [], n = motoChoices(c, vehicles, c?.rank);
    return `<p class="${n.over ? 'rt-warning' : 'rt-help'}" data-rk-moto>${ru ? `Выборы Moto (машина или улучшение за ранг): занято ${n.used} из ${n.limit}.` : `Moto picks (a vehicle or an upgrade per rank): ${n.used} of ${n.limit} used.`}${n.over ? (ru ? ' Больше, чем даёт ранг: сверьтесь с ведущим.' : ' More than the rank gives: check with your GM.') : ''}</p>`;
  }
  function vehicleBlock(c, vehicle, lang) {
    const st = vehicleState(c, vehicle); if (!st) return null;
    const ru = lng(lang) === 'ru', id = esc(vehicle.id), rank = int(c?.rank, 1, 10, 1), catalog = upgradeCatalog();
    const seats = `${st.seats}${st.perRoom ? (ru ? ' на комнату' : ' per room') : ''}`;
    const chips = st.ups.map((u, i) => { const item = catalog.find(x => x.id === u); return `<span class="rk-chip">${esc(item ? (ru ? item.ru : item.en) : u)}${item ? ` · ${ru ? 'стр.' : 'p.'} ${item.page}` : ''}<button type="button" class="rk-x" data-rk-action="veh-up-remove" data-rk-id="${id}" data-rk-index="${i}" aria-label="${ru ? 'Убрать улучшение' : 'Remove upgrade'}">×</button></span>`; }).join('');
    const select = catalog.length ? `<label class="rt-field">${ru ? 'Добавить улучшение' : 'Add an upgrade'}<select data-rk-field="veh-upgrade" data-rk-id="${id}"><option value="">${ru ? 'Выберите улучшение' : 'Choose an upgrade'}</option>${catalog.map(u => `<option value="${esc(u.id)}"${u.rank > rank ? ' disabled' : ''}>${esc(ru ? u.ru : u.en)} · ${ru ? 'стр.' : 'p.'} ${u.page}${u.rank > rank ? ` · ${ru ? 'нужен ранг' : 'needs rank'} ${u.rank}` : ''}</option>`).join('')}</select></label>` : '';
    return `<div class="rk-box" data-rk-vehicle="${id}"><div class="rk-stats"><span class="${st.destroyed ? 'rk-bad' : ''}"><b>SDP</b> ${st.sdp} / ${st.max}</span>${st.sp ? `<span><b>SP</b> ${st.sp}</span>` : ''}<span><b>${ru ? 'Мест' : 'Seats'}</b> ${esc(seats)}</span><span><b>MOVE</b> ${st.move}</span><span>${st.kph} ${ru ? 'км/ч' : 'km/h'}</span></div>`
      + `<div class="rk-row">${amountField(ru ? 'Урон или ремонт, SDP' : 'Damage or repair, SDP')}${button('veh-hit', ru ? 'Нанести урон' : 'Apply damage', `data-rk-id="${id}"`)}${button('veh-fix', ru ? 'Починить' : 'Repair', `data-rk-id="${id}"`)}${st.sdp < st.max ? button('veh-full', ru ? 'Полный ремонт' : 'Full repair', `data-rk-id="${id}"`) : ''}</div>`
      + (st.destroyed ? `<p class="rt-warning">${ru ? 'Транспорт уничтожен. Семья чинит его за неделю, обычно за 500 eb.' : 'The vehicle is destroyed. The Family repairs it in a week, normally for 500 eb.'}</p><div class="rk-row">${button('veh-family', ru ? 'Оплатить ремонт семье: 500 eb' : 'Pay the Family repair: 500 eb', `data-rk-id="${id}"`)}</div>` : '')
      + `<div class="rk-chips">${chips || `<span class="rt-help">${ru ? 'Улучшений нет.' : 'No upgrades.'}</span>`}</div>${select}${flashFor('veh:' + vehicle.id)}</div>`;
  }

  // Lawman
  function backupBlock(c, lang) {
    const st = backupState(c), ru = lng(lang) === 'ru'; if (!st) return '';
    const name = st.tier.name?.[ru ? 0 : 1] || '';
    const where = st.rounds > 0 ? (ru ? `в пути, раундов до прибытия: ${st.rounds}` : `on the way, rounds to arrival: ${st.rounds}`) : (ru ? 'на месте' : 'on the scene');
    const officers = st.hp.map((hp, i) => `<label class="rt-field rk-amount ${hp < 1 ? 'rk-bad' : ''}">№ ${i + 1} · HP<input type="number" min="-99" max="${st.tier.hp}" step="1" data-rk-field="backup-hp" data-rk-index="${i}" value="${hp}"></label>`).join('');
    return `<div class="rk-box" data-rk-backup><div class="rt-subhead">${ru ? 'ВЫЗВАННОЕ ПОДКРЕПЛЕНИЕ' : 'BACKUP CALLED'}</div><div class="rk-stats"><span><b>${esc(name)}</b></span><span class="${st.rounds > 0 ? '' : 'rk-good'}">${esc(where)}</span><span>Combat Number ${st.tier.combat}</span><span>SP ${st.tier.sp}</span><span>HP ${st.tier.hp}</span></div>`
      + `<div class="rk-row">${st.rounds > 0 ? button('backup-round', ru ? 'Прошёл раунд' : 'A round passed') : ''}${button('backup-dismiss', ru ? 'Подкрепление ушло' : 'Backup has left', '', 'rt-danger')}</div>`
      + `<div class="rk-row">${officers}</div><p class="rt-help">${ru ? 'HP каждого бойца меняйте прямо в поле. Урон считайте после брони SP.' : 'Change each officer’s HP in its field. Count damage after SP.'}</p>${flashFor('backup')}</div>`;
  }

  // ---- Events -------------------------------------------------------------------------------
  // First press arms a destructive button, the second one within four seconds does it.
  function armed(b, lang) {
    if (b.dataset.rkArmed === '1') return true;
    const was = b.textContent; b.dataset.rkArmed = '1'; b.textContent = lng(lang) === 'ru' ? 'Нажмите ещё раз' : 'Press again';
    setTimeout(() => { if (b.dataset.rkArmed === '1') { delete b.dataset.rkArmed; b.textContent = was; } }, 4000);
    return false;
  }
  const done = (notify, key) => { if (key && notify) say(key, notify); return { handled: true, dirty: true, rerender: true, notify }; };
  const only = notify => ({ handled: true, notify });

  function click(b, c, lang) {
    const ru = lng(lang) === 'ru', a = b.dataset.rkAction, box = b.closest('.rk-box,[data-rk-pay]') || b.parentElement;
    const amount = () => int((b.closest('[data-rk-pay]') || box)?.querySelector?.('[data-rk-input="amount"]')?.value, 0, 999999999);
    const needAmount = ru ? 'Введите число больше нуля.' : 'Enter a number above zero.';
    if (a === 'undo') {
      if (!armed(b, lang)) return { handled: true };
      const r = undoLast(c); if (!r.ok) return only(moneyFail(r, lang));
      return done(ru ? `Операция отменена. В кошельке ${eb(r.balance)}.` : `Operation undone. The wallet holds ${eb(r.balance)}.`);
    }
    if (a === 'pay' || a === 'pay-skip') {
      const p = pays(c).find(x => x.id === b.dataset.rkId); if (!p) return only(ru ? 'Запись уже закрыта.' : 'This entry is already closed.');
      const team = c.extra?.roleTools?.exec?.team, member = Array.isArray(team) ? team.find(m => m?.id === p.member) : null;
      if (a === 'pay') {
        const n = amount(); if (n < 1) return only(needAmount);
        const r = pay(c, -n, payNote(p, member?.name || '', lang)); if (!r.ok) return only(moneyFail(r, lang));
        ensure(c).pay = pays(c).filter(x => x.id !== p.id);
        return done(ru ? `Списано ${eb(n)}. В кошельке ${eb(r.balance)}.` : `${eb(n)} paid. The wallet holds ${eb(r.balance)}.`);
      }
      ensure(c).pay = pays(c).filter(x => x.id !== p.id);
      return done(ru ? 'Деньги не списаны.' : 'Nothing was charged.');
    }
    if (a === 'deal-apply') {
      const delta = int(b.dataset.rkDelta, -999999999, 999999999), later = int(b.dataset.rkLater, 0, 999999999), kind = b.dataset.rkKind;
      const note = ru ? ({ buy: 'Сделка посредника: покупка', sell: 'Сделка посредника: продажа', job: 'Оплата работы', installments: 'Рассрочка: первый взнос' }[kind] || 'Сделка посредника')
        : ({ buy: 'Operator deal: purchase', sell: 'Operator deal: sale', job: 'Job payment', installments: 'Instalment: first half' }[kind] || 'Operator deal');
      if (!delta) return only(needAmount);
      const debt = later > 0 ? { id: uid(), amount: later, note: ru ? 'Вторая половина рассрочки, срок — через месяц' : 'Second half of the instalment, due in a month', at: new Date().toISOString() } : null;
      const r = pay(c, delta, note, debt ? { debtId: debt.id } : null); if (!r.ok) return only(moneyFail(r, lang));
      if (debt) list(ensure(c), 'debts').push(debt);
      return done((delta < 0 ? (ru ? `Списано ${eb(-delta)}.` : `${eb(-delta)} paid.`) : (ru ? `Получено ${eb(delta)}.` : `${eb(delta)} received.`)) + (debt ? (ru ? ` Долг ${eb(later)} записан.` : ` A debt of ${eb(later)} is recorded.`) : '') + (ru ? ` В кошельке ${eb(r.balance)}.` : ` The wallet holds ${eb(r.balance)}.`), 'fixer');
    }
    if (a === 'debt-pay' || a === 'debt-drop') {
      const d = debts(c).find(x => x.id === b.dataset.rkId); if (!d) return only(ru ? 'Запись уже закрыта.' : 'This entry is already closed.');
      if (a === 'debt-drop') { if (!armed(b, lang)) return { handled: true }; ensure(c).debts = debts(c).filter(x => x.id !== d.id); return done(ru ? 'Запись о долге убрана.' : 'The debt entry was removed.', 'fixer'); }
      const r = pay(c, -d.amount, ru ? 'Рассрочка: вторая половина' : 'Instalment: second half', { paidDebt: d }); if (!r.ok) return only(moneyFail(r, lang));
      ensure(c).debts = debts(c).filter(x => x.id !== d.id);
      return done(ru ? `Долг ${eb(d.amount)} оплачен. В кошельке ${eb(r.balance)}.` : `The debt of ${eb(d.amount)} is paid. The wallet holds ${eb(r.balance)}.`, 'fixer');
    }
    if (a.startsWith('veh-')) {
      const vehicle = (global.RoleTools?.motorpool?.(c)?.vehicles || []).find(v => v.id === b.dataset.rkId), key = 'veh:' + b.dataset.rkId;
      if (!vehicle) return only(ru ? 'Запись транспорта изменилась.' : 'The vehicle entry changed.');
      if (a === 'veh-hit') { const r = vehicleDamage(c, vehicle, amount()); if (!r) return only(needAmount); return done(`${ru ? 'Урон' : 'Damage'} ${r.through}${r.sp ? ` (${ru ? 'после' : 'after'} SP ${r.sp})` : ''}: SDP ${r.before} → ${r.after}.${r.destroyed ? (ru ? ' Транспорт уничтожен.' : ' The vehicle is destroyed.') : ''}`, key); }
      if (a === 'veh-fix' || a === 'veh-full') { const r = vehicleRepair(c, vehicle, a === 'veh-full' ? 'full' : amount()); if (!r) return only(needAmount); return done(`${ru ? 'Ремонт' : 'Repair'}: SDP ${r.before} → ${r.after}.`, key); }
      if (a === 'veh-family') {
        const before = vehicleState(c, vehicle).sdp, r = pay(c, -500, ru ? `Ремонт семьёй: ${vehicle.name}` : `Family repair: ${vehicle.name}`, { repaired: { id: vehicle.id, sdp: before } }); if (!r.ok) return only(moneyFail(r, lang));
        vehicleRepair(c, vehicle, 'full');
        return done(ru ? `Списано 500 eb, SDP восстановлены. В кошельке ${eb(r.balance)}.` : `500 eb paid, SDP restored. The wallet holds ${eb(r.balance)}.`, key);
      }
      if (a === 'veh-up-remove') { if (!armed(b, lang)) return { handled: true }; const r = vehicleRemoveUpgrade(c, vehicle, b.dataset.rkIndex); if (!r.ok) return only(ru ? 'Запись транспорта изменилась.' : 'The vehicle entry changed.'); return done(ru ? 'Улучшение убрано.' : 'Upgrade removed.', key); }
    }
    if (a.startsWith('member-')) {
      const team = c.extra?.roleTools?.exec?.team, i = int(b.dataset.rkIndex, -1, 9999, -1), m = Array.isArray(team) ? team[i] : null, st = m ? memberState(c, m) : null;
      if (!st) return only(ru ? 'Список команды изменился.' : 'The team list changed.');
      const key = 'member:' + (m.id || i), who = m.name || (st.profile.jobData.name?.[ru ? 0 : 1] || '');
      if (a === 'member-hit') { const r = memberDamage(c, m, amount()); if (!r) return only(needAmount); return done(r.through ? `${who}: ${ru ? 'урон' : 'damage'} ${r.through} ${ru ? 'после брони' : 'after armor'}. HP ${r.hpBefore} → ${r.hp}, SP ${r.spBefore} → ${r.sp}.` : `${who}: ${ru ? 'броня выдержала' : 'the armor held'} (SP ${r.sp}).`, key); }
      if (a === 'member-heal') { const r = memberHeal(c, m, amount()); if (!r) return only(needAmount); return done(`${who}: HP ${r.hpBefore} → ${r.hp}.`, key); }
      if (a === 'member-skill' || a === 'member-attack') {
        const skills = memberSkills(st.profile), name = a === 'member-attack' ? 'Handgun' : box?.querySelector?.('[data-rk-input="skill"]')?.value, s = skills.find(x => x.name === name);
        if (!s) return only(ru ? 'Выберите навык.' : 'Choose a skill.');
        const r = d10(s.total + st.wound), label = `${who} · ${skillLabel(s, lang)}`;
        try { global.Rolls?.check?.(label, r, lang); } catch { /* history is optional */ }
        return done(`${label}: ${s.stat ? `${s.stat} ${st.profile.stats[s.stat]} + ` : ''}${s.level}${st.wound ? ` ${signed(st.wound)} (${ru ? 'ранение' : 'wound'})` : ''} · ${rollText(r, lang)}`, key);
      }
      if (a === 'member-damage') {
        const n = int(b.dataset.rkDice, 1, 8, 1), rolls = Array.from({ length: n }, () => die(6)), total = rolls.reduce((x, y) => x + y, 0), label = `${who} · ${b.dataset.rkBrawl ? (ru ? 'урон в драке' : 'Brawling damage') : (ru ? 'урон пистолета' : 'pistol damage')} ${n}d6`;
        try { global.App?.report?.(label, rolls.join(' + '), total, rolls.map(v => ({ v, s: 6 }))); } catch { /* history is optional */ }
        return done(`${label}: ${rolls.join(' + ')} = ${total}${rolls.filter(v => v === 6).length >= 2 ? (ru ? ' · критическая травма' : ' · Critical Injury') : ''}`, key);
      }
      if (a === 'member-death') {
        const roll = die(10), target = st.profile.deathSave, ok = roll < target, label = `${who} · ${ru ? 'спасбросок от смерти' : 'Death Save'}`, text = `${label}: 1d10 ${roll} ${ok ? '<' : '≥'} ${target} · ${ok ? (ru ? 'выжил' : 'alive') : (ru ? 'погиб' : 'dead')}`;
        log(label, text, roll, 10);
        return done(text, key);
      }
    }
    if (a === 'backup-round' || a === 'backup-dismiss') {
      const st = backupState(c); if (!st) return only(ru ? 'Подкрепление уже отпущено.' : 'The backup is already gone.');
      if (a === 'backup-dismiss') { if (!armed(b, lang)) return { handled: true }; delete ensure(c).backup; return done(ru ? 'Запись о подкреплении убрана.' : 'The backup entry was removed.'); }
      const left = Math.max(0, st.rounds - 1); ensure(c).backup.rounds = left;
      return done(left ? (ru ? `Раундов до прибытия: ${left}.` : `Rounds to arrival: ${left}.`) : (ru ? 'Подкрепление на месте.' : 'The backup is on the scene.'), 'backup');
    }
    return { handled: false };
  }

  function change(f, c, lang) {
    const ru = lng(lang) === 'ru', k = f.dataset.rkField;
    if (k === 'maneuver') {
      const list = maneuvers(), v = c.extra?.roleTools?.nomad?.values; if (!obj(v)) return { handled: true };
      if (!Object.hasOwn(list, f.value)) { delete v.maneuver; return { handled: true, dirty: true }; }
      v.maneuver = f.value; v.vehicleDv = list[f.value].dv;
      return { handled: true, dirty: true, rerender: true };
    }
    if (k === 'veh-upgrade') {
      if (!f.value) return { handled: true };
      const vehicle = (global.RoleTools?.motorpool?.(c)?.vehicles || []).find(v => v.id === f.dataset.rkId);
      if (!vehicle) return only(ru ? 'Запись транспорта изменилась.' : 'The vehicle entry changed.');
      const r = vehicleAddUpgrade(c, vehicle, f.value, c.rank);
      if (!r.ok) { f.value = ''; return only(r.reason === 'rank' ? (ru ? `Для этого улучшения нужен ранг ${r.need}.` : `This upgrade needs rank ${r.need}.`) : (ru ? 'Улучшение не добавлено.' : 'The upgrade was not added.')); }
      return done(ru ? `Улучшение добавлено и сохранено: ${r.item.ru}.` : `Upgrade added and saved: ${r.item.en}.`, 'veh:' + vehicle.id);
    }
    if (k === 'member-sp') {
      const team = c.extra?.roleTools?.exec?.team, m = Array.isArray(team) ? team[int(f.dataset.rkIndex, -1, 9999, -1)] : null;
      if (!m || !memberState(c, m) || typeof m.id !== 'string') return { handled: true };
      bag(bag(ensure(c), 'team'), m.id).sp = int(f.value, 0, 30, LIGHT_ARMORJACK);
      return { handled: true, dirty: true, rerender: true };
    }
    if (k === 'backup-hp') {
      const st = backupState(c), i = int(f.dataset.rkIndex, -1, 99, -1); if (!st || i < 0 || i >= st.hp.length) return { handled: true };
      const hp = st.hp.slice(); hp[i] = int(f.value, -99, st.tier.hp, st.tier.hp); ensure(c).backup.hp = hp;
      return { handled: true, dirty: true, rerender: true };
    }
    return { handled: false };
  }

  // Called first by RoleTools.handle for every click, input and change inside the role panel.
  function handle(e, c, lang, options) {
    const el = e?.target; if (!obj(c) || !el?.closest) return { handled: false };
    const hit = e.type === 'click' ? el.closest('[data-rk-action]') : e.type === 'change' ? el.closest('[data-rk-field]') : null;
    if (!hit) return e.type !== 'click' && el.closest('[data-rk-input],[data-rk-field]') ? { handled: true } : { handled: false };
    let current = false;
    try { current = hit.isConnected !== false && (typeof options?.isCurrent !== 'function' || options.isCurrent(c) === true); } catch { current = false; }
    if (!current) return only(lng(lang) === 'ru' ? 'Данные изменились. Повторите действие.' : 'Data changed. Try again.');
    if (e.type === 'click' && Number(e.detail) > 1 && ['pay', 'deal-apply'].includes(hit.dataset.rkAction)) return { handled: true }; // a double click must not charge twice
    if (e.type === 'click') flash = null;
    return e.type === 'click' ? click(hit, c, lang) : change(hit, c, lang);
  }

  global.RoleKit = {
    sheetMods, modsText, takeMods, log, d10, rollText,
    cash, charge, pay, undoLast, moneyFail, suggestPay, pays, dealMoney, debts,
    VEHICLES, vehicleState, vehicleDamage, vehicleRepair, vehicleAddUpgrade, vehicleRemoveUpgrade, motoChoices,
    memberProfile, memberSkills, memberState, memberDamage, memberHeal, teamLimit, teamFull,
    backupArrive, backupState, backupTier,
    walletLine, teamBlock, memberBlock, dealActions, fixerBlock, maneuverSelect, motoCount, vehicleBlock, backupBlock, handle
  };
})(typeof window !== 'undefined' ? window : globalThis);
