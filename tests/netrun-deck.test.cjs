// The deck as a rack of slots on the NETRUN tab (site/netrun-deck.js): slot counts from the catalog, the rack layout, install /
// remove / delete without window.confirm and with a one-step undo, stale-state guards, multiclass netrunners, the old role-panel block.
const { test } = require('node:test'), assert = require('node:assert/strict'), fs = require('node:fs'), vm = require('node:vm');
const read = f => fs.readFileSync(__dirname + '/../site/' + f, 'utf8');
const plain = x => JSON.parse(JSON.stringify(x));

function load({ files = ['catalog.js', 'catalog-extra.js', 'role-tools.js', 'role-play.js', 'netrun-tab.js', 'netrun-deck.js'], storage } = {}) {
  let n = 0;
  const handlers = {}, notes = [], actions = [], saves = [], timers = [], queried = [];
  let throwOn = null;
  let confirmCalls = 0, scope = 'owner', current = null, renders = 0;
  const deckEl = { dataset: {} };
  const root = { dataset: {}, isConnected: true, querySelector: () => deckEl, replaceWith(next) { const m = String(next.html).match(/data-nd-rev="([^"]+)"/); if (m) root.dataset.ndRev = m[1]; root.redraws = (root.redraws || 0) + 1; } };
  const doc = {
    addEventListener: (t, f) => { (handlers[t] ||= []).push(f); },
    querySelector: s => { queried.push(s); if (throwOn && throwOn.test(s)) throw new SyntaxError('bad selector'); return s === '[data-nd-root]' ? root : null; },
    createElement: () => ({ set innerHTML(v) { this._h = v; }, get firstElementChild() { return { html: this._h }; } }),
    getElementById: () => null, body: { appendChild() {} }, documentElement: { classList: { add() {}, remove() {} } },
  };
  const state = { characters: [] };
  const w = {
    document: doc, confirm: () => { confirmCalls++; return true; }, crypto: { randomUUID: () => 'id-' + (++n) },
    App: {
      active: () => current, lang: () => w.lang || 'en', save: () => saves.push(1), render: () => { renders++; }, notify: m => notes.push(m),
      notifyAction: (message, label, fn) => actions.push({ message, label, fn }), getState: () => state, editScope: () => scope,
    },
  };
  if (storage) w.localStorage = storage;
  const ctx = { window: w, Math, Date, JSON, Object, Array, Number, String, Set, setTimeout: f => { timers.push(f); return 0; } };
  vm.createContext(ctx);
  for (const f of files) vm.runInContext(read(f), ctx);
  const api = {
    w, timers, queried, throwOn: re => { throwOn = re; }, ND: w.NetrunDeck, RT: w.RoleTools, notes, actions, saves, root, deckEl, state,
    use(c) { current = c; state.characters = [c]; return c; },
    stamp(c = current) { root.dataset = { ndChar: c.id, ndRev: w.NetrunDeck.rev(c), ndScope: scope }; deckEl.dataset = { deckId: w.NetrunDeck.decksOf(c)[0]?.id || '' }; },
    setScope(s) { scope = s; },
    confirms: () => confirmCalls, renders: () => renders,
    press(act, extra = {}) {
      const el = { dataset: { ndAct: act, ...extra }, getAttribute: () => null, closest: s => (s === '[data-nd-act]' ? el : s === '[data-nd-root]' ? root : s === '[data-deck-id]' ? deckEl : null) };
      for (const h of handlers.click || []) h({ target: el });
    },
  };
  return api;
}
const runner = (extra = {}) => ({ id: 'n1', name: 'Nova', role: 'netrunner', rank: 4, stats: {}, skills: {}, extra: { cash: 5, items: [{ id: 'i1', catalogId: 'gear-cyberdeck-standard-quality', quantity: 1 }, { id: 'i2', catalogId: 'extra-program-sword', quantity: 2 }], ...extra } });
const multi = () => ({ id: 'm1', name: 'Kit', role: 'solo', rank: 5, stats: {}, skills: {}, extra: { additionalRoles: [{ role: 'netrunner', rank: 3 }], items: [{ id: 'i1', catalogId: 'gear-cyberdeck-excellent-quality', quantity: 1 }] } });
const deckOf = (c, i = 0) => c.extra.cyberdecks.decks[i];

test('catalog: the three deck qualities carry their slot count as a number, nothing else changed', () => {
  const { w } = load({ files: ['catalog.js', 'catalog-extra.js'] });
  const slots = id => w.CATALOG.find(x => x.id === id).stats.slots;
  assert.equal(slots('gear-cyberdeck-poor-quality'), 5);
  assert.equal(slots('gear-cyberdeck-standard-quality'), 7);
  assert.equal(slots('gear-cyberdeck-excellent-quality'), 9);
  assert.equal(w.CATALOG.find(x => x.id === 'cyberware-cyberdeck').stats.slots, undefined, 'the cyberarm option is not a deck of its own');
  assert.equal(w.CATALOG.filter(x => /^gear-cyberdeck-/.test(x.id)).length, 3);
});

test('owned decks come from the inventory with the slots filled in; a deck made from one marks it used', () => {
  const x = load(), c = x.use(runner());
  c.extra.items.push({ id: 'i3', catalogId: 'gear-cyberdeck-poor-quality', quantity: 0 }, { id: 'i4', catalogId: 'gear-glow-stick', quantity: 3 });
  assert.deepEqual(plain(x.ND.ownedDecks(c).map(o => [o.id, o.slots, o.owned, o.used])), [['gear-cyberdeck-standard-quality', 7, 1, 0]]);
  const r = x.ND.createOwned(c, 'en', { catalogId: 'gear-cyberdeck-standard-quality' });
  assert.equal(r.ok, true);
  const d = deckOf(c);
  assert.equal(d.slots, 7); assert.equal(d.hardwareOnly, 0); assert.equal(d.sourceId, 'gear-cyberdeck-standard-quality'); assert.match(d.name, /Standard Quality/);
  assert.equal(x.ND.ownedDecks(c)[0].used, 1);
  const again = x.ND.createOwned(c, 'en', { catalogId: 'gear-cyberdeck-standard-quality' });
  assert.equal(again.ok, false); assert.equal(again.reason, 'allUsed'); assert.equal(c.extra.cyberdecks.decks.length, 1);
  assert.equal(x.ND.createOwned(c, 'en', { catalogId: 'gear-cyberdeck-poor-quality' }).reason, 'notOwned', 'quantity 0 is not owned');
  assert.equal(x.ND.createOwned(c, 'en', { catalogId: 'gear-glow-stick' }).reason, 'notOwned');
  assert.equal(x.RT.deckState(c).kind, 'ok');
  assert.equal(c.extra.items.length, 4, 'the inventory is not touched');
});

test('a second owned deck of the same kind gets a different name; the Russian name is used in Russian', () => {
  const x = load(), c = x.use(runner());
  c.extra.items[0].quantity = 2;
  x.ND.createOwned(c, 'ru', { catalogId: 'gear-cyberdeck-standard-quality' }); x.ND.createOwned(c, 'ru', { catalogId: 'gear-cyberdeck-standard-quality' });
  assert.deepEqual(plain(c.extra.cyberdecks.decks.map(d => d.name)), ['Кибердека стандартного качества', 'Кибердека стандартного качества 2']);
});

test('a custom deck keeps the old rules: name, 1..30 general, 0..10 Hardware-only, at most 20 decks', () => {
  const x = load(), c = x.use(runner());
  for (const bad of [{ name: '', slots: '5' }, { name: 'A', slots: '0' }, { name: 'A', slots: '31' }, { name: 'A', slots: '2.5' }, { name: 'A', slots: 'x' }, { name: 'A', slots: '5', hardwareOnly: '11' }, { name: 'A'.repeat(101), slots: '5' }]) {
    const before = JSON.stringify(c); const r = x.ND.createFree(c, 'en', bad);
    assert.equal(r.ok, false, JSON.stringify(bad)); assert.equal(JSON.stringify(c), before);
  }
  assert.equal(x.ND.createFree(c, 'en', { name: ' Rig ', slots: '6', hardwareOnly: '2' }).ok, true);
  assert.deepEqual(plain(deckOf(c)), { id: deckOf(c).id, name: 'Rig', slots: 6, hardwareOnly: 2, entries: [] });
  for (let i = 1; i < 20; i++) assert.equal(x.ND.createFree(c, 'en', { name: 'D' + i, slots: '1' }).ok, true);
  const r = x.ND.createFree(c, 'en', { name: 'one too many', slots: '1' });
  assert.equal(r.ok, false); assert.equal(c.extra.cyberdecks.decks.length, 20);
});

test('layout: general cells first, Hardware-only cells after; Hardware fills its own slots first and a copy may straddle', () => {
  const x = load(), ND = x.ND;
  const E = (id, kind, slots) => ({ id, catalogId: 'x', name: { ru: id, en: id }, kind, slots });
  const deck = { id: 'd', name: 'D', slots: 5, hardwareOnly: 2, entries: [E('p1', 'program', 1), E('ice', 'ice', 2), E('h1', 'hardware', 1), E('h2', 'hardware', 2)] };
  const L = ND.layout(deck);
  assert.deepEqual(plain(L.hw.map(s => [s.entry.id, s.span, s.part])), [['h1', 1, 'whole'], ['h2', 1, 'head']]);
  assert.deepEqual(plain(L.general.map(s => [s.entry.id, s.span, s.part])), [['p1', 1, 'whole'], ['ice', 2, 'whole'], ['h2', 1, 'tail']]);
  assert.equal(L.freeGeneral, 1); assert.equal(L.freeHw, 0); assert.equal(L.used, 6); assert.equal(L.total, 7);
  const empty = ND.layout({ id: 'e', name: 'E', slots: 3, hardwareOnly: 2, entries: [] });
  assert.equal(empty.freeGeneral, 3); assert.equal(empty.freeHw, 2);
});

test('fit() agrees with deckState on every install of a long random sequence, and the cells always add up', () => {
  const x = load(), ND = x.ND, rows = ND.catalogRows();
  assert.ok(rows.length >= 30);
  let seed = 7; const rnd = n => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed % n; };
  for (let round = 0; round < 40; round++) {
    const deck = { id: 'd', name: 'D', slots: 1 + rnd(9), hardwareOnly: rnd(4), entries: [] };
    for (let i = 0; i < 25; i++) {
      const r = rows[rnd(rows.length)], f = ND.fit(deck, r.kind, r.slots);
      const trial = JSON.parse(JSON.stringify(deck)); trial.entries.push({ id: 'e' + i, catalogId: r.p.id, name: { ...r.p.name }, kind: r.kind, slots: r.slots });
      const valid = x.RT.deckState({ extra: { cyberdecks: { version: 1, decks: [trial] } } }).kind === 'ok';
      assert.equal(f.ok, valid, `${r.p.id} in ${deck.slots}+${deck.hardwareOnly} with ${deck.entries.length} entries`);
      if (f.ok) deck.entries.push(trial.entries.at(-1));
      const L = ND.layout(deck);
      assert.equal(L.general.reduce((n, s) => n + s.span, 0) + L.freeGeneral, deck.slots);
      assert.equal(L.hw.reduce((n, s) => n + s.span, 0) + L.freeHw, deck.hardwareOnly);
    }
  }
});

