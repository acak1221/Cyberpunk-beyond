// Money on the sheet: the chip in the HUD, the row on the «Снаряжение» tab, the «next step: buy gear»
// banner and the wallet panel (got / spent, exact amount, give to another character, split a payout).
//
// Three layers:
//   1. pure helpers   - what a typed amount means, what to show, staged wallet operations;
//   2. HTML builders  - chip, row, banner and panel as strings;
//   3. a controller   - one panel appended to <body>, driven by document-level listeners.
//
// Cash is only ever changed through window.Wallet (wallet.js): every operation here stages a new `extra`
// with Wallet.change/earn/spend/transfer and assigns it in one step, then saves through window.App.
(function () {
  'use strict';

  const BUDGETS = ['gearBudget', 'fashionBudget'];
  const QUICK = [10, 50, 100, 500, 1000];
  const MAX = 999999999;

  const S = {
    ru: {
      money: 'Деньги', wallet: 'Кошелёк', open: 'Открыть кошелёк', close: 'Закрыть',
      gearBudget: 'Стартовое снаряжение', fashionBudget: 'Стартовая одежда',
      gearShort: 'старт', fashionShort: 'одежда',
      change: '＋ / − Деньги', budgetsNote: 'Стартовые бюджеты тратятся в каталоге. Остаток бюджета снаряжения станет деньгами, когда вы завершите стартовые закупки.',
      amount: 'Сумма, eb', note: 'За что (необязательно)', notePlaceholder: 'работа, взятка, патроны…',
      earn: '＋ Получил', spend: '− Потратил',
      setTitle: 'Указать точную сумму', setLabel: 'Сколько денег сейчас, eb', setDo: 'Записать',
      giveTitle: 'Передать другому персонажу', giveTo: 'Кому', giveDo: 'Передать', giveNone: 'На этом устройстве нет других персонажей.',
      splitTitle: 'Разделить выплату на группу', splitAmount: 'Вся выплата, eb', splitWho: 'Кто получает', splitDo: 'Раздать',
      splitEach: (each, n, rest) => `По ${each} eb × ${n}${rest ? `, остаток ${rest} eb никому не записан` : ''}`,
      splitHint: 'Введите сумму и отметьте получателей.',
      log: 'История', logEmpty: 'Пока пусто. Здесь появится всё, что вы получили и потратили.',
      undo: 'Отменить', undone: 'Отменено.', undoNote: 'Отмена',
      noteSet: 'Исправление суммы', noteField: 'Изменено на листе', noteGiveTo: name => `Передано: ${name}`, noteGiveFrom: name => `Получено от: ${name}`, noteSplit: 'Доля выплаты', noteShop: 'Покупка в каталоге',
      earned: (n, left) => `Получено ${n} eb. Теперь ${left} eb.`, spent: (n, left) => `Потрачено ${n} eb. Осталось ${left} eb.`,
      setDone: left => `Записано: ${left} eb.`, same: 'Сумма не изменилась.',
      gave: (n, name, left) => `Передано ${n} eb: ${name}. У вас осталось ${left} eb.`,
      splitDone: (each, n, rest) => `Роздано по ${each} eb × ${n}.${rest ? ` Остаток ${rest} eb никому не записан.` : ''}`,
      short: (need, have) => `Не хватает ${need} eb: сейчас ${have} eb. Ничего не списано.`,
      invalid: 'Введите целую сумму больше нуля.', invalidSet: 'Введите целое число от 0 до 999 999 999.', tooMuch: 'Слишком большая сумма.',
      pick: 'Выберите получателя.', pickSome: 'Отметьте хотя бы одного получателя.', splitSmall: 'Сумма меньше числа получателей — делить нечего.',
      gone: 'Персонаж не найден. Откройте лист ещё раз.',
      fieldKept: have => `Сумма не изменена (${have} eb). Введите целое число от 0, либо «+500» или «-200», чтобы прибавить или вычесть.`,
      budgetKept: have => `Бюджет не изменён (${have} eb): введите целое число от 0.`,
      nextTitle: 'Следующий шаг: купите снаряжение',
      nextText: parts => `У вас ${parts}. Оружия и брони пока нет.`,
      nextGear: n => `${n} eb на снаряжение`, nextFashion: n => `${n} eb на одежду`,
      nextBuy: 'Купить в каталоге', nextHide: 'Скрыть'
    },
    en: {
      money: 'Money', wallet: 'Wallet', open: 'Open the wallet', close: 'Close',
      gearBudget: 'Starting gear', fashionBudget: 'Starting fashion',
      gearShort: 'start', fashionShort: 'fashion',
      change: '＋ / − Money', budgetsNote: 'Starting budgets are spent in the catalog. What is left of the gear budget becomes money when you finish the starting purchases.',
      amount: 'Amount, eb', note: 'What for (optional)', notePlaceholder: 'job, bribe, ammo…',
      earn: '＋ Got', spend: '− Spent',
      setTitle: 'Set the exact amount', setLabel: 'Money right now, eb', setDo: 'Save',
      giveTitle: 'Give to another character', giveTo: 'To', giveDo: 'Give', giveNone: 'There are no other characters on this device.',
      splitTitle: 'Split a payout between the party', splitAmount: 'Whole payout, eb', splitWho: 'Who gets a share', splitDo: 'Pay out',
      splitEach: (each, n, rest) => `${each} eb × ${n}${rest ? `, ${rest} eb left over and given to nobody` : ''}`,
      splitHint: 'Enter the sum and tick who gets a share.',
      log: 'History', logEmpty: 'Nothing yet. Everything you get and spend will show up here.',
      undo: 'Undo', undone: 'Undone.', undoNote: 'Undo',
      noteSet: 'Amount corrected', noteField: 'Changed on the sheet', noteGiveTo: name => `Given to: ${name}`, noteGiveFrom: name => `Received from: ${name}`, noteSplit: 'Share of a payout', noteShop: 'Catalog purchase',
      earned: (n, left) => `Got ${n} eb. Now ${left} eb.`, spent: (n, left) => `Spent ${n} eb. ${left} eb left.`,
      setDone: left => `Saved: ${left} eb.`, same: 'The amount did not change.',
      gave: (n, name, left) => `Gave ${n} eb to ${name}. You have ${left} eb left.`,
      splitDone: (each, n, rest) => `Paid out ${each} eb × ${n}.${rest ? ` ${rest} eb left over and given to nobody.` : ''}`,
      short: (need, have) => `Short by ${need} eb: you have ${have} eb. Nothing was spent.`,
      invalid: 'Enter a whole amount above zero.', invalidSet: 'Enter a whole number from 0 to 999,999,999.', tooMuch: 'The amount is too large.',
      pick: 'Choose who gets the money.', pickSome: 'Tick at least one character.', splitSmall: 'The sum is smaller than the number of people — nothing to split.',
      gone: 'Character not found. Open the sheet again.',
      fieldKept: have => `The amount was not changed (${have} eb). Enter a whole number from 0, or “+500” / “-200” to add or subtract.`,
      budgetKept: have => `The budget was not changed (${have} eb): enter a whole number from 0.`,
      nextTitle: 'Next step: buy your gear',
      nextText: parts => `You have ${parts}. No weapons or armor yet.`,
      nextGear: n => `${n} eb for gear`, nextFashion: n => `${n} eb for fashion`,
      nextBuy: 'Buy from the catalog', nextHide: 'Hide'
    }
  };
  const L = lang => (lang === 'en' ? 'en' : 'ru');
  const t = (lang, key, ...args) => { const v = S[L(lang)][key]; return typeof v === 'function' ? v(...args) : v; };
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const W = () => window.Wallet;
  const fmt = n => (W()?.format ? W().format(n) : String(n));

  // ---------- 1. Pure helpers ----------

  const whole = v => { const n = Math.floor(Number(v)); return Number.isFinite(n) ? n : 0; };
  const cash = c => (W()?.cash ? W().cash(c) : Math.min(MAX, Math.max(0, whole(c?.extra?.cash))));
  const budget = (c, key) => { const v = c?.extra?.[key]; return typeof v === 'number' && Number.isSafeInteger(v) && v > 0 ? v : 0; };
  const budgets = c => ({ gearBudget: budget(c, 'gearBudget'), fashionBudget: budget(c, 'fashionBudget') });

  // What a typed sum means: '500' sets, '+500' / '-200' add or subtract, anything else is refused.
  // -> { kind: 'set' | 'delta' | 'bad', value }
  function parseEntry(text) {
    const s = String(text ?? '').replace(/[\s\u00a0\u202f]/g, '').replace(/eb$/i, '');
    const m = /^([+\-\u2212\u2013])?(\d{1,9})$/.exec(s);
    if (!m) return { kind: 'bad', value: 0 };
    const n = Number(m[2]);
    return m[1] ? { kind: 'delta', value: m[1] === '+' ? n : -n } : { kind: 'set', value: n };
  }
  // A positive whole sum typed into an amount box, or 0 when it is not one.
  function parseAmount(text) { const p = parseEntry(text); return p.kind === 'set' && p.value > 0 ? p.value : 0; }

  // Does the character own anything to fight in? Weapons on the sheet or armor in the inventory.
  function armed(c) {
    const x = c?.extra || {};
    const weapons = Array.isArray(x.weapons) && x.weapons.some(w => w && typeof w === 'object');
    const armor = Array.isArray(x.items) && x.items.some(i => i && typeof i === 'object' && (i.category === 'armor' || String(i.catalogId || '').startsWith('armor-')));
    return weapons || armor;
  }
  // The banner after creation: shown while a starting budget is unspent and there is nothing to fight in.
  function nextStep(c) {
    const b = budgets(c);
    if (!c || c.extra?.moneyNextHidden === true || c.extra?.startingBudgetCompletion !== undefined) return null;
    if (!(b.gearBudget > 0) || armed(c)) return null;
    return b;
  }

  const failText = (lang, r, forSet) => r?.reason === 'short' ? t(lang, 'short', fmt(r.short), fmt(r.balance)) : r?.reason === 'max' ? t(lang, 'tooMuch') : t(lang, forSet ? 'invalidSet' : 'invalid');

  // Staged operations. Each returns { ok, changes:[{character, extra, delta}], text } or { ok:false, text };
  // nothing is assigned here.
  function opChange(c, delta, note, lang) {
    const r = W().change(c, delta, note);
    if (!r.ok) return { ok: false, text: failText(lang, r) };
    return { ok: true, changes: [{ character: c, extra: r.extra, delta: r.entry.delta }], text: delta > 0 ? t(lang, 'earned', fmt(delta), fmt(r.balance)) : t(lang, 'spent', fmt(-delta), fmt(r.balance)) };
  }
  function opSet(c, target, note, lang) {
    const p = parseEntry(target);
    if (p.kind !== 'set') return { ok: false, text: t(lang, 'invalidSet') };
    const now = cash(c);
    if (p.value === now && Number(c?.extra?.cash) === now) return { ok: false, same: true, text: t(lang, 'same') };
    if (p.value === now) return { ok: true, changes: [{ character: c, extra: { ...(c.extra || {}), cash: now }, delta: 0 }], text: t(lang, 'setDone', fmt(now)) };
    const r = W().change(c, p.value - now, note || t(lang, 'noteSet'));
    if (!r.ok) return { ok: false, text: failText(lang, r, true) };
    return { ok: true, changes: [{ character: c, extra: r.extra, delta: r.entry.delta }], text: t(lang, 'setDone', fmt(r.balance)) };
  }
  function opGive(from, to, amount, note, lang, nameOf) {
    if (!to || to === from) return { ok: false, text: t(lang, 'pick') };
    const n = parseAmount(amount);
    if (!n) return { ok: false, text: t(lang, 'invalid') };
    const out = W().spend(from, n, [t(lang, 'noteGiveTo', nameOf(to)), note].filter(Boolean).join(' · '));
    if (!out.ok) return { ok: false, text: failText(lang, out) };
    const into = W().earn(to, n, [t(lang, 'noteGiveFrom', nameOf(from)), note].filter(Boolean).join(' · '));
    if (!into.ok) return { ok: false, text: failText(lang, into) };
    return { ok: true, changes: [{ character: from, extra: out.extra, delta: -n }, { character: to, extra: into.extra, delta: n }], text: t(lang, 'gave', fmt(n), nameOf(to), fmt(out.balance)) };
  }
  function opSplit(people, amount, note, lang) {
    const n = parseAmount(amount);
    if (!n) return { ok: false, text: t(lang, 'invalid') };
    if (!people.length) return { ok: false, text: t(lang, 'pickSome') };
    const share = W().split(n, people.length);
    if (share.each < 1) return { ok: false, text: t(lang, 'splitSmall') };
    const changes = [];
    for (const c of people) {
      const r = W().earn(c, share.each, [t(lang, 'noteSplit'), note].filter(Boolean).join(' · '));
      if (!r.ok) return { ok: false, text: failText(lang, r) };
      changes.push({ character: c, extra: r.extra, delta: share.each });
    }
    return { ok: true, changes, text: t(lang, 'splitDone', fmt(share.each), people.length, share.rest) };
  }
  // Takes back what `changes` did, all or nothing.
  function opUndo(changes, lang) {
    const back = [];
    for (const ch of changes) {
      if (!ch.delta) continue;
      const r = W().change(ch.character, -ch.delta, t(lang, 'undoNote'));
      if (!r.ok) return { ok: false, text: failText(lang, r) };
      back.push({ character: ch.character, extra: r.extra, delta: -ch.delta });
    }
    return { ok: true, changes: back, text: t(lang, 'undone') };
  }

  // The sheet's own «Деньги» and starting budget fields. Garbage and negative numbers never wipe the value:
  // the field goes back to what is stored and the player is told why.
  // -> { value (what the field must show), dirty, extra? (assign to character.extra), notify? }
  function fieldEntry(c, key, text, lang) {
    if (key === 'cash') {
      const now = cash(c), p = parseEntry(text);
      if (p.kind === 'bad') return { value: String(now), dirty: false, notify: t(lang, 'fieldKept', fmt(now)) };
      if (p.kind === 'set') {
        const r = opSet(c, p.value, t(lang, 'noteField'), lang);
        return r.ok ? { value: String(p.value), dirty: true, extra: r.changes[0].extra, notify: r.text } : { value: String(now), dirty: false, ...(r.same ? {} : { notify: r.text }) };
      }
      if (p.value === 0) return { value: String(now), dirty: false };
      const r = opChange(c, p.value, t(lang, 'noteField'), lang);
      return r.ok ? { value: String(now + p.value), dirty: true, extra: r.changes[0].extra, notify: r.text } : { value: String(now), dirty: false, notify: r.text };
    }
    const stored = c?.extra?.[key], have = typeof stored === 'number' && Number.isSafeInteger(stored) && stored >= 0 ? stored : 0;
    const p = parseEntry(text);
    if (p.kind !== 'set') return { value: String(have), dirty: false, notify: t(lang, 'budgetKept', fmt(have)) };
    if (p.value === stored) return { value: String(have), dirty: false };
    return { value: String(p.value), dirty: true, extra: { ...(c.extra || {}), [key]: p.value } };
  }

  // ---------- 2. HTML builders ----------

  const budgetBits = (c, lang, short) => BUDGETS.filter(k => budgets(c)[k] > 0).map(k => `${esc(t(lang, short ? (k === 'gearBudget' ? 'gearShort' : 'fashionShort') : k))} ${fmt(budgets(c)[k])}${short ? '' : ' eb'}`);

  // The chip in the HUD beside HP / HUM / LUCK.
  function chipHTML(c, lang) {
    if (!c || !W()) return '';
    const extra = budgetBits(c, lang, true), label = `${t(lang, 'money')}: ${fmt(cash(c))} eb${BUDGETS.filter(k => budgets(c)[k] > 0).map(k => `, ${t(lang, k)} ${fmt(budgets(c)[k])} eb`).join('')}. ${t(lang, 'open')}`;
    return `<button type="button" class="hud-chip hud-money" data-money-open="${esc(c.id)}" aria-haspopup="dialog" aria-label="${esc(label)}" title="${esc(label)}"><span aria-hidden="true">€$</span><b>${fmt(cash(c))}</b><small>eb</small>${extra.length ? `<em>+ ${extra.join(' · ')}</em>` : ''}</button>`;
  }
  // The row on top of the «Снаряжение» tab.
  function rowHTML(c, lang) {
    if (!c || !W()) return '';
    const more = BUDGETS.filter(k => budgets(c)[k] > 0).map(k => `<span class="money-row-budget"><small>${esc(t(lang, k))}</small> <b>${fmt(budgets(c)[k])} eb</b></span>`).join('');
    return `<div class="money-row"><button type="button" class="money-row-cash" data-money-open="${esc(c.id)}" aria-haspopup="dialog" aria-label="${esc(t(lang, 'money'))}: ${fmt(cash(c))} eb. ${esc(t(lang, 'open'))}"><small>${esc(t(lang, 'money'))}</small> <b>${fmt(cash(c))} eb</b></button>${more}<button type="button" class="btn ghost money-row-change" data-money-open="${esc(c.id)}" aria-haspopup="dialog">${esc(t(lang, 'change'))}</button></div>`;
  }
  function nextStepHTML(c, lang) {
    const b = nextStep(c);
    if (!b) return '';
    const parts = [t(lang, 'nextGear', fmt(b.gearBudget)), b.fashionBudget > 0 ? t(lang, 'nextFashion', fmt(b.fashionBudget)) : ''].filter(Boolean).join(lang === 'en' ? ' and ' : ' и ');
    return `<div class="money-next" role="note"><div><strong>${esc(t(lang, 'nextTitle'))}</strong><p>${esc(t(lang, 'nextText', parts))}</p></div><div class="money-next-actions"><button type="button" class="btn primary" data-sheet-shop>${esc(t(lang, 'nextBuy'))} →</button><button type="button" class="btn ghost" data-money-next-hide="${esc(c.id)}">${esc(t(lang, 'nextHide'))}</button></div></div>`;
  }

  function stamp(at) {
    const d = new Date(at);
    if (!at || Number.isNaN(d.getTime())) return '';
    const p = n => String(n).padStart(2, '0');
    return `${p(d.getDate())}.${p(d.getMonth() + 1)} ${p(d.getHours())}:${p(d.getMinutes())}`;
  }
  function logHTML(c, lang) {
    const rows = W().log(c);
    if (!rows.length) return `<p class="money-empty">${esc(t(lang, 'logEmpty'))}</p>`;
    return `<ol class="money-log">${rows.map(e => `<li><b class="${e.delta < 0 ? 'is-out' : 'is-in'}">${e.delta < 0 ? '−' : '+'}${fmt(Math.abs(e.delta))}</b><span>${esc(e.note || '—')}</span><small>${esc(stamp(e.at))} · ${fmt(e.balance)} eb</small></li>`).join('')}</ol>`;
  }
  // view: { lang, character, others:[characters], nameOf, section:'set'|'give'|'split'|'', status:{text, ok, undo}, splitPick:Set(ids) }
  function panelHTML(view) {
    const lang = view.lang, c = view.character, nameOf = view.nameOf || (x => x.name || ''), others = view.others || [], sec = view.section || '';
    const b = budgets(c), st = view.status;
    const bud = BUDGETS.filter(k => b[k] > 0).map(k => `<span>${esc(t(lang, k))}: <b>${fmt(b[k])} eb</b></span>`).join('');
    const details = (id, title, body) => `<details class="money-sec" data-money-sec="${id}"${sec === id ? ' open' : ''}><summary>${esc(title)}</summary><div class="money-sec-body">${body}</div></details>`;
    const give = others.length
      ? `<label class="field">${esc(t(lang, 'giveTo'))}<select data-money-give-to><option value="">—</option>${others.map(o => `<option value="${esc(o.id)}">${esc(nameOf(o))} · ${fmt(cash(o))} eb</option>`).join('')}</select></label><label class="field">${esc(t(lang, 'amount'))}<input type="text" inputmode="numeric" autocomplete="off" data-money-give-amount placeholder="0"></label><button type="button" class="btn" data-money-do="give">${esc(t(lang, 'giveDo'))}</button>`
      : `<p class="money-empty">${esc(t(lang, 'giveNone'))}</p>`;
    const pick = view.splitPick, everyone = [c, ...others];
    const split = `<label class="field">${esc(t(lang, 'splitAmount'))}<input type="text" inputmode="numeric" autocomplete="off" data-money-split-amount placeholder="0"></label><fieldset class="money-who"><legend>${esc(t(lang, 'splitWho'))}</legend>${everyone.map(o => `<label><input type="checkbox" data-money-split-who value="${esc(o.id)}"${!pick || pick.has(o.id) ? ' checked' : ''}> ${esc(nameOf(o))}</label>`).join('')}</fieldset><p class="money-split-preview" data-money-split-preview>${esc(t(lang, 'splitHint'))}</p><button type="button" class="btn" data-money-do="split">${esc(t(lang, 'splitDo'))}</button>`;
    return `<div class="money-head"><h2 id="money-title" tabindex="-1">${esc(t(lang, 'wallet'))} · ${esc(nameOf(c))}</h2><button type="button" class="btn ghost" data-money-close>${esc(t(lang, 'close'))}</button></div>`
      + `<p class="money-balance"><b data-money-balance>${fmt(cash(c))}</b> eb</p>`
      + (bud ? `<p class="money-budgets">${bud}</p><p class="money-hint">${esc(t(lang, 'budgetsNote'))}</p>` : '')
      + `<div class="money-status${st && !st.ok ? ' is-bad' : ''}" role="status" aria-live="polite" data-money-status>${st ? `<span>${esc(st.text)}</span>${st.undo ? `<button type="button" class="btn small" data-money-do="undo">${esc(t(lang, 'undo'))}</button>` : ''}` : ''}</div>`
      + `<div class="money-form"><label class="field">${esc(t(lang, 'amount'))}<input type="text" inputmode="numeric" autocomplete="off" data-money-amount placeholder="0"></label><label class="field">${esc(t(lang, 'note'))}<input type="text" maxlength="120" data-money-note placeholder="${esc(t(lang, 'notePlaceholder'))}"></label><div class="money-quick" role="group" aria-label="${esc(t(lang, 'amount'))}">${QUICK.map(n => `<button type="button" class="btn ghost small" data-money-quick="${n}">${fmt(n)}</button>`).join('')}</div><div class="money-actions"><button type="button" class="btn primary" data-money-do="earn">${esc(t(lang, 'earn'))}</button><button type="button" class="btn" data-money-do="spend">${esc(t(lang, 'spend'))}</button></div></div>`
      + details('set', t(lang, 'setTitle'), `<label class="field">${esc(t(lang, 'setLabel'))}<input type="text" inputmode="numeric" autocomplete="off" data-money-set value="${cash(c)}"></label><button type="button" class="btn" data-money-do="set">${esc(t(lang, 'setDo'))}</button>`)
      + details('give', t(lang, 'giveTitle'), give)
      + details('split', t(lang, 'splitTitle'), split)
      + `<h3 class="money-log-title">${esc(t(lang, 'log'))}</h3>${logHTML(c, lang)}`;
  }

  // ---------- 3. Controller ----------

  const doc = typeof document !== 'undefined' ? document : null;
  const app = () => window.App || {};
  const lang = () => (app().lang?.() || doc?.documentElement?.lang) === 'en' ? 'en' : 'ru';
  const people = () => { const s = app().getState?.(); return Array.isArray(s?.characters) ? s.characters : []; };
  const nameOf = c => String(c?.name || (lang() === 'en' ? 'Unnamed' : 'Без имени'));
  const find = id => people().find(c => c && String(c.id) === String(id)) || null;

  let ui = null; // { id, section, status, last, opener, changed, splitPick }
  const overlay = () => doc?.getElementById?.('money-overlay') || null;

  function paint(focusSel) {
    const box = overlay(), c = ui && find(ui.id);
    if (!box || !c) { close(); return; }
    const panel = box.querySelector('.money-panel');
    panel.innerHTML = panelHTML({ lang: lang(), character: c, others: people().filter(o => o && o !== c), nameOf, section: ui.section, status: ui.status, splitPick: ui.splitPick });
    (focusSel && panel.querySelector(focusSel) || panel.querySelector('#money-title'))?.focus?.({ preventScroll: true });
  }
  function open(id, opener) {
    const c = find(id);
    if (!doc || !c || !W()) return false;
    close(true);
    ui = { id: c.id, section: '', status: null, last: null, opener: opener || null, changed: false, splitPick: null };
    const box = doc.createElement('div');
    box.id = 'money-overlay'; box.className = 'money-overlay';
    box.innerHTML = '<div class="money-backdrop" data-money-close></div><section class="money-panel" role="dialog" aria-modal="true" aria-labelledby="money-title"></section>';
    doc.body.appendChild(box);
    doc.documentElement.classList.add('money-open');
    paint('[data-money-amount]');
    return true;
  }
  function close(silent) {
    const box = overlay(), was = ui;
    if (box) box.remove();
    doc?.documentElement?.classList?.remove('money-open');
    ui = null;
    if (!was || silent === true) return;
    // Texts elsewhere on the sheet quote the balance (lifestyle, hustle…): redraw once, when the wallet closes.
    if (was.changed && app().getState?.()?.view === 'sheet') app().render?.();
    const again = was.opener && was.opener.isConnected ? was.opener : doc?.querySelector?.(`[data-money-open="${String(was.id).replace(/["\\]/g, '\\$&')}"]`);
    again?.focus?.({ preventScroll: true });
  }
  // Everything on screen that shows money follows a change at once.
  function announce() {
    const c = ui && find(ui.id) || app().active?.();
    const field = doc?.querySelector?.('.sheet-layout [data-cx-field="cash"]');
    const shown = app().active?.();
    if (field && shown && doc.activeElement !== field) field.value = String(cash(shown));
    window.SheetTabs?.refreshHud?.();
    try { doc?.dispatchEvent?.(new CustomEvent('nc-money', { detail: { id: c?.id ?? null } })); } catch { /* old browser: the next repaint shows it */ }
  }
  function commit(op, undoable) {
    if (!op.ok) { ui.status = { text: op.text, ok: false }; return false; }
    for (const ch of op.changes) ch.character.extra = ch.extra;
    app().save?.();
    ui.changed = true;
    ui.last = undoable ? op.changes.map(ch => ({ id: ch.character.id, delta: ch.delta })) : null;
    ui.status = { text: op.text, ok: true, undo: !!ui.last?.some(x => x.delta) };
    announce();
    return true;
  }
  function act(kind, panel) {
    const c = find(ui.id), l = lang();
    if (!c) { app().notify?.(t(l, 'gone')); close(); return; }
    const val = sel => panel.querySelector(sel)?.value ?? '';
    const note = String(val('[data-money-note]')).trim().slice(0, 120);
    let focus = '[data-money-amount]';
    if (kind === 'earn' || kind === 'spend') {
      const n = parseAmount(val('[data-money-amount]'));
      commit(n ? opChange(c, kind === 'earn' ? n : -n, note, l) : { ok: false, text: t(l, 'invalid') }, true);
    } else if (kind === 'set') {
      ui.section = 'set'; focus = '[data-money-set]';
      const op = opSet(c, val('[data-money-set]'), note, l);
      if (commit(op, true)) ui.section = '';
    } else if (kind === 'give') {
      ui.section = 'give'; focus = '[data-money-give-amount]';
      const to = find(val('[data-money-give-to]'));
      if (commit(opGive(c, to && to !== c ? to : null, val('[data-money-give-amount]'), note, l, nameOf), true)) ui.section = '';
    } else if (kind === 'split') {
      ui.section = 'split'; focus = '[data-money-split-amount]';
      const ids = [...panel.querySelectorAll('[data-money-split-who]')].filter(x => x.checked).map(x => x.value);
      ui.splitPick = new Set(ids);
      if (commit(opSplit(ids.map(find).filter(Boolean), val('[data-money-split-amount]'), note, l), true)) ui.section = '';
    } else if (kind === 'undo') {
      const changes = (ui.last || []).map(x => ({ character: find(x.id), delta: x.delta })).filter(x => x.character);
      if (changes.length) commit(opUndo(changes, l), false);
    }
    // A refused entry stays in its box so it can be corrected.
    const keep = ui.status && !ui.status.ok ? [...panel.querySelectorAll('input[type="text"], select')].map(el => [el.getAttributeNames().find(a => a.startsWith('data-money-')), el.value]) : [];
    paint(ui.status && !ui.status.ok ? focus : (ui.section ? focus : '[data-money-amount]'));
    const fresh = overlay()?.querySelector('.money-panel');
    for (const [name, value] of keep) { const el = name && fresh?.querySelector(`[${name}]`); if (el) el.value = value; }
    if (keep.length) previewSplit(fresh);
  }
  function previewSplit(panel) {
    const out = panel?.querySelector?.('[data-money-split-preview]');
    if (!out) return;
    const n = parseAmount(panel.querySelector('[data-money-split-amount]')?.value), who = [...panel.querySelectorAll('[data-money-split-who]')].filter(x => x.checked).length, l = lang();
    const share = n && who ? W().split(n, who) : null;
    out.textContent = share && share.each > 0 ? t(l, 'splitEach', fmt(share.each), who, share.rest) : t(l, 'splitHint');
  }

  if (doc?.addEventListener) {
    doc.addEventListener('click', e => {
      const el = e.target;
      const hide = el.closest?.('[data-money-next-hide]');
      if (hide) {
        const c = find(hide.dataset.moneyNextHide);
        if (c) { c.extra = { ...(c.extra || {}), moneyNextHidden: true }; app().save?.(); window.SheetTabs?.refreshHud?.(); }
        return;
      }
      const opener = el.closest?.('[data-money-open]');
      if (opener) { e.preventDefault(); open(opener.dataset.moneyOpen, opener); return; }
      if (!ui || !el.closest?.('#money-overlay')) return;
      const panel = overlay().querySelector('.money-panel');
      if (el.closest('[data-money-close]')) { close(); return; }
      const quick = el.closest('[data-money-quick]');
      if (quick) { const box = panel.querySelector('[data-money-amount]'); if (box) { box.value = String(Math.min(MAX, parseAmount(box.value) + Number(quick.dataset.moneyQuick))); box.focus?.(); } return; }
      const run = el.closest('[data-money-do]');
      if (run) act(run.dataset.moneyDo, panel);
    });
    doc.addEventListener('input', e => { if (ui && e.target.closest?.('[data-money-split-amount],[data-money-split-who]')) previewSplit(overlay()?.querySelector('.money-panel')); });
    doc.addEventListener('change', e => { if (ui && e.target.closest?.('[data-money-split-who]')) previewSplit(overlay()?.querySelector('.money-panel')); });
    doc.addEventListener('toggle', e => { const d = e.target; if (ui && d?.matches?.('.money-sec') && d.open) { ui.section = d.dataset.moneySec; for (const other of overlay()?.querySelectorAll('.money-sec[open]') || []) if (other !== d) other.open = false; } }, true);
    doc.addEventListener('keydown', e => {
      if (!ui) return;
      if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); close(); return; }
      if (e.key === 'Enter' && e.target.matches?.('#money-overlay input[type="text"]')) {
        const a = e.target, kind = a.hasAttribute('data-money-set') ? 'set' : a.hasAttribute('data-money-give-amount') ? 'give' : a.hasAttribute('data-money-split-amount') ? 'split' : a.hasAttribute('data-money-amount') ? 'earn' : '';
        if (kind) { e.preventDefault(); act(kind, overlay().querySelector('.money-panel')); }
        return;
      }
      if (e.key === 'Tab') {
        const items = [...overlay().querySelectorAll('button, input, select, summary, [tabindex="-1"]')].filter(x => !x.disabled && x.getClientRects?.().length && !x.classList.contains('money-backdrop') && x.tabIndex !== -1);
        if (!items.length) return;
        const first = items[0], last = items[items.length - 1];
        if (e.shiftKey && (doc.activeElement === first || !overlay().contains(doc.activeElement))) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && (doc.activeElement === last || !overlay().contains(doc.activeElement))) { e.preventDefault(); first.focus(); }
      }
    }, true);
  }

  // Called by character-extra.js for the «Деньги» and starting-budget fields of the sheet.
  // -> the usual CharacterExtra handler result.
  function fieldChange(el, c, key, type, l) {
    if (type !== 'change') return { handled: true };
    const r = fieldEntry(c, key, el.value, l);
    if (r.extra) c.extra = r.extra;
    if (String(el.value) !== r.value) el.value = r.value;
    return { handled: true, ...(r.dirty ? { dirty: true } : {}), ...(r.notify ? { notify: r.notify } : {}), rerender: r.dirty && key !== 'cash' };
  }

  window.Money = { text: t, parseEntry, parseAmount, budgets, armed, nextStep, opChange, opSet, opGive, opSplit, opUndo, fieldEntry, fieldChange, chipHTML, rowHTML, nextStepHTML, panelHTML, logHTML, open, close, state: () => ui };
})();
