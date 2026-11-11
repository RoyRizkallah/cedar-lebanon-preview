import assert from 'node:assert/strict';
import { FORMS, formById, fileForm, prefillValues, formsFor } from '../src/lib/forms/engine.js';
import { addOrder, recordDose, correctDose } from '../src/lib/medication.js';
import { canDo, canSee, canSeeTab } from '../src/lib/people.js';

// Nursing & Medical forms from the owner's reply (Cedar_Rehab_Nursing_Forms + Admission Medical Assessment, SOP 2.1–2.7).
const empty = () => ({ patients: [{ id: 'P-1', fullName: 'Karim Haddad', clinicalName: 'Karim H.', status: 'Admitted', admittedAt: '2026-11-10', roomId: '1' }, { id: 'P-2', fullName: 'Lara Khalil', clinicalName: 'Lara K.', status: 'Admitted', admittedAt: '2026-11-01', roomId: '2' }, { id: 'P-3', fullName: 'Old Patient', clinicalName: 'Old P.', status: 'Discharged' }],
  forms: [], notifications: [], activity: [], tasks: [], appointments: [], medication: { orders: [], doses: [], tests: [] } });

// The forms on file. The MAR is the medication round itself and the Prescription Log is the medication list, so neither is a second paper copy.
const nursing = FORMS.filter(form => form.family === 'medical');
assert.deepEqual(nursing.map(form => form.id), ['admission-medical', 'access-log', 'box-prep', 'weekly-count', 'disposal', 'psych-consult', 'escort']);
assert.deepEqual(nursing.filter(form => form.ward).map(form => form.id), ['access-log', 'box-prep', 'weekly-count', 'disposal']);
assert.ok(nursing.every(form => !form.multi), 'no nursing form is a group form');

// SOP 2.1: the RSA running the meds window records each dose; prescriptions stay with Fadia (and Imad under her).
for (const id of ['omar', 'georgio', 'alaa', 'dania', 'imad', 'fadia']) assert.ok(canDo(id, 'giveMedication') && canSee(id, 'medication'), id);
for (const id of ['melyssa', 'john', 'nabila']) assert.ok(!canDo(id, 'giveMedication'), id);
assert.ok(!canDo('georgio', 'recordMedication'), 'RSAs do not start or stop medication');
{
  const state = empty();
  const order = addOrder(state, { patientId: 'P-1', drug: 'Diazepam', dose: '5 mg', times: ['08:00'], startDate: '2026-11-10' }, 'fadia');
  assert.throws(() => addOrder(state, { patientId: 'P-1', drug: 'X', dose: '1', times: ['08:00'] }, 'georgio'), /Fadia/);
  const dose = recordDose(state, { orderId: order.id, date: '2026-11-11', time: '08:00', status: 'Refused', note: 'Said he felt sick' }, 'georgio', new Date('2026-11-11T08:30:00'));
  assert.equal(dose.by, 'georgio');
  // Any refused or missed dose goes to the Head Nurse the same shift, and to Ahmed.
  assert.deepEqual(state.notifications.filter(item => item.title === 'Dose refused: Karim H.').map(item => item.to).sort(), ['ahmed', 'fadia']);
  // Corrections stay with Fadia and Imad.
  assert.throws(() => correctDose(state, dose.id, { status: 'Given', reason: 'tapped wrong' }, 'georgio'), /Fadia/);
}

// RSAs reach the patient's Medical tab for the escort log; prescriptions there stay hidden from them.
assert.ok(canSeeTab('omar', 'medical') && canSeeTab('georgio', 'medical'));
assert.ok(!canDo('georgio', 'viewPrescriptions'));

// Admission Medical Assessment (SOP 2.4): the Head Nurse only; risk sets the first 72 hours; Ahmed is told.
{
  const state = empty();
  const form = formById('admission-medical');
  assert.throws(() => fileForm(state, { formId: 'admission-medical', patientId: 'P-1', values: {}, staffId: 'imad' }), /completed by Fadia/);
  const values = prefillValues(form, { state, patient: state.patients[0], staffId: 'fadia', now: new Date('2026-11-11T10:00:00') });
  assert.equal(values.patient, 'Karim H.');
  assert.deepEqual(values.monitoring.map(row => row.period), ['Day 1 (0–24 h)', 'Day 2 (24–48 h)', 'Day 3 (48–72 h)']);
  assert.throws(() => fileForm(state, { formId: 'admission-medical', patientId: 'P-1', values, staffId: 'fadia', final: true }), /Last use.*required/);
  const signed = { ...values, lastUse: 'Alcohol, half a bottle, last night', allergies: 'None known', withdrawalRisk: 'High', informed: 'Yes', signedBy: { at: '2026-11-11T10:30:00Z', by: 'fadia' } };
  fileForm(state, { formId: 'admission-medical', patientId: 'P-1', values: signed, staffId: 'fadia', final: true });
  const told = state.notifications.find(item => item.to === 'ahmed');
  assert.ok(told && /High withdrawal risk/.test(told.title), 'High risk is raised with Ahmed');
  assert.equal(formsFor(state, 'P-1', 'medical').length, 1);
}

// Off-site escort (SOP 2.7): RSAs complete it; Omar reviews on return.
{
  const state = empty();
  const entry = fileForm(state, { formId: 'escort', patientId: 'P-2', values: { patient: 'Lara K.', date: '2026-11-11', destination: 'Dentist, Jounieh', necessary: 'Confirmed (Head Nurse)', riskLevel: 'Standard, one escort', escorts: 'Georgio', escortSignature: { at: '2026-11-11T12:00:00Z' } }, staffId: 'georgio', final: true });
  assert.equal(entry.status, 'Filed');
  assert.ok(state.notifications.some(item => item.to === 'omar' && /escort/i.test(item.title)), 'Omar is asked to review the escort log');
}

// Ward logs belong to no patient; the box sheet lists everyone in care.
{
  const state = empty();
  const values = prefillValues(formById('box-prep'), { state, staffId: 'fadia', now: new Date('2026-11-11T10:00:00') });
  assert.deepEqual(values.boxes.map(row => row.patient), ['Karim Haddad', 'Lara Khalil']);
  const log = fileForm(state, { formId: 'access-log', values: { entries: [{ date: '2026-11-11', time: '08:05', who: 'Georgio', reason: 'Meds window' }] }, staffId: 'georgio', final: true });
  assert.equal(log.patientId, null);
  assert.equal(state.activity.at(-1).link, '#/medication/logs');
  // An unexplained difference in controlled medication is reported to Ahmed and Amer the same day.
  fileForm(state, { formId: 'weekly-count', values: { weekEnding: '2026-11-15', resolved: 'No, escalated', controlled: 'Reported to Ahmed & Amer same day', signedBy: { at: '2026-11-15T18:00:00Z', by: 'fadia' } }, staffId: 'fadia', final: true });
  const count = state.notifications.filter(item => /count/i.test(item.title));
  assert.deepEqual(count.map(item => [item.to, item.urgent]).sort(), [['ahmed', true], ['amer', true]]);
}
console.log('Nursing checks passed.');