test('install, remove and delete are plain changes with an undo that puts back exactly the old data', () => {
  const x = load(), ND = x.ND, c = x.use(runner());
  ND.createOwned(c, 'en', { catalogId: 'gear-cyberdeck-standard-quality' });
  const id = deckOf(c).id, afterCreate = JSON.stringify(c);
  const put = ND.install(c, 'en', { deckId: id, catalogId: 'extra-program-sword' });
  assert.equal(put.ok, true); assert.match(put.message, /Installed: Sword/); assert.equal(deckOf(c).entries.length, 1);
  assert.equal(x.confirms(), 0);
  assert.equal(ND.restore(c, put.undo, 'en').ok, true); assert.equal(JSON.stringify(c), afterCreate);
  const again = ND.install(c, 'en', { deckId: id, catalogId: 'extra-ice-hellhound' });
  const entry = deckOf(c).entries[0].id, withIce = JSON.stringify(c);
  const gone = ND.removeEntry(c, 'en', { deckId: id, entryId: entry });
  assert.equal(gone.ok, true); assert.equal(deckOf(c).entries.length, 0);
  assert.equal(ND.restore(c, gone.undo, 'en').ok, true); assert.equal(JSON.stringify(c), withIce);
  const del = ND.removeDeck(c, 'en', { deckId: id });
  assert.equal(del.ok, true); assert.equal(c.extra.cyberdecks.decks.length, 0);
  assert.equal(ND.restore(c, del.undo, 'en').ok, true); assert.equal(JSON.stringify(c), withIce);
  assert.equal(again.ok, true);
  // Undo of the very first deck puts the sheet back to «no decks at all».
  const fresh = x.use(runner()), made = ND.createFree(fresh, 'en', { name: 'A', slots: '3' });
  assert.equal(ND.restore(fresh, made.undo, 'en').ok, true); assert.equal('cyberdecks' in fresh.extra, false);
});

