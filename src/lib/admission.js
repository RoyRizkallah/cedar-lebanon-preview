// Admission is separate from the pipeline: the steps below, then the patient and their wallet exist.
import { nextId } from './ids.js';
import { todayISO } from './dates.js';
import { STAFF, staffName, canDo, hasRole, nextRsa, nextPsychologist } from './people.js';
import { notify } from './notifications.js';
import { PAYERS, PAYMENT_METHODS } from './finance.js';
import { log } from './activity.js';
import { autoBookPsychologist } from './scheduling.js';
import { openWallet } from './wallet.js';
import { clinicalNameOf } from './seed.js';

export const STEPS = ['nursing', 'physio', 'psychologist', 'financial', 'agreement', 'payment', 'room', 'ready'];
export const STEP_LABELS = { nursing: 'Nursing assessment', physio: 'Physiotherapy assessment', psychologist: 'Psychologist session', financial: 'Financial arrangement', agreement: 'Admission agreement signed', payment: 'Payment received', room: 'Room assigned', ready: 'Room ready' };
export const STEP_OWNERS = {
  nursing: ['fadia', 'ahmed'],
  physio: ['john', 'ahmed'],
  psychologist: ['nabila', 'samar', 'ahmed'],
  financial: ['melyssa', 'amer', 'ahmed'],
  agreement: ['melyssa', 'amer', 'ahmed'],
  // Admissions SOP: payment per policy is received before admission; Finance records it.
  payment: ['kteish', 'rabih', 'amer'],
  room: ['melyssa', 'amer', 'ahmed'],
  // Never admit into a room whose readiness checklist Mazen has not signed.
  ready: ['mazen']
};
// A step that waits on another: there is nothing to pay before the terms, nothing to prepare before the bed.
export const STEP_NEEDS = { payment: 'financial', ready: 'room' };
const NEED_MESSAGE = { financial: 'Agree the financial arrangement first.', room: 'Assign the bed first.' };
export const isWaiting = (onboarding, step) => !!STEP_NEEDS[step] && !onboarding.steps[STEP_NEEDS[step]]?.done;
export const PAYMENT_TERMS = ['Monthly in advance', 'Full stay in advance', 'Installments', 'Sponsor or insurer'];

const find = (state, id) => {
  const onboarding = state.onboardings.find(item => item.id === id);
  if (!onboarding) throw new Error('This admission was not found.');
  return onboarding;
};
export const inquiryOf = (state, onboarding) => state.inquiries.find(item => item.id === onboarding.inquiryId);
export const isOutpatient = inquiry => inquiry?.program === 'Outpatient';
// An admission is in progress only while its inquiry is open and in Agreement.
export const isActive = (state, onboarding) => { const inquiry = inquiryOf(state, onboarding); return !onboarding.admittedPatientId && inquiry?.stage === 'Agreement' && !inquiry.outcome; };

// The psychologist session linked to this admission, unless it was cancelled.
export function linkedPsychologist(state, onboarding) {
  const appointment = state.appointments.find(item => item.id === onboarding.psychologistAppointmentId);
  return appointment && appointment.status !== 'Cancelled' ? appointment : null;
}

function bookPsychologist(state, onboarding, now) {
  try { onboarding.psychologistAppointmentId = autoBookPsychologist(state, { inquiryId: onboarding.inquiryId }, todayISO(now)).id; } catch { /* no free slot: the step offers a booking button instead */ }
}

export function openOnboarding(state, inquiryId, staffId, now = new Date()) {
  const existing = state.onboardings.find(item => item.inquiryId === inquiryId);
  if (existing) {
    if (!existing.admittedPatientId && !linkedPsychologist(state, existing)) bookPsychologist(state, existing, now);
    return existing;
  }
  const inquiry = state.inquiries.find(item => item.id === inquiryId);
  const onboarding = { id: nextId('ON', state.onboardings), inquiryId, openedAt: now.toISOString(), steps: Object.fromEntries(STEPS.map(step => [step, { done: false }])) };
  bookPsychologist(state, onboarding, now);
  state.onboardings.push(onboarding);
  log(state, staffId, `Admission started for ${inquiry?.name}`, '#/admissions');
  return onboarding;
}

