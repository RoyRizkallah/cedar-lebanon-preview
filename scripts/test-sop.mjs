import assert from 'node:assert/strict';
import { openOnboarding, completeStep, undoStep, canAdmit, admit, STEPS, STEP_OWNERS } from '../src/lib/admission.js';
import { createInquiry, moveInquiry } from '../src/lib/pipeline.js';
import { completeAppointment } from '../src/lib/scheduling.js';
import { tasksFor } from '../src/lib/tasks.js';
import { seed } from '../src/lib/seed.js';
import { LEVELS, reportIncident, reviewIncident } from '../src/lib/safety.js';
import { addWalletDeposit, addWalletPurchase, walletTransactionsFor } from '../src/lib/wallet.js';
import { canDo, canSee, visiblePatients, STAFF, staffById } from '../src/lib/people.js';
import { raiseOrder, approveOrder, receiveOrder, setKitchenCeiling, kitchenSpend, APPROVAL_LIMIT } from '../src/lib/orders.js';
import { dischargePatient } from '../src/lib/discharge.js';

// SOP corrections the owner's reply left standing (Admissions & Administration, Structure & Delegation, RSA & Floor).
const now = new Date('2026-11-11T10:00:00');

// Admission (Admissions SOP, stage 3 and the arrival checklist):
// the guarantor signs; payment is received before admission; Mazen signs the room ready before arrival.
{
  assert.deepEqual(STEPS, ['nursing', 'physio', 'psychologist', 'financial', 'agreement', 'payment', 'room', 'ready']);
  assert.deepEqual(STEP_OWNERS.payment, ['kteish', 'rabih', 'amer']);
  assert.deepEqual(STEP_OWNERS.ready, ['mazen']);
  for (const step of STEPS) for (const id of STEP_OWNERS[step]) assert.ok(canSee(id, 'admissions'), `${id} owns ${step}`);

  const state = seed(now);
  const inquiry = createInquiry(state, { name: 'Rami Khoury', program: 'Inpatient', roomPreference: 'Standard room', commPreference: 'WhatsApp' }, 'melyssa', now);
  moveInquiry(state, inquiry.id, 'Assessment', 'melyssa', now);
  moveInquiry(state, inquiry.id, 'Agreement', 'melyssa', now);
  const onboarding = openOnboarding(state, inquiry.id, 'melyssa', now);
  completeStep(state, onboarding.id, 'nursing', {}, 'fadia');
  completeStep(state, onboarding.id, 'physio', {}, 'john');
  completeAppointment(state, onboarding.psychologistAppointmentId, state.appointments.find(item => item.id === onboarding.psychologistAppointmentId).provider, now);
  completeStep(state, onboarding.id, 'psychologist', {}, 'nabila');

  // The guarantor (who Finance's statements go to) is never left incomplete.
  const terms = { monthlyAmount: 7500, terms: 'Monthly in advance', payer: 'Family' };
  assert.throws(() => completeStep(state, onboarding.id, 'financial', terms, 'melyssa'), /guarantor/i);
  assert.throws(() => completeStep(state, onboarding.id, 'financial', { ...terms, guarantorName: 'Joseph Khoury' }, 'melyssa'), /guarantor's phone/i);
  completeStep(state, onboarding.id, 'financial', { ...terms, guarantorName: 'Joseph Khoury', guarantorRelation: 'Parent', guarantorPhone: '+961 3 123 456' }, 'melyssa');
  assert.deepEqual(onboarding.steps.financial.guarantor, { name: 'Joseph Khoury', relation: 'Parent', phone: '+961 3 123 456' });
  completeStep(state, onboarding.id, 'agreement', { signature: { name: 'Joseph Khoury', at: now.toISOString() } }, 'melyssa');

  // Payment per policy, recorded by Finance.
  assert.throws(() => completeStep(state, onboarding.id, 'payment', { amount: 7500 }, 'melyssa'), /belongs to Kteish/);
  assert.throws(() => completeStep(state, onboarding.id, 'payment', {}, 'kteish'), /amount received/);
  completeStep(state, onboarding.id, 'payment', { amount: 7500, method: 'Bank transfer', date: '2026-11-11', reference: 'TRX-88' }, 'kteish');
  assert.equal(onboarding.steps.payment.amount, 7500);

  // Readiness comes after the bed, and only Mazen signs it; it is for that bed.
  assert.ok(!tasksFor(state, 'mazen', now).overdue.concat(tasksFor(state, 'mazen', now).today).some(item => item.id === `step-${onboarding.id}-ready`), 'no readiness task before a bed is held');
  assert.throws(() => completeStep(state, onboarding.id, 'ready', {}, 'mazen'), /Assign the bed first/);
  completeStep(state, onboarding.id, 'room', { roomId: '6', bed: 1, arrivalDate: '2026-11-12' }, 'melyssa');
  const mazen = tasksFor(state, 'mazen', now);
  assert.ok([...mazen.overdue, ...mazen.today].some(item => item.id === `step-${onboarding.id}-ready`), 'Mazen is asked to sign the room ready');
  assert.equal(canAdmit(onboarding), false, 'never admit into a room whose readiness is not signed');
  completeStep(state, onboarding.id, 'ready', { note: 'Linen changed, AC serviced' }, 'mazen');
  assert.equal(onboarding.steps.ready.roomId, '6');
  // Changing the bed undoes the readiness: it was signed for another room.
  undoStep(state, onboarding.id, 'room', 'melyssa');
  assert.equal(onboarding.steps.ready.done, false);
  completeStep(state, onboarding.id, 'room', { roomId: '6', bed: 1, arrivalDate: '2026-11-12' }, 'melyssa');
  completeStep(state, onboarding.id, 'ready', {}, 'mazen');
  assert.equal(canAdmit(onboarding), true);
  const patient = admit(state, onboarding.id, 'melyssa', now);
  assert.deepEqual(patient.guarantor, { name: 'Joseph Khoury', relation: 'Parent', phone: '+961 3 123 456' });
}

// A sponsored patient: the sponsor's confirmation stands in place of the family's payment, and the sponsor in place of a guarantor.
{
  const state = seed(now);
  const inquiry = createInquiry(state, { name: 'Sami Haddad', program: 'Outpatient', commPreference: 'Phone' }, 'melyssa', now);
  moveInquiry(state, inquiry.id, 'Assessment', 'melyssa', now);
  moveInquiry(state, inquiry.id, 'Agreement', 'melyssa', now);
  const onboarding = openOnboarding(state, inquiry.id, 'melyssa', now);
  completeStep(state, onboarding.id, 'financial', { monthlyAmount: 3000, terms: 'Sponsor or insurer', payer: 'Sponsor' }, 'melyssa');
  assert.throws(() => completeStep(state, onboarding.id, 'payment', {}, 'kteish'), /sponsor's confirmation/);
  completeStep(state, onboarding.id, 'payment', { sponsorReference: 'UNRWA letter 2026/114' }, 'kteish');
  // An outpatient has no room to prepare.
  completeStep(state, onboarding.id, 'room', {}, 'melyssa');
  assert.equal(onboarding.steps.ready.done, true);
}
// Incidents (RSA & Floor SOP 3.4): three levels, each with its own call list.
{
  assert.deepEqual(LEVELS.map(item => [item.level, item.name]), [[1, 'Behavioural'], [2, 'Serious'], [3, 'Emergency']]);
  const state = seed(now);
  const patientId = state.patients.find(item => item.status === 'Admitted').id;
  const told = incident => state.notifications.filter(item => item.link === '#/safety/incidents' && item.title.includes(incident.id)).map(item => [item.to, item.urgent]).sort();
  assert.throws(() => reportIncident(state, { patientId, type: 'Aggression', level: 4, description: 'x' }, 'alaa'), /Choose the level/);
  // Level 1: de-escalated, Omar reviews.
  const one = reportIncident(state, { patientId, type: 'Rule breach', level: 1, description: 'Shouted when refused a second coffee; settled.' }, 'alaa');
  assert.deepEqual(told(one), [['omar', false]]);
  reviewIncident(state, one.id, { outcome: 'Noted in the behaviour log.' }, 'omar');
  // Level 2: Omar and Ahmed called the same day.
  const two = reportIncident(state, { patientId, type: 'Substance found', level: 2, description: 'Cannabis found in a jacket.' }, 'alaa');
  assert.deepEqual(told(two), [['ahmed', true], ['omar', true]]);
  assert.throws(() => reviewIncident(state, two.id, { outcome: 'x' }, 'omar'), /Ahmed/);
  // Level 3: calls now. Fadia for anything health; Ahmed; Amer for major events.
  const three = reportIncident(state, { patientId, type: 'Self-harm', level: 3, description: 'Cut on forearm, dressed.' }, 'alaa');
  assert.deepEqual(told(three), [['ahmed', true], ['amer', true], ['fadia', true], ['omar', true]]);
  const run = reportIncident(state, { patientId, type: 'Absconding', level: 3, description: 'Left through the garden gate.' }, 'alaa');
  assert.ok(!told(run).some(([to]) => to === 'fadia'), 'absconding is not a health call');
}
// Patient petty cash (Structure & Delegation, Part 4): Georgio holds and hands out the cash, with the patient's signature;
// he never keeps the accounts. Kteish owns the ledger, so the final bill is his.
{
  assert.deepEqual(['georgio', 'amer', 'melyssa', 'alaa', 'kteish'].filter(id => canDo(id, 'pettyCash')), ['georgio']);
  const state = seed(now);
  const patient = state.patients.find(item => item.status === 'Admitted');
  addWalletDeposit(state, { patientId: patient.id, amount: '50', description: 'Family deposit', recordedBy: 'kteish' });
  const purchase = { patientId: patient.id, amount: '8', description: 'Phone card' };
  assert.throws(() => addWalletPurchase(state, { ...purchase, recordedBy: 'alaa', signature: { at: now.toISOString(), name: patient.fullName } }), /Georgio/);
  assert.throws(() => addWalletPurchase(state, { ...purchase, recordedBy: 'georgio' }), /patient signs/);
  const entry = addWalletPurchase(state, { ...purchase, recordedBy: 'georgio', signature: { at: now.toISOString(), name: patient.fullName, image: 'data:x' } });
  assert.equal(entry.signedBy, patient.fullName);
  assert.ok(walletTransactionsFor(state, patient.id).some(item => item.id === entry.id));
}
{
  const state = seed(now);
  const resident = state.patients.find(item => item.status === 'Admitted' && item.program !== 'Outpatient' && item.assigned?.rsa);
  const other = ['georgio', 'alaa', 'dania', 'imad'].find(id => id !== resident.assigned.rsa);
  assert.ok(visiblePatients(state, other).some(item => item.id === resident.id), 'the RSA covering the house sees every resident');
  assert.ok(!visiblePatients(state, other).some(item => item.program === 'Outpatient'), 'outpatients are not on the floor');
}
// Kitchen and housekeeping (Structure & Delegation, Part 1): under Mazen; Shady is Head Chef and a sub-lead.
{
  for (const [id, title] of [['shady', 'Head Chef'], ['wissam', 'Kitchen purchasing'], ['ezdihar', 'Kitchen & housekeeping help'], ['khadija', 'Kitchen & housekeeping help'], ['hasna', 'Housekeeping'], ['ghassan', 'Housekeeping']]) {
    assert.equal(staffById(id)?.title, title, id);
    assert.equal(staffById(id).team, 'Operations', id);
  }
  assert.ok(canSee('hasna', 'rooms') && !canSee('hasna', 'patients'), 'housekeeping sees rooms, not patient files');
}

// Orders (Structure & Delegation, Part 3): Shady or Mazen raises; up to $200 the sub-lead proceeds;
// over $200 Amer approves in writing before the purchase; kitchen orders within Amer's weekly ceiling need no separate approval.
{
  assert.equal(APPROVAL_LIMIT, 200);
  const state = seed(now);
  assert.throws(() => raiseOrder(state, { item: 'Bleach', amount: 30, kind: 'Cleaning' }, 'alaa', now), /Shady or Mazen/);
  const small = raiseOrder(state, { item: 'Bleach and gloves', supplier: 'Local shop', amount: 45, kind: 'Cleaning' }, 'mazen', now);
  assert.equal(small.status, 'Approved');
  assert.equal(small.approval, 'Within the $200 sub-lead limit');
  const big = raiseOrder(state, { item: 'New water heater', supplier: 'Khoury Plumbing', amount: 640, kind: 'Maintenance' }, 'mazen', now);
  assert.equal(big.status, 'Awaiting approval');
  assert.ok(state.notifications.some(item => item.to === 'amer' && /water heater/.test(item.title)));
  assert.throws(() => receiveOrder(state, big.id, { amount: 640, fileId: 'r1' }, 'mazen', now), /approved/);
  assert.throws(() => approveOrder(state, big.id, 'rabih', now), /Amer/);
  approveOrder(state, big.id, 'amer', now);
  assert.equal(big.approvedBy, 'amer');
  // Kitchen: within the standing weekly ceiling, no separate approval; above it, Amer again.
  setKitchenCeiling(state, 900, 'amer');
  const before = kitchenSpend(state, now);
  assert.throws(() => setKitchenCeiling(state, 2000, 'mazen'), /Amer/);
  const weekly = raiseOrder(state, { item: 'Weekly groceries', supplier: 'Beirut run (Wissam)', amount: 750, kind: 'Kitchen' }, 'shady', now);
  assert.equal(weekly.status, 'Approved');
  assert.match(weekly.approval, /weekly kitchen ceiling/);
  assert.equal(kitchenSpend(state, now), before + 750, 'every kitchen order this week counts toward the ceiling');
  const extra = raiseOrder(state, { item: 'Extra meat for the holiday', amount: 300, kind: 'Kitchen' }, 'shady', now);
  assert.equal(extra.status, 'Awaiting approval', 'over the ceiling needs Amer');
  // Received with the receipt, which goes to Administration then Finance.
  assert.throws(() => receiveOrder(state, small.id, { amount: 42 }, 'mazen', now), /receipt/);
  receiveOrder(state, small.id, { amount: 42, fileId: 'r2', fileName: 'receipt.jpg' }, 'mazen', now);
  assert.equal(small.status, 'Received');
  assert.ok(['melyssa', 'amer', 'kteish', 'mazen', 'shady'].every(id => canSee(id, 'orders')));
  assert.ok(!canSee('alaa', 'orders') && !canSee('nabila', 'orders'));
}
console.log('SOP checks passed.');
