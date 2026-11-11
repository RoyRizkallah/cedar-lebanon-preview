// Run on this machine only.
//   node server/admin.mjs init [--demo] [--force]   create the database (--demo loads the sample data)
//   node server/admin.mjs passwd <staffId>           set a password, typed or piped on standard input
//   node server/admin.mjs disable <staffId>          close an account and its sessions
//   node server/admin.mjs users                      list accounts (never passwords)
// The data folder is CEDAR_DATA, or ./data next to the app.
import { createInterface } from 'node:readline';
import { fileURLToPath } from 'node:url';
import { openStore, initialState } from './store.mjs';

const dir = process.env.CEDAR_DATA || fileURLToPath(new URL('../data/', import.meta.url));
const [command, target] = process.argv.slice(2);
const flag = name => process.argv.includes(name);
const store = openStore(dir);

async function readPassword() {
  if (process.stdin.isTTY) process.stdout.write('Password (at least 10 characters): ');
  const lines = createInterface({ input: process.stdin });
  for await (const line of lines) { lines.close(); return line; }
  return '';
}

try {
  if (command === 'init') {
    if (store.getState() && !flag('--force')) throw new Error(`${dir} already has data. Add --force to start again.`);
    store.saveState(initialState({ demo: flag('--demo') }));
    console.log(`Initialised ${dir}${flag('--demo') ? ' with sample data' : ' for real use (no patient data)'}.`);
  } else if (command === 'passwd' && target) {
    store.setPassword(target, await readPassword());
    console.log(`Password set for ${target}.`);
  } else if (command === 'disable' && target) {
    store.disable(target);
    console.log(`${target} can no longer sign in.`);
  } else if (command === 'users') {
    for (const row of store.users()) console.log(`${row.staff_id}${row.disabled ? ' (disabled)' : ''}, set ${row.updated_at}`);
  } else {
    console.log('Usage: init [--demo] [--force] | passwd <staffId> | disable <staffId> | users');
    process.exitCode = 1;
  }
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
} finally {
  store.close();
}
