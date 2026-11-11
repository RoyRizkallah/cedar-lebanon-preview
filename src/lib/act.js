// The one way the screens change data: a named command, run as the person using the app.
// In the preview it runs here and is saved in this browser; with the local server it also goes to the server (backend.svelte.js).
import { commit, session } from './store.svelte.js';
import { applyCommand } from './commands.js';
import { backend, push } from './backend.svelte.js';

// The change runs here first, so the screen answers at once and a rule's error shows straight away;
// with the server on, the server then runs it for real and sends back this person's view.
export function act(name, ...args) {
  const result = commit(state => applyCommand(state, name, args, session.staffId, backend.on ? new Date() : session.now));
  if (backend.on) push(name, JSON.parse(JSON.stringify(args)));
  return result;
}
