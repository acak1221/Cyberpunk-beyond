/* The combat page (#/combat): the live tracker of the active campaign, or a temporary «Quick combat» without one.
   A big round banner with the current actor and a sticky «Next turn»; one-line rows (name, initiative, HP bar, chips);
   a tap on a row opens its actions (health pad, a hit with the armor already filled in, initiative, crit roll, moves,
   cyberweapons, programs). Groups of mooks (×5 with one initiative roll, one stat block, a pip per member, bulk damage,
   «remove the fallen»). The calculators (range, autofire, area, grapple, hazards, vehicles, martial arts, weapons) wait in
   a tools drawer on the same page and are filled in from the selected actor.
   The data are the campaign's own: roster rows, c.turnIndex, c.round. Groups add two optional fields: row.grp (a group id)
   and c.groups (the stat block of each group); rows without them behave exactly as before.
   Dice go through rolls.js. Pure rules are exported for tests (the browser part is at the bottom). */
(function (global) {
  'use strict';
  const doc = global.document;
  const MAX_ROSTER = 2045, MAX_GROUPS = 100, QUICK_KEY = 'nightcity-red-quick-combat';
  const T = {
    ru: {
      title: 'Бой', now: 'Ходит', nobody: 'В бою пока никого нет', round: 'Раунд', turn: 'Ход', next: 'Следующий ход', prev: 'Предыдущий ход',
      bannerLabel: 'Текущий ход', campaign: 'Кампания', quick: 'Быстрый бой', quickShort: 'Быстрый бой (временный)', quickName: 'Быстрый бой',
      quickHelp: 'Временная схватка без кампании. Она хранится только в этой вкладке; сохраните её как кампанию, чтобы оставить.',
      quickSave: 'Сохранить как кампанию', quickSaved: 'Бой сохранён как кампания', quickEnd: 'Закончить бой', quickEnded: 'Быстрый бой закончен', quickStart: 'Начать быстрый бой',
      noCampaign: 'Кампаний пока нет. Начните быстрый бой: он не требует ни кампании, ни листа.', openCampaign: 'Страница кампании', menu: 'Ещё',
      rollAll: 'Инициатива всем', rolledAll: n => `Инициатива брошена (участников: ${n})`, reset: 'Начать раунды заново', resetDone: 'Бой сброшен', clearNpcs: 'Убрать всех противников',
      add: 'Добавить в бой', addPc: 'Персонаж игрока', addPcDo: 'Добавить персонажа', noPc: 'Нет листов для добавления', addNpc: 'Противник', addNpcDo: 'Добавить противника',
      fName: 'Имя', fRef: 'REF', fHp: 'HP', fCount: 'Сколько', fSpHead: 'SP головы', fSpBody: 'SP тела', fNote: 'Оружие и заметка',
      groupHelp: 'Больше одного — группа: один бросок инициативы, общий блок параметров, у каждого свои HP.', template: 'Противник из книги', templateDo: 'Добавить из книги',
      defaultName: 'Противник', added: n => `Добавлено: ${n}`, full: 'В бою не может быть больше 2045 участников.', badNew: 'Проверьте поля: REF 0–20, HP 1–999, число 1–20, SP 0–30.',
      pcs: 'ПЕРСОНАЖ', npcs: 'ПРОТИВНИК', notLinked: 'Лист не найден', ally: 'Союзник',
      init: 'Инициатива', hp: 'HP', hpOf: (a, b) => `HP ${a}${b ? ' из ' + b : ''}`, sp: 'SP', head: 'Голова', body: 'Тело',
      full_: 'Здоров', light: 'Ранен', serious: 'Тяжело ранен', mortal: 'Смертельно ранен', dead: 'Мёртв', out: 'Выбыл', held: 'Держит действие',
      actions: 'Действия', openSheet: 'Открыть лист', hpPad: 'Изменить HP', hit: 'Попадание', hitHelp: 'Урон до брони. SP взят из строки.', raw: 'Урон до брони', place: 'Куда',
      crit: 'Критическое попадание', apply: 'Нанести урон', hitBad: 'Введите урон от 1 до 999.', hitStale: 'Боец изменился. Повторите действие.', hitDone: (n, raw, sp, dealt, hp) => `${n}: удар ${raw}, броня ${sp}, прошло ${dealt}, HP ${hp}`,
      hitStopped: (n, raw, sp) => `${n}: броня ${sp} остановила удар ${raw}`,
      rollOne: 'Бросить инициативу', toTop: 'Наверх очереди', hold: 'Придержать', unhold: 'Снять «держит»', markOut: 'Выбыл', markIn: 'Вернуть в бой', remove: 'Убрать из боя', removed: n => `Убрано: ${n}`, undo: 'Вернуть', restored: n => `Возвращено: ${n}`,
      critRoll: 'Критическое ранение', critBody: 'Тело', critHead: 'Голова', critResult: (t, n, e) => `Критическое ранение (2d6 = ${t}): ${n}. ${e}`,
      death: 'Death Save', deathBody: 'BODY противника', deathNeed: 'Укажите BODY от 1 до 20.', deathOk: (n, d, p, b) => `${n}: Death Save пройден (d10 ${d} + штраф ${p} < BODY ${b})`, deathFail: (n, d, p, b) => `${n}: Death Save провален (d10 ${d} + штраф ${p}, BODY ${b}). Мёртв.`,
      toolsFor: n => `Инструменты для ${n}`, tools: 'Инструменты', toolsHelp: 'Калькуляторы боя. Открытый боец подставляет в них свои числа.', toolsFind: 'Найти инструмент', toolsNone: 'Ничего не нашлось', toolsClose: 'Свернуть', toolsOpen: 'Показать',
      moves: 'Приёмы', cyber: 'Кибероружие', programs: 'Программы', deck: 'Дека', noneYet: 'Пока ничего',
      group: 'Группа', members: 'Бойцы группы', alive: (a, t) => `${a} из ${t}`, groupHit: 'Урон каждому в группе', groupHitDo: 'Ударить всех', groupDone: (n, f) => `Задето: ${n}, выбыло: ${f}`, groupNone: 'В группе некому получать урон.',
      removeFallen: 'Убрать выбывших', noFallen: 'Выбывших нет', ungroup: 'Распустить группу', stat: 'Общие параметры', saved: 'Сохранено',
      pip: (n, a, b) => `${n}: HP ${a} из ${b}`, rolled: n => `Инициатива: ${n}`, hint: 'Нажмите на бойца, чтобы открыть его действия.', stale: 'Данные изменились. Повторите действие.',
      editInit: 'Инициатива вручную', noteLabel: 'Заметка',
    },
    en: {
      title: 'Combat', now: 'Acting', nobody: 'Nobody is in the fight yet', round: 'Round', turn: 'Turn', next: 'Next turn', prev: 'Previous turn',
      bannerLabel: 'Current turn', campaign: 'Campaign', quick: 'Quick combat', quickShort: 'Quick combat (temporary)', quickName: 'Quick combat',
      quickHelp: 'A temporary fight without a campaign. It is kept in this tab only; save it as a campaign to keep it.',
      quickSave: 'Save as a campaign', quickSaved: 'The fight was saved as a campaign', quickEnd: 'End the fight', quickEnded: 'Quick combat ended', quickStart: 'Start a quick combat',
      noCampaign: 'There are no campaigns yet. Start a quick combat: it needs neither a campaign nor a sheet.', openCampaign: 'Campaign page', menu: 'More',
      rollAll: 'Roll initiative for all', rolledAll: n => `Initiative rolled (combatants: ${n})`, reset: 'Restart the rounds', resetDone: 'Combat reset', clearNpcs: 'Remove all opponents',
      add: 'Add to the fight', addPc: 'Player character', addPcDo: 'Add the character', noPc: 'No sheets to add', addNpc: 'Opponent', addNpcDo: 'Add the opponent',
      fName: 'Name', fRef: 'REF', fHp: 'HP', fCount: 'How many', fSpHead: 'Head SP', fSpBody: 'Body SP', fNote: 'Weapons and a note',
      groupHelp: 'More than one makes a group: one initiative roll, one stat block, separate HP for each.', template: 'Opponent from the book', templateDo: 'Add from the book',
      defaultName: 'Opponent', added: n => `Added: ${n}`, full: 'A fight cannot hold more than 2045 combatants.', badNew: 'Check the fields: REF 0–20, HP 1–999, count 1–20, SP 0–30.',
      pcs: 'CHARACTER', npcs: 'OPPONENT', notLinked: 'Sheet not found', ally: 'Ally',
      init: 'Initiative', hp: 'HP', hpOf: (a, b) => `HP ${a}${b ? ' of ' + b : ''}`, sp: 'SP', head: 'Head', body: 'Body',
      full_: 'Unhurt', light: 'Wounded', serious: 'Seriously wounded', mortal: 'Mortally wounded', dead: 'Dead', out: 'Out', held: 'Holding an action',
      actions: 'Actions', openSheet: 'Open sheet', hpPad: 'Change HP', hit: 'Hit', hitHelp: 'Damage before armor. SP comes from the row.', raw: 'Damage before armor', place: 'Where',
      crit: 'Critical hit', apply: 'Apply damage', hitBad: 'Enter damage from 1 to 999.', hitStale: 'The combatant changed. Try again.', hitDone: (n, raw, sp, dealt, hp) => `${n}: hit ${raw}, armor ${sp}, through ${dealt}, HP ${hp}`,
      hitStopped: (n, raw, sp) => `${n}: armor ${sp} stopped the hit of ${raw}`,
      rollOne: 'Roll initiative', toTop: 'To the top of the order', hold: 'Hold', unhold: 'Stop holding', markOut: 'Out', markIn: 'Back in', remove: 'Remove from the fight', removed: n => `Removed: ${n}`, undo: 'Undo', restored: n => `Restored: ${n}`,
      critRoll: 'Critical Injury', critBody: 'Body', critHead: 'Head', critResult: (t, n, e) => `Critical Injury (2d6 = ${t}): ${n}. ${e}`,
      death: 'Death Save', deathBody: 'Opponent BODY', deathNeed: 'Enter BODY from 1 to 20.', deathOk: (n, d, p, b) => `${n}: Death Save passed (d10 ${d} + penalty ${p} < BODY ${b})`, deathFail: (n, d, p, b) => `${n}: Death Save failed (d10 ${d} + penalty ${p}, BODY ${b}). Dead.`,
      toolsFor: n => `Tools for ${n}`, tools: 'Tools', toolsHelp: 'Combat calculators. The open combatant fills in their numbers.', toolsFind: 'Find a tool', toolsNone: 'Nothing found', toolsClose: 'Collapse', toolsOpen: 'Show',
      moves: 'Moves', cyber: 'Cyberweapons', programs: 'Programs', deck: 'Deck', noneYet: 'Nothing yet',
      group: 'Group', members: 'Members of the group', alive: (a, t) => `${a} of ${t}`, groupHit: 'Damage to each in the group', groupHitDo: 'Hit everyone', groupDone: (n, f) => `Hit: ${n}, fell: ${f}`, groupNone: 'Nobody in the group can take damage.',
      removeFallen: 'Remove the fallen', noFallen: 'Nobody has fallen', ungroup: 'Disband the group', stat: 'Shared stats', saved: 'Saved',
      pip: (n, a, b) => `${n}: HP ${a} of ${b}`, rolled: n => `Initiative: ${n}`, hint: 'Tap a combatant to open their actions.', stale: 'The data changed. Try again.',
      editInit: 'Set initiative by hand', noteLabel: 'Note',
    },
  };
  // The calculators: id (the anchors of the old page keep their ids), names, words to search by, and what draws them.
  Object.assign(T.ru, { forcedCrit: ' Критическое ранение: бросьте по таблице.', sentHit: n => `Урон отправлен игроку: ${n}.`, hitFail: 'Не удалось применить урон.' });
  Object.assign(T.en, { forcedCrit: ' Critical injury: roll on the table.', sentHit: n => `Damage sent to the player: ${n}.`, hitFail: 'Could not apply the damage.' });
  const TOOLS = [
    { id: 'overview', ru: 'Дальность, броня и ранения', en: 'Range, armor & injuries', kw: 'dv дальность урон крит ранение броня sp движение range damage armor injury movement cover укрытие', mod: 'CombatTools' },
    { id: 'autofire', ru: 'Автоматический огонь', en: 'Autofire', kw: 'очередь автоогонь autofire burst', mod: 'AutofireTools' },
    { id: 'area', ru: 'Площадные атаки', en: 'Area attacks', kw: 'граната взрыв дробь area explosion grenade shotgun', mod: 'AreaTools' },
    { id: 'grapple', ru: 'Ближний бой и захват', en: 'Brawling & grappling', kw: 'захват рукопашный бросок melee grab throw brawl', mod: 'GrappleTools' },
    { id: 'hazards', ru: 'Опасности среды', en: 'Environmental hazards', kw: 'огонь яд падение hazard fire poison fall', mod: 'HazardTools' },
    { id: 'vehicles', ru: 'Транспорт и погони', en: 'Vehicles & chases', kw: 'машина погоня таран vehicle chase ram', mod: 'VehicleTools' },
    { id: 'martial', ru: 'Боевые искусства', en: 'Martial arts', kw: 'приём форма martial moves', mod: 'MartialArts' },
    { id: 'weapons', ru: 'Оружие и модификации', en: 'Weapons & attachments', kw: 'оружие ствол weapon attachment', mod: 'WeaponReference' },
  ];

  // ---------- small pure helpers ----------
  const isObj = x => !!x && typeof x === 'object' && !Array.isArray(x);
  const num = v => { const n = Number(v); return Number.isFinite(n) ? n : 0; };
  const int = (v, lo, hi, d = 0) => { const n = Math.trunc(Number(v)); return Number.isFinite(n) && v !== '' && v !== null ? Math.max(lo, Math.min(hi, n)) : d; };
  const esc = x => String(x ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  // A whole number inside the limits, from a number or a typed string; anything else is NaN (the caller refuses it).
  const whole = (v, lo, hi) => { const t = String(v ?? '').trim(); if (!/^-?\d+$/.test(t)) return NaN; const n = Number(t); return n >= lo && n <= hi ? n : NaN; };
  const L = l => (l === 'en' ? 'en' : 'ru');
  const tx = (l, k, ...a) => { const v = T[L(l)][k]; return typeof v === 'function' ? v(...a) : v; };
  const uid = () => global.crypto?.randomUUID?.() || Date.now().toString(36) + '-' + Math.random().toString(36).slice(2);
  // One die through rolls.js; without it (a unit test of a single file) the same face from the plain random source.
  const die = sides => { const v = global.Rolls?.d?.(sides); return Number.isInteger(v) ? v : 1 + Math.floor((global.Rolls?.rand || Math.random)() * sides); };
  const hpMaxOf = c => 10 + 5 * Math.ceil((num(c?.stats?.BODY) + num(c?.stats?.WILL)) / 2);
  const woundOf = (hp, max) => (hp < 1 ? 'mortal' : max && hp < Math.ceil(max / 2) ? 'serious' : max && hp < max ? 'light' : 'full');
  const spOf = (r, loc) => { const n = Number(r?.sp?.[loc]); return Number.isSafeInteger(n) && n >= 0 && n <= 30 ? n : 0; };

  // The turn order. Campaigns.ordered is the one the tracker page uses; the copy keeps the module usable on its own.
  function ordered(c) {
    if (global.Campaigns?.ordered) return global.Campaigns.ordered(c);
    return [...(c.roster || [])].sort((a, b) => {
      let n = (Number(b.initiative) || 0) - (Number(a.initiative) || 0); if (n) return n;
      const x = a.ties || [], y = b.ties || [];
      for (let i = 0; i < Math.max(x.length, y.length); i++) { n = (Number(y[i]) || 0) - (Number(x[i]) || 0); if (n) return n; }
      return (Number(a.order) || 0) - (Number(b.order) || 0);
    });
  }
  // A group acts once, at the place of its first member who is still in the fight.
  function isLead(roster, i) {
    const r = roster[i]; if (!r) return false; if (!r.grp) return true;
    const j = roster.findIndex(x => x.grp === r.grp && x.out !== true);
    return j === i;
  }
  // The next (dir 1) or previous (dir -1) place in the order: skips rows that are out and the other members of a group.
  function walk(c, roster, dir) {
    const n = roster.length; if (!n) return null;
    let i = int(c.turnIndex, 0, n - 1, 0), round = Math.max(1, int(c.round, 1, 99999, 1));
    for (let k = 0; k <= n; k++) {
      i += dir;
      if (i >= n) { i = 0; round++; } else if (i < 0) { if (round <= 1) return null; i = n - 1; round--; }
      if (roster[i].out === true || !isLead(roster, i)) continue;
      return { index: i, round };
    }
    return null;
  }
  // Moves the turn and reports what changed: {moved, from, round, newRound}. The held mark of the actor who now acts is dropped.
  function advance(c, dir) {
    const roster = ordered(c), step = walk(c, roster, dir === -1 ? -1 : 1);
    if (!step) return { moved: false };
    const before = Math.max(1, int(c.round, 1, 99999, 1));
    c.turnIndex = step.index; c.round = step.round;
    if (dir !== -1) delete roster[step.index].held;
    return { moved: true, from: before, round: step.round, newRound: step.round !== before, actor: roster[step.index] };
  }
  // The first place that acts: not out, and the first member of its group.
  function firstTurn(c) { const roster = ordered(c), i = roster.findIndex((r, k) => r.out !== true && isLead(roster, k)); return i >= 0 ? i : 0; }
  // Actors in a round (a group counts once) and the place of the current one among them.
  function turnCount(c) {
    const roster = ordered(c), at = int(c.turnIndex, 0, Math.max(0, roster.length - 1), 0); let total = 0, pos = 0;
    roster.forEach((r, k) => { if (r.out !== true && isLead(roster, k)) { total++; if (k <= at) pos = total; } });
    return { pos: Math.max(1, pos), total: Math.max(1, total) };
  }
  // After the order changes, the turn stays with whoever had it.
  function keepTurn(c, id) { if (!id) return; const i = ordered(c).findIndex(x => x.id === id); if (i >= 0) c.turnIndex = i; }

  function pickCampaign(campaigns, selectedId, lastId) {
    const list = Array.isArray(campaigns) ? campaigns.filter(isObj) : [];
    return list.find(x => x.id === selectedId) || list.find(x => x.id === lastId) || list.find(x => Array.isArray(x.roster) && x.roster.length) || list[0] || null;
  }

  // ---------- groups ----------
  function groupsOf(c) {
    const stored = Array.isArray(c?.groups) ? c.groups.filter(g => isObj(g) && typeof g.id === 'string' && g.id && g.id.length <= 60) : [];
    const out = new Map();
    for (const r of ordered(c)) {
      if (r.kind !== 'npc' || typeof r.grp !== 'string' || !r.grp || r.grp.length > 60) continue;
      if (!out.has(r.grp)) {
        const g = stored.find(x => x.id === r.grp) || {};
        out.set(r.grp, { id: r.grp, name: typeof g.name === 'string' && g.name ? g.name.slice(0, 100) : String(r.name || '').replace(/\s+\d+$/, '') || '?', ref: Number.isSafeInteger(g.ref) ? g.ref : r.ref, sp: isObj(g.sp) ? g.sp : r.sp || null, note: typeof g.note === 'string' ? g.note.slice(0, 300) : '', members: [] });
      }
      out.get(r.grp).members.push(r);
    }
    return out;
  }
  const isFallen = r => r.kind === 'npc' && (r.dead === true || num(r.hp) < 1);
  const standing = g => g.members.filter(r => !isFallen(r));
  // «Boosters 1…N», continuing after the highest number already used by the same base name.
  function numbered(base, count, roster) {
    const b = String(base).slice(0, 90), re = new RegExp('^' + b.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '(?: (\\d+))?$');
    let max = 0; for (const r of Array.isArray(roster) ? roster : []) { const m = r?.kind === 'npc' && typeof r.name === 'string' ? re.exec(r.name) : null; if (m) max = Math.max(max, Number(m[1]) || 1); }
    return Array.from({ length: count }, (_, i) => `${b} ${max + i + 1}`);
  }
  /* New opponents. spec: {name, count 1..20, ref 0..20, hp 1..999, spHead/spBody 0..30, note ≤300}. One makes a lone row;
     more make a group (row.grp + an entry in c.groups). Returns {ok, rows} or {ok:false, reason}. */
  function addNpcs(c, spec, lang) {
    const zero = v => (v === undefined || v === null || String(v).trim() === '' ? 0 : v);
    const count = whole(spec?.count, 1, 20), ref = whole(spec?.ref, 0, 20), hp = whole(spec?.hp, 1, 999), sph = whole(zero(spec?.spHead), 0, 30), spb = whole(zero(spec?.spBody), 0, 30);
    if (!isObj(c) || !Array.isArray(c.roster) || [count, ref, hp, sph, spb].some(Number.isNaN)) return { ok: false, reason: 'bad' };
    if (c.roster.length + count > MAX_ROSTER) return { ok: false, reason: 'full' };
    const base = String(spec?.name ?? '').trim().slice(0, 90) || tx(lang, 'defaultName'), note = String(spec?.note ?? '').replace(/\u0000/g, '').trim().slice(0, 300);
    const names = count === 1 && !c.roster.some(r => r?.name === base) ? [base] : numbered(base, count, c.roster), now = Date.now(), grp = count > 1 ? 'g' + uid().replace(/[^a-z0-9]/gi, '').slice(0, 12) : '';
    if (grp && (Array.isArray(c.groups) ? c.groups.length : 0) >= MAX_GROUPS) return { ok: false, reason: 'full' };
    const rows = names.map((name, i) => {
      const r = { id: uid(), kind: 'npc', name, ref, hp, maxHp: hp, initiative: 0, order: now + i };
      if (sph || spb) r.sp = { head: sph, body: spb };
      if (grp) r.grp = grp;
      if (note) r.combatNote = { version: 1, text: note };
      return r;
    });
    c.roster.push(...rows);
    if (grp) c.groups = [...(Array.isArray(c.groups) ? c.groups : []), { id: grp, name: base, ref, sp: sph || spb ? { head: sph, body: spb } : null, note }];
    return { ok: true, rows, group: grp || null };
  }
  // Rows that were added one by one (several copies of a book template) become a group.
  function groupRows(c, rows, name) {
    const list = rows.filter(r => isObj(r) && r.kind === 'npc' && !r.grp);
    if (list.length < 2 || (Array.isArray(c.groups) ? c.groups.length : 0) >= MAX_GROUPS) return null;
    const grp = 'g' + uid().replace(/[^a-z0-9]/gi, '').slice(0, 12), first = list[0];
    list.forEach(r => { r.grp = grp; });
    c.groups = [...(Array.isArray(c.groups) ? c.groups : []), { id: grp, name: String(name || first.name).slice(0, 100), ref: Number.isSafeInteger(first.ref) ? first.ref : 0, sp: first.sp || null, note: first.combatNote?.text || '' }];
    return grp;
  }
  // The stat block of a group is shared: a change goes to every member and to the stored block.
  function setGroupStat(c, grp, field, value) {
    const g = (Array.isArray(c.groups) ? c.groups : []).find(x => x.id === grp), members = c.roster.filter(r => r.grp === grp && r.kind === 'npc');
    if (!g || !members.length) return false;
    if (field === 'ref') { const n = whole(value, 0, 20); if (Number.isNaN(n)) return false; g.ref = n; members.forEach(r => { r.ref = n; }); return true; }
    if (field === 'spHead' || field === 'spBody') {
      const n = whole(value, 0, 30); if (Number.isNaN(n)) return false;
      const key = field === 'spHead' ? 'head' : 'body', next = { head: num(g.sp?.head), body: num(g.sp?.body), [key]: n };
      g.sp = next; members.forEach(r => { r.sp = { head: next.head, body: next.body }; }); return true;
    }
    if (field === 'note') {
      const text = String(value ?? '').replace(/\u0000/g, '').slice(0, 300); g.note = text;
      members.forEach(r => { if (text) r.combatNote = { ...(isObj(r.combatNote) ? r.combatNote : {}), version: 1, text }; else delete r.combatNote; }); return true;
    }
    return false;
  }
  function ungroup(c, grp) {
    const members = c.roster.filter(r => r.grp === grp);
    members.forEach(r => { delete r.grp; });
    c.groups = (Array.isArray(c.groups) ? c.groups : []).filter(g => g.id !== grp);
    if (!c.groups.length) delete c.groups;
    return members.length;
  }

  // ---------- initiative ----------
  const baseOf = (r, characters) => (global.Campaigns?.initiativeBase ? global.Campaigns.initiativeBase(r, characters) : Number(r.ref) || 0);
  // One roll for a row: 1d10 + the base + the row's own bonus. dice is injected by tests.
  function rollInit(r, characters, dice = die) {
    const d = dice(10), base = baseOf(r, characters) + (Number(r.bonus) || 0);
    r.initiative = d + base; r.ties = [];
    return { die: d, bonus: base, total: r.initiative };
  }
  // One roll for the whole group; every member gets the same number and they stay together in the order.
  function alignGroups(c) {
    for (const g of groupsOf(c).values()) {
      const members = [...g.members].sort((x, y) => (Number(x.order) || 0) - (Number(y.order) || 0)), lead = members[0]; if (!lead) continue;
      const base = Number(lead.order) || Date.now();
      members.forEach((r, i) => { r.initiative = lead.initiative; r.ties = Array.isArray(lead.ties) ? [...lead.ties] : []; r.order = base + i / 1000; });
    }
  }
  function rollGroup(c, grp, characters, dice = die) {
    const g = groupsOf(c).get(grp); if (!g) return null;
    const prev = ordered(c)[int(c.turnIndex, 0, 1e6, 0)]?.id, res = rollInit(g.members[0], characters, dice);
    g.members.forEach(r => { r.initiative = res.total; r.ties = []; delete r.held; });
    alignGroups(c); keepTurn(c, prev);
    return { ...res, count: g.members.length };
  }
  function rollAll(c, characters, dice = die) {
    const seen = new Set(), results = [];
    for (const r of c.roster) {
      delete r.held;
      if (r.grp && r.kind === 'npc') { if (seen.has(r.grp)) continue; seen.add(r.grp); }
      const res = rollInit(r, characters, dice); results.push({ id: r.id, ...res });
      if (r.grp && r.kind === 'npc') c.roster.forEach(m => { if (m !== r && m.grp === r.grp) { m.initiative = res.total; m.ties = []; } });
    }
    if (global.Campaigns?.rollTies) global.Campaigns.rollTies(c.roster, characters);
    alignGroups(c);
    c.round = 1; c.turnIndex = firstTurn(c);
    return results;
  }

  // ---------- damage ----------
  // A hit on an opponent: the SP of the place stops it (half for melee), one point of armor wears off, the head takes double.
  // Uses the table's own rule when the GM table is loaded, the same arithmetic otherwise.
  function hitRow(r, raw, opts = {}) {
    const loc = opts.loc === 'head' ? 'head' : 'body', crit = opts.crit === true;
    if (!isObj(r) || r.kind !== 'npc' || !Number.isSafeInteger(raw) || raw < 1 || raw > 999) return { ok: false, reason: 'invalid' };
    if (global.GMTable?.hitNpc) { const res = global.GMTable.hitNpc(r, { raw, location: loc, type: 'standard', critical: crit, lang: L(opts.lang), rng: global.Rolls?.rand }); if (res?.ok) return res; }
    const from = Number(r.hp) || 0, sp = spOf(r, loc), through = Math.max(0, raw - sp), dealt = (loc === 'head' ? through * 2 : through) + (crit ? 5 : 0);
    if (!dealt) return { ok: true, stopped: true, raw, sp, through: 0, dealt: 0, from, hp: from };
    if (r.maxHp === undefined && from > 0) r.maxHp = from;
    if (through > 0 && sp > 0) r.sp = { head: spOf(r, 'head'), body: spOf(r, 'body'), [loc]: sp - 1 };
    r.hp = Math.max(0, from - dealt);
    if (from < 1) r.deathPenalty = Math.min(99, (Number(r.deathPenalty) || 0) + 1);
    return { ok: true, stopped: false, raw, sp, through, dealt, from, hp: r.hp, nowMortal: from >= 1 && r.hp < 1 };
  }
  // The same hit on every member of a group who is still standing.
  function groupHit(c, grp, raw, opts = {}) {
    const g = groupsOf(c).get(grp); if (!g) return { ok: false, reason: 'invalid' };
    const targets = standing(g); if (!targets.length) return { ok: false, reason: 'none' };
    let hit = 0, fell = 0;
    for (const r of targets) { const res = hitRow(r, raw, opts); if (!res.ok) return { ok: false, reason: 'invalid' }; if (!res.stopped) hit++; if (res.nowMortal) fell++; }
    return { ok: true, targets: targets.length, hit, fell };
  }
  /* A hit on a player character by the sheet's own damage rules (GMTable.hitPc: armor wear, melee, Death Save penalty, forced
     critical). Changes the character. Without the table the pad's arithmetic is used and only quoted (no change is made). */
  function pcHit(pc, raw, opts = {}) {
    if (global.GMTable?.hitPc && isObj(pc)) {
      const res = global.GMTable.hitPc(pc, { raw, location: opts.loc === 'head' ? 'head' : 'body', type: opts.type || 'standard', critical: opts.crit === true });
      if (res?.ok) return { ...res, rule: true, to: res.hp };
    }
    const pad = global.HpPad; if (!pad?.simpleHit || !isObj(pc)) return { ok: false, reason: 'invalid' };
    const sp = pad.forCharacter(pc).sp?.() || { body: 0, head: 0 }, loc = opts.loc === 'head' ? 'head' : 'body';
    const res = pad.simpleHit({ hp: pc.hp, amount: raw, zone: loc, sp: sp[loc], crit: opts.crit, headMultiplier: 2 });
    if (!res.ok) return { ok: false, reason: 'invalid' };
    const dealt = res.damage + (opts.crit ? 5 : 0);
    return { ok: true, raw: res.raw, sp: res.armor, dealt, from: res.hpBefore, to: res.hpBefore - dealt };
  }

  // ---------- removing and bringing back ----------
  function removeRows(c, ids) {
    const want = new Set(ids), cur = ordered(c)[int(c.turnIndex, 0, 1e6, 0)]?.id, old = int(c.turnIndex, 0, 1e6, 0);
    const taken = []; c.roster.forEach((r, index) => { if (want.has(r.id)) taken.push({ row: r, index }); });
    if (!taken.length) return [];
    c.roster = c.roster.filter(r => !want.has(r.id));
    if (Array.isArray(c.groups)) { const used = new Set(c.roster.map(r => r.grp)); c.groups = c.groups.filter(g => used.has(g.id)); if (!c.groups.length) delete c.groups; }
    const next = ordered(c), same = cur ? next.findIndex(x => x.id === cur) : -1;
    c.turnIndex = same >= 0 ? same : Math.min(old, Math.max(0, next.length - 1));
    return taken;
  }
  function restoreRows(c, taken, groups) {
    const have = new Set(c.roster.map(r => r.id)), back = taken.filter(t => isObj(t?.row) && !have.has(t.row.id));
    if (!back.length || c.roster.length + back.length > MAX_ROSTER) return 0;
    const cur = ordered(c)[int(c.turnIndex, 0, 1e6, 0)]?.id, list = [...c.roster];
    for (const t of back) list.splice(Math.min(Math.max(0, int(t.index, 0, 1e6, list.length)), list.length), 0, t.row);
    c.roster = list;
    for (const g of Array.isArray(groups) ? groups : []) if (!(c.groups || []).some(x => x.id === g.id) && c.roster.some(r => r.grp === g.id)) c.groups = [...(c.groups || []), g];
    keepTurn(c, cur);
    return back.length;
  }

  // ---------- critical injury ----------
  // 2d6 on the table of the place; the row is the single table of crit-injuries.js. dice is injected by tests.
  function critRoll(loc, lang, dice = die) {
    const a = dice(6), b = dice(6), total = a + b, location = loc === 'head' ? 'head' : 'body';
    const row = global.CritInjuries?.row?.(location, total) || global.CombatTools?.INJURIES?.[location]?.[total - 2] || null;
    if (!row) return null;
    return { dice: [a, b], total, location, name: row[L(lang)], effect: row.effect?.[L(lang)] || '', quick: row.quick, treatment: row.treatment };
  }

  // ---------- the model of one row ----------
  function modelOf(r, characters, lang, c, live) {
    const pc = r.kind === 'pc' ? characters.find(x => x.id === r.characterId) || null : null;
    const hp = live ? num(live.hp) : pc ? num(pc.hp) : num(r.hp);
    const max = pc ? hpMaxOf(pc) : live && num(live.max) > 0 ? num(live.max) : Number.isSafeInteger(r.maxHp) && r.maxHp > 0 ? r.maxHp : (hp > 0 ? hp : 0);
    const dead = r.dead === true || pc?.extra?.deathRecord?.dead === true;
    const w = dead ? 'dead' : woundOf(hp, max);
    const sp = pc ? (global.HpPad?.forCharacter?.(pc).sp?.() || { body: num(pc.bodyArmor), head: num(pc.head) }) : { body: spOf(r, 'body'), head: spOf(r, 'head') };
    const chips = [];
    if (dead) chips.push(['dead', 'dead']); else if (w === 'mortal' || w === 'serious') chips.push([w, w]);
    if (r.out === true && !dead) chips.push(['out', 'out']);
    if (r.held === true) chips.push(['held', 'held']);
    let ally = ''; try { ally = global.TrackerAllies?.label?.(r, characters, 'en') ? 'ally' : ''; } catch { ally = ''; }
    if (ally) chips.push(['ally', 'ally']);
    return {
      id: r.id, kind: r.kind, pc, row: r, live: !!live, name: pc ? (pc.name || 'Edgerunner') : r.kind === 'pc' ? tx(lang, 'notLinked') : r.name || '?',
      init: Number(r.initiative) || 0, hp, max, pct: max > 0 ? Math.max(0, Math.min(100, Math.round(hp / max * 100))) : 0, wound: w, dead, out: r.out === true, sp, chips, grp: r.grp || '',
    };
  }

  // ---------- tools: search, pre-fill ----------
  function filterTools(q, lang) {
    const needle = String(q || '').trim().toLowerCase(); if (!needle) return TOOLS.map(x => x.id);
    return TOOLS.filter(x => `${x.ru} ${x.en} ${x.kw}`.toLowerCase().includes(needle)).map(x => x.id);
  }
  /* What a tool is given from the selected actor: [css selector, value]. The defender's armor and HP go to the damage and area
     tools; a character's REF/DEX go to the attack fields. Nothing is made up: an opponent without an entered number gives nothing. */
  function prefillFor(m) {
    if (!m) return [];
    const out = [], body = num(m.sp?.body), head = num(m.sp?.head);
    for (const s of ['[data-ct-sp]', '[data-ct-roll-sp]', '[data-ct-aim-sp]', '[data-af-sp]', '[data-area-sp]', '[data-gr-sp]', '[data-gr-object-sp]']) out.push([s, String(body)]);
    if (m.max > 0) for (const s of ['[data-ct-cover-hp]', '[data-gr-hp]']) out.push([s, String(Math.max(0, m.hp))]);
    const st = m.pc?.stats;
    if (st) {
      if (Number.isFinite(Number(st.REF))) for (const s of ['[data-ct-check-stat]', '[data-af-ref]', '[data-area-ref]', '[data-ct-check-ref]', '[data-af-target-ref]']) out.push([s, String(num(st.REF))]);
      if (Number.isFinite(Number(st.DEX))) for (const s of ['[data-ct-check-dex]', '[data-af-dex]', '[data-gr-grab-a-dex]', '[data-gr-melee-a-dex]']) out.push([s, String(num(st.DEX))]);
    } else if (m.kind === 'npc' && Number.isSafeInteger(m.row?.ref)) {
      for (const s of ['[data-ct-check-ref]', '[data-af-target-ref]', '[data-area-ref]']) out.push([s, String(m.row.ref)]);
    }
    return out;
  }

  // ---------- the quick combat ----------
  function newQuick(lang) { return { id: 'quick', name: tx(lang, 'quickName'), notes: '', round: 1, turnIndex: 0, roster: [], quick: true }; }
  // What a reload may bring back: a plain object with a bounded roster; anything else starts empty.
  function readQuick(raw, lang) {
    let v = raw; if (typeof raw === 'string') { try { v = JSON.parse(raw); } catch { return newQuick(lang); } }
    if (!isObj(v) || !Array.isArray(v.roster)) return newQuick(lang);
    const roster = []; const ids = new Set();
    for (const r of v.roster.slice(0, MAX_ROSTER)) {
      if (!isObj(r) || r.kind !== 'npc' || typeof r.id !== 'string' || !r.id || r.id.length > 160 || ids.has(r.id)) continue; ids.add(r.id);
      const x = { id: r.id, kind: 'npc', name: String(r.name ?? '').slice(0, 100) || '?', ref: int(r.ref, 0, 20, 0), hp: int(r.hp, 0, 999, 0), initiative: int(r.initiative, -999, 999, 0), order: Number.isFinite(Number(r.order)) ? Number(r.order) : 0 };
      if (Number.isSafeInteger(r.maxHp) && r.maxHp > 0 && r.maxHp <= 999) x.maxHp = r.maxHp;
      if (isObj(r.sp)) x.sp = { head: int(r.sp.head, 0, 30, 0), body: int(r.sp.body, 0, 30, 0) };
      if (typeof r.grp === 'string' && r.grp && r.grp.length <= 60) x.grp = r.grp;
      if (Array.isArray(r.ties)) x.ties = r.ties.slice(0, 10).map(t => int(t, -999, 999, 0));
      if (r.out === true) x.out = true; if (r.held === true) x.held = true; if (r.dead === true) x.dead = true;
      if (Number.isSafeInteger(r.bonus) && Math.abs(r.bonus) <= 99) x.bonus = r.bonus;
      if (Number.isSafeInteger(r.deathPenalty) && r.deathPenalty >= 0 && r.deathPenalty <= 99) x.deathPenalty = r.deathPenalty;
      if (isObj(r.combatNote) && r.combatNote.version === 1 && typeof r.combatNote.text === 'string') x.combatNote = { version: 1, text: r.combatNote.text.slice(0, 300) };
      roster.push(x);
    }
    const groups = (Array.isArray(v.groups) ? v.groups : []).filter(g => isObj(g) && typeof g.id === 'string' && roster.some(r => r.grp === g.id)).slice(0, MAX_GROUPS)
      .map(g => ({ id: g.id, name: String(g.name ?? '').slice(0, 100), ref: int(g.ref, 0, 20, 0), sp: isObj(g.sp) ? { head: int(g.sp.head, 0, 30, 0), body: int(g.sp.body, 0, 30, 0) } : null, note: String(g.note ?? '').slice(0, 300) }));
    const q = { id: 'quick', name: String(v.name ?? '').slice(0, 100) || tx(lang, 'quickName'), notes: '', round: int(v.round, 1, 99999, 1), turnIndex: int(v.turnIndex, 0, Math.max(0, roster.length - 1), 0), roster, quick: true };
    if (groups.length) q.groups = groups;
    return q;
  }

  // ---------- markup ----------
  const chipLabel = (l, k) => (k === 'ally' ? tx(l, 'ally') : tx(l, k === 'full' ? 'full_' : k));
  const chipsHTML = (l, chips) => (chips.length ? `<span class="cd-chips">${chips.map(([cls, k]) => `<span class="cd-chip cd-chip-${cls}">${esc(chipLabel(l, k))}</span>`).join('')}</span>` : '');
  const hpBar = (l, m) => `<span class="cd-hp" role="img" aria-label="${esc(tx(l, 'hpOf', m.hp, m.max || ''))}"><span class="cd-bar-track"><i style="width:${m.pct}%"></i></span><span class="cd-hp-n">${m.hp}${m.max ? '<small>/' + m.max + '</small>' : ''}</span></span>`;
  const btn = (act, label, extra = '', cls = 'btn ghost') => `<button type="button" class="${cls}" data-cd-action="${act}" ${extra}>${esc(label)}</button>`;

  function rowHTML(m, l, ui, current) {
    const sel = ui.sel === m.id;
    return `<li class="cd-row" data-cd-row="${esc(m.id)}" data-wound="${m.wound}"${current ? ' data-current="true"' : ''}${m.out ? ' data-out="true"' : ''}>`
      + `<button type="button" class="cd-main" data-cd-action="select" data-id="${esc(m.id)}" aria-expanded="${sel}" aria-controls="cd-act-${esc(m.id)}">`
      + `<span class="cd-ord" aria-hidden="true">${current ? '▶' : ''}</span><span class="cd-name"><b>${esc(m.name)}</b><small>${esc(m.kind === 'pc' ? tx(l, 'pcs') : tx(l, 'npcs'))}</small></span>`
      + `<span class="cd-init" aria-label="${esc(tx(l, 'init'))} ${m.init}">${m.init}</span>${hpBar(l, m)}${chipsHTML(l, m.chips)}</button>${sel ? panelHTML(m, l, ui) : ''}</li>`;
  }
  function groupHTML(g, models, l, ui, currentId) {
    const alive = standing(g).length, total = g.members.length, anySel = g.members.some(r => r.id === ui.sel), open = ui.sel === 'g:' + g.id || anySel, init = Number(g.members[0]?.initiative) || 0;
    const current = g.members.some(r => r.id === currentId), pct = Math.round(g.members.reduce((a, r) => a + (models.get(r.id)?.pct || 0), 0) / Math.max(1, total));
    const pips = g.members.map(r => { const m = models.get(r.id); return `<button type="button" class="cd-pip" data-cd-action="select" data-id="${esc(r.id)}" data-wound="${m.wound}" aria-pressed="${ui.sel === r.id}" aria-label="${esc(tx(l, 'pip', m.name, m.hp, m.max || m.hp))}" style="--p:${m.pct}"><span>${m.hp}</span></button>`; }).join('');
    return `<li class="cd-row cd-group" data-cd-group="${esc(g.id)}" data-wound="${alive ? 'full' : 'dead'}"${current ? ' data-current="true"' : ''}>`
      + `<button type="button" class="cd-main" data-cd-action="select-group" data-grp="${esc(g.id)}" aria-expanded="${open}" aria-controls="cd-gact-${esc(g.id)}"><span class="cd-ord" aria-hidden="true">${current ? '▶' : ''}</span>`
      + `<span class="cd-name"><b>${esc(g.name)} ×${alive}</b><small>${esc(tx(l, 'group'))} · ${esc(tx(l, 'alive', alive, total))}</small></span><span class="cd-init" aria-label="${esc(tx(l, 'init'))} ${init}">${init}</span>`
      + `<span class="cd-hp" role="img" aria-label="${esc(tx(l, 'alive', alive, total))}"><span class="cd-bar-track"><i style="width:${pct}%"></i></span><span class="cd-hp-n">${alive}<small>/${total}</small></span></span></button>`
      + `<div class="cd-pips" role="group" aria-label="${esc(tx(l, 'members'))}">${pips}</div>${open ? groupPanelHTML(g, models, l, ui) : ''}</li>`;
  }
  function hitFields(l, m) {
    const sp = m.sp || {};
    return `<div class="cd-hit" data-cd-hit><p class="cd-help">${esc(tx(l, 'hitHelp'))} ${esc(tx(l, 'sp'))}: ${esc(tx(l, 'body'))} ${num(sp.body)}, ${esc(tx(l, 'head'))} ${num(sp.head)}</p>`
      + `<label>${esc(tx(l, 'raw'))}<input type="number" inputmode="numeric" min="1" max="999" data-cd-raw placeholder="0"></label>`
      + `<label>${esc(tx(l, 'place'))}<select data-cd-loc><option value="body">${esc(tx(l, 'body'))}</option><option value="head">${esc(tx(l, 'head'))}</option></select></label>`
      + `<label class="cd-check"><input type="checkbox" data-cd-crit>${esc(tx(l, 'crit'))}</label></div>`;
  }
  function extrasHTML(m, l) {
    if (!m.pc) return '';
    let out = '';
    try { out += global.MartialArts?.renderKnown?.(m.pc, l) || ''; } catch { /* a block that fails is left out */ }
    try { out += global.Cyberweapons?.render?.(m.pc, l) || ''; } catch { /* same */ }
    try { out += global.Garage?.combatRows?.(m.pc, l) || ''; } catch { /* same */ }
    try {
      const decks = global.NetrunDeck?.decksOf?.(m.pc);
      const lines = Array.isArray(decks) ? decks.map(d => ({ name: String(d?.name || tx(l, 'deck')), list: (Array.isArray(d?.entries) ? d.entries : []).map(e => String(e?.name?.[L(l)] || e?.name?.en || '')).filter(Boolean) })).filter(d => d.list.length) : [];
      if (lines.length) out += `<section class="cd-programs" aria-label="${esc(tx(l, 'programs'))}"><h3>${esc(tx(l, 'programs'))}</h3>${lines.map(d => `<p><b>${esc(d.name)}</b>: ${esc(d.list.join(', '))}</p>`).join('')}</section>`;
    } catch { /* same */ }
    return out;
  }
  function panelHTML(m, l, ui) {
    const r = m.row, npc = m.kind === 'npc', mortalNpc = npc && !m.dead && m.hp < 1;
    const res = ui.result?.id === m.id ? `<p class="cd-result" role="status">${esc(ui.result.text)}</p>` : '';
    return `<div class="cd-actions" id="cd-act-${esc(m.id)}" data-cd-panel="${esc(m.id)}" role="group" aria-label="${esc(tx(l, 'actions'))}: ${esc(m.name)}">`
      + `<div class="cd-btns">${btn('hp-pad', tx(l, 'hpPad'), `data-id="${esc(m.id)}"`, 'btn primary')}${m.pc ? btn('open-sheet', tx(l, 'openSheet'), `data-id="${esc(m.id)}"`) : ''}`
      + `${btn('roll-one', tx(l, 'rollOne'), `data-id="${esc(m.id)}"`)}${btn('to-top', tx(l, 'toTop'), `data-id="${esc(m.id)}"`)}${btn('hold', r.held === true ? tx(l, 'unhold') : tx(l, 'hold'), `data-id="${esc(m.id)}"`)}`
      + `${m.dead ? '' : btn('out', r.out === true ? tx(l, 'markIn') : tx(l, 'markOut'), `data-id="${esc(m.id)}"`)}${btn('remove', tx(l, 'remove'), `data-id="${esc(m.id)}"`)}</div>`
      + hitFields(l, m)
      + `<div class="cd-btns">${btn('hit', tx(l, 'apply'), `data-id="${esc(m.id)}"`, 'btn primary')}${btn('crit-roll', `${tx(l, 'critRoll')}: ${tx(l, 'critBody')}`, `data-id="${esc(m.id)}" data-loc="body"`)}${btn('crit-roll', `${tx(l, 'critRoll')}: ${tx(l, 'critHead')}`, `data-id="${esc(m.id)}" data-loc="head"`)}</div>`
      + (mortalNpc ? `<div class="cd-death"><label>${esc(tx(l, 'deathBody'))}<input type="number" inputmode="numeric" min="1" max="20" data-cd-body value="${esc(r.body ?? '')}"></label>${btn('death-save', tx(l, 'death'), `data-id="${esc(m.id)}"`)}</div>` : '')
      + `<label class="cd-init-edit">${esc(tx(l, 'editInit'))}<input type="number" inputmode="numeric" min="-99" max="999" data-cd-init="${esc(m.id)}" value="${m.init}"></label>`
      + (r.combatNote?.text ? `<p class="cd-note"><b>${esc(tx(l, 'noteLabel'))}:</b> ${esc(r.combatNote.text)}</p>` : '')
      + res + extrasHTML(m, l)
      + `<div class="cd-btns">${btn('tools-for', tx(l, 'toolsFor', m.name), `data-id="${esc(m.id)}"`)}</div></div>`;
  }
  function groupPanelHTML(g, models, l, ui) {
    const g0 = g.members[0] || {}, sp = g.sp || {}, sel = g.members.find(r => r.id === ui.sel), res = ui.result?.id === 'g:' + g.id ? `<p class="cd-result" role="status">${esc(ui.result.text)}</p>` : '';
    const field = (k, label, v, max) => `<label>${esc(label)}<input type="number" inputmode="numeric" min="0" max="${max}" data-cd-g="${k}" data-grp="${esc(g.id)}" value="${esc(v)}"></label>`;
    return `<div class="cd-actions cd-gpanel" id="cd-gact-${esc(g.id)}" data-cd-panel="g:${esc(g.id)}" role="group" aria-label="${esc(tx(l, 'group'))}: ${esc(g.name)}">`
      + `<div class="cd-btns">${btn('roll-group', tx(l, 'rollOne'), `data-grp="${esc(g.id)}"`, 'btn primary')}${btn('remove-fallen', tx(l, 'removeFallen'), `data-grp="${esc(g.id)}"`)}${btn('ungroup', tx(l, 'ungroup'), `data-grp="${esc(g.id)}"`)}</div>`
      + `<div class="cd-hit" data-cd-ghit><p class="cd-help">${esc(tx(l, 'groupHit'))}</p><label>${esc(tx(l, 'raw'))}<input type="number" inputmode="numeric" min="1" max="999" data-cd-raw placeholder="0"></label>`
      + `<label>${esc(tx(l, 'place'))}<select data-cd-loc><option value="body">${esc(tx(l, 'body'))}</option><option value="head">${esc(tx(l, 'head'))}</option></select></label><label class="cd-check"><input type="checkbox" data-cd-crit>${esc(tx(l, 'crit'))}</label>${btn('group-hit', tx(l, 'groupHitDo'), `data-grp="${esc(g.id)}"`, 'btn primary')}</div>`
      + `<fieldset class="cd-stat"><legend>${esc(tx(l, 'stat'))}</legend>${field('ref', tx(l, 'fRef'), g.ref ?? g0.ref ?? 0, 20)}${field('spHead', tx(l, 'fSpHead'), num(sp.head), 30)}${field('spBody', tx(l, 'fSpBody'), num(sp.body), 30)}`
      + `<label class="cd-wide">${esc(tx(l, 'fNote'))}<input type="text" maxlength="300" data-cd-g="note" data-grp="${esc(g.id)}" value="${esc(g.note || '')}"></label></fieldset>${res}`
      + (sel ? panelHTML(models.get(sel.id), l, ui) : '') + `</div>`;
  }
  function addHTML(ctx, l, ui, c) {
    const pcs = (ctx.characters || []).filter(p => !c.roster.some(r => r.kind === 'pc' && r.characterId === p.id));
    const tpl = global.GMTools?.NPC_TEMPLATES, tpls = Array.isArray(tpl) ? tpl.filter(x => isObj(x) && typeof x.id === 'string' && isObj(x.name)) : [];
    const f = (k, label, v, extra = '') => `<label>${esc(label)}<input data-cd-new="${k}" ${extra} value="${esc(v)}"></label>`;
    return `<details class="cd-add"${ui.add ? ' open' : ''} data-cd-add><summary>${esc(tx(l, 'add'))}</summary><div class="cd-add-body">`
      + (c.quick ? '' : `<div class="cd-add-pc"><label>${esc(tx(l, 'addPc'))}<select data-cd-pc>${pcs.length ? pcs.map(p => `<option value="${esc(p.id)}">${esc(p.name || 'Edgerunner')}</option>`).join('') : `<option value="">${esc(tx(l, 'noPc'))}</option>`}</select></label>${btn('add-pc', tx(l, 'addPcDo'), pcs.length ? '' : 'disabled')}</div>`)
      + `<fieldset class="cd-add-npc"><legend>${esc(tx(l, 'addNpc'))}</legend><p class="cd-help">${esc(tx(l, 'groupHelp'))}</p>`
      + `${f('name', tx(l, 'fName'), '', 'maxlength="90" autocomplete="off"')}<div class="cd-add-nums">${f('count', tx(l, 'fCount'), '1', 'type="number" inputmode="numeric" min="1" max="20"')}${f('ref', tx(l, 'fRef'), '6', 'type="number" inputmode="numeric" min="0" max="20"')}${f('hp', tx(l, 'fHp'), '20', 'type="number" inputmode="numeric" min="1" max="999"')}${f('spHead', tx(l, 'fSpHead'), '0', 'type="number" inputmode="numeric" min="0" max="30"')}${f('spBody', tx(l, 'fSpBody'), '0', 'type="number" inputmode="numeric" min="0" max="30"')}</div>`
      + `${f('note', tx(l, 'fNote'), '', 'maxlength="300"')}${btn('add-npc', tx(l, 'addNpcDo'), '', 'btn primary')}</fieldset>`
      + (tpls.length ? `<div class="cd-add-tpl"><label>${esc(tx(l, 'template'))}<select data-cd-tpl>${tpls.map(x => `<option value="${esc(x.id)}">${esc(x.name[L(l)] || x.name.en || x.id)}</option>`).join('')}</select></label><label>${esc(tx(l, 'fCount'))}<input type="number" inputmode="numeric" min="1" max="10" value="1" data-cd-tpl-count></label>${btn('add-template', tx(l, 'templateDo'))}</div>` : '')
      + `</div></details>`;
  }
  function toolHTML(id, l) {
    const nav = global.CombatNavigation, wrap = (x, content) => nav?.wrap(x, content) || content || '';
    const call = (mod, ...a) => { try { return global[mod]?.render?.(...a) || ''; } catch { return ''; } };
    const map = { overview: () => call('CombatTools', l), autofire: () => call('AutofireTools', l), area: () => call('AreaTools', l), grapple: () => call('GrappleTools', l), hazards: () => call('HazardTools', l), vehicles: () => call('VehicleTools', l), martial: () => call('MartialArts', l), weapons: () => call('WeaponReference', l) };
    return map[id] ? wrap(id, map[id]()) : '';
  }
  function toolsHTML(l, ui, actor) {
    const shown = new Set(filterTools(ui.q, l));
    const buttons = TOOLS.map(x => `<button type="button" class="cd-tool" data-cd-action="tool" data-tool="${x.id}" data-cd-kw="${esc((x.ru + ' ' + x.en + ' ' + x.kw).toLowerCase())}" aria-pressed="${ui.tool === x.id}"${shown.has(x.id) ? '' : ' hidden'}>${esc(x[L(l)])}</button>`).join('');
    return `<section class="cd-tools" data-cd-tools aria-labelledby="cd-tools-h"><div class="cd-tools-head"><h2 id="cd-tools-h">${esc(tx(l, 'tools'))}${actor ? ` · <small>${esc(actor.name)}</small>` : ''}</h2>`
      + `<button type="button" class="btn ghost" data-cd-action="tools-toggle" aria-expanded="${ui.tools}" aria-controls="cd-tools-body">${esc(ui.tools ? tx(l, 'toolsClose') : tx(l, 'toolsOpen'))}</button></div>`
      + (ui.tools ? `<div id="cd-tools-body"><p class="cd-help">${esc(tx(l, 'toolsHelp'))}</p><label class="cd-find">${esc(tx(l, 'toolsFind'))}<input type="search" data-cd-tools-search value="${esc(ui.q || '')}" autocomplete="off"></label>`
        + `<div class="cd-tool-list" role="group" aria-label="${esc(tx(l, 'tools'))}">${buttons}</div><p class="cd-help" data-cd-tools-none${shown.size ? ' hidden' : ''}>${esc(tx(l, 'toolsNone'))}</p>${ui.tool ? `<div class="cd-tool-body" data-cd-tool-body="${ui.tool}">${toolHTML(ui.tool, l)}</div>` : ''}</div>` : '')
      + `</section>`;
  }
  function bannerHTML(c, roster, l, models) {
    const tn = turnCount(c), cur = roster[int(c.turnIndex, 0, Math.max(0, roster.length - 1), 0)], m = cur && models.get(cur.id), groups = groupsOf(c), g = cur?.grp ? groups.get(cur.grp) : null;
    const name = g ? `${g.name} ×${standing(g).length}` : m?.name || '';
    return `<div class="cd-banner" data-cd-banner role="region" aria-label="${esc(tx(l, 'bannerLabel'))}"><div class="cd-round"><small>${esc(tx(l, 'round'))}</small><b>${Math.max(1, int(c.round, 1, 99999, 1))}</b></div>`
      + `<div class="cd-now" aria-live="polite" aria-atomic="true"><small>${esc(roster.length ? `${tx(l, 'now')} · ${tx(l, 'turn')} ${tn.pos}/${tn.total}` : tx(l, 'nobody'))}</small><strong>${esc(name)}</strong>${m && !g ? chipsHTML(l, m.chips) : ''}</div>`
      + `<button type="button" class="cd-next" data-cd-action="next"${roster.length ? '' : ' disabled'}>${esc(tx(l, 'next'))} ▶</button></div>`;
  }
  function barHTML(ctx, l, c, ui, roster) {
    const opts = (ctx.campaigns || []).map(k => `<option value="${esc(k.id)}"${!c.quick && k.id === c.id ? ' selected' : ''}>${esc(k.name || '?')}</option>`).join('') + `<option value="quick"${c.quick ? ' selected' : ''}>${esc(tx(l, 'quickShort'))}</option>`;
    return `<div class="cd-bar"><label class="cd-camp">${esc(tx(l, 'campaign'))}<select data-cd-campaign>${opts}</select></label>`
      + `<div class="cd-bar-btns">${btn('roll-all', tx(l, 'rollAll'), roster.length ? '' : 'disabled')}`
      + `<details class="cd-menu"><summary>${esc(tx(l, 'menu'))}</summary><div class="cd-menu-body">${btn('prev', tx(l, 'prev'), roster.length ? '' : 'disabled')}${btn('reset', tx(l, 'reset'), roster.length ? '' : 'disabled')}`
      + `${btn('clear-npcs', tx(l, 'clearNpcs'), roster.some(r => r.kind === 'npc') ? '' : 'disabled')}${c.quick ? btn('quick-save', tx(l, 'quickSave'), roster.length ? '' : 'disabled') + btn('quick-end', tx(l, 'quickEnd')) : btn('open-campaign', tx(l, 'openCampaign'))}</div></details></div></div>`;
  }
  /* The whole page. ctx: {lang, campaigns, characters, state?}. ui is the module's own state (selected row, drawer). */
  function page(ctx) {
    const l = L(ctx.lang), c = target(ctx);
    if (!c) return emptyHTML(ctx);
    try { global.TrackerAllies?.sync?.(c, ctx.characters || []); } catch { /* the tracker page does the same, and carries on */ }
    const roster = ordered(c), curId = roster[int(c.turnIndex, 0, Math.max(0, roster.length - 1), 0)]?.id;
    const models = new Map(roster.map(r => { let live = null; try { live = r.kind === 'npc' && r.own ? global.Room?.liveRow?.(r, null) || null : r.kind === 'pc' ? global.Room?.liveRow?.(r, (ctx.characters || []).find(x => x.id === r.characterId) || null) || null : null; } catch { live = null; } return [r.id, modelOf(r, ctx.characters || [], l, c, live)]; }));
    const groups = groupsOf(c), drawn = new Set();
    const items = roster.map(r => {
      if (r.grp && groups.has(r.grp)) { if (drawn.has(r.grp)) return ''; drawn.add(r.grp); return groupHTML(groups.get(r.grp), models, l, ui, curId); }
      return rowHTML(models.get(r.id), l, ui, r.id === curId);
    }).join('');
    const actor = ui.sel && !String(ui.sel).startsWith('g:') ? models.get(ui.sel) : null;
    return `<div class="cd" data-combat-dock data-cd-mode="${c.quick ? 'quick' : 'live'}"><div class="page-header cd-head"><div><div class="overline">06 / COMBAT</div><h1 tabindex="-1">${esc(tx(l, 'title'))} · ${esc(c.quick ? tx(l, 'quick') : c.name || '?')}</h1>${c.quick ? `<p>${esc(tx(l, 'quickHelp'))}</p>` : ''}</div></div>`
      + bannerHTML(c, roster, l, models) + barHTML(ctx, l, c, ui, roster)
      + `<ul class="cd-list" data-cd-list aria-label="${esc(tx(l, 'turn'))}">${items || `<li class="cd-empty">${esc(tx(l, 'nobody'))}. ${esc(tx(l, 'hint'))}</li>`}</ul>`
      + addHTML(ctx, l, ui, c) + toolsHTML(l, ui, actor) + `</div>`;
  }
  // When there is no campaign at all, the page offers the quick combat.
  function emptyHTML(ctx) {
    const l = L(ctx.lang);
    return `<div class="cd" data-combat-dock data-cd-mode="empty"><div class="page-header cd-head"><div><div class="overline">06 / COMBAT</div><h1 tabindex="-1">${esc(tx(l, 'title'))}</h1><p>${esc(tx(l, 'noCampaign'))}</p></div></div>${btn('quick-new', tx(l, 'quickStart'), '', 'btn primary cd-start')}</div>`;
  }

  // ---------- the state of the page ----------
  const ui = { camp: null, sel: null, tools: false, tool: '', q: '', add: false, result: null, focus: null, quick: null, filled: '' };
  function quickStore() { try { return global.sessionStorage || null; } catch { return null; } }
  function saveQuick() { try { if (ui.quick) quickStore()?.setItem(QUICK_KEY, JSON.stringify(ui.quick)); else quickStore()?.removeItem(QUICK_KEY); } catch { /* storage may be blocked */ } }
  function quickOf(lang) { if (!ui.quick) { let raw = null; try { raw = quickStore()?.getItem(QUICK_KEY) || null; } catch { raw = null; } ui.quick = raw ? readQuick(raw, lang) : null; } return ui.quick; }
  // The fight on screen: the chosen one, else the campaign open on the campaigns page, else the first with people in it, else a quick combat.
  function target(ctx) {
    const l = L(ctx.lang), list = Array.isArray(ctx.campaigns) ? ctx.campaigns : [];
    if (ui.camp === 'quick') return quickOf(l) || (ui.quick = newQuick(l));
    const chosen = list.find(x => x.id === ui.camp);
    if (chosen) return chosen;
    const q = quickOf(l); if (q && ui.camp === null && !list.length) return q;
    const picked = pickCampaign(list, global.Campaigns?.selectedId?.(), null);
    return picked || q || null;
  }
  const persist = (ctx, c) => { if (c.quick) saveQuick(); else ctx.save?.(); };
  const live = (ctx, c) => (c.quick ? ui.quick === c : ctx.isCurrent?.(c) !== false);
  const rowOf = (c, id) => c.roster.find(r => r.id === id) || null;
  const tell = (ctx, m) => { try { ctx.notify?.(m); } catch { /* no notice available */ } };

  // ---------- the handlers ----------
  // Buttons of the closed «More» menu are not on screen after a redraw: focus goes to «Next turn» instead.
  const MENU_ACTS = new Set(['prev', 'reset', 'clear-npcs', 'quick-save', 'quick-end']);
  function setFocus(act, id) { ui.focus = MENU_ACTS.has(act) ? { act: 'next', id: null } : { act, id }; }
  function readNew(root) {
    const get = k => root.querySelector(`[data-cd-new="${k}"]`)?.value ?? '';
    return { name: get('name'), count: get('count'), ref: get('ref'), hp: get('hp'), spHead: get('spHead'), spBody: get('spBody'), note: get('note') };
  }
  function openPad(btnEl, c, r, ctx) {
    const pad = global.HpPad; if (!pad?.open) return;
    const l = L(ctx.lang), m = modelOf(r, ctx.characters || [], l, c, null), pc = m.pc;
    const stale = () => { tell(ctx, tx(l, 'stale')); return false; };
    if (pc) {
      const base = pad.forCharacter(pc);
      pad.open({ ...base, dock: false, kind: 'tracker', name: m.name, hitForm: undefined, setHp: (next, meta) => {
        if (!live(ctx, c) || !(ctx.characters || []).includes(pc)) return stale();
        const res = global.Campaigns?.applyCharacterHP?.(pc, String(next), meta?.reason === 'correction' ? 'correction' : 'damage');
        if (!res || !res.ok) { tell(ctx, tx(l, 'stale')); return false; }
        if (res.changed) persist(ctx, c);
        ctx.render?.(); return { ok: true };
      } }, { opener: btnEl, lang: l });
      return;
    }
    if (r.kind !== 'npc') return;
    pad.open({ kind: 'tracker', id: r.id, name: m.name, hp: () => num(r.hp), max: () => m.max || num(r.hp), sp: () => ({ body: spOf(r, 'body'), head: spOf(r, 'head') }), setHp: next => {
      if (!live(ctx, c) || !c.roster.includes(r)) return stale();
      const from = num(r.hp), n = int(next, 0, 999, from); if (r.maxHp === undefined && from > 0) r.maxHp = from;
      r.hp = n; if (n >= 1) { delete r.dead; delete r.deathPenalty; }
      persist(ctx, c); ctx.render?.(); return { ok: true, hp: n };
    } }, { opener: btnEl, lang: l });
  }
  function handleClick(e, ctx, root) {
    const b = e.target.closest('[data-cd-action]'); if (!b || !root.contains(b)) return false;
    const l = L(ctx.lang), a = b.dataset.cdAction, c = target(ctx);
    if (a === 'quick-new') { ui.camp = 'quick'; ui.quick = ui.quick || newQuick(l); saveQuick(); setFocus('h1', null); ctx.render?.(); return true; }
    if (!c) return true;
    if (!live(ctx, c)) { tell(ctx, tx(l, 'stale')); return true; }
    const id = b.dataset.id, grp = b.dataset.grp, panel = b.closest('[data-cd-panel]'), done = (act, fid) => { setFocus(act, fid); persist(ctx, c); ctx.render?.(); return true; };
    const before = ordered(c)[int(c.turnIndex, 0, 1e6, 0)]?.id;
    switch (a) {
      case 'select': {
        ui.sel = ui.sel === id ? null : id;
        // The sheet blocks (moves, cyberweapons) work on the open sheet: the picked character is the open one while this page is shown.
        try { const st = global.App?.getState?.(), r = rowOf(c, id), pc = ui.sel && r?.kind === 'pc' ? (ctx.characters || []).find(x => x.id === r.characterId) : null; if (st && st.view === 'combat') st.active = pc ? pc.id : null; } catch { /* the blocks simply stay empty */ }
        setFocus('select', id); ctx.render?.(); return true;
      }
      case 'select-group': ui.sel = ui.sel === 'g:' + grp ? null : 'g:' + grp; setFocus('select-group', grp); ctx.render?.(); return true;
      case 'next': case 'prev': {
        const res = advance(c, a === 'prev' ? -1 : 1); if (!res.moved) return true;
        if (res.newRound && a === 'next') { try { global.Campaigns?.journalAdd?.(c, l === 'en' ? `Round ${res.round} started` : `Начался раунд ${res.round}`, true); } catch { /* the journal is optional */ } try { global.ClockTriggers?.round?.(c.id, res.from, res.round); } catch { /* same */ } }
        if (res.newRound && a === 'prev') { try { global.ClockTriggers?.round?.(c.id, res.from, res.round); } catch { /* same */ } }
        return done(a, null);
      }
      case 'roll-all': { const res = rollAll(c, ctx.characters || [], die); try { global.ClockTriggers?.restart?.(c.id); } catch { /* optional */ } if (res.length) { try { global.Campaigns?.journalAdd?.(c, l === 'en' ? `Initiative rolled for everyone (combatants: ${res.length})` : `Брошена инициатива для всех (участников: ${res.length})`, true); } catch { /* optional */ } global.Rolls?.report?.(tx(l, 'rolledAll', res.length), res.map(x => x.total).join(', '), Math.max(...res.map(x => x.total)), null, c.roster.some(x => x.kind === 'npc')); } tell(ctx, tx(l, 'rolledAll', res.length)); return done('roll-all', null); }
      case 'reset': c.round = 1; c.turnIndex = firstTurn(c); try { global.ClockTriggers?.restart?.(c.id); } catch { /* optional */ } tell(ctx, tx(l, 'resetDone')); return done('reset', null);
      case 'clear-npcs': { const ids = c.roster.filter(r => r.kind === 'npc').map(r => r.id), groups = JSON.parse(JSON.stringify(c.groups || [])), taken = removeRows(c, ids); if (!taken.length) return true; notifyUndo(ctx, c, tx(l, 'removed', taken.length), taken, groups); return done('clear-npcs', null); }
      case 'open-campaign': global.Campaigns?.select?.(c.id); global.App?.navigate?.('campaigns'); return true;
      case 'quick-save': { if (!c.quick || !Array.isArray(ctx.campaigns)) return true; const copy = JSON.parse(JSON.stringify(c)); delete copy.quick; copy.id = uid(); copy.name = l === 'en' ? 'Saved fight' : 'Сохранённый бой'; ctx.campaigns.unshift(copy); ui.quick = null; ui.camp = copy.id; saveQuick(); ctx.save?.(); tell(ctx, tx(l, 'quickSaved')); ctx.render?.(); return true; }
      case 'quick-end': ui.quick = null; ui.camp = null; ui.sel = null; saveQuick(); tell(ctx, tx(l, 'quickEnded')); setFocus('h1', null); ctx.render?.(); return true;
      case 'add-pc': { const pcId = root.querySelector('[data-cd-pc]')?.value, p = (ctx.characters || []).find(x => x.id === pcId); if (!p || c.quick || c.roster.some(r => r.kind === 'pc' && r.characterId === pcId) || c.roster.length >= MAX_ROSTER) return true; c.roster.push({ id: uid(), kind: 'pc', characterId: pcId, initiative: 0, order: Date.now() }); keepTurn(c, before); ui.add = true; return done('add-pc', null); }
      case 'add-npc': { const res = addNpcs(c, readNew(root), l); if (!res.ok) { tell(ctx, tx(l, res.reason === 'full' ? 'full' : 'badNew')); return true; } keepTurn(c, before); ui.add = true; tell(ctx, tx(l, 'added', res.rows.length)); return done('add-npc', null); }
      case 'add-template': {
        const tpl = root.querySelector('[data-cd-tpl]')?.value, n = int(root.querySelector('[data-cd-tpl-count]')?.value, 1, 10, 1);
        if (!tpl || !global.Campaigns?.addTemplates) return true;
        const res = global.Campaigns.addTemplates(c, tpl, n, l); if (!res.ok) { tell(ctx, tx(l, 'badNew')); return true; }
        if (res.added?.length > 1) groupRows(c, res.added, res.name);
        keepTurn(c, before); ui.add = true; tell(ctx, tx(l, 'added', res.added?.length || n)); return done('add-template', null);
      }
      case 'tools-toggle': ui.tools = !ui.tools; setFocus('tools-toggle', null); ctx.render?.(); return true;
      case 'tool': ui.tool = ui.tool === b.dataset.tool ? '' : b.dataset.tool; ui.tools = true; setFocus('tool', b.dataset.tool); ctx.render?.(); return true;
      case 'tools-for': ui.tools = true; ui.tool = ui.tool || 'overview'; ui.filled = ''; setFocus('tools-for', id); ctx.render?.(); return true;
      case 'open-sheet': { const r = rowOf(c, id); if (r?.kind === 'pc') global.App?.open?.(r.characterId); return true; }
      default: break;
    }
    if (['roll-group', 'remove-fallen', 'ungroup', 'group-hit'].includes(a)) return handleGroup(a, grp, c, ctx, panel, l, done);
    const r = rowOf(c, id); if (!r) { tell(ctx, tx(l, 'stale')); return true; }
    const m = modelOf(r, ctx.characters || [], l, c, null);
    switch (a) {
      case 'hp-pad': openPad(b, c, r, ctx); return true;
      case 'roll-one': { if (r.grp && groupsOf(c).has(r.grp)) return handleGroup('roll-group', r.grp, c, ctx, panel, l, done); const res = rollInit(r, ctx.characters || [], die); global.Rolls?.sum?.(`${tx(l, 'init')} · ${m.name}`, [res.die], 10, { bonus: res.bonus, total: res.total, secret: r.kind === 'npc' }); keepTurn(c, before); ui.result = { id: m.id, text: tx(l, 'rolled', res.total) }; return done('roll-one', id); }
      case 'to-top': { const top = Math.min(999, Math.max(0, ...c.roster.map(x => Number(x.initiative) || 0)) + 1); r.initiative = top; r.ties = []; if (r.grp) { c.roster.forEach(x => { if (x.grp === r.grp) { x.initiative = top; x.ties = []; } }); alignGroups(c); } keepTurn(c, before); return done('to-top', id); }
      case 'hold': if (r.held === true) delete r.held; else r.held = true; return done('hold', id);
      case 'out': if (r.dead === true) return true; if (r.out === true) delete r.out; else { r.out = true; delete r.held; } keepTurn(c, before); return done('out', id);
      case 'remove': { const groups = JSON.parse(JSON.stringify(c.groups || [])), taken = removeRows(c, [r.id]); if (ui.sel === r.id) ui.sel = null; notifyUndo(ctx, c, tx(l, 'removed', taken.length), taken, groups); return done('select', null); }
      case 'hit': {
        const raw = panel?.querySelector('[data-cd-raw]')?.value, n = /^\d{1,3}$/.test(String(raw ?? '').trim()) ? Number(String(raw).trim()) : 0;
        if (n < 1) { tell(ctx, tx(l, 'hitBad')); return true; }
        const loc = panel?.querySelector('[data-cd-loc]')?.value === 'head' ? 'head' : 'body', crit = panel?.querySelector('[data-cd-crit]')?.checked === true;
        if (m.pc) {
          const away = global.GMTable?.onlineMember?.(m.pc);
          if (away && global.RoomGrants?.sendTo) { const sent = global.RoomGrants.sendTo(away, { kind: 'damage', n, loc, via: 'armor', note: '' }, l); tell(ctx, sent?.ok ? tx(l, 'sentHit', m.name) : (sent?.error || tx(l, 'hitFail'))); return true; }
          const res = pcHit(m.pc, n, { loc, crit }); if (!res.ok) { tell(ctx, tx(l, 'hitBad')); return true; }
          if (res.rule) { tell(ctx, (global.GMTable.hitText?.(l, m.name, res) || tx(l, 'hitDone', m.name, n, res.sp, res.dealt, res.hp)) + (res.forcedCritical ? tx(l, 'forcedCrit') : '')); return res.stopped ? true : done('hit', id); }
          if (!res.dealt) { tell(ctx, tx(l, 'hitStopped', m.name, n, res.sp)); return true; }
          const set = global.Campaigns?.applyCharacterHP?.(m.pc, String(res.to), 'damage'); if (!set?.ok) { tell(ctx, tx(l, 'stale')); return true; }
          tell(ctx, tx(l, 'hitDone', m.name, n, res.sp, res.dealt, res.to)); return done('hit', id);
        }
        const res = hitRow(r, n, { loc, crit, lang: l }); if (!res.ok) { tell(ctx, tx(l, 'hitBad')); return true; }
        tell(ctx, res.stopped ? tx(l, 'hitStopped', m.name, n, res.sp) : tx(l, 'hitDone', m.name, n, res.sp, res.dealt, res.hp)); keepTurn(c, before); return done('hit', id);
      }
      case 'crit-roll': {
        const res = critRoll(b.dataset.loc, l, die); if (!res) return true;
        global.Rolls?.sum?.(`${tx(l, 'critRoll')} · ${m.name}`, res.dice, 6, { note: res.name, secret: r.kind === 'npc' });
        ui.result = { id: m.id, text: tx(l, 'critResult', res.total, res.name, res.effect) };
        if (r.kind === 'npc') { const old = r.combatNote?.text || '', line = `${res.name} (${res.total})`, text = old ? `${old}\n${line}` : line; if (text.length <= 300 && (r.combatNote === undefined || isObj(r.combatNote))) r.combatNote = { ...(r.combatNote || {}), version: 1, text }; }
        return done('crit-roll', id);
      }
      case 'death-save': {
        if (r.kind !== 'npc' || r.dead === true || num(r.hp) >= 1) return true;
        const raw = panel?.querySelector('[data-cd-body]')?.value ?? r.body, body = /^\d{1,2}$/.test(String(raw ?? '').trim()) ? Number(String(raw).trim()) : 0;
        if (body < 1 || body > 20) { tell(ctx, tx(l, 'deathNeed')); return true; }
        const d = die(10), pen = int(r.deathPenalty, 0, 99, 0), alive = d !== 10 && d + pen < body;
        r.body = body; r.deathPenalty = Math.min(99, pen + 1);
        const text = tx(l, alive ? 'deathOk' : 'deathFail', m.name, d, pen, body); if (!alive) { r.dead = true; r.out = true; delete r.held; }
        global.Rolls?.sum?.(`${tx(l, 'death')} · ${m.name}`, [d], 10, { note: alive ? 'ok' : 'dead', secret: true }); try { global.Campaigns?.journalAdd?.(c, text, true); } catch { /* optional */ }
        tell(ctx, text); ui.result = { id: m.id, text }; keepTurn(c, before); return done('death-save', id);
      }
      default: return false;
    }
  }
  function handleGroup(a, grp, c, ctx, panel, l, done) {
    const g = groupsOf(c).get(grp); if (!g) { tell(ctx, tx(l, 'stale')); return true; }
    const before = ordered(c)[int(c.turnIndex, 0, 1e6, 0)]?.id;
    if (a === 'roll-group') { const res = rollGroup(c, grp, ctx.characters || [], die); if (!res) return true; global.Rolls?.sum?.(`${tx(l, 'init')} · ${g.name} ×${res.count}`, [res.die], 10, { bonus: res.bonus, total: res.total, secret: true }); ui.result = { id: 'g:' + grp, text: tx(l, 'rolled', res.total) }; return done('roll-group', null); }
    if (a === 'ungroup') { ungroup(c, grp); ui.sel = null; return done('select-group', grp); }
    if (a === 'remove-fallen') {
      const ids = g.members.filter(isFallen).map(r => r.id); if (!ids.length) { ui.result = { id: 'g:' + grp, text: tx(l, 'noFallen') }; return done('remove-fallen', null); }
      const groups = JSON.parse(JSON.stringify(c.groups || [])), taken = removeRows(c, ids); ui.sel = null; notifyUndo(ctx, c, tx(l, 'removed', taken.length), taken, groups); return done('select-group', grp);
    }
    const raw = panel?.querySelector('[data-cd-raw]')?.value, n = /^\d{1,3}$/.test(String(raw ?? '').trim()) ? Number(String(raw).trim()) : 0;
    if (n < 1) { tell(ctx, tx(l, 'hitBad')); return true; }
    const res = groupHit(c, grp, n, { loc: panel?.querySelector('[data-cd-loc]')?.value === 'head' ? 'head' : 'body', crit: panel?.querySelector('[data-cd-crit]')?.checked === true, lang: l });
    if (!res.ok) { tell(ctx, res.reason === 'none' ? tx(l, 'groupNone') : tx(l, 'hitBad')); return true; }
    const text = tx(l, 'groupDone', res.hit, res.fell); ui.result = { id: 'g:' + grp, text }; tell(ctx, text); keepTurn(c, before); return done('group-hit', null);
  }
  // A removal can be taken back from the notice; a stale undo (the fight changed meanwhile) does nothing.
  function notifyUndo(ctx, c, message, taken, groups) {
    const l = L(ctx.lang);
    if (typeof ctx.notifyAction !== 'function') { tell(ctx, message); return; }
    ctx.notifyAction(message, tx(l, 'undo'), () => {
      // A notice outlives the page: only the data (not the view) must still be the same.
      const same = c.quick ? ui.quick === c : typeof ctx.sameData === 'function' ? ctx.sameData(c) : ctx.isCurrent?.(c) !== false && (ctx.campaigns || []).includes(c);
      if (!same) { tell(ctx, tx(l, 'stale')); return; }
      const n = restoreRows(c, taken, groups); if (!n) { tell(ctx, tx(l, 'stale')); return; }
      persist(ctx, c); tell(ctx, tx(l, 'restored', n)); ctx.render?.();
    });
  }
  function handleChange(e, ctx, root) {
    const el = e.target, l = L(ctx.lang);
    if (el.matches?.('[data-cd-campaign]')) { ui.camp = el.value; ui.sel = null; if (el.value !== 'quick') global.Campaigns?.select?.(el.value); setFocus('campaign', null); ctx.render?.(); return true; }
    const c = target(ctx); if (!c) return true;
    if (el.dataset?.cdInit !== undefined) {
      const r = rowOf(c, el.dataset.cdInit); if (!r) return true; if (!live(ctx, c)) { tell(ctx, tx(l, 'stale')); return true; }
      const before = ordered(c)[int(c.turnIndex, 0, 1e6, 0)]?.id; r.initiative = int(el.value, -99, 999, 0); r.ties = [];
      if (r.grp) { c.roster.forEach(m => { if (m.grp === r.grp) { m.initiative = r.initiative; m.ties = []; } }); alignGroups(c); }
      keepTurn(c, before); setFocus('init', r.id); persist(ctx, c); ctx.render?.(); return true;
    }
    if (el.dataset?.cdG !== undefined) {
      if (!live(ctx, c)) { tell(ctx, tx(l, 'stale')); return true; }
      if (!setGroupStat(c, el.dataset.grp, el.dataset.cdG, el.value)) { tell(ctx, tx(l, 'badNew')); ctx.render?.(); return true; }
      persist(ctx, c); tell(ctx, tx(l, 'saved')); setFocus('stat', el.dataset.cdG); ctx.render?.(); return true;
    }
    return false;
  }
  /* The one entry point of the app's event chain. Returns true when the event was the dock's. */
  function handle(e, ctx) {
    try {
      const el = e?.target; if (!el?.closest) return false;
      const root = el.closest('[data-combat-dock]'); if (!root) return false;
      if (e.type === 'input') { if (el.matches?.('[data-cd-tools-search]')) { ui.q = el.value; applySearch(root, el.value, ctx.lang); return true; } return false; }
      if (e.type === 'change') return handleChange(e, ctx, root);
      if (e.type === 'click') return handleClick(e, ctx, root);
    } catch (err) { try { ctx.notify?.(tx(ctx.lang, 'stale')); } catch { /* nothing more to do */ } return true; }
    return false;
  }
  // The search box hides buttons in place, so the typing is not interrupted by a redraw.
  function applySearch(root, q, lang) {
    const keep = new Set(filterTools(q, lang)); let any = false;
    root.querySelectorAll('[data-cd-action="tool"]').forEach(b => { const on = keep.has(b.dataset.tool); b.hidden = !on; if (on) any = true; });
    const none = root.querySelector('[data-cd-tools-none]'); if (none) none.hidden = any;
  }
  // After every draw of the page: the tools take the numbers of the open actor, and focus goes back to where the person was.
  function after(ctx) {
    const root = doc?.querySelector?.('[data-combat-dock]'); if (!root) return;
    try {
      const sel = ui.sel && !String(ui.sel).startsWith('g:') ? ui.sel : '', key = `${ui.tool}|${sel}`;
      const c = ctx && target(ctx);
      if (ui.tool && sel && c) {
        const r = rowOf(c, sel), m = r && modelOf(r, ctx.characters || [], L(ctx.lang), c, null);
        for (const [s, v] of prefillFor(m)) { const f = root.querySelector(`[data-cd-tool-body] ${s}`); if (f && 'value' in f) f.value = v; }
        ui.filled = key;
      }
    } catch { /* a calculator that has no such field is simply left alone */ }
    const f = ui.focus; ui.focus = null;
    try {
      let node = null;
      if (f) {
        const q = f.id ? `[data-cd-action="${f.act}"][data-id="${cssEsc(f.id)}"],[data-cd-action="${f.act}"][data-grp="${cssEsc(f.id)}"],[data-cd-action="${f.act}"][data-tool="${cssEsc(f.id)}"]` : `[data-cd-action="${f.act}"]`;
        node = root.querySelector(q) || (f.act === 'campaign' ? root.querySelector('[data-cd-campaign]') : null) || (f.act === 'init' ? root.querySelector(`[data-cd-init="${cssEsc(f.id)}"]`) : null);
        if (!node && f.act === 'stat') node = root.querySelector(`[data-cd-g="${cssEsc(f.id)}"]`);
        if (node && node.disabled) node = null;
        if (f.act === 'h1') node = root.querySelector('h1');
        if (!node) node = root.querySelector('[data-cd-action="next"]:not([disabled])') || root.querySelector('.cd-menu summary') || root.querySelector('h1');
      }
      if (node) node.focus?.({ preventScroll: true });
    } catch { /* focus is a courtesy */ }
  }
  const cssEsc = s => (global.CSS?.escape ? global.CSS.escape(String(s)) : String(s).replace(/["\\\]]/g, '\\$&'));
  function resetUi() { Object.assign(ui, { camp: null, sel: null, tools: false, tool: '', q: '', add: false, result: null, focus: null, quick: null, filled: '' }); }

  global.CombatDock = {
    T, TOOLS, page, emptyHTML, handle, after, target, ui, resetUi,
    // pure rules, for the tests
    ordered, walk, advance, isLead, keepTurn, pickCampaign, groupsOf, standing, isFallen, numbered, addNpcs, groupRows, setGroupStat, ungroup,
    firstTurn, turnCount, rollInit, rollGroup, rollAll, alignGroups, hitRow, groupHit, pcHit, removeRows, restoreRows, critRoll, modelOf, filterTools, prefillFor, newQuick, readQuick, hpMaxOf, woundOf,
  };
})(typeof window !== 'undefined' ? window : globalThis);
