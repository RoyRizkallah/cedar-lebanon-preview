<script>
  import { onMount } from 'svelte';
  import Registry from './Registry.svelte';
  import { scrollRegion } from './registry.js';
  import Icon from './Icon.svelte';
  import RoleOverview from './RoleOverview.svelte';
  import PatientRecord from './PatientRecord.svelte';
  import Reports from './Reports.svelte';
  import AdmissionDetail from './AdmissionDetail.svelte';
  import InvoiceDetail from './InvoiceDetail.svelte';
  import FinanceWorkspace from './FinanceWorkspace.svelte';
  import RoleTasks from './RoleTasks.svelte';
  import RoleSidebar from './RoleSidebar.svelte';
  import RSAWorkspace from './RSAWorkspace.svelte';
  import WalletWorkspace from './WalletWorkspace.svelte';
  import CenterPulse from './CenterPulse.svelte';
  import WorkspaceSearch from './WorkspaceSearch.svelte';
  import { sidebarConfig } from './sidebarConfig.js';
  import { dialogFocus } from './dialogFocus.js';
  import { loadData, saveData, resetData, withAssignments, iso, prettyDate } from './data.js';
  import { seedAnalytics } from './analytics.js';
  import CedarIntelligence from './CedarIntelligence.svelte';
  import { roleConfig, canViewPage, canPerform, visiblePatients, visibleSessions, visibleFollowups, profilesForRole, profileForId, defaultProfile } from './roles.js';
  import { ensureClinicalData } from './clinical.js';
  import { ensureFinanceData } from './finance.js';
  import { ensureWalletData, addWalletDeposit, addWalletPurchase, createWalletOrder, cancelWalletOrder, declineWalletOrder, fulfillWalletOrder } from './wallet.js';
  import { clearAttachments } from './clinicalFiles.js';
  import { roomCapacity, roomLabel, nextRoomNumber, saveRoomRecord, removeRoomRecord } from './rooms.js';

  const navigation = [
    ['overview', 'Overview', 'grid'], ['admissions', 'Admissions', 'inbox'], ['handoffs', 'Handoff queue', 'check'], ['arrivals', 'Planned arrivals', 'calendar'], ['patients', 'Patients', 'users'], ['careplans', 'Care plans', 'heart'], ['clinicalreports', 'Clinical reports', 'inbox'],
    ['schedule', 'Schedule', 'calendar'], ['rooms', 'Rooms & beds', 'bed'], ['billing', 'Billing', 'wallet'],
    ['payments', 'Payments', 'wallet'], ['expenses', 'Expenses', 'inbox'], ['ledger', 'General ledger', 'chart'], ['reconciliation', 'Reconciliation', 'check'], ['payers', 'Payer accounts', 'users'],
    ['aftercare', 'Aftercare', 'heart'], ['reports', 'Reports', 'chart'], ['assist', 'Cedar Intelligence', 'sparkle'],
    ['caseload', 'My residents', 'users'], ['checkins', 'Daily check-ins', 'check'], ['wallets', 'Resident wallets', 'wallet'], ['wallet', 'My wallet', 'wallet'], ['orders', 'My purchases', 'inbox']
  ];
  const stages = ['New inquiry', 'Intake review', 'Awaiting decision', 'Arrival planned'];
  const roles = ['Director', 'Coordinator', 'Therapist', 'Finance', 'Reception', 'RSA', 'Resident'];
  function initialRole() { const requested = typeof location !== 'undefined' ? new URLSearchParams(location.search).get('role') : null; const fromUrl = roles.find(item => item.toLowerCase() === requested?.toLowerCase()); if (fromUrl) return fromUrl; try { const saved = localStorage.getItem('cedar-role-preview'); return roleConfig[saved] ? saved : 'Director'; } catch { return 'Director'; } }
  function initialStaff(currentRole) { const requested = typeof location !== 'undefined' ? new URLSearchParams(location.search).get('staff') : null; const fromUrl = profileForId(requested); if (fromUrl?.role === currentRole) return fromUrl; try { const saved = profileForId(localStorage.getItem(`cedar-staff-preview:${currentRole}`)); if (saved?.role === currentRole) return saved; } catch {} return defaultProfile(currentRole); }
  let data = ensureWalletData(ensureFinanceData(ensureClinicalData(loadData())));
  if (!data.analytics || data.analyticsAsOf !== iso(0)) { data.analytics = seedAnalytics(); data.analyticsAsOf = iso(0); }
  let page = 'overview';
  let mobileOpen = false;
  let patientDirectoryOpen = false;
  let modal = '';
  let form = {};
  let toast = '';
  let role = initialRole();
  let staffId = initialStaff(role).id;
  $: staff = profileForId(staffId)?.role === role ? profileForId(staffId) : defaultProfile(role);
  let selectedPatient = 'P-1042';
  let walletFocusPatient = '';
  let rsaFocusPatient = '';
  let reviewRequest = 0;
  let patientTabRequest = { tab: '', version: 0 };
  let selectedDate = iso(0);
  let activeRoom = '';
  let activeBed = 0;
  let activeFollowup = '';
  let activeSession = '';
  let activeInquiry = '';
  let activeInvoice = '';
  let editingId = '';
  let deleteTarget = null;
  let formError = '';
  let contactGate = 'Phone';
  let sessionClose = null;
  let closeError = '';
  let toastTimer;

  onMount(() => {
    if (!visiblePatients(role, data.patients, staff).some(patient => patient.id === selectedPatient)) selectedPatient = visiblePatients(role, data.patients, staff)[0]?.id || '';
    const hash = location.hash.slice(1);
    if (navigation.some(n => n[0] === hash) && canView(hash)) page = hash;
    else if (hash) history.replaceState(null, '', '#overview');
    const onHash = () => { const h = location.hash.slice(1); if (navigation.some(n => n[0] === h) && canView(h)) page = h; else { page = 'overview'; history.replaceState(null, '', '#overview'); } };
    const escapeMenu = event => { if (event.key === 'Escape') mobileOpen = false; };
    window.addEventListener('hashchange', onHash);
    window.addEventListener('keydown', escapeMenu);
    return () => { window.removeEventListener('hashchange', onHash); window.removeEventListener('keydown', escapeMenu); };
  });

  $: rolePatients = visiblePatients(role, data.patients, staff);
  $: selected = rolePatients.find(p => p.id === selectedPatient) || rolePatients[0];
  $: totalBeds = roomCapacity(data.rooms);
  $: occupied = data.rooms.flatMap(r => r.beds).filter(Boolean).length;
  $: available = data.rooms.filter(r => r.status === 'Ready').flatMap(r => r.beds).filter(b => !b).length;
  $: notReady = data.rooms.filter(r => r.status !== 'Ready').flatMap(r => r.beds).filter(b => !b).length;
  $: dueToday = visibleFollowups(role, data.followups, staff).filter(f => f.status !== 'Completed' && f.due <= iso(0)).length;
  $: sessionsToday = visibleSessions(role, data.sessions, staff).filter(s => s.date === iso(0)).length;
  $: pendingInquiries = data.inquiries.filter(i => i.stage !== 'Arrival planned').length;
  $: selectedSessions = visibleSessions(role, data.sessions, staff).filter(s => s.date === selectedDate).sort((a,b) => a.time.localeCompare(b.time));
  $: attendanceQueue = [...selectedSessions].filter(s => canManage('attendance', s)).sort((a, b) => {
    const am = isSessionComplete(a) ? 1 : 0;
    const bm = isSessionComplete(b) ? 1 : 0;
    if (am !== bm) return am - bm;
    return a.time.localeCompare(b.time);
  });
  $: attendanceOpen = attendanceQueue.filter(s => !isSessionComplete(s)).length;
  $: attendanceDone = attendanceQueue.length - attendanceOpen;
  $: weeklyDue = weeklyReportsDue();
  $: outstanding = data.invoices.filter(i => i.status !== 'Void').reduce((n,i) => n + Math.max(0, Number(i.amount || 0) - (Number(i.paid) || (i.status === 'Paid' ? Number(i.amount) : 0))), 0);
  $: collected = data.invoices.filter(i => i.status !== 'Void').reduce((n,i) => n + (Number(i.paid) || (i.status === 'Paid' ? Number(i.amount) : 0)), 0);
  $: billed = data.invoices.filter(i => i.status !== 'Void').reduce((n,i) => n + Number(i.amount || 0), 0);

  function canView(id) { return canViewPage(role, id); }
  function navLabel(id, fallback) { return sidebarConfig[role].sections.flatMap(section => section.items).find(item => item[0] === id)?.[1] || fallback; }
  function canManage(kind, item = null) { if (!canPerform(role, kind)) return false; if (role === 'Therapist' && ['session','attendance'].includes(kind) && item) return item.owner === staff.assignment; if (role === 'Therapist' && kind === 'care' && item) return item.therapist === staff.assignment; if (role === 'Therapist' && kind === 'outcome' && item) return item.owner === staff.assignment; return true; }
  function canRemove(kind, item = null) { if (kind === 'invoice') return ['Director','Finance'].includes(role) && !!item && item.status !== 'Void' && Number(item.paid || 0) === 0; if (role === 'Director') return kind !== 'room' || !item?.beds?.some(Boolean); if (role === 'Coordinator') return ['inquiry','session','followup','bed'].includes(kind); if (role === 'Therapist') return kind === 'session' && item?.owner === staff.assignment; return false; }
  function changeRole() { const nextStaff = initialStaff(role); staffId = nextStaff.id; try { localStorage.setItem('cedar-role-preview', role); } catch {} updatePreviewUrl(); selectedPatient = visiblePatients(role, data.patients, nextStaff)[0]?.id || ''; closeModal(); go('overview'); notice(`${nextStaff.name}'s workspace opened.`); }
  function changeStaff() { const nextStaff = profileForId(staffId); if (nextStaff?.role !== role) return; try { localStorage.setItem(`cedar-staff-preview:${role}`, staffId); } catch {} updatePreviewUrl(); selectedPatient = visiblePatients(role, data.patients, nextStaff)[0]?.id || ''; closeModal(); go('overview'); notice(`${nextStaff.name}'s workspace opened.`); }
  function updatePreviewUrl() { const url = new URL(location.href); url.searchParams.set('role', role.toLowerCase()); url.searchParams.set('staff', staffId); history.replaceState(null, '', `${url.pathname}${url.search}${url.hash}`); }
  function go(id) { if (!canView(id)) { notice('This preview role does not open that workspace.'); return; } if (id === 'checkins') rsaFocusPatient = ''; page = id; location.hash = id; mobileOpen = false; window.scrollTo({ top: 0, behavior: 'smooth' }); }
  function notice(message) { toast = message; clearTimeout(toastTimer); toastTimer = setTimeout(() => toast = '', 3500); }
  function openPatientTab(id, tab, sourceId = '') { selectedPatient = id; patientTabRequest = { tab, sourceId, version: patientTabRequest.version + 1 }; go('patients'); }
  function openResidentWallet(id) { if (role !== 'RSA' || !visiblePatients(role, data.patients, staff).some(patient => patient.id === id)) return; walletFocusPatient = id; go('wallets'); }
  function openRsaCheckin(id) { if (role !== 'RSA' || !visiblePatients(role, data.patients, staff).some(patient => patient.id === id && patient.program === 'Residential')) return; go('checkins'); rsaFocusPatient = id; }
  function persist() { data = ensureWalletData(ensureFinanceData(ensureClinicalData(withAssignments({ ...data })))); saveData(data); }
  function logAction(section, action) { data.activity = [{ id: `ACT-${Date.now()}`, section, action, at: new Date().toISOString() }, ...(data.activity || [])].slice(0, 30); }
  function recordSupportCheckin({ patientId, status, note, followUp } = {}) {
    const patient = data.patients.find(item => item.id === patientId && item.status !== 'Archived' && item.program === 'Residential');
    if (role !== 'RSA' || !patient || patient.rsa !== staff.assignment) { notice('This resident is outside your assignment.'); return false; }
    const cleanNote = String(note || '').trim();
    if (cleanNote.length < 8 || !['Settled', 'Needs follow-up', 'Request noted'].includes(status)) { notice('Choose a status and add a useful check-in note.'); return false; }
    data.supportCheckins.unshift({ id: nextId('SC', data.supportCheckins), patientId, date: iso(0), status, note: cleanNote, followUp: String(followUp || '').trim(), recordedBy: staff.name });
    rsaFocusPatient = '';
    logAction('RSA', `${patientId} daily check-in recorded`);
    persist(); notice('Daily check-in saved.'); return true;
  }
  function recordWalletDeposit(payload = {}) {
    const patient = data.patients.find(item => item.id === payload.patientId && item.status !== 'Archived' && item.program === 'Residential');
    if (!['Director', 'Finance'].includes(role) || !patient) { notice('Choose an active residential account.'); return false; }
    try {
      addWalletDeposit(data, { ...payload, patientId: patient.id, recordedBy: staff.name, date: iso(0) });
      logAction('Resident wallets', `${patient.id} funds received`);
      persist(); notice('Funds recorded in the resident wallet.'); return true;
    } catch (error) { notice(error.message || 'The deposit could not be recorded.'); throw error; }
  }
  function recordWalletPurchase(payload = {}) {
    const patient = data.patients.find(item => item.id === payload.patientId && item.status !== 'Archived' && item.program === 'Residential');
    if (!['Director', 'RSA'].includes(role) || !patient || (role === 'RSA' && patient.rsa !== staff.assignment)) { notice('This resident is outside your assignment.'); return false; }
    try {
      addWalletPurchase(data, { ...payload, patientId: patient.id, recordedBy: staff.name, date: iso(0) });
      logAction('Resident wallets', `${patient.id} purchase recorded`);
      persist(); notice('Purchase recorded and wallet balance updated.'); return true;
    } catch (error) { notice(error.message || 'The purchase could not be recorded.'); throw error; }
  }
  function submitResidentOrder(payload = {}) {
    const patient = data.patients.find(item => item.id === staff.patientId && item.status !== 'Archived' && item.program === 'Residential');
    if (!canPerform(role, 'walletOrderCreate') || !patient) throw new Error('This resident account cannot place an order.');
    const order = createWalletOrder(data, { ...payload, patientId: patient.id, createdBy: staff.name });
    logAction('Resident orders', `${order.id} requested by ${patient.id}`);
    persist(); notice('Your request was sent to the Cedar team.'); return true;
  }
  function cancelResidentOrder({ orderId } = {}) {
    const order = data.walletOrders?.find(item => item.id === orderId);
    if (!canPerform(role, 'walletOrderCancel') || !order || order.patientId !== staff.patientId) throw new Error('You can cancel only your own pending request.');
    cancelWalletOrder(data, { orderId, cancelledBy: staff.name });
    logAction('Resident orders', `${orderId} cancelled by resident`);
    persist(); notice('Order request cancelled.'); return true;
  }
  function staffOrder({ orderId, amount, note } = {}, action) {
    const order = data.walletOrders?.find(item => item.id === orderId);
    const patient = data.patients.find(item => item.id === order?.patientId && item.status !== 'Archived' && item.program === 'Residential');
    if (!canPerform(role, action === 'fulfill' ? 'walletOrderFulfill' : 'walletOrderDecline') || !patient || (role === 'RSA' && patient.rsa !== staff.assignment)) throw new Error('This request is outside your assigned residents.');
    if (action === 'fulfill') fulfillWalletOrder(data, { orderId, amount, note, recordedBy: staff.name, date: iso(0) });
    else declineWalletOrder(data, { orderId, note, declinedBy: staff.name });
    logAction('Resident orders', `${orderId} ${action === 'fulfill' ? 'fulfilled' : 'declined'}`);
    persist(); notice(action === 'fulfill' ? 'Order fulfilled and wallet updated.' : 'Order request declined.'); return true;
  }
  function fulfillResidentOrder(payload) { return staffOrder(payload, 'fulfill'); }
  function declineResidentOrder(payload) { return staffOrder(payload, 'decline'); }
  function openModal(kind, extra = {}) { if (!canManage(kind)) { notice('This role cannot make that change.'); return; } editingId = ''; formError = ''; modal = kind; contactGate = kind === 'patient' ? 'Phone' : 'Phone'; form = { date: iso(0), issued: iso(0), due: iso(kind === 'invoice' ? 7 : 0), admitted: iso(0), time: '10:00', program: 'Outpatient', ageBand: '25–34', language: 'Arabic', referral: 'Self referral', contactPreference: 'Confirm with coordinator', stage: 'New inquiry', subject: '', preferredContact: 'Phone', contactPhone: '', contactEmail: '', contactNote: '', contactMethod: 'Phone', location: 'Beirut', handoff: '', owner: role === 'Therapist' ? staff.assignment : kind === 'invoice' ? (role === 'Finance' ? staff.assignment : 'Rana') : kind === 'inquiry' ? (role === 'Coordinator' ? staff.assignment : 'Unassigned') : kind === 'session' ? 'Coordinator' : role === 'Coordinator' ? staff.assignment : 'Maya', deskOwner: role === 'Reception' ? staff.assignment : 'Leila', kind: 'green', patient: '', patientRef: '', paid: 0, fundingType: 'Self-pay', paymentTerms: 'Due on date', description: 'Program and treatment administration', therapist: 'Therapist A', ...extra }; contactGate = form.preferredContact || form.contactMethod || 'Phone'; if (kind === 'room') form = { wing: 'A', roomNumber: nextRoomNumber(data.rooms), bedCount: 2, status: 'Preparing', access: 'Standard', notes: '', ...extra }; }
  function openEdit(kind, item) { if (!canManage(kind, item)) { notice('This role cannot edit that record.'); return; } editingId = item.id; formError = ''; modal = kind; form = { contactPhone: '', contactEmail: '', contactNote: '', contactMethod: item.preferredContact || item.contactMethod || 'Phone', ...item }; if (kind === 'patient' && !form.contactMethod) form.contactMethod = item.contactPreference?.startsWith('Email') ? 'Email' : item.contactPreference?.startsWith('Phone') ? 'Phone' : (item.contactPreference || 'Confirm with coordinator'); if (kind === 'followup' && !form.contactMethod) form.contactMethod = item.consent?.toLowerCase().includes('email') ? 'Email' : 'Phone'; contactGate = form.preferredContact || form.contactMethod || 'Phone'; if (kind === 'room') form = { wing: item.id[0], roomNumber: item.id.split('-')[1], bedCount: item.beds.length, status: item.status, access: item.access || 'Standard', notes: item.notes || '' }; }
  function closeModal() { modal = ''; form = {}; editingId = ''; formError = ''; contactGate = 'Phone'; deleteTarget = null; }
  function askDelete(kind, id, label) { const item = ({ inquiry: data.inquiries, session: data.sessions, invoice: data.invoices, followup: data.followups, room: data.rooms }[kind] || []).find(entry => entry.id === id); if (!canRemove(kind, item)) { notice('This role cannot remove that record.'); return; } deleteTarget = { kind, id, label: kind === 'bed' ? label.toLowerCase() : kind === 'room' ? `remove ${label}` : kind === 'invoice' ? `void ${label}` : `remove ${label}` }; editingId = ''; formError = ''; modal = 'confirm'; form = {}; }
  function nextId(prefix, list) { return `${prefix}-${String(Math.max(0, ...list.map(x => Number(x.id.split('-')[1]) || 0)) + 1).padStart(3, '0')}`; }
  function convertInquiry(item) {
    if (!canManage('patient') || item.linkedPatient || item.stage !== 'Arrival planned' || item.decision !== 'Approved by staff') { notice('A staff-approved planned arrival is required.'); return; }
    const id = nextId('P', data.patients);
    const patient = { id, name: item.subject || `Demo case ${id}`, program: item.program || 'Residential', room: '—', coordinator: item.owner === 'Nour' ? 'Nour Haddad' : 'Maya Mansour', therapist: item.therapist || 'Therapist A', next: item.next || 'To schedule', care: 'Initial care plan review', consent: 'Confirm communication preference', admitted: iso(0), ageBand: 'Not recorded', language: 'Arabic', referral: item.source || 'Referral', contactMethod: item.preferredContact || 'Phone', contactPhone: item.contactPhone || '', contactEmail: item.contactEmail || '', contactPreference: item.preferredContact === 'Phone' && item.contactPhone ? `Phone · ${item.contactPhone}` : item.preferredContact === 'Email' && item.contactEmail ? `Email · ${item.contactEmail}` : (item.preferredContact || 'Confirm with coordinator'), status: 'Active' };
    patient.rsa = 'Unassigned';
    data.patients.unshift(patient);
    item.linkedPatient = id;
    item.history.unshift({ id: `H-${Date.now()}`, date: iso(0), action: `Patient record ${id} created`, by: staff.name });
    selectedPatient = id;
    logAction('Admissions', `${item.id} handed off to patient record ${id}`);
    persist(); activeInquiry = ''; go('patients'); notice(`${id} created from ${item.id}.`);
  }
  function saveForm() {
    const action = modal === 'payment' ? 'payment' : modal === 'outcome' ? 'outcome' : modal === 'confirm' ? deleteTarget?.kind : modal;
    if (modal !== 'confirm' && !canManage(action, modal === 'care' ? data.patients.find(p => p.id === editingId) : modal === 'outcome' ? data.followups.find(f => f.id === activeFollowup) : modal === 'attendance' ? data.sessions.find(s => s.id === activeSession) : modal === 'session' && editingId ? data.sessions.find(s => s.id === editingId) : null)) { formError = 'This role cannot save that change.'; return; }
    if (modal === 'confirm' && !canRemove(deleteTarget?.kind, ({ inquiry: data.inquiries, session: data.sessions, invoice: data.invoices, followup: data.followups, room: data.rooms }[deleteTarget?.kind] || []).find(item => item.id === deleteTarget?.id))) { formError = 'This role cannot remove that record.'; return; }
    if (modal === 'inquiry') {
      if (role === 'Reception' && !['New inquiry','Intake review'].includes(form.stage || 'New inquiry')) { formError = 'Reception can manage first contact and intake review only.'; return; }
      const preferred = contactGate || form.preferredContact || 'Phone';
      if (preferred === 'Phone' && !form.contactPhone?.trim()) { formError = 'Enter a phone number for this inquiry.'; return; }
      if (preferred === 'Email' && !form.contactEmail?.trim()) { formError = 'Enter an email address for this inquiry.'; return; }
      const value = { name: form.name?.trim() || 'New inquiry', subject: form.subject?.trim() || 'New demo contact', program: form.program || 'Residential', preferredContact: preferred, contactPhone: preferred === 'Phone' ? form.contactPhone.trim() : (form.contactPhone?.trim() || ''), contactEmail: preferred === 'Email' ? form.contactEmail.trim() : (form.contactEmail?.trim() || ''), contactNote: preferred === 'In person' ? (form.contactNote?.trim() || '') : '', location: form.location?.trim() || 'Beirut', therapist: form.therapist || 'Therapist A', handoff: form.handoff?.trim() || 'Document the next contact and complete the intake checklist.', source: form.source || 'Website', stage: form.stage || 'New inquiry', next: form.next?.trim() || 'Schedule first conversation', owner: form.owner || 'Unassigned', date: form.date || iso(0), documents: !!form.documents, deskOwner: role === 'Reception' && !editingId ? staff.assignment : form.deskOwner || 'Leila' };
      if (role === 'Reception' && editingId) value.documents = data.inquiries.find(i => i.id === editingId)?.documents || false;
      if (editingId) Object.assign(data.inquiries.find(i => i.id === editingId), value);
      else data.inquiries.unshift({ id: nextId('INQ', data.inquiries), ...value });
      logAction('Admissions', `${editingId || 'New inquiry'} ${editingId ? 'updated' : 'created'}`);
      notice(editingId ? 'Inquiry updated.' : 'Inquiry added to the demo pipeline.');
    } else if (modal === 'patient') {
      const method = contactGate || form.contactMethod || 'Confirm with coordinator';
      if (method === 'Phone' && !form.contactPhone?.trim()) { formError = 'Enter a phone number for this patient.'; return; }
      if (method === 'Email' && !form.contactEmail?.trim()) { formError = 'Enter an email address for this patient.'; return; }
      const contactPreference = method === 'Phone' ? `Phone · ${form.contactPhone.trim()}` : method === 'Email' ? `Email · ${form.contactEmail.trim()}` : method;
      const value = { name: form.name?.trim() || 'Patient reference', program: form.program || 'Outpatient', coordinator: form.coordinator?.trim() || 'Unassigned', therapist: form.therapist || 'Therapist A', next: form.next?.trim() || 'To schedule', care: form.care?.trim() || 'No open care tasks', consent: form.consent?.trim() || 'Contact preference to confirm', admitted: form.admitted || iso(0), ageBand: form.ageBand || 'Not recorded', language: form.language?.trim() || 'Arabic', referral: form.referral?.trim() || 'Self referral', contactMethod: method, contactPhone: method === 'Phone' ? form.contactPhone.trim() : (form.contactPhone?.trim() || ''), contactEmail: method === 'Email' ? form.contactEmail.trim() : (form.contactEmail?.trim() || ''), contactPreference };
      value.rsa = form.program === 'Residential' ? (form.rsa || 'Unassigned') : 'Unassigned';
      if (editingId) Object.assign(data.patients.find(p => p.id === editingId), value);
      else { const id = nextId('P', data.patients); data.patients.unshift({ id, room: '—', status: 'Active', ...value }); selectedPatient = id; }
      logAction('Patients', `${editingId || selectedPatient} ${editingId ? 'updated' : 'created'}`);
      notice(editingId ? 'Patient record updated.' : 'Patient record created.');
    } else if (modal === 'care') {
      const patient = data.patients.find(p => p.id === editingId);
      if (!patient || !canManage('care', patient)) { formError = 'This patient is outside your assigned caseload.'; return; }
      patient.care = form.care?.trim() || 'No open care tasks'; patient.next = form.next?.trim() || 'To schedule';
      logAction('Patients', `${patient.id} care task updated`); notice('Care task updated.');
    } else if (modal === 'session') {
      if (role === 'Therapist') form.owner = staff.assignment;
      if (role === 'Therapist' && form.patientRef && !rolePatients.some(item => item.id === form.patientRef)) { formError = 'Choose a patient from your assigned caseload.'; return; }
      if (role === 'Reception' && !['Coordinator','Care team'].includes(form.owner)) { formError = 'Reception can schedule desk and coordination work only.'; return; }
      if (data.sessions.some(s => s.id !== editingId && s.date === form.date && s.time === form.time && s.owner === form.owner)) { formError = 'This owner already has a session at that time. Choose another time or owner.'; return; }
      const value = { title: form.title?.trim() || 'New session', date: form.date || iso(0), time: form.time || '10:00', owner: form.owner || 'Coordinator', meta: form.meta?.trim() || 'Room to confirm', patientRef: form.patientRef || '', kind: form.kind || 'green', deskOwner: role === 'Reception' && !editingId ? staff.assignment : form.deskOwner || 'Leila' };
      if (editingId) Object.assign(data.sessions.find(s => s.id === editingId), value);
      else data.sessions.push({ id: nextId('SES', data.sessions), ...value });
      selectedDate = value.date; logAction('Schedule', `Session ${editingId || 'created'} ${editingId ? 'updated' : ''}`.trim()); notice(editingId ? 'Session updated.' : 'Session added to the schedule.');
    } else if (modal === 'attendance') {
      const session = data.sessions.find(item => item.id === activeSession);
      const patientId = sessionPatientId(session || {});
      const patient = data.patients.find(item => item.id === patientId);
      if (!session || !canManage('attendance', session)) { formError = 'This session cannot be marked by your role.'; return; }
      const value = { sessionId: session.id, date: session.date, title: session.title, staff: staff.name, status: form.status || 'Attended', note: form.note?.trim() || '' };
      if (patient) {
        const record = data.clinical[patientId];
        const prior = record.attendance.find(item => item.sessionId === session.id);
        if (prior) Object.assign(prior, value);
        else record.attendance.unshift({ id: `ATT-${Date.now()}`, ...value });
      }
      session.attendanceStatus = value.status;
      session.attendanceBy = staff.name;
      session.attendanceNote = value.note;
      logAction('Schedule', `Attendance ${value.status.toLowerCase()} for ${session.id}${patientId ? ` / ${patientId}` : ''}`);
      notice('Attendance recorded.');
    } else if (modal === 'followup') {
      const method = contactGate || form.contactMethod || 'Phone';
      if (method === 'Phone' && !form.contactPhone?.trim()) { formError = 'Enter the phone number for this follow-up.'; return; }
      if (method === 'Email' && !form.contactEmail?.trim()) { formError = 'Enter the email address for this follow-up.'; return; }
      if (!form.patient) { formError = 'Select a patient.'; return; }
      const consentBase = form.consent?.trim() || (method === 'Phone' ? 'Phone contact agreed' : method === 'Email' ? 'Email contact agreed' : 'In-person contact agreed');
      const value = { patient: form.patient.trim().toUpperCase(), action: form.action?.trim() || 'Follow-up call', owner: form.owner || 'Maya', due: form.due || iso(0), time: form.time || '15:00', contactMethod: method, contactPhone: method === 'Phone' ? form.contactPhone.trim() : '', contactEmail: method === 'Email' ? form.contactEmail.trim() : '', consent: consentBase };
      if (editingId) Object.assign(data.followups.find(f => f.id === editingId), value);
      else data.followups.unshift({ id: nextId('AF', data.followups), ...value, status: 'Upcoming' });
      logAction('Aftercare', `Follow-up ${editingId || 'created'} ${editingId ? 'updated' : ''}`.trim()); notice(editingId ? 'Follow-up updated.' : 'Follow-up assigned.');
    } else if (modal === 'invoice') {
      if (editingId && data.invoices.find(i => i.id === editingId)?.status === 'Void') { formError = 'Voided invoices cannot be edited.'; return; }
      if (Number(form.paid || 0) > Number(form.amount || 0)) { formError = 'Recorded payments cannot exceed the invoice amount.'; return; }
      if ((form.issued || iso(0)) > (form.due || iso(7))) { formError = 'Due date must be on or after the issue date.'; return; }
      const value = { patient: form.patient?.trim().toUpperCase(), payer: form.payer?.trim() || 'Self-pay', issued: form.issued || iso(0), due: form.due || iso(7), amount: Number(form.amount) || 0, paid: Number(form.paid) || 0, fundingType: form.fundingType || 'Self-pay', paymentTerms: form.paymentTerms || 'Due on date', description: form.description?.trim() || 'Program and treatment administration', owner: role === 'Finance' && !editingId ? staff.assignment : form.owner || 'Rana' };
      value.status = value.paid >= value.amount ? 'Paid' : value.paid > 0 ? 'Part-paid' : value.due < iso(0) ? 'Overdue' : 'Upcoming';
      if (editingId) Object.assign(data.invoices.find(i => i.id === editingId), value);
      else data.invoices.unshift({ id: nextId('INV', data.invoices), ...value });
      logAction('Billing', `Invoice ${editingId || 'created'} ${editingId ? 'updated' : ''}`.trim()); notice(editingId ? 'Invoice updated.' : 'Invoice added to the demo ledger.');
    } else if (modal === 'room') {
      const result = saveRoomRecord(data, form, editingId);
      if (result.error) { formError = result.error; return; }
      logAction('Rooms', `${result.room.id} ${result.created ? 'created' : 'updated'}`);
      notice(`${result.room.id} ${result.created ? 'added' : 'updated'}.`);
    } else if (modal === 'bed') {
      const room = data.rooms.find(r => r.id === activeRoom);
      const patientId = (form.patient || '').trim().toUpperCase();
      const patient = data.patients.find(p => p.id === patientId && p.status !== 'Archived');
      if (!patient) { formError = 'Choose an active patient from the directory first.'; return; }
      if (data.rooms.some(r => r.beds.includes(patientId))) { formError = 'This patient already has a bed. Release the previous placement first.'; return; }
      if (room?.status !== 'Ready') { formError = 'Mark the room ready before assigning a bed.'; return; }
      if (room && !room.beds[activeBed]) { room.beds[activeBed] = patientId; patient.room = room.id; patient.program = 'Residential'; logAction('Rooms', `${patientId} assigned to ${activeRoom}, bed ${activeBed + 1}`); notice(`${activeRoom}, bed ${activeBed + 1} assigned in the demo.`); }
    } else if (modal === 'outcome') {
      const followup = data.followups.find(f => f.id === activeFollowup);
      if (followup) { if (form.nextAction?.trim() && form.nextDue < iso(0)) { formError = 'Choose today or a later date for the next task.'; return; } followup.status = 'Completed'; followup.outcome = form.outcome?.trim() || 'Contact recorded'; followup.contactResult = form.contactResult || 'Reached'; followup.completedAt = iso(0); if (form.nextAction?.trim()) data.followups.unshift({ id: nextId('AF', data.followups), patient: followup.patient, action: form.nextAction.trim(), owner: role === 'Therapist' ? staff.assignment : form.nextOwner || followup.owner, due: form.nextDue || iso(7), time: followup.time, status: 'Upcoming', consent: followup.consent, linkedFrom: followup.id }); logAction('Aftercare', `${activeFollowup} completed${form.nextAction?.trim() ? ' and next task assigned' : ''}`); notice(form.nextAction?.trim() ? 'Outcome recorded and next task assigned.' : 'Outcome recorded and task completed.'); }
    } else if (modal === 'payment') {
      const invoice = data.invoices.find(i => i.id === editingId);
      const amount = Number(form.payment || 0);
      if (!invoice || invoice.status === 'Void' || amount <= 0 || amount > invoice.amount - (Number(invoice.paid) || 0)) { formError = 'Enter an amount within the open balance.'; return; }
      invoice.payments ||= [];
      invoice.payments.unshift({ id: `PAY-${Date.now()}`, date: form.paymentDate || iso(0), amount, method: form.method || 'Bank transfer', reference: form.reference?.trim() || '—', note: form.paymentNote?.trim() || '' });
      invoice.paid = Math.round(invoice.payments.reduce((sum, item) => sum + Math.round(Number(item.amount || 0) * 100), 0)) / 100;
      invoice.status = invoice.paid >= invoice.amount ? 'Paid' : 'Part-paid';
      logAction('Billing', `Payment recorded for ${invoice.id}`); notice('Payment recorded in the demo ledger.');
    } else if (modal === 'confirm' && deleteTarget) {
      const { kind, id } = deleteTarget;
      if (kind === 'bed') { const room = data.rooms.find(r => r.id === activeRoom); const patientId = room?.beds[activeBed]; if (room) room.beds[activeBed] = null; const patient = data.patients.find(p => p.id === patientId); if (patient) patient.room = '—'; logAction('Rooms', `Placement released from ${activeRoom}, bed ${activeBed + 1}`); }
      else if (kind === 'room') { const result = removeRoomRecord(data, id); if (result.error) { formError = result.error; return; } logAction('Rooms', `${id} removed`); }
      else if (kind === 'invoice') { const invoice = data.invoices.find(item => item.id === id); if (invoice) { invoice.status = 'Void'; invoice.voidedAt = iso(0); invoice.voidedBy = staff.name; logAction('Billing', `${id} voided with a reversing journal entry`); } }
      else { const collection = { inquiry: 'inquiries', session: 'sessions', followup: 'followups' }[kind]; if (collection) data[collection] = data[collection].filter(item => item.id !== id); logAction(kind, `${id} removed`); }
      notice('Demo record updated.');
    }
    persist(); closeModal();
  }
  function advanceInquiry(id) { const item = data.inquiries.find(i => i.id === id); if (!item || !canManage('inquiry')) return; const n = stages.indexOf(item.stage); if (role === 'Reception' && n >= 1) { notice('Intake review needs a coordinator handoff.'); return; } if (n < stages.length - 1) { if (stages[n + 1] === 'Arrival planned' && item.decision !== 'Approved by staff') { activeInquiry = id; notice('Record the authorized staff decision before planning arrival.'); return; } item.stage = stages[n + 1]; item.history ||= []; item.history.unshift({ id: `H-${Date.now()}`, date: iso(0), action: `Moved to ${item.stage}`, by: staff.name }); item.next = ['Assign intake coordinator','Review consent and documents','Authorized team decision','Confirm room and welcome pack'][n + 1]; logAction('Admissions', `${id} moved to ${item.stage}`); persist(); notice(`${id} moved to ${item.stage}.`); } }
  function openPayment(item) { if (!canManage('payment') || item.status === 'Void') return; editingId = item.id; formError = ''; form = { payment: item.amount - (Number(item.paid) || 0), paymentDate: iso(0), method: 'Bank transfer', reference: '', paymentNote: '' }; modal = 'payment'; }
  function sessionPatientId(session) { return session.patientRef || session.meta?.match(/P-\d+/)?.[0] || ''; }
  function weekBounds(dateStr = iso(0)) {
    const d = new Date(`${dateStr}T12:00:00`);
    const mondayOffset = (d.getDay() + 6) % 7;
    const start = new Date(d); start.setDate(d.getDate() - mondayOffset);
    const end = new Date(start); end.setDate(start.getDate() + 6);
    const stamp = (value) => {
      const y = value.getFullYear();
      const m = String(value.getMonth() + 1).padStart(2, '0');
      const day = String(value.getDate()).padStart(2, '0');
      return `${y}-${m}-${day}`;
    };
    return { start: stamp(start), end: stamp(end) };
  }
  function attendanceFor(session) {
    const patientId = sessionPatientId(session);
    if (patientId) {
      const clinical = data.clinical?.[patientId]?.attendance?.find(item => item.sessionId === session.id);
      if (clinical) return clinical;
    }
    if (session.attendanceStatus) return { status: session.attendanceStatus, note: session.attendanceNote || '', staff: session.attendanceBy || '', closed: !!session.sessionClosed };
    return null;
  }
  function isSessionComplete(session) {
    const marked = attendanceFor(session);
    return !!(marked && (session.sessionClosed || (marked.note && marked.note.trim() && marked.note !== 'Attendance recorded')));
  }
  function markAttendance(session, status) {
    if (!canManage('attendance', session)) { notice('Only the assigned therapist can mark this session.'); return; }
    const patientId = sessionPatientId(session);
    if (patientId && data.patients.some(item => item.id === patientId)) {
      data = ensureClinicalData(data);
      const record = data.clinical[patientId];
      if (!record) { notice('Patient clinical file is missing.'); return; }
      const prior = record.attendance.find(item => item.sessionId === session.id);
      const value = { sessionId: session.id, date: session.date, title: session.title, staff: staff.name, status, note: prior?.note || session.attendanceNote || '' };
      if (prior) Object.assign(prior, value);
      else record.attendance.unshift({ id: `ATT-${Date.now()}`, ...value });
    }
    session.attendanceStatus = status;
    session.attendanceBy = staff.name;
    session.attendanceAt = new Date().toISOString();
    session.sessionClosed = false;
    logAction('Schedule', `${session.id} marked ${status}${patientId ? ` · ${patientId}` : ''}`);
    persist();
    closeError = '';
    sessionClose = { sessionId: session.id, patientId, status, note: '', title: session.title, time: session.time };
    notice(`${session.time} · ${status}. Add the close note to finish.`);
  }
  function saveSessionClose() {
    if (!sessionClose) return;
    const note = sessionClose.note?.trim();
    if (!note || note.length < 8) { closeError = 'Write one short line about what happened or the next step.'; return; }
    const session = data.sessions.find(item => item.id === sessionClose.sessionId);
    if (!session || !canManage('attendance', session)) { closeError = 'You cannot close this session.'; return; }
    const patientId = sessionClose.patientId || sessionPatientId(session);
    session.attendanceNote = note;
    session.sessionClosed = true;
    session.attendanceStatus = sessionClose.status || session.attendanceStatus;
    if (patientId && data.clinical?.[patientId]) {
      const record = data.clinical[patientId];
      const att = record.attendance.find(item => item.sessionId === session.id);
      if (att) att.note = note;
      else record.attendance.unshift({ id: `ATT-${Date.now()}`, sessionId: session.id, date: session.date, title: session.title, staff: staff.name, status: session.attendanceStatus || 'Attended', note });
      record.notes.unshift({
        id: `NOTE-${Date.now()}`,
        kind: 'Session note',
        title: `Session close · ${session.title}`,
        body: note,
        author: staff.name,
        date: iso(0),
        time: new Date().toLocaleTimeString('en-LB', { hour: '2-digit', minute: '2-digit', hour12: false }),
        status: 'Signed',
        sessionId: session.id
      });
    }
    logAction('Schedule', `${session.id} closed with note`);
    persist();
    sessionClose = null;
    closeError = '';
    notice('Session closed and recorded.');
  }
  function weeklyReportsDue() {
    if (!canPerform(role, 'attendance')) return [];
    const { start, end } = weekBounds(iso(0));
    const mine = visibleSessions(role, data.sessions, staff).filter(session => canManage('attendance', session) && session.date >= start && session.date <= end && sessionPatientId(session));
    const byPatient = new Map();
    for (const session of mine) {
      const patientId = sessionPatientId(session);
      if (!byPatient.has(patientId)) byPatient.set(patientId, []);
      byPatient.get(patientId).push(session);
    }
    const due = [];
    for (const [patientId, sessions] of byPatient) {
      const record = data.clinical?.[patientId];
      const hasWeekly = (record?.reports || []).some(report => report.type === 'Weekly progress' && report.periodStart === start && report.periodEnd === end);
      if (!hasWeekly) {
        const patient = data.patients.find(item => item.id === patientId);
        due.push({ patientId, name: patient?.name || patientId, sessions: sessions.length, start, end });
      }
    }
    return due;
  }
  function draftWeeklyReport(item) {
    data = ensureClinicalData(data);
    const record = data.clinical[item.patientId];
    if (!record) { notice('Clinical file missing.'); return; }
    const { start, end } = weekBounds(iso(0));
    const weekSessions = visibleSessions(role, data.sessions, staff).filter(session => sessionPatientId(session) === item.patientId && session.date >= start && session.date <= end);
    const lines = weekSessions.map(session => {
      const marked = attendanceFor(session);
      return `${session.date} ${session.time} · ${session.title} — ${marked ? marked.status : 'Not recorded'}${marked?.note && marked.note !== 'Attendance recorded' ? ` · ${marked.note}` : ''}`;
    });
    const report = {
      id: `RPT-${Date.now()}`,
      type: 'Weekly progress',
      title: `Weekly progress · ${prettyDate(start, { day: 'numeric', month: 'short' })}–${prettyDate(end, { day: 'numeric', month: 'short' })}`,
      periodStart: start,
      periodEnd: end,
      overview: `Weekly summary for ${item.name}. ${weekSessions.length} linked session${weekSessions.length === 1 ? '' : 's'} in this period.`,
      engagement: lines.length ? lines.join('\n') : 'No linked sessions this week.',
      goals: 'Review open care-plan goals with the assigned therapist.',
      nextSteps: 'Confirm next appointment and any follow-up from sessions this week.',
      status: 'Draft',
      author: staff.name,
      createdAt: iso(0)
    };
    record.reports.unshift(report);
    logAction('Patients', `${item.patientId} weekly report draft created`);
    persist();
    selectedPatient = item.patientId;
    patientTabRequest = { tab: 'Reports', version: patientTabRequest.version + 1 };
    go('patients');
    notice(`Weekly draft ready for ${item.patientId}. Review and finish it.`);
  }
  function openAttendance(session) { if (!canManage('attendance', session)) { notice('Only the assigned therapist can record this session.'); return; } const patientId = sessionPatientId(session); const prior = attendanceFor(session); if (!patientId || !data.patients.some(item => item.id === patientId)) { session.attendanceNote = session.attendanceNote || ''; notice('Marked on the session. Link a patient to keep it on the clinical log.'); markAttendance(session, prior?.status || 'Attended'); return; } activeSession = session.id; editingId = prior?.id || ''; formError = ''; form = { date: session.date, title: session.title, staff: staff.name, patient: patientId, status: prior?.status || 'Attended', note: prior?.note || '' }; modal = 'attendance'; }
  function openBed(room, n) { activeRoom = room; activeBed = n; openModal('bed'); }
  function setRoomStatus(room, status) { if (!canManage('roomStatus')) { notice('This role can view room readiness only.'); return; } if (status === 'Maintenance' && room.beds.some(Boolean)) { notice('Release occupied beds before marking a room for maintenance.'); return; } room.status = status; logAction('Rooms', `${room.id} marked ${status.toLowerCase()}`); persist(); notice(`${room.id} marked ${status.toLowerCase()}.`); }
  function releaseBed(room, n) { activeRoom = room; activeBed = n; askDelete('bed', `${room}-${n + 1}`, `Release ${room}, bed ${n + 1}`); }
  function openOutcome(id) { const item = data.followups.find(f => f.id === id); if (!canManage('outcome', item)) return; activeFollowup = id; openModal('outcome'); form = { ...form, contactResult: 'Reached', nextAction: '', nextDue: iso(7), nextOwner: role === 'Therapist' ? staff.assignment : item.owner }; }
  function toggleArchive(patient) { if (!canManage('patient')) return; patient.status = patient.status === 'Archived' ? 'Active' : 'Archived'; if (patient.status === 'Archived') { data.rooms.forEach(r => { r.beds = r.beds.map(b => b === patient.id ? null : b); }); patient.room = '—'; } logAction('Patients', `${patient.id} ${patient.status.toLowerCase()}`); persist(); notice(`${patient.id} ${patient.status.toLowerCase()}.`); }
  function reopenFollowup(item) { if (!canManage('followup')) return; item.status = 'Upcoming'; item.outcome = ''; logAction('Aftercare', `${item.id} reopened`); persist(); notice('Follow-up reopened.'); }
  async function resetDemo() { if (!canManage('reset')) return; await clearAttachments().catch(() => {}); data = ensureWalletData(ensureFinanceData(ensureClinicalData(resetData()))); data.analytics = seedAnalytics(); data.analyticsAsOf = iso(0); selectedPatient = 'P-1042'; notice('Demo data restored.'); }

