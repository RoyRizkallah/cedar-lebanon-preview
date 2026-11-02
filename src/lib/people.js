// The people on the owner's org chart (docs/org-chart.md), and what each of them can open.
// Access follows roles, not names: a person can hold more than one (Imad is an RSA who also
// records doses under Fadia; Georgio is an RSA who holds petty cash).
export const STAFF = [
  { id: 'amer', name: 'Amer Khattab', title: 'General Manager', team: 'Partners', initials: 'AM', roles: ['gm'] },
  { id: 'ahmed', name: 'Ahmed Khattab', title: 'Clinical & Program Director', team: 'Partners', initials: 'AH', roles: ['director'] },
  { id: 'clinical-director', name: 'Wael', title: 'Clinical Director', team: 'Clinical & Program', initials: 'W', roles: ['clinical-director'] },
  { id: 'nabila', name: 'Nabila', title: 'Junior Psychologist', team: 'Clinical & Program', initials: 'N', roles: ['psychologist'] },
  { id: 'nazha', name: 'Nazha', title: 'Drama Therapist', team: 'Clinical & Program', initials: 'NZ', roles: ['drama'] },
  { id: 'fadia', name: 'Fadia', title: 'Head Nurse', team: 'Nursing & Medical', initials: 'F', roles: ['nurse'] },
  { id: 'melyssa', name: 'Melyssa', title: 'Admin & Admissions Manager', team: 'Admin & Admissions', initials: 'M', roles: ['admin'] },
  { id: 'rabih', name: 'Rabih', title: 'Head of Finance', team: 'Finance', initials: 'R', roles: ['finance', 'finance-head'] },
  { id: 'kteish', name: 'Kteish', title: 'Accountant', team: 'Finance', initials: 'K', roles: ['finance'] },
  { id: 'mazen', name: 'Mazen', title: 'Head of Operations', team: 'Operations', initials: 'MZ', roles: ['ops'] },
  { id: 'john', name: 'John', title: 'Physiotherapist, Head of PT & Fitness', team: 'PT & Fitness', initials: 'J', roles: ['pt', 'trainer'] },
  { id: 'zeina', name: 'Zeina', title: 'Movement & Yoga', team: 'PT & Fitness', initials: 'Z', roles: ['trainer'] },
  { id: 'tony-j', name: 'Tony J.', title: 'Tennis', team: 'PT & Fitness', initials: 'TJ', roles: ['trainer'] },
  { id: 'tony-am', name: 'Tony AM', title: 'Personal Trainer', team: 'PT & Fitness', initials: 'TA', roles: ['trainer'] },
  { id: 'raymond', name: 'Raymond', title: 'MMA / Boxing', team: 'PT & Fitness', initials: 'RY', roles: ['trainer'] },
  { id: 'omar', name: 'Omar', title: 'Senior RSA, Peer Lead', team: 'RSA / Floor', initials: 'O', roles: ['rsa', 'rsa-lead'] },
  { id: 'georgio', name: 'Georgio', title: 'RSA, petty cash', team: 'RSA / Floor', initials: 'G', roles: ['rsa', 'petty-cash'] },
  { id: 'alaa', name: 'Alaa', title: 'RSA', team: 'RSA / Floor', initials: 'AL', roles: ['rsa'] },
  { id: 'dania', name: 'Dania', title: 'RSA', team: 'RSA / Floor', initials: 'D', roles: ['rsa'] },
  { id: 'imad', name: 'Imad', title: 'RSA, certified nurse', team: 'RSA / Floor', initials: 'I', roles: ['rsa', 'nurse-aide'] }
];

// RSAs who take residents of their own. Omar leads the floor and sees everyone.
export const RSAS = ['georgio', 'alaa', 'dania', 'imad'];

