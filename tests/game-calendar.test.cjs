// Game calendar: pure date math, state, due items per kind, the "never changes anything else" promise, handlers.
const { test } = require('node:test'), assert = require('node:assert/strict'), fs = require('node:fs'), vm = require('node:vm');
const site = f => fs.readFileSync(__dirname + '/../site/' + f, 'utf8');
const FILES = ['wallet.js', 'medical-tools.js', 'therapy-tools.js', 'drug-tools.js', 'lifestyle-tools.js', 'hustle-tools.js', 'crafting-tools.js', 'maker-projects.js', 'game-calendar.js'];
function load(files = FILES) {
  const w = { confirm: () => true }, ctx = { window: w, Math, JSON, Number, String, Array, Object, Date, Map, Set, WeakMap, setTimeout: () => 0, structuredClone };
  vm.createContext(ctx);
  for (const f of files) vm.runInContext(site(f), ctx);
  w.MedicalTools.setScope('s'); w.TherapyTools.setScope('s'); w.DrugTools.setScope('s'); w.MakerProjects.setScope('s');
  return w;
}
const plain = x => JSON.parse(JSON.stringify(x));
const { GameCalendar: G, MedicalTools: M } = (() => { const w = load(); return w; })();
const cal = (date, marks) => ({ version: 1, date, ...(marks ? { marks } : {}) });
// stabilized wounded character, BODY 8, WILL 6: max HP 10+5*7 = 45
function hurt(extra = {}) { return { id: 'v', name: 'Vi', role: 'solo', rank: 4, hp: 12, humanity: 60, stats: { BODY: 8, WILL: 6, EMP: 6, INT: 5, REF: 6, DEX: 6, TECH: 4, COOL: 5, LUCK: 5, MOVE: 5 }, extra: { medical: { version: 1, stabilized: true, stabilizedHp: 12 }, calendar: cal('2045-03-12', { heal: '2045-03-10' }), ...extra } }; }
const ev = (type, map, detail = 1) => ({ type, detail, target: { closest: s => map[s] || null, dataset: {}, value: '' } });
const btn = (attr, value, extra = {}) => ({ dataset: { [attr]: value }, ...extra });

test('date math: parse, addDays, addMonths, diffDays, format', () => {
  assert.equal(G.parse('2045-02-29'), null); assert.equal(G.parse('1899-12-31'), null); assert.equal(G.parse('2045-1-1'), null); assert.equal(G.parse('abc'), null); assert.equal(G.parse(20450101), null);
  assert.deepEqual(plain(G.parse('2044-02-29')), { y: 2044, m: 2, d: 29 });
  assert.equal(G.addMonths('2045-01-31', 1), '2045-02-28'); assert.equal(G.addMonths('2044-01-31', 1), '2044-02-29'); assert.equal(G.addMonths('2045-12-15', 1), '2046-01-15'); assert.equal(G.addMonths('2045-01-15', -1), '2044-12-15');
  assert.equal(G.addDays('2045-12-31', 1), '2046-01-01'); assert.equal(G.addDays('2044-02-28', 1), '2044-02-29'); assert.equal(G.addDays('2045-02-28', 1), '2045-03-01');
  assert.equal(G.addDays('9999-12-31', 1), ''); assert.equal(G.addMonths('9999-12-31', 1), ''); assert.equal(G.addDays('1900-01-01', -1), '');
  assert.equal(G.diffDays('2044-12-30', '2045-01-02'), 3); assert.equal(G.diffDays('2045-01-02', '2044-12-30'), -3); assert.equal(G.diffDays('x', '2045-01-02'), null);
  assert.equal(G.format('2045-03-12', 'ru'), '12.03.2045'); assert.equal(G.format('2045-03-12', 'en'), '2045-03-12'); assert.equal(G.format('bad', 'ru'), '');
  assert.equal(G.month('2045-03-12'), '2045-03'); assert.equal(G.monthsBetween('2045-02', '2045-04'), 2); assert.equal(G.monthsBetween('2044-11', '2045-02'), 3);
});

