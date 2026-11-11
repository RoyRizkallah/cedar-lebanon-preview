// The one way the screens change data: a named command, run as the person using the app.
// Preview: it runs here and is saved in this browser.
// Local server: the server runs it and answers at once (a local round trip of a few milliseconds); the screen then
// shows the server's own view, the server's record numbers, and the server's reason when it refuses.
import { commit, session } from './store.svelte.js';
import { applyCommand } from './commands.js';
import { backend, sendNow } from './backend.svelte.js';

export function act(name, ...args) {
  if (backend.on) return sendNow(name, JSON.parse(JSON.stringify(args)));
  return commit(state => applyCommand(state, name, args, session.staffId, session.now));
}
