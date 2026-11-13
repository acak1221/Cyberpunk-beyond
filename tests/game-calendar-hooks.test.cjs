// The real hooks of the tools into the game calendar (no manual consume): therapy week, drug hours, per-drug marks,
// "Not now" on rent, unpaid months, the prefilled dates of the therapy and substance cards.
const { test } = require('node:test'), assert = require('node:assert/strict'), fs = require('node:fs'), vm = require('node:vm');
const site = f => fs.readFileSync(__dirname + '/../site/' + f, 'utf8');
function load(files) {
  const w = { confirm: () => true }, ctx = { window: w, Math, JSON, Number, String, Array, Object, Date, Map, Set, WeakMap, setTimeout: () => 0, structuredClone };
  vm.createContext(ctx);
  for (const f of files) vm.runInContext(site(f), ctx);
  return w;
}
const ALL = ['wallet.js', 'medical-tools.js', 'therapy-tools.js', 'dose-stock.js', 'drug-tools.js', 'lifestyle-tools.js', 'hustle-tools.js', 'crafting-tools.js', 'maker-projects.js', 'game-calendar.js'];
const cal = (date, marks) => ({ version: 1, date, marks });

function therapySetup(w, c) {
  const M = w.TherapyTools; M.setScope(null); M.setScope('s');
  const ctx = { lang: 'en', characters: [c], isCurrent: (x, s) => x === c && s === 's' }, root = { isConnected: true };
  const button = { isConnected: true, dataset: { therapyAction: 'roll' }, closest: s => (s === '[data-therapy-root]' ? root : null) };
  const event = { type: 'click', target: { closest: s => (s === '[data-therapy-action]' ? button : null) } };
  M.render(ctx);
  return { M, ctx, button, event, field: (key, value) => M.handle({ type: 'change', target: { dataset: { therapyField: key }, value, checked: value === true } }, ctx) };
}
function drugSetup(w, c) {
  const D = w.DrugTools; D.setScope(null); D.setScope('s'); D.render(c, 'en');
  const root = { isConnected: true };
  return {
    D,
    field: (key, value) => D.handle({ type: 'change', target: { dataset: { drugField: key }, value, closest: s => (s === '[data-drug-root]' ? root : null) } }, c, 'en', { isCurrent: () => true }),
    act(op) { const b = { isConnected: true, dataset: { drugAction: op }, closest: s => (s === '[data-drug-root]' ? root : null) }; return D.handle({ type: 'click', target: { closest: s => (s === '[data-drug-root]' ? root : s === '[data-drug-action]' ? b : null) } }, c, 'en', { isCurrent: () => true }); },
  };
}
const person = extra => ({ id: 'p', hp: 30, humanity: 30, stats: { EMP: 6, WILL: 6 }, skills: { 'Resist Torture/Drugs': 6 }, extra: { cash: 5000, equipment: { maxHumanity: 38 }, ...extra } });

test('therapy apply moves the therapy mark by one week', () => {
  const w = load(ALL), c = person({ calendar: cal('2045-03-26', { heal: '2045-03-26', therapy: '2045-03-05', hustle: '2045-03-26', drugs: '2045-03-26' }) });
  const x = therapySetup(w, c), old = Math.random; Math.random = () => 0.99;
  try {
    x.field('tech', '8'); x.field('skill', '6'); x.field('ack', true);
    assert.equal(x.M.handle(x.event, x.ctx).rerender, true);
    x.button.dataset.therapyAction = 'apply';
    assert.equal(x.M.handle(x.event, x.ctx).dirty, true);
  } finally { Math.random = old; }
  assert.equal(c.extra.calendar.marks.therapy, '2045-03-12');
});

test('therapy: the calendar date stays in the field after the drug is chosen', () => {
  const w = load(ALL), c = person({ calendar: cal('2045-03-15', { heal: '2045-03-15', therapy: '2045-03-15', hustle: '2045-03-15', drugs: '2045-03-15' }), streetDrugs: { version: 1, records: { 'blue-glass': { status: 'resolved', remainingHours: 0, addicted: true, yearVulnerability: false, lastCheck: null } } } });
  const x = therapySetup(w, c);
  assert.equal(x.M.prefill({ patient: 'p', gameDate: '2045-03-15' }), true);
  x.field('type', 'addiction'); x.field('drug', 'blue-glass');
  assert.match(x.M.render(x.ctx), /data-therapy-field="gameDate"[^>]*value="2045-03-15"/);
});

