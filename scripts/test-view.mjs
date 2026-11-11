import assert from 'node:assert/strict';
import { viewFor } from '../src/lib/view.js';
import { formById } from '../src/lib/forms/engine.js';
import { seed } from '../src/lib/seed.js';

// What the server sends each person: only what their role may see.
const now = new Date('2026-11-11T10:00:00');
const state = seed(now);
const before = JSON.stringify(state);
const family = entry => formById(entry.formId)?.family;

const melyssa = viewFor(state, 'melyssa');
assert.ok(!melyssa.forms.some(entry => family(entry) === 'clinical' && entry.formId !== 'aftercare'), 'admin never receives clinical records');
assert.ok(!melyssa.documents.some(doc => doc.type === 'Prescription'), 'nor prescriptions');
assert.ok(melyssa.forms.some(entry => entry.formId === 'aftercare'), 'but she keeps the follow-up log she runs');
assert.equal(melyssa.medication.orders.length, 0);

const georgio = viewFor(state, 'georgio');
assert.equal(georgio.finance.invoices.length, 0, 'the floor gets no books');
assert.ok(!georgio.patients.some(patient => patient.riskReviews), 'nor risk reviews');
assert.ok(!georgio.forms.some(entry => family(entry) === 'clinical'));
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
assert.ok(!amer.forms.some(entry => family(entry) === 'clinical'), 'the GM is not on the clinical team');

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
console.log('View checks passed.');
