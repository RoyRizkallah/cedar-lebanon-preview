// The one way the screens change data: a named command, run as the person using the app.
// In the preview it runs here and is saved in this browser; with the local server it also goes to the server (backend.svelte.js).
import { commit, session } from './store.svelte.js';
import { applyCommand } from './commands.js';

export function act(name, ...args) {
  return commit(state => applyCommand(state, name, args, session.staffId, session.now));
}
