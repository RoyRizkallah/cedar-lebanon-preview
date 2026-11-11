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

// Fees, payer and guarantor are for intake and Finance; the rest of the team never needs them.
const MONEY = ['monthlyAmount', 'payer', 'paymentTerms', 'guarantor'];
const without = (object, keys) => Object.fromEntries(Object.entries(object).filter(([key]) => !keys.includes(key)));

export function viewFor(state, staffId) {
  const full = structuredClone(state);
  if (isResident(staffId)) return residentView(full, staffId);
  const intake = canSee(staffId, 'pipeline') || canSee(staffId, 'admissions') || canSee(staffId, 'followups');
  const money = canDo(staffId, 'editInquiry') || canSee(staffId, 'finance');
  const careTeam = canSee(staffId, 'patients');
  // Patients: the care team sees the file; anyone else (kitchen, housekeeping) only who is in which bed.
  const patients = full.patients.map(patient => {
    if (!careTeam) return { id: patient.id, clinicalName: patient.clinicalName, fullName: patient.clinicalName, status: patient.status, program: patient.program, roomId: patient.roomId, bed: patient.bed, roomType: patient.roomType, admittedAt: patient.admittedAt, dischargedAt: patient.dischargedAt, assigned: {} };
    return without(patient, [...(canDo(staffId, 'viewRisk') ? [] : ['riskReviews']), ...(money ? [] : MONEY)]);
  });
  const onboardings = !intake ? [] : full.onboardings.map(item => (money ? item : { ...item, steps: { ...item.steps, financial: without(item.steps.financial || {}, ['monthlyAmount', 'guarantor', 'terms', 'payer']), payment: without(item.steps.payment || {}, ['amount', 'method', 'reference', 'sponsorReference']) } }));
  return {
    ...full,
    patients,
    leads: canSee(staffId, 'leads') ? full.leads : [],
    inquiries: intake ? (money ? full.inquiries : full.inquiries.map(item => without(item, ['potentialRevenue']))) : [],
    onboardings,
    notifications: full.notifications.filter(item => item.to === staffId),
    activity: canSee(staffId, 'dashboard') ? full.activity : full.activity.filter(item => item.by === staffId),
    forms: full.forms.filter(entry => canSeeTab(staffId, tabOf(entry))),
    documents: full.documents.filter(doc => (doc.type === 'Prescription' ? canDo(staffId, 'viewPrescriptions') : canSeeTab(staffId, 'documents') || intake)),
    medication: canSee(staffId, 'medication') || canSeeTab(staffId, 'medical') ? full.medication : EMPTY_MEDICATION,
    finance: canSee(staffId, 'finance') ? full.finance : EMPTY_FINANCE,
    wallet: { transactions: canSeeTab(staffId, 'wallet') || canSee(staffId, 'finance') ? full.wallet.transactions : [] },
    requests: canSee(staffId, 'requests') ? full.requests : [],
    appointments: canDo(staffId, 'viewTherapyBookings') ? full.appointments : [],
    incidents: careTeam ? incidentsFor(full, staffId) : [],
    checkins: careTeam ? full.checkins : [],
    comments: careTeam ? full.comments : [],
    visits: careTeam ? full.visits : [],
    leaves: careTeam ? full.leaves : [],
    orders: canSee(staffId, 'orders') ? full.orders : [],
    // The custodian and witnesses see the counts they made or signed, never the expected balance or variance; Finance and Amer see all.
    cashCounts: canSee(staffId, 'finance') ? full.cashCounts || [] : canDo(staffId, 'pettyCash') || ['omar', 'melyssa'].includes(staffId) ? (full.cashCounts || []).map(({ expectedCents, varianceCents, ...count }) => count) : [],
    statements: canSee(staffId, 'finance') || canSeeTab(staffId, 'wallet') ? full.statements || [] : [],
    kitchenCeiling: canSee(staffId, 'orders') ? full.kitchenCeiling : null
  };
}

// What a change sends back: the person's own copy of the record it made or touched, a plain value, or nothing.
export function resultFor(result, view) {
  if (result === null || result === undefined) return null;
  if (typeof result !== 'object') return result;
  if (!result.id) return null;
  const lists = [...Object.values(view), ...Object.values(view).filter(value => value && typeof value === 'object' && !Array.isArray(value)).flatMap(Object.values)].filter(Array.isArray);
  for (const list of lists) { const found = list.find(item => item?.id === result.id); if (found) return found; }
  return null;
}