test('start, advance and setDate are pure; backward clamps marks; the range is guarded', () => {
  const s = G.start('2045-03-12');
  assert.deepEqual(plain(s), { version: 1, date: '2045-03-12', marks: { heal: '2045-03-12', hustle: '2045-03-12', therapy: '2045-03-12', drugs: '2045-03-12', living: '2045-03' } });
  assert.equal(G.start('2045-02-30'), null);
  const before = JSON.stringify(s), n = G.advance(s, 'week', {});
  assert.equal(JSON.stringify(s), before); assert.equal(n.date, '2045-03-19');
  assert.equal(G.advance(s, 'month', {}).date, '2045-04-12'); assert.equal(G.advance(s, 'day', {}).date, '2045-03-13');
  assert.equal(G.advance(cal('9999-12-31'), 'day', {}), null); assert.equal(G.advance(s, 'year', {}), null);
  const back = G.setDate(cal('2045-04-12', { heal: '2045-04-10', living: '2045-04' }), '2045-03-01', {});
  assert.equal(back.date, '2045-03-01'); assert.equal(back.marks.heal, '2045-03-01'); assert.equal(back.marks.living, '2045-03');
  assert.equal(G.setDate(s, 'nope', {}), null);
});

test('follow: an unwounded character keeps marks at the date, a stabilized wounded one accumulates', () => {
  const healthy = hurt(); healthy.hp = 45; healthy.extra.medical.stabilizedHp = 45;
  const a = G.advance(healthy.extra.calendar, 'week', healthy);
  assert.equal(a.marks.heal, a.date);
  const w = hurt(), b = G.advance(w.extra.calendar, 'week', w);
  assert.equal(b.marks.heal, '2045-03-10');
  const unstable = hurt(); unstable.extra.medical = { version: 1, stabilized: false, stabilizedHp: 12 };
  assert.equal(G.advance(unstable.extra.calendar, 'day', unstable).marks.heal, '2045-03-13');
  const dead = hurt({ deathRecord: { version: 1, dead: true } });
  assert.equal(G.advance(dead.extra.calendar, 'day', dead).marks.heal, '2045-03-13');
});

test('read: off, ok, invalid', () => {
  assert.equal(G.read({}).kind, 'off'); assert.equal(G.read({ extra: {} }).kind, 'off'); assert.equal(G.read(null).kind, 'off');
  assert.equal(G.read({ extra: { calendar: cal('2045-03-12') } }).kind, 'ok');
  for (const bad of [null, 5, { version: 2, date: '2045-03-12' }, { version: 1, date: '2045-02-30' }, cal('2045-03-12', { heal: '2045-03-13' }), cal('2045-03-12', { heal: 'x' }), cal('2045-03-12', { living: '2045-04' }), { version: 1, date: '2045-03-12', marks: [] }])
    assert.equal(G.read({ extra: { calendar: bad } }).kind, 'invalid', JSON.stringify(bad));
  assert.equal(G.read({ extra: [] }).kind, 'invalid');
  assert.equal(G.dateOf({ extra: { calendar: cal('2045-03-12') } }), '2045-03-12'); assert.equal(G.dateOf({}), '');
});

test('due: heal text carries BODY x days, only for a stabilized wounded character', () => {
  const c = hurt(), items = G.due(c);
  const h = items.find(x => x.key === 'heal');
  assert.ok(h); assert.equal(h.days, 2); assert.match(h.text, /Отдых: 2 дн\. — до \+16 HP \(BODY 8 × дни\), HP 12 \/ 45/);
  assert.match(G.due(c, { lang: 'en' }).find(x => x.key === 'heal').text, /Rest: 2 d/);
  const none = hurt(); none.extra.calendar = cal('2045-03-12', { heal: '2045-03-12' });
  assert.equal(G.due(none).some(x => x.key === 'heal'), false);
  const low = hurt(); low.hp = 0; assert.equal(G.due(low).some(x => x.key === 'heal'), false);
});

