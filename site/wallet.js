// Wallet: the one place that changes a character's cash outside the shop cart.
//
// Pure functions only. Nothing here touches storage or the page: change() returns a fully staged
// `extra` (cash + a short ledger) and the caller assigns it and saves the way it already does.
// Money is `character.extra.cash`, a whole number of eurobucks, 0..MAX. The ledger is
// `character.extra.walletLog`, newest first, at most LOG_MAX entries: {at, delta, balance, note}.
(function () {
  'use strict';

  const MAX = 999999999, LOG_MAX = 40, NOTE_MAX = 120;

  const whole = value => { const n = Math.floor(Number(value)); return Number.isFinite(n) ? n : 0; };
  const cash = character => Math.min(MAX, Math.max(0, whole(character?.extra?.cash)));
  const log = character => (Array.isArray(character?.extra?.walletLog) ? character.extra.walletLog : [])
    .filter(e => e && typeof e === 'object' && Number.isFinite(Number(e.delta)))
    .slice(0, LOG_MAX)
    .map(e => ({ at: String(e.at || ''), delta: whole(e.delta), balance: Math.min(MAX, Math.max(0, whole(e.balance))), note: String(e.note || '').slice(0, NOTE_MAX) }));
  const can = (character, amount) => whole(amount) >= 0 && cash(character) >= whole(amount);

  // delta > 0 earns, delta < 0 spends. Never mutates `character`.
  // -> { ok:true, extra, balance, entry } | { ok:false, reason:'noCharacter'|'invalid'|'short'|'max', balance, short? }
  function change(character, delta, note, options) {
    if (!character || typeof character !== 'object') return { ok: false, reason: 'noCharacter', balance: 0 };
    const raw = Number(delta), d = whole(delta), now = cash(character);
    if (!Number.isFinite(raw) || d === 0 || Math.abs(d) > MAX) return { ok: false, reason: 'invalid', balance: now };
    if (d < 0 && now + d < 0) return { ok: false, reason: 'short', balance: now, short: -(now + d) };
    if (d > 0 && now + d > MAX) return { ok: false, reason: 'max', balance: now };
    const balance = now + d;
    const entry = { at: String(options?.at || new Date().toISOString()), delta: d, balance, note: String(note || '').trim().slice(0, NOTE_MAX) };
    const extra = { ...(character.extra || {}), cash: balance, walletLog: [entry, ...log(character)].slice(0, LOG_MAX) };
    return { ok: true, extra, balance, entry };
  }
  const earn = (character, amount, note, options) => whole(amount) > 0 ? change(character, whole(amount), note, options) : { ok: false, reason: 'invalid', balance: cash(character) };
  const spend = (character, amount, note, options) => whole(amount) > 0 ? change(character, -whole(amount), note, options) : { ok: false, reason: 'invalid', balance: cash(character) };

  // Move money between two characters, all or nothing. -> { ok, from:{extra}, to:{extra} } | { ok:false, reason }
  function transfer(from, to, amount, note, options) {
    if (!from || !to || from === to || (from.id && from.id === to.id)) return { ok: false, reason: 'invalid', balance: cash(from) };
    const out = spend(from, amount, note, options);
    if (!out.ok) return out;
    const into = earn(to, amount, note, options);
    if (!into.ok) return into;
    return { ok: true, from: out, to: into };
  }

  // Split a sum between n people: everyone gets the same whole share, the remainder is reported.
  function split(amount, people) {
    const total = Math.max(0, whole(amount)), n = Math.max(0, whole(people));
    if (!n) return { each: 0, rest: total };
    return { each: Math.floor(total / n), rest: total % n };
  }

  const format = value => String(whole(value)).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');

  window.Wallet = { MAX, LOG_MAX, cash, log, can, change, earn, spend, transfer, split, format };
})();