test('an undo is refused once anything else changed, another character or a replayed token', () => {
  const x = load(), ND = x.ND, c = x.use(runner());
  ND.createOwned(c, 'en', { catalogId: 'gear-cyberdeck-standard-quality' });
  const id = deckOf(c).id, put = ND.install(c, 'en', { deckId: id, catalogId: 'extra-program-sword' });
  deckOf(c).entries[0].active = true;
  const before = JSON.stringify(c), r = ND.restore(c, put.undo, 'en');
  assert.equal(r.ok, false); assert.equal(r.reason, 'stale'); assert.equal(JSON.stringify(c), before, 'a changed deck is never rolled back over');
  delete deckOf(c).entries[0].active;
  assert.equal(ND.restore(x.use({ ...runner(), id: 'other' }), put.undo, 'en').ok, false);
  assert.equal(ND.restore(c, put.undo, 'en').ok, true);
  assert.equal(ND.restore(c, put.undo, 'en').ok, false, 'the same undo twice');
});

test('a change drawn from older data is refused: the stamp of the card must match the data', () => {
  const x = load(), ND = x.ND, c = x.use(runner());
  ND.createOwned(c, 'en', { catalogId: 'gear-cyberdeck-standard-quality' });
  const id = deckOf(c).id, old = ND.rev(c);
  ND.install(c, 'en', { deckId: id, catalogId: 'extra-program-sword' });
  const before = JSON.stringify(c);
  for (const r of [ND.install(c, 'en', { deckId: id, catalogId: 'extra-program-worm', rev: old }), ND.removeEntry(c, 'en', { deckId: id, entryId: deckOf(c).entries[0].id, rev: old }), ND.removeDeck(c, 'en', { deckId: id, rev: old }), ND.updateDeck(c, 'en', { deckId: id, name: 'X', slots: '7', hardwareOnly: '0', rev: old })]) {
    assert.equal(r.ok, false); assert.equal(r.reason, 'stale');
  }
  assert.equal(JSON.stringify(c), before);
  assert.notEqual(ND.rev(c), old); assert.notEqual(ND.rev({ ...c, id: 'z' }), ND.rev(c));
  assert.equal(ND.install(c, 'en', { deckId: id, catalogId: 'extra-program-worm', rev: ND.rev(c) }).ok, true);
  assert.equal(ND.install(c, 'en', { deckId: 'gone', catalogId: 'extra-program-worm' }).ok, false);
});

