import assert from 'node:assert/strict';
import { DOC_TYPES, addDocument, signDocument, attachScan } from '../src/lib/documents.js';
import { progressSummary } from '../src/lib/forms/engine.js';
import { seed } from '../src/lib/seed.js';
import { withSsr } from './lib/ssr.mjs';

assert.deepEqual(DOC_TYPES, ['Admission agreement', 'Consent', 'Prescription', 'Invoice (fatoura)', 'Other']);
const state = seed();
const patient = state.patients.find(item => item.status === 'Admitted');

const doc = addDocument(state, { patientId: patient.id, type: 'Consent', title: 'Family contact consent' }, 'melyssa');
assert.equal(doc.status, 'Awaiting signature');
signDocument(state, doc.id, { name: patient.fullName, at: new Date().toISOString(), image: 'data:image/png;base64,x' }, 'melyssa');
assert.equal(doc.status, 'Signed electronically');
assert.equal(doc.signedBy, patient.fullName);
assert.throws(() => signDocument(state, doc.id, { name: 'x', at: new Date().toISOString() }, 'melyssa'), /already signed/);
const scan = addDocument(state, { patientId: patient.id, type: 'Other', title: 'Referral letter' }, 'melyssa');
attachScan(state, scan.id, { fileId: 'file-1', fileName: 'letter.pdf' }, 'melyssa');
assert.equal(scan.status, 'Signed scan uploaded');
assert.throws(() => addDocument(state, { patientId: patient.id, type: 'Nope', title: 'x' }, 'melyssa'), /Choose a document type/);
assert.throws(() => addDocument(state, { patientId: patient.id, type: 'Consent', title: 'x' }, 'omar'), /cannot manage documents/);

// Fitness Form 5's automatic rows.
const fixture = { forms: [
  { formId: 'attendance', status: 'Filed', values: { patients: [{ patientId: 'P-X', attended: 'Attended' }, { patientId: 'P-Y', attended: 'Absent' }] } },
  { formId: 'attendance', status: 'Filed', values: { patients: [{ patientId: 'P-X', attended: 'Attended' }, { patientId: 'P-X', attended: 'Held' }] } },
  { formId: 'attendance', status: 'Filed', values: { patients: [{ patientId: 'P-X', attended: 'Absent' }] } },
  { formId: 'attendance', status: 'Draft', values: { patients: [{ patientId: 'P-X', attended: 'Absent' }] } },
  { formId: 'wellbeing', status: 'Filed', patientId: 'P-X', values: { energy: 4, sleep: 4, mood: 3, activityFeel: 5 } }
] };
const summary = progressSummary(fixture, 'P-X');
assert.equal(summary.attendancePct, 67);
assert.equal(summary.wellbeingAvg, 4);

await withSsr(async ({ load, html }) => {
  const { session, db } = await load('/src/lib/store.svelte.js');
  const id = db.patients.find(item => item.status === 'Admitted').id;
  const view = async (staff, tab = 'overview') => { session.staffId = staff; return html('/src/pages/Patients.svelte', { args: [id, tab] }); };

  const melyssa = await view('melyssa', 'clinical');
  assert.ok(melyssa.includes('Follow-up log'));
  assert.ok(!melyssa.includes('Intake Psychological Assessment'), 'admin never sees clinical forms');
  assert.ok(!melyssa.includes('>Clinical<'));
  assert.ok((await view('clinical-director', 'clinical')).includes('Intake Psychological Assessment'));
  // A direct link to a clinical form opens it for clinical staff and never for Admin.
  const intake = db.forms.find(entry => entry.formId === 'intake' && entry.patientId === id);
  session.staffId = 'clinical-director';
  assert.ok((await html('/src/pages/Patients.svelte', { args: [id, 'clinical', intake.id] })).includes('Risk notes &amp; basis'));
  session.staffId = 'melyssa';
  assert.ok(!(await html('/src/pages/Patients.svelte', { args: [id, 'clinical', intake.id] })).includes('Risk notes &amp; basis'));

  const rsa = await view('omar');
  const tabs = [...rsa.matchAll(/class="tab-link[^"]*"[^>]*>([^<]+)</g)].map(match => match[1].trim());
  assert.deepEqual(tabs, ['Overview', 'Wallet & requests'.replace('&', '&amp;')]);

  const fitness = await view('john', 'fitness');
  for (const text of ['Physical Assessment &amp; Activity Clearance', 'Weekly Wellbeing Check-in']) assert.ok(fitness.includes(text), text);
  assert.ok((await view('fadia', 'medical')).includes('Prescriptions'));

  session.staffId = 'nabila';
  const list = await html('/src/pages/Patients.svelte', { args: [] });
  assert.ok(list.includes('Weekly case review'));
  session.staffId = 'melyssa';
  assert.ok(!(await html('/src/pages/Patients.svelte', { args: [] })).includes('Weekly case review'));
  // Ahmed signs case reviews; he is never offered an empty form he cannot fill.
  session.staffId = 'ahmed';
  assert.ok(!(await html('/src/pages/Patients.svelte', { args: [] })).includes('Weekly case review'));
});

console.log('Patient checks passed.');
