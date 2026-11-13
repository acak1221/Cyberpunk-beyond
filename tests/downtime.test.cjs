// Between-sessions tools: start of session, pay buttons, remembered lifestyle, hustle income — all money through Wallet.
const { test } = require('node:test'), assert = require('node:assert/strict'), fs = require('node:fs'), vm = require('node:vm');
const site = f => fs.readFileSync(__dirname + '/../site/' + f, 'utf8');
function load(files) {
  const w = { confirm: () => true }, ctx = { window: w, Math, JSON, Number, String, Array, Object, Date, Map, Set, WeakMap, setTimeout: () => 0, structuredClone };
  vm.createContext(ctx);
  for (const f of files) vm.runInContext(site(f), ctx);
  return w;
}
const plain = x => JSON.parse(JSON.stringify(x));
const click = (dt, key) => { const b = { dataset: { dt, key } }; return { type: 'click', target: { closest: s => s === '[data-dt]' ? b : null } }; };

test('start of session refills LUCK, clears the next-roll leftovers and can be undone', () => {
  const D = load(['wallet.js', 'downtime.js']).Downtime;
  const c = { id: 'a', stats: { LUCK: 6 }, extra: { luck: 4, luckUse: 2, modifier: 3, cash: 10 } };
  const r = D.startSession(c);
  assert.equal(r.ok, true); assert.equal(r.from, 4); assert.equal(r.to, 6); assert.equal(r.changed, true); assert.equal(r.modifier, 3);
  assert.deepEqual(plain(r.extra), { luck: 6, luckUse: 0, modifier: 0, cash: 10 });
  assert.equal(c.extra.luck, 4, 'pure: the character is not touched');
  assert.deepEqual(plain(D.undoSession({ extra: r.extra }, r.before)), { luck: 4, luckUse: 2, modifier: 3, cash: 10 });
  // a pinned modifier stays; a sheet without extra counts as full LUCK
  assert.equal(D.startSession({ stats: { LUCK: 5 }, extra: { luck: 1, modifier: -2, modifierHold: true } }).extra.modifier, -2);
  const fresh = D.startSession({ stats: { LUCK: 5 } });
  assert.equal(fresh.changed, false); assert.equal(fresh.from, 5);
  assert.deepEqual(plain(D.undoSession({ extra: fresh.extra }, fresh.before)), {});
});

test('the session chip changes the active sheet only, and offers an undo', () => {
  const D = load(['wallet.js', 'downtime.js']).Downtime;
  const c = { id: 'a', stats: { LUCK: 6 }, extra: { luck: 2 } };
  const ctx = { lang: 'ru', view: 'sheet', active: c, characters: [c], isCurrent: () => true };
  assert.match(D.hudChip(c, 'ru'), /data-dt="session"[^>]*>.*Начало сессии/);
  assert.match(D.hudChip(c, 'en'), /Start of session/);
  assert.equal(D.handle(click('session'), { ...ctx, isCurrent: () => false }).dirty, undefined);
  assert.equal(c.extra.luck, 2);
  const r = D.handle(click('session'), ctx);
  assert.equal(r.dirty, true); assert.equal(c.extra.luck, 6); assert.match(r.notify, /2 → 6/);
  assert.match(D.hudChip(c, 'ru'), /data-dt="session-undo"/);
  const u = D.handle(click('session-undo'), ctx);
  assert.equal(u.dirty, true); assert.equal(c.extra.luck, 2);
  assert.match(D.hudChip(c, 'ru'), /data-dt="session"/);
  c.extra.luck = 6;
  const again = D.handle(click('session'), ctx);
  assert.equal(again.dirty, undefined); assert.match(again.notify, /уже полная/);
});

