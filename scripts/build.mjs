// Builds the deployable static site: copies site/ to dist/ and stamps the
// service worker with a content hash and the list of files to precache.
import { createHash } from 'node:crypto';
import { cp, mkdir, readFile, readdir, rm, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const src = path.join(root, 'site');
const out = path.join(root, process.argv[2] || 'dist');

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

const files = await walk(src);
const hash = createHash('sha256');
const precache = ['./'];
let bytes = 0;
for (const file of files) {
  if (SKIP.some(re => re.test(file))) continue;
  const content = await readFile(path.join(src, file));
  hash.update(file).update('\0').update(content);
  if (RUNTIME_ONLY.some(re => re.test(file))) continue;
  precache.push(file);
  bytes += (await stat(path.join(src, file))).size;
}
const version = hash.digest('hex').slice(0, 12);

const swSource = await readFile(path.join(src, 'sw.js'), 'utf8');
const VERSION_SLOT = "const VERSION = '__BUILD__';", PRECACHE_SLOT = 'const PRECACHE = __PRECACHE__;';
if (!swSource.includes(VERSION_SLOT) || !swSource.includes(PRECACHE_SLOT)) throw new Error('sw.js placeholders are missing');
await writeFile(path.join(out, 'sw.js'), swSource
  .replace(VERSION_SLOT, `const VERSION = ${JSON.stringify(version)};`)
  .replace(PRECACHE_SLOT, `const PRECACHE = ${JSON.stringify(precache)};`));

const indexPath = path.join(out, 'index.html');
const index = await readFile(indexPath, 'utf8');
if (!index.includes('<html lang="ru">')) throw new Error('index.html root element changed; update build.mjs');
// data-build turns on the service worker; ?v= busts plain HTTP caches on hosts without the worker.
const stamped = index
  .replace('<html lang="ru">', `<html lang="ru" data-build="${version}">`)
  .replace(/(<script src="|<link rel="stylesheet" href=")([^":]+?\.(?:js|css))"/g, `$1$2?v=${version}"`);
await writeFile(indexPath, stamped);

// GitHub Pages: serve files as-is (no Jekyll processing).
await writeFile(path.join(out, '.nojekyll'), '');
// Any unknown path falls back to the app.
await writeFile(path.join(out, '404.html'), stamped);

console.log(`Built ${path.relative(root, out)}/ — version ${version}, ${precache.length} precached files (${(bytes / 1024).toFixed(0)} KiB).`);
