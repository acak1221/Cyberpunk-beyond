/* Whispers («Шёпот»): private messages between the Game Master and one player in an online room, and secret checks.

   What is private, and from whom. Everything in a room is sealed with a key derived from the room code, so every member
   can read every message. A whisper is sealed a second time (room.js sealFor: ephemeral ECDH P-256 + AES-GCM) to the
   «box» key of the recipient's open page. Every page makes that key on load, keeps it unextractable in memory and
   announces its public half in its signed status, so nobody can swap in another key for a member. The sealed text names
   the sender, the recipient and the whisper id; the receiver checks them against the signature, so a member who cannot
   read a box cannot re-sign it as their own either.

   Who may whisper whom: the Game Master to any player, a player only to the Game Master this page trusts. room.js
   accepts a whisper for a player only when the trusted Game Master signed it, fresh and addressed to this member;
   Room.whisperLink.send refuses a player's whisper to anyone but the Game Master.

   What is NOT hidden: other members (and the relays, after the room key) see that a whisper went from whom to whom and
   when. The text is kept in plain text in this browser (localStorage) until the room is left.

   Delivery: the box key lives for one page load, so a whisper waits («⏳») until the recipient is online and is
   sealed again to their current key on every try, until they acknowledge it. After 24 hours it is marked «⚠».

   A secret check: the Game Master names a skill (and keeps the DV to themselves); the player's device rolls
   STAT + Skill + 1d10 (+ LUCK the player spends) and sends the numbers back sealed. The roll goes nowhere else: not to
   the room feed, not to the roll history. */
