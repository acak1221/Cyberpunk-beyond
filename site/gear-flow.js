// Gear flow: what a player does with things they already own.
//
//  - the inventory is a list of one-line rows; a row opens into its edit form (character-extra.js draws the form);
//  - «Удалить» on an item or a weapon can be taken back from the notice for ten seconds;
//  - «Продать» credits money through Wallet.earn at a price the player confirms (the catalog price is offered);
//  - «Отдать» moves the thing to another character on this device;
//  - armor bought in the shop is put on when the location is bare, and the receipt says what is still unprotected.
//
// The first part is pure functions over a character (tested in tests/gear-flow.test.cjs); the second part is the
// page wiring. Money changes only through window.Wallet; armor only through EquipmentTools.equip.
(function (global) {
  'use strict';

  const KINDS = ['items', 'weapons'];
  const esc = x => String(x ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const isObject = x => x !== null && typeof x === 'object' && !Array.isArray(x);
  const whole = v => { const n = Math.floor(Number(v)); return Number.isFinite(n) ? n : 0; };
  const L = lang => (lang === 'en' ? 'en' : 'ru');
  const uid = () => global.crypto?.randomUUID?.() || Date.now().toString(36) + '-' + Math.random().toString(36).slice(2);
  const catalogItem = id => (Array.isArray(global.CATALOG) && id ? global.CATALOG.find(x => x && x.id === id) : undefined);
  const tools = () => global.EquipmentTools;

  const T = {
    ru: {
      sell: 'Продать', give: 'Отдать', remove: 'Удалить', cancel: 'Отмена', undo: 'Вернуть',
      count: 'Сколько', price: 'Цена за всё, eb', to: 'Кому',
      sellTitle: name => `Продать: ${name}`, giveTitle: name => `Отдать: ${name}`,
      priceHint: unit => unit > 0 ? `По каталогу: ${unit} eb за штуку. Сколько дадут на самом деле, решает ведущий.` : 'Цены в каталоге нет: укажите, сколько вам дали.',
      sold: (name, n, sum, balance) => `Продано: ${name} × ${n} за ${sum} eb. Деньги: ${balance} eb.`,
      dropped: (name, n) => `Отдано даром: ${name} × ${n}.`,
      given: (name, n, who) => `Отдано: ${name} × ${n} → ${who}.`,
      removed: name => `Удалено: ${name}.`, restored: name => `Возвращено: ${name}.`,
      soldNote: (name, n) => `Продажа: ${name} × ${n}`,
      noOthers: 'На этом устройстве нет других персонажей. Создайте или импортируйте персонажа, которому хотите отдать вещь.',
      installed: 'Этот имплант установлен: его нельзя продать или отдать.',
      badCount: 'Укажите количество от 1 до имеющегося.', badPrice: 'Укажите цену целым числом от 0.', tooMuch: 'Столько денег на листе не поместится.',
      stale: 'Лист изменился. Повторите действие.', unnamed: 'Без названия', noName: 'без имени',
      worn: 'надето', installedTag: 'установлено',
      cat: { equipment: 'Снаряжение', cyberware: 'Имплант', armor: 'Броня', other: 'Другое' },
      armor: 'Броня', head: 'голова', body: 'тело', armorJump: 'Надеть или снять',
      wornLine: (where, name, sp) => `Надето ${where}: ${name}, SP ${sp}.`,
      onHead: 'на голову', onBody: 'на тело', onBoth: 'на голову и тело',
      bareHead: 'Голова не защищена: один экземпляр брони закрывает одну часть тела. Для головы купите ещё один.',
      bareBody: 'Тело не защищено: один экземпляр брони закрывает одну часть тела. Для тела купите ещё один.',
      keptOff: name => `${name}: не надето, обе части тела уже защищены. Надеть можно на листе, вкладка «Снаряжение».`,
      perLocation: 'На одну часть тела: голову или тело'
    },
    en: {
      sell: 'Sell', give: 'Give', remove: 'Delete', cancel: 'Cancel', undo: 'Undo',
      count: 'How many', price: 'Price for all, eb', to: 'To',
      sellTitle: name => `Sell: ${name}`, giveTitle: name => `Give: ${name}`,
      priceHint: unit => unit > 0 ? `Catalog: ${unit} eb each. What you really get is the GM's call.` : 'There is no catalog price: enter what you were paid.',
      sold: (name, n, sum, balance) => `Sold: ${name} × ${n} for ${sum} eb. Money: ${balance} eb.`,
      dropped: (name, n) => `Given away: ${name} × ${n}.`,
      given: (name, n, who) => `Given: ${name} × ${n} → ${who}.`,
      removed: name => `Deleted: ${name}.`, restored: name => `Restored: ${name}.`,
      soldNote: (name, n) => `Sale: ${name} × ${n}`,
      noOthers: 'There are no other characters on this device. Create or import the character you want to give this to.',
      installed: 'This implant is installed: it cannot be sold or given away.',
      badCount: 'Enter a quantity from 1 to what you have.', badPrice: 'Enter the price as a whole number, 0 or more.', tooMuch: 'The sheet cannot hold that much money.',
      stale: 'The sheet changed. Try again.', unnamed: 'Unnamed', noName: 'unnamed',
      worn: 'worn', installedTag: 'installed',
      cat: { equipment: 'Equipment', cyberware: 'Cyberware', armor: 'Armor', other: 'Other' },
      armor: 'Armor', head: 'head', body: 'body', armorJump: 'Put on or take off',
      wornLine: (where, name, sp) => `Put ${where}: ${name}, SP ${sp}.`,
      onHead: 'on the head', onBody: 'on the body', onBoth: 'on the head and body',
      bareHead: 'The head is unprotected: one piece of armor covers one location. Buy another piece for the head.',
      bareBody: 'The body is unprotected: one piece of armor covers one location. Buy another piece for the body.',
      keptOff: name => `${name}: not put on, both locations are already covered. You can put it on from the sheet, Gear tab.`,
      perLocation: 'Covers one location: head or body'
    }
  };
  const t = (lang, key, ...args) => { const v = T[L(lang)][key]; return typeof v === 'function' ? v(...args) : v; };

  // ---------- 1. Pure functions ----------

  const list = (c, kind) => (KINDS.includes(kind) && Array.isArray(c?.extra?.[kind]) ? c.extra[kind] : null);
  function find(c, kind, id) {
    const rows = list(c, kind);
    if (!rows || typeof id !== 'string' || !id) return null;
    const hits = rows.filter(r => isObject(r) && r.id === id);
    return hits.length === 1 ? { record: hits[0], index: rows.indexOf(hits[0]) } : null;
  }
  // How many of the record there are: a weapon is one thing, an item has a quantity.
  const amount = (kind, record) => (kind === 'weapons' ? 1 : Math.max(0, whole(record?.quantity ?? 1)));
  function displayName(record, lang) {
    const item = catalogItem(record?.catalogId), name = String(record?.name || '').trim();
    if (item && [item.name?.ru, item.name?.en].includes(name)) return item.name[L(lang)] || name;
    return name || t(lang, 'unnamed');
  }

  // Price of one unit: what was paid for it, else the catalog price. Ammunition is counted in rounds and priced per ten.
  function unitPrice(record, item) {
    const p = record?.purchase;
    if (isObject(p) && Number.isFinite(p.total) && p.total >= 0) {
      const n = p.rooms ? 1 : Number(p.ammoCount ?? p.quantity);
      return Number.isFinite(n) && n > 0 ? p.total / n : p.total;
    }
    if (item && Number.isFinite(item.price) && item.price >= 0) {
      if (item.category === 'ammo') return ['grenade', 'rocket'].includes(record?.ammoType) ? item.price : item.price / 10;
      return item.price;
    }
    return 0;
  }
  // -> { max, count, unit, price }: the offer shown in the «Sell» form.
  function sellQuote(record, kind, count, item) {
    const max = amount(kind, record), n = Math.max(1, Math.min(max || 1, whole(count) || 1)), unit = unitPrice(record, item === undefined ? catalogItem(record?.catalogId) : item);
    return { max, count: n, unit, price: Math.round(unit * n) };
  }

  const fail = (lang, reason, message) => ({ ok: false, reason, message: message || t(lang, reason) });
  // Takes `count` of the record out of the character. Worn armor and installed implants stay put (EquipmentTools says why).
  function takeOut(c, kind, id, count, lang) {
    const hit = find(c, kind, id);
    if (!hit) return fail(lang, 'stale');
    const { record, index } = hit, have = amount(kind, record), n = whole(count), ET = tools();
    if (record.humanityLossIncluded === true) return fail(lang, 'installed');
    if (!(n >= 1) || n > have || Number(count) !== n) return fail(lang, 'badCount');
    if (n === have) {
      const check = ET?.canRemove ? ET.canRemove(c, id, L(lang)) : { ok: true };
      if (!check.ok) return fail(lang, check.reason, check.message);
      return { ok: true, record, index, count: n, whole: true, apply() { list(c, kind).splice(index, 1); } };
    }
    const check = ET?.canSetQuantity ? ET.canSetQuantity(c, id, have - n, L(lang)) : { ok: true };
    if (!check.ok) return fail(lang, check.reason, check.message);
    return { ok: true, record, index, count: n, whole: false, apply() { if (ET?.setQuantity) ET.setQuantity(c, id, have - n, L(lang)); else record.quantity = have - n; } };
  }

  // Sell: the thing leaves the sheet and the confirmed price is credited through the Wallet. All or nothing.
  function sell(c, kind, id, count, price, lang) {
    const raw = Number(price), sum = whole(price), W = global.Wallet;
    if (!Number.isFinite(raw) || sum < 0 || raw !== sum) return fail(lang, 'badPrice');
    const out = takeOut(c, kind, id, count, lang);
    if (!out.ok) return out;
    const name = displayName(out.record, lang);
    if (sum > 0) {
      if (!W?.earn) return fail(lang, 'stale');
      const probe = W.earn(c, sum, t(lang, 'soldNote', name, out.count));
      if (!probe.ok) return fail(lang, probe.reason === 'max' ? 'tooMuch' : 'badPrice');
    }
    out.apply();
    let balance = W?.cash ? W.cash(c) : whole(c.extra?.cash);
    if (sum > 0) { const paid = W.earn(c, sum, t(lang, 'soldNote', name, out.count)); c.extra = paid.extra; balance = paid.balance; }
    return { ok: true, dirty: true, name, count: out.count, price: sum, balance, message: sum > 0 ? t(lang, 'sold', name, out.count, sum, balance) : t(lang, 'dropped', name, out.count) };
  }

  // Give: the same record (a fresh id, nothing worn or installed carried over) appears on the other character's sheet.
  function give(from, to, kind, id, count, lang) {
    if (!isObject(from) || !isObject(to) || from === to || (from.id && from.id === to.id)) return fail(lang, 'stale');
    if (to.extra !== undefined && !isObject(to.extra)) return fail(lang, 'stale');
    const out = takeOut(from, kind, id, count, lang);
    if (!out.ok) return out;
    let copy;
    try { copy = JSON.parse(JSON.stringify(out.record)); } catch { return fail(lang, 'stale'); }
    copy.id = uid();
    delete copy.humanityLossIncluded;
    if (kind === 'items') copy.quantity = out.count;
    if (copy.starterArmor !== undefined && out.count !== 1) delete copy.starterArmor;
    if (global.CharacterExtra?.init) global.CharacterExtra.init(to);
    if (!isObject(to.extra)) to.extra = {};
    if (!Array.isArray(to.extra[kind])) to.extra[kind] = [];
    out.apply();
    to.extra[kind].push(copy);
    const name = displayName(copy, lang);
    return { ok: true, dirty: true, name, count: out.count, record: copy, message: t(lang, 'given', name, out.count, String(to.name || '').trim() || t(lang, 'noName')) };
  }

  // Delete with a way back: the caller keeps `undo` and hands it to restore().
  function remove(c, kind, id, lang) {
    const hit = find(c, kind, id);
    if (!hit) return fail(lang, 'stale');
    const check = tools()?.canRemove ? tools().canRemove(c, id, L(lang)) : { ok: true };
    if (!check.ok) return fail(lang, check.reason, check.message);
    list(c, kind).splice(hit.index, 1);
    const name = displayName(hit.record, lang);
    return { ok: true, dirty: true, name, message: t(lang, 'removed', name), undo: { characterId: c.id, kind, index: hit.index, record: hit.record } };
  }
  function restore(c, undo, lang) {
    const rows = list(c, undo?.kind);
    if (!rows || !isObject(undo.record) || (c.id && undo.characterId !== c.id) || rows.some(r => r === undo.record || (isObject(r) && r.id === undo.record.id))) return fail(lang, 'stale');
    rows.splice(Math.max(0, Math.min(rows.length, whole(undo.index))), 0, undo.record);
    return { ok: true, dirty: true, message: t(lang, 'restored', displayName(undo.record, lang)) };
  }

  // Armor state of the two locations: { head: { sp, name, bare }, body: … }.
  function armorState(c, lang) {
    const slots = isObject(c?.extra?.equipment?.armor) ? c.extra.equipment.armor : {};
    const one = (key, sp) => {
      const slot = isObject(slots[key]) ? slots[key] : null, item = slot ? catalogItem(slot.catalogId) : null, value = Math.max(0, whole(sp));
      return { sp: value, name: item?.name?.[L(lang)] || '', slot: !!slot, bare: !slot && value === 0 };
    };
    return { head: one('head', c?.head), body: one('body', c?.bodyArmor) };
  }

  // After a purchase: every new armor piece goes onto a bare location (body first). Nothing worn is ever replaced.
  // -> { worn:[{location,name,sp}], kept:[name], bare:['head'|'body'], lines:[text] } or null when no armor was bought.
  function wearBought(c, created, lang) {
    const ET = tools(), ids = (Array.isArray(created) ? created : []).filter(x => x && x.kind === 'item').map(x => x.id);
    const worn = [], kept = [];
    let any = false;
    for (const id of ids) {
      const hit = find(c, 'items', id), item = hit && catalogItem(hit.record.catalogId);
      if (!item || item.category !== 'armor' || !Number.isSafeInteger(item.stats?.sp)) continue;
      any = true;
      const name = item.name?.[L(lang)] || hit.record.name, before = worn.length;
      if (!ET?.equip) { kept.push(name); continue; }
      if (item.id === 'armor-bodyweight-suit') {
        const now = armorState(c, lang);
        if (now.head.bare && now.body.bare && ET.equip(c, id, 'both', L(lang), true).ok) worn.push({ location: 'both', name, sp: item.stats.sp });
      } else {
        for (let piece = 0; piece < amount('items', hit.record); piece++) {
          const now = armorState(c, lang), where = now.body.bare ? 'body' : now.head.bare ? 'head' : null;
          if (!where || !ET.equip(c, id, where, L(lang), true).ok) break;
          worn.push({ location: where, name, sp: item.stats.sp });
        }
      }
      if (worn.length === before) kept.push(name);
    }
    if (!any) return null;
    const after = armorState(c, lang), bare = ['head', 'body'].filter(k => after[k].bare);
    const lines = [
      ...worn.map(w => t(lang, 'wornLine', t(lang, w.location === 'both' ? 'onBoth' : w.location === 'head' ? 'onHead' : 'onBody'), w.name, w.sp)),
      ...kept.map(name => t(lang, 'keptOff', name)),
      ...bare.map(k => t(lang, k === 'head' ? 'bareHead' : 'bareBody'))
    ];
    return { worn, kept, bare, lines };
  }
  const receiptHTML = result => (result?.lines?.length ? `<div class="gf-receipt" data-gf-receipt>${result.lines.map((line, i) => `<p${i >= result.worn.length + result.kept.length ? ' class="gf-warn"' : ''}>${esc(line)}</p>`).join('')}</div>` : '');

  // Armor cards in the catalog say that a piece is for one location (the full-body suit already says it covers both).
  function annotateCatalog(catalog) {
    let n = 0;
    for (const item of Array.isArray(catalog) ? catalog : []) {
      if (!item || item.category !== 'armor' || !Number.isSafeInteger(item.stats?.sp) || item.id === 'armor-bodyweight-suit' || !isObject(item.details)) continue;
      for (const lang of ['ru', 'en']) {
        const note = T[lang].perLocation;
        if (typeof item.details[lang] === 'string' && !item.details[lang].includes(note)) { item.details[lang] += ' · ' + note; n++; }
      }
    }
    return n;
  }

  // ---------- 2. HTML for the sheet ----------

  const open = new Set();
  const isOpen = id => typeof id === 'string' && open.has(id);
  const attrs = (kind, record, index) => `data-gf-kind="${kind}" data-gf-index="${index}" data-gf-id="${esc(record?.id ?? '')}"`;

  // The right side of a collapsed inventory row: quantity, category and whether the thing is on the body.
  function rowMeta(c, record, lang) {
    const e = c?.extra?.equipment, cat = ['equipment', 'cyberware', 'armor', 'other'].includes(record?.category) ? record.category : 'equipment';
    const worn = isObject(e?.armor) && ['head', 'body'].some(k => e.armor[k]?.recordId === record?.id);
    const installed = record?.humanityLossIncluded === true || (Array.isArray(e?.installs) && e.installs.some(i => i && i.recordId === record?.id && !i.removedAt));
    return `<span class="gf-meta">${worn ? `<span class="gf-tag gf-on">${esc(t(lang, 'worn'))}</span>` : ''}${installed ? `<span class="gf-tag gf-on">${esc(t(lang, 'installedTag'))}</span>` : ''}<span class="gf-tag" data-gf-cat>${esc(T[L(lang)].cat[cat])}</span><span class="gf-qty" data-gf-qty>× ${esc(record?.quantity ?? 1)}</span></span>`;
  }
  const button = (action, label, kind, record, index, cls = '') => `<button type="button" class="cx-button${cls}" data-gf-action="${action}" ${attrs(kind, record, index)}>${esc(label)}</button>`;
  const removeButton = (kind, record, index, lang) => button('remove', '✕ ' + t(lang, 'remove'), kind, record, index, ' gf-remove');
  const tradeButtons = (kind, record, index, lang) => button('sell', t(lang, 'sell'), kind, record, index) + button('give', t(lang, 'give'), kind, record, index);
  const rowActions = (kind, record, index, lang) => `<div class="cx-entry-actions gf-actions">${tradeButtons(kind, record, index, lang)}${removeButton(kind, record, index, lang)}</div>`;
  const weaponActions = (record, index, lang) => `<div class="cx-entry-actions gf-actions">${tradeButtons('weapons', record, index, lang)}</div>`;

  // One line above the inventory: what protects the head and the body right now, and the way to the armor block.
  function armorStrip(c, lang) {
    const s = armorState(c, lang), part = (key, label) => `<span class="${s[key].bare ? 'gf-bare' : ''}">${esc(label)}: <b>SP ${s[key].sp}</b>${s[key].name ? ' · ' + esc(s[key].name) : ''}</span>`;
    return `<div class="gf-armor-strip" data-gf-armor><strong>${esc(t(lang, 'armor'))}</strong>${part('head', t(lang, 'head'))}${part('body', t(lang, 'body'))}<button type="button" class="btn ghost small" data-hud-jump="sheet-equipment">${esc(t(lang, 'armorJump'))} →</button></div>`;
  }

  function panelHTML(mode, kind, record, index, lang, others) {
    const name = displayName(record, lang), max = amount(kind, record), q = sellQuote(record, kind, max > 1 ? 1 : max);
    const count = max > 1 ? `<label class="field">${esc(t(lang, 'count'))}<input type="number" inputmode="numeric" min="1" max="${max}" step="1" value="${mode === 'give' ? max : 1}" data-gf-count></label>` : '';
    const head = `<div class="gf-panel" data-gf-panel="${mode}" ${attrs(kind, record, index)} role="group" aria-label="${esc(t(lang, mode === 'sell' ? 'sellTitle' : 'giveTitle', name))}"><strong>${esc(t(lang, mode === 'sell' ? 'sellTitle' : 'giveTitle', name))}</strong>`;
    const close = `<button type="button" class="cx-button" data-gf-action="panel-close">${esc(t(lang, 'cancel'))}</button>`;
    if (mode === 'sell') {
      return `${head}<div class="gf-fields">${count}<label class="field">${esc(t(lang, 'price'))}<input type="number" inputmode="numeric" min="0" max="999999999" step="1" value="${q.price}" data-gf-price data-gf-unit="${q.unit}"></label></div><p class="cx-help">${esc(t(lang, 'priceHint', Math.round(q.unit * 100) / 100))}</p><div class="cx-entry-actions"><button type="button" class="cx-button gf-go" data-gf-action="sell-confirm">${esc(t(lang, 'sell'))}</button>${close}</div></div>`;
    }
    if (!others.length) return `${head}<p class="cx-help">${esc(t(lang, 'noOthers'))}</p><div class="cx-entry-actions">${close}</div></div>`;
    return `${head}<div class="gf-fields"><label class="field">${esc(t(lang, 'to'))}<select data-gf-to>${others.map(o => `<option value="${esc(o.id)}">${esc(String(o.name || '').trim() || t(lang, 'noName'))}</option>`).join('')}</select></label>${count}</div><div class="cx-entry-actions"><button type="button" class="cx-button gf-go" data-gf-action="give-confirm">${esc(t(lang, 'give'))}</button>${close}</div></div>`;
  }

  // ---------- 3. Page wiring ----------

  const app = () => global.App;
  const lang = () => (app()?.lang?.() === 'en' ? 'en' : 'ru');
  function say(message) { if (message) app()?.notify?.(message); }
  function target(el) {
    const c = app()?.active?.(), kind = el?.dataset?.gfKind, rows = c && list(c, kind), index = Number(el?.dataset?.gfIndex), record = rows && Number.isInteger(index) ? rows[index] : null;
    if (!c || !isObject(record) || String(record.id ?? '') !== String(el.dataset.gfId ?? '') || !record.id) return null;
    return { c, kind, record, index };
  }
  function commit(result) {
    const A = app();
    if (result?.ok) { A?.save?.(); A?.render?.(); }
    return result;
  }
  function onClick(e) {
    const el = e.target?.closest?.('[data-gf-action]');
    if (!el || !global.document.querySelector('#app')?.contains(el)) return;
    const action = el.dataset.gfAction, l = lang(), A = app();
    if (action === 'panel-close') { el.closest('[data-gf-panel]')?.remove(); return; }
    if (action === 'remove') {
      const at = target(el);
      if (!at) { say(t(l, 'stale')); A?.render?.(); return; }
      const r = commit(remove(at.c, at.kind, at.record.id, l));
      if (!r.ok) { say(r.message); return; }
      open.delete(at.record.id);
      const back = () => {
        const c = A?.getState?.()?.characters?.find?.(x => x && x.id === r.undo.characterId), again = c ? restore(c, r.undo, lang()) : fail(lang(), 'stale');
        commit(again); say(again.message);
      };
      if (typeof A?.notifyAction === 'function') A.notifyAction(r.message, t(l, 'undo'), back); else say(r.message);
      return;
    }
    if (action === 'sell' || action === 'give') {
      const at = target(el), host = el.closest('.cx-entry');
      if (!at || !host) { say(t(l, 'stale')); A?.render?.(); return; }
      if (at.record.humanityLossIncluded === true) { say(t(l, 'installed')); return; }
      const shown = host.querySelector('[data-gf-panel]'), same = shown?.dataset.gfPanel === action;
      shown?.remove();
      if (same) return;
      const others = action === 'give' ? (A?.getState?.()?.characters || []).filter(x => x && x.id && x.id !== at.c.id) : [];
      el.closest('.gf-actions')?.insertAdjacentHTML('afterend', panelHTML(action, at.kind, at.record, at.index, l, others));
      host.querySelector('[data-gf-panel] input, [data-gf-panel] select')?.focus?.();
      return;
    }
    if (action === 'sell-confirm' || action === 'give-confirm') {
      const panel = el.closest('[data-gf-panel]'), at = target(panel);
      if (!at) { say(t(l, 'stale')); A?.render?.(); return; }
      const field = panel.querySelector('[data-gf-count]'), count = field ? (field.value.trim() === '' ? NaN : Number(field.value)) : amount(at.kind, at.record);
      let r;
      if (action === 'sell-confirm') {
        const raw = panel.querySelector('[data-gf-price]')?.value ?? '';
        r = sell(at.c, at.kind, at.record.id, count, raw.trim() === '' ? NaN : Number(raw), l);
      } else {
        const to = (A?.getState?.()?.characters || []).find(x => x && x.id === panel.querySelector('[data-gf-to]')?.value);
        r = to ? give(at.c, to, at.kind, at.record.id, count, l) : fail(l, 'stale');
      }
      if (r.ok && amount(at.kind, at.record) === count) open.delete(at.record.id);
      commit(r); say(r.message);
    }
  }
  function onInput(e) {
    const el = e.target;
    if (!el?.dataset) return;
    // The price follows the quantity until the player types a price of their own.
    if (el.dataset.gfPrice !== undefined) { el.dataset.gfTouched = '1'; return; }
    if (el.dataset.gfCount !== undefined) {
      const price = el.closest('[data-gf-panel]')?.querySelector('[data-gf-price]');
      if (price && !price.dataset.gfTouched) price.value = String(Math.round(Number(price.dataset.gfUnit) * Math.max(0, whole(el.value))));
      return;
    }
    // Keep the collapsed row's quantity and category in step with the form inside it.
    if (el.dataset.cxList === 'items' && ['quantity', 'category'].includes(el.dataset.cxKey)) {
      const row = el.closest('.cx-item');
      if (el.dataset.cxKey === 'quantity') { const qty = row?.querySelector('[data-gf-qty]'); if (qty) qty.textContent = '× ' + el.value; }
      else { const cat = row?.querySelector('[data-gf-cat]'); if (cat) cat.textContent = T[lang()].cat[el.value] || el.value; }
    }
  }
  // A row stays open across redraws of the sheet (a quantity change redraws it).
  function onToggle(e) {
    const el = e.target, id = el?.dataset?.gfRow;
    if (!id || !el.matches?.('details')) return;
    if (el.open) open.add(id); else open.delete(id);
  }

  try { annotateCatalog(global.CATALOG); } catch { /* the catalog is optional here */ }
  const doc = global.document;
  if (doc?.addEventListener) {
    doc.addEventListener('click', onClick);
    doc.addEventListener('input', onInput);
    doc.addEventListener('change', onInput);
    doc.addEventListener('toggle', onToggle, true);
  }

  global.GearFlow = {
    unitPrice, sellQuote, sell, give, remove, restore, armorState, wearBought, receiptHTML, annotateCatalog, displayName,
    isOpen, rowMeta, rowActions, removeButton, weaponActions, armorStrip, panelHTML
  };
})(window);
