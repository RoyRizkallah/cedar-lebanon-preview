// Screenshot pages with headless Chrome: node scripts/screens.mjs [baseUrl] [outDir] [route,...]
// Each route is "staffId:hash[:width]"; the staff choice is passed through localStorage via ?as=.
import { spawnSync } from 'node:child_process';
import { mkdirSync, existsSync, writeFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';

const [base = 'http://localhost:4173', out = 'artifacts/rebuild-20261102', list = ''] = process.argv.slice(2);
const chrome = ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find(existsSync);
if (!chrome) throw new Error('Chrome or Edge is needed for screenshots.');
mkdirSync(out, { recursive: true });
const profile = resolve(out, '.chrome-profile');

for (const spec of list.split(',').filter(Boolean)) {
  const [staff, hash, width = '1440', mode = 'light'] = spec.split(':');
  const height = Number(width) < 600 ? 844 : 900;
  const name = `${staff}-${hash.replace(/[^\w-]+/g, '_') || 'home'}-${width}${mode === 'dark' ? '-dark' : ''}.png`;
  let url = `${base}/?as=${staff}&theme=${mode}#/${hash}`;
  // Chrome will not open a window narrower than ~500px, so phone sizes render inside an exact-size frame.
  if (Number(width) < 600) {
    const frame = resolve(out, '.frame.html');
    writeFileSync(frame, `<!doctype html><body style="margin:0"><iframe src="${url}" style="border:0;width:${width}px;height:${height}px;display:block"></iframe></body>`);
    url = pathToFileURL(frame).href;
  }
  const result = spawnSync(chrome, ['--headless=new', '--disable-gpu', '--force-prefers-reduced-motion', '--hide-scrollbars', `--user-data-dir=${profile}`, `--window-size=${Math.max(Number(width), 520)},${height}`, '--virtual-time-budget=4000', `--screenshot=${resolve(out, name)}`, url], { encoding: 'utf8' });
  console.log(result.status === 0 ? `saved ${name}` : `failed ${name}: ${result.stderr.slice(0, 200)}`);
}
