import assert from 'node:assert/strict';
import { openOnboarding, completeStep, canAdmit, admit, STEP_OWNERS, freeBeds, rebookPsychologist, linkedPsychologist } from '../src/lib/admission.js';
import { declineInquiry } from '../src/lib/pipeline.js';
import { cancelAppointment } from '../src/lib/scheduling.js';
import { moveInquiry, createInquiry } from '../src/lib/pipeline.js';
import { completeAppointment } from '../src/lib/scheduling.js';
import { walletBalanceCents, addWalletDeposit, addWalletPurchase, walletTransactionsFor } from '../src/lib/wallet.js';
import { seed } from '../src/lib/seed.js';
import { tasksFor } from '../src/lib/tasks.js';
import { setRoomStatus, removeRoom, updateRoom, addRoom } from '../src/lib/rooms.js';
import { withSsr } from './lib/ssr.mjs';

const now = new Date('2026-11-02T10:00:00');
const state = seed(now);
assert.deepEqual(STEP_OWNERS.nursing, ['fadia', 'ahmed']);

const inquiry = createInquiry(state, { name: 'Rami Khoury', program: 'Inpatient', potentialRevenue: 6000, commPreference: 'WhatsApp' }, 'melyssa', now);
moveInquiry(state, inquiry.id, 'Assessment', 'melyssa', now);
moveInquiry(state, inquiry.id, 'Agreement', 'melyssa', now);
const onboarding = openOnboarding(state, inquiry.id, 'melyssa', now);
assert.equal(openOnboarding(state, inquiry.id, 'melyssa', now), onboarding, 'opening twice keeps one record');
assert.equal(state.onboardings.filter(item => item.inquiryId === inquiry.id).length, 1);
const psych = state.appointments.filter(item => item.inquiryId === inquiry.id && item.service === 'Psychologist session');
assert.equal(psych.length, 1);
assert.equal(psych[0].auto, true);
assert.ok(psych[0].date > '2026-11-02', 'booked from the next day');

assert.throws(() => completeStep(state, onboarding.id, 'nursing', {}, 'melyssa'), /This step belongs to Fadia, Ahmed Khattab./);
assert.throws(() => admit(state, onboarding.id, 'melyssa', now), /Complete all admission steps first\./);
completeStep(state, onboarding.id, 'nursing', { note: 'Vitals normal' }, 'fadia');
completeStep(state, onboarding.id, 'physio', { note: 'Fit for the gym, no impact work' }, 'john');
assert.throws(() => completeStep(state, onboarding.id, 'psychologist', {}, 'nabila'), /once the psychologist session is completed/);
completeAppointment(state, psych[0].id, 'nabila', now);
completeStep(state, onboarding.id, 'psychologist', {}, 'nabila');
assert.throws(() => completeStep(state, onboarding.id, 'financial', { monthlyAmount: '' }, 'melyssa'), /Add the agreed monthly amount/);
assert.throws(() => completeStep(state, onboarding.id, 'financial', { monthlyAmount: '5500', terms: 'Monthly in advance', payer: 'Lottery' }, 'melyssa'), /who pays/);
completeStep(state, onboarding.id, 'financial', { monthlyAmount: '5500', terms: 'Monthly in advance', payer: 'Employer' }, 'melyssa');
assert.equal(onboarding.steps.financial.monthlyAmount, 5500);
assert.throws(() => completeStep(state, onboarding.id, 'agreement', {}, 'melyssa'), /signed agreement/);
completeStep(state, onboarding.id, 'agreement', { signature: { name: 'Rami Khoury', at: now.toISOString() } }, 'melyssa');
const agreement = state.documents.find(doc => doc.id === onboarding.steps.agreement.documentId);
assert.equal(agreement.status, 'Signed electronically');
// Beds in a room that isn't ready are not offered; a held bed's room can't be shrunk, removed or closed.
const closing = state.rooms.find(item => freeBeds(state).some(([id]) => id === item.id));
setRoomStatus(state, closing.id, 'Cleaning', 'mazen');
assert.ok(!freeBeds(state).some(([id]) => id === closing.id), 'a room being cleaned is not offered');
setRoomStatus(state, closing.id, 'Ready', 'mazen');
addRoom(state, { id: '201', wing: 'Upper', beds: 2 }, 'mazen');
const [room, bed] = ['201', 2];
assert.ok(freeBeds(state).some(([id, number]) => id === room && number === bed));
assert.throws(() => completeStep(state, onboarding.id, 'room', { roomId: '1', bed: 1 }, 'melyssa'), /Room 1, bed a is not free/);
completeStep(state, onboarding.id, 'room', { roomId: room, bed }, 'melyssa');
assert.equal(canAdmit(onboarding), true);
assert.throws(() => setRoomStatus(state, room, 'Maintenance', 'mazen'), /Room 201, bed b is held for Rami Khoury/);
assert.throws(() => removeRoom(state, room, 'mazen'), /held for/);
assert.throws(() => updateRoom(state, room, { beds: 1, wing: 'Upper' }, 'mazen'), /held for/);