test('due: therapy for lost Humanity and for addiction, weeks counted', () => {
  const c = hurt(); c.humanity = 52; c.extra.calendar = cal('2045-03-26', { therapy: '2045-03-12' });
  c.extra.equipment = { maxHumanity: 60 };
  const t = G.due(c).find(x => x.key === 'therapy');
  assert.ok(t); assert.equal(t.weeks, 2); assert.match(t.text, /Humanity 52 \/ 60/);
  const full = hurt(); full.humanity = 60; full.extra.equipment = { maxHumanity: 60 }; full.extra.calendar = cal('2045-03-26', { therapy: '2045-03-12' });
  assert.equal(G.due(full).some(x => x.key === 'therapy'), false);
  full.extra.streetDrugs = { version: 1, records: { 'black-lace': { status: 'resolved', remainingHours: 0, addicted: true, yearVulnerability: false, lastCheck: null } } };
  const a = G.due(full).find(x => x.key === 'therapy');
  assert.ok(a, 'addiction counts'); assert.match(a.text, /зависимость: /);
});

test('due: hustle weeks, drugs hours, drug year', () => {
  const c = hurt(); c.extra.calendar = cal('2045-03-26', { heal: '2045-03-26', hustle: '2045-03-12', drugs: '2045-03-25' });
  const hu = G.due(c).find(x => x.key === 'hustle'); assert.ok(hu); assert.equal(hu.weeks, 2);
  c.extra.streetDrugs = { version: 1, records: { 'black-lace': { status: 'active', remainingHours: 20, addicted: false, yearVulnerability: false, lastCheck: null } } };
  const d = G.due(c).find(x => x.key === 'drugs'); assert.ok(d); assert.equal(d.hours, 20); assert.equal(d.elapsed, 24); assert.match(d.text, /осталось 20 ч; прошло 24 ч/);
  c.extra.calendar = cal('2045-03-26', { heal: '2045-03-26', hustle: '2045-03-26', drugs: '2045-03-19' });
  c.extra.streetDrugs.records['black-lace'].remainingHours = 500;
  assert.equal(G.due(c).find(x => x.key === 'drugs').hours, 168);
  const y = hurt(); y.extra.calendar = cal('2046-03-10', { heal: '2046-03-10', hustle: '2046-03-10', drugs: '2046-03-10', therapy: '2046-03-10', living: '2045-03' });
  y.extra.streetDrugs = { version: 1, records: { 'black-lace': { status: 'resolved', remainingHours: 0, addicted: false, yearVulnerability: true, therapyYear: { version: 1, start: '2045-03-05', end: '2046-03-05' }, lastCheck: null } } };
  const row = G.due(y).find(x => x.key === 'drug-year:black-lace'); assert.ok(row); assert.equal(row.skippable, false); assert.match(row.text, /05\.03\.2046/);
  y.extra.calendar = cal('2046-03-04', { heal: '2046-03-04', hustle: '2046-03-04', drugs: '2046-03-04', therapy: '2046-03-04', living: '2046-03' });
  assert.equal(G.due(y).some(x => x.kind === 'drug-year'), false);
});

