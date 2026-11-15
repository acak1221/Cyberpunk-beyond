/* Browser smoke run against the production bundle: every screen opens without errors in both languages, the keyboard
   basics work, the installed app starts offline, and two browsers meet in a room over a local MQTT broker.

   Needs Playwright with Chromium. The room check also needs `aedes` and `ws`, and the accessibility check `axe-core`;
   without them those two checks are skipped with a note. CI installs all of them (see .github/workflows/deploy.yml):

     npm install --no-save playwright@1.63.0 aedes@0.51.3 ws@8.22.2 axe-core@4.14.0
     npx playwright install --with-deps chromium
     npm run e2e */
const { execFileSync, spawn } = require('node:child_process');
const fs = require('node:fs'), os = require('node:os'), path = require('node:path'), net = require('node:net'), http = require('node:http');

const ROOT = path.join(__dirname, '..', '..');
const VIEWS = ['overview', 'characters', 'lifepath', 'rules', 'catalog', 'combat', 'net', 'medical', 'repair', 'gm', 'dice', 'campaigns', 'book', 'builder-choice', 'builder', 'quick-builder', 'news', 'room', 'sheet/v1'];
const optional = name => { try { return require(name); } catch { return null; } };
const wait = ms => new Promise(r => setTimeout(r, ms));
const freePort = () => new Promise((resolve, reject) => { const s = net.createServer(); s.once('error', reject); s.listen(0, '127.0.0.1', () => { const { port } = s.address(); s.close(() => resolve(port)); }); });
const until = async (fn, ms = 15000, step = 200) => { const end = Date.now() + ms; for (;;) { const v = await fn().catch(() => null); if (v) return v; if (Date.now() > end) return null; await wait(step); } };

const character = { id: 'v1', name: 'Vee', role: 'solo', rank: 4, stats: { INT: 6, REF: 7, DEX: 6, TECH: 6, COOL: 6, WILL: 6, LUCK: 6, MOVE: 6, BODY: 8, EMP: 6 }, skills: { Evasion: 4, Athletics: 2 }, hp: 45, humanity: 60, head: 11, bodyArmor: 11 };
const campaign = { id: 'k1', name: 'Job', notes: '', round: 1, turnIndex: 0, roster: [{ id: 'r1', kind: 'npc', name: 'Ganger', ref: 6, hp: 20, initiative: 12, order: 1 }] };

