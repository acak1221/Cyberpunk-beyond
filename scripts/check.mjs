// Syntax-checks every browser script and verifies index.html references existing files.
import { readFile, readdir, access } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const site = path.join(root, 'site');
let failed = false;

for (const name of (await readdir(site)).filter(n => n.endsWith('.js'))) {
  const result = spawnSync(process.execPath, ['--check', path.join(site, name)], { encoding: 'utf8' });
  if (result.status !== 0) { failed = true; console.error(`✗ ${name}\n${result.stderr}`); }
}

const index = await readFile(path.join(site, 'index.html'), 'utf8');
for (const [, ref] of index.matchAll(/(?:src|href)="([^"#?:]+)"/g)) {
  try { await access(path.join(site, ref)); } catch { failed = true; console.error(`✗ index.html references missing file: ${ref}`); }
}
const scripts = [...index.matchAll(/<script src="([^"]+)"/g)].map(m => m[1]);
if (scripts.at(-1) !== 'app.js') { failed = true; console.error('✗ app.js must be the last script in index.html'); }

if (failed) process.exit(1);
console.log(`✓ ${scripts.length} scripts parsed, index.html references are valid`);