test('due: lifestyle months behind, grace warning from day 8 and not on day 7', () => {
  const c = hurt(); c.extra.cash = 5000; c.extra.calendar = cal('2045-04-12', { heal: '2045-04-12', living: '2045-01' });
  c.extra.living = { version: 1, log: [], current: { period: '2045-02', life: 'generic', home: 'shared' } };
  const l = G.due(c).find(x => x.key === 'living'); assert.ok(l); assert.equal(l.months, 3); assert.match(l.text, /2045-02 … 2045-04 \(3 мес\.\)/);
  assert.equal(G.due(c).some(x => x.key === 'living-grace'), true);
  const a = hurt(); a.extra.calendar = cal('2045-04-07', { heal: '2045-04-07', living: '2045-03' });
  a.extra.living = { version: 1, log: [], current: { period: '2045-04', life: 'generic', home: 'shared' } };
  assert.equal(G.due(a).some(x => x.key === 'living'), true); assert.equal(G.due(a).some(x => x.key === 'living-grace'), false);
  a.extra.calendar = cal('2045-04-08', { heal: '2045-04-08', living: '2045-03' });
  assert.equal(G.due(a).some(x => x.key === 'living-grace'), true);
  // just started: the current month counts as settled
  const s = hurt(); s.extra.calendar = G.start('2045-04-08');
  assert.equal(G.due(s).some(x => x.key === 'living'), false);
});

test('due: finished Maker projects', () => {
  const c = hurt(); c.extra.calendar = cal('2045-03-14', { heal: '2045-03-14' });
  const p = (id, over) => ({ id, name: 'Глушитель', op: 'fabricate', category: 'costly', price: 0, status: 'passed', rolls: [{ tech: 6, skill: 4, specialty: 4, modifier: 0, die: 5, extra: 0, total: 19, dv: 13, success: true }], readyOn: '2045-03-14', ...over });
  c.extra.makerProjects = { version: 1, projects: [p('a'), p('b', { readyOn: '2045-03-15' }), p('c', { delivered: true }), p('d', { readyOn: undefined })] };
  const m = G.due(c).filter(x => x.kind === 'maker'); assert.deepEqual(plain(m.map(x => x.key)), ['maker:a']); assert.match(m[0].text, /Глушитель.*14\.03\.2045/);
});

test('readyOn per unit; campaignOf picks the latest campaign date', () => {
  const c = { id: 'v', extra: { calendar: cal('2045-01-31') } };
  assert.equal(G.readyOn(c, { unit: 'hour', amount: 6 }), '2045-01-31'); assert.equal(G.readyOn(c, { unit: 'day', amount: 1 }), '2045-02-01');
  assert.equal(G.readyOn(c, { unit: 'week', amount: 2 }), '2045-02-14'); assert.equal(G.readyOn(c, { unit: 'month', amount: 1 }), '2045-02-28');
  assert.equal(G.readyOn(c, { unit: 'per10000', price: 25000 }), '2045-04-30'); assert.equal(G.readyOn({ id: 'x' }, { unit: 'day', amount: 1 }), '');
  const ks = [{ id: 1, gameDate: '2045-05-01', roster: [{ kind: 'pc', characterId: 'v' }] }, { id: 2, gameDate: '2045-06-01', roster: [{ kind: 'pc', characterId: 'v' }] }, { id: 3, gameDate: '2046-01-01', roster: [{ kind: 'npc', characterId: 'v' }] }, { id: 4, gameDate: 'bad', roster: [{ kind: 'pc', characterId: 'v' }] }];
  assert.equal(G.campaignOf(c, ks).id, 2); assert.equal(G.campaignOf({ id: 'z' }, ks), null);
});

test('due, advance, render and short never change anything but extra.calendar', () => {
  const c = hurt(); c.cash = 1; c.extra.cash = 500; c.extra.walletLog = [{ n: 1 }];
  c.extra.makerProjects = { version: 1, projects: [] };
  const snap = JSON.stringify(c);
  G.due(c); G.render(c, 'ru', []); G.short(c, 'en'); G.sessionLine(c, 'ru');
  assert.equal(JSON.stringify(c), snap);
  const next = G.advance(c.extra.calendar, 'month', c);
  assert.equal(JSON.stringify(c), snap);
  c.extra.calendar = next;
  const keep = plain({ ...c, extra: { ...c.extra, calendar: 0 } });
  G.consume(c, 'heal', 1); G.skip(c, 'hustle');
  assert.deepEqual(plain({ ...c, extra: { ...c.extra, calendar: 0 } }), keep);
});

