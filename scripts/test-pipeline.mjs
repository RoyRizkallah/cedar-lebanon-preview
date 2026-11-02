import assert from 'node:assert/strict';
import { STAGES, PROGRAMS, COMM_PREFS, RELATIONSHIPS, startFollowUp, followUpAgain, runFollowUpAlerts, createInquiry, updateInquiry, moveInquiry, declineInquiry, logCall, reviewDue, potentialTotals, sendClarification, timeInStageHours } from '../src/lib/pipeline.js';
import { seed } from '../src/lib/seed.js';
import { tasksFor } from '../src/lib/tasks.js';
import { withSsr } from './lib/ssr.mjs';

assert.deepEqual(STAGES, ['New Inquiry', 'Assessment', 'Agreement']);
assert.deepEqual(PROGRAMS, ['Inpatient', 'Outpatient', 'Detox', 'Detox + Inpatient']);
assert.deepEqual(COMM_PREFS, ['Phone call', 'WhatsApp', 'Email', 'Not comfortable talking on the phone']);

const now = new Date('2026-11-02T10:00:00');
const state = seed(now);
const before = state.notifications.length;

// Revenue is always a number; two follow-up calls are booked at one week and one month.
const inquiry = createInquiry(state, { name: 'Test Person', potentialRevenue: '', contactPerson: 'melyssa' }, 'melyssa', now);
assert.equal(inquiry.potentialRevenue, 0);
const followups = state.tasks.filter(task => task.inquiryId === inquiry.id);
assert.deepEqual(followups.map(task => [task.title, task.due]), [['Follow-up call 1 of 2', '2026-11-09'], ['Final follow-up call', '2026-12-02']]);
assert.equal(state.notifications.length, before, 'normal inquiries alert nobody');
assert.throws(() => createInquiry(state, { name: '  ' }, 'melyssa', now), /Add the person’s name/);

// Dropping a card on its own column changes nothing.
moveInquiry(state, inquiry.id, 'New Inquiry', 'melyssa', now);
assert.equal(inquiry.stageHistory.length, 1);
moveInquiry(state, inquiry.id, 'Assessment', 'melyssa', new Date('2026-11-03T10:00:00'));
assert.equal(inquiry.stageHistory.length, 2);
assert.equal(timeInStageHours(inquiry, new Date('2026-11-03T16:00:00')), 6);

// The 48-hour review flag applies to New Inquiry only.
const fresh = createInquiry(state, { name: 'Fresh Lead' }, 'melyssa', now);
assert.equal(reviewDue(fresh, new Date('2026-11-04T09:00:00')), false);
assert.equal(reviewDue(fresh, new Date('2026-11-04T10:00:00')), true);
assert.equal(reviewDue(inquiry, new Date('2026-11-10T10:00:00')), false);

// Declining stops the scheduled follow-ups.
declineInquiry(state, fresh.id, 'Went elsewhere', 'melyssa', now);
assert.deepEqual(state.tasks.filter(task => task.inquiryId === fresh.id).map(task => task.status), ['cancelled', 'cancelled']);
assert.throws(() => moveInquiry(state, fresh.id, 'Assessment', 'melyssa', now), /closed as Declined/);

// Marking urgent alerts both partners, Wael and the contact person — once.
const count = () => state.notifications.length;
const start = count();
updateInquiry(state, inquiry.id, { urgency: 'Urgent' }, 'melyssa');
const alerts = state.notifications.slice(0, count() - start);
assert.deepEqual(alerts.map(item => item.to).sort(), ['ahmed', 'amer', 'clinical-director', 'melyssa']);
assert.ok(alerts.every(item => item.link === `#/pipeline/${inquiry.id}` && item.channels.includes('WhatsApp (queued)')));
updateInquiry(state, inquiry.id, { urgency: 'Urgent', phone: '+961 70 000 000' }, 'melyssa');
assert.equal(count(), start + 4);

// A save that fails changes nothing, so a later retry still raises the urgent alert.
const careful = createInquiry(state, { name: 'Careful Save', potentialRevenue: 1000 }, 'melyssa', now);
const alertsBefore = state.notifications.length;
assert.throws(() => updateInquiry(state, careful.id, { name: '', urgency: 'Urgent', potentialRevenue: 9000 }, 'melyssa'), /Add the person’s name/);
assert.deepEqual([careful.name, careful.urgency, careful.potentialRevenue], ['Careful Save', 'Normal', 1000]);
updateInquiry(state, careful.id, { name: 'Careful Save', urgency: 'Urgent' }, 'melyssa');
assert.equal(state.notifications.length, alertsBefore + 4);

