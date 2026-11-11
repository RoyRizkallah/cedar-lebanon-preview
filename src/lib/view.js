// What the server sends each person: the workspace reduced to what their role may see.
// The screens already hide these things; this makes sure the data never reaches the browser at all.
import { canSee, canSeeTab, canDo, isResident, RESIDENTS } from './people.js';
import { formById } from './forms/engine.js';
import { incidentsFor } from './safety.js';

// The patient-file tab a form lives on (the follow-up log holds the aftercare form).
const tabOf = entry => (entry.formId === 'aftercare' ? 'followup' : formById(entry.formId)?.family);
const EMPTY_FINANCE = { invoices: [], expenses: [], manualEntries: [], bankEntries: [] };
const EMPTY_MEDICATION = { orders: [], doses: [], tests: [] };

function residentView(state, staffId) {
  const patientId = RESIDENTS.find(person => person.id === staffId)?.patientId;
  const mine = item => item.patientId === patientId;
  const view = Object.fromEntries(Object.entries(state).map(([key, value]) => [key, Array.isArray(value) ? [] : value]));
  return {
    ...view,
    patients: state.patients.filter(patient => patient.id === patientId).map(({ riskReviews, ...patient }) => patient),
    wallet: { transactions: state.wallet.transactions.filter(mine) },
    requests: state.requests.filter(mine),
    appointments: state.appointments.filter(mine),
    forms: state.forms.filter(entry => entry.formId === 'wellbeing' && mine(entry)),
    notifications: state.notifications.filter(item => item.to === staffId),
    rooms: state.rooms,
    finance: EMPTY_FINANCE,
    medication: EMPTY_MEDICATION,
    kitchenCeiling: null
  };
}

export function viewFor(state, staffId) {
  const full = structuredClone(state);
  if (isResident(staffId)) return residentView(full, staffId);
  return {
    ...full,
    notifications: full.notifications.filter(item => item.to === staffId),
    forms: full.forms.filter(entry => canSeeTab(staffId, tabOf(entry))),
    documents: full.documents.filter(doc => doc.type !== 'Prescription' || canDo(staffId, 'viewPrescriptions')),
    medication: canSee(staffId, 'medication') || canSeeTab(staffId, 'medical') ? full.medication : EMPTY_MEDICATION,
    finance: canSee(staffId, 'finance') ? full.finance : EMPTY_FINANCE,
    incidents: incidentsFor(full, staffId),
    patients: canDo(staffId, 'viewRisk') ? full.patients : full.patients.map(({ riskReviews, ...patient }) => patient)
  };
}
