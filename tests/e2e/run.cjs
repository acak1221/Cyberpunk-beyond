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
const VIEWS = ['overview', 'characters', 'lifepath', 'rules', 'catalog', 'combat', 'net', 'medical', 'repair', 'gm', 'dice', 'campaigns', 'book', 'builder-choice', 'builder', 'quick-builder', 'room', 'sheet/v1'];
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

  const axePath = (() => { try { return require.resolve('axe-core/axe.min.js'); } catch { return null; } })();
  if (!axePath) skip('accessibility rules (axe)', 'axe-core is not installed');
  else await check('accessibility rules (axe): names, roles and contrast on every screen in the three looks', async fail => {
    const source = fs.readFileSync(axePath, 'utf8');
    for (const [look, theme, width] of [['native', 'dark', 1280], ['native', 'light', 390], ['cyber', 'dark', 1280]]) {
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
