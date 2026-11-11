// The walkthrough (a WhatsApp lead becomes an admitted patient) against the local server: every step as that person,
// through sign-in, the server's permission checks and each person's own view.
// node scripts/walk-server.mjs   (run npm run build first; uses a scratch data folder and port)
import { spawn, spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { openStore, initialState } from '../server/store.mjs';
import { STAFF, RESIDENTS } from '../src/lib/people.js';

const password = 'walkthrough password';
const dir = mkdtempSync(join(tmpdir(), 'cedar-walk-server-'));
{ const store = openStore(dir); store.saveState(initialState({ demo: true })); for (const person of [...STAFF, ...RESIDENTS]) store.setPassword(person.id, password); store.close(); }
const port = 4600 + Math.floor(Math.random() * 300);
const server = spawn(process.execPath, ['--no-warnings', fileURLToPath(new URL('../server/index.mjs', import.meta.url)), String(port)], { env: { ...process.env, CEDAR_DATA: dir }, stdio: ['ignore', 'pipe', 'inherit'] });
await new Promise(resolve => server.stdout.on('data', chunk => { if (String(chunk).includes('backend on')) resolve(); }));
const walk = spawnSync(process.execPath, [fileURLToPath(new URL('./walkthrough.mjs', import.meta.url)), `http://localhost:${port}`], { env: { ...process.env, CEDAR_PASSWORD: password }, stdio: 'inherit' });
server.kill();
await new Promise(resolve => setTimeout(resolve, 500));
rmSync(dir, { recursive: true, force: true });
process.exitCode = walk.status ?? 1;