</script>

<svelte:head><title>{navLabel(page, navigation.find(n => n[0] === page)?.[1])} · {roleConfig[role].title} · Cedar Lebanon</title></svelte:head>
<a class="skip-link" href="#main-content">Skip to workspace</a>
<div class="app-shell" data-role={role.toLowerCase()}>
  <button type="button" class:open={mobileOpen} class="mobile-scrim" aria-label="Close navigation" on:click={() => mobileOpen = false}></button>
  <RoleSidebar {role} {staff} {data} {page} open={mobileOpen} onNavigate={go} onClose={() => mobileOpen = false}/>
  <div class="main">
    <header class="topbar">
      <div class="topbar-left"><button class="mobile-menu" aria-label="Open menu" aria-expanded={mobileOpen} on:click={() => mobileOpen = true}><Icon name="menu"/></button><span class="breadcrumb">Cedar Lebanon <span style="margin:0 7px;color:#b3c1b4">/</span> <b>{navLabel(page,navigation.find(n => n[0] === page)?.[1])}</b></span><span class="top-divider"></span><span class="topbar-date">{new Date().toLocaleDateString('en-LB',{weekday:'long',day:'numeric',month:'long',year:'numeric'})}</span></div>
      <WorkspaceSearch {role} {staff} patients={data.patients} onNavigate={go} onPatient={openPatientTab}/>
      <div class="topbar-right"><span class="demo-pill">Fictional demo</span>{#if canManage("reset")}<button class="top-icon" title="Restore demo data" aria-label="Restore demo data" on:click={resetDemo}><Icon name="refresh" size={15}/></button>{/if}<span class="role-switch-label">View as</span><select class="role-select" aria-label="View as staff role" bind:value={role} on:change={changeRole}>{#each roles as r}<option>{r}</option>{/each}</select><select class="staff-select" aria-label="View as person" bind:value={staffId} on:change={changeStaff}>{#each profilesForRole(role) as person}<option value={person.id}>{person.shortName}</option>{/each}</select><div class="avatar" title={staff.name}>{staff.initials}</div></div>
    </header>
    <main class="content" data-page={page} id="main-content" tabindex="-1">
      {#if page === 'overview'}
        {#if role === 'RSA'}
          <RSAWorkspace {page} {data} {staff} focusPatient={rsaFocusPatient} onNavigate={go} onOpenCheckin={openRsaCheckin} onSaveCheckin={recordSupportCheckin} onOpenPatient={openResidentWallet}/>
        {:else if role === 'Resident'}
          <WalletWorkspace {page} {data} {role} {staff} onCreateOrder={submitResidentOrder} onCancelOrder={cancelResidentOrder}/>
        {:else if role === 'Director'}
        <div class="page-intro"><div><div class="eyebrow">Center overview</div><h1 class="page-title">Your center, <span class="serif">at a glance.</span></h1><p class="page-desc">The people, places and priorities that need your attention.</p></div><div class="intro-actions"><button class="btn btn-outline" on:click={() => go('assist')}><Icon name="sparkle"/> Investigate data</button><button class="btn btn-primary" on:click={() => openModal('inquiry')}><Icon name="plus"/> New inquiry</button></div></div>
        <CenterPulse {occupied} {available} capacity={data.rooms.reduce((total,room)=>total+room.beds.length,0)} sessions={sessionsToday} inquiries={pendingInquiries} followups={dueToday} onNavigate={go}/>
        <div class="dashboard-grid"><section class="panel"><div class="panel-head"><div><h2 class="panel-title">Today's rhythm</h2><p class="panel-sub">Sessions and coordination, in order</p></div><button class="text-link" on:click={() => go('schedule')}>Full schedule →</button></div><div class="panel-body schedule-list">{#each data.sessions.filter(s => s.date === iso(0)).sort((a,b)=>a.time.localeCompare(b.time)).slice(0,5) as s}<div class="schedule-row"><span class="schedule-time">{s.time}</span><span class:blue={s.kind==='blue'} class:sand={s.kind==='sand'} class="schedule-line"></span><div><div class="schedule-name">{s.title}</div><div class="schedule-meta">{s.meta}</div></div><span class="schedule-owner">{s.owner}</span></div>{/each}</div></section><section class="panel"><div class="panel-head"><div><h2 class="panel-title">Attention queue</h2><p class="panel-sub">The next operational handoffs</p></div><button class="text-link" on:click={() => go('assist')}>Explain priorities →</button></div><div class="panel-body priority-list"><button class="priority-item" style="text-align:left;border:1px solid #edf1e9" on:click={() => go('admissions')}><span class="priority-number">01</span><span class="priority-text"><strong>{data.inquiries.filter(i => !i.documents && i.stage === 'Intake review').length} intake files need review</strong><span>Admissions · before arrival</span></span><span class="priority-chevron"><Icon name="chevron"/></span></button><button class="priority-item" style="text-align:left;border:1px solid #edf1e9" on:click={() => go('aftercare')}><span class="priority-number">02</span><span class="priority-text"><strong>{dueToday} follow-up contacts due</strong><span>Aftercare · assigned to coordinators</span></span><span class="priority-chevron"><Icon name="chevron"/></span></button><button class="priority-item" style="text-align:left;border:1px solid #edf1e9" on:click={() => go('billing')}><span class="priority-number">03</span><span class="priority-text"><strong>{data.invoices.filter(i => !['Paid','Void'].includes(i.status)).length} invoices have open balances</strong><span>Finance · restricted demo view</span></span><span class="priority-chevron"><Icon name="chevron"/></span></button></div></section></div>
        <div class="section-spacer"></div><section class="insight-card"><span class="insight-icon"><Icon name="sparkle"/></span><div><h3>Follow the evidence behind the numbers.</h3><p>Cedar Intelligence compares admission trends and lets you inspect every fictional record in the calculation.</p></div><button class="btn btn-primary" on:click={() => { go('assist'); }}>Investigate admissions <Icon name="arrow"/></button></section><div class="section-spacer"></div><section class="panel activity-panel"><div class="panel-head"><div><h2 class="panel-title">Recent workspace changes</h2><p class="panel-sub">Local demo action history</p></div><span class="badge gray">{(data.activity || []).length} changes</span></div>{#if (data.activity || []).length}<div class="activity-list">{#each (data.activity || []).slice(0,5) as entry}<div class="activity-row"><span class="activity-dot"></span><div><strong>{entry.action}</strong><small>{entry.section} · {new Date(entry.at).toLocaleString('en-LB',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'})}</small></div></div>{/each}</div>{:else}<div class="activity-empty">Changes you make in the demo will appear here.</div>{/if}</section>

        {:else}<RoleOverview {role} {data} {staff} onNavigate={go} onCreate={openModal} onCare={(patient) => { selectedPatient = patient.id; go('patients'); }} onPayment={openPayment} onOutcome={openOutcome}/>{/if}
      {:else if ['caseload','checkins'].includes(page)}
        <RSAWorkspace {page} {data} {staff} focusPatient={rsaFocusPatient} onNavigate={go} onOpenCheckin={openRsaCheckin} onSaveCheckin={recordSupportCheckin} onOpenPatient={openResidentWallet}/>
      {:else if ['wallets','wallet','orders'].includes(page)}
        <WalletWorkspace {page} {data} {role} {staff} focusPatient={walletFocusPatient} onDeposit={recordWalletDeposit} onPurchase={recordWalletPurchase} onCreateOrder={submitResidentOrder} onCancelOrder={cancelResidentOrder} onFulfillOrder={fulfillResidentOrder} onDeclineOrder={declineResidentOrder} onOpenPatient={(id) => openPatientTab(id, 'Overview')}/>
      {:else if ['careplans','clinicalreports','handoffs','arrivals'].includes(page)}
        <RoleTasks {page} {data} {role} {staff} onPatient={openPatientTab} onInquiry={(id) => { activeInquiry = id; go('admissions'); }} onNavigate={go}/>
      {:else if page === 'admissions'}
        <div class="page-intro"><div><div class="eyebrow">01 / Admissions</div><h1 class="page-title">Admissions <span class="serif">pipeline.</span></h1><p class="page-desc">A shared path from first contact to a staff-approved arrival.</p></div><div class="intro-actions"><button class="btn btn-primary" on:click={() => openModal('inquiry')}><Icon name="plus"/> Add inquiry</button></div></div>
        <div class="kpi-grid"><div class="kpi"><div class="kpi-top"><span class="kpi-label">In progress</span><span class="kpi-icon"><Icon name="inbox"/></span></div><div class="kpi-number">{data.inquiries.length}</div><div class="kpi-foot">Across four stages</div></div><div class="kpi"><div class="kpi-top"><span class="kpi-label">Needs documents</span><span class="kpi-icon"><Icon name="document"/></span></div><div class="kpi-number">{data.inquiries.filter(i=>!i.documents&&i.stage!=='New inquiry').length}</div><div class="kpi-foot">Review before arrival</div></div><div class="kpi"><div class="kpi-top"><span class="kpi-label">Decision review</span><span class="kpi-icon"><Icon name="shield"/></span></div><div class="kpi-number">{data.inquiries.filter(i=>i.stage==='Awaiting decision').length}</div><div class="kpi-foot">Authorized team only</div></div><div class="kpi"><div class="kpi-top"><span class="kpi-label">Arrivals planned</span><span class="kpi-icon"><Icon name="calendar"/></span></div><div class="kpi-number">{data.inquiries.filter(i=>i.stage==='Arrival planned').length}</div><div class="kpi-foot">Placement pending confirmation</div></div></div>
        <div class="data-card"><div class="toolbar"><span class="toolbar-title">Admissions pipeline</span><span class="badge gray">Four-stage intake</span></div><Registry items={data.inquiries} label="Inquiries" searchKeys={['id','name','subject','next','owner','source']} fields={[{key:'stage',label:'Stage'},{key:'program',label:'Program'},{key:'owner',label:'Coordinator'},{key:'source',label:'Referral source'},{id:'documents',key:item=>item.documents?'Complete':'Missing documents',label:'Documents'}]} dateKey="date" dateLabel="Planned contact" sorts={[{key:'date',label:'Next contact first'},{key:'date',desc:true,label:'Latest contact first'},{key:'subject',label:'Name A–Z'}]} hint="Summary figures show the full pipeline. Filters apply across all four stages." let:rows>{#if stages.filter(stage=>rows.some(item=>item.stage===stage)).length > 1}<p class="pipeline-scroll-note">Scroll across to see each stage →</p>{/if}<div class="pipeline" use:scrollRegion role="region" aria-label="Admissions stages — scroll horizontally to see all stages" style:--pipeline-columns={stages.filter(stage=>rows.some(item=>item.stage===stage)).length}>{#each stages.filter(stage=>rows.some(item=>item.stage===stage)) as stage}<div class="pipeline-column" data-stage={stage}><div class="pipeline-head">{stage}<span class="pipeline-count">{rows.filter(i=>i.stage===stage).length}</span></div>{#each rows.filter(i=>i.stage===stage) as item}<div class="inquiry-card"><span class="card-id">{item.id} · {item.source}</span><h4>{item.name}</h4><span class="inquiry-person">{item.subject} · {item.program}</span><span class="inquiry-contact">{item.preferredContact === 'Phone' && item.contactPhone ? `Phone · ${item.contactPhone}` : item.preferredContact === 'Email' && item.contactEmail ? `Email · ${item.contactEmail}` : item.preferredContact || ''}</span><p>{item.next}</p><div class="inquiry-foot"><span class="inquiry-date">Coordinator: {item.owner} · Desk: {item.deskOwner} · {prettyDate(item.date)}</span><div class="record-actions"><button class="text-link" on:click={() => activeInquiry = item.id}>Open file</button>{#if role !== "Reception" || ["New inquiry","Intake review"].includes(stage)}<button class="text-link" on:click={() => openEdit("inquiry", item)}>Edit</button>{/if}{#if canRemove("inquiry", item)}<button class="text-link danger-link" on:click={() => askDelete("inquiry", item.id, item.id)}>Remove</button>{/if}{#if stage !== "Arrival planned" && (role !== "Reception" || stage === "New inquiry")}<button class="text-link" title="Move to next stage" on:click={() => advanceInquiry(item.id)}>Next →</button>{:else if stage === "Arrival planned"}<span class="badge green">Planned</span>{/if}</div></div></div>{/each}</div>{/each}</div></Registry></div><div class="section-spacer"></div><div class="subtle-note">An inquiry is not a clinical admission. Acceptance, suitability and room placement stay with authorized staff.</div>
      {:else if page === 'patients'}
        <div class="page-intro"><div><div class="eyebrow">02 / Patient workspace</div><h1 class="page-title">Patient <span class="serif">records.</span></h1><p class="page-desc">Care plans, notes, team comments, sessions, documents and source-linked case reviews.</p></div><div class="intro-actions"><span class="badge green">{roleConfig[role].title}</span>{#if canManage("patient")}<button class="btn btn-primary" on:click={() => openModal("patient")}><Icon name="plus"/> Add patient</button>{/if}</div></div>
        <div class="patient-layout"><section class="data-card patient-directory" class:directory-open={patientDirectoryOpen}><button class="patient-directory-toggle" aria-expanded={patientDirectoryOpen} on:click={() => patientDirectoryOpen = !patientDirectoryOpen}><span class="patient-avatar">{selected?.name.split(/\s+/).map(part=>part[0]).slice(0,2).join('')}</span><span><small>PATIENT DIRECTORY</small><strong>{selected?.name || 'Choose a patient'}</strong></span><span class="patient-switch-label">{patientDirectoryOpen ? 'Close list' : 'Switch patient'}</span><Icon name="chevron" size={16}/></button><div class="toolbar"><span class="toolbar-title">{role === "Therapist" ? "My patients" : "Patient directory"}</span></div><Registry items={rolePatients} label="Patients" compact scope={role+staffId} searchKeys={['id','name','program','room','therapist','coordinator']} fields={[{key:'program',label:'Program'},{key:'status',label:'Status'},{key:'therapist',label:'Therapist'},{key:'coordinator',label:'Coordinator'}]} sorts={[{key:'name',label:'Name A–Z'},{key:'admitted',desc:true,label:'Recently admitted'},{key:'id',desc:true,label:'Patient reference'}]} hint="Filtering the directory keeps the open patient record visible." let:rows><div class="patient-list">{#each rows as patient}<button class:selected={selectedPatient===patient.id} class="patient-item" aria-pressed={selectedPatient===patient.id} on:click={() => { selectedPatient=patient.id; patientDirectoryOpen=false; }}><span class="patient-avatar">{patient.name.split(/\s+/).map(part=>part[0]).slice(0,2).join('')}</span><span><strong>{patient.name}</strong><small>{patient.id} · {patient.program}{patient.status === 'Archived' ? ' · Archived' : ''}</small></span><span class="patient-arrow"><Icon name="chevron" size={14}/></span></button>{:else}<div class="empty-state">No matching demo patients.</div>{/each}</div></Registry></section>{#if selected}<div class="patient-detail-shell"><div class="detail-manage"><button class="btn btn-soft btn-tiny" on:click={() => reviewRequest += 1}><Icon name="sparkle" size={14}/> AI case review</button>{#if canManage("patient")}<button class="btn btn-soft btn-tiny" on:click={() => openEdit("patient", selected)}>Edit profile</button><button class="btn btn-soft btn-tiny" on:click={() => toggleArchive(selected)}>{selected.status === "Archived" ? "Restore record" : "Archive record"}</button>{:else if canManage("care", selected)}<button class="btn btn-soft btn-tiny" on:click={() => openEdit("care", selected)}>Update current task</button>{/if}</div><PatientRecord patient={selected} record={data.clinical[selected.id]} {role} {staff} {reviewRequest} {patientTabRequest} sessions={data.sessions} followups={data.followups} onSchedule={() => go('schedule')} onPersist={(patientId, action) => { logAction('Patients', `${patientId} ${action}`); persist(); }} onNotice={notice}/></div>{:else}<section class="data-card"><div class="empty-state">No patients in the directory.</div></section>{/if}</div>
      {:else if page === 'schedule'}
        <div class="page-intro"><div><div class="eyebrow">03 / {role === "Therapist" ? "My day" : role === "Reception" ? "Desk scheduling" : "Scheduling"}</div><h1 class="page-title">Appointments <span class="serif">& {canPerform(role, 'attendance') ? 'attendance.' : 'coordination.'}</span></h1><p class="page-desc">{canPerform(role, 'attendance') ? "After each session: tap Here / Missed / Excused, write one close line. End of week: finish the weekly report." : role === "Reception" ? "Plan intake and coordination appointments for the front desk." : "Plan sessions across people, spaces and the working day."}</p></div><div class="intro-actions"><button class="btn btn-primary" on:click={() => openModal('session')}><Icon name="plus"/> Create session</button></div></div>
        <div class="easy-day-bar"><div class="easy-day-chips">{#each [0,1,2] as offset}<button class:active={selectedDate===iso(offset)} class="easy-day-chip" on:click={() => selectedDate=iso(offset)}>{offset===0?'Today':offset===1?'Tomorrow':prettyDate(iso(offset),{weekday:'short',day:'numeric'})}</button>{/each}</div><label class="date-picker-label easy-day-jump">Other day <input type="date" bind:value={selectedDate}/></label></div>
        {#if canPerform(role, 'attendance')}
        <section class="easy-attendance" class:incomplete={attendanceOpen > 0} class:complete={attendanceQueue.length > 0 && attendanceOpen === 0} aria-label="Mark attendance">
          <div class="easy-attendance-head"><div><span class="easy-kicker">RECORDING RITUAL</span><h2>{prettyDate(selectedDate,{weekday:'long',day:'numeric',month:'long'})}</h2><p>{attendanceOpen > 0 ? `${attendanceOpen} still need a mark or close note.` : attendanceQueue.length ? 'All sessions for this day are recorded.' : 'No sessions assigned to you on this day.'}</p></div><div class="easy-progress" aria-live="polite"><strong>{attendanceDone}/{attendanceQueue.length || 0}</strong><span>recorded</span></div></div>
          {#if attendanceOpen > 0}<div class="easy-must" role="status">After every session: mark it, then write one close line. Unfinished stay on top.</div>{:else if attendanceQueue.length > 0}<div class="easy-all-clear" role="status">Day clear — every session is marked and closed.</div>{/if}
          <Registry items={attendanceQueue} label="Session recording" compact scope={role+staffId+selectedDate} searchKeys={['title','patientRef','meta','owner']} fields={[{key:'owner',label:'Staff'},{id:'recording',key:item=>isSessionComplete(item)?'Closed':attendanceFor(item)?'Needs close note':'Not recorded',label:'Recording status'},{id:'attendance',key:item=>attendanceFor(item)?.status || 'Unmarked',label:'Attendance'}]} sorts={[{key:item=>isSessionComplete(item)?1:0,label:'Unfinished first'},{key:'time',label:'Session time'}]} hint="Daily progress above counts all assigned sessions, including those hidden by filters." let:rows><div class="easy-attendance-list">
            {#each rows as session}
              {@const patientId = sessionPatientId(session)}
              {@const marked = attendanceFor(session)}
              {@const patient = data.patients.find(p => p.id === patientId)}
              <article class="easy-att-row" class:needs={!isSessionComplete(session)} class:done={isSessionComplete(session)} class:missed={marked?.status==='Missed'} class:excused={marked?.status==='Excused'} class:here={marked?.status==='Attended'}>
                <div class="easy-att-main">
                  <span class="easy-att-time">{session.time}</span>
                  <div>
                    <strong>{session.title}</strong>
                    <small>{#if patient}{patient.name} · {patientId}{:else if patientId}{patientId}{:else}Group / desk session{/if} · {session.owner}</small>
                  </div>
                  {#if isSessionComplete(session)}<span class="easy-att-badge">Closed</span>{:else if marked}<span class="easy-att-badge needs">Needs close note</span>{:else}<span class="easy-att-badge needs">Not recorded</span>{/if}
                </div>
                <div class="easy-att-actions">
                  {#if canManage('attendance', session)}
                    <button type="button" class="att-btn here" class:active={marked?.status==='Attended'} on:click={() => markAttendance(session, 'Attended')}>Here</button>
                    <button type="button" class="att-btn missed" class:active={marked?.status==='Missed'} on:click={() => markAttendance(session, 'Missed')}>Missed</button>
                    <button type="button" class="att-btn excused" class:active={marked?.status==='Excused'} on:click={() => markAttendance(session, 'Excused')}>Excused</button>
                    {#if marked && !isSessionComplete(session)}<button type="button" class="att-note strong" on:click={() => { closeError=''; sessionClose = { sessionId: session.id, patientId, status: marked.status, note: marked.note && marked.note !== 'Attendance recorded' ? marked.note : '', title: session.title, time: session.time }; }}>Finish</button>{:else if patientId}<button type="button" class="att-note" on:click={() => openAttendance(session)}>Note</button>{:else}<button type="button" class="att-note" on:click={() => openEdit('session', session)}>Link patient</button>{/if}
                  {:else}
                    <span class="easy-att-locked">Assigned to {session.owner}</span>
                  {/if}
                </div>
              </article>
            {:else}
              <div class="easy-att-empty">No sessions for you on this day.</div>
            {/each}
          </div></Registry>
        </section>
        {#if weeklyDue.length}
        <section class="weekly-due" aria-label="Weekly reports due">
          <div class="weekly-due-head"><div><span class="easy-kicker">WEEKLY REPORT</span><h2>Close the week</h2><p>Patients with sessions this week still need a weekly progress draft.</p></div><span class="easy-count">{weeklyDue.length} due</span></div>
          <div class="weekly-due-list">
            {#each weeklyDue as item}
              <article class="weekly-due-row">
                <div><strong>{item.name}</strong><small>{item.patientId} · {item.sessions} session{item.sessions === 1 ? '' : 's'} · {prettyDate(item.start, {day:'numeric',month:'short'})}–{prettyDate(item.end, {day:'numeric',month:'short'})}</small></div>
                <button type="button" class="btn btn-primary btn-tiny" on:click={() => draftWeeklyReport(item)}>Draft weekly report</button>
              </article>
            {/each}
          </div>
        </section>
        {/if}
        {/if}
        <Registry items={selectedSessions} label="Day appointments" scope={role+staffId+selectedDate} searchKeys={['title','patientRef','meta','owner']} fields={[{key:'owner',label:'Staff'},{key:'deskOwner',label:'Desk owner'}]} sorts={[{key:'time',label:'Time: earliest first'},{key:'time',desc:true,label:'Time: latest first'},{key:'title',label:'Title A–Z'}]} let:rows><div class="data-card"><div class="toolbar"><span class="toolbar-title">Day board</span><span class="badge green">{rows.length} sessions</span></div><div class="calendar-heading"><span>TIME</span><span>CARE TEAM</span><span>THERAPY</span><span>COORDINATION</span></div><div class="calendar-board">{#each [...new Set(['09:00','10:00','11:00','12:00','13:00','14:00','15:00','16:00',...rows.map(item=>item.time.slice(0,2)+':00')])].sort() as hour}<div class="calendar-row"><div class="calendar-time">{hour}</div>{#each ['Care team','Therapist','Coordinator'] as group}<div class="calendar-cell">{#each rows.filter(s=>s.time.slice(0,2)===hour.slice(0,2)&&((group==='Care team'&&s.owner==='Care team')||(group==='Therapist'&&s.owner.includes('Therapist'))||(group==='Coordinator'&&!s.owner.includes('Therapist')&&s.owner!=='Care team'))) as session}<button class:blue={session.kind==='blue'} class:sand={session.kind==='sand'} class="calendar-event" title="Edit {session.title}" on:click={() => openEdit('session', session)}><strong>{session.title}</strong><span>{session.meta}</span>{#if attendanceFor(session)}<em class="cal-att-tag">{attendanceFor(session).status}</em>{/if}</button>{/each}</div>{/each}</div>{/each}</div><div class="schedule-manage"><div class="schedule-manage-head"><strong>Edit sessions · {rows.length}</strong><span>Open a row only when you need to change the booking</span></div>{#each rows as session}<div class="session-work-row"><button class="schedule-manage-row" on:click={() => openEdit("session", session)}><span class="schedule-manage-time">{session.time}</span><span><strong>{session.title}</strong><small>{session.owner} · {sessionPatientId(session) ? `${sessionPatientId(session)} · ` : ''}{session.meta}{session.deskOwner ? ` · Desk: ${session.deskOwner}` : ''}</small></span><Icon name="chevron" size={14}/></button></div>{:else}<div class="activity-empty">No sessions on this date.</div>{/each}</div></div></Registry>
      {:else if page === 'rooms'}
        <div class="page-intro"><div><div class="eyebrow">04 / Residential operations</div><h1 class="page-title">Rooms <span class="serif">& bed allocation.</span></h1><p class="page-desc">{role === "Reception" ? "Check room readiness and capacity before welcoming an arrival." : "Manage beds, occupancy and room preparation."}</p></div><div class="intro-actions"><button class="btn btn-outline" on:click={() => go('admissions')}>View planned arrivals <Icon name="arrow"/></button>{#if canManage('room')}<button class="btn btn-primary" on:click={() => openModal('room')}><Icon name="plus"/> Add room</button>{/if}</div></div>
        <div class="kpi-grid"><div class="kpi"><div class="kpi-top"><span class="kpi-label">Total capacity</span><span class="kpi-icon"><Icon name="bed"/></span></div><div class="kpi-number">{totalBeds}</div><div class="kpi-foot">Across {data.rooms.length} rooms</div></div><div class="kpi"><div class="kpi-top"><span class="kpi-label">Occupied</span><span class="kpi-icon"><Icon name="users"/></span></div><div class="kpi-number">{occupied}</div><div class="kpi-foot">Current demo census</div></div><div class="kpi"><div class="kpi-top"><span class="kpi-label">Available</span><span class="kpi-icon"><Icon name="check"/></span></div><div class="kpi-number">{available}</div><div class="kpi-foot">{notReady ? `${notReady} unoccupied ${notReady === 1 ? 'bed' : 'beds'} not ready` : 'All open beds ready'}</div></div><div class="kpi"><div class="kpi-top"><span class="kpi-label">Planned arrivals</span><span class="kpi-icon"><Icon name="calendar"/></span></div><div class="kpi-number">{data.inquiries.filter(i=>i.stage==='Arrival planned').length}</div><div class="kpi-foot">Review readiness first</div></div></div>
        <div class="two-col room-layout"><div class="data-card"><div class="toolbar"><span class="toolbar-title">Room board</span><span class="badge green">{data.rooms.length} rooms · Wings A & B</span></div><Registry items={data.rooms} label="Rooms" searchKeys={role==='Reception'?['id','status','access','notes']:['id','status','access','notes',item=>item.beds.filter(Boolean).join(' ')]} fields={[{id:'wing',key:item=>item.id[0],label:'Wing'},{key:'status',label:'Readiness'},{id:'capacity',key:item=>item.beds.every(Boolean)?'Full':item.beds.some(Boolean)?'Partly occupied':'Empty',label:'Occupancy'},{id:'type',key:item=>roomLabel(item),label:'Room type'},{id:'access',key:item=>item.access || 'Standard',label:'Access'},{id:'available',key:item=>item.status==='Ready' && item.beds.some(bed=>!bed)?'Ready bed available':'No ready bed',label:'Availability'}]} sorts={[{key:'id',label:'Room number'},{key:item=>item.beds.filter(bed=>!bed).length,desc:true,label:'Most free beds'}]} hint="Center-wide capacity totals remain visible above." let:rows><div class="rooms-floorboard">
  {#each ['A','B'] as wing}
    {#if rows.some(room => room.id[0] === wing)}
      <section class="wing-zone" aria-label={'Wing ' + wing}>
        <div class="wing-zone-head"><div><span>RESIDENTIAL / {wing === 'A' ? '01' : '02'}</span><h3>Wing {wing}</h3></div><p>{rows.filter(room => room.id[0] === wing).length} rooms · {rows.filter(room => room.id[0] === wing).reduce((total, room) => total + room.beds.length, 0)} beds shown</p></div>
        <div class="wing-rows">
          {#each rows.filter(room => room.id[0] === wing) as room}
            <article class="room" data-readiness={room.status}>
              <div class="room-identity"><span>{roomLabel(room)} <i>·</i> {room.beds.filter(Boolean).length}/{room.beds.length} occupied</span><strong>{room.id}</strong><small>{room.access || 'Standard'} access</small>{#if room.notes}<p class="room-note">{room.notes}</p>{/if}</div>
              <div class="room-beds">{#each room.beds as bed, n}<div class:occupied={!!bed} class="bed"><span>Bed {n+1}</span>{#if bed}<strong>{role === 'Reception' ? 'Occupied' : bed}</strong>{#if canRemove('bed')}<button class="bed-release" title="Release bed" on:click={() => releaseBed(room.id,n)}>Release</button>{/if}{:else}{#if canManage('bed')}<button disabled={room.status !== 'Ready'} on:click={() => openBed(room.id,n)}>{room.status === 'Ready' ? 'Assign +' : 'Not ready'}</button>{:else}<span class="bed-readonly">{room.status === 'Ready' ? 'Open' : 'Not ready'}</span>{/if}{/if}</div>{/each}</div>
              <div class="room-operations"><div class="room-status-row"><label for={'room-status-' + room.id}>Readiness</label><select id={'room-status-' + room.id} class="room-status" aria-label="Readiness for room {room.id}" disabled={!canManage('roomStatus')} value={room.status} on:change={(event) => { setRoomStatus(room, event.currentTarget.value); event.currentTarget.value = room.status; }}><option>Ready</option><option>Preparing</option><option>Maintenance</option></select></div>{#if canManage('room')}<button class="room-edit" type="button" aria-label="Edit room {room.id}" on:click={() => openEdit('room', room)}>Edit room <Icon name="arrow" size={13}/></button>{/if}</div>
            </article>
          {/each}
        </div>
      </section>
    {/if}
  {/each}
</div></Registry></div><div class="side-stack"><section class="panel"><div class="panel-head"><div><h2 class="panel-title">Before an arrival</h2><p class="panel-sub">Operational readiness checklist</p></div></div><div class="panel-body"><div class="mini-stat-row"><span>Documents and consent</span><strong>Verify</strong></div><div class="mini-stat-row"><span>Room preparation</span><strong>Confirm</strong></div><div class="mini-stat-row"><span>Coordinator handoff</span><strong>Assign</strong></div><div class="mini-stat-row"><span>Placement approval</span><strong>Staff decision</strong></div></div></section><div class="subtle-note">The demo lets you assign a bed for exploration. Production placement requires suitable access checks and an authorized staff decision.</div></div></div>
      {:else if page === 'billing'}
        <div class="page-intro"><div><div class="eyebrow">05 / Billing & funding</div><h1 class="page-title">Invoices <span class="serif">& funding.</span></h1><p class="page-desc">Follow invoices and funding without exposing clinical notes.</p></div><div class="intro-actions"><button class="btn btn-primary" on:click={() => openModal('invoice')}><Icon name="plus"/> Create invoice</button></div></div>
        <div class="kpi-grid"><div class="kpi"><div class="kpi-top"><span class="kpi-label">Tracked invoice total</span><span class="kpi-icon"><Icon name="wallet"/></span></div><div class="kpi-number">${billed.toLocaleString()}</div><div class="kpi-foot">Across tracked demo invoices</div></div><div class="kpi"><div class="kpi-top"><span class="kpi-label">Collected</span><span class="kpi-icon"><Icon name="check"/></span></div><div class="kpi-number">${collected.toLocaleString()}</div><div class="kpi-foot">Recorded payments in demo</div></div><div class="kpi"><div class="kpi-top"><span class="kpi-label">Open balance</span><span class="kpi-icon"><Icon name="chart"/></span></div><div class="kpi-number">${(outstanding/1000).toFixed(1)}k</div><div class="kpi-foot">Across current demo invoices</div></div><div class="kpi"><div class="kpi-top"><span class="kpi-label">Past due</span><span class="kpi-icon"><Icon name="clock"/></span></div><div class="kpi-number">{data.invoices.filter(i=>!['Paid','Void'].includes(i.status)&&i.due<iso(0)).length}</div><div class="kpi-foot">Invoices to review</div></div></div>
        <div class="data-card"><div class="toolbar"><span class="toolbar-title">Invoice ledger</span></div><Registry items={data.invoices} label="Invoices" pageSize={25} searchKeys={['id','patient','payer','owner','description']} fields={[{key:'status',label:'Status'},{key:'payer',label:'Payer'},{key:'owner',label:'Owner'},{id:'due',key:item=>['Paid','Void'].includes(item.status)?'Closed':item.due<iso(0)?'Overdue':'Not overdue',label:'Due status'}]} dateKey="due" dateLabel="Due date" sorts={[{key:'due',label:'Due soonest'},{key:'issued',desc:true,label:'Recently issued'},{key:item=>item.status==='Void'?0:Math.max(0,item.amount-Number(item.paid||0)),desc:true,label:'Largest balance'},{key:'amount',desc:true,label:'Largest total'}]} columns={[{key:'id',label:'Invoice'},{key:'patient',label:'Patient'},{key:'payer',label:'Payer'},{key:'owner',label:'Owner'},{key:'due',label:'Due date'},{key:'amount',label:'Total'},{key:'paid',label:'Paid'},{key:item=>item.status==='Void'?0:Math.max(0,item.amount-Number(item.paid||0)),label:'Balance'},{key:'status',label:'Status'}]} hint="Summary figures cover the entire ledger. Export view downloads only the matching invoices." let:rows><div class="table-wrap" use:scrollRegion role="region" aria-label="Data table — scroll horizontally to see all columns"><table class="data-table"><thead><tr><th>Invoice</th><th>Patient</th><th>Payer</th><th>Owner</th><th>Due date</th><th>Total</th><th>Paid</th><th>Balance</th><th>Status</th><th>Action</th></tr></thead><tbody>{#each rows as invoice}<tr><td><span class="table-id">{invoice.id}</span></td><td><strong>{invoice.patient}</strong></td><td>{invoice.payer}</td><td>{invoice.owner}</td><td>{prettyDate(invoice.due,{day:'numeric',month:'short',year:'numeric'})}</td><td>${invoice.amount.toLocaleString()}</td><td>${(Number(invoice.paid) || 0).toLocaleString()}</td><td><strong>${(invoice.status === 'Void' ? 0 : Math.max(0, invoice.amount - (Number(invoice.paid) || 0))).toLocaleString()}</strong></td><td><span class:green={invoice.status==='Paid'} class:amber={invoice.status==='Upcoming'||invoice.status==='Part-paid'} class:red={invoice.status==='Overdue'} class="badge">{invoice.status}</span></td><td><div class="table-actions"><button class="text-link" on:click={() => activeInvoice = invoice.id}>View</button>{#if invoice.status!=='Void'}<button class="text-link" on:click={() => openEdit('invoice', invoice)}>Edit</button>{/if}{#if invoice.status!=='Paid' && invoice.status!=='Void'}<button class="text-link" on:click={() => openPayment(invoice)}>Payment</button>{/if}{#if canRemove('invoice', invoice)}<button class="text-link danger-link" on:click={() => askDelete('invoice', invoice.id, invoice.id)}>Void</button>{/if}</div></td></tr>{:else}<tr><td colspan="10" class="table-empty">No matching invoices.</td></tr>{/each}</tbody></table></div></Registry></div><div class="section-spacer"></div><div class="subtle-note">This is a fictional finance preview. Real payment processing and audit trails need a secure production backend.</div>
      {:else if ['payments','expenses','ledger','reconciliation','payers'].includes(page)}
        <FinanceWorkspace {page} {data} {role} {staff} onNavigate={go} onPayment={openPayment} onPersist={(action) => { logAction('Finance', action); persist(); }} onNotice={notice}/>
      {:else if page === 'aftercare'}
        <div class="page-intro"><div><div class="eyebrow">06 / Aftercare</div><h1 class="page-title">Aftercare <span class="serif">follow-ups.</span></h1><p class="page-desc">{role === "Therapist" ? "Record outcomes for the contacts assigned to you." : "Give every follow-up an owner, an outcome and a next action."}</p></div><div class="intro-actions">{#if canManage("followup")}<button class="btn btn-primary" on:click={() => openModal("followup")}><Icon name="plus"/> Assign follow-up</button>{/if}</div></div>
        <div class="two-col"><section class="data-card"><div class="toolbar"><span class="toolbar-title">Follow-up worklist</span></div><Registry items={visibleFollowups(role,data.followups,staff)} label="Follow-ups" scope={role+staffId} searchKeys={['patient','action','owner','outcome']} fields={[{key:'status',label:'Status'},{key:'owner',label:'Owner'},{key:'contactMethod',label:'Contact method'},{id:'due',key:item=>item.status==='Completed'?'Completed':item.due<iso(0)?'Overdue':item.due===iso(0)?'Due today':'Upcoming',label:'Due status'}]} dateKey="due" dateLabel="Due date" sorts={[{key:'due',label:'Due soonest'},{key:'due',desc:true,label:'Latest due date'},{key:'patient',label:'Patient reference'}]} let:rows><div class="aftercare-list">{#each rows as item}<div class="followup-row"><span class="followup-date">{new Date(`${item.due}T12:00:00`).getDate()}</span><span class="followup-main"><strong>{item.patient} · {item.action}</strong><span>{item.owner} · {prettyDate(item.due)} at {item.time} · {item.consent}{#if item.contactMethod === 'Phone' && item.contactPhone} · {item.contactPhone}{:else if item.contactMethod === 'Email' && item.contactEmail} · {item.contactEmail}{/if}</span>{#if item.outcome}<em>Outcome: {item.outcome}</em>{/if}</span><div class="followup-actions">{#if item.status==='Completed'}<span class="badge green">Completed</span>{#if canManage("followup")}<button class="text-link" on:click={() => reopenFollowup(item)}>Reopen</button>{/if}{:else}<button class="btn btn-soft btn-tiny" on:click={() => openOutcome(item.id)}>Record outcome</button>{/if}{#if canManage("followup")}<button class="text-link" on:click={() => openEdit("followup", item)}>Edit</button>{/if}{#if canRemove("followup", item)}<button class="text-link danger-link" on:click={() => askDelete("followup", item.id, item.id)}>Remove</button>{/if}</div></div>{:else}<div class="empty-state">No matching follow-ups.</div>{/each}</div></Registry></section><div class="side-stack"><section class="panel"><div class="panel-head"><div><h2 class="panel-title">Follow-through</h2><p class="panel-sub">Current team load</p></div></div><div class="panel-body"><div class="mini-stat-row"><span>Due today</span><strong>{dueToday}</strong></div><div class="mini-stat-row"><span>Upcoming</span><strong>{visibleFollowups(role,data.followups,staff).filter(f=>f.status!=="Completed"&&f.due>iso(0)).length}</strong></div><div class="mini-stat-row"><span>Completed</span><strong>{visibleFollowups(role,data.followups,staff).filter(f=>f.status==="Completed").length}</strong></div></div></section><div class="subtle-note">Only use an agreed contact method. The software supports team continuity; it does not predict relapse or replace clinical judgment.</div></div></div>

      {:else if page === 'reports'}
        <Reports {data} {role} onNavigate={go}/>
      {:else if page === 'assist'}
        <CedarIntelligence analytics={data.analytics || []} workspace={data} onNavigate={go} onOpenPatient={openPatientTab} onOpenInquiry={(id) => { activeInquiry = id; go('admissions'); }}/>
      {/if}
      <p class="footer-note">CEDAR LEBANON · {role === 'Resident' ? 'RESIDENT VIEW' : 'STAFF WORKSPACE'} · FICTIONAL DEMO DATA</p>
    </main>
  </div>
</div>

{#if modal}<div class="modal-backdrop" role="presentation" on:click={(event) => { if (event.target===event.currentTarget) closeModal(); }}><form class="modal" use:dialogFocus={{onClose:closeModal}} class:modal-wide={['inquiry','patient','invoice','followup','room'].includes(modal)} on:submit|preventDefault={saveForm}><div class="modal-head"><div><div class="eyebrow">{editingId ? editingId : 'CEDAR WORKSPACE'}</div><h2>{modal==='confirm'?'Confirm change':modal==='payment'?'Record payment':modal==='outcome'?'Record follow-up outcome':modal==='bed'?'Assign a bed':modal==='room'?(editingId?'Edit room':'Add a room'):modal==='attendance'?'Record attendance':modal==='care'?'Update care task':editingId ? 'Edit '+modal : modal==='inquiry'?'Add an inquiry':modal==='patient'?'Add a patient':modal==='session'?'Create a session':modal==='followup'?'Assign a follow-up':'Create an invoice'}</h2></div><button type="button" class="icon-btn" aria-label="Close" on:click={closeModal}><Icon name="close"/></button></div><div class="modal-body">
  {#if modal==='inquiry'}<div class="form-grid"><div class="form-section full"><span class="form-section-label">Who reached out</span></div><div class="form-field full"><label for="inquiry-name">Inquiry label</label><input id="inquiry-name" required bind:value={form.name} placeholder="e.g. New phone referral"/></div><div class="form-field"><label for="inquiry-subject">Person reference</label><input id="inquiry-subject" required bind:value={form.subject} placeholder="Fictional alias"/></div><div class="form-field"><label for="inquiry-program">Program interest</label><select id="inquiry-program" bind:value={form.program}><option>Residential</option><option>Outpatient</option></select></div><div class="form-section full"><span class="form-section-label">How to reach them</span></div><div class="form-field"><label for="inquiry-contact">Preferred contact</label><select id="inquiry-contact" bind:value={contactGate} on:change={() => { form.preferredContact = contactGate; }}><option>Phone</option><option>Email</option><option>In person</option></select></div><div class="form-field"><label for="inquiry-location">Location</label><input id="inquiry-location" bind:value={form.location} placeholder="Beirut"/></div>{#if contactGate === 'Phone'}<div class="form-field full reveal-field"><label for="inquiry-phone">Phone number</label><input id="inquiry-phone" type="tel" required bind:value={form.contactPhone} placeholder="+961 71 000 000" autocomplete="tel"/></div>{:else if contactGate === 'Email'}<div class="form-field full reveal-field"><label for="inquiry-email">Email address</label><input id="inquiry-email" type="email" required bind:value={form.contactEmail} placeholder="name@example.com" autocomplete="email"/></div>{:else}<div class="form-field full reveal-field"><label for="inquiry-visit">Visit notes</label><input id="inquiry-visit" bind:value={form.contactNote} placeholder="Walk-in desk, preferred time"/></div>{/if}<div class="form-section full"><span class="form-section-label">Routing</span></div><div class="form-field"><label for="inquiry-source">Source</label><select id="inquiry-source" bind:value={form.source}><option>Website</option><option>Phone</option><option>Referral</option><option>Family</option></select></div><div class="form-field"><label for="inquiry-owner">Coordinator</label><select id="inquiry-owner" bind:value={form.owner}><option>Unassigned</option><option>Maya</option><option>Nour</option></select></div><div class="form-field"><label for="inquiry-desk-owner">Front desk owner</label><select id="inquiry-desk-owner" bind:value={form.deskOwner} disabled={role === 'Reception'}><option>Leila</option><option>Karim</option></select></div><div class="form-field"><label for="inquiry-therapist">Assigned therapist</label><select id="inquiry-therapist" bind:value={form.therapist}><option>Therapist A</option><option>Therapist B</option></select></div><div class="form-field"><label for="inquiry-stage">Stage</label><select id="inquiry-stage" bind:value={form.stage}>{#each (role === "Reception" ? stages.slice(0,2) : stages) as stage}<option>{stage}</option>{/each}</select></div><div class="form-field"><label for="inquiry-date">Next action date</label><input id="inquiry-date" type="date" bind:value={form.date}/></div><div class="form-field full"><label for="inquiry-next">Next action</label><input id="inquiry-next" bind:value={form.next} placeholder="e.g. Request consent and questionnaire"/></div><div class="form-field full"><label for="inquiry-handoff">Handoff note</label><textarea id="inquiry-handoff" rows="2" bind:value={form.handoff} placeholder="What the next person needs to know"></textarea></div>{#if role !== "Reception"}<label class="check-field full"><input type="checkbox" bind:checked={form.documents}/> Documents reviewed and on file</label>{/if}</div>
  {:else if modal==='patient'}<div class="form-grid"><div class="form-section full"><span class="form-section-label">Directory</span></div><div class="form-field full"><label for="patient-name">Directory label</label><input id="patient-name" required bind:value={form.name} placeholder="Fictional display name"/></div><div class="form-field"><label for="patient-program">Program</label><select id="patient-program" bind:value={form.program}><option>Residential</option><option>Outpatient</option></select></div><div class="form-field"><label for="patient-age">Age range</label><select id="patient-age" bind:value={form.ageBand}><option>18–24</option><option>25–34</option><option>35–44</option><option>45–54</option><option>55+</option><option>Not recorded</option></select></div><div class="form-field"><label for="patient-admitted">Admission date</label><input id="patient-admitted" type="date" bind:value={form.admitted}/></div><div class="form-field"><label for="patient-language">Preferred language</label><input id="patient-language" bind:value={form.language} placeholder="Arabic / English"/></div><div class="form-field"><label for="patient-referral">Referral source</label><input id="patient-referral" bind:value={form.referral} placeholder="Family referral"/></div><div class="form-field"><label for="patient-coordinator">Coordinator</label><input id="patient-coordinator" bind:value={form.coordinator} placeholder="Coordinator name"/></div><div class="form-field"><label for="patient-therapist">Assigned therapist</label><select id="patient-therapist" bind:value={form.therapist}><option>Therapist A</option><option>Therapist B</option></select></div><div class="form-field"><label for="patient-rsa">Assigned RSA</label><select id="patient-rsa" bind:value={form.rsa} disabled={form.program !== 'Residential'}><option>Unassigned</option><option>Salim</option><option>Dana</option></select></div><div class="form-section full"><span class="form-section-label">Contact</span></div><div class="form-field"><label for="patient-contact-method">Preferred contact</label><select id="patient-contact-method" bind:value={contactGate} on:change={() => { form.contactMethod = contactGate; }}><option>Phone</option><option>Email</option><option>In person</option><option>Confirm with coordinator</option></select></div><div class="form-field"><label for="patient-consent">Consent note</label><input id="patient-consent" bind:value={form.consent} placeholder="Patient only / family with confirmation"/></div>{#if contactGate === 'Phone'}<div class="form-field full reveal-field"><label for="patient-phone">Phone number</label><input id="patient-phone" type="tel" required bind:value={form.contactPhone} placeholder="+961 71 000 000"/></div>{:else if contactGate === 'Email'}<div class="form-field full reveal-field"><label for="patient-email">Email address</label><input id="patient-email" type="email" required bind:value={form.contactEmail} placeholder="name@example.com"/></div>{/if}<div class="form-section full"><span class="form-section-label">Care</span></div><div class="form-field full"><label for="patient-next">Next appointment</label><input id="patient-next" bind:value={form.next} placeholder="To schedule"/></div><div class="form-field full"><label for="patient-care">Current team task</label><input id="patient-care" bind:value={form.care} placeholder="Weekly plan review"/></div></div><p class="form-help">Assign residential placement from the room board after creating the directory record.</p>
  {:else if modal==='care'}<div class="form-grid"><div class="form-field full"><label for="care-task">Current team task</label><input id="care-task" required bind:value={form.care} placeholder="Next care task"/></div><div class="form-field full"><label for="care-next">Next appointment</label><input id="care-next" bind:value={form.next} placeholder="To schedule"/></div></div><p class="form-help">This view updates only your assigned patient’s care task and next appointment.</p>
  {:else if modal==='session'}<div class="form-grid"><div class="form-field full"><label for="session-title">Session title</label><input id="session-title" required bind:value={form.title} placeholder="e.g. Individual session"/></div><div class="form-field"><label for="session-date">Date</label><input id="session-date" type="date" required bind:value={form.date}/></div><div class="form-field"><label for="session-time">Time</label><input id="session-time" type="time" required bind:value={form.time}/></div><div class="form-field"><label for="session-owner">Owner</label><select id="session-owner" bind:value={form.owner}>{#if role === "Therapist"}<option>{staff.assignment}</option>{:else if role === "Reception"}<option>Coordinator</option><option>Care team</option>{:else}<option>Coordinator</option><option>Care team</option><option>Therapist A</option><option>Therapist B</option>{/if}</select></div>{#if role !== 'Therapist'}<div class="form-field"><label for="session-desk-owner">Desk owner</label><select id="session-desk-owner" bind:value={form.deskOwner} disabled={role === 'Reception'}><option>Leila</option><option>Karim</option></select></div>{/if}{#if role !== 'Reception'}<div class="form-field"><label for="session-patient">Linked patient</label><select id="session-patient" bind:value={form.patientRef}><option value="">No patient linked</option>{#each (role === 'Therapist' ? rolePatients : data.patients.filter(item => item.status !== 'Archived')) as patient}<option value={patient.id}>{patient.id} · {patient.name}</option>{/each}</select></div>{/if}<div class="form-field"><label for="session-kind">Color</label><select id="session-kind" bind:value={form.kind}><option value="green">Cedar</option><option value="blue">Blue</option><option value="sand">Sand</option></select></div><div class="form-field full"><label for="session-meta">Patient / room reference</label><input id="session-meta" bind:value={form.meta} placeholder="e.g. P-1042 · Room 1"/></div></div>
  {:else if modal==='attendance'}<div class="att-modal-quick"><p class="att-modal-lead"><strong>{form.patient}</strong> · {form.title}</p><div class="att-modal-picks">{#each ['Attended','Missed','Excused','Rescheduled'] as status}<button type="button" class="att-btn" class:here={status==='Attended'} class:missed={status==='Missed'} class:excused={status==='Excused'} class:active={form.status===status} on:click={() => form = { ...form, status }}>{status === 'Attended' ? 'Here' : status}</button>{/each}</div></div><div class="form-field full"><label for="attendance-note">Optional note</label><textarea id="attendance-note" bind:value={form.note} placeholder="Only if something needs follow-up"></textarea></div><p class="form-help">Saved on the patient record. Prefer the one-tap buttons on the schedule for normal days.</p>
  {:else if modal==='followup'}<div class="form-grid"><div class="form-field"><label for="followup-patient">Patient</label><select id="followup-patient" required bind:value={form.patient} on:change={() => { const p = data.patients.find(item => item.id === form.patient); if (!p) return; contactGate = p.contactMethod === 'Email' ? 'Email' : p.contactMethod === 'In person' ? 'In person' : 'Phone'; form.contactMethod = contactGate; form.contactPhone = p.contactPhone || ''; form.contactEmail = p.contactEmail || ''; form.consent = p.contactPreference || form.consent; form = { ...form }; }}><option value="" disabled>Select patient</option>{#each rolePatients.filter(p => p.status !== 'Archived') as patient}<option value={patient.id}>{patient.id} · {patient.name}</option>{/each}</select></div><div class="form-field"><label for="followup-owner">Owner</label><select id="followup-owner" bind:value={form.owner}><option>Maya</option><option>Nour</option><option>Therapist A</option><option>Therapist B</option></select></div><div class="form-field full"><label for="followup-action">Next action</label><input id="followup-action" required bind:value={form.action} placeholder="Scheduled call"/></div><div class="form-field"><label for="followup-due">Due date</label><input id="followup-due" type="date" required bind:value={form.due}/></div><div class="form-field"><label for="followup-time">Time</label><input id="followup-time" type="time" bind:value={form.time}/></div><div class="form-field"><label for="followup-method">Contact method</label><select id="followup-method" bind:value={contactGate} on:change={() => { form.contactMethod = contactGate; }}><option>Phone</option><option>Email</option><option>In person</option></select></div>{#if contactGate === 'Phone'}<div class="form-field reveal-field"><label for="followup-phone">Phone number</label><input id="followup-phone" type="tel" required bind:value={form.contactPhone} placeholder="+961 71 000 000"/></div>{:else if contactGate === 'Email'}<div class="form-field reveal-field"><label for="followup-email">Email address</label><input id="followup-email" type="email" required bind:value={form.contactEmail} placeholder="name@example.com"/></div>{/if}<div class="form-field full"><label for="followup-consent">Consent / notes</label><input id="followup-consent" bind:value={form.consent} placeholder="Phone contact agreed · patient only"/></div></div>
  {:else if modal==='invoice'}<div class="form-grid"><div class="form-field"><label for="invoice-patient">Patient</label><select id="invoice-patient" required bind:value={form.patient}><option value="" disabled>Select patient</option>{#each data.patients.filter(p => p.status !== 'Archived') as patient}<option value={patient.id}>{patient.id} · {patient.name}</option>{/each}</select></div><div class="form-field"><label for="invoice-payer">Payer</label><input id="invoice-payer" required bind:value={form.payer} placeholder="Self-pay or sponsor"/></div><div class="form-field"><label for="invoice-owner">Finance owner</label><select id="invoice-owner" bind:value={form.owner} disabled={role === 'Finance'}><option>Rana</option><option>Omar</option></select></div><div class="form-field"><label for="invoice-funding">Funding</label><select id="invoice-funding" bind:value={form.fundingType}><option>Self-pay</option><option>Sponsor funded</option><option>Mixed funding</option></select></div><div class="form-field"><label for="invoice-terms">Payment terms</label><select id="invoice-terms" bind:value={form.paymentTerms}><option>Due on date</option><option>Installments</option><option>Monthly</option></select></div><div class="form-field full"><label for="invoice-description">Description</label><input id="invoice-description" bind:value={form.description} placeholder="Program and treatment administration"/></div><div class="form-field"><label for="invoice-amount">Invoice total (USD)</label><input id="invoice-amount" type="number" min="0.01" step="0.01" required bind:value={form.amount}/></div><div class="form-field"><label for="invoice-paid">Paid so far (USD)</label><input id="invoice-paid" type="number" min="0" step="0.01" bind:value={form.paid} placeholder="0" disabled={!!editingId}/></div><div class="form-field"><label for="invoice-issued">Issue date</label><input id="invoice-issued" type="date" required bind:value={form.issued}/></div><div class="form-field"><label for="invoice-due">Due date</label><input id="invoice-due" type="date" required bind:value={form.due}/></div></div>
  {:else if modal==='room'}<div class="form-grid"><div class="form-section full"><span class="form-section-label">Room details</span></div><div class="form-field"><label for="room-wing">Wing</label><select id="room-wing" required bind:value={form.wing} on:change={() => { if (!editingId) form.roomNumber = nextRoomNumber(data.rooms, form.wing); }}><option>A</option><option>B</option></select></div><div class="form-field"><label for="room-number">Room number</label><input id="room-number" type="number" min="1" max="99" required bind:value={form.roomNumber}/></div><div class="form-field"><label for="room-capacity">Room type</label><select id="room-capacity" bind:value={form.bedCount}><option value={1}>Single · 1 bed</option><option value={2}>Twin · 2 beds</option></select></div><div class="form-field"><label for="room-access">Access</label><select id="room-access" bind:value={form.access}><option>Standard</option><option>Step-free</option></select></div><div class="form-field"><label for="room-readiness">Readiness</label><select id="room-readiness" bind:value={form.status}><option>Preparing</option><option>Ready</option><option>Maintenance</option></select></div><div class="form-field full"><label for="room-notes">Housekeeping note <span class="optional-label">Optional</span></label><textarea id="room-notes" rows="3" maxlength="240" bind:value={form.notes} placeholder="e.g. Linen change pending, inspect before arrival"></textarea></div></div><p class="form-help">New rooms start in Preparing. Mark Ready after staff confirm the space can receive a patient.</p>
  {:else if modal==='bed'}<div class="form-field"><label for="bed-patient">Patient for {activeRoom}, bed {activeBed+1}</label><select id="bed-patient" required bind:value={form.patient}><option value="" disabled>Select an unplaced patient</option>{#each data.patients.filter(p => p.status !== 'Archived' && !data.rooms.some(r => r.beds.includes(p.id))) as patient}<option value={patient.id}>{patient.id} · {patient.name}</option>{/each}</select></div><p class="form-help">Placement requires staff review of suitability and room readiness.</p>
  {:else if modal==='payment'}<div class="payment-summary"><span>Invoice {editingId}</span><strong>Open balance ${(data.invoices.find(i=>i.id===editingId)?.amount - (Number(data.invoices.find(i=>i.id===editingId)?.paid) || 0)).toLocaleString()}</strong></div><div class="form-field"><label for="payment-amount">Payment amount (USD)</label><input id="payment-amount" type="number" min="0.01" step="0.01" required bind:value={form.payment}/></div><div class="form-grid"><div class="form-field"><label for="payment-date">Date received</label><input id="payment-date" type="date" required bind:value={form.paymentDate}/></div><div class="form-field"><label for="payment-method">Method</label><select id="payment-method" bind:value={form.method}><option>Bank transfer</option><option>Cash</option><option>Card</option><option>Sponsor remittance</option></select></div><div class="form-field full"><label for="payment-reference">Reference</label><input id="payment-reference" bind:value={form.reference} placeholder="Receipt or transfer reference"/></div><div class="form-field full"><label for="payment-note">Payment note</label><textarea id="payment-note" bind:value={form.paymentNote} placeholder="Optional funding or installment note"></textarea></div></div>
  {:else if modal==='outcome'}<div class="form-grid"><div class="form-field"><label for="outcome-result">Contact result</label><select id="outcome-result" bind:value={form.contactResult}><option>Reached</option><option>No answer</option><option>Rescheduled</option><option>Declined contact</option></select></div><div class="form-field full"><label for="outcome-text">Outcome</label><textarea id="outcome-text" required bind:value={form.outcome} placeholder="Document the contact and agreed next step"></textarea></div><div class="form-field full"><label for="outcome-next">Next task (optional)</label><input id="outcome-next" bind:value={form.nextAction} placeholder="e.g. Confirm next appointment"/></div>{#if form.nextAction}<div class="form-field"><label for="outcome-next-due">Due date</label><input id="outcome-next-due" type="date" bind:value={form.nextDue}/></div><div class="form-field"><label for="outcome-next-owner">Owner</label><select id="outcome-next-owner" bind:value={form.nextOwner}>{#if role === 'Therapist'}<option>{staff.assignment}</option>{:else}<option>Maya</option><option>Nour</option><option>Therapist A</option><option>Therapist B</option>{/if}</select></div>{/if}</div><p class="form-help">A new task is created only when you enter a next action. Use fictional details in this demo.</p>
  {:else if modal==='confirm'}<p class="confirm-copy">Are you sure you want to {deleteTarget?.label || 'remove this record'}? This change affects only local fictional demo data.</p>{/if}
  {#if formError}<div class="form-error" role="alert">{formError}</div>{/if}
  </div><div class="modal-foot">{#if editingId && ['inquiry','session','invoice','followup','room'].includes(modal) && canRemove(modal, modal === 'room' ? data.rooms.find(r => r.id === editingId) : modal === 'session' ? data.sessions.find(s => s.id === editingId) : null)}<button type="button" class="btn btn-danger-quiet" on:click={() => askDelete(modal, editingId, editingId)}>Remove</button>{/if}<span class="modal-spacer"></span><button type="button" class="btn btn-outline" on:click={closeModal}>Cancel</button><button type="submit" class="btn btn-primary">{modal==='confirm'?'Confirm change':modal==='outcome'?'Complete follow-up':modal==='payment'?'Record payment':modal==='room'?(editingId?'Save room':'Create room'):editingId?'Save changes':'Save record'}</button></div></form></div>{/if}
{#if activeInquiry && data.inquiries.find(item => item.id === activeInquiry)}<AdmissionDetail inquiry={data.inquiries.find(item => item.id === activeInquiry)} {role} {staff} onClose={() => activeInquiry = ''} onPersist={(id, action) => { logAction('Admissions', `${id} ${action}`); persist(); }} onConvert={convertInquiry} onOpenPatient={(id) => { selectedPatient = id; activeInquiry = ''; go('patients'); }}/>{/if}
{#if activeInvoice && data.invoices.find(item => item.id === activeInvoice)}<InvoiceDetail invoice={data.invoices.find(item => item.id === activeInvoice)} onClose={() => activeInvoice = ''} onPayment={() => { const item = data.invoices.find(entry => entry.id === activeInvoice); activeInvoice = ''; if (item) openPayment(item); }} onEdit={() => { const item = data.invoices.find(entry => entry.id === activeInvoice); activeInvoice = ''; if (item) openEdit('invoice', item); }}/>{/if}
{#if sessionClose}<div class="session-close-backdrop" role="presentation"><form class="session-close-card" use:dialogFocus={{onClose:() => { sessionClose = null; closeError = ''; }}} on:submit|preventDefault={saveSessionClose}><div class="session-close-kicker">CLOSE THE SESSION</div><h2>{sessionClose.time} · {sessionClose.title}</h2><p>One line is enough — what happened, or the next step.</p><label for="session-close-note">Session close note</label><textarea id="session-close-note" rows="3" bind:value={sessionClose.note} placeholder="e.g. Attended. Keep the same appointment time next week."></textarea>{#if closeError}<div class="form-error" role="alert">{closeError}</div>{/if}<div class="session-close-actions"><button type="button" class="btn btn-outline" on:click={() => { sessionClose = null; closeError = ''; notice('Still open — finish the close note from the list.'); }}>Later</button><button type="submit" class="btn btn-primary">Save close note</button></div></form></div>{/if}
{#if toast}<div class="toast" role="status">{toast}</div>{/if}
