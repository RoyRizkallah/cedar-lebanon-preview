// Stored tasks (follow-up calls) plus work derived from the records, gathered per person.
import { log } from './activity.js';
import { staffName, hasRole } from './people.js';
import { addDays, todayISO, daysBetween, fmtDay, localDay } from './dates.js';
import { reviewDue, REVIEW_AFTER_HOURS } from './pipeline.js';
import { notesOverdue } from './scheduling.js';
import { STEPS, STEP_LABELS, STEP_OWNERS } from './admission.js';
import { allFields, formById } from './forms/engine.js';

export function completeTask(state, id, staffId, note = '') {
  const task = state.tasks.find(item => item.id === id);
  if (!task) throw new Error('This task was not found.');
  if (task.status !== 'open') throw new Error('This task is already closed.');
  Object.assign(task, { status: 'done', doneBy: staffId, doneAt: new Date().toISOString(), note: String(note).trim() });
  log(state, staffId, `${staffName(staffId)} completed: ${task.title}`, task.link);
  return task;
}

const UPCOMING_DAYS = 14;
const patientName = (state, id, clinical) => { const patient = state.patients.find(item => item.id === id); return clinical ? patient?.clinicalName : patient?.fullName; };

// Everything waiting on one person, sorted into overdue, today and the next two weeks.
export function tasksFor(state, staffId, now = new Date()) {
  const today = todayISO(now);
  const items = [];
  const push = item => items.push(item);

  for (const task of state.tasks) {
    if (task.owner !== staffId || task.status !== 'open') continue;
    const inquiry = task.inquiryId && state.inquiries.find(item => item.id === task.inquiryId);
    push({ id: task.id, taskId: task.id, kind: task.kind, title: task.title, sub: inquiry ? inquiry.name : patientName(state, task.patientId), due: task.due, link: task.link, done: true });
  }

  for (const inquiry of state.inquiries) {
    if (inquiry.contactPerson === staffId && reviewDue(inquiry, now)) {
      push({ id: `review-${inquiry.id}`, kind: 'review', title: `Review ${inquiry.name}`, sub: `More than ${REVIEW_AFTER_HOURS} hours in New Inquiry`, due: todayISO(new Date(new Date(inquiry.stageHistory.at(-1).at).getTime() + REVIEW_AFTER_HOURS * 3600000)), link: `#/pipeline/${inquiry.id}` });
    }
  }

  for (const inquiry of state.inquiries) {
    if (inquiry.stage === 'Follow-up' && !inquiry.outcome && inquiry.contactPerson === staffId && inquiry.followUp?.due) {
      push({ id: `followup-${inquiry.id}`, kind: 'inquiry-followup', title: `Follow up with ${inquiry.name}`, sub: inquiry.followUp.note || `Round ${inquiry.followUp.round}`, due: inquiry.followUp.due, link: `#/followups/${inquiry.id}` });
    }
  }

  for (const appointment of notesOverdue(state, staffId, now)) {
    push({ id: `note-${appointment.id}`, kind: 'note', title: `Session note: ${patientName(state, appointment.patientId, true)}`, sub: `${appointment.service}, ${fmtDay(appointment.date)}. Due within 24 hours`, due: addDays(appointment.date, 1), link: `#/patients/${appointment.patientId}/clinical`, appointmentId: appointment.id, patientId: appointment.patientId });
  }

  if (!hasRole(staffId, 'gm', 'director')) {
    for (const onboarding of state.onboardings) {
      const inquiry = state.inquiries.find(item => item.id === onboarding.inquiryId);
      if (onboarding.admittedPatientId || inquiry?.stage !== 'Agreement' || inquiry.outcome) continue;
      for (const step of STEPS) {
        if (onboarding.steps[step].done || !STEP_OWNERS[step].includes(staffId)) continue;
        if (step === 'psychologist') {
          const session = state.appointments.find(item => item.id === onboarding.psychologistAppointmentId);
          if (session?.status !== 'Completed') continue;
        }
        push({ id: `step-${onboarding.id}-${step}`, kind: 'admission', title: `${STEP_LABELS[step]}: ${inquiry.name}`, sub: 'Admission step', due: today, link: '#/admissions' });
      }
    }
  }

  if (staffId === 'clinical-director') {
    const filed = (formId, patientId) => state.forms.some(entry => entry.formId === formId && entry.patientId === patientId && entry.status === 'Filed');
    for (const patient of state.patients.filter(item => item.status === 'Admitted')) {
      for (const [formId, days] of [['intake', 3], ['plan', 7]]) {
        const due = addDays(patient.admittedAt, days);
        if (!filed(formId, patient.id) && daysBetween(today, due) <= UPCOMING_DAYS) push({ id: `form-${formId}-${patient.id}`, kind: 'form', title: `${formById(formId).title}: ${patient.clinicalName}`, sub: `Due ${days === 3 ? 'within 72 hours' : 'within 7 days'} of admission`, due, link: `#/patients/${patient.id}/clinical` });
      }
    }
  }

  // Treatment plans are reviewed monthly: a dated review entry, not a rewrite (Form 2).
  if (staffId === 'clinical-director') {
    for (const patient of state.patients.filter(item => item.status === 'Admitted')) {
      const plan = state.forms.filter(entry => entry.formId === 'plan' && entry.patientId === patient.id && entry.status === 'Filed').sort((a, b) => String(b.filedAt).localeCompare(String(a.filedAt)))[0];
      if (!plan) continue;
      const last = [localDay(plan.filedAt), ...(plan.values.reviews || []).map(review => review.date).filter(Boolean)].sort().at(-1);
      const due = addDays(last, 30);
      if (daysBetween(today, due) <= UPCOMING_DAYS) push({ id: `review-plan-${plan.id}`, kind: 'form', title: `Monthly plan review: ${patient.clinicalName}`, sub: 'Add a dated review entry to the treatment plan', due, link: `#/patients/${patient.id}/clinical/${plan.id}` });
    }
  }

  // Planned arrivals for the people who welcome them.
  if (['melyssa', 'fadia'].includes(staffId)) {
    for (const onboarding of state.onboardings.filter(item => !item.admittedPatientId && item.steps.room?.arrivalDate)) {
      const inquiry = state.inquiries.find(item => item.id === onboarding.inquiryId);
      if (inquiry?.stage !== 'Agreement' || inquiry.outcome) continue;
      push({ id: `arrival-${onboarding.id}`, kind: 'admission', title: `Arrival: ${inquiry.name}`, sub: onboarding.steps.room.roomId ? `Room ${onboarding.steps.room.roomId}, bed ${onboarding.steps.room.bed}` : 'Outpatient', due: onboarding.steps.room.arrivalDate, link: '#/admissions' });
    }
  }

  // Countersignatures waiting on this person.
  for (const entry of state.forms) {
    if (entry.status !== 'Filed') continue;
    const form = formById(entry.formId);
    const pending = allFields(form).filter(field => field.type === 'signature' && field.later && field.signer?.includes(staffId) && !entry.values[field.id]?.at);
    if (!pending.length) continue;
    const who = entry.patientId ? patientName(state, entry.patientId, form.family === 'clinical') : 'weekly review';
    push({ id: `sign-${entry.id}`, kind: 'sign', title: `Sign ${form.title}: ${who}`, sub: pending.map(field => field.label).join(', '), due: entry.filedAt ? localDay(entry.filedAt) : today, link: entry.patientId ? `#/patients/${entry.patientId}/${form.family}/${entry.id}` : '#/patients' });
  }

  // Purchases come out of petty cash, which Georgio holds.
  if (hasRole(staffId, 'petty-cash')) {
    for (const request of state.requests.filter(item => item.status === 'Open')) {
      push({ id: `request-${request.id}`, kind: 'request', title: `Buy ${request.quantity} × ${request.item}`, sub: `For ${patientName(state, request.patientId)}`, due: today, link: '#/requests' });
    }
  }

  if (staffId === 'fadia') {
    for (const doc of state.documents.filter(item => item.type === 'Prescription' && !item.reviewedBy)) {
      push({ id: `rx-${doc.id}`, kind: 'prescription', title: `Review prescription: ${patientName(state, doc.patientId, true)}`, sub: doc.note || doc.title, due: today, link: `#/patients/${doc.patientId}/medical`, docId: doc.id });
    }
  }

  if (staffId === 'john') {
    for (const entry of state.forms.filter(item => item.formId === 'clearance' && item.status === 'Draft' && item.values.medicallyCleared === 'Yes')) {
      push({ id: `plan-${entry.id}`, kind: 'form', title: `Activity plan: ${patientName(state, entry.patientId)}`, sub: 'Fadia cleared gate one. Gate two is yours.', due: today, link: `#/patients/${entry.patientId}/fitness/${entry.id}` });
    }
  }

  const horizon = addDays(today, UPCOMING_DAYS);
  const byDue = (a, b) => a.due.localeCompare(b.due) || a.title.localeCompare(b.title);
  return {
    overdue: items.filter(item => item.due < today).sort(byDue),
    today: items.filter(item => item.due === today).sort(byDue),
    upcoming: items.filter(item => item.due > today && item.due <= horizon).sort(byDue)
  };
}

export function reviewPrescription(state, docId, staffId) {
  const doc = state.documents.find(item => item.id === docId);
  if (!doc) throw new Error('This prescription was not found.');
  Object.assign(doc, { reviewedBy: staffId, reviewedAt: new Date().toISOString() });
  log(state, staffId, `Reviewed ${doc.title}`, `#/patients/${doc.patientId}/medical`);
  return doc;
}