test('slot rules hold on install: Black ICE takes two, programs never use Hardware-only slots, limits are reported', () => {
  const x = load(), ND = x.ND, c = x.use(runner());
  ND.createFree(c, 'en', { name: 'Tiny', slots: '3', hardwareOnly: '1' });
  const id = deckOf(c).id, put = cat => ND.install(c, 'en', { deckId: id, catalogId: cat });
  assert.equal(put('extra-ice-hellhound').ok, true);
  assert.equal(put('extra-program-sword').ok, true);
  const full = put('extra-program-worm'); assert.equal(full.ok, false); assert.equal(deckOf(c).entries.length, 2, 'the free Hardware-only slot is not for programs');
  assert.equal(ND.fit(deckOf(c), 'program', 1).reason, 'hwonly');
  assert.equal(put('extra-deck-range-upgrade').ok, true);
  assert.equal(ND.fit(deckOf(c), 'hardware', 1).reason, 'full');
  assert.equal(x.RT.deckState(c).kind, 'ok');
  assert.equal(put('extra-program-does-not-exist').reason, 'unknown');
  assert.equal(put('extra-program-sword').ok, false);
});

test('settings: renaming and resizing keep everything installed, shrinking below the installed copies is refused', () => {
  const x = load(), ND = x.ND, c = x.use(runner());
  ND.createFree(c, 'en', { name: 'Rig', slots: '4' });
  const id = deckOf(c).id;
  ND.install(c, 'en', { deckId: id, catalogId: 'extra-ice-hellhound' }); ND.install(c, 'en', { deckId: id, catalogId: 'extra-program-sword' });
  assert.equal(ND.updateDeck(c, 'en', { deckId: id, name: 'Rig 2', slots: '3', hardwareOnly: '0' }).ok, true);
  assert.equal(deckOf(c).name, 'Rig 2'); assert.equal(deckOf(c).entries.length, 2);
  const r = ND.updateDeck(c, 'en', { deckId: id, name: 'Rig 3', slots: '2', hardwareOnly: '0' });
  assert.equal(r.ok, false); assert.equal(deckOf(c).slots, 3);
  assert.equal(ND.updateDeck(c, 'en', { deckId: id, name: '', slots: '3', hardwareOnly: '0' }).ok, false);
});

test('unknown or malformed deck data is never touched and the card says so', () => {
  const x = load(), ND = x.ND, c = x.use(runner({ cyberdecks: { version: 2, decks: [], future: true } }));
  const before = JSON.stringify(c);
  assert.match(ND.render(c, 'en'), /incompatible/);
  for (const r of [ND.createFree(c, 'en', { name: 'A', slots: '3' }), ND.createOwned(c, 'en', { catalogId: 'gear-cyberdeck-standard-quality' }), ND.install(c, 'en', { deckId: 'a', catalogId: 'extra-program-sword' })]) assert.equal(r.ok, false);
  assert.equal(JSON.stringify(c), before);
  assert.doesNotMatch(ND.render(c, 'ru'), /data-nd-act/);
});

test('old saves load: a deck without sourceId or run state draws as before, extra keys on a deck are kept', () => {
  const x = load(), ND = x.ND;
  const old = runner({ cyberdecks: { version: 1, decks: [{ id: 'old', name: 'Old rig', slots: 4, hardwareOnly: 0, entries: [{ id: 'a', catalogId: 'extra-program-sword', name: { ru: 'Sword', en: 'Sword' }, kind: 'program', slots: 1 }], keepMe: 1 }] } });
  x.use(old);
  const html = ND.render(old, 'en');
  assert.match(html, /Old rig/); assert.match(html, /data-nd-entry="a"/);
  assert.equal((html.match(/data-nd-act="add"/g) || []).length, 3);
  assert.equal(ND.install(old, 'en', { deckId: 'old', catalogId: 'extra-program-worm' }).ok, true);
  assert.equal(deckOf(old).keepMe, 1); assert.equal(deckOf(old).entries.length, 2);
});

