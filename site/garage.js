// Garage: the vehicles a character owns, with a durability counter (SDP) and installed upgrades.
//
//  - extra.vehicles = [{ id, catalogId?, name?, sdp, sdpMax, upgrades: [catalogId], notes }], at most 20;
//  - stats (SDP, seats, MOVE, speed) come from the vehicle entries of the app catalog; a vehicle that is not in the
//    catalog is typed by hand (name and maximum SDP). The maximum stays a field the player can change, because
//    upgrades and house rules move it and this module does not guess the effect of an upgrade;
//  - SDP is changed with - and + like the quick HP change, and «Collision damage» rolls through vehicle-tools.js
//    (VehicleTools.ramDamage) and offers the sum, which can be corrected before it is applied;
//  - removing a vehicle, removing an upgrade and applying damage can be taken back from the notice.
//
// The first part is pure functions over a character (tested in tests/garage.test.cjs); the second part is the page
// wiring. The card is drawn by Garage.render(c, lang) for the equipment tab and Garage.combatRows(c, lang) gives the
// compact rows for the combat page. Saved data is rebuilt field by field on every read.
(function (global) {
  'use strict';

  const MAX_VEHICLES = 20, MAX_UPGRADES = 12, MAX_NAME = 60, MAX_NOTES = 500, MAX_SDP = 9999, MAX_ID = 80;
  const ID = /^[A-Za-z0-9_-]{1,40}$/;
  const isObject = x => x !== null && typeof x === 'object' && !Array.isArray(x);
  const esc = x => String(x ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const L = lang => (lang === 'en' ? 'en' : 'ru');
  const line = (v, max) => (typeof v === 'string' ? v.replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max) : '');
  const text = (v, max) => (typeof v === 'string' ? v.replace(/\r\n?/g, '\n').replace(/[\u0000-\u0009\u000b-\u001f\u007f]/g, ' ').slice(0, max) : '');
  // A whole number as stored or as typed in a field; anything else is «not a number».
  function whole(v, min, max) {
    let n = null;
    if (typeof v === 'number') n = v;
    else if (typeof v === 'string' && /^\s*\d{1,6}\s*$/.test(v)) n = Number(v);
    return Number.isSafeInteger(n) && n >= min && n <= max ? n : null;
  }
  const uid = () => 'v' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  const catalog = () => (Array.isArray(global.CATALOG) ? global.CATALOG : []);
  const entry = id => (id ? catalog().find(x => x && x.id === id) : undefined);
  const isUpgrade = x => !!x && x.category === 'vehicles' && x.stats?.type === 'upgrade';
  const isVehicle = x => !!x && x.category === 'vehicles' && x.stats?.type !== 'upgrade';
  const vehicleChoices = () => catalog().filter(isVehicle);
  const upgradeChoices = () => catalog().filter(isUpgrade);
  const itemName = (x, lang) => String(x?.name?.[L(lang)] || x?.name?.en || x?.id || '');

  // ---------- 1. Pure functions ----------

  const T = {
    ru: {
      title: 'ГАРАЖ', count: (n, max) => `${n} из ${max}`,
      empty: 'У персонажа пока нет транспорта. Выберите его в каталоге ниже или впишите свой.',
      pick: 'Транспорт из каталога', custom: 'Свой транспорт…', newName: 'Название своего транспорта', newSdp: 'Максимум SDP своего транспорта',
      newHint: 'Для транспорта из каталога SDP, места и скорость берутся из каталога. Для своего впишите название и максимум SDP.',
      add: 'Добавить транспорт', name: 'Название', sdpNow: 'SDP сейчас', sdpMax: 'SDP максимум', notes: 'Заметки',
      minus: 'SDP −1', plus: 'SDP +1', repair: 'Починить до максимума', hit: 'Урон от столкновения', hitRoll: 'Урон от столкновения (6d6)',
      hitFor: n => `Урон от столкновения: ${n}`, hitValue: 'Урон по транспорту', hitApply: 'Нанести урон SDP', hitDismiss: 'Скрыть',
      hitNote: 'Если урон получает и вторая сторона, ведущий решает, бросать один раз или отдельно: см. «Транспорт и погони».',
      zero: 'SDP 0: транспорт разрушен, не движется и не служит укрытием до ремонта.',
      remove: 'Убрать из гаража', upgrades: n => `Улучшения (${n})`, noUpgrades: 'Улучшений нет.', upgradePick: 'Улучшение', addUpgrade: 'Установить',
      removeUpgrade: 'Снять', noMoreUpgrades: 'Все улучшения каталога уже установлены.', upgradeHint: 'Совместимость и действие улучшения проверяйте по его описанию и у ведущего.',
      page: 'стр.', seats: 'мест', move: 'MOVE', kph: 'км/ч', book: 'Книга, стр. 190',
      undo: 'Вернуть', stale: 'Лист изменился. Повторите действие.', unnamed: 'Без названия', unknown: 'Такого транспорта нет в каталоге.',
      added: n => `В гараж добавлено: ${n}.`, removed: n => `Убрано из гаража: ${n}.`, restored: n => `Возвращено в гараж: ${n}.`,
      upRemoved: (u, n) => `Снято: ${u} (${n}).`, upRestored: (u, n) => `Улучшение возвращено: ${u} (${n}).`,
      applied: (n, v, cur, max) => `${v}: урон ${n}, SDP ${cur} из ${max}.`, appliedBack: (v, cur) => `${v}: SDP снова ${cur}.`,
      full: `В гараже может быть не больше ${MAX_VEHICLES} единиц транспорта.`, fullUpgrades: `На одном транспорте — не больше ${MAX_UPGRADES} улучшений.`,
      dup: 'Это улучшение уже установлено.', badSdp: `Укажите целое число от 1 до ${MAX_SDP}.`, badDamage: `Укажите урон целым числом от 0 до ${MAX_SDP}.`,
      noName: 'Впишите название своего транспорта.', clipped: (n, cur, max) => `${n}: максимум ${max}, SDP снижен до ${cur}.`, clippedBack: (n, was) => `${n}: SDP снова ${was}.`, noRoll: 'Бросок столкновения недоступен: модуль транспорта не загружен.', rollLabel: 'Урон от столкновения', combat: 'ГАРАЖ'
    },
    en: {
      title: 'GARAGE', count: (n, max) => `${n} of ${max}`,
      empty: 'This character has no vehicles yet. Pick one from the catalog below or type your own.',
      pick: 'Vehicle from the catalog', custom: 'Custom vehicle…', newName: 'Name of a custom vehicle', newSdp: 'Maximum SDP of a custom vehicle',
      newHint: 'For a catalog vehicle SDP, seats and speed come from the catalog. For a custom one, type a name and a maximum SDP.',
      add: 'Add vehicle', name: 'Name', sdpNow: 'SDP now', sdpMax: 'SDP maximum', notes: 'Notes',
      minus: 'SDP -1', plus: 'SDP +1', repair: 'Repair to maximum', hit: 'Collision damage', hitRoll: 'Collision damage (6d6)',
      hitFor: n => `Collision damage: ${n}`, hitValue: 'Damage to the vehicle', hitApply: 'Apply damage to SDP', hitDismiss: 'Hide',
      hitNote: 'If the other side takes damage too, the GM decides whether to roll once or separately: see “Vehicles & Chases”.',
      zero: 'SDP 0: the vehicle is destroyed, cannot move and gives no cover until repaired.',
      remove: 'Remove from garage', upgrades: n => `Upgrades (${n})`, noUpgrades: 'No upgrades.', upgradePick: 'Upgrade', addUpgrade: 'Install',
      removeUpgrade: 'Remove', noMoreUpgrades: 'Every catalog upgrade is already installed.', upgradeHint: 'Check compatibility and the effect of an upgrade in its description and with the GM.',
      page: 'p.', seats: 'seats', move: 'MOVE', kph: 'km/h', book: 'Corebook p. 190',
      undo: 'Undo', stale: 'The sheet changed. Repeat the action.', unnamed: 'Unnamed', unknown: 'This vehicle is not in the catalog.',
      added: n => `Added to the garage: ${n}.`, removed: n => `Removed from the garage: ${n}.`, restored: n => `Back in the garage: ${n}.`,
      upRemoved: (u, n) => `Removed: ${u} (${n}).`, upRestored: (u, n) => `Upgrade restored: ${u} (${n}).`,
      applied: (n, v, cur, max) => `${v}: ${n} damage, SDP ${cur} of ${max}.`, appliedBack: (v, cur) => `${v}: SDP back to ${cur}.`,
      full: `The garage holds at most ${MAX_VEHICLES} vehicles.`, fullUpgrades: `One vehicle takes at most ${MAX_UPGRADES} upgrades.`,
      dup: 'This upgrade is already installed.', badSdp: `Enter a whole number from 1 to ${MAX_SDP}.`, badDamage: `Enter the damage as a whole number from 0 to ${MAX_SDP}.`,
      noName: 'Type a name for the custom vehicle.', clipped: (n, cur, max) => `${n}: maximum ${max}, SDP lowered to ${cur}.`, clippedBack: (n, was) => `${n}: SDP back to ${was}.`, noRoll: 'The collision roll is unavailable: the vehicle module is not loaded.', rollLabel: 'Collision damage', combat: 'GARAGE'
    }
  };
  const t = (lang, key, ...args) => { const v = T[L(lang)][key]; return typeof v === 'function' ? v(...args) : v; };
  const fail = (lang, key) => ({ ok: false, key, message: t(lang, key) });

  // Rebuilds a vehicle from known fields only; a record without an id or without any name is dropped.
  function cleanVehicle(raw) {
    if (!isObject(raw) || typeof raw.id !== 'string' || !ID.test(raw.id)) return null;
    const catalogId = typeof raw.catalogId === 'string' && raw.catalogId.length <= MAX_ID ? raw.catalogId : '';
    const name = line(raw.name, MAX_NAME);
    if (!catalogId && !name) return null;
    const maxRaw = whole(raw.sdpMax, 0, MAX_SDP), nowRaw = whole(raw.sdp, 0, MAX_SDP);
    const sdpMax = maxRaw ?? nowRaw ?? 0, sdp = Math.min(nowRaw ?? sdpMax, sdpMax);
    const seen = new Set(), upgrades = [];
    for (const u of Array.isArray(raw.upgrades) ? raw.upgrades : []) {
      if (typeof u !== 'string' || !u || u.length > MAX_ID || seen.has(u)) continue;
      seen.add(u); upgrades.push(u);
      if (upgrades.length >= MAX_UPGRADES) break;
    }
    return { id: raw.id, ...(catalogId ? { catalogId } : {}), ...(name ? { name } : {}), sdp, sdpMax, upgrades, notes: text(raw.notes, MAX_NOTES) };
  }
  function readVehicles(c) {
    const raw = isObject(c) && isObject(c.extra) ? c.extra.vehicles : null;
    if (!Array.isArray(raw)) return [];
    const out = [], seen = new Set();
    for (const x of raw.slice(0, MAX_VEHICLES * 3)) {
      const v = cleanVehicle(x);
      if (v && !seen.has(v.id)) { seen.add(v.id); out.push(v); }
      if (out.length >= MAX_VEHICLES) break;
    }
    return out;
  }
  // Strict check of one stored record: nothing is repaired here, a wrong type or range makes the whole record invalid.
  function strictVehicle(x) {
    if (!isObject(x) || typeof x.id !== 'string' || !ID.test(x.id)) return false;
    if (x.catalogId !== undefined && (typeof x.catalogId !== 'string' || x.catalogId.length > MAX_ID)) return false;
    if (x.name !== undefined && (typeof x.name !== 'string' || x.name.length > MAX_NAME)) return false;
    if (!x.catalogId && !(typeof x.name === 'string' && line(x.name, MAX_NAME))) return false;
    const intIn = (n, min) => typeof n === 'number' && Number.isSafeInteger(n) && n >= min && n <= MAX_SDP;
    if (!intIn(x.sdpMax, 0) || !intIn(x.sdp, 0) || x.sdp > x.sdpMax) return false;
    if (x.upgrades !== undefined) {
      if (!Array.isArray(x.upgrades) || x.upgrades.length > MAX_UPGRADES) return false;
      const seen = new Set();
      for (const u of x.upgrades) { if (typeof u !== 'string' || !u || u.length > MAX_ID || seen.has(u)) return false; seen.add(u); }
    }
    return x.notes === undefined || (typeof x.notes === 'string' && x.notes.length <= MAX_NOTES);
  }
  // For the saved-data check of a character: no field, or a list of well-formed records (hand-edited data is refused, not repaired).
  function valid(c) {
    const raw = isObject(c) && isObject(c.extra) ? c.extra.vehicles : undefined;
    if (raw === undefined) return true;
    if (!Array.isArray(raw) || raw.length > MAX_VEHICLES) return false;
    return raw.every(strictVehicle) && new Set(raw.map(x => x.id)).size === raw.length;
  }
  function writeVehicles(c, list) {
    if (!isObject(c.extra)) c.extra = {};
    if (list.length) c.extra.vehicles = list.map(cleanVehicle).filter(Boolean).slice(0, MAX_VEHICLES);
    else delete c.extra.vehicles;
  }
  const snap = list => JSON.stringify(list);
  function displayName(v, lang) { return v.name || itemName(entry(v.catalogId), lang) || t(lang, 'unnamed'); }
  function stats(v) {
    const s = entry(v.catalogId)?.stats;
    return isObject(s) ? { seats: s.seats !== undefined ? String(s.seats) : '', move: Number.isFinite(s.move) ? s.move : null, kph: Number.isFinite(s.kph) ? s.kph : null } : { seats: '', move: null, kph: null };
  }

  // Runs one change on the list. The result carries what the notice needs to take the change back: the one vehicle
  // it touched, before and after, so a later change to another vehicle does not make the undo stale.
  const one = v => (v ? JSON.stringify(v) : null);
  function change(c, lang, fn) {
    const before = readVehicles(c), copy = before.map(v => ({ ...v, upgrades: v.upgrades.slice() })), r = fn(copy);
    if (!r || r.ok === false) return r || fail(lang, 'stale');
    writeVehicles(c, copy);
    const after = readVehicles(c), id = r.id, index = before.findIndex(v => v.id === id);
    return { ok: true, ...r, undo: { characterId: c.id, id, index, before: one(before[index]), after: one(after.find(v => v.id === id)) } };
  }
  function restore(c, undo, lang) {
    if (!isObject(c) || !undo || c.id !== undo.characterId) return fail(lang, 'stale');
    const list = readVehicles(c), i = list.findIndex(v => v.id === undo.id);
    if (one(list[i]) !== undo.after) return fail(lang, 'stale');
    if (undo.before === null) list.splice(i, 1);
    else if (i >= 0) list[i] = JSON.parse(undo.before);
    else if (list.length >= MAX_VEHICLES) return fail(lang, 'full');
    else list.splice(Math.min(Math.max(undo.index, 0), list.length), 0, JSON.parse(undo.before));
    writeVehicles(c, list);
    return { ok: true };
  }
  const find = (list, id) => list.find(v => v.id === id);

  function addVehicle(c, input, lang, newId = uid) {
    const o = isObject(input) ? input : {};
    return change(c, lang, list => {
      if (list.length >= MAX_VEHICLES) return fail(lang, 'full');
      let v;
      if (o.catalogId) {
        const e = entry(o.catalogId);
        if (!isVehicle(e)) return fail(lang, 'unknown');
        const sdp = whole(e.stats?.sdp, 0, MAX_SDP) ?? 0;
        v = { id: newId(), catalogId: e.id, sdp, sdpMax: sdp, upgrades: [], notes: '' };
      } else {
        const name = line(o.name, MAX_NAME), max = whole(o.sdpMax, 1, MAX_SDP);
        if (!name) return fail(lang, 'noName');
        if (max === null) return fail(lang, 'badSdp');
        v = { id: newId(), name, sdp: max, sdpMax: max, upgrades: [], notes: '' };
      }
      list.push(v);
      return { id: v.id, message: t(lang, 'added', displayName(v, lang)) };
    });
  }
  function removeVehicle(c, id, lang) {
    return change(c, lang, list => {
      const i = list.findIndex(v => v.id === id);
      if (i < 0) return fail(lang, 'stale');
      const [v] = list.splice(i, 1);
      return { id, message: t(lang, 'removed', displayName(v, lang)), restoredMessage: t(lang, 'restored', displayName(v, lang)) };
    });
  }
  // delta changes SDP by that much (clamped to 0..max); set puts an exact value (clamped to the maximum).
  function adjustSdp(c, id, delta, lang) {
    return change(c, lang, list => {
      const v = find(list, id), d = typeof delta === 'number' && Number.isSafeInteger(delta) ? delta : null;
      if (!v || d === null) return fail(lang, 'stale');
      v.sdp = Math.max(0, Math.min(v.sdpMax, v.sdp + d));
      return { id };
    });
  }
  function setSdp(c, id, value, lang) {
    const n = whole(value, 0, MAX_SDP);
    if (n === null) return fail(lang, 'badSdp');
    return change(c, lang, list => {
      const v = find(list, id);
      if (!v) return fail(lang, 'stale');
      v.sdp = Math.min(n, v.sdpMax);
      return { id };
    });
  }
  function setSdpMax(c, id, value, lang) {
    const n = whole(value, 1, MAX_SDP);
    if (n === null) return fail(lang, 'badSdp');
    return change(c, lang, list => {
      const v = find(list, id);
      if (!v) return fail(lang, 'stale');
      const was = v.sdp;
      v.sdpMax = n; v.sdp = Math.min(v.sdp, n);
      return v.sdp < was ? { id, clipped: true, message: t(lang, 'clipped', displayName(v, lang), v.sdp, n), restoredMessage: t(lang, 'clippedBack', displayName(v, lang), was) } : { id };
    });
  }
  function repair(c, id, lang) {
    return change(c, lang, list => {
      const v = find(list, id);
      if (!v) return fail(lang, 'stale');
      v.sdp = v.sdpMax;
      return { id };
    });
  }
  // Collision (or any other) damage taken from the vehicle's SDP; SDP stops at 0.
  function applyDamage(c, id, amount, lang) {
    const n = whole(amount, 0, MAX_SDP);
    if (n === null) return fail(lang, 'badDamage');
    return change(c, lang, list => {
      const v = find(list, id);
      if (!v) return fail(lang, 'stale');
      const was = v.sdp;
      v.sdp = Math.max(0, v.sdp - n);
      return { id, damage: n, sdp: v.sdp, sdpMax: v.sdpMax, message: t(lang, 'applied', n, displayName(v, lang), v.sdp, v.sdpMax), restoredMessage: t(lang, 'appliedBack', displayName(v, lang), was) };
    });
  }
  function installUpgrade(c, id, upgradeId, lang) {
    return change(c, lang, list => {
      const v = find(list, id), e = entry(upgradeId);
      if (!v) return fail(lang, 'stale');
      if (!isUpgrade(e)) return fail(lang, 'unknown');
      if (v.upgrades.includes(e.id)) return fail(lang, 'dup');
      if (v.upgrades.length >= MAX_UPGRADES) return fail(lang, 'fullUpgrades');
      v.upgrades.push(e.id);
      return { id, upgradeId: e.id };
    });
  }
  function removeUpgrade(c, id, upgradeId, lang) {
    return change(c, lang, list => {
      const v = find(list, id), i = v ? v.upgrades.indexOf(upgradeId) : -1;
      if (!v || i < 0) return fail(lang, 'stale');
      v.upgrades.splice(i, 1);
      const u = itemName(entry(upgradeId), lang) || upgradeId;
      return { id, message: t(lang, 'upRemoved', u, displayName(v, lang)), restoredMessage: t(lang, 'upRestored', u, displayName(v, lang)) };
    });
  }
  function setName(c, id, value, lang) {
    return change(c, lang, list => {
      const v = find(list, id);
      if (!v) return fail(lang, 'stale');
      const name = line(value, MAX_NAME);
      if (!name && !v.catalogId) return fail(lang, 'noName');
      if (name) v.name = name; else delete v.name;
      return { id };
    });
  }
  function setNotes(c, id, value, lang) {
    return change(c, lang, list => {
      const v = find(list, id);
      if (!v) return fail(lang, 'stale');
      v.notes = text(value, MAX_NOTES);
      return { id };
    });
  }
  // The dice of a collision come from vehicle-tools.js; this only reads them back.
  function rollCollision(rng) {
    const tools = global.VehicleTools;
    if (!tools || typeof tools.ramDamage !== 'function') return null;
    const r = tools.ramDamage('shared', rng ? () => 1 + Math.floor(rng() * 6) : undefined);
    return r && Array.isArray(r.first) && Number.isSafeInteger(r.firstTotal) ? { dice: r.first.slice(), total: r.firstTotal } : null;
  }

  // ---------- 2. Drawing ----------

  // The latest collision roll per vehicle (kept in memory until it is applied or hidden).
  const hits = new Map();
  const open = new Set();
  const pct = v => (v.sdpMax > 0 ? Math.round((v.sdp / v.sdpMax) * 100) : 0);
  function attrs(c, v) { return `data-gr-char="${esc(c.id)}" data-gr-id="${esc(v.id)}"`; }
  function stepper(c, v, lang) {
    const name = displayName(v, lang), a = attrs(c, v);
    return `<div class="gr-sdpbox" data-gr-box="${esc(v.id)}"><div class="gr-sdp" role="group" aria-label="SDP: ${esc(name)}"><button type="button" class="gr-step" data-gr-action="sdp-minus" ${a} aria-label="${esc(t(lang, 'minus'))}: ${esc(name)}">&minus;</button><span class="gr-val"><b data-gr-cur>${v.sdp}</b> / <span data-gr-max>${v.sdpMax}</span> <small>SDP</small></span><button type="button" class="gr-step" data-gr-action="sdp-plus" ${a} aria-label="${esc(t(lang, 'plus'))}: ${esc(name)}">+</button></div><div class="gr-bar" role="progressbar" aria-label="SDP: ${esc(name)}" aria-valuemin="0" aria-valuemax="${v.sdpMax}" aria-valuenow="${v.sdp}" data-gr-bar><i style="width:${pct(v)}%"></i></div></div>`;
  }
  function hitHtml(c, v, lang) {
    const h = hits.get(v.id);
    if (!h) return '';
    const name = displayName(v, lang), a = attrs(c, v);
    return `<div class="gr-hit" role="status"><p>${esc(t(lang, 'hitFor', h.total))} <span class="gr-dice">(${esc(h.dice.join(' + '))})</span></p><label class="field">${esc(t(lang, 'hitValue'))}<input type="number" inputmode="numeric" min="0" max="${MAX_SDP}" step="1" value="${h.total}" data-gr-hit-value></label><div class="gr-actions"><button type="button" class="btn primary" data-gr-action="hit-apply" ${a} aria-label="${esc(t(lang, 'hitApply'))}: ${esc(name)}">${esc(t(lang, 'hitApply'))}</button><button type="button" class="btn ghost" data-gr-action="hit-dismiss" ${a} aria-label="${esc(t(lang, 'hitDismiss'))}: ${esc(name)}">${esc(t(lang, 'hitDismiss'))}</button></div><p class="gr-note">${esc(t(lang, 'hitNote'))}</p></div>`;
  }
  function hitButton(c, v, lang) {
    const name = displayName(v, lang);
    return `<button type="button" class="btn ghost" data-gr-action="hit" ${attrs(c, v)} aria-label="${esc(t(lang, 'hit'))}: ${esc(name)}">${esc(t(lang, 'hitRoll'))}</button>`;
  }
  function upgradeRows(c, v, lang) {
    if (!v.upgrades.length) return `<p class="gr-note">${esc(t(lang, 'noUpgrades'))}</p>`;
    return `<ul class="gr-upgrades">${v.upgrades.map(u => {
      const e = entry(u), nm = itemName(e, lang) || u;
      return `<li><span class="gr-up-name"><b>${esc(nm)}</b>${e?.details ? `<small>${esc(e.details[L(lang)] || e.details.en || '')}</small>` : ''}</span>${e?.page ? `<button type="button" class="rule-source" data-action="book-page" data-page="${esc(e.page)}">${esc(t(lang, 'page'))} ${esc(e.page)}</button>` : ''}<button type="button" class="btn ghost" data-gr-action="up-remove" ${attrs(c, v)} data-gr-up="${esc(u)}" aria-label="${esc(t(lang, 'removeUpgrade'))}: ${esc(nm)} (${esc(displayName(v, lang))})">${esc(t(lang, 'removeUpgrade'))}</button></li>`;
    }).join('')}</ul>`;
  }
  function upgradePicker(c, v, lang) {
    const free = upgradeChoices().filter(e => !v.upgrades.includes(e.id));
    if (!free.length) return `<p class="gr-note">${esc(t(lang, 'noMoreUpgrades'))}</p>`;
    return `<div class="gr-pick"><label class="field">${esc(t(lang, 'upgradePick'))}<select data-gr-upgrade-pick="${esc(v.id)}">${free.map(e => `<option value="${esc(e.id)}">${esc(itemName(e, lang))} · ${esc(e.price)} eb</option>`).join('')}</select></label><button type="button" class="btn" data-gr-action="up-add" ${attrs(c, v)}>${esc(t(lang, 'addUpgrade'))}</button></div><p class="gr-note">${esc(t(lang, 'upgradeHint'))}</p>`;
  }
  function vehicleHtml(c, v, lang) {
    const name = displayName(v, lang), s = stats(v), a = attrs(c, v), e = entry(v.catalogId);
    const meta = [s.seats ? `${t(lang, 'seats')} ${s.seats}` : '', s.move !== null ? `${t(lang, 'move')} ${s.move}` : '', s.kph !== null ? `${s.kph} ${t(lang, 'kph')}` : ''].filter(Boolean).join(' · ');
    return `<li class="gr-vehicle" data-gr-row="${esc(v.id)}"><div class="gr-head"><strong>${esc(name)}</strong>${meta ? `<span class="gr-meta">${esc(meta)}</span>` : ''}${e?.page ? `<button type="button" class="rule-source" data-action="book-page" data-page="${esc(e.page)}">${esc(t(lang, 'page'))} ${esc(e.page)}</button>` : ''}</div>${stepper(c, v, lang)}${v.sdp === 0 ? `<p class="gr-zero" role="status">${esc(t(lang, 'zero'))}</p>` : ''}<div class="gr-actions">${hitButton(c, v, lang)}<button type="button" class="btn ghost" data-gr-action="repair" ${a} aria-label="${esc(t(lang, 'repair'))}: ${esc(name)}"${v.sdp === v.sdpMax ? ' disabled' : ''}>${esc(t(lang, 'repair'))}</button></div>${hitHtml(c, v, lang)}<details data-gr-open="${esc(v.id)}"${open.has(v.id) ? ' open' : ''}><summary>${esc(t(lang, 'upgrades', v.upgrades.length))}</summary>${upgradeRows(c, v, lang)}${upgradePicker(c, v, lang)}</details><details data-gr-open="${esc('f' + v.id)}"${open.has('f' + v.id) ? ' open' : ''}><summary>${esc(t(lang, 'name'))} · SDP · ${esc(t(lang, 'notes'))}</summary><div class="gr-fields"><label class="field">${esc(t(lang, 'name'))}<input type="text" maxlength="${MAX_NAME}" value="${esc(v.name || '')}" placeholder="${esc(itemName(e, lang))}" data-gr-field="name" ${a}></label><label class="field">${esc(t(lang, 'sdpNow'))}<input type="number" inputmode="numeric" min="0" max="${MAX_SDP}" step="1" value="${v.sdp}" data-gr-field="sdp" ${a}></label><label class="field">${esc(t(lang, 'sdpMax'))}<input type="number" inputmode="numeric" min="1" max="${MAX_SDP}" step="1" value="${v.sdpMax}" data-gr-field="max" ${a}></label></div><label class="field">${esc(t(lang, 'notes'))}<textarea rows="3" maxlength="${MAX_NOTES}" data-gr-field="notes" ${a}>${esc(v.notes)}</textarea></label><div class="gr-actions"><button type="button" class="btn ghost" data-gr-action="remove" ${a} aria-label="${esc(t(lang, 'remove'))}: ${esc(name)}">${esc(t(lang, 'remove'))}</button></div></details></li>`;
  }
  function addForm(c, lang) {
    return `<div class="gr-add"><label class="field">${esc(t(lang, 'pick'))}<select data-gr-vehicle-pick>${vehicleChoices().map(e => `<option value="${esc(e.id)}">${esc(itemName(e, lang))}${e.stats?.sdp !== undefined ? ` · SDP ${esc(e.stats.sdp)}` : ''}</option>`).join('')}<option value="">${esc(t(lang, 'custom'))}</option></select></label><label class="field">${esc(t(lang, 'newName'))}<input type="text" maxlength="${MAX_NAME}" data-gr-new-name></label><label class="field">${esc(t(lang, 'newSdp'))}<input type="number" inputmode="numeric" min="1" max="${MAX_SDP}" step="1" data-gr-new-sdp></label><button type="button" class="btn primary" data-gr-action="add" data-gr-char="${esc(c.id)}">${esc(t(lang, 'add'))}</button></div><p class="gr-note">${esc(t(lang, 'newHint'))}</p>`;
  }
  function render(c, lang) {
    const l = L(lang);
    if (!isObject(c) || typeof c.id !== 'string') return '';
    const list = readVehicles(c);
    return `<section class="card garage" data-garage data-gr-char="${esc(c.id)}"><div class="card-heading"><span>${esc(t(l, 'title'))}</span><span>${esc(t(l, 'count', list.length, MAX_VEHICLES))}</span></div>${list.length ? `<ul class="gr-list">${list.map(v => vehicleHtml(c, v, l)).join('')}</ul>` : `<p class="gr-note">${esc(t(l, 'empty'))}</p>`}${list.length < MAX_VEHICLES ? addForm(c, l) : `<p class="gr-note">${esc(t(l, 'full'))}</p>`}<button type="button" class="rule-source" data-action="book-page" data-page="190">${esc(t(l, 'book'))} ↗</button></section>`;
  }
  // Compact rows for the combat page: the SDP counter and the collision button of every vehicle.
  function combatRows(c, lang) {
    const l = L(lang);
    if (!isObject(c) || typeof c.id !== 'string') return '';
    const list = readVehicles(c);
    if (!list.length) return '';
    return `<div class="garage-combat" data-gr-combat><div class="gr-combat-title">${esc(t(l, 'combat'))}</div>${list.map(v => `<div class="gr-combat-row"><strong>${esc(displayName(v, l))}</strong>${stepper(c, v, l)}${v.sdp === 0 ? `<p class="gr-zero" role="status">${esc(t(l, 'zero'))}</p>` : ''}<div class="gr-actions">${hitButton(c, v, l)}</div>${hitHtml(c, v, l)}</div>`).join('')}</div>`;
  }

  // ---------- 3. Page wiring ----------

  const app = () => global.App;
  const doc = global.document;
  const lang = () => (app()?.lang?.() === 'en' ? 'en' : 'ru');
  function say(message) { if (message) app()?.notify?.(message); }
  function target(el) {
    const A = app(), c = A?.active?.();
    if (!c || String(c.id) !== String(el?.dataset?.grChar ?? '')) return null;
    const id = el.dataset.grId;
    if (id !== undefined && !readVehicles(c).some(v => v.id === id)) return null;
    return { c, id };
  }
  // After the sheet is drawn again the control that was used is a new element: find it by what it carries.
  function refocus(selector, match) {
    for (const el of doc?.querySelectorAll?.(selector) || []) {
      if (!match(el)) continue;
      el.focus?.({ preventScroll: true });
      return true;
    }
    return false;
  }
  const focusAction = (action, id) => refocus('[data-gr-action]', el => el.dataset.grAction === action && el.dataset.grId === id);
  function commit(r) {
    if (r?.ok) { app()?.save?.(); app()?.render?.(); }
    return r;
  }
  function withUndo(r, l) {
    const A = app();
    const back = () => {
      const c = A?.getState?.()?.characters?.find?.(x => x && x.id === r.undo.characterId), again = c ? restore(c, r.undo, lang()) : fail(lang(), 'stale');
      commit(again); say(again.ok ? r.restoredMessage : again.message);
    };
    if (typeof A?.notifyAction === 'function') A.notifyAction(r.message, t(l, 'undo'), back); else say(r.message);
  }
  function handle(e) {
    const el = e.target?.closest?.('[data-gr-action]');
    if (e.type !== 'click' || !el) return false;
    const l = lang(), A = app(), action = el.dataset.grAction, at = target(el);
    if (!at) { say(t(l, 'stale')); A?.render?.(); return true; }
    const { c, id } = at;
    if (action === 'add') {
      const root = el.closest('[data-garage]') || doc, q = s => root.querySelector(s), pick = q('[data-gr-vehicle-pick]')?.value || '';
      const r = addVehicle(c, { catalogId: pick, name: q('[data-gr-new-name]')?.value, sdpMax: q('[data-gr-new-sdp]')?.value }, l);
      if (!r.ok) { say(r.message); (pick ? q('[data-gr-vehicle-pick]') : q(r.key === 'noName' ? '[data-gr-new-name]' : '[data-gr-new-sdp]'))?.focus?.(); return true; }
      commit(r); say(r.message); open.add('f' + r.id);
      focusAction('sdp-plus', r.id);
      return true;
    }
    if (action === 'sdp-minus' || action === 'sdp-plus') {
      hits.delete(id);
      commit(adjustSdp(c, id, action === 'sdp-plus' ? 1 : -1, l));
      focusAction(action, id);
      return true;
    }
    if (action === 'repair') { commit(repair(c, id, l)); focusAction('hit', id) || focusAction('sdp-plus', id); return true; }
    if (action === 'hit') {
      const roll = rollCollision();
      if (!roll) { say(t(l, 'noRoll')); return true; }
      hits.set(id, roll);
      try { global.Rolls?.sum?.(t(l, 'rollLabel'), roll.dice, 6, { total: roll.total }); } catch { /* the roll history is optional */ }
      app()?.render?.();
      focusAction('hit-apply', id);
      return true;
    }
    if (action === 'hit-dismiss') { hits.delete(id); app()?.render?.(); focusAction('hit', id); return true; }
    if (action === 'hit-apply') {
      const input = el.closest('.gr-hit')?.querySelector('[data-gr-hit-value]');
      const r = applyDamage(c, id, input ? input.value : null, l);
      if (!r.ok) { say(r.message); input?.focus?.(); return true; }
      hits.delete(id); commit(r); withUndo(r, l); focusAction('hit', id);
      return true;
    }
    if (action === 'remove') {
      const r = removeVehicle(c, id, l);
      if (!r.ok) { say(r.message); return true; }
      hits.delete(id); open.delete(id); open.delete('f' + id); commit(r); withUndo(r, l);
      refocus('[data-gr-action="add"]', () => true);
      return true;
    }
    if (action === 'up-add') {
      const pick = el.closest('details')?.querySelector('[data-gr-upgrade-pick]');
      const r = installUpgrade(c, id, pick?.value, l);
      if (!r.ok) { say(r.message); return true; }
      open.add(id); commit(r);
      refocus('[data-gr-upgrade-pick]', x => x.dataset.grUpgradePick === id) || focusAction('up-remove', id);
      return true;
    }
    if (action === 'up-remove') {
      const up = el.dataset.grUp, r = removeUpgrade(c, id, up, l);
      if (!r.ok) { say(r.message); return true; }
      open.add(id); commit(r); withUndo(r, l);
      refocus('[data-gr-upgrade-pick]', x => x.dataset.grUpgradePick === id) || refocus('summary', x => x.parentElement?.dataset?.grOpen === id);
      return true;
    }
    return false;
  }
  // A typed field is saved on change. The counter and the bar are updated in place, so the control the player
  // is moving to (a button pressed right after typing) is not replaced under the pointer.
  function sync(c, id) {
    const v = readVehicles(c).find(x => x.id === id);
    if (!v) return;
    // The card and the combat dock can both show this vehicle: every copy is updated.
    for (const box of [...(doc?.querySelectorAll?.('[data-gr-box]') || [])].filter(x => x.dataset.grBox === id)) {
      const set = (s, val) => { const n = box.querySelector(s); if (n) n.textContent = String(val); };
      set('[data-gr-cur]', v.sdp); set('[data-gr-max]', v.sdpMax);
      const bar = box.querySelector('[data-gr-bar]');
      if (bar) { bar.setAttribute?.('aria-valuenow', String(v.sdp)); bar.setAttribute?.('aria-valuemax', String(v.sdpMax)); const i = bar.querySelector('i'); if (i) i.style.width = pct(v) + '%'; }
    }
    for (const row of [...(doc?.querySelectorAll?.('[data-gr-row]') || [])].filter(x => x.dataset.grRow === id)) {
      for (const [k, val] of [['sdp', v.sdp], ['max', v.sdpMax]]) { const f = [...row.querySelectorAll('[data-gr-field]')].find(x => x.dataset.grField === k); if (f && f !== doc.activeElement) f.value = String(val); }
    }
  }
  function handleChange(e) {
    const el = e.target;
    if (e.type !== 'change' || !el?.dataset || el.dataset.grField === undefined) return false;
    const l = lang(), at = target(el), field = el.dataset.grField;
    if (!at) { say(t(l, 'stale')); app()?.render?.(); return true; }
    const { c, id } = at;
    const r = field === 'name' ? setName(c, id, el.value, l) : field === 'sdp' ? setSdp(c, id, el.value, l) : field === 'max' ? setSdpMax(c, id, el.value, l) : field === 'notes' ? setNotes(c, id, el.value, l) : null;
    if (!r) return false;
    if (!r.ok) { say(r.message); app()?.render?.(); refocus('[data-gr-field]', x => x.dataset.grField === field && x.dataset.grId === id); return true; }
    hits.delete(id);
    app()?.save?.(); sync(c, id);
    if (r.clipped) withUndo(r, l);
    return true;
  }
  function onToggle(e) {
    const el = e.target, id = el?.dataset?.grOpen;
    if (!id || !el.matches?.('details')) return;
    if (el.open) open.add(id); else open.delete(id);
  }
  const inApp = el => !!el && !!doc?.querySelector?.('#app')?.contains?.(el);
  if (doc?.addEventListener) {
    doc.addEventListener('click', e => { if (inApp(e.target?.closest?.('[data-gr-action]'))) handle(e); });
    doc.addEventListener('change', e => { if (inApp(e.target)) handleChange(e); });
    doc.addEventListener('toggle', onToggle, true);
  }

  global.Garage = {
    MAX_VEHICLES, MAX_UPGRADES, MAX_NAME, MAX_NOTES, MAX_SDP, T,
    cleanVehicle, readVehicles, valid, writeVehicles, displayName, stats, vehicleChoices, upgradeChoices,
    addVehicle, removeVehicle, adjustSdp, setSdp, setSdpMax, repair, applyDamage, installUpgrade, removeUpgrade, setName, setNotes, restore, rollCollision,
    render, combatRows, handle, handleChange, reset() { hits.clear(); open.clear(); }
  };
})(window);
