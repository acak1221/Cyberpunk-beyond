/* «Из чего складывается число»: a details dialog for a STAT box or a Skill row, in every look. It shows the STAT, the level, the
   wound state, the effects with their sources, the armor penalty and what is set for the next roll, and has a roll button that
   presses the sheet's own roll button. The breakdown itself is built by DossierPanel (dossier-panel.js), the same builder the
   «Досье» look uses on its own panel; this file only opens it from a button («i» on a Skill row, the name of a STAT) in any look.
   Presentation only: nothing is written to the character. Pure helpers are exported for tests. */
(function (global) {
  'use strict';
  const doc = global.document;
  const STATS = ['INT', 'REF', 'DEX', 'TECH', 'COOL', 'WILL', 'LUCK', 'MOVE', 'BODY', 'EMP'];
  const num = v => { const n = Number(v); return Number.isFinite(n) ? n : 0; };
  const quote = x => String(x ?? '').replace(/["\\]/g, '\\$&');
  const esc = x => String(x ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  let pop = null, backdrop = null, opened = null, openerEl = null;
  function lang() { try { const l = global.App?.lang?.(); if (l === 'en' || l === 'ru') return l; } catch {} return doc?.documentElement?.lang === 'en' ? 'en' : 'ru'; }

  // ---------- pure ----------
  // «skill:Handgun» or «stat:REF» as the trigger carries it.
  function parse(token) {
    const m = /^(skill|stat):(.{1,80})$/.exec(String(token ?? ''));
    if (!m) return null;
    if (m[1] === 'stat') return STATS.includes(m[2]) ? { kind: 'stat', key: m[2] } : null;
    return { kind: 'skill', key: m[2] };
  }
  // The breakdown model for a trigger: the Skill's STAT comes from the sheet's own Skill list, so the dialog explains exactly
  // what the row rolls. Null when the character or the Skill is unknown.
  function model(c, o, l, panel) {
    const D = panel || global.DossierPanel;
    if (!c || !o || !D) return null;
    if (o.kind === 'stat') return D.statBreakdown?.(c, { stat: o.key }, l) || null;
    if (o.kind === 'skill') {
      let info = null; try { info = global.App?.skillInfo?.(o.key) || null; } catch {}
      return info ? D.skillBreakdown?.(c, { skill: o.key, stat: info.stat }, l) || null : null;
    }
    return null;
  }
  // The dialog body. DossierPanel marks its buttons for the board panel; here they carry this dialog's own marks, so the board
  // panel's handlers never react to them (and the other way round).
  function markup(m, l, panel) {
    const D = panel || global.DossierPanel;
    return String(D.render(m, l)).replace(/data-dossier-close/g, 'data-detail-close').replace(/data-dossier-roll/g, 'data-detail-roll').replace(/data-dossier-check/g, 'data-detail-check').replace(/data-dossier-label/g, 'data-detail-label').replace(/id="dossier-title"/g, 'id="detail-title"');
  }

  // ---------- the dialog ----------
  function ensure() {
    if (pop && pop.isConnected !== false) return;
    backdrop = doc.createElement('div'); backdrop.className = 'detail-backdrop'; backdrop.hidden = true; backdrop.setAttribute('data-detail-close', '');
    pop = doc.createElement('div'); pop.className = 'detail-pop'; pop.hidden = true;
    pop.setAttribute('role', 'dialog'); pop.setAttribute('aria-modal', 'true'); pop.setAttribute('aria-labelledby', 'detail-title'); pop.setAttribute('tabindex', '-1');
    doc.body.appendChild(backdrop); doc.body.appendChild(pop);
  }
  const trigger = o => (o ? doc.querySelector(`[data-detail-open="${quote(o.kind + ':' + o.key)}"]`) : null);
  function open(token, from) {
    const o = typeof token === 'string' ? parse(token) : token;
    const c = global.App?.active?.(), l = lang(), m = o && c ? model(c, o, l) : null;
    if (!m) return false;
    try { global.DossierPanel?.close?.({ focus: false }); } catch {}
    ensure();
    for (const r of m.rolls) if (r.selector) { const t = doc.querySelector('.sheet-layout ' + r.selector); r.disabled = !t || !!t.disabled; }
    opened = o; openerEl = from || doc.activeElement || null;
    pop.innerHTML = markup(m, l);
    pop.hidden = false; backdrop.hidden = false; doc.documentElement.classList.add('detail-open');
    pop.focus?.({ preventScroll: true });
    return true;
  }
  function close({ focus = true } = {}) {
    if (!opened) return false;
    const o = opened, from = openerEl; opened = null; openerEl = null;
    if (pop) { pop.hidden = true; pop.innerHTML = ''; }
    if (backdrop) backdrop.hidden = true;
    doc.documentElement.classList.remove('detail-open');
    if (focus) {
      // The sheet may have been drawn again meanwhile: look for the trigger by what it opens, then fall back to something real.
      const el = trigger(o) || (from && from.isConnected !== false ? from : null) || doc.querySelector('.sheet-tabs .active') || doc.querySelector('#app h1') || doc.body;
      el?.focus?.({ preventScroll: true });
    }
    return true;
  }
  // A roll closes the dialog first (so the result is not behind it), then presses the sheet's own button.
  function roll(button) {
    const o = opened, selector = button.dataset.detailRoll, base = button.dataset.detailCheck, label = button.dataset.detailLabel;
    close();
    if (selector) { const t = doc.querySelector('.sheet-layout ' + selector); if (t && !t.disabled) t.click(); return; }
    if (base === undefined) return;
    // A STAT check follows the sheet's rolls: the same character and numbers as now, and the DV set for the next check is used up.
    let check = { base: num(base), label: label || '' };
    if (o?.kind === 'stat') { const c = global.App?.active?.(), r = c ? global.DossierPanel?.statBreakdown?.(c, { stat: o.key }, lang())?.rolls?.[0] : null; check = r && !r.disabled ? r.check : null; }
    if (!check) return;
    let dv = 0; try { dv = num(global.SheetTabs?.takeDV?.()); } catch {}
    try { global.App?.check?.(check.base, check.label, dv > 0 ? { dv } : {}); } catch {}
  }
  function onClick(e) {
    const t = e.target; if (!t?.closest) return false;
    if (t.closest('[data-detail-close]')) { close(); return true; }
    const rb = t.closest('[data-detail-roll],[data-detail-check]');
    if (rb && pop?.contains?.(rb)) { if (!rb.disabled) roll(rb); return true; }
    const from = t.closest('[data-detail-open]');
    if (from) { open(from.dataset.detailOpen, from); return true; }
    return false;
  }
  function onKey(e) {
    // A Skill name is a div with role=button (like the «Досье» look's): Enter and Space open it.
    const from = e.target?.closest?.('[data-detail-open]');
    if (!opened && from && e.target === from && from.tagName !== 'BUTTON' && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault?.(); open(from.dataset.detailOpen, from); return; }
    if (!opened || !pop) return;
    if (e.key === 'Escape') { e.preventDefault?.(); e.stopPropagation?.(); close(); return; }
    if (e.key !== 'Tab') return;
    const items = [...pop.querySelectorAll('button:not([disabled]),[href],[tabindex]:not([tabindex="-1"])')];
    if (!items.length) { e.preventDefault?.(); return; }
    const first = items[0], last = items[items.length - 1], a = doc.activeElement;
    if (e.shiftKey && (a === first || a === pop)) { e.preventDefault?.(); last.focus(); }
    else if (!e.shiftKey && (a === last || !pop.contains(a))) { e.preventDefault?.(); first.focus(); }
  }
  if (doc?.addEventListener) {
    doc.addEventListener('click', e => { try { onClick(e); } catch {} });
    doc.addEventListener('keydown', onKey, true);
    global.addEventListener?.('hashchange', () => close({ focus: false }));
  }
  global.StatDetail = { parse, model, markup, open, close, opened: () => opened && { ...opened }, onClick, esc };
})(window);