test('the rack: one cell per slot, Hardware-only cells marked, a two-slot copy is one wide cell, deck picker only with several decks', () => {
  const x = load(), ND = x.ND, c = x.use(runner());
  ND.createFree(c, 'en', { name: 'Rig', slots: '5', hardwareOnly: '2' });
  const id = deckOf(c).id;
  ND.install(c, 'en', { deckId: id, catalogId: 'extra-ice-hellhound' }); ND.install(c, 'en', { deckId: id, catalogId: 'extra-deck-range-upgrade' });
  let html = ND.render(c, 'en');
  assert.match(html, /data-span="2"[^>]*data-nd-act="entry"/);
  assert.equal((html.match(/data-nd-act="add" data-nd-region="general"/g) || []).length, 3);
  assert.equal((html.match(/data-nd-act="add" data-nd-region="hw"/g) || []).length, 1);
  assert.match(html, /nd-hw/); assert.match(html, /Hardware only/); assert.match(html, /<b>3<\/b> \/ 7/);
  assert.doesNotMatch(html, /data-nd-select/);
  ND.createFree(c, 'en', { name: 'Second', slots: '3' });
  html = ND.render(c, 'en');
  assert.match(html, /data-nd-select/); assert.match(html, /Second/);
  assert.match(html, new RegExp('data-nd-rev="' + ND.rev(c) + '"')); assert.match(html, /data-nd-char="n1"/);
  assert.match(ND.render(c, 'ru'), /Общие слоты/);
  assert.equal(ND.render({ id: 'z', role: 'solo', rank: 3, extra: {} }, 'en'), '');
});

test('which deck is shown is remembered per character in localStorage, falls back to the first deck, and survives a blocked storage', () => {
  const mem = new Map(), storage = { getItem: k => (mem.has(k) ? mem.get(k) : null), setItem: (k, v) => mem.set(k, String(v)) };
  const x = load({ storage }), ND = x.ND, c = x.use(runner());
  ND.createFree(c, 'en', { name: 'A', slots: '3' }); ND.createFree(c, 'en', { name: 'B', slots: '3' });
  const [a, b] = c.extra.cyberdecks.decks;
  assert.equal(ND.currentId(c), a.id);
  ND.setCurrent(c, b.id);
  assert.equal(ND.currentId(c), b.id); assert.equal(mem.get('nc-netrun-deck:n1'), b.id);
  assert.match(ND.render(c, 'en'), /<h3 class="nd-name" tabindex="-1">B<\/h3>/);
  mem.set('nc-netrun-deck:n1', 'gone'); const y = load({ storage }); y.use(c);
  assert.equal(y.ND.currentId(c), a.id, 'an unknown remembered deck falls back to the first');
  const blocked = load({ storage: { getItem() { throw new Error('blocked'); }, setItem() { throw new Error('blocked'); } } });
  blocked.use(c); blocked.ND.setCurrent(c, b.id);
  assert.equal(blocked.ND.currentId(c), b.id, 'kept in memory for the session');
  assert.equal(JSON.stringify(c).includes('current'), false, 'the sheet itself does not carry the preference');
});

test('a multiclass netrunner (additional role) gets the whole deck: render, create, install', () => {
  const x = load(), ND = x.ND, c = x.use(multi());
  assert.equal(x.w.NetrunTab.interfaceRank(c), 3);
  assert.match(ND.render(c, 'en'), /Excellent Quality/);
  assert.equal(ND.createOwned(c, 'en', { catalogId: 'gear-cyberdeck-excellent-quality' }).ok, true);
  assert.equal(deckOf(c).slots, 9);
  assert.equal(ND.install(c, 'en', { deckId: deckOf(c).id, catalogId: 'extra-program-worm' }).ok, true);
  assert.equal(c.role, 'solo');
});

test('the cyberarm option is only a hint: it never changes a slot count by itself', () => {
  const x = load(), c = x.use(runner());
  c.extra.items.push({ id: 'ca', catalogId: 'cyberware-cyberdeck', quantity: 1 });
  assert.match(x.ND.render(c, 'en'), /cyberarm/);
  x.ND.createOwned(c, 'en', { catalogId: 'gear-cyberdeck-standard-quality' });
  assert.equal(deckOf(c).slots, 7);
});

test('the picker rows: classes, search, owned/free mark, disabled with a reason', () => {
  const x = load(), ND = x.ND, c = x.use(runner());
  c.extra.items.push({ id: 'i9', catalogId: 'extra-ice-hellhound', quantity: 1 });
  ND.createFree(c, 'en', { name: 'Rig', slots: '2', hardwareOnly: '1' });
  const deck = deckOf(c), id = deck.id;
  const rows = st => ND.pickRows(c, 'en', deckOf(c), st);
  const names = html => [...html.matchAll(/<strong>([^<]+)<\/strong>/g)].map(m => m[1]);
  const total = ND.CLASSES.reduce((n, k) => n + names(rows({ chip: k })).length, 0);
  assert.equal(total, ND.catalogRows().length, 'every class together lists the whole catalog once');
  assert.ok(names(rows({ chip: 'booster' })).includes('Worm'));
  assert.ok(names(rows({ chip: 'attacker' })).includes('Sword'));
  assert.ok(names(rows({ chip: 'ice' })).includes('Hellhound'));
  assert.ok(names(rows({ chip: 'hardware' })).includes('Range Upgrade'));
  assert.deepEqual(names(rows({ chip: 'attacker', q: 'swor' })), ['Sword']);
  assert.deepEqual(names(rows({ chip: 'attacker', q: 'zzz' })), []); assert.match(rows({ chip: 'attacker', q: 'zzz' }), /Nothing found/);
  assert.match(rows({ chip: 'attacker', q: 'sword' }), /owned 2, free 2/);
  assert.match(rows({ chip: 'ice', q: 'hell' }), /owned 1, free 1/);
  assert.match(rows({ chip: 'booster', q: 'worm' }), /not in inventory/);
  assert.match(rows({ chip: 'attacker', q: 'sword' }), /ATK 3 · DEF 0 · REZ 0|ATK \d+ · DEF \d+ · REZ \d+/);
  assert.doesNotMatch(rows({ chip: 'attacker', q: 'sword' }), /aria-disabled/);
  ND.install(c, 'en', { deckId: id, catalogId: 'extra-ice-hellhound' });
  assert.match(rows({ chip: 'attacker', q: 'sword' }), /aria-disabled="true"[\s\S]*No free slots|Only Hardware slots are free/);
  assert.match(rows({ chip: 'ice', q: 'hell' }), /owned 1, free 0/);
  assert.match(rows({ chip: 'booster', q: 'worm', region: 'hw' }), /This slot is for Hardware only/);
  assert.doesNotMatch(rows({ chip: 'hardware', q: 'range', region: 'hw' }), /aria-disabled/);
  assert.match(ND.pickRows(c, 'ru', deckOf(c), { chip: 'booster', q: 'worm' }), /нет в инвентаре/);
});

