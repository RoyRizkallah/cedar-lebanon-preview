import assert from 'node:assert/strict';
import { applyCommand } from '../src/lib/commands.js';
import { viewFor } from '../src/lib/view.js';
import { onWatch, riskLevel } from '../src/lib/forms/engine.js';
import { dashboard } from '../src/lib/kpis.js';
import { tasksFor } from '../src/lib/tasks.js';
import { dischargeDay } from '../src/lib/discharge.js';
import { canSee } from '../src/lib/people.js';
import { recordCashCount, reconcileCashCount, cashHeldCents } from '../src/lib/cash.js';
import { seed } from '../src/lib/seed.js';

// Second review: each person's view must still give the right operational facts, even without the records behind them.
const now = new Date('2026-11-11T10:00:00');
const state = seed(now);
const watched = state.patients.filter(patient => patient.status === 'Admitted' && onWatch(state, patient.id));
assert.ok(watched.length > 0);

// 1. Who is on watch reaches the floor (the flag, never the rating); the risk rating reaches those who may see it.
for (const id of ['omar', 'georgio', 'melyssa', 'mazen']) {
  const view = viewFor(state, id);
  for (const patient of watched) assert.equal(onWatch(view, patient.id), true, `${id} sees ${patient.id} on watch`);
  assert.ok(view.patients.every(patient => patient.risk === undefined), `${id} never receives the rating`);
}
const fadia = viewFor(state, 'fadia');
for (const patient of state.patients.filter(item => item.status === 'Admitted')) assert.equal(riskLevel(fadia, patient.id), riskLevel(state, patient.id), patient.id);

// 2. The discharge plan's day, type and sign-off reach those who discharge and plan rooms, without its clinical content.
const planned = state.forms.find(entry => entry.formId === 'discharge' && entry.status === 'Filed' && entry.values.dischargeDate);
const melyssa = viewFor(state, 'melyssa');
const copy = melyssa.forms.find(entry => entry.id === planned.id);
assert.ok(copy, 'Melyssa receives the plan\'s operational part');
assert.equal(copy.values.dischargeType, planned.values.dischargeType);
assert.equal(copy.values.living, undefined, 'never the clinical content');
assert.equal(dischargeDay(melyssa, planned.patientId), dischargeDay(state, planned.patientId));
assert.deepEqual(tasksFor(melyssa, 'melyssa', now).today.map(item => item.id).sort(), tasksFor(state, 'melyssa', now).today.map(item => item.id).sort(), 'her discharge tasks are all there');

// 4. The partners' dashboard shows the real figures in server mode.
for (const id of ['amer', 'ahmed']) {
  const view = viewFor(state, id);
  assert.deepEqual(JSON.parse(JSON.stringify(view.derived?.dashboard)), JSON.parse(JSON.stringify(dashboard(state, now))), `${id}'s dashboard`);
}
assert.equal(viewFor(state, 'georgio').derived?.dashboard, undefined);

// 5. Fadia approves restricted requests, so she can open them.
assert.ok(canSee('fadia', 'requests'));

// 6. A signature already on a record is never replaced.
{
  const s = seed(now);
  const intake = s.forms.find(entry => entry.formId === 'intake' && entry.status === 'Filed' && entry.values.conductedBy?.at);
  assert.throws(() => applyCommand(s, 'signLater', [intake.id, 'conductedBy', { name: 'x', at: now.toISOString() }], 'nazha', now), /already signed/);
}

// 8. An appointment is marked completed by the person who provides it.
{
  const s = seed(now);
  const theirs = s.appointments.find(item => item.status === 'Booked' && item.provider === 'nabila');
  assert.throws(() => applyCommand(s, 'completeAppointment', [theirs.id], 'melyssa', now), /Nabila/);
  applyCommand(s, 'completeAppointment', [theirs.id], 'nabila', now);
}

// 9. Tasks: your own; intake keeps the inquiry tasks; kitchen and housekeeping get only theirs.
assert.ok(viewFor(state, 'hasna').tasks.every(task => task.owner === 'hasna'));

// 7. Reopening the financial arrangement never wipes the payment Finance recorded.
{
  const s = seed(now);
  const paid = s.onboardings.find(item => item.steps.payment?.done);
  assert.throws(() => applyCommand(s, 'undoStep', [paid.id, 'financial'], 'melyssa', now), /payment/);
  assert.equal(paid.steps.payment.done, true);
}

// 10. A count is reconciled only after the witness has signed it.
{
  const s = seed(now);
  const count = recordCashCount(s, { counted: (cashHeldCents(s) / 100).toFixed(2), witness: 'omar' }, 'georgio', now);
  assert.throws(() => reconcileCashCount(s, count.id, 'ok', 'kteish', now), /witness/);
}
console.log('Second review checks passed.');
