export const today = new Date();
export const iso = (offset = 0) => {
  const d = new Date(today.getFullYear(), today.getMonth(), today.getDate() + offset);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
export const prettyDate = (value, options = { day: 'numeric', month: 'short' }) =>
  new Date(`${value}T12:00:00`).toLocaleDateString('en-LB', options);

const seed = () => ({
  inquiries: [
    { id: 'INQ-021', name: 'New website inquiry', source: 'Website', stage: 'New inquiry', next: 'Schedule first conversation', owner: 'Maya', date: iso(0), documents: false },
    { id: 'INQ-022', name: 'Family referral', source: 'Family', stage: 'New inquiry', next: 'Assign intake coordinator', owner: 'Unassigned', date: iso(0), documents: false },
    { id: 'INQ-018', name: 'Intake call completed', source: 'Phone', stage: 'Intake review', next: 'Review consent form', owner: 'Maya', date: iso(1), documents: false },
    { id: 'INQ-019', name: 'Documents requested', source: 'Referral', stage: 'Intake review', next: 'Await intake questionnaire', owner: 'Nour', date: iso(1), documents: false },
    { id: 'INQ-016', name: 'Assessment submitted', source: 'Referral', stage: 'Awaiting decision', next: 'Authorized team review', owner: 'Nour', date: iso(2), documents: true },
    { id: 'INQ-012', name: 'Planned arrival', source: 'Phone', stage: 'Arrival planned', next: 'Confirm room and welcome pack', owner: 'Maya', date: iso(3), documents: true },
    { id: 'INQ-011', name: 'Outpatient welcome', subject: 'Yara M.', source: 'Referral', stage: 'Arrival planned', next: 'Confirm arrival time and private welcome', owner: 'Nour', deskOwner: 'Leila', date: iso(2), documents: true, program: 'Outpatient', preferredContact: 'Phone', location: 'Beirut', handoff: 'Call using the agreed number, confirm a quiet arrival time and orient Yara to the outpatient room.' }
  ],
  patients: [
    { id: 'P-1042', name: 'Patient P-1042', program: 'Residential', room: 'A-03', coordinator: 'Nour Haddad', next: 'Individual session · 10:00', care: 'Weekly plan review due', consent: 'Family updates require consent', admitted: iso(-11) },
    { id: 'P-1037', name: 'Patient P-1037', program: 'Residential', room: 'B-02', coordinator: 'Maya Mansour', next: 'Family meeting · 14:00', care: 'Confirm family meeting', consent: 'Family meeting consent on file', admitted: iso(-17) },
    { id: 'P-1035', name: 'Patient P-1035', program: 'Residential', room: 'A-02', coordinator: 'Nour Haddad', next: 'Group session · 11:30', care: 'Attendance follow-up', consent: 'No family updates authorized', admitted: iso(-23) },
    { id: 'P-1031', name: 'Patient P-1031', program: 'Residential', room: 'A-01', coordinator: 'Maya Mansour', next: 'Individual session · tomorrow', care: 'Review weekly plan', consent: 'Family contact by coordinator', admitted: iso(-32) },
    { id: 'P-1044', name: 'Patient P-1044', program: 'Residential', room: 'A-04', coordinator: 'Nour Haddad', next: 'Group session · 11:30', care: 'No open care tasks', consent: 'Contact preferences recorded', admitted: iso(-7) },
    { id: 'P-1025', name: 'Patient P-1025', program: 'Outpatient', room: '—', coordinator: 'Maya Mansour', next: 'Follow-up session · tomorrow', care: 'Confirm appointment', consent: 'Phone contact agreed', admitted: iso(-63) },
    ...['P-1032:A-01','P-1046:A-04','P-1028:A-05','P-1030:A-05','P-1027:A-06','P-1024:B-01','P-1040:B-01','P-1022:B-03','P-1041:B-03','P-1039:B-04','P-1036:B-05','P-1021:B-05','P-1020:B-06'].map((entry, index) => { const [id, room] = entry.split(':'); return { id, name: `Patient ${id}`, program: 'Residential', room, coordinator: index % 2 ? 'Maya Mansour' : 'Nour Haddad', next: 'To schedule', care: 'Weekly plan review', consent: 'Contact preference to confirm', admitted: iso(-5 - index * 2), status: 'Active' }; })
  ],
  sessions: [
    { id: 'SES-101', time: '09:00', title: 'Team handover', meta: 'Morning shift · Staff room', owner: 'Care team', kind: 'green', date: iso(0) },
    { id: 'SES-102', time: '10:00', title: 'Individual session', meta: 'P-1042 · Room 1', owner: 'Therapist A', kind: 'blue', date: iso(0) },
    { id: 'SES-103', time: '11:30', title: 'Group session', meta: '6 participants · Hall', owner: 'Therapist B', kind: 'sand', date: iso(0) },
    { id: 'SES-104', time: '14:00', title: 'Family meeting', meta: 'P-1037 · Consent on file', owner: 'Coordinator', kind: 'green', date: iso(0) },
    { id: 'SES-105', time: '10:00', title: 'Intake conversation', meta: 'INQ-021 · Office', owner: 'Coordinator', kind: 'blue', date: iso(1) },
    { id: 'SES-106', time: '11:00', title: 'Follow-up session', meta: 'P-1025 · Room 2', owner: 'Therapist A', kind: 'green', date: iso(1) }
  ],
  rooms: Array.from({ length: 12 }, (_, i) => {
    const wing = i < 6 ? 'A' : 'B';
    const room = `${wing}-${String((i % 6) + 1).padStart(2, '0')}`;
    const ids = ['P-1031','P-1032','P-1035',null,'P-1042',null,'P-1044','P-1046','P-1028','P-1030',null,'P-1027','P-1024','P-1040',null,'P-1037','P-1022','P-1041','P-1039',null,'P-1036','P-1021','P-1020',null];
    return { id: room, status: 'Ready', beds: [ids[i * 2], ids[i * 2 + 1]] };
  }),
  invoices: [
    { id: 'INV-026', patient: 'P-1042', payer: 'Self-pay', due: iso(5), amount: 2000, status: 'Upcoming' },
    { id: 'INV-023', patient: 'P-1037', payer: 'Sponsor A', due: iso(5), amount: 1500, status: 'Upcoming' },
    { id: 'INV-021', patient: 'P-1035', payer: 'Self-pay', due: iso(-5), amount: 1000, status: 'Overdue' },
    { id: 'INV-019', patient: 'P-1031', payer: 'Sponsor B', due: iso(-2), amount: 1500, paid: 500, status: 'Part-paid' }
  ],
  followups: [
    { id: 'AF-101', patient: 'P-1008', action: 'Scheduled call', owner: 'Maya', due: iso(0), time: '15:00', status: 'Due today', consent: 'Phone contact agreed' },
    { id: 'AF-102', patient: 'P-1013', action: 'Confirm appointment', owner: 'Nour', due: iso(0), time: '16:00', status: 'Due today', consent: 'Contact preferences recorded' },
    { id: 'AF-103', patient: 'P-1021', action: 'Retry agreed contact', owner: 'Maya', due: iso(0), time: '17:00', status: 'Due today', consent: 'Phone contact agreed' },
    { id: 'AF-104', patient: 'P-1025', action: 'Follow-up session', owner: 'Therapist A', due: iso(3), time: '11:00', status: 'Upcoming', consent: 'Appointment confirmed' },
    { id: 'AF-105', patient: 'P-1029', action: 'Review follow-up plan', owner: 'Nour', due: iso(4), time: '10:00', status: 'Upcoming', consent: 'Staff review only' }
  ],
  activity: []
});

export function withAssignments(data) {
  if (!data.staffAssignmentVersion) {
    const intakePatient = data.patients.find(patient => patient.id === 'P-1042');
    if (intakePatient?.therapist === 'Therapist B') intakePatient.therapist = 'Therapist A';
    data.staffAssignmentVersion = 1;
  }
  const demoAliases = ['Mira K.','Karim S.','Lea M.','Nabil H.','Rana A.','Tarek D.','Nour F.','Sami B.','Jana R.','Fadi C.','Hala N.','Elias T.','Maya J.','Omar L.','Dina P.','Rami G.','Lina W.','Youssef E.','Salma Q.'];
  data.patients.forEach((patient, index) => {
    patient.therapist ||= patient.id === 'P-1042' || patient.id === 'P-1025' ? 'Therapist A' : Number(patient.id.split('-')[1]) % 2 ? 'Therapist A' : 'Therapist B';
    patient.rsa ||= patient.id === 'P-1042' ? 'Salim' : index % 2 ? 'Dana' : 'Salim';
    if (patient.name === `Patient ${patient.id}`) patient.name = demoAliases[index] || `Demo case ${patient.id}`;
    patient.ageBand ||= ['25–34','35–44','45–54','18–24'][index % 4];
    patient.language ||= index % 3 === 0 ? 'Arabic / English' : 'Arabic';
    patient.referral ||= ['Family referral','Self referral','Clinician referral','Community partner'][index % 4];
    patient.contactMethod ||= index % 3 === 0 ? 'Phone' : index % 3 === 1 ? 'Email' : 'Confirm with coordinator';
    patient.contactPhone ||= patient.contactMethod === 'Phone' ? `+961 7${1 + (index % 8)} ${String(100000 + index * 137).slice(0, 3)} ${String(200 + index * 11).slice(0, 3)}` : '';
    patient.contactEmail ||= patient.contactMethod === 'Email' ? `patient.${patient.id.toLowerCase()}@cedar.demo` : '';
    patient.contactPreference ||= patient.contactMethod === 'Phone' && patient.contactPhone ? `Phone · ${patient.contactPhone}` : patient.contactMethod === 'Email' && patient.contactEmail ? `Email · ${patient.contactEmail}` : 'Confirm with coordinator';
  });
  data.inquiries.forEach((item, index) => {
    item.deskOwner ||= index % 2 ? 'Karim' : 'Leila';
    item.subject ||= ['Rita M.','Sami H.','Nour A.','Karim D.','Lea R.','Omar K.'][index] || `Inquiry ${item.id}`;
    item.program ||= index % 3 === 0 ? 'Outpatient' : 'Residential';
    item.preferredContact ||= index % 2 ? 'Phone' : 'Email';
    item.contactPhone ||= item.preferredContact === 'Phone' ? `+961 7${1 + (index % 8)} ${String(310000 + index * 211).slice(0, 3)} ${String(400 + index * 17).slice(0, 3)}` : '';
    item.contactEmail ||= item.preferredContact === 'Email' ? `inquiry.${item.id.toLowerCase()}@cedar.demo` : '';
    item.contactNote ||= item.preferredContact === 'In person' ? 'Desk walk-in' : '';
    item.location ||= index % 2 ? 'Mount Lebanon' : 'Beirut';
    item.therapist ||= index % 2 ? 'Therapist B' : 'Therapist A';
    item.checklist ||= {
      firstContact: item.stage !== 'New inquiry',
      consent: item.stage === 'Awaiting decision' || item.stage === 'Arrival planned',
      questionnaire: item.documents,
      assessment: item.stage === 'Awaiting decision' || item.stage === 'Arrival planned',
      funding: item.stage === 'Arrival planned'
    };
    item.decision ||= item.stage === 'Arrival planned' ? 'Approved by staff' : 'Pending review';
    item.handoff ||= item.stage === 'Arrival planned' ? 'Confirm welcome call, room readiness and assigned coordinator.' : 'Document the next contact and complete the intake checklist.';
    item.history ||= [{ id: `H-${item.id}-1`, date: item.date, action: `${item.stage} recorded`, by: item.owner || 'Cedar team' }];
  });
  data.invoices.forEach((item, index) => {
    if (item.paid == null) item.paid = 0;
    item.issued ||= iso(-7 - index * 3);
    item.owner ||= index % 2 ? 'Omar' : 'Rana';
    item.fundingType ||= item.payer?.startsWith('Sponsor') ? 'Sponsor funded' : 'Self-pay';
    item.paymentTerms ||= item.paid ? 'Installments' : 'Due on date';
    item.description ||= 'Program and treatment administration';
    item.payments ||= item.paid ? [{ id: `PAY-${item.id}-01`, date: iso(-2), amount: Number(item.paid), method: 'Bank transfer', reference: `DEMO-${item.id}`, note: 'Fictional opening balance payment' }] : [];
  });
  data.followups.forEach((item, index) => {
    item.contactMethod ||= item.consent?.toLowerCase().includes('email') ? 'Email' : 'Phone';
    item.contactPhone ||= item.contactMethod === 'Phone' ? `+961 71 ${String(500000 + index * 91).slice(0, 3)} ${String(100 + index * 13).slice(0, 3)}` : '';
    item.contactEmail ||= item.contactMethod === 'Email' ? `aftercare.${item.patient.toLowerCase()}@cedar.demo` : '';
  });
  data.sessions.forEach((item, index) => {
    item.patientRef ||= item.meta?.match(/P-\d+/)?.[0] || '';
    if (/intake|handover|arrival|coordination|family meeting/i.test(item.title) || item.owner === 'Coordinator') item.deskOwner ||= index % 2 ? 'Karim' : 'Leila';
  });
  data.supportCheckins ||= [
    { id: 'SC-101', patientId: 'P-1042', date: iso(-1), status: 'Settled', note: 'Joined the morning routine and asked for a later check-in after the group.', followUp: 'Check in after the afternoon activity.', recordedBy: 'Salim' },
    { id: 'SC-102', patientId: 'P-1037', date: iso(-1), status: 'Needs follow-up', note: 'Requested help arranging personal supplies for the week.', followUp: 'Confirm supplies and review at the next daily check-in.', recordedBy: 'Dana' }
  ];
  return data;
}

export function loadData() {
  try {
    const stored = JSON.parse(localStorage.getItem('cedar-demo-v1'));
    if (stored?.inquiries && stored?.rooms && stored?.followups) {
      const reference = seed();
      for (const patient of reference.patients) if (!stored.patients.some(p => p.id === patient.id)) stored.patients.push(patient);
      for (const inquiry of reference.inquiries.filter(item => item.id === 'INQ-011')) if (!stored.inquiries.some(i => i.id === inquiry.id)) stored.inquiries.push(inquiry);
      stored.activity ||= [];
      stored.rooms.forEach(room => { room.status ||= 'Ready'; });
      stored.invoices.forEach(i => { if (i.paid == null) i.paid = i.status === 'Paid' ? i.amount : i.status === 'Part-paid' ? Math.round(i.amount / 3) : 0; });
      return withAssignments(stored);
    }
  } catch { /* The demo can recover from a corrupted browser copy. */ }
  return withAssignments(seed());
}
export function saveData(data) { localStorage.setItem('cedar-demo-v1', JSON.stringify(data)); }
export function resetData() { localStorage.removeItem('cedar-demo-v1'); return withAssignments(seed()); }

