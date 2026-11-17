/* The checks of the new shell and the ported features. Loaded by run.cjs, which passes what it owns:
   check, device, BASE, wait, until, fs, character, campaign and the accessibility helper axeAt. */
module.exports = async function shellFeatures({ check, device, BASE, wait, until, fs, character, campaign, axeAt, brokerUrl }) {
  const sideways = page => page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  const small = (page, sel) => page.$$eval(sel, els => els.filter(e => e.getClientRects().length).filter(e => { const r = e.getBoundingClientRect(); return r.height < 43.5; }).map(e => (e.dataset && Object.keys(e.dataset)[0]) || e.className || e.tagName));
  const onBody = page => page.evaluate(() => document.activeElement === document.body);

  await check('settings: one page for look, theme (also black), vibration strength and an erase dialog that can be cancelled', async fail => {
    const { ctx, page } = await device({ width: 390 });
    await page.goto(BASE); await wait(400);
    await page.click('.topbar [data-view="settings"]'); await wait(300);
    if (!/#\/settings/.test(page.url())) fail('the gear does not open #/settings: ' + page.url());
    for (const [sel, name] of [['[data-ui-style="board"]', 'the «Досье» look'], ['[data-ui-style="cyber"]', 'the cyber look'], ['[data-ui-theme="black"]', 'the black theme'], ['[data-haptic-level]', 'the vibration strength'], ['[data-dice-volume]', 'the dice volume'], ['[data-set="erase-open"]', 'the erase button'], ['[data-action="lang"][data-lang="en"]', 'the language']]) {
      if (!(await page.locator(sel).first().count())) fail('the page has no ' + name);
    }
    await page.click('#main-content [data-ui-theme="black"]'); await wait(150);
    if (!(await page.evaluate(() => document.documentElement.classList.contains('ui-black')))) fail('the black theme did not set ui-black');
    if ((await page.evaluate(() => document.querySelector('meta[name="theme-color"]')?.content)) !== '#000000') fail('the black theme does not set the browser colour');
    await page.click('#main-content [data-ui-style="cyber"]'); await wait(200);
    if (!(await page.locator('#set-theme-note:not([hidden])').count())) fail('the cyber look shows no note that light and black do not apply');
    await page.click('#main-content [data-ui-style="native"]'); await wait(200);
    await page.fill('[data-haptic-level]', '3'); await page.dispatchEvent('[data-haptic-level]', 'input'); await page.dispatchEvent('[data-haptic-level]', 'change');
    if ((await page.evaluate(() => localStorage.getItem('nc-haptics-level'))) !== '3') fail('the vibration strength is not kept');
    // The erase dialog: a second step, a typed word, and Cancel changes nothing.
    const before = await page.evaluate(() => localStorage.getItem('nightcity-red-v1'));
    await page.click('[data-set="erase-open"]'); await wait(250);
    if (!(await page.locator('[data-set="erase-go"]').isDisabled())) fail('the erase button is enabled before anything is confirmed');
    if (!(await page.evaluate(() => !!document.activeElement?.closest('[data-set-erase]')))) fail('the focus did not move into the erase step');
    await page.click('[data-set="erase-cancel"]'); await wait(250);
    if (await page.locator('[data-set-erase]').count()) fail('Cancel left the erase step open');
    if (await onBody(page)) fail('the focus fell to the page body after Cancel');
    if ((await page.evaluate(() => localStorage.getItem('nightcity-red-v1'))) !== before) fail('cancelling the erase changed the saved data');
    if (await sideways(page) > 0) fail('the settings page scrolls sideways at 390 px');
    const tiny = await small(page, '#main-content button, #main-content select');
    if (tiny.length) fail('settings controls under 44 px: ' + tiny.slice(0, 5).join(', '));
    await axeAt(page, '#main-content', 'settings, native dark 390', fail);
    for (const e of page.errs) fail(e);
    await ctx.close();
    for (const [look, theme] of [['board', 'black'], ['cyber', 'dark']]) {
      const o = await device({ width: 1280, look, theme }); await o.page.goto(BASE + '#/settings'); await wait(400);
      await axeAt(o.page, '#main-content', `settings, ${look} ${theme}`, fail);
      await o.ctx.close();
    }
  });

  await check('sheet: quick rolls rail with a starred skill, the breakdown of a number, a remembered skill grouping and the health pad', async fail => {
    const { ctx, page } = await device({ width: 390 });
    await page.goto(BASE + '#/sheet/v1'); await wait(500);
    if (!(await page.locator('.quick-rail [data-keep="qr-init"]').count())) fail('no Initiative in the quick rolls');
    await page.click('.sheet-tabs [data-sheet-tab="skills"]'); await wait(250);
    await page.click('[data-quick-star="Athletics"]'); await wait(300);
    if (!(await page.locator('.quick-rail [data-proxy-roll*="Athletics"]').count())) fail('a starred Skill did not appear in the rail');
    if (await onBody(page)) fail('the focus fell to the page body after starring');
    const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('nightcity-red-v1')).characters.find(c => c.id === 'v1').extra?.quickRolls);
    if (!saved) fail('the starred Skill is not saved on the character');
    const rolls = () => page.evaluate(() => window.App.getState().history.length);
    const h0 = await rolls();
    // The rail is part of the first screen of the sheet: back on the main tab it is pressed like any button.
    await page.click('.sheet-tabs [data-sheet-tab="main"]'); await page.evaluate(() => window.scrollTo(0, 0)); await wait(350);
    await page.click('.quick-rail [data-proxy-roll*="Athletics"]'); await wait(300);
    if (await rolls() !== h0 + 1) fail('the rail button did not roll the Skill into the history');
    // The breakdown dialog from a Skill name: a labelled dialog that gives the focus back.
    await page.click('.sheet-tabs [data-sheet-tab="skills"]'); await wait(250);
    await page.click('.skill-name[data-detail-open="skill:Evasion"]'); await wait(300);
    const dlg = await page.evaluate(() => { const d = document.querySelector('[role="dialog"], dialog[open]'); return d ? { label: d.getAttribute('aria-label') || d.getAttribute('aria-labelledby'), inside: !!document.activeElement?.closest('[role="dialog"], dialog') } : null; });
    if (!dlg || !dlg.label || !dlg.inside) fail('the breakdown is not a labelled dialog with the focus inside: ' + JSON.stringify(dlg));
    await axeAt(page, '[role="dialog"], dialog[open]', 'the breakdown dialog, native dark 390', fail);
    await page.keyboard.press('Escape'); await wait(250);
    if (!(await page.evaluate(() => document.activeElement?.matches('[data-detail-open]')))) fail('Escape did not give the focus back to the Skill name');
    // The health pad: a step, then Undo.
    await page.click('.sheet-tabs [data-sheet-tab="main"]'); await wait(200);
    await page.click('[data-hud-hp]'); await wait(200);
    await page.click('[data-hp-step="-5"]'); await wait(250);
    if ((await page.evaluate(() => window.App.active().hp)) !== 40) fail('the -5 step did not give 40');
    if (await page.locator('[data-hp-undo]').count()) { await page.click('[data-hp-undo]'); await wait(250); if ((await page.evaluate(() => window.App.active().hp)) !== 45) fail('Undo did not bring the HP back'); }
    else fail('no Undo after a change');
    for (const e of page.errs) fail(e);
    await ctx.close();
  });

  await check('combat table: a group of mooks with one initiative, Next turn, the bin for a deleted campaign', async fail => {
    const { ctx, page } = await device({ width: 390 });
    await page.goto(BASE + '#/combat'); await wait(500);
    if (!(await page.locator('[data-cd-action="next"]').count())) { fail('no Next turn on the combat page'); await ctx.close(); return; }
    await page.click('summary:has-text("Добавить в бой")'); await wait(150);
    await page.fill('[data-cd-new="name"]', 'Бустер'); await page.fill('[data-cd-new="count"]', '3'); await page.fill('[data-cd-new="hp"]', '12'); await page.fill('[data-cd-new="ref"]', '6');
    await page.click('[data-cd-action="add-npc"]'); await wait(350);
    const c = await page.evaluate(() => { const k = window.App.getState().campaigns[0]; return { rows: k.roster.filter(r => r.grp).length, groups: (k.groups || []).length }; });
    if (c.rows !== 3 || c.groups !== 1) fail('three mooks did not become one group: ' + JSON.stringify(c));
    const ini = await page.evaluate(() => [...new Set(window.App.getState().campaigns[0].roster.filter(r => r.grp).map(r => r.initiative))].length);
    if (ini !== 1) fail('the members of a group have ' + ini + ' different initiatives');
    const round = () => page.evaluate(() => { const k = window.App.getState().campaigns[0]; return k.round + ':' + k.turnIndex; });
    const r0 = await round();
    await page.click('[data-cd-action="next"]'); await wait(250);
    if ((await round()) === r0) fail('Next turn did not move the turn');
    if (!(await page.evaluate(() => document.activeElement?.matches('[data-cd-action="next"]')))) fail('the focus left Next turn after pressing it');
    const tiny = await small(page, '#main-content .cd-next, #main-content [data-cd-action="roll-all"], #main-content [data-cd-action="select"]');
    if (tiny.length) fail('combat controls under 44 px: ' + tiny.join(', '));
    if (await sideways(page) > 0) fail('the combat page scrolls sideways at 390 px');
    await axeAt(page, '#main-content', 'combat table, native dark 390', fail);
    // Deleting a campaign puts it in the bin and can be taken back.
    await page.goto(BASE + '#/campaigns'); await wait(400);
    await page.click('[data-campaign-action="open"][data-id="k1"]'); await wait(300);
    await page.evaluate(() => { document.querySelector('[data-campaign-action="delete"]')?.click(); }); await wait(400);
    const after = await page.evaluate(() => ({ camps: window.App.getState().campaigns.length, bin: (window.App.getState().bin || []).filter(b => b.kind === 'campaign').length }));
    if (after.camps !== 0 || after.bin < 1) fail('a deleted campaign is not in the bin: ' + JSON.stringify(after));
    if (await page.locator('#app-notice .notice-action').count()) { await page.click('#app-notice .notice-action'); await wait(350); if ((await page.evaluate(() => window.App.getState().campaigns.length)) !== 1) fail('Undo did not bring the campaign back'); }
    else fail('no Undo after deleting a campaign');
    for (const e of page.errs) fail(e);
    await ctx.close();
  });
};
