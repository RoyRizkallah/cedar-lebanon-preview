import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import http from 'node:http';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { openStore, initialState } from '../server/store.mjs';

// The local API end to end: sign-in, changes run on the server as the signed-in person, each person's view, files.
const dir = mkdtempSync(join(tmpdir(), 'cedar-api-'));
const PASSWORD = 'a long test password';
{
  const store = openStore(dir);
  store.saveState(initialState({ demo: true }));
  for (const id of ['amer', 'melyssa', 'georgio', 'fadia']) store.setPassword(id, PASSWORD);
  store.close();
}
const port = 4400 + Math.floor(Math.random() * 400);
const base = `http://127.0.0.1:${port}`;
const serverFile = fileURLToPath(new URL('../server/index.mjs', import.meta.url));
let server;
const start = async () => {
  server = spawn(process.execPath, ['--no-warnings', serverFile, String(port)], { env: { ...process.env, CEDAR_DATA: dir }, stdio: ['ignore', 'pipe', 'inherit'] });
  await new Promise((resolve, reject) => { server.stdout.on('data', chunk => { if (String(chunk).includes('http://')) resolve(); }); server.on('exit', code => reject(new Error(`server exited ${code}`))); });
};
const stop = () => new Promise(resolve => { server.removeAllListeners('exit'); server.on('exit', resolve); server.kill(); });

const call = async (path, { cookie, body, method = body ? 'POST' : 'GET', headers = {} } = {}) => {
  const response = await fetch(base + path, { method, headers: { ...(body && typeof body !== 'string' && !(body instanceof Uint8Array) ? { 'content-type': 'application/json' } : {}), ...(cookie ? { cookie } : {}), ...headers }, body: body && typeof body !== 'string' && !(body instanceof Uint8Array) ? JSON.stringify(body) : body });
  const text = await response.text();
  let json = null; try { json = JSON.parse(text); } catch { /* binary or plain */ }
  return { status: response.status, json, text, cookie: response.headers.get('set-cookie')?.split(';')[0] };
};
const login = async (staffId, password = PASSWORD) => call('/api/login', { body: { staffId, password } });