// When an inquiry leaves Agreement or is declined, its held bed and booked psychologist slot go back.
export function releaseOnboarding(state, inquiryId, now = new Date()) {
  const onboarding = state.onboardings.find(item => item.inquiryId === inquiryId && !item.admittedPatientId);
  if (!onboarding) return null;
  const appointment = linkedPsychologist(state, onboarding);
  if (appointment?.status === 'Booked') Object.assign(appointment, { status: 'Cancelled', cancelledBy: 'system', cancelledAt: now.toISOString() });
  if (onboarding.steps.room.done) { onboarding.steps.room = { done: false }; onboarding.steps.ready = { done: false }; }
  return onboarding;
}

export function rebookPsychologist(state, onboardingId, staffId, now = new Date()) {
  const onboarding = find(state, onboardingId);
  if (linkedPsychologist(state, onboarding)) throw new Error('A psychologist session is already booked.');
  const appointment = autoBookPsychologist(state, { inquiryId: onboarding.inquiryId }, todayISO(now));
  onboarding.psychologistAppointmentId = appointment.id;
  log(state, staffId, `Psychologist session rebooked for ${appointment.date} ${appointment.start}`, '#/admissions');
  return appointment;
}

// Beds are lettered within a room (1a, 1b); a one-bed room needs no letter.
export const bedName = (room, bed) => (!room || room.beds === 1 ? '' : String.fromCharCode(96 + Number(bed)));
export function placeLabel(state, roomId, bed) {
  const room = state.rooms.find(item => item.id === roomId);
  if (!room) return roomId ? `Room ${roomId}` : '';
  const letter = bedName(room, bed);
  return letter ? `${room.name}, bed ${letter}` : room.name;
}

// Beds free now in rooms that are ready, excluding beds already held by another admission in progress.
// A bungalow request gets the bungalow; a private room is a whole room with nobody in it; a standard bed is never in the bungalow.
// Nobody is put into a room someone has taken privately.
export function freeBeds(state, exceptOnboardingId, preference = '') {
  const taken = new Set([
    ...state.patients.filter(patient => patient.status === 'Admitted' && patient.roomId).map(patient => `${patient.roomId}/${patient.bed}`),
    ...state.onboardings.filter(item => !item.admittedPatientId && item.id !== exceptOnboardingId && item.steps.room.done && item.steps.room.roomId && isActive(state, item)).map(item => `${item.steps.room.roomId}/${item.steps.room.bed}`)
  ]);
  const people = [
    ...state.patients.filter(patient => patient.status === 'Admitted' && patient.roomId).map(patient => ({ roomId: patient.roomId, type: patient.roomType })),
    ...state.onboardings.filter(item => !item.admittedPatientId && item.id !== exceptOnboardingId && item.steps.room.done && item.steps.room.roomId && isActive(state, item)).map(item => ({ roomId: item.steps.room.roomId, type: item.steps.room.roomType }))
  ];
  const privateRooms = new Set(people.filter(person => person.type === 'Private room').map(person => person.roomId));
  const empty = room => !people.some(person => person.roomId === room.id);
  const suits = room => preference === 'Bungalow' ? room.type === 'Bungalow' : preference === 'Private room' ? room.type !== 'Bungalow' && empty(room) : preference === 'Standard room' ? room.type !== 'Bungalow' : true;
  const beds = state.rooms.filter(room => (room.status || 'Ready') === 'Ready' && !privateRooms.has(room.id) && suits(room)).flatMap(room => Array.from({ length: room.beds }, (_, index) => [room.id, index + 1])).filter(([room, bed]) => !taken.has(`${room}/${bed}`));
  // A private room is offered once, as its first bed.
  return preference === 'Private room' ? beds.filter(([, bed]) => bed === 1) : beds;
}

