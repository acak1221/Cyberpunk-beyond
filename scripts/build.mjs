// Builds the deployable static site: copies site/ to dist/, bundles the local scripts and stylesheets, and stamps the
// service worker with a content hash and the list of files to precache.
//
//   nc-red.js     the core: everything the first screens need, ending with app.js. Comments and indentation are
//                 stripped (scripts/strip.mjs); nothing is renamed.
//   nc-<name>.js  lazy chunks (scripts/chunks.mjs): code of single screens, loaded when the screen is first opened.
//   nc-red.css    all stylesheets, one file, loaded without blocking the first paint (index.html has a skeleton).
//
// node scripts/build.mjs [outDir] [--no-strip] [--update-budget]
import { createHash } from 'node:crypto';
import { cp, mkdir, readFile, readdir, rm, stat, writeFile } from 'node:fs/promises';
import { gzipSync } from 'node:zlib';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { stripJs } from './strip.mjs';
import { CHUNKS } from './chunks.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const src = path.join(root, 'site');
const flags = new Set(process.argv.slice(2).filter(a => a.startsWith('--')));
const out = path.resolve(root, process.argv.slice(2).find(a => !a.startsWith('--')) || 'dist');
const BUDGET_FILE = path.join(root, 'scripts', 'size-budget.json');
const BUDGET_MARGIN = 1.10; // the core file may grow this much over the recorded baseline

// Big optional files are not precached. The PDF reader is stored on first use or in the
// background, in a cache of its own that app updates keep (see sw.js).
const RUNTIME_ONLY = [/^vendor\/pdfjs\//];
const SKIP = [/^sw\.js$/, /\.map$/, /(^|\/)\./];

async function walk(dir, base = '') {
  const files = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const rel = base ? `${base}/${entry.name}` : entry.name;
    if (entry.isDirectory()) files.push(...await walk(path.join(dir, entry.name), rel));
    else files.push(rel);
  }
  return files.sort();
}

await rm(out, { recursive: true, force: true });
await mkdir(out, { recursive: true });
await cp(src, out, { recursive: true });

const sourceIndex = await readFile(path.join(src, 'index.html'), 'utf8');
if (!sourceIndex.includes('<html lang="ru">')) throw new Error('index.html root element changed; update build.mjs');

// ---- Bundles --------------------------------------------------------------
const SCRIPT_TAG = /<script src="([^":?]+\.js)"><\/script>/g;
const STYLE_TAG = /<link rel="stylesheet" href="([^":?]+\.css)">/g;
const scripts = [...sourceIndex.matchAll(SCRIPT_TAG)].map(m => m[1]);
const styles = [...sourceIndex.matchAll(STYLE_TAG)].map(m => m[1]);
if (!scripts.length || !styles.length) throw new Error('no scripts or stylesheets found in index.html');
if (scripts.at(-1) !== 'app.js') throw new Error('app.js must be the last script');

// Which script goes where. A chunk's files keep the order they have in index.html.
const chunkOf = new Map();
for (const [name, chunk] of Object.entries(CHUNKS)) {
  if (!/^[a-z][a-z0-9-]*$/.test(name)) throw new Error(`chunk name ${name} is not a plain word`);
  if (!chunk.files?.length || !chunk.views?.length || !chunk.probe) throw new Error(`chunk ${name} needs files, views and a probe`);
  for (const file of chunk.files) {
    if (!scripts.includes(file)) throw new Error(`chunk ${name}: ${file} is not a script of index.html`);
    if (file === 'app.js') throw new Error('app.js cannot be in a lazy chunk');
    if (chunkOf.has(file)) throw new Error(`${file} is in two chunks`);
    chunkOf.set(file, name);
  }
}
const coreScripts = scripts.filter(file => !chunkOf.has(file));

