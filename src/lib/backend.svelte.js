// The local server, when there is one. Without it (the static preview) the app keeps working in the browser alone.
import { db, session, replaceState, storage } from './store.svelte.js';
import { say } from './ui.svelte.js';
import { homePage } from './people.js';

export const backend = $state({ on: false, checked: false, user: null, version: 0 });

const json = (path, body) => fetch(path, body === undefined ? { credentials: 'same-origin' } : { method: 'POST', credentials: 'same-origin', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
let events = null;

async function load() {
  const response = await fetch('/api/state', { credentials: 'same-origin' });
  if (response.status === 401) { signedOut(); return; }
  const { version, state } = await response.json();
  replaceState(state);
  backend.version = version;
}

function listen() {
  events?.close();
  events = new EventSource('/api/events');
  // Someone else changed something: fetch this person's fresh view.
  events.addEventListener('version', event => { if (Number(event.data) > backend.version && !queue.busy) load(); });
}

function signedIn(staffId) {
  backend.user = staffId;
  session.staffId = staffId;
}
function signedOut() {
  backend.user = null;
  events?.close();
  events = null;
  replaceState({});
}

export async function startBackend() {
  try {
    const response = await fetch('/api/me', { credentials: 'same-origin' });
    if (response.status === 404 || !response.headers.get('content-type')?.includes('application/json')) { backend.checked = true; return; }
    backend.on = true;
    // Real data never goes into this browser's storage.
    storage.off = true;
    if (response.ok) { signedIn((await response.json()).staffId); await load(); listen(); }
  } catch { /* no server: the preview */ }
  backend.checked = true;
}

export async function signIn(staffId, password) {
  const response = await json('/api/login', { staffId, password });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.error || 'Could not sign in.');
  signedIn(body.staffId);
  await load();
  listen();
  location.hash = `#/${homePage(body.staffId)}`;
}

export async function signOut() {
  await json('/api/logout', {}).catch(() => {});
  signedOut();
}

// Changes go to the server one at a time, in the order they were made here.
const queue = { busy: 0, tail: Promise.resolve() };
export function push(name, args) {
  queue.busy++;
  queue.tail = queue.tail.then(async () => {
    try {
      const response = await json('/api/act', { name, args });
      const body = await response.json().catch(() => ({}));
      if (response.status === 401) { signedOut(); say('Signed out. Sign in again to carry on.'); return; }
      if (!response.ok) { say(body.error || 'The server did not accept that change.'); await load(); return; }
      backend.version = body.version;
      if (queue.busy === 1) replaceState(body.state);
    } catch {
      say('The server could not be reached. Your last change was not saved.');
      await load().catch(() => {});
    } finally {
      queue.busy--;
    }
  });
  return queue.tail;
}

export const filesUrl = id => `/api/files/${encodeURIComponent(id)}`;
void db;
