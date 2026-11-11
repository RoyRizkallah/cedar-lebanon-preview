// The local API. Every change runs here, through the same rules the screens use, as the signed-in person
// and on the server's clock; each person receives only their own view of the workspace.
import { randomBytes } from 'node:crypto';
import { mkdirSync, writeFileSync, readFileSync, readdirSync, rmSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { openStore } from './store.mjs';
import { applyCommand, SYSTEM } from '../src/lib/commands.js';
import { viewFor } from '../src/lib/view.js';
import { runInquiryAging, runFollowUpAlerts } from '../src/lib/pipeline.js';
import { runLeaveAlerts } from '../src/lib/safety.js';
import { todayISO } from '../src/lib/dates.js';

const MAX_JSON = 2 * 1024 * 1024;
const MAX_FILE = 15 * 1024 * 1024;
const LOCK_AFTER = 5;
const LOCK_MINUTES = 15;
const KEEP_BACKUPS = 30;

class HttpError extends Error { constructor(status, message) { super(message); this.status = status; } }

export function createApi(dir) {
  const store = openStore(dir);
  if (!store.getState()) { store.close(); return null; } // not initialised: the app stays a preview
  let { version, state } = store.getState();
  const files = join(dir, 'files');
  const backups = join(dir, 'backups');
  mkdirSync(files, { recursive: true });
  mkdirSync(backups, { recursive: true });
  const listeners = new Set();
  const failures = new Map();

  function save() {
    version = store.saveState(state);
    // The first save of each day leaves a copy of the database; the newest 30 are kept.
    const today = join(backups, `cedar-${todayISO()}.db`);
    if (!existsSync(today)) {
      store.backup(today);
      for (const old of readdirSync(backups).filter(name => /^cedar-\d{4}-\d{2}-\d{2}\.db$/.test(name)).sort().slice(0, -KEEP_BACKUPS)) rmSync(join(backups, old));
    }
    for (const response of listeners) response.write(`event: version\ndata: ${version}\n\n`);
  }

  // Follow-up alerts, inquiry ageing and late returns run on the server's clock.
  function runJobs(now = new Date()) {
    const before = JSON.stringify(state);
    runInquiryAging(state, now);
    runFollowUpAlerts(state, now);
    runLeaveAlerts(state, now);
    if (JSON.stringify(state) !== before) save();
  }
  const timer = setInterval(runJobs, 60 * 1000);
  timer.unref();

  const cookieToken = request => (request.headers.cookie || '').split(';').map(part => part.trim().split('=')).find(([key]) => key === 'cedar_session')?.[1] || '';
  const userOf = request => store.sessionUser(cookieToken(request));
  const send = (response, status, body, headers = {}) => {
    response.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', 'x-content-type-options': 'nosniff', ...headers });
    response.end(JSON.stringify(body));
  };
  const cookie = (token, maxAge) => `cedar_session=${token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${maxAge}`;

  function readBody(request, limit) {
    return new Promise((resolve, reject) => {
      // Past the limit the rest is read and dropped, so the sender gets a clear answer rather than a cut connection.
      const chunks = []; let size = 0;
      request.on('data', chunk => {
        size += chunk.length;
        if (size <= limit) chunks.push(chunk);
      });
      request.on('end', () => (size > limit ? reject(new HttpError(413, `Files can be up to ${Math.round(limit / 1024 / 1024)} MB.`)) : resolve(Buffer.concat(chunks))));
      request.on('error', reject);
    });
  }
  async function readJson(request) {
    if (!String(request.headers['content-type'] || '').startsWith('application/json')) throw new HttpError(415, 'Send JSON.');
    try { return JSON.parse(String(await readBody(request, MAX_JSON)) || '{}'); } catch (error) { if (error.status) throw error; throw new HttpError(400, 'Unreadable request.'); }
  }
  function locked(staffId) {
    const since = Date.now() - LOCK_MINUTES * 60 * 1000;
    const recent = (failures.get(staffId) || []).filter(at => at > since);
    failures.set(staffId, recent);
    return recent.length >= LOCK_AFTER;
  }

  async function handle(request, response, path) {
    // A change can only come from a page this server served.
    if (request.method === 'POST' && request.headers.origin) {
      let host = '';
      try { host = new URL(request.headers.origin).host; } catch { /* treated as foreign */ }
      if (host !== request.headers.host) throw new HttpError(403, 'Not allowed from another site.');
    }

    if (path === '/api/login' && request.method === 'POST') {
      const { staffId, password } = await readJson(request);
      const id = String(staffId || '');
      if (locked(id)) throw new HttpError(429, `Too many wrong passwords. Try again in ${LOCK_MINUTES} minutes.`);
      if (!store.checkPassword(id, password)) { failures.get(id).push(Date.now()); throw new HttpError(401, 'Wrong name or password.'); }
      failures.delete(id);
      return send(response, 200, { staffId: id }, { 'set-cookie': cookie(store.createSession(id), 12 * 3600) });
    }

    const me = userOf(request);
    if (!me) throw new HttpError(401, 'Sign in again.');

    if (path === '/api/logout' && request.method === 'POST') {
      store.endSession(cookieToken(request));
      return send(response, 200, { ok: true }, { 'set-cookie': cookie('', 0) });
    }
    if (path === '/api/me' && request.method === 'GET') return send(response, 200, { staffId: me });
    if (path === '/api/state' && request.method === 'GET') return send(response, 200, { version, state: viewFor(state, me) });

    if (path === '/api/act' && request.method === 'POST') {
      const { name, args } = await readJson(request);
      if (SYSTEM.has(name)) throw new HttpError(400, 'That runs on its own schedule.');
      // Work on a copy, so a rule that throws halfway leaves nothing behind.
      const next = structuredClone(state);
      let result;
      try {
        result = applyCommand(next, String(name), Array.isArray(args) ? args : [], me, new Date());
      } catch (error) {
        store.audit({ staffId: me, command: String(name), args, ok: false, error: error.message });
        throw new HttpError(400, error.message);
      }
      state = next;
      store.audit({ staffId: me, command: name, args, ok: true });
      save();
      return send(response, 200, { ok: true, result: result === undefined ? null : JSON.parse(JSON.stringify(result)), version, state: viewFor(state, me) });
    }

    if (path === '/api/events' && request.method === 'GET') {
      response.writeHead(200, { 'content-type': 'text/event-stream', 'cache-control': 'no-store', connection: 'keep-alive' });
      response.write(`event: version\ndata: ${version}\n\n`);
      listeners.add(response);
      request.on('close', () => listeners.delete(response));
      return;
    }

    if (path === '/api/files' && request.method === 'POST') {
      if (request.headers['x-cedar-upload'] !== '1') throw new HttpError(415, 'Not an upload.');
      const bytes = await readBody(request, MAX_FILE);
      const id = `file-${randomBytes(12).toString('hex')}`;
      let name = 'file';
      try { name = decodeURIComponent(String(request.headers['x-file-name'] || 'file')).slice(0, 200); } catch { /* keep the default */ }
      writeFileSync(join(files, id), bytes);
      store.addFile({ id, name, type: String(request.headers['content-type'] || 'application/octet-stream'), size: bytes.length, uploadedBy: me });
      return send(response, 200, { id, name });
    }
    const fileMatch = path.match(/^\/api\/files\/(file-[a-f0-9]+)$/);
    if (fileMatch && request.method === 'GET') {
      const meta = store.file(fileMatch[1]);
      // A file is readable only by someone whose view of the workspace refers to it.
      if (!meta || !JSON.stringify(viewFor(state, me)).includes(meta.id)) throw new HttpError(404, 'Not found.');
      response.writeHead(200, { 'content-type': meta.type, 'content-disposition': `inline; filename*=UTF-8''${encodeURIComponent(meta.name)}`, 'cache-control': 'private, no-store', 'x-content-type-options': 'nosniff' });
      return response.end(readFileSync(join(files, meta.id)));
    }
    throw new HttpError(404, 'Not found.');
  }

  return {
    async route(request, response, path) {
      try { await handle(request, response, path); } catch (error) {
        if (!response.headersSent) send(response, error.status || 500, { error: error.status ? error.message : 'Something went wrong on the server.' });
        if (!error.status) console.error(error);
      }
    },
    runJobs,
    close() { clearInterval(timer); for (const response of listeners) response.end(); store.close(); }
  };
}