const call = logCall(state, inquiry.id, { outcome: 'Reached', notes: 'Booked assessment' }, 'melyssa', now);
assert.equal(call.by, 'melyssa');
assert.throws(() => logCall(state, inquiry.id, { outcome: 'Maybe' }, 'melyssa'), /Choose how the call went/);

const totals = potentialTotals({ inquiries: [{ stage: 'New Inquiry', potentialRevenue: 3000 }, { stage: 'Assessment', potentialRevenue: 5000 }, { stage: 'Agreement', potentialRevenue: 7000 }, { stage: 'Assessment', potentialRevenue: 9999, outcome: 'Declined' }, { stage: 'New Inquiry' }] });
assert.deepEqual(totals, { inquiry: 3000, assessment: 5000, combined: 8000, agreement: 7000 });

const shy = createInquiry(state, { name: 'Quiet Person', source: 'Phone', commPreference: 'Not comfortable talking on the phone' }, 'melyssa', now);
assert.equal(sendClarification(state, shy.id, 'melyssa', now), 'WhatsApp');
const mail = createInquiry(state, { name: 'Mail Person', source: 'Instagram', commPreference: 'Email' }, 'melyssa', now);
assert.equal(sendClarification(state, mail.id, 'melyssa', now), 'Email');

// Who is inquiring: the person themselves or someone close to them.
assert.ok(RELATIONSHIPS.includes('Parent') && RELATIONSHIPS[0] === 'Self');
const mother = createInquiry(state, { name: 'Youssef Haddad', relationship: 'Parent', callerName: 'Mona Haddad' }, 'melyssa', now);
assert.deepEqual([mother.relationship, mother.callerName], ['Parent', 'Mona Haddad']);
assert.equal(createInquiry(state, { name: 'Self Caller', relationship: 'Neighbour?' }, 'melyssa', now).relationship, 'Self');

// Not ready for an assessment: the inquiry waits in Follow-up, and the contact person is reminded when it is due.
const waiting = createInquiry(state, { name: 'Needs Time', potentialRevenue: 4000 }, 'melyssa', now);
const potentialBefore = potentialTotals(state).inquiry;
startFollowUp(state, waiting.id, { days: 2, note: 'Wants to talk after payday' }, 'melyssa', now);
assert.equal(waiting.stage, 'Follow-up');
assert.equal(waiting.followUp.due, '2026-11-04');
assert.equal(waiting.stageHistory.at(-1).stage, 'Follow-up');
assert.equal(potentialTotals(state).inquiry, potentialBefore - 4000, 'follow-ups are not counted as new-inquiry potential');
const alertsFor = () => state.notifications.filter(item => item.to === 'melyssa' && item.link === `#/followups/${waiting.id}`).length;
runFollowUpAlerts(state, new Date('2026-11-03T10:00:00'));
assert.equal(alertsFor(), 0, 'not due yet');
runFollowUpAlerts(state, new Date('2026-11-04T08:00:00'));
assert.equal(alertsFor(), 1, 'due: one reminder');
runFollowUpAlerts(state, new Date('2026-11-04T15:00:00'));
assert.equal(alertsFor(), 1, 'never twice for the same round');
assert.ok(tasksFor(state, 'melyssa', new Date('2026-11-04T09:00:00')).today.some(item => item.title === 'Follow up with Needs Time'));
followUpAgain(state, waiting.id, { days: 2, outcome: 'No answer' }, 'melyssa', new Date('2026-11-04T11:00:00'));
assert.deepEqual([waiting.followUp.due, waiting.followUp.round, waiting.followUp.notified], ['2026-11-06', 2, false]);
assert.equal(waiting.calls.at(-1).outcome, 'No answer');
moveInquiry(state, waiting.id, 'Assessment', 'melyssa', new Date('2026-11-06T10:00:00'));
assert.equal(waiting.stage, 'Assessment');
assert.equal(waiting.followUp, undefined, 'scheduling the assessment ends the follow-up');
assert.throws(() => startFollowUp(state, waiting.id, { days: 0 }, 'melyssa', now), /at least one day/);

await withSsr(async ({ load, html }) => {
  const { session } = await load('/src/lib/store.svelte.js');
  session.staffId = 'melyssa';
  const page = await html('/src/pages/Pipeline.svelte', { args: [] });
  for (const text of ['Pipeline', 'New Inquiry', 'Assessment', 'Agreement', 'Omar Itani', 'Urgent', 'Review due', 'Move to']) assert.ok(page.includes(text), text);
  const drawer = await html('/src/pages/Pipeline.svelte', { args: ['INQ-0016'] });
  for (const text of ['Omar Itani', 'Log call', 'Stage history', 'Follow-up call 1 of 2']) assert.ok(drawer.includes(text), text);
});

console.log('Pipeline checks passed.');