test('removing, installing and deleting through the buttons never call window.confirm and offer «Undo»', () => {
  const x = load(), ND = x.ND, c = x.use(runner());
  ND.createOwned(c, 'en', { catalogId: 'gear-cyberdeck-standard-quality' });
  ND.install(c, 'en', { deckId: deckOf(c).id, catalogId: 'extra-program-sword' }); x.stamp(c);
  const entry = deckOf(c).entries[0].id;
  x.press('remove', { ndEntry: entry });
  assert.equal(x.confirms(), 0, 'no native confirm');
  assert.equal(deckOf(c).entries.length, 0); assert.equal(x.saves.length, 1);
  assert.equal(x.actions.length, 1); assert.equal(x.actions[0].label, 'Undo'); assert.match(x.actions[0].message, /Removed: Sword/);
  x.actions[0].fn();
  assert.equal(deckOf(c).entries.length, 1); assert.equal(deckOf(c).entries[0].id, entry); assert.equal(x.saves.length, 2);
  assert.equal(x.root.redraws >= 2, true, 'only the deck card is redrawn');
  assert.equal(x.renders(), 0, 'the whole sheet is not redrawn');
  x.press('deck-delete');
  assert.equal(c.extra.cyberdecks.decks.length, 0); assert.equal(x.actions.at(-1).label, 'Undo');
  x.actions.at(-1).fn(); assert.equal(c.extra.cyberdecks.decks.length, 1);
  x.w.lang = 'ru'; x.stamp(c); x.press('deck-delete');
  assert.equal(x.actions.at(-1).label, 'Отменить'); assert.match(x.actions.at(-1).message, /Дека удалена/);
  assert.equal(x.confirms(), 0);
});

test('a second press of an undo after the data moved on says "data changed" and changes nothing', () => {
  const x = load(), ND = x.ND, c = x.use(runner());
  ND.createOwned(c, 'en', { catalogId: 'gear-cyberdeck-standard-quality' });
  ND.install(c, 'en', { deckId: deckOf(c).id, catalogId: 'extra-program-sword' }); x.stamp(c);
  x.press('remove', { ndEntry: deckOf(c).entries[0].id });
  ND.install(c, 'en', { deckId: deckOf(c).id, catalogId: 'extra-program-worm' });
  const before = JSON.stringify(c); x.actions[0].fn();
  assert.equal(JSON.stringify(c), before); assert.match(x.notes.at(-1), /Data changed/);
});

test('buttons from an old drawing, another character, another account or a detached card do nothing', () => {
  const x = load(), ND = x.ND, c = x.use(runner());
  ND.createOwned(c, 'en', { catalogId: 'gear-cyberdeck-standard-quality' });
  ND.install(c, 'en', { deckId: deckOf(c).id, catalogId: 'extra-program-sword' });
  const entry = deckOf(c).entries[0].id, before = JSON.stringify(c);
  const tries = [
    () => { x.stamp(c); x.root.dataset.ndRev = 'old'; },
    () => { x.stamp(c); x.root.dataset.ndChar = 'someone-else'; },
    () => { x.stamp(c); x.root.dataset.ndScope = 'other-account'; },
    () => { x.stamp(c); x.root.isConnected = false; },
    () => { x.stamp(c); x.deckEl.dataset.deckId = 'no-such-deck'; },
  ];
  for (const t of tries) { x.root.isConnected = true; t(); x.notes.length = 0; x.press('remove', { ndEntry: entry }); assert.equal(JSON.stringify(c), before); assert.match(x.notes.at(-1), /Data changed/); assert.equal(x.actions.length, 0); }
  x.root.isConnected = true; x.stamp(c); x.setScope('switched');
  x.press('remove', { ndEntry: entry }); assert.equal(JSON.stringify(c), before, 'the account changed after the card was drawn');
  x.setScope('owner'); x.stamp(c);
  x.press('remove', { ndEntry: 'no-such-entry' }); assert.equal(JSON.stringify(c), before);
  x.press('remove', { ndEntry: entry }); assert.equal(deckOf(c).entries.length, 0);
});

