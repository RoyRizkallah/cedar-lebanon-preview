// Serves the built workspace from dist/. Every unknown path falls back to the app.
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { resolve, extname, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(fileURLToPath(new URL('../dist/', import.meta.url)));
const port = Number(process.argv[2] || process.env.PORT || 4173);
const mime = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.woff2': 'font/woff2', '.txt': 'text/plain; charset=utf-8' };

createServer(async (request, response) => {
  if (request.method !== 'GET' && request.method !== 'HEAD') { response.writeHead(405); return response.end(); }
  let pathname;
  try { pathname = decodeURIComponent(new URL(request.url, 'http://localhost').pathname); } catch { response.writeHead(400); return response.end(); }
  const target = resolve(root, '.' + (pathname === '/' ? '/index.html' : pathname));
  if (!(target === root || target.startsWith(root + sep))) { response.writeHead(403); return response.end(); }
  let file = target;
  try { if (!(await stat(file)).isFile()) throw new Error('Not a file'); } catch { file = resolve(root, 'index.html'); }
  try {
    const bytes = await readFile(file);
    response.writeHead(200, { 'content-type': mime[extname(file)] || 'application/octet-stream', 'x-content-type-options': 'nosniff', 'referrer-policy': 'strict-origin-when-cross-origin' });
    response.end(request.method === 'HEAD' ? undefined : bytes);
  } catch { response.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' }); response.end('Not found. Run npm run build first.'); }
}).listen(port, '127.0.0.1', () => console.log('Cedar Rehab: http://localhost:' + port));
