import assert from 'node:assert/strict';
import { DRUGS, ROOM_PREFERENCES, ROOM_RATES, createInquiry, updateInquiry, drugLabel, scheduleAssessment, assessmentFor, runInquiryAging, recordFollowUp, ASSESSORS, assessorName, FOLLOW_UP } from '../src/lib/pipeline.js';
import { STEPS, STEP_OWNERS, STEP_LABELS, freeBeds, bedName, placeLabel } from '../src/lib/admission.js';
import { STAFF, canDo, canSee } from '../src/lib/people.js';
import { seed } from '../src/lib/seed.js';

// Decisions from the owner's meeting notes and his reply of 11 November 2026.
const now = new Date('2026-11-11T09:00:00');
const empty = () => ({ inquiries: [], onboardings: [], appointments: [], patients: [], rooms: [], tasks: [], notifications: [], activity: [], documents: [], forms: [] });

// Staff: Wael has left; Ahmed is Clinical Director; Nabila and Samar are the psychologists.
assert.ok(!STAFF.some(person => person.name === 'Wael'));
assert.equal(STAFF.find(person => person.id === 'ahmed').title, 'Clinical Director');
assert.deepEqual(STAFF.filter(person => person.roles.includes('psychologist')).map(person => [person.name, person.title]), [['Nabila', 'Psychologist'], ['Samar', 'Psychologist']]);
assert.ok(canDo('ahmed', 'reviewIncident') && canDo('ahmed', 'caseReview'));

// Whoever owns an admission step can open the Admissions page to do it.
for (const step of STEPS) for (const id of STEP_OWNERS[step]) assert.ok(canSee(id, 'admissions'), `${id} owns ${step} but cannot open Admissions`);

// Inquiry details: Ketamine and a typed "Other"; previous detox and rehab, each with what it was; the room wanted, with its rate.
{
  const state = empty();
  assert.ok(DRUGS.includes('Ketamine'));
  assert.throws(() => createInquiry(state, { name: 'Sam Daher', drugOfChoice: 'Other' }, 'melyssa', now), /Type the drug/);
  const sam = createInquiry(state, { name: 'Sam Daher', drugOfChoice: 'Other', drugOther: 'Pregabalin', previousDetox: 'Yes', detoxDetail: 'Two weeks at a hospital in 2024', previousRehab: 'No', roomPreference: 'Private room' }, 'melyssa', now);
  assert.equal(drugLabel(sam), 'Pregabalin');
  assert.equal(sam.detoxDetail, 'Two weeks at a hospital in 2024');
  assert.equal(sam.roomPreference, 'Private room');
  assert.equal(sam.potentialRevenue, 12000, 'the room sets the monthly rate when none is given');
  assert.deepEqual(ROOM_PREFERENCES, ['Standard room', 'Private room', 'Bungalow']);
  assert.deepEqual(ROOM_RATES, { 'Standard room': 7500, 'Private room': 12000, Bungalow: 15000 });
  assert.throws(() => updateInquiry(state, sam.id, { previousRehab: 'Yes', rehabDetail: '' }, 'melyssa'), /where and when the previous rehab/);
  assert.equal(sam.previousRehab, 'No', 'a refused save changes nothing');
  updateInquiry(state, sam.id, { previousRehab: 'Yes', rehabDetail: 'Three months in Cyprus, 2023' }, 'melyssa');
  assert.equal(sam.rehabDetail, 'Three months in Cyprus, 2023');
}

// Urgent inquiries reach Amer and Ahmad, plus the contact person.
{
  const state = empty();
  createInquiry(state, { name: 'Urgent Case', urgency: 'Urgent' }, 'melyssa', now);
  assert.deepEqual(state.notifications.map(item => item.to).sort(), ['ahmed', 'amer', 'melyssa']);
}