// A module that throws while loading must not stop the ones after it (as with
// separate <script> tags). Only whole-file IIFEs and plain window.X = … files
// are wrapped: wrapping a file with top-level let/const would change its scope.
const IIFE_START = /^(?:\/\*[\s\S]*?\*\/\s*|\/\/[^\n]*\n\s*)*(?:\(function|window\.[A-Za-z_$][\w$]*\s*=)/;
const IIFE_END = /(?:\}\)\((?:window|typeof window[^)]*|globalThis)?\);?|\];?|\};?)\s*$/;
async function bundleScripts(files, header) {
  let js = header;
  for (const file of files) {
    const code = (await readFile(path.join(src, file), 'utf8')).replace(/\/\/# sourceMappingURL=.*$/m, '');
    const wrap = file !== 'app.js' && IIFE_START.test(code) && IIFE_END.test(code);
    const body = flags.has('--no-strip') ? code : stripJs(code);
    js += wrap
      ? `\n/* ${file} */\ntry{\n${body}\n}catch(e){console.error(${JSON.stringify(file)},e)}\n`
      : `\n/* ${file} */\n;${body}\n`;
  }
  return js;
}
const jsBundle = await bundleScripts(coreScripts, '/* Night City // RED — bundled by scripts/build.mjs; sources in site/. */\n');
const chunkBundles = {};
for (const [name, chunk] of Object.entries(CHUNKS)) {
  const files = scripts.filter(file => chunk.files.includes(file));
  const js = await bundleScripts(files, `/* Night City // RED — chunk ${name}, loaded by lazy-chunks.js; sources in site/. */\n`);
  // The page knows a chunk has run by this global (lazy-chunks.js): a chunk that does not define it would load forever.
  if (!files.some(file => new RegExp(`\\b(?:window|global|root)\\.${chunk.probe}\\s*=(?!=)`).test(js))) throw new Error(`chunk ${name} never defines ${chunk.probe}`);
  chunkBundles[name] = js;
}
let cssBundle = '/* Night City // RED — bundled by scripts/build.mjs; sources in site/. */\n';
for (const file of styles) {
  const css = await readFile(path.join(src, file), 'utf8');
  if (/@import|@charset/.test(css)) throw new Error(`${file}: @import/@charset cannot be bundled`);
  cssBundle += `\n/* ${file} */\n${css}\n`;
}
for (const file of [...scripts, ...styles]) await rm(path.join(out, file), { force: true });
await writeFile(path.join(out, 'nc-red.js'), jsBundle);
for (const [name, js] of Object.entries(chunkBundles)) await writeFile(path.join(out, `nc-${name}.js`), js);
await writeFile(path.join(out, 'nc-red.css'), cssBundle);

// ---- Size budget: the core file (what every visit downloads and runs) may not creep up unnoticed ------
const coreBytes = Buffer.byteLength(jsBundle), coreGzip = gzipSync(jsBundle, { level: 9 }).length;
if (flags.has('--update-budget')) {
  await writeFile(BUDGET_FILE, JSON.stringify({ note: 'Baseline of nc-red.js (the core file). scripts/build.mjs fails when it grows more than 10% over this; after a deliberate increase run: node scripts/build.mjs --update-budget', coreBytes, coreGzip }, null, 2) + '\n');
} else {
  const budget = JSON.parse(await readFile(BUDGET_FILE, 'utf8').catch(() => 'null') || 'null');
  if (!budget?.coreBytes || !budget?.coreGzip) throw new Error('scripts/size-budget.json is missing; create it with: node scripts/build.mjs --update-budget');
  const over = [['bytes', coreBytes, budget.coreBytes], ['gzip', coreGzip, budget.coreGzip]].filter(([, now, base]) => now > base * BUDGET_MARGIN);
  if (over.length) {
    throw new Error(`nc-red.js grew more than 10% over the baseline in scripts/size-budget.json: ${over.map(([k, now, base]) => `${k} ${now} > ${Math.round(base * BUDGET_MARGIN)} (baseline ${base})`).join('; ')}. `
      + 'Move code for a single screen into a lazy chunk (scripts/chunks.mjs), or, if the growth is wanted, run: node scripts/build.mjs --update-budget');
  }
}

// ---- Version and precache list (from what is actually deployed) -------------
const files = await walk(out);
const hash = createHash('sha256'), pdfHash = createHash('sha256');
// './' is index.html itself; the bundles get the ?v= the page loads them with (below).
const precache = ['./'], pdfjs = {};
let bytes = 0;
for (const file of files) {
  if (SKIP.some(re => re.test(file)) || file === '404.html') continue;
  const content = await readFile(path.join(out, file));
  hash.update(file).update('\0').update(content);
  if (RUNTIME_ONLY.some(re => re.test(file))) {
    // The worker checks these hashes before it stores a pdf.js file.
    if (/\.m?js$/.test(file)) pdfjs[file] = createHash('sha256').update(content).digest('hex'), pdfHash.update(file).update('\0').update(content);
    continue;
  }
  if (file !== 'index.html') precache.push(file);
  bytes += (await stat(path.join(out, file))).size;
}
if (!Object.keys(pdfjs).length) throw new Error('vendor/pdfjs is missing');
hash.update(await readFile(path.join(src, 'sw.js')));
const version = hash.digest('hex').slice(0, 12);
const BUNDLES = new Set(['nc-red.js', 'nc-red.css', ...Object.keys(CHUNKS).map(name => `nc-${name}.js`)]);
for (let i = 0; i < precache.length; i++) if (BUNDLES.has(precache[i])) precache[i] += `?v=${version}`;
const views = [...(await readFile(path.join(src, 'app.js'), 'utf8')).match(/VIEWS=new Set\((\[[^\]]*\])\)/)?.[1].matchAll(/'([\w-]+)'/g) || []].map(m => m[1]);
if (!views.length) throw new Error('VIEWS list not found in app.js; update build.mjs');
for (const [name, chunk] of Object.entries(CHUNKS)) for (const view of chunk.views) if (!views.includes(view)) throw new Error(`chunk ${name}: ${view} is not a screen of app.js`);