test('consume: clamps to the date, no-op without a calendar, leaves an invalid one alone', () => {
  const c = hurt();
  assert.equal(G.consume(c, 'heal', 1), true); assert.equal(c.extra.calendar.marks.heal, '2045-03-11');
  assert.equal(G.consume(c, 'heal', 50), true); assert.equal(c.extra.calendar.marks.heal, '2045-03-12');
  assert.equal(G.consume(c, 'nope', 1), false); assert.equal(G.consume(c, 'heal', 0), false);
  const off = { id: 'o', extra: { cash: 1 } }; assert.equal(G.consume(off, 'heal', 1), false); assert.deepEqual(plain(off), { id: 'o', extra: { cash: 1 } });
  const bad = { id: 'b', extra: { calendar: { version: 9 } } }; assert.equal(G.consume(bad, 'heal', 1), false); assert.deepEqual(plain(bad.extra.calendar), { version: 9 });
  assert.equal(G.consume({ id: 'q', extra: [] }, 'heal', 1), false);
  assert.equal(G.skip(c, 'living'), true); assert.equal(c.extra.calendar.marks.living, '2045-03');
});

test('catchUp: starts without backlog, moves earlier dates forward, never backward', () => {
  const off = { id: 'o', extra: {} }; assert.equal(G.catchUp(off, '2045-05-01'), true);
  assert.deepEqual(plain(off.extra.calendar), plain(G.start('2045-05-01')));
  const early = hurt(); early.extra.calendar = cal('2045-03-01', { heal: '2045-02-20' });
  assert.equal(G.catchUp(early, '2045-03-10'), true); assert.equal(early.extra.calendar.date, '2045-03-10'); assert.equal(early.extra.calendar.marks.heal, '2045-02-20');
  const later = hurt(); assert.equal(G.catchUp(later, '2045-03-01'), false); assert.equal(later.extra.calendar.date, '2045-03-12');
  assert.equal(G.catchUp({ id: 'x', extra: { calendar: { version: 3 } } }, '2045-03-01'), false);
  assert.equal(G.catchUp({ id: 'x', extra: 5 }, '2045-03-01'), false);
});

test('handle: stale sheet changes nothing; double click advances once; undo restores and is refused after other changes', () => {
  const c = hurt(), opts = { isCurrent: x => x === c, campaigns: [] };
  const step = (kind, detail = 1) => ev('click', { '[data-cal-step]': btn('calStep', kind) }, detail);
  const snap = JSON.stringify(c);
  let r = G.handle(step('day'), c, 'ru', { isCurrent: () => false });
  assert.equal(r.handled, true); assert.equal(JSON.stringify(c), snap); assert.match(r.notify, /Данные изменились/);
  r = G.handle(step('day', 2), c, 'ru', opts); assert.equal(r.handled, true); assert.equal(JSON.stringify(c), snap);
  r = G.handle(step('day'), c, 'ru', opts);
  assert.equal(r.dirty, true); assert.equal(c.extra.calendar.date, '2045-03-13'); assert.match(r.notify, /Дата игры: 12\.03 → 13\.03\.2045\. Дела: отдых 3 дн\./);
  assert.match(G.render(c, 'ru', []), /data-cal-undo/);
  r = G.handle(ev('click', { '[data-cal-undo]': btn('calUndo', '') }), c, 'ru', opts);
  assert.equal(r.dirty, true); assert.equal(c.extra.calendar.date, '2045-03-12'); assert.equal(JSON.stringify(c), snap);
  // undo refused after another change
  G.handle(step('week'), c, 'ru', opts); G.consume(c, 'heal', 1);
  const mid = JSON.stringify(c);
  r = G.handle(ev('click', { '[data-cal-undo]': btn('calUndo', '') }), c, 'ru', opts);
  assert.equal(r.dirty, undefined); assert.equal(JSON.stringify(c), mid); assert.doesNotMatch(G.render(c, 'ru', []), /data-cal-undo/);
});

