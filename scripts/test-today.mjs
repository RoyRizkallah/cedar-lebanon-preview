import assert from 'node:assert/strict';
import { houseToday, milestonesFor, floorNotes, teamFeed } from '../src/lib/today.js';
import { roundFor } from '../src/lib/medication.js';
import { addDays, todayISO } from '../src/lib/dates.js';
import { seed } from '../src/lib/seed.js';
import { STAFF } from '../src/lib/people.js';
import { withSsr } from './lib/ssr.mjs';

const now = new Date();
const today = todayISO(now);
const state = seed();
const admitted = state.patients.filter(patient => patient.status === 'Admitted');

// In the house: a strip of live counts, each shown only to people who can open what it links to.
const amer = houseToday(state, 'amer', now);
assert.equal(amer.find(item => item.id === 'in-care').value, admitted.length);
assert.ok(!amer.some(item => item.id === 'doses'), 'Amer does not run medication');
const fadia = houseToday(state, 'fadia', now);
assert.equal(fadia.find(item => item.id === 'doses').value, roundFor(state, today).filter(item => item.status === 'Due').length);
assert.ok(!houseToday(state, 'georgio', now).some(item => item.id === 'doses' || item.id === 'arriving'));
for (const item of amer) assert.ok(item.label && item.link?.startsWith('#/'), item.id);

// Milestones this week: stay days, programs finishing, planned discharges, for the patients the person can see.
{
  const s = seed();
  const patient = s.patients.find(item => item.status === 'Admitted' && item.program !== 'Outpatient');
  patient.admittedAt = addDays(today, -27); // day 30 falls in 2 days
  const list = milestonesFor(s, 'ahmed', now);
  const day30 = list.find(item => item.patientId === patient.id && item.kind === 'stay');
  assert.ok(day30, 'day 30 is a milestone');
  assert.equal(day30.date, addDays(today, 2));
  assert.match(day30.text, /Day 30/);
  assert.deepEqual(list.map(item => item.date), [...list.map(item => item.date)].sort(), 'in date order');
  assert.ok(list.every(item => item.date >= today && item.date <= addDays(today, 7)));
  const assignment = s.programAssignments.find(item => item.status === 'Active');
  assignment.end = addDays(today, 4);
  const finishing = milestonesFor(s, 'ahmed', now).find(item => item.kind === 'program' && item.patientId === assignment.patientId);
  assert.equal(finishing.date, addDays(today, 3), 'the last day on the program');
  // An RSA only hears about their own residents.
  const mine = new Set(s.patients.filter(item => item.assigned?.rsa === 'alaa').map(item => item.id));
  assert.ok(milestonesFor(s, 'alaa', now).every(item => mine.has(item.patientId)));
}

// From the floor: check-ins that flag something, and recent team comments.
{
  const notes = floorNotes(state, 'ahmed', now);
  assert.ok(notes.some(item => item.kind === 'checkin' && item.tone === 'warn'), 'a flagged check-in');
  assert.ok(!notes.some(item => item.kind === 'checkin' && /Settled/.test(item.text)), 'settled check-ins stay out');
  assert.ok(notes.length <= 6);
}

// Team activity: what colleagues did, newest first, never your own.
{
  const feed = teamFeed(state, 'melyssa', now);
  assert.ok(feed.length > 0);
  assert.ok(feed.every(item => item.by !== 'melyssa'));
  assert.ok(feed.every(item => STAFF.some(person => person.id === item.by)), 'only people, never the system');
  assert.ok(!state.activity.some(item => /^Booked /.test(item.text) && item.by === 'system'), 'program bookings do not flood the log');
  assert.deepEqual(feed.map(item => item.at), [...feed.map(item => item.at)].sort().reverse());
}

// Every member of staff starts the sample day with something real to do.
{
  const { tasksFor } = await import('../src/lib/tasks.js');
  for (const id of ['amer', 'ahmed', 'clinical-director', 'nazha', 'rabih', 'kteish', 'mazen', 'john', 'omar']) {
    const work = tasksFor(state, id, now);
    assert.ok(work.overdue.length + work.today.length + work.upcoming.length > 0, `${id} has work`);
  }
}

await withSsr(async ({ load, html }) => {
  const { session } = await load('/src/lib/store.svelte.js');
  session.staffId = 'ahmed';
  const page = await html('/src/pages/Today.svelte', { args: [] });
  for (const text of ['In the house', 'Milestones this week', 'From the floor', 'Team activity']) assert.ok(page.includes(text), text);
});

console.log('Today checks passed.');
