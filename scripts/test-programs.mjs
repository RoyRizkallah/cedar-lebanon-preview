import assert from 'node:assert/strict';
import { createProgram, updateProgram, archiveProgram, assignProgram, endAssignment, programFor, programWeek, programBookings, DAYS, SESSION_KINDS } from '../src/lib/programs.js';
import { canDo, canSee } from '../src/lib/people.js';
import { loadState } from '../src/lib/persist.js';
import { seed } from '../src/lib/seed.js';
import { withSsr } from './lib/ssr.mjs';

// The clinical team (Ahmed, Nabila, Samar, Nazha) builds programs and gives them to patients; the rest of the care team reads them.
for (const id of ['ahmed', 'nabila', 'samar', 'nazha']) assert.equal(canDo(id, 'managePrograms'), true, id);
for (const id of ['amer', 'melyssa', 'fadia', 'john', 'omar']) assert.equal(canDo(id, 'managePrograms'), false, id);
for (const id of ['ahmed', 'nazha', 'ahmed', 'fadia', 'john']) assert.equal(canSee(id, 'programs'), true, id);
for (const id of ['melyssa', 'rabih', 'georgio']) assert.equal(canSee(id, 'programs'), false, id);

const now = new Date('2026-11-02T10:00:00');
const state = seed();
const patient = state.patients.find(item => item.status === 'Admitted' && item.program !== 'Outpatient');
const blank = { name: 'Relapse prevention', focus: 'Triggers and coping plans', weeks: 4, goals: ['Name three triggers'], sessions: [{ day: 'Mon', time: '10:00', minutes: 60, kind: 'Group', title: 'Triggers group', leader: 'ahmed' }] };

