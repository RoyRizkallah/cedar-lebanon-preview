// Drives the real app in headless Chrome: a WhatsApp lead becomes an admitted patient.
// node scripts/walkthrough.mjs [baseUrl]   (the server must be running: npm start)
import { spawn } from 'node:child_process';
import { existsSync, mkdtempSync, rmSync, writeFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const base = process.argv[2] || 'http://localhost:4173';
const chrome = ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find(existsSync);
const profile = mkdtempSync(join(tmpdir(), 'cedar-walk-'));
const port = 9333;
const browser = spawn(chrome, ['--headless=new', '--disable-gpu', `--remote-debugging-port=${port}`, `--user-data-dir=${profile}`, '--window-size=1440,1000', 'about:blank'], { stdio: 'ignore' });
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const errors = [];
let socket, seq = 0;
const pending = new Map();

async function connect() {
  for (let i = 0; i < 50; i++) {
    try { const targets = await (await fetch(`http://127.0.0.1:${port}/json`)).json(); const page = targets.find(t => t.type === 'page'); if (page) return page.webSocketDebuggerUrl; } catch { /* starting */ }
    await sleep(200);
  }
  throw new Error('Chrome did not start.');
}
const send = (method, params = {}) => new Promise((resolve, reject) => { const id = ++seq; pending.set(id, { resolve, reject }); socket.send(JSON.stringify({ id, method, params })); });
async function run(expression) {
  const { result, exceptionDetails } = await send('Runtime.evaluate', { expression: `(async () => { ${expression} })()`, awaitPromise: true, returnByValue: true });
  if (exceptionDetails) throw new Error(exceptionDetails.exception?.description || exceptionDetails.text);
  return result.value;
}
async function open(path, as) {
  await send('Page.navigate', { url: `${base}/?as=${as}#/${path}` });
  await sleep(900);
}
// Click the first visible element inside `scope` whose text includes `text`.
const click = (text, scope = 'document', selector = 'button, a, label, [role=button]') => run(`
  const root = ${scope};
  const el = [...root.querySelectorAll('${selector}')].find(node => node.textContent.trim().includes(${JSON.stringify(text)}) && node.getClientRects().length);
  if (!el) throw new Error('No clickable element with text: ${text.replace(/'/g, '')}');
  el.click(); await new Promise(r => setTimeout(r, 350)); return true;`);
const bodyHas = text => run(`return document.body.innerText.includes(${JSON.stringify(text)});`);
const article = name => `[...document.querySelectorAll('article')].find(node => node.innerText.includes(${JSON.stringify(name)}))`;
// SHOTS=<dir> saves screenshots at the key moments.
async function shot(name) {
  if (!process.env.SHOTS) return;
  mkdirSync(process.env.SHOTS, { recursive: true });
  const { data } = await send('Page.captureScreenshot', { format: 'png' });
  writeFileSync(join(process.env.SHOTS, `${name}.png`), Buffer.from(data, 'base64'));
}
function check(condition, message) { if (!condition) throw new Error(`Check failed: ${message}`); console.log(`  ok  ${message}`); }

try {
  socket = new WebSocket(await connect());
  await new Promise(resolve => socket.addEventListener('open', resolve));
  socket.addEventListener('message', event => {
    const data = JSON.parse(event.data);
    if (data.id && pending.has(data.id)) { const { resolve, reject } = pending.get(data.id); pending.delete(data.id); data.error ? reject(new Error(data.error.message)) : resolve(data.result); }
    if (data.method === 'Runtime.exceptionThrown') errors.push(data.params.exceptionDetails.exception?.description || data.params.exceptionDetails.text);
    if (data.method === 'Runtime.consoleAPICalled' && data.params.type === 'error') errors.push(data.params.args.map(arg => arg.value ?? arg.description).join(' '));
  });
  await send('Runtime.enable');
  await send('Page.enable');

  console.log('Lead to inquiry (Melyssa)');
  await open('leads/L-0004', 'melyssa');
  check(await bodyHas('Nour Zein'), 'WhatsApp lead is open');
  await click('Create inquiry');
  await click('Create inquiry', `document.querySelector('.drawer')`);
  check(await bodyHas('Open inquiry'), 'lead now links to its inquiry');

  console.log('Pipeline');
  await open('pipeline', 'melyssa');
  for (const stage of ['Assessment', 'Agreement']) {
    await run(`const card = ${article('Nour Zein')}; const select = card.querySelector('select'); select.value = '${stage}'; select.dispatchEvent(new Event('change', { bubbles: true })); await new Promise(r => setTimeout(r, 350)); return true;`);
  }
  check(await run(`return [...document.querySelectorAll('section.column')].find(c => c.getAttribute('aria-label') === 'Agreement').innerText.includes('Nour Zein');`), 'card moved to Agreement');

  console.log('Admission steps');
  await open('admissions', 'fadia');
  await click('Nursing assessment', article('Nour Zein'));
  await click('Mark nursing assessment done');
  check(await run(`return ${article('Nour Zein')}.innerText.includes('Fadia,');`), 'Fadia completed nursing');

  await open('schedule', 'nabila');
  const moved = await run(`const next = () => document.querySelector('[aria-label="Next week"]');
    for (let i = 0; i < 3; i++) { if ([...document.querySelectorAll('.appt')].some(a => a.innerText.includes('Nour Zein'))) break; next().click(); await new Promise(r => setTimeout(r, 300)); }
    const appt = [...document.querySelectorAll('.appt')].find(a => a.innerText.includes('Nour Zein')); if (!appt) return false; appt.click(); await new Promise(r => setTimeout(r, 300)); return true;`);
  check(moved, 'auto-booked psychologist session is on Nabila’s schedule');
  await click('Mark completed', `document.querySelector('.dialog')`);
  await open('admissions', 'nabila');
  await click('Psychologist session', article('Nour Zein'));
  await click('Mark psychologist step done');

  await open('admissions', 'melyssa');
  await click('Financial arrangement', article('Nour Zein'));
  await run(`const input = document.querySelector('.step-panel input[type=number]'); input.value = '6000'; input.dispatchEvent(new Event('input', { bubbles: true })); return true;`);
  await click('Save financial arrangement');
  await click('Admission agreement signed', article('Nour Zein'));
  await click('Sign on screen');
  await run(`const c = document.querySelector('.dialog canvas'); const r = c.getBoundingClientRect();
    const fire = (type, x, y) => c.dispatchEvent(new PointerEvent(type, { bubbles: true, pointerId: 1, clientX: r.left + x, clientY: r.top + y }));
    fire('pointerdown', 20, 40); for (let x = 30; x < 220; x += 20) fire('pointermove', x, 40 + (x % 40)); fire('pointerup', 220, 60); return true;`);
  await click('Sign', `document.querySelector('.dialog .drawer-foot')`);
  await click('Room assigned', article('Nour Zein'));
  await click('Assign bed');
  check(await run(`return ${article('Nour Zein')}.innerText.includes('5/5');`), 'all five steps done');
  await click('Admit patient', article('Nour Zein'));
  await sleep(600);
  check(await run(`return location.hash.startsWith('#/patients/P-');`), 'admitting opens the new patient file');
  check(await bodyHas('Nour Zein'), 'patient file shows the full name');
  check(!(await run(`return [...document.querySelectorAll('.tab-link')].some(t => t.textContent.trim() === 'Clinical');`)), 'Melyssa has no Clinical tab');
  await click('Wallet & requests');
  check(await bodyHas('$0.00'), 'wallet created at $0.00');
  await click('Documents');
  check(await bodyHas('Admission agreement') && await bodyHas('Signed electronically'), 'signed agreement moved into the patient file');
  await click('Add document');
  await click('Add, then sign or upload');
  await click('Sign', `[...document.querySelectorAll('tr')].find(row => row.innerText.includes('Awaiting signature'))`);
  await run(`const c = document.querySelector('.dialog canvas'); const r = c.getBoundingClientRect();
    const fire = (type, x, y) => c.dispatchEvent(new PointerEvent(type, { bubbles: true, pointerId: 1, clientX: r.left + x, clientY: r.top + y }));
    fire('pointerdown', 20, 40); for (let x = 30; x < 220; x += 20) fire('pointermove', x, 50); fire('pointerup', 220, 50); return true;`);
  await click('Sign', `document.querySelector('.dialog .drawer-foot')`);
  check(!(await bodyHas('Awaiting signature')), 'consent signed on screen');

  console.log('Clinical Director sees the clinical side');
  const patientHash = await run('return location.hash;');
  await open(`patients/${patientHash.split('/')[2]}/clinical`, 'clinical-director');
  check(await bodyHas('Intake Psychological Assessment'), 'clinical forms listed for the new patient');
  check(await bodyHas('Due by'), 'intake shows its 72-hour deadline');

  console.log('Session note from Today (Nabila)');
  await open('today', 'nabila');
  await click('Write note');
  check(await bodyHas('Individual Session Note'), 'session note opens from Today');
  check(await bodyHas('Dictate this note'), 'dictation panel offered on the new note');
  await click('Sign & file');
  check(await bodyHas('Therapist signature is required'), 'filing without a signature is refused');
  await run(`const t = document.querySelector('.assist textarea'); t.value = 'Attended. Talked about evening cravings and his brother. Denies self-harm. Next session we practise urge surfing.'; t.dispatchEvent(new Event('input', { bubbles: true })); return true;`);
  await click('Draft the note');
  await run(`document.querySelector('.form-drawer .drawer-body').scrollTop = 0; return true;`);
  await shot('assist-dictation');
  check(await run(`return [...document.querySelectorAll('.form-row.drafted')].length >= 4;`), 'Cedar Assist drafted the fields and marked them');
  await run(`document.querySelector('.form-drawer .drawer-body').scrollTop = 520; return true;`);
  await shot('assist-drafted-fields');
  check(await run(`const box = [...document.querySelectorAll('.form-drawer .choice')].find(c => c.innerText.includes('Relapse / craving')).querySelector('input'); return box.checked;`), 'craving flagged, self-harm denial not flagged');
  check(await run(`return ![...document.querySelectorAll('.form-drawer .choice')].find(c => c.innerText.trim() === 'Self-harm').querySelector('input').checked;`), 'negated self-harm left unticked');
  await click('Sign', `document.querySelector('.form-drawer .form-section')`);
  await run(`const c = document.querySelector('.dialog canvas'); const r = c.getBoundingClientRect();
    const fire = (type, x, y) => c.dispatchEvent(new PointerEvent(type, { bubbles: true, pointerId: 1, clientX: r.left + x, clientY: r.top + y }));
    fire('pointerdown', 20, 40); for (let x = 30; x < 220; x += 20) fire('pointermove', x, 50); fire('pointerup', 220, 50); return true;`);
  await click('Sign', `document.querySelector('.dialog .drawer-foot')`);
  await click('Sign & file');
  check(!(await bodyHas('Session note:')), 'overdue note cleared from Today');

  console.log('Case review prep (Nabila) and Ahmed’s countersignature');
  await open('patients', 'nabila');
  await click('Weekly case review');
  await click('Prepare', `document.querySelector('.form-drawer .assist')`);
  check(await bodyHas('need depth this week'), 'week prepared with standing flags');
  await shot('assist-case-review');
  check(await run(`return [...document.querySelectorAll('.form-drawer tbody tr')].length >= 8;`), 'review table filled for every patient in care');
  await click('Sign & file');
  await open('today', 'ahmed');
  check(await bodyHas('Sign Case Review Record'), 'Ahmed is asked to sign the filed review');

  console.log('Follow-up instead of assessment (Melyssa)');
  await open('pipeline', 'melyssa');
  await run(`const card = ${article('Georges Abi Nader')}; const select = card.querySelector('select'); select.value = 'Follow-up'; select.dispatchEvent(new Event('change', { bubbles: true })); await new Promise(r => setTimeout(r, 350)); return true;`);
  check(!(await run(`return !!${article('Georges Abi Nader')};`)), 'card leaves the board for follow-up');
  await open('followups', 'melyssa');
  check(await bodyHas('Georges Abi Nader') && await bodyHas('In 2 days'), 'listed in Follow-ups, due in 2 days');
  await click('Schedule assessment', `[...document.querySelectorAll('tr')].find(row => row.innerText.includes('Georges Abi Nader'))`);
  await open('pipeline', 'melyssa');
  check(await run(`return [...document.querySelectorAll('section.column')].find(c => c.getAttribute('aria-label') === 'Assessment').innerText.includes('Georges Abi Nader');`), 'scheduled: back on the board in Assessment');

  console.log('Therapist builds a program and assigns it (Nazha)');
  const type = (selector, value) => run(`const el = document.querySelector(${JSON.stringify(selector)}); el.value = ${JSON.stringify(value)}; el.dispatchEvent(new Event('input', { bubbles: true })); el.dispatchEvent(new Event('change', { bubbles: true })); return true;`);
  await open('programs', 'nazha');
  await click('New program');
  await type('.dialog input.input', 'Walkthrough program');
  await click('Create program', `document.querySelector('.dialog')`);
  check(await bodyHas('Walkthrough program') && (await run('return location.hash;')).startsWith('#/programs/PRG-'), 'program created and opened');
  await click('Add', `[...document.querySelectorAll('.day')].find(day => day.innerText.startsWith('Monday'))`);
  await type('.dialog input.input', 'Mask work');
  await click('Save', `document.querySelector('.dialog')`);
  check(await run(`return [...document.querySelectorAll('.day')].find(day => day.innerText.startsWith('Monday')).innerText.includes('Mask work');`), 'session added to Monday');
  const patientName = await run(`const select = document.querySelector('.assign select'); const option = [...select.options].find(o => o.value && !o.textContent.includes('another program')); select.value = option.value; select.dispatchEvent(new Event('change', { bubbles: true })); return option.textContent;`);
  await click('Assign', `document.querySelector('.assign')`);
  check(await run(`return document.querySelector('.people').innerText.includes(${JSON.stringify(patientName)});`), `${patientName} is on the program`);

  console.log('Lead reply and booking (Melyssa)');
  await open('leads/L-0005', 'melyssa');
  await run(`const t = document.querySelector('#reply'); t.value = 'Yes, we welcome people from abroad.'; t.dispatchEvent(new Event('input', { bubbles: true })); return true;`);
  await click('Send');
  check(await bodyHas('Queued on Instagram'), 'reply queued on the lead’s channel');
  await open('schedule', 'melyssa');
  await click('Book earliest');
  check(!(await run(`return [...document.querySelectorAll('.dialog select option')].some(o => o.textContent === 'Psychologist session');`)), 'Melyssa cannot book psychologist sessions');
  await click('Book ', `document.querySelector('.dialog .drawer-foot')`);
  check(!(await run(`return !!document.querySelector('.dialog');`)), 'earliest slot booked');

  console.log('Petty-cash purchase with invoice photo (Georgio)');
  await open('requests', 'georgio');
  await click('Bought', `[...document.querySelectorAll('.list > li')].find(li => li.innerText.includes('Phone charger'))`);
  await run(`const i = document.querySelector('.buy input.input'); i.value = '15'; i.dispatchEvent(new Event('input', { bubbles: true })); return true;`);
  const { root } = await send('DOM.getDocument');
  const { nodeId } = await send('DOM.querySelector', { nodeId: root.nodeId, selector: '.buy input[type=file]' });
  await send('DOM.setFileInputFiles', { nodeId, files: [join(process.cwd(), 'public', 'logo-mark.png')] });
  await sleep(200);
  await click('Save purchase');
  await sleep(500);
  check(!(await bodyHas('Phone charger')), 'request closed and charged to the wallet');

  check(errors.length === 0, `no page errors${errors.length ? `: ${errors.join(' | ')}` : ''}`);
  console.log('Walkthrough passed.');
} catch (error) {
  console.error(error.message);
  if (errors.length) console.error('Page errors:', errors);
  process.exitCode = 1;
} finally {
  socket?.close();
  browser.kill();
  await sleep(300);
  try { rmSync(profile, { recursive: true, force: true }); } catch { /* Chrome may still hold files */ }
}
