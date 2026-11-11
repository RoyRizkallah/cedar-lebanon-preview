// Discharge happens on the day the patient leaves. The discharge plan (Form 7) only sets the day;
// discharging then frees the bed, ends the program, clears the calendar, returns the wallet,
// asks Finance for the final bill and books the aftercare calls.
import { nextId } from './ids.js';
import { addDays, todayISO, fmtDay } from './dates.js';
import { STAFF, canDo, hasRole } from './people.js';
import { notify } from './notifications.js';
import { log } from './activity.js';
import { walletBalanceCents, formatCents } from './wallet.js';
import { openBalance } from './finance.js';
import { FOLLOWUP_OFFSETS } from './forms/engine.js';
import { endProgramFor, programFor } from './programs.js';

export const DISCHARGE_TYPES = ['Planned', 'Early (agreed)', 'Self-discharge'];

const latestFiled = (state, formId, patientId) => state.forms
  .filter(entry => entry.formId === formId && entry.patientId === patientId && entry.status === 'Filed')
  .sort((a, b) => String(b.filedAt).localeCompare(String(a.filedAt)))[0];

// The filed discharge plan sets the day; before that, the treatment plan's estimate.
export const dischargeDay = (state, patientId) => latestFiled(state, 'discharge', patientId)?.values.dischargeDate || '';
export const plannedDischarge = (state, patientId) => dischargeDay(state, patientId) || latestFiled(state, 'plan', patientId)?.values.plannedDischarge || '';

const involves = (item, patientId) => item.patientId === patientId || !!item.patientIds?.includes(patientId);
const ahead = (state, patientId, date) => state.appointments.filter(item => item.status === 'Booked' && item.date > date && involves(item, patientId));

// What discharging will do, shown before anyone confirms it.
export function dischargePreview(state, patientId, date) {
  const patient = state.patients.find(item => item.id === patientId);
  return {
    room: patient?.roomId || '',
    bed: patient?.bed || null,
    program: programFor(state, patientId, date)?.program.name || '',
    sessions: ahead(state, patientId, date).length,
    walletCents: walletBalanceCents(state, patientId),
    owed: state.finance.invoices.filter(item => item.patientId === patientId).reduce((sum, item) => sum + openBalance(item), 0),
    planFiled: !!latestFiled(state, 'discharge', patientId)
  };
}

export function dischargePatient(state, patientId, { date, type, note = '' }, staffId, now = new Date()) {
  if (!canDo(staffId, 'discharge')) throw new Error('Patients are discharged by Ahmed or Melyssa.');
  const patient = state.patients.find(item => item.id === patientId);
  if (!patient) throw new Error('This patient was not found.');
  if (patient.status !== 'Admitted') throw new Error(`${patient.clinicalName} is already discharged.`);
  const day = date || todayISO(now);
  if (day > todayISO(now)) throw new Error('Discharge a patient on the day they leave, not before.');
  if (!DISCHARGE_TYPES.includes(type)) throw new Error('Choose the kind of discharge.');
  if (type !== 'Self-discharge' && !latestFiled(state, 'discharge', patientId)) throw new Error('File the Discharge & Aftercare Plan first. Only a self-discharge can go without it.');
  // The Clinical Director (Ahmed) signs off every discharge plan before the patient leaves.
  const plan = latestFiled(state, 'discharge', patientId);
  if (type !== 'Self-discharge' && !(plan.values.directorSignature?.at || plan.values.ahmedSignature?.at)) throw new Error('Ahmed signs off the discharge plan before the patient is discharged.');

  const preview = dischargePreview(state, patientId, day);
  const stamp = now.toISOString();
  // The calendar: one-to-ones are cancelled; the patient leaves shared sessions, which close if nobody is left.
  for (const item of ahead(state, patientId, day)) {
    if (item.patientIds) item.patientIds = item.patientIds.filter(id => id !== patientId);
    if (item.patientId === patientId || !item.patientIds?.length) Object.assign(item, { status: 'Cancelled', cancelledBy: staffId, cancelledAt: stamp });
  }
  endProgramFor(state, patientId, day, staffId);
  // Medication stops after the last day in the house; that day's doses stay on the round.
  for (const order of (state.medication?.orders || []).filter(item => item.patientId === patientId && item.status === 'Active')) {
    Object.assign(order, { status: 'Stopped', endDate: addDays(day, 1), stoppedBy: staffId, stopReason: 'Discharged' });
  }
  if (preview.walletCents > 0) {
    state.wallet.transactions.push({ id: nextId('W', state.wallet.transactions), patientId, type: 'refund', amountCents: preview.walletCents, description: 'Balance returned to the family at discharge', date: day, recordedBy: staffId });
  }
  Object.assign(patient, { status: 'Discharged', dischargedAt: day, dischargeType: type, dischargeNote: String(note).trim(), dischargedBy: staffId, roomId: '', bed: null });

  const finance = STAFF.find(person => hasRole(person.id, 'finance-head'))?.id;
  state.tasks.push({ id: nextId('T', state.tasks), kind: 'final-bill', title: `Final bill: ${patient.fullName}`, owner: finance, due: addDays(day, 2), patientId, link: '#/finance/invoices', status: 'open' });
  for (const [contact, days] of FOLLOWUP_OFFSETS) {
    state.tasks.push({ id: nextId('T', state.tasks), kind: 'followup-call', title: `${contact} follow-up call`, owner: 'melyssa', due: addDays(day, days), patientId, link: `#/patients/${patientId}/followup`, status: 'open' });
  }
  const team = Object.values(patient.assigned || {}).filter(id => id && id !== staffId);
  notify(state, { to: [...team, finance], title: `${patient.clinicalName} was discharged`, body: `${type}, ${fmtDay(day)}.${preview.walletCents ? ` Wallet of ${formatCents(preview.walletCents)} returned.` : ''}`, link: `#/patients/${patientId}` });
  log(state, staffId, `Discharged ${patient.clinicalName} (${type.toLowerCase()})`, `#/patients/${patientId}`);
  return patient;
}
