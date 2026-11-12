// Extra facts on a character card in the list: money and wound state, next to HP.
(function (global) {
  'use strict';
  const esc = s => String(s ?? '').replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
  const num = v => { const n = Number(v); return Number.isFinite(n) ? n : 0; };
  const NAMES = { ru: { light: 'Лёгкое ранение', serious: 'Тяжёлое ранение', mortal: 'Смертельное ранение' }, en: { light: 'Lightly wounded', serious: 'Seriously wounded', mortal: 'Mortally wounded' } };
  // Same thresholds as the sheet HUD: below 1 mortal, below half serious, below the maximum light.
  function wound(hp, max) { hp = num(hp); max = num(max); return hp < 1 ? 'mortal' : hp < Math.ceil(max / 2) ? 'serious' : hp < max ? 'light' : 'full'; }
  function money(c) {
    const W = global.Wallet;
    const cash = W?.cash ? W.cash(c) : Math.max(0, Math.floor(num(c?.extra?.cash)));
    return (W?.format ? W.format(cash) : String(cash)) + ' eb';
  }
  // -> html for the extra spans of .char-meta (empty strings for a healthy character's wound)
  function html(c, lang, max) {
    const l = lang === 'en' ? 'en' : 'ru', w = wound(c?.hp, max);
    const wnd = w === 'full' ? '' : `<span class="char-wound" data-wound="${w}">${esc(NAMES[l][w])}</span>`;
    return `<span class="char-money">€$ <strong>${esc(money(c))}</strong></span>${wnd}`;
  }
  global.CardInfo = { wound, money, html };
})(window);
