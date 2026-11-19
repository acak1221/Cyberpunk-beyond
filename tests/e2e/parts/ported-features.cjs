/* The checks of the ported features: the character list, the quick builder, notes, gear, the Game Master's hub, the NET
   generator and the server list of a room. Loaded by run.cjs, which passes what it owns (see shell-features.cjs). */
module.exports = async function portedFeatures({ check, device, BASE, wait, until, character, axeAt, brokerUrl }) {
  const sideways = page => page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  const small = (page, sel) => page.$$eval(sel, els => els.filter(e => e.getClientRects().length).filter(e => { const r = e.getBoundingClientRect(); return r.height < 43.5; }).map(e => (e.dataset && Object.keys(e.dataset)[0]) || e.className || e.tagName));
  const onBody = page => page.evaluate(() => document.activeElement === document.body);
  const state = (page, fn) => page.evaluate(fn);

  await check('character list: a copy, the Select mode with all cards, one move to the bin and one Undo', async fail => {
    const { ctx, page } = await device({ width: 390 });
    await page.goto(BASE + '#/characters'); await wait(500);
    await page.click('[data-character-card="v1"] .cl-more'); await page.click('[data-character-card="v1"] [data-action="duplicate"]'); await wait(400);
    await page.goto(BASE + '#/characters'); await wait(400);
    if ((await page.locator('[data-character-card]').count()) !== 2) fail('the copy did not appear next to the card');
    await page.click('[data-cl="select"]'); await wait(250);
    if ((await page.locator('[data-cl-pick]').count()) !== 2) fail('Select mode shows no tick on a card');
    await page.click('[data-cl="all"]'); await wait(200);
    if (!/2/.test(await page.locator('[data-cl-count]').innerText())) fail('the count does not say two cards are picked: ' + await page.locator('[data-cl-count]').innerText());
    const tiny = await small(page, '.cl-select-tools button, .cl-pick, .cl-more');
    if (tiny.length) fail('list controls under 44 px: ' + tiny.join(', '));
    await axeAt(page, '#main-content', 'the character list in Select mode, native dark 390', fail);
    await page.click('[data-cl="bin"]'); await wait(450);
    const gone = await state(page, () => ({ chars: window.App.getState().characters.length, bin: (window.App.getState().bin || []).filter(b => b.kind !== 'campaign').length }));
    if (gone.chars !== 0 || gone.bin < 2) fail('both sheets did not go to the bin: ' + JSON.stringify(gone));
    if (await onBody(page)) fail('the focus fell to the page body after the bin');
    if ((await page.locator('#app-notice .notice-action').count()) !== 1) { fail('one notice with one Undo is expected'); }
    else { await page.click('#app-notice .notice-action'); await wait(450); if ((await state(page, () => window.App.getState().characters.length)) !== 2) fail('one Undo did not bring both sheets back'); }
    if (await sideways(page) > 0) fail('the list scrolls sideways at 390 px');
    for (const e of page.errs) fail(e);
    await ctx.close();
  });

  await check('full backup restore: Undo keeps the original sheet and custom catalog after reload', async fail => {
    const { ctx, page } = await device({});
    const item = (id, price) => ({ id, name: { en: id }, category: 'gear', price });
    const materials = items => ({ format: 'nightcity-red-custom', version: 1, items, npcs: [] });
    const backup = {
      format: 'nightcity-red-backup', version: 1,
      _completeSnapshot: { characters: [{ ...character, id: 'imported', hp: 12 }], campaigns: [] },
      customContent: materials([item('kit', 250), item('cable', 50)])
    };
    try {
      await page.addInitScript(data => {
        if (sessionStorage.getItem('custom-seeded')) return;
        localStorage.setItem('nightcity-red-custom-v1', JSON.stringify(data));
        sessionStorage.setItem('custom-seeded', '1');
      }, materials([item('kit', 777)]));
      await page.goto(BASE + '#/characters');
      const checkState = async (id, hp, expectedItems) => {
        await page.locator(`[data-character-card="${id}"]`).waitFor();
        const actual = await page.evaluate(() => ({
          sheets: window.App.getState().characters.map(c => [c.id, c.hp]),
          items: window.CustomContent.getData().items.map(i => [i.id, i.price]).sort(),
          catalog: window.CATALOG.filter(i => i.custom).map(i => [i.id.slice('custom-'.length), i.price]).sort()
        }));
        const expected = { sheets: [[id, hp]], items: expectedItems, catalog: expectedItems };
        if (JSON.stringify(actual) !== JSON.stringify(expected)) fail(`expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
      };
      await checkState(character.id, character.hp, [['kit', 777]]);
      await page.setInputFiles('#restore-backup', {
        name: 'backup.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(backup))
      });
      await checkState('imported', 12, [['cable', 50], ['kit', 250]]);
      await page.locator('#app-notice .notice-action').click();
      await page.locator(`[data-character-card="${character.id}"]`).waitFor();
      await page.reload();
      await checkState(character.id, character.hp, [['kit', 777]]);
    } finally {
      await ctx.close();
    }
  });

  await check('quick builder: three screens, roll everything, one confirmation, a character appears and the focus stays', async fail => {
    const { ctx, page } = await device({ width: 390, data: false });
    await page.goto(BASE + '#/quick-builder'); await wait(500);
    if ((await page.locator('[data-quick-action="step"]').count()) !== 3) fail('the builder does not have three screens');
    await page.fill('[data-quick-field="name"]', 'Тест'); await page.click('[data-quick-action="roll"]'); await wait(300);
    if (await onBody(page)) fail('the focus fell to the page body after «Бросить всё»');
    await page.click('[data-quick-action="next"]'); await wait(300);
    if (!(await page.locator('[data-quick-confirm="confirmAll"]').count())) fail('the kit screen has no single confirmation');
    await page.check('[data-quick-confirm="confirmAll"]'); await wait(200);
    await axeAt(page, '#main-content', 'the quick builder kit screen, native dark 390', fail);
    await page.click('[data-quick-action="next"]'); await wait(300);
    const tiny = await small(page, '#main-content [data-quick-action="back"], #main-content [data-quick-action="create"]');
    if (tiny.length) fail('builder buttons under 44 px: ' + tiny.join(', '));
    await page.click('[data-quick-action="create"]'); await wait(600);
    const made = await state(page, () => window.App.getState().characters.map(c => c.name + ':' + c.role));
    if (made.length !== 1 || !/^Тест:/.test(made[0])) fail('the character was not created: ' + made);
    if (await onBody(page)) fail('the focus fell to the page body after Create');
    for (const e of page.errs) fail(e);
    await ctx.close();
  });

  await check('notes: a titled note, search, pin, delete with Undo; a goal and a contact', async fail => {
    const { ctx, page } = await device({ width: 1280 });
    await page.goto(BASE + '#/sheet/v1'); await wait(500);
    await page.evaluate(() => document.querySelector('[data-sheet-tab="life"]')?.click()); await wait(300);
    await page.click('[data-agent-action="add-note"]'); await wait(300);
    const dlg = await state(page, () => { const d = document.querySelector('dialog[open]'); return d ? { inside: !!document.activeElement?.closest('dialog'), fields: d.querySelectorAll('input,textarea').length } : null; });
    if (!dlg || !dlg.inside) fail('the note dialog did not take the focus: ' + JSON.stringify(dlg));
    await page.fill('dialog[open] input:not([type="checkbox"])', 'Склад'); await page.fill('dialog[open] textarea', 'Ключ у Ли, код 4417'); await page.click('dialog[open] button:not([data-agent-dialog])'); await wait(400);
    const saved = await state(page, () => window.App.active().extra.notesList?.map(n => n.title + '|' + n.text));
    if (!saved || saved.length !== 1 || saved[0] !== 'Склад|Ключ у Ли, код 4417') fail('the note was not saved on the character: ' + JSON.stringify(saved));
    if (await state(page, () => !!document.querySelector('dialog[open]'))) fail('the dialog stays open after Save');
    if (await onBody(page)) fail('the focus fell to the page body after saving a note');
    await page.fill('[data-agent-search="notes"]', 'код 44'); await wait(250);
    if (!/склад/i.test(await page.locator('[data-agent-list="notes"]').innerText())) fail('the search did not find the note by its text');
    await page.fill('[data-agent-search="notes"]', 'нет такого'); await wait(250);
    if (/склад/i.test(await page.locator('[data-agent-list="notes"]').innerText())) fail('the search shows a note that does not match');
    await page.fill('[data-agent-search="notes"]', ''); await wait(250);
    await page.click('[data-agent-action="pin-note"]'); await wait(300);
    if (!(await state(page, () => window.App.active().extra.notesList[0].pinned))) fail('the pin did not stick');
    await page.click('[data-agent-action="remove-note"]'); await wait(350);
    if ((await state(page, () => (window.App.active().extra.notesList || []).length)) !== 0) fail('the note was not deleted');
    if ((await page.locator('#app-notice .notice-action').count()) !== 1) fail('no Undo after deleting a note');
    else { await page.click('#app-notice .notice-action'); await wait(350); if ((await state(page, () => window.App.active().extra.notesList.length)) !== 1) fail('Undo did not bring the note back'); }
    await page.click('[data-agent-action="add-goal"]'); await wait(300);
    if ((await state(page, () => (window.App.active().extra.goals || []).length)) !== 1) fail('a goal was not added');
    await page.click('[data-agent-action="add-contact"]'); await wait(300);
    if ((await state(page, () => (window.App.active().extra.contacts || []).length)) !== 1) fail('a contact was not added');
    await axeAt(page, '#sheet-agent', 'notes, goals and contacts, native dark 1280', fail);
    for (const e of page.errs) fail(e);
    await ctx.close();
  });

  await check('gear: a weapon takes a modification within its slots, cyberware slots count, the garage tracks vehicle SDP', async fail => {
    const { ctx, page } = await device({ width: 390 });
    await page.goto(BASE + '#/sheet/v1'); await wait(500);
    const bought = await state(page, () => {
      const c = window.App.active(); c.extra = { ...(c.extra || {}), cash: 20000 };
      const out = ['weapon-heavy-pistol', 'cyberware-neural-link', 'cyberware-kerenzikov'].map(id => window.EquipmentTools.purchase(c, window.CATALOG.find(x => x.id === id), 'cash', 'ru', { confirmed: true })?.ok === true);
      window.App.save(); window.App.render(); return out;
    });
    if (bought.includes(false)) { fail('the test things were not bought: ' + bought); await ctx.close(); return; }
    await page.evaluate(() => document.querySelector('[data-sheet-tab="gear"]')?.click()); await wait(350);
    // The weapon: the panel opens, a modification goes in, the slots are counted.
    await page.click('[data-wa-panel] summary'); await wait(200);
    if (!/слоты 0\/3/.test(await page.locator('[data-wa-panel]').innerText())) fail('the weapon panel does not show 0 of 3 slots');
    await page.selectOption('[data-wa-pick]', { index: 0 }); await page.click('[data-wa-action="attach"]'); await wait(400);
    const panel = await page.locator('[data-wa-panel]').innerText();
    if (!/слоты 1\/3/.test(panel)) fail('the modification did not take a slot: ' + panel.replace(/\s+/g, ' ').slice(0, 160));
    if (await onBody(page)) fail('the focus fell to the page body after attaching');
    const att = await state(page, () => JSON.stringify(window.App.active().extra.weapons || window.App.active().weapons));
    if (!/attachments/.test(att)) fail('the attachment is not saved on the weapon');
    // Cyberware slots: the foundation first, then an option that takes slots from it.
    await page.click('#sheet-items [data-eq-action="prepare"]'); await wait(300);
    await page.click('[data-eq-action="commit"]'); await wait(450);
    const before = await page.locator('[data-cs-panel]').innerText();
    if (!/занято 0 из 5/.test(before)) fail('the foundation does not show five free slots: ' + before.replace(/\s+/g, ' ').slice(0, 200));
    await page.click('#sheet-items [data-eq-action="prepare"]'); await wait(300);
    await page.click('[data-eq-action="commit"]'); await wait(450);
    if (!/занято [1-9]/.test(await page.locator('[data-cs-panel]').innerText())) fail('the installed option did not take slots from its foundation');
    // The garage.
    await page.click('[data-gr-action="add"]'); await wait(400);
    const sdp = () => page.locator('[data-garage] [data-gr-row], [data-garage]').first().innerText();
    const t0 = await sdp(), m = t0.match(/(\d+) \/ (\d+) SDP/);
    if (!m) fail('the garage shows no SDP: ' + t0.slice(0, 120));
    else {
      await page.click('[data-gr-action="sdp-minus"]'); await wait(300);
      if (!new RegExp(`${m[1] - 1} / ${m[2]} SDP`).test(await sdp())) fail('SDP −1 did not lower the number');
      if (await onBody(page)) fail('the focus fell to the page body after SDP −1');
    }
    if (await sideways(page) > 0) fail('the gear tab scrolls sideways at 390 px');
    await axeAt(page, '#sheet-items', 'gear tab, native dark 390', fail);
    for (const e of page.errs) fail(e);
    await ctx.close();
  });

  await check('clocks: a pool of dice and a countdown that starts, pauses and survives a reload', async fail => {
    const { ctx, page } = await device({ width: 1280 });
    await page.goto(BASE + '#/gm/clocks'); await wait(500);
    await page.fill('[data-gx-field="draft"]', 'Погоня'); await page.selectOption('[data-gx-field="kind"]', 'pool'); await page.click('[data-gx-action="add"]'); await wait(350);
    if ((await page.locator('[data-gx-action="ct-pool-roll"]').count()) !== 1) { fail('a pool clock was not made'); await ctx.close(); return; }
    await page.click('[data-gx-action="ct-pool-roll"]'); await wait(300);
    if (await onBody(page)) fail('the focus fell to the page body after rolling the pool');
    await page.click('[data-gx-action="ct-open"]'); await wait(250);
    await page.fill('[data-gx-field="ct-cd-min"]', '5'); await page.keyboard.press('Tab'); await wait(300);
    if (!(await page.locator('[data-gx-action="ct-cd-toggle"]').count())) { fail('no countdown after setting minutes'); await ctx.close(); return; }
    await page.click('[data-gx-action="ct-cd-toggle"]'); await wait(1300);
    const running = await page.locator('[data-ct-time]').first().innerText();
    if (!/^0?[0-4]:\d\d|^4:/.test(running.trim()) && !/^\d+:\d\d/.test(running.trim())) fail('the countdown shows no time: ' + running);
    await page.click('[data-gx-action="ct-cd-toggle"]'); await wait(300);
    const paused = await page.locator('[data-ct-time]').first().innerText(); await wait(1500);
    if ((await page.locator('[data-ct-time]').first().innerText()) !== paused) fail('a paused countdown keeps running');
    await page.reload(); await wait(700);
    if ((await page.locator('[data-ct-time]').first().innerText()) !== paused) fail('the countdown time was lost on reload');
    await axeAt(page, '#main-content', 'clocks, native dark 1280', fail);
    for (const e of page.errs) fail(e);
    await ctx.close();
  });

  await check('NET: the generator builds an architecture, and the GM hub opens one pane per tab with the address following', async fail => {
    const { ctx, page } = await device({ width: 390 });
    await page.goto(BASE + '#/net'); await wait(500);
    const n0 = await state(page, () => window.App.getState().netArchitectures.length);
    await page.click('[data-net="gen"]'); await wait(450);
    const made = await state(page, () => { const a = window.App.getState().netArchitectures; return { n: a.length, floors: a[a.length - 1]?.floors?.length || 0 }; });
    if (made.n !== n0 + 1 || made.floors < 3) fail('the generator did not add an architecture with floors: ' + JSON.stringify(made));
    if (await onBody(page)) fail('the focus fell to the page body after generating');
    await page.goto(BASE + '#/gm'); await wait(500);
    for (const tab of ['meeting', 'npc', 'clocks', 'tables', 'market', 'world', 'help']) {
      await page.evaluate(t => document.querySelector(`[data-gmh-tab="${t}"]`)?.click(), tab); await wait(200);
      const seen = await state(page, () => ({ panes: [...new Set([...document.querySelectorAll('[data-gm-pane]')].filter(e => e.getClientRects().length).map(e => e.dataset.gmPane))], sel: [...document.querySelectorAll('[data-gmh-tab][aria-selected="true"]')].map(b => b.dataset.gmhTab), hash: location.hash }));
      if (seen.panes.join() !== tab || seen.sel.join() !== tab || !seen.hash.endsWith('/' + tab)) fail(tab + ': ' + JSON.stringify(seen));
    }
    const tiny = await small(page, '.gmh-tab');
    if (tiny.length) fail('hub tabs under 44 px: ' + tiny.length);
    if (await sideways(page) > 0) fail('the hub scrolls sideways at 390 px');
    await axeAt(page, '#main-content', 'the GM hub, native dark 390', fail);
    for (const e of page.errs) fail(e);
    await ctx.close();
  });

  await check('room page: the server list takes a server and goes back to the defaults', async fail => {
    const { ctx, page } = await device({ width: 1280 });
    await page.goto(BASE + '#/room'); await wait(500);
    const before = await page.locator('[data-room-action="srv-test"]').count();
    await page.fill('#room-server-url', 'wss://example.org/mqtt'); await page.click('[data-room-action="srv-add"]');
    await until(async () => (await page.locator('[data-room-action="srv-test"]').count()) === before + 1, 8000, 100);
    if ((await page.locator('[data-room-action="srv-test"]').count()) !== before + 1) fail('the new server is not in the list');
    if (await onBody(page)) fail('the focus fell to the page body after adding a server');
    await page.click('[data-room-action="srv-reset"]');
    // Reset also drops any custom server the profile was seeded with, so the target is the built-in list.
    const defaults = await page.evaluate(() => window.RoomTransport.DEFAULT_BROKERS.length);
    await until(async () => (await page.locator('[data-room-action="srv-test"]').count()) === defaults, 8000, 100);
    if ((await page.locator('[data-room-action="srv-test"]').count()) !== defaults) fail('Reset did not bring the default servers back');
    await axeAt(page, '[data-room-servers]', 'the server list, native dark 1280', fail);
    for (const e of page.errs) fail(e);
    await ctx.close();
  });
  if (brokerUrl) await check('room: the code and link can be hidden on screen, the hidden code is not in the text, showing brings it back', async fail => {
    const { ctx, page } = await device({ width: 1280 });
    await page.goto(BASE + '#/room'); await wait(400);
    await page.fill('#room-gm-name', 'Мастер'); await page.selectOption('#room-campaign', 'k1'); await page.click('[data-room-action="create"]');
    const code = await until(() => page.evaluate(() => window.Room._test.session()?.code || null));
    if (!code) { fail('the room was not created'); await ctx.close(); return; }
    await wait(300);
    await page.click('[data-room-action="hide-code"]'); await wait(300);
    const hidden = await page.evaluate(() => ({ text: document.querySelector('#main-content').innerText, label: document.querySelector('.room-code')?.getAttribute('aria-label'), hidden: window.Room._test.codeHidden() }));
    if (!hidden.hidden || hidden.text.replace(/[s-]/g, '').includes(code.replace(/[s-]/g, ''))) fail('the code is still on the screen after hiding it');
    if (!hidden.label) fail('the hidden code has no spoken name');
    if (await onBody(page)) fail('the focus fell to the page body after hiding the code');
    await page.click('[data-room-action="hide-code"]'); await wait(300);
    if (!(await page.evaluate(c => document.querySelector('#main-content').innerText.replace(/[s-]/g, '').includes(c.replace(/[s-]/g, '')), code))) fail('showing the code did not bring it back');
    for (const e of page.errs) fail(e);
    await ctx.close();
  });
};
