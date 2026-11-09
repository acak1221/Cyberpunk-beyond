// Builds the deployable static site: copies site/ to dist/, bundles the local
// scripts and stylesheets into one file each (one request instead of ~100 on a
// first visit), and stamps the service worker with a content hash and the list
// of files to precache.
import { createHash } from 'node:crypto';
import { cp, mkdir, readFile, readdir, rm, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const src = path.join(root, 'site');
const out = path.resolve(root, process.argv[2] || 'dist');

// Big optional files are cached on first use instead of at install time.
const RUNTIME_ONLY = [/^vendor\//];
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

// A module that throws while loading must not stop the ones after it (as with
// separate <script> tags). Only whole-file IIFEs and plain window.X = … files
// are wrapped: wrapping a file with top-level let/const would change its scope.
const IIFE_START = /^(?:\/\*[\s\S]*?\*\/\s*|\/\/[^\n]*\n\s*)*(?:\(function|window\.[A-Za-z_$][\w$]*\s*=)/;
const IIFE_END = /(?:\}\)\((?:window|typeof window[^)]*|globalThis)?\);?|\];?|\};?)\s*$/;
let jsBundle = '/* Night City // RED — bundled by scripts/build.mjs; sources in site/. */\n';
for (const file of scripts) {
  const code = (await readFile(path.join(src, file), 'utf8')).replace(/\/\/# sourceMappingURL=.*$/m, '');
  const wrap = file !== 'app.js' && IIFE_START.test(code) && IIFE_END.test(code);
  jsBundle += wrap
    ? `\n/* ${file} */\ntry{\n${code}\n}catch(e){console.error(${JSON.stringify(file)},e)}\n`
    : `\n/* ${file} */\n;${code}\n`;
}
let cssBundle = '/* Night City // RED — bundled by scripts/build.mjs; sources in site/. */\n';
for (const file of styles) {
  const css = await readFile(path.join(src, file), 'utf8');
  if (/@import|@charset/.test(css)) throw new Error(`${file}: @import/@charset cannot be bundled`);
  cssBundle += `\n/* ${file} */\n${css}\n`;
}
for (const file of [...scripts, ...styles]) await rm(path.join(out, file), { force: true });
await writeFile(path.join(out, 'nc-red.js'), jsBundle);
await writeFile(path.join(out, 'nc-red.css'), cssBundle);

// ---- Version and precache list (from what is actually deployed) -------------
const files = await walk(out);
const hash = createHash('sha256');
const precache = ['./'];
let bytes = 0;
for (const file of files) {
  if (SKIP.some(re => re.test(file)) || file === '404.html') continue;
  const content = await readFile(path.join(out, file));
  hash.update(file).update('\0').update(content);
  if (RUNTIME_ONLY.some(re => re.test(file))) continue;
  precache.push(file);
  bytes += (await stat(path.join(out, file))).size;
}
hash.update(await readFile(path.join(src, 'sw.js')));
const version = hash.digest('hex').slice(0, 12);

const swSource = await readFile(path.join(src, 'sw.js'), 'utf8');
const VERSION_SLOT = "const VERSION = '__BUILD__';", PRECACHE_SLOT = 'const PRECACHE = __PRECACHE__;';
if (!swSource.includes(VERSION_SLOT) || !swSource.includes(PRECACHE_SLOT)) throw new Error('sw.js placeholders are missing');
await writeFile(path.join(out, 'sw.js'), swSource
  .replace(VERSION_SLOT, `const VERSION = ${JSON.stringify(version)};`)
  .replace(PRECACHE_SLOT, `const PRECACHE = ${JSON.stringify(precache)};`));

// data-build turns on the service worker; ?v= busts plain HTTP caches on hosts without the worker.
let first = true;
const stamped = sourceIndex
  .replace('<html lang="ru">', `<html lang="ru" data-build="${version}">`)
  .replace(STYLE_TAG, () => (first ? (first = false, `<link rel="stylesheet" href="nc-red.css?v=${version}">`) : ''))
  .replace(SCRIPT_TAG, (tag, file) => (file === 'app.js' ? `<script src="nc-red.js?v=${version}"></script>` : ''));
await writeFile(path.join(out, 'index.html'), stamped);

// GitHub Pages: serve files as-is (no Jekyll processing).
await writeFile(path.join(out, '.nojekyll'), '');

// Unknown paths (e.g. /Cyberpunk-beyond/sheet/abc typed or shared without the #)
// redirect to the app with the same route as a hash, under whatever base path
// the site is served from. Relative asset links would break on a deep path, so
// this page is tiny and self-contained.
const views = [...(await readFile(path.join(src, 'app.js'), 'utf8')).match(/VIEWS=new Set\((\[[^\]]*\])\)/)?.[1].matchAll(/'([\w-]+)'/g) || []].map(m => m[1]);
if (!views.length) throw new Error('VIEWS list not found in app.js; update build.mjs');
await writeFile(path.join(out, '404.html'), `<!doctype html><html lang="ru"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>Night City // RED</title><style>body{margin:0;min-height:100vh;display:grid;place-items:center;background:#11110f;color:#e8e6e1;font:16px system-ui,sans-serif}a{color:#ff5a4f}</style></head><body><p><a href="./">Night City // RED</a></p><script>
(function(){var views=${JSON.stringify(views)},parts=location.pathname.split('/').filter(Boolean),at=-1;
for(var i=0;i<parts.length;i++)if(views.indexOf(decodeURIComponent(parts[i]))>=0){at=i;break}
var base=at>=0?parts.slice(0,at):(/\.github\.io$/.test(location.hostname)&&parts.length?parts.slice(0,1):[]);
var route=at>=0?'#/'+parts.slice(at).join('/'):location.hash;
var target='/'+base.join('/')+(base.length?'/':'')+location.search+(location.hash||route);
document.querySelector('a').href=target;if(target!==location.pathname+location.search+location.hash)location.replace(target)})();
</script></body></html>`);

console.log(`Built ${path.relative(root, out)}/ — version ${version}, ${precache.length} precached files (${(bytes / 1024).toFixed(0)} KiB); ${scripts.length} scripts and ${styles.length} stylesheets bundled.`);
