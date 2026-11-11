import assert from 'node:assert/strict';
import { applyCommand, COMMANDS, SYSTEM } from '../src/lib/commands.js';
import { viewFor } from '../src/lib/view.js';
import { seed } from '../src/lib/seed.js';

// Findings from the review of the local backend: every change is checked on the server, whatever a browser sends.
const now = new Date('2026-11-11T10:00:00');
const fresh = () => seed(now);
const refuses = (state, staffId, name, args, why) => assert.throws(() => applyCommand(state, name, args, staffId, now), Error, `${staffId} must not run ${name}${why ? ` (${why})` : ''}`);

// 1. Every command says who may run it; a resident may only look after their own space.
{
  const missing = Object.keys(COMMANDS).filter(name => !SYSTEM.has(name) && !COMMANDS[name].access);
  assert.deepEqual(missing, [], `no access rule for: ${missing.join(', ')}`);
  const state = fresh();
  const other = state.patients.find(item => item.status === 'Admitted' && item.id !== 'P-0001');
  refuses(state, 'resident-p0001', 'walletDeposit', [{ patientId: 'P-0001', amount: '9999', description: 'x' }], 'top-ups are Finance and Admin');
  refuses(state, 'resident-p0001', 'reviewRisk', [other.id, 'Low', 'fine']);
  refuses(state, 'georgio', 'reviewRisk', [other.id, 'Low', 'fine'], 'risk is the clinical team');
  refuses(state, 'resident-p0001', 'recordPrescription', [{ patientId: other.id, fileId: 'file-x', note: 'x' }]);
  refuses(state, 'georgio', 'recordPrescription', [{ patientId: other.id, fileId: 'file-x', note: 'x' }], 'prescriptions are Fadia');
  refuses(state, 'resident-p0001', 'createInquiry', [{ name: 'X', program: 'Inpatient' }]);
  refuses(state, 'ezdihar', 'replyToLead', [state.leads[0].id, 'hello']);
  refuses(state, 'resident-p0001', 'reportIncident', [{ type: 'Medical', level: 3, description: 'x' }]);
  refuses(state, 'resident-p0001', 'completeAppointment', [state.appointments.find(item => item.status === 'Booked').id]);
  // What a resident may do: their own requests and wellbeing check-in.
  const request = applyCommand(state, 'createRequest', [{ patientId: 'P-0001', item: 'Notebook', quantity: 1 }], 'resident-p0001', now);
  assert.equal(request.patientId, 'P-0001');
  refuses(state, 'resident-p0001', 'createRequest', [{ patientId: other.id, item: 'Notebook', quantity: 1 }], 'not someone else');
  // A task is closed by its owner or by intake, not by anyone.
  const task = state.tasks.find(item => item.status === 'open' && item.owner && item.owner !== 'georgio');
  refuses(state, 'georgio', 'completeTask', [task.id]);
}

// 2. Saving a form never overwrites a different record.
{
  const state = fresh();
  const intake = state.forms.find(entry => entry.formId === 'intake' && entry.status === 'Filed');
  const values = JSON.stringify(intake.values);
  refuses(state, 'georgio', 'fileForm', [{ entryId: intake.id, formId: 'access-log', values: {}, final: true }], 'another form');
  assert.equal(JSON.stringify(intake.values), values, 'the intake is untouched');
  const session = state.forms.find(entry => entry.formId === 'session' && entry.status === 'Filed');
  const ownerOfSession = session.createdBy;
  refuses(state, ownerOfSession, 'fileForm', [{ entryId: session.id, formId: 'session', patientId: 'P-9999', values: {}, final: false }], 'another patient');
}

// 3. A signature inside a form is always the signed-in person's.
{
  const state = fresh();
  const patient = state.patients.find(item => item.status === 'Admitted' && item.assigned?.psychologist === 'nabila');
  const entry = applyCommand(state, 'fileForm', [{ formId: 'intake', patientId: patient.id, values: { countersigned: { at: now.toISOString(), by: 'ahmed' } }, final: false }], 'nabila', now);
  assert.notEqual(entry.values.countersigned?.by, 'ahmed', 'a browser cannot sign in Ahmed\'s name');
  // signLater on a line with no named signer still needs someone who completes or sees that form.
  const note = state.forms.find(item => item.formId === 'session' && item.status === 'Filed');
  refuses(state, 'resident-p0001', 'signLater', [note.id, 'therapistSignature', { name: 'x', at: now.toISOString() }]);
}

// 4. Each person's view: only the pages their role opens.
{
  const state = fresh();
  const ezdihar = viewFor(state, 'ezdihar');
  for (const key of ['leads', 'inquiries', 'onboardings', 'requests', 'checkins', 'comments', 'visits', 'leaves']) assert.equal(ezdihar[key].length, 0, `housekeeping gets no ${key}`);
  assert.equal(ezdihar.wallet.transactions.length, 0);
  assert.ok(ezdihar.patients.every(patient => !patient.phone && !patient.contacts && !patient.monthlyAmount), 'no contact or money details');
  assert.ok(ezdihar.activity.every(item => item.by === 'ezdihar'));
  const georgio = viewFor(state, 'georgio');
  assert.equal(georgio.leads.length, 0, 'leads are for intake');
  assert.ok(georgio.patients.every(patient => patient.monthlyAmount === undefined && patient.guarantor === undefined), 'the floor sees no fees');
  assert.ok(georgio.onboardings.every(item => !item.steps?.payment?.amount && !item.steps?.financial?.guarantor));
  // Appointments (therapy sessions among them) go only to the roles that may see therapy bookings.
  assert.equal(ezdihar.appointments.length, 0);
  assert.equal(georgio.appointments.length, 0);
  assert.ok(viewFor(state, 'nabila').appointments.length > 0);
  const melyssa = viewFor(state, 'melyssa');
  assert.ok(melyssa.leads.length > 0 && melyssa.inquiries.length > 0, 'intake keeps its work');
}
console.log('Security checks passed.');
