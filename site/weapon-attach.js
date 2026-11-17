// Weapon quality, attachments and links between things.
//
//  - a weapon of the sheet may carry a quality (poor / standard / excellent) and a list of attachments;
//  - what fits, how many slots there are and what an attachment costs in slots comes from the reference data of the repo
//    (window.WEAPON_MODIFIERS, defenses-extra.js) and from the catalog; nothing is typed in here;
//  - what the data defines as a plain number is applied to the weapon line (the attack bonus of an excellent weapon, the
//    magazine capacity of an extended or drum magazine); everything that depends on a situation is shown as a note;
//  - a thing of the inventory may be linked to a weapon or to another thing («в оружии X»). Removing the parent only
//    unlinks it (gear-flow.js), never deletes it.
//
// Stored on the character, every field optional: extra.weapons[i].quality = 'poor' | 'standard' | 'excellent',
// extra.weapons[i].attachments = [catalogId], extra.items[i].linkedTo = id of a weapon or of another thing.
// A sheet saved before this has none of them and looks as before. Whatever is stored may come from an imported file, so
// every read rebuilds the value from known fields and never trusts it.
//
// The first part is pure functions over a character (tests/weapon-attach.test.cjs), the second draws the markup, the
// third is the page wiring. Pure functions never touch the page; the wiring changes a sheet only through them.
(function (global) {
  'use strict';

  const QUALITIES = ['poor', 'standard', 'excellent'];
  const MAX_READ = 20;
  const MAGAZINES = ['extended-magazine', 'drum-magazine'];
  const RANGED_SKILLS = ['Handgun', 'Shoulder Arms', 'Heavy Weapons', 'Archery'];
  const esc = x => String(x ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const isObject = x => x !== null && typeof x === 'object' && !Array.isArray(x);
  const L = lang => (lang === 'en' ? 'en' : 'ru');
  const data = () => (isObject(global.WEAPON_MODIFIERS) ? global.WEAPON_MODIFIERS : null);
  const catalogItem = id => (Array.isArray(global.CATALOG) && typeof id === 'string' && id ? global.CATALOG.find(x => x && x.id === id) : undefined);
  const val = (x, lang) => (isObject(x) ? String(x[L(lang)] || x.ru || '') : '');
  const lowerFirst = text => (/^[A-ZА-ЯЁ][a-zа-яё]/.test(text) ? text[0].toLowerCase() + text.slice(1) : text);
  const signed = n => (n > 0 ? '+' : '') + n;

  const T = {
    ru: {
      title: 'Качество и модификации', quality: 'Качество', qualityNone: 'Не указано',
      slots: (used, max) => `слоты ${used}/${max}`, slotsShort: n => `${n} сл.`,
      installed: 'Установлено', none: 'Модификаций нет.', pick: 'Модификация', attach: 'Установить', detach: 'Снять',
      detachLabel: name => `Снять: ${name}`, price: n => `${n} eb`,
      noSlots: 'У этого оружия нет слотов под модификации: по справочнику они есть только у обычного дальнобойного оружия.',
      notEligible: (name, rule) => `${name} не подходит к этому оружию: ${rule}.`,
      duplicate: name => `${name} уже установлена: одинаковые модификации не дают дополнительного эффекта.`,
      oneMagazine: 'Магазин уже установлен: можно только один (расширенный или барабанный).',
      full: (name, need, free) => `${name} занимает слотов: ${need}, а свободно: ${free}. Снимите что-нибудь.`,
      unknown: 'Эта вещь не годится как модификация оружия.', noData: 'Справочник модификаций недоступен.',
      stale: 'Лист изменился. Повторите действие.', undo: 'Вернуть',
      attached: (name, weapon) => `Установлено: ${name} → ${weapon}.`, detached: (name, weapon) => `Снято: ${name} ← ${weapon}.`,
      qualitySet: (q, weapon) => `${weapon}: ${q}.`, qualityCleared: weapon => `${weapon}: качество не указано.`,
      capacity: n => `Ёмкость магазина: ${n}.`, capacityManual: n => `По таблице ёмкость ${n}: впишите её в оружие сами, там стоит другое число.`,
      attack: n => `${signed(n)} к атаке`, attackManual: n => `${signed(n)} к атаке: впишите в модификатор оружия сами`,
      notFit: 'не подходит', pickFirst: 'Подходящие модификации стоят первыми.',
      noteBy: (name, text) => `${name}: ${text}`, linked: 'Привязано к оружию',
      inWeapon: name => `в оружии ${name}`, toThing: name => `к предмету ${name}`,
      linkLabel: 'Связь', linkPick: 'Привязать к…', linkNone: 'Не привязано',
      linkSet: (thing, parent) => `${thing}: привязано к «${parent}».`, linkCleared: thing => `${thing}: привязка снята.`,
      linkSelf: 'Вещь нельзя привязать к самой себе.', linkCycle: 'Вещи нельзя привязать по кругу.', linkGone: 'Такой вещи или оружия на листе уже нет.',
      unnamed: 'Без названия', weaponsGroup: 'Оружие', itemsGroup: 'Предметы'
    },
    en: {
      title: 'Quality and attachments', quality: 'Quality', qualityNone: 'Not set',
      slots: (used, max) => `slots ${used}/${max}`, slotsShort: n => `${n} sl.`,
      installed: 'Installed', none: 'No attachments.', pick: 'Attachment', attach: 'Install', detach: 'Remove',
      detachLabel: name => `Remove: ${name}`, price: n => `${n} eb`,
      noSlots: 'This weapon has no attachment slots: the reference gives them to ordinary ranged weapons only.',
      notEligible: (name, rule) => `${name} does not fit this weapon: ${rule}.`,
      duplicate: name => `${name} is already installed: duplicate attachments add no further effect.`,
      oneMagazine: 'A magazine is already installed: only one (extended or drum) is allowed.',
      full: (name, need, free) => `${name} takes ${need} slot(s) but ${free} are free. Remove something first.`,
      unknown: 'This thing is not a weapon attachment.', noData: 'The attachment reference is not available.',
      stale: 'The sheet changed. Try again.', undo: 'Undo',
      attached: (name, weapon) => `Installed: ${name} → ${weapon}.`, detached: (name, weapon) => `Removed: ${name} ← ${weapon}.`,
      qualitySet: (q, weapon) => `${weapon}: ${q}.`, qualityCleared: weapon => `${weapon}: quality not set.`,
      capacity: n => `Magazine capacity: ${n}.`, capacityManual: n => `The table gives capacity ${n}: enter it on the weapon yourself, it holds another number now.`,
      attack: n => `${signed(n)} to attack`, attackManual: n => `${signed(n)} to attack: add it to the weapon's modifier yourself`,
      notFit: 'does not fit', pickFirst: 'Attachments that fit come first.',
      noteBy: (name, text) => `${name}: ${text}`, linked: 'Linked to the weapon',
      inWeapon: name => `in weapon ${name}`, toThing: name => `linked to ${name}`,
      linkLabel: 'Link', linkPick: 'Link to…', linkNone: 'Not linked',
      linkSet: (thing, parent) => `${thing}: linked to “${parent}”.`, linkCleared: thing => `${thing}: link removed.`,
      linkSelf: 'A thing cannot be linked to itself.', linkCycle: 'Things cannot be linked in a circle.', linkGone: 'That thing or weapon is no longer on the sheet.',
      unnamed: 'Unnamed', weaponsGroup: 'Weapons', itemsGroup: 'Items'
    }
  };
  const t = (lang, key, ...args) => { const v = (T[L(lang)] || T.ru)[key] ?? T.ru[key]; return typeof v === 'function' ? v(...args) : v; };
  const fail = (lang, reason, ...args) => ({ ok: false, reason, message: t(lang, reason, ...args) });
  const clone = x => JSON.parse(JSON.stringify(x));

  // ---------- 1. Pure functions ----------

  function displayName(record, lang) {
    try { const name = global.GearFlow?.displayName?.(record, lang); if (name) return String(name); } catch { /* the stored name will do */ }
    const item = catalogItem(record?.catalogId), own = String(record?.name || '').trim();
    return own || item?.name?.[L(lang)] || t(lang, 'unnamed');
  }
  const rows = (c, kind) => (isObject(c?.extra) && Array.isArray(c.extra[kind]) ? c.extra[kind] : []);
  // A record is found by an id that exactly one entry of the list has (the rule GearFlow uses).
  function find(c, kind, id) {
    if (typeof id !== 'string' || !id) return null;
    const hits = rows(c, kind).filter(r => isObject(r) && r.id === id);
    return hits.length === 1 ? hits[0] : null;
  }

  // -- quality --
  // 'poor' | 'standard' | 'excellent', or '' when nothing valid is stored.
  const qualityOf = w => (isObject(w) && QUALITIES.includes(w.quality) ? w.quality : '');
  const qualityName = (q, lang) => val(data()?.quality?.[q]?.name, lang);
  /* The prices of the three qualities of a catalog weapon, from the table of the reference (it is keyed by the standard
     price). [] when the weapon has no row in the table (an exotic weapon, a price the table does not know): then no
     quality is offered in the shop. */
  function qualityOptions(item, lang) {
    const d = data();
    if (!d || !isObject(d.quality) || !Array.isArray(d.quality.costs) || item?.category !== 'weapon' || !item.stats?.damage || !item.stats?.skill || item.stats.exotic === true) return [];
    const row = d.quality.costs.find(r => isObject(r) && r.standard === item.price);
    if (!row || !QUALITIES.every(k => Number.isSafeInteger(row[k]) && row[k] >= 0 && isObject(d.quality[k]))) return [];
    return QUALITIES.map(k => ({ value: k, label: val(d.quality[k].name, lang), price: row[k] }));
  }

  // -- attachments --
  const refOf = catalogId => {
    const map = data()?.catalogIds;
    const key = isObject(map) ? Object.keys(map).find(k => map[k] === catalogId) : undefined;
    return key ? (data().attachments || []).find(a => a && a.id === key) || null : null;
  };
  // Slots an attachment takes: the catalog says so (stats.slots), else the reference. null: not an attachment at all.
  function slotCost(catalogId) {
    const item = catalogItem(catalogId);
    if (!item || item.category !== 'attachment') return null;
    const own = item.stats?.slots;
    if (Number.isSafeInteger(own) && own >= 1 && own <= 10) return own;
    const ref = refOf(catalogId);
    return ref && Number.isSafeInteger(ref.slots) && ref.slots >= 1 ? ref.slots : null;
  }
  const installable = () => (Array.isArray(global.CATALOG) ? global.CATALOG.filter(x => x && x.category === 'attachment' && slotCost(x.id) !== null) : []);
  const attachmentName = (catalogId, lang) => catalogItem(catalogId)?.name?.[L(lang)] || catalogId;

  // The attachments of a weapon that can be read: known catalog attachments, each once, in order.
  function attachmentsOf(w) {
    const out = [], seen = new Set();
    if (!isObject(w) || !Array.isArray(w.attachments)) return out;
    for (const id of w.attachments.slice(0, MAX_READ)) {
      if (typeof id !== 'string' || seen.has(id)) continue;
      const cost = slotCost(id);
      if (cost === null) continue;
      seen.add(id); out.push({ id, cost });
    }
    return out;
  }
  // What kind of weapon this is, from the catalog entry or, for one written in by hand, from its attack skill.
  function classify(w) {
    const item = catalogItem(w?.catalogId), skill = String(item ? item.stats?.skill ?? '' : w?.skill ?? '');
    const exotic = item ? item.stats?.exotic === true : false;
    return { known: !!item, skill, exotic, ranged: RANGED_SKILLS.includes(skill), shoulder: skill === 'Shoulder Arms', bow: skill === 'Archery' };
  }
  // Slots of the weapon: the reference gives them to an ordinary (non-exotic) ranged weapon only.
  function slotLimit(w) {
    const d = data(), cls = classify(w);
    return d && Number.isSafeInteger(d.attachmentSlots) && d.attachmentSlots > 0 && cls.ranged && !cls.exotic ? d.attachmentSlots : 0;
  }
  const slotsUsed = w => attachmentsOf(w).reduce((n, a) => n + a.cost, 0);
  const slotsFree = w => Math.max(0, slotLimit(w) - slotsUsed(w));
  const isMagazine = catalogId => MAGAZINES.includes(refOf(catalogId)?.id);
  const magazineKind = w => {
    const ids = attachmentsOf(w).map(a => refOf(a.id)?.id);
    return ids.includes('drum-magazine') ? 'drum' : ids.includes('extended-magazine') ? 'extended' : 'standard';
  };
  // Does the weapon suit this attachment? Only the reference's own rules are checked; a custom attachment fits any weapon with slots.
  function eligible(cls, ref) {
    if (!ref) return true;
    if (['bayonet', 'grenade-underbarrel', 'shotgun-underbarrel'].includes(ref.id)) return cls.shoulder && !cls.exotic;
    if (MAGAZINES.includes(ref.id)) return cls.ranged && !cls.exotic && !cls.bow;
    return cls.ranged && !cls.exotic;
  }
  /* Can this weapon take this attachment now? {ok:true, cost, free} or {ok:false, reason, message}: the message says why
     not (no slots, wrong weapon type, a duplicate, a second magazine, too few free slots). */
  function check(w, catalogId, lang) {
    const d = data();
    if (!d) return fail(lang, 'noData');
    const cost = slotCost(catalogId);
    if (cost === null) return fail(lang, 'unknown');
    const name = attachmentName(catalogId, lang), ref = refOf(catalogId);
    if (slotLimit(w) <= 0) return fail(lang, 'noSlots');
    if (!eligible(classify(w), ref)) return fail(lang, 'notEligible', name, lowerFirst(val(ref?.eligibility, lang).replace(/\.$/, '')));
    const now = attachmentsOf(w);
    if (now.some(a => a.id === catalogId)) return fail(lang, 'duplicate', name);
    if (isMagazine(catalogId) && now.some(a => isMagazine(a.id))) return fail(lang, 'oneMagazine');
    const free = slotsFree(w);
    if (cost > free) return fail(lang, 'full', name, cost, free);
    return { ok: true, cost, free };
  }

  // The magazine capacity the reference gives this weapon for a kind of magazine, or null.
  const capacityFor = (w, kind) => {
    const row = (data()?.magazines?.rows || []).find(r => r && r.id === w?.catalogId);
    return row && Number.isSafeInteger(row[kind]) ? row[kind] : null;
  };
  /* Moves the capacity of the weapon from one magazine kind to another, but only when the sheet still holds the number
     the table gave for the old kind (a hand-written number is never overwritten). null: nothing to say. */
  function moveCapacity(w, from, to) {
    const was = capacityFor(w, from), now = capacityFor(w, to);
    if (was === null || now === null || was === now) return null;
    if (Number(w.capacity) !== was) return { applied: false, value: now };
    w.capacity = now;
    if (Number(w.ammo) > now) w.ammo = now;
    return { applied: true, value: now };
  }

  // The effects of quality and attachments. attack: a plain number the data defines; notes: everything that depends on a situation.
  function effects(w, lang) {
    const d = data(), out = { attack: 0, notes: [] };
    if (!d || !isObject(w)) return out;
    const q = qualityOf(w);
    if (q && isObject(d.quality?.[q])) {
      const m = d.quality[q].attackModifier;
      if (Number.isSafeInteger(m)) out.attack += m;
      if (q !== 'standard') out.notes.push(t(lang, 'noteBy', val(d.quality[q].name, lang), val(d.quality[q].description, lang)));
    }
    for (const a of attachmentsOf(w)) {
      const ref = refOf(a.id), text = ref ? val(ref.effect, lang) : catalogItem(a.id)?.details?.[L(lang)] || '';
      if (text) out.notes.push(t(lang, 'noteBy', attachmentName(a.id, lang), text));
    }
    return out;
  }
  // The attack modifier a weapon gets from its quality (character-extra.js adds it to the attack bonus).
  let attackWired = false;
  const attackModifier = w => { attackWired = true; return isObject(w) ? effects(w, 'en').attack : 0; };

  // Short pieces for the weapon line of a card.
  function summary(w, lang) {
    const out = [], q = qualityOf(w), limit = slotLimit(w);
    if (q && q !== 'standard') { const m = effects(w, 'en').attack; out.push(qualityName(q, lang) + (m ? ' (' + t(lang, attackWired ? 'attack' : 'attackManual', m) + ')' : '')); }
    const used = slotsUsed(w);
    if (limit > 0 && used > 0) out.push(t(lang, 'slots', used, limit));
    return out;
  }

  // -- changes of a weapon, each with an undo that carries the whole record as it was --
  // The undo keeps only the fields a change touches (value before and value after, as JSON). Taking it back puts a field
  // back only while it still holds what the change set: whatever the player did to the weapon since stays.
  const UNDO_KEYS = ['quality', 'attachments', 'capacity', 'ammo'];
  const keep = (w, k) => (Object.hasOwn(w, k) && w[k] !== undefined ? JSON.stringify(w[k]) : null);
  function snapshot(c, w) { const before = {}; for (const k of UNDO_KEYS) before[k] = keep(w, k); return { characterId: c?.id, weaponId: w.id, before, after: null }; }
  function seal(undo, w) { const after = {}; for (const k of UNDO_KEYS) after[k] = keep(w, k); undo.after = after; return undo; }
  function restore(c, undo, lang) {
    const w = find(c, 'weapons', undo?.weaponId);
    if (!w || !isObject(undo.before) || !isObject(undo.after) || (c.id && undo.characterId !== c.id)) return fail(lang, 'stale');
    for (const k of UNDO_KEYS) {
      if (undo.before[k] === undo.after[k] || keep(w, k) !== undo.after[k]) continue;
      if (undo.before[k] === null) delete w[k]; else w[k] = JSON.parse(undo.before[k]);
    }
    return { ok: true, dirty: true };
  }
  function install(c, weaponId, catalogId, lang) {
    const w = find(c, 'weapons', weaponId);
    if (!w) return fail(lang, 'stale');
    const why = check(w, catalogId, lang);
    if (!why.ok) return why;
    const undo = snapshot(c, w), from = magazineKind(w);
    w.attachments = Array.isArray(w.attachments) ? w.attachments.filter(x => typeof x === 'string').slice(0, MAX_READ) : [];
    w.attachments.push(catalogId);
    const cap = isMagazine(catalogId) ? moveCapacity(w, from, magazineKind(w)) : null;
    const extra = cap ? ' ' + t(lang, cap.applied ? 'capacity' : 'capacityManual', cap.value) : '';
    return { ok: true, dirty: true, undo: seal(undo, w), message: t(lang, 'attached', attachmentName(catalogId, lang), displayName(w, lang)) + extra };
  }
  function uninstall(c, weaponId, catalogId, lang) {
    const w = find(c, 'weapons', weaponId);
    if (!w || !Array.isArray(w.attachments) || !w.attachments.includes(catalogId)) return fail(lang, 'stale');
    const undo = snapshot(c, w), from = magazineKind(w);
    w.attachments = w.attachments.filter(x => x !== catalogId);
    if (!w.attachments.length) delete w.attachments;
    const cap = isMagazine(catalogId) ? moveCapacity(w, from, magazineKind(w)) : null;
    const extra = cap ? ' ' + t(lang, cap.applied ? 'capacity' : 'capacityManual', cap.value) : '';
    return { ok: true, dirty: true, undo: seal(undo, w), message: t(lang, 'detached', attachmentName(catalogId, lang), displayName(w, lang)) + extra };
  }
  // '' clears the quality (the weapon is as it was before the field existed).
  function setQuality(c, weaponId, quality, lang) {
    const w = find(c, 'weapons', weaponId);
    if (!w) return fail(lang, 'stale');
    if (quality !== '' && !QUALITIES.includes(quality)) return fail(lang, 'unknown');
    const undo = snapshot(c, w);
    if (quality === '') delete w.quality; else w.quality = quality;
    const name = displayName(w, lang);
    return { ok: true, dirty: qualityOf({ quality: undo.before.quality === null ? undefined : JSON.parse(undo.before.quality) }) !== quality, undo: seal(undo, w), message: quality === '' ? t(lang, 'qualityCleared', name) : t(lang, 'qualitySet', qualityName(quality, lang), name) };
  }

  // -- links between things --
  // The thing this record is linked to, or null (no link, or the parent is gone: a dangling id is never shown).
  function parentOf(c, record) {
    const id = isObject(record) ? record.linkedTo : undefined;
    if (typeof id !== 'string' || !id || id === record.id) return null;
    const weapon = find(c, 'weapons', id);
    if (weapon) return { kind: 'weapons', record: weapon };
    const item = find(c, 'items', id);
    return item ? { kind: 'items', record: item } : null;
  }
  // Drops a linkedTo that points at nothing (the parent was deleted on the sheet itself). Returns how many were dropped.
  function pruneDangling(c) {
    let n = 0;
    for (const r of rows(c, 'items')) if (isObject(r) && 'linkedTo' in r && !parentOf(c, r)) { delete r.linkedTo; n++; }
    return n;
  }
  // Things linked to this one (a weapon or a thing), in the order of the list.
  const childrenOf = (c, id) => (typeof id === 'string' && id ? rows(c, 'items').filter(r => isObject(r) && r.linkedTo === id && r.id !== id) : []);
  // Would linking `childId` under this parent close a circle?
  function wouldCycle(c, childId, parentRecord) {
    let at = parentRecord, steps = 0;
    while (isObject(at) && steps++ < 50) {
      if (at.id === childId) return true;
      const next = parentOf(c, at);
      if (!next) return false;
      at = next.record;
    }
    return steps >= 50;
  }
  // parentId '' unlinks. Only a thing of the inventory is linked; the parent is a weapon or another thing.
  function link(c, itemId, parentId, lang) {
    const item = find(c, 'items', itemId);
    if (!item) return fail(lang, 'stale');
    const undo = { characterId: c?.id, itemId, had: Object.hasOwn(item, 'linkedTo'), prev: item.linkedTo };
    const thing = displayName(item, lang);
    if (parentId === '' || parentId === undefined || parentId === null) {
      const dirty = undo.had;
      delete item.linkedTo;
      return { ok: true, dirty, undo, message: t(lang, 'linkCleared', thing) };
    }
    if (parentId === itemId) return fail(lang, 'linkSelf');
    const parent = find(c, 'weapons', parentId) || find(c, 'items', parentId);
    if (!parent) return fail(lang, 'linkGone');
    if (wouldCycle(c, itemId, parent)) return fail(lang, 'linkCycle');
    const dirty = item.linkedTo !== parentId;
    item.linkedTo = parentId;
    return { ok: true, dirty, undo, message: t(lang, 'linkSet', thing, displayName(parent, lang)) };
  }
  function restoreLink(c, undo, lang) {
    const item = find(c, 'items', undo?.itemId);
    if (!item || (c.id && undo.characterId !== c.id)) return fail(lang, 'stale');
    if (undo.had) item.linkedTo = undo.prev; else delete item.linkedTo;
    return { ok: true, dirty: true };
  }

  // ---------- 2. Markup ----------

  const open = new Set();
  const isOpen = id => typeof id === 'string' && open.has(id);
  const wattr = w => `data-wa-weapon="${esc(w.id)}"`;

  // The line under a weapon card: quality and slots.
  function lineParts(w, lang) { return summary(w, lang); }

  function qualityField(w, lang) {
    const d = data(), now = qualityOf(w);
    if (!d?.quality) return '';
    const opt = (v, label) => `<option value="${v}"${v === now ? ' selected' : ''}>${esc(label)}</option>`;
    const hint = now ? val(d.quality[now]?.description, lang) : '';
    return `<label class="field wa-field">${esc(t(lang, 'quality'))}<select data-wa-quality ${wattr(w)}>${opt('', t(lang, 'qualityNone'))}${QUALITIES.map(k => opt(k, val(d.quality[k]?.name, lang))).join('')}</select></label>${hint ? `<p class="wa-hint">${esc(hint)}</p>` : ''}`;
  }
  function attachSection(w, lang) {
    const limit = slotLimit(w), list = attachmentsOf(w);
    if (limit <= 0 && !list.length) return `<p class="wa-hint">${esc(t(lang, 'noSlots'))}</p>`;
    const used = slotsUsed(w);
    const installedList = list.length
      ? `<ul class="wa-installed">${list.map(a => { const name = attachmentName(a.id, lang); return `<li><span>${esc(name)} <small>${esc(t(lang, 'slotsShort', a.cost))}</small></span><button type="button" class="cx-button wa-detach" data-wa-action="detach" ${wattr(w)} data-wa-cat="${esc(a.id)}" aria-label="${esc(t(lang, 'detachLabel', name))}">${esc(t(lang, 'detach'))}</button></li>`; }).join('')}</ul>`
      : `<p class="wa-hint">${esc(t(lang, 'none'))}</p>`;
    const rated = installable().map(x => ({ x, fits: check(w, x.id, lang).ok }));
    rated.sort((p, q) => Number(q.fits) - Number(p.fits));
    const firstFit = rated.findIndex(r => r.fits);
    const options = rated.map(({ x, fits }, i) => `<option value="${esc(x.id)}"${i === Math.max(0, firstFit) ? ' selected' : ''}>${esc((x.name?.[L(lang)] || x.id) + ' · ' + t(lang, 'slotsShort', slotCost(x.id)) + (Number.isFinite(x.price) ? ' · ' + t(lang, 'price', x.price) : '') + (fits ? '' : ' · ' + t(lang, 'notFit')))}</option>`).join('');
    const add = limit > 0 && options ? `<div class="wa-add"><label class="field wa-field">${esc(t(lang, 'pick'))}<select data-wa-pick ${wattr(w)}>${options}</select></label><button type="button" class="cx-button wa-attach" data-wa-action="attach" ${wattr(w)}>${esc(t(lang, 'attach'))}</button></div>` : '';
    return `<p class="wa-title">${esc(t(lang, 'installed'))}: ${esc(t(lang, 'slots', used, limit))}</p>${installedList}${add}`;
  }
  /* The panel of a weapon card: quality, attachments (the picker refuses what does not fit and says why), the effects as
     notes, and the things linked to this weapon. A weapon without an id cannot be pointed at: no panel. */
  function panel(c, w, lang) {
    if (!isObject(w) || typeof w.id !== 'string' || !w.id || !data()) return '';
    const sum = summary(w, lang), notes = effects(w, lang).notes, kids = childrenOf(c, w.id);
    return `<details class="wa-panel" data-wa-panel ${wattr(w)}${isOpen(w.id) ? ' open' : ''}><summary><span>${esc(t(lang, 'title'))}</span>${sum.length ? `<small>${esc(sum.join(' · '))}</small>` : ''}</summary><div class="wa-body">${qualityField(w, lang)}${attachSection(w, lang)}<p class="wa-status" role="status" aria-live="polite" data-wa-status></p>${notes.length ? `<ul class="wa-notes">${notes.map(n => `<li>${esc(n)}</li>`).join('')}</ul>` : ''}${kids.length ? `<p class="wa-title">${esc(t(lang, 'linked'))}</p><ul class="wa-notes">${kids.map(k => `<li>${esc(displayName(k, lang))}</li>`).join('')}</ul>` : ''}</div></details>`;
  }
  // «в оружии X» / «к предмету X» for a linked thing; '' when it is not linked.
  function linkChip(c, record, lang) {
    const p = parentOf(c, record);
    return p ? `<span class="wa-chip" data-wa-link-chip>${esc(t(lang, p.kind === 'weapons' ? 'inWeapon' : 'toThing', displayName(p.record, lang)))}</span>` : '';
  }
  /* The link control of a thing: the chip and a select with the weapons and the other things. Offered for things that
     have an id; the select lists only what the thing can be linked to without closing a circle. */
  function linkField(c, record, lang) {
    if (!isObject(record) || typeof record.id !== 'string' || !record.id) return '';
    const here = parentOf(c, record), chosen = here ? here.record.id : '';
    const free = (kind, r) => isObject(r) && typeof r.id === 'string' && r.id && r.id !== record.id && (kind === 'weapons' || !wouldCycle(c, record.id, r));
    const weapons = rows(c, 'weapons').filter(r => free('weapons', r)), things = rows(c, 'items').filter(r => free('items', r));
    if (!weapons.length && !things.length) return '';
    const opt = r => `<option value="${esc(r.id)}"${r.id === chosen ? ' selected' : ''}>${esc(displayName(r, lang))}</option>`;
    const group = (label, list) => list.length ? `<optgroup label="${esc(label)}">${list.map(opt).join('')}</optgroup>` : '';
    return `<label class="field wa-link"><span>${esc(t(lang, 'linkLabel'))}</span><select data-wa-link data-wa-rid="${esc(record.id)}" aria-label="${esc(t(lang, 'linkLabel') + ': ' + displayName(record, lang))}"><option value="">${esc(t(lang, here ? 'linkNone' : 'linkPick'))}</option>${group(t(lang, 'weaponsGroup'), weapons)}${group(t(lang, 'itemsGroup'), things)}</select></label>`;
  }

  // ---------- 3. Page wiring ----------

  const doc = global.document, app = () => global.App;
  const lang = () => (app()?.lang?.() === 'en' ? 'en' : 'ru');
  const say = message => { if (message) app()?.notify?.(message); };
  const inApp = el => !!el && doc?.querySelector?.('#app')?.contains(el) === true;
  const stale = () => { say(t(lang(), 'stale')); app()?.render?.(); };
  const commit = result => { if (result?.ok && result.dirty !== false) { app()?.save?.(); app()?.render?.(); } return result; };
  // After the sheet is drawn again the control that was used is a new element: find it by what it carries.
  function refocus(selector, match) {
    for (const el of doc?.querySelectorAll?.(selector) || []) {
      if (!match(el)) continue;
      el.focus?.({ preventScroll: true });
      return doc.activeElement === el;
    }
    return false;
  }
  const focusWeapon = (id, ...selectors) => selectors.some(s => refocus(s, el => el.dataset.waWeapon === id)) || refocus('[data-wa-panel] summary', el => el.parentElement?.dataset?.waWeapon === id);
  // A change with an undo: the notice offers to take it back for a while.
  function announce(c, r, back) {
    const A = app(), l = lang(), id = c.id;
    const again = () => {
      const now = A?.getState?.()?.characters?.find?.(x => x && x.id === id);
      const done = now ? back(now, lang()) : fail(lang(), 'stale');
      commit(done); if (!done.ok) say(done.message);
    };
    if (typeof A?.notifyAction === 'function') A.notifyAction(r.message, t(l, 'undo'), again); else say(r.message);
  }
  function panelOf(el) { return el?.closest?.('[data-wa-panel]') || null; }
  function status(el, message) {
    const box = panelOf(el)?.querySelector?.('[data-wa-status]');
    if (box) box.textContent = message || '';
    say(message);
  }
  function weaponTarget(el) {
    const c = app()?.active?.(), id = el?.dataset?.waWeapon;
    return c && id && find(c, 'weapons', id) ? { c, id } : null;
  }
  function onClick(e) {
    const el = e.target?.closest?.('[data-wa-action]');
    if (!el || !inApp(el)) return;
    const at = weaponTarget(el), l = lang();
    if (!at) { stale(); return; }
    if (el.dataset.waAction === 'attach') {
      const catalogId = panelOf(el)?.querySelector?.('[data-wa-pick]')?.value || '';
      const r = install(at.c, at.id, catalogId, l);
      if (!r.ok) { status(el, r.message); return; }
      open.add(at.id); commit(r); announce(at.c, r, (c2, l2) => restore(c2, r.undo, l2));
      focusWeapon(at.id, '[data-wa-pick]');
    } else if (el.dataset.waAction === 'detach') {
      const r = uninstall(at.c, at.id, el.dataset.waCat, l);
      if (!r.ok) { status(el, r.message); stale(); return; }
      open.add(at.id); commit(r); announce(at.c, r, (c2, l2) => restore(c2, r.undo, l2));
      focusWeapon(at.id, '[data-wa-pick]', '[data-wa-quality]');
    }
  }
  function onChange(e) {
    const el = e.target;
    if (!el?.dataset || !inApp(el)) return;
    if (el.dataset.waQuality !== undefined) {
      const at = weaponTarget(el);
      if (!at) { stale(); return; }
      const r = setQuality(at.c, at.id, String(el.value || ''), lang());
      if (!r.ok) { status(el, r.message); return; }
      open.add(at.id); commit(r); announce(at.c, r, (c2, l2) => restore(c2, r.undo, l2));
      focusWeapon(at.id, '[data-wa-quality]');
    } else if (el.dataset.waLink !== undefined) {
      const c = app()?.active?.(), rid = el.dataset.waRid;
      if (!c || !find(c, 'items', rid)) { stale(); return; }
      const r = link(c, rid, String(el.value || ''), lang());
      if (!r.ok) { say(r.message); app()?.render?.(); refocus('[data-wa-link]', x => x.dataset.waRid === rid); return; }
      commit(r); announce(c, r, (c2, l2) => restoreLink(c2, r.undo, l2));
      refocus('[data-wa-link]', x => x.dataset.waRid === rid);
    }
  }
  function onToggle(e) {
    const el = e.target;
    if (!el?.matches?.('[data-wa-panel]')) return;
    const id = el.dataset.waWeapon;
    if (el.open) open.add(id); else open.delete(id);
  }
  if (doc?.addEventListener) {
    doc.addEventListener('click', onClick);
    doc.addEventListener('change', onChange);
    doc.addEventListener('toggle', onToggle, true);
  }

  global.WeaponAttach = {
    QUALITIES, T, t, data, qualityOf, qualityName, qualityOptions, slotCost, installable, attachmentsOf, classify, slotLimit, slotsUsed, slotsFree,
    check, install, uninstall, setQuality, restore, effects, attackModifier, summary, lineParts, capacityFor, magazineKind,
    parentOf, childrenOf, pruneDangling, link, restoreLink, wouldCycle, panel, linkChip, linkField, isOpen,
    _test: { open }
  };
})(typeof window !== 'undefined' ? window : globalThis);
