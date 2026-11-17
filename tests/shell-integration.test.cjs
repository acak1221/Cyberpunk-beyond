/* Guards for the whole shell: script order in index.html, RU/EN parity of the text tables of the newer modules, and the
   hooks that tie the feature modules into the pages (so a module that nobody calls is caught here, not by a player). */
const { test } = require('node:test'), assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm');
const { load } = require('./dialog-dom.cjs');
const SITE = path.join(__dirname, '..', 'site');
const read = f => fs.readFileSync(path.join(SITE, f), 'utf8');
const CYR = /[\u0400-\u04FF]/;

test('index.html: app.js is the last script, error-guard.js the first, no script twice, nothing references a missing file', () => {
  const html = read('index.html'), scripts = [...html.matchAll(/<script src="([^"]+)"/g)].map(m => m[1]);
  assert.equal(scripts.at(-1), 'app.js');
  assert.equal(scripts[0], 'error-guard.js', 'the error banner has to exist before anything else can fail');
  assert.equal(new Set(scripts).size, scripts.length, 'a script listed twice runs twice');
  for (const f of scripts) assert.ok(fs.existsSync(path.join(SITE, f)), f);
  for (const [, ref] of html.matchAll(/<link rel="stylesheet" href="([^"]+)"/g)) assert.ok(fs.existsSync(path.join(SITE, ref)), ref);
  // Every script of the site (except the service worker) is registered.
  for (const f of fs.readdirSync(SITE).filter(n => n.endsWith('.js') && n !== 'sw.js')) assert.ok(scripts.includes(f) || /new Worker|importScripts/.test(html) || html.includes(f), 'not registered: ' + f);
  // The shell modules are loaded before app.js draws, and the settings page after ui-memory.js (it reads it).
  assert.ok(scripts.indexOf('ui-memory.js') < scripts.indexOf('settings.js'));
  assert.ok(scripts.indexOf('crit-injuries.js') < scripts.indexOf('combat-tools.js') && scripts.indexOf('crit-injuries.js') < scripts.indexOf('effects.js'));
});

test('fonts are local: no stylesheet or script comes from another host, and the fonts folder carries its licence', () => {
  const html = read('index.html');
  assert.doesNotMatch(html, /fonts\.googleapis|fonts\.gstatic/);
  for (const m of html.matchAll(/(?:src|href)="(https?:)?\/\/[^"]+"/g)) assert.fail('external reference: ' + m[0]);
  const css = read('fonts.css');
  for (const [, f] of css.matchAll(/url\(["']?([^)"']+)["']?\)/g)) assert.ok(fs.existsSync(path.join(SITE, f)), f);
  assert.ok(fs.existsSync(path.join(SITE, 'fonts', 'OFL.txt')));
});

// The text table T of a module without running the page: the source is run in a fake window and the first `const T=` is captured.
function tableOf(file) {
  const src = read(file).replace(/\b(const|let|var)\s+T\s*=/, '$1 T=globalThis.__ncT=');
  const h = load([]);
  const ctx = h.ctx; ctx.globalThis = ctx;
  try { vm.runInContext(src, ctx, { filename: file }); } catch { /* the table is captured before anything else can fail */ }
  return ctx.__ncT || null;
}
const paths = (o, p = '') => (o && typeof o === 'object' && !Array.isArray(o) ? Object.keys(o).flatMap(k => paths(o[k], p + '/' + k)) : [p]);
const MODULES = ['settings', 'home', 'more-sheet', 'command-palette', 'quick-dice', 'roll-chip', 'hp-pad', 'quick-rail', 'combat-dock', 'char-list', 'char-tags', 'agent-notes', 'portrait', 'weapon-attach', 'garage', 'room-servers', 'net-generator', 'gm-hub', 'clock-triggers', 'city-map', 'error-guard', 'skill-filter', 'cyberweapons', 'book-memory', 'factions', 'rumors', 'whats-new'];

test('RU and EN text tables of the newer modules have the same keys, and English has no Cyrillic', () => {
  let checked = 0;
  for (const m of MODULES) {
    const T = tableOf(m + '.js');
    if (!T || !T.ru || !T.en) continue;
    checked++;
    const ru = paths(T.ru).sort(), en = paths(T.en).sort();
    assert.deepEqual(ru.filter(k => !en.includes(k)), [], m + ': keys only in RU');
    assert.deepEqual(en.filter(k => !ru.includes(k)), [], m + ': keys only in EN');
    const strings = (o, out = []) => { if (typeof o === 'string') out.push(o); else if (o && typeof o === 'object') for (const v of Object.values(o)) strings(v, out); return out; };
    for (const s of strings(T.en)) assert.doesNotMatch(s, CYR, m + ' EN: ' + s.slice(0, 50));
  }
  assert.ok(checked >= 12, 'the table of most modules was read (' + checked + ')');
});

test('the feature modules are called from the pages that show them', () => {
  const app = read('app.js'), dock = read('combat-dock.js');
  assert.match(app, /window\.Garage\?\.render\(c,state\.lang\)/, 'the garage card is in the equipment tab');
  assert.match(dock, /Garage\?\.combatRows/, 'the garage rows are in the combat dock');
  assert.match(app, /window\.AgentNotes\?\.cleanExtra/, 'the import cleans the notes, goals and contacts');
  assert.match(read('print-sheet.js'), /AgentNotes/, 'the printed sheet carries the titled notes');
  assert.match(read('combat-dock.js'), /MartialArts\?\.renderKnown/);
  assert.match(read('combat-dock.js'), /Cyberweapons\?\.render/);
  assert.match(read('equipment-tools.js'), /CyberSlots\?\.renderPanel/);
  assert.match(read('net-tools.js'), /NetGenerator/);
  assert.match(read('gm-hub.js'), /rumors/);
  assert.match(read('room.js'), /RoomServers/);
});

test('the saved-data check of a character calls the garage check, so an import with malformed vehicles is refused',()=>{
 const app=fs.readFileSync(path.join(__dirname,'../site/app.js'),'utf8');
 assert.match(app,/function validateCharacter\(c\)\{return validEquipmentExtra\(c\)&&validRoleTools\(c\)&&\(!window\.Garage\?\.valid\|\|window\.Garage\.valid\(c\)\)/);
});

test('touch-targets.css is the last stylesheet and lifts the small inline controls to 44 px on phones', () => {
  const html = read('index.html'), sheets = [...html.matchAll(/<link rel="stylesheet" href="([^"]+)"/g)].map(m => m[1]), css = read('touch-targets.css');
  assert.equal(sheets.at(-1), 'touch-targets.css');
  for (const sel of ['.nx-more', '.rule-source', '.hint-link', '.text-link', '.delete-button', '.cx-button', '.shop-chip', '.btn']) assert.ok(css.includes('html ' + sel), sel);
  assert.match(css, /min-height: 44px !important/); assert.match(css, /@media \(max-width: 820px\)/);
  assert.ok(!css.includes('\r'));
});
test('the service worker has no third-party font branch and drops the old font cache', () => {
  const sw = read('sw.js');
  assert.ok(!/FONT_HOSTS|fonts\.googleapis|fonts\.gstatic|FONT_CACHE/.test(sw));
});