// The assessor is Amer, Ahmad, or someone typed in.
{
  const state = empty();
  assert.deepEqual(ASSESSORS, ['amer', 'ahmed', 'other']);
  const person = createInquiry(state, { name: 'Nadim Saad' }, 'melyssa', now);
  assert.throws(() => scheduleAssessment(state, person.id, { date: '2026-11-12', start: '10:00', assessor: 'nabila' }, 'melyssa', now), /Amer, Ahmad or someone you name/);
  assert.throws(() => scheduleAssessment(state, person.id, { date: '2026-11-12', start: '10:00', assessor: 'other', assessorName: '' }, 'melyssa', now), /Type the assessor/);
  const outside = scheduleAssessment(state, person.id, { date: '2026-11-12', start: '10:00', assessor: 'other', assessorName: 'Dr. Rami Khoury' }, 'melyssa', now);
  assert.equal(assessorName(outside), 'Dr. Rami Khoury');
  const amer = scheduleAssessment(state, person.id, { date: '2026-11-12', start: '11:00', assessor: 'amer' }, 'melyssa', now);
  assert.equal(assessorName(amer), 'Amer Khattab');
  assert.equal(outside.status, 'Cancelled', 'rebooking replaces the earlier slot');
  assert.equal(assessmentFor(state, person.id).id, amer.id);
}

// Going quiet: after 72 hours in New Inquiry it moves to the follow-up log, due one week after the first contact;
// after that follow-up, with no assessment booked, it moves to its own log.
{
  const state = empty();
  const created = new Date(now.getTime() - 73 * 3600000);
  const stale = createInquiry(state, { name: 'Stale Lead' }, 'melyssa', created);
  const fresh = createInquiry(state, { name: 'Fresh Lead' }, 'melyssa', new Date(now.getTime() - 10 * 3600000));
  runInquiryAging(state, now);
  assert.equal(stale.stage, FOLLOW_UP);
  assert.equal(stale.followUp.due, '2026-11-15', 'one week after the first inquiry');
  assert.equal(fresh.stage, 'New Inquiry');
  recordFollowUp(state, stale.id, { outcome: 'No answer', note: 'Voicemail' }, 'melyssa', new Date('2026-11-15T10:00:00'));
  assert.equal(stale.stage, 'Inactive', 'no assessment after the follow-up: into its own log');
  assert.equal(stale.calls.at(-1).outcome, 'No answer');
  // Booking an assessment from the log brings them back.
  scheduleAssessment(state, stale.id, { date: '2026-11-20', start: '10:00', assessor: 'ahmed' }, 'melyssa', new Date('2026-11-16T10:00:00'));
  assert.equal(stale.stage, 'Assessment');
}

// Admissions gains a physiotherapy step, owned by John.
assert.deepEqual(STEPS.slice(0, 3), ['nursing', 'physio', 'psychologist']);
assert.ok(STEP_OWNERS.physio.includes('john'));
assert.equal(STEP_LABELS.physio, 'Physiotherapy assessment');

// Rooms as the centre has them: Upper floor 1–4 (beds a, b), Ground floor Bungalow 1 (one bed), Lower floor 5 (a, b, c), 6 and 7 (a, b).
{
  const state = seed(now);
  const layout = state.rooms.map(room => `${room.wing}:${room.id}:${room.beds}:${room.type}`);
  assert.deepEqual(layout, ['Upper:1:2:Standard', 'Upper:2:2:Standard', 'Upper:3:2:Standard', 'Upper:4:2:Standard', 'Ground:Bungalow 1:1:Bungalow', 'Lower:5:3:Standard', 'Lower:6:2:Standard', 'Lower:7:2:Standard']);
  assert.equal(bedName(state.rooms[0], 1), 'a');
  assert.equal(bedName(state.rooms[5], 3), 'c');
  assert.equal(bedName(state.rooms[4], 1), '', 'a one-bed room has no letter');
  assert.equal(placeLabel(state, '1', 2), 'Room 1, bed b');
  assert.equal(placeLabel(state, 'Bungalow 1', 1), 'Bungalow 1');
  assert.ok(freeBeds(state, null, 'Bungalow').every(([room]) => room === 'Bungalow 1'));
  for (const [room] of freeBeds(state, null, 'Private room')) assert.ok(!state.patients.some(item => item.status === 'Admitted' && item.roomId === room), `${room} is empty`);
  assert.ok(freeBeds(state, null, 'Standard room').every(([room]) => room !== 'Bungalow 1'));
}

console.log('Meeting checks passed.');
