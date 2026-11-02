import assert from 'node:assert/strict';
import { SERVICES, earliestSlot, book, completeAppointment, notesOverdue, recordPrescription, autoBookPsychologist, cancelAppointment, scheduleScope, canCancel } from '../src/lib/scheduling.js';
import { seed } from '../src/lib/seed.js';
import { withSsr } from './lib/ssr.mjs';

const empty = () => ({ appointments: [], patients: [{ id: 'P-1', clinicalName: 'Test P.', fullName: 'Test Person', status: 'Admitted' }], inquiries: [], documents: [], notifications: [], activity: [], tasks: [] });
assert.deepEqual(SERVICES.map(service => service.name), ['Psychologist session', 'Therapist session', 'Nursing appointment', 'Blood test', 'Physiotherapy', 'Fitness session', 'Movement & yoga', 'Tennis', 'Personal training', 'Boxing / MMA', 'Drama therapy', 'Group', 'External psychiatrist']);

// Next day first; Sunday is skipped.
assert.deepEqual(earliestSlot(empty(), { provider: 'nabila', minutes: 50, from: '2026-11-06' }), { date: '2026-11-07', start: '09:00' });
assert.deepEqual(earliestSlot(empty(), { provider: 'nabila', minutes: 50, from: '2026-11-07' }), { date: '2026-11-09', start: '09:00' });

// A full day rolls to the next working day; a gap is used when it fits.
const busy = empty();
busy.appointments.push({ id: 'A-1', service: 'Psychologist session', provider: 'nabila', date: '2026-11-03', start: '09:00', minutes: 435, status: 'Booked' });
assert.deepEqual(earliestSlot(busy, { provider: 'nabila', minutes: 50, from: '2026-11-02' }), { date: '2026-11-04', start: '09:00' });
assert.deepEqual(earliestSlot(busy, { provider: 'nabila', minutes: 30, from: '2026-11-02' }), { date: '2026-11-03', start: '16:15' });
busy.appointments[0].status = 'Cancelled';
assert.deepEqual(earliestSlot(busy, { provider: 'nabila', minutes: 50, from: '2026-11-02' }), { date: '2026-11-03', start: '09:00' });
busy.appointments[0].status = 'Booked';

// No double booking for the same person.
assert.throws(() => book(busy, { service: 'Psychologist session', provider: 'nabila', patientId: 'P-1', date: '2026-11-03', start: '10:00', minutes: 50 }, 'nabila'), /This time overlaps another booking for Nabila/);
assert.throws(() => book(busy, { service: 'Psychologist session', provider: 'nabila', patientId: 'P-1', date: '2026-11-05', start: '10:00', minutes: 50 }, 'melyssa'), /Psychologist appointments are booked automatically and can't be changed here/);
const nurse = book(busy, { service: 'Nursing appointment', provider: 'fadia', patientId: 'P-1', date: '2026-11-03', start: '10:00', minutes: 30 }, 'melyssa');
assert.equal(nurse.status, 'Booked');

// Automatic psychologist booking takes the earliest free slot.
const auto = autoBookPsychologist(busy, { patientId: 'P-1' }, '2026-11-02', 'system');
assert.equal(auto.provider, 'nabila');
assert.equal(auto.auto, true);
assert.deepEqual([auto.date, auto.start], ['2026-11-04', '09:00'], 'a 50-minute session does not fit after 16:15');

// Each person sees their own calendar; Ahmed and Melyssa see everyone's. Cancelling is limited to your own bookings.
assert.equal(scheduleScope('ahmed'), 'all');
assert.equal(scheduleScope('melyssa'), 'all');
assert.deepEqual(scheduleScope('fadia'), ['fadia', 'external']);
assert.deepEqual(scheduleScope('john'), ['john']);
assert.equal(canCancel('john', nurse), false);
assert.equal(canCancel('fadia', nurse), true);
assert.equal(canCancel('melyssa', nurse), true);
assert.equal(canCancel('melyssa', auto), false);
assert.equal(canCancel('ahmed', auto), true);
assert.throws(() => cancelAppointment(busy, nurse.id, 'john'), /You can cancel only your own appointments/);
cancelAppointment(busy, nurse.id, 'fadia');
assert.equal(nurse.status, 'Cancelled');

// A session note is due within 24 hours of the session ending.
const notes = empty();
const now = new Date('2026-11-05T12:00:00');
notes.appointments.push(
  { id: 'A-late', service: 'Psychologist session', provider: 'nabila', patientId: 'P-1', date: '2026-11-04', start: '10:00', minutes: 50, status: 'Completed', completedAt: new Date('2026-11-04T10:50:00').toISOString() },
  { id: 'A-fresh', service: 'Psychologist session', provider: 'nabila', patientId: 'P-1', date: '2026-11-04', start: '13:00', minutes: 50, status: 'Completed', completedAt: new Date('2026-11-04T13:50:00').toISOString() },
  { id: 'A-noted', service: 'Therapist session', provider: 'nabila', patientId: 'P-1', date: '2026-11-03', start: '10:00', minutes: 50, status: 'Completed', completedAt: new Date('2026-11-03T10:50:00').toISOString(), noteFormId: 'F-1' }
);
assert.deepEqual(notesOverdue(notes, 'nabila', now).map(item => item.id), ['A-late']);
assert.throws(() => completeAppointment(notes, 'A-late', 'nabila'), /already completed/);

const state = seed();
const visit = state.appointments.find(item => item.service === 'External psychiatrist' && item.status === 'Booked');
const before = state.notifications.filter(item => item.to === 'fadia').length;
recordPrescription(state, { patientId: visit.patientId, appointmentId: visit.id, fileId: 'file-1', note: 'Sertraline 50 mg' }, 'fadia');
assert.equal(state.notifications.filter(item => item.to === 'fadia').length, before + 1);
assert.equal(state.documents.at(-1).type, 'Prescription');
assert.equal(state.documents.at(-1).patientId, visit.patientId);

await withSsr(async ({ load, html }) => {
  const { session } = await load('/src/lib/store.svelte.js');
  session.staffId = 'melyssa';
  const page = await html('/src/pages/Schedule.svelte', { args: [] });
  for (const text of ['Schedule', 'Psychologist session', 'Book earliest']) assert.ok(page.includes(text), text);
  session.staffId = 'fadia';
  assert.ok((await html('/src/pages/Schedule.svelte', { args: [] })).includes('Record psychiatrist appointment'));
  session.staffId = 'john';
  const johns = await html('/src/pages/Schedule.svelte', { args: [] });
  assert.ok(!johns.includes('>Everyone<'), 'John sees only his own calendar');
  assert.ok(!johns.includes('Nursing appointment'), 'and none of Fadia’s appointments');
});

console.log('Scheduling checks passed.');
