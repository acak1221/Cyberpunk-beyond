// Shopping cart for the equipment catalog.
//
// Three layers, kept apart so each can be tested alone:
//   1. pure cart logic  - lines, quantities, pricing plan, all-or-nothing checkout;
//   2. HTML builders    - the sticky money bar and the cart panel, as strings;
//   3. a controller     - wires clicks and field changes to the two layers above.
//
// The cart lives in memory and in its own localStorage key (KEY below). It is never part of the
// saved app state, backups or room sync: it only holds catalog ids, quantities and option names,
// and it is sanitized against the catalog every time it is read. Characters are changed in one
// place only, checkout(), and only by a single assignment of a fully staged `extra`.
(function () {
  'use strict';

  const KEY = 'nightcity-red-cart-v1';
  const MAX_LINES = 50, MAX_QTY = 50;
  const MODES = ['cash', 'gearBudget', 'fashionBudget'];
  const RICH = Number.MAX_SAFE_INTEGER;

  const S = {
    ru: {
      cash: 'Деньги', gearBudget: 'Стартовое снаряжение', fashionBudget: 'Стартовая одежда',
      buyer: 'Покупает', chooseBuyer: 'Выберите персонажа', noBuyerHint: 'Выберите, кто покупает, — здесь появятся его деньги.',
      cart: 'Корзина', cartEmpty: 'Корзина пуста', cartBar: (n, sum) => `Корзина: ${n} · ${sum} eb`,
      remains: 'Останется', short: 'Не хватает', payFrom: 'Платить из', notSet: 'не указано', paying: 'оплата отсюда',
      close: 'Закрыть', closeCart: 'Закрыть корзину',
      emptyHelp: 'Корзина пуста. Нажмите «В корзину» на карточке предмета — деньги спишутся только после кнопки «Купить всё».',
      each: 'за шт.', qty: 'Количество', rooms: 'Комнат', less: 'Меньше', more: 'Больше', remove: 'Убрать',
      ammoType: 'Тип боеприпаса', chipType: 'Тип Skill Chip', chooseType: 'Выберите тип', units: 'шт.',
      total: 'Итого', was: 'Сейчас', clear: 'Очистить корзину', buyAll: 'Купить всё',
      review: 'Проверьте покупку', reviewFor: 'Покупатель', back: 'Назад к корзине', pay: sum => `Оплатить ${sum} eb`,
      paySummary: (sum, name, was, left) => `Будет списано ${sum} eb из бюджета «${name}». Сейчас там ${was} eb, останется ${left} eb.`,
      reviewNote: 'Предметы появятся в листе персонажа. Покупка не меняет Humanity и ничего не устанавливает.',
      cyberNote: (loss, install) => `Киберимплант. Потеря Humanity при установке: ${loss}${install ? ` · установка: ${install}` : ''}. Покупка Humanity не меняет — установка делается на листе.`,
      chipNote: 'Конкретный навык для чипа укажите на листе вручную.',
      ammoNote: (label, n) => `${label} · ${n} шт.`,
      roomsNote: n => `Комнат: ${n}`,
      added: name => `В корзину: ${name}`, needOption: 'Выберите тип в корзине, иначе позицию нельзя купить.',
      full: 'В корзине уже максимум позиций. Купите или уберите что-нибудь.',
      maxQty: 'Не больше 50 штук одной позиции.',
      empty: 'Корзина пуста.', noBuyer: 'Сначала выберите, кто покупает.',
      badFunds: 'В этом бюджете на листе персонажа нет суммы. Укажите её на листе или выберите другой бюджет.',
      gone: 'Этой позиции больше нет в каталоге. Уберите её из корзины.',
      shortBy: n => `Не хватает ${n} eb в выбранном бюджете.`, lineShort: 'На эту позицию денег в выбранном бюджете уже не хватает.',
      stale: 'Цены, корзина или деньги изменились. Проверьте покупку ещё раз.',
      confirmNeeded: 'Сначала подтвердите покупку.', failed: 'Покупка не выполнена, ничего не списано.',
      blocked: 'Покупку нельзя оформить',
      done: (n, sum, name, left) => `Куплено: ${n} поз. на ${sum} eb. В бюджете «${name}» осталось ${left} eb.`,
      receipt: 'Покупка оформлена', bought: 'Куплено', openSheet: name => `Открыть лист: ${name}`, keepShopping: 'Продолжить покупки',
      cleared: 'Корзина очищена.', removed: name => `Убрано из корзины: ${name}`,
      payHere: 'Платить отсюда', setMoney: 'Указать деньги', addMoney: '＋ Добавить деньги',
      switchTo: (name, n) => `Оплатить из «${name}» (${n} eb)`, logNote: names => `Каталог: ${names}`
    },
    en: {
      cash: 'Cash', gearBudget: 'Starting gear', fashionBudget: 'Starting fashion',
      buyer: 'Buyer', chooseBuyer: 'Choose a character', noBuyerHint: 'Choose who is buying to see their money here.',
      cart: 'Cart', cartEmpty: 'Cart is empty', cartBar: (n, sum) => `Cart: ${n} · ${sum} eb`,
      remains: 'Left after', short: 'Short by', payFrom: 'Pay from', notSet: 'not set', paying: 'paying from here',
      close: 'Close', closeCart: 'Close cart',
      emptyHelp: 'The cart is empty. Press “Add to cart” on an item card — money is only spent after “Buy all”.',
      each: 'each', qty: 'Quantity', rooms: 'Rooms', less: 'Fewer', more: 'More', remove: 'Remove',
      ammoType: 'Ammunition type', chipType: 'Skill Chip type', chooseType: 'Choose a type', units: 'units',
      total: 'Total', was: 'Now', clear: 'Clear cart', buyAll: 'Buy all',
      review: 'Review the purchase', reviewFor: 'Buyer', back: 'Back to cart', pay: sum => `Pay ${sum} eb`,
      paySummary: (sum, name, was, left) => `${sum} eb will be paid from “${name}”. It holds ${was} eb now and ${left} eb will remain.`,
      reviewNote: 'The items will appear on the character sheet. Buying does not change Humanity or install anything.',
      cyberNote: (loss, install) => `Cyberware. Humanity loss on installation: ${loss}${install ? ` · installation: ${install}` : ''}. Buying does not change Humanity — installation is done on the sheet.`,
      chipNote: 'Note the specific skill for the chip on the sheet manually.',
      ammoNote: (label, n) => `${label} · ${n} units`,
      roomsNote: n => `Rooms: ${n}`,
      added: name => `Added to cart: ${name}`, needOption: 'Choose a type in the cart, otherwise the item cannot be bought.',
      full: 'The cart already holds the maximum number of lines. Buy or remove something.',
      maxQty: 'No more than 50 of one item.',
      empty: 'The cart is empty.', noBuyer: 'First choose who is buying.',
      badFunds: 'This budget has no amount on the character sheet. Set it on the sheet or choose another budget.',
      gone: 'This item is no longer in the catalog. Remove it from the cart.',
      shortBy: n => `Short by ${n} eb in the chosen budget.`, lineShort: 'The chosen budget does not stretch to this line.',
      stale: 'Prices, the cart or the money changed. Review the purchase again.',
      confirmNeeded: 'Confirm the purchase first.', failed: 'The purchase was not made and nothing was spent.',
      blocked: 'The purchase cannot be completed',
      done: (n, sum, name, left) => `Bought: ${n} line(s) for ${sum} eb. “${name}” has ${left} eb left.`,
      receipt: 'Purchase complete', bought: 'Bought', openSheet: name => `Open sheet: ${name}`, keepShopping: 'Keep shopping',
      cleared: 'Cart cleared.', removed: name => `Removed from cart: ${name}`,
      payHere: 'Pay from here', setMoney: 'Set money', addMoney: '＋ Add money',
      switchTo: (name, n) => `Pay from “${name}” (${n} eb)`, logNote: names => `Catalog: ${names}`
    }
  };
  const L = lang => (lang === 'en' ? 'en' : 'ru');
  const t = (lang, key, ...args) => { const v = S[L(lang)][key]; return typeof v === 'function' ? v(...args) : v; };
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const isMoney = v => typeof v === 'number' && Number.isSafeInteger(v) && v >= 0;
  const tools = () => window.EquipmentTools;
  const findItem = (catalog, id) => (Array.isArray(catalog) ? catalog.find(x => x && x.id === id) : null) || null;
  const itemName = (item, lang) => String(item?.name?.[L(lang)] || item?.name?.en || item?.id || '');

  // ---------- 1. Pure cart logic ----------

  const emptyCart = () => ({ mode: 'cash', lines: [] });
  const lineKey = line => [line.itemId, line.ammoType || '', line.skillChipType || ''].join('|');
  const minQty = item => (item?.priceUnit?.en === 'per room' && Number.isSafeInteger(item?.stats?.minRooms) ? Math.max(1, Math.min(MAX_QTY, item.stats.minRooms)) : 1);
  const clampQty = (n, item) => { n = Math.floor(Number(n)); return Math.max(minQty(item), Math.min(MAX_QTY, Number.isFinite(n) ? n : 1)); };
  const ammoOptions = (item, lang) => (item?.category === 'ammo' ? tools()?.ammoTypeOptions?.(item, lang) || [] : []);
  const chipOptions = (item, lang) => (item?.id === 'cyberware-skill-chip' ? tools()?.skillChipOptions?.(item, lang) || [] : []);

  // A richly funded, empty stand-in buyer: tells whether an item can be bought at all, funds aside.
  const richStage = (mode, items = 0, weapons = 0) => ({ extra: { [mode]: RICH, items: new Array(items), weapons: new Array(weapons) } });

  // Why an item can never go through the cart (services, no numeric price...): {reason, message}, or null when it can.
  // Missing ammo or Skill Chip type is not a refusal: that is chosen on the cart line.
  function refusal(item, lang) {
    const q = tools()?.quote?.(richStage('cash'), item, 'cash', lang, { quantity: minQty(item), ammoType: ammoOptions(item, lang)[0]?.value, skillChipType: chipOptions(item, lang)[0]?.value });
    return !q ? { reason: 'purchaseFail', message: t(lang, 'failed') } : q.ok ? null : { reason: q.reason, message: q.message };
  }
  const buyable = item => !!item && !refusal(item, 'en');

  // Anything read from storage goes through here: unknown ids, bad shapes and absurd numbers are dropped.
  function sanitize(raw, catalog) {
    const cart = emptyCart();
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return cart;
    if (MODES.includes(raw.mode)) cart.mode = raw.mode;
    const seen = new Set();
    for (const entry of Array.isArray(raw.lines) ? raw.lines : []) {
      if (cart.lines.length >= MAX_LINES) break;
      if (!entry || typeof entry !== 'object' || typeof entry.itemId !== 'string') continue;
      const item = findItem(catalog, entry.itemId);
      if (!item) continue;
      const line = { itemId: item.id, quantity: clampQty(entry.quantity, item) };
      if (typeof entry.ammoType === 'string' && ammoOptions(item, 'en').some(o => o.value === entry.ammoType)) line.ammoType = entry.ammoType;
      if (typeof entry.skillChipType === 'string' && chipOptions(item, 'en').some(o => o.value === entry.skillChipType)) line.skillChipType = entry.skillChipType;
      const key = lineKey(line);
      if (seen.has(key)) continue;
      seen.add(key); cart.lines.push(line);
    }
    return cart;
  }
  const serialize = cart => ({ v: 1, mode: MODES.includes(cart?.mode) ? cart.mode : 'cash', lines: (cart?.lines || []).map(l => ({ itemId: l.itemId, quantity: l.quantity, ...(l.ammoType ? { ammoType: l.ammoType } : {}), ...(l.skillChipType ? { skillChipType: l.skillChipType } : {}) })) });
  function load(storage, catalog) {
    try { const text = storage?.getItem?.(KEY); return sanitize(text ? JSON.parse(text) : null, catalog); } catch { return emptyCart(); }
  }
  function store(storage, cart) {
    // The pay source is settled anew for the buyer on screen, so an empty cart leaves nothing worth keeping.
    try { if (cart.lines.length) storage?.setItem?.(KEY, JSON.stringify(serialize(cart))); else storage?.removeItem?.(KEY); return true; } catch { return false; }
  }

  // Adds one more of an item. The same item with the same options joins its existing line.
  function add(cart, item, lang, options = {}) {
    if (!item || typeof item !== 'object' || !item.id) return { ok: false, reason: 'invalidItem', message: tools()?.quote?.(null, null, 'cash', lang)?.message || t(lang, 'failed') };
    const why = refusal(item, lang);
    if (why) return { ok: false, ...why };
    const ammo = ammoOptions(item, lang), chip = chipOptions(item, lang);
    const line = { itemId: item.id, quantity: clampQty(options.quantity ?? 1, item) };
    const ammoType = options.ammoType || (ammo.length === 1 ? ammo[0].value : '');
    const chipType = options.skillChipType || (chip.length === 1 ? chip[0].value : '');
    if (ammoType && ammo.some(o => o.value === ammoType)) line.ammoType = ammoType;
    if (chipType && chip.some(o => o.value === chipType)) line.skillChipType = chipType;
    const key = lineKey(line), same = cart.lines.find(l => lineKey(l) === key);
    const needsOption = (ammo.length > 0 && !line.ammoType) || (chip.length > 0 && !line.skillChipType);
    if (same) {
      if (same.quantity >= MAX_QTY) return { ok: false, reason: 'maxQty', message: t(lang, 'maxQty'), key };
      same.quantity = Math.min(MAX_QTY, same.quantity + (options.quantity ? line.quantity : 1));
      return { ok: true, key, merged: true, needsOption };
    }
    if (cart.lines.length >= MAX_LINES) return { ok: false, reason: 'full', message: t(lang, 'full') };
    cart.lines.push(line);
    return { ok: true, key, merged: false, needsOption };
  }
  function setQuantity(cart, key, quantity, catalog) {
    const line = cart.lines.find(l => lineKey(l) === key);
    if (!line) return false;
    line.quantity = clampQty(quantity, findItem(catalog, line.itemId));
    return true;
  }
  // Sets the ammo or Skill Chip type of a line. If that makes it identical to another line, the two merge.
  function setOption(cart, key, value, catalog) {
    const index = cart.lines.findIndex(l => lineKey(l) === key);
    if (index < 0) return '';
    const line = cart.lines[index], item = findItem(catalog, line.itemId);
    delete line.ammoType; delete line.skillChipType;
    if (ammoOptions(item, 'en').some(o => o.value === value)) line.ammoType = value;
    else if (chipOptions(item, 'en').some(o => o.value === value)) line.skillChipType = value;
    const next = lineKey(line), twin = cart.lines.find((l, i) => i !== index && lineKey(l) === next);
    if (twin) { twin.quantity = Math.min(MAX_QTY, twin.quantity + line.quantity); cart.lines.splice(index, 1); }
    return next;
  }
  function remove(cart, key) {
    const index = cart.lines.findIndex(l => lineKey(l) === key);
    if (index < 0) return false;
    cart.lines.splice(index, 1); return true;
  }
  function clear(cart) { cart.lines.length = 0; }
  function setMode(cart, mode) { if (!MODES.includes(mode)) return false; cart.mode = mode; return true; }

  // The three budgets of a character; null where the sheet holds no usable number.
  function budgets(c) {
    const x = c && c.extra && typeof c.extra === 'object' && !Array.isArray(c.extra) ? c.extra : null;
    return Object.fromEntries(MODES.map(m => [m, isMoney(x?.[m]) ? x[m] : null]));
  }

  // Prices the whole cart for one buyer without touching anyone. Lines are taken in order: each one sees the
  // inventory room used up by the lines before it, and a line is marked short of funds from the point where
  // the running total passes the budget. `c` may be null (nobody chosen): lines are still priced.
  function plan(c, cart, catalog, lang) {
    const ET = tools(), mode = MODES.includes(cart?.mode) ? cart.mode : 'cash';
    const x = c && c.extra && typeof c.extra === 'object' && !Array.isArray(c.extra) ? c.extra : null;
    const funds = x ? x[mode] : undefined, fundsOk = isMoney(funds);
    let items = Array.isArray(x?.items) ? x.items.length : 0, weapons = Array.isArray(x?.weapons) ? x.weapons.length : 0;
    let total = 0, count = 0;
    const blockers = [];
    const lines = (cart?.lines || []).map(line => {
      const key = lineKey(line), item = findItem(catalog, line.itemId);
      const out = { key, itemId: line.itemId, item, name: itemName(item || { id: line.itemId }, lang), quantity: line.quantity, ammoType: line.ammoType || '', skillChipType: line.skillChipType || '', ok: false, reason: '', message: '', unitPrice: null, total: null, notes: [] };
      count += line.quantity;
      if (!item) { out.reason = 'gone'; out.message = t(lang, 'gone'); return out; }
      const q = ET?.quote ? ET.quote(richStage(mode, items, weapons), item, mode, lang, { quantity: line.quantity, ammoType: line.ammoType || undefined, skillChipType: line.skillChipType || undefined }) : { ok: false, reason: 'purchaseFail', message: t(lang, 'failed') };
      if (!q.ok) {
        out.reason = q.reason; out.message = q.message;
        if (isMoney(item.price) && !['ammoManual', 'ammoUnsupported', 'skillChipManual', 'skillChipUnsupported'].includes(q.reason)) out.unitPrice = item.price;
        return out;
      }
      out.unitPrice = q.unitPrice; out.total = q.total; total += q.total;
      if (item.category === 'weapon' && item.stats?.damage && item.stats?.skill) weapons += q.quantity; else items += 1;
      if (q.ammoLabel) { out.variant = q.ammoLabel; out.ammoCount = q.ammoCount; out.notes.push(t(lang, 'ammoNote', q.ammoLabel, q.ammoCount)); }
      if (q.skillChipLabel) { out.variant = q.skillChipLabel; out.notes.push(t(lang, 'chipNote')); }
      if (item.priceUnit?.en === 'per room') out.notes.push(t(lang, 'roomsNote', q.quantity));
      if (item.category === 'cyberware') { out.humanityLoss = item.stats?.humanityLoss ?? null; out.installation = item.stats?.installation ?? null; if (out.humanityLoss != null) out.notes.push(t(lang, 'cyberNote', out.humanityLoss, out.installation)); }
      if (fundsOk && total > funds) { out.reason = 'noFunds'; out.message = t(lang, 'lineShort'); return out; }
      out.ok = true;
      return out;
    });
    if (!lines.length) blockers.push({ reason: 'empty', message: t(lang, 'empty') });
    if (!c) blockers.push({ reason: 'noBuyer', message: t(lang, 'noBuyer') });
    else if (!fundsOk) blockers.push({ reason: 'badFunds', message: t(lang, 'badFunds') });
    const priced = lines.every(l => l.total != null);
    const bad = lines.find(l => !l.ok && l.reason !== 'noFunds') || lines.find(l => !l.ok);
    const remaining = fundsOk ? funds - total : null;
    // One sentence for the whole cart: a broken line is named; a shortage is given as the full missing sum.
    if (bad) blockers.push({ reason: bad.reason, message: bad.reason === 'noFunds' ? t(lang, 'shortBy', -remaining) : bad.name + ': ' + bad.message, key: bad.key });
    return {
      ok: !blockers.length, mode, buyerId: c?.id ?? null, available: fundsOk ? funds : null, total, remaining, count, priced, lines, blockers,
      // What the buyer was shown. Checkout refuses to pay if a fresh plan no longer matches it.
      signature: JSON.stringify([c?.id ?? null, mode, fundsOk ? funds : null, total, lines.map(l => [l.key, l.quantity, l.unitPrice, l.total, l.ok])])
    };
  }

  // Can this source pay the whole cart: it holds enough and takes every line (the fashion budget only takes fashion).
  function covers(c, cart, catalog, mode) {
    const p = plan(c, { mode, lines: cart?.lines || [] }, catalog, 'en');
    return p.available != null && p.remaining >= 0 && !p.lines.some(l => l.reason === 'badBudget' || l.reason === 'noFunds');
  }
  // The source a buyer pays from unless they choose another. Starting budgets go first while they hold money
  // (fashion for a cart of fashion only): what is left of them is lost or turns into cash when creation is
  // finished, so cash is never spent before them. A source that cannot cover the cart gives way to one that can.
  function pickMode(c, cart, catalog) {
    if (!c) return 'cash';
    const b = budgets(c), lines = cart?.lines || [];
    const order = [...(lines.length && b.fashionBudget > 0 ? ['fashionBudget'] : []), ...(b.gearBudget > 0 ? ['gearBudget'] : []), 'cash'];
    return order.find(m => covers(c, cart, catalog, m)) || ((b.gearBudget ?? 0) > (b.cash ?? 0) ? 'gearBudget' : 'cash');
  }
  // Another source that can pay a cart the chosen one cannot; '' when there is none or no need.
  function alternative(c, cart, catalog) {
    if (!c || !(cart?.lines || []).length || covers(c, cart, catalog, cart.mode)) return '';
    const m = pickMode(c, cart, catalog);
    return m !== cart.mode && covers(c, cart, catalog, m) ? m : '';
  }

  // Buys the whole cart or nothing. Everything is staged on a copy of `extra`; the character is changed
  // by one assignment at the very end, after every line and the final sum have been checked again.
  function checkout(c, cart, catalog, lang, options = {}) {
    const fail = (reason, message, key) => ({ ok: false, reason, message: message || t(lang, 'failed'), ...(key ? { key } : {}) });
    if (options.confirmed !== true) return fail('confirmNeeded', t(lang, 'confirmNeeded'));
    const ET = tools();
    if (!ET?.purchase) return fail('purchaseFail');
    const fresh = plan(c, cart, catalog, lang);
    if (!fresh.ok) return fail(fresh.blockers[0].reason, fresh.blockers[0].message, fresh.blockers[0].key);
    if (options.signature !== fresh.signature) return fail('stale', t(lang, 'stale'));
    let stage;
    // The copy keeps the rest of the character (stats above all): defaults such as the current LUCK are derived from it.
    try { stage = { ...c, extra: JSON.parse(JSON.stringify(c.extra)) }; } catch { return fail('purchaseFail'); }
    const created = [], bought = [];
    for (let i = 0; i < cart.lines.length; i++) {
      const line = cart.lines[i], expected = fresh.lines[i];
      let r;
      try { r = ET.purchase(stage, expected.item, fresh.mode, lang, { quantity: line.quantity, ammoType: line.ammoType || undefined, skillChipType: line.skillChipType || undefined, confirmed: true }); } catch { r = null; }
      if (!r?.ok) return fail(r?.reason || 'purchaseFail', expected.name + ': ' + (r?.message || t(lang, 'failed')), expected.key);
      if (r.quote.total !== expected.total) return fail('stale', t(lang, 'stale'), expected.key);
      created.push(...r.created);
      bought.push({ key: expected.key, itemId: expected.itemId, name: expected.name, variant: expected.variant || '', quantity: line.quantity, total: expected.total });
    }
    if (stage.extra[fresh.mode] !== fresh.remaining) return fail('stale', t(lang, 'stale'));
    // Cash spent in the shop goes into the wallet ledger, so the sheet can show where the money went.
    if (fresh.mode === 'cash' && fresh.total > 0 && window.Wallet?.spend) {
      const logged = window.Wallet.spend({ extra: { ...stage.extra, cash: fresh.available } }, fresh.total, t(lang, 'logNote', bought.map(x => x.name + (x.quantity > 1 ? ' ×' + x.quantity : '')).join(', ')));
      if (logged.ok && logged.balance === fresh.remaining) stage.extra = logged.extra;
    }
    c.extra = stage.extra;
    return { ok: true, dirty: true, mode: fresh.mode, total: fresh.total, available: fresh.available, remaining: fresh.remaining, created, bought };
  }

  // ---------- 2. HTML builders ----------

  // Inner HTML of the live money region in the bar.
  function moneyHTML(view) {
    const lang = view.lang, c = view.buyer, p = view.plan;
    if (!c) return `<span class="shop-hint">${esc(t(lang, 'noBuyerHint'))}</span>`;
    const b = budgets(c);
    // Starting budgets are noise once they are spent or closed; cash and the budget being paid from always show.
    // Each one is a button: pressing it makes that source the one the cart is paid from.
    const chips = MODES.filter(m => m === 'cash' || m === p.mode || (b[m] ?? 0) > 0).map(m => `<button type="button" data-action="cart-mode" data-mode="${m}" aria-pressed="${m === p.mode}" title="${esc(t(lang, m === p.mode ? 'paying' : 'payHere'))}" class="shop-chip${m === p.mode ? ' is-paying' : ''}"><span class="shop-chip-name">${esc(t(lang, m))}</span> <b>${b[m] == null ? esc(t(lang, 'notSet')) : b[m] + ' eb'}</b>${m === p.mode ? `<span class="sr-only"> — ${esc(t(lang, 'paying'))}</span>` : ''}</button>`).join('');
    // No money at all, or not enough for the cart: the wallet opens right here (money.js), no trip to the sheet.
    const broke = MODES.every(m => !(b[m] > 0)), lacking = p.lines.length > 0 && p.remaining != null && p.remaining < 0;
    const wallet = window.Money && (broke || lacking) ? `<button type="button" class="shop-chip shop-add-money" data-money-open="${esc(c.id)}" aria-haspopup="dialog">${esc(t(lang, broke ? 'setMoney' : 'addMoney'))}</button>` : '';
    let after = '';
    if (p.lines.length && p.remaining != null) after = p.remaining < 0
      ? `<span class="shop-after is-short">${esc(t(lang, 'short'))} <b>${-p.remaining} eb</b></span>`
      : `<span class="shop-after">${esc(t(lang, 'remains'))} <b>${p.remaining} eb</b></span>`;
    return chips + after + wallet;
  }
  const toggleText = (lang, p) => (p.lines.length ? t(lang, 'cartBar', p.count, p.total) : t(lang, 'cartEmpty'));

  function lineHTML(lang, l) {
    const name = esc(l.name), key = esc(l.key), item = l.item;
    const ammo = ammoOptions(item, lang), chip = chipOptions(item, lang), opts = ammo.length ? ammo : chip, chosen = l.ammoType || l.skillChipType;
    const optionLabel = t(lang, ammo.length ? 'ammoType' : 'chipType');
    const select = opts.length ? `<label class="shop-line-option"><span>${esc(optionLabel)}</span><select data-cart-option="${key}" aria-label="${esc(optionLabel)}: ${name}"${chosen ? '' : ' aria-invalid="true"'}><option value="">${esc(t(lang, 'chooseType'))}</option>${opts.map(o => `<option value="${esc(o.value)}"${o.value === chosen ? ' selected' : ''}>${esc(o.label)}${o.price ? ' · ' + o.price + ' eb' : ''}</option>`).join('')}</select></label>` : '';
    const rooms = item?.priceUnit?.en === 'per room', unit = item?.priceUnit?.[L(lang)];
    const price = l.unitPrice == null ? '' : `<span class="shop-line-price">${l.unitPrice} eb${unit ? ' / ' + esc(unit) : ''} × ${l.quantity}${l.total != null ? ` = <b>${l.total} eb</b>` : ''}</span>`;
    const qtyLabel = t(lang, rooms ? 'rooms' : 'qty');
    return `<li class="shop-line${l.ok ? '' : ' is-bad'}" data-cart-line="${key}"><div class="shop-line-head"><strong>${name}</strong>${price}</div>${select}<div class="shop-line-ctl"><span class="shop-step" role="group" aria-label="${esc(qtyLabel)}: ${name}"><button type="button" class="btn ghost" data-action="cart-dec" data-key="${key}" aria-label="${esc(t(lang, 'less'))}: ${name}"${l.quantity <= minQty(item) ? ' disabled' : ''}>−</button><input type="number" inputmode="numeric" min="${minQty(item)}" max="${MAX_QTY}" value="${l.quantity}" data-cart-qty="${key}" aria-label="${esc(qtyLabel)}: ${name}"><button type="button" class="btn ghost" data-action="cart-inc" data-key="${key}" aria-label="${esc(t(lang, 'more'))}: ${name}"${l.quantity >= MAX_QTY ? ' disabled' : ''}>+</button></span><button type="button" class="btn ghost shop-remove" data-action="cart-remove" data-key="${key}" aria-label="${esc(t(lang, 'remove'))}: ${name}">${esc(t(lang, 'remove'))}</button></div>${l.notes.map(n => `<p class="shop-line-note">${esc(n)}</p>`).join('')}${l.ok ? '' : `<p class="shop-line-error">${esc(l.message)}</p>`}</li>`;
  }
  function modeHTML(lang, c, p) {
    const b = budgets(c);
    return `<label class="field shop-mode">${esc(t(lang, 'payFrom'))}<select id="catalog-mode">${MODES.filter(m => !c || m === 'cash' || m === p.mode || (b[m] ?? 0) > 0).map(m => `<option value="${m}"${m === p.mode ? ' selected' : ''}>${esc(t(lang, m))}${c ? ' — ' + (b[m] == null ? esc(t(lang, 'notSet')) : b[m] + ' eb') : ''}</option>`).join('')}</select></label>`;
  }
  function totalsHTML(lang, p) {
    const left = p.remaining == null ? '' : `<span>${esc(t(lang, 'was'))}: <b>${p.available} eb</b></span><span class="${p.remaining < 0 ? 'is-short' : ''}">${esc(t(lang, p.remaining < 0 ? 'short' : 'remains'))}: <b>${Math.abs(p.remaining)} eb</b></span>`;
    return `<p class="shop-total"><span>${esc(t(lang, 'total'))}: <b>${p.total} eb</b></span>${left}</p>`;
  }

  // Inner HTML of the cart panel: the receipt of the last purchase, the review step, or the editable cart.
  function panelHTML(view) {
    const lang = view.lang, c = view.buyer, p = view.plan, buyerName = view.buyerName || '';
    const head = title => `<div class="shop-cart-head"><h2 id="shop-cart-title" tabindex="-1">${esc(title)}</h2><button type="button" class="btn ghost shop-close" data-action="cart-close" aria-label="${esc(t(lang, 'closeCart'))}">${esc(t(lang, 'close'))}</button></div>`;
    if (view.receipt) {
      const r = view.receipt;
      return head(t(lang, 'receipt')) + `<p class="shop-done">${esc(t(lang, 'done', r.bought.length, r.total, t(lang, r.mode), r.remaining))}</p><ul class="shop-review-list">${r.bought.map(x => `<li><span>${esc(x.name)}${x.variant ? ' · ' + esc(x.variant) : ''} × ${x.quantity}</span><b>${x.total} eb</b></li>`).join('')}</ul><div class="shop-actions"><button type="button" class="btn ghost" data-action="cart-close">${esc(t(lang, 'keepShopping'))}</button><button type="button" class="btn primary" data-action="cart-open-sheet" data-id="${esc(r.buyerId)}">${esc(t(lang, 'openSheet', r.buyerName))}</button></div>`;
    }
    if (!p.lines.length) return head(t(lang, 'cart')) + `<p class="shop-empty">${esc(t(lang, 'emptyHelp'))}</p>` + modeHTML(lang, c, p);
    if (view.review && p.ok) {
      return head(t(lang, 'review')) + `<p class="shop-review-buyer">${esc(t(lang, 'reviewFor'))}: <b>${esc(buyerName)}</b></p><ol class="shop-review-list">${p.lines.map(l => `<li><span>${esc(l.name)}${l.variant ? ' · ' + esc(l.variant) : ''} × ${l.quantity}${l.notes.map(n => `<small>${esc(n)}</small>`).join('')}</span><b>${l.total} eb</b></li>`).join('')}</ol><p class="shop-pay">${esc(t(lang, 'paySummary', p.total, t(lang, p.mode), p.available, p.remaining))}</p><p class="shop-line-note">${esc(t(lang, 'reviewNote'))}</p><div class="shop-actions"><button type="button" class="btn ghost" data-action="cart-back">${esc(t(lang, 'back'))}</button><button type="button" class="btn primary" data-action="cart-pay">${esc(t(lang, 'pay', p.total))}</button></div>`;
    }
    const offer = view.alt && c ? `<button type="button" class="btn primary shop-switch" data-action="cart-mode" data-mode="${esc(view.alt)}">${esc(t(lang, 'switchTo', t(lang, view.alt), budgets(c)[view.alt]))}</button>` : '';
    const blocker = p.blockers[0] ? `<p class="shop-blocker" id="shop-blocker">${esc(t(lang, 'blocked'))}: ${esc(p.blockers[0].message)}</p>${offer}` : '';
    return head(t(lang, 'cart')) + modeHTML(lang, c, p) + `<ul class="shop-lines">${p.lines.map(l => lineHTML(lang, l)).join('')}</ul>` + totalsHTML(lang, p) + blocker + `<div class="shop-actions"><button type="button" class="btn ghost" data-action="cart-clear">${esc(t(lang, 'clear'))}</button><button type="button" class="btn primary" data-action="cart-review"${blocker ? ' aria-describedby="shop-blocker"' : ''}>${esc(t(lang, 'buyAll'))}</button></div>`;
  }

  // The whole dock: sticky bar (buyer, money, cart button) with the cart panel folded under it.
  function shellHTML(view) {
    const lang = view.lang, open = !!view.open;
    const options = (view.characters || []).map(c => `<option value="${esc(c.id)}"${view.buyer && view.buyer.id === c.id ? ' selected' : ''}>${esc(view.nameOf ? view.nameOf(c) : c.name)}</option>`).join('');
    return `<div class="shop-dock" id="shop-dock"><div class="shop-bar"><label class="shop-buyer"><span>${esc(t(lang, 'buyer'))}</span><select id="catalog-target"${view.buyer ? '' : ' class="is-empty"'}><option value="">${esc(t(lang, 'chooseBuyer'))}</option>${options}</select></label><div class="shop-money" id="shop-money" role="status" aria-live="polite">${moneyHTML(view)}</div><button type="button" class="btn primary shop-toggle" id="shop-toggle" data-action="cart-toggle" aria-expanded="${open}" aria-controls="shop-cart">${esc(toggleText(lang, view.plan))}</button></div><section class="shop-cart" id="shop-cart" aria-labelledby="shop-cart-title"${open ? '' : ' hidden'}>${open ? panelHTML(view) : ''}</section></div>`;
  }

  // ---------- 3. Controller ----------

  // host: { lang(), characters(), buyerId(), nameOf(c), catalog(), scope(), epoch(), current(c, scope), stale(),
  //         notify(text), save(), needBuyer(), openSheet(id), document?, storage?, window?, defer?(fn) }
  function controller(host) {
    const doc = host.document || (typeof document !== 'undefined' ? document : null);
    const storage = 'storage' in host ? host.storage : (() => { try { return typeof localStorage !== 'undefined' ? localStorage : null; } catch { return null; } })();
    const win = host.window || (typeof window !== 'undefined' ? window : null);
    const later = host.defer || (typeof setTimeout === 'function' ? fn => setTimeout(fn, 0) : fn => fn());
    const raw = () => { try { return storage?.getItem?.(KEY) ?? null; } catch { return null; } };
    // The stored text this tab last read or wrote. Anything else in storage was put there by another tab.
    let seen = raw();
    const cart = load(storage, host.catalog());
    let open = false, review = null, receipt = null;
    // shown: the panel was open at the last paint. pressing: a pointer is down. pending: the panel is waiting to be rebuilt.
    let shown = false, pressing = false, pending = false;
    const $ = sel => doc?.querySelector?.(sel) || null;
    const buyer = () => { const id = host.buyerId(); return (host.characters() || []).find(c => c.id === id) || null; };
    // manual: the source this buyer picked by hand. It holds for that buyer only, and only while that source has money.
    let manual = null;
    // Settles what the cart is paid from for the buyer on screen: their own choice while it is usable, else the default.
    function tune() {
      const c = buyer();
      if (manual && !(c && manual.id === c.id && (manual.mode === 'cash' || (budgets(c)[manual.mode] ?? 0) > 0))) manual = null;
      const next = manual ? manual.mode : pickMode(c, cart, host.catalog());
      if (next === cart.mode) return false;
      cart.mode = next; review = null;
      return true;
    }
    const view = () => { tune(); const c = buyer(), lang = host.lang(), catalog = host.catalog(); return { lang, buyer: c, buyerName: c ? host.nameOf(c) : '', characters: host.characters(), nameOf: host.nameOf, plan: plan(c, cart, catalog, lang), alt: alternative(c, cart, catalog), open, review: !!review, receipt }; };
    const persist = () => { store(storage, cart); seen = raw(); };
    // Another tab changed the stored cart (bought it, cleared it, edited it): take its version, so that
    // a cart that was already paid for cannot be paid again here or written back. True when it changed.
    function sync() {
      const now = raw();
      if (now === seen) return false;
      seen = now;
      const fresh = load(storage, host.catalog());
      cart.mode = fresh.mode; cart.lines.splice(0, cart.lines.length, ...fresh.lines);
      review = null;
      return true;
    }
    const focus = sel => { const el = $(sel); el?.focus?.({ preventScroll: false }); return !!el; };
    const attr = key => String(key).replace(/["\\]/g, '\\$&');
    // A selector that finds the same control again after the panel has been rebuilt.
    function selectorOf(el) {
      const d = el?.dataset || {};
      if (!el?.closest?.('#shop-cart')) return '';
      if (el.id) return '#' + el.id;
      if (d.cartQty !== undefined) return `[data-cart-qty="${attr(d.cartQty)}"]`;
      if (d.cartOption !== undefined) return `[data-cart-option="${attr(d.cartOption)}"]`;
      if (d.action) return `[data-action="${d.action}"]` + (d.key !== undefined ? `[data-key="${attr(d.key)}"]` : '');
      return '';
    }
    // Tells the stylesheet how much of the top of the screen the sticky dock covers, so that a control
    // scrolled into view by the keyboard stops below it instead of under it.
    function measure() {
      const dock = $('#shop-dock'), root = doc?.documentElement;
      if (!dock?.getBoundingClientRect || !root?.style?.setProperty || !win?.getComputedStyle) return;
      const stick = parseFloat(win.getComputedStyle(dock).top) || 0;
      root.style.setProperty('--shop-dock-h', Math.round(Math.min(stick + dock.getBoundingClientRect().height, (win.innerHeight || 800) * .6)) + 'px');
    }
    // The dock only sticks once the page is scrolled. When the cart opens while the dock still sits lower
    // in the page and would run off the bottom, scroll the page so the dock sticks and the panel is on screen.
    function reveal() {
      const dock = $('#shop-dock');
      if (!dock?.getBoundingClientRect || !win?.scrollBy || !win?.getComputedStyle) return;
      const stick = parseFloat(win.getComputedStyle(dock).top) || 0, box = dock.getBoundingClientRect();
      if (box.top > stick + 1 && box.bottom > (win.innerHeight || 0) - 76) win.scrollBy({ top: box.top - stick, behavior: 'instant' });
    }

    // Repaints the money region, the cart button and (when open) the panel. Missing nodes are skipped.
    // barOnly leaves the panel alone (it stays pending); keep puts the keyboard back on the control it was on.
    function paint(how = {}) {
      const v = view(), money = $('#shop-money'), toggle = $('#shop-toggle'), panel = $('#shop-cart');
      if (money) { const html = moneyHTML(v); if (money.innerHTML !== html) money.innerHTML = html; }
      if (toggle) { toggle.textContent = toggleText(v.lang, v.plan); toggle.setAttribute?.('aria-expanded', String(open)); }
      $('#catalog-target')?.classList?.toggle?.('is-empty', !v.buyer);
      if (how.barOnly) return v;
      pending = false;
      const keep = how.keep && open ? selectorOf(doc?.activeElement) : '';
      if (panel) { panel.hidden = !open; panel.innerHTML = open ? panelHTML(v) : ''; }
      if (open && !shown) reveal();
      shown = open;
      if (keep) focus(keep) || focus('#shop-cart-title');
      measure();
      return v;
    }
    // Rebuilding the panel destroys the button under a pressed pointer (the click is lost) and the control
    // the Tab key is moving to. So a typed quantity repaints the bar at once and the panel a moment later:
    // after the press has turned into a click, or after the focus has moved.
    const flush = () => { if (pending) paint({ keep: true }); };
    const soon = () => { pending = true; if (!pressing) later(flush); };
    function setOpen(next, focusSel) {
      open = next; if (!next) { review = null; receipt = null; }
      paint();
      focus(next ? focusSel || '#shop-cart-title' : '#shop-toggle');
    }
    // Any edit invalidates a review in progress: the buyer must look at the new sums before paying.
    function edited(focusSel) { review = null; receipt = null; persist(); paint(); if (focusSel) focus(focusSel) || focus('#shop-cart-title'); }

    function startReview() {
      const c = buyer(), lang = host.lang();
      if (!c) { host.needBuyer(); return; }
      const scope = host.scope();
      if (!host.current(c, scope)) { host.stale(); return; }
      tune();
      const p = plan(c, cart, host.catalog(), lang);
      if (!p.ok) {
        const b = p.blockers[0]; host.notify(t(lang, 'blocked') + ': ' + b.message);
        open = true; review = null; paint();
        if (b.key) focus(`[data-cart-option="${attr(b.key)}"]`) || focus(`[data-cart-qty="${attr(b.key)}"]`); else focus('#catalog-mode');
        return;
      }
      review = { c, scope, epoch: host.epoch(), signature: p.signature };
      open = true; receipt = null; paint(); focus('#shop-cart-title');
    }
    function pay() {
      const token = review, lang = host.lang();
      review = null;
      if (!token || host.epoch() !== token.epoch || !host.current(token.c, token.scope) || buyer() !== token.c) { paint(); host.stale(); return; }
      const r = checkout(token.c, cart, host.catalog(), lang, { confirmed: true, signature: token.signature });
      if (!r.ok) { paint(); host.notify(r.reason === 'stale' ? r.message : t(lang, 'blocked') + ': ' + r.message); focus('#shop-cart-title'); return; }
      clear(cart); persist();
      receipt = { ...r, buyerId: token.c.id, buyerName: host.nameOf(token.c) };
      host.save();
      open = true; paint();
      host.notify(t(lang, 'done', r.bought.length, r.total, t(lang, r.mode), r.remaining));
      focus('#shop-cart-title');
    }

    const api = {
      cart, paint,
      shell() {
        // Coming back to the catalog from another screen starts with the panel closed.
        if (!$('#shop-dock')) { open = false; shown = false; review = null; receipt = null; }
        sync();
        return shellHTML(view());
      },
      // Buyer or budget changed elsewhere, or a character was edited: re-price and repaint.
      changed() { review = null; paint(); },
      setMode(mode) { if (sync()) paint({ keep: true }); if (setMode(cart, mode)) { const c = buyer(); manual = c ? { id: c.id, mode } : null; edited('#catalog-mode'); } },
      sync,
      click(action, button) {
        const lang = host.lang(), key = button?.dataset?.key, catalog = host.catalog();
        if (sync()) paint({ keep: true });
        if (action === 'cart-add') {
          const item = findItem(catalog, button?.dataset?.id), r = add(cart, item, lang);
          if (!r.ok) { host.notify(r.message); return true; }
          review = null; receipt = null; persist();
          if (r.needsOption) { open = true; paint(); host.notify(t(lang, 'needOption')); focus(`[data-cart-option="${attr(r.key)}"]`); }
          else { paint(); host.notify(t(lang, 'added', itemName(item, lang))); }
        } else if (action === 'cart-toggle') { const panel = $('#shop-cart'); setOpen(!(open && panel?.hidden !== true)); }
        else if (action === 'cart-mode') { const mode = button?.dataset?.mode; api.setMode(mode); if (!button?.closest?.('#shop-cart')) focus(`[data-action="cart-mode"][data-mode="${attr(mode)}"]`); }
        else if (action === 'cart-close') setOpen(false);
        else if (action === 'cart-inc' || action === 'cart-dec') {
          const line = cart.lines.find(l => lineKey(l) === key);
          if (line && setQuantity(cart, key, line.quantity + (action === 'cart-inc' ? 1 : -1), catalog)) {
            edited();
            // Keep the keyboard on the stepper; a button that just became disabled hands over to the number field.
            const again = $(`[data-action="${action}"][data-key="${attr(key)}"]`);
            if (again && !again.disabled) again.focus?.(); else focus(`[data-cart-qty="${attr(key)}"]`);
          }
        } else if (action === 'cart-remove') {
          const index = cart.lines.findIndex(l => lineKey(l) === key), name = itemName(findItem(catalog, cart.lines[index]?.itemId), lang);
          if (remove(cart, key)) {
            edited();
            const next = cart.lines[Math.min(index, cart.lines.length - 1)];
            if (next) focus(`[data-action="cart-remove"][data-key="${attr(lineKey(next))}"]`); else focus('#shop-cart-title');
            host.notify(t(lang, 'removed', name));
          }
        } else if (action === 'cart-clear') { clear(cart); edited('#shop-cart-title'); host.notify(t(lang, 'cleared')); }
        else if (action === 'cart-review') startReview();
        else if (action === 'cart-back') { review = null; paint(); focus('[data-action="cart-review"]'); }
        else if (action === 'cart-pay') pay();
        else if (action === 'cart-open-sheet') { const id = button?.dataset?.id; open = false; receipt = null; host.openSheet(id); }
        else return false;
        return true;
      },
      // A quantity field or an option select inside a cart line changed.
      field(el) {
        const data = el?.dataset || {}, catalog = host.catalog();
        if (sync()) paint({ keep: true });
        // No forced focus here: the change usually fires because the keyboard or the pointer is leaving the field.
        if (data.cartQty !== undefined) { if (setQuantity(cart, data.cartQty, el.value, catalog)) { review = null; receipt = null; persist(); paint({ barOnly: true }); soon(); } return true; }
        if (data.cartOption !== undefined) { const next = setOption(cart, data.cartOption, el.value, catalog); if (next) edited(`[data-cart-option="${attr(next)}"]`) ; return true; }
        return false;
      },
      // Escape closes the panel (or steps back from the review) and returns focus to where it came from.
      key(event) {
        if (event?.key !== 'Escape' || !open || !$('#shop-cart')) return false;
        // Only when the keyboard is in the dock: Escape elsewhere belongs to whatever is open there.
        if (event.target?.closest && !event.target.closest('#shop-dock')) return false;
        if (review) { review = null; paint(); focus('[data-action="cart-review"]'); } else setOpen(false);
        return true;
      },
      state: () => ({ open, review: !!review, receipt })
    };
    doc?.addEventListener?.('keydown', event => { if (event?.key === 'Tab') measure(); if (api.key(event)) event.preventDefault?.(); });
    for (const type of ['pointerdown', 'mousedown']) doc?.addEventListener?.(type, () => { pressing = true; }, true);
    for (const type of ['pointerup', 'pointercancel', 'mouseup']) doc?.addEventListener?.(type, () => { pressing = false; if (pending) later(flush); }, true);
    // Runs after the app's own click handler, so an action pressed right after typing sees the panel it was pressed in.
    doc?.addEventListener?.('click', () => { pressing = false; flush(); });
    // The wallet (money.js) changed somebody's money while the shop is on screen.
    doc?.addEventListener?.('nc-money', () => { if ($('#shop-dock')) api.changed(); });
    // The cart is shared by every tab of the app; follow what the other tabs do with it.
    win?.addEventListener?.('storage', event => { if ((event?.key == null || event.key === KEY) && sync()) paint({ keep: true }); });
    return api;
  }

  window.ShopCart = { KEY, MAX_LINES, MAX_QTY, MODES, text: t, emptyCart, lineKey, buyable, refusal, sanitize, serialize, load, store, add, setQuantity, setOption, remove, clear, setMode, budgets, covers, pickMode, alternative, plan, checkout, moneyHTML, panelHTML, shellHTML, toggleText, controller };
})();
