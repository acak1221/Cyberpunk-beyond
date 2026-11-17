// Sheet scrolling helpers: the tab strip stays pinned while a long tab scrolls, the HUD gets compact on a phone,
// and a «Наверх» button appears after two screens. Pure rules are exported for tests; the DOM part only toggles classes.
(function (global) {
  'use strict';
  const doc = global.document;
  // Compact on the way down after 160 px, back to normal near the top (a gap, so the header does not flicker).
  function compactState(y, was) { return was ? y > 40 : y > 160; }
  function showTop(y, viewport) { return viewport > 0 && y > viewport * 2; }
  function lang() { try { const l = global.App?.lang?.(); if (l === 'en' || l === 'ru') return l; } catch {} return doc?.documentElement?.lang === 'en' ? 'en' : 'ru'; }
  global.SheetSticky = { compactState, showTop };
  if (!doc || !doc.addEventListener || !global.MutationObserver) return;

  let top = null, pin = null, queued = false;
  function topButton() {
    if (top && top.isConnected) return top;
    top = doc.createElement('button');
    top.type = 'button'; top.className = 'to-top'; top.hidden = true;
    top.addEventListener('click', () => { const r = global.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches; global.scrollTo({ top: 0, behavior: r ? 'auto' : 'smooth' }); });
    doc.body.appendChild(top);
    return top;
  }
  function pinBox() {
    if (pin && pin.isConnected) return pin;
    pin = doc.createElement('div'); pin.className = 'sheet-pin'; pin.hidden = true;
    doc.body.appendChild(pin);
    return pin;
  }
  // The compact HUD is one row that scrolls sideways (the fade at its right edge says so): no chip is hidden, so money, the lock and sleep
  // stay reachable. Only the «Your turn» marker is pulled into sight: it is scrolled to when it does not fit whole.
  function fitHud(dock) {
    const hud = dock.querySelector('.sheet-hud');
    if (!hud) return;
    for (const k of hud.children) k.classList.remove('hud-cut');
    if (!dock.classList.contains('dock-compact')) return;
    const turn = [...hud.children].find(k => k.hasAttribute('data-room-turn') && !k.hidden);
    if (turn && turn.getClientRects().length > 0 && turn.getBoundingClientRect().right > hud.getBoundingClientRect().right - 1 && !turn.dataset.hudSeen) {
      turn.dataset.hudSeen = '1';
      hud.scrollLeft = Math.max(0, turn.offsetLeft - hud.clientWidth + turn.offsetWidth + 8);
    } else if (turn && turn.dataset.hudSeen && turn.getBoundingClientRect().right <= hud.getBoundingClientRect().right) delete turn.dataset.hudSeen;
  }
  function update() {
    queued = false;
    const dock = doc.querySelector('.sheet-dock'), y = global.scrollY || 0;
    const btn = topButton(), ru = lang() === 'ru';
    const label = ru ? '↑ Наверх' : '↑ Top';
    if (btn.textContent !== label) { btn.textContent = label; btn.setAttribute('aria-label', ru ? 'Наверх' : 'Back to top'); }
    if (!dock) { btn.hidden = true; if (pin) pin.hidden = true; return; }
    btn.hidden = !showTop(y, global.innerHeight);
    const flat = global.getComputedStyle(dock).display === 'contents';
    // Phone and narrow screens: the dock itself is sticky, only the HUD gets smaller.
    dock.classList.toggle('dock-compact', !flat && compactState(y, dock.classList.contains('dock-compact')));
    fitHud(dock);
    // A row of chips that scrolls sideways says so with a fade at its right edge.
    const row = dock.querySelector('.sheet-hud');
    if (row) dock.classList.toggle('hud-overflow', row.scrollWidth > row.clientWidth + 2 && row.scrollLeft + row.clientWidth < row.scrollWidth - 2);
    // Wide «Досье»: the tabs are a cell of the board grid and cannot stick, so a copy stands at the top while they are out of sight.
    const tabs = dock.querySelector('.sheet-tabs');
    if (!flat || !tabs) { if (pin) pin.hidden = true; return; }
    const r = tabs.getBoundingClientRect(), box = pinBox();
    if (r.bottom > 0) { box.hidden = true; return; }
    // The «Your turn» marker of the HUD scrolls away with it, so the pinned copy carries it too.
    const turn = dock.querySelector('[data-room-turn]:not([hidden])'), src = tabs.innerHTML + (turn ? turn.outerHTML : '');
    if (box.dataset.src !== src) { box.innerHTML = '<div class="sheet-tabs" role="tablist">' + tabs.innerHTML + '</div>' + (turn ? turn.outerHTML : ''); box.dataset.src = src; }
    box.style.left = r.left + 'px'; box.style.width = r.width + 'px';
    box.hidden = false;
  }
  function queue() { if (!queued) { queued = true; (global.requestAnimationFrame || setTimeout)(update); } }
  global.addEventListener('scroll', queue, { passive: true });
  global.addEventListener('resize', queue);
  global.addEventListener('hashchange', queue);
  doc.addEventListener('click', () => setTimeout(queue, 60));
  // The page and the HUD are drawn again when HP or money change.
  new global.MutationObserver(queue).observe(doc.body, { childList: true, subtree: true });
})(window);
