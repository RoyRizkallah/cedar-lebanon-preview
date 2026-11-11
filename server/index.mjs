// Serves the built workspace from dist/. Every unknown path falls back to the app.
// With an initialised data folder (node server/admin.mjs init), /api/* is the local backend; without one, the app stays a preview.
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { resolve, extname, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(fileURLToPath(new URL('../dist/', import.meta.url)));
const port = Number(process.argv[2] || process.env.PORT || 4173);
const dataDir = process.env.CEDAR_DATA || fileURLToPath(new URL('../data/', import.meta.url));
const mime = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.woff2': 'font/woff2', '.txt': 'text/plain; charset=utf-8' };

// The database module is loaded only when there is a database to open.
let api = null;
try {
  const { existsSync } = await import('node:fs');
  if (existsSync(resolve(dataDir, 'cedar.db'))) api = (await import('./api.mjs')).createApi(dataDir);
} catch (error) {
  console.error('The local backend could not start:', error.message);
}

createServer(async (request, response) => {
  let pathname;
  try { pathname = decodeURIComponent(new URL(request.url, 'http://localhost').pathname); } catch { response.writeHead(400); return response.end(); }
  if (pathname.startsWith('/api/')) {
    if (api) return api.route(request, response, pathname);
    response.writeHead(404, { 'content-type': 'application/json; charset=utf-8' });
    return response.end('{"error":"No local backend."}');
  }
  if (request.method !== 'GET' && request.method !== 'HEAD') { response.writeHead(405); return response.end(); }
  const target = resolve(root, '.' + (pathname === '/' ? '/index.html' : pathname));
  if (!(target === root || target.startsWith(root + sep))) { response.writeHead(403); return response.end(); }
  let file = target;
  try { if (!(await stat(file)).isFile()) throw new Error('Not a file'); } catch { file = resolve(root, 'index.html'); }
  try {
    const bytes = await readFile(file);
    response.writeHead(200, { 'content-type': mime[extname(file)] || 'application/octet-stream', 'x-content-type-options': 'nosniff', 'referrer-policy': 'strict-origin-when-cross-origin' });
    response.end(request.method === 'HEAD' ? undefined : bytes);
  } catch { response.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' }); response.end('Not found. Run npm run build first.'); }
}).listen(port, '127.0.0.1', () => console.log(`Cedar Rehab: http://localhost:${port}${api ? ' (local backend on)' : ''}`));
