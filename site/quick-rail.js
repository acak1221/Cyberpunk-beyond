/* «Быстрые броски»: a rail of one-tap rolls above the tabs of the sheet. It always has Initiative and Evasion, the attack of the
   main weapon (the first one on the Combat tab) and up to five Skills the player starred. A star sits on every Skill row.

   What is stored: extra.quickRolls, a list of Skill names (at most five, each one a Skill the sheet knows), on the character
   itself, so a file, a link and a backup carry it. It is optional: a sheet without it shows the defaults, and a value that is not
   a list of known names is read as an empty list. The buttons press the sheet's own roll buttons, so every rule stays in one place.
   Pure helpers are exported for tests. */
(function (global) {
  'use strict';
  const doc = global.document;
  const KEY = 'quickRolls', MAX = 5;
  const num = v => { const n = Number(v); return Number.isFinite(n) ? n : 0; };
  const esc = x => String(x ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const sign = n => (n < 0 ? '−' : '+') + Math.abs(n);
  const quote = x => String(x ?? '').replace(/["\\]/g, '\\$&');
  const T = {
    ru: { title: 'Быстрые броски', init: 'Инициатива', evasion: 'Уклонение', attack: 'Атака', star: 'В быстрые броски', unstar: 'Убрать из быстрых бросков', full: n => `Уже ${n} навыков в быстрых бросках. Уберите один, чтобы добавить другой.`, added: 'Добавлено в быстрые броски', removed: 'Убрано из быстрых бросков', empty: '★ у навыка — быстрый бросок', emptyGo: 'Выбрать навыки', noBullets: 'не от пуль', weapon: 'Оружие', stale: 'Данные изменились. Повторите действие.' },
    en: { title: 'Quick rolls', init: 'Initiative', evasion: 'Evasion', attack: 'Attack', star: 'Add to quick rolls', unstar: 'Remove from quick rolls', full: n => `Already ${n} Skills in quick rolls. Remove one to add another.`, added: 'Added to quick rolls', removed: 'Removed from quick rolls', empty: 'Star a Skill for a quick roll', emptyGo: 'Pick Skills', noBullets: 'not vs bullets', weapon: 'Weapon', stale: 'The data changed. Try again.' },
  };
  function lang() { try { const l = global.App?.lang?.(); if (l === 'en' || l === 'ru') return l; } catch {} return doc?.documentElement?.lang === 'en' ? 'en' : 'ru'; }
  const tr = (l, k, ...a) => { const v = (T[l] || T.ru)[k]; return typeof v === 'function' ? v(...a) : v; };

  // ---------- pure ----------
  // A stored list as it is read: strings only, each Skill once (first place stays), at most MAX, and only names `known` accepts.
  function clean(list, known) {
    if (!Array.isArray(list)) return [];
    const ok = typeof known === 'function' ? known : known && typeof known.has === 'function' ? n => known.has(n) : () => true;
    const out = [];
    for (const n of list) { if (typeof n !== 'string' || n.length > 80 || out.includes(n) || !ok(n)) continue; out.push(n); if (out.length >= MAX) break; }
    return out;
  }
  // Star or unstar a Skill: {list, changed, full}; a sixth star is refused, not dropped silently.
  function toggle(list, name, known) {
    const cur = clean(list, known);
    if (typeof name !== 'string' || !name || name.length > 80 || (typeof known === 'function' && !known(name))) return { list: cur, changed: false, full: false };
    if (cur.includes(name)) return { list: cur.filter(n => n !== name), changed: true, full: false, on: false };
    if (cur.length >= MAX) return { list: cur, changed: false, full: true };
    return { list: [...cur, name], changed: true, full: false, on: true };
  }
  // When a Skill is renamed or dropped from the app, a stored name that is no longer known disappears from the rail on its own.
  const knownIn = A => name => { try { return !!A?.skillInfo?.(name); } catch { return false; } };
  const known = name => knownIn(global.App)(name);
  function stars(c, api) { return clean(c?.extra?.[KEY], api ? knownIn(api) : known); }
  // What the rail shows for a character: a list of {id, label, total, selector, hint, warn}. `api` is injectable for tests.
  function entries(c, l, api) {
    if (!c || typeof c !== 'object') return [];
    const A = api || global.App || {}, st = c.stats || {}, sk = c.skills || {}, out = [];
    const bonus = (stat, level) => (typeof A.checkBonus === 'function' ? A.checkBonus(c, stat, level) : num(st[stat]) + num(level));
    out.push({ id: 'init', label: tr(l, 'init'), total: sign(typeof A.initiativeBonus === 'function' ? A.initiativeBonus(c) : num(st.REF)), selector: '[data-action="initiative-roll"]', hint: '1d10 + REF' });
    out.push({ id: 'evasion', label: tr(l, 'evasion'), total: sign(bonus('DEX', sk.Evasion)), selector: '[data-action="skill-roll"][data-skill="Evasion"]', hint: '1d10 + DEX + ' + tr(l, 'evasion'), warn: num(st.REF) < 8 ? tr(l, 'noBullets') : '' });
    const weapons = Array.isArray(c?.extra?.weapons) ? c.extra.weapons : [], wi = weapons.findIndex(w => w && typeof w === 'object' && !Array.isArray(w));
    if (wi >= 0) {
      let v = NaN; try { v = Number(global.CharacterExtra?.attackBonus?.(c, wi)); } catch {}
      const name = String(weapons[wi].name || '').trim().slice(0, 30) || tr(l, 'weapon');
      out.push({ id: 'weapon', label: name, total: Number.isFinite(v) ? sign(v + num(global.PlayCombat?.precision?.(c))) : '—', selector: `[data-cx-action="attack"][data-cx-index="${wi}"]`, hint: tr(l, 'attack') });
    }
    for (const name of stars(c, A)) {
      if (name === 'Evasion') continue; // Evasion is always the second button; a star on it would only repeat it
      let info = null; try { info = A.skillInfo?.(name) || null; } catch {}
      if (!info) continue;
      out.push({ id: 'skill:' + name, label: l === 'en' ? info.name : info.ru, total: info.total, selector: `[data-action="skill-roll"][data-skill="${quote(name)}"]`, hint: `1d10 + ${info.stat} + ${l === 'en' ? info.name : info.ru}` });
    }
    return out;
  }

  // ---------- markup ----------
  function html(c, l) {
    l = l === 'en' ? 'en' : 'ru';
    if (!c) return '';
    const list = entries(c, l), hasStars = stars(c).some(n => n !== 'Evasion');
    const btn = e => `<button type="button" class="qr-btn" data-proxy-roll="${esc(e.selector)}" data-keep="qr-${esc(e.id)}" title="${esc(e.hint)}"><span>${esc(e.label)}${e.warn ? ` <small class="qr-warn">${esc(e.warn)}</small>` : ''}</span><b>${esc(e.total)}</b></button>`;
    const hint = hasStars ? '' : `<button type="button" class="qr-btn qr-add" data-hud-jump="sheet-skills" data-keep="qr-add"><span>${esc(tr(l, 'empty'))}</span></button>`;
    return `<div class="quick-rail" role="group" aria-label="${esc(tr(l, 'title'))}"><span class="qr-title">${esc(tr(l, 'title'))}</span>${list.map(btn).join('')}${hint}</div>`;
  }
  // The star on a Skill row.
  function starHTML(c, name, l) {
    l = l === 'en' ? 'en' : 'ru';
    const on = stars(c).includes(name);
    return `<button type="button" class="skill-star" data-quick-star="${esc(name)}" aria-pressed="${on}" aria-label="${esc(tr(l, on ? 'unstar' : 'star'))}: ${esc(l === 'en' ? name : (global.SKILL_LABELS?.[name]?.ru || name))}" title="${esc(tr(l, on ? 'unstar' : 'star'))}"><span aria-hidden="true">${on ? '★' : '☆'}</span></button>`;
  }
  // Writes the starred list to the character and saves; the caller redraws the rail and the star.
  function setStars(c, list) {
    if (!c || typeof c !== 'object') return false;
    let x = null; try { x = global.CharacterExtra?.init?.(c) || null; } catch { return false; }
    x = x || (c.extra && typeof c.extra === 'object' && !Array.isArray(c.extra) ? c.extra : (c.extra = {}));
    if (!x || typeof x !== 'object') return false;
    const next = clean(list, known);
    if (next.length) x[KEY] = next; else delete x[KEY];
    return true;
  }
  // App.canEdit is the app's own check (editable scope, this sheet is the one on screen); without it (a test) the star works.
  const canEdit = c => { try { return typeof global.App?.canEdit === 'function' ? global.App.canEdit(c) === true : true; } catch { return false; } };
  function onClick(e) {
    const b = e.target?.closest?.('[data-quick-star]'); if (!b) return false;
    const c = global.App?.active?.(), l = lang(), name = b.dataset.quickStar; if (!c) return true;
    // Same guards as every other edit of the sheet: the right account and scope, the sheet on screen, nothing mid-switch.
    if (!canEdit(c)) { try { global.App?.notify?.(tr(l, 'stale')); } catch {} return true; }
    const r = toggle(c.extra?.[KEY], name, known);
    if (r.full) { try { global.App?.notify?.(tr(l, 'full', MAX)); } catch {} return true; }
    if (!r.changed) return true;
    if (!setStars(c, r.list)) return true;
    try { global.App?.save?.(); } catch {}
    b.setAttribute('aria-pressed', String(!!r.on)); b.setAttribute('aria-label', `${tr(l, r.on ? 'unstar' : 'star')}: ${l === 'en' ? name : (global.SKILL_LABELS?.[name]?.ru || name)}`); b.title = tr(l, r.on ? 'unstar' : 'star');
    const icon = b.querySelector('span'); if (icon) icon.textContent = r.on ? '★' : '☆';
    try { global.SheetTabs?.refreshHud?.(c); } catch {}
    b.focus?.({ preventScroll: true });
    return true;
  }
  if (doc?.addEventListener) doc.addEventListener('click', e => { try { onClick(e); } catch {} });
  global.QuickRail = { KEY, MAX, clean, toggle, stars, entries, html, starHTML, setStars, onClick };
})(window);