test('handle: start, date input, range, skip and open rows', () => {
  const c = { id: 'n', name: 'N', extra: {} }, opts = { isCurrent: x => x === c, campaigns: [] };
  assert.match(G.render(c, 'ru', []), /Дата игры не задана\..*Начать с 01\.01\.2045/s); assert.equal(c.extra.calendar, undefined);
  let r = G.handle(ev('click', { '[data-cal-start]': btn('calStart', '2045-01-01') }), c, 'ru', opts);
  assert.equal(r.dirty, true); assert.equal(c.extra.calendar.date, '2045-01-01');
  const input = d => { const i = { dataset: {}, value: d }; return { type: 'change', target: { closest: s => (s === '[data-cal-date]' ? i : null), dataset: {}, value: d } }; };
  r = G.handle(input('2045-02-30'), c, 'ru', opts); assert.equal(r.dirty, undefined); assert.equal(c.extra.calendar.date, '2045-01-01');
  r = G.handle(input('2045-06-01'), c, 'ru', opts); assert.equal(c.extra.calendar.date, '2045-06-01');
  c.extra.calendar = cal('9999-12-31'); r = G.handle(ev('click', { '[data-cal-step]': btn('calStep', 'day') }), c, 'ru', opts); assert.match(r.notify, /вне диапазона/);
  // skip: a row that is not due is refused
  const h = hurt(), o2 = { isCurrent: x => x === h, campaigns: [] };
  r = G.handle(ev('click', { '[data-cal-skip]': btn('calSkip', 'heal') }), h, 'ru', o2); assert.equal(h.extra.calendar.marks.heal, '2045-03-12'); assert.equal(r.dirty, true);
  r = G.handle(ev('click', { '[data-cal-skip]': btn('calSkip', 'heal') }), h, 'ru', o2); assert.match(r.notify, /Данные изменились/);
  // open the heal row: the medical tool is filled in and the page is named
  h.extra.calendar = cal('2045-03-19', { heal: '2045-03-12' });
  r = G.handle(ev('click', { '[data-cal-open]': btn('calOpen', 'heal') }), h, 'ru', o2); assert.equal(r.go, 'medical');
});

test('invalid calendar: card says so, reset needs a second tap and removes only the calendar', () => {
  const c = { id: 'i', extra: { calendar: { version: 7 }, cash: 3 } }, opts = { isCurrent: x => x === c };
  assert.match(G.render(c, 'ru', []), /Данные календаря не распознаны/); assert.deepEqual(plain(G.due(c)), []);
  let r = G.handle(ev('click', { '[data-cal-reset]': btn('calReset', 'ask') }), c, 'ru', opts); assert.equal(r.rerender, true); assert.ok(c.extra.calendar);
  assert.match(G.render(c, 'ru', []), /data-cal-reset="yes"/);
  r = G.handle(ev('click', { '[data-cal-reset]': btn('calReset', 'no') }), c, 'ru', opts); assert.ok(c.extra.calendar);
  G.handle(ev('click', { '[data-cal-reset]': btn('calReset', 'ask') }), c, 'ru', opts);
  r = G.handle(ev('click', { '[data-cal-reset]': btn('calReset', 'yes') }), c, 'ru', opts); assert.equal(r.dirty, true); assert.deepEqual(plain(c.extra), { cash: 3 });
});