test('each active drug has its own mark: advancing one does not move the other', () => {
  const w = load(ALL), G = w.GameCalendar;
  const c = person({ calendar: cal('2045-03-04', { heal: '2045-03-04', therapy: '2045-03-04', hustle: '2045-03-04', drugs: '2045-03-01' }), streetDrugs: { version: 1, records: {
    'black-lace': { status: 'active', remainingHours: 50, addicted: false, yearVulnerability: false, lastCheck: null },
    'blue-glass': { status: 'active', remainingHours: 100, addicted: false, yearVulnerability: false, lastCheck: null } } } });
  const rows = G.due(c).filter(r => r.kind === 'drugs');
  assert.deepEqual(JSON.parse(JSON.stringify(rows.map(r => [r.drug, r.hours, r.elapsed]))), [['black-lace', 50, 72], ['blue-glass', 72, 72]]);
  const h = drugSetup(w, c); h.field('drug', 'black-lace'); h.field('hours', '50');
  assert.equal(h.act('advance').dirty, true);
  assert.equal(c.extra.calendar.marks['drug:black-lace'], '2045-03-03');
  const left = G.due(c).filter(r => r.kind === 'drugs');
  assert.deepEqual(JSON.parse(JSON.stringify(left.map(r => [r.drug, r.elapsed]))), [['blue-glass', 72]]);
  // read() accepts the per-drug marks and a mark in the future is rejected
  assert.equal(G.read(c).kind, 'ok');
  c.extra.calendar.marks['drug:blue-glass'] = '2046-01-01'; assert.equal(G.read(c).kind, 'invalid');
});

test('a new dose starts counting today, setDate drops marks of drugs no longer active', () => {
  const w = load(ALL), G = w.GameCalendar;
  const c = person({ calendar: cal('2045-03-10', { heal: '2045-03-10', therapy: '2045-03-10', hustle: '2045-03-10', drugs: '2045-03-01' }), streetDrugs: { version: 1, records: { 'black-lace': { status: 'active', remainingHours: 500, addicted: false, yearVulnerability: false, lastCheck: null } } } });
  c.extra.items = [{ id: 'r-bg', catalogId: 'extra-drug-blue-glass', name: 'Blue Glass', category: 'equipment', quantity: 1, notes: '' }];
  const h = drugSetup(w, c); h.field('drug', 'blue-glass'); assert.equal(h.act('dose').dirty, true);
  assert.equal(c.extra.calendar.marks['drug:blue-glass'], '2045-03-10');
  assert.equal(G.due(c).some(r => r.drug === 'blue-glass'), false);
  c.extra.streetDrugs.records['blue-glass'].status = 'resolved';
  const next = G.setDate(G.read(c).value, '2045-03-11', c);
  assert.equal(Object.hasOwn(next.marks, 'drug:blue-glass'), false);
});

test('unpaid months pile up from the start of the calendar, "Not now" only snoozes this month', () => {
  const w = load(ALL), G = w.GameCalendar, c = person({ calendar: G.start('2045-03-10') });
  assert.equal(G.due(c).some(r => r.key === 'living'), false);
  for (let i = 0; i < 4; i++) c.extra.calendar = G.advance(c.extra.calendar, 'month', c);
  let row = G.due(c).find(r => r.key === 'living'); assert.ok(row);
  assert.equal(row.months, 4); assert.match(row.text, /2045-04 … 2045-07 \(4 мес\.\)/); assert.equal(row.total, 100);
  assert.equal(w.LifestyleTools.view(c).period, '2045-04');
  assert.equal(G.skip(c, 'living'), true);
  assert.equal(G.due(c).some(r => r.key === 'living'), false);
  assert.equal(G.due(c).some(r => r.key === 'living-grace'), true, 'the grace warning is not snoozed');
  assert.equal(c.extra.calendar.marks.living, '2045-03');
  c.extra.calendar = G.advance(c.extra.calendar, 'month', c);
  row = G.due(c).find(r => r.key === 'living'); assert.ok(row); assert.equal(row.months, 5);
});

test('substances card follows the calendar date until the player edits the field', () => {
  const w = load(ALL), G = w.GameCalendar;
  const c = person({ calendar: G.start('2045-03-01'), streetDrugs: { version: 1, records: { 'black-lace': { status: 'resolved', remainingHours: 0, addicted: true, yearVulnerability: false, lastCheck: null } } } });
  const h = drugSetup(w, c); h.field('drug', 'black-lace');
  assert.match(w.DrugTools.render(c, 'en'), /data-drug-field="gameDate" value="2045-03-01"/);
  c.extra.calendar = G.advance(c.extra.calendar, 'month', c);
  assert.match(w.DrugTools.render(c, 'en'), /data-drug-field="gameDate" value="2045-04-01"/);
  h.field('gameDate', '2045-05-05'); c.extra.calendar = G.advance(c.extra.calendar, 'month', c);
  assert.match(w.DrugTools.render(c, 'en'), /data-drug-field="gameDate" value="2045-05-05"/);
});
