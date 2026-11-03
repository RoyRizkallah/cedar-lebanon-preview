import assert from 'node:assert/strict';
import { CLINICAL_FORMS } from '../src/lib/forms/clinical.js';
import { FITNESS_FORMS } from '../src/lib/forms/fitness.js';
import { formById, allFields, computeAuto, isSectionLocked, validateForm, fileForm, signLater, riskLevel } from '../src/lib/forms/engine.js';
import { seed } from '../src/lib/seed.js';
import { withSsr } from './lib/ssr.mjs';
import { notesOverdue } from '../src/lib/scheduling.js';

assert.equal(CLINICAL_FORMS.length, 8);
assert.equal(FITNESS_FORMS.length, 6);
assert.deepEqual(CLINICAL_FORMS.map(form => form.title), ['Intake Psychological Assessment', 'Treatment Plan', 'Individual Session Note', 'Group Session Note', 'Case Review Record', 'Family Session Record', 'Discharge & Aftercare Plan', 'Post-Discharge Follow-up Log']);
assert.deepEqual(FITNESS_FORMS.map(form => form.title), ['Physical Assessment & Activity Clearance', 'Session Attendance & Observation Log', 'Injury Report', 'Weekly Wellbeing Check-in', 'Progress Record', 'Nutrition Assessment']);

const intake = formById('intake');
const riskFields = allFields(intake).filter(field => field.type === 'lmh');
assert.deepEqual(riskFields.map(field => field.label), ['Self-harm / suicide risk', 'Absconding risk', 'Aggression risk']);

const session = formById('session');
assert.deepEqual(allFields(session).find(field => field.label === 'Attendance').options, ['Attended', 'Refused', 'Rescheduled']);

const clearance = formById('clearance');
assert.equal(computeAuto(clearance, { weight: 80, height: 180 }).bmi, 24.7);
assert.equal(computeAuto(clearance, { weight: '', height: 180 }).bmi, '');
assert.equal(isSectionLocked(clearance.sections[1], { medicallyCleared: 'No' }), true);
assert.equal(isSectionLocked(clearance.sections[1], { medicallyCleared: 'Yes' }), false);

// Drafts save with anything missing; filing needs the required fields and the author's signatures.
assert.deepEqual(validateForm(session, {}, { final: false }), []);
assert.ok(validateForm(session, {}, { final: true }).includes('Therapist signature is required.'));
assert.ok(validateForm(session, { riskFlags: ['Self-harm'] }, { final: true }).includes('If flagged — escalated to, same day is required.'));

const state = seed();
const patient = state.patients.find(item => item.status === 'Admitted');
const before = state.notifications.filter(item => item.to === 'ahmed').length;
const signature = { name: 'Clinical Director', by: 'clinical-director', at: new Date().toISOString() };
assert.throws(() => fileForm(state, { formId: 'intake', patientId: patient.id, values: { riskAggression: 'High' }, staffId: 'clinical-director', final: true }), /Risk notes & basis is required/);
const filed = fileForm(state, { formId: 'intake', patientId: patient.id, values: { riskSelfHarm: 'Low', riskAbscond: 'Low', riskAggression: 'High', riskNotes: 'Threatened staff on arrival.', conductedBy: signature }, staffId: 'clinical-director', final: true });
assert.equal(filed.status, 'Filed');
assert.equal(state.notifications.filter(item => item.to === 'ahmed').length, before + 1);
assert.equal(riskLevel(state, patient.id), 'High');

// A countersignature can be added after filing, only by the person it names.
assert.throws(() => signLater(state, filed.id, 'countersigned', { name: 'Nabila', by: 'nabila', at: new Date().toISOString() }, 'nabila'), /Only Wael can sign this/);
signLater(state, filed.id, 'countersigned', signature, 'clinical-director');
assert.equal(filed.values.countersigned.by, 'clinical-director');

// Filing the discharge plan sets the day and tells Melyssa; the discharge itself (and the aftercare calls) come on that day.
const discharge = fileForm(state, { formId: 'discharge', patientId: patient.id, values: { dischargeDate: '2026-11-10', dischargeType: 'Planned', patientCopy: { name: patient.fullName, by: 'clinical-director', at: new Date().toISOString() } }, staffId: 'clinical-director', final: true });
assert.equal(discharge.status, 'Filed');
assert.equal(patient.status, 'Admitted');
assert.ok(state.notifications.some(item => item.to === 'melyssa' && item.title.startsWith('Discharge planned')));
assert.equal(state.tasks.filter(task => task.kind === 'followup-call' && task.patientId === patient.id).length, 0);

// A note started from the patient's Clinical tab (no appointment passed) still clears that session's reminder.
{
  const fresh = seed();
  const [late] = notesOverdue(fresh, 'nabila');
  assert.ok(late, 'the seed has one overdue note');
  const note = fileForm(fresh, { formId: 'session', patientId: late.patientId, values: { date: late.date, attendance: 'Attended', riskFlags: ['None'], therapistSignature: { name: 'Nabila', by: 'nabila', at: new Date().toISOString() } }, staffId: 'nabila', final: true });
  assert.equal(late.noteFormId, note.id);
  assert.equal(note.appointmentId, late.id);
  assert.deepEqual(notesOverdue(fresh, 'nabila'), []);
}

// Every form renders, blank for its first owner, and the gate shows while it is closed.
await withSsr(async ({ load, html }) => {
  const { session, db } = await load('/src/lib/store.svelte.js');
  const patientId = db.patients.find(item => item.status === 'Admitted').id;
  for (const form of [...CLINICAL_FORMS, ...FITNESS_FORMS]) {
    session.staffId = form.owners[0];
    const page = await html('/src/components/FormView.svelte', { formId: form.id, patientId: form.multi ? null : patientId, onclose() {} });
    assert.ok(page.includes(form.title.replaceAll('&', '&amp;')), form.id);
  }
  session.staffId = 'fadia';
  assert.ok((await html('/src/components/FormView.svelte', { formId: 'clearance', patientId, onclose() {} })).includes('Gate two below is not started'));

  // The carried risk rating shows while writing a session note or plan; dictation is offered on a new note only.
  session.staffId = 'nabila';
  const highRisk = db.patients.find(item => item.id === 'P-0002').id;
  const note = await html('/src/components/FormView.svelte', { formId: 'session', patientId: highRisk, onclose() {} });
  assert.ok(note.includes('High risk'), 'risk banner on a session note');
  assert.ok(note.includes('Dictate this note'));
  assert.ok((await html('/src/components/FormView.svelte', { formId: 'plan', patientId: highRisk, onclose() {} })).includes('High risk'));
  const filedNote = db.forms.find(entry => entry.formId === 'session' && entry.status === 'Filed');
  assert.ok(!(await html('/src/components/FormView.svelte', { formId: 'session', entryId: filedNote.id, onclose() {} })).includes('Dictate this note'));
  assert.ok((await html('/src/components/FormView.svelte', { formId: 'review', onclose() {} })).includes('Prepare this week'));
  session.staffId = 'clinical-director';
  const calm = db.patients.find(item => item.status === 'Admitted' && !['P-0002', 'P-0003'].includes(item.id)).id;
  assert.ok(!(await html('/src/components/FormView.svelte', { formId: 'session', patientId: calm, onclose() {} })).includes(' risk</strong>'), 'no banner for low risk');
});

console.log('Forms checks passed.');