// Residents can preview their own space (wallet and requests). Not staff; never sees records.
export const RESIDENTS = [
  { id: 'resident-p0001', patientId: 'P-0001', name: 'Karim Haddad', title: 'Resident', initials: 'KH' },
  { id: 'resident-p0007', patientId: 'P-0007', name: 'Lara Khalil', title: 'Resident', initials: 'LK' }
];

const STAFF_ROLES = ['gm', 'director', 'clinical-director', 'psychologist', 'drama', 'nurse', 'admin', 'finance', 'ops', 'pt', 'trainer', 'rsa'];
const MANAGEMENT = ['gm', 'director'];
const INTAKE = [...MANAGEMENT, 'admin'];
const CLINICIANS = ['director', 'clinical-director', 'psychologist', 'drama'];
const CARE = [...CLINICIANS, 'nurse', 'pt', 'trainer'];

// Sidebar sections, in order. Each page lists the roles that can open it.
export const GROUPS = ['My work', 'Intake', 'Care', 'Operations', 'Finance'];
export const GROUP_ICONS = { 'My work': 'home', Intake: 'funnel', Care: 'leaf', Operations: 'building', Finance: 'wallet' };
export const PAGES = [
  { id: 'dashboard', label: 'Dashboard', icon: 'chart', group: 'My work', staff: MANAGEMENT },
  { id: 'today', label: 'Today', icon: 'check-circle', group: 'My work', staff: STAFF_ROLES },
  { id: 'reports', label: 'Reports', icon: 'document', group: 'My work', staff: [...INTAKE, 'clinical-director', 'finance', 'ops'] },
  { id: 'leads', label: 'Leads', icon: 'inbox', group: 'Intake', staff: INTAKE },
  { id: 'pipeline', label: 'Pipeline', icon: 'columns', group: 'Intake', staff: INTAKE },
  { id: 'followups', label: 'Follow-ups', icon: 'clock', group: 'Intake', staff: INTAKE },
  { id: 'admissions', label: 'Admissions', icon: 'door', group: 'Intake', staff: [...INTAKE, 'clinical-director', 'psychologist', 'nurse'] },
  { id: 'insights', label: 'Insights', icon: 'sparkle', group: 'Intake', staff: INTAKE },
  { id: 'patients', label: 'Admitted patients', icon: 'users', group: 'Care', staff: STAFF_ROLES },
  { id: 'programs', label: 'Programs', icon: 'heart', group: 'Care', staff: CARE },
  { id: 'sessions', label: 'Sessions', icon: 'stethoscope', group: 'Care', staff: CARE },
  { id: 'medication', label: 'Medication', icon: 'pill', group: 'Care', staff: ['nurse', 'nurse-aide', 'director', 'clinical-director'] },
  { id: 'rooms', label: 'Rooms & beds', icon: 'bed', group: 'Care', staff: [...INTAKE, 'clinical-director', 'nurse', 'ops', 'rsa'] },
  { id: 'schedule', label: 'Schedule', icon: 'calendar', group: 'Operations', staff: [...INTAKE, ...CARE.filter(role => role !== 'director')] },
  { id: 'safety', label: 'Visits & incidents', icon: 'shield', group: 'Operations', staff: STAFF_ROLES.filter(role => role !== 'finance') },
  { id: 'requests', label: 'Resident support', icon: 'bag', group: 'Operations', staff: [...INTAKE, 'ops', 'rsa'] },
  { id: 'finance', label: 'Accounts', icon: 'receipt', group: 'Finance', staff: ['gm', 'finance'] },
  // The resident's own space: their wallet and requests.
  { id: 'home', label: 'My space', icon: 'home', group: 'My work', staff: ['resident'] }
];

export const TABS = [
  { id: 'overview', label: 'Overview', staff: STAFF_ROLES },
  { id: 'clinical', label: 'Clinical', staff: CLINICIANS },
  { id: 'medical', label: 'Medical', staff: ['director', 'clinical-director', 'nurse', 'nurse-aide', 'pt'] },
  { id: 'fitness', label: 'Fitness', staff: ['director', 'nurse', 'pt', 'trainer'] },
  { id: 'followup', label: 'Follow-up log', staff: ['director', 'clinical-director', 'admin'] },
  { id: 'documents', label: 'Documents', staff: [...INTAKE, 'nurse'] },
  { id: 'wallet', label: 'Wallet & requests', staff: [...INTAKE, 'finance', 'rsa'] }
];