test('a pay button takes exactly the shown sum from the patient, refuses when short, and can be undone', () => {
  const D = load(['wallet.js', 'downtime.js']).Downtime;
  const c = { id: 'p', name: 'Ви', extra: { cash: 2900 } }, ctx = { lang: 'ru', view: 'medical', characters: [c], isCurrent: () => true };
  const html = D.payHTML({ key: 'hospital', lang: 'ru', character: c, amount: 700, note: 'Больница: DV 15' });
  assert.match(html, /data-dt="pay" data-key="hospital">Оплатить 700 eb/); assert.match(html, /На счету Ви: <b>2 900 eb<\/b>/);
  const r = D.handle(click('pay', 'hospital'), ctx);
  assert.equal(r.dirty, true); assert.equal(c.extra.cash, 2200);
  assert.deepEqual(plain(c.extra.walletLog.map(e => [e.delta, e.note])), [[-700, 'Больница: DV 15']]);
  assert.match(D.payHTML({ key: 'hospital', lang: 'ru', character: c, amount: 700, note: 'x' }), /data-dt="pay-undo"/);
  const u = D.handle(click('pay-undo', 'hospital'), ctx);
  assert.equal(u.dirty, true); assert.equal(c.extra.cash, 2900); assert.equal(c.extra.walletLog[0].delta, 700);
  // short: the button is off and says how much is missing; a forced click changes nothing
  const short = D.payHTML({ key: 'therapy', lang: 'en', character: c, amount: 3000, note: 'Therapy' });
  assert.match(short, /disabled/); assert.match(short, /Short by 100 eb/);
  const refused = D.handle(click('pay', 'therapy'), { ...ctx, lang: 'en' });
  assert.equal(refused.dirty, undefined); assert.equal(c.extra.cash, 2900); assert.match(refused.notify, /Short by 100 eb/);
  // nothing to pay, or no patient: no button; an unknown key or a stale sheet: no charge
  assert.equal(D.payHTML({ key: 'k', lang: 'ru', character: c, amount: 0 }), '');
  assert.equal(D.payHTML({ key: 'k', lang: 'ru', character: null, amount: 50 }), '');
  assert.equal(D.handle(click('pay', 'nope'), ctx).dirty, undefined);
  D.payHTML({ key: 'hospital', lang: 'ru', character: c, amount: 700, note: 'x' });
  assert.equal(D.handle(click('pay', 'hospital'), { ...ctx, isCurrent: () => false }).dirty, undefined);
  assert.equal(c.extra.cash, 2900);
});

