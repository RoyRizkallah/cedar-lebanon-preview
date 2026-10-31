export const roleConfig = {
  Director: {
    title: 'Center director',
    pages: ['overview', 'admissions', 'patients', 'schedule', 'rooms', 'billing', 'payments', 'wallets', 'expenses', 'ledger', 'reconciliation', 'payers', 'aftercare', 'reports', 'assist'],
    actions: ['inquiry', 'patient', 'care', 'session', 'attendance', 'roomStatus', 'room', 'bed', 'followup', 'outcome', 'invoice', 'payment', 'walletOrderFulfill', 'walletOrderDecline', 'reset']
  },
  Coordinator: {
    title: 'Care coordinator',
    pages: ['overview', 'admissions', 'handoffs', 'patients', 'schedule', 'rooms', 'aftercare', 'reports', 'assist'],
    actions: ['inquiry', 'patient', 'care', 'session', 'roomStatus', 'room', 'bed', 'followup', 'outcome']
  },
  Therapist: {
    title: 'Therapist',
    pages: ['overview', 'patients', 'careplans', 'clinicalreports', 'schedule', 'aftercare'],
    actions: ['care', 'session', 'attendance', 'outcome']
  },
  Finance: {
    title: 'Finance desk',
    pages: ['overview', 'billing', 'payments', 'wallets', 'expenses', 'ledger', 'reconciliation', 'payers', 'reports'],
    actions: ['invoice', 'payment']
  },
  Reception: {
    title: 'Front desk',
    pages: ['overview', 'admissions', 'arrivals', 'schedule', 'rooms'],
    actions: ['inquiry', 'session']
  },
  RSA: {
    title: 'RSA',
    pages: ['overview', 'caseload', 'checkins', 'wallets'],
    actions: ['supportCheckin', 'walletPurchase', 'walletOrderFulfill', 'walletOrderDecline']
  },
  Resident: {
    title: 'Resident',
    pages: ['overview', 'wallet', 'orders'],
    actions: ['walletOrderCreate', 'walletOrderCancel']
  }
};

export const staffProfiles = [
  { id: 'director-elias', role: 'Director', name: 'Elias Haddad', shortName: 'Elias', initials: 'EH', assignment: 'Elias' },
  { id: 'director-sara', role: 'Director', name: 'Sara Khoury', shortName: 'Sara', initials: 'SK', assignment: 'Sara' },
  { id: 'coordinator-maya', role: 'Coordinator', name: 'Maya Mansour', shortName: 'Maya', initials: 'MM', assignment: 'Maya' },
  { id: 'coordinator-nour', role: 'Coordinator', name: 'Nour Haddad', shortName: 'Nour', initials: 'NH', assignment: 'Nour' },
  { id: 'therapist-a', role: 'Therapist', name: 'Therapist A', shortName: 'Therapist A', initials: 'TA', assignment: 'Therapist A' },
  { id: 'therapist-b', role: 'Therapist', name: 'Therapist B', shortName: 'Therapist B', initials: 'TB', assignment: 'Therapist B' },
  { id: 'finance-rana', role: 'Finance', name: 'Rana Saliba', shortName: 'Rana', initials: 'RS', assignment: 'Rana' },
  { id: 'finance-omar', role: 'Finance', name: 'Omar Farah', shortName: 'Omar', initials: 'OF', assignment: 'Omar' },
  { id: 'reception-leila', role: 'Reception', name: 'Leila Nassar', shortName: 'Leila', initials: 'LN', assignment: 'Leila' },
  { id: 'reception-karim', role: 'Reception', name: 'Karim Daher', shortName: 'Karim', initials: 'KD', assignment: 'Karim' },
  { id: 'rsa-salim', role: 'RSA', name: 'Salim Khoury', shortName: 'Salim', initials: 'SK', assignment: 'Salim' },
  { id: 'rsa-dana', role: 'RSA', name: 'Dana Mansour', shortName: 'Dana', initials: 'DM', assignment: 'Dana' },
  { id: 'resident-p1042', role: 'Resident', name: 'Mira K.', shortName: 'Mira', initials: 'MK', assignment: 'P-1042', patientId: 'P-1042' },
  { id: 'resident-p1037', role: 'Resident', name: 'Karim S.', shortName: 'Karim', initials: 'KS', assignment: 'P-1037', patientId: 'P-1037' }
];

export const profilesForRole = role => staffProfiles.filter(person => person.role === role);
export const profileForId = id => staffProfiles.find(person => person.id === id);
export const defaultProfile = role => profilesForRole(role)[0];

export const canViewPage = (role, page) => !!roleConfig[role]?.pages.includes(page);
export const canPerform = (role, action) => !!roleConfig[role]?.actions.includes(action);

export function visiblePatients(role, patients, person) {
  if (role === 'Therapist') return patients.filter(patient => patient.therapist === person?.assignment && patient.status !== 'Archived');
  if (role === 'RSA') return patients.filter(patient => patient.rsa === person?.assignment && patient.status !== 'Archived');
  if (role === 'Resident') return patients.filter(patient => patient.id === (person?.patientId || person?.assignment) && patient.status !== 'Archived');
  return patients;
}

export function visibleSessions(role, sessions, person) {
  if (role === 'Therapist') return sessions.filter(session => session.owner === person?.assignment);
  if (role === 'Reception') return sessions.filter(session => /intake|handover|arrival|coordination/i.test(session.title) || session.owner === 'Coordinator');
  if (role === 'RSA' || role === 'Resident') return [];
  return sessions;
}

export function visibleFollowups(role, followups, person) {
  if (role === 'RSA' || role === 'Resident') return [];
  return role === 'Therapist' ? followups.filter(item => item.owner === person?.assignment) : followups;
}

export function assignedInquiries(data, person) {
  return data.inquiries.filter(item => item.owner === person?.assignment);
}

export function assignedDeskInquiries(data, person) {
  return data.inquiries.filter(item => item.deskOwner === person?.assignment);
}

export function assignedInvoices(data, person) {
  return data.invoices.filter(item => item.owner === person?.assignment);
}

export function assignedDeskSessions(data, person) {
  return data.sessions.filter(item => item.deskOwner === person?.assignment);
}
