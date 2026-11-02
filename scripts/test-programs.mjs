import assert from 'node:assert/strict';
import { createProgram, updateProgram, archiveProgram, assignProgram, endAssignment, programFor, programWeek, DAYS, SESSION_KINDS } from '../src/lib/programs.js';
import { canDo, canSee } from '../src/lib/people.js';
import { loadState } from '../src/lib/persist.js';
import { seed } from '../src/lib/seed.js';
import { withSsr } from './lib/ssr.mjs';

// Therapists build programs and give them to patients; Ahmed and the rest of the team only read them.
for (const id of ['clinical-director', 'nabila', 'nazha']) assert.equal(canDo(id, 'managePrograms'), true, id);
for (const id of ['ahmed', 'amer', 'melyssa', 'fadia', 'john', 'omar']) assert.equal(canDo(id, 'managePrograms'), false, id);
for (const id of ['clinical-director', 'nazha', 'ahmed', 'fadia', 'john']) assert.equal(canSee(id, 'programs'), true, id);
for (const id of ['melyssa', 'rabih', 'georgio']) assert.equal(canSee(id, 'programs'), false, id);

const now = new Date('2026-11-02T10:00:00');
const state = seed();
const patient = state.patients.find(item => item.status === 'Admitted' && item.program !== 'Outpatient');
const blank = { name: 'Relapse prevention', focus: 'Triggers and coping plans', weeks: 4, goals: ['Name three triggers'], sessions: [{ day: 'Mon', time: '10:00', minutes: 60, kind: 'Group', title: 'Triggers group', leader: 'clinical-director' }] };

assert.throws(() => createProgram(state, blank, 'ahmed', now), /Programs are created by the therapists/);
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
assert.throws(() => updateProgram(state, program.id, { weeks: 6 }, 'fadia', now), /Programs are created by the therapists/);

// The week view groups sessions by day, in time order.
updateProgram(state, program.id, { sessions: [...program.sessions, { day: 'Mon', time: '08:30', minutes: 30, kind: 'Fitness', title: 'Morning walk', leader: 'john' }] }, 'nabila', now);
const week = programWeek(program);
assert.deepEqual(week.map(day => day.day), DAYS);
assert.deepEqual(week[0].sessions.map(item => item.time), ['08:30', '10:00']);

// Assigning: one active program per patient, dated, and the care team hears about it.
const before = state.notifications.length;
assert.throws(() => assignProgram(state, program.id, patient.id, { start: '2026-11-03' }, 'melyssa', now), /Programs are created by the therapists/);
const first = assignProgram(state, program.id, patient.id, { start: '2026-11-03' }, 'clinical-director', now);
assert.equal(first.end, '2026-12-01', '4 weeks from the start');
assert.ok(state.notifications.length > before, 'the team is told');
assert.equal(programFor(state, patient.id, '2026-11-10').program.id, program.id);
assert.throws(() => assignProgram(state, program.id, patient.id, { start: '2026-11-03' }, 'clinical-director', now), /already on this program/);

const other = createProgram(state, { ...blank, name: 'Family repair' }, 'clinical-director', now);
assignProgram(state, other.id, patient.id, { start: '2026-11-10' }, 'clinical-director', now);
assert.equal(first.status, 'Ended', 'the earlier program ends when a new one starts');
assert.equal(programFor(state, patient.id, '2026-11-12').program.id, other.id);

const discharged = state.patients.find(item => item.status === 'Discharged');
assert.throws(() => assignProgram(state, other.id, discharged.id, { start: '2026-11-03' }, 'clinical-director', now), /admitted patient/);

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

await withSsr(async ({ load, html }) => {
  const { session } = await load('/src/lib/store.svelte.js');
  session.staffId = 'nazha';
  const page = await html('/src/pages/Programs.svelte', { args: [] });
  for (const text of ['Programs', 'New program', 'Assign']) assert.ok(page.includes(text), `therapist sees ${text}`);
  session.staffId = 'ahmed';
  const view = await html('/src/pages/Programs.svelte', { args: [] });
  assert.ok(view.includes('Programs') && !view.includes('New program'), 'Ahmed reads, does not build');
});

console.log('Program checks passed.');
