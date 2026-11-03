import assert from 'node:assert/strict';
import { createInquiry, moveInquiry, declineInquiry, startFollowUp, scheduleAssessment, assessmentFor, ASSESSMENT_MODES } from '../src/lib/pipeline.js';
import { SERVICES } from '../src/lib/scheduling.js';
import { tasksFor } from '../src/lib/tasks.js';

const now = new Date('2026-11-03T09:00:00');
const empty = () => ({ inquiries: [], onboardings: [], appointments: [], patients: [], rooms: [], tasks: [], notifications: [], activity: [], documents: [], forms: [] });

assert.ok(SERVICES.some(service => service.name === 'Assessment' && service.provider === 'clinical-director'));
assert.deepEqual(ASSESSMENT_MODES, ['In person', 'Phone', 'Video']);

// Moving someone to Assessment means booking it: a date, a time, an assessor and how it happens.
const state = empty();
const inquiry = createInquiry(state, { name: 'Rami Aoun', phone: '+961 70 111 222' }, 'melyssa', now);
assert.throws(() => scheduleAssessment(state, inquiry.id, { date: '2026-11-04', start: '10:00' }, 'fadia', now), /cannot/i);
assert.throws(() => scheduleAssessment(state, inquiry.id, { date: '2026-11-04', start: '10:00', provider: 'john' }, 'melyssa', now), /Wael or Nabila/);
assert.throws(() => scheduleAssessment(state, inquiry.id, { date: '2026-11-04', start: '10:00', mode: 'Pigeon' }, 'melyssa', now), /in person, by phone or by video/);
const first = scheduleAssessment(state, inquiry.id, { date: '2026-11-04', start: '10:00', mode: 'Video' }, 'melyssa', now);
assert.equal(inquiry.stage, 'Assessment');
assert.equal(first.service, 'Assessment');
assert.equal(first.provider, 'clinical-director');
assert.equal(first.inquiryId, inquiry.id);
assert.equal(first.mode, 'Video');
assert.match(first.title, /Rami Aoun/);
assert.equal(assessmentFor(state, inquiry.id).id, first.id);
assert.ok(state.notifications.some(item => item.to === 'clinical-director' && /Rami Aoun/.test(item.title)), 'the assessor is told');

// Rebooking replaces the old slot; the assessor's calendar never double-books.
const second = scheduleAssessment(state, inquiry.id, { date: '2026-11-05', start: '11:00', provider: 'nabila' }, 'melyssa', now);
assert.equal(first.status, 'Cancelled');
assert.equal(assessmentFor(state, inquiry.id).id, second.id);
const other = createInquiry(state, { name: 'Lina Haddad', phone: '+961 70 333 444' }, 'melyssa', now);
assert.throws(() => scheduleAssessment(state, other.id, { date: '2026-11-05', start: '11:30', provider: 'nabila' }, 'melyssa', now), /overlaps/);

// Someone in Assessment with nothing booked becomes a task for their contact person.
moveInquiry(state, other.id, 'Assessment', 'melyssa', now);
const ask = () => tasksFor(state, 'melyssa', now).today.find(item => item.id === `assessment-${other.id}`);
assert.ok(ask(), 'book the assessment');
scheduleAssessment(state, other.id, { date: '2026-11-06', start: '09:00' }, 'melyssa', now);
assert.ok(!ask(), 'cleared once booked');

// Going back, into follow-up, or declining cancels the booked assessment; Agreement keeps it.
moveInquiry(state, inquiry.id, 'New Inquiry', 'melyssa', now);
assert.equal(second.status, 'Cancelled');
assert.equal(assessmentFor(state, inquiry.id), null);
const third = createInquiry(state, { name: 'Joe Nader', phone: '+961 70 555 666' }, 'melyssa', now);
const booked = scheduleAssessment(state, third.id, { date: '2026-11-07', start: '09:00' }, 'melyssa', now);
startFollowUp(state, third.id, {}, 'melyssa', now);
assert.equal(booked.status, 'Cancelled');
const fourth = createInquiry(state, { name: 'Maha Sabbagh', phone: '+961 70 777 888' }, 'melyssa', now);
const kept = scheduleAssessment(state, fourth.id, { date: '2026-11-07', start: '11:00' }, 'melyssa', now);
moveInquiry(state, fourth.id, 'Agreement', 'melyssa', now);
assert.equal(kept.status, 'Booked');
const fifth = createInquiry(state, { name: 'Nour Saleh', phone: '+961 70 999 000' }, 'melyssa', now);
const gone = scheduleAssessment(state, fifth.id, { date: '2026-11-07', start: '14:00' }, 'melyssa', now);
declineInquiry(state, fifth.id, 'Chose another centre', 'melyssa', now);
assert.equal(gone.status, 'Cancelled');

// Moving a booking half an hour with the same assessor is not a clash with itself; a failed rebook keeps the old slot.
{
  const s = empty();
  const person = createInquiry(s, { name: 'Ziad Khoury', phone: '+961 70 121 212' }, 'melyssa', now);
  const a = scheduleAssessment(s, person.id, { date: '2026-11-04', start: '10:00' }, 'melyssa', now);
  const b = scheduleAssessment(s, person.id, { date: '2026-11-04', start: '10:30' }, 'melyssa', now);
  assert.equal(a.status, 'Cancelled');
  assert.equal(b.start, '10:30');
  const blocker = createInquiry(s, { name: 'Busy Slot', phone: '+961 70 343 434' }, 'melyssa', now);
  scheduleAssessment(s, blocker.id, { date: '2026-11-04', start: '14:00' }, 'melyssa', now);
  assert.throws(() => scheduleAssessment(s, person.id, { date: '2026-11-04', start: '14:00' }, 'melyssa', now), /overlaps/);
  assert.equal(b.status, 'Booked', 'the old slot stays when the new one fails');
}

console.log('Assessment checks passed.');