const ACTIONS = {
  editInquiry: INTAKE,
  confirmAdmission: INTAKE,
  bookPsychologist: ['director', 'clinical-director', 'psychologist'],
  bookService: [...CLINICIANS, 'nurse', 'admin', 'pt', 'trainer'],
  seeAllBookings: INTAKE,
  recordPsychiatrist: ['director', 'nurse'],
  recordMedication: ['nurse', 'nurse-aide', 'director'],
  topUpWallet: [...INTAKE, 'finance'],
  pettyCash: [...MANAGEMENT, 'petty-cash'],
  createRequest: [...INTAKE, 'ops', 'rsa'],
  manageDocuments: [...INTAKE, 'nurse'],
  manageRooms: [...INTAKE, 'ops'],
  recordFinance: ['gm', 'finance'],
  approveExpense: ['gm', 'finance-head'],
  logVisit: STAFF_ROLES.filter(role => !['psychologist', 'pt', 'trainer', 'finance'].includes(role)),
  reviewIncident: ['director', 'clinical-director'],
  managePrograms: ['clinical-director', 'psychologist', 'drama'],
  caseReview: ['director', 'clinical-director', 'psychologist'],
  viewRisk: [...CLINICIANS, 'nurse'],
  resetData: MANAGEMENT
};

export const staffById = id => STAFF.find(person => person.id === id) || RESIDENTS.find(person => person.id === id);
export const isResident = id => String(id).startsWith('resident-');
export const rolesOf = id => isResident(id) ? ['resident'] : STAFF.find(person => person.id === id)?.roles || [];
export const hasRole = (id, ...roles) => rolesOf(id).some(role => roles.includes(role));
const allowed = (list, id) => !!list && rolesOf(id).some(role => list.includes(role));
export const staffName = id => staffById(id)?.name || id || '—';
export const canSee = (staffId, page) => allowed(PAGES.find(item => item.id === page)?.staff, staffId);
export const canSeeTab = (staffId, tab) => !isResident(staffId) && allowed(TABS.find(item => item.id === tab)?.staff, staffId);
export const canDo = (staffId, action) => !isResident(staffId) && allowed(ACTIONS[action], staffId);
export const whoCan = action => STAFF.filter(person => canDo(person.id, action)).map(person => person.id);
export const pagesFor = staffId => PAGES.filter(page => allowed(page.staff, staffId));
export const tabsFor = staffId => TABS.filter(tab => canSeeTab(staffId, tab.id));
export const homePage = staffId => (isResident(staffId) ? 'home' : canSee(staffId, 'dashboard') ? 'dashboard' : 'today');

// The RSA with the fewest residents in the house takes the next one.
export function nextRsa(state) {
  const load = id => state.patients.filter(patient => patient.status === 'Admitted' && patient.assigned?.rsa === id).length;
  return RSAS.reduce((best, id) => (load(id) < load(best) ? id : best));
}

export function visiblePatients(state, staffId, { includeDischarged = false } = {}) {
  const list = state.patients.filter(patient => includeDischarged || patient.status === 'Admitted');
  if (hasRole(staffId, 'psychologist')) return list.filter(patient => patient.assigned?.psychologist === staffId);
  if (isResident(staffId)) return list.filter(patient => patient.id === RESIDENTS.find(person => person.id === staffId)?.patientId);
  if (hasRole(staffId, 'rsa')) return list.filter(patient => patient.program !== 'Outpatient' && (hasRole(staffId, 'rsa-lead') || patient.assigned?.rsa === staffId));
  return list;
}
