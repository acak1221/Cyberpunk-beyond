// One short line under the name on a sheet: role and rank, and the second role of a multiclass character.
(function (global) {
  'use strict';
  const esc = s => String(s ?? '').replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
  const rank = v => { const n = typeof v === 'number' ? v : typeof v === 'string' && /^\d+$/.test(v.trim()) ? Number(v) : NaN; return Number.isSafeInteger(n) && n >= 0 && n <= 10 ? n : null; };
  const word = lang => lang === 'en' ? 'rank' : 'ранг';
  function name(id, lang) {
    const r = (global.ROLES || []).find(x => x && x.id === id);
    return (r && r.name && (r.name[lang] || r.name.ru)) || String(id || '');
  }
  // -> [{role, rank}] primary first, then the roles taken later (each role once, bad entries skipped)
  function entries(c) {
    if (!c || typeof c !== 'object' || !c.role) return [];
    const out = [{ role: c.role, rank: rank(c.rank) }], seen = new Set([c.role]);
    const add = c.extra && c.extra.advancement && Array.isArray(c.extra.advancement.additionalRoles) ? c.extra.advancement.additionalRoles : [];
    for (const r of add) { if (!r || typeof r !== 'object' || !r.role || seen.has(r.role)) continue; seen.add(r.role); out.push({ role: r.role, rank: rank(r.rank) }); }
    return out;
  }
  // One role: «Соло, ранг 4». Several roles stay on one line on a phone: «Соло 4 · Нетраннер 2» (the full form is the tooltip).
  function text(c, lang, full) {
    const l = lang === 'en' ? 'en' : 'ru', list = entries(c), long = list.length === 1 || full;
    return list.map(e => name(e.role, l) + (e.rank === null ? '' : long ? ', ' + word(l) + ' ' + e.rank : ' ' + e.rank)).join(' · ');
  }
  function html(c, lang) {
    const t = text(c, lang);
    return t ? `<p class="sheet-roleline" title="${esc(text(c, lang, true))}">${esc(t)}</p>` : '';
  }
  global.RoleLine = { entries, text, html };
})(window);
