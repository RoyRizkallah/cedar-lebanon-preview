import assert from 'node:assert/strict';
import { onWatch } from '../src/lib/forms/engine.js';
import { startLeave } from '../src/lib/safety.js';
import { createRequest, approveRequest, declineRequest, completeRequest, isRestricted } from '../src/lib/requests.js';
import { scheduleScope } from '../src/lib/scheduling.js';
import { sessionsWeek } from '../src/lib/sessions.js';
import { tasksFor } from '../src/lib/tasks.js';
import { addDays, todayISO, weekday } from '../src/lib/dates.js';
import { seed } from '../src/lib/seed.js';
import { withSsr } from './lib/ssr.mjs';

const now = new Date();

// On watch: the floor knows who needs extra care without seeing the clinical rating, and leave for them needs the clinical team's agreement.
{
  const state = seed();
  const watched = state.patients.find(item => item.status === 'Admitted' && onWatch(state, item.id) && !state.leaves.some(leave => leave.patientId === item.id && !leave.returnedAt));
  const calm = state.patients.find(item => item.status === 'Admitted' && !onWatch(state, item.id) && !state.leaves.some(leave => leave.patientId === item.id && !leave.returnedAt));
  assert.ok(watched && calm, 'sample data has both');
  const out = now.toISOString();
  const dueBack = new Date(now.getTime() + 4 * 3600000).toISOString();
  assert.throws(() => startLeave(state, { patientId: watched.id, out, dueBack }, 'melyssa'), /on watch/);
  startLeave(state, { patientId: watched.id, out, dueBack, clinicalOk: true }, 'melyssa');
  startLeave(state, { patientId: calm.id, out, dueBack }, 'melyssa');
}

// Requests: a resident's own request, or anything restricted, waits for approval before Georgio buys it.
{
  const state = seed();
  const resident = state.patients.find(item => item.id === 'P-0001');
  assert.ok(isRestricted('Mouthwash (Listerine)') && isRestricted('cough syrup') && !isRestricted('Phone charger'));
  const own = createRequest(state, { patientId: 'P-0001', item: 'Phone charger', quantity: 1 }, 'resident-p0001');
  assert.equal(own.status, 'Awaiting approval');
  const rsa = resident.assigned.rsa;
  assert.ok(tasksFor(state, rsa, now).today.some(item => item.id === `approve-${own.id}`), 'their RSA is asked');
  assert.throws(() => completeRequest(state, own.id, { amount: '10', fileId: 'f' }, 'georgio'), /approved/);
  approveRequest(state, own.id, rsa);
  assert.equal(own.status, 'Open');
  const restricted = createRequest(state, { patientId: 'P-0001', item: 'Mouthwash', quantity: 1 }, rsa);
  assert.equal(restricted.status, 'Awaiting approval');
  assert.ok(restricted.restricted);
  assert.throws(() => approveRequest(state, restricted.id, rsa), /Fadia or the clinical team/);
  assert.ok(tasksFor(state, 'fadia', now).today.some(item => item.id === `approve-${restricted.id}`), 'restricted items go to the nurse');
  assert.throws(() => declineRequest(state, restricted.id, '', 'fadia'), /reason/);
  declineRequest(state, restricted.id, 'Alcohol-based; ask for an alcohol-free one', 'fadia');
  assert.equal(restricted.status, 'Declined');
  const plain = createRequest(state, { patientId: 'P-0001', item: 'Notebook', quantity: 2 }, rsa);
  assert.equal(plain.status, 'Open', 'an RSA request for an ordinary item goes straight to purchase');
}

// Wael oversees his team: his calendar and Sessions page include Nabila's and Nazha's sessions.
{
  const state = seed();
  const scope = scheduleScope('clinical-director');
  for (const id of ['clinical-director', 'nabila', 'nazha']) assert.ok(scope.includes(id), id);
  assert.ok(!scope.includes('john'));
  const today = todayISO(now);
  const monday = addDays(today, -((weekday(today) + 6) % 7));
  const providers = new Set([0, 7].flatMap(offset => sessionsWeek(state, 'clinical-director', addDays(monday, offset)).items.map(item => item.appointment.provider)));
  assert.ok(providers.has('nabila') && providers.has('nazha'), 'Wael sees his team');
}

// RSAs see the open requests of their own residents and their history, not everyone's.
await withSsr(async ({ load, html }) => {
  const { session, db } = await load('/src/lib/store.svelte.js');
  const done = db.requests.find(item => item.status === 'Done');
  const owner = db.patients.find(item => item.id === done.patientId).assigned.rsa;
  const stranger = ['alaa', 'dania', 'imad'].find(id => id !== owner);
  session.staffId = stranger;
  assert.ok(!(await html('/src/pages/Requests.svelte', { args: [] })).includes(done.item), 'another RSA does not see it');
  // On watch shows for RSAs, without the rating.
  const watched = db.patients.find(item => item.status === 'Admitted' && onWatch(db, item.id) && item.assigned?.rsa);
  session.staffId = watched.assigned.rsa;
  const card = await html('/src/pages/Patients.svelte', { args: [] });
  assert.ok(card.includes('On watch') && !/(High|Medium) risk/.test(card), 'the floor sees on watch, not the rating');
});

console.log('Floor checks passed.');
