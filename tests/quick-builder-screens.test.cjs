// The quick builder in three screens: defaults pre-selected, one confirmation, optional native language and specialization,
// old five-step drafts, and the kit-to-inventory link of the Netrunner's cyberdeck (the NETRUN tab looks the deck up by catalog id).
const test = require('node:test'), assert = require('node:assert/strict'), fs = require('fs'), vm = require('vm'), path = require('path');
const base = path.join(__dirname, '../site');
global.window = global; global.confirm = () => true;
const source = fs.readFileSync(path.join(base, 'app.js'), 'utf8');
const m = source.match(/const SKILLS = \[[\s\S]*?\n\];/); assert(m);
const skills = vm.runInThisContext(m[0] + ';SKILLS');
for (const f of ['archetypes', 'rules', 'catalog', 'catalog-extra', 'wizard-steps', 'quick-builder', 'role-tools', 'netrun-deck', 'char-todo'])
  try { vm.runInThisContext(fs.readFileSync(path.join(base, f + '.js'), 'utf8'), { filename: f + '.js' }); } catch (e) { if (!/role-tools|netrun-deck|char-todo/.test(f)) throw e; }
let n = 0;
const ctx = (method, extra = {}) => ({ lang: 'en', skills, roles: window.ROLES, method, scopeId: 'qs-' + (++n), readDraft: () => undefined, saveDraft: () => true, createCharacter: c => c.id, ...extra });
const ev = (c, attrs, value = '', type = 'change', checked = false) => QuickBuilder.handle({ type, target: { value, checked, hasAttribute: k => Object.hasOwn(attrs, k), getAttribute: k => attrs[k], closest: () => null } }, c);
const act = (c, name, attrs = {}) => QuickBuilder.handle({ type: 'click', target: { closest: () => ({ getAttribute: k => k === 'data-quick-action' ? name : attrs[k] }) } }, c);
function quick(role, method = 'streetrat', name = 'Case') {
  const c = ctx(method); QuickBuilder.render(c);
  ev(c, { 'data-quick-field': 'name' }, name, 'input');
  if (role !== 'solo') ev(c, { 'data-quick-role': '' }, role);
  act(c, 'roll');
  return c;
}

test('every role is ready after a name, one roll and one confirmation', () => {
  for (const method of ['streetrat', 'edgerunner']) for (const role of Archetypes.roleIds) {
    const c = quick(role, method);
    const errs = QuickBuilder.analyze(c).errors;
    assert.deepEqual(errs.map(e => e.step), [1], role + ' ' + method + ': only the kit confirmation is left');
    assert.equal(errs[0].field, '[data-quick-confirm="confirmAll"]');
    ev(c, { 'data-quick-confirm': 'confirmAll' }, '', 'change', true);
    assert.deepEqual(QuickBuilder.analyze(c).errors, [], role + ' ' + method);
    assert.equal(QuickBuilder.toCharacter(c).ok, true);
  }
});

test('the native language and specializations never block Next and the sheet gets them empty', () => {
  const c = quick('medtech'); // medtech names a specialization skill
  const t = Archetypes.getTemplate('medtech');
  assert(t.streetratSkills.some(s => s.needsSpecialty));
  const html = QuickBuilder.render(c);
  assert.match(html, /Native language \(can wait\)/);
  assert.equal(act(c, 'next').focus, '[data-quick-progress] [aria-current="step"]', 'Next goes on without a native language');
  ev(c, { 'data-quick-confirm': 'confirmAll' }, '', 'change', true);
  const out = QuickBuilder.toCharacter(c);
  assert(out.ok); assert.equal(out.character.native, '');
  const specs = out.character.extra.specializations;
  assert(specs.length && specs.every(s => !s.name.includes('(')), 'an unnamed specialization is stored under the skill name');
});

