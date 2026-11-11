import assert from 'node:assert/strict';
import { createInquiry, updateInquiry, scheduleAssessment, assessmentFor, markNoShow } from '../src/lib/pipeline.js';
import { tasksFor } from '../src/lib/tasks.js';

// From the owner's meeting notes (the points that don't depend on the SOP questions).
const now = new Date('2026-11-11T09:00:00');
const empty = () => ({ inquiries: [], onboardings: [], appointments: [], patients: [], rooms: [], tasks: [], notifications: [], activity: [], documents: [], forms: [] });

// A referral records who referred them.
{
  const state = empty();
  assert.throws(() => createInquiry(state, { name: 'Rola Nassar', source: 'Referral' }, 'melyssa', now), /who referred/);
  const rola = createInquiry(state, { name: 'Rola Nassar', source: 'Referral', referrerName: 'Dr. Haddad' }, 'melyssa', now);
  assert.equal(rola.referrerName, 'Dr. Haddad');
  assert.throws(() => updateInquiry(state, rola.id, { referrerName: '' }, 'melyssa'), /who referred/);
  assert.equal(rola.referrerName, 'Dr. Haddad', 'a refused save changes nothing');
  const walkIn = createInquiry(state, { name: 'Sami Aoun', source: 'Walk-in', referrerName: 'ignored' }, 'melyssa', now);
  assert.equal(walkIn.referrerName, '', 'only referrals keep a referrer');
}

// An assessment can be marked no-show from the card; they stay in Assessment and rebooking becomes a task.
{
  const state = empty();
  const person = createInquiry(state, { name: 'Nadim Saad' }, 'melyssa', now);
  const booked = scheduleAssessment(state, person.id, { date: '2026-11-12', start: '10:00' }, 'melyssa', now);
  assert.throws(() => markNoShow(state, person.id, 'fadia', now), /cannot/);
  markNoShow(state, person.id, 'melyssa', now);
  assert.equal(booked.status, 'No-show');
  assert.equal(person.noShows, 1);
  assert.equal(person.stage, 'Assessment');
  assert.equal(assessmentFor(state, person.id), null, 'nothing is booked any more');
  const task = tasksFor(state, 'melyssa', now).today.find(item => item.id === `assessment-${person.id}`);
  assert.match(task?.sub || '', /Did not come/);
  assert.throws(() => markNoShow(state, person.id, 'melyssa', now), /no booked assessment/);
}

console.log('Meeting note checks passed.');