test('the medical page and therapy offer the pay button and no longer say money is not taken', () => {
  const med = site('medical-tools.js'), therapy = site('therapy-tools.js');
  assert.match(med, /Downtime\?\.payHTML\?\.\(\{key:'hospital'/);
  assert.match(therapy, /Downtime\?\.payHTML\?\.\(\{key:'therapy-'\+ui\.type/);
  assert.doesNotMatch(med + therapy, /не списывает деньги|не списываются автоматически|does not spend money|not deducted automatically/);
  const html = site('index.html');
  assert.ok(html.indexOf('src="wallet.js"') > 0 && html.indexOf('src="downtime.js"') > html.indexOf('src="wallet.js"') && html.indexOf('src="downtime.js"') < html.indexOf('src="app.js"'));
  assert.match(html, /href="downtime\.css"/);
  assert.match(site('app.js'), /addEventListener\('click',e=>\{if\(handleDowntime\(e\)\|\|/);
});

test('lifestyle: the choice and the month are remembered, the next unpaid month is offered', () => {
  const w = load(['wallet.js', 'lifestyle-tools.js']), L = w.LifestyleTools;
  const c = { extra: { cash: 3000 } };
  assert.deepEqual(plain(L.view(c)), { period: '', life: 'kibble', home: 'street', paidLife: false, paidHome: false, due: [], total: 0, cash: 3000, short: 0 });
  assert.equal(L.remember(c, { period: '2045-03', life: 'generic', home: 'studio' }), true);
  assert.deepEqual(plain(c.extra.living), { version: 1, log: [], current: { period: '2045-03', life: 'generic', home: 'studio' } });
  let v = L.view(c);
  assert.deepEqual([v.period, v.life, v.home, v.total, v.due.join()], ['2045-03', 'generic', 'studio', 1800, 'life,home']);
  assert.equal(L.pay(c, L.quote(c, '2045-03', 'life', 'generic'), 'Образ жизни').ok, true);
  assert.equal(c.extra.cash, 2700); assert.equal(c.extra.walletLog[0].delta, -300); assert.equal(c.extra.walletLog[0].note, 'Образ жизни');
  v = L.view(c);
  assert.deepEqual([v.period, v.paidLife, v.paidHome, v.total], ['2045-03', true, false, 1500]);
  assert.match(L.render(c, 'ru'), /data-living-period type="month"[^>]*value="2045-03"/);
  assert.match(L.render(c, 'ru'), /<option value="studio" selected>/);
  assert.match(L.render(c, 'ru'), /<option value="generic" selected>/);
  assert.equal(L.pay(c, L.quote(c, '2045-03', 'home', 'studio')).ok, true);
  v = L.view(c);
  assert.deepEqual([v.period, v.total, v.cash, v.short], ['2045-04', 1800, 1200, 600], 'both paid: the next month, and it says what is missing');
  assert.match(L.summary(c, 'ru'), /data-living-pay="month" disabled>Оплатить месяц целиком · 1 800 eb/);
  assert.match(L.summary(c, 'en'), /Short by 600 eb/);
  assert.equal(L.nextPeriod('2045-12'), '2046-01'); assert.equal(L.nextPeriod('bad'), '');
  // reversing a payment returns the money through the ledger and the month is due again
  assert.equal(L.undo(c, 1, JSON.stringify(c.extra.living.log[1]), 'Возврат').ok, true);
  assert.equal(c.extra.cash, 2700); assert.equal(c.extra.walletLog[0].delta, 1500);
  assert.equal(L.view(c).period, '2045-03');
  assert.equal(L.state(c).kind, 'ok', 'the remembered choice does not break the validator');
});

test('lifestyle: an old sheet (log only) shows its last choices; a broken remembered choice is ignored', () => {
  const L = load(['wallet.js', 'lifestyle-tools.js']).LifestyleTools;
  const old = { extra: { cash: 50, living: { version: 1, log: [{ period: '2045-01', type: 'life', choice: 'good', amount: 600 }, { period: '2045-01', type: 'home', choice: 'cube', amount: 500 }, { period: '2045-02', type: 'life', choice: 'fresh', amount: 1500, void: true }] } } };
  const v = L.view(old);
  assert.deepEqual([v.period, v.life, v.home], ['2045-02', 'good', 'cube']);
  const odd = { extra: { cash: 50, living: { version: 1, log: [], current: { period: '13-2045', life: 'caviar', home: 7 } } } };
  assert.deepEqual([L.view(odd).period, L.view(odd).life, L.view(odd).home], ['', 'kibble', 'street']);
  assert.equal(L.remember({ extra: { living: { version: 2 } } }, { life: 'good' }), false, 'unknown data is left alone');
});

test('lifestyle: «pay the whole month» charges both parts once, with no dialog, and refuses when short', () => {
  const w = load(['wallet.js', 'lifestyle-tools.js']), L = w.LifestyleTools;
  w.confirm = () => { throw new Error('no dialog expected'); };
  const values = { '[data-living-period]': '2045-03', '[data-living-life]': 'generic', '[data-living-home]': 'studio' };
  const root = { isConnected: true, querySelector: s => ({ value: values[s] }) }, button = { dataset: { livingPay: 'month' }, closest: () => root };
  const event = { type: 'click', target: { closest: s => /data-living-pay/.test(s) ? button : null } }, options = { isCurrent: () => true };
  const c = { extra: { cash: 2000 } };
  const r = L.handle(event, c, 'ru', options);
  assert.equal(r.dirty, true); assert.equal(c.extra.cash, 200); assert.equal(c.extra.living.log.length, 2);
  assert.match(r.notify, /Оплачено за 2045-03: Generic Prepak \+ Квартира-студия · −1 800 eb/);
  assert.deepEqual(plain(c.extra.walletLog.map(e => e.delta)), [-1500, -300]);
  // the same month again: nothing is charged twice, the form moves on
  const twice = L.handle(event, c, 'ru', options);
  assert.equal(c.extra.cash, 200); assert.equal(c.extra.living.log.length, 2); assert.match(twice.notify, /уже оплачен/);
  values['[data-living-period]'] = '2045-04';
  const short = L.handle(event, c, 'ru', options);
  assert.equal(c.extra.cash, 200); assert.equal(c.extra.living.log.length, 2); assert.match(short.notify, /Не хватает 1 600 eb/);
  assert.equal(L.handle(event, { extra: { cash: 9000 } }, 'ru', { isCurrent: () => false }).dirty, undefined);
});

test('lifestyle: changing a select keeps the choice at once', () => {
  const L = load(['wallet.js', 'lifestyle-tools.js']).LifestyleTools;
  const box = { innerHTML: '' }, area = { querySelector: () => box };
  const pick = { value: 'cargo', hasAttribute: a => a === 'data-living-home', closest: () => area };
  const event = { type: 'change', target: { closest: s => /data-living-home/.test(s) ? pick : null } };
  const c = { extra: { cash: 10 } };
  const r = L.handle(event, c, 'ru', { isCurrent: () => true });
  assert.equal(r.dirty, true); assert.equal(c.extra.living.current.home, 'cargo'); assert.match(box.innerHTML, /data-living-pay="month"/);
});

test('hustle income is credited through Wallet', () => {
  const w = load(['wallet.js', 'hustle-tools.js']), H = w.HustleTools;
  assert.match(site('hustle-tools.js'), /W\.earn\(c,p\.amount,note\|\|'Hustle'\)/);
  const c = { role: 'solo', rank: 4, extra: { cash: 100 } };
  const started = H.start(c, 'solo', () => 0.99);
  if (started?.ok && c.extra.hustle?.pending) {
    const amount = c.extra.hustle.pending.amount, r = H.credit(c, JSON.stringify(c.extra.hustle.pending), 'Заработок');
    assert.equal(r.ok, true); assert.equal(c.extra.cash, 100 + amount);
    if (amount > 0) assert.deepEqual(plain(c.extra.walletLog.map(e => [e.delta, e.note])), [[amount, 'Заработок']]);
    assert.equal(c.extra.hustle.pending.status, 'credited');
  }
});

test('jump links point at sections that exist and that the tabs know', () => {
  const D = load(['wallet.js', 'downtime.js']).Downtime, tabs = site('sheet-tabs.js');
  const markup = ['app.js', 'character-extra.js', 'agent-notes.js', 'hustle-tools.js', 'lifestyle-tools.js', 'drug-tools.js', 'game-calendar.js'].map(site).join('\n');
  for (const [id] of D.JUMPS) { assert.match(markup, new RegExp(`id="${id}"`), id); assert.match(tabs, new RegExp(`'${id}':'`), id + ' has no owner tab'); }
  const nav = D.jumpNav({ id: 'a', extra: { cash: 2900 } }, 'ru');
  assert.match(nav, /data-hud-jump="sheet-living">Жильё и образ жизни/); assert.match(nav, /Деньги <b>2 900 eb<\/b>/);
  assert.match(D.jumpNav({ id: 'a' }, 'en'), /Hustle/);
  assert.match(tabs, /Downtime\?\.hudChip\?\.\(c,lang\(\)\)/); assert.match(tabs, /Downtime\?\.jumpNav\?\.\(c,lang\(\)\)/);
});

test('with the game calendar loaded the session toast carries the game date and a way to it', () => {
  const w = load(['wallet.js', 'downtime.js', 'game-calendar.js']), D = w.Downtime;
  const c = { id: 'a', stats: { LUCK: 6 }, extra: { luck: 4, calendar: { version: 1, date: '2045-03-12' } } };
  const r = D.handle(click('session'), { lang: 'ru', view: 'sheet', active: c, isCurrent: x => x === c });
  assert.match(r.notify, /Дата игры 12\.03\.2045/); assert.equal(r.calendar, true);
  const off = { id: 'b', stats: { LUCK: 6 }, extra: { luck: 4 } };
  assert.match(D.handle(click('session'), { lang: 'ru', view: 'sheet', active: off, isCurrent: x => x === off }).notify, /Дата игры не задана\./);
  assert.match(D.jumpNav(c, 'ru'), /data-hud-jump="sheet-calendar">Дата игры <b>12\.03\.2045<\/b>/);
  assert.match(D.jumpNav(off, 'ru'), /data-hud-jump="sheet-calendar">Дата игры<\/button>/);
  const bare = load(['wallet.js', 'downtime.js']).Downtime.handle(click('session'), { lang: 'ru', view: 'sheet', active: { id: 'z', stats: { LUCK: 6 }, extra: { luck: 4 } }, isCurrent: () => true });
  assert.doesNotMatch(bare.notify, /Дата игры/); assert.equal(bare.calendar, false);
});
