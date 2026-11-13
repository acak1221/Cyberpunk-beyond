// Keeps the tapped field of the #/medical page focused when the page redraws after the previous field changed.
(function (global) {
  'use strict';
  let tapped = null;
  const doc = global.document;
  function note(event) {
    try {
      const el = event.target && event.target.closest && event.target.closest('[data-med-field]');
      tapped = el ? { key: el.getAttribute('data-med-field'), at: Date.now() } : null;
    } catch { tapped = null; }
  }
  if (doc && doc.addEventListener) {
    doc.addEventListener('pointerdown', note, true);
    doc.addEventListener('touchstart', note, true);
  }
  // Called after the redraw: gives the focus to the field that was tapped just before it.
  function restore() {
    try {
      const t = tapped; tapped = null;
      if (!t || Date.now() - t.at > 1000 || !doc) return false;
      const a = doc.activeElement;
      if (a && a !== doc.body && a.getAttribute && a.getAttribute('data-med-field') === t.key) return false;
      const el = doc.querySelector('[data-med-field="' + String(t.key).replace(/["\\]/g, '') + '"]');
      if (!el || el.disabled) return false;
      el.focus({ preventScroll: true });
      if (typeof el.select === 'function' && el.type === 'number') try { el.select(); } catch { /* not selectable */ }
      return true;
    } catch { return false; }
  }
  global.MedicalFocus = { restore };
})(window);
