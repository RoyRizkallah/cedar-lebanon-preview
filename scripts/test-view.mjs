import assert from 'node:assert/strict';
import { viewFor, resultFor } from '../src/lib/view.js';
import { formById } from '../src/lib/forms/engine.js';
import { seed } from '../src/lib/seed.js';

// What the server sends each person: only what their role may see.
const now = new Date('2026-11-11T10:00:00');
const state = seed(now);
const before = JSON.stringify(state);
const family = entry => formById(entry.formId)?.family;

const melyssa = viewFor(state, 'melyssa');
// Admin never receives clinical content: plans and discharge plans arrive only as their date, type, phase and sign-off.
const OPERATIONAL = ['patient', 'phase', 'plannedDischarge', 'dischargeDate', 'dischargeType', 'directorSignature', 'ahmedSignature'];
const clinicalContent = entry => family(entry) === 'clinical' && entry.formId !== 'aftercare' && !(['plan', 'discharge'].includes(entry.formId) && Object.keys(entry.values).every(key => OPERATIONAL.includes(key)));
assert.ok(!melyssa.forms.some(clinicalContent), 'admin never receives clinical records');
assert.ok(!melyssa.documents.some(doc => doc.type === 'Prescription'), 'nor prescriptions');
assert.ok(melyssa.forms.some(entry => entry.formId === 'aftercare'), 'but she keeps the follow-up log she runs');
assert.equal(melyssa.medication.orders.length, 0);

const georgio = viewFor(state, 'georgio');
assert.equal(georgio.finance.invoices.length, 0, 'the floor gets no books');
assert.ok(!georgio.patients.some(patient => patient.riskReviews), 'nor risk reviews');
assert.ok(!georgio.forms.some(clinicalContent));
assert.ok(georgio.medication.orders.length > 0, 'RSAs run the meds window');

const nabila = viewFor(state, 'nabila');
assert.ok(nabila.forms.some(entry => family(entry) === 'clinical'), 'the clinical team keeps clinical records');
assert.equal(nabila.finance.invoices.length, 0);

const amer = viewFor(state, 'amer');
const someone = state.notifications[0].to;
const theirs = viewFor(state, someone).notifications;
assert.ok(theirs.length > 0 && theirs.every(item => item.to === someone), 'only your own notifications');
assert.ok(amer.notifications.every(item => item.to === 'amer'));
assert.ok(amer.finance.invoices.length > 0);
assert.ok(!amer.forms.some(clinicalContent), 'the GM is not on the clinical team');

// Incidents keep the redaction the screens already apply.
const mazen = viewFor(state, 'mazen');
assert.ok(mazen.incidents.filter(item => item.patientId).every(item => item.redacted), 'Operations sees that it happened, not what');

// A resident gets their own space and nothing else.
const resident = viewFor(state, 'resident-p0001');
assert.deepEqual(resident.patients.map(patient => patient.id), ['P-0001']);
assert.ok(resident.wallet.transactions.every(item => item.patientId === 'P-0001'));
assert.ok(resident.requests.every(item => item.patientId === 'P-0001'));
assert.ok(resident.forms.every(entry => entry.formId === 'wellbeing' && entry.patientId === 'P-0001'));
for (const key of ['leads', 'inquiries', 'incidents', 'documents', 'activity', 'orders']) assert.equal(resident[key].length, 0, key);

assert.equal(JSON.stringify(state), before, 'the full state is never changed by making a view');

// What a change sends back is the person's own copy of the record, or nothing.
{
  const note = state.forms.find(entry => entry.formId === 'session');
  assert.equal(resultFor(note, viewFor(state, 'melyssa')), null, 'a session note never comes back to admin');
  assert.equal(resultFor(note, viewFor(state, 'nabila'))?.id, note.id);
  assert.equal(resultFor(3, melyssa), 3);
  assert.equal(resultFor({ conflicts: [] }, melyssa), null, 'an unnamed object is not passed on');
}
console.log('View checks passed.');
