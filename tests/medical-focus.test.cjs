// The #/medical page keeps the tapped field focused after a redraw (site/medical-focus.js).
const { test } = require('node:test'), assert = require('node:assert/strict'), fs = require('node:fs');
test('the tapped medical field gets the focus back after a redraw', () => {
  const handlers = {}; let focused = null;
  const field = { disabled: false, type: 'number', getAttribute: k => (k === 'data-med-field' ? 'skill' : null), focus() { focused = this; }, select() {} };
  const body = {};
  const win = { document: { body, activeElement: body, addEventListener: (n, f) => { handlers[n] = f; }, querySelector: s => (s === '[data-med-field="skill"]' ? field : null) } };
  const src = fs.readFileSync(__dirname + '/../site/medical-focus.js', 'utf8');
  new Function('window', src)(win);
  handlers.pointerdown({ target: { closest: () => field } });
  assert.equal(win.MedicalFocus.restore(), true); assert.equal(focused, field);
  assert.equal(win.MedicalFocus.restore(), false, 'only once per tap');
  handlers.pointerdown({ target: { closest: () => field } });
  focused = null;
  assert.equal(win.MedicalFocus.restore('skill'), false, 'the field just left keeps no focus'); assert.equal(focused, null);
  handlers.pointerdown({ target: { closest: () => null } });
  assert.equal(win.MedicalFocus.restore(), false);
  assert.ok(fs.readFileSync(__dirname + '/../site/app.js', 'utf8').includes("window.MedicalFocus?.restore?.(e?.target?.getAttribute?.('data-med-field'))"));
  assert.ok(fs.readFileSync(__dirname + '/../site/index.html', 'utf8').includes('medical-focus.js'));
});

test('choosing a healer from the sheets pre-fills the stabilization modifier with the healer wound penalty', () => {
  const src = fs.readFileSync(__dirname + '/../site/medical-tools.js', 'utf8');
  assert.ok(src.includes("if(key==='practitioner'){const h=all.find(x=>x?.id===ui.practitioner)"));
  assert.ok(src.includes('PlayCombat?.condition?.(h)?.penalty'));
});