export function completeStep(state, onboardingId, step, payload = {}, staffId, now = new Date()) {
  const onboarding = find(state, onboardingId);
  if (onboarding.admittedPatientId) throw new Error('This patient is already admitted.');
  if (!STEPS.includes(step)) throw new Error('Unknown admission step.');
  if (!STEP_OWNERS[step].includes(staffId)) throw new Error(`This step belongs to ${STEP_OWNERS[step].map(staffName).join(', ')}.`);
  if (isWaiting(onboarding, step)) throw new Error(NEED_MESSAGE[STEP_NEEDS[step]]);
  const inquiry = inquiryOf(state, onboarding);
  const done = { done: true, by: staffId, at: now.toISOString() };
  if (step === 'nursing' || step === 'physio') done.note = String(payload.note || '').trim();
  if (step === 'psychologist') {
    if (linkedPsychologist(state, onboarding)?.status !== 'Completed') throw new Error('This step can be marked once the psychologist session is completed.');
  }
  if (step === 'financial') {
    const amount = Math.round(Number(payload.monthlyAmount));
    if (!(amount > 0)) throw new Error('Add the agreed monthly amount.');
    done.monthlyAmount = amount;
    done.terms = PAYMENT_TERMS.includes(payload.terms) ? payload.terms : PAYMENT_TERMS[0];
    if (payload.payer !== undefined && !PAYERS.includes(payload.payer)) throw new Error('Choose who pays.');
    done.payer = payload.payer || PAYERS[0];
    // The guarantor is the family member responsible for payment; a sponsor stands in their place.
    if (done.payer !== 'Sponsor') {
      const guarantor = { name: String(payload.guarantorName || '').trim(), relation: String(payload.guarantorRelation || '').trim(), phone: String(payload.guarantorPhone || '').trim() };
      if (!guarantor.name) throw new Error('Add the guarantor: the family member responsible for payment.');
      if (!guarantor.phone) throw new Error("Add the guarantor's phone: Finance's statements go to them.");
      done.guarantor = guarantor;
    }
  }
  if (step === 'payment') {
    if (onboarding.steps.financial.payer === 'Sponsor') {
      const reference = String(payload.sponsorReference || '').trim();
      if (!reference) throw new Error("Add the sponsor's confirmation: it stands in place of the family's payment.");
      done.sponsorReference = reference;
    } else {
      const amount = Math.round(Number(payload.amount));
      if (!(amount > 0)) throw new Error('Add the amount received.');
      Object.assign(done, { amount, method: PAYMENT_METHODS.includes(payload.method) ? payload.method : PAYMENT_METHODS[0], date: payload.date || todayISO(now), reference: String(payload.reference || '').trim() });
    }
  }
  if (step === 'ready') {
    Object.assign(done, { roomId: onboarding.steps.room.roomId, bed: onboarding.steps.room.bed, note: String(payload.note || '').trim() });
  }
  if (step === 'agreement') {
    if (!payload.signature?.at && !payload.fileId) throw new Error('Capture the signed agreement or upload the signed scan.');
    const document = {
      id: nextId('D', state.documents), inquiryId: inquiry.id, type: 'Admission agreement', title: 'Admission agreement', createdAt: now.toISOString(), createdBy: staffId,
      ...(payload.signature?.at
        ? { status: 'Signed electronically', signedBy: payload.signature.name, signedAt: payload.signature.at, signature: payload.signature.image }
        : { status: 'Signed scan uploaded', fileId: payload.fileId, fileName: payload.fileName, signedBy: inquiry.name, signedAt: now.toISOString() })
    };
    state.documents.push(document);
    done.documentId = document.id;
  }
  if (step === 'room') {
    if (isOutpatient(inquiry)) Object.assign(done, { roomId: '', bed: null });
    else {
      const free = freeBeds(state, onboardingId, inquiry.roomPreference || '').some(([room, bed]) => room === payload.roomId && bed === Number(payload.bed));
      if (!free) throw new Error(`${placeLabel(state, payload.roomId, payload.bed)} is not free for a ${(inquiry.roomPreference || 'standard room').toLowerCase()}.`);
      Object.assign(done, { roomId: payload.roomId, bed: Number(payload.bed), roomType: inquiry.roomPreference || 'Standard room' });
    }
  }
  if (step === 'room' && payload.arrivalDate) done.arrivalDate = payload.arrivalDate;
  onboarding.steps[step] = done;
  // An outpatient has no room to prepare.
  if (step === 'room' && !done.roomId) onboarding.steps.ready = { done: true, by: staffId, at: done.at, note: 'Outpatient, no room to prepare.' };
  log(state, staffId, `${STEP_LABELS[step]} done for ${inquiry.name}`, '#/admissions');
  return onboarding;
}

