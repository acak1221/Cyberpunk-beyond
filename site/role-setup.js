// Role ability set-up reminder.
//
// Three Roles hand the player points to place the moment the character exists: a Solo spreads the Combat Awareness
// rank, a Medtech puts one Medicine point per rank into a specialty, a Tech two Maker points per rank. The tool
// that does it lives with the Role's rolls; this module only says «0 / 4 placed» where a new player looks for it
// (the Role ability card, the «character created» page) and leads there.
(function (global) {
  'use strict';

  const esc = x => String(x ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const whole = (v, max) => { const n = Math.floor(Number(v)); return Number.isFinite(n) ? Math.max(0, Math.min(max, n)) : 0; };
  // Combat Awareness: [points per level, highest level] — the same table the Role tools use.
  const SOLO_COST = { deflect: [2, 5], fumble: [4, 1], initiative: [1, 10], precision: [3, 3], weakness: [1, 10], threat: [1, 10] };
  const POINTS = {
    solo: { per: 1, ability: { ru: 'Боевое чутьё', en: 'Combat Awareness' } },
    medtech: { per: 1, keys: [['surgery', 10], ['pharma', 5], ['cryo', 5]], ability: { ru: 'Медицина', en: 'Medicine' } },
    tech: { per: 2, keys: [['field', 10], ['upgrade', 10], ['fabrication', 10], ['invention', 10]], ability: { ru: 'Мастер', en: 'Maker' } }
  };

  function rank(c) { return whole(c?.rank, 10) || 1; }
  function values(c) {
    const v = c?.extra?.roleTools?.[c?.role]?.values;
    return v && typeof v === 'object' && !Array.isArray(v) ? v : {};
  }
  function soloSpent(c, v) {
    const own = global.RoleTools?.soloCost;
    if (typeof own === 'function') { try { const n = Number(own(v)); if (Number.isFinite(n)) return n; } catch { /* fall through */ } }
    let sum = 0;
    for (const [key, [cost, max]] of Object.entries(SOLO_COST)) sum += whole(v[key], max) * cost;
    return sum;
  }

  // -> null when the Role has nothing to place, else { role, spent, total, left, done }.
  function status(c) {
    const spec = c && typeof c === 'object' ? POINTS[c.role] : null;
    if (!spec) return null;
    const v = values(c), total = rank(c) * spec.per;
    const spent = c.role === 'solo' ? soloSpent(c, v) : spec.keys.reduce((a, [k, max]) => a + whole(v[k], max), 0);
    return { role: c.role, spent, total, left: total - spent, done: spent === total };
  }

  // The line under the Role ability card. The button uses the sheet's own jump (data-hud-jump), which opens the right tab.
  function cardHTML(c, lang) {
    const s = status(c), ru = lang !== 'en';
    if (!s) return `<p class="role-setup"><button type="button" class="btn ghost small" data-hud-jump="sheet-role">${ru ? 'Броски и инструменты роли' : 'Role rolls and tools'} →</button></p>`;
    const text = s.done ? (ru ? `Очки способности распределены: ${s.spent} / ${s.total}.` : `Ability points placed: ${s.spent} / ${s.total}.`)
      : s.left > 0 ? (ru ? `Распределите очки способности: ${s.spent} / ${s.total}. Без этого способность не работает.` : `Place your ability points: ${s.spent} / ${s.total}. The ability does nothing until you do.`)
      : (ru ? `Распределено больше очков, чем даёт ранг: ${s.spent} / ${s.total}.` : `More points are placed than the rank gives: ${s.spent} / ${s.total}.`);
    return `<p class="role-setup${s.done ? '' : ' role-setup-todo'}" data-role-setup="${s.done ? 'done' : 'todo'}"><span>${esc(text)}</span> <button type="button" class="btn ${s.done ? 'ghost' : 'primary'} small" data-hud-jump="sheet-role">${ru ? (s.done ? 'Изменить' : 'Распределить') : (s.done ? 'Change' : 'Place points')} →</button></p>`;
  }

  // One sentence for the «character created» page of a wizard; '' for Roles with nothing to place. New characters start at rank 4.
  function createdHint(role, lang, roleRank) {
    const spec = POINTS[role], ru = lang !== 'en';
    if (!spec) return '';
    const total = (whole(roleRank, 10) || 4) * spec.per, name = spec.ability[ru ? 'ru' : 'en'];
    return `<p class="role-setup role-setup-todo" data-role-setup="todo">${esc(ru
      ? `Ещё один шаг: распределите ${total} очк. способности «${name}». Откройте лист → «Особенности» → «Способность роли».`
      : `One more step: place the ${total} points of ${name}. Open the sheet → Features → Role ability.`)}</p>`;
  }

  global.RoleSetup = { status, cardHTML, createdHint };
})(window);
