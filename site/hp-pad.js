/* One HP control. The pad has the steps (−5 −1 +1 +5), a damage field with the place of the hit (body, head, through the
   armor) and the SP of the worn armor already filled in, a tick for a critical hit, and a line after every change where the
   reason can be named (optionally) or the change taken back. The character sheet draws it in its sticky header; any other
   screen (for example the tracker) opens the same pad for any target with HpPad.open(target, opts).

   A target is a plain object:
     { id, name, hp(): number, max(): number, sp(): {body, head} | null,
       setHp(next, {reason}): {ok, hp, medical?} | boolean,          -- writes the new value (and saves)
       relabel?(change, reason): boolean,                             -- optional: the reason was named afterwards
       hitForm?(lang): string, dock?: true }                          -- optional: the sheet draws its own full damage form
   The sheet's target comes from HpPad.forCharacter(character).

   Presentation and rules only; the pad writes nothing but through target.setHp. Pure helpers are exported for tests. */
(function (global) {
  'use strict';
  const doc = global.document;
  const num = v => { const n = Number(v); return Number.isFinite(n) ? n : 0; };
  const int = (v, lo, hi) => Math.max(lo, Math.min(hi, Math.trunc(num(v))));
  const esc = x => String(x ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const T = {
    ru: {
      title: 'Здоровье', close: 'Закрыть', now: 'Сейчас', stepName: 'HP', damage: 'Урон', take: 'Получить урон', place: 'Куда попали',
      body: 'Тело', head: 'Голова', through: 'Мимо брони', sp: 'SP', crit: 'Критическое попадание', critNote: 'Критическое попадание: киньте критическое ранение.',
      exact: 'Задать точно', exactSet: 'Задать', change: 'Изменено', undo: 'Отменить', reasonGroup: 'Что это было', reasonDamage: 'Урон', reasonCorrection: 'Исправление',
      healed: 'Лечение', undone: 'Возвращено', preview: (d, a, h) => `Пройдёт ${d} урона: HP ${h} → ${a}`, blocked: 'Броня поглотила весь урон', empty: 'Введите урон',
      full: 'Без ранений', light: 'Лёгкое ранение', serious: 'Тяжёлое ранение', mortal: 'Смертельное ранение', fail: 'Не удалось изменить HP. Проверьте значение.',
      withArmor: 'С учётом брони', stale: 'HP уже изменилось другим путём, поэтому отменять нечего.', changeLine: (a, b) => `HP ${a} → ${b}`, open: 'Изменить HP',
    },
    en: {
      title: 'Health', close: 'Close', now: 'Now', stepName: 'HP', damage: 'Damage', take: 'Take damage', place: 'Where it hit',
      body: 'Body', head: 'Head', through: 'Through armor', sp: 'SP', crit: 'Critical hit', critNote: 'Critical hit: roll the Critical Injury.',
      exact: 'Set exactly', exactSet: 'Set', change: 'Changed', undo: 'Undo', reasonGroup: 'What it was', reasonDamage: 'Damage', reasonCorrection: 'Correction',
      healed: 'Healing', undone: 'Reverted', preview: (d, a, h) => `${d} damage gets through: HP ${h} → ${a}`, blocked: 'The armor stops all of it', empty: 'Enter the damage',
      full: 'Unhurt', light: 'Lightly wounded', serious: 'Seriously wounded', mortal: 'Mortally wounded', fail: 'Could not change HP. Check the value.',
      withArmor: 'With armor', stale: 'HP has changed another way since, so there is nothing to undo.', changeLine: (a, b) => `HP ${a} → ${b}`, open: 'Change HP',
    },
  };
  function lang() { try { const l = global.App?.lang?.(); if (l === 'en' || l === 'ru') return l; } catch {} return doc?.documentElement?.lang === 'en' ? 'en' : 'ru'; }
  const tr = (l, k, ...a) => { const v = (T[l] || T.ru)[k]; return typeof v === 'function' ? v(...a) : v; };

  // ---------- pure rules ----------
  // The wound state of the pad: hp below 1 is mortal, below half the maximum is serious (same thresholds as the sheet).
  function wound(hp, max) { hp = num(hp); max = num(max); return hp < 1 ? 'mortal' : hp < Math.ceil(max / 2) ? 'serious' : hp < max ? 'light' : 'full'; }
  // A heal never lifts HP above the maximum (and never lowers a value that is already above it); damage goes down to −999.
  function stepHp(hp, max, delta) {
    hp = Math.trunc(num(hp)); max = Math.trunc(num(max)); delta = Math.trunc(num(delta));
    return delta > 0 ? Math.max(hp, Math.min(max, hp + delta)) : Math.max(-999, hp + delta);
  }
  // Share of the bar that is filled, 0..100.
  function fill(hp, max) { max = num(max); return max > 0 ? Math.max(0, Math.min(100, Math.round(num(hp) / max * 100))) : 0; }
  // The hit of a plain target: the SP of the place stops that much (all of it for «through armor»). The head multiplier is a
  // parameter because it belongs to the rules tool of the sheet; the pad does not make up a number of its own (default 1).
  function simpleHit({ hp, amount, zone, sp, crit, headMultiplier } = {}) {
    const raw = Math.trunc(num(amount)), z = zone === 'head' || zone === 'through' ? zone : 'body';
    if (!(raw >= 1)) return { ok: false, reason: 'empty' };
    const armor = z === 'through' ? 0 : Math.max(0, Math.trunc(num(sp)));
    const through = Math.max(0, raw - armor), mult = z === 'head' && through > 0 ? Math.max(1, Math.trunc(num(headMultiplier)) || 1) : 1;
    const damage = through * mult, before = Math.trunc(num(hp));
    return { ok: true, raw, zone: z, armor, damage, hpBefore: before, hpAfter: Math.max(-999, before - damage), critical: crit === true, blocked: damage === 0 };
  }
  // Naming the reason afterwards. Only «new damage» clears a recorded stabilization, so «correction» gives it back and
  // «damage» takes it away again. `now` is the medical record as it is; `before` is what it was before the change.
  function relabelMedical(before, now, reason) {
    if (!before || typeof before !== 'object' || before.version !== 1 || before.stabilized !== true) return now;
    if (reason === 'correction') return now && typeof now === 'object' && now.version === 1 && now.stabilized === false ? { ...now, stabilized: true } : now;
    if (reason === 'damage') return now && typeof now === 'object' && now.version === 1 && now.stabilized === true ? { ...now, stabilized: false } : now;
    return now;
  }

  // ---------- targets ----------
  const hpMax = c => { const s = c?.stats || {}; return 10 + 5 * Math.ceil((num(s.BODY) + num(s.WILL)) / 2); };
  // The sheet's character: every change goes through the sheet's own HP field so its stale-state guards stay in one place.
  function forCharacter(c) {
    return {
      kind: 'sheet', dock: true, id: c?.id, name: c?.name || '',
      hp: () => num(c?.hp), max: () => hpMax(c), sp: () => ({ body: Math.max(0, num(c?.bodyArmor)), head: Math.max(0, num(c?.head)) }),
      character: c,
      hitForm: l => { try { return global.PlayCombat?.hitForm?.(c, l) || ''; } catch { return ''; } },
      setHp(next, meta) { return global.App?.applyHp ? global.App.applyHp(Math.trunc(num(next)), meta?.reason || 'damage', c) : false; },
      relabel(change, reason) {
        const x = c?.extra; if (!x || typeof x !== 'object' || !change || change.id !== c.id || num(c.hp) !== change.to) return false;
        const next = relabelMedical(change.medical, x.medical, reason);
        if (next === x.medical) return true;
        x.medical = next; global.App?.save?.(); return true;
      },
    };
  }

  // ---------- markup ----------
  let last = null; // the last change made with the pad: {id, from, to, reason, medical}
  const sheetState = { zone: 'body', crit: false }; // the plain damage form in the dock, when the sheet has no damage tool
  const stateOf = el => (el?.closest?.('[data-hp-pad="modal"]') && modal ? modal.state : sheetState);
  let modal = null; // {target, opener, root, backdrop}
  const reasonRow = (l, ch) => {
    if (!ch) return '';
    const down = ch.to < ch.from, up = ch.to > ch.from;
    const chips = down
      ? `<span class="hp-pad-reasons" role="radiogroup" aria-label="${esc(tr(l, 'reasonGroup'))}"><button type="button" role="radio" data-hp-reason="damage" aria-checked="${ch.reason !== 'correction'}">${esc(tr(l, 'reasonDamage'))}</button><button type="button" role="radio" data-hp-reason="correction" aria-checked="${ch.reason === 'correction'}">${esc(tr(l, 'reasonCorrection'))}</button></span>`
      : up ? `<span class="hp-pad-tag">${esc(tr(l, 'healed'))}</span>` : '';
    return `<span class="hp-pad-line">${esc(tr(l, 'change'))}: <b>${esc(tr(l, 'changeLine', ch.from, ch.to))}</b></span>${chips}<button type="button" class="btn ghost small" data-hp-undo>${esc(tr(l, 'undo'))}</button>`;
  };
  // The line describes the last change only while HP is still what that change made it; any other write (the hit form, the exact
  // field, a roll, the tracker) makes it stale, and a stale line is dropped, never shown with an Undo that would heal.
  const fresh = (ch, target) => !!ch && ch.id === target?.id && Math.trunc(num(target.hp())) === ch.to;
  function lastHtml(l, target) { if (last && last.id === target?.id && !fresh(last, target)) last = null; return reasonRow(l, fresh(last, target) ? last : null); }
  // The simple damage form of a target that has no damage tool of its own.
  function simpleForm(l, target, st) {
    const sp = target.sp?.() || { body: 0, head: 0 }, z = st.zone || 'body';
    const radio = (v, label) => `<button type="button" role="radio" data-hp-zone="${v}" aria-checked="${z === v}">${esc(label)}</button>`;
    return `<div class="hp-pad-hit" data-hp-hit><div class="hud-hp-row"><label>${esc(tr(l, 'damage'))}<input type="number" inputmode="numeric" min="1" max="999" data-hp-amount placeholder="0" value="${esc(st.amount ?? '')}"></label><div class="hud-hp-reasons" role="radiogroup" aria-label="${esc(tr(l, 'place'))}">${radio('body', `${tr(l, 'body')} · ${tr(l, 'sp')} ${num(sp.body)}`)}${radio('head', `${tr(l, 'head')} · ${tr(l, 'sp')} ${num(sp.head)}`)}${radio('through', tr(l, 'through'))}</div></div><div class="hud-hp-row"><button type="button" role="checkbox" class="hp-pad-crit" data-hp-crit aria-checked="${st.crit === true}">${esc(tr(l, 'crit'))}</button><button type="button" class="btn small primary" data-hp-take>${esc(tr(l, 'take'))}</button></div><p class="hp-pad-preview" data-hp-preview role="status" aria-live="polite"></p></div>`;
  }
  // The whole pad. `where` is 'sheet' (in the dock) or 'modal'.
  function html(target, l, where = 'sheet', st = {}) {
    l = l === 'en' ? 'en' : 'ru';
    const hp = Math.trunc(num(target.hp())), max = Math.trunc(num(target.max())), w = wound(hp, max);
    const step = d => `<button type="button" data-hp-step="${d}" aria-label="${esc(tr(l, 'stepName'))} ${d < 0 ? '−' : '+'}${Math.abs(d)}">${d < 0 ? '−' : '+'}${Math.abs(d)}</button>`;
    const form = typeof target.hitForm === 'function' ? (target.hitForm(l) || '') : '';
    const exact = where === 'sheet'
      ? `<div class="hp-pad-exact" data-sheet-hp-root><label>${esc(tr(l, 'exact'))}<input type="number" inputmode="numeric" min="-999" max="1000" data-field="hp" value="${hp}" aria-label="${esc(tr(l, 'exact'))}"></label></div>`
      : `<div class="hp-pad-exact"><label>${esc(tr(l, 'exact'))}<input type="number" inputmode="numeric" min="-999" max="1000" data-hp-exact value="${hp}"></label><button type="button" class="btn ghost small" data-hp-exact-set>${esc(tr(l, 'exactSet'))}</button></div>`;
    return `<div class="hp-pad" data-hp-pad="${where}" data-wound="${w}"><div class="hp-pad-bar" aria-hidden="true"><i style="width:${fill(hp, max)}%"></i></div><div class="hud-hp-row hp-pad-steps">${step(-5)}${step(-1)}<span class="hud-hp-now" data-hp-now aria-live="polite"><b>${hp}</b><small>/ ${max}</small></span>${step(1)}${step(5)}</div>${form || simpleForm(l, target, st)}${exact}<div class="hp-pad-last" data-hp-last role="status" aria-live="polite">${lastHtml(l, target)}</div></div>`;
  }

  // ---------- acting ----------
  function targetFor(el) {
    const root = el?.closest?.('[data-hp-pad]'); if (!root) return null;
    if (root.dataset.hpPad === 'modal') return modal && modal.root.contains(root) ? modal.target : null;
    const c = global.App?.active?.(); return c ? forCharacter(c) : null;
  }
  // Writes a new value and remembers it so the line under the pad can offer the reason and the undo.
  function change(target, next, reason) {
    const from = target.hp(), medical = (() => { try { return JSON.parse(JSON.stringify(target.character?.extra?.medical ?? null)); } catch { return null; } })();
    const r = target.setHp(next, { reason: reason || 'damage' });
    const ok = r === true || (r && r.ok !== false);
    if (!ok) return false;
    const to = target.hp();
    if (target.kind !== 'sheet' && to !== from) last = { id: target.id, from, to, reason: to < from ? (reason || 'damage') : 'heal', medical: medical && typeof medical === 'object' ? medical : null };
    return true;
  }
  function refresh() {
    if (!doc) return;
    const l = lang();
    for (const root of doc.querySelectorAll?.('[data-hp-pad]') || []) {
      const t = targetFor(root); if (!t) continue;
      const hp = Math.trunc(num(t.hp())), max = Math.trunc(num(t.max()));
      root.dataset.wound = wound(hp, max);
      const bar = root.querySelector('.hp-pad-bar i'); if (bar) bar.style.width = fill(hp, max) + '%';
      const now = root.querySelector('[data-hp-now]'); if (now) now.innerHTML = `<b>${hp}</b><small>/ ${max}</small>`;
      const field = root.querySelector('[data-field="hp"],[data-hp-exact]'); if (field && doc.activeElement !== field) field.value = String(hp);
      const line = root.querySelector('[data-hp-last]'), next = lastHtml(l, t); if (line && line.innerHTML !== next) line.innerHTML = next;
    }
    if (modal) refreshPreview(modal.root);
  }
  function preview(root) {
    const t = targetFor(root); if (!t || t.hitForm) return;
    const l = lang(), box = root.querySelector('[data-hp-preview]'); if (!box) return;
    const st = stateOf(root), amount = root.querySelector('[data-hp-amount]')?.value;
    const sp = t.sp?.() || {}, r = simpleHit({ hp: t.hp(), amount, zone: st.zone, sp: st.zone === 'head' ? sp.head : sp.body, crit: st.crit, headMultiplier: headFactor() });
    box.textContent = !r.ok ? '' : (r.blocked ? tr(l, 'blocked') : tr(l, 'preview', r.damage, r.hpAfter, r.hpBefore)) + (r.critical ? ' · ' + tr(l, 'critNote') : '');
  }
  const refreshPreview = root => { for (const p of root.querySelectorAll?.('[data-hp-pad]') || []) preview(p); };
  // The head multiplier is the rules tool's own number; read it from there when it is loaded.
  let headCache = null;
  function headFactor() {
    if (headCache !== null) return headCache;
    try { const q = global.DamageApply?.quote?.({ id: 'x', hp: 50, head: 0, bodyArmor: 0, stats: { BODY: 6, WILL: 6 }, extra: {} }, { type: 'standard', location: 'head', raw: 4 }); headCache = Math.max(1, Math.trunc(num(q?.headMultiplier)) || 1); } catch { headCache = 1; }
    return headCache;
  }
  function say(msg) { try { global.App?.notify?.(msg); } catch {} }

  function onClick(e) {
    const el = e.target?.closest?.('[data-hp-step],[data-hp-take],[data-hp-reason],[data-hp-undo],[data-hp-zone],[data-hp-crit],[data-hp-exact-set],[data-hp-pad-close]');
    if (!el) return false;
    if (el.hasAttribute('data-hp-pad-close')) { close(); return true; }
    const t = targetFor(el); if (!t) return true;
    const l = lang(), padRoot = el.closest('[data-hp-pad]'), chipSel = el.hasAttribute('data-hp-reason') ? `[data-hp-reason="${el.dataset.hpReason === 'correction' ? 'correction' : 'damage'}"]` : '';
    if (el.hasAttribute('data-hp-step')) {
      const next = stepHp(t.hp(), t.max(), el.dataset.hpStep);
      if (next !== t.hp() && !change(t, next, 'damage')) say(tr(l, 'fail'));
    } else if (el.hasAttribute('data-hp-zone')) {
      const st = stateOf(el), root = el.closest('[data-hp-pad]'); st.zone = ['head', 'through'].includes(el.dataset.hpZone) ? el.dataset.hpZone : 'body';
      for (const b of root.querySelectorAll('[data-hp-zone]')) b.setAttribute('aria-checked', String(b.dataset.hpZone === st.zone)); preview(root);
    } else if (el.hasAttribute('data-hp-crit')) {
      const st = stateOf(el); st.crit = !st.crit; el.setAttribute('aria-checked', String(st.crit)); preview(el.closest('[data-hp-pad]'));
    } else if (el.hasAttribute('data-hp-take')) {
      const root = el.closest('[data-hp-pad]'), field = root?.querySelector('[data-hp-amount]'), st = stateOf(el), sp = t.sp?.() || {};
      const r = simpleHit({ hp: t.hp(), amount: field?.value, zone: st.zone, sp: st.zone === 'head' ? sp.head : sp.body, crit: st.crit, headMultiplier: headFactor() });
      if (!r.ok) { field?.focus?.(); return true; }
      if (change(t, r.hpAfter, 'damage')) { if (field) field.value = ''; st.crit = false; for (const b of root?.querySelectorAll?.('[data-hp-crit]') || []) b.setAttribute('aria-checked', 'false'); if (r.critical) say(tr(l, 'critNote')); } else say(tr(l, 'fail'));
      refresh();
    } else if (el.hasAttribute('data-hp-exact-set')) {
      const field = el.closest('[data-hp-pad]')?.querySelector('[data-hp-exact]'), v = field?.value;
      if (!/^-?\d+$/.test(String(v).trim())) { say(tr(l, 'fail')); return true; }
      const next = int(v, -999, 1000);
      if (next !== t.hp()) change(t, next, next < t.hp() ? 'correction' : 'damage');
    } else if (el.hasAttribute('data-hp-reason')) {
      const reason = el.dataset.hpReason === 'correction' ? 'correction' : 'damage';
      if (last && last.id === t.id && t.relabel?.(last, reason)) { last = { ...last, reason }; }
    } else if (el.hasAttribute('data-hp-undo')) {
      if (last && last.id === t.id && !fresh(last, t)) { last = null; say(tr(l, 'stale')); }
      else if (last && last.id === t.id) {
        const c = last; last = null;
        if (t.setHp(c.from, { reason: 'correction' }) !== false) { t.relabel?.({ ...c, to: c.from }, 'correction'); say(tr(l, 'undone') + ': ' + tr(l, 'changeLine', c.to, c.from)); }
      }
    }
    refresh();
    // A button that is gone after the change (the undo, a chip that was redrawn) must not leave the focus on the page.
    const a = doc.activeElement;
    if (!a || a === doc.body || a.isConnected === false) {
      const pad = padRoot?.isConnected ? padRoot : doc.querySelector('[data-hp-pad]');
      (chipSel && pad?.querySelector(chipSel) || pad?.querySelector('[data-hp-step="-1"]'))?.focus?.({ preventScroll: true });
    }
    return true;
  }

  // ---------- the modal ----------
  function ensureModal() {
    if (modal?.root?.isConnected) return modal;
    const backdrop = doc.createElement('div'); backdrop.className = 'hp-pad-backdrop'; backdrop.setAttribute('data-hp-pad-close', ''); backdrop.hidden = true;
    const root = doc.createElement('div'); root.className = 'hp-pad-pop'; root.hidden = true; root.setAttribute('role', 'dialog'); root.setAttribute('aria-modal', 'true'); root.setAttribute('tabindex', '-1');
    doc.body.appendChild(backdrop); doc.body.appendChild(root);
    modal = { backdrop, root, target: null, opener: null, state: { zone: 'body', crit: false } };
    return modal;
  }
  // Opens the pad for any target. opts: {opener, lang}. For the sheet's own target the dock's pad is opened instead.
  function open(target, opts = {}) {
    if (!doc || !target || typeof target.hp !== 'function' || typeof target.max !== 'function' || typeof target.setHp !== 'function') return false;
    if (target.dock && global.SheetTabs?.openHp) { global.SheetTabs.openHp(true); return true; }
    const l = opts.lang === 'en' || opts.lang === 'ru' ? opts.lang : lang();
    const m = ensureModal();
    m.target = target; m.opener = opts.opener || doc.activeElement || null; m.state = { zone: 'body', crit: false };
    m.root.setAttribute('aria-label', `${tr(l, 'title')}: ${target.name || ''}`.trim());
    m.root.innerHTML = `<header class="hp-pad-head"><h2>${esc(tr(l, 'title'))}${target.name ? ` · ${esc(target.name)}` : ''}</h2><button type="button" class="hp-pad-x" data-hp-pad-close aria-label="${esc(tr(l, 'close'))}">✕</button></header>${html(target, l, 'modal', m.state)}`;
    m.root.hidden = false; m.backdrop.hidden = false; doc.documentElement.classList.add('hp-pad-open');
    refreshPreview(m.root);
    (m.root.querySelector('[data-hp-amount]') || m.root).focus?.({ preventScroll: true });
    return true;
  }
  // A screen that redraws itself after the change (the tracker) replaces the button that opened the pad; the same button of
  // the new page is found again by its first data- attribute.
  function sameButton(el) {
    try {
      if (!el?.attributes) return null;
      for (const a of el.attributes) if (/^data-[\w-]+$/.test(a.name) && !a.name.startsWith('data-hp-') && a.value) return doc.querySelector(`[${a.name}="${String(a.value).replace(/["\\]/g, '\\$&')}"]`);
    } catch {}
    return null;
  }
  function close({ focus = true } = {}) {
    if (!modal || modal.root.hidden) return false;
    const opener = modal.opener; modal.root.hidden = true; modal.backdrop.hidden = true; modal.root.innerHTML = ''; modal.target = null; modal.opener = null;
    doc.documentElement.classList.remove('hp-pad-open');
    if (focus) {
      const page = el => { if (el && !el.hasAttribute?.('tabindex') && !/^(BUTTON|A|INPUT|SELECT|TEXTAREA)$/.test(el.tagName || '')) el.setAttribute?.('tabindex', '-1'); return el; };
      const list = [opener && opener.isConnected !== false ? opener : null, opener && opener.isConnected === false ? sameButton(opener) : null, doc.querySelector?.('[data-hud-hp]'), page(doc.querySelector?.('#app h1')), page(doc.querySelector?.('main'))];
      for (const el of list) { if (!el) continue; el.focus?.({ preventScroll: true }); if (doc.activeElement === el) return true; }
      doc.body?.focus?.();
    }
    return true;
  }
  const isOpen = () => !!modal && !modal.root.hidden;
  // A live modal follows what happens to its target (for the tracker, which redraws its rows on its own).
  function onKey(e) {
    if (!isOpen()) return;
    if (e.key === 'Escape') { e.preventDefault?.(); e.stopPropagation?.(); close(); return; }
    if (e.key === 'Tab') {
      const items = [...modal.root.querySelectorAll('button:not([disabled]),input:not([disabled]),[tabindex]:not([tabindex="-1"])')].filter(x => !x.hidden);
      if (!items.length) { e.preventDefault?.(); return; }
      const first = items[0], lastEl = items[items.length - 1], a = doc.activeElement;
      if (e.shiftKey && (a === first || a === modal.root)) { e.preventDefault?.(); lastEl.focus(); }
      else if (!e.shiftKey && (a === lastEl || !modal.root.contains(a))) { e.preventDefault?.(); first.focus(); }
    }
  }
  // The damage tool of the sheet redraws its form after «Применить»; the focus goes back to its damage field, not to the page.
  function keepHitFocus(e) {
    const b = e.target?.closest?.('[data-pc-hit="apply"]'), pad = b?.closest?.('[data-hp-pad]'); if (!pad) return;
    const back = () => {
      const a = doc.activeElement; if (a && a !== doc.body && a.isConnected !== false) return;
      const p = pad.isConnected ? pad : doc.querySelector('[data-hp-pad]');
      (p?.querySelector('[data-pc-hit="raw"],[data-hp-amount]') || p?.querySelector('[data-hp-step="-1"]'))?.focus?.({ preventScroll: true });
    };
    for (const ms of [0, 60, 250]) global.setTimeout?.(back, ms);
  }
  if (doc?.addEventListener) {
    doc.addEventListener('click', e => { try { onClick(e); } catch {} try { keepHitFocus(e); } catch {} });
    doc.addEventListener('keydown', onKey);
    doc.addEventListener('input', e => { const root = e.target?.closest?.('[data-hp-pad="modal"]'); if (root && e.target.hasAttribute('data-hp-amount')) preview(root); });
    doc.addEventListener('keydown', e => { if (e.key === 'Enter' && e.target?.hasAttribute?.('data-hp-amount')) { e.preventDefault?.(); e.target.closest('[data-hp-pad]')?.querySelector('[data-hp-take]')?.click?.(); } });
  }

  // The sheet reports every change of HP it makes (App.applyHp), so the line under the pad can name the reason or take it back.
  function noted(c, from, reason, medical) {
    if (!c || num(c.hp) === Math.trunc(num(from))) return;
    last = { id: c.id, from: Math.trunc(num(from)), to: num(c.hp), reason: num(c.hp) < num(from) ? (reason === 'correction' ? 'correction' : 'damage') : 'heal', medical: medical && typeof medical === 'object' ? medical : null };
  }
  global.HpPad = { noted, wound, stepHp, fill, simpleHit, relabelMedical, forCharacter, html, open, close, isOpen, refresh, onClick, change, last: () => last && { ...last }, forget() { last = null; }, T };
})(window);
