import assert from 'node:assert/strict';
import { dischargePatient, dischargePreview, plannedDischarge, DISCHARGE_TYPES } from '../src/lib/discharge.js';
import { fileForm } from '../src/lib/forms/engine.js';
import { walletBalanceCents } from '../src/lib/wallet.js';
import { programFor } from '../src/lib/programs.js';
import { roundFor } from '../src/lib/medication.js';
import { tasksFor } from '../src/lib/tasks.js';
import { milestonesFor } from '../src/lib/today.js';
import { canDo } from '../src/lib/people.js';
import { addDays, todayISO } from '../src/lib/dates.js';
import { seed } from '../src/lib/seed.js';
import { withSsr } from './lib/ssr.mjs';

const now = new Date();
const today = todayISO(now);
const state = seed();
// A resident on a program, with money in their wallet and sessions ahead.
const assignment = state.programAssignments.find(item => item.status === 'Active');
const patient = state.patients.find(item => item.id === assignment.patientId);
const { roomId, bed } = patient;
assert.ok(roomId && walletBalanceCents(state, patient.id) > 0, 'sample resident has a bed and money');
const ahead = () => state.appointments.filter(item => item.status === 'Booked' && item.date > today && (item.patientId === patient.id || item.patientIds?.includes(patient.id)));
assert.ok(ahead().length > 0, 'sessions are booked ahead');

assert.deepEqual(DISCHARGE_TYPES, ['Planned', 'Early (agreed)', 'Self-discharge']);
for (const id of ['ahmed', 'melyssa']) assert.equal(canDo(id, 'discharge'), true, id);
for (const id of ['fadia', 'nabila', 'omar', 'amer']) assert.equal(canDo(id, 'discharge'), false, id);

// The planned date comes from the treatment plan until the discharge plan is filed, then from that.
const fromPlan = state.forms.filter(item => item.formId === 'plan' && item.patientId === patient.id && item.status === 'Filed').at(-1)?.values.plannedDischarge;
assert.equal(plannedDischarge(state, patient.id), fromPlan || '');

// Filing the discharge plan no longer discharges anyone: it plans the day.
const plan = fileForm(state, { formId: 'discharge', patientId: patient.id, values: { dischargeDate: today, dischargeType: 'Planned', patientCopy: { name: patient.fullName, by: 'samar', at: now.toISOString() } }, staffId: 'samar', final: true });
assert.equal(plan.status, 'Filed');
assert.equal(patient.status, 'Admitted', 'still in care until the day itself');
assert.equal(plannedDischarge(state, patient.id), today);
assert.ok(tasksFor(state, 'melyssa', now).today.some(item => item.kind === 'discharge' && item.patientId === patient.id), 'Melyssa is asked to discharge on the day');
assert.ok(milestonesFor(state, 'ahmed', now).some(item => item.kind === 'discharge' && item.patientId === patient.id), 'a discharge milestone');

// What will happen, shown before confirming.
const preview = dischargePreview(state, patient.id, today);
assert.equal(preview.room, roomId);
assert.equal(preview.walletCents, walletBalanceCents(state, patient.id));
assert.equal(preview.sessions, ahead().length);
assert.ok(preview.program);

// Guard rails.
assert.throws(() => dischargePatient(state, patient.id, { date: today, type: 'Planned' }, 'fadia', now), /discharged by/);
assert.throws(() => dischargePatient(state, patient.id, { date: addDays(today, 1), type: 'Planned' }, 'melyssa', now), /on the day they leave/);
assert.throws(() => dischargePatient(state, patient.id, { date: today, type: 'Lost' }, 'melyssa', now), /Choose the kind of discharge/);
const unplanned = state.patients.find(item => item.status === 'Admitted' && item.id !== patient.id && !state.forms.some(f => f.formId === 'discharge' && f.patientId === item.id && f.status === 'Filed'));
assert.throws(() => dischargePatient(state, unplanned.id, { date: today, type: 'Planned' }, 'melyssa', now), /File the Discharge & Aftercare Plan first/);

// Ahmed, the Clinical Director, signs off the plan before anyone is discharged.
assert.throws(() => dischargePatient(state, patient.id, { date: today, type: 'Planned' }, 'melyssa', now), /Ahmed signs off the discharge plan/);
plan.values.directorSignature = { name: 'Ahmed Khattab', by: 'ahmed', at: now.toISOString() };

// The day itself: bed, program, calendar, medication, wallet, bill and aftercare all follow.
state.medication.orders.push({ id: 'MED-T1', patientId: patient.id, drug: 'Thiamine', dose: '100 mg', route: 'Oral', times: ['08:00'], startDate: addDays(today, -3), status: 'Active' });
assert.ok(roundFor(state, addDays(today, 1)).some(item => item.patientId === patient.id), 'a dose is due tomorrow while in care');
const before = state.notifications.length;
dischargePatient(state, patient.id, { date: today, type: 'Planned', note: 'Left with family.' }, 'melyssa', now);
assert.equal(patient.status, 'Discharged');
assert.equal(patient.dischargedAt, today);
assert.equal(patient.dischargeType, 'Planned');
assert.equal(patient.roomId, '');
assert.equal(patient.bed, null);
assert.equal(ahead().length, 0, 'nothing left booked ahead');
assert.equal(programFor(state, patient.id, today), null, 'program ended');
assert.equal(state.programAssignments.find(item => item.id === assignment.id).status, 'Ended');
assert.equal(walletBalanceCents(state, patient.id), 0, 'wallet returned to the family');
assert.ok(!roundFor(state, addDays(today, 1)).some(item => item.patientId === patient.id), 'no doses due after they leave');
assert.ok(state.medication.orders.filter(item => item.patientId === patient.id).every(item => item.status !== 'Active'), 'orders stopped');
assert.ok(state.wallet.transactions.some(item => item.patientId === patient.id && item.type === 'refund'));
const bill = state.tasks.find(item => item.kind === 'final-bill' && item.patientId === patient.id);
assert.equal(bill.owner, 'rabih');
const calls = state.tasks.filter(item => item.kind === 'followup-call' && item.patientId === patient.id).map(item => item.due);
assert.deepEqual(calls, [addDays(today, 7), addDays(today, 30), addDays(today, 90)]);
assert.ok(state.notifications.length > before, 'the team is told');
assert.ok(!tasksFor(state, 'melyssa', now).today.some(item => item.kind === 'discharge' && item.patientId === patient.id), 'the discharge task clears');
assert.throws(() => dischargePatient(state, patient.id, { date: today, type: 'Planned' }, 'melyssa', now), /already discharged/);

// Someone who walks out can be discharged without a filed plan.
dischargePatient(state, unplanned.id, { date: today, type: 'Self-discharge' }, 'ahmed', now);
assert.equal(unplanned.status, 'Discharged');

await withSsr(async ({ load, html }) => {
  const { session, db } = await load('/src/lib/store.svelte.js');
  const id = db.patients.find(item => item.status === 'Admitted').id;
  const button = />Discharge<\/span><\/button>/;
  session.staffId = 'melyssa';
  assert.ok((await html('/src/pages/Patients.svelte', { args: [id] })).match(button), 'Melyssa sees Discharge');
  session.staffId = 'fadia';
  assert.ok(!(await html('/src/pages/Patients.svelte', { args: [id] })).match(button), 'Fadia does not');
});

console.log('Discharge checks passed.');