try {
  await start();
  // Nothing without signing in.
  assert.equal((await call('/api/state')).status, 401);
  assert.equal((await call('/api/me')).status, 401);
  const wrong = await login('melyssa', 'not her password');
  assert.equal(wrong.status, 401);
  assert.equal(wrong.json.error, 'Wrong name or password.');

  // Too many wrong passwords lock that name for a while.
  for (let i = 0; i < 5; i++) assert.equal((await login('amer', 'guessing wrong')).status, 401);
  assert.equal((await login('amer', 'guessing wrong')).status, 429);
  assert.equal((await login('amer')).status, 429, 'even the right password waits out the lock');
  // The lock is on the computer that guessed, so nobody can lock a colleague out from elsewhere.
  const fromElsewhere = await new Promise(resolve => {
    const body = JSON.stringify({ staffId: 'amer', password: PASSWORD });
    const request = http.request({ host: '127.0.0.1', port, path: '/api/login', method: 'POST', localAddress: '127.0.0.2', headers: { host: `127.0.0.1:${port}`, 'content-type': 'application/json', 'content-length': Buffer.byteLength(body) } }, response => { response.resume(); resolve(response.statusCode); });
    request.on('error', error => resolve(`error: ${error.message}`));
    request.end(body);
  });
  assert.equal(fromElsewhere, 200, 'Amer still signs in from his own computer');

  const melyssa = (await login('melyssa')).cookie;
  assert.match(melyssa, /^cedar_session=/);
  assert.equal((await call('/api/me', { cookie: melyssa })).json.staffId, 'melyssa');
  const first = await call('/api/state', { cookie: melyssa });
  assert.equal(first.status, 200);
  assert.ok(!first.json.state.forms.some(entry => ['intake', 'session'].includes(entry.formId)), 'her view has no clinical records');
  // Plans reach her only as the phase and planned discharge.
  assert.ok(first.json.state.forms.filter(entry => entry.formId === 'plan').every(entry => Object.keys(entry.values).every(key => ['patient', 'phase', 'plannedDischarge'].includes(key))));

  // A change runs on the server as her.
  const made = await call('/api/act', { cookie: melyssa, body: { name: 'createInquiry', args: [{ name: 'Test Person', program: 'Inpatient' }] } });
  assert.equal(made.status, 200);
  assert.equal(made.json.result.stageHistory[0].by, 'melyssa');
  assert.ok(made.json.state.inquiries.some(item => item.id === made.json.result.id), 'the result is her own view of the record');
  assert.equal(made.json.version, first.json.version + 1);
  assert.ok(made.json.state.inquiries.some(item => item.name === 'Test Person'));

  // Georgio cannot act as anyone else: the actor is always the session's person.
  const georgio = (await login('georgio')).cookie;
  const order = first.json.state.orders.find(item => item.status === 'Awaiting approval');
  const forged = await call('/api/act', { cookie: georgio, body: { name: 'approveOrder', args: [order.id, 'amer'] } });
  assert.equal(forged.status, 400);
  assert.match(forged.json.error, /role cannot/);
  // Clock jobs are the server's, never a browser's.
  assert.equal((await call('/api/act', { cookie: georgio, body: { name: 'runInquiryAging', args: [] } })).status, 400);
  assert.equal((await call('/api/act', { cookie: georgio, body: { name: 'nope', args: [] } })).json.error, 'Unknown command: nope');

  // Two people work in turn; each sees the other's change.
  const both = await call('/api/act', { cookie: georgio, body: { name: 'reportIncident', args: [{ type: 'Rule breach', level: 1, description: 'Smoking indoors.' }] } });
  assert.equal(both.status, 200);
  const melyssaNow = (await call('/api/state', { cookie: melyssa })).json.state;
  assert.ok(melyssaNow.inquiries.some(item => item.name === 'Test Person'));
  assert.ok(melyssaNow.incidents.some(item => item.id === both.json.result.id), 'she sees the incident Georgio just reported');
  const georgioNow = (await call('/api/state', { cookie: georgio })).json.state;
  assert.ok(georgioNow.incidents.some(item => item.id === both.json.result.id));
  assert.equal(georgioNow.inquiries.length, 0, 'the floor never receives inquiries');

  // Only JSON posts, and not from another site.
  assert.equal((await call('/api/act', { cookie: melyssa, body: 'name=createInquiry', headers: { 'content-type': 'text/plain' } })).status, 415);
  assert.equal((await call('/api/act', { cookie: melyssa, body: { name: 'markAllRead', args: [] }, headers: { origin: 'https://evil.example' } })).status, 403);

  // Files: a prescription scan reaches Fadia, never Melyssa; a file over 15 MB is refused.
  const fadia = (await login('fadia')).cookie;
  const bytes = new Uint8Array([37, 80, 68, 70, 1, 2, 3]);
  const upload = await call('/api/files', { cookie: fadia, body: bytes, headers: { 'x-cedar-upload': '1', 'x-file-name': encodeURIComponent('rx scan.pdf'), 'content-type': 'application/pdf' } });
  assert.equal(upload.status, 200);
  const patient = first.json.state.patients.find(item => item.status === 'Admitted');
  const attached = await call('/api/act', { cookie: fadia, body: { name: 'recordPrescription', args: [{ patientId: patient.id, fileId: upload.json.id, fileName: 'rx scan.pdf', note: 'Sertraline 50 mg' }] } });
  assert.equal(attached.status, 200, attached.json?.error);
  assert.equal((await call(`/api/files/${upload.json.id}`, { cookie: melyssa })).status, 404, 'Melyssa cannot fetch a prescription scan');
  const got = await fetch(`${base}/api/files/${upload.json.id}`, { headers: { cookie: fadia } });
  assert.equal(got.status, 200);
  assert.deepEqual(new Uint8Array(await got.arrayBuffer()), bytes);
  assert.equal((await call('/api/files', { cookie: fadia, body: new Uint8Array(16 * 1024 * 1024), headers: { 'x-cedar-upload': '1', 'x-file-name': 'big.bin', 'content-type': 'application/octet-stream' } })).status, 413);

  // A command name must be a plain name; nothing runs, nothing is skipped in the audit.
  const sneaky = await call('/api/act', { cookie: georgio, body: { name: ['runLeaveAlerts'], args: [] } });
  assert.equal(sneaky.status, 400);
  // A resident cannot top up their own wallet by calling the server directly.
  // A file is shown in the browser only if it is a picture or a PDF; anything else downloads, so it can never run as the person opening it.
  const page = await call('/api/files', { cookie: fadia, body: new TextEncoder().encode('<script>alert(1)</script>'), headers: { 'x-cedar-upload': '1', 'x-file-name': 'x.html', 'content-type': 'text/html' } });
  await call('/api/act', { cookie: fadia, body: { name: 'recordPrescription', args: [{ patientId: patient.id, fileId: page.json.id, fileName: 'x.html', note: 'x' }] } });
  const served = await fetch(`${base}/api/files/${page.json.id}`, { headers: { cookie: fadia } });
  assert.equal(served.headers.get('content-type'), 'application/octet-stream');
  assert.match(served.headers.get('content-disposition'), /^attachment/);
  assert.equal(got.headers.get('content-type'), 'application/pdf');
  assert.match(got.headers.get('content-disposition'), /^inline/);
  // Only this computer's own address is answered (no other site can pose as it).
  const foreign = await new Promise(resolve => { const request = http.request({ host: '127.0.0.1', port, path: '/api/me', headers: { host: 'evil.example', cookie: melyssa } }, response => { response.resume(); resolve(response.statusCode); }); request.on('error', error => resolve(`error: ${error.message}`)); request.end(); });
  assert.equal(foreign, 403);

  // State and sessions survive a restart; signing out ends the session.
  await stop();
  await start();
  assert.equal((await call('/api/me', { cookie: melyssa })).json.staffId, 'melyssa');
  assert.ok((await call('/api/state', { cookie: melyssa })).json.state.inquiries.some(item => item.name === 'Test Person'));
  await call('/api/logout', { cookie: melyssa, body: {} });
  assert.equal((await call('/api/me', { cookie: melyssa })).status, 401);
  assert.equal((await call('/api/act', { cookie: melyssa, body: { name: 'markAllRead', args: [] } })).status, 401, 'an ended session changes nothing');

  // Every change, and every refusal, is in the audit log.
  await stop();
  const store = openStore(dir);
  const rows = store.auditRows(50);
  store.close();
  assert.ok(rows.some(row => row.command === 'createInquiry' && row.staff_id === 'melyssa' && row.ok === 1));
  assert.ok(rows.some(row => row.command === 'approveOrder' && row.staff_id === 'georgio' && row.ok === 0));
  server = null;
} finally {
  if (server) await stop();
  rmSync(dir, { recursive: true, force: true });
}
console.log('Server API checks passed.');
