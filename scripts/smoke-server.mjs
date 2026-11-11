// The app against the local server, in headless Chrome: sign in, change something, reload, sign out.
// node scripts/smoke-server.mjs   (run npm run build first; uses a scratch data folder and port)
import { spawn } from 'node:child_process';
import { existsSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { openStore, initialState } from '../server/store.mjs';

const PASSWORD = 'smoke test password';
const dir = mkdtempSync(join(tmpdir(), 'cedar-smoke-'));
{ const store = openStore(dir); store.saveState(initialState({ demo: true })); store.setPassword('melyssa', PASSWORD); store.close(); }
const port = 4600 + Math.floor(Math.random() * 300);
const base = `http://localhost:${port}`;
const server = spawn(process.execPath, ['--no-warnings', fileURLToPath(new URL('../server/index.mjs', import.meta.url)), String(port)], { env: { ...process.env, CEDAR_DATA: dir }, stdio: ['ignore', 'pipe', 'inherit'] });
await new Promise(resolve => server.stdout.on('data', chunk => { if (String(chunk).includes('backend on')) resolve(); }));

const chrome = ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find(existsSync);
const profile = mkdtempSync(join(tmpdir(), 'cedar-smoke-chrome-'));
const debugPort = 9444;
const browser = spawn(chrome, ['--headless=new', '--disable-gpu', `--remote-debugging-port=${debugPort}`, `--user-data-dir=${profile}`, '--window-size=1440,1000', 'about:blank'], { stdio: 'ignore' });
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
let socket, seq = 0;
const pending = new Map();
const send = (method, params = {}) => new Promise((resolve, reject) => { const id = ++seq; pending.set(id, { resolve, reject }); socket.send(JSON.stringify({ id, method, params })); });
async function run(expression) {
  const { result, exceptionDetails } = await send('Runtime.evaluate', { expression: `(async () => { ${expression} })()`, awaitPromise: true, returnByValue: true });
  if (exceptionDetails) throw new Error(exceptionDetails.exception?.description || exceptionDetails.text);
  return result.value;
}
const go = async path => { await send('Page.navigate', { url: base + path }); await sleep(1200); };
const bodyHas = text => run(`return document.body.innerText.includes(${JSON.stringify(text)});`);
const click = text => run(`const el = [...document.querySelectorAll('button, a')].find(node => node.textContent.trim().includes(${JSON.stringify(text)}) && node.getClientRects().length); if (!el) throw new Error('No button: ${text}'); el.click(); await new Promise(r => setTimeout(r, 600)); return true;`);
async function signIn(staffId, password) {
  await run(`const select = document.querySelector('select[name=staff]'); select.value = ${JSON.stringify(staffId)}; select.dispatchEvent(new Event('change', { bubbles: true }));
    const input = document.querySelector('input[type=password]'); input.value = ${JSON.stringify(password)}; input.dispatchEvent(new Event('input', { bubbles: true })); return true;`);
  await click('Sign in');
  await sleep(800);
}
function check(condition, message) { if (!condition) throw new Error(`Check failed: ${message}`); console.log(`  ok  ${message}`); }

try {
  for (let i = 0; i < 50 && !socket; i++) {
    try { const page = (await (await fetch(`http://127.0.0.1:${debugPort}/json`)).json()).find(t => t.type === 'page'); if (page) socket = new WebSocket(page.webSocketDebuggerUrl); } catch { await sleep(200); }
  }
  await new Promise(resolve => socket.addEventListener('open', resolve));
  socket.addEventListener('message', event => { const data = JSON.parse(event.data); if (data.id && pending.has(data.id)) { const { resolve, reject } = pending.get(data.id); pending.delete(data.id); data.error ? reject(new Error(data.error.message)) : resolve(data.result); } });
  await send('Runtime.enable');
  await send('Page.enable');

  console.log('Sign in');
  await go('/');
  check(await bodyHas('Sign in'), 'the app asks to sign in');
  check(!(await bodyHas('view the workspace as')), 'there is no "view as" switch');
  await signIn('melyssa', 'not her password');
  check(await bodyHas('Wrong name or password.'), 'a wrong password is refused in plain words');
  await signIn('melyssa', PASSWORD);
  check(await bodyHas('Melyssa'), 'Melyssa is signed in');

  console.log('A change is saved on the server');
  await go('/#/leads/L-0004');
  await click('Create inquiry');
  await run(`const el = [...document.querySelectorAll('.drawer button')].find(node => node.textContent.trim().includes('Create inquiry')); el.click(); await new Promise(r => setTimeout(r, 1200)); return true;`);
  await go('/#/pipeline');
  check(await bodyHas('Nour Zein'), 'the new inquiry is on the pipeline');
  check(await run(`return localStorage.getItem('cedar-rehab-v1') === null;`), 'nothing is kept in the browser\'s storage');
  await send('Page.reload');
  await sleep(1500);
  check(await bodyHas('Nour Zein'), 'still there after a reload');

  console.log('Sign out');
  await run(`document.querySelector('.profile').click(); await new Promise(r => setTimeout(r, 300)); return true;`);
  await click('Sign out');
  await sleep(600);
  check(await bodyHas('Sign in'), 'signing out returns to sign-in');
  console.log('Server smoke passed.');
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