test('the module never uses a native dialog, the network or a stored copy of the sheet', () => {
  const src = read('netrun-deck.js').replace(/\/\*[\s\S]*?\*\//, '');
  assert.doesNotMatch(src, /\bconfirm\s*\(|\balert\s*\(|\bprompt\s*\(/);
  assert.doesNotMatch(src, /fetch\(|XMLHttpRequest|WebSocket|nightcity-red-v1/);
  assert.deepEqual(src.match(/localStorage\??\.\w+\(/g).sort(), ['localStorage?.getItem(', 'localStorage?.setItem(']);
});

test('the NETRUN tab draws the deck right under the run controls and no longer points to the role tools', () => {
  const x = load(), c = x.use(runner());
  for (const l of ['ru', 'en']) {
    const html = x.w.NetrunTab.render(c, l);
    assert.match(html, /data-nd-root/);
    assert.ok(html.indexOf('netrun-grid') < html.indexOf('data-nd-root'));
    assert.doesNotMatch(html, /в инструментах роли|in the role tools/);
  }
  assert.equal(x.w.NetrunTab.render({ id: 'z', role: 'solo', rank: 3, extra: {} }, 'en'), '');
});

test('the old deck block of the role panel is gone for characters that have the NETRUN tab, and stays for the rest', () => {
  const withTab = load(), c = withTab.use(runner());
  assert.doesNotMatch(withTab.RT.render(c, 'en'), /data-deck-root/);
  const noTab = load({ files: ['catalog.js', 'catalog-extra.js', 'role-tools.js', 'role-play.js'] });
  assert.match(noTab.RT.render(runner(), 'en'), /data-deck-root/);
  const zero = load(), z = zero.use({ ...runner(), rank: 0 });
  assert.equal(zero.w.NetrunTab.interfaceRank(z), 0);
  assert.match(zero.RT.render(z, 'en'), /data-deck-root/, 'rank 0 has no NETRUN tab, so the old block is the only deck');
});

test('the old role-panel deck actions also work for a multiclass netrunner (the role guard is lifted, every validation stays)', () => {
  const x = load(), c = x.use(multi());
  const fields = { name: 'Rig', slots: '3', hardware: '0' }, root = { isConnected: true, querySelector: s => ({ value: fields[s.match(/data-deck-([a-z]+)/)[1]] }) }, box = { dataset: { deckId: '' }, closest: s => (s === '[data-deck-root]' ? root : null), querySelector: root.querySelector };
  const b = { dataset: { rtAction: 'deck-create' }, isConnected: true, closest: s => (s === '[data-rt-action]' ? b : s === '[data-deck-root]' ? root : s === '[data-deck-id]' ? box : null) };
  const r = x.RT.handle({ type: 'click', target: b }, c, 'en', { isCurrent: z => z === c });
  assert.equal(r.dirty, true); assert.equal(deckOf(c).name, 'Rig');
  fields.slots = '99';
  assert.equal(x.RT.handle({ type: 'click', target: b }, c, 'en', { isCurrent: z => z === c }).dirty, undefined);
  const plainSolo = load(), s = plainSolo.use({ id: 's', role: 'solo', rank: 4, stats: {}, skills: {}, extra: {} });
  fields.slots = '3';
  assert.equal(plainSolo.RT.handle({ type: 'click', target: b }, s, 'en', { isCurrent: z => z === s }).dirty, undefined, 'a character without Interface gets no deck');
});

test('the script and the stylesheet are registered, app.js stays last, and every target is at least 44px', () => {
  const index = read('index.html');
  assert.ok(index.indexOf('src="netrun-deck.js"') > index.indexOf('src="netrun-tab.js"'));
  assert.ok(index.indexOf('src="netrun-deck.js"') < index.indexOf('src="app.js"'));
  assert.match(index, /href="netrun-deck\.css"/);
  assert.match(index, /src="app\.js"><\/script><\/body>/);
  const css = read('netrun-deck.css');
  const blocks = css.split('}').map(b => b.split('{')), rule = sel => (blocks.find(([h]) => h && h.split(',').map(x => x.trim()).includes(sel)) || ['', ''])[1];
  for (const sel of ['.nd-btn', '.nd-cell', '.nd-chip', '.nd-row', 'html .nd-card .nd-pick select', 'html .nd-card .nd-form input']) assert.match(rule(sel), /min-height: (44|56|64)px/, sel);
});

test('every string is in both languages: no Russian in the English card, no English sentence left in the Russian one', () => {
  const x = load(), ND = x.ND, c = x.use(runner());
  c.extra.items.push({ id: 'ca', catalogId: 'cyberware-cyberdeck', quantity: 1 });
  const seen = l => {
    const out = [ND.render(c, l)];
    ND.createFree(c, l, { name: 'Rig', slots: '5', hardwareOnly: '1' });
    const d = deckOf(c); ND.install(c, l, { deckId: d.id, catalogId: 'extra-program-worm' }); ND.install(c, l, { deckId: d.id, catalogId: 'extra-deck-range-upgrade' });
    x.w.lang = l; out.push(ND.render(c, l));
    for (const chip of ND.CLASSES) out.push(ND.pickRows(c, l, deckOf(c), { chip }));
    c.extra.cyberdecks.decks.length = 0; delete c.extra.cyberdecks;
    return out.join('\n').replace(/<[^>]+>/g, ' ');
  };
  assert.doesNotMatch(seen('en'), /[А-Яа-яЁё]/);
  const ru = seen('ru');
  for (const word of ['Install', 'Remove', 'Undo', 'Search by', 'General slots', 'Custom deck', 'Create deck', 'No free slots', 'not in inventory']) assert.ok(!ru.includes(word), word);
  assert.doesNotMatch(read('netrun-deck.js'), /\bты\b|\bтвой|\bтебя\b|\bвыберите ты/i);
});

test('the final deckState check in work() refuses a change the fit check let through', () => {
  const x = load(), ND = x.ND, c = x.use(runner());
  ND.createOwned(c, 'en', { catalogId: 'gear-cyberdeck-standard-quality' });
  const id = deckOf(c).id, before = JSON.stringify(c), real = x.RT.deckState;
  // Only the check of the finished copy (a bare object without an id) disagrees; reading the character still works.
  x.RT.deckState = ch => (ch && ch.id === undefined ? { kind: 'invalid' } : real(ch));
  try {
    for (const r of [ND.install(c, 'en', { deckId: id, catalogId: 'extra-program-sword' }), ND.createFree(c, 'en', { name: 'B', slots: '3' }), ND.updateDeck(c, 'en', { deckId: id, name: 'Z', slots: '7', hardwareOnly: '0' }), ND.removeDeck(c, 'en', { deckId: id })]) {
      assert.equal(r.ok, false); assert.equal(r.reason, 'invalid');
    }
  } finally { x.RT.deckState = real; }
  assert.equal(JSON.stringify(c), before, 'nothing was written');
  assert.equal(ND.install(c, 'en', { deckId: id, catalogId: 'extra-program-sword' }).ok, true);
});

test('an undo token is bound to its character even when two sheets hold identical deck data', () => {
  const x = load(), ND = x.ND, c = x.use(runner());
  const made = ND.createFree(c, 'en', { name: 'Twin', slots: '5' });
  const twin = runner({ cyberdecks: JSON.parse(JSON.stringify(c.extra.cyberdecks)) }); twin.id = 'copy-of-nova';
  assert.equal(JSON.stringify(twin.extra.cyberdecks), JSON.stringify(c.extra.cyberdecks), 'same bytes, different sheet');
  const before = JSON.stringify(twin), r = ND.restore(twin, made.undo, 'en');
  assert.equal(r.ok, false); assert.equal(r.reason, 'stale'); assert.equal(JSON.stringify(twin), before);
  assert.equal(ND.restore(c, made.undo, 'en').ok, true);
});

test('an entry id with quotes or brackets cannot break the focus selector; a bad selector never throws from the timer', () => {
  const x = load(), ND = x.ND, c = x.use(runner());
  ND.createOwned(c, 'en', { catalogId: 'gear-cyberdeck-standard-quality' });
  ND.install(c, 'en', { deckId: deckOf(c).id, catalogId: 'extra-program-sword' });
  const evil = 'a"]b\\c';
  deckOf(c).entries[0].id = evil;
  assert.equal(x.RT.deckState(c).kind, 'ok', 'the validator accepts such an id');
  assert.equal(ND.qa(evil), 'a\\22 ]b\\5c c');
  x.stamp(c); x.press('entry', { ndEntry: evil });
  const sel = x.queried.length; x.timers.forEach(f => f());
  const used = x.queried.slice(sel).find(s => /data-nd-entry/.test(s));
  assert.ok(used, 'focus was tried'); assert.ok(!used.includes('"]b'), 'the quote is escaped');
  // Even if the engine rejects a selector, the timer swallows it.
  x.throwOn(/data-nd-entry/); x.timers.length = 0; x.press('entry', { ndEntry: evil }); x.stamp(c);
  assert.doesNotThrow(() => x.timers.forEach(f => f()));
});

test('focus is not lost: the deck name is focusable and an undo hands focus back to the card', () => {
  const x = load(), ND = x.ND, c = x.use(runner());
  ND.createOwned(c, 'en', { catalogId: 'gear-cyberdeck-standard-quality' });
  assert.match(ND.render(c, 'en'), /<h3 class="nd-name" tabindex="-1">/);
  x.stamp(c); x.press('remove', { ndEntry: 'nope' });
  ND.install(c, 'en', { deckId: deckOf(c).id, catalogId: 'extra-program-sword' });
  x.stamp(c); x.press('remove', { ndEntry: deckOf(c).entries[0].id });
  x.timers.length = 0; x.queried.length = 0;
  x.actions.at(-1).fn(); x.timers.forEach(f => f());
  assert.ok(x.queried.some(s => /\.nd-name/.test(s)), 'after Undo the focus is asked for the deck name');
});
