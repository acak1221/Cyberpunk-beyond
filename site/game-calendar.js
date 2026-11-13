// Game calendar: one game date per character (and one per campaign) and a list of what is due after days pass.
//  - The calendar only PROPOSES. It never pays, heals, rolls or changes anything but extra.calendar (and, for a
//    campaign, campaign.gameDate). Every row opens the existing tool, already filled in; the tool asks the player.
//  - Pure helpers (dates, read/start/setDate/advance/follow/due/readyOn) take plain objects and never touch a sheet.
//  - Thin mutators (consume/skip/catchUp) write only c.extra.calendar and return a boolean.
//  - Other tools call consume() after THEIR OWN confirmed action (rest, therapy week, hustle roll, drug hours), so a
//    row disappears after the work was really done. With no calendar every hook is a no-op.
// app.js calls handle() for the sheet card; campaigns.js calls handleCampaign() for the campaign card.
(function () {
  'use strict';

  const DEFAULT_START = '2045-01-01';
  const KEYS = ['heal', 'hustle', 'therapy', 'drugs', 'living', 'livingSnooze'];
  const isMonthKey = k => k === 'living' || k === 'livingSnooze';
  const drugKey = k => typeof k === 'string' && /^drug:[a-z0-9-]+$/.test(k);
  const SKIPPABLE = ['living', 'heal', 'therapy', 'hustle', 'drugs'];
  const UNDO_MS = 20000;

  const T = {
    ru: {
      title: 'Дата игры', head: 'ДАТА ИГРЫ', date: 'Дата', none: 'Дата игры не задана. Укажите её — и приложение будет подсказывать, что пора сделать: жильё, отдых, терапия, заработок.',
      startFrom: 'Начать с', startCamp: 'Начать с даты кампании', day: 'Прошёл день', week: 'Прошла неделя', month: 'Прошёл месяц', undo: 'Отменить',
      todo: 'Что теперь нужно сделать', nothing: 'По дате дел нет.', open: 'Открыть', skip: 'Не сейчас', catchup: 'Догнать', campaign: 'Кампания',
      invalid: 'Данные календаря не распознаны.', reset: 'Начать заново', resetAsk: 'Стереть данные календаря этого персонажа? Другие данные листа не изменятся.', yes: 'Да, стереть', cancel: 'Отмена',
      stale: 'Данные изменились. Повторите действие.', range: 'Дата вне диапазона.', badDate: 'Введите дату от 1900-01-01 до 9999-12-31.', toGame: 'К дате игры',
      gameDate: 'Дата игры', gameDateOff: 'Дата игры не задана.', dueN: 'дел', moved: 'Дата игры', todoWord: 'Дела', noTodo: 'дел нет', started: 'Дата игры задана', undone: 'Дата игры возвращена', caught: 'Дата игры догнала кампанию',
      livingW: 'жильё', healW: 'отдых', therapyW: 'терапия', hustleW: 'заработок', drugsW: 'вещества', drugYearW: 'год после терапии', makerW: 'проект', daysShort: 'дн.', weeksShort: 'нед.', monthsShort: 'мес.',
      living: 'Жильё и образ жизни не оплачены', toPay: 'к оплате за', grace: 'Отсрочка в неделю прошла: пока образ жизни не оплачен, в начале каждого дня — Death Save (стр. 378).',
      heal: 'Отдых', upTo: 'до', healBy: 'BODY', healTimes: 'дни', therapyOne: 'Неделя терапии доступна', therapyMany: 'Недель терапии доступно', addiction: 'зависимость',
      hustle: 'Свободная неделя: можно бросить заработок', drugLeft: 'осталось', drugPassed: 'прошло', hoursShort: 'ч', yearEnded: 'Год после терапии', yearEnd2: 'истёк', yearMark: 'отметьте',
      project: 'Проект', ready: 'готов с', finish: 'завершите',
      campTitle: 'ДАТА КАМПАНИИ', chars: 'Персонажи', noDate: 'не задана', noChars: 'на этом устройстве нет листов из состава', campStart: 'Задать',
      campAsk: (date, names) => `Перевести дату кампании на ${date}? ${names ? `Листы на этом устройстве (${names}) получат эту дату` : 'Листов из состава кампании на этом устройстве нет'}; оплату и лечение каждый игрок подтверждает сам.`,
      campDone: (date, n) => `Дата кампании ${date}. Обновлено листов: ${n}.`, campSet: date => `Дата кампании ${date}.`, confirm: 'Перевести', rows: 'Строки',
    },
    en: {
      title: 'Game date', head: 'GAME DATE', date: 'Date', none: 'No game date yet. Set one and the app will suggest what is due: rent, rest, therapy, hustle.',
      startFrom: 'Start from', startCamp: 'Start from the campaign date', day: 'A day passed', week: 'A week passed', month: 'A month passed', undo: 'Undo',
      todo: 'What is due now', nothing: 'Nothing is due by the date.', open: 'Open', skip: 'Not now', catchup: 'Catch up', campaign: 'Campaign',
      invalid: 'The calendar data is not recognised.', reset: 'Start over', resetAsk: "Erase this character's calendar data? Nothing else on the sheet changes.", yes: 'Yes, erase', cancel: 'Cancel',
      stale: 'Data changed. Please retry.', range: 'Date out of range.', badDate: 'Enter a date from 1900-01-01 to 9999-12-31.', toGame: 'Game date',
      gameDate: 'Game date', gameDateOff: 'Game date is not set.', dueN: 'due', moved: 'Game date', todoWord: 'Due', noTodo: 'nothing due', started: 'Game date set', undone: 'Game date restored', caught: 'Game date caught up with the campaign',
      livingW: 'rent', healW: 'rest', therapyW: 'therapy', hustleW: 'hustle', drugsW: 'substances', drugYearW: 'year after therapy', makerW: 'project', daysShort: 'd', weeksShort: 'wk', monthsShort: 'mo',
      living: 'Lifestyle and housing are not paid', toPay: 'due for', grace: 'The one-week grace is over: while lifestyle is unpaid, make a Death Save at the start of each day (p. 378).',
      heal: 'Rest', upTo: 'up to', healBy: 'BODY', healTimes: 'days', therapyOne: 'A week of therapy is available', therapyMany: 'Weeks of therapy available', addiction: 'addiction',
      hustle: 'A free week: you can roll a hustle', drugLeft: 'left', drugPassed: 'passed', hoursShort: 'h', yearEnded: 'Year after therapy', yearEnd2: 'ended', yearMark: 'mark it',
      project: 'Project', ready: 'ready since', finish: 'finish it',
      campTitle: 'CAMPAIGN DATE', chars: 'Characters', noDate: 'not set', noChars: 'no sheets of the roster on this device', campStart: 'Set',
      campAsk: (date, names) => `Move the campaign date to ${date}? ${names ? `Sheets on this device (${names}) get this date` : 'No roster sheets are on this device'}; each player confirms payments and healing.`,
      campDone: (date, n) => `Campaign date ${date}. Sheets updated: ${n}.`, campSet: date => `Campaign date ${date}.`, confirm: 'Move', rows: 'Rows',
    },
  };
  const tx = lang => T[lang === 'en' ? 'en' : 'ru'];
  const esc = x => String(x ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const isObj = x => !!x && typeof x === 'object' && !Array.isArray(x);
  const pad = (n, w = 2) => String(n).padStart(w, '0');

  // ---- Dates (UTC, strings in and out) ---------------------------------------------------------------------------
  const leap = y => y % 4 === 0 && (y % 100 !== 0 || y % 400 === 0);
  const dim = (y, m) => [31, leap(y) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][m - 1];
  function parse(s) {
    if (typeof s !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
    const y = Number(s.slice(0, 4)), m = Number(s.slice(5, 7)), d = Number(s.slice(8, 10));
    if (y < 1900 || y > 9999 || m < 1 || m > 12 || d < 1 || d > dim(y, m)) return null;
    return { y, m, d };
  }
  const str = (y, m, d) => `${pad(y, 4)}-${pad(m)}-${pad(d)}`;
  function addDays(s, n) {
    const p = parse(s);
    if (!p || !Number.isInteger(n)) return '';
    const t = new Date(Date.UTC(p.y, p.m - 1, p.d) + n * 86400000);
    const y = t.getUTCFullYear();
    return y < 1900 || y > 9999 ? '' : str(y, t.getUTCMonth() + 1, t.getUTCDate());
  }
  function addMonths(s, n) {
    const p = parse(s);
    if (!p || !Number.isInteger(n)) return '';
    const total = p.y * 12 + (p.m - 1) + n, y = Math.floor(total / 12), m = total - y * 12 + 1;
    if (y < 1900 || y > 9999) return '';
    return str(y, m, Math.min(p.d, dim(y, m)));
  }
  function diffDays(a, b) {
    const x = parse(a), y = parse(b);
    if (!x || !y) return null;
    return Math.round((Date.UTC(y.y, y.m - 1, y.d) - Date.UTC(x.y, x.m - 1, x.d)) / 86400000);
  }
  const validMonth = s => typeof s === 'string' && /^\d{4}-\d{2}$/.test(s) && !!parse(s + '-01');
  const month = s => (parse(s) ? s.slice(0, 7) : '');
  function monthsBetween(p, q) {
    if (!validMonth(p) || !validMonth(q)) return null;
    return (Number(q.slice(0, 4)) * 12 + Number(q.slice(5))) - (Number(p.slice(0, 4)) * 12 + Number(p.slice(5)));
  }
  function format(s, lang) {
    const p = parse(s);
    if (!p) return '';
    return lang === 'en' ? s : `${pad(p.d)}.${pad(p.m)}.${pad(p.y, 4)}`;
  }

  // ---- State (pure) -----------------------------------------------------------------------------------------------
  // -> { kind: 'off' | 'invalid' | 'ok', value }
  function read(c) {
    const x = c?.extra;
    if (x === undefined || x === null) return { kind: 'off' };
    if (!isObj(x)) return { kind: 'invalid' };
    const cal = x.calendar;
    if (cal === undefined) return { kind: 'off' };
    if (!isObj(cal) || cal.version !== 1 || !parse(cal.date)) return { kind: 'invalid' };
    if (cal.marks !== undefined) {
      if (!isObj(cal.marks)) return { kind: 'invalid' };
      for (const k of Object.keys(cal.marks)) {
        if (!KEYS.includes(k) && !drugKey(k)) continue;
        const v = cal.marks[k];
        if (v === undefined) continue;
        if (isMonthKey(k) ? !validMonth(v) || v > month(cal.date) : !parse(v) || v > cal.date) return { kind: 'invalid' };
      }
    }
    return { kind: 'ok', value: cal };
  }
  const dateOf = c => { const r = read(c); return r.kind === 'ok' ? r.value.date : ''; };
  const markOf = (cal, key) => cal.marks?.[key] ?? (key === 'living' ? month(cal.date) : cal.date);
  // Every active drug has its own mark (marks['drug:<key>']); a drug without one counts from marks.drugs.
  const drugMark = (cal, key) => cal.marks?.['drug:' + key] ?? markOf(cal, 'drugs');

  function start(date) {
    if (!parse(date)) return null;
    return { version: 1, date, marks: { heal: date, hustle: date, therapy: date, drugs: date, living: month(date) } };
  }

  const probe = fn => { try { return fn(); } catch { return undefined; } };

  // What each kind of reminder needs right now. Anything unreadable counts as "not eligible".
  function healInfo(c) {
    const M = window.MedicalTools;
    if (!M?.patientInfo || !M?.medical) return null;
    const info = probe(() => M.patientInfo(c)), m = probe(() => M.medical(c)), dead = c?.extra?.deathRecord?.dead === true;
    if (!info || !m || m.stabilized !== true || dead || info.hp < 1 || info.hp >= info.max || info.hp < m.stabilizedHp) return null;
    return info;
  }
  function therapyInfo(c) {
    const human = probe(() => window.TherapyTools?.humanInfo?.(c));
    const loss = human && human.humanity < human.max ? human : null;
    const drugs = probe(() => window.DrugTools?.state?.(c)), D = window.DrugTools?.DRUGS || {};
    const addicted = [];
    if (drugs?.kind === 'ok') for (const k of Object.keys(D)) if (Object.hasOwn(drugs.value.records, k) && drugs.value.records[k].addicted === true) addicted.push(k);
    return loss || addicted.length ? { human: loss, addicted } : null;
  }
  function activeDrugs(c) {
    const drugs = probe(() => window.DrugTools?.state?.(c)), D = window.DrugTools?.DRUGS || {}, out = [];
    if (drugs?.kind === 'ok') for (const k of Object.keys(D)) { const r = Object.hasOwn(drugs.value.records, k) ? drugs.value.records[k] : null; if (r && r.status === 'active') out.push({ key: k, name: D[k].name, remaining: r.remainingHours }); }
    return out;
  }
  const hustleRoles = c => { const r = probe(() => window.HustleTools?.roleOptions?.(c)); return Array.isArray(r) && r.length ? r : null; };

  // Marks of items that are not eligible right now move to the date, so days spent unwounded do not pile up.
  function follow(cal, c) {
    const marks = { ...(cal.marks || {}) };
    if (!healInfo(c)) marks.heal = cal.date;
    if (!therapyInfo(c)) marks.therapy = cal.date;
    const live = activeDrugs(c).map(d => 'drug:' + d.key);
    if (!live.length) marks.drugs = cal.date;
    for (const k of Object.keys(marks)) if (drugKey(k) && !live.includes(k)) delete marks[k];
    if (!hustleRoles(c)) marks.hustle = cal.date;
    return { ...cal, marks };
  }
  function setDate(cal, date, c) {
    if (!isObj(cal) || !parse(date) || !parse(cal.date)) return null;
    if (date >= cal.date) return follow({ ...cal, date, marks: { ...(cal.marks || {}) } }, c);
    const marks = { ...(cal.marks || {}) };
    for (const k of Object.keys(marks)) {
      if (!KEYS.includes(k) && !drugKey(k)) continue;
      const lim = isMonthKey(k) ? month(date) : date;
      if (marks[k] !== undefined && marks[k] > lim) marks[k] = lim;
    }
    return { ...cal, date, marks };
  }
  function advance(cal, step, c) {
    if (!isObj(cal) || !parse(cal.date)) return null;
    const next = step === 'day' ? addDays(cal.date, 1) : step === 'week' ? addDays(cal.date, 7) : step === 'month' ? addMonths(cal.date, 1) : '';
    return next ? setDate(cal, next, c) : null;
  }

  // ---- Due items (computed, never stored) -------------------------------------------------------------------------
  const fmtMoney = n => (window.Wallet?.format ? window.Wallet.format(n) : String(n));
  function due(c, opts) {
    const r = read(c), lang = opts?.lang === 'en' ? 'en' : 'ru', t = tx(lang), f = s => format(s, lang);
    if (r.kind !== 'ok') return [];
    const cal = r.value, date = cal.date, out = [];

    // rent and lifestyle
    probe(() => {
      const L = window.LifestyleTools, v = L?.view?.(c), cur = month(date);
      if (!v || !v.period || v.period > cur || !Array.isArray(v.due) || !v.due.length) return;
      const behind = monthsBetween(v.period, cur) + 1;
      const span = behind > 1 ? `${v.period} … ${cur} (${behind} ${t.monthsShort})` : v.period;
      // "Not now" only snoozes the row for the current month; the unpaid months and the warning stay.
      if (cal.marks?.livingSnooze !== cur) out.push({ key: 'living', kind: 'living', period: v.period, months: behind, total: v.total, skippable: true, text: `${t.living}: ${span}, ${t.toPay} ${v.period}: ${fmtMoney(v.total)} eb` });
      if (v.due.includes('life') && date >= v.period + '-08') out.push({ key: 'living-grace', kind: 'grace', warning: true, skippable: false, text: t.grace });
    });

    // natural healing
    probe(() => {
      const info = healInfo(c), mark = markOf(cal, 'heal'), days = diffDays(mark, date);
      if (!info || !(days >= 1)) return;
      const capped = Math.min(days, 3650), gain = Math.min(info.max - info.hp, info.body * capped);
      out.push({ key: 'heal', kind: 'heal', days: capped, mark, skippable: true, text: `${t.heal}: ${capped} ${t.daysShort} — ${t.upTo} +${gain} HP (${t.healBy} ${info.body} × ${t.healTimes}), HP ${info.hp} / ${info.max}` });
    });

    // therapy
    probe(() => {
      const info = therapyInfo(c), weeks = Math.floor((diffDays(markOf(cal, 'therapy'), date) ?? 0) / 7);
      if (!info || weeks < 1) return;
      const D = window.DrugTools?.DRUGS || {}, parts = [];
      if (info.human) parts.push(`Humanity ${info.human.humanity} / ${info.human.max}`);
      if (info.addicted.length) parts.push(`${t.addiction}: ${info.addicted.map(k => D[k]?.name || k).join(', ')}`);
      out.push({ key: 'therapy', kind: 'therapy', weeks, skippable: true, text: `${weeks > 1 ? `${t.therapyMany}: ${weeks}` : t.therapyOne} (${parts.join('; ')})` });
    });

    // hustle
    probe(() => {
      const weeks = Math.floor((diffDays(markOf(cal, 'hustle'), date) ?? 0) / 7);
      if (!hustleRoles(c) || weeks < 1) return;
      out.push({ key: 'hustle', kind: 'hustle', weeks, skippable: true, text: `${t.hustle} (${weeks} ${t.weeksShort})` });
    });

    // drugs: 24 hours per day
    probe(() => {
      for (const d of activeDrugs(c)) {
        const days = diffDays(drugMark(cal, d.key), date);
        if (!(days >= 1)) continue;
        const hours = days * 24;
        out.push({ key: 'drugs:' + d.key, kind: 'drugs', drug: d.key, hours: Math.min(d.remaining, hours), elapsed: hours, skippable: true, text: `${d.name}: ${t.drugLeft} ${d.remaining} ${t.hoursShort}; ${t.drugPassed} ${hours} ${t.hoursShort}` });
      }
    });

    // the year after addiction therapy
    probe(() => {
      const drugs = window.DrugTools?.state?.(c), D = window.DrugTools?.DRUGS || {};
      if (drugs?.kind !== 'ok') return;
      for (const k of Object.keys(D)) {
        const rec = Object.hasOwn(drugs.value.records, k) ? drugs.value.records[k] : null;
        if (!rec || rec.yearVulnerability !== true) continue;
        const y = window.DrugTools.therapyYear(rec);
        if (y.kind === 'dated' && y.end <= date) out.push({ key: 'drug-year:' + k, kind: 'drug-year', drug: k, skippable: false, text: `${t.yearEnded} (${D[k].name}) ${t.yearEnd2} ${f(y.end)} — ${t.yearMark}` });
      }
    });

    // Maker projects that passed their check and whose time is up
    probe(() => {
      const s = window.MakerProjects?.state?.(c);
      if (s?.kind !== 'ok') return;
      for (const p of s.value.projects) if (p && p.status === 'passed' && !p.delivered && parse(p.readyOn) && p.readyOn <= date) out.push({ key: 'maker:' + p.id, kind: 'maker', id: p.id, skippable: false, text: `${t.project} «${p.name}» ${t.ready} ${f(p.readyOn)} — ${t.finish}` });
    });
    return out;
  }

  // When a Maker project is ready: '' with no calendar. Plan is CraftingTools.plan(): { unit, amount, price }.
  function readyOn(c, plan) {
    const r = read(c);
    if (r.kind !== 'ok' || !isObj(plan)) return '';
    const date = r.value.date, n = Number(plan.amount) || 0;
    switch (plan.unit) {
      case 'hour': return date;
      case 'day': return addDays(date, n);
      case 'week': return addDays(date, 7 * n);
      case 'month': return addMonths(date, n);
      case 'per10000': return Number.isFinite(Number(plan.price)) && plan.price > 0 ? addMonths(date, Math.ceil(plan.price / 10000)) : '';
      default: return '';
    }
  }

  function campaignOf(c, campaigns) {
    if (!c || !Array.isArray(campaigns)) return null;
    let best = null;
    for (const k of campaigns) {
      if (!isObj(k) || !parse(k.gameDate) || !Array.isArray(k.roster)) continue;
      if (!k.roster.some(r => isObj(r) && r.kind === 'pc' && r.characterId === c.id)) continue;
      if (!best || k.gameDate > best.gameDate) best = k;
    }
    return best;
  }

  // ---- Thin mutators: only c.extra.calendar --------------------------------------------------------------------------
  function write(c, cal) {
    if (!c || typeof c !== 'object') return false;
    if (c.extra === undefined || c.extra === null) c.extra = {};
    if (!isObj(c.extra)) return false;
    c.extra.calendar = cal;
    return true;
  }
  function consume(c, key, days) {
    const r = read(c);
    if (r.kind !== 'ok' || !isObj(c.extra) || !(['heal', 'hustle', 'therapy', 'drugs'].includes(key) || drugKey(key))) return false;
    const n = Math.trunc(Number(days));
    if (!Number.isFinite(n) || n < 1) return false;
    const cal = r.value, moved = addDays(drugKey(key) ? drugMark(cal, key.slice(5)) : markOf(cal, key), n), next = !moved || moved > cal.date ? cal.date : moved;
    return write(c, { ...cal, marks: { ...(cal.marks || {}), [key]: next } });
  }
  function skip(c, key) {
    const r = read(c);
    const dk = typeof key === 'string' && key.startsWith('drugs:') ? 'drug:' + key.slice(6) : '';
    if (r.kind !== 'ok' || !isObj(c.extra) || !(SKIPPABLE.includes(key) || drugKey(dk))) return false;
    const mk = key === 'living' ? 'livingSnooze' : dk || key;
    return write(c, { ...r.value, marks: { ...(r.value.marks || {}), [mk]: mk === 'livingSnooze' ? month(r.value.date) : r.value.date } });
  }
  // A drug that just became active counts from today, whatever other drugs are running.
  function touchDrug(c, key) {
    const r = read(c);
    if (r.kind !== 'ok' || !isObj(c.extra) || !drugKey('drug:' + key)) return false;
    return write(c, { ...r.value, marks: { ...(r.value.marks || {}), ['drug:' + key]: r.value.date } });
  }
  // A sheet that has no date gets this one (no backlog); an earlier date moves forward; a later date stays.
  function catchUp(c, date) {
    if (!parse(date) || !c || typeof c !== 'object' || (c.extra !== undefined && c.extra !== null && !isObj(c.extra))) return false;
    const r = read(c);
    if (r.kind === 'invalid') return false;
    if (r.kind === 'off') return write(c, start(date));
    if (r.value.date >= date) return false;
    return write(c, setDate(r.value, date, c));
  }

  // ---- Sheet card ---------------------------------------------------------------------------------------------------
  function short(c, lang) {
    const r = read(c);
    if (r.kind !== 'ok') return '';
    const n = due(c, { lang }).filter(x => !x.warning).length;
    return format(r.value.date, lang) + (n ? ' · ' + n : '');
  }
  function sessionLine(c, lang) {
    const t = tx(lang), r = read(c);
    if (r.kind === 'invalid') return t.invalid;
    if (r.kind === 'off') return t.gameDateOff;
    const n = due(c, { lang }).filter(x => !x.warning).length;
    return `${t.gameDate} ${format(r.value.date, lang)}${n ? ` · ${t.dueN}: ${n}` : ''}.`;
  }

  let lastUndo = null; // { id, before, after, until } — in memory only
  let resetAsk = null; // character id waiting for the second tap
  const canUndo = c => !!lastUndo && !!c && lastUndo.id === c.id && Date.now() < lastUndo.until && JSON.stringify(read(c).value) === lastUndo.after;

  function render(c, lang, campaigns) {
    if (!c || typeof c !== 'object') return '';
    const t = tx(lang), r = read(c);
    const head = `<section class="card game-calendar" id="sheet-calendar" tabindex="-1" data-cal><div class="card-heading"><span>${esc(t.head)}</span></div>`;
    if (r.kind === 'invalid') {
      const ask = resetAsk === c.id;
      return head + `<p class="cal-warning" role="status">${esc(t.invalid)}</p>` + (ask
        ? `<p>${esc(t.resetAsk)}</p><div class="cal-actions"><button type="button" class="btn ghost" data-cal-reset="yes">${esc(t.yes)}</button><button type="button" class="btn ghost" data-cal-reset="no">${esc(t.cancel)}</button></div>`
        : `<div class="cal-actions"><button type="button" class="btn ghost" data-cal-reset="ask">${esc(t.reset)}</button></div>`) + '</section>';
    }
    const camp = campaignOf(c, campaigns);
    if (r.kind === 'off') {
      const base = camp ? camp.gameDate : DEFAULT_START, label = camp ? `${t.startCamp} «${camp.name || '—'}»: ${format(base, lang)}` : `${t.startFrom} ${format(base, lang)}`;
      return head + `<p>${esc(t.none)}</p><div class="cal-start"><label class="field">${esc(t.date)}<input type="date" data-cal-date min="1900-01-01" max="9999-12-31" value=""></label><button type="button" class="btn primary" data-cal-start="${esc(base)}">${esc(label)}</button></div></section>`;
    }
    const cal = r.value, items = due(c, { lang });
    let out = head + `<div class="cal-head"><label class="field">${esc(t.date)}<input type="date" data-cal-date min="1900-01-01" max="9999-12-31" value="${esc(cal.date)}"></label>`;
    out += `<div class="cal-steps"><button type="button" class="btn ghost" data-cal-step="day">${esc(t.day)}</button><button type="button" class="btn ghost" data-cal-step="week">${esc(t.week)}</button><button type="button" class="btn ghost" data-cal-step="month">${esc(t.month)}</button>`;
    if (canUndo(c)) out += `<button type="button" class="btn ghost cal-undo" data-cal-undo><span aria-hidden="true">↶</span> ${esc(t.undo)}</button>`;
    out += '</div></div>';
    if (camp && camp.gameDate > cal.date) out += `<p class="cal-camp">${esc(t.campaign)} «${esc(camp.name || '—')}»: ${esc(format(camp.gameDate, lang))} <button type="button" class="btn ghost" data-cal-catchup>${esc(t.catchup)}</button></p>`;
    out += `<h4 class="cal-sub">${esc(t.todo)}</h4>`;
    if (!items.length) return out + `<p class="cal-empty">${esc(t.nothing)}</p></section>`;
    out += '<div class="cal-due">' + items.map(x => `<p class="cal-row${x.warning ? ' cal-warning' : ''}" data-cal-row="${esc(x.key)}"><span class="cal-text">${esc(x.text)}</span>${x.warning ? '' : `<span class="cal-actions"><button type="button" class="btn ghost" data-cal-open="${esc(x.key)}">${esc(t.open)}</button>${x.skippable ? `<button type="button" class="btn ghost" data-cal-skip="${esc(x.key)}">${esc(t.skip)}</button>` : ''}</span>`}</p>`).join('') + '</div>';
    return out + '</section>';
  }

  // In-sheet jump: the downtime jump bar knows the tab of every section.
  function jump(id) {
    id = id || 'sheet-calendar';
    try {
      const d = document, b = d.querySelector('[data-hud-jump="' + id + '"]');
      if (b) { b.click(); return true; }
      const tabs = window.SheetTabs;
      if (tabs?.select && tabs?.owner) { const tab = tabs.owner(id); if (tab) tabs.select(tab, { scroll: false }); }
      const el = d.getElementById(id);
      el?.scrollIntoView?.({ block: 'start' });
      el?.focus?.({ preventScroll: true });
      return !!el;
    } catch { return false; }
  }
  const later = fn => { try { setTimeout(fn, 0); } catch { try { fn(); } catch { /* no DOM */ } } };

  function summary(items, lang) {
    const t = tx(lang), parts = [];
    for (const x of items) {
      if (x.warning) continue;
      if (x.kind === 'heal') parts.push(`${t.healW} ${x.days} ${t.daysShort}`);
      else if (x.kind === 'living') parts.push(t.livingW);
      else if (x.kind === 'therapy') parts.push(t.therapyW);
      else if (x.kind === 'hustle') parts.push(t.hustleW);
      else if (x.kind === 'drugs') { if (!parts.includes(t.drugsW)) parts.push(t.drugsW); }
      else if (x.kind === 'drug-year') parts.push(t.drugYearW);
      else if (x.kind === 'maker') parts.push(t.makerW);
    }
    return parts.length ? `${t.todoWord}: ${parts.join(', ')}.` : `${t.noTodo[0].toUpperCase() + t.noTodo.slice(1)}.`;
  }
  function moveText(from, to, lang) {
    const a = parse(from), b = parse(to);
    if (lang === 'en' || !a || !b || a.y !== b.y) return `${format(from, lang)} → ${format(to, lang)}`;
    return `${pad(a.d)}.${pad(a.m)} → ${format(to, lang)}`;
  }

  // -> { handled, dirty?, rerender?, notify? , go? }
  function handle(event, c, lang, options) {
    const type = event?.type, tg = event?.target;
    if (!tg || typeof tg.closest !== 'function' || (type !== 'click' && type !== 'change')) return { handled: false };
    const q = s => tg.closest(s);
    const t = tx(lang);
    let el = null, op = '';
    if (type === 'click') for (const o of ['step', 'start', 'undo', 'catchup', 'open', 'skip', 'reset']) { const b = q(`[data-cal-${o}]`); if (b) { el = b; op = o; break; } }
    else { const i = q('[data-cal-date]'); if (i) { el = i; op = 'date'; } }
    if (!el) return { handled: false };
    const current = () => { try { return !!c && typeof options?.isCurrent === 'function' && options.isCurrent(c) === true; } catch { return false; } };
    if (!current()) return { handled: true, notify: t.stale };
    if (op !== 'reset') resetAsk = null;
    const val = name => el.dataset?.['cal' + name[0].toUpperCase() + name.slice(1)];

    if (op === 'reset') {
      const a = val('reset');
      if (read(c).kind !== 'invalid') return { handled: true, rerender: true, notify: t.stale };
      if (a === 'ask') { resetAsk = c.id; return { handled: true, rerender: true }; }
      resetAsk = null;
      if (a === 'yes' && isObj(c.extra)) { delete c.extra.calendar; lastUndo = null; return { handled: true, dirty: true, rerender: true }; }
      return { handled: true, rerender: true };
    }
    if (op === 'start' || op === 'date') {
      const date = op === 'start' ? val('start') : String(el.value || '');
      if (!parse(date)) return { handled: true, rerender: true, notify: date ? t.badDate : undefined };
      const r = read(c);
      if (r.kind === 'invalid') return { handled: true, rerender: true, notify: t.invalid };
      if (r.kind === 'off') { if (!write(c, start(date))) return { handled: true, notify: t.stale }; lastUndo = null; return { handled: true, dirty: true, rerender: true, notify: `${t.started}: ${format(date, lang)}.` }; }
      if (date === r.value.date) return { handled: true };
      const next = setDate(r.value, date, c);
      if (!next || !write(c, next)) return { handled: true, rerender: true, notify: t.range };
      lastUndo = null;
      return { handled: true, dirty: true, rerender: true, notify: `${t.moved}: ${moveText(r.value.date, date, lang)}.` };
    }

    const r = read(c);
    if (r.kind !== 'ok') return { handled: true, rerender: true, notify: r.kind === 'invalid' ? t.invalid : t.stale };
    const cal = r.value;

    if (op === 'step') {
      if (Number(event.detail) > 1) return { handled: true }; // second click of a double click
      const next = advance(cal, val('step'), c);
      if (!next) return { handled: true, notify: t.range };
      write(c, next);
      lastUndo = { id: c.id, before: JSON.stringify(cal), after: JSON.stringify(next), until: Date.now() + UNDO_MS };
      return { handled: true, dirty: true, rerender: true, notify: `${t.moved}: ${moveText(cal.date, next.date, lang)}. ${summary(due(c, { lang }), lang)}` };
    }
    if (op === 'undo') {
      if (!canUndo(c) || !isObj(c.extra)) { lastUndo = null; return { handled: true, rerender: true, notify: t.stale }; }
      c.extra.calendar = JSON.parse(lastUndo.before);
      const back = c.extra.calendar.date; lastUndo = null;
      return { handled: true, dirty: true, rerender: true, notify: `${t.undone}: ${format(back, lang)}.` };
    }
    if (op === 'catchup') {
      const camp = campaignOf(c, options?.campaigns);
      if (!camp || !(camp.gameDate > cal.date)) return { handled: true, rerender: true, notify: t.stale };
      if (!catchUp(c, camp.gameDate)) return { handled: true, notify: t.range };
      lastUndo = { id: c.id, before: JSON.stringify(cal), after: JSON.stringify(read(c).value), until: Date.now() + UNDO_MS };
      return { handled: true, dirty: true, rerender: true, notify: `${t.caught}: ${format(camp.gameDate, lang)}.` };
    }

    // rows: always taken from a fresh computation, never from the page
    const key = val(op), item = due(c, { lang }).find(x => x.key === key);
    if (!item) return { handled: true, rerender: true, notify: t.stale };
    if (op === 'skip') {
      if (!item.skippable || !skip(c, key)) return { handled: true, notify: t.stale };
      lastUndo = null;
      return { handled: true, dirty: true, rerender: true };
    }
    // op === 'open'
    const fail = { handled: true, notify: t.stale };
    if (item.kind === 'living') {
      if (!window.LifestyleTools?.remember?.(c, { period: item.period })) return fail;
      later(() => jump('sheet-living'));
      return { handled: true, dirty: true, rerender: true };
    }
    if (item.kind === 'heal') {
      if (!window.MedicalTools?.prefill?.({ patient: c.id, days: item.days, restDate: item.mark })) return fail;
      return { handled: true, go: 'medical' };
    }
    if (item.kind === 'therapy') {
      if (!window.TherapyTools?.prefill?.({ patient: c.id, gameDate: cal.date })) return fail;
      return { handled: true, go: 'medical' };
    }
    if (item.kind === 'hustle') { later(() => jump('sheet-hustle')); return { handled: true }; }
    if (item.kind === 'drugs' || item.kind === 'drug-year') {
      const ok = item.kind === 'drugs'
        ? window.DrugTools?.prefill?.(c, { drug: item.drug, hours: String(item.hours) })
        : window.DrugTools?.prefill?.(c, { drug: item.drug, gameDate: cal.date });
      if (!ok) return fail;
      later(() => jump('sheet-drugs'));
      return { handled: true, rerender: true };
    }
    if (item.kind === 'maker') {
      window.MakerProjects?.select?.(c.id);
      return { handled: true, go: 'repair' };
    }
    return fail;
  }

  // ---- Campaign card ------------------------------------------------------------------------------------------------
  let campaignAsk = null; // { id, step }
  const pcRows = (campaign, characters) => (Array.isArray(campaign?.roster) ? campaign.roster : [])
    .filter(r => isObj(r) && r.kind === 'pc' && typeof r.characterId === 'string')
    .map(r => (Array.isArray(characters) ? characters.find(x => x && x.id === r.characterId) : null)).filter(Boolean);
  const stepDate = (date, step) => (step === 'day' ? addDays(date, 1) : step === 'week' ? addDays(date, 7) : step === 'month' ? addMonths(date, 1) : '');

  function campaignHTML(campaign, characters, lang) {
    if (!isObj(campaign) || typeof campaign.id !== 'string') return '';
    const t = tx(lang), date = parse(campaign.gameDate) ? campaign.gameDate : '', chars = pcRows(campaign, characters);
    let out = `<section class="card game-calendar" data-cal-campaign><div class="card-heading"><span>${esc(t.campTitle)}</span></div>`;
    out += `<label class="field">${esc(t.date)}<input type="date" data-cal-cdate min="1900-01-01" max="9999-12-31" value="${esc(date)}"></label>`;
    if (!date) {
      const known = chars.map(dateOf).filter(Boolean).sort().pop() || DEFAULT_START;
      out += `<div class="cal-actions"><button type="button" class="btn primary" data-cal-cstart="${esc(known)}">${esc(t.campStart)} ${esc(format(known, lang))}</button></div>`;
    } else {
      out += `<div class="cal-steps"><button type="button" class="btn ghost" data-cal-cstep="day">${esc(t.day)}</button><button type="button" class="btn ghost" data-cal-cstep="week">${esc(t.week)}</button><button type="button" class="btn ghost" data-cal-cstep="month">${esc(t.month)}</button></div>`;
      if (campaignAsk && campaignAsk.id === campaign.id) {
        const next = stepDate(date, campaignAsk.step);
        if (next) out += `<p class="cal-ask" role="status">${esc(t.campAsk(format(next, lang), chars.map(x => x.name || '—').join(', ')))}</p><div class="cal-actions"><button type="button" class="btn primary" data-cal-cconfirm>${esc(t.confirm)} ${esc(format(next, lang))}</button><button type="button" class="btn ghost" data-cal-ccancel>${esc(t.cancel)}</button></div>`;
      }
    }
    out += `<p class="cal-chars">${esc(t.chars)}: ${chars.length ? chars.map(x => `${esc(x.name || '—')} ${dateOf(x) ? esc(format(dateOf(x), lang)) : '— ' + esc(t.noDate)}`).join(' · ') : '—'}</p></section>`;
    return out;
  }
  const ownsCampaign = e => { try { return !!e?.target?.closest?.('[data-cal-campaign]'); } catch { return false; } };

  // -> { dirty, rerender, notify }
  function handleCampaign(e, campaign, ctx) {
    const t = tx(ctx?.lang), tg = e?.target, none = { dirty: false, rerender: false };
    if (!tg?.closest || !isObj(campaign)) return none;
    const type = e.type, q = s => tg.closest(s);
    if (type === 'change') {
      const i = q('[data-cal-cdate]');
      if (!i) return none;
      campaignAsk = null;
      const v = String(i.value || '');
      if (!parse(v)) return { dirty: false, rerender: true, notify: v ? t.badDate : undefined };
      campaign.gameDate = v;
      return { dirty: true, rerender: true, notify: t.campSet(format(v, ctx?.lang)) };
    }
    if (type !== 'click') return none;
    const start0 = q('[data-cal-cstart]'), stepB = q('[data-cal-cstep]'), yes = q('[data-cal-cconfirm]'), no = q('[data-cal-ccancel]');
    if (start0) {
      const v = start0.dataset?.calCstart;
      if (!parse(v)) return none;
      campaign.gameDate = v; campaignAsk = null;
      return { dirty: true, rerender: true, notify: t.campSet(format(v, ctx?.lang)) };
    }
    if (stepB) {
      const step = stepB.dataset?.calCstep;
      if (!parse(campaign.gameDate)) return { dirty: false, rerender: true };
      if (!stepDate(campaign.gameDate, step)) return { dirty: false, rerender: false, notify: t.range };
      campaignAsk = { id: campaign.id, step };
      return { dirty: false, rerender: true };
    }
    if (no) { campaignAsk = null; return { dirty: false, rerender: true }; }
    if (yes) {
      const ask = campaignAsk; campaignAsk = null;
      if (!ask || ask.id !== campaign.id || !parse(campaign.gameDate)) return { dirty: false, rerender: true, notify: t.stale };
      const next = stepDate(campaign.gameDate, ask.step);
      if (!next) return { dirty: false, rerender: true, notify: t.range };
      campaign.gameDate = next;
      let n = 0;
      for (const ch of pcRows(campaign, ctx?.characters)) { catchUp(ch, next); if (dateOf(ch) >= next) n++; }
      return { dirty: true, rerender: true, notify: t.campDone(format(next, ctx?.lang), n) };
    }
    return none;
  }

  window.GameCalendar = {
    parse, addDays, addMonths, diffDays, month, monthsBetween, format,
    read, dateOf, start, follow, setDate, advance, due, readyOn, campaignOf,
    consume, skip, catchUp, touchDrug,
    short, sessionLine, render, handle, jump, campaignHTML, ownsCampaign, handleCampaign,
  };
})();
