/* The checks of how the page loads: the skeleton before the script, and the lazily loaded screens (scripts/chunks.mjs,
   site/lazy-chunks.js), online, with a broken network and offline. Loaded by run.cjs, which passes what it owns. */
module.exports = async function loadFeatures({ check, device, BASE, wait, until }) {
  const realHeading = page => page.evaluate(() => { const h = document.querySelector('#app .content h1'); return !!h && !document.querySelector('#app .nc-lazy') ? h.textContent.trim() : ''; });
  const onBody = page => page.evaluate(() => document.activeElement === document.body || !document.activeElement);

  await check('first paint: the skeleton is on the page before the script has run, in every look, and the app takes its place', async fail => {
    for (const [theme, bg] of [['dark', 'rgb(11, 11, 13)'], ['light', 'rgb(242, 242, 244)'], ['black', 'rgb(0, 0, 0)']]) {
      const { ctx, page } = await device({ width: 390, theme });
      let release; const gate = new Promise(r => { release = r; });
      await ctx.route('**/nc-red.js*', async route => { await gate; await route.continue().catch(() => {}); });
      const going = page.goto(BASE, { waitUntil: 'commit' }).catch(() => {});
      const shown = await until(() => page.evaluate(() => { const s = document.querySelector('#app .nc-skel-load'); return !!s && s.getBoundingClientRect().height > 0; }).catch(() => false), 10000, 50);
      if (!shown) fail(theme + ': no skeleton before the script');
      else {
        const info = await page.evaluate(() => ({
          bg: getComputedStyle(document.querySelector('.nc-skel')).backgroundColor,
          text: document.querySelector('.nc-skel-load').textContent.replace(/\s+/g, ' '),
          busy: document.querySelector('#app').getAttribute('aria-busy'),
          heading: !!document.querySelector('#app h1'),
          nav: document.querySelector('.nc-skel-nav').getBoundingClientRect().bottom,
          vh: innerHeight,
          sideways: document.documentElement.scrollWidth - document.documentElement.clientWidth,
          booted: typeof window.App,
        }));
        if (info.bg !== bg) fail(`${theme}: the skeleton is ${info.bg}, not ${bg}`);
        if (!/Загрузка/.test(info.text) || !/Loading/.test(info.text)) fail(theme + ': the loading text is not in both languages: ' + info.text);
        if (info.busy !== 'true') fail(theme + ': #app is not marked busy');
        if (info.heading) fail(theme + ': the skeleton has a heading');
        if (Math.abs(info.nav - info.vh) > 1) fail(theme + ': the bottom bar is not at the bottom of the phone');
        if (info.sideways > 0) fail(theme + ': the skeleton scrolls sideways');
        if (info.booted !== 'undefined') fail(theme + ': the script ran before it was released');
      }
      release(); await going;
      if (!(await until(() => realHeading(page), 15000, 50))) fail(theme + ': the app did not replace the skeleton');
      else if (await page.evaluate(() => !!document.querySelector('.nc-skel'))) fail(theme + ': the skeleton is still there');
      if (await page.evaluate(() => document.documentElement.classList.contains('nc-css'))) fail(theme + ': the guard against unstyled content was not lifted');
      for (const e of page.errs) fail(theme + ': ' + e);
      await ctx.close();
    }
  });

  await check('the first load carries the core file only; each lazy screen asks for its own file once, draws, and keeps working', async fail => {
    const { ctx, page } = await device({ width: 390 });
    await page.goto(BASE + '#/overview');
    if (!(await until(() => realHeading(page), 10000, 50))) { fail('the first screen did not appear'); await ctx.close(); return; }
    const scripts = await page.evaluate(() => [...document.scripts].map(s => s.src.replace(/^.*\//, '').replace(/\?.*/, '')).filter(Boolean));
    if (scripts.join() !== 'nc-red.js') fail('the first load asks for more than the core file: ' + scripts.join());
    const globals = { book: 'Book', 'builder-choice': 'Builder', builder: 'Builder', catalog: 'ShopCart', combat: 'HazardTools', repair: 'RepairTools', medical: 'CyberSurgery' };
    for (const g of new Set(Object.values(globals))) if (await page.evaluate(n => typeof window[n] !== 'undefined', g)) fail(g + ' is loaded before its screen is opened');
    for (const [view, g] of Object.entries(globals)) {
      await page.goto(BASE + '#/' + view);
      if (!(await until(() => realHeading(page), 8000, 50))) { fail(view + ': the screen did not appear'); continue; }
      if (!(await page.evaluate(n => typeof window[n] !== 'undefined', g))) fail(`${view}: ${g} is missing after the screen drew`);
      for (const e of page.errs.splice(0)) fail(`${view}: ${e}`);
    }
    // the same screens again: no second request for a file that has run
    for (const view of ['book', 'catalog', 'combat']) { await page.goto(BASE + '#/overview'); await wait(60); await page.goto(BASE + '#/' + view); await wait(150); }
    const twice = await page.evaluate(() => [...document.scripts].map(s => s.src.replace(/^.*\//, '').replace(/\?.*/, '')).filter(Boolean).filter((n, i, a) => a.indexOf(n) !== i));
    if (twice.length) fail('a file was loaded twice: ' + twice.join());
    // the book is really there, not only its global: the «choose a PDF» control
    await page.goto(BASE + '#/book'); await wait(200);
    if (!(await page.locator('#book-file, #book-file-empty').count())) fail('the book screen has no file chooser');
    await ctx.close();
  });

  await check('the «open page» links reach the book through the loader: the page number is kept while the file loads', async fail => {
    const { ctx, page } = await device({ width: 390 });
    await page.goto(BASE + '#/rules');
    if (!(await until(() => realHeading(page), 10000, 50))) { fail('the rules did not appear'); await ctx.close(); return; }
    const link = page.locator('[data-action="book-page"]').first();
    if (!(await link.count())) { fail('no «open page» link on the rules screen'); await ctx.close(); return; }
    const want = await link.getAttribute('data-page');
    if (await page.evaluate(() => typeof window.Book !== 'undefined')) fail('the book is loaded before it is needed');
    await link.click({ timeout: 5000 });
    if (!(await until(() => page.evaluate(() => window.App.getState().view === 'book' && typeof window.Book !== 'undefined' && !document.querySelector('#app .nc-lazy')), 8000, 50))) fail('the book did not open');
    else {
      const page1 = await page.evaluate(() => window.Book.getPage());
      if (String(page1) !== String(want)) fail(`the page is ${page1}, not ${want}`);
    }
    if (await onBody(page)) fail('the focus fell to the page after the book opened');
    for (const e of page.errs) fail(e);
    await ctx.close();
  });

  for (const lang of ['ru', 'en']) {
    await check(`a lazy file that cannot be loaded shows a retry card (${lang}) and the retry brings the screen`, async fail => {
      const { ctx, page } = await device({ width: 390, lang });
      await page.goto(BASE + '#/overview');
      if (!(await until(() => realHeading(page), 10000, 50))) { fail('the first screen did not appear'); await ctx.close(); return; }
      let asked = 0; page.on('request', r => { if (/nc-nowhere/.test(r.url())) asked++; });
      const good = await page.evaluate(() => { const u = window.NC_CHUNKS.book.u; window.NC_CHUNKS.book.u = 'nc-nowhere.js?v=0'; return u; });
      await page.goto(BASE + '#/book');
      const card = await until(() => page.evaluate(() => !!document.querySelector('#app .nc-lazy [data-lazy-retry]')), 8000, 50);
      if (!card) { fail('no retry card'); await ctx.close(); return; }
      const shown = await page.evaluate(() => ({ role: document.querySelector('.nc-lazy').getAttribute('role'), text: document.querySelector('.nc-lazy').textContent, h: document.querySelector('.nc-lazy button').getBoundingClientRect().height }));
      if (shown.role !== 'alert') fail('the failure is not announced: role=' + shown.role);
      if (!(lang === 'ru' ? /Не удалось загрузить раздел/ : /could not be loaded/).test(shown.text)) fail('wrong language or text: ' + shown.text);
      if (shown.h < 43.5) fail('the retry button is ' + shown.h + ' px high');
      await wait(300);
      if (asked !== 1) fail('the failed file was requested ' + asked + ' times, not once');
      await page.evaluate(u => { window.NC_CHUNKS.book.u = u; }, good);
      await page.focus('[data-lazy-retry]'); await page.keyboard.press('Enter');
      if (!(await until(() => realHeading(page), 8000, 50))) fail('the retry did not bring the screen');
      else if (!(await page.evaluate(() => typeof window.Book !== 'undefined'))) fail('Book is missing after the retry');
      if (await onBody(page)) fail('the focus fell to the page after the retry');
      for (const e of page.errs.filter(x => !/nc-nowhere|404|Failed to load|MIME|net::/.test(x))) fail(e);
      await ctx.close();
    });
  }

  await check('offline: the installed app opens every lazy screen from its own copy of the files', async fail => {
    const { ctx, page } = await device({ width: 390 });
    await page.goto(BASE + '#/overview');
    const active = await until(() => page.evaluate(() => navigator.serviceWorker?.getRegistration().then(r => !!r?.active && !!navigator.serviceWorker.controller)), 20000);
    if (!active) { fail('the service worker did not take control'); await ctx.close(); return; }
    // every file the page can ask for is in the cache the worker filled when it installed
    const cached = await page.evaluate(async () => {
      const names = (await caches.keys()).filter(n => n.startsWith('nc-red-app-')), cache = await caches.open(names[0]);
      const wanted = Object.values(window.NC_CHUNKS).map(c => c.u), have = [];
      for (const u of wanted) if (await cache.match(new URL(u, location.href).href)) have.push(u);
      return { wanted, have };
    });
    if (cached.have.length !== cached.wanted.length) fail('not every lazy file is in the offline copy: ' + cached.wanted.filter(u => !cached.have.includes(u)).join());
    await ctx.setOffline(true);
    await page.reload().catch(e => fail('offline reload failed: ' + e.message.split('\n')[0]));
    if (!(await until(() => realHeading(page), 8000, 100))) fail('nothing is drawn offline');
    for (const [view, g] of [['book', 'Book'], ['builder', 'Builder'], ['catalog', 'ShopCart'], ['combat', 'HazardTools'], ['repair', 'RepairTools'], ['medical', 'CyberSurgery']]) {
      await page.goto(BASE + '#/' + view);
      if (!(await until(() => realHeading(page), 8000, 100))) fail(view + ': does not open offline');
      else if (!(await page.evaluate(n => typeof window[n] !== 'undefined', g))) fail(`${view}: ${g} is missing offline`);
    }
    await ctx.setOffline(false);
    await ctx.close();
  });
};
