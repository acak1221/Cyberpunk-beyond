// The roll chip: back/forward take it away, the keyboard can reach it and keeps it up, Escape closes it.
const { test } = require('node:test'), assert = require('node:assert/strict');
const { load, key } = require('./dialog-dom.cjs');

function setup() {
  const wl = {};
  const h = load(['roll-chip.js'], { addEventListener: (t, f) => { (wl[t] ||= []).push(f); } });
  const box = h.doc.el('div'); box.classList.add('roll-notice', 'visible'); h.doc.queries['#app-notice'] = box;
  const btn = h.doc.el('button'); btn.parent = box; box.queries.button = btn;
  const main = h.doc.el('div'); h.doc.queries['#main-content'] = main;
  return { ...h, wl, box, btn, main, C: h.win.RollChip, fireWin: t => (wl[t] || []).forEach(f => f({})) };
}

test('browser back and forward (popstate) and a hash change take the chip away', () => {
  for (const type of ['popstate', 'hashchange']) {
    const s = setup(); s.C.setScreen('a'); s.C.arm();
    assert.ok(s.wl[type]?.length, type + ' is listened to');
    s.fireWin(type); assert.equal(s.box.classList.contains('visible'), false, type);
  }
});

test('after a key press the chip is held for a while so a keyboard user can reach it; a pointer press ends that', () => {
  const s = setup(); s.C.setScreen('a'); s.C.arm();
  assert.equal(s.C.holds({ matches: () => false, contains: () => false }), false, 'a mouse user: not held');
  s.doc.fire('keydown', key('x'));
  assert.equal(s.C.holds({ matches: () => false, contains: () => false }), true, 'keyboard: held');
  s.doc.fire('pointerdown', {});
  assert.equal(s.C.holds({ matches: () => false, contains: () => false }), false);
});

test('Alt+J moves the focus to the chip; Escape in the chip closes it and the focus goes to the content', () => {
  const s = setup(); s.C.setScreen('a'); s.C.arm();
  const e = key('j', { altKey: true }); s.doc.fire('keydown', e);
  assert.equal(s.doc.activeElement, s.btn); assert.equal(e.prevented, 1);
  const esc = key('Escape'); s.doc.fire('keydown', esc);
  assert.equal(s.box.classList.contains('visible'), false); assert.equal(s.doc.activeElement, s.main); assert.equal(esc.prevented, 1);
  const none = key('j', { altKey: true }); s.doc.fire('keydown', none); assert.equal(none.prevented, 0, 'no chip showing: the key is left alone');
});

test('focus() is false without a roll chip or without a button', () => {
  const s = setup(); s.box.classList.remove('visible'); assert.equal(s.C.focus(), false);
  s.box.classList.add('visible'); s.box.queries.button = null; assert.equal(s.C.focus(), false);
});