const swSource = await readFile(path.join(src, 'sw.js'), 'utf8');
const slots = {
  "const VERSION = '__BUILD__';": `const VERSION = ${JSON.stringify(version)};`,
  'const PRECACHE = __PRECACHE__;': `const PRECACHE = ${JSON.stringify(precache)};`,
  'const PDFJS = __PDFJS__;': `const PDFJS = ${JSON.stringify({ version: pdfHash.digest('hex').slice(0, 12), files: pdfjs })};`,
  'const VIEWS = __VIEWS__;': `const VIEWS = ${JSON.stringify(views)};`,
};
let sw = swSource;
for (const [slot, value] of Object.entries(slots)) {
  if (!sw.includes(slot)) throw new Error(`sw.js placeholder is missing: ${slot}`);
  sw = sw.replace(slot, value);
}
await writeFile(path.join(out, 'sw.js'), sw);

// data-build turns on the service worker; ?v= busts plain HTTP caches on hosts without the worker.
// First paint: the page ships a skeleton in #app (index.html), so the stylesheet is fetched as a preload and applied
// when it has arrived instead of holding the paint back, and the script is deferred. While the stylesheet is on its way
// the class nc-css hides anything the app draws (index.html), so that a fast script never shows unstyled content;
// a timer ends that in any case. Without scripts the <noscript> link loads the stylesheet the plain way.
const cssUrl = `nc-red.css?v=${version}`;
const dropGuard = "document.documentElement.classList.remove('nc-css')";
const cssTags = `<script>var h=document.documentElement;h.classList.add("nc-css");setTimeout(function(){h.classList.remove("nc-css")},15000)</script>`
  + `<link rel="preload" as="style" href="${cssUrl}" onload="this.onload=function(){${dropGuard}};this.rel='stylesheet'" onerror="${dropGuard}">`
  + `<noscript><link rel="stylesheet" href="${cssUrl}"></noscript>`;
const manifest = Object.fromEntries(Object.entries(CHUNKS).map(([name, chunk]) => [name, { u: `nc-${name}.js?v=${version}`, p: chunk.probe, v: chunk.views }]));
let first = true;
const stamped = sourceIndex
  .replace('<html lang="ru">', `<html lang="ru" data-build="${version}">`)
  .replace(STYLE_TAG, () => (first ? (first = false, cssTags) : ''))
  .replace(SCRIPT_TAG, (tag, file) => (file === 'app.js' ? `<script>window.NC_CHUNKS=${JSON.stringify(manifest)}</script><script src="nc-red.js?v=${version}" defer></script>` : ''));
await writeFile(path.join(out, 'index.html'), stamped);
// The worker must store the very URLs the page loads, or a first visit downloads them twice.
for (const [, url] of stamped.matchAll(/<(?:script|link|img)\b[^>]*?\s(?:src|href)="(?![a-z]+:|#|\/)([^"]+)"/g)) {
  if (!precache.includes(url)) throw new Error(`index.html loads ${url}, which is not precached`);
}
for (const { u } of Object.values(manifest)) if (!precache.includes(u)) throw new Error(`lazy chunk ${u} is not precached`);

// GitHub Pages: serve files as-is (no Jekyll processing).
await writeFile(path.join(out, '.nojekyll'), '');

// Unknown paths (e.g. /Cyberpunk-beyond/sheet/abc typed or shared without the #)
// redirect to the app with the same route as a hash, under whatever base path
// the site is served from. Relative asset links would break on a deep path, so
// this page is tiny and self-contained. Once installed, sw.js does the same
// without the network (VIEWS).
await writeFile(path.join(out, '404.html'), `<!doctype html><html lang="ru"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>Night City // RED</title><style>body{margin:0;min-height:100vh;display:grid;place-items:center;background:#11110f;color:#e8e6e1;font:16px system-ui,sans-serif}a{color:#ff5a4f}</style></head><body><p><a href="./">Night City // RED</a></p><script>
(function(){var views=${JSON.stringify(views)},parts=location.pathname.split('/').filter(Boolean),at=-1;
for(var i=0;i<parts.length;i++)if(views.indexOf(decodeURIComponent(parts[i]))>=0){at=i;break}
var base=at>=0?parts.slice(0,at):(/\.github\.io$/.test(location.hostname)&&parts.length?parts.slice(0,1):[]);
var route=at>=0?'#/'+parts.slice(at).join('/'):location.hash;
var target='/'+base.join('/')+(base.length?'/':'')+location.search+(location.hash||route);
document.querySelector('a').href=target;if(target!==location.pathname+location.search+location.hash)location.replace(target)})();
</script></body></html>`);

const chunkInfo = Object.entries(chunkBundles).map(([name, js]) => `${name} ${(Buffer.byteLength(js) / 1024).toFixed(0)} KiB`).join(', ');
console.log(`Built ${path.relative(root, out)}/ — version ${version}, ${precache.length} precached files (${(bytes / 1024).toFixed(0)} KiB); `
  + `core ${coreScripts.length} scripts → nc-red.js ${(coreBytes / 1024).toFixed(0)} KiB (${(coreGzip / 1024).toFixed(0)} KiB gzip), lazy chunks: ${chunkInfo}; ${styles.length} stylesheets bundled.`);
