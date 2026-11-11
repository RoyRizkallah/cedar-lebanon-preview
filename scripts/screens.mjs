// Screenshot pages with headless Chrome: node scripts/screens.mjs [baseUrl] [outDir] [route,...]
// Each route is "staffId:hash[:width]"; the person is chosen with ?as= (the preview). Widths under 600 are
// emulated as a phone (touch, device pixel ratio 2); the page is given time to finish loading before the picture.
import { spawn } from 'node:child_process';
import { mkdirSync, existsSync, writeFileSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const [base = 'http://localhost:4173', out = 'artifacts/screens', list = ''] = process.argv.slice(2);
const chrome = ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find(existsSync);
if (!chrome) throw new Error('Chrome or Edge is needed for screenshots.');
mkdirSync(out, { recursive: true });
const profile = mkdtempSync(join(tmpdir(), 'cedar-screens-'));
const port = 9300 + Math.floor(Math.random() * 300);
const browser = spawn(chrome, ['--headless=new', '--disable-gpu', '--hide-scrollbars', '--force-prefers-reduced-motion', `--remote-debugging-port=${port}`, `--user-data-dir=${profile}`, 'about:blank'], { stdio: 'ignore' });
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
let socket, seq = 0;
const pending = new Map();
const send = (method, params = {}) => new Promise((resolve, reject) => { const id = ++seq; pending.set(id, { resolve, reject }); socket.send(JSON.stringify({ id, method, params })); });

try {
  for (let i = 0; i < 50 && !socket; i++) {
    try { const page = (await (await fetch(`http://127.0.0.1:${port}/json`)).json()).find(t => t.type === 'page'); if (page) socket = new WebSocket(page.webSocketDebuggerUrl); } catch { await sleep(200); }
  }
  await new Promise(resolve => socket.addEventListener('open', resolve));
  socket.addEventListener('message', event => { const data = JSON.parse(event.data); if (data.id && pending.has(data.id)) { const { resolve, reject } = pending.get(data.id); pending.delete(data.id); data.error ? reject(new Error(data.error.message)) : resolve(data.result); } });
  await send('Page.enable');
  await send('Runtime.enable');
  for (const spec of list.split(',').filter(Boolean)) {
    const [staff, hash = '', width = '1440'] = spec.split(':');
    const phone = Number(width) < 600;
    await send('Emulation.setDeviceMetricsOverride', { width: Number(width), height: phone ? 844 : 900, deviceScaleFactor: phone ? 2 : 1, mobile: phone });
    await send('Page.navigate', { url: `${base}/?as=${staff}#/${hash}` });
    await sleep(1500);
    const { result } = await send('Runtime.evaluate', { expression: 'document.documentElement.scrollWidth', returnByValue: true });
    const { data } = await send('Page.captureScreenshot', { format: 'png' });
    const name = `${staff}-${hash.replace(/[^\w-]+/g, '_') || 'home'}-${width}.png`;
    writeFileSync(join(out, name), Buffer.from(data, 'base64'));
    // A page wider than the screen scrolls sideways on a phone: say so.
    console.log(`saved ${name}${result.value > Number(width) ? `  (warning: page is ${result.value}px wide)` : ''}`);
  }
} finally {
  socket?.close();
  browser.kill();
  await sleep(300);
  try { rmSync(profile, { recursive: true, force: true }); } catch { /* Chrome may still hold it */ }
}
