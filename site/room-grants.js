/* Grants: in an online room the Game Master sends damage, healing, money, IP or an item to a player's sheet.

   The message only describes what is offered. Nothing changes until the player presses «Применить» on their own
   device, where the offer is shown first; the player's sheet then does its own bookkeeping (armor through the sheet's
   damage rules, money through Wallet with a ledger entry, IP through the IP log, the item through the inventory).
   room.js accepts the message only from the Game Master this page trusts (signed with the key of the room link), only
   when it is fresh and addressed to this member; everything in it is rebuilt here from known fields and clamped.
   Players cannot send grants: Room.grantLink.send refuses on any device that is not the Game Master. */
(function (global) {
  'use strict';

  const KINDS = ['damage', 'heal', 'cash', 'ip', 'item'], VIA = ['armor', 'melee', 'direct'], LOCS = ['body', 'head'];
  const LIMIT = { damage: 999, heal: 999, cash: 1000000, ip: 9999, item: 99 };
  const STORE = 'nightcity-red-room-grants', MAX_PENDING = 12, MAX_DONE = 60, GID = /^[0-9a-f]{16}$/;

  const T = {
    ru: {
      kind: { damage: 'Урон', heal: 'Лечение', cash: 'Деньги', ip: 'IP', item: 'Предмет' },
      loc: { body: 'тело', head: 'голова' }, via: { armor: 'через броню', melee: 'ближний бой, половина брони', direct: 'напрямую в HP' },
      locField: 'Куда', viaField: 'Как считать', amount: 'Сколько', itemName: 'Название предмета', qty: 'Количество', note: 'Пояснение (необязательно)',
      take: 'Списать, а не выдать', give: 'Выдать: урон, деньги, IP…', giveAll: 'Выдать всем игрокам', toOne: 'Выдать игроку', toAll: 'Выдать всем игрокам', send: 'Отправить', cancel: 'Отмена',
      hint: 'Игрок увидит предложение и сам нажмёт «Применить» — после этого его лист всё посчитает.',
      badAmount: 'Введите целое число больше нуля.', badName: 'Введите название предмета.', nobody: 'В комнате нет игроков с персонажем.',
      sent: 'Отправлено', notSent: 'Не отправлено: нет связи с комнатой.', fromGM: 'От ведущего', gm: 'Ведущий', offers: 'От ведущего',
      apply: 'Применить', decline: 'Отклонить', applied: 'Применено', declined: 'отклонил(а)', accepted: 'применил(а)',
      becomes: 'станет', short: 'Не хватает {n} eb: списать нельзя.', max: 'Сумма больше, чем помещается в кошелёк.',
      noChar: 'Этого персонажа нет на устройстве. Выберите его в комнате и попросите ведущего отправить ещё раз.',
      manual: 'Автоматически посчитать не удалось. Внесите урон сами: лист → «Полученный урон».',
      full: 'HP уже полные.', blocked: 'Броня остановила урон.', deathPenalty: 'Штраф Death Save', crit: 'Смертельно раненый получил урон от атаки: +5 урона и критическое ранение — запишите его отдельно.',
      spHead: 'SP головы', spBody: 'SP тела', count: 'Ждут ответа', item: 'Предмет', inInventory: 'добавится в снаряжение', unsupported: 'Лист не поддерживает это изменение.',
    },
    en: {
      kind: { damage: 'Damage', heal: 'Healing', cash: 'Money', ip: 'IP', item: 'Item' },
      loc: { body: 'body', head: 'head' }, via: { armor: 'through armor', melee: 'melee, half armor', direct: 'straight to HP' },
      locField: 'Where', viaField: 'How to count', amount: 'How much', itemName: 'Item name', qty: 'Quantity', note: 'Note (optional)',
      take: 'Take away instead of giving', give: 'Give: damage, money, IP…', giveAll: 'Give to all players', toOne: 'Give to player', toAll: 'Give to all players', send: 'Send', cancel: 'Cancel',
      hint: 'The player sees the offer and presses “Apply” — their sheet then does the maths.',
      badAmount: 'Enter a whole number above zero.', badName: 'Enter the item name.', nobody: 'No players with a character are in the room.',
      sent: 'Sent', notSent: 'Not sent: no connection to the room.', fromGM: 'From the GM', gm: 'GM', offers: 'From the GM',
      apply: 'Apply', decline: 'Decline', applied: 'Applied', declined: 'declined', accepted: 'applied',
      becomes: 'new total', short: 'Short by {n} eb: cannot take it.', max: 'The sum is more than the wallet can hold.',
      noChar: 'This character is not on this device. Choose it in the room and ask the GM to send again.',
      manual: 'Could not work it out automatically. Enter the damage yourself: sheet → “Damage taken”.',
      full: 'HP is already full.', blocked: 'Armor stopped the damage.', deathPenalty: 'Death Save penalty', crit: 'A Mortally Wounded character took attack damage: +5 damage and a Critical Injury — record it separately.',
      spHead: 'Head SP', spBody: 'Body SP', count: 'Waiting', item: 'Item', inInventory: 'goes to gear', unsupported: 'The sheet does not support this change.',
    },
  };
  const tx = lang => T[lang === 'en' ? 'en' : 'ru'];
  const esc = x => String(x ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const text = (v, n) => (typeof v === 'string' ? v : '').replace(/[\u0000-\u001f\u007f]/g, ' ').trim().slice(0, n);
  const whole = v => (typeof v === 'number' && Number.isSafeInteger(v) ? v : typeof v === 'string' && /^-?\d{1,9}$/.test(v.trim()) ? Number(v.trim()) : null);
  const obj = v => !!v && typeof v === 'object' && !Array.isArray(v);
  const money = n => (global.Wallet?.format ? global.Wallet.format(n) : String(n));
  const hpMax = c => 10 + 5 * Math.ceil(((Number(c?.stats?.BODY) || 0) + (Number(c?.stats?.WILL) || 0)) / 2);

  /* ---------- Pure part ---------- */

  // Whatever arrived (or was typed by the GM) is rebuilt from known fields; anything out of range is refused, not trimmed.
  function clean(d) {
    if (!obj(d) || !KINDS.includes(d.kind) || typeof d.gid !== 'string' || !GID.test(d.gid)) return null;
    const n = whole(d.n), cid = text(d.cid, 60);
    if (n === null || !cid || cid !== d.cid) return null;
    const max = LIMIT[d.kind];
    if (d.kind === 'cash' ? n === 0 || Math.abs(n) > max : n < 1 || n > max) return null;
    const g = { gid: d.gid, kind: d.kind, n, cid, note: text(d.note, 120) };
    if (d.kind === 'damage') {
      if (!LOCS.includes(d.loc) || !VIA.includes(d.via)) return null;
      g.loc = d.loc; g.via = d.via;
    }
    if (d.kind === 'item') { g.name = text(d.name, 100); if (!g.name) return null; }
    return g;
  }

  // One line that names the offer: «Урон 14 · тело · через броню».
  function describe(g, lang) {
    const t = tx(lang);
    if (g.kind === 'damage') return `${t.kind.damage} ${g.n} · ${t.loc[g.loc]} · ${t.via[g.via]}`;
    if (g.kind === 'heal') return `${t.kind.heal} +${g.n} HP`;
    if (g.kind === 'cash') return `${t.kind.cash} ${g.n > 0 ? '+' : '−'}${money(Math.abs(g.n))} eb`;
    if (g.kind === 'ip') return `+${g.n} IP`;
    return `${t.kind.item}: ${g.name}${g.n > 1 ? ' × ' + g.n : ''}`;
  }

  function damageQuote(c, g) {
    const DA = global.DamageApply; if (!DA?.quote || !DA.armorClone) return null;
    const hp = whole(c.hp); if (hp === null) return null;
    const type = g.via === 'direct' ? 'direct' : g.via === 'melee' ? 'melee' : 'standard';
    let q = null;
    try { q = DA.quote(c, { type, location: g.loc, raw: g.n, critical: false, ...(hp < 1 ? { source: type === 'direct' ? 'other' : 'attack' } : {}) }); } catch { q = null; }
    if (!q) return null;
    let copy = null; try { copy = DA.armorClone(c, q); } catch { copy = null; }
    return copy ? { q, copy } : null;
  }
  const ipBalance = c => { try { return global.CharacterExtra?.ipBalance?.(c) ?? null; } catch { return null; } };

  // What pressing «Применить» would do, in words. Never changes the character.
  function preview(c, g, lang) {
    const t = tx(lang);
    if (!obj(c) || (c.extra !== undefined && !obj(c.extra))) return { ok: false, why: t.unsupported };
    if (g.kind === 'damage') {
      const r = damageQuote(c, g); if (!r) return { ok: false, why: t.manual };
      const q = r.q, lines = [`HP ${q.hp} → ${Math.max(0, q.hpAfter)}`];
      if (q.type !== 'direct' && q.spAfter !== q.sp) lines.push(`${g.loc === 'head' ? t.spHead : t.spBody} ${q.sp} → ${q.spAfter}`);
      if (q.type !== 'direct' && q.damage === 0) lines.push(t.blocked);
      if (q.mortalAttack) lines.push(`${t.deathPenalty} ${q.penaltyBefore} → ${q.penaltyAfter}`);
      if (q.forcedCritical) lines.push(t.crit);
      return { ok: true, lines };
    }
    if (g.kind === 'heal') {
      const hp = whole(c.hp), max = hpMax(c); if (hp === null) return { ok: false, why: t.unsupported };
      if (hp >= max) return { ok: false, why: t.full };
      return { ok: true, lines: [`HP ${hp} → ${Math.min(max, hp + g.n)}`] };
    }
    if (g.kind === 'cash') {
      const W = global.Wallet; if (!W) return { ok: false, why: t.unsupported };
      const r = g.n > 0 ? W.earn(c, g.n, '') : W.spend(c, -g.n, '');
      if (!r.ok) return { ok: false, why: r.reason === 'short' ? t.short.replace('{n}', money(r.short)) : r.reason === 'max' ? t.max : t.unsupported };
      return { ok: true, lines: [`${money(W.cash(c))} → ${money(r.balance)} eb`] };
    }
    if (g.kind === 'ip') {
      if (c.extra?.ipLog !== undefined && !Array.isArray(c.extra.ipLog)) return { ok: false, why: t.unsupported };
      const now = ipBalance(c);
      return { ok: true, lines: now === null ? [] : [`IP ${now} → ${now + g.n}`] };
    }
    if (c.extra?.items !== undefined && !Array.isArray(c.extra.items)) return { ok: false, why: t.unsupported };
    return { ok: true, lines: [t.inInventory] };
  }

  // Applies the offer to the character the way the sheet's own tools do. -> { ok, text } | { ok:false, why }
  function apply(c, g, lang, options) {
    const t = tx(lang), seen = preview(c, g, lang);
    if (!seen.ok) return seen;
    const note = `${t.fromGM}${g.note ? ': ' + g.note : ''}`.slice(0, 120);
    if (g.kind === 'damage') {
      const r = damageQuote(c, g); if (!r) return { ok: false, why: t.manual };
      const q = r.q, copy = r.copy;
      c.hp = Math.max(0, q.hpAfter);
      if (q.mortalAttack) { if (!c.extra) c.extra = {}; c.extra.deathPenalty = q.penaltyAfter; }
      if (q.resetStabilization && obj(c.extra?.medical)) c.extra.medical = { ...c.extra.medical, stabilized: false };
      if (q.spAfter !== q.sp && q.type !== 'direct') {
        if (q.location === 'head') c.head = copy.head; else c.bodyArmor = copy.bodyArmor;
        if (copy.extra?.equipment !== undefined && c.extra) c.extra.equipment = copy.extra.equipment;
      }
    } else if (g.kind === 'heal') {
      c.hp = Math.min(hpMax(c), whole(c.hp) + g.n);
    } else if (g.kind === 'cash') {
      const W = global.Wallet, r = g.n > 0 ? W.earn(c, g.n, note, options) : W.spend(c, -g.n, note, options);
      if (!r.ok) return { ok: false, why: t.unsupported };
      c.extra = r.extra;
    } else if (g.kind === 'ip') {
      if (!c.extra) c.extra = {};
      if (!Array.isArray(c.extra.ipLog)) c.extra.ipLog = [];
      c.extra.ipLog.push({ id: 'g' + g.gid, date: String(options?.at || new Date().toISOString()).slice(0, 10), reason: note, delta: g.n });
    } else {
      const item = { name: g.name, category: 'equipment', quantity: g.n, notes: note };
      let done = false;
      try { done = !!global.CharacterExtra?.addItem?.(c, item); } catch { done = false; }
      if (!done) { if (!c.extra) c.extra = {}; if (!Array.isArray(c.extra.items)) c.extra.items = []; c.extra.items.push({ id: 'g' + g.gid, ...item }); }
    }
    return { ok: true, text: [describe(g, lang), ...seen.lines].join(' · ') };
  }

  // What the GM's form holds, as a grant for one player; null with the reason when it cannot be sent.
  function fromForm(v, cid, gid, lang) {
    const t = tx(lang), kind = KINDS.includes(v.kind) ? v.kind : 'damage';
    let n = whole(String(v.n ?? '').trim());
    if (n === null || n < 1 || n > LIMIT[kind]) return { error: t.badAmount };
    if (kind === 'cash' && v.take) n = -n;
    const g = clean({ gid, kind, n, cid, note: text(String(v.note ?? ''), 120), loc: v.loc, via: v.via, name: text(String(v.name ?? ''), 100) });
    if (!g) return { error: kind === 'item' ? t.badName : t.badAmount };
    return { grant: g };
  }

  /* ---------- Page part ---------- */
  const doc = global.document;
  const lang = () => { try { return global.App?.lang?.() === 'en' ? 'en' : 'ru'; } catch { return 'ru'; } };
  const link = () => global.Room?.grantLink || null;
  const notify = m => { try { global.App?.notify?.(m); } catch {} };
  const hex = n => { const a = new Uint8Array(n); global.crypto.getRandomValues(a); return Array.from(a, x => x.toString(16).padStart(2, '0')).join(''); };
  let pending = [], done = [], roomCode = '';
  // Offers the Game Master sent, kept for this tab so a reload does not lose the player's answer.
  const SENT = 'nightcity-red-room-sent';
  const saveSent = () => { try { if (roomCode && sentTo.size) global.sessionStorage.setItem(SENT, JSON.stringify({ code: roomCode, sent: [...sentTo].slice(-200) })); else global.sessionStorage.removeItem(SENT); } catch {} };
  class SentMap extends Map { set(k, v) { super.set(k, v); saveSent(); return this; } delete(k) { const r = super.delete(k); saveSent(); return r; } }
  const sentTo = new SentMap();

  function load(code) {
    pending = []; done = []; roomCode = code || '';
    Map.prototype.clear.call(sentTo);
    if (!roomCode) return;
    try {
      const r = JSON.parse(global.sessionStorage.getItem(SENT) || 'null');
      if (obj(r) && r.code === roomCode && Array.isArray(r.sent)) for (const e of r.sent.slice(-200)) if (Array.isArray(e) && typeof e[0] === 'string' && GID.test(e[0]) && obj(e[1]) && typeof e[1].to === 'string') Map.prototype.set.call(sentTo, e[0], { to: e[1].to.slice(0, 80), name: String(e[1].name || '').slice(0, 80), character: String(e[1].character || '').slice(0, 80) });
    } catch {}
    try {
      const s = JSON.parse(global.localStorage.getItem(STORE) || 'null');
      if (!obj(s) || s.code !== roomCode) return;
      done = (Array.isArray(s.done) ? s.done : []).filter(x => typeof x === 'string' && GID.test(x)).slice(0, MAX_DONE);
      for (const p of Array.isArray(s.pending) ? s.pending.slice(0, MAX_PENDING) : []) { const g = clean(p); if (g && !done.includes(g.gid)) pending.push({ ...g, gm: text(p.gm, 40), from: text(p.from, 40), at: whole(p.at) || 0 }); }
    } catch {}
  }
  function store() { try { if (roomCode && (pending.length || done.length)) global.localStorage.setItem(STORE, JSON.stringify({ code: roomCode, pending, done })); else global.localStorage.removeItem(STORE); } catch {} }
  // The list follows the room this page is in: a new room starts empty, the same room after a reload keeps what was not answered.
  function sync() { const code = link()?.who?.()?.code || ''; if (code !== roomCode) { load(code); if (!code) store(); } }

  // Called by room.js for a message it has already checked: from the trusted Game Master, fresh, addressed to this member.
  function receive(d, meta) {
    sync(); if (!roomCode) return false;
    const g = clean(d); if (!g || done.includes(g.gid) || pending.some(p => p.gid === g.gid)) return false;
    pending = [{ ...g, gm: text(meta?.gm, 40), from: text(meta?.from, 40), at: Date.now() }, ...pending].slice(0, MAX_PENDING);
    store(); paint();
    try { if (global.localStorage?.getItem('nc-haptics') !== 'off') global.navigator?.vibrate?.(80); } catch {}
    return true;
  }
  function settle(p, state, summary) {
    pending = pending.filter(x => x !== p); done = [p.gid, ...done].slice(0, MAX_DONE); store(); paint();
    if (p.from) link()?.reply?.(p.from, { gid: p.gid, state, text: text(summary, 200) });
  }
  const characterFor = p => { try { return global.App?.getState?.()?.characters?.find(c => c?.id === p.cid) || null; } catch { return null; } };
  function answer(gid, yes) {
    const p = pending.find(x => x.gid === gid); if (!p) return;
    const l = lang(), t = tx(l);
    if (!yes) { settle(p, 'declined', describe(p, l)); return; }
    const c = characterFor(p); if (!c) { notify(t.noChar); return; }
    let r; try { r = apply(c, p, l); } catch { r = { ok: false, why: t.unsupported }; }
    if (!r.ok) { notify(r.why); paint(); return; }
    try { global.App.save(); global.App.render(); } catch {}
    try { global.Room?.changed?.(); } catch {}
    notify(`${t.applied}: ${r.text}`);
    settle(p, 'applied', r.text);
  }

  function trayHTML() {
    const l = lang(), t = tx(l);
    return `<div class="rg-tray-head"><b>${esc(t.offers)}</b><span>${pending.length}</span></div>${pending.map(p => {
      const c = characterFor(p), seen = c ? preview(c, p, l) : { ok: false, why: t.noChar };
      return `<article class="rg-offer" data-kind="${p.kind}"><strong>${esc(describe(p, l))}</strong><small>${esc(p.gm || t.gm)}${c ? ' → ' + esc(c.name || '—') : ''}${p.note ? ' · ' + esc(p.note) : ''}</small><p class="${seen.ok ? '' : 'rg-warn'}">${esc(seen.ok ? seen.lines.join(' · ') : seen.why)}</p><div class="rg-offer-actions"><button type="button" class="btn primary" data-rg-apply="${p.gid}"${seen.ok ? '' : ' disabled'}>${esc(t.apply)}</button><button type="button" class="btn ghost" data-rg-decline="${p.gid}">${esc(t.decline)}</button></div></article>`;
    }).join('')}`;
  }
  function paint() {
    if (!doc?.body) return;
    let box = doc.querySelector('.rg-tray');
    if (!pending.length) { box?.remove(); return; }
    if (!box) { box = doc.createElement('section'); box.className = 'rg-tray'; box.setAttribute('aria-live', 'polite'); box.setAttribute('aria-label', tx(lang()).offers); doc.body.appendChild(box); }
    box.innerHTML = trayHTML();
  }

  /* The Game Master's side */
  function targets() { try { return link()?.targets?.() || []; } catch { return []; } }
  const giveButton = (id, cls) => `<button type="button" class="${cls || 'btn primary rg-give'}" data-rg-open="${esc(id)}">${esc(tx(lang()).give)}</button>`;
  // On a member's card on the room page (room.js calls this for the Game Master only).
  function memberButton(id) { return targets().some(x => x.id === id) ? giveButton(id) : ''; }
  function teamButton() { return targets().length > 1 ? `<button type="button" class="btn ghost rg-give" data-rg-open="all">${esc(tx(lang()).giveAll)}</button>` : ''; }
  // In the campaign tracker, next to a character whose player is in the room.
  // For the GM's tracker and party reward: send one grant to the player who owns this sheet, without the dialog.
  // -> { ok:true, text, character } | { ok:false, error? }. The player's device applies it; the GM's copy is not touched.
  function sendTo(memberId, v, l, hooks) {
    try {
      const L = link(), m = L?.targets?.().find(x => x.id === memberId); if (!m) return { ok: false };
      const lg = l === 'en' ? 'en' : l === 'ru' ? 'ru' : lang(), r = fromForm(v, m.cid, hex(8), lg); if (r.error) return { ok: false, error: r.error };
      sentTo.set(r.grant.gid, { to: m.id, name: m.name, character: m.character, declined: typeof hooks?.declined === 'function' ? hooks.declined : null });
      if (sentTo.size > 200) for (const k of [...sentTo.keys()].slice(0, 100)) sentTo.delete(k);
      Promise.resolve(L.send(m.id, r.grant)).then(sent => { if (!sent) { sentTo.delete(r.grant.gid); notify(tx(lg).notSent); } }, () => { sentTo.delete(r.grant.gid); });
      return { ok: true, text: describe(r.grant, lg), character: m.character };
    } catch { return { ok: false }; }
  }
  function trackerButton(character) { try { const id = link()?.memberFor?.(character); return id ? giveButton(id, 'btn ghost camp-open rg-give') : ''; } catch { return ''; } }

  function dialogHTML(list, l) {
    const t = tx(l), one = list.length === 1 ? list[0] : null;
    const title = one ? `${t.toOne}: ${one.character || '—'} (${one.name})` : `${t.toAll} (${list.length})`;
    return `<form method="dialog" class="rg-form"><h2>${esc(title)}</h2><p class="rg-hint">${esc(t.hint)}</p>
<div class="rg-kinds" role="radiogroup">${KINDS.map((k, i) => `<label><input type="radio" name="kind" value="${k}"${i ? '' : ' checked'}><span>${esc(t.kind[k])}</span></label>`).join('')}</div>
<label class="field" data-rg-for="item">${esc(t.itemName)}<input name="name" maxlength="100" autocomplete="off"></label>
<label class="field"><span data-rg-for="damage heal cash ip">${esc(t.amount)}</span><span data-rg-for="item">${esc(t.qty)}</span><input name="n" type="number" inputmode="numeric" min="1" max="1000000" step="1" required></label>
<label class="field" data-rg-for="damage">${esc(t.locField)}<select name="loc">${LOCS.map(x => `<option value="${x}">${esc(t.loc[x])}</option>`).join('')}</select></label>
<label class="field" data-rg-for="damage">${esc(t.viaField)}<select name="via">${VIA.map(x => `<option value="${x}">${esc(t.via[x])}</option>`).join('')}</select></label>
<label class="room-check" data-rg-for="cash"><input type="checkbox" name="take"> ${esc(t.take)}</label>
<label class="field">${esc(t.note)}<input name="note" maxlength="120" autocomplete="off"></label>
<p class="rg-error" role="alert"></p>
<div class="dialog-actions"><button type="button" class="btn ghost" data-rg-close>${esc(t.cancel)}</button><button type="submit" class="btn primary">${esc(t.send)}</button></div></form>`;
  }
  function showKind(dlg) {
    const kind = dlg.querySelector('input[name="kind"]:checked')?.value || 'damage';
    for (const el of dlg.querySelectorAll('[data-rg-for]')) el.hidden = !el.dataset.rgFor.split(' ').includes(kind);
    const n = dlg.querySelector('input[name="n"]'); if (n) n.max = String(LIMIT[kind]);
  }
  function openDialog(who) {
    const l = lang(), t = tx(l), all = targets(), list = who === 'all' ? all : all.filter(x => x.id === who);
    if (!list.length) { notify(t.nobody); return; }
    doc.querySelector('dialog.rg-dialog')?.remove();
    const dlg = doc.createElement('dialog'); dlg.className = 'share-import rg-dialog'; dlg.innerHTML = dialogHTML(list, l);
    doc.body.appendChild(dlg); showKind(dlg);
    dlg.addEventListener('change', e => { if (e.target?.name === 'kind') showKind(dlg); });
    dlg.addEventListener('click', e => { if (e.target?.closest?.('[data-rg-close]')) dlg.close(); });
    dlg.addEventListener('close', () => dlg.remove());
    dlg.querySelector('form').addEventListener('submit', async e => {
      e.preventDefault();
      const f = e.target, v = { kind: f.querySelector('input[name="kind"]:checked')?.value, n: f.elements.n.value, loc: f.elements.loc.value, via: f.elements.via.value, name: f.elements.name.value, note: f.elements.note.value, take: f.elements.take.checked };
      const made = list.map(x => ({ x, r: fromForm(v, x.cid, hex(8), l) })), bad = made.find(m => m.r.error);
      if (bad) { f.querySelector('.rg-error').textContent = bad.r.error; (v.kind === 'item' && !String(v.name).trim() ? f.elements.name : f.elements.n).focus(); return; }
      let ok = 0;
      for (const { x, r } of made) { const sent = await link()?.send?.(x.id, r.grant); if (sent) { ok++; sentTo.set(r.grant.gid, { to: x.id, name: x.name, character: x.character }); } }
      if (sentTo.size > 200) for (const k of [...sentTo.keys()].slice(0, 100)) sentTo.delete(k);
      notify(ok ? `${t.sent}: ${describe(made[0].r.grant, l)} → ${ok === 1 ? made.find(m => sentTo.has(m.r.grant.gid))?.x.character || made[0].x.name : ok}` : t.notSent);
      dlg.close();
    });
    if (typeof dlg.showModal === 'function') dlg.showModal(); else dlg.setAttribute('open', '');
    dlg.querySelector('input[name="n"]')?.focus();
  }
  // The player's answer, for the Game Master: only from the member the grant went to.
  function acked(d, meta) {
    const gid = typeof d?.gid === 'string' ? d.gid : '', s = sentTo.get(gid);
    if (!s || s.to !== meta?.from || !['applied', 'declined'].includes(d.state)) return false;
    sentTo.delete(gid);
    if (d.state === 'declined' && s.declined) { try { s.declined(); } catch { /* the notice below still goes out */ } }
    const t = tx(lang());
    notify(`${s.character || s.name} ${d.state === 'applied' ? t.accepted : t.declined}: ${text(d.text, 200)}`);
    return true;
  }

  if (doc?.addEventListener) {
    doc.addEventListener('click', e => {
      const b = e.target?.closest?.('[data-rg-open],[data-rg-apply],[data-rg-decline]'); if (!b) return;
      if (b.dataset.rgOpen) openDialog(b.dataset.rgOpen);
      else if (b.dataset.rgApply) answer(b.dataset.rgApply, true);
      else answer(b.dataset.rgDecline, false);
    });
  }

  global.RoomGrants = {
    KINDS, LIMIT, clean, describe, preview, apply, fromForm, hpMax,
    receive, acked, memberButton, teamButton, trackerButton, sendTo,
    // room.js calls this on every repaint: the tray follows the room (and the language) without its own timers.
    refresh() { const was = roomCode; sync(); if (was !== roomCode || pending.length || doc?.querySelector?.('.rg-tray')) paint(); },
    _test: { pending: () => pending, done: () => done, answer, sentTo, load, trayHTML, dialogHTML },
  };
})(window);
