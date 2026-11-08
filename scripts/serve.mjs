// Zero-dependency static server for local development and previewing builds.
//   npm run dev               -> serves site/ (no service worker, no caching)
//   npm run preview           -> builds and serves dist/ (like production)
//   node scripts/serve.mjs dist --port 8080 --host 0.0.0.0
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const option = (name, fallback) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 && args[i + 1] ? args[i + 1] : fallback;
};
const dirArg = args.find((a, i) => !a.startsWith('--') && !args[i - 1]?.startsWith('--')) || 'site';
const base = path.resolve(root, dirArg);
const port = Number(option('port', process.env.PORT || 5173));
const host = option('host', '127.0.0.1');

const TYPES = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8', '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.ico': 'image/x-icon', '.txt': 'text/plain; charset=utf-8', '': 'text/plain; charset=utf-8',
};

const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url, 'http://localhost');
    let file = path.normalize(path.join(base, decodeURIComponent(url.pathname)));
    if (!file.startsWith(base)) { res.writeHead(403).end('Forbidden'); return; }
    let info = await stat(file).catch(() => null);
    if (info?.isDirectory()) { file = path.join(file, 'index.html'); info = await stat(file).catch(() => null); }
    if (!info) { file = path.join(base, 'index.html'); }
    const body = await readFile(file);
    res.writeHead(info ? 200 : 404, {
      'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream',
      'Cache-Control': 'no-cache',
      'X-Content-Type-Options': 'nosniff',
    });
    res.end(body);
  } catch (error) {
    res.writeHead(500).end(String(error));
  }
});
server.listen(port, host, () => console.log(`Night City // RED: http://${host === '0.0.0.0' ? 'localhost' : host}:${port}/  (serving ${path.relative(root, base) || '.'}/)`));