(function (global) {
  'use strict';

  const STORE = 'nightcity-red-room-whispers';
  const W = /^[0-9a-f]{16}$/, FP = /^[0-9a-f]{24}$/, SEEN = /^[0-9a-f]{24}:[0-9a-f]{16}$/;
  const MAX_TEXT = 500, MAX_NOTE = 120, MAX_ITEMS = 50, MAX_THREADS = 12, MAX_SEEN = 300;
  const PENDING_TTL = 24 * 3600 * 1000, RETRY = 15000, MAX_BOX = 6000, PER_FLUSH = 5;
  const DVS = [9, 13, 15, 17, 21, 24, 29], KINDS = ['text', 'ask', 'result'];
  const DV_NAMES = [[9, 'Простая', 'Simple'], [13, 'Обычная', 'Everyday'], [15, 'Трудная', 'Difficult'], [17, 'Профессиональная', 'Professional'], [21, 'Героическая', 'Heroic'], [24, 'Невероятная', 'Incredible'], [29, 'Легендарная', 'Legendary']];

  const T = {
    ru: {
      btnGM: '✉ Шёпот', btnPlayer: '✉ Шёпот ведущему', title: 'Шёпот', gm: 'ведущий',
      privacyGM: 'Текст видите только вы и игрок: он зашифрован ключом его открытой страницы. Остальные в комнате видят, что шёпот был, но не что в нём.',
      privacyPlayer: 'Текст видите только вы и ведущий: он зашифрован ключом его открытой страницы. Остальные в комнате видят, что шёпот был, но не что в нём.',
      send: 'Отправить', placeholder: 'Сообщение', close: 'Закрыть', empty: 'Сообщений пока нет.',
      askTitle: 'Тайная проверка', askSend: 'Попросить бросок', skill: 'Навык', dv: 'DV', dvNone: 'DV не задан', note: 'Пояснение (необязательно)',
      askedOut: 'Вы попросили тайную проверку: {skill} ({stat})', asked: 'Ведущий просит тайную проверку: {skill} ({stat})',
      answered: 'ответ получен', youAnswered: 'вы ответили', rollBtn: 'Бросить тайно', yourRoll: 'Ваш бросок: {r}.', dvHidden: 'DV знает ведущий.',
      luckHint: 'LUCK к броску', pending: '⏳ ждёт доставки — уйдёт, когда собеседник будет в сети', sent: '✓ доставлено', failed: '⚠ не доставлено',
      retry: 'Повторить', oldApp: 'У собеседника старая версия приложения: попросите обновить страницу.',
      noChar: 'Выберите персонажа на странице «Игра онлайн».', gotText: 'Ведущий шепнул вам', gotAsk: 'Ведущий просит тайную проверку',
      gotFrom: '{name} шепнул(а) вам', gotResult: '{name}: тайная проверка — {total}', open: 'Открыть',
      success: 'успех', failure: 'провал', crit: 'крит. успех', fumble: 'крит. провал', unread: 'непрочитанных: {n}',
      full: 'Слишком много переписок: откройте старые, чтобы освободить место.', armor: 'Проверьте экипированную броню и настройку автоматизации перед броском.',
      noskill: 'Не удалось бросить кубик.', saveFailed: 'Не удалось сохранить LUCK персонажа: бросок не отправлен.', noPeer: 'Этого участника нет в комнате.',
    },
    en: {
      btnGM: '✉ Whisper', btnPlayer: '✉ Whisper to GM', title: 'Whisper', gm: 'Game Master',
      privacyGM: 'Only you and the player can read this: it is encrypted with the key of their open page. Others in the room see that a whisper was sent, not what it says.',
      privacyPlayer: 'Only you and the GM can read this: it is encrypted with the key of their open page. Others in the room see that a whisper was sent, not what it says.',
      send: 'Send', placeholder: 'Message', close: 'Close', empty: 'No messages yet.',
      askTitle: 'Secret check', askSend: 'Ask for a roll', skill: 'Skill', dv: 'DV', dvNone: 'No DV', note: 'Note (optional)',
      askedOut: 'You asked for a secret check: {skill} ({stat})', asked: 'The GM asks for a secret check: {skill} ({stat})',
      answered: 'answered', youAnswered: 'answered', rollBtn: 'Roll secretly', yourRoll: 'Your roll: {r}.', dvHidden: 'The GM knows the DV.',
      luckHint: 'LUCK for the roll', pending: '⏳ waiting — goes out when they are online', sent: '✓ delivered', failed: '⚠ not delivered',
      retry: 'Retry', oldApp: 'They run an old version of the app: ask them to reload the page.',
      noChar: 'Choose a character on the “Online play” page.', gotText: 'The GM whispered to you', gotAsk: 'The GM asks for a secret check',
      gotFrom: '{name} whispered to you', gotResult: '{name}: secret check — {total}', open: 'Open',
      success: 'success', failure: 'failure', crit: 'critical success', fumble: 'critical failure', unread: 'unread: {n}',
      full: 'Too many conversations: open the old ones to free a place.', armor: 'Check equipped armor and the automation setting before rolling.',
      noskill: 'Could not roll the die.', saveFailed: 'Could not save the character’s LUCK: the roll was not sent.', noPeer: 'This member is not in the room.',
    },
  };
  const doc = global.document;
  const lang = () => { try { return global.App?.getState?.()?.lang === 'en' ? 'en' : 'ru'; } catch { return 'ru'; } };
  const tx = l => T[l === 'en' ? 'en' : 'ru'];
  const esc = x => String(x ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const obj = v => !!v && typeof v === 'object' && !Array.isArray(v);
  const hex = n => { const a = new Uint8Array(n); global.crypto.getRandomValues(a); return Array.from(a, x => x.toString(16).padStart(2, '0')).join(''); };
  const notify = m => { try { global.App?.notify?.(m); } catch {} };

  /* ---------- Pure part ---------- */

  // Text from the other device: control characters become spaces, then trimmed and clipped. Same rule as room-grants.js.
  const text = (v, n) => (typeof v === 'string' ? v : '').replace(/[\u0000-\u001f\u007f\u2028\u2029]/g, ' ').trim().slice(0, n);
  const whole = (v, lo, hi) => (Number.isSafeInteger(v) && v >= lo && v <= hi ? v : null);
  const dieValue = (first, extra) => first + (first === 10 ? extra : first === 1 ? -extra : 0);
  // The skill reference has one «Language» and one «Local Expert»; a sheet keeps two of each. Checks use the sheet's keys.
  const VARIANTS = {
    'Language': [['Language (Streetslang)', 'Язык (уличный сленг)'], ['Language (Other)', 'Язык (другой)']],
    'Local Expert': [['Local Expert (Home)', 'Знание района (дом)'], ['Local Expert (Other)', 'Знание района (другой)']],
  };
  function skillList() {
    const list = global.SkillReference?.SKILLS, out = [];
    for (const r of Array.isArray(list) ? list : []) {
      if (!Array.isArray(r) || typeof r[0] !== 'string') continue;
      if (VARIANTS[r[0]]) for (const [id, ru] of VARIANTS[r[0]]) out.push([id, r[1], r[2], r[3], r[4], ru]);
      else out.push(r);
    }
    return out;
  }
  // Also takes the reference ids «Language» and «Local Expert» (from a page before this split).
  function skillRow(id) {
    if (typeof id !== 'string' || !id) return null;
    const list = global.SkillReference?.SKILLS;
    return skillList().find(r => r[0] === id) || (VARIANTS[id] && Array.isArray(list) ? list.find(r => Array.isArray(r) && r[0] === id) || null : null);
  }
  // The level on the sheet; for a reference id with two sheet keys, the higher of the two.
  const skillLevel = (c, id) => (VARIANTS[id] ? Math.max(...VARIANTS[id].map(([k]) => Number(c.skills?.[k]) || 0)) : Number(c.skills?.[id]) || 0);
  const skillName = (row, l) => (row ? (l === 'en' ? row[0] : row[5] || row[0]) : '—');
  const dvLadder = () => { const d = global.SkillReference?.DV; return Array.isArray(d) && d.length ? d : DV_NAMES; };

  // The fields of one kind of whisper, rebuilt; null when anything is missing or out of range.
  function fieldsOf(kind, o) {
    if (kind === 'text') { const t = text(o.text, MAX_TEXT); return t ? { text: t } : null; }
    if (kind === 'ask') { const row = skillRow(o.skill); return row ? { skill: row[0], note: text(o.note, MAX_NOTE) } : null; }
    if (kind === 'result') {
      if (typeof o.re !== 'string' || !W.test(o.re)) return null;
      const row = skillRow(o.skill); if (!row) return null;
      const first = whole(o.first, 1, 10), extra = whole(o.extra, 0, 10), base = whole(o.base, -60, 60), luck = whole(o.luck, 0, 20), total = whole(o.total, -100, 100);
      if (first === null || extra === null || base === null || luck === null || total === null) return null;
      if (extra > 0 && first !== 1 && first !== 10) return null;
      if (total !== base + luck + dieValue(first, extra)) return null;
      return { re: o.re, skill: row[0], base, luck, first, extra, total };
    }
    return null;
  }
  // What came out of a sealed box: it must name this sender, this recipient and a known kind. No DV is ever read.
  function cleanInner(o, { from, to } = {}) {
    if (!obj(o) || o.v !== 1 || typeof o.w !== 'string' || !W.test(o.w)) return null;
    if (typeof from !== 'string' || !FP.test(from) || o.from !== from || typeof to !== 'string' || !FP.test(to) || o.to !== to) return null;
    if (!KINDS.includes(o.kind)) return null;
    const at = whole(o.at, 1, Number.MAX_SAFE_INTEGER); if (at === null) return null;
    const f = fieldsOf(o.kind, o); if (!f) return null;
    return { w: o.w, kind: o.kind, at: Math.min(at, Date.now()), ...f };
  }

  // A secret check made on this device. Never changes the character: the caller takes the LUCK.
  function rollFor(c, skillId, luckWanted, rng) {
    if (!obj(c)) return { ok: false, why: 'nochar' };
    const row = skillRow(skillId); if (!row) return { ok: false, why: 'noskill' };
    const stat = row[2], level = skillLevel(c, row[0]);
    let base;
    try { base = global.App?.checkBase?.(c, stat, level, '', row[0]); } catch { base = undefined; }
    if (base === null) return { ok: false, why: 'armor' };
    base = Math.max(-60, Math.min(60, Math.trunc(Number(base)) || 0));
    const x = obj(c.extra) ? c.extra : {};
    const pool = x.luck === undefined || x.luck === '' ? Number(c.stats?.LUCK) || 0 : Math.max(0, Number(x.luck) || 0);
    const luck = Math.max(0, Math.min(Math.trunc(Number(luckWanted)) || 0, Math.min(Math.trunc(pool), 20)));
    const die = global.Rolls?.d10?.(rng);
    if (!die) return { ok: false, why: 'noskill' };
    return { ok: true, skill: row[0], base, luck, first: die.first, extra: die.extra, total: Math.max(-100, Math.min(100, base + luck + die.value)) };
  }
  const luckPool = c => { const x = obj(c?.extra) ? c.extra : {}; return Math.max(0, Math.min(20, Math.trunc(x.luck === undefined || x.luck === '' ? Number(c?.stats?.LUCK) || 0 : Number(x.luck) || 0))); };

  // A check succeeds only when the total beats the DV; a tie fails (Corebook p. 128).
  const verdict = (total, dv) => (dv ? total > dv : null);

  // «14 (1d10 7 + 7 · LUCK +1)», and for the Game Master «… > DV 13 — успех».
  function describeResult(item, l, { gm = false } = {}) {
    const t = tx(l), { first, extra, base, luck, total } = item;
    let s = `${total} (1d10 ${first}${extra ? (first === 10 ? ' + ' : ' − ') + extra : ''}${base ? (base > 0 ? ' + ' : ' − ') + Math.abs(base) : ''}${luck ? ' · LUCK +' + luck : ''})`;
    if (gm && DVS.includes(item.dv)) s += ` ${verdict(total, item.dv) ? '>' : '≤'} DV ${item.dv} — ${verdict(total, item.dv) ? t.success : t.failure}`;
    if (first === 10) s += ` · ${t.crit}`; else if (first === 1) s += ` · ${t.fumble}`;
    return s;
  }

  function cleanItem(x, now = Date.now()) {
    if (!obj(x) || typeof x.w !== 'string' || !W.test(x.w) || !['in', 'out'].includes(x.dir) || !KINDS.includes(x.kind)) return null;
    const at = whole(x.at, 1, Number.MAX_SAFE_INTEGER); if (at === null) return null;
    const f = fieldsOf(x.kind, x); if (!f) return null;
    const it = { w: x.w, dir: x.dir, kind: x.kind, at, ...f };
    if (x.dir === 'in') it.got = whole(x.got, 1, Number.MAX_SAFE_INTEGER) || at;
    else { it.state = ['pending', 'sent', 'failed'].includes(x.state) ? x.state : 'sent'; if (it.state === 'pending' && now - at > PENDING_TTL) it.state = 'failed'; }
    if (x.kind === 'ask') { it.answered = x.answered === true; if (x.dir === 'out' && DVS.includes(x.dv)) it.dv = x.dv; }
    if (x.kind === 'result' && x.dir === 'in' && DVS.includes(x.dv)) it.dv = x.dv;
    return it;
  }
  const lastActivity = th => th.items.reduce((m, i) => Math.max(m, i.got || i.at), th.read || 0);
  const unreadOf = th => (th ? th.items.filter(i => i.dir === 'in' && i.got > (th.read || 0)).length : 0);
  const busy = th => unreadOf(th) > 0 || th.items.some(i => i.dir === 'out' && i.state === 'pending');
  const emptyState = code => ({ v: 1, code, threads: {}, seen: [] });

  // The stored history of one room. Anything else (another room, a broken store) is an empty history.
  function load(raw, code) {
    const out = emptyState(code);
    let s = raw;
    if (typeof raw === 'string') { try { s = JSON.parse(raw); } catch { return out; } }
    if (!obj(s) || s.v !== 1 || typeof code !== 'string' || !code || s.code !== code) return out;
    const now = Date.now(), threads = [];
    for (const [fp, th] of Object.entries(obj(s.threads) ? s.threads : {})) {
      if (!FP.test(fp) || !obj(th)) continue;
      const seenW = new Set(), items = [];
      for (const x of Array.isArray(th.items) ? th.items : []) { const it = cleanItem(x, now); if (it && !seenW.has(it.w)) { seenW.add(it.w); items.push(it); } }
      threads.push([fp, { name: text(th.name, 40), read: whole(th.read, 0, Number.MAX_SAFE_INTEGER) || 0, items: items.slice(-MAX_ITEMS) }]);
    }
    threads.sort((a, b) => lastActivity(b[1]) - lastActivity(a[1]));
    for (const [fp, th] of threads.slice(0, MAX_THREADS)) out.threads[fp] = th;
    out.seen = (Array.isArray(s.seen) ? s.seen : []).filter(w => typeof w === 'string' && SEEN.test(w)).slice(-MAX_SEEN);
    return out;
  }
  const serialize = s => JSON.stringify({ v: 1, code: s.code, threads: s.threads, seen: s.seen });

  /* ---------- Page part ---------- */

  let state = null, roomCode = '', openFp = '', lastThread = '';
  const tried = new Map(), rolling = new Set();
  const link = () => global.Room?.whisperLink;
  const who = () => { try { return link()?.who?.() || null; } catch { return null; } };
  const peers = () => { try { return link()?.peers?.() || []; } catch { return []; } };

  // The history follows the room this page is in. Pages draw before Room.attach, so «no room yet» never wipes anything.
  function sync() {
    const code = who()?.code;
    if (code && code !== roomCode) {
      roomCode = code; tried.clear();
      let raw = null; try { raw = global.localStorage?.getItem(STORE); } catch {}
      state = load(raw, code);
    }
    return !!state && !!roomCode;
  }
  function store() { if (!state || !roomCode) return; try { global.localStorage?.setItem(STORE, serialize(state)); } catch {} }
  // Leaving the room deletes the history on this device.
  function forget() {
    try { global.localStorage?.removeItem(STORE); } catch {}
    state = null; roomCode = ''; openFp = ''; lastThread = ''; tried.clear(); rolling.clear();
    for (const d of doc?.querySelectorAll?.('.rw-dialog') || []) { try { d.close?.(); } catch {} d.remove?.(); }
  }
  function ensureThread(fp, name) {
    let th = state.threads[fp];
    if (!th) {
      const keys = Object.keys(state.threads);
      if (keys.length >= MAX_THREADS) {
        const idle = keys.filter(k => !busy(state.threads[k]) && k !== openFp).sort((a, b) => lastActivity(state.threads[a]) - lastActivity(state.threads[b]));
        if (!idle.length) return null;
        delete state.threads[idle[0]];
      }
      th = state.threads[fp] = { name: '', read: 0, items: [] };
    }
    if (name) th.name = text(name, 40);
    return th;
  }
  const push = (th, it) => { th.items.push(it); if (th.items.length > MAX_ITEMS) th.items.splice(0, th.items.length - MAX_ITEMS); };

  // Who may talk to whom: the Game Master to any player, a player only to the trusted Game Master.
  function canTalk(fp) {
    const me = who(); if (!me || !FP.test(fp || '') || fp === me.fp) return false;
    if (me.role === 'gm') return true;
    return !!me.gmFp && fp === me.gmFp;
  }
  // The newest online page of that member that announced a box.
  function target(fp, me) {
    let best = null;
    for (const p of peers()) {
      if (p.fp !== fp || !p.online || !p.box) continue;
      if (me.role !== 'gm' && (p.role !== 'gm' || fp !== me.gmFp)) continue;
      if (!best || (p.at || 0) > (best.at || 0)) best = p;
    }
    return best;
  }
  function innerOf(it, from, to) {
    const base = { v: 1, w: it.w, from, to, at: it.at, kind: it.kind };
    if (it.kind === 'text') return { ...base, text: it.text };
    if (it.kind === 'ask') return { ...base, skill: it.skill, note: it.note };
    return { ...base, re: it.re, skill: it.skill, base: it.base, luck: it.luck, first: it.first, extra: it.extra, total: it.total };
  }

  // Sends what waits, sealed to the recipient's current box. Each try waits RETRY unless the recipient's page changed.
  async function flush(only) {
    if (!sync()) return 0;
    const me = who(); if (!me) return 0;
    const now = Date.now(), list = [];
    let changed = false, n = 0;
    for (const [fp, th] of Object.entries(state.threads)) {
      if (only && fp !== only) continue;
      for (const it of th.items) {
        if (it.dir !== 'out' || it.state !== 'pending') continue;
        if (now - it.at > PENDING_TTL) { it.state = 'failed'; changed = true; continue; }
        list.push([fp, it]);
      }
    }
    if (changed) { store(); paint(); }
    list.sort((a, b) => a[1].at - b[1].at);
    for (const [fp, it] of list) {
      if (n >= PER_FLUSH) break;
      if (!canTalk(fp)) continue;
      const p = target(fp, me); if (!p) continue;
      const last = tried.get(it.w), boxId = p.box.x + p.box.y;
      if (last && last.box === boxId && now - last.at < RETRY) continue;
      tried.set(it.w, { at: now, box: boxId }); n++;
      try {
        const box = await link().seal(p.box, innerOf(it, me.fp, fp));
        await link().send(p.id, 'whisper', { w: it.w, epk: box.epk, iv: box.iv, ct: box.ct });
      } catch {}
    }
    return n;
  }

  function addOut(fp, it) {
    const peer = peers().find(p => p.fp === fp), th = ensureThread(fp, peer?.name || '');
    if (!th) { notify(tx(lang()).full); return null; }
    push(th, it); store(); paint(); repaintRoom(); flush(fp);
    return it;
  }
  function say(fp, value) {
    if (!sync() || !canTalk(fp)) return null;
    const t = text(value, MAX_TEXT); if (!t) return null;
    return addOut(fp, { w: hex(8), dir: 'out', kind: 'text', at: Date.now(), text: t, state: 'pending' });
  }
  // The Game Master asks one player for a secret check. The DV stays on this device.
  function ask(fp, skill, dv, note) {
    const me = who(); if (!sync() || me?.role !== 'gm' || !canTalk(fp)) return null;
    const row = skillRow(skill); if (!row) return null;
    const d = Number(dv), it = { w: hex(8), dir: 'out', kind: 'ask', at: Date.now(), skill: row[0], note: text(note, MAX_NOTE), answered: false, state: 'pending' };
    if (DVS.includes(d)) it.dv = d;
    return addOut(fp, it);
  }
  const characterOf = me => { try { return me?.characterId ? global.App?.getState?.()?.characters?.find(c => c?.id === me.characterId) || null : null; } catch { return null; } };
  // The player answers a secret check: rolled here, shown here, sent sealed to the Game Master only.
  async function roll(fp, askW, luckWanted, rng = Math.random) {
    const me = who(); if (!sync() || !me || me.role === 'gm' || fp !== me.gmFp) return null;
    const th = state.threads[fp], a = th?.items.find(x => x.dir === 'in' && x.kind === 'ask' && x.w === askW && !x.answered);
    if (!a || rolling.has(askW)) return null;
    const t = tx(lang()), c = characterOf(me);
    if (!c) { notify(t.noChar); return null; }
    const luckIn = luckWanted ?? doc?.querySelector?.('#rw-luck')?.value ?? 0;
    const r = rollFor(c, a.skill, luckIn, rng);
    if (!r.ok) { notify(r.why === 'armor' ? t.armor : r.why === 'nochar' ? t.noChar : t.noskill); return null; }
    rolling.add(askW);
    try {
      if (r.luck) {
        let x; try { x = global.CharacterExtra?.init?.(c); } catch { x = null; }
        if (!x) { notify(t.saveFailed); return null; }
        const before = x.luck;
        x.luck = Math.max(0, (Number(x.luck) || 0) - r.luck);
        let ok = true;
        try { const res = await global.App?.save?.(); if (res && res.ok === false) ok = false; } catch { ok = false; }
        if (!ok) { x.luck = before; notify(t.saveFailed); return null; }
        try { global.App?.render?.(); } catch {}
      }
      if (!state || a.answered) return null;
      a.answered = true;
      const it = { w: hex(8), dir: 'out', kind: 'result', at: Date.now(), re: askW, skill: r.skill, base: r.base, luck: r.luck, first: r.first, extra: r.extra, total: r.total, state: 'pending' };
      push(th, it); store(); paint(); repaintRoom(); flush(fp);
      return it;
    } finally { rolling.delete(askW); }
  }
  function retry(fp, w) {
    if (!sync()) return;
    const it = state.threads[fp]?.items.find(x => x.dir === 'out' && x.w === w && x.state === 'failed'); if (!it) return;
    it.w = hex(8); it.at = Date.now(); it.state = 'pending'; store(); paint(); flush(fp);
  }

  // Called by room.js for a message it has already checked: signed, fresh, live, addressed to this member, and for a
  // player only from the trusted Game Master. meta = { from: member id, fp, name }. -> true when something changed.
  async function receive(type, d, meta) {
    if (!sync() || !obj(d) || !obj(meta) || !FP.test(meta.fp || '')) return false;
    const me = who(); if (!me) return false;
    if (type === 'whisper-ack') {
      if (typeof d.w !== 'string' || !W.test(d.w)) return false;
      const it = state.threads[meta.fp]?.items.find(x => x.dir === 'out' && x.w === d.w && x.state === 'pending');
      if (!it) return false;
      it.state = 'sent'; tried.delete(d.w); store(); paint();
      return true;
    }
    if (type !== 'whisper') return false;
    if (typeof d.w !== 'string' || !W.test(d.w) || !obj(d.epk) || typeof d.iv !== 'string' || d.iv.length > 64 || typeof d.ct !== 'string' || d.ct.length > MAX_BOX) return false;
    if (!canTalk(meta.fp)) return false;
    const ack = () => { try { link()?.send?.(meta.from, 'whisper-ack', { w: d.w }); } catch {} };
    // Replays are remembered per sender: the id travels in clear, so another member must not be able to use it up.
    const seenKey = meta.fp + ':' + d.w;
    if (state.seen.includes(seenKey)) { ack(); return false; }
    let plain;
    try { plain = await link().open({ epk: d.epk, iv: d.iv, ct: d.ct }); } catch { return false; }
    if (!state) return false;
    const inner = cleanInner(plain, { from: meta.fp, to: me.fp });
    if (!inner || inner.w !== d.w || state.seen.includes(seenKey)) return false;
    if (me.role === 'gm' ? !['text', 'result'].includes(inner.kind) : !['text', 'ask'].includes(inner.kind)) return false;
    const item = { ...inner, dir: 'in', got: Date.now() };
    let th = state.threads[meta.fp];
    if (inner.kind === 'result') {
      const a = th?.items.find(x => x.dir === 'out' && x.kind === 'ask' && x.w === inner.re);
      if (!a || a.answered || a.skill !== inner.skill) return false;
      a.answered = true; if (a.state === 'pending') a.state = 'sent';
      if (DVS.includes(a.dv)) item.dv = a.dv;
    }
    if (inner.kind === 'ask') item.answered = false;
    th = ensureThread(meta.fp, meta.name);
    if (!th) return false;
    push(th, item);
    state.seen.push(seenKey); if (state.seen.length > MAX_SEEN) state.seen.splice(0, state.seen.length - MAX_SEEN);
    const looking = openFp === meta.fp && !!doc?.querySelector?.('.rw-dialog');
    if (looking) th.read = Date.now();
    store(); ack(); paint();
    if (!looking) {
      const t = tx(lang()), name = th.name || '?';
      const msg = me.role === 'gm' ? (inner.kind === 'result' ? t.gotResult.replace('{name}', name).replace('{total}', inner.total) : t.gotFrom.replace('{name}', name)) : inner.kind === 'ask' ? t.gotAsk : t.gotText;
      try { if (global.App?.notifyAction) global.App.notifyAction(msg, t.open, () => open(meta.fp)); else notify(msg); } catch {}
      try { if (global.localStorage?.getItem('nc-haptics') !== 'off') global.navigator?.vibrate?.([60, 40, 60]); } catch {}
    }
    return true;
  }

  /* ---------- Markup ---------- */

  function visibleThreads() {
    const me = who(); if (!me || !state) return [];
    if (me.role !== 'gm') return me.gmFp && state.threads[me.gmFp] ? [[me.gmFp, state.threads[me.gmFp]]] : [];
    const gmPeers = new Set(peers().filter(p => p.role === 'gm').map(p => p.fp));
    return Object.entries(state.threads).filter(([fp]) => fp !== me.fp && !gmPeers.has(fp));
  }
  function unread() { try { if (!sync()) return 0; return visibleThreads().reduce((n, [, th]) => n + unreadOf(th), 0); } catch { return 0; } }
  // On a member's card on the room page.
  function memberButton(id) {
    try {
      if (!sync()) return '';
      const me = who(), p = peers().find(x => x.id === id); if (!me || !p) return '';
      const mine = me.role === 'gm' ? p.role !== 'gm' : p.role === 'gm' && p.fp === me.gmFp;
      if (!mine || !canTalk(p.fp)) return '';
      const t = tx(lang()), n = unreadOf(state.threads[p.fp]);
      return `<button type="button" class="btn ghost rw-open" data-rw-open="${esc(p.fp)}">${esc(me.role === 'gm' ? t.btnGM : t.btnPlayer)}${n ? ` <span class="rw-badge" aria-label="${esc(t.unread.replace('{n}', n))}">${n}</span>` : ''}</button>`;
    } catch { return ''; }
  }
  const timeOf = ms => { try { return new Date(ms).toLocaleTimeString(lang() === 'ru' ? 'ru-RU' : 'en-GB', { hour: '2-digit', minute: '2-digit' }); } catch { return ''; } };
  function threadHTML(fp) {
    const l = lang(), t = tx(l), me = who(), th = state?.threads?.[fp], gm = me?.role === 'gm';
    if (!th || !th.items.length) return `<ol class="rw-thread" tabindex="0" aria-label="${esc(t.title)}"><li class="rw-empty">${esc(t.empty)}</li></ol>`;
    const hasChar = !!characterOf(me);
    return `<ol class="rw-thread" tabindex="0" aria-label="${esc(t.title)}" aria-live="polite">${th.items.map(it => {
      const row = skillRow(it.skill), skill = esc(skillName(row, l)), stat = esc(row?.[2] || '');
      let body = '';
      if (it.kind === 'text') body = `<p>${esc(it.text)}</p>`;
      else if (it.kind === 'ask' && it.dir === 'out') {
        const dv = dvLadder().find(x => x[0] === it.dv);
        body = `<p><b>${esc(t.askedOut.replace('{skill}', '\u0000').replace('{stat}', '\u0001')).replace('\u0000', skill).replace('\u0001', stat)}</b>${dv ? ` · DV ${dv[0]} (${esc(l === 'en' ? dv[2] : dv[1])})` : ''}</p>${it.note ? `<p class="rw-note">${esc(it.note)}</p>` : ''}${it.answered ? `<small class="rw-done">✓ ${esc(t.answered)}</small>` : ''}`;
      } else if (it.kind === 'ask') {
        body = `<p><b>${esc(t.asked.replace('{skill}', '\u0000').replace('{stat}', '\u0001')).replace('\u0000', skill).replace('\u0001', stat)}</b></p>${it.note ? `<p class="rw-note">${esc(it.note)}</p>` : ''}${it.answered ? `<small class="rw-done">✓ ${esc(t.youAnswered)}</small>` : `<div class="rw-roll"><button type="button" class="btn primary" data-rw-roll="${esc(it.w)}"${hasChar ? '' : ' disabled'}>🎲 ${esc(t.rollBtn)}</button>${hasChar ? '' : `<small>${esc(t.noChar)}</small>`}</div>`}`;
      } else if (it.dir === 'out') body = `<p><b>${skill}</b>: ${esc(t.yourRoll.replace('{r}', describeResult(it, l)))} ${esc(t.dvHidden)}</p>`;
      else body = `<p class="rw-result${DVS.includes(it.dv) ? (verdict(it.total, it.dv) ? ' ok' : ' bad') : ''}"><b>${esc(th.name || '?')} · ${skill}:</b> ${esc(describeResult(it, l, { gm }))}</p>`;
      const st = it.dir === 'out' ? ` · <span class="rw-state ${it.state}">${esc(t[it.state] || '')}</span>${it.state === 'failed' ? ` <button type="button" class="room-mute" data-rw-retry="${esc(it.w)}">${esc(t.retry)}</button>` : ''}` : '';
      return `<li class="rw-item ${it.dir} k-${it.kind}">${body}<small class="rw-meta">${esc(timeOf(it.dir === 'in' ? it.got : it.at))}${st}</small></li>`;
    }).join('')}</ol>`;
  }
  const openAsk = fp => { const me = who(); return me && me.role !== 'gm' ? state?.threads?.[fp]?.items.find(x => x.dir === 'in' && x.kind === 'ask' && !x.answered) || null : null; };
  // A member that is online without a box runs an app from before whispers.
  const oldApp = fp => { const list = peers().filter(p => p.fp === fp && p.online); return list.length > 0 && !list.some(p => p.box); };
  function dialogHTML(fp) {
    const l = lang(), t = tx(l), me = who(), gm = me?.role === 'gm', p = peers().find(x => x.fp === fp), name = p?.name || state?.threads?.[fp]?.name || '?';
    const title = gm ? `${t.title}: ${p?.character ? p.character + ' (' + name + ')' : name}` : `${t.title}: ${t.gm} (${name})`;
    const c = characterOf(me), pool = luckPool(c);
    const skills = skillList().sort((a, b) => skillName(a, l).localeCompare(skillName(b, l), l));
    const askBlock = gm ? `<details class="rw-ask"><summary>${esc(t.askTitle)}</summary><form class="rw-ask-form" data-rw-form="ask">
<label class="field">${esc(t.skill)}<select name="skill">${skills.map(r => `<option value="${esc(r[0])}"${r[0] === 'Perception' ? ' selected' : ''}>${esc(skillName(r, l))} (${esc(r[2])})</option>`).join('')}</select></label>
<label class="field">${esc(t.dv)}<select name="dv"><option value="">${esc(t.dvNone)}</option>${dvLadder().map(d => `<option value="${d[0]}">${d[0]} — ${esc(l === 'en' ? d[2] : d[1])}</option>`).join('')}</select></label>
<label class="field">${esc(t.note)}<input name="note" maxlength="${MAX_NOTE}" autocomplete="off"></label>
<button type="submit" class="btn ghost">${esc(t.askSend)}</button></form></details>` : '';
    return `<div class="rw-box"><h2>${esc(title)}</h2><p class="rw-privacy">${esc(gm ? t.privacyGM : t.privacyPlayer)}</p>
<p class="rw-old" role="alert"${oldApp(fp) ? '' : ' hidden'}>${esc(t.oldApp)}</p>
${threadHTML(fp)}
<label id="rw-luck-row" class="rw-luck"${openAsk(fp) ? '' : ' hidden'}>${esc(t.luckHint)} <input id="rw-luck" type="number" inputmode="numeric" min="0" max="${pool}" step="1" value="0"> <small>/ ${pool}</small></label>
<form class="rw-send" data-rw-form="text"><input id="rw-text" maxlength="${MAX_TEXT}" autocomplete="off" aria-label="${esc(t.placeholder)}" placeholder="${esc(t.placeholder)}"><button type="submit" class="btn primary"${oldApp(fp) ? ' disabled' : ''}>${esc(t.send)}</button></form>
${askBlock}
<div class="dialog-actions"><button type="button" class="btn ghost" data-rw-close>${esc(t.close)}</button></div></div>`;
  }
  function repaintRoom() {
    try { link()?.repaint?.(); } catch {}
    try { const pill = doc?.querySelector?.('[data-room-pill]'); if (pill && global.Room?.pill) pill.outerHTML = global.Room.pill(); } catch {}
  }
  // Repaints only the thread and the state around it; the inputs are never redrawn, so typed text stays.
  function paint() {
    const dlg = doc?.querySelector?.('.rw-dialog'); if (!dlg || !openFp || !state) return;
    // The language changed: the fixed parts are drawn again, keeping what was typed.
    if (dlg.dataset.lang !== lang()) {
      const typed = dlg.querySelector('#rw-text')?.value || '';
      dlg.innerHTML = dialogHTML(openFp); dlg.dataset.lang = lang(); lastThread = dlg.querySelector('.rw-thread')?.outerHTML || '';
      const input = dlg.querySelector('#rw-text'); if (input) input.value = typed;
    }
    const list = dlg.querySelector('.rw-thread'), html = threadHTML(openFp);
    if (list && html !== lastThread) {
      const atEnd = list.scrollHeight - list.scrollTop - list.clientHeight < 40;
      list.outerHTML = html; lastThread = html;
      const fresh = dlg.querySelector('.rw-thread'); if (fresh && (atEnd || !lastThread)) fresh.scrollTop = fresh.scrollHeight;
    }
    const row = dlg.querySelector('#rw-luck-row'); if (row) row.hidden = !openAsk(openFp);
    const pool = luckPool(characterOf(who())), luck = dlg.querySelector('#rw-luck');
    if (luck) { luck.max = String(pool); const small = row?.querySelector('small'); if (small) small.textContent = '/ ' + pool; }
    const old = oldApp(openFp), warn = dlg.querySelector('.rw-old'); if (warn) warn.hidden = !old;
    for (const b of dlg.querySelectorAll('[data-rw-form] button[type="submit"]')) b.disabled = old;
  }
  function markRead(fp) { const th = state?.threads?.[fp]; if (th && unreadOf(th)) { th.read = Date.now(); store(); repaintRoom(); } }
  function open(fp) {
    if (!sync() || !canTalk(fp)) { notify(tx(lang()).noPeer); return; }
    if (!doc?.createElement) return;
    for (const d of doc.querySelectorAll('.rw-dialog')) d.remove();
    openFp = fp; lastThread = '';
    const dlg = doc.createElement('dialog'); dlg.className = 'share-import rw-dialog'; dlg.innerHTML = dialogHTML(fp); dlg.dataset.lang = lang();
    doc.body.appendChild(dlg);
    lastThread = dlg.querySelector('.rw-thread')?.outerHTML || '';
    dlg.addEventListener('close', () => { dlg.remove(); if (openFp === fp) { openFp = ''; lastThread = ''; } });
    dlg.addEventListener('submit', e => {
      const f = e.target?.closest?.('[data-rw-form]'); if (!f) return;
      e.preventDefault();
      if (f.dataset.rwForm === 'text') { const input = f.querySelector('#rw-text'); if (say(fp, input?.value)) { input.value = ''; input.focus(); } }
      else if (f.dataset.rwForm === 'ask') { if (ask(fp, f.elements.skill.value, f.elements.dv.value, f.elements.note.value)) { f.elements.note.value = ''; f.closest('details')?.removeAttribute('open'); } }
    });
    if (typeof dlg.showModal === 'function') dlg.showModal(); else dlg.setAttribute('open', '');
    const list = dlg.querySelector('.rw-thread'); if (list) list.scrollTop = list.scrollHeight;
    markRead(fp);
    dlg.querySelector('#rw-text')?.focus();
  }

  if (doc?.addEventListener) {
    doc.addEventListener('click', e => {
      const b = e.target?.closest?.('[data-rw-open],[data-rw-roll],[data-rw-close],[data-rw-retry]'); if (!b) return;
      if (b.dataset.rwOpen) open(b.dataset.rwOpen);
      else if (b.dataset.rwRoll) { b.disabled = true; roll(openFp, b.dataset.rwRoll).finally(() => paint()); }
      else if (b.dataset.rwRetry) retry(openFp, b.dataset.rwRetry);
      else b.closest('dialog')?.close?.();
    });
  }

  global.RoomWhispers = {
    receive, flush, forget, memberButton, unread, open,
    // room.js calls this on every repaint: the history follows the room and the open dialog follows the language.
    refresh() { sync(); if (openFp) { paint(); markRead(openFp); } },
    _test: { text, skillList, cleanInner, cleanItem, rollFor, verdict, describeResult, load, serialize, state: () => state, openFp: v => { if (v !== undefined) openFp = v; return openFp; }, say, ask, roll, retry, dialogHTML, threadHTML, sync, tried, MAX_ITEMS, MAX_THREADS, PENDING_TTL, RETRY },
  };
})(window);