const followups = state.tasks.filter(task => task.inquiryId === inquiry.id);
const before = state.notifications.length;
const patient = admit(state, onboarding.id, 'melyssa', now);
assert.equal(patient.fullName, 'Rami Khoury');
assert.equal(patient.clinicalName, 'Rami K.');
assert.equal(patient.status, 'Admitted');
assert.equal(patient.monthlyAmount, 5500);
assert.deepEqual([patient.roomId, patient.bed], [room, bed]);
assert.equal(walletBalanceCents(state, patient.id), 0);
assert.ok(walletTransactionsFor(state, patient.id).some(item => item.type === 'opened'));
assert.equal(inquiry.outcome, 'Admitted');
assert.ok(followups.every(task => task.status === 'cancelled'));
assert.equal(agreement.patientId, patient.id, 'the signed agreement moves to the patient file');
assert.ok(state.forms.some(entry => entry.formId === 'discharge' && entry.patientId === patient.id && entry.status === 'Draft'));
assert.equal(psych[0].patientId, patient.id, 'the assessment session is linked to the new patient');
assert.throws(() => admit(state, onboarding.id, 'melyssa', now), /already admitted/);
// What was agreed and observed at admission travels with the patient, and the team hears about the arrival.
assert.equal(patient.payer, 'Employer');
assert.equal(patient.paymentTerms, 'Monthly in advance');
assert.equal(patient.nursingNote, 'Vitals normal');
const told = state.notifications.slice(0, state.notifications.length - before).map(item => item.to);
for (const id of ['fadia', 'nabila', 'ahmed', 'john', patient.assigned.rsa, 'mazen', 'rabih']) assert.ok(told.includes(id), `${id} is told`);
assert.ok(tasksFor(state, 'fadia', now).upcoming.concat(tasksFor(state, 'fadia', now).today).some(item => item.kind === 'clearance' && item.patientId === patient.id), 'Fadia clears the new patient for activity');

// Leaving Agreement, or declining, gives back the bed and the psychologist slot.
const leaver = createInquiry(state, { name: 'Changed Mind', program: 'Inpatient' }, 'melyssa', now);
moveInquiry(state, leaver.id, 'Agreement', 'melyssa', now);
const leaverOnboarding = state.onboardings.find(item => item.inquiryId === leaver.id);
assert.ok(leaverOnboarding, 'entering Agreement opens the admission without any page code');
const firstSlot = linkedPsychologist(state, leaverOnboarding);
assert.equal(firstSlot.status, 'Booked');
const bedsBefore = freeBeds(state).length;
const [leaverRoom, leaverBed] = freeBeds(state)[0];
completeStep(state, leaverOnboarding.id, 'room', { roomId: leaverRoom, bed: leaverBed }, 'melyssa');
assert.equal(freeBeds(state).length, bedsBefore - 1);
moveInquiry(state, leaver.id, 'Assessment', 'melyssa', now);
assert.equal(firstSlot.status, 'Cancelled', 'moving back releases the psychologist slot');
assert.equal(freeBeds(state).length, bedsBefore, 'and the bed');
moveInquiry(state, leaver.id, 'Agreement', 'melyssa', now);
assert.equal(linkedPsychologist(state, leaverOnboarding).status, 'Booked', 'returning to Agreement books a new slot');
declineInquiry(state, leaver.id, 'Went elsewhere', 'melyssa', now);
assert.equal(linkedPsychologist(state, leaverOnboarding), null, 'declining cancels the slot');
assert.equal(freeBeds(state).length, bedsBefore);

// A cancelled psychologist session can be booked again; the admission is never stuck.
const stuck = createInquiry(state, { name: 'Needs Rebook', program: 'Inpatient' }, 'melyssa', now);
moveInquiry(state, stuck.id, 'Agreement', 'melyssa', now);
const stuckOnboarding = state.onboardings.find(item => item.inquiryId === stuck.id);
cancelAppointment(state, linkedPsychologist(state, stuckOnboarding).id, 'nabila');
assert.equal(linkedPsychologist(state, stuckOnboarding), null);
const rebooked = rebookPsychologist(state, stuckOnboarding.id, 'nabila', now);
assert.equal(rebooked.status, 'Booked');
assert.equal(stuckOnboarding.psychologistAppointmentId, rebooked.id);

// Wallet rules carried over from the previous preview.
addWalletDeposit(state, { patientId: patient.id, amount: '50.00', description: 'Family deposit', recordedBy: 'melyssa' });
assert.equal(walletBalanceCents(state, patient.id), 5000);
assert.throws(() => addWalletPurchase(state, { patientId: patient.id, amount: '60', description: 'Shoes', recordedBy: 'rsa' }), /This purchase is higher than the available wallet balance\./);
assert.throws(() => addWalletDeposit(state, { patientId: patient.id, amount: '-5', description: 'x' }), /positive amount/);

await withSsr(async ({ load, html }) => {
  const { session } = await load('/src/lib/store.svelte.js');
  session.staffId = 'melyssa';
  const page = await html('/src/pages/Admissions.svelte', { args: [] });
  for (const text of ['Admissions', 'Hiba Moussa', 'Fadi Chamoun', 'Nursing assessment', 'Room assigned', 'Admit patient']) assert.ok(page.includes(text), text);
});

console.log('Admission checks passed.');
