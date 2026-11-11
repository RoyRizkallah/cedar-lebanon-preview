// Every person, every page they can open, against the local server: no page may fail or come up empty.
// node scripts/roles-server.mjs   (run npm run build first; uses a scratch data folder and port)
import { spawn } from 'node:child_process';
import { existsSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { openStore, initialState } from '../server/store.mjs';
import { STAFF, RESIDENTS, pagesFor, tabsFor, visiblePatients } from '../src/lib/people.js';

const PASSWORD = 'roles check password';
// Screens inside a page that only some people have.
const EXTRA = { georgio: ['requests/cash'], omar: ['requests/cash'], melyssa: ['requests/cash'], kteish: ['finance/cash'], rabih: ['finance/cash'], amer: ['finance/cash'] };
const dir = mkdtempSync(join(tmpdir(), 'cedar-roles-'));
const state = initialState({ demo: true });
{ const store = openStore(dir); store.saveState(state); for (const person of [...STAFF, ...RESIDENTS]) store.setPassword(person.id, PASSWORD); store.close(); }
const port = 4600 + Math.floor(Math.random() * 300);
const base = `http://localhost:${port}`;
const server = spawn(process.execPath, ['--no-warnings', fileURLToPath(new URL('../server/index.mjs', import.meta.url)), String(port)], { env: { ...process.env, CEDAR_DATA: dir }, stdio: ['ignore', 'pipe', 'inherit'] });
await new Promise(resolve => server.stdout.on('data', chunk => { if (String(chunk).includes('backend on')) resolve(); }));

const chrome = ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find(existsSync);
const profile = mkdtempSync(join(tmpdir(), 'cedar-roles-chrome-'));
const debugPort = 9445;
const browser = spawn(chrome, ['--headless=new', '--disable-gpu', `--remote-debugging-port=${debugPort}`, `--user-data-dir=${profile}`, '--window-size=1440,1000', 'about:blank'], { stdio: 'ignore' });
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
let socket, seq = 0;
const pending = new Map();
let errors = [];
const send = (method, params = {}) => new Promise((resolve, reject) => { const id = ++seq; pending.set(id, { resolve, reject }); socket.send(JSON.stringify({ id, method, params })); });
async function run(expression) {
  const { result, exceptionDetails } = await send('Runtime.evaluate', { expression: `(async () => { ${expression} })()`, awaitPromise: true, returnByValue: true });
  if (exceptionDetails) throw new Error(exceptionDetails.exception?.description || exceptionDetails.text);
  return result.value;
}
const go = async hash => { await send('Page.navigate', { url: `${base}/#/${hash}` }); await sleep(900); };
const failures = [];
async function visit(who, hash) {
  errors = [];
  await go(hash);
  const page = await run(`const main = document.querySelector('main, .content'); return { text: (main?.innerText || '').trim().slice(0, 80), signIn: document.body.innerText.includes('Sign in') && !!document.querySelector('input[type=password]') };`);
  const problem = errors[0] || (page.signIn ? 'signed out' : !page.text ? 'empty page' : '');
  if (problem) failures.push(`${who} #/${hash}: ${problem.split('\n')[0].slice(0, 160)}`);
  return !problem;
}

try {
  for (let i = 0; i < 50 && !socket; i++) {
    try { const page = (await (await fetch(`http://127.0.0.1:${debugPort}/json`)).json()).find(t => t.type === 'page'); if (page) socket = new WebSocket(page.webSocketDebuggerUrl); } catch { await sleep(200); }
  }
  await new Promise(resolve => socket.addEventListener('open', resolve));
  socket.addEventListener('message', event => {
    const data = JSON.parse(event.data);
    if (data.id && pending.has(data.id)) { const { resolve, reject } = pending.get(data.id); pending.delete(data.id); data.error ? reject(new Error(data.error.message)) : resolve(data.result); }
    if (data.method === 'Runtime.exceptionThrown') errors.push(data.params.exceptionDetails.exception?.description || data.params.exceptionDetails.text);
    // An error the app only logs counts too.
    if (data.method === 'Runtime.consoleAPICalled' && data.params.type === 'error') errors.push(data.params.args.map(arg => arg.value ?? arg.description ?? '').join(' '));
  });
  await send('Runtime.enable');
  await send('Page.enable');
  await send('Page.navigate', { url: base });
  await sleep(800);

  for (const person of [...STAFF, ...RESIDENTS]) {
    // Sign in through the API from the page, so the browser holds that person's session cookie.
    const ok = await run(`const r = await fetch('/api/login', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ staffId: ${JSON.stringify(person.id)}, password: ${JSON.stringify(PASSWORD)} }) }); return r.ok;`);
    if (!ok) { failures.push(`${person.id}: could not sign in`); continue; }
    await send('Page.reload');
    await sleep(1200);
    const pages = pagesFor(person.id).map(page => page.id);
    let count = 0;
    for (const page of pages) { await visit(person.id, page); count++; }
    for (const extra of EXTRA[person.id] || []) { await visit(person.id, extra); count++; }
    // The patient file, every tab this person has, on the first patient they look after.
    const patient = pages.includes('patients') ? visiblePatients(state, person.id)[0] : null;
    if (patient) for (const tab of tabsFor(person.id)) { await visit(person.id, `patients/${patient.id}/${tab.id}`); count++; }
    console.log(`  ${person.id.padEnd(15)} ${count} screens`);
    await run(`await fetch('/api/logout', { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' }); return true;`);
  }
  if (failures.length) { console.log(`\n${failures.length} problems:\n${failures.join('\n')}`); process.exitCode = 1; }
  else console.log('Every role, every page: no errors.');
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
} finally {
  socket?.close();
  browser.kill();
  server.kill();
  await sleep(500);
  rmSync(dir, { recursive: true, force: true });
  try { rmSync(profile, { recursive: true, force: true }); } catch { /* Chrome may still hold it */ }
}
