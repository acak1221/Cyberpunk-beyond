// Downtime: the small things done between sessions, without retyping numbers by hand.
//  - «Начало сессии»: a chip in the sheet header that refills LUCK and clears the one-roll leftovers.
//  - Jump links at the top of the long «Персонаж» / «Жизнь» tab.
//  - A pay button for the medical page (hospital, therapy): the sum leaves the patient's cash through Wallet.
// The module keeps no data of its own: money is Wallet (wallet.js), LUCK is character.extra.luck.
// app.js calls handle() for clicks on [data-dt] and saves / re-renders the way it does for the other tools.
(function () {
  'use strict';

  const W = {
    ru: {
      session: 'Начало сессии', sessionHint: 'Начало сессии: восстановить LUCK и сбросить модификатор следующего броска',
      sessionDone: 'Начало сессии: LUCK', sessionMod: 'модификатор броска сброшен', sessionNothing: 'LUCK уже полная, сбрасывать нечего',
      undo: 'Отменить', sessionUndone: 'Начало сессии отменено: LUCK', stale: 'Данные изменились. Повторите действие.',
      nav: 'Быстрый переход по вкладке', money: 'Деньги', ip: 'Опыт (IP)', drugs: 'Вещества', hustle: 'Заработок', living: 'Жильё и образ жизни', story: 'История', notes: 'Заметки',
      cash: 'На счету', pay: 'Оплатить', payAgain: 'Оплатить ещё раз', short: 'Не хватает', paid: 'Списано', left: 'осталось', refund: 'Возврат', refunded: 'Платёж отменён, деньги возвращены',
      noCash: 'На листе не указаны деньги.', doctor: 'Материалы врача', failed: 'Платёж не выполнен, ничего не списано.',
    },
    en: {
      session: 'Start of session', sessionHint: 'Start of session: refill LUCK and clear the next-roll modifier',
      sessionDone: 'Start of session: LUCK', sessionMod: 'roll modifier cleared', sessionNothing: 'LUCK is already full, nothing to clear',
      undo: 'Undo', sessionUndone: 'Start of session undone: LUCK', stale: 'Data changed. Please retry.',
      nav: 'Jump within the tab', money: 'Cash', ip: 'Experience (IP)', drugs: 'Substances', hustle: 'Hustle', living: 'Lifestyle & housing', story: 'History', notes: 'Notes',
      cash: 'Cash of', pay: 'Pay', payAgain: 'Pay again', short: 'Short by', paid: 'Paid', left: 'left', refund: 'Refund', refunded: 'Payment reversed, the money is back',
      noCash: 'The sheet has no cash value.', doctor: "Doctor's materials", failed: 'The payment was not made and nothing was spent.',
    },
  };
  const words = lang => W[lang === 'en' ? 'en' : 'ru'];
  const esc = x => String(x ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const int = (value, min, max) => { const n = Math.trunc(Number(value)); return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : min; };
  const wallet = () => window.Wallet || null;
  const money = n => wallet()?.format ? wallet().format(n) : String(n);
  const cashOf = c => wallet()?.cash ? wallet().cash(c) : int(c?.extra?.cash, 0, 999999999);

  // ---- Start of session -------------------------------------------------------------------------------------------
  // LUCK comes back to the STAT; LUCK set aside for the next roll and a modifier that is not pinned are cleared.
  // Pure: -> { ok, extra, from, to, modifier, changed, before } and the character is not touched.
  function startSession(c) {
    if (!c || typeof c !== 'object') return { ok: false };
    const x = c.extra && typeof c.extra === 'object' && !Array.isArray(c.extra) ? c.extra : {};
    const to = int(c.stats?.LUCK, 0, 20), from = x.luck === undefined || x.luck === '' ? to : int(x.luck, 0, 20);
    const use = int(x.luckUse, 0, 20), mod = int(x.modifier, -100, 100), clearMod = mod !== 0 && x.modifierHold !== true;
    const before = { luck: x.luck, luckUse: x.luckUse, modifier: x.modifier };
    const extra = { ...x, luck: to, luckUse: 0 };
    if (clearMod) extra.modifier = 0;
    return { ok: true, extra, from, to, modifier: clearMod ? mod : 0, changed: from !== to || use !== 0 || clearMod, before };
  }
  // Puts back what startSession() changed. Pure as well.
  function undoSession(c, before) {
    const extra = { ...(c?.extra || {}) };
    for (const key of ['luck', 'luckUse', 'modifier']) { if (before?.[key] === undefined) delete extra[key]; else extra[key] = before[key]; }
    return extra;
  }

  let lastSession = null; // { id, before, luck, until } — the undo is offered for a short while
  const UNDO_MS = 20000;
  const canUndoSession = c => !!lastSession && !!c && lastSession.id === c.id && Date.now() < lastSession.until && int(c.extra?.luck, 0, 20) === lastSession.luck;

  function hudChip(c, lang) {
    if (!c) return '';
    const t = words(lang);
    if (canUndoSession(c)) return `<button type="button" class="hud-chip dt-session dt-session-undo" data-dt="session-undo"><span aria-hidden="true">↶</span><small>${esc(t.undo)}</small></button>`;
    return `<button type="button" class="hud-chip dt-session" data-dt="session" title="${esc(t.sessionHint)}" aria-label="${esc(t.sessionHint)}"><span aria-hidden="true">⟳</span><small>${esc(t.session)}</small></button>`;
  }

  // ---- Jump links -------------------------------------------------------------------------------------------------
  // The targets are section ids; sheet-tabs.js already knows which tab owns each one ([data-hud-jump]).
  const JUMPS = [['sheet-resources', 'money'], ['sheet-ip', 'ip'], ['sheet-hustle', 'hustle'], ['sheet-living', 'living'], ['sheet-drugs', 'drugs'], ['sheet-lifepath', 'story'], ['sheet-notes', 'notes']];
  function jumpNav(c, lang) {
    if (!c) return '';
    const t = words(lang);
    return `<nav class="dt-jump" aria-label="${esc(t.nav)}">${JUMPS.map(([id, key]) => `<button type="button" data-hud-jump="${id}">${esc(t[key])}${key === 'money' ? ` <b>${money(cashOf(c))} eb</b>` : ''}</button>`).join('')}</nav>`;
  }

  // ---- Paying from a sheet ----------------------------------------------------------------------------------------
  // payHTML() is called while a page renders; it remembers what the button stands for, so the click charges exactly
  // what was shown. `paid` keeps the last payment of each button for the undo.
  const offers = new Map(), paid = new Map();
  function payHTML(o) {
    const c = o?.character, amount = Math.floor(Number(o?.amount)), key = String(o?.key || '');
    if (!c || typeof c.id !== 'string' || !c.id || !key || !Number.isFinite(amount) || amount <= 0) { offers.delete(key); return ''; }
    const t = words(o.lang), have = cashOf(c), short = Math.max(0, amount - have), done = paid.get(key), mine = done && done.id === c.id ? done : null;
    offers.set(key, { id: c.id, amount, note: String(o.note || '').slice(0, 120) });
    const who = String(c.name || '—');
    return `<div class="dt-pay" data-dt-pay="${esc(key)}">` +
      `<p class="dt-pay-line">${o.role === 'doctor' ? `<span class="dt-pay-role">${esc(t.doctor)}: ${money(amount)} eb</span>` : ''}<span>${esc(t.cash)} ${esc(who)}: <b>${money(have)} eb</b></span>${short ? `<span class="dt-pay-short" role="status">${esc(t.short)} ${money(short)} eb</span>` : ''}</p>` +
      `<div class="dt-pay-actions"><button type="button" class="btn ${mine ? 'ghost' : 'primary'}" data-dt="pay" data-key="${esc(key)}"${short ? ' disabled' : ''}>${esc(mine ? t.payAgain : t.pay)} ${money(amount)} eb</button>` +
      (mine ? `<span class="dt-pay-done" role="status">✓ ${esc(t.paid)} ${money(mine.amount)} eb</span><button type="button" class="btn ghost" data-dt="pay-undo" data-key="${esc(key)}">${esc(t.undo)}</button>` : '') +
      `</div></div>`;
  }

  // -> { handled, dirty?, rerender?, notify? }. ctx: { lang, view, characters, active, isCurrent(character) }
  function handle(event, ctx) {
    const b = event?.type === 'click' ? event.target?.closest?.('[data-dt]') : null;
    if (!b) return { handled: false };
    const t = words(ctx?.lang), kind = b.dataset.dt;
    const current = c => { try { return !!c && typeof ctx.isCurrent === 'function' && ctx.isCurrent(c) === true; } catch { return false; } };
    const refreshLater = () => { try { setTimeout(() => window.SheetTabs?.refreshHud?.(), UNDO_MS + 200); } catch { /* no timers: the chip changes on the next render */ } };

    if (kind === 'session' || kind === 'session-undo') {
      const c = ctx?.active;
      if (ctx?.view !== 'sheet' || !current(c)) return { handled: true, notify: t.stale };
      if (kind === 'session-undo') {
        if (!canUndoSession(c)) { lastSession = null; return { handled: true, rerender: true, notify: t.stale }; }
        const was = int(c.extra?.luck, 0, 20);
        c.extra = undoSession(c, lastSession.before); lastSession = null;
        const now = c.extra.luck === undefined || c.extra.luck === '' ? int(c.stats?.LUCK, 0, 20) : int(c.extra.luck, 0, 20);
        return { handled: true, dirty: true, rerender: true, notify: `${t.sessionUndone} ${was} → ${now}.` };
      }
      const r = startSession(c);
      if (!r.ok) return { handled: true, notify: t.stale };
      if (!r.changed) return { handled: true, notify: `${t.sessionNothing} (${r.to} / ${r.to}).` };
      c.extra = r.extra;
      lastSession = { id: c.id, before: r.before, luck: r.to, until: Date.now() + UNDO_MS }; refreshLater();
      return { handled: true, dirty: true, rerender: true, notify: `${t.sessionDone} ${r.from} → ${r.to}${r.modifier ? ', ' + t.sessionMod : ''}.` };
    }

    if (kind === 'pay' || kind === 'pay-undo') {
      const key = String(b.dataset.key || ''), record = kind === 'pay' ? offers.get(key) : paid.get(key), Wl = wallet();
      const list = Array.isArray(ctx?.characters) ? ctx.characters.filter(x => x && x.id === record?.id) : [];
      const c = list.length === 1 ? list[0] : null;
      if (!record || !Wl || !current(c)) return { handled: true, rerender: true, notify: t.stale };
      if (kind === 'pay-undo') {
        const r = Wl.earn(c, record.amount, `${t.refund}: ${record.note}`);
        if (!r.ok) return { handled: true, notify: t.failed };
        c.extra = r.extra; paid.delete(key);
        return { handled: true, dirty: true, rerender: true, notify: `${t.refunded}: +${money(record.amount)} eb, ${t.left} ${money(r.balance)} eb.` };
      }
      const r = Wl.spend(c, record.amount, record.note);
      if (!r.ok) return { handled: true, rerender: true, notify: r.reason === 'short' ? `${t.short} ${money(r.short)} eb. ${t.failed}` : t.failed };
      c.extra = r.extra; paid.set(key, { ...record });
      return { handled: true, dirty: true, rerender: true, notify: `${t.paid} ${money(record.amount)} eb (${record.note}), ${t.left} ${money(r.balance)} eb.` };
    }
    return { handled: false };
  }

  window.Downtime = { startSession, undoSession, hudChip, jumpNav, payHTML, handle, JUMPS, reset() { offers.clear(); paid.clear(); lastSession = null; } };
})();