test('campaign: advance asks first, then moves only resolvable pc sheets; typing a date touches no sheet', () => {
  const vi = { id: 'v', name: 'Ви', extra: { calendar: cal('2045-03-12') } }, jack = { id: 'j', name: 'Джеки', extra: {} }, away = { id: 'z', name: 'Z', extra: {} };
  const k = { id: 'k1', name: 'Run', gameDate: '2045-03-12', roster: [{ kind: 'pc', characterId: 'v' }, { kind: 'pc', characterId: 'j' }, { kind: 'pc', characterId: 'gone' }, { kind: 'npc', characterId: 'z' }] };
  const ctx = { lang: 'ru', characters: [vi, jack, away] };
  const html = G.campaignHTML(k, ctx.characters, 'ru');
  assert.match(html, /ДАТА КАМПАНИИ/); assert.match(html, /Ви 12\.03\.2045 · Джеки — не задана/);
  assert.equal(G.ownsCampaign({ target: { closest: s => (s === '[data-cal-campaign]' ? {} : null) } }), true);
  const click = a => ({ type: 'click', target: { closest: s => (s === `[data-cal-${a}]` ? { dataset: a === 'cstep' ? { calCstep: 'day' } : {} } : null) } });
  let r = G.handleCampaign(click('cstep'), k, ctx); assert.equal(r.dirty, false); assert.equal(k.gameDate, '2045-03-12');
  assert.match(G.campaignHTML(k, ctx.characters, 'ru'), /Перевести дату кампании на 13\.03\.2045\? Листы на этом устройстве \(Ви, Джеки\)/);
  r = G.handleCampaign(click('ccancel'), k, ctx); assert.equal(k.gameDate, '2045-03-12'); assert.equal(jack.extra.calendar, undefined);
  G.handleCampaign(click('cstep'), k, ctx); r = G.handleCampaign(click('cconfirm'), k, ctx);
  assert.equal(k.gameDate, '2045-03-13'); assert.equal(vi.extra.calendar.date, '2045-03-13'); assert.equal(jack.extra.calendar.date, '2045-03-13'); assert.equal(away.extra.calendar, undefined);
  assert.equal(r.dirty, true); assert.match(r.notify, /Дата кампании 13\.03\.2045\. Обновлено листов: 2\./);
  // confirm without asking does nothing
  r = G.handleCampaign(click('cconfirm'), k, ctx); assert.equal(k.gameDate, '2045-03-13');
  // typing a date only sets the campaign
  const typed = { type: 'change', target: { closest: s => (s === '[data-cal-cdate]' ? { value: '2045-09-01' } : null) } };
  G.handleCampaign(typed, k, ctx); assert.equal(k.gameDate, '2045-09-01'); assert.equal(vi.extra.calendar.date, '2045-03-13');
  // the sheet then offers to catch up
  assert.match(G.render(vi, 'ru', [k]), /Кампания «Run»: 01\.09\.2045.*Догнать/s);
});

test('tools use the calendar: medical, therapy, hustle, drugs, lifestyle, maker', () => {
  const w = load(), c = hurt(); const GC = w.GameCalendar;
  // medical: prefill and heal consume the days
  assert.equal(w.MedicalTools.prefill({ patient: 'v', days: 2, restDate: '2045-03-10' }), true);
  assert.equal(w.MedicalTools.prefill({ patient: 'v', days: 0 }), false);
  // hustle: a roll consumes a week
  c.extra.calendar = cal('2045-03-26', { heal: '2045-03-26', hustle: '2045-03-12' });
  const r = w.HustleTools.start(c, 'solo'); assert.equal(r.ok, true);
  GC.consume(c, 'hustle', 7); assert.equal(c.extra.calendar.marks.hustle, '2045-03-19');
  // drugs: prefill needs a known drug; draft starts from the game date
  assert.equal(w.DrugTools.prefill(c, { drug: 'nope' }), false);
  assert.equal(w.DrugTools.prefill(c, { drug: 'black-lace', hours: '24' }), true);
  // lifestyle falls back to the game month
  assert.equal(w.LifestyleTools.view(c).period, '2045-03');
  const plainChar = { id: 'p', extra: {} }; assert.equal(w.LifestyleTools.view(plainChar).period, '');
});

test('without game-calendar.js the tools behave as before', () => {
  const w = load(FILES.filter(f => f !== 'game-calendar.js')), c = hurt();
  assert.equal(w.LifestyleTools.view(c).period, '');
  assert.equal(w.HustleTools.start(c, 'solo').ok, true);
});