async function main() {
  const playwright = optional('playwright');
  if (!playwright) { console.error('Playwright is not installed: npm install --no-save playwright && npx playwright install chromium'); process.exit(2); }
  const out = fs.mkdtempSync(path.join(os.tmpdir(), 'ncred-e2e-'));
  execFileSync(process.execPath, [path.join(ROOT, 'scripts', 'build.mjs'), out], { stdio: 'pipe' });
  const port = await freePort(), BASE = `http://127.0.0.1:${port}/`;
  const server = spawn(process.execPath, [path.join(ROOT, 'scripts', 'serve.mjs'), out, '--port', String(port)], { stdio: 'ignore' });
  const cleanup = [() => server.kill()];
  let brokerUrl = null;
  const aedesFactory = optional('aedes'), ws = optional('ws');
  if (aedesFactory && ws) {
    const aedes = (aedesFactory.createBroker || aedesFactory.default || aedesFactory)(), brokerPort = await freePort(), srv = http.createServer();
    const wss = new ws.WebSocketServer({ server: srv, handleProtocols: p => (p.has('mqtt') ? 'mqtt' : false) });
    wss.on('connection', socket => aedes.handle(ws.createWebSocketStream(socket)));
    await new Promise(r => srv.listen(brokerPort, '127.0.0.1', r));
    brokerUrl = `ws://127.0.0.1:${brokerPort}`;
    cleanup.push(() => { wss.close(); srv.close(); aedes.close(); });
  }
  if (!(await until(() => fetch(BASE).then(r => r.ok)))) throw new Error('the preview server did not start');

  const browser = await playwright.chromium.launch();
  cleanup.push(() => browser.close());
  const results = [];
  const NOISE = /WebSocket|ERR_INTERNET_DISCONNECTED|ERR_CONNECTION|Failed to load resource|fonts\.g/;
  // One browser profile with saved data, like a returning player.
  async function device({ lang = 'ru', look = 'native', theme = 'dark', data = true, width = 1280 } = {}) {
    // No motion: a color measured in the middle of a fade-in is not the color the player reads.
    const ctx = await browser.newContext({ viewport: { width, height: 844 }, reducedMotion: 'reduce' });
    await ctx.addInitScript(([state, brokers, style, mode]) => {
      if (sessionStorage.getItem('seeded')) return;
      if (state) localStorage.setItem('nightcity-red-v1', state);
      if (brokers) localStorage.setItem('nightcity-red-room-brokers', brokers);
      localStorage.setItem('nc-ui-style', style);
      localStorage.setItem('nc-ui-theme', mode);
      sessionStorage.setItem('seeded', '1');
    }, [data ? JSON.stringify({ characters: [character], campaigns: [campaign], lang }) : null, brokerUrl ? JSON.stringify([{ url: brokerUrl }]) : null, look, theme]);
    const page = await ctx.newPage();
    page.errs = [];
    page.on('pageerror', e => page.errs.push('page error: ' + e.message));
    page.on('console', m => { if (m.type() === 'error' && !NOISE.test(m.text())) page.errs.push('console: ' + m.text()); });
    page.on('dialog', d => d.accept().catch(() => {}));
    return { ctx, page };
  }
  async function check(name, fn) {
    const problems = [], t0 = Date.now();
    try { await fn(msg => problems.push(msg)); } catch (e) { problems.push('crashed: ' + (e && e.message || e).toString().split('\n')[0]); }
    results.push({ name, problems });
    console.log(`${problems.length ? 'FAIL' : 'ok  '} ${name} (${((Date.now() - t0) / 1000).toFixed(1)} s)`);
    for (const p of problems.slice(0, 12)) console.log('     - ' + p);
  }
  const skip = (name, why) => { results.push({ name, problems: [], skipped: true }); console.log(`skip ${name}: ${why}`); };

  for (const lang of ['ru', 'en']) {
    await check(`every screen opens without errors (${lang})`, async fail => {
      const { ctx, page } = await device({ lang });
      for (const view of VIEWS) {
        await page.goto(BASE + '#/' + view);
        if (!(await until(() => page.evaluate(() => !!document.querySelector('#app .content h1')), 5000, 50))) fail(`${view}: no heading`);
        await wait(120);
        for (const e of page.errs.splice(0)) fail(`${view}: ${e}`);
        if (lang === 'en') {
          // Interface text only: what the player typed and the Russian title of the look switcher stay as they are.
          const leaks = await page.evaluate(() => {
            const found = [], walker = document.createTreeWalker(document.querySelector('#app'), NodeFilter.SHOW_TEXT);
            for (let n; (n = walker.nextNode());) { const text = n.nodeValue.trim(); if (/[А-Яа-яЁё]/.test(text) && !n.parentElement.closest('[lang="ru"],[data-ui-style],[data-lang],script,style')) found.push(text.slice(0, 60)); }
            return [...new Set(found)].slice(0, 5);
          });
          for (const text of leaks) fail(`${view}: Russian text in the English interface: «${text}»`);
        }
      }
      await ctx.close();
    });
  }

  await check('a new player gets the first screen and can make a character', async fail => {
    const { ctx, page } = await device({ data: false, width: 390 });
    await page.goto(BASE);
    if (!(await until(() => page.evaluate(() => !!document.querySelector('#app .content h1')), 5000, 50))) fail('the first screen did not appear');
    await page.goto(BASE + '#/quick-builder'); await wait(300);
    if (!(await page.$('#app .content h1'))) fail('the quick builder did not open');
    for (const e of page.errs) fail(e);
    await ctx.close();
  });

  await check('keyboard: skip link, named roll buttons, focus kept after a roll', async fail => {
    const { ctx, page } = await device();
    await page.goto(BASE + '#/sheet/v1'); await wait(500);
    await page.evaluate(() => { try { localStorage.setItem('nightcity-red-sheet-tab-v1', 'skills'); } catch {} });
    await page.reload(); await wait(500);
    await page.keyboard.press('Tab');
    if (!(await page.evaluate(() => document.activeElement?.classList.contains('skip-link')))) fail('the first Tab stop is not the skip link');
    await page.keyboard.press('Enter'); await wait(100);
    if (!(await page.evaluate(() => document.activeElement?.id === 'main-content'))) fail('the skip link does not move the focus to the content');
    const label = await page.$eval('[data-action="skill-roll"][data-skill="Athletics"]', b => b.getAttribute('aria-label')).catch(() => null);
    if (!/Атлетика, \+\d+$/.test(label || '')) fail('the roll button has no spoken name: ' + label);
    await page.focus('[data-action="skill-roll"][data-skill="Athletics"]'); await page.keyboard.press('Enter'); await wait(300);
    const after = await page.evaluate(() => ({ skill: document.activeElement?.dataset?.skill, rolls: window.App.getState().history.length }));
    if (after.rolls !== 1) fail('the roll was not recorded');
    if (after.skill !== 'Athletics') fail('the focus left the roll button');
    for (const e of page.errs) fail(e);
    await ctx.close();
  });

  await check('phone: the menu drawer takes the focus and gives it back', async fail => {
    const { ctx, page } = await device({ width: 390 });
    await page.goto(BASE + '#/overview'); await wait(400);
    await page.evaluate(() => document.querySelector('.menu-toggle').click()); await wait(450);
    const open = await page.evaluate(() => ({ inside: !!document.activeElement?.closest('#app-sidebar'), inert: document.querySelector('.content').inert }));
    if (!open.inside || !open.inert) fail('the open drawer: ' + JSON.stringify(open));
    await page.keyboard.press('Escape'); await wait(250);
    const closed = await page.evaluate(() => ({ toggle: document.activeElement?.classList.contains('menu-toggle'), inert: document.querySelector('.content').inert }));
    if (!closed.toggle || closed.inert) fail('after Escape: ' + JSON.stringify(closed));
    for (const e of page.errs) fail(e);
    await ctx.close();
  });

  await check('what is new: the unread dot goes away after a visit, and the report shows exactly what is sent', async fail => {
    // A new player has nothing unread: everything is new to them.
    const fresh = await device({ data: false, width: 390 });
    await fresh.page.goto(BASE + '#/overview'); await wait(400);
    if (await fresh.page.$('.wn-dot')) fail('a new player sees the unread dot');
    for (const e of fresh.page.errs) fail('new player: ' + e);
    await fresh.ctx.close();

    const { ctx, page } = await device({ width: 390 });
    await page.goto(BASE + '#/overview'); await wait(400);
    const before = await page.evaluate(() => ({ more: !!document.querySelector('.bottom-nav [data-shell="menu"] .wn-dot'), item: !!document.querySelector('.nav-item[data-view="news"] .wn-dot'), name: document.querySelector('.nav-item[data-view="news"]')?.textContent || '' }));
    if (!before.more || !before.item) fail('a returning player has no unread dot: ' + JSON.stringify(before));
    if (!/Что нового.*есть новое/.test(before.name)) fail('the menu item does not say that something is new: ' + before.name);
    // Reached the way a player does: the «Ещё» button, then the menu item.
    await page.click('.bottom-nav [data-shell="menu"]'); await wait(450);
    await page.click('.nav-item[data-view="news"]'); await wait(400);
    const shown = await page.evaluate(() => ({ hash: location.hash, h1: document.querySelector('#app .content h1')?.textContent, cards: document.querySelectorAll('.wn-release').length, releases: window.WhatsNew.RELEASES.length, tagged: [...document.querySelectorAll('.wn-release')].filter(c => c.querySelector('.wn-new')).map(c => c.dataset.wnRelease), latest: String(window.WhatsNew.latest()), dots: document.querySelectorAll('.wn-dot').length, stored: localStorage.getItem('nc-news-seen'), sideways: document.documentElement.scrollWidth > document.documentElement.clientWidth }));
    if (shown.hash !== '#/news' || shown.h1 !== 'Что нового') fail('the page did not open: ' + JSON.stringify(shown));
    if (shown.cards !== shown.releases || shown.cards < 2) fail('not every release is listed: ' + shown.cards);
    if (shown.tagged.join() !== shown.latest) fail('only the newest release should be tagged as new: ' + shown.tagged.join());
    if (shown.dots) fail('the dot is still there on the page itself');
    if (shown.stored !== shown.latest) fail('the visit was not remembered: ' + shown.stored);
    if (shown.sideways) fail('the page scrolls sideways on a phone');
    await page.reload(); await wait(500);
    const after = await page.evaluate(() => ({ dots: document.querySelectorAll('.wn-dot').length, tags: document.querySelectorAll('.wn-new').length }));
    if (after.dots || after.tags) fail('after a reload something is still marked as new: ' + JSON.stringify(after));

    await page.click('[data-wn-report="bottom"]'); await wait(300);
    const dlg = await page.evaluate(() => {
      const d = document.querySelector('dialog.wn-dialog[open]'); if (!d) return null;
      const link = d.querySelector('[data-wn-go]'), u = new URL(link.href);
      return { modal: d.matches(':modal'), inside: d.contains(document.activeElement), href: link.href, target: link.target, rel: link.rel, sent: u.searchParams.get('title') + '\n\n' + u.searchParams.get('body'), params: [...u.searchParams.keys()].join(), preview: d.querySelector('.wn-preview').textContent, text: d.textContent,
        small: [...d.querySelectorAll('a,button')].filter(b => b.getBoundingClientRect().height < 44).map(b => b.textContent.trim()), wide: d.getBoundingClientRect().right > innerWidth || d.scrollWidth > d.clientWidth };
    });
    if (!dlg) fail('the report dialog did not open');
    else {
      if (!dlg.modal || !dlg.inside) fail('the dialog is not modal or the focus is outside it');
      if (!dlg.href.startsWith('https://github.com/acak1221/Cyberpunk-beyond/issues/new?') || dlg.params !== 'title,body') fail('the link: ' + dlg.href.slice(0, 90));
      if (dlg.target !== '_blank' || !/noopener/.test(dlg.rel) || !/noreferrer/.test(dlg.rel)) fail('the link must open a new tab without an opener or a referrer');
      if (dlg.sent !== dlg.preview) fail('the text shown is not the text in the link');
      if (!/Версия: 2\.0, выпуск \d+, сборка [0-9a-f]{6,16}\n- Оформление: Обычное, тёмная тема\n- Язык: ru\n- Браузер: [A-Za-z ]+ \d+, \w+$/.test(dlg.preview)) fail('the report does not end with the four lines about the app: ' + dlg.preview.slice(-160));
      // The seeded character, its id, the campaign, the page address and the raw user agent stay out.
      for (const leak of ['Vee', 'v1', 'Job', 'Ganger', 'sheet', 'news', '127.0.0.1', 'Mozilla', 'Headless']) if (dlg.preview.includes(leak) || decodeURIComponent(dlg.href).includes(leak)) fail('the report contains «' + leak + '»');
      if (dlg.small.length) fail('controls under 44px: ' + dlg.small.join(', '));
      if (dlg.wide) fail('the dialog does not fit a phone');
      await page.click('[data-wn-copy]'); await wait(200);
      const said = await page.evaluate(() => { const s = document.querySelector('.wn-dialog [data-wn-status]'); return s && !s.hidden ? s.textContent : ''; });
      if (!said) fail('copying says nothing');
      await page.keyboard.press('Escape'); await wait(250);
      const closed = await page.evaluate(() => ({ gone: !document.querySelector('.wn-dialog'), back: document.activeElement?.dataset?.wnReport }));
      if (!closed.gone || closed.back !== 'bottom') fail('after Escape: ' + JSON.stringify(closed));
    }
    for (const e of page.errs) fail(e);
    await ctx.close();
  });

  await check('what is new: the «Досье» look on a phone, a change of screen under the dialog, another tab, and the link on a wide screen', async fail => {
    // «Досье», light theme, phone: its menu and bottom bar stay dark, and its buttons are 40px unless told otherwise.
    const phone = await device({ look: 'board', theme: 'light', width: 390 });
    await phone.page.goto(BASE + '#/overview'); await wait(400);
    const dots = await phone.page.evaluate(() => {
      const lum = c => { const [r, g, b] = c.match(/[\d.]+/g).slice(0, 3).map(v => { v /= 255; return v <= .03928 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4; }); return .2126 * r + .7152 * g + .0722 * b; };
      const under = el => { for (let e = el.parentElement; e; e = e.parentElement) { const c = getComputedStyle(e).backgroundColor, a = c.match(/[\d.]+/g); if (a.length < 4 || Number(a[3]) > .9) return c; } return 'rgb(255, 255, 255)'; };
      return [...document.querySelectorAll('.sidebar .wn-dot, .bottom-nav .wn-dot')].map(d => { const a = lum(getComputedStyle(d).backgroundColor), b = lum(under(d)); return (Math.max(a, b) + .05) / (Math.min(a, b) + .05); });
    });
    if (dots.length !== 2) fail('expected a dot in the menu and on «Ещё», found ' + dots.length);
    for (const r of dots) if (r < 3) fail('the unread dot is too dim on its background in the light «Досье»: ' + r.toFixed(2) + ':1');
    await phone.page.goto(BASE + '#/news'); await wait(400);
    const low = await phone.page.evaluate(() => [...document.querySelectorAll('[data-wn-report]')].map(b => b.getBoundingClientRect().height).filter(h => h < 44));
    if (low.length) fail('report buttons under 44px in «Досье» on a phone: ' + low.join());
    await phone.page.click('[data-wn-report="top"]'); await wait(300);
    const lowDlg = await phone.page.evaluate(() => { const d = document.querySelector('dialog.wn-dialog[open]'); return d ? [...d.querySelectorAll('a,button')].map(b => b.getBoundingClientRect().height).filter(h => h < 44) : null; });
    if (!lowDlg) fail('the report dialog did not open in «Досье»');
    else if (lowDlg.length) fail('dialog controls under 44px in «Досье» on a phone: ' + lowDlg.join());
    // The phone's Back button or a link changes the screen: the dialog must not stay on top of it.
    await phone.page.evaluate(() => { location.hash = '#/dice'; }); await wait(400);
    const moved = await phone.page.evaluate(() => ({ hash: location.hash, dialog: !!document.querySelector('dialog.wn-dialog'), focus: document.activeElement?.id || document.activeElement?.tagName }));
    if (moved.hash !== '#/dice' || moved.dialog) fail('the dialog stays open over another screen: ' + JSON.stringify(moved));
    if (moved.focus !== 'main-content') fail('after the dialog closed on another screen the focus is lost: ' + moved.focus);
    await phone.page.goto(BASE + '#/news'); await wait(300);
    await phone.page.click('[data-wn-report="bottom"]'); await wait(300);
    await phone.page.goBack(); await wait(400);
    const back = await phone.page.evaluate(() => ({ hash: location.hash, dialog: !!document.querySelector('dialog.wn-dialog'), focus: document.activeElement?.id || document.activeElement?.tagName }));
    if (back.dialog || back.focus === 'BODY') fail('after Back with the dialog open: ' + JSON.stringify(back));
    for (const e of phone.page.errs) fail('phone: ' + e);
    await phone.ctx.close();

    // A laptop screen: the menu item is the last one and is out of sight, so the top bar carries the link.
    for (const look of ['native', 'board', 'cyber']) {
      const wide = await device({ look });
      await wide.page.setViewportSize({ width: 1280, height: 720 });
      await wide.page.goto(BASE + '#/overview'); await wait(400);
      const pill = await wide.page.evaluate(() => { const p = document.querySelector('.topbar .wn-pill'); if (!p) return null; const r = p.getBoundingClientRect(); return { seen: r.width > 0 && r.top >= 0 && r.bottom <= innerHeight && r.right <= innerWidth, dot: !!p.querySelector('.wn-dot'), text: p.textContent, sideways: document.documentElement.scrollWidth > document.documentElement.clientWidth }; });
      if (!pill || !pill.seen || !pill.dot) fail(look + ': no visible sign of unread news on a wide screen: ' + JSON.stringify(pill));
      else if (!/Что нового.*есть новое/.test(pill.text)) fail(look + ': the link does not say what it is: ' + pill.text);
      if (pill?.sideways) fail(look + ': the top bar makes the page scroll sideways');
      if (look === 'native') {
        // Another tab of the same browser reads the news: this one drops its marks at the next draw, with no reload.
        const other = await wide.ctx.newPage();
        await other.goto(BASE + '#/news'); await wait(400);
        await wide.page.evaluate(() => { location.hash = '#/dice'; }); await wait(400);
        const left = await wide.page.evaluate(() => ({ hash: location.hash, dots: document.querySelectorAll('.wn-dot').length, pill: !!document.querySelector('.wn-pill'), stored: localStorage.getItem('nc-news-seen'), latest: String(window.WhatsNew.latest()) }));
        if (left.hash !== '#/dice' || left.stored !== left.latest) fail('the other tab did not record the visit: ' + JSON.stringify(left));
        if (left.dots || left.pill) fail('news read in another tab is still marked here: ' + JSON.stringify(left));
      } else {
        await wide.page.click('.topbar .wn-pill'); await wait(400);
        const went = await wide.page.evaluate(() => ({ hash: location.hash, pill: !!document.querySelector('.wn-pill'), dots: document.querySelectorAll('.wn-dot').length }));
        if (went.hash !== '#/news' || went.pill || went.dots) fail(look + ': the link in the top bar: ' + JSON.stringify(went));
      }
      for (const e of wide.page.errs) fail(look + ': ' + e);
      await wide.ctx.close();
    }
    // On a phone the link is not shown: «Ещё» has the dot.
    const small = await device({ width: 390 });
    await small.page.goto(BASE + '#/overview'); await wait(400);
    if (await small.page.evaluate(() => { const p = document.querySelector('.wn-pill'); return !!p && p.getBoundingClientRect().width > 0; })) fail('the top-bar link shows on a phone');
    await small.ctx.close();
  });

  await check('the installed app starts offline and keeps the data', async fail => {
    const { ctx, page } = await device();
    await page.goto(BASE + '#/overview');
    const active = await until(() => page.evaluate(() => navigator.serviceWorker?.getRegistration().then(r => !!r?.active && !!navigator.serviceWorker.controller)), 20000);
    if (!active) { fail('the service worker did not take control'); await ctx.close(); return; }
    await ctx.setOffline(true);
    await page.reload().catch(e => fail('offline reload failed: ' + e.message.split('\n')[0]));
    if (!(await until(() => page.evaluate(() => !!document.querySelector('#app .content h1')), 8000, 100))) fail('nothing is drawn offline');
    await page.goto(BASE + '#/sheet/v1').catch(() => {}); await wait(400);
    const name = await page.evaluate(() => window.App?.active?.()?.name).catch(() => null);
    if (name !== 'Vee') fail('the sheet is not available offline: ' + name);
    await page.goto(BASE + 'catalog').catch(e => fail('offline deep link failed: ' + e.message.split('\n')[0])); await wait(500);
    if (!(await page.evaluate(() => window.App?.getState().view === 'catalog').catch(() => false))) fail('a direct address does not open the screen offline');
    await ctx.setOffline(false);
    await ctx.close();
  });

  await check('the «Досье» look: three columns on a wide screen, its own tabs, chips that filter «Действия»', async fail => {
    const wide = await device({ look: 'board', theme: 'light', width: 1440 });
    await wide.page.goto(BASE + '#/sheet/v1'); await wait(500);
    const board = await wide.page.evaluate(() => {
      const box = sel => document.querySelector(sel).getBoundingClientRect(), aside = box('.sheet-aside'), skills = box('#sheet-skills'), tabs = box('.sheet-tabs');
      return { columns: aside.right <= skills.left && skills.right <= tabs.left, skillsTab: getComputedStyle(document.querySelector('.sheet-tabs [data-sheet-tab="skills"]')).display, stats: document.querySelectorAll('.sheet-stat-strip > div').length, tabs: [...document.querySelectorAll('.sheet-tabs [data-sheet-tab]')].filter(b => b.getClientRects().length).map(b => b.dataset.sheetTab).join(','), active: document.querySelector('.sheet-layout').dataset.activeTab, skillsScroll: getComputedStyle(document.querySelector('#sheet-skills .skills-list')).overflowY, quickInPanel: box('.sheet-quick-rolls').left >= tabs.left - 1 && box('.sheet-quick-rolls').top > box('.dossier-filter').top, scroll: document.documentElement.scrollWidth - innerWidth, pressed: document.querySelector('[data-ui-style][aria-pressed="true"]')?.dataset.uiStyle };
    });
    if (!board.columns) fail('the condition, the skills and the panel are not three columns');
    if (board.skillsTab !== 'none') fail('the «Навыки» tab is still shown beside the skills column');
    if (board.stats !== 10) fail('the row of stat boxes is missing');
    if (board.tabs !== 'combat,gear,role,life' || board.active !== 'combat') fail('the board tabs are not «Действия», «Снаряжение», «Особенности», «Персонаж»: ' + board.tabs + ' / ' + board.active);
    if (board.skillsScroll !== 'visible') fail('the skills list scrolls inside its card: ' + board.skillsScroll);
    if (!board.quickInPanel) fail('the quick rolls are not in the panel under the chips');
    const seen = () => wide.page.evaluate(() => Object.fromEntries(['#sheet-weapons', '#sheet-role', '#sheet-damage', '.sheet-quick-rolls', '#sheet-features', '#sheet-identity'].map(s => [s, !!document.querySelector(s)?.getClientRects().length])));
    const chip = async id => { await wide.page.evaluate(id => document.querySelector(`[data-dossier-filter="${id}"]`).click(), id); await wait(150); return seen(); };
    const want = (got, shown, what) => { for (const [k, v] of Object.entries(got)) if (v !== shown.includes(k)) fail(`${what}: ${k} is ${v ? 'shown' : 'hidden'}`); };
    want(await seen(), ['#sheet-weapons', '#sheet-role', '#sheet-damage', '.sheet-quick-rolls'], 'all');
    want(await chip('role'), ['#sheet-role'], 'chip «Роль»');
    want(await chip('other'), ['#sheet-damage'], 'chip «Прочее»');
    want(await chip('quick'), ['.sheet-quick-rolls'], 'chip «Броски»');
    want(await chip('attacks'), ['#sheet-weapons', '.sheet-quick-rolls'], 'chip «Атаки»');
    await chip('all');
    const tab = async id => { await wide.page.evaluate(id => window.SheetTabs.select(id, { scroll: false }), id); await wait(150); return seen(); };
    want(await tab('role'), ['#sheet-features'], '«Особенности»');
    want(await tab('life'), ['#sheet-identity'], '«Персонаж»');
    if (!(await wide.page.evaluate(() => document.querySelector('.sheet-primary > .delete-button').getClientRects().length))) fail('the character cannot be deleted: no button on «Персонаж»');
    await wide.page.evaluate(() => { window.DossierPanel.setFilter('attacks'); document.querySelector('[data-hud-hp]').click(); }); await wait(150);
    await wide.page.evaluate(() => document.querySelector('[data-hud-jump="sheet-damage"]').click()); await wait(250);
    if (!(await wide.page.evaluate(() => document.querySelector('#sheet-damage').getClientRects().length))) fail('«С учётом брони» leads to a block the chip hides');
    await tab('combat');
    if (board.scroll > 0) fail('the page scrolls sideways by ' + board.scroll);
    if (board.pressed !== 'board') fail('the switch does not mark «Досье»: ' + board.pressed);
    await wide.page.evaluate(() => document.querySelector('[data-action="skill-roll"][data-skill="Athletics"]').click()); await wait(250);
    if ((await wide.page.evaluate(() => window.App.getState().history.length)) !== 1) fail('a roll from the skills column was not recorded');
    for (const e of wide.page.errs) fail(e);
    await wide.ctx.close();
    const phone = await device({ look: 'board', theme: 'dark', width: 390 });
    await phone.page.goto(BASE + '#/sheet/v1'); await wait(500);
    const small = await phone.page.evaluate(() => { window.SheetTabs.select('skills', { scroll: false }); return { active: document.querySelector('.sheet-layout').dataset.activeTab, grid: getComputedStyle(document.querySelector('#main-content')).display, scroll: document.documentElement.scrollWidth - innerWidth }; });
    if (small.active !== 'skills' || small.grid === 'grid') fail('on a phone the sheet is not a tabbed one: ' + JSON.stringify(small));
    if (small.scroll > 0) fail('the phone page scrolls sideways by ' + small.scroll);
    for (const e of phone.page.errs) fail(e);
    await phone.ctx.close();
  });

  await check('the inventory as cards: type chips, armor put on and cyberware installed from a card, weapons in the list', async fail => {
    const d = await device({ width: 390 }), page = d.page;
    await page.goto(BASE + '#/sheet/v1'); await wait(500);
    const bought = await page.evaluate(() => {
      const c = window.App.active(); c.extra = { ...(c.extra || {}), cash: 5000 }; c.head = 0; c.bodyArmor = 0;
      const out = ['weapon-heavy-pistol', 'armor-leathers', 'cyberware-neural-link', 'gear-agent'].map(id => window.EquipmentTools.purchase(c, window.CATALOG.find(x => x.id === id), 'cash', 'ru', { confirmed: true })?.ok === true);
      window.App.save(); window.App.render(); return out;
    });
    if (bought.includes(false)) { fail('the test things were not bought: ' + bought); return; }
    await page.evaluate(() => document.querySelector('[data-sheet-tab="gear"]')?.click()); await wait(300);
    const rows = () => page.evaluate(() => [...document.querySelectorAll('#sheet-items [data-inventory-row]')].map(r => r.dataset.inventoryType + (r.hidden ? ':hidden' : '')));
    const all = await rows();
    if (all.join() !== 'weapon,armor,cyberware,gear') fail('the list is not weapon, armor, cyberware, gear: ' + all);
    if ((await page.evaluate(() => document.querySelector('[data-inventory-filter="type"][value="all"] [data-inventory-count]')?.textContent)) !== '4') fail('the «Все» chip does not count four things');
    await page.click('[data-inventory-filter="type"][value="armor"]');
    if ((await rows()).join() !== 'weapon:hidden,armor,cyberware:hidden,gear:hidden') fail('the armor chip does not leave only armor: ' + await rows());
    if ((await page.getAttribute('[data-inventory-filter="type"][value="armor"]', 'aria-pressed')) !== 'true') fail('the pressed chip is not marked');
    // Armor goes on from its card, and the card then offers to take it off.
    await page.click('#sheet-items [data-eq-action="equip"][data-eq-location="body"]');
    if (!(await until(() => page.evaluate(() => window.App.active().bodyArmor === 4 && !!document.querySelector('#sheet-items [data-eq-action="unequip"][data-eq-location="body"]'))))) fail('armor was not put on from its card');
    if ((await page.getAttribute('[data-inventory-filter="type"][value="armor"]', 'aria-pressed')) !== 'true') fail('the chosen type was lost when the sheet was drawn again');
    await page.click('[data-inventory-filter="type"][value="armor"]');
    if ((await rows()).some(r => r.endsWith(':hidden'))) fail('pressing the chosen chip again does not show everything');
    // Cyberware: the card starts the installation, and the folded block opens with the confirmation.
    if (await page.evaluate(() => document.querySelector('[data-inv-more]')?.open)) fail('the armor and cyberware block is not folded');
    await page.click('#sheet-items [data-eq-action="prepare"]');
    if (!(await until(() => page.evaluate(() => document.querySelector('[data-inv-more]')?.open === true && !!document.querySelector('[data-inv-more] [data-eq-preview]'))))) fail('the installation to confirm is not shown');
    await page.click('[data-eq-action="commit"]');
    if (!(await until(() => page.evaluate(() => window.App.active().extra.equipment.installs.length === 1 && !document.querySelector('#sheet-items [data-eq-action="prepare"]'))))) fail('the implant was not installed, or its card still offers to install it');
    // A weapon card leads to the rolls.
    await page.click('#sheet-items [data-hud-jump="sheet-weapons"]'); await wait(300);
    if (!(await page.evaluate(() => { const el = document.getElementById('sheet-weapons'); return !!el && el.offsetParent !== null; }))) fail('the weapon card does not lead to the weapons');
    const scroll = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    if (scroll > 0) fail('the phone page scrolls sideways by ' + scroll);
    for (const e of page.errs) fail(e);
    await d.ctx.close();
  });

  await check('item groups: make a group, move things into it, filter by it, fold it, put on and take off its armor, delete it and take that back', async fail => {
    const d = await device({ width: 390 }), page = d.page;
    await page.goto(BASE + '#/sheet/v1'); await wait(500);
    const bought = await page.evaluate(() => {
      const c = window.App.active(); c.extra = { ...(c.extra || {}), cash: 5000 }; c.head = 0; c.bodyArmor = 0;
      const out = ['weapon-heavy-pistol', 'armor-leathers', 'armor-kevlar', 'gear-agent'].map(id => window.EquipmentTools.purchase(c, window.CATALOG.find(x => x.id === id), 'cash', 'ru', { confirmed: true })?.ok === true);
      window.App.save(); window.App.render(); return out;
    });
    if (bought.includes(false)) { fail('the test things were not bought: ' + bought); return; }
    const gear = async () => { await page.evaluate(() => document.querySelector('[data-sheet-tab="gear"]')?.click()); await wait(300); };
    await gear();
    const ids = await page.evaluate(() => { const x = window.App.active().extra, by = id => x.items.find(i => i.catalogId === id)?.id; return { leathers: by('armor-leathers'), kevlar: by('armor-kevlar'), agent: by('gear-agent'), pistol: x.weapons[0]?.id }; });
    const groups = () => page.evaluate(() => window.ItemGroups.groups(window.App.active()).map(g => ({ ...g })));
    // Where every card is: «group id or none» + type, with a mark when it cannot be seen.
    const cards = () => page.evaluate(() => [...document.querySelectorAll('#sheet-items [data-inventory-row]')].map(r => (r.closest('[data-ig-group]')?.dataset.igGroup || 'none') + '/' + r.dataset.inventoryType + (r.offsetParent === null ? ':hidden' : '')));
    const focused = () => page.evaluate(() => { const el = document.activeElement; return el ? [el.dataset.igAction || '', el.dataset.igRid || '', el.dataset.igId || '', el.hasAttribute('data-ig-name') ? 'name' : ''].join('|') : ''; });
    const chipCount = value => page.evaluate(v => [...document.querySelectorAll('[data-inventory-filter="group"]')].find(b => b.value === v)?.querySelector('[data-inventory-gcount]')?.textContent, value);
    const pressChip = value => page.evaluate(v => [...document.querySelectorAll('[data-inventory-filter="group"]')].find(b => b.value === v)?.click(), value);
    const saved = () => page.evaluate(() => { const c = JSON.parse(localStorage.getItem('nightcity-red-v1')).characters.find(x => x.id === 'v1'); return { groups: c.extra.itemGroups || [], items: c.extra.items.map(i => i.id + ':' + (i.group || '')), weapons: c.extra.weapons.map(w => w.id + ':' + (w.group || '')) }; });

    // Before any group: the list is what it was, and the only new thing is the button that makes a group.
    if ((await cards()).join() !== 'none/weapon,none/armor,none/armor,none/gear') fail('the list without groups is not the plain list: ' + await cards());
    if (await page.evaluate(() => document.querySelectorAll('.inventory-groups button').length !== 1 || !!document.querySelector('#sheet-items [data-ig-group], #sheet-items [data-ig-none], #sheet-items .inv-weapon select'))) fail('a sheet without groups shows more than the «＋ Группа» button');

    // Make «Рюкзак» from a ready-made name, with Enter.
    await page.click('[data-ig-action="new"]');
    if ((await focused()) !== '|||name') fail('the new-group panel does not take the focus: ' + await focused());
    await page.keyboard.press('Enter');
    if ((await page.textContent('[data-ig-panel="new"] [data-ig-error]').catch(() => '')) !== 'Назовите группу.') fail('an empty name is not refused in the panel');
    await page.click('[data-ig-panel="new"] [data-ig-action="pick"][value="Рюкзак"]');
    await page.keyboard.press('Enter');
    if (!(await until(async () => (await groups()).length === 1))) { fail('the group was not created'); await d.ctx.close(); return; }
    const bag = (await groups())[0].id;
    if ((await focused()) !== 'new|||') fail('after creating a group the focus is not back on «＋ Группа»: ' + await focused());
    if (!(await page.evaluate(() => /Группа создана: Рюкзак/.test(document.querySelector('#app-notice')?.textContent || '')))) fail('no notice about the new group');
    if ((await cards()).join() !== 'none/weapon,none/armor,none/armor,none/gear') fail('things moved by themselves: ' + await cards());
    if (!(await page.evaluate(() => document.querySelector('[data-ig-group] .ig-empty')?.offsetParent != null))) fail('an empty group does not say how to fill it');

    // Both pieces of armor go into the group from their cards; the focus stays on the select that was used.
    for (const rid of [ids.leathers, ids.kevlar]) {
      await page.evaluate(id => { const box = [...document.querySelectorAll('#sheet-items details[data-gf-row]')].find(x => x.dataset.gfRow === id); if (box && !box.open) box.querySelector('summary').click(); }, rid);
      await page.selectOption(`[data-ig-assign][data-ig-rid="${rid}"]`, bag);
      if (!(await until(() => page.evaluate(([id, g]) => window.App.active().extra.items.find(i => i.id === id)?.group === g, [rid, bag])))) fail('the armor was not put into the group');
      if ((await focused()) !== `|${rid}||`) fail('the focus left the «Группа» select: ' + await focused());
    }
    // The weapon gets a group of its own, made from its card: «＋ Новая группа…».
    await page.selectOption(`[data-ig-assign][data-ig-rid="${ids.pistol}"]`, '__new');
    if (!(await page.evaluate(() => document.querySelector('.inv-weapon [data-ig-panel="new"]') !== null)) || (await focused()) !== '|||name') fail('«＋ Новая группа…» does not open the panel at the card');
    await page.fill('[data-ig-panel="new"] [data-ig-name]', 'Тайник');
    await page.click('[data-ig-panel="new"] [data-ig-action="create"]');
    if (!(await until(async () => (await groups()).length === 2))) { fail('the second group was not created'); await d.ctx.close(); return; }
    const stash = (await groups())[1].id;
    if ((await cards()).join() !== `none/gear,${bag}/armor,${bag}/armor,${stash}/weapon`) fail('the cards are not under their groups: ' + await cards());
    if ((await chipCount('none')) !== '1' || (await chipCount(bag)) !== '2' || (await chipCount(stash)) !== '1') fail('the group chips do not count 1, 2, 1');
    if ((await page.textContent(`[data-ig-group="${bag}"] [data-ig-count]`)) !== '2') fail('the group header does not count its two things');

    // The chip of a group leaves only that group; pressed again, everything is back.
    await pressChip(bag); await wait(100);
    if ((await cards()).join() !== `none/gear:hidden,${bag}/armor,${bag}/armor,${stash}/weapon:hidden`) fail('the group chip does not leave only its group: ' + await cards());
    if (await page.evaluate(g => [...document.querySelectorAll('[data-ig-group], [data-ig-none]')].filter(b => b.dataset.igGroup !== g).some(b => b.offsetParent !== null), bag)) fail('emptied groups stay on screen while one group is picked');
    // The type chips work together with it.
    await page.click('[data-inventory-filter="type"][value="weapon"]');
    if ((await cards()).some(x => !x.endsWith(':hidden'))) fail('a group and a type together should leave nothing here: ' + await cards());
    await page.click('[data-inventory-filter="type"][value="weapon"]');
    await pressChip(bag); await wait(100);
    if ((await cards()).some(x => x.endsWith(':hidden'))) fail('pressing the picked group again does not show everything: ' + await cards());

    // Fold the group from the keyboard; it stays folded after the page is loaded again, and nothing is lost.
    const toggle = `[data-ig-action="toggle"][data-ig-id="${bag}"]`;
    await page.focus(toggle); await page.keyboard.press('Enter');
    if ((await page.getAttribute(toggle, 'aria-expanded')) !== 'false' || (await cards()).join() !== `none/gear,${bag}/armor:hidden,${bag}/armor:hidden,${stash}/weapon`) fail('Enter on the header does not fold the group: ' + await cards());
    if ((await focused()) !== `toggle||${bag}|`) fail('folding moved the focus');
    await page.reload(); await wait(600); await gear();
    const kept = await saved();
    if (kept.groups.length !== 2 || kept.groups[0].collapsed !== true || kept.items.join() !== `${ids.leathers}:${bag},${ids.kevlar}:${bag},${ids.agent}:` || kept.weapons.join() !== `${ids.pistol}:${stash}`) fail('the groups were not saved as they were: ' + JSON.stringify(kept));
    if ((await page.getAttribute(toggle, 'aria-expanded')) !== 'false' || (await cards()).join() !== `none/gear,${bag}/armor:hidden,${bag}/armor:hidden,${stash}/weapon`) fail('the group is not folded after a reload: ' + await cards());
    // A search opens a folded group for its hits, and folds it again when the search is cleared.
    await page.fill('[data-inventory-filter="query"]', 'кевлар');
    if ((await cards()).join() !== `none/gear:hidden,${bag}/armor:hidden,${bag}/armor,${stash}/weapon:hidden`) fail('the search does not show its hit inside a folded group: ' + await cards());
    await page.fill('[data-inventory-filter="query"]', '');
    if ((await cards()).join() !== `none/gear,${bag}/armor:hidden,${bag}/armor:hidden,${stash}/weapon`) fail('the group did not fold again after the search: ' + await cards());
    // A type chip alone opens a folded group too: the status line must not count cards that are behind a folded header.
    await page.click('[data-inventory-filter="type"][value="armor"]');
    if ((await cards()).join() !== `none/gear:hidden,${bag}/armor,${bag}/armor,${stash}/weapon:hidden` || (await page.textContent('[data-inventory-filter-count]')) !== 'Показано 2 из 4') fail('a type chip counts cards inside a folded group without showing them: ' + await cards() + ' / ' + await page.textContent('[data-inventory-filter-count]'));
    await page.click('[data-inventory-filter="type"][value="armor"]');
    if ((await cards()).join() !== `none/gear,${bag}/armor:hidden,${bag}/armor:hidden,${stash}/weapon`) fail('the group did not fold again after the type chip: ' + await cards());
    await page.focus(toggle); await page.keyboard.press('Enter');
    if ((await page.getAttribute(toggle, 'aria-expanded')) !== 'true' || (await cards()).some(x => x.endsWith(':hidden'))) fail('Enter does not unfold the group');

    // On a phone every control of a group is a 44px target, and nothing pushes the page sideways.
    const small = await page.evaluate(() => [...document.querySelectorAll('.inventory-groups .inventory-chip, .ig-toggle, .ig-tool, .inv-weapon [data-ig-assign]')].filter(el => el.offsetParent !== null && el.getBoundingClientRect().height < 43.5).map(el => (el.textContent || el.tagName).trim().slice(0, 20)));
    if (small.length) fail('touch targets under 44px: ' + small.join(', '));

    // «Надеть всё»: the body, then the head. «Снять всё» asks once (the test accepts) and bares both.
    await page.click(`[data-ig-action="wear-all"][data-ig-id="${bag}"]`);
    if (!(await until(() => page.evaluate(() => window.App.active().bodyArmor === 4 && window.App.active().head === 7)))) fail('«Надеть всё» did not put the leathers on the body and the kevlar on the head');
    if (!(await page.evaluate(() => /Надето: тело — Кожа \(SP 4\), голова — Кевлар \(SP 7\)\./.test(document.querySelector('#app-notice')?.textContent || '')))) fail('the notice does not say what was put on');
    if (await page.evaluate(g => !!document.querySelector(`[data-ig-action="wear-all"][data-ig-id="${g}"]`), bag)) fail('«Надеть всё» is still offered when everything is on');
    if ((await focused()) !== `toggle||${bag}|`) fail('after «Надеть всё» the focus is not on the group header: ' + await focused());
    await page.click(`[data-ig-action="off-all"][data-ig-id="${bag}"]`);
    if (!(await until(() => page.evaluate(() => window.App.active().bodyArmor === 0 && window.App.active().head === 0 && Object.keys(window.App.active().extra.equipment.armor).length === 0)))) fail('«Снять всё» did not take the armor off');

    // Sorting with «Без группы» pressed: the filed thing leaves the list, and the focus goes to the pressed chip, not to the top of the page.
    await pressChip('none'); await wait(100);
    await page.evaluate(id => { const box = [...document.querySelectorAll('#sheet-items details[data-gf-row]')].find(x => x.dataset.gfRow === id); if (box && !box.open) box.querySelector('summary').click(); }, ids.agent);
    await page.selectOption(`[data-ig-assign][data-ig-rid="${ids.agent}"]`, stash);
    if (!(await until(() => page.evaluate(([id, g]) => window.App.active().extra.items.find(i => i.id === id)?.group === g, [ids.agent, stash])))) fail('the thing was not filed while «Без группы» was pressed');
    const landed = await page.evaluate(() => { const el = document.activeElement; return el ? `${el.tagName}|${el.dataset.inventoryFilter || ''}|${el.value || ''}|${el.getAttribute('aria-pressed') || ''}` : 'nothing'; });
    if (landed !== 'BUTTON|group|none|true') fail('after filing a thing under the «Без группы» chip the focus is lost: ' + landed);
    await pressChip('none'); await wait(100);
    await page.evaluate(id => { const box = [...document.querySelectorAll('#sheet-items details[data-gf-row]')].find(x => x.dataset.gfRow === id); if (box && !box.open) box.querySelector('summary').click(); }, ids.agent);
    await page.selectOption(`[data-ig-assign][data-ig-rid="${ids.agent}"]`, '');
    if (!(await until(async () => (await cards()).join() === `none/gear,${bag}/armor,${bag}/armor,${stash}/weapon`))) fail('the thing did not go back to «Без группы»: ' + await cards());
    if ((await focused()) !== `|${ids.agent}||`) fail('with no chip pressed the focus left the «Группа» select: ' + await focused());

    // Rename, then delete: the things stay, and «Вернуть» brings the group back with them.
    await page.click(`[data-ig-action="edit"][data-ig-id="${bag}"]`);
    await page.fill('[data-ig-panel="edit"] [data-ig-name]', 'тайник'); await page.keyboard.press('Enter');
    if ((await page.textContent('[data-ig-panel="edit"] [data-ig-error]').catch(() => '')) !== 'Такая группа уже есть.') fail('a name that is taken is not refused');
    await page.fill('[data-ig-panel="edit"] [data-ig-name]', 'Сумка'); await page.keyboard.press('Enter');
    if (!(await until(async () => (await groups())[0].name === 'Сумка'))) fail('the group was not renamed');
    await page.click(`[data-ig-action="edit"][data-ig-id="${bag}"]`);
    await page.click('[data-ig-panel="edit"] [data-ig-action="delete"]');
    if (!(await until(async () => (await groups()).length === 1))) fail('the group was not deleted');
    if ((await cards()).join() !== `none/armor,none/armor,none/gear,${stash}/weapon`) fail('after deleting the group its things are not in «Без группы»: ' + await cards());
    if ((await page.evaluate(() => window.App.active().extra.items.length)) !== 3) fail('deleting a group lost things');
    await page.click('#app-notice .notice-action');
    if (!(await until(async () => (await groups()).length === 2 && (await cards()).join() === `none/gear,${bag}/armor,${bag}/armor,${stash}/weapon`))) fail('«Вернуть» did not bring the group and its things back: ' + await cards());
    if ((await groups())[0].id !== bag) fail('the group did not come back to its place');
    if ((await focused()) !== `toggle||${bag}|`) fail('after «Вернуть» the focus is not on the header of the group that came back: ' + await focused());

    const scroll = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    if (scroll > 0) fail('the phone page scrolls sideways by ' + scroll);
    // The groups in every look: names, roles and contrast. Only what this feature draws is checked here; the rest of
    // the tab belongs to the general accessibility check below.
    const axeFile = (() => { try { return require.resolve('axe-core/axe.min.js'); } catch { return null; } })();
    if (axeFile) {
      const source = fs.readFileSync(axeFile, 'utf8');
      for (const [look, theme] of [['native', 'dark'], ['native', 'light'], ['cyber', 'dark'], ['board', 'dark'], ['board', 'light']]) {
        await page.evaluate(([s, t]) => { localStorage.setItem('nc-ui-style', s); localStorage.setItem('nc-ui-theme', t); }, [look, theme]);
        await page.reload(); await wait(500); await gear();
        await page.evaluate(source);
        const found = [];
        // Once with the panel that edits a group open, once with the panel that makes one; each with its error line
        // shown (a name that is taken, an empty name), so the colour of the error is checked too.
        for (const open of [`[data-ig-action="edit"][data-ig-id="${bag}"]`, '[data-ig-action="new"]']) {
          await page.click(open);
          await page.fill('.ig-panel [data-ig-name]', open.includes('edit') ? 'Тайник' : ''); await page.keyboard.press('Enter');
          if (!(await page.evaluate(() => document.querySelector('.ig-panel [data-ig-error]')?.offsetParent != null))) fail(`${look} ${theme}: the error line of the panel is not shown`);
          // Every button and field of a group and of its panels is a 44px target in every look.
          const low = await page.evaluate(() => [...document.querySelectorAll('.ig-toggle, .ig-tool, .ig-panel .cx-button, .ig-panel input, .inventory-groups .inventory-chip')].filter(el => el.offsetParent !== null && el.getBoundingClientRect().height < 43.5).map(el => (el.textContent || el.tagName).trim().slice(0, 20) + ' ' + Math.round(el.getBoundingClientRect().height)));
          if (low.length) fail(`${look} ${theme}: touch targets under 44px: ${[...new Set(low)].join(', ')}`);
          found.push(...await page.evaluate(() => window.axe.run({ include: [['.inventory-groups'], ['[data-ig-group]'], ['[data-ig-none]'], ['.ig-panel']] }, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa'] }, resultTypes: ['violations'] }).then(r => r.violations.filter(v => ['critical', 'serious'].includes(v.impact)).map(v => `${v.id} (${v.nodes.length}): ${v.nodes[0].target.join(' ').slice(0, 70)}`)))); }
        for (const v of new Set(found)) fail(`${look} ${theme}: ${v}`);
        // Nothing this feature draws may reach past the edge of the phone screen in any look.
        const wide = await page.evaluate(() => { const w = document.documentElement.clientWidth; return [...document.querySelectorAll('.inventory-groups, .inventory-groups *, [data-ig-group], [data-ig-group] *, [data-ig-none], .ig-panel, .ig-panel *')].filter(el => el.offsetParent !== null && el.getBoundingClientRect().right > w + 1).slice(0, 4).map(el => el.tagName + '.' + String(el.className).slice(0, 30)).join(', '); });
        if (wide) fail(`${look} ${theme}: wider than the phone screen: ${wide}`);
      }
    }
    for (const e of page.errs) fail(e);
    await d.ctx.close();
  });

  await check('the name generator: a die next to the handle in both builders and next to an NPC name, the typed text comes back', async fail => {
    const d = await device({ width: 390 }), page = d.page;
    const value = sel => page.evaluate(s => document.querySelector(s)?.value ?? null, sel);
    const sideways = async where => { const over = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth); if (over > 0) fail(`${where}: the phone page scrolls sideways by ${over}`); };
    // The quick builder: typed text, two taps, and back again step by step.
    await page.goto(BASE + '#/quick-builder'); await wait(400);
    const name = '[data-quick-field="name"]', die = '.ng-slot [data-ng="handle"]', undo = '.ng-slot [data-ng-undo]';
    if (!(await page.$(die))) { fail('no die next to the handle in the quick builder'); await d.ctx.close(); return; }
    if (await page.isVisible(undo)) fail('the undo button shows before anything was generated');
    await page.fill(name, 'Моё имя');
    await page.click(die);
    const first = await value(name);
    if (!first || first === 'Моё имя' || !/^[А-Яа-яЁё -]+$/.test(first)) fail('the first tap did not put a Russian handle into the field: ' + first);
    if ((await page.textContent('.ng-slot [data-ng-said]')) !== 'Подставлено: ' + first) fail('the new handle is not announced');
    const size = await page.evaluate(s => { const r = document.querySelector(s).getBoundingClientRect(); return [r.width, r.height]; }, die);
    if (size[0] < 44 || size[1] < 44) fail('the die is smaller than 44 by 44: ' + size);
    // From the keyboard: Enter on the die, and the focus stays on it for the next press.
    await page.focus(die); await page.keyboard.press('Enter');
    const second = await value(name);
    if (!second || second === first) fail('the second tap did not change the handle');
    if (!(await page.evaluate(s => document.activeElement === document.querySelector(s), die))) fail('the focus left the die after Enter');
    // The builder keeps the handle like typed text: it is still there after the page is drawn again.
    await page.evaluate(() => window.App.render()); await wait(200);
    if ((await value(name)) !== second) fail('the quick builder did not keep the generated handle: ' + await value(name));
    await page.click(die); const third = await value(name);
    await sideways('quick builder');
    await page.click(undo);
    if ((await value(name)) !== second) fail('undo did not bring the previous handle back');
    if (third === second) fail('the third tap did not change the handle');
    // Choosing a role draws the page again; the steps back must still be there, down to the typed text.
    const roles = await page.evaluate(() => [...document.querySelector('[data-quick-role]').options].map(o => o.value));
    await page.selectOption('[data-quick-role]', roles[roles.length - 1]); await wait(200);
    if ((await value(name)) !== second) fail('the role change lost the handle');
    if (!(await page.isVisible(undo))) fail('the undo button is gone after the page was drawn again');
    await page.click(undo);
    if ((await value(name)) !== first) fail('the second step back did not survive the redraw: ' + await value(name));
    // Text typed over a generated handle is kept one step away, not thrown out by undo.
    await page.fill(name, first + ' Два');
    await page.click(undo);
    if ((await value(name)) !== 'Моё имя') fail('undo after typing did not bring the typed-in name back: ' + await value(name));
    if (!(await page.isVisible(undo))) fail('the text typed over the handle cannot be brought back');
    await page.click(undo);
    if ((await value(name)) !== first + ' Два') fail('the text typed over the handle was lost: ' + await value(name));
    if (await page.isVisible(undo)) fail('the undo button stays when there is nothing left to bring back');
    if (!(await page.evaluate(s => document.activeElement === document.querySelector(s), die))) fail('the focus was lost when the undo button hid');
    // The step-by-step builder.
    await page.goto(BASE + '#/builder'); await wait(400);
    await page.fill('[data-builder-field="name"]', 'Моё имя');
    await page.click(die); const made = await value('[data-builder-field="name"]');
    if (!made || made === 'Моё имя') fail('the die does nothing in the builder');
    await page.evaluate(() => window.App.render()); await wait(200);
    if ((await value('[data-builder-field="name"]')) !== made) fail('the builder did not keep the generated handle');
    await page.click(die); await page.click(undo);
    if ((await value('[data-builder-field="name"]')) !== made) fail('undo in the builder did not bring the previous handle back');
    await sideways('builder');
    // An opponent in a campaign: the generated name goes to the list like a typed one.
    await page.goto(BASE + '#/campaigns'); await wait(300);
    await page.click('[data-campaign-action="open"]'); await wait(300);
    await page.click('.ng-slot [data-ng="npc"]');
    const npc = await value('#campaign-npc-name');
    if (!npc) fail('the die does nothing next to the opponent’s name');
    else if (!(await page.evaluate(() => document.querySelector('.ng-slot [data-ng="npc"]')?.isConnected === true))) fail('the campaign page was drawn again under the die');
    await page.click('[data-campaign-action="add-npc"]');
    if (!(await until(() => page.evaluate(n => window.App.getState().campaigns[0].roster.some(r => r.kind === 'npc' && r.name === n), npc), 3000))) fail('the opponent was not added under the generated name: ' + npc);
    await sideways('campaign');
    // The NPC library on the GM page.
    await page.goto(BASE + '#/gm'); await wait(400);
    await page.evaluate(() => document.querySelector('[data-nl-action="new"]')?.click()); await wait(200);
    await page.evaluate(() => document.querySelector('[data-nl-root] [data-ng="npc"]')?.click());
    if (!(await value('[data-nl-field="name"]'))) fail('the die does nothing in the NPC library form');
    // «Свои материалы» on the catalog page: a new NPC of one's own.
    await page.goto(BASE + '#/catalog'); await wait(400);
    await page.evaluate(() => document.querySelector('[data-cc-action="toggle"]')?.click()); await wait(200);
    await page.evaluate(() => document.querySelector('[data-cc-action="tab"][data-cc-tab="npcs"]')?.click()); await wait(200);
    await page.evaluate(() => document.querySelector('[data-cc-action="new"][data-cc-kind="npc"]')?.click()); await wait(200);
    const own = '[data-cc-root] .ng-slot [data-cc-field="name"]';
    if (!(await page.$(own))) fail('no die next to the name of an own NPC');
    else {
      await page.fill(own, 'Свой'); await page.click('[data-cc-root] [data-ng="npc"]');
      const got = await value(own);
      if (!got || got === 'Свой') fail('the die does nothing in the own-content NPC form');
      await page.click('[data-cc-root] [data-ng-undo]');
      if ((await value(own)) !== 'Свой') fail('undo does not bring the typed name back in the own-content NPC form');
      await sideways('own content');
    }
    // No field is too short for the longest names, with both buttons showing, in the narrowest look.
    for (const look of ['native', 'cyber']) for (const width of [390, 1280]) {
      const n = await device({ look, width });
      await n.page.goto(BASE + '#/campaigns'); await wait(300);
      await n.page.click('[data-campaign-action="open"]'); await wait(300);
      await n.page.click('.ng-slot [data-ng="npc"]');
      const cut = await n.page.evaluate(() => { const i = document.querySelector('#campaign-npc-name'), L = window.NameGen.LISTS.ru, long = l => l.reduce((a, b) => (b.length > a.length ? b : a)); let worst = 0; for (const v of [long(L.prefix) + ' ' + long(L.handle), long(L.first) + ' ' + long(L.last)]) { i.value = v; worst = Math.max(worst, i.scrollWidth - i.clientWidth); } const b = document.querySelector('.ng-slot [data-ng-undo]').getBoundingClientRect(); return { worst, undo: [b.width, b.height], over: document.documentElement.scrollWidth - document.documentElement.clientWidth }; });
      if (cut.worst > 0) fail(`${look} ${width}: the longest name is cut by ${cut.worst}px in the opponent field`);
      if (cut.undo[0] < 44 || cut.undo[1] < 44) fail(`${look} ${width}: the undo button is smaller than 44 by 44: ${cut.undo}`);
      if (cut.over > 0) fail(`${look} ${width}: the campaign page scrolls sideways by ${cut.over}`);
      await n.ctx.close();
    }
    for (const e of page.errs) fail(e);
    await d.ctx.close();
    // In the English interface the names are English, in the field and in the announcement.
    const en = await device({ lang: 'en', width: 390 });
    await en.page.goto(BASE + '#/quick-builder'); await wait(400);
    for (let i = 0; i < 5; i++) {
      await en.page.click(die);
      const got = await en.page.evaluate(s => document.querySelector(s)?.value, name), said = await en.page.textContent('.ng-slot [data-ng-said]');
      if (!/^[A-Za-z -]+$/.test(got || '')) fail('a name that is not English in the English interface: ' + got);
      if (said !== 'Filled in: ' + got) fail('the English announcement is wrong: ' + said);
    }
    if ((await en.page.getAttribute(die, 'aria-label')) !== 'Random handle') fail('the die is not named in English');
    for (const e of en.page.errs) fail(e);
    await en.ctx.close();
  });

  await check('characters: folders and tags file the list, the chips and the search filter it', async fail => {
    const axeFile = (() => { try { return require.resolve('axe-core/axe.min.js'); } catch { return null; } })();
    // Two more characters next to the saved one, optionally already filed.
    const seed = (page, filed) => page.evaluate(filed => {
      const s = window.App.getState(), base = s.characters.find(c => c.id === 'v1'), copy = (id, name, extra) => ({ ...JSON.parse(JSON.stringify(base)), id, name, extra: { uid: id, ...extra } });
      if (filed) base.extra = { ...(base.extra || {}), folder: 'Банда Шестой улицы', tags: ['долг', 'стрелок'] };
      s.characters.splice(0, s.characters.length, base, copy('r2', 'Rook', filed ? { folder: 'Корпораты', tags: ['долг'] } : {}), copy('j3', 'Jackie', {}));
      window.App.save(); window.App.render();
    }, filed);
    const cards = page => page.evaluate(() => [...document.querySelectorAll('.character-grid [data-character-card]')].map(c => c.dataset.characterCard + (c.hidden ? ':hidden' : '')).join());
    const status = page => page.evaluate(() => document.querySelector('[data-char-tags-count]')?.textContent || '');
    const focusOn = page => page.evaluate(() => { const a = document.activeElement; return a ? (a.dataset.charTagsField || a.dataset.charTags || a.tagName) + ':' + (a.dataset.charTagsId || '') : ''; });
    const sideways = page => page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    const d = await device({ width: 390 }), page = d.page;
    await page.goto(BASE + '#/characters'); await wait(500);
    await seed(page, false); await wait(200);
    if (!(await page.isVisible('[data-char-tags="query"]'))) fail('with three characters there is no search field');
    if (await page.locator('.char-tags-chip').count()) fail('chips are drawn before any folder or tag exists');
    // The editor opens from the keyboard; Tab from the folder to the tags files the sheet and keeps the focus in the editor.
    await page.focus('[data-char-tags-card="v1"] summary'); await page.keyboard.press('Enter'); await page.keyboard.press('Tab');
    if ((await focusOn(page)) !== 'folder:v1') fail('Tab from the opened editor does not reach the folder field: ' + await focusOn(page));
    await page.keyboard.type('  Банда  '); await page.keyboard.press('Tab');
    if ((await focusOn(page)) !== 'tags:v1') fail('after the folder was filed the focus is not in the tags field: ' + await focusOn(page));
    if ((await page.evaluate(() => document.querySelector('[data-char-tags="folder"][value="банда"] b')?.textContent)) !== '1') fail('the folder chip did not appear with a count of one');
    await page.keyboard.type('долг, #стрелок, долг'); await page.keyboard.press('Enter');
    if ((await focusOn(page)) !== 'tags:v1') fail('Enter in the tags field moved the focus: ' + await focusOn(page));
    const tagChips = await page.evaluate(() => [...document.querySelectorAll('[data-char-tags="tag"]')].map(b => b.textContent).join());
    if (tagChips !== '#долг1,#стрелок1') fail('the tag chips are not #долг and #стрелок: ' + tagChips);
    if ((await page.inputValue('[data-char-tags-field="tags"][data-char-tags-id="v1"]')) !== 'долг, стрелок') fail('the tags field does not show the cleaned list');
    const stored = await until(() => page.evaluate(() => { const x = JSON.parse(localStorage.getItem('nightcity-red-v1')).characters.find(c => c.id === 'v1').extra; return x.folder === 'Банда' && (x.tags || []).join() === 'долг,стрелок'; }), 4000);
    if (!stored) fail('the folder and tags were not saved');
    // A press on a chip straight from another card's field: the field is filed first, and the press still lands.
    await page.click('[data-char-tags-card="r2"] summary');
    await page.click('[data-char-tags-field="folder"][data-char-tags-id="r2"]'); await page.keyboard.type('Корпы');
    await page.click('[data-char-tags="folder"][value="банда"]');
    if ((await page.getAttribute('[data-char-tags="folder"][value="банда"]', 'aria-pressed')) !== 'true') fail('the press on the chip was lost while the other field was being filed');
    if (!(await page.locator('[data-char-tags="folder"][value="корпы"]').count())) fail('the folder typed just before the press has no chip');
    // The chips were drawn anew under that press; the focus is on the new «Банда» chip, not back at the top of the page.
    const chipFocus = await page.evaluate(() => { const a = document.activeElement; return a.tagName + ':' + (a.dataset.charTags || '') + ':' + (a.value || '') + ':' + a.getAttribute('aria-pressed'); });
    if (chipFocus !== 'BUTTON:folder:банда:true') fail('after a chip pressed straight from a field the focus is on ' + chipFocus);
    if ((await cards(page)) !== 'v1,r2:hidden,j3:hidden') fail('the folder chip does not leave only its folder: ' + await cards(page));
    if ((await status(page)) !== 'Показано 1 из 3') fail('the status line reads: ' + await status(page));
    if ((await sideways(page)) > 0) fail('the phone page scrolls sideways by ' + await sideways(page));
    await page.click('[data-char-tags="folder-none"]');
    if ((await cards(page)) !== 'v1:hidden,r2:hidden,j3') fail('«Без папки» does not leave the unfiled sheet: ' + await cards(page));
    await page.click('[data-char-tags="folder-all"]');
    // The search narrows the list as it is typed and keeps the focus.
    await page.click('[data-char-tags="query"]'); await page.keyboard.type('ro');
    if ((await cards(page)) !== 'v1:hidden,r2,j3:hidden') fail('the search by name does not narrow the list: ' + await cards(page));
    await page.keyboard.type('o');
    if ((await focusOn(page)) !== 'query:' || (await page.inputValue('[data-char-tags="query"]')) !== 'roo') fail('the search field lost the focus or the text while typing');
    await page.keyboard.type('zz');
    if (!/Никого не найдено/.test(await status(page))) fail('an empty result is not explained: ' + await status(page));
    await page.click('[data-char-tags="reset"]');
    if ((await cards(page)) !== 'v1,r2,j3' || (await page.inputValue('[data-char-tags="query"]')) !== '' || await page.isVisible('[data-char-tags="reset"]')) fail('«Сбросить фильтр» does not bring everyone back');
    await page.click('[data-char-tags="tag"][value="долг"]');
    if ((await cards(page)) !== 'v1,r2:hidden,j3:hidden') fail('the tag chip does not filter: ' + await cards(page));
    // A redraw of the page (here: another language) draws fresh cards; the filter is applied to them again.
    await page.evaluate(() => document.querySelector('[data-action="lang"][data-lang="en"]').click()); await wait(300);
    if ((await page.evaluate(() => document.documentElement.lang)) !== 'en') fail('the language did not change');
    if ((await cards(page)) !== 'v1,r2:hidden,j3:hidden') fail('after a change of language the filter is no longer applied: ' + await cards(page));
    if ((await status(page)) !== 'Showing 1 of 3') fail('after a change of language the status line reads: ' + await status(page));
    if ((await page.getAttribute('[data-char-tags="tag"][value="долг"]', 'aria-pressed')) !== 'true') fail('after a change of language the tag chip is no longer pressed');
    await page.evaluate(() => window.App.render()); await wait(200);
    if ((await cards(page)) !== 'v1,r2:hidden,j3:hidden') fail('after a plain redraw the filter is no longer applied: ' + await cards(page));
    await page.evaluate(() => document.querySelector('[data-action="lang"][data-lang="ru"]').click()); await wait(300);
    if ((await cards(page)) !== 'v1,r2:hidden,j3:hidden' || (await status(page)) !== 'Показано 1 из 3') fail('back in Russian the filter shows ' + await cards(page) + ' / ' + await status(page));
    // The search finds a tag typed the way the page draws it, with the # in front.
    await page.click('[data-char-tags="tag"][value="долг"]');
    await page.click('[data-char-tags="query"]'); await page.keyboard.type('#стрелок');
    if ((await cards(page)) !== 'v1,r2:hidden,j3:hidden') fail('the search does not find a tag typed with #: ' + await cards(page));
    await page.click('[data-char-tags="reset"]');
    await page.click('[data-char-tags="tag"][value="долг"]');
    // Every control is big enough for a finger.
    const small = await page.evaluate(() => [...document.querySelectorAll('.char-tags-chip,[data-char-tags="reset"],[data-char-tags="query"],.char-tags-edit > summary,.char-tags-fields input')].filter(e => e.getClientRects().length && e.getBoundingClientRect().height < 43.5).map(e => (e.dataset.charTags || e.dataset.charTagsField || 'summary') + ' ' + Math.round(e.getBoundingClientRect().height)));
    if (small.length) fail('controls lower than 44px: ' + small.join(', '));
    // A reload keeps what was filed.
    await page.reload(); await wait(600);
    const line = await page.evaluate(() => document.querySelector('[data-char-tags-card="v1"] [data-char-tags-line]')?.textContent || '');
    if (!line.includes('Банда') || !line.includes('#долг') || !line.includes('#стрелок')) fail('after a reload the card does not show its folder and tags: ' + line);
    if (!(await page.locator('[data-char-tags="folder"][value="корпы"]').count())) fail('after a reload the second folder is gone');
    for (const e of page.errs) fail(e);
    await d.ctx.close();
    // A press on a button of the next card straight from an unfiled field. Filing adds a line to the card and, for the
    // first folder, a row of chips above the list; neither may move the button away before the click lands on it.
    for (const width of [390, 1280]) {
      const o = await device({ width }), p = o.page;
      await p.goto(BASE + '#/characters'); await wait(500);
      await seed(p, false); await wait(200);
      await p.click('[data-char-tags-card="v1"] summary');
      await p.click('[data-char-tags-field="folder"][data-char-tags-id="v1"]'); await p.keyboard.type('Банда');
      await p.click('[data-character-card="r2"] [data-action="open"]'); await wait(300);
      const hash = await p.evaluate(() => location.hash);
      if (hash !== '#/sheet/r2') fail(`${width}px: «Открыть» pressed straight from the folder field did not open the sheet: ${hash}`);
      const kept = await until(() => p.evaluate(() => JSON.parse(localStorage.getItem('nightcity-red-v1')).characters.find(c => c.id === 'v1').extra.folder === 'Банда'), 4000);
      if (!kept) fail(`${width}px: the folder typed before that press was not saved`);
      await p.goto(BASE + '#/characters'); await wait(400);
      if (!(await p.evaluate(() => document.querySelector('[data-char-tags-card="v1"] [data-char-tags-line]')?.textContent || '')).includes('Банда')) fail(`${width}px: back on the page the card does not show its folder`);
      // On a desktop "/" jumps to the search field of the page.
      if (width === 1280) {
        await p.evaluate(() => document.activeElement?.blur()); await p.keyboard.press('/');
        if ((await focusOn(p)) !== 'query:') fail('"/" does not focus the search field: ' + await focusOn(p));
      }
      for (const e of p.errs) fail(`${width}px: ${e}`);
      await o.ctx.close();
    }
    // The same page with a filter on, in every look: nothing sticks out sideways and axe finds nothing.
    for (const [look, theme] of [['native', 'dark'], ['native', 'light'], ['board', 'dark'], ['board', 'light'], ['cyber', 'dark']]) {
      const o = await device({ look, theme, width: 390 }), p = o.page;
      await p.goto(BASE + '#/characters'); await wait(400);
      await seed(p, true); await wait(200);
      await p.click('[data-char-tags="tag"][value="долг"]'); await p.click('[data-char-tags-card="v1"] summary');
      // The pointer leaves the card: the colors measured are the ones a phone shows, not the hover of a mouse resting on the card.
      await p.mouse.move(2, 2); await wait(150);
      if ((await cards(p)) !== 'v1,r2,j3:hidden') fail(`${look} ${theme}: the tag chip shows ${await cards(p)}`);
      if ((await sideways(p)) > 0) fail(`${look} ${theme}: the phone page scrolls sideways by ${await sideways(p)}`);
      if (axeFile) {
        await p.evaluate(fs.readFileSync(axeFile, 'utf8'));
        const found = await p.evaluate(() => window.axe.run(document, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa'] }, resultTypes: ['violations'] }).then(r => r.violations.filter(v => ['critical', 'serious'].includes(v.impact)).map(v => `${v.id} (${v.nodes.length}): ${v.nodes[0].target.join(' ').slice(0, 70)}`)));
        for (const v of found) fail(`${look} ${theme}: ${v}`);
      }
      for (const e of p.errs) fail(`${look} ${theme}: ${e}`);
      await o.ctx.close();
    }
  });

  await check('custom roll tables: build one on a phone, see the gap warning, roll it into the history, export, import, delete and undo', async fail => {
    const d = await device({ width: 390 }), page = d.page;
    const fits = async where => { const [sw, iw] = await page.evaluate(() => [document.documentElement.scrollWidth, innerWidth]); if (sw > iw) fail(`${where}: the page scrolls sideways (${sw} > ${iw})`); };
    const stored = () => page.evaluate(() => JSON.parse(localStorage.getItem('nightcity-red-v1') || '{}').gmExtras?.rollTables || []);
    await page.goto(BASE + '#/gm');
    if (!(await until(() => page.evaluate(() => !!document.querySelector('[data-gx-root] [data-rtb-root] [data-rtb-action="new"]'))))) { fail('the card of custom tables is not on the GM screen'); await d.ctx.close(); return; }
    await page.click('[data-rtb-action="new"]');
    if (!(await until(() => page.evaluate(() => document.activeElement?.dataset?.rtbField === 'name'), 3000, 50))) fail('the new table form does not take the focus into its name field');
    await page.fill('[data-rtb-field="name"]', 'Встречи <b>в порту</b>');
    await page.fill('[data-rtb-field="group"]', 'Улицы');
    await page.selectOption('[data-rtb-field="die"]', '2d6');
    await page.selectOption('[data-rtb-field="die"]', '1d6');
    if ((await page.inputValue('[data-rtb-field="name"]')) !== 'Встречи <b>в порту</b>') fail('choosing the die lost the typed name');
    await page.click('[data-rtb-root] summary');
    await page.fill('[data-rtb-field="bulk"]', 'Патруль\nТихо\nСтарый знакомый\nДождь\nОблава\nПустой причал');
    await page.click('[data-rtb-action="bulk-add"]');
    const ranges = () => page.evaluate(() => [...document.querySelectorAll('[data-rtb-field="from"]')].map((f, i) => f.value + '-' + document.querySelector(`[data-rtb-field="to"][data-rtb-row="${i}"]`).value).join(' '));
    if ((await ranges()) !== '1-1 2-2 3-3 4-4 5-5 6-6') fail('six pasted lines were not spread over the d6: ' + await ranges());
    await page.click('[data-rtb-action="row-del"][data-rtb-row="5"]');
    await page.click('[data-rtb-action="row-del"][data-rtb-row="4"]');
    const problems = () => page.evaluate(() => document.querySelector('[data-rtb-problems]')?.innerText || '');
    if (!/Нет результата для: 5–6/.test(await problems())) fail('the gap 5–6 is not named: ' + await problems());
    await page.click('[data-rtb-action="spread"]');
    if ((await ranges()) !== '1-2 3-4 5-5 6-6') fail('«Расставить диапазоны по порядку» did not cover the die: ' + await ranges());
    // Typing is checked as it happens, and the field being typed in keeps the focus.
    await page.fill('[data-rtb-field="from"][data-rtb-row="3"]', '5');
    if (!/Строки 3 и 4 пересекаются на значении 5/.test(await problems())) fail('the overlap is not named: ' + await problems());
    if (!(await page.evaluate(() => document.activeElement?.dataset?.rtbField === 'from' && document.activeElement.dataset.rtbRow === '3'))) fail('the field lost the focus while its value was checked');
    await page.click('[data-rtb-action="save"]');
    if (!(await until(() => page.evaluate(() => document.activeElement?.classList.contains('rtb-error')), 3000, 50))) fail('a table with an overlap was saved, or the message did not take the focus');
    if ((await stored()).length) fail('a table with an overlap reached the saved data');
    await fits('the editor');
    // In the default dark look a field must stand out from what is behind it: by its fill or by a visible border.
    const flat = await page.evaluate(() => { const clear = c => /rgba\(0, 0, 0, 0\)|transparent/.test(c); const seen = el => { for (let n = el; n; n = n.parentElement) { const c = getComputedStyle(n).backgroundColor; if (!clear(c)) return c; } return ''; }; return [...document.querySelectorAll('.rtb-entry input')].filter(i => seen(i) === seen(i.parentElement) && clear(getComputedStyle(i).borderTopColor)).length; });
    if (flat) fail(flat + ' fields of the table rows cannot be told from the row behind them');
    // A reload in the middle of the work keeps the open form with everything typed.
    await page.reload(); await wait(500);
    if (!(await until(() => page.evaluate(() => document.querySelector('[data-rtb-field="name"]')?.value === 'Встречи <b>в порту</b>'), 5000, 100))) fail('a reload lost the table that was being edited');
    if ((await ranges()) !== '1-2 3-4 5-5 5-6') fail('a reload lost the typed rows: ' + await ranges());
    if ((await stored()).length) fail('a reload stored the unfinished table');
    await page.fill('[data-rtb-field="from"][data-rtb-row="3"]', '6');
    await page.click('[data-rtb-action="row-del"][data-rtb-row="3"]');
    if (!/Нет результата для: 6\./.test(await problems())) fail('the gap 6 is not named: ' + await problems());
    await page.click('[data-rtb-action="save"]');
    if (!(await until(async () => (await stored()).length === 1))) { fail('the table was not saved'); await d.ctx.close(); return; }
    const table = (await stored())[0];
    if (table.name !== 'Встречи <b>в порту</b>' || table.group !== 'Улицы' || table.die !== '1d6' || table.entries.map(e => e.from + '-' + e.to).join() !== '1-2,3-4,5-5') fail('the saved table is not what was typed: ' + JSON.stringify(table));
    if (await page.evaluate(() => !!document.querySelector('[data-rtb-root] b'))) fail('a typed name was drawn as markup');
    if (!(await page.evaluate(() => /есть пропуски/.test(document.querySelector('.rtb-table')?.innerText || '')))) fail('the list does not mark the table with a gap');
    await fits('the list');
    // A roll: the result is said next to the button, the button keeps the focus, the history has the line.
    const rollBtn = `[data-rtb-action="roll"][data-rtb-id="${table.id}"]`;
    await page.focus(rollBtn); await page.keyboard.press('Enter');
    if (!(await until(() => page.evaluate(() => !!document.querySelector('.rtb-table .rtb-result[role="status"] strong')?.textContent.trim()), 3000, 50))) fail('the roll shows no result');
    if (!(await page.evaluate(s => document.activeElement === document.querySelector(s), rollBtn))) fail('the roll button lost the focus');
    if (!(await page.evaluate(() => /Таблица: Встречи/.test(document.querySelector('[data-gx-section="tables"] .gx-log')?.textContent || '')))) fail('the result is not in «Последние результаты»');
    await page.click('[data-gx-action="journal"][data-gx-index="0"]');
    if (!(await until(() => page.evaluate(() => /Таблица: Встречи <b>в порту<\/b> 1d6: \d /.test(JSON.stringify(JSON.parse(localStorage.getItem('nightcity-red-v1') || '{}').campaigns || []))), 3000, 50))) fail('«В журнал» did not write the table result into the campaign journal');
    const box = await page.evaluate(s => { const r = document.querySelector(s).getBoundingClientRect(); return [Math.round(r.width), Math.round(r.height)]; }, rollBtn);
    if (box[1] < 44) fail('the roll button is lower than 44px on a phone: ' + box);
    await page.goto(BASE + '#/dice'); await wait(400);
    const line = await page.evaluate(() => document.querySelector('#history-list')?.innerText || '');
    if (!/Таблица: Встречи <b>в порту<\/b>/.test(line) || !/1d6: \d · /.test(line)) fail('the roll is not in the roll history: ' + line.slice(0, 120));
    // The file: out, and back in as «nothing new».
    await page.goto(BASE + '#/gm'); await wait(400);
    const [download] = await Promise.all([page.waitForEvent('download'), page.click(`[data-rtb-action="export"][data-rtb-id="${table.id}"]`)]);
    const saved = await download.path(), file = JSON.parse(fs.readFileSync(saved, 'utf8'));
    if (file.format !== 'nightcity-red-roll-tables' || file.version !== 1 || file.tables?.length !== 1 || file.tables[0].name !== table.name) fail('the exported file is not a table file: ' + JSON.stringify(file).slice(0, 120));
    if (!/^night-city-roll-tables-\d{4}-\d\d-\d\d\.json$/.test(download.suggestedFilename())) fail('the file name is ' + download.suggestedFilename());
    for (const [sel, title] of [['[data-rtb-action="export-group"]', 'Улицы'], ['[data-rtb-action="export-all"]', '']]) {
      const [dl] = await Promise.all([page.waitForEvent('download'), page.click(sel)]);
      const made = JSON.parse(fs.readFileSync(await dl.path(), 'utf8'));
      if (made.format !== 'nightcity-red-roll-tables' || made.title !== title || made.tables?.length !== 1 || made.tables[0].id !== table.id) fail(sel + ': not the expected table file: ' + JSON.stringify(made).slice(0, 120));
    }
    await page.setInputFiles('[data-rtb-file]', saved);
    if (!(await until(() => page.evaluate(() => !!document.querySelector('[data-rtb-preview]')), 3000, 50))) fail('the opened file is not shown before it is taken in');
    if (!(await page.evaluate(() => /Новых: 0 · заменит ваши: 0 · без изменений: 1/.test(document.querySelector('[data-rtb-preview]')?.innerText || '') && !document.querySelector('[data-rtb-action="apply"]')))) fail('the same file is not recognised as already here');
    await page.click('[data-rtb-action="discard"]');
    // A file of another kind is refused, and the message names the menu where a backup is really opened.
    const wrong = path.join(os.tmpdir(), `ncred-not-tables-${process.pid}.json`);
    fs.writeFileSync(wrong, JSON.stringify({ characters: [], campaigns: [] }));
    await page.setInputFiles('[data-rtb-file]', wrong);
    if (!(await until(() => page.evaluate(() => /Это не файл таблиц бросков.*«Персонажи».*«Файлы и резервные копии».*«Импорт копии»/.test(document.querySelector('[data-rtb-root] .rtb-error')?.innerText || '')), 3000, 50))) fail('a file of another kind is not refused with the place where a backup is opened');
    if ((await stored())[0]?.name !== table.name || (await stored()).length !== 1) fail('a file of another kind changed the tables');
    fs.rmSync(wrong, { force: true });
    // A changed copy of the file replaces the table only after the button, and one press takes it back.
    const copy = path.join(os.tmpdir(), `ncred-tables-${process.pid}.json`);
    fs.writeFileSync(copy, JSON.stringify({ ...file, tables: [{ ...file.tables[0], name: 'Из файла' }, { id: 'bad', name: 'Кривая', die: '1d6', entries: [{ from: 1, to: 4, text: 'a' }, { from: 4, to: 6, text: 'b' }] }] }));
    await page.setInputFiles('[data-rtb-file]', copy);
    if (!(await until(() => page.evaluate(() => /заменит ваши: 1/.test(document.querySelector('[data-rtb-preview]')?.innerText || '')), 3000, 50))) fail('a changed table is not offered as a replacement');
    if (!(await page.evaluate(() => /будут пропущены: 1/.test(document.querySelector('[data-rtb-preview]')?.innerText || '')))) fail('a table with overlapping ranges in the file is not reported as skipped');
    if ((await stored())[0].name !== table.name) fail('the file changed the data before the button was pressed');
    await fits('the file preview');
    await page.click('[data-rtb-action="apply"]');
    if (!(await until(async () => (await stored())[0]?.name === 'Из файла'))) fail('the file was not taken in');
    if ((await stored()).length !== 1) fail('the broken table from the file was stored');
    await page.click('[data-rtb-action="undo"]');
    if (!(await until(async () => (await stored())[0]?.name === table.name))) fail('the import was not taken back');
    fs.rmSync(copy, { force: true });
    // Delete is one press with a way back, and the table survives a reload.
    await page.click(`[data-rtb-action="del"][data-rtb-id="${table.id}"]`);
    if (!(await until(async () => (await stored()).length === 0 && await page.evaluate(() => !document.querySelector('.rtb-table') && document.activeElement?.dataset?.rtbAction === 'undo')))) fail('the table was not deleted, or the way back did not take the focus');
    await page.click('[data-rtb-action="undo"]');
    if (!(await until(async () => (await stored()).length === 1))) fail('the deleted table did not come back');
    await page.reload(); await wait(500);
    if (!(await until(() => page.evaluate(s => !!document.querySelector(s), rollBtn)))) fail('the table is gone after a reload');
    if (!(await page.evaluate(() => /Таблица: Встречи/.test(document.querySelector('[data-gx-section="tables"] .rtb-log')?.textContent || '')))) fail('the table result is gone from «Последние результаты» after a reload');
    await page.click('[data-gx-action="name1"]');
    if (!(await until(() => page.evaluate(() => { const l = JSON.parse(localStorage.getItem('nc-gm-prep-v1') || '{}').log || []; return l[0]?.kind === 'names' && l.some(e => e.kind === 'custom'); }), 3000, 50))) fail('the next result erased the saved table result');
    // The way back is withdrawn once the tables were replaced from outside the card, as a restored backup does.
    await page.click(`[data-rtb-action="del"][data-rtb-id="${table.id}"]`);
    if (!(await until(() => page.evaluate(() => !!document.querySelector('[data-rtb-action="undo"]')), 3000, 50))) fail('no way back after the delete');
    await page.evaluate(() => { const st = window.App.getState(); st.gmExtras = { ...(st.gmExtras || {}), rollTables: [{ id: 'restored', name: 'Из копии', group: '', die: '1d6', entries: [{ from: 1, to: 6, text: 'x' }] }] }; window.App.save(); window.App.render(); });
    if (!(await until(() => page.evaluate(() => /Из копии/.test(document.querySelector('.rtb-table')?.innerText || '') && !document.querySelector('[data-rtb-action="undo"]')), 3000, 50))) fail('the way back to an older list is still offered after the tables were replaced');
    if (!(await until(async () => (await stored()).map(t => t.id).join() === 'restored', 3000, 100))) fail('the replaced tables were not kept');
    for (const e of page.errs) fail(e);
    await d.ctx.close();
    // The card with a result, the open editor and a file preview against the accessibility rules, in three looks.
    const axe = (() => { try { return fs.readFileSync(require.resolve('axe-core/axe.min.js'), 'utf8'); } catch { return null; } })();
    if (axe) for (const [look, theme, width] of [['native', 'light', 390], ['board', 'dark', 1280], ['cyber', 'dark', 1280]]) {
      const o = await device({ look, theme, width }), p = o.page;
      await p.goto(BASE + '#/gm'); await wait(400);
      await p.evaluate(f => { const st = window.App.getState(); st.gmExtras = { ...(st.gmExtras || {}), rollTables: f.tables }; window.App.save(); window.RollTables.openFile(JSON.stringify({ ...f, tables: [{ ...f.tables[0], id: 'other', group: '' }] })); window.App.render(); }, file);
      await p.click(rollBtn); await wait(200);
      const rules = async where => {
        // The pointer is taken off the button it has just pressed: the check reads the card at rest, not a hover colour.
        await p.mouse.move(0, 0); await wait(100);
        await p.evaluate(axe);
        const found = await p.evaluate(() => window.axe.run(document.querySelector('[data-rtb-root]'), { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa'] }, resultTypes: ['violations'] }).then(r => r.violations.filter(v => ['critical', 'serious'].includes(v.impact)).map(v => `${v.id} (${v.nodes.length}): ${v.nodes[0].target.join(' ').slice(0, 70)}`)));
        for (const v of found) fail(`${look} ${theme} ${where}: ${v}`);
        const [sw, iw] = await p.evaluate(() => [document.documentElement.scrollWidth, innerWidth]); if (sw > iw) fail(`${look} ${theme} ${where}: the page scrolls sideways`);
      };
      if (!(await p.evaluate(() => !!document.querySelector('.rtb-result') && !!document.querySelector('[data-rtb-preview]')))) fail(`${look} ${theme}: the result or the file preview is not drawn`);
      await rules('list');
      await p.click(`[data-rtb-action="edit"][data-rtb-id="${table.id}"]`); await p.click('[data-rtb-root] summary'); await p.fill('[data-rtb-field="to"][data-rtb-row="0"]', '4'); await p.click('[data-rtb-action="save"]'); await wait(200);
      if (!(await p.evaluate(() => !!document.querySelector('[data-rtb-form] .rtb-error') && !!document.querySelector('.rtb-problems .rtb-bad')))) fail(`${look} ${theme}: the editor with an error is not drawn`);
      await rules('editor');
      for (const e of p.errs) fail(`${look} ${theme}: ${e}`);
      await o.ctx.close();
    }
  });

  await check('the NPC builder: four steps on a phone, a saved preset, three numbered copies in the tracker, undo', async fail => {
    const d = await device({ width: 390 }), page = d.page;
    const fits = async where => { const [sw, iw] = await page.evaluate(() => [document.documentElement.scrollWidth, innerWidth]); if (sw > iw) fail(`${where}: the page scrolls sideways (${sw} > ${iw})`); };
    const stored = () => page.evaluate(() => { const s = JSON.parse(localStorage.getItem('nightcity-red-v1') || '{}'); return { lib: s.gmExtras?.npcLibrary || [], roster: s.campaigns?.[0]?.roster || [] }; });
    const onHeading = step => until(() => page.evaluate(n => document.activeElement?.matches('[data-nb-heading]') && document.querySelector('[data-nb-step-body]')?.dataset.nbStepBody === String(n), step), 3000, 50);
    const said = () => page.evaluate(() => document.querySelector('[data-nb-status]')?.textContent || '');
    await page.goto(BASE + '#/gm');
    if (!(await until(() => page.evaluate(() => { const b = document.querySelector('[data-gx-root] [data-nb-root]'), l = document.querySelector('[data-nl-root]'); return !!b && !!l && !!(b.compareDocumentPosition(l) & Node.DOCUMENT_POSITION_FOLLOWING); })))) { fail('the builder card is not above the NPC library on the GM screen'); await d.ctx.close(); return; }
    await page.click('[data-nb-action="open"]');
    if (!(await onHeading(0))) fail('opening the builder does not take the focus to the heading of step one');
    // Step one: who. The keyboard moves through the archetypes without losing the focus.
    await page.focus('[data-nb-field="arch"][value="bodyguard"]'); await page.keyboard.press('ArrowDown');
    if (!(await until(() => page.evaluate(() => document.activeElement?.dataset?.nbField === 'arch' && document.activeElement.checked && document.activeElement.value === 'boosterganger'), 3000, 50))) fail('an arrow key in the archetype group lost the focus or did not choose the next archetype');
    await page.check('[data-nb-field="arch"][value="bodyguard"]');
    await page.check('[data-nb-field="tier"][value="lieutenant"]');
    const sum = await page.evaluate(() => document.querySelector('[data-nb-summary]')?.innerText.replace(/\s+/g, ' '));
    if (sum !== 'REF 7 BODY 7 WILL 5 HP 40 SP 11') fail('a bodyguard one level up does not show REF 7, HP 40, SP 11: ' + sum);
    await page.fill('[data-nb-field="name"]', 'Охрана <b>клуба</b>');
    await fits('step one');
    await page.click('[data-nb-action="next"]');
    if (!(await onHeading(1))) fail('«Далее» does not take the focus to the heading of step two');
    // Step two: the fight. Armor one rung up, the shotgun out, a pistol from the catalog in.
    await page.click('[data-nb-action="sp"][data-nb-d="1"]');
    if (!/^SP 12 · /.test(await page.evaluate(() => document.querySelector('[data-nb-sp]')?.innerText || ''))) fail('armor did not go one rung up to SP 12');
    if (!(await page.evaluate(() => document.activeElement?.dataset?.nbFocus === 'sp:1'))) fail('the «+» of the armor lost the focus when the card was drawn again');
    await page.click('[data-nb-action="attack"][data-nb-i="0"]');
    if ((await page.getAttribute('[data-nb-action="attack"][data-nb-i="0"]', 'aria-pressed')) !== 'false') fail('a weapon that was pressed is still in the preset');
    await page.selectOption('[data-nb-field="addWeapon"]', 'weapon-heavy-pistol');
    await page.click('[data-nb-action="add-weapon"]');
    if ((await page.evaluate(() => document.querySelector('[data-nb-action="attack"][data-nb-i="2"]')?.innerText)) !== 'Тяжёлый пистолет · +12 · 3d6') fail('the pistol from the catalog was not added with the total of the archetype');
    if ((await said()) !== 'Добавлено: Тяжёлый пистолет') fail('adding a weapon is not announced: ' + await said());
    await fits('step two');
    await page.click('[data-nb-action="next"]');
    if (!(await onHeading(2))) fail('«Далее» does not take the focus to the heading of step three');
    // Step three: cyberware and gear with plus and minus.
    await page.click('[data-nb-action="kit"][data-nb-i="0"][data-nb-d="1"]');
    await page.click('[data-nb-action="kit"][data-nb-i="2"][data-nb-d="-1"]');
    if ((await said()) !== 'Убрано: Радиокоммуникатор') fail('removing the last piece is not announced: ' + await said());
    if (!(await page.evaluate(() => document.querySelector('[data-nb-root]').contains(document.activeElement) && document.activeElement !== document.body))) fail('the focus left the card when a kit row was removed');
    await page.selectOption('[data-nb-field="addCyber"]', 'cyberware-neural-link');
    await page.click('[data-nb-action="add-cyber"]');
    await page.fill('[data-nb-field="own"]', 'Жетон <i>клуба</i>');
    await page.click('[data-nb-action="add-own"]');
    const kit = await page.evaluate(() => [...document.querySelectorAll('.nb-kit li')].map(li => li.querySelector('.nb-kit-name').textContent + ' ' + li.querySelector('.nb-qty').textContent).join(' | '));
    if (kit !== 'Пули для дробовика ×26 | Патроны для очень тяжёлого пистолета ×25 | Нейронная связь ×1 | Жетон <i>клуба</i> ×1') fail('the kit is not what was set: ' + kit);
    if (await page.evaluate(() => !!document.querySelector('[data-nb-root] i, [data-nb-root] .nb-kit b'))) fail('typed text was drawn as markup');
    await fits('step three');
    await page.click('[data-nb-action="next"]');
    if (!(await onHeading(3))) fail('«Далее» does not take the focus to the heading of step four');
    // Step four: the review shows what will be saved; the save button is pressed right after typing the number.
    const preview = await page.evaluate(() => document.querySelector('[data-nb-preview]')?.innerText || '');
    for (const part of ['Охрана <b>клуба</b>', 'REF 7 · HP 40 · BODY/WILL 7/5 · SP 12/12', 'Очень тяжёлый пистолет +12 4d6; Тяжёлый пистолет +12 3d6', 'Нейронная связь', 'Основа: Телохранитель · лейтенант · стр. 412']) if (!preview.includes(part)) fail('the review does not show «' + part + '»: ' + preview.replace(/\s+/g, ' ').slice(0, 300));
    if (preview.includes('Дробовик низкого качества')) fail('the weapon that was taken out is in the review');
    await page.selectOption('[data-nb-field="campaign"]', 'k1');
    await page.fill('[data-nb-field="count"]', '3');
    if ((await page.evaluate(() => document.querySelector('[data-nb-action="save"]')?.innerText)) !== 'Сохранить и добавить в трекер: 3') fail('the save button does not say how many copies go to the tracker');
    await fits('step four');
    await page.click('[data-nb-action="save"]');
    const saved = await until(async () => { const s = await stored(); return s.lib.length === 1 && s.roster.length === 4 ? s : null; }, 5000, 100);
    if (!saved) { fail('the preset and three copies did not reach the saved data'); await d.ctx.close(); return; }
    const e = saved.lib[0];
    if (e.name !== 'Охрана <b>клуба</b>' || e.head !== 12 || e.torso !== 12 || e.hp !== 40 || e.ref !== 7) fail('the saved preset has other numbers: ' + JSON.stringify(e).slice(0, 200));
    if ((e.attacks || []).map(a => a.name + a.base + a.damage).join() !== 'Очень тяжёлый пистолет124d6,Тяжёлый пистолет123d6') fail('the saved attacks are wrong: ' + JSON.stringify(e.attacks));
    if (!/Пули для дробовика ×26.*Нейронная связь, Жетон <i>клуба<\/i>\nОснова/.test(e.notes) || /радиокоммуникатор/i.test(e.notes)) fail('the saved notes do not carry the kit: ' + e.notes);
    if (saved.roster.map(r => r.name).join() !== 'Ganger,Охрана <b>клуба</b> 1,Охрана <b>клуба</b> 2,Охрана <b>клуба</b> 3') fail('the tracker rows are not numbered copies: ' + saved.roster.map(r => r.name));
    if (saved.roster.slice(1).some(r => r.sourceLibrary !== e.id || r.kind !== 'npc' || r.sp?.head !== 12 || r.body !== 7)) fail('a tracker row does not carry the preset, its armor or BODY');
    if (!(await until(() => page.evaluate(() => document.querySelector('[data-nl-root] .nl-head strong')?.textContent === 'Охрана <b>клуба</b>' && !document.querySelector('[data-nl-root] .nl-head b') && !!document.querySelector('[data-nb-action="open"]')), 3000, 50))) fail('the library card does not show the new preset as plain text, or the builder did not close');
    if (!/Сохранено в библиотеку: Охрана <b>клуба<\/b>\. В «Job» добавлено:/.test(await page.evaluate(() => document.querySelector('#app-notice')?.textContent || ''))) fail('the save is not confirmed in the notice');
    await fits('after the save');
    // Undo takes back the preset and exactly its three rows.
    await page.click('#app-notice .notice-action');
    const undone = await until(async () => { const s = await stored(); return s.lib.length === 0 && s.roster.length === 1 ? s : null; }, 5000, 100);
    if (!undone || undone.roster[0].name !== 'Ganger') fail('«Отменить» did not remove the preset and its rows, or touched the row that was there before');
    if (!(await until(() => page.evaluate(() => !document.querySelector('[data-nl-root] .nl-entry')), 3000, 50))) fail('the library card still shows the preset that was taken back');
    // A second NPC with nothing changed, then a reload: the data is still there and the library can roll for it.
    // On the way the interface language is switched in the middle of the build, after the weapons and the kit
    // were touched: the rows that came from the archetype follow the language, and nothing Russian is left.
    await page.click('[data-nb-action="open"]');
    await page.click('[data-nb-action="next"]');
    await page.click('[data-nb-action="attack"][data-nb-i="0"]'); await page.click('[data-nb-action="attack"][data-nb-i="0"]');
    await page.click('[data-nb-action="next"]');
    await page.click('[data-nb-action="kit"][data-nb-i="0"][data-nb-d="1"]'); await page.click('[data-nb-action="kit"][data-nb-i="0"][data-nb-d="-1"]');
    const setLang = lang => page.evaluate(l => { App.getState().lang = l; App.save(); App.render(); }, lang);
    const cardText = () => page.evaluate(() => document.querySelector('[data-nb-root]').innerText + [...document.querySelectorAll('[data-nb-root] [aria-label]')].map(x => x.getAttribute('aria-label')).join(' '));
    await setLang('en');
    if (!(await until(() => page.evaluate(() => document.querySelector('[data-nb-root]')?.dataset.lang === 'en' && document.querySelector('[data-nb-step-body]')?.dataset.nbStepBody === '2'), 3000, 50))) fail('the open builder did not follow the language switch on step three');
    let mixed = (await cardText()).match(/[А-Яа-яЁё][А-Яа-яЁё ]{2,30}/);
    if (mixed) fail('after a switch to English step three still has Russian text: «' + mixed[0] + '»');
    await page.click('[data-nb-action="next"]');
    mixed = (await cardText()).match(/[А-Яа-яЁё][А-Яа-яЁё ]{2,30}/);
    if (mixed) fail('after a switch to English the review still has Russian text: «' + mixed[0] + '»');
    if (!/Poor Quality Shotgun \+10 5d6; Very Heavy Pistol \+10 4d6/.test(await page.evaluate(() => document.querySelector('[data-nb-preview]')?.innerText || ''))) fail('the review does not name the weapons in English after the switch');
    await setLang('ru');
    await until(() => page.evaluate(() => document.querySelector('[data-nb-root]')?.dataset.lang === 'ru' && !!document.querySelector('[data-nb-action="save"]')), 3000, 50);
    await page.click('[data-nb-action="save"]');
    await until(async () => (await stored()).lib.length === 1, 5000, 100);
    await page.reload(); await wait(500);
    const again = await stored();
    if (again.lib[0]?.name !== 'Телохранитель' || again.lib[0].hp !== 35 || again.roster.map(r => r.name).join() !== 'Ganger,Телохранитель 1') fail('after a reload the saved NPC is not there: ' + JSON.stringify([again.lib[0]?.name, again.roster.map(r => r.name)]));
    if (!(await until(() => page.evaluate(() => document.querySelector('[data-nl-root] .nl-head strong')?.textContent === 'Телохранитель' && !!document.querySelector('[data-nl-root] [data-nl-action="roll-attack"]')), 5000, 100))) fail('the saved preset is not in the library card with its roll buttons after a reload');
    if (/[A-Za-z]{4,}/.test(again.lib[0]?.notes || '') || (again.lib[0]?.attacks || []).map(a => a.name).join() !== 'Дробовик низкого качества,Очень тяжёлый пистолет') fail('the preset saved after switching the language there and back is not in Russian: ' + JSON.stringify([again.lib[0]?.attacks, again.lib[0]?.notes]));
    // The save that fills the library: the card closes without its button, and the focus must stay inside it.
    await page.evaluate(() => { const st = App.getState(), N = window.NpcLibrary; let list = N.readLibrary(st); for (let i = 0; list.length < 99 && i < 200; i++) list = N.addEntry(list, { name: 'Filler ' + i, ref: 5, hp: 20 }).list; N.writeLibrary(st, list); App.save(); App.render(); });
    if (!(await until(async () => (await stored()).lib.length === 99, 5000, 100))) fail('could not fill the library up to 99 presets for the focus check');
    await until(() => page.evaluate(() => !!document.querySelector('[data-nb-action="open"]')), 3000, 50);
    await page.click('[data-nb-action="open"]');
    for (let i = 0; i < 3; i++) await page.click('[data-nb-action="next"]');
    await page.fill('[data-nb-field="count"]', '0');
    await page.click('[data-nb-action="save"]');
    await until(async () => (await stored()).lib.length === 100, 5000, 100);
    if (!(await until(() => page.evaluate(() => !document.querySelector('[data-nb-action="open"]') && !!document.querySelector('[data-nb-root]')?.contains(document.activeElement) && document.activeElement !== document.body), 3000, 50))) fail('after the save that filled the library the focus fell out of the builder card');
    await fits('the full library');
    for (const err of page.errs) fail(err);
    await d.ctx.close();
    // English: every step without Russian text.
    const en = await device({ lang: 'en', width: 390 });
    await en.page.goto(BASE + '#/gm'); await until(() => en.page.evaluate(() => !!document.querySelector('[data-nb-action="open"]')));
    await en.page.click('[data-nb-action="open"]');
    for (let step = 0; step < 4; step++) {
      const text = await en.page.evaluate(() => document.querySelector('[data-nb-root]').innerText + [...document.querySelectorAll('[data-nb-root] [aria-label]')].map(x => x.getAttribute('aria-label')).join(' '));
      const ru = text.match(/[А-Яа-яЁё][А-Яа-яЁё ]{2,30}/);
      if (ru) fail(`English step ${step + 1} has Russian text: «${ru[0]}»`);
      if (step < 3) await en.page.click('[data-nb-action="next"]');
    }
    for (const err of en.page.errs) fail(err);
    await en.ctx.close();
    // Every step against the accessibility rules, in the other looks.
    const axe = (() => { try { return fs.readFileSync(require.resolve('axe-core/axe.min.js'), 'utf8'); } catch { return null; } })();
    for (const [look, theme, width] of [['native', 'light', 390], ['board', 'dark', 390], ['board', 'light', 1280], ['cyber', 'dark', 1280]]) {
      const o = await device({ look, theme, width }), p = o.page;
      await p.goto(BASE + '#/gm'); await until(() => p.evaluate(() => !!document.querySelector('[data-nb-action="open"]')));
      await p.click('[data-nb-action="open"]');
      for (let step = 0; step < 4; step++) {
        if (step === 1) { await p.click('[data-nb-action="attack"][data-nb-i="0"]'); for (let i = 0; i < 5; i++) await p.click('[data-nb-action="sp"][data-nb-d="1"]'); }
        // The pointer is taken off the button it has just pressed: the check reads the card at rest, not a hover colour.
        await p.mouse.move(0, 0); await wait(100);
        if (axe) {
          await p.evaluate(axe);
          const found = await p.evaluate(() => window.axe.run(document.querySelector('[data-nb-root]'), { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa'] }, resultTypes: ['violations'] }).then(r => r.violations.filter(v => ['critical', 'serious'].includes(v.impact)).map(v => `${v.id} (${v.nodes.length}): ${v.nodes[0].target.join(' ').slice(0, 70)}`)));
          for (const v of found) fail(`${look} ${theme} step ${step + 1}: ${v}`);
        }
        const [sw, iw] = await p.evaluate(() => [document.documentElement.scrollWidth, innerWidth]); if (sw > iw) fail(`${look} ${theme} step ${step + 1}: the page scrolls sideways`);
        if (width < 600) { const small = await p.evaluate(() => [...document.querySelectorAll('[data-nb-root] button, [data-nb-root] select, [data-nb-root] input:not([type=radio]), [data-nb-root] .nb-option')].filter(x => { const r = x.getBoundingClientRect(); return r.width > 0 && (r.height < 43.5 || r.width < 43.5); }).map(x => (x.dataset.nbAction || x.dataset.nbField || x.className) + ' ' + Math.round(x.getBoundingClientRect().width) + 'x' + Math.round(x.getBoundingClientRect().height))); if (small.length) fail(`${look} ${theme} step ${step + 1}: touch targets under 44px: ${small.slice(0, 4).join(', ')}`); }
        if (step < 3) await p.click('[data-nb-action="next"]');
      }
      for (const err of p.errs) fail(`${look} ${theme}: ${err}`);
      await o.ctx.close();
    }
  });

  if (!brokerUrl) skip('custom roll tables in a room', 'aedes and ws are not installed');
  else await check('custom roll tables in a room: a roll reaches the player, a hidden roll stays with the Game Master', async fail => {
    const gm = await device(), player = await device({ width: 390 });
    const G = gm.page, P = player.page;
    await G.goto(BASE + '#/room'); await wait(400);
    await G.fill('#room-gm-name', 'Мастер'); await G.selectOption('#room-campaign', 'k1'); await G.click('[data-room-action="create"]');
    const link = await until(() => G.evaluate(() => { const s = window.Room._test.session(); return s?.code && s.gmFp ? window.Room._test.roomLink(s.code) : null; }));
    if (!link) { fail('the room was not created'); await gm.ctx.close(); await player.ctx.close(); return; }
    await P.goto(link); await wait(600);
    await P.fill('#room-player-name', 'Аня'); await P.selectOption('#room-character', 'v1'); await P.click('[data-room-action="join"]');
    if (!(await until(() => G.evaluate(() => [...window.Room._test.members().values()].some(m => m.name === 'Аня'))))) fail('the Game Master does not see the player');
    await G.evaluate(() => { const st = window.App.getState(); st.gmExtras = { ...(st.gmExtras || {}), rollTables: [{ id: 'room1', name: 'Слухи', group: '', die: '1d6', entries: [{ from: 1, to: 6, text: 'Патруль у ворот' }] }] }; window.App.save(); location.hash = '#/gm'; });
    const roll = '[data-rtb-action="roll"][data-rtb-id="room1"]';
    if (!(await until(() => G.evaluate(s => !!document.querySelector(s) && !!document.querySelector('[data-rtb-field="quiet"]'), roll)))) { fail('in a room the card has no roll button or no «Не показывать бросок игрокам»'); await gm.ctx.close(); await player.ctx.close(); return; }
    const inFeed = page => page.evaluate(() => window.Room._test.state().feed.filter(r => r.label === 'Таблица: Слухи').map(r => String(r.detail)));
    await G.click(roll);
    if (!(await until(async () => { const l = await inFeed(P); return l.length === 1 && /^1d6: \d · Патруль у ворот$/.test(l[0]); }))) fail('a table roll did not reach the player: ' + JSON.stringify(await inFeed(P)));
    // The hidden roll: the Game Master sees the result and keeps it in the history; the feed of neither side grows.
    await G.check('[data-rtb-field="quiet"]');
    await G.click(roll);
    if (!(await until(() => G.evaluate(() => /только у вас/.test(document.querySelector('.rtb-result')?.innerText || '')), 3000, 50))) fail('the hidden roll shows no result marked as private');
    if ((await G.evaluate(() => window.RollHistory.all().filter(r => r.label === 'Таблица: Слухи').length)) !== 2) fail('the hidden roll is not in the Game Master\'s own history');
    await wait(1500);
    if ((await inFeed(P)).length !== 1) fail('a hidden table roll reached the player');
    if ((await inFeed(G)).length !== 1) fail('a hidden table roll was put into the room feed');
    for (const e of [...G.errs, ...P.errs]) fail(e);
    await gm.ctx.close(); await player.ctx.close();
  });

  if (!brokerUrl) skip('two browsers meet in a room', 'aedes and ws are not installed');
  else await check('two browsers meet in a room: join by link, rolls, hidden enemies stay hidden', async fail => {
    const gm = await device(), player = await device({ width: 390 });
    const G = gm.page, P = player.page;
    await G.goto(BASE + '#/room'); await wait(400);
    await G.fill('#room-gm-name', 'Мастер'); await G.selectOption('#room-campaign', 'k1'); await G.click('[data-room-action="create"]');
    const link = await until(() => G.evaluate(() => { const s = window.Room._test.session(); return s?.code && s.gmFp ? window.Room._test.roomLink(s.code) : null; }));
    if (!link) { fail('the room was not created'); return; }
    if (!/#\/room\/[A-Z0-9-]+\.[0-9a-f]{24}$/.test(link)) fail('the link does not carry the Game Master key: ' + link.replace(/^.*#/, '#'));
    await P.goto(link); await wait(600);
    await P.fill('#room-player-name', 'Аня'); await P.selectOption('#room-character', 'v1'); await P.click('[data-room-action="join"]');
    if (!(await until(() => G.evaluate(() => [...window.Room._test.members().values()].some(m => m.name === 'Аня'))))) fail('the Game Master does not see the player');
    if (!(await until(() => P.evaluate(() => [...window.Room._test.members().values()].some(m => m.role === 'gm' && !m.me && !m.impostor))))) fail('the player does not see the Game Master');
    if (!(await until(() => P.evaluate(() => window.Room._test.state().combat?.campaign === 'Job')))) fail('the initiative did not reach the player');
    await P.evaluate(() => window.App.open('v1')); await wait(400);
    await P.evaluate(() => document.querySelector('[data-action="skill-roll"][data-skill="Athletics"]')?.click());
    if (!(await until(() => G.evaluate(() => window.Room._test.state().feed.some(r => /Атлетика/.test(r.label) && r.who === 'Аня'))))) fail('a sheet roll did not reach the Game Master');
    await P.evaluate(() => window.App.setView('combat')); await wait(400);
    await P.evaluate(() => document.querySelector('[data-gr-action="grab-roll"]')?.click());
    if (!(await until(() => G.evaluate(() => window.Room._test.state().feed.some(r => r.label === 'Захват'))))) fail('a tool roll did not reach the Game Master');
    for (const e of [...G.errs, ...P.errs]) fail(e);
    await gm.ctx.close(); await player.ctx.close();
  });

  if (!brokerUrl) skip('«Агент» in a room', 'aedes and ws are not installed');
  else await check('«Агент»: the Game Master drafts an entry, publishes it, the player sees it on the room page, hiding takes it away', async fail => {
    const gm = await device(), player = await device({ width: 390, look: 'board', theme: 'light' });
    const G = gm.page, P = player.page;
    const axeFile = (() => { try { return require.resolve('axe-core/axe.min.js'); } catch { return null; } })(), axeSource = axeFile ? fs.readFileSync(axeFile, 'utf8') : null;
    // The same rules as the accessibility check, on the one card this check is about.
    const axe = async (page, selector, where) => {
      if (!axeSource) return;
      await page.evaluate(axeSource);
      // The order of headings is a best-practice rule of moderate weight; it is asked for by name, the other best-practice rules stay out.
      const found = await page.evaluate(sel => window.axe.run(document.querySelector(sel), { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'best-practice'] }, resultTypes: ['violations'] }).then(r => r.violations.filter(v => v.id === 'heading-order' || (!v.tags.includes('best-practice') && ['critical', 'serious'].includes(v.impact))).map(v => `${v.id} (${v.nodes.length}): ${v.nodes[0].target.join(' ').slice(0, 70)}`)), selector);
      for (const v of found) fail(`${where}: ${v}`);
    };
    const sideways = (page, where) => page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth).then(over => { if (over > 0) fail(`${where}: the page scrolls sideways by ${over}px`); });
    const small = (page, selector, where) => page.evaluate(sel => [...document.querySelectorAll(sel)].filter(b => b.offsetParent && b.getBoundingClientRect().height < 44).length, selector).then(n => { if (n) fail(`${where}: ${n} controls are lower than 44px`); });
    await G.goto(BASE + '#/room'); await wait(400);
    await G.fill('#room-gm-name', 'Мастер'); await G.selectOption('#room-campaign', 'k1'); await G.click('[data-room-action="create"]');
    const link = await until(() => G.evaluate(() => { const s = window.Room._test.session(); return s?.code && s.gmFp ? window.Room._test.roomLink(s.code) : null; }));
    if (!link) { fail('the room was not created'); return; }
    await P.goto(link); await wait(600);
    await P.fill('#room-player-name', 'Аня'); await P.selectOption('#room-character', 'v1'); await P.click('[data-room-action="join"]');
    if (!(await until(() => P.evaluate(() => [...window.Room._test.members().values()].some(m => m.role === 'gm' && !m.me && !m.impostor))))) fail('the player does not see the Game Master');
    if (!(await G.evaluate(() => /опубликуйте запись/.test(document.querySelector('[data-ra-card]')?.textContent || '')))) fail('the Game Master has no «Агент» card on the room page');
    // The Game Master writes under the open campaign.
    await G.goto(BASE + '#/campaigns'); await wait(300);
    await G.click('[data-campaign-action="open"][data-id="k1"]'); await wait(300);
    if (!(await G.locator('[data-ra-edit="k1"]').count())) { fail('no «Агент» editor under the open campaign'); await gm.ctx.close(); await player.ctx.close(); return; }
    if (!/Комната открыта/.test(await G.locator('[data-ra-status]').textContent())) fail('the editor does not say that the room is open');
    if (await G.locator('[data-ra-rating]').isVisible()) fail('the rating is offered before «Место» is chosen');
    await G.click('[data-ra-action="save"]');
    if (!/Введите заголовок/.test(await G.evaluate(() => document.querySelector('#app-notice')?.textContent || ''))) fail('an empty title is not refused in words');
    await G.selectOption('#ra-kind', 'place');
    if (!(await G.locator('[data-ra-rating]').isVisible())) fail('choosing «Место» does not offer the rating');
    await G.selectOption('#ra-rating', '4');
    const title = 'Бар <b>«Тихий час»</b> ' + 'Ж'.repeat(40);
    await G.fill('#ra-title', title); await G.fill('#ra-text', 'Наливают без вопросов.\nВход со двора.');
    // A repaint of the whole page in the middle of typing keeps what is typed.
    await G.evaluate(() => window.App.render());
    if ((await G.inputValue('#ra-title')) !== title || (await G.inputValue('#ra-kind')) !== 'place' || (await G.inputValue('#ra-rating')) !== '4') fail('a repaint lost what was typed into the form');
    await G.click('[data-ra-action="save"]'); await wait(300);
    if ((await G.locator('[data-ra-action="publish"]').count()) !== 1) fail('the draft is not in the list');
    if (await G.inputValue('#ra-title')) fail('the form is not cleared after the draft is added');
    if (await G.locator('[data-ra-edit] b').count()) fail('markup typed into a title became markup');
    await wait(900);
    if (await P.locator('[data-ra-card]').count()) fail('a draft reached the player');
    if (await P.evaluate(() => JSON.stringify(window.RoomAgent._test.shown().list) !== '[]')) fail('a draft was sent to the player');
    await axe(G, '[data-ra-edit]', 'editor, native dark 1280');
    // Publishing: the player gets the card and a notice.
    await G.click('[data-ra-action="publish"]');
    if (!(await until(() => P.evaluate(() => !!document.querySelector('[data-ra-card]'))))) fail('the published entry did not reach the player');
    const seen = await P.evaluate(() => { const c = document.querySelector('[data-ra-card]'); return c ? { text: c.textContent, stars: c.querySelector('.ra-stars')?.getAttribute('aria-label') || '', bold: c.querySelectorAll('b').length, controls: c.querySelectorAll('button,input,select,textarea').length, notice: document.querySelector('#app-notice')?.textContent || '' } : null; });
    if (seen) {
      if (!seen.text.includes(title) || !seen.text.includes('Вход со двора.')) fail('the player does not read the title and the text');
      if (seen.stars !== 'Оценка: 4 из 5') fail('the rating is not named for a screen reader: ' + seen.stars);
      if (seen.bold) fail('markup from the Game Master became markup on the player page');
      if (seen.controls) fail('the player card has controls');
      if (!/Агент · Место: Бар/.test(seen.notice)) fail('the player got no notice about the new entry: ' + seen.notice);
    }
    await sideways(P, 'player room page, 390px'); await axe(P, '[data-ra-card]', 'player card, board light 390');
    if ((await G.locator('[data-ra-action="unpublish"]').count()) !== 1 || !/опубликовано 1 \/ 30/.test(await G.locator('[data-ra-count]').textContent())) fail('the editor does not show the entry as published');
    // Editing a published entry rewords it for the player.
    await G.click('[data-ra-action="edit"]'); await G.fill('#ra-title', 'Бар «Громкий час»'); await G.click('[data-ra-action="save"]');
    if (!(await until(() => P.evaluate(() => /Громкий час/.test(document.querySelector('[data-ra-card]')?.textContent || ''))))) fail('the reworded entry did not reach the player');
    // Hiding takes it away again; deleting can be undone.
    await G.click('[data-ra-action="unpublish"]');
    if (!(await until(() => P.evaluate(() => !document.querySelector('[data-ra-card]'))))) fail('the hidden entry stayed with the player');
    await G.click('[data-ra-action="delete"]'); await wait(200);
    if (await G.locator('[data-ra-item]').count()) fail('the entry was not deleted');
    await G.click('#app-notice .notice-action'); await wait(300);
    if ((await G.locator('[data-ra-item]').count()) !== 1) fail('the deleted entry did not come back');
    if (!(await until(() => G.evaluate(() => JSON.parse(localStorage.getItem('nightcity-red-v1')).campaigns.find(c => c.id === 'k1')?.agentFeed?.length === 1), 3000))) fail('the feed is not saved with the campaign');
    // More than five published entries: the older ones fold away behind a summary that shows a marker, and a new entry
    // arriving (the room page is repainted whole) does not take the keyboard focus off that summary.
    await G.evaluate(() => { const c = window.App.getState().campaigns.find(x => x.id === 'k1'); for (let i = 0; i < 7; i++) { const r = window.RoomAgent.add(c, { kind: 'news', title: 'Сводка ' + i }); if (i < 6) window.RoomAgent.setPublished(c, r.id, true); } window.App.save(); window.App.render(); });
    if (!(await until(() => P.evaluate(() => /Ещё записей: 1/.test(document.querySelector('#ra-more-toggle')?.textContent || ''))))) fail('the older entries are not folded behind a summary on the player page');
    else {
      const sum = await P.evaluate(() => { const el = document.querySelector('#ra-more-toggle'), m = getComputedStyle(el, '::before'); return { marker: m.content, shown: m.display !== 'none' && parseFloat(m.width) > 0, height: el.getBoundingClientRect().height }; });
      if (!/▸/.test(sum.marker) || !sum.shown) fail('the summary of older entries shows no marker: ' + JSON.stringify(sum));
      if (sum.height < 44) fail('the summary of older entries is lower than 44px: ' + sum.height);
      await P.focus('#ra-more-toggle'); await P.keyboard.press('Enter');
      if (!(await P.evaluate(() => document.querySelector('[data-ra-more]').open))) fail('Enter on the summary does not open the older entries');
      await G.locator('[data-ra-action="publish"]').first().click();
      if (!(await until(() => P.evaluate(() => /Ещё записей: 2/.test(document.querySelector('#ra-more-toggle')?.textContent || ''))))) fail('one more published entry did not reach the player');
      const after = await P.evaluate(() => ({ focus: document.activeElement?.id || document.activeElement?.tagName, open: document.querySelector('[data-ra-more]')?.open === true }));
      if (after.focus !== 'ra-more-toggle') fail('a new entry threw the keyboard focus off the summary to ' + after.focus);
      if (!after.open) fail('a new entry closed the older entries');
      await sideways(P, 'player room page with folded entries, 390px'); await axe(P, '[data-ra-card]', 'player card with folded entries, board light 390');
    }
    // The Game Master's own room page mirrors the card.
    await G.goto(BASE + '#/room'); await wait(400);
    if (!(await G.locator('[data-ra-card] #ra-more-toggle').count())) fail('the Game Master does not see the card with the folded entries on the room page');
    else await axe(G, '[data-ra-card]', 'Game Master card, native dark 1280');
    for (const e of [...G.errs, ...P.errs]) fail(e);
    await gm.ctx.close(); await player.ctx.close();
    // The editor on a phone and in the other looks, with a title that has no place to break.
    const solo = await device({ width: 390, look: 'native', theme: 'light' }), S = solo.page;
    await S.goto(BASE + '#/campaigns'); await wait(300); await S.click('[data-campaign-action="open"][data-id="k1"]'); await wait(300);
    for (const [kind, name] of [['wanted', 'Щ'.repeat(80)], ['place', 'Склад у доков']]) { await S.selectOption('#ra-kind', kind); await S.fill('#ra-title', name); await S.fill('#ra-text', 'x'.repeat(200)); await S.click('[data-ra-action="save"]'); await wait(200); }
    await S.click('[data-ra-action="publish"]'); await wait(200);
    if (!/Комната не открыта/.test(await S.locator('[data-ra-status]').textContent())) fail('without a room the editor does not say that nothing is sent');
    for (const [look, theme, width] of [['native', 'light', 390], ['board', 'dark', 390], ['cyber', 'dark', 390], ['cyber', 'dark', 1280], ['board', 'light', 1440]]) {
      await S.setViewportSize({ width, height: 844 });
      await S.evaluate(([a, b]) => { localStorage.setItem('nc-ui-style', a); localStorage.setItem('nc-ui-theme', b); }, [look, theme]); await S.reload(); await wait(500);
      if (!(await S.locator('[data-ra-edit]').count())) { await S.goto(BASE + '#/campaigns'); await wait(300); await S.click('[data-campaign-action="open"][data-id="k1"]').catch(() => {}); await wait(300); }
      const where = `editor, ${look} ${theme} ${width}`;
      if ((await S.locator('[data-ra-item]').count()) !== 2) { fail(where + ': the saved entries are not shown after a reload'); continue; }
      await sideways(S, where); await axe(S, '[data-ra-edit]', where);
      if (width === 390) await small(S, '[data-ra-edit] button, [data-ra-edit] [data-ra-field]', where);
      // The help is read in full in every look: nothing folds it behind a «Подробнее» button.
      const help = await S.evaluate(() => { const p = document.querySelector('[data-ra-edit] .ra-help'); return p ? { folded: p.classList.contains('nx-clamp') || p.scrollHeight > p.clientHeight + 1, more: document.querySelectorAll('[data-ra-edit] .nx-more').length, drafts: /Черновики видите только вы/.test(p.innerText) } : null; });
      if (!help || help.folded || help.more || !help.drafts) fail(where + ': the help of the editor is not shown in full: ' + JSON.stringify(help));
    }
    for (const e of S.errs) fail(e);
    await solo.ctx.close();
  });

  if (!brokerUrl) skip('visibility in a room', 'aedes and ws are not installed');
  else await check('visibility: the GM chooses what players see of each participant, and what is not shown is not sent', async fail => {
    const gm = await device(), player = await device({ width: 390 });
    const G = gm.page, P = player.page, close = async () => { await gm.ctx.close(); await player.ctx.close(); };
    await G.goto(BASE + '#/room'); await wait(400);
    await G.fill('#room-gm-name', 'Мастер'); await G.selectOption('#room-campaign', 'k1'); await G.click('[data-room-action="create"]');
    const link = await until(() => G.evaluate(() => { const s = window.Room._test.session(); return s?.code && s.gmFp ? window.Room._test.roomLink(s.code) : null; }));
    if (!link) { fail('the room was not created'); await close(); return; }
    await P.goto(link); await wait(600);
    await P.fill('#room-player-name', 'Аня'); await P.selectOption('#room-character', 'v1'); await P.click('[data-room-action="join"]');
    const order = () => P.evaluate(() => JSON.parse(JSON.stringify(window.Room._test.state().combat?.order || null)));
    if (!(await until(async () => (await order())?.length === 1))) { fail('the initiative did not reach the player'); await close(); return; }
    // Nothing chosen yet: the row is what it always was.
    const first = (await order())[0];
    if (Object.keys(first).some(k => !['name', 'pc', 'none', 'own', 'init', 'current'].includes(k))) fail('with no setting the row carries more than before: ' + JSON.stringify(first));
    // The Game Master opens the tracker and adds a second, armored enemy next to the seeded one.
    await G.evaluate(() => { const c = window.App.getState().campaigns[0]; c.roster.push({ id: 'r2', kind: 'npc', name: 'Sniper', ref: 8, hp: 9, maxHp: 30, initiative: 8, order: 2, sp: { head: 7, body: 11 } }); window.App.save(); location.hash = '#/campaigns'; });
    await wait(300);
    await G.click('[data-campaign-action="open"][data-id="k1"]').catch(() => {});
    if (!(await until(() => G.evaluate(() => !!document.querySelector('[data-rv-room]') && document.querySelectorAll('[data-rv-row]').length === 2)))) { fail('the tracker has no «Игроки в комнате видят» list or no list per participant'); await close(); return; }
    if (await G.evaluate(() => !!document.querySelector('[data-campaign-action="hide"]'))) fail('the old «Скрыть от игроков» button is still next to the new list');
    // A row of the tracker is folded until it is opened; «Действия» is inside it.
    const openRow = (page, id) => page.evaluate(i => { const b = document.querySelector('[data-gt-action="toggle"][data-id="' + i + '"]'); if (b && b.dataset.open !== '1') b.click(); const d = document.querySelector('[data-rv-row="' + i + '"]')?.closest('details'); if (d) d.open = true; }, id);
    // The room level by keyboard: the list keeps the focus after the tracker is drawn again.
    await G.focus('[data-rv-room]'); await G.selectOption('[data-rv-room]', 'state');
    if (!(await until(() => G.evaluate(() => document.activeElement?.dataset?.rvRoom !== undefined && document.querySelector('[data-rv-room]').value === 'state'), 3000, 50))) fail('after the change the room list lost the focus or the value');
    if (!(await until(async () => { const o = await order(); return o?.length === 2 && o.every(r => Number.isInteger(r.w)); }))) fail('«state» did not reach the player: ' + JSON.stringify(await order()));
    if ((await order()).some(r => 'hp' in r || 'max' in r || 'sp' in r)) fail('«state» sent a number: ' + JSON.stringify(await order()));
    if (!(await until(() => P.evaluate(() => /Тяжело ранен/.test(document.querySelector('.room-order')?.innerText || '') && /Не ранен/.test(document.querySelector('.room-order').innerText))))) fail('the player does not see the wound states in the list');
    // One participant in full: «Действия» stays open and the list keeps the focus.
    await openRow(G, 'r2'); await wait(200);
    await G.focus('[data-rv-row="r2"]'); await G.selectOption('[data-rv-row="r2"]', 'full');
    if (!(await until(() => G.evaluate(() => { const el = document.querySelector('[data-rv-row="r2"]'); return document.activeElement === el && el.value === 'full' && el.closest('details').open && el.getBoundingClientRect().height > 0; }), 3000, 50))) fail('after the change the participant list lost the focus, the value, or «Действия» closed');
    if (!(await until(async () => { const r = (await order())?.find(x => x.name === 'Sniper'); return r?.hp === 9 && r.max === 30 && r.sp?.[0] === 7 && r.sp[1] === 11; }))) fail('«full» did not reach the player: ' + JSON.stringify(await order()));
    if ('hp' in ((await order()).find(x => x.name === 'Ganger') || {})) fail('the other participant got HP too');
    if (!(await until(() => P.evaluate(() => /HP 9\/30/.test(document.querySelector('.room-order')?.innerText || '') && /SP: голова 7 · тело 11/.test(document.querySelector('.room-order').innerText))))) fail('the player does not see HP and armor of the participant shown in full');
    // The chips on a phone, in every look: readable, and the page does not scroll sideways.
    const axeFile = (() => { try { return require.resolve('axe-core/axe.min.js'); } catch { return null; } })(), axe = axeFile ? fs.readFileSync(axeFile, 'utf8') : null;
    const rules = (page, sel) => page.evaluate(s => window.axe.run(document.querySelector(s), { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa'] }, resultTypes: ['violations'] }).then(r => r.violations.filter(v => ['critical', 'serious'].includes(v.impact)).map(v => `${v.id} (${v.nodes.length}): ${v.nodes[0].target.join(' ').slice(0, 70)}`)), sel);
    const look = async (page, style, theme) => { await page.evaluate(([a, b]) => { localStorage.setItem('nc-ui-style', a); localStorage.setItem('nc-ui-theme', b); }, [style, theme]); await page.reload(); await wait(500); };
    for (const [style, theme] of [['native', 'dark'], ['native', 'light'], ['board', 'dark'], ['board', 'light'], ['cyber', 'dark']]) {
      if (style !== 'native' || theme !== 'dark') { await P.evaluate(() => window.App.setView('room')); await look(P, style, theme); }
      if (!(await until(() => P.evaluate(() => document.querySelectorAll('.room-order .rv-chip').length >= 4)))) { fail(`${style} ${theme}: the chips are not in the player's list`); continue; }
      const [sw, iw] = await P.evaluate(() => [document.documentElement.scrollWidth, innerWidth]); if (sw > iw) fail(`${style} ${theme}: the player's room scrolls sideways (${sw} > ${iw})`);
      if (axe) { await P.evaluate(axe); for (const v of await rules(P, '.room-combat')) fail(`${style} ${theme} room: ${v}`); }
    }
    // The tracker's lists: named, readable, and tall enough for a finger on a phone.
    if (axe) { await G.evaluate(axe); for (const v of await rules(G, '[data-campaign-view]')) fail('tracker: ' + v); }
    // Hidden: the participant and its name leave the message.
    await G.selectOption('[data-rv-row="r2"]', 'hidden');
    if (!(await until(async () => { const o = await order(); return o?.length === 1 && o[0].name === 'Ganger'; }))) fail('the hidden participant is still in the player\'s list: ' + JSON.stringify(await order()));
    if (await P.evaluate(() => JSON.stringify(window.Room._test.state().combat).includes('Sniper'))) fail('the hidden participant\'s name is in what the player received');
    if (!(await G.evaluate(() => /Скрыт от игроков/.test(document.querySelector('[data-rv-row="r2"]')?.closest('.combatant')?.innerText || '')))) fail('the tracker does not mark the hidden participant');
    // A room that hides by default: nobody but the players' own rows; one enemy opened by hand comes back.
    await G.selectOption('[data-rv-row="r2"]', ''); await G.selectOption('[data-rv-room]', 'hidden');
    if (!(await until(async () => (await order())?.length === 0))) fail('with «Никого» the player still sees: ' + JSON.stringify(await order()));
    await openRow(G, 'r1'); await wait(200);
    await G.selectOption('[data-rv-row="r1"]', 'name');
    if (!(await until(async () => { const o = await order(); return o?.length === 1 && o[0].name === 'Ganger' && !('w' in o[0]); }))) fail('the enemy opened by hand did not come back at «name»: ' + JSON.stringify(await order()));
    // The saved campaign keeps the choice in the fields older data understands.
    const saved = await G.evaluate(() => { const c = JSON.parse(localStorage.getItem('nightcity-red-v1')).campaigns[0]; return [c.vis, c.roster.map(r => [r.id, r.vis, r.hidden])]; });
    if (JSON.stringify(saved) !== JSON.stringify(['hidden', [['r1', 'name', null], ['r2', null, null]]])) fail('saved: ' + JSON.stringify(saved));
    for (const e of [...G.errs, ...P.errs]) fail(e);
    await close();
    // The tracker on a phone, without a room: the lists fit and are 44px tall.
    for (const [style, theme] of [['native', 'light'], ['board', 'dark']]) {
      const phone = await device({ look: style, theme, width: 390 }), T = phone.page;
      await T.goto(BASE + '#/campaigns'); await wait(300);
      await T.click('[data-campaign-action="open"][data-id="k1"]').catch(() => {});
      if (!(await until(() => T.evaluate(() => !!document.querySelector('[data-rv-room]') && !!document.querySelector('[data-rv-row]'))))) { fail(`${style} ${theme} phone: no lists in the tracker`); await phone.ctx.close(); continue; }
      await openRow(T, 'r1'); await wait(200);
      const small = await T.evaluate(() => [...document.querySelectorAll('[data-rv-room],[data-rv-row]')].map(x => x.getBoundingClientRect()).filter(r => r.height < 43.5 || r.width < 43.5).length);
      if (small) fail(`${style} ${theme} phone: ${small} list(s) under 44px`);
      const [sw, iw] = await T.evaluate(() => [document.documentElement.scrollWidth, innerWidth]); if (sw > iw) fail(`${style} ${theme} phone: the tracker scrolls sideways (${sw} > ${iw})`);
      if (axe) { await T.evaluate(axe); for (const v of await rules(T, '[data-campaign-view]')) fail(`${style} ${theme} phone tracker: ${v}`); }
      for (const e of T.errs) fail(e);
      await phone.ctx.close();
    }
  });

  if (!brokerUrl) skip('whispers in a room', 'aedes and ws are not installed');
  else await check('whispers: the GM and one player talk privately, a secret check stays out of the feed, a third member sees nothing', async fail => {
    const gm = await device(), player = await device({ width: 390 }), other = await device({ width: 390 });
    const G = gm.page, P = player.page, B = other.page;
    await G.goto(BASE + '#/room'); await wait(400);
    await G.fill('#room-gm-name', 'Мастер'); await G.click('[data-room-action="create"]');
    const link = await until(() => G.evaluate(() => { const s = window.Room._test.session(); return s?.code && s.gmFp ? window.Room._test.roomLink(s.code) : null; }));
    if (!link) { fail('the room was not created'); return; }
    for (const [page, name] of [[P, 'Аня'], [B, 'Боб']]) {
      await page.goto(link); await wait(600);
      await page.fill('#room-player-name', name); await page.selectOption('#room-character', 'v1'); await page.click('[data-room-action="join"]');
    }
    const annFp = await until(() => G.evaluate(() => [...window.Room._test.members().values()].find(m => m.name === 'Аня' && m.box)?.fp));
    if (!annFp || !(await until(() => G.evaluate(() => [...window.Room._test.members().values()].some(m => m.name === 'Боб'))))) { fail('the Game Master does not see both players'); return; }
    if (!(await until(() => P.evaluate(() => !!document.querySelector('[data-rw-open]'))))) { fail('the player has no «Шёпот ведущему» button'); return; }
    await G.click(`[data-rw-open="${annFp}"]`);
    await G.fill('#rw-text', 'тихо'); await G.press('#rw-text', 'Enter');
    if (!(await until(() => P.evaluate(() => !!document.querySelector('.room-pill-unread'))))) fail('the player pill shows no unread whisper');
    await P.click('[data-rw-open]');
    if (!(await until(() => P.evaluate(() => /тихо/.test(document.querySelector('.rw-dialog .rw-thread')?.textContent || ''))))) fail('the player does not see the whisper');
    await P.fill('#rw-text', 'понял'); await P.press('#rw-text', 'Enter');
    if (!(await until(() => G.evaluate(() => /понял/.test(document.querySelector('.rw-dialog .rw-thread')?.textContent || ''))))) fail('the Game Master does not see the answer');
    if (!(await until(() => G.evaluate(() => /доставлено/.test(document.querySelector('.rw-dialog .rw-thread')?.textContent || ''))))) fail('the whisper is not marked delivered');
    await G.click('.rw-ask summary'); await G.selectOption('.rw-ask select[name="skill"]', 'Perception'); await G.selectOption('.rw-ask select[name="dv"]', '13');
    await G.click('.rw-ask button[type="submit"]');
    if (!(await until(() => P.evaluate(() => !!document.querySelector('.rw-dialog [data-rw-roll]:not([disabled])'))))) { fail('the player has no «Бросить тайно» button'); }
    else await P.click('.rw-dialog [data-rw-roll]');
    if (!(await until(() => G.evaluate(() => /DV 13 — (успех|провал)/.test(document.querySelector('.rw-dialog .rw-item.in.k-result')?.textContent || ''))))) fail('the secret check result did not reach the Game Master');
    for (const [who, page] of [['GM', G], ['player', P], ['third', B]]) if (await page.evaluate(() => window.Room._test.state().feed.some(r => /Восприятие|Perception/.test(r.label)))) fail(`the secret check is in the ${who} feed`);
    if (await B.evaluate(() => document.querySelectorAll('.rw-item').length || Object.keys(window.RoomWhispers._test.state()?.threads || {}).length)) fail('the third member has whispers');
    for (const e of [...G.errs, ...P.errs, ...B.errs]) fail(e);
    await gm.ctx.close(); await player.ctx.close(); await other.ctx.close();
  });

  if (!brokerUrl) skip('the waiting room', 'aedes and ws are not installed');
  else await check('the waiting room: newcomers wait at the door, one is let in by hand, one is declined, a removed member is back at the door', async fail => {
    const gm = await device(), player = await device({ width: 390 }), other = await device({ width: 390 });
    const G = gm.page, P = player.page, B = other.page;
    await G.goto(BASE + '#/room'); await wait(400);
    await G.fill('#room-gm-name', 'Мастер'); await G.selectOption('#room-campaign', 'k1'); await G.check('#room-gate'); await G.click('[data-room-action="create"]');
    const link = await until(() => G.evaluate(() => { const s = window.Room._test.session(); return s?.code && s.gmFp ? window.Room._test.roomLink(s.code) : null; }));
    if (!link) { fail('the room was not created'); return; }
    if (!(await G.evaluate(() => window.Room._test.gate.gateOn()))) { fail('the room was created without a waiting room'); return; }
    for (const [page, name] of [[P, 'Аня'], [B, 'Боб']]) {
      await page.goto(link); await wait(600);
      await page.fill('#room-player-name', name); await page.selectOption('#room-character', 'v1'); await page.click('[data-room-action="join"]');
    }
    // Both wait at the door and see nothing of the room.
    for (const [who, page] of [['Аня', P], ['Боб', B]]) {
      if (!(await until(() => page.evaluate(() => !!document.querySelector('[data-room-lobby]'))))) fail(`${who} is not shown the door`);
      if (await page.evaluate(() => window.Room._test.members().size > 1 || !!window.Room._test.state().combat || !!document.querySelector('.room-columns'))) fail(`${who} sees the room before being let in`);
    }
    if (!(await until(() => G.evaluate(() => document.querySelectorAll('[data-room-action="gate-admit"]').length === 2)))) { fail('the Game Master does not see both requests'); return; }
    if (!(await G.evaluate(() => /⏳ 2/.test(document.querySelector('.room-pill-gate')?.textContent || '')))) fail('the pill does not count those who wait');
    if (await G.evaluate(() => window.Room._test.members().size > 1)) fail('a device at the door is listed as a member');
    const waitingId = name => G.evaluate(n => [...window.Room._test.gate.waiting().entries()].find(([, w]) => w.name === n)?.[0] || '', name);
    // One is let in: the room appears, with the Game Master and the initiative.
    await G.click(`[data-room-action="gate-admit"][data-id="${await waitingId('Аня')}"]`);
    if (!(await until(() => P.evaluate(() => !!document.querySelector('.room-columns') && [...window.Room._test.members().values()].some(m => m.role === 'gm' && !m.me && !m.impostor))))) fail('the player let in does not see the room');
    if (!(await until(() => P.evaluate(() => window.Room._test.state().combat?.campaign === 'Job')))) fail('the initiative did not reach the player let in');
    if (!(await until(() => G.evaluate(() => [...window.Room._test.members().values()].some(m => m.name === 'Аня'))))) fail('the Game Master does not see the player let in');
    // A roll made in the room reaches the Game Master, and not the device that is still at the door.
    await P.evaluate(() => window.App.open('v1')); await wait(400);
    await P.evaluate(() => document.querySelector('[data-action="skill-roll"][data-skill="Athletics"]')?.click());
    if (!(await until(() => G.evaluate(() => window.Room._test.state().feed.some(r => /Атлетика/.test(r.label) && r.who === 'Аня'))))) fail('a roll from the player let in did not reach the Game Master');
    await wait(500);
    if (await B.evaluate(() => window.Room._test.state().feed.length > 0 || window.Room._test.members().size > 1 || !!window.Room._test.state().combat)) fail('the device at the door sees the room');
    // The other is declined and told so.
    await G.click(`[data-room-action="gate-deny"][data-id="${await waitingId('Боб')}"]`);
    if (!(await until(() => B.evaluate(() => document.querySelector('[data-room-lobby]')?.dataset.roomLobby === 'denied')))) fail('the declined device is not told');
    // A reload does not put the player back at the door, and the Game Master is not asked again.
    await P.evaluate(() => window.App.setView('room')); await P.reload(); await wait(600);
    if (!(await until(() => P.evaluate(() => window.Room._test.gate.inRoom() && [...window.Room._test.members().values()].some(m => m.role === 'gm' && !m.me))))) fail('a reloaded page is not back in the room');
    if (await G.evaluate(() => window.Room._test.gate.waiting().size)) fail('a reloaded page had to ask again');
    // Removed: the room key changes and the page is back at the door.
    if (!(await until(() => G.evaluate(() => !!document.querySelector('[data-room-action="gate-remove"]'))))) { fail('the Game Master has no «Убрать из комнаты» button'); }
    else {
      const kid = await G.evaluate(() => window.Room._test.session().gate.kid);
      await G.click('[data-room-action="gate-remove"]');
      if (!(await until(() => G.evaluate(k => window.Room._test.session().gate.kid !== k, kid)))) fail('the room key did not change');
      if (!(await until(() => P.evaluate(() => !window.Room._test.gate.inRoom() && !!document.querySelector('[data-room-lobby]'))))) fail('a removed member still reads the room');
      if (await G.evaluate(() => [...window.Room._test.members().values()].some(m => m.name === 'Аня'))) fail('the removed member is still listed');
    }
    for (const e of [...G.errs, ...P.errs, ...B.errs]) fail(e);
    await gm.ctx.close(); await player.ctx.close(); await other.ctx.close();
  });

  // Without a broker the Game Master's half still runs: only the player's side needs the room.
  await check('clocks with triggers: a combat clock ticks with the round, the GM gets the reminder, the text never reaches the player', async fail => {
    const SECRET = 'СЕКРЕТ-ТРИГГЕР';
    const seed = page => page.evaluate(text => { const st = window.App.getState(); window.GMExtras.writeClocks(st, [{ id: 'c1', name: 'Тревога', size: 4, filled: 0, shared: true, triggers: [{ at: 1, text }], tick: { camp: 'k1', hist: [] } }]); window.App.save(); window.GMExtras.refresh(); }, SECRET);
    const clock = page => page.evaluate(() => window.GMExtras.readClocks(window.App.getState())[0]);
    const gm = await device(), G = gm.page, player = brokerUrl ? await device({ width: 390 }) : null, P = player?.page;
    const close = async () => { await gm.ctx.close(); if (player) await player.ctx.close(); };
    if (P) {
      await G.goto(BASE + '#/room'); await wait(400);
      await G.fill('#room-gm-name', 'Мастер'); await G.selectOption('#room-campaign', 'k1'); await G.click('[data-room-action="create"]');
      const link = await until(() => G.evaluate(() => { const s = window.Room._test.session(); return s?.code && s.gmFp ? window.Room._test.roomLink(s.code) : null; }));
      if (!link) { fail('the room was not created'); await close(); return; }
      await P.goto(link); await wait(600);
      await P.fill('#room-player-name', 'Аня'); await P.selectOption('#room-character', 'v1'); await P.click('[data-room-action="join"]');
      if (!(await until(() => G.evaluate(() => [...window.Room._test.members().values()].some(m => m.name === 'Аня'))))) fail('the Game Master does not see the player');
    }
    await G.goto(BASE + '#/gm'); await wait(400);
    await seed(G);
    const toggle = '[data-gx-action="ct-open"][data-gx-id="c1"]';
    if (!(await until(() => G.evaluate(s => document.querySelector(s)?.getAttribute('aria-expanded') === 'false', toggle), 5000, 100))) { fail('the clock card has no «Триггеры и автоход» button'); await close(); return; }
    // The settings by keyboard: open the panel, add a reminder, type its text, choose a die.
    await G.focus(toggle); await G.keyboard.press('Enter');
    if (!(await until(() => G.evaluate(s => document.querySelector(s)?.getAttribute('aria-expanded') === 'true' && document.activeElement === document.querySelector(s) && !!document.getElementById('ct-panel-c1'), toggle), 3000, 50))) fail('Enter did not open the panel, or the focus left the button');
    await G.focus('[data-gx-action="ct-add-trig"]'); await G.keyboard.press('Enter');
    if (!(await until(() => G.evaluate(() => document.querySelectorAll('[data-gx-field="ct-text"]').length === 2 && document.activeElement?.dataset.gxAction === 'ct-add-trig'), 3000, 50))) fail('a second reminder was not added by keyboard, or the focus was lost');
    // Deleting the last row by keyboard removes the pressed button: the focus goes to the row above, not to the page.
    await G.focus('[data-gx-action="ct-add-trig"]'); await G.keyboard.press('Enter');
    if (!(await until(() => G.evaluate(() => document.querySelectorAll('[data-gx-field="ct-text"]').length === 3), 3000, 50))) fail('a third reminder was not added by keyboard');
    await G.focus('[data-gx-action="ct-del-trig"][data-gx-seg="2"]'); await G.keyboard.press('Enter');
    if (!(await until(() => G.evaluate(() => document.querySelectorAll('[data-gx-field="ct-text"]').length === 2 && document.activeElement?.dataset.gxAction === 'ct-del-trig' && document.activeElement.dataset.gxSeg === '1'), 3000, 50))) fail('deleting the last reminder by keyboard left the focus on ' + await G.evaluate(() => document.activeElement?.tagName + ' ' + (document.activeElement?.dataset?.gxAction || '')));
    await G.selectOption('[data-gx-field="ct-at"][data-gx-seg="1"]', '3');
    await G.fill('[data-gx-field="ct-text"][data-gx-seg="1"]', 'Вторая <b>волна</b>'); await G.keyboard.press('Tab');
    if (JSON.stringify((await clock(G)).triggers) !== JSON.stringify([{ at: 1, text: SECRET }, { at: 3, text: 'Вторая <b>волна</b>' }])) fail('the reminders were not saved as typed: ' + JSON.stringify((await clock(G)).triggers));
    await G.selectOption('[data-gx-field="ct-die"]', '4');
    if (!(await until(() => G.evaluate(() => /d4/.test(document.querySelector('[data-gx-action="ct-roll"]')?.innerText || '') && !!document.querySelector('[data-gx-field="ct-need"]')), 3000, 50))) fail('choosing a die did not bring the roll button and the second select');
    // The die fills the clock on this device only, and the notice offers to take the roll back.
    await G.click('[data-gx-action="ct-roll"]');
    const rolled = (await clock(G)).filled;
    if (!(rolled >= 1 && rolled <= 4)) fail('the die did not fill the clock: ' + rolled);
    if (!(await G.evaluate(text => document.querySelector('#app-notice')?.innerText.includes(text), SECRET))) fail('the roll passed the first segment but the reminder did not come up');
    if (!(await G.evaluate(() => !!document.querySelector('.ct-last') && !!document.querySelector('.ct-fired') && !document.querySelector('.gm-extras .ct-box b b, .gm-extras .ct-box span b')))) fail('the card does not show the roll and the reminder, or drew typed text as markup');
    if (P && (await P.evaluate(() => window.Room._test.state().feed.length))) fail('the roll of a clock went to the room feed');
    await G.focus('#app-notice .notice-action'); await G.keyboard.press('Enter');
    if (!(await until(async () => (await clock(G)).filled === 0, 3000, 50))) fail('«Отменить» did not take the roll back');
    if (!(await until(() => G.evaluate(() => document.activeElement?.dataset?.gxAction === 'ct-roll'), 3000, 50))) fail('after «Отменить» by keyboard the focus is not back on the roll button');
    if (!(await until(() => G.evaluate(() => document.querySelector('[data-gx-clock="c1"] .gx-count strong')?.innerText === '0/4'), 3000, 50))) fail('the card was not drawn again after the undo');
    // A phone: nothing scrolls sideways and every new control is big enough for a finger.
    await G.setViewportSize({ width: 390, height: 844 }); await wait(300);
    const phone = await G.evaluate(() => ({ wide: document.documentElement.scrollWidth - document.documentElement.clientWidth, small: [...document.querySelectorAll('.ct-box .btn, .ct-panel select, .ct-panel input')].filter(e => e.getBoundingClientRect().height < 44).map(e => e.className || e.dataset.gxField) }));
    if (phone.wide > 0) fail('the GM screen scrolls sideways on a phone with the panel open: ' + phone.wide + 'px');
    if (phone.small.length) fail('controls smaller than 44px on a phone: ' + phone.small.join(', '));
    await G.setViewportSize({ width: 1280, height: 844 });
    // The tracker: the seeded campaign has one participant, so every «next» starts a new round.
    await G.goto(BASE + '#/campaigns'); await wait(300);
    await G.click('[data-campaign-action="open"]'); await wait(300);
    if (!(await G.evaluate(() => /Тревога/.test(document.querySelector('.ct-strip')?.innerText || '')))) fail('the tracker does not show the linked clock');
    if (await G.evaluate(text => !!document.querySelector('.ct-strip')?.innerText.includes(text), SECRET)) fail('the tracker shows a reminder that has not come up yet');
    await G.click('[data-campaign-action="next"]');
    if ((await clock(G)).filled !== 1) fail('a new round did not move the linked clock: ' + (await clock(G)).filled);
    if (!(await until(() => G.evaluate(text => document.querySelector('#app-notice')?.innerText.includes(text) && document.querySelector('.ct-strip')?.innerText.includes(text), SECRET), 3000, 50))) fail('the reminder did not come up in the notice and in the strip: ' + await G.evaluate(() => document.querySelector('#app-notice')?.innerText));
    await G.click('[data-campaign-action="prev"]');
    if ((await clock(G)).filled !== 0) fail('the step back over the round did not return the segment');
    await G.click('[data-campaign-action="next"]');
    if ((await clock(G)).filled !== 1) fail('the round entered again did not move the clock again');
    if (P) {
      const seen = () => P.evaluate(() => JSON.stringify(window.Room._test.state().clocks));
      if (!(await until(async () => (await seen()) === JSON.stringify([{ name: 'Тревога', size: 4, filled: 1 }])))) fail('the player did not get the clock as name, size and filled only: ' + await seen());
      await P.evaluate(() => { location.hash = '#/room'; }); await wait(400);
      const leak = await P.evaluate(() => /СЕКРЕТ|волна/.test(JSON.stringify(window.Room._test.state()) + document.body.innerText + JSON.stringify(localStorage)));
      if (leak) fail('a reminder text reached the player');
    }
    for (let i = 0; i < 3; i++) await G.click('[data-campaign-action="next"]');
    if ((await clock(G)).filled !== 4) fail('three more rounds did not fill the clock');
    if (!(await G.evaluate(() => /Заполнено/i.test(document.querySelector('.ct-strip-clock.full')?.innerText || '') && /заполнены/.test(document.querySelector('#app-notice')?.innerText || '')))) fail('the Game Master is not told that the clock has run out');
    await G.click('[data-campaign-action="next"]');
    if ((await clock(G)).filled !== 4) fail('a full clock moved');
    if (P) {
      if (!(await until(() => P.evaluate(() => /4 \/ 4 · Счётчик заполнен/i.test(document.querySelector('.room-clock.full')?.innerText || ''))))) fail('the player does not see that the clock has run out');
      if (await P.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth)) fail('the room scrolls sideways on the player\'s phone');
      if (await P.evaluate(() => /СЕКРЕТ|волна/.test(JSON.stringify(window.Room._test.state()) + document.body.innerText))) fail('a reminder text reached the player with the full clock');
    }
    for (const e of [...G.errs, ...(P ? P.errs : [])]) fail(e);
    await close();
    // The same card and strip in the other looks: names, roles and contrast (the axe check below sees no clocks).
    // Only the clocks are examined here: an opened campaign has rows of its own that are not this check's subject.
    const axeFile = (() => { try { return require.resolve('axe-core/axe.min.js'); } catch { return null; } })();
    if (axeFile) for (const [look, theme, width] of [['native', 'dark', 1280], ['native', 'light', 390], ['cyber', 'dark', 390], ['board', 'dark', 1280], ['board', 'light', 390]]) {
      const d = await device({ look, theme, width }), page = d.page;
      await page.goto(BASE + '#/gm'); await wait(400);
      await seed(page);
      await page.evaluate(() => { const st = window.App.getState(), list = window.GMExtras.readClocks(st); list[0].filled = 4; list[0].die = { sides: 6, need: 4 }; list[0].triggers.push({ at: 2, text: 'Вторая <b>волна</b>' }); window.GMExtras.writeClocks(st, list); window.App.save(); window.GMExtras.refresh(); });
      await page.click(toggle);
      // Every look has button rules of its own («Досье» makes them lower), so the finger size is measured in each.
      if (width < 500) { const small = await page.evaluate(() => [...document.querySelectorAll('.ct-box .btn, .ct-panel select, .ct-panel input')].filter(e => e.getBoundingClientRect().height < 44).map(e => (e.className || e.dataset.gxField) + ' ' + Math.round(e.getBoundingClientRect().height))); if (small.length) fail(look + ' ' + theme + ': controls smaller than 44px on a phone: ' + small.join(', ')); }
      // The clock is full: its roll button has nothing to do, but a press must not throw the focus out of the card.
      await page.focus('[data-gx-action="ct-roll"]'); await page.keyboard.press('Enter'); await wait(150);
      if (!(await page.evaluate(() => document.activeElement?.dataset?.gxAction === 'ct-roll' && document.activeElement.getAttribute('aria-disabled') === 'true'))) fail(look + ' ' + theme + ': the roll button of a full clock lost the keyboard focus');
      if ((await page.evaluate(() => window.GMExtras.readClocks(window.App.getState())[0].filled)) !== 4) fail(look + ' ' + theme + ': a full clock was rolled');
      for (const view of ['gm', 'campaigns']) {
        if (view === 'campaigns') { await page.goto(BASE + '#/campaigns'); await wait(300); await page.click('[data-campaign-action="open"]'); await wait(300); }
        if (!(await page.evaluate(v => !!document.querySelector(v === 'gm' ? '.ct-panel' : '.ct-strip-clock.full'), view))) fail(look + ' ' + theme + ' ' + view + ': the clock part is not on the screen');
        if (view === 'campaigns' && !(await page.evaluate(() => { const n = document.querySelector('.ct-strip-note'); return !!n && !n.querySelector('*') && n.innerText.includes('<b>волна</b>'); }))) fail(look + ' ' + theme + ': the tracker strip does not draw the reminder text as plain text');
        if (await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth)) fail(look + ' ' + theme + ' ' + view + ': the page scrolls sideways at ' + width + 'px');
        await page.evaluate(fs.readFileSync(axeFile, 'utf8'));
        const found = await page.evaluate(scope => window.axe.run(document.querySelector(scope), { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa'] }, resultTypes: ['violations'] }).then(r => r.violations.filter(v => ['critical', 'serious'].includes(v.impact)).map(v => v.id + ' (' + v.nodes.length + '): ' + v.nodes[0].target.join(' ').slice(0, 70))), view === 'gm' ? '[data-gx-section="clocks"]' : '.ct-strip');
        for (const v of found) fail(look + ' ' + theme + ' ' + view + ': ' + v);
      }
      for (const e of page.errs) fail(e);
      await d.ctx.close();
    }
  });

  await check('named modifiers: made next to the roll buttons, switched on and off, named in the roll, asleep without their thing', async fail => {
    const d = await device({ width: 390 }), page = d.page;
    await page.goto(BASE + '#/sheet/v1'); await wait(500);
    await page.evaluate(() => { try { localStorage.setItem('nightcity-red-sheet-tab-v1', 'skills'); } catch {} });
    await page.reload(); await wait(500);
    const bonus = skill => page.evaluate(s => document.querySelector(`[data-action="skill-roll"][data-skill="${s}"]`)?.getAttribute('aria-label')?.match(/[+−]\d+$/)?.[0] || '', skill);
    const chips = () => page.evaluate(() => [...document.querySelectorAll('.sheet-next-roll .nm-chip')].map(b => `${b.querySelector('.nm-name').textContent} ${b.querySelector('b').textContent}${b.getAttribute('aria-checked') === 'true' ? '' : ' off'}${b.classList.contains('nm-asleep') ? ' asleep' : ''}`).join(' | '));
    const keep = () => page.evaluate(() => document.activeElement?.dataset?.keep || document.activeElement?.tagName);
    const add = async (name, value, when, item) => {
      await page.fill('[data-nm-field="name"]', name); await page.fill('[data-nm-field="value"]', String(value));
      if (when) await page.selectOption('[data-nm-field="when"]', when);
      if (item) await page.selectOption('[data-nm-field="item"]', item);
      await page.focus('[data-nm-field="value"]'); await page.keyboard.press('Enter'); await wait(250);
    };
    if (!(await page.isVisible('.sheet-next-roll [data-nm-root]'))) { fail('the block is not next to the roll buttons on the Skills tab'); await d.ctx.close(); return; }
    if ((await chips()) !== '' || (await page.innerText('[data-nm-edit] > summary')).trim() !== '+ Свой модификатор') fail('an unused sheet shows more than one folded line');
    const plain = { ath: await bonus('Athletics'), eva: await bonus('Evasion') };
    if (plain.ath !== '+8' || plain.eva !== '+10') fail('unexpected numbers on the roll buttons before any modifier: ' + JSON.stringify(plain));

    // By keyboard: open the editor, type, Enter saves.
    await page.focus('[data-nm-edit] > summary'); await page.keyboard.press('Enter'); await wait(200);
    if (!(await page.evaluate(() => document.querySelector('[data-nm-edit]').open))) fail('Enter on the folded line does not open the editor');
    await page.focus('[data-nm-field="value"]'); await page.keyboard.press('Enter'); await wait(150);
    if (!/Введите название/.test(await page.innerText('#app-notice'))) fail('an empty name is not refused with a message');
    await page.fill('[data-nm-field="name"]', 'Тест'); await page.keyboard.press('Tab'); await page.keyboard.type('2');
    if ((await page.inputValue('[data-nm-field="name"]')) !== 'Тест' || !(await page.evaluate(() => document.querySelector('[data-nm-edit]').open))) fail('typing in the form lost what was typed or closed the editor');
    await page.keyboard.press('Enter'); await wait(250);
    if ((await chips()) !== 'Тест +2') fail('the new modifier did not appear as a switch that is on: ' + await chips());
    if ((await keep()) !== 'nm-name') fail('after adding, the focus is not back in the name field: ' + await keep());
    if ((await bonus('Athletics')) !== '+10' || (await bonus('Evasion')) !== '+12') fail('the numbers on the roll buttons did not grow by 2: ' + await bonus('Athletics') + ' ' + await bonus('Evasion'));

    await page.evaluate(() => document.querySelector('[data-action="skill-roll"][data-skill="Athletics"]').click()); await wait(350);
    const roll = await page.evaluate(() => { const h = window.App.getState().history[0]; return h ? { label: h.label, detail: h.detail, open: document.querySelector('[data-nm-edit]')?.open } : null; });
    if (!roll || !roll.label.includes(' · Тест +2')) fail('the roll label does not name the modifier: ' + roll?.label);
    if (!roll || !roll.detail.includes('+ 2 (Тест)') || /эффекты/.test(roll.detail + roll.label)) fail('the roll detail does not name the modifier on its own: ' + roll?.detail);
    if (roll && !roll.open) fail('a roll closed the editor');

    // One tap switches it off; the focus stays on the switch.
    await page.focus('.nm-chip'); await page.keyboard.press('Space'); await wait(250);
    if ((await chips()) !== 'Тест +2 off' || (await bonus('Athletics')) !== '+8') fail('switching off did not take the modifier out of the numbers: ' + await chips() + ' ' + await bonus('Athletics'));
    if ((await keep()) !== 'nm-t-0') fail('the focus left the switch: ' + await keep());
    await page.evaluate(() => document.querySelector('[data-action="skill-roll"][data-skill="Athletics"]').click()); await wait(350);
    if (await page.evaluate(() => /Тест/.test(window.App.getState().history[0].label + window.App.getState().history[0].detail))) fail('a modifier that is off is still named in the roll');

    // For one Skill only; a name with markup stays text.
    // The value is typed with the minus the app itself prints («−», not the hyphen): it must stay a penalty.
    await add('<b>Тьма</b>', '−1', 'skill:Evasion');
    if ((await bonus('Evasion')) !== '+9' || (await bonus('Athletics')) !== '+8') fail('a modifier for one Skill changed the wrong numbers: ' + await bonus('Evasion') + ' ' + await bonus('Athletics'));
    if (await page.evaluate(() => !!document.querySelector('[data-nm-root] b b, [data-nm-root] .nm-name b, [data-nm-root] strong b'))) fail('a name with markup was drawn as markup');

    // What is not a whole number is refused with a message and nothing is saved in its place.
    await add('Дробь', '1,5'); const refused = await page.innerText('#app-notice');
    if (/Дробь/.test(await chips()) || !/Введите целое значение/.test(refused) || (await keep()) !== 'nm-value') fail('«1,5» was not refused: ' + (await chips()) + ' / ' + refused + ' / ' + await keep());
    await page.fill('[data-nm-field="name"]', ''); await page.fill('[data-nm-field="value"]', '');

    // Tied to a thing: counts while the thing is there.
    const bought = await page.evaluate(() => { const c = window.App.active(); c.extra.cash = 5000; const ok = window.EquipmentTools.purchase(c, window.CATALOG.find(x => x.id === 'gear-agent'), 'cash', 'ru', { confirmed: true })?.ok === true; window.App.save(); window.App.render(); return ok && c.extra.items.find(i => i.catalogId === 'gear-agent')?.id; });
    if (!bought) { fail('the test thing was not bought'); await d.ctx.close(); return; }
    await add('Агент', 3, 'all', bought);
    if ((await chips()) !== 'Тест +2 off | <b>Тьма</b> −1 | Агент +3' || (await bonus('Athletics')) !== '+11') fail('the modifier tied to a thing does not count while the thing is there: ' + await chips() + ' ' + await bonus('Athletics'));
    if (!/Модификатор: Агент \+3 \(включён\)/.test(await page.evaluate(() => document.querySelector('#sheet-items .nm-item-chip')?.textContent || ''))) fail('the inventory card does not name the modifier tied to the thing');
    const quantity = n => page.evaluate(([id, q]) => { const c = window.App.active(); c.extra.items.find(i => i.id === id).quantity = q; window.App.save(); window.App.render(); }, [bought, n]);
    await quantity(0); await wait(200);
    if (!/Агент \+3 asleep$/.test(await chips()) || (await bonus('Athletics')) !== '+8') fail('without the thing the modifier is not asleep: ' + await chips() + ' ' + await bonus('Athletics'));
    if (!(await page.isVisible('[data-nm-op="detach"]'))) fail('a sleeping modifier does not offer «Отвязать»');
    await quantity(1); await wait(200);
    if (/asleep/.test(await chips()) || (await bonus('Athletics')) !== '+11') fail('the thing came back but the modifier did not wake up: ' + await chips());

    // Delete and take it back.
    await page.click('[data-nm-op="remove"][data-keep="nm-d-2"]'); await wait(250);
    if (/Агент/.test(await chips()) || (await bonus('Athletics')) !== '+8') fail('the deleted modifier is still there: ' + await chips());
    if (!(await page.isVisible('#app-notice .notice-action'))) fail('deleting offers no way back');
    else { await page.focus('#app-notice .notice-action'); await page.keyboard.press('Enter'); await wait(250); }
    if ((await chips()) !== 'Тест +2 off | <b>Тьма</b> −1 | Агент +3' || (await bonus('Athletics')) !== '+11') fail('«Вернуть» did not put the modifier back in its place: ' + await chips());
    if ((await keep()) !== 'nm-t-2') fail('after «Вернуть» the keyboard is not on the switch that came back: ' + await keep());

    // Change one: the row fills the form, «Сохранить» writes it.
    await page.click('[data-nm-op="edit"][data-keep="nm-e-0"]'); await wait(200);
    if ((await page.inputValue('[data-nm-field="name"]')) !== 'Тест' || (await keep()) !== 'nm-name') fail('«Изменить» did not load the modifier into the form');
    await page.fill('[data-nm-field="value"]', '4'); await page.click('[data-nm-op="save"]'); await wait(250);
    if (!/^Тест \+4 off/.test(await chips())) fail('the change was not saved: ' + await chips());

    if (await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1)) fail('the page scrolls sideways with the editor open');
    const low = await page.evaluate(() => [...document.querySelectorAll('[data-nm-root] button, [data-nm-root] summary, [data-nm-root] input, [data-nm-root] select')].filter(e => e.getClientRects().length && e.getBoundingClientRect().height < 44).length);
    if (low) fail(low + ' controls of the block are lower than 44px on a phone');

    await page.reload(); await wait(500);
    if ((await chips()) !== 'Тест +4 off | <b>Тьма</b> −1 | Агент +3') fail('the modifiers did not survive a reload: ' + await chips());
    const stored = await page.evaluate(() => JSON.parse(localStorage.getItem('nightcity-red-v1')).characters.find(c => c.id === 'v1').extra.namedModifiers);
    if (stored?.version !== 1 || stored.list.length !== 3 || stored.list.some(m => Object.keys(m).some(k => !['id', 'name', 'value', 'on', 'scope', 'key', 'itemId'].includes(k)))) fail('what is stored is not the plain record: ' + JSON.stringify(stored));
    for (const e of page.errs) fail(e);
    await d.ctx.close();

    // English, and a sheet without the record that arrives with a broken one: nothing breaks, nothing is written over.
    const en = await device({ lang: 'en', width: 390 });
    await en.page.goto(BASE + '#/sheet/v1'); await wait(500);
    await en.page.evaluate(() => { const c = window.App.active(); c.extra.namedModifiers = { version: 1, list: [{ id: 'a', name: 'Smartgun', value: 1, on: true, scope: 'ranged' }, { id: 'b', name: 'x', value: 99, on: true, scope: 'all' }, 'junk'] }; window.App.save(); window.App.render(); document.querySelector('[data-sheet-tab="skills"]')?.click(); });
    await wait(300);
    const english = await en.page.evaluate(() => ({ label: document.querySelector('.nm-chip')?.getAttribute('aria-label'), count: document.querySelectorAll('.nm-chip').length, summary: document.querySelector('[data-nm-edit] > summary')?.textContent, raw: window.App.active().extra.namedModifiers.list.length, ath: document.querySelector('[data-action="skill-roll"][data-skill="Athletics"]')?.getAttribute('aria-label') }));
    if (english.label !== 'Smartgun, +1, ranged attacks' || english.count !== 1 || english.summary !== 'Set up modifiers' || english.raw !== 3 || !/\+8$/.test(english.ath || '')) fail('English or a damaged record: ' + JSON.stringify(english));
    // A burst goes through another roll path: it names the modifier too and blames nothing on «effects».
    const burst = await en.page.evaluate(async () => {
      const c = window.App.active(); c.skills.Autofire = 3; c.extra.weapons = [{ id: 'w1', name: 'SMG', skill: 'Autofire', damage: '2d6', usesAmmo: true, capacity: 30, ammo: 30 }];
      window.App.save(); window.App.render(); document.querySelector('[data-sheet-tab="combat"]')?.click(); await new Promise(r => setTimeout(r, 250));
      const b = document.querySelector('[data-pc-mode="burst"]'); if (!b) return null; b.click(); await new Promise(r => setTimeout(r, 300));
      const h = window.App.getState().history[0]; return h ? { label: h.label, detail: h.detail, tool: window.ToolEffects.use(c, { kind: 'ranged', stat: 'REF' }, 'en').label, line: window.Effects.lines({ ...c, extra: { namedModifiers: { version: 1, list: [{ id: 'd', name: 'Darkness', value: -2, on: true, scope: 'all' }] } } }, 'en')[0]?.text } : null;
    });
    if (!burst || !burst.label.endsWith(' · Smartgun +1') || !burst.detail.includes('+ 1 (Smartgun)') || /effects/i.test(burst.label + burst.detail)) fail('a burst does not name the modifier: ' + JSON.stringify(burst));
    if (burst && (burst.tool !== ' · Smartgun +1' || burst.line !== '−2 to all checks')) fail('the tools or the sheet list word it differently: ' + JSON.stringify(burst));

    // A record that is damage, not another version: said honestly, can be started over, and the old value taken back.
    const enKeep = () => en.page.evaluate(() => document.activeElement?.dataset?.keep || document.activeElement?.tagName);
    await en.page.evaluate(() => { const c = window.App.active(); c.extra.namedModifiers = null; window.App.save(); window.App.render(); document.querySelector('[data-sheet-tab="skills"]')?.click(); });
    await wait(300);
    const hurt = await en.page.evaluate(() => ({ text: document.querySelector('[data-nm-root]')?.innerText || '', ops: [...document.querySelectorAll('[data-nm-root] [data-nm-op]')].map(b => b.dataset.nmOp).join(), h: Math.round(document.querySelector('[data-nm-op="reset"]')?.getBoundingClientRect().height || 0) }));
    if (!/is damaged/.test(hurt.text) || /another version/.test(hurt.text) || hurt.ops !== 'reset' || hurt.h < 44) fail('a damaged record is not offered to be started over: ' + JSON.stringify(hurt));
    else {
      await en.page.focus('[data-nm-op="reset"]'); await en.page.keyboard.press('Enter'); await wait(300);
      if ((await en.page.evaluate(() => JSON.stringify(window.App.active().extra.namedModifiers))) !== '{"version":1,"list":[]}' || (await enKeep()) !== 'nm-sum') fail('«Start over» did not leave an empty record with the focus on the folded line: ' + await enKeep());
      if (!(await en.page.isVisible('#app-notice .notice-action'))) fail('starting over offers no way back');
      else {
        await en.page.focus('#app-notice .notice-action'); await en.page.keyboard.press('Enter'); await wait(300);
        if ((await en.page.evaluate(() => window.App.active().extra.namedModifiers)) !== null || (await enKeep()) !== 'nm-reset') fail('«Undo» did not bring the old record back: ' + await enKeep());
      }
    }
    // A list clogged with rows nobody can read: adding says why, and one button makes room without losing the modifier.
    await en.page.evaluate(() => { const c = window.App.active(); c.extra.namedModifiers = { version: 1, list: [{ id: 'a', name: 'Smartgun', value: 1, on: true, scope: 'all' }, ...Array.from({ length: 200 }, () => ({ junk: 1 }))] }; window.App.save(); window.App.render(); });
    await wait(250);
    await en.page.evaluate(() => { if (!document.querySelector('[data-nm-edit]').open) document.querySelector('[data-nm-edit] > summary').click(); }); await wait(200);
    await en.page.fill('[data-nm-field="name"]', 'More'); await en.page.fill('[data-nm-field="value"]', '1'); await en.page.focus('[data-nm-field="value"]'); await en.page.keyboard.press('Enter'); await wait(250);
    const why = await en.page.innerText('#app-notice');
    if (!/cannot read/.test(why) || /24/.test(why)) fail('a clogged list answers with the wrong reason: ' + why);
    await en.page.click('[data-nm-op="reset"]'); await wait(300);
    await en.page.focus('[data-nm-field="value"]'); await en.page.keyboard.press('Enter'); await wait(250);
    const cleared = await en.page.evaluate(() => ({ raw: window.App.active().extra.namedModifiers.list.length, chips: [...document.querySelectorAll('.nm-chip .nm-name')].map(n => n.textContent).join() }));
    if (cleared.raw !== 2 || cleared.chips !== 'Smartgun,More') fail('clearing the unreadable rows did not make room: ' + JSON.stringify(cleared));
    for (const e of en.page.errs) fail(e);
    await en.ctx.close();

    // The switches (on, off, asleep) and the open editor in every look.
    const axeFile = (() => { try { return require.resolve('axe-core/axe.min.js'); } catch { return null; } })();
    if (axeFile) {
      const source = fs.readFileSync(axeFile, 'utf8');
      for (const [look, theme, width] of [['native', 'dark', 390], ['native', 'light', 1280], ['cyber', 'dark', 390], ['board', 'dark', 1440], ['board', 'light', 390]]) {
        const { ctx, page: p } = await device({ look, theme, width });
        await p.goto(BASE + '#/sheet/v1'); await wait(400);
        await p.evaluate(() => { const c = window.App.active(); c.extra.namedModifiers = { version: 1, list: [{ id: 'a', name: 'Умное оружие', value: 1, on: true, scope: 'ranged' }, { id: 'b', name: 'Темнота', value: -2, on: false, scope: 'all' }, { id: 'c', name: 'Сонный', value: 3, on: true, scope: 'stat', key: 'REF', itemId: 'gone' }, { id: 'd', name: 'Сонный и выключенный', value: 3, on: false, scope: 'all', itemId: 'gone' }, { id: 'e', name: 'Электромагнитный', value: 1, on: true, scope: 'skill', key: 'Pilot Air Vehicle' }] }; window.App.save(); window.App.render(); document.querySelector('[data-sheet-tab="skills"]')?.click(); });
        await wait(250);
        await p.click('[data-nm-edit] > summary'); await wait(200);
        if (!(await p.isVisible('.sheet-next-roll .nm-form'))) fail(`${look} ${theme}: the editor is not shown next to the roll buttons`);
        await p.evaluate(source);
        const found = await p.evaluate(() => window.axe.run(document.querySelector('.sheet-next-roll'), { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa'] }, resultTypes: ['violations'] }).then(r => r.violations.filter(v => ['critical', 'serious'].includes(v.impact)).map(v => `${v.id} (${v.nodes.length}): ${v.nodes[0].target.join(' ').slice(0, 70)}`)));
        for (const v of found) fail(`${look} ${theme}: ${v}`);
        if (await p.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1)) fail(`${look} ${theme} ${width}: the page scrolls sideways`);
        // A one-word name next to a long tag stays one word: the tag goes under it instead of squeezing it letter by letter.
        const word = await p.evaluate(() => { const n = [...document.querySelectorAll('.sheet-next-roll .nm-chip .nm-name')].find(x => x.textContent === 'Электромагнитный'); if (!n) return null; const r = document.createRange(); r.selectNodeContents(n); return new Set([...r.getClientRects()].map(q => Math.round(q.top))).size; });
        if (word !== 1) fail(`${look} ${theme} ${width}: a one-word name is broken into ${word} lines on its switch`);
        for (const e of p.errs) fail(`${look} ${theme}: ${e}`);
        await ctx.close();
      }
    }
  });

  await check('NET architecture: floors as a tree moved by buttons, then a run floor by floor', async fail => {
    const axe = (() => { try { return fs.readFileSync(require.resolve('axe-core/axe.min.js'), 'utf8'); } catch { return null; } })();
    // Saved before the feature: three floors in a row, no parent and no place of the Netrunner.
    const entry = (id, type, more = {}) => ({ id, type, name: '', dv: 8, state: type === 'ice' ? 'waiting' : 'closed', preset: '', rez: 0, maxRez: 0, per: 0, spd: 0, atk: 0, def: 0, notes: '', ...more });
    const old = { id: 'e2e-net', name: 'Склад «Биотехники»', access: 'Терминал у ворот', notes: '', rank: 4, modifier: 0, dv: 8, remaining: 3, current: '1', floors: [
      { id: 'n1', label: '1', branch: '', entries: [entry('p1', 'password', { name: 'Пароль охраны' })] },
      { id: 'n2', label: '2', branch: 'очень длинное примечание к ветке, которое не должно раздвигать телефонный экран', entries: [entry('i1', 'ice', { name: 'Hellhound', preset: 'Hellhound', per: 6, spd: 6, atk: 6, def: 2, rez: 20, maxRez: 20 })] },
      { id: 'n3', label: '3', branch: '', entries: [entry('c1', 'control', { name: 'Камеры', dv: 10 })] }] };
    const seed = async (page, arch) => {
      await page.goto(BASE + '#/net'); await wait(400);
      await page.evaluate(a => { const st = window.App.getState(); st.netArchitectures = [a]; window.App.save(); window.App.render(); }, arch);
      await page.click('[data-net="open"][data-id="e2e-net"]');
    };
    const rules = async (page, where) => {
      const [sw, iw] = await page.evaluate(() => [document.documentElement.scrollWidth, document.documentElement.clientWidth]); if (sw > iw) fail(where + ': the page scrolls sideways (' + sw + ' > ' + iw + ')');
      if (!axe) return;
      await page.mouse.move(0, 0); await wait(100);
      await page.evaluate(axe);
      const found = await page.evaluate(() => window.axe.run(document.querySelector('[data-net-root]'), { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa'] }, resultTypes: ['violations'] }).then(r => r.violations.filter(v => ['critical', 'serious'].includes(v.impact)).map(v => v.id + ' (' + v.nodes.length + '): ' + v.nodes[0].target.join(' ').slice(0, 70))));
      for (const v of found) fail(where + ': ' + v);
    };
    const d = await device({ width: 390 }), page = d.page;
    const arch = () => page.evaluate(() => window.App.getState().netArchitectures[0]);
    const shape = async () => (await arch()).floors.map(x => x.id.slice(0, 2) + '<' + (x.parent ?? '?')).join(' ');
    const focused = () => page.evaluate(() => { const a = document.activeElement; return a && document.querySelector('#app').contains(a) ? (a.dataset.net || '') + ':' + (a.dataset.floor || '') : 'outside'; });
    const press = async (op, floor) => { await page.focus('[data-net="' + op + '"][data-floor="' + floor + '"]'); await page.keyboard.press('Enter'); await wait(150); };
    // Every button the feature adds must be a full 44px touch target on a phone, in every look (the board look makes buttons 40px by default).
    const sizes = async (pg, selector, where) => {
      const small = await pg.evaluate(sel => [...document.querySelectorAll(sel)].map(b => [b, b.getBoundingClientRect()]).filter(([, r]) => r.width > 0 && (r.width < 44 || r.height < 44)).map(([b, r]) => (b.dataset.net || b.className) + ' ' + Math.round(r.width) + 'x' + Math.round(r.height)), selector);
      if (small.length) fail(where + ': ' + small.length + ' buttons are smaller than 44px (' + small.slice(0, 3).join(', ') + ')');
    };
    const EDIT_BUTTONS = '.net-ed-bar button, .net-ed-modes button, .net-ed-here', RUN_BUTTONS = '.net-ed-modes button, .net-run button, .net-run-cols button';
    await seed(page, old);
    if ((await page.getAttribute('[data-net="ed-move"][data-floor="n1"]', 'aria-disabled')) !== 'true') fail('«Перенести…» on the entrance is offered although it has nowhere to go');
    if ((await page.locator('.net-ed-card').count()) !== 3) fail('three saved floors are not drawn as three cards');
    if (await page.locator('.net-ed-branch').count()) fail('a plain chain is drawn with branches');
    if ((await shape()) !== 'n1<? n2<? n3<?') fail('drawing rewrote the saved floors: ' + await shape());
    // Everything by keyboard: a second floor under floor 2 starts a branch.
    await press('ed-add', 'n2');
    const a1 = await arch(), added = a1.floors.find(x => !['n1', 'n2', 'n3'].includes(x.id))?.id;
    if (!added || (await page.locator('.net-ed-card').count()) !== 4 || (await page.locator('.net-ed-branch').count()) !== 2) fail('«Этаж ниже» on floor 2 did not start a branch');
    if ((await focused()) !== 'ed-add:n2') fail('after adding a floor the focus is on ' + await focused());
    // The new branch is moved under floor 3 in two presses.
    await press('ed-move', added);
    if ((await focused()) !== 'ed-move:' + added) fail('after «Перенести…» the focus is on ' + await focused());
    if (!/Выберите этаж/.test(await page.evaluate(() => document.querySelector('.net-ed-pick[role="status"]')?.innerText || ''))) fail('pick mode does not say what to do');
    if (await page.locator('[data-net="ed-move-here"][data-floor="' + added + '"]').count()) fail('a floor is offered as its own target');
    // On a phone the instruction and the targets must be where the user is, not thousands of pixels of forms away.
    const pick = await page.evaluate(() => { const seen = el => { const r = el.getBoundingClientRect(); return r.top >= 0 && r.bottom <= innerHeight; }; const hint = document.querySelector('.net-ed-pick'); return { hint: !!hint && seen(hint), inCard: !!hint?.closest('.net-ed-card.is-moving'), here: [...document.querySelectorAll('[data-net="ed-move-here"]')].filter(seen).length, forms: document.querySelectorAll('.net-ed-tree [data-net-entry], .net-ed-tree [data-net-floor]').length }; });
    if (!pick.hint || !pick.inCard) fail('the pick instruction is not on screen inside the card being moved');
    if (!pick.here) fail('no «Сюда» button is on screen after «Перенести…»');
    if (pick.forms) fail('the record forms are still drawn while a target is chosen');
    await press('ed-move-here', 'n3');
    if (!(await until(async () => (await focused()) === 'ed-move:' + added, 3000, 50))) fail('after the move the focus is on ' + await focused());
    if ((await arch()).floors.find(x => x.id === added)?.parent !== 'n3') fail('the floor was not moved under floor 3: ' + await shape());
    await press('ed-up', 'n3');
    const after = (await arch()).floors;
    if (after.map(x => x.id).join() !== ['n1', 'n3', 'n2', added].join() || after.map(x => x.label).join() !== '1,2,3,4') fail('«Выше» did not swap floors 2 and 3: ' + await shape() + ' / ' + after.map(x => x.label));
    if ((await focused()) !== 'ed-up:n3') fail('after «Выше» the focus is on ' + await focused());
    // A branch again, so the phone layout is checked with a shift.
    await press('ed-add', 'n3');
    await sizes(page, EDIT_BUTTONS, 'native dark 390 editor');
    // A renamed floor shows its new name in the card heading as soon as the field is left.
    await page.fill('[data-net-floor="label"][data-index="0"]', 'Вход'); await page.keyboard.press('Tab'); await wait(150);
    if (!/Вход/i.test(await page.evaluate(() => document.querySelector('.net-ed-title')?.innerText || ''))) fail('the card heading did not follow the renamed floor');
    // Removing a floor by keyboard leaves the focus on the floor above, not at the top of the page.
    await press('ed-add', 'n2');
    const extra = (await arch()).floors.find(x => ![...['n1', 'n2', 'n3', added], ...after.map(y => y.id)].includes(x.id) && x.parent === 'n2')?.id;
    if (!extra) fail('a floor to remove was not added');
    else { await press('remove-floor', extra); if (!(await until(async () => (await focused()) === 'ed-add:n2', 3000, 50))) fail('after removing a floor the focus is on ' + await focused()); if ((await arch()).floors.some(x => x.id === extra)) fail('the floor was not removed'); }
    await press('ed-move', 'n2');
    await sizes(page, EDIT_BUTTONS, 'native dark 390 pick mode');
    await rules(page, 'native dark 390 editor');
    await press('ed-move', 'n2');
    // The GM's own words in «Текущий этаж» must survive the run.
    await page.fill('[data-net-field="current"]', 'у лифта, за дверью');
    // The run: the password, a step down, the ICE, the reset and its undo.
    await page.click('[data-net="run-mode-on"]');
    const floorText = () => page.evaluate(() => document.querySelector('[data-net-run-floor]')?.innerText || '');
    if (!/Этаж 1/i.test(await floorText()) || !/DV 8/.test(await floorText()) || !/Закрыто/.test(await floorText())) fail('the run does not start on floor 1 with a closed password: ' + (await floorText()).slice(0, 120));
    if (!/закрытый пароль/.test(await floorText())) fail('the closed password is not pointed out');
    await page.click('[data-net="run-toggle"][data-entry="p1"]');
    if (!/Открыто/.test(await floorText()) || /закрытый пароль/.test(await floorText())) fail('the password is not shown as open');
    await page.click('.net-run-move [data-net="run-go"][data-floor="n3"]');
    if (!(await until(() => page.evaluate(() => document.activeElement?.hasAttribute('data-net-run-floor')), 3000, 50))) fail('after a step the focus is not on the new floor');
    await page.click('.net-run-move [data-net="run-go"][data-floor="n2"]');
    if (!/Hellhound/.test(await floorText()) || !/REZ\s*20\s*\/\s*20/.test(await floorText())) fail('floor 3 does not show the ICE with its REZ: ' + (await floorText()).slice(0, 160));
    await page.click('[data-net="run-rez"][data-delta="-1"]');
    if (!/REZ\s*19\s*\/\s*20/.test(await floorText())) fail('REZ −1 did not change the number');
    if ((await arch()).current !== 'у лифта, за дверью') fail('a step in the run overwrote the text of «Текущий этаж»: ' + (await arch()).current);
    await sizes(page, RUN_BUTTONS, 'native dark 390 run');
    await page.click('[data-net="run-ice"]'); await wait(200);
    if ((await page.inputValue('[data-net-combat="ice"]')) !== 'n2:i1' || (await page.inputValue('[data-net-combat="mode"]')) !== 'encounter') fail('the ICE was not handed to the combat calculator');
    await rules(page, 'native dark 390 run');
    await page.click('[data-net="run-reset"]'); await wait(150);
    let now = await arch();
    if (now.floors[0].entries[0].state !== 'closed' || now.floors[2].entries[0].rez !== 20) fail('«Сбросить защиту» did not close the password and refill the REZ');
    await page.click('[data-net="run-reset-undo"]'); await wait(150);
    now = await arch();
    if (now.floors[0].entries[0].state !== 'open' || now.floors[2].entries[0].rez !== 19) fail('«Вернуть как было» did not restore the state');
    if (await page.locator('[data-net="run-reset-undo"]').count()) fail('the undo is still offered after it was used');
    if (!(await until(async () => (await focused()) === 'run-reset:', 3000, 50))) fail('after the undo the focus is on ' + await focused());
    // An undo that would overwrite newer changes is not offered: reset, then take REZ off the ICE.
    await page.click('[data-net="run-reset"]'); await wait(150);
    await page.click('[data-net="run-rez"][data-delta="-1"]'); await wait(150);
    if (await page.locator('[data-net="run-reset-undo"]').count()) fail('a stale undo of the reset is still offered');
    // REZ +1 stops at the maximum.
    await page.click('[data-net="run-rez"][data-delta="1"]'); await page.click('[data-net="run-rez"][data-delta="1"]'); await wait(150);
    now = await arch();
    if (now.floors[2].entries[0].rez !== 20) fail('REZ +1 went past the maximum: ' + now.floors[2].entries[0].rez);
    // What was built and where the Netrunner stands survive a reload.
    const want = JSON.stringify(now);
    if (!(await until(() => page.evaluate(w => JSON.stringify(JSON.parse(localStorage.getItem('nightcity-red-v1') || '{}').netArchitectures?.[0]) === w, want), 5000, 100))) fail('the tree was not saved');
    await page.reload(); await wait(500);
    const back = await arch();
    if (JSON.stringify(back) !== want || back.runAt !== 'n2' || back.floors[1].parent !== 'n1' || back.current !== 'у лифта, за дверью') fail('the tree or the place did not survive a reload');
    await page.click('[data-net="open"][data-id="e2e-net"]');
    if ((await page.locator('.net-ed-card').count()) !== 5) fail('after a reload the tree is not drawn');
    for (const e of page.errs) fail(e);
    await d.ctx.close();
    // The same two views in the other looks, with a branch, pick mode and a roll line on screen.
    for (const [look, theme, width] of [['native', 'light', 390], ['board', 'light', 390], ['board', 'dark', 1280], ['cyber', 'dark', 390]]) {
      const o = await device({ look, theme, width }), p = o.page;
      // The modifier makes the Interface roll below a certain success, so the focus after it can be checked.
      await seed(p, { ...JSON.parse(want), modifier: 99 });
      if (width < 640) await sizes(p, EDIT_BUTTONS, look + ' ' + theme + ' ' + width + ' editor');
      await p.click('[data-net="ed-move"][data-floor="n2"]');
      if (!(await p.locator('[data-net="ed-move-here"]').count())) fail(look + ' ' + theme + ': pick mode shows no target');
      if (width < 640) await sizes(p, EDIT_BUTTONS, look + ' ' + theme + ' ' + width + ' pick mode');
      await rules(p, look + ' ' + theme + ' ' + width + ' editor');
      await p.click('[data-net="run-mode-on"]');
      await p.click('.net-run-map [data-net="run-go"][data-floor="n3"]');
      await p.focus('[data-net="run-roll"][data-entry="c1"]'); await p.keyboard.press('Enter'); await wait(200);
      if (!(await p.locator('[data-net-run-floor] .net-result[role="status"]').count()) || (await p.evaluate(() => window.App.getState().netArchitectures[0].floors.find(f => f.id === 'n3').entries[0].state)) !== 'open') fail(look + ' ' + theme + ': the roll left no result line or did not open the node');
      if (!(await until(() => p.evaluate(() => document.activeElement?.dataset?.net === 'run-toggle' && document.activeElement.dataset.entry === 'c1'), 3000, 50))) fail(look + ' ' + theme + ': after a successful roll the focus is not on «Закрыть снова»');
      await rules(p, look + ' ' + theme + ' ' + width + ' run');
      // The ICE floor as well, so the narrow REZ buttons are measured.
      if (width < 640) { await sizes(p, RUN_BUTTONS, look + ' ' + theme + ' ' + width + ' run'); await p.click('.net-run-map [data-net="run-go"][data-floor="n2"]'); await wait(150); await sizes(p, RUN_BUTTONS, look + ' ' + theme + ' ' + width + ' run, ICE floor'); }
      for (const e of p.errs) fail(look + ' ' + theme + ': ' + e);
      await o.ctx.close();
    }
  });

  if (!brokerUrl) skip('the city map in a room', 'aedes and ws are not installed');
  else await check('the city map: own picture stays on the device, pins, filter, route, crew mark, chosen pins reach a player', async fail => {
    const gm = await device(), player = await device({ width: 390, look: 'board', theme: 'light' });
    const G = gm.page, P = player.page, close = async () => { await gm.ctx.close(); await player.ctx.close(); };
    const axeFile = (() => { try { return require.resolve('axe-core/axe.min.js'); } catch { return null; } })(), axeSource = axeFile ? fs.readFileSync(axeFile, 'utf8') : null;
    const axe = async (page, selector, where) => {
      if (!axeSource) return;
      await page.evaluate(axeSource);
      const found = await page.evaluate(sel => window.axe.run(document.querySelector(sel), { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa'] }, resultTypes: ['violations'] }).then(r => r.violations.filter(v => ['critical', 'serious'].includes(v.impact)).map(v => `${v.id} (${v.nodes.length}): ${v.nodes[0].target.join(' ').slice(0, 70)}`)), selector);
      for (const v of found) fail(`${where}: ${v}`);
    };
    const sideways = (page, where) => page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth).then(over => { if (over > 0) fail(`${where}: the page scrolls sideways by ${over}px`); });
    const small = (page, where) => page.evaluate(() => [...document.querySelectorAll('[data-cm-page] button, [data-cm-page] select, [data-cm-page] input[type="text"], [data-cm-page] textarea, [data-cm-page] .cm-file, [data-cm-page] .cm-check')].filter(b => b.offsetParent && b.getBoundingClientRect().height < 44).map(b => b.className || b.tagName).join(', ')).then(list => { if (list) fail(`${where}: controls lower than 44px: ${list}`); });
    const map = page => page.evaluate(() => window.App.getState().campaigns.find(c => c.id === 'k1')?.cityMap || null);
    const openMap = async page => { await page.goto(BASE + '#/campaigns'); await wait(300); if (!(await page.locator('[data-cm-page]').count())) { if (await page.locator('[data-campaign-action="open"][data-id="k1"]').count()) await page.click('[data-campaign-action="open"][data-id="k1"]'); await wait(300); await page.click('[data-cm-act="open"]'); await wait(300); } };
    await openMap(G);
    if (!(await G.locator('[data-cm-page="k1"] h1').count())) { fail('the city map page did not open from the campaign'); await close(); return; }
    if ((await G.evaluate(() => document.activeElement?.dataset?.cmAct)) !== 'close') fail('the focus did not move to the opened map page');
    if (await G.locator('[data-cio-root]').count()) fail('the import and transfer cards were added under the map page');
    if (!(await G.locator('.cm-stage.cm-grid').count()) || (await G.locator('.cm-stage img').count())) fail('without a picture the placeholder grid is not shown');
    // The user's own picture: made here, loaded through the file field, kept outside the saved data.
    const png = await G.evaluate(() => { const c = document.createElement('canvas'); c.width = 320; c.height = 160; const g = c.getContext('2d'); g.fillStyle = '#1d3b53'; g.fillRect(0, 0, 320, 160); g.fillStyle = '#f2a900'; g.fillRect(40, 40, 110, 60); return c.toDataURL('image/png').split(',')[1]; });
    await G.setInputFiles('[data-cm-file]', { name: 'my-city.png', mimeType: 'image/png', buffer: Buffer.from(png, 'base64') });
    if (!(await until(() => G.evaluate(() => { const i = document.querySelector('.cm-stage img.cm-pic'); return !!i && i.complete && i.naturalWidth === 320; }), 5000))) fail('the loaded picture is not shown on the stage');
    if ((await map(G))?.ratio !== 2) fail('the stage did not take the proportions of the picture: ' + JSON.stringify(await map(G)));
    if (!/сохранена в этом браузере/.test(await G.evaluate(() => document.querySelector('#app-notice')?.textContent || ''))) fail('the page does not say where the picture is kept');
    await wait(700);
    if (await G.evaluate(() => (localStorage.getItem('nightcity-red-v1') || '').includes('data:image'))) fail('the picture got into the saved data');
    // A pin by a tap on the map, of the type chosen in the toolbar.
    await G.click('[data-cm-act="mode"][data-cm-value="add"]'); await G.selectOption('[data-cm-newtype]', 'bar');
    const box = await G.locator('[data-cm-stage]').boundingBox();
    await G.mouse.click(box.x + box.width * 0.3, box.y + box.height * 0.4); await wait(200);
    let m = await map(G);
    if (m?.pins.length !== 1 || m.pins[0].t !== 'bar' || Math.abs(m.pins[0].x - 300) > 6 || Math.abs(m.pins[0].y - 400) > 6) { fail('a tap on the map did not put a pin there: ' + JSON.stringify(m?.pins)); await close(); return; }
    if ((await G.evaluate(() => document.activeElement?.dataset?.cmField)) !== 'name') fail('the name of the new pin is not ready to be typed');
    const barName = 'Бар <b>«Тихий час»</b>';
    await G.fill('[data-cm-field="name"]', barName); await G.fill('[data-cm-field="note"]', 'Хозяин — информатор');
    if ((await G.evaluate(() => document.activeElement?.dataset?.cmField)) !== 'note') fail('typing redrew the editor and lost the focus');
    if (await G.locator('[data-cm-page] b:not(.cm-row-name)').count()) fail('markup typed into a name became markup');
    if (!(await G.evaluate(n => document.querySelector('.cm-row-name')?.textContent === n && document.querySelector('button.cm-pin')?.getAttribute('aria-label')?.includes(n), barName))) fail('the list and the pin did not follow the typed name');
    // A pin without a pointer.
    await G.selectOption('[data-cm-newtype]', 'clinic'); await G.click('[data-cm-act="add-centre"]'); await wait(150);
    await G.fill('[data-cm-field="name"]', 'Клиника у доков');
    m = await map(G);
    if (m.pins.length !== 2 || m.pins[1].x !== 500 || m.pins[1].y !== 500 || m.pins[1].name !== 'Клиника у доков' || m.pins[0].note !== 'Хозяин — информатор') { fail('«Метку в центр» or the editor did not save: ' + JSON.stringify(m.pins)); await close(); return; }
    const [bar, clinic] = m.pins.map(p => p.id);
    // Filter by type.
    await G.click('[data-cm-act="filter"][data-cm-value="clinic"]'); await wait(100);
    if ((await G.locator('button.cm-pin').count()) !== 1 || (await G.locator('[data-cm-row]').count()) !== 1) fail('the filter did not leave one pin on the stage and in the list');
    await G.click('[data-cm-act="filter"][data-cm-value=""]'); await wait(100);
    if ((await G.locator('button.cm-pin').count()) !== 2) fail('«Все» did not bring the pins back');
    // A route of two stops.
    await G.click('[data-cm-act="mode"][data-cm-value="route"]');
    await G.click(`[data-cm-pin="${bar}"]`); await G.click(`[data-cm-pin="${clinic}"]`); await wait(100);
    m = await map(G);
    if (JSON.stringify(m.route) !== JSON.stringify([bar, clinic]) || !(await G.locator('.cm-route polyline').count()) || !/остановок: 2/.test(await G.locator('[data-cm-route-line]').textContent())) fail('the route of two stops was not built: ' + JSON.stringify(m.route));
    // The crew is at the clinic; the bar and the place of the crew are shown to players.
    await G.click('[data-cm-act="mode"][data-cm-value="select"]');
    await G.click(`[data-cm-pin="${clinic}"]`);
    // What the action did is read out from a line that is not replaced by the redraw; the button keeps one label and says "pressed".
    await G.evaluate(() => { window.__cmLive = document.querySelector('[data-cm-live]'); });
    await G.click('[data-cm-act="crew"]'); await wait(100);
    const said = await G.evaluate(() => { const l = document.querySelector('[data-cm-live]'), b = document.querySelector('[data-cm-act="crew"]'); return { same: !!l && l === window.__cmLive && l.isConnected, role: l?.getAttribute('role'), text: l?.textContent || '', seen: document.querySelector('[data-cm-say]')?.textContent || '', label: b?.textContent.trim(), pressed: b?.getAttribute('aria-pressed'), lives: document.querySelectorAll('[data-cm-body] [aria-live], [data-cm-body] .cm-say[role]').length }; });
    if (!said.same || said.role !== 'status' || !/Группа отмечена на метке «Клиника у доков»/.test(said.text) || said.seen !== said.text || said.lives) fail('the status line is recreated with its text instead of being updated: ' + JSON.stringify(said));
    if (said.label !== 'Группа здесь' || said.pressed !== 'true') fail('the crew button says the opposite of its state: ' + JSON.stringify(said));
    await G.click(`[data-cm-row="${bar}"]`); await G.check('[data-cm-field="shown"]'); await G.check('[data-cm-field="crewShown"]'); await wait(100);
    m = await map(G);
    if (m.crew !== clinic || m.crewShown !== true || m.pins[0].shown !== true || m.pins[1].shown) fail('the crew mark or «Показать игрокам» was not saved: ' + JSON.stringify(m));
    // Keyboard: arrows move the focused pin and the focus stays on it.
    await G.focus(`[data-cm-pin="${bar}"]`); await G.keyboard.press('ArrowRight'); await G.keyboard.press('Shift+ArrowDown'); await wait(100);
    const moved = (await map(G)).pins[0];
    if (moved.x !== m.pins[0].x + 10 || moved.y !== m.pins[0].y + 50) fail(`arrow keys did not move the pin: ${m.pins[0].x},${m.pins[0].y} -> ${moved.x},${moved.y}`);
    if ((await G.evaluate(() => document.activeElement?.dataset?.cmPin)) !== bar) fail('the focus left the pin after it was moved with the keyboard');
    // Dragging with a pointer.
    const pb = await G.locator(`[data-cm-pin="${clinic}"]`).boundingBox();
    await G.mouse.move(pb.x + pb.width / 2, pb.y + pb.height / 2); await G.mouse.down(); await G.mouse.move(pb.x + pb.width / 2 + 60, pb.y + pb.height / 2 + 30, { steps: 6 }); await G.mouse.up(); await wait(200);
    const dragged = (await map(G)).pins[1];
    if (dragged.x <= 520 || dragged.y <= 520) fail('dragging did not move the pin: ' + JSON.stringify(dragged));
    // Deleting takes the pin off the route and lifts the crew mark; «Вернуть» puts all of it back.
    await wait(450);
    await G.click(`[data-cm-pin="${clinic}"]`); await G.click('[data-cm-act="pin-remove"]'); await wait(150);
    m = await map(G);
    if (m.pins.length !== 1 || m.crew || (m.route || []).includes(clinic)) fail('deleting a pin left it on the route or under the crew: ' + JSON.stringify(m));
    await G.click('#app-notice .notice-action'); await wait(200);
    m = await map(G);
    if (m.pins.length !== 2 || m.crew !== clinic || JSON.stringify(m.route) !== JSON.stringify([bar, clinic])) fail('«Вернуть» did not bring the pin back with its route stop and the crew mark: ' + JSON.stringify(m));
    if ((await G.locator('button.cm-pin').count()) !== 2) fail('the map was not redrawn after «Вернуть»');
    // A route changed after a deletion is newer than the deletion: «Вернуть» brings the pin back and leaves that route alone.
    await G.click(`[data-cm-pin="${clinic}"]`); await G.click('[data-cm-act="pin-remove"]'); await wait(150);
    await G.click('[data-cm-act="mode"][data-cm-value="route"]'); await G.click(`[data-cm-pin="${bar}"]`); await wait(100);
    if (((await map(G)).route || []).length) fail('a tap on the last stop did not take it off the route');
    await G.click('#app-notice .notice-action'); await wait(200);
    m = await map(G);
    if (m.pins.length !== 2 || m.crew !== clinic || (m.route || []).length) fail('«Вернуть» overwrote the route changed after the deletion: ' + JSON.stringify(m));
    await G.click(`[data-cm-pin="${bar}"]`); await G.click(`[data-cm-pin="${clinic}"]`); await wait(100);
    await G.click('[data-cm-act="route-clear"]'); await wait(100);
    await G.click(`[data-cm-pin="${clinic}"]`); await wait(100);
    await G.click('#app-notice .notice-action'); await wait(200);
    m = await map(G);
    if (JSON.stringify(m.route) !== JSON.stringify([clinic])) fail('«Вернуть» after «Очистить маршрут» overwrote the route drawn since: ' + JSON.stringify(m.route));
    await G.click('[data-cm-act="mode"][data-cm-value="select"]');
    // «Сменить картинку» can be taken back: the first picture returns with its proportions.
    const png2 = await G.evaluate(() => { const c = document.createElement('canvas'); c.width = 200; c.height = 200; const g = c.getContext('2d'); g.fillStyle = '#5a1e2c'; g.fillRect(0, 0, 200, 200); return c.toDataURL('image/png').split(',')[1]; });
    await G.setInputFiles('[data-cm-file]', { name: 'other.png', mimeType: 'image/png', buffer: Buffer.from(png2, 'base64') });
    if (!(await until(() => G.evaluate(() => { const i = document.querySelector('.cm-stage img.cm-pic'); return !!i && i.complete && i.naturalWidth === 200; }), 5000))) fail('the second picture did not replace the first');
    if ((await map(G)).ratio !== 1 || !/заменена/.test(await G.evaluate(() => document.querySelector('#app-notice')?.textContent || ''))) fail('replacing the picture is not announced with a way back');
    await G.click('#app-notice .notice-action');
    if (!(await until(() => G.evaluate(() => { const i = document.querySelector('.cm-stage img.cm-pic'); return !!i && i.complete && i.naturalWidth === 320; }), 5000)) || (await map(G)).ratio !== 2) fail('«Вернуть» did not bring the replaced picture back');
    if ((await G.evaluate(() => new Promise(ok => { const rq = indexedDB.open('nightcity-red-citymap'); rq.onsuccess = () => { const g = rq.result.transaction('pics').objectStore('pics').get('k1'); g.onsuccess = () => { rq.result.close(); ok(g.result?.w); }; g.onerror = () => ok(-1); }; rq.onerror = () => ok(-1); }))) !== 320) fail('the picture brought back is not the one kept in the browser');
    // Two pins put in the centre one after another do not lie on each other.
    await G.click('[data-cm-act="add-centre"]'); await wait(100); await G.click('[data-cm-act="add-centre"]'); await wait(150);
    const pair = await G.evaluate(() => { const b = [...document.querySelectorAll('button.cm-pin')].slice(-2).map(e => e.getBoundingClientRect()); return Math.max(Math.abs(b[0].x - b[1].x), Math.abs(b[0].y - b[1].y)); });
    if (pair < 28) fail('two pins put in the centre overlap: ' + pair + 'px apart');
    for (let i = 0; i < 2; i++) { await G.click('button.cm-pin >> nth=-1'); await G.click('[data-cm-act="pin-remove"]'); await wait(120); }
    if ((await map(G)).pins.length !== 2) fail('the two extra pins were not removed');
    await axe(G, '[data-cm-page]', 'map page, native dark 1280'); await sideways(G, 'map page, 1280px');
    // The room: the player gets the chosen pin and the place of the crew, and nothing else.
    await G.goto(BASE + '#/room'); await wait(400);
    await G.fill('#room-gm-name', 'Мастер'); await G.selectOption('#room-campaign', 'k1'); await G.click('[data-room-action="create"]');
    const link = await until(() => G.evaluate(() => { const s = window.Room._test.session(); return s?.code && s.gmFp ? window.Room._test.roomLink(s.code) : null; }));
    if (!link) { fail('the room was not created'); await close(); return; }
    await P.goto(link); await wait(600);
    await P.fill('#room-player-name', 'Аня'); await P.selectOption('#room-character', 'v1'); await P.click('[data-room-action="join"]');
    if (!(await until(() => P.evaluate(() => window.CityMap._test.shown().pins.length === 1 && !!window.CityMap._test.shown().crew), 10000))) { fail('the shown pin and the crew mark did not reach the player: ' + await P.evaluate(() => JSON.stringify(window.CityMap._test.shown()))); await close(); return; }
    const got = await P.evaluate(() => window.CityMap._test.shown()), want = await map(G);
    if (JSON.stringify(got.pins) !== JSON.stringify([['bar', want.pins[0].x, want.pins[0].y, barName]]) || JSON.stringify(got.crew) !== JSON.stringify([want.pins[1].x, want.pins[1].y]) || got.ratio !== 2) fail('the player got something else than the chosen pin and the crew point: ' + JSON.stringify(got));
    if (/информатор|Клиника/.test(JSON.stringify(got))) fail('a note or a pin that was not chosen reached the player');
    await wait(400);
    const card = await P.evaluate(() => { const c = document.querySelector('[data-cm-room]'); return c ? { pins: c.querySelectorAll('.cm-shared .cm-pin:not(.cm-crew-only)').length, crew: c.querySelectorAll('.cm-crew-tag').length, img: c.querySelectorAll('img').length, pressable: c.querySelectorAll('button,input,a').length, bold: c.querySelectorAll('.cm-pin-name b, li b b').length, text: c.innerText } : null; });
    if (!card || card.pins !== 2 || card.crew !== 1 || card.img || card.pressable || card.bold || !/Тихий час/.test(card.text) || !/Группа отмечена на карте/.test(card.text)) fail('the player card does not show one pin and the crew mark only: ' + JSON.stringify(card));
    await sideways(P, 'player room page, 390px'); await axe(P, '[data-cm-room]', 'player card, board light 390');
    if (!(await G.evaluate(() => /Игроки видят меток: 1\. Место группы показано/.test(document.querySelector('[data-cm-room]')?.textContent || '')))) fail('the Game Master card on the room page does not say what players see');
    // Taking the pin back takes it from the player too.
    await G.evaluate(() => { const c = window.App.getState().campaigns.find(x => x.id === 'k1'); delete c.cityMap.pins[0].shown; window.App.save(); });
    if (!(await until(() => P.evaluate(() => window.CityMap._test.shown().pins.length === 0), 8000))) fail('a pin taken back stayed with the player');
    // A reload keeps the pins (saved data) and the picture (this browser's storage).
    await G.reload(); await wait(600); await openMap(G);
    if (!(await until(() => G.evaluate(() => { const i = document.querySelector('.cm-stage img.cm-pic'); return !!i && i.complete && i.naturalWidth === 320; }), 5000))) fail('the picture is gone after a reload');
    if ((await G.locator('button.cm-pin').count()) !== 2) fail('the pins are gone after a reload');
    for (const e of [...G.errs, ...P.errs]) fail(e);
    await close();
    // The same page on a phone and in the other looks, with a pin selected and names that have no place to break.
    const solo = await device({ width: 390, look: 'native', theme: 'light' }), S = solo.page;
    await S.goto(BASE + '#/campaigns'); await wait(300);
    await S.evaluate(() => { const c = window.App.getState().campaigns.find(x => x.id === 'k1'); c.cityMap = { v: 1, ratio: 0.75, pins: [{ id: 'a', t: 'gang', x: 0, y: 0, name: 'Щ'.repeat(60), shown: true }, { id: 'b', t: 'job', x: 1000, y: 1000, name: 'Заказ: склад у доков', note: 'x'.repeat(300) }, { id: 'c', t: 'safehouse', x: 500, y: 480, name: 'Убежище' }], route: ['a', 'c', 'b'], crew: 'a', crewShown: true }; window.App.save(); });
    await wait(700);
    for (const [look, theme, width] of [['native', 'light', 390], ['board', 'dark', 390], ['cyber', 'dark', 390], ['board', 'light', 1280], ['cyber', 'dark', 1280]]) {
      await S.setViewportSize({ width, height: 844 });
      await S.evaluate(([a, b]) => { localStorage.setItem('nc-ui-style', a); localStorage.setItem('nc-ui-theme', b); }, [look, theme]); await S.reload(); await wait(500);
      await openMap(S);
      const where = `map page, ${look} ${theme} ${width}`;
      if ((await S.locator('button.cm-pin').count()) !== 3) { fail(where + ': the saved pins are not shown'); continue; }
      await S.click('[data-cm-row="a"]'); await wait(100);
      await sideways(S, where); await axe(S, '[data-cm-page]', where);
      // Labels and the crew tag of pins in the very corners stay inside the stage.
      const cut = await S.evaluate(() => { const st = document.querySelector('[data-cm-stage]').getBoundingClientRect(); return [...document.querySelectorAll('[data-cm-stage] .cm-pin-name, [data-cm-stage] .cm-crew-tag')].map(e => [e.className, e.getBoundingClientRect()]).filter(([, r]) => r.left < st.left - 1 || r.right > st.right + 1 || r.top < st.top - 1 || r.bottom > st.bottom + 1).map(([c, r]) => c + ' ' + Math.round(r.left - st.left) + '..' + Math.round(r.right - st.left) + ' / ' + Math.round(r.top - st.top)).join('; '); });
      if (cut) fail(where + ': text on the map is cut by the edge of the stage: ' + cut);
      if (width === 390) await small(S, where);
      // Zoomed in, only the map box scrolls sideways.
      await S.click('[data-cm-act="zoom-in"]'); await wait(100);
      const zoom = await S.evaluate(() => { const s = document.querySelector('[data-cm-scroll]'); return { inner: s.scrollWidth > s.clientWidth + 10, page: document.documentElement.scrollWidth - window.innerWidth }; });
      if (!zoom.inner || zoom.page > 0) fail(where + ': zooming in did not keep the scroll inside the map box: ' + JSON.stringify(zoom));
      await S.click('[data-cm-act="zoom-out"]');
    }
    for (const e of S.errs) fail(e);
    await solo.ctx.close();
  });

  const axePath = (() => { try { return require.resolve('axe-core/axe.min.js'); } catch { return null; } })();
  if (!axePath) skip('accessibility rules (axe)', 'axe-core is not installed');
  else await check('accessibility rules (axe): names, roles and contrast on every screen in every look', async fail => {
    const source = fs.readFileSync(axePath, 'utf8');
    for (const [look, theme, width] of [['native', 'dark', 1280], ['native', 'light', 390], ['cyber', 'dark', 1280], ['board', 'dark', 1440], ['board', 'light', 390]]) {
      const { ctx, page } = await device({ look, theme, width });
      for (const view of VIEWS) {
        await page.goto(BASE + '#/' + view); await wait(300);
        await page.evaluate(source);
        const found = await page.evaluate(() => window.axe.run(document, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa'] }, resultTypes: ['violations'] }).then(r => r.violations.filter(v => ['critical', 'serious'].includes(v.impact)).map(v => `${v.id} (${v.nodes.length}): ${v.nodes[0].target.join(' ').slice(0, 70)}`)));
        for (const v of found) fail(`${look} ${theme} ${view}: ${v}`);
      }
      await ctx.close();
    }
  });

  for (const f of cleanup.reverse()) { try { await f(); } catch {} }
  fs.rmSync(out, { recursive: true, force: true });
  const failed = results.filter(r => r.problems.length), skipped = results.filter(r => r.skipped);
  console.log(`\n${results.length - failed.length - skipped.length} passed, ${failed.length} failed, ${skipped.length} skipped`);
  process.exit(failed.length ? 1 : 0);
}
main().catch(e => { console.error(e); process.exit(1); });
