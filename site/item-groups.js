// Item groups: the player's own shelves for the inventory («Рюкзак», «Тайник», «В машине»).
//
//  - a group is a name the player made up; a thing or a weapon points to one group or to none;
//  - the list of cards is drawn group by group, a group folds away and stays folded after a reload;
//  - a row of chips next to the type chips (inventory-filter.js) shows one group at a time;
//  - «Надеть всё» and «Снять всё» put on or take off the armor of a group in one go.
//
// Groups are for keeping order only. They change no rule and never leave the device through a room (room.js drops
// them from a sheet on sending and again on arrival; a file or a link carries the whole sheet, groups included). Armor still
// goes on and comes off only through EquipmentTools.equip / unequip, so SP, the armor penalty and the saved SP of a
// damaged piece behave exactly as they do for a single card.
//
// Stored on the character, every field optional: c.extra.itemGroups = [{ id, name, collapsed? }] and record.group = id
// on entries of c.extra.items and c.extra.weapons. A sheet saved before this feature has neither and looks as before.
// What is stored may come from an imported file, so every read rebuilds the list from known fields and never trusts it.
//
// The first part is pure functions over a character (tests/item-groups.test.cjs), the second draws the markup, the
// third is the page wiring.
(function (global) {
  'use strict';

  const MAX_GROUPS = 12, NAME_MAX = 40, KINDS = ['items', 'weapons'], LOCATIONS = ['head', 'body'];
  const ID = /^g-[a-z0-9-]{1,40}$/i, SUIT = 'armor-bodyweight-suit', NEW = '__new';
  const esc = x => String(x ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const isObject = x => x !== null && typeof x === 'object' && !Array.isArray(x);
  const L = lang => (lang === 'en' ? 'en' : 'ru');
  const whole = v => { const n = Math.floor(Number(v)); return Number.isFinite(n) ? n : 0; };
  const catalogItem = id => (Array.isArray(global.CATALOG) && typeof id === 'string' && id ? global.CATALOG.find(x => x && x.id === id) : undefined);
  const tools = () => global.EquipmentTools;

  const T = {
    ru: {
      group: 'Группа', groups: 'Группа предметов', none: 'Без группы', add: 'Группа', newOption: '＋ Новая группа…',
      newTitle: 'Новая группа', nameLabel: 'Название группы', quick: 'Готовые названия', picks: ['Рюкзак', 'Тайник', 'В машине'],
      create: 'Создать', cancel: 'Отмена', save: 'Сохранить', edit: 'Изменить', remove: 'Удалить группу', undo: 'Вернуть',
      editTitle: name => `Группа «${name}»`, editLabel: name => `Изменить группу «${name}»`,
      wearAll: 'Надеть всё', offAll: 'Снять всё',
      wearAllLabel: name => `Надеть всю броню группы «${name}»`, offAllLabel: name => `Снять всю броню группы «${name}»`,
      empty: 'В группе пока ничего нет. Выберите группу в карточке предмета.',
      badName: 'Назовите группу.', duplicate: 'Такая группа уже есть.', limit: `Групп может быть не больше ${MAX_GROUPS}.`,
      stale: 'Лист изменился. Повторите действие.',
      created: name => `Группа создана: ${name}.`, renamed: name => `Группа теперь называется «${name}».`,
      removed: name => `Группа удалена: ${name}. Вещи остались в инвентаре.`, restored: name => `Группа возвращена: ${name}.`,
      moved: (thing, name) => `${thing} → ${name}`, ungrouped: thing => `${thing}: без группы`,
      unnamed: 'Без названия', head: 'голова', body: 'тело', both: 'голова и тело',
      piece: (where, name, sp) => `${where} — ${name} (SP ${sp})`, off: (where, name) => `${where} — ${name}`,
      onHead: 'На голове', onBody: 'На теле', onBoth: 'На голове и на теле',
      worn: list => `Надето: ${list}.`, kept: list => `Не надето: ${list} (свободного места нет).`, taken: list => `Снято: ${list}.`,
      noArmor: 'В этой группе нет брони, которую можно надеть.', allWorn: 'Вся броня группы уже надета.',
      noPlace: 'Голова и тело уже заняты бронёй этой группы.', nothingWorn: 'Из этой группы ничего не надето.',
      confirmWear: (name, where) => `Надеть броню группы «${name}»? ${where} она заменит то, что надето сейчас. Повреждённый SP останется за снятой бронёй.`,
      confirmOff: name => `Снять всю броню группы «${name}»?`,
      confirmNeeded: 'Подтвердите действие.'
    },
    en: {
      group: 'Group', groups: 'Item group', none: 'No group', add: 'Group', newOption: '＋ New group…',
      newTitle: 'New group', nameLabel: 'Group name', quick: 'Ready-made names', picks: ['Backpack', 'Stash', 'In the car'],
      create: 'Create', cancel: 'Cancel', save: 'Save', edit: 'Edit', remove: 'Delete group', undo: 'Undo',
      editTitle: name => `Group “${name}”`, editLabel: name => `Edit the group “${name}”`,
      wearAll: 'Put on all', offAll: 'Take off all',
      wearAllLabel: name => `Put on all armor of the group “${name}”`, offAllLabel: name => `Take off all armor of the group “${name}”`,
      empty: 'Nothing in this group yet. Pick the group on an item card.',
      badName: 'Give the group a name.', duplicate: 'There is already a group with this name.', limit: `There can be at most ${MAX_GROUPS} groups.`,
      stale: 'The sheet changed. Try again.',
      created: name => `Group created: ${name}.`, renamed: name => `The group is now called “${name}”.`,
      removed: name => `Group deleted: ${name}. The things stay in the inventory.`, restored: name => `Group restored: ${name}.`,
      moved: (thing, name) => `${thing} → ${name}`, ungrouped: thing => `${thing}: no group`,
      unnamed: 'Unnamed', head: 'head', body: 'body', both: 'head and body',
      piece: (where, name, sp) => `${where}: ${name} (SP ${sp})`, off: (where, name) => `${where}: ${name}`,
      onHead: 'on the head', onBody: 'on the body', onBoth: 'on the head and the body',
      worn: list => `Put on: ${list}.`, kept: list => `Not put on: ${list} (no free location).`, taken: list => `Taken off: ${list}.`,
      noArmor: 'This group has no armor that can be put on.', allWorn: 'All armor of this group is already on.',
      noPlace: 'The head and the body are already covered by armor of this group.', nothingWorn: 'Nothing from this group is worn.',
      confirmWear: (name, where) => `Put on the armor of the group “${name}”? It replaces what is worn ${where}. The damaged SP stays with the piece that comes off.`,
      confirmOff: name => `Take off all armor of the group “${name}”?`,
      confirmNeeded: 'Confirm the action.'
    }
  };
  const t = (lang, key, ...args) => { const v = T[L(lang)][key]; return typeof v === 'function' ? v(...args) : v; };
  const fail = (lang, reason, message) => ({ ok: false, reason, message: message || t(lang, reason) });

  // ---------- 1. Pure functions ----------

  // A name as it is kept: one line, no control characters, at most NAME_MAX characters.
  const cleanName = name => Array.from(String(typeof name === 'string' ? name : '').replace(/[\u0000-\u001f\u007f]+/g, ' ').replace(/\s+/g, ' ').trim()).slice(0, NAME_MAX).join('').trim();
  const nameKey = name => cleanName(name).normalize('NFKC').toLocaleLowerCase();
  const stored = c => (isObject(c?.extra) && Array.isArray(c.extra.itemGroups) ? c.extra.itemGroups : null);

  // The groups of a character, rebuilt from the fields this module knows. Reading never changes what is stored.
  function groups(c) {
    const raw = stored(c), out = [], seen = new Set();
    if (!raw) return out;
    // An imported list may be huge: look at a bounded part of it only.
    for (const g of raw.slice(0, 500)) {
      if (out.length >= MAX_GROUPS) break;
      if (!isObject(g) || typeof g.id !== 'string' || !ID.test(g.id) || seen.has(g.id)) continue;
      const name = cleanName(g.name);
      if (!name) continue;
      seen.add(g.id);
      out.push({ id: g.id, name, collapsed: g.collapsed === true });
    }
    return out;
  }
  const group = (c, id) => (typeof id === 'string' ? groups(c).find(g => g.id === id) : undefined);
  const has = (c, id) => !!group(c, id);
  // The stored object behind a group, so that an edit keeps fields a later version may add to it.
  const storedGroup = (c, id) => (has(c, id) ? stored(c).find(g => isObject(g) && g.id === id && cleanName(g.name)) : undefined);
  const groupOf = (c, record) => (isObject(record) && typeof record.group === 'string' && has(c, record.group) ? record.group : '');
  const rows = (c, kind) => (KINDS.includes(kind) && isObject(c?.extra) && Array.isArray(c.extra[kind]) ? c.extra[kind] : []);
  function members(c, id) {
    const out = [];
    if (!has(c, id)) return out;
    for (const kind of KINDS) for (const record of rows(c, kind)) if (isObject(record) && record.group === id) out.push({ kind, record });
    return out;
  }
  // A record is found by an id that exactly one entry of the list has (the rule GearFlow uses).
  function find(c, kind, id) {
    if (typeof id !== 'string' || !id) return null;
    const hits = rows(c, kind).filter(r => isObject(r) && r.id === id);
    return hits.length === 1 ? hits[0] : null;
  }
  function displayName(record, lang) {
    try { const name = global.GearFlow?.displayName?.(record, lang); if (name) return String(name); } catch { /* fall back to the stored name */ }
    return String(record?.name || '').trim() || t(lang, 'unnamed');
  }

  function ensure(c) {
    if (!isObject(c) || (c.extra !== undefined && !isObject(c.extra))) return null;
    if (c.extra === undefined) c.extra = {};
    if (!Array.isArray(c.extra.itemGroups)) c.extra.itemGroups = [];
    return c.extra.itemGroups;
  }
  /* The list to write a new group into. An imported sheet may hold entries this module cannot read (junk, or twelve
     nulls); they show nowhere, so the player could neither see nor delete them, and a group added after them could
     fall outside what groups() reads. Once the stored list is as long as the limit they are dropped: the stored
     objects of the readable groups stay, in their order, with whatever other fields they carry. A shorter list is
     left as it is. */
  function tidy(c) {
    const list = ensure(c);
    if (list && list.length >= MAX_GROUPS) { const keep = groups(c).map(g => storedGroup(c, g.id)).filter(Boolean); list.splice(0, list.length, ...keep); }
    return list;
  }
  const newId = () => {
    const raw = String(global.crypto?.randomUUID?.() || Date.now().toString(36) + Math.random().toString(36).slice(2)).toLowerCase().replace(/[^a-z0-9]/g, '');
    return 'g-' + (raw.slice(0, 10) || '0');
  };

  function create(c, name, lang) {
    if (!isObject(c) || (c.extra !== undefined && !isObject(c.extra))) return fail(lang, 'stale');
    const clean = cleanName(name), now = groups(c);
    if (!clean) return fail(lang, 'badName');
    if (now.some(g => nameKey(g.name) === nameKey(clean))) return fail(lang, 'duplicate');
    if (now.length >= MAX_GROUPS) return fail(lang, 'limit');
    const list = tidy(c);
    let id = newId();
    for (let i = 0; i < 20 && list.some(g => isObject(g) && g.id === id); i++) id = newId();
    if (list.some(g => isObject(g) && g.id === id)) return fail(lang, 'stale');
    list.push({ id, name: clean });
    return { ok: true, dirty: true, id, name: clean, message: t(lang, 'created', clean) };
  }
  function rename(c, id, name, lang) {
    const g = storedGroup(c, id), clean = cleanName(name);
    if (!g) return fail(lang, 'stale');
    if (!clean) return fail(lang, 'badName');
    if (groups(c).some(x => x.id !== id && nameKey(x.name) === nameKey(clean))) return fail(lang, 'duplicate');
    const dirty = g.name !== clean;
    g.name = clean;
    return { ok: true, dirty, name: clean, message: t(lang, 'renamed', clean) };
  }
  // Only `true` is kept: an unfolded group has no key at all, like a group saved before folding existed.
  function setCollapsed(c, id, flag) {
    const g = storedGroup(c, id);
    if (!g) return fail('ru', 'stale');
    const dirty = (g.collapsed === true) !== (flag === true);
    if (flag === true) g.collapsed = true; else delete g.collapsed;
    return { ok: true, dirty };
  }
  // '' takes the thing out of its group. The thing itself is never touched otherwise.
  function assign(c, kind, recordId, groupId, lang) {
    const record = find(c, kind, recordId);
    if (!record) return fail(lang, 'stale');
    const thing = displayName(record, lang);
    if (groupId === '' || groupId === undefined || groupId === null) {
      const dirty = 'group' in record;
      delete record.group;
      return { ok: true, dirty, name: '', message: t(lang, 'ungrouped', thing) };
    }
    const g = group(c, groupId);
    if (!g) return fail(lang, 'stale');
    const dirty = record.group !== g.id;
    record.group = g.id;
    // A thing put into a folded group would seem to vanish: the group opens to show where it went.
    if (g.collapsed) setCollapsed(c, g.id, false);
    return { ok: true, dirty: dirty || g.collapsed, name: g.name, message: t(lang, 'moved', thing, g.name) };
  }
  // Deleting a group deletes no thing: its members go back to «Без группы». The caller keeps `undo` for restore().
  function remove(c, id, lang) {
    const g = storedGroup(c, id), list = stored(c);
    if (!g) return fail(lang, 'stale');
    const name = group(c, id).name, was = members(c, id), index = list.indexOf(g);
    for (const m of was) delete m.record.group;
    list.splice(index, 1);
    return { ok: true, dirty: true, name, message: t(lang, 'removed', name), undo: { characterId: c.id, index, group: g, members: was } };
  }
  function restore(c, undo, lang) {
    if (!isObject(c) || !isObject(undo) || !isObject(undo.group) || (c.id && undo.characterId !== c.id) || (c.extra !== undefined && !isObject(c.extra))) return fail(lang, 'stale');
    const id = undo.group.id, name = cleanName(undo.group.name), now = groups(c);
    if (typeof id !== 'string' || !ID.test(id) || !name || (stored(c) || []).some(g => isObject(g) && g.id === id)) return fail(lang, 'stale');
    if (now.length >= MAX_GROUPS) return fail(lang, 'limit');
    if (now.some(g => nameKey(g.name) === nameKey(name))) return fail(lang, 'duplicate');
    const list = tidy(c);
    list.splice(Math.max(0, Math.min(list.length, whole(undo.index))), 0, undo.group);
    // Only things that are still on the sheet and still without a group go back: what the player moved meanwhile stays.
    for (const m of Array.isArray(undo.members) ? undo.members : []) {
      if (!isObject(m) || !isObject(m.record) || !rows(c, m.kind).includes(m.record) || groupOf(c, m.record)) continue;
      m.record.group = id;
    }
    return { ok: true, dirty: true, name, message: t(lang, 'restored', name) };
  }

  // ---- Armor of a group ----

  const slots = c => (isObject(c?.extra?.equipment?.armor) ? c.extra.equipment.armor : {});
  const slotAt = (c, where) => (isObject(slots(c)[where]) ? slots(c)[where] : null);
  const spAt = (c, where) => Math.max(0, whole(where === 'head' ? c?.head : c?.bodyArmor));
  // The things of a group that EquipmentTools can put on: catalog armor with an SP, in a sane quantity, and not a
  // starter piece whose record is broken (the same conditions equip() checks before it does anything).
  function armorIn(c, id) {
    const ET = tools();
    if (!ET?.equip || !has(c, id)) return [];
    return rows(c, 'items').filter(record => {
      if (!isObject(record) || record.group !== id || !find(c, 'items', record.id)) return false;
      const item = catalogItem(record.catalogId), n = Number(record.quantity);
      if (!item || item.category !== 'armor' || !Number.isInteger(item.stats?.sp) || item.stats.sp < 0 || !Number.isSafeInteger(n) || n < 1 || n > 100) return false;
      let fixed; try { fixed = ET.starterArmorLocation?.(record); } catch { fixed = false; }
      return fixed !== false;
    });
  }
  /* What «Надеть всё» would do, without doing it. One piece covers one location and a Bodyweight Suit covers both, so
     at most two pieces (or one suit) can go on. A location that already wears a piece of this group is left alone. A
     starter piece may go on one location only, so those are placed first; the rest then fill what is left in the
     order of the list, the body before the head. (Placed in list order alone, an ordinary piece listed first would
     take the body and leave a body-only starter piece off while the head stayed bare.) */
  function wearPlan(c, id) {
    const armor = armorIn(c, id), ids = new Set(armor.map(r => r.id)), taken = { head: false, body: false };
    const plan = { steps: [], already: [], kept: [], dropSuit: false, replaces: false };
    for (const where of LOCATIONS) {
      const slot = slotAt(c, where);
      if (slot && ids.has(slot.recordId)) { taken[where] = true; plan.already.push({ recordId: slot.recordId, location: where }); }
    }
    const step = (record, item, location) => {
      const places = location === 'both' ? LOCATIONS : [location], replaces = places.some(k => !!slotAt(c, k) || spAt(c, k) > 0);
      for (const k of places) taken[k] = true;
      if (replaces) plan.replaces = true;
      plan.steps.push({ recordId: record.id, location, name: { ru: item.name?.ru || record.name || '', en: item.name?.en || record.name || '' }, sp: item.stats.sp, replaces });
    };
    const fixedOf = record => { if (catalogItem(record.catalogId)?.id === SUIT) return undefined; try { return tools().starterArmorLocation?.(record) || undefined; } catch { return undefined; } };
    for (const record of [...armor.filter(r => fixedOf(r)), ...armor.filter(r => !fixedOf(r))]) {
      const item = catalogItem(record.catalogId), on = LOCATIONS.filter(k => slotAt(c, k)?.recordId === record.id).length;
      if (item.id === SUIT) {
        if (on) continue;
        if (!taken.head && !taken.body) step(record, item, 'both'); else plan.kept.push(record.id);
        continue;
      }
      const fixed = fixedOf(record);
      for (let left = Math.min(2, Number(record.quantity) - on); left > 0; left--) {
        const where = fixed ? (taken[fixed] ? null : fixed) : !taken.body ? 'body' : !taken.head ? 'head' : null;
        if (!where) { plan.kept.push(record.id); break; }
        step(record, item, where);
      }
    }
    // An ordinary piece cannot go on over a Bodyweight Suit: a suit from outside the group comes off first.
    plan.dropSuit = plan.steps.some(s => s.location !== 'both') && LOCATIONS.some(k => slotAt(c, k)?.catalogId === SUIT && !ids.has(slotAt(c, k).recordId));
    if (plan.dropSuit) plan.replaces = true;
    return plan;
  }
  const placeName = (lang, where) => t(lang, where === 'both' ? 'both' : where === 'head' ? 'head' : 'body');
  // Which locations lose what they wear now, for the question: only those the plan fills, or both when a suit comes off.
  function replacedWhere(plan, lang) {
    const hit = new Set();
    for (const s of plan.steps) if (s.replaces) for (const k of s.location === 'both' ? LOCATIONS : [s.location]) hit.add(k);
    return t(lang, plan.dropSuit || hit.size > 1 ? 'onBoth' : hit.has('head') ? 'onHead' : 'onBody');
  }
  function wearAll(c, id, lang, confirmed) {
    const ET = tools(), g = group(c, id);
    if (!ET?.equip || !ET?.unequip || !g) return fail(lang, 'stale');
    if (!armorIn(c, id).length) return fail(lang, 'noArmor');
    const plan = wearPlan(c, id), nameOf = rid => displayName(find(c, 'items', rid), lang);
    if (!plan.steps.length) return fail(lang, plan.kept.length ? 'noPlace' : 'allWorn');
    if (plan.replaces && confirmed !== true) return fail(lang, 'confirmNeeded', t(lang, 'confirmWear', g.name, replacedWhere(plan, lang)));
    const worn = [], kept = plan.kept.map(nameOf);
    let dirty = false;
    if (plan.dropSuit) { const where = LOCATIONS.find(k => slotAt(c, k)?.catalogId === SUIT); if (where && ET.unequip(c, where, L(lang), true)?.ok) dirty = true; }
    for (const s of plan.steps) {
      let r; try { r = ET.equip(c, s.recordId, s.location, L(lang), true); } catch { r = null; }
      // A step that EquipmentTools refuses is reported, the rest still go on: there is nothing to roll back to.
      if (!r?.ok) { kept.push(nameOf(s.recordId)); continue; }
      dirty = true;
      worn.push({ recordId: s.recordId, location: s.location, name: s.name[L(lang)] || nameOf(s.recordId), sp: spAt(c, s.location === 'head' ? 'head' : 'body') });
    }
    const lines = [];
    if (worn.length) lines.push(t(lang, 'worn', worn.map(w => t(lang, 'piece', placeName(lang, w.location), w.name, w.sp)).join(', ')));
    if (kept.length) lines.push(t(lang, 'kept', [...new Set(kept)].join(', ')));
    return { ok: worn.length > 0 || dirty, dirty, worn, kept, reason: worn.length ? undefined : 'noPlace', message: lines.join(' ') };
  }
  // Where things of this group are worn right now.
  function wornOf(c, id) {
    if (!has(c, id)) return [];
    const ids = new Set(rows(c, 'items').filter(r => isObject(r) && r.group === id && typeof r.id === 'string' && r.id).map(r => r.id));
    return LOCATIONS.filter(k => ids.has(slotAt(c, k)?.recordId));
  }
  function takeOffAll(c, id, lang, confirmed) {
    const ET = tools(), g = group(c, id);
    if (!ET?.unequip || !g) return fail(lang, 'stale');
    const places = wornOf(c, id);
    if (!places.length) return fail(lang, 'noArmor', t(lang, 'nothingWorn'));
    if (confirmed !== true) return fail(lang, 'confirmNeeded', t(lang, 'confirmOff', g.name));
    const removed = [];
    for (const where of places) {
      const slot = slotAt(c, where);
      // A suit leaves both locations with one call, so the second location may be bare by now.
      if (!slot) continue;
      const item = catalogItem(slot.catalogId), record = find(c, 'items', slot.recordId), suit = slot.catalogId === SUIT;
      let r; try { r = ET.unequip(c, where, L(lang), true); } catch { r = null; }
      if (r?.ok) removed.push({ recordId: slot.recordId, location: suit ? 'both' : where, name: item?.name?.[L(lang)] || displayName(record, lang) });
    }
    if (!removed.length) return fail(lang, 'stale');
    return { ok: true, dirty: true, removed, message: t(lang, 'taken', removed.map(x => t(lang, 'off', placeName(lang, x.location), x.name)).join(', ')) };
  }

  // ---------- 2. Markup ----------

  // The chips under the type chips: «Без группы», every group, and the button that makes a new one.
  function chips(c, lang, picked) {
    const list = groups(c), chip = (value, name) => `<button type="button" class="inventory-chip" data-inventory-filter="group" value="${esc(value)}" aria-pressed="${value === picked}"><span>${esc(name)}</span><b data-inventory-gcount></b></button>`;
    return `<div class="inventory-chips inventory-groups" role="group" aria-label="${esc(t(lang, 'groups'))}" data-ig-chips>${list.length ? chip('none', t(lang, 'none')) + list.map(g => chip(g.id, g.name)).join('') : ''}<button type="button" class="inventory-chip ig-new" data-ig-action="new"><span aria-hidden="true">＋</span><span>${esc(t(lang, 'add'))}</span></button></div>`;
  }
  /* The «Группа» select of a card. A thing always has it in its edit form; a weapon card shows it only once a group
     exists, so a sheet without groups keeps the weapon card it had. A record without an id cannot be pointed at. */
  function field(c, kind, record, lang) {
    if (!KINDS.includes(kind) || !isObject(record) || typeof record.id !== 'string' || !record.id) return '';
    const list = groups(c), now = groupOf(c, record);
    if (kind === 'weapons' && !list.length) return '';
    const option = (value, name) => `<option value="${esc(value)}"${value === now ? ' selected' : ''}>${esc(name)}</option>`;
    return `<label class="field ig-field">${esc(t(lang, 'group'))}<select data-ig-assign data-ig-kind="${kind}" data-ig-rid="${esc(record.id)}">${option('', t(lang, 'none'))}${list.map(g => option(g.id, g.name)).join('')}<option value="${NEW}">${esc(t(lang, 'newOption'))}</option></select></label>`;
  }
  /* The list of cards, group by group. `entries` is [{ record, html }] in the order of the list. Without groups the
     cards are returned exactly as they came, so a sheet that never used groups is drawn as before. */
  function arrange(c, lang, entries) {
    const all = (Array.isArray(entries) ? entries : []).filter(e => e && typeof e.html === 'string'), list = groups(c);
    if (!list.length) return all.map(e => e.html).join('');
    const loose = all.filter(e => !groupOf(c, e.record));
    const none = loose.length ? `<div class="ig-none" data-ig-none><p class="ig-title">${esc(t(lang, 'none'))}</p>${loose.map(e => e.html).join('')}</div>` : '';
    return none + list.map(g => {
      const mine = all.filter(e => groupOf(c, e.record) === g.id), name = esc(g.name);
      const wear = wearPlan(c, g.id).steps.length ? `<button type="button" class="cx-button ig-tool" data-ig-action="wear-all" data-ig-id="${g.id}" aria-label="${esc(t(lang, 'wearAllLabel', g.name))}">${esc(t(lang, 'wearAll'))}</button>` : '';
      const off = tools()?.unequip && wornOf(c, g.id).length ? `<button type="button" class="cx-button ig-tool" data-ig-action="off-all" data-ig-id="${g.id}" aria-label="${esc(t(lang, 'offAllLabel', g.name))}">${esc(t(lang, 'offAll'))}</button>` : '';
      return `<div class="ig-group" role="group" aria-label="${name}" data-ig-group="${g.id}"${g.collapsed ? ' data-ig-collapsed="1"' : ''}><div class="ig-head"><button type="button" class="ig-toggle" data-ig-action="toggle" data-ig-id="${g.id}" aria-expanded="${!g.collapsed}" aria-controls="ig-body-${g.id}"><span class="ig-caret" aria-hidden="true">▸</span><strong>${name}</strong><b class="ig-count" data-ig-count>${mine.length}</b></button><span class="ig-tools">${wear}${off}<button type="button" class="cx-button ig-tool" data-ig-action="edit" data-ig-id="${g.id}" aria-label="${esc(t(lang, 'editLabel', g.name))}">${esc(t(lang, 'edit'))}</button></span></div><div class="ig-body" id="ig-body-${g.id}"${g.collapsed ? ' hidden' : ''}>${mine.length ? mine.map(e => e.html).join('') : `<p class="cx-empty ig-empty">${esc(t(lang, 'empty'))}</p>`}</div></div>`;
    }).join('');
  }
  /* Called by InventoryFilter.apply after it has hidden the rows that do not match. A folded group opens while anything
     is filtered (a search, a type chip, a group chip), so «Показано N из M» never counts things that cannot be seen; a group that a
     filter leaves empty steps aside, but an empty group stays in view when nothing is filtered (to rename or delete it). */
  function afterFilter(root, state) {
    if (!root?.querySelectorAll) return;
    const filtered = state?.filtered === true || state?.query === true;
    const shown = box => { let n = 0; for (const row of box.querySelectorAll('[data-inventory-row]')) if (!row.hidden) n++; return n; };
    for (const box of root.querySelectorAll('[data-ig-group]')) {
      const n = shown(box), open = box.dataset?.igCollapsed !== '1' || filtered;
      const count = box.querySelector('[data-ig-count]'), body = box.querySelector('.ig-body'), toggle = box.querySelector('[data-ig-action="toggle"]');
      if (count) count.textContent = String(n);
      if (body) body.hidden = !open;
      toggle?.setAttribute?.('aria-expanded', String(open));
      box.hidden = filtered && n === 0;
    }
    for (const box of root.querySelectorAll('[data-ig-none]')) box.hidden = filtered && shown(box) === 0;
  }

  const closeButton = lang => `<button type="button" class="cx-button" data-ig-action="panel-close">${esc(t(lang, 'cancel'))}</button>`;
  // The panel that makes a group. `pending` is the card whose select asked for it: the thing goes into the new group.
  function newPanel(c, lang, pending) {
    const used = new Set(groups(c).map(g => nameKey(g.name))), picks = T[L(lang)].picks.filter(name => !used.has(nameKey(name)));
    const to = pending && KINDS.includes(pending.kind) && pending.rid ? ` data-ig-kind="${pending.kind}" data-ig-rid="${esc(pending.rid)}"` : '';
    return `<div class="gf-panel ig-panel" data-ig-panel="new"${to} role="group" aria-label="${esc(t(lang, 'newTitle'))}"><strong>${esc(t(lang, 'newTitle'))}</strong><label class="field">${esc(t(lang, 'nameLabel'))}<input type="text" maxlength="${NAME_MAX}" autocomplete="off" data-ig-name></label>${picks.length ? `<div class="ig-picks" role="group" aria-label="${esc(t(lang, 'quick'))}">${picks.map(name => `<button type="button" class="cx-button ig-pick" data-ig-action="pick" value="${esc(name)}">${esc(name)}</button>`).join('')}</div>` : ''}<p class="ig-error" role="alert" data-ig-error hidden></p><div class="cx-entry-actions"><button type="button" class="cx-button gf-go" data-ig-action="create">${esc(t(lang, 'create'))}</button>${closeButton(lang)}</div></div>`;
  }
  function editPanel(c, id, lang) {
    const g = group(c, id);
    if (!g) return '';
    return `<div class="gf-panel ig-panel" data-ig-panel="edit" data-ig-id="${g.id}" role="group" aria-label="${esc(t(lang, 'editTitle', g.name))}"><strong>${esc(t(lang, 'editTitle', g.name))}</strong><label class="field">${esc(t(lang, 'nameLabel'))}<input type="text" maxlength="${NAME_MAX}" autocomplete="off" value="${esc(g.name)}" data-ig-name></label><p class="ig-error" role="alert" data-ig-error hidden></p><div class="cx-entry-actions"><button type="button" class="cx-button gf-go" data-ig-action="rename">${esc(t(lang, 'save'))}</button><button type="button" class="cx-button gf-remove" data-ig-action="delete">${esc(t(lang, 'remove'))}</button>${closeButton(lang)}</div></div>`;
  }

  // ---------- 3. Page wiring ----------

  const doc = global.document, app = () => global.App;
  const lang = () => (app()?.lang?.() === 'en' ? 'en' : 'ru');
  const say = message => { if (message) app()?.notify?.(message); };
  const inApp = el => !!el && doc.querySelector('#app')?.contains(el) === true;
  const stale = () => { say(t(lang(), 'stale')); app()?.render?.(); };
  const commit = result => { if (result?.ok && result.dirty !== false) { app()?.save?.(); app()?.render?.(); } return result; };
  // After the sheet is drawn again the control that was used is a new element: find it by what it carries, not by a
  // selector built from stored text.
  function refocus(selector, match) {
    for (const el of doc.querySelectorAll?.('#sheet-items ' + selector) || []) {
      if (!match(el)) continue;
      // A card that the pressed chip has just hidden cannot take the focus: say so, and the caller looks further.
      if (el.closest?.('[hidden]')) return false;
      el.focus?.({ preventScroll: true });
      return doc.activeElement === el;
    }
    return false;
  }
  /* Focus must land on something after every action, or a keyboard user is thrown to the top of the page. When the
     control that was used is gone or hidden (a thing filed away while «Без группы» is pressed leaves the list), the
     pressed group chip takes it, and failing that the button that makes a group. */
  const focusNear = (selector, match) => refocus(selector, match) || refocus('[data-inventory-filter="group"][aria-pressed="true"]', () => true) || refocus('[data-ig-action="new"]', () => true);
  const closePanels = () => { for (const p of doc.querySelectorAll?.('[data-ig-panel]') || []) p.remove(); };
  function showError(panel, message) {
    const box = panel?.querySelector('[data-ig-error]');
    if (box) { box.textContent = message; box.hidden = false; } else say(message);
    panel?.querySelector('[data-ig-name]')?.focus?.();
  }
  function openNew(anchor, pending) {
    const c = app()?.active?.(), root = doc.querySelector('#sheet-items');
    if (!c || !root) return;
    closePanels();
    const after = anchor || root.querySelector('[data-ig-chips]');
    if (!after) return;
    after.insertAdjacentHTML('afterend', newPanel(c, lang(), pending));
    root.querySelector('[data-ig-panel="new"] [data-ig-name]')?.focus?.();
  }
  function submitNew(panel) {
    const c = app()?.active?.(), l = lang();
    if (!c || !panel) return;
    const kind = panel.dataset.igKind, rid = panel.dataset.igRid, r = create(c, panel.querySelector('[data-ig-name]')?.value, l);
    if (!r.ok) { if (r.reason === 'stale') stale(); else showError(panel, r.message); return; }
    // Made from a card: the thing goes straight into the new group. If the card is gone meanwhile the group still stays.
    const moved = kind && rid ? assign(c, kind, rid, r.id, l) : null;
    commit(r);
    say(moved?.ok ? `${r.message} ${moved.message}` : r.message);
    if (moved?.ok) focusNear('[data-ig-assign]', el => el.dataset.igRid === rid && el.dataset.igKind === kind); else refocus('[data-ig-action="new"]', () => true);
  }
  function submitRename(panel) {
    const c = app()?.active?.(), l = lang(), id = panel?.dataset.igId;
    if (!c || !panel) return;
    const r = rename(c, id, panel.querySelector('[data-ig-name]')?.value, l);
    if (!r.ok) { if (r.reason === 'stale') stale(); else showError(panel, r.message); return; }
    if (r.dirty) { commit(r); say(r.message); } else panel.remove();
    refocus('[data-ig-action="edit"]', el => el.dataset.igId === id);
  }
  function bulk(c, id, wear) {
    const l = lang(), g = group(c, id);
    if (!g) { stale(); return; }
    let r = wear ? wearAll(c, id, l, false) : takeOffAll(c, id, l, false);
    if (!r.ok && r.reason === 'confirmNeeded') {
      if (typeof global.confirm === 'function' && !global.confirm(r.message)) return;
      // The question may have stayed open while the sheet changed under it.
      if (app()?.active?.() !== c || !has(c, id)) { stale(); return; }
      r = wear ? wearAll(c, id, l, true) : takeOffAll(c, id, l, true);
    }
    if (r.reason === 'stale') { stale(); return; }
    commit(r);
    say(r.message);
    if (r.ok) focusNear('[data-ig-action="toggle"]', el => el.dataset.igId === id);
  }
  function onClick(e) {
    const el = e.target?.closest?.('[data-ig-action]');
    if (!el || !inApp(el)) return;
    const action = el.dataset.igAction, c = app()?.active?.(), l = lang(), id = el.dataset.igId;
    if (!c) return;
    if (action === 'panel-close') {
      const panel = el.closest('[data-ig-panel]'), edit = panel?.dataset.igPanel === 'edit' ? panel.dataset.igId : null, kind = panel?.dataset.igKind, rid = panel?.dataset.igRid;
      panel?.remove();
      // Focus goes back to what opened the panel.
      if (edit) refocus('[data-ig-action="edit"]', x => x.dataset.igId === edit);
      else if (!(rid && refocus('[data-ig-assign]', x => x.dataset.igRid === rid && x.dataset.igKind === kind))) refocus('[data-ig-action="new"]', () => true);
      return;
    }
    if (action === 'new') {
      const shown = doc.querySelector('[data-ig-panel="new"]:not([data-ig-rid])');
      if (shown) { shown.remove(); return; }
      openNew(null, null); return;
    }
    if (action === 'pick') { const input = el.closest('[data-ig-panel]')?.querySelector('[data-ig-name]'); if (input) { input.value = el.value; input.focus?.(); } return; }
    if (action === 'create') { submitNew(el.closest('[data-ig-panel]')); return; }
    if (action === 'rename') { submitRename(el.closest('[data-ig-panel]')); return; }
    if (action === 'toggle') {
      const box = el.closest('[data-ig-group]'), body = box?.querySelector('.ig-body');
      if (!box || !body || !has(c, id)) { stale(); return; }
      // The button does what the eye expects: it folds what is open and opens what is folded, even while a search
      // holds a folded group open. Only the fold is saved; the sheet is not drawn again, so the focus stays put.
      const fold = !body.hidden, r = setCollapsed(c, id, fold);
      if (fold) box.dataset.igCollapsed = '1'; else delete box.dataset.igCollapsed;
      body.hidden = fold; el.setAttribute('aria-expanded', String(!fold));
      if (r.ok && r.dirty) app()?.save?.();
      return;
    }
    if (action === 'edit') {
      const box = el.closest('[data-ig-group]'), shown = box?.querySelector('[data-ig-panel="edit"]');
      if (shown) { shown.remove(); return; }
      const markup = editPanel(c, id, l);
      if (!box || !markup) { stale(); return; }
      closePanels();
      box.querySelector('.ig-head')?.insertAdjacentHTML('afterend', markup);
      box.querySelector('[data-ig-panel] [data-ig-name]')?.focus?.();
      return;
    }
    if (action === 'delete') {
      const gid = el.closest('[data-ig-panel]')?.dataset.igId, r = commit(remove(c, gid, l)), A = app();
      if (!r.ok) { stale(); return; }
      const back = () => {
        const owner = A?.getState?.()?.characters?.find?.(x => x && x.id === r.undo.characterId), again = owner ? restore(owner, r.undo, lang()) : fail(lang(), 'stale');
        commit(again); say(again.message);
        // The «Вернуть» button is gone with its notice: the focus goes to the group that came back.
        if (again.ok) focusNear('[data-ig-action="toggle"]', x => x.dataset.igId === r.undo.group.id);
      };
      if (typeof A?.notifyAction === 'function') A.notifyAction(r.message, t(l, 'undo'), back); else say(r.message);
      refocus('[data-ig-action="new"]', () => true);
      return;
    }
    if (action === 'wear-all' || action === 'off-all') bulk(c, id, action === 'wear-all');
  }
  function onChange(e) {
    const el = e.target;
    if (!el?.matches?.('[data-ig-assign]') || !inApp(el)) return;
    const c = app()?.active?.(), l = lang(), kind = el.dataset.igKind, rid = el.dataset.igRid, record = c && find(c, kind, rid);
    if (!record) { stale(); return; }
    if (el.value === NEW) {
      // The select goes back to what is true now; the choice is made when the new group has a name.
      el.value = groupOf(c, record);
      openNew(el.closest('.cx-grid, .inv-quick'), { kind, rid });
      return;
    }
    const r = assign(c, kind, rid, el.value, l);
    if (!r.ok) { stale(); return; }
    commit(r); say(r.message);
    focusNear('[data-ig-assign]', x => x.dataset.igRid === rid && x.dataset.igKind === kind);
  }
  // Enter in the name field does what the main button of its panel does.
  function onKey(e) {
    if (e.key !== 'Enter' || e.isComposing || !e.target?.matches?.('[data-ig-name]') || !inApp(e.target)) return;
    const panel = e.target.closest('[data-ig-panel]');
    e.preventDefault();
    if (panel?.dataset.igPanel === 'edit') submitRename(panel); else submitNew(panel);
  }
  if (doc?.addEventListener) {
    doc.addEventListener('click', onClick);
    doc.addEventListener('change', onChange);
    doc.addEventListener('keydown', onKey);
  }

  global.ItemGroups = {
    MAX_GROUPS, NAME_MAX, T, t, groups, has, groupOf, members, create, rename, remove, restore, assign, setCollapsed,
    armorIn, wearPlan, wearAll, takeOffAll, wornOf, chips, field, arrange, afterFilter, newPanel, editPanel
  };
})(typeof window !== 'undefined' ? window : globalThis);
