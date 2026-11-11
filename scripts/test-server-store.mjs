import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { openStore, initialState } from '../server/store.mjs';

// The local database: one state document, hashed passwords, sessions that survive a restart.
const dir = mkdtempSync(join(tmpdir(), 'cedar-store-'));
try {
  let store = openStore(dir);
  assert.equal(store.getState(), null, 'a new database has no state until it is initialised');
  store.saveState(initialState({ demo: true }));
  assert.equal(store.getState().version, 1);
  assert.equal(store.getState().state.leads.length, 14);

  // Passwords: at least 10 characters, only for people on the staff list or residents, never stored in clear.
  assert.throws(() => store.setPassword('amer', 'short'), /10 characters/);
  assert.throws(() => store.setPassword('nobody', 'long enough password'), /Unknown staff/);
  store.setPassword('amer', 'correct horse battery');
  assert.equal(store.checkPassword('amer', 'correct horse battery'), true);
  assert.equal(store.checkPassword('amer', 'wrong horse battery'), false);
  assert.equal(store.checkPassword('melyssa', 'correct horse battery'), false, 'no account, no entry');
  store.close();
  assert.ok(!readFileSync(join(dir, 'cedar.db')).includes(Buffer.from('correct horse battery')), 'the clear password is not in the database');

  // Sessions: a token works until it ends or expires; the token itself is not stored.
  store = openStore(dir);
  const token = store.createSession('amer');
  assert.equal(store.sessionUser(token), 'amer');
  assert.equal(store.sessionUser('made-up'), null);
  const later = store.createSession('amer', new Date(Date.now() - 13 * 3600 * 1000));
  assert.equal(store.sessionUser(later), null, 'a session older than 12 hours has expired');
  store.close();

  // Everything survives reopening.
  store = openStore(dir);
  assert.equal(store.sessionUser(token), 'amer');
  assert.equal(store.saveState({ ...store.getState().state, note: 'x' }), 2);
  store.endSession(token);
  assert.equal(store.sessionUser(token), null);
  store.audit({ staffId: 'amer', command: 'createInquiry', args: [{ name: 'A' }], ok: true });
  assert.equal(store.auditRows().at(-1).command, 'createInquiry');
  store.close();

  // A real start: the house (rooms, programs) without any patient data.
  const real = initialState({ demo: false });
  for (const key of ['leads', 'inquiries', 'onboardings', 'patients', 'appointments', 'forms', 'documents', 'requests', 'tasks', 'notifications', 'activity', 'visits', 'leaves', 'incidents', 'checkins', 'comments', 'programAssignments', 'orders']) assert.equal(real[key].length, 0, key);
  assert.equal(real.wallet.transactions.length + real.finance.invoices.length + real.medication.orders.length, 0);
  assert.equal(real.rooms.length, 8);
  assert.ok(real.rooms.every(room => room.status === 'Ready'));
} finally {
  rmSync(dir, { recursive: true, force: true });
}
console.log('Server store checks passed.');