test('the first screen carries Roll everything, the footer is Back/Next and the review has Create', () => {
  const c = quick('solo');
  let html = QuickBuilder.render(c);
  assert.match(html, /data-quick-action="roll"/); assert.match(html, /Roll everything/);
  assert.match(html, /class="quick-nav"[^>]*>(<span><\/span>)?<button class="btn" data-quick-action="next"/);
  assert.equal((html.match(/data-quick-step="/g) || []).length, 3, 'three steps');
  act(c, 'next'); html = QuickBuilder.render(c);
  assert.match(html, /data-quick-confirm="confirmAll"/); assert.match(html, /data-quick-action="back"/);
  assert.doesNotMatch(html, /data-quick-field="name"/);
});

test('kit variants are preselected and changing one clears the confirmation', () => {
  const c = quick('tech');
  const html = QuickBuilder.render(c);
  assert.doesNotMatch(html, /<option value="" selected/);
  ev(c, { 'data-quick-confirm': 'confirmAll' }, '', 'change', true);
  assert.deepEqual(QuickBuilder.analyze(c).errors, []);
  const r = ev(c, { 'data-quick-choice-section': 'gear', 'data-quick-choice-index': '0' }, '1');
  assert.equal(r.rerender, true); assert.match(r.focus, /data-quick-choice-section="gear"/);
  assert(QuickBuilder.analyze(c).errors.some(e => e.step === 1));
});

test('a draft saved by the five-step wizard opens on the matching screen', () => {
  for (const [old, now] of [[0, 0], [1, 0], [2, 0], [3, 1], [4, 2]]) {
    const data = { role: 'solo', name: 'Old', step: old, rolls: [4], confirmGear: true, confirmCyber: true };
    const c = ctx('streetrat', { scopeId: 'old' + old, readDraft: () => ({ version: 1, method: 'streetrat', data }) });
    assert(act(c, 'load').rerender);
    const html = QuickBuilder.render(c);
    assert.match(html, new RegExp('aria-current="step"[^>]*><span>' + (now + 1) + '</span>'));
  }
});

test('a draft written by the new wizard keeps its own step', () => {
  const store = {};
  const c = ctx('streetrat', { scopeId: 'newdraft', readDraft: m => store[m], saveDraft: (m, r) => (store[m] = JSON.parse(JSON.stringify(r)), true) });
  QuickBuilder.render(c); ev(c, { 'data-quick-field': 'name' }, 'N', 'input'); act(c, 'roll'); act(c, 'next');
  act(c, 'save'); assert.equal(store.streetrat.data.step, 1); assert.equal(store.streetrat.data.layout, 3);
  const d = ctx('streetrat', { scopeId: 'newdraft2', readDraft: m => store[m] });
  act(d, 'load'); assert.match(QuickBuilder.render(d), /aria-current="step"[^>]*><span>2<\/span>/);
});

test('a role change puts the new role defaults back and asks focus on the select', () => {
  const c = quick('solo');
  const r = ev(c, { 'data-quick-role': '' }, 'fixer');
  assert.equal(r.focus, '[data-quick-role]');
  const t = Archetypes.getTemplate('fixer');
  const a = QuickBuilder.analyze(c);
  assert.equal(a.template.role, 'fixer');
  assert(!a.errors.some(e => /Choose every/.test(e.en)), 'the fixer defaults are complete');
  assert(t.gear.some(x => x.type === 'choice'));
});

test('Netrunner kit: the cyberdeck and programs are linked to catalog items (NETRUN tab regression)', () => {
  const c = quick('netrunner');
  ev(c, { 'data-quick-confirm': 'confirmAll' }, '', 'change', true);
  const built = QuickBuilder.toCharacter(c);
  assert(built.ok);
  const items = built.character.extra.items;
  const deck = items.find(i => i.name === 'Cyberdeck (7 slots)');
  assert(deck, 'the kit lists the cyberdeck');
  assert.equal(deck.catalogId, 'gear-cyberdeck-standard-quality');
  assert(CATALOG.find(x => x.id === deck.catalogId).stats.slots === 7, 'the linked deck has seven slots');
  for (const p of ['Armor', 'Sword']) {
    const it = items.find(i => i.name === 'Program: ' + p);
    assert(it && CATALOG.some(x => x.id === it.catalogId), p + ' is linked to the catalog');
    assert.equal(it.catalogId, 'extra-program-' + p.toLowerCase());
  }
  // The NETRUN tab's own lookup finds the deck.
  assert(window.NetrunDeck?.ownedDecks, 'NetrunDeck loaded');
  {
    const owned = window.NetrunDeck.ownedDecks(built.character);
    assert.equal(owned.length, 1); assert.equal(owned[0].slots, 7);
  }
});

test('kit alias helper leaves other kit lines alone', () => {
  const c = quick('rockerboy');
  ev(c, { 'data-quick-confirm': 'confirmAll' }, '', 'change', true);
  const built = QuickBuilder.toCharacter(c);
  assert(built.ok);
  assert(!built.character.extra.items.some(i => /Cyberdeck/.test(i.name)));
});

test('what the quick builder leaves empty is exactly what the sheet checklist asks for', () => {
  const c = quick('medtech');
  ev(c, { 'data-quick-confirm': 'confirmAll' }, '', 'change', true);
  const x = QuickBuilder.toCharacter(c).character;
  const ids = window.CharTodo.items(x).map(i => i.id);
  assert.deepEqual(JSON.parse(JSON.stringify(ids)), ['native', 'spec', 'life']);
  // Filled in on the first screen, nothing is left but Lifepath.
  const d = quick('medtech');
  ev(d, { 'data-quick-field': 'native' }, 'English', 'input');
  for (const s of Archetypes.getTemplate('medtech').streetratSkills) if (s.needsSpecialty) ev(d, { 'data-quick-specialty': s.name }, 'Biology', 'input');
  ev(d, { 'data-quick-confirm': 'confirmAll' }, '', 'change', true);
  assert.deepEqual(JSON.parse(JSON.stringify(window.CharTodo.items(QuickBuilder.toCharacter(d).character).map(i => i.id))), ['life']);
});

test('a Netrunner quick-built before the link existed is repaired on load (idempotent), other lines stay', () => {
  const c = quick('netrunner');
  ev(c, { 'data-quick-confirm': 'confirmAll' }, '', 'change', true);
  const x = QuickBuilder.toCharacter(c).character;
  // The old save: the same sheet without catalog ids on the kit lines.
  for (const it of x.extra.items) if (it.name === 'Cyberdeck (7 slots)' || /^Program: /.test(it.name)) delete it.catalogId;
  assert.equal(window.NetrunDeck.ownedDecks(x).length, 0, 'the old save reproduces the bug');
  const n = QuickBuilder.repairKit(x);
  assert(n >= 1);
  assert.equal(window.NetrunDeck.ownedDecks(x).length, 1, 'the NETRUN tab sees the deck');
  assert.equal(QuickBuilder.repairKit(x), 0, 'a second run changes nothing');
  assert.equal(QuickBuilder.repairKit({ extra: { items: [{ name: 'Cyberdeck (7 slots)', localizedName: { en: 'Cyberdeck (7 slots)' } }], startingPack: {} } }), 0, 'a line that is not from the kit is left alone');
  assert.equal(QuickBuilder.repairKit(null), 0);
});

test('app.js repairs the kit while it reads an archive', () => {
  assert(/keepChar=c=>\{[^\n]*repairKit/.test(source), 'keepChar calls QuickBuilder.repairKit');
});

test('the done screen puts focus on the sheet button and the footer clears the dice button', () => {
  const c = quick('solo'); ev(c, { 'data-quick-confirm': 'confirmAll' }, '', 'change', true);
  const r = act(c, 'create');
  assert(r.created.length > 0);
  assert.equal(r.focus, '[data-quick-action="open-sheet"]');
  const html = QuickBuilder.render(c);
  assert.match(html, /data-quick-action="open-sheet"/); assert.doesNotMatch(html, /Статус сохранения показан вверху|See the save status above/);
  const css = fs.readFileSync(path.join(base, 'quick-builder.css'), 'utf8');
  assert.match(css, /\.quick-nav\{padding-right:74px\}/, 'room for the dice button');
  assert.match(css, /\.quick-nav\{position:sticky;bottom:0/); assert.match(css, /bottom:calc\(60px/);
  assert.match(css, /#b8322c/, 'the main buttons use the deeper red');
});

test('Complete Package: the native language is optional and the footer is sticky', () => {
  const css = fs.readFileSync(path.join(base, 'builder.css'), 'utf8');
  assert.match(css, /\.builder-nav\{position:sticky;bottom:0/); assert.match(css, /builder-title\{margin:6px 0;font-size:1\.25rem/);
  const js = fs.readFileSync(path.join(base, 'builder.js'), 'utf8');
  assert.doesNotMatch(js, /Enter your native language/);
});