export function undoStep(state, onboardingId, step, staffId) {
  const onboarding = find(state, onboardingId);
  if (onboarding.admittedPatientId) throw new Error('This patient is already admitted.');
  if (!STEP_OWNERS[step].includes(staffId)) throw new Error(`This step belongs to ${STEP_OWNERS[step].map(staffName).join(', ')}.`);
  onboarding.steps[step] = { done: false };
  // Whatever waited on this step is undone with it: readiness was signed for that bed.
  for (const [later, need] of Object.entries(STEP_NEEDS)) if (need === step) onboarding.steps[later] = { done: false };
  return onboarding;
}

export const canAdmit = onboarding => !onboarding.admittedPatientId && STEPS.every(step => onboarding.steps[step]?.done);

export function admit(state, onboardingId, staffId, now = new Date()) {
  const onboarding = find(state, onboardingId);
  if (onboarding.admittedPatientId) throw new Error('This patient is already admitted.');
  if (!canAdmit(onboarding)) throw new Error('Complete all admission steps first.');
  if (!canDo(staffId, 'confirmAdmission')) throw new Error('Admission is confirmed by Melyssa, Ahmed or Amer.');
  const inquiry = inquiryOf(state, onboarding);
  const today = todayISO(now);
  const patient = {
    id: nextId('P', state.patients), inquiryId: inquiry.id, fullName: inquiry.name, clinicalName: clinicalNameOf(inquiry.name), age: '', program: inquiry.program,
    roomId: onboarding.steps.room.roomId || '', bed: onboarding.steps.room.bed || null, admittedAt: today, phase: '1 Stabilization',
    assigned: { psychologist: nextPsychologist(state), therapist: 'ahmed', nurse: 'fadia', fitness: 'john', rsa: isOutpatient(inquiry) ? '' : nextRsa(state) },
    commPreference: inquiry.commPreference, phone: inquiry.phone, status: 'Admitted', monthlyAmount: onboarding.steps.financial.monthlyAmount,
    // What was agreed and observed during the admission steps travels with the patient.
    roomType: onboarding.steps.room.roomType || '', payer: onboarding.steps.financial.payer || PAYERS[0], paymentTerms: onboarding.steps.financial.terms, guarantor: onboarding.steps.financial.guarantor || null, nursingNote: onboarding.steps.nursing.note || '',
    // The family member who made the inquiry becomes the first contact.
    contacts: inquiry.relationship && inquiry.relationship !== 'Self' && inquiry.callerName
      ? [{ id: `CT-${inquiry.id}`, name: inquiry.callerName, relation: inquiry.relationship, phone: inquiry.phone || '', emergency: true, canDiscuss: true, canVisit: true }]
      : []
  };
  state.patients.push(patient);
  openWallet(state, patient.id, today);
  Object.assign(inquiry, { outcome: 'Admitted', closedAt: now.toISOString() });
  for (const task of state.tasks) if (task.inquiryId === inquiry.id && task.kind === 'inquiry-followup' && task.status === 'open') task.status = 'cancelled';
  for (const document of state.documents) if (document.inquiryId === inquiry.id) document.patientId = patient.id;
  for (const appointment of state.appointments) if (appointment.inquiryId === inquiry.id) appointment.patientId = patient.id;
  state.forms.push({ id: nextId('F', state.forms), formId: 'discharge', patientId: patient.id, status: 'Draft', createdBy: staffId, createdAt: now.toISOString(), updatedAt: now.toISOString(), updatedBy: staffId, values: { patient: patient.clinicalName, admissionDate: today } });
  onboarding.admittedPatientId = patient.id;
  onboarding.admittedAt = now.toISOString();
  // The care team meets a new resident; Operations has a bed taken; Finance has a new monthly amount.
  const team = [...Object.values(patient.assigned), ...STAFF.filter(person => hasRole(person.id, 'ops', 'finance-head', 'ledger')).map(person => person.id)].filter(id => id && id !== staffId);
  notify(state, { to: team, title: `New admission: ${patient.clinicalName}`, body: `${patient.program}${patient.roomId ? `, ${placeLabel(state, patient.roomId, patient.bed)}` : ''}. $${patient.monthlyAmount.toLocaleString('en-US')} a month, ${patient.payer.toLowerCase()}.`, link: `#/patients/${patient.id}` });
  log(state, staffId, `Admitted ${patient.fullName}. Wallet created.`, `#/patients/${patient.id}`);
  return patient;
}