assert.throws(() => createProgram(state, blank, 'fadia', now), /Programs are created by the clinical team/);
assert.throws(() => createProgram(state, { ...blank, name: 'x' }, 'nazha', now), /Name the program/);
assert.throws(() => createProgram(state, { ...blank, weeks: 0 }, 'nazha', now), /1 to 26 weeks/);
assert.throws(() => createProgram(state, { ...blank, sessions: [{ day: 'Sun', time: '10:00', kind: 'Group', title: 'x y' }] }, 'nazha', now), /Monday to Saturday/);
assert.throws(() => createProgram(state, { ...blank, sessions: [{ day: 'Mon', time: '25:00', kind: 'Group', title: 'Group' }] }, 'nazha', now), /time/);
assert.throws(() => createProgram(state, { ...blank, sessions: [{ day: 'Mon', time: '10:00', kind: 'Karaoke', title: 'Group' }] }, 'nazha', now), /kind of session/);
assert.deepEqual(DAYS, ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']);
assert.ok(SESSION_KINDS.includes('Drama therapy') && SESSION_KINDS.includes('Fitness'));

const program = createProgram(state, blank, 'nazha', now);
assert.equal(program.createdBy, 'nazha');
assert.equal(program.status, 'Active');
assert.equal(program.sessions[0].id.length > 0, true, 'each session has an id');

// Editing keeps the program whole: a bad edit changes nothing.
assert.throws(() => updateProgram(state, program.id, { name: '' }, 'nazha', now), /Name the program/);
assert.equal(program.name, 'Relapse prevention');
updateProgram(state, program.id, { sessions: [...program.sessions, { day: 'Wed', time: '15:00', minutes: 60, kind: 'Drama therapy', title: 'Role play', leader: 'nazha' }] }, 'nazha', now);
assert.equal(program.sessions.length, 2);
assert.throws(() => updateProgram(state, program.id, { weeks: 6 }, 'fadia', now), /Programs are created by the clinical team/);

// The week view groups sessions by day, in time order.
updateProgram(state, program.id, { sessions: [...program.sessions, { day: 'Mon', time: '08:30', minutes: 30, kind: 'Fitness', title: 'Morning walk', leader: 'john' }] }, 'nabila', now);
const week = programWeek(program);
assert.deepEqual(week.map(day => day.day), DAYS);
assert.deepEqual(week[0].sessions.map(item => item.time), ['08:30', '10:00']);

// Assigning: one active program per patient, dated, and the care team hears about it.
const before = state.notifications.length;
assert.throws(() => assignProgram(state, program.id, patient.id, { start: '2026-11-03' }, 'melyssa', now), /Programs are created by the clinical team/);
const first = assignProgram(state, program.id, patient.id, { start: '2026-11-03' }, 'ahmed', now);
assert.equal(first.end, '2026-12-01', '4 weeks from the start');
assert.ok(state.notifications.length > before, 'the team is told');
assert.equal(programFor(state, patient.id, '2026-11-10').program.id, program.id);
assert.throws(() => assignProgram(state, program.id, patient.id, { start: '2026-11-03' }, 'ahmed', now), /already on this program/);

const other = createProgram(state, { ...blank, name: 'Family repair' }, 'ahmed', now);
assignProgram(state, other.id, patient.id, { start: '2026-11-10' }, 'ahmed', now);
assert.equal(first.status, 'Ended', 'the earlier program ends when a new one starts');
assert.equal(programFor(state, patient.id, '2026-11-12').program.id, other.id);

const discharged = state.patients.find(item => item.status === 'Discharged');
assert.throws(() => assignProgram(state, other.id, discharged.id, { start: '2026-11-03' }, 'ahmed', now), /admitted patient/);

// Archiving keeps the record but stops new assignments.
archiveProgram(state, program.id, 'nazha', now);
assert.equal(program.status, 'Archived');
assert.throws(() => assignProgram(state, program.id, patient.id, { start: '2026-11-20' }, 'nazha', now), /archived/);

const current = programFor(state, patient.id, '2026-11-12');
endAssignment(state, current.assignment.id, 'nazha', now);
assert.equal(programFor(state, patient.id, '2026-11-12'), null);

// Sample data comes with programs, and old saved data without them starts fresh.
const fresh = seed();
assert.ok(fresh.programs.length >= 2);
assert.ok(fresh.programAssignments.some(item => item.status === 'Active'));
const old = { ...fresh }; delete old.programs;
assert.ok(Array.isArray(loadState(JSON.stringify(old)).programs));

// Assigning books the program onto the Schedule: shared sessions are one booking the patients join,
// one-to-one sessions are booked per patient, moved later the same day if the leader is busy.
{
  const team = { psychologist: 'nabila', therapist: 'ahmed', nurse: 'fadia', fitness: 'john', rsa: 'alaa' };
  const s = { programs: [], programAssignments: [], appointments: [], notifications: [], activity: [], tasks: [],
    patients: ['P-1', 'P-2', 'P-3'].map(id => ({ id, clinicalName: id, fullName: id, status: 'Admitted', program: 'Inpatient', admittedAt: '2026-10-20', assigned: team })) };
  const plan = createProgram(s, { name: 'Booking check', weeks: 2, sessions: [
    { day: 'Mon', time: '10:00', minutes: 60, kind: 'Group', title: 'Process group', leader: 'ahmed' },
    { day: 'Wed', time: '15:00', minutes: 50, kind: 'Individual', title: 'Individual therapy', leader: 'nabila' }
  ] }, 'nazha', now);
  const a = assignProgram(s, plan.id, 'P-1', { start: '2026-11-03' }, 'nazha', now);
  // Tue 3 Nov for 2 weeks: Mondays 9 and 16, Wednesdays 4 and 11.
  assert.deepEqual(programBookings(s, a).map(item => `${item.date} ${item.start}`).sort(), ['2026-11-04 15:00', '2026-11-09 10:00', '2026-11-11 15:00', '2026-11-16 10:00']);
  assert.deepEqual(a.conflicts, []);
  const group = s.appointments.find(item => item.date === '2026-11-09' && item.start === '10:00');
  assert.equal(group.service, 'Group');
  assert.equal(group.provider, 'ahmed');
  assert.equal(group.title, 'Process group');
  assert.deepEqual(group.patientIds, ['P-1']);

  const b = assignProgram(s, plan.id, 'P-2', { start: '2026-11-03' }, 'nazha', now);
  assert.deepEqual(group.patientIds, ['P-1', 'P-2'], 'the second patient joins the same group');
  assert.equal(s.appointments.filter(item => item.date === '2026-11-09' && item.start === '10:00').length, 1);
  const individual = programBookings(s, b).find(item => item.date === '2026-11-04');
  assert.equal(individual.service, 'Psychologist session');
  assert.equal(individual.patientId, 'P-2');
  assert.equal(individual.start, '15:50', 'Nabila is busy at 15:00, so the next free time that day');

  // A patient who is busy at a shared session is not double-booked: it is listed for the therapist.
  s.appointments.push({ id: 'A-900', service: 'Nursing appointment', provider: 'fadia', patientId: 'P-3', date: '2026-11-09', start: '10:15', minutes: 30, status: 'Booked' });
  const c = assignProgram(s, plan.id, 'P-3', { start: '2026-11-03' }, 'nazha', now);
  assert.deepEqual(c.conflicts.map(item => `${item.date} ${item.time} ${item.title}`), ['2026-11-09 10:00 Process group']);
  assert.ok(!group.patientIds.includes('P-3'));

  // Editing the week rebooks what is still ahead.
  updateProgram(s, plan.id, { sessions: plan.sessions.map(item => (item.kind === 'Group' ? { ...item, time: '11:00' } : item)) }, 'nazha', new Date('2026-11-10T08:00:00'));
  assert.equal(group.status, 'Booked', 'past sessions stay as they were');
  const moved = s.appointments.find(item => item.date === '2026-11-16' && item.title === 'Process group' && item.status === 'Booked');
  assert.equal(moved.start, '11:00');
  assert.ok(s.appointments.some(item => item.date === '2026-11-16' && item.start === '10:00' && item.status === 'Cancelled'));

  // Ending or switching a program cancels its future sessions for that patient only.
  endAssignment(s, b.id, 'nazha', new Date('2026-11-10T08:00:00'));
  assert.ok(!moved.patientIds.includes('P-2'), 'P-2 leaves the future group');
  assert.ok(moved.patientIds.includes('P-1'), 'P-1 stays in it');
  assert.equal(s.appointments.find(item => item.patientId === 'P-2' && item.date === '2026-11-11').status, 'Cancelled');
  assert.equal(s.appointments.find(item => item.patientId === 'P-2' && item.date === '2026-11-04').status, 'Booked', 'the past is kept');
  const other = createProgram(s, { name: 'Other plan', weeks: 1, sessions: [] }, 'nazha', now);
  assignProgram(s, other.id, 'P-1', { start: '2026-11-12' }, 'nazha', now);
  assert.deepEqual(moved.patientIds, ['P-3'], 'switching programs takes P-1 out of the old one from the new start');
  endAssignment(s, c.id, 'nazha', new Date('2026-11-10T08:00:00'));
  assert.equal(moved.status, 'Cancelled', 'a group nobody is left in is cancelled');
  // Fitness books the trainer's own kind of session, and a one-to-one never runs past 18:00.
  const s2 = { programs: [], programAssignments: [], appointments: [], notifications: [], activity: [], tasks: [], patients: [{ id: 'P-9', clinicalName: 'P-9', status: 'Admitted', assigned: team }] };
  const late = createProgram(s2, { name: 'Edges check', weeks: 1, sessions: [
    { day: 'Thu', time: '09:00', minutes: 45, kind: 'Fitness', title: 'Walk', leader: 'john' },
    { day: 'Thu', time: '17:30', minutes: 60, kind: 'Individual', title: 'Late talk', leader: 'ahmed' }
  ] }, 'nazha', now);
  const edge = assignProgram(s2, late.id, 'P-9', { start: '2026-11-03' }, 'nazha', now);
  assert.equal(s2.appointments.find(item => item.title === 'Walk').service, 'Fitness session');
  assert.deepEqual(edge.conflicts.map(item => item.title), ['Late talk']);
}

await withSsr(async ({ load, html }) => {
  const { session } = await load('/src/lib/store.svelte.js');
  session.staffId = 'nazha';
  const page = await html('/src/pages/Programs.svelte', { args: [] });
  for (const text of ['Programs', 'New program', 'Assign']) assert.ok(page.includes(text), `therapist sees ${text}`);
  session.staffId = 'fadia';
  const view = await html('/src/pages/Programs.svelte', { args: [] });
  assert.ok(view.includes('Programs') && !view.includes('New program'), 'the nurse reads, does not build');
  assert.ok(view.includes('Programs are built by Ahmed, Nabila, Samar and Nazha'), 'and is told who builds them');
});

console.log('Program checks passed.');
