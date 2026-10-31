import { iso } from './data.js';

const phases = ['Stabilization', 'Building routine', 'Active treatment', 'Transition planning'];
const priorities = [
  'Keep the weekly care plan current',
  'Confirm the next individual session',
  'Review agreed family contact preferences',
  'Coordinate the next program milestone'
];

const caseProfiles = {
  'P-1042': {
    intake: 'Mira requested a structured residential routine following a family referral. At intake she asked for a clear weekly schedule, one named point of contact, and direct discussion before any family update.',
    preferences: 'Arabic or English in sessions. Phone contact to Mira first; family updates require a separate confirmation in the consent register.',
    continuity: 'Nour coordinates the weekly timetable. Therapist A reviews attendance and the transition support plan at the next care-plan meeting.',
    transition: 'Confirm the first outpatient appointment and agreed support contacts before any discharge date is proposed.',
    additionalNotes: [
      { id: 'NOTE-P-1042-03', kind: 'Session note', title: 'Individual session · routine mapping', body: 'Mira reviewed the current weekly timetable and identified the afternoon group as easier to attend than the morning group. The next step is to confirm the group time with scheduling and revisit the routine at the care-plan review.', author: 'Therapist A', date: iso(-5), time: '10:45', status: 'Signed' },
      { id: 'NOTE-P-1042-04', kind: 'Coordination note', title: 'Family contact preference checked', body: 'Nour confirmed that family updates must wait for Mira to review the scope of sharing. The consent register remains marked for confirmation. No family update was sent from this entry.', author: 'Nour Haddad', date: iso(-3), time: '14:15', status: 'Signed' },
      { id: 'NOTE-P-1042-05', kind: 'Care-plan review', title: 'Transition planning checkpoint', body: 'The team agreed to prepare a first outpatient appointment option and a list of support contacts for Mira to review. No discharge date has been set. Therapist A will bring the draft support plan to the next individual session.', author: 'Therapist A', date: iso(-2), time: '12:05', status: 'Signed' }
    ],
    additionalComments: [
      { id: 'COM-P-1042-03', date: iso(-1), author: 'Nour Haddad', body: 'I reserved a discussion slot for the outpatient handoff. Please confirm the proposed time with Mira before adding it to the calendar.' }
    ]
  },
  'P-1037': {
    intake: 'Karim entered the residential program after a self-referral. He asked to include a family meeting after staff and Karim confirm the topics and participants.',
    preferences: 'Arabic preferred. Meeting details should be confirmed directly with Karim. The current register records consent for the planned family meeting only.',
    continuity: 'Maya coordinates the family meeting and records the agreed attendee list. The therapist reviews the care-plan goal after the meeting.',
    transition: 'Agree the next family contact and written summary before the next care-plan review.',
    additionalNotes: [
      { id: 'NOTE-P-1037-03', kind: 'Coordination note', title: 'Family meeting agenda', body: 'Maya confirmed the proposed meeting time and asked Karim to review the attendee list. The meeting should cover the support plan and next contact, with scope limited to the recorded consent.', author: 'Maya Mansour', date: iso(-2), time: '13:40', status: 'Signed' },
      { id: 'NOTE-P-1037-04', kind: 'Session note', title: 'Individual session follow-through', body: 'Draft summary of the individual session. The assigned therapist still needs to check the agreed next step and sign this note before it is used for team handoff.', author: 'Therapist A', date: iso(-4), time: '10:35', status: 'Draft' }
    ]
  },
  'P-1035': {
    intake: 'Lea joined the residential program through a clinician referral. She asked for the group schedule in writing and prefers that no family updates be sent.',
    preferences: 'Arabic preferred. Family sharing is not authorized in the current register. Confirm any change directly with Lea before updating permissions.',
    continuity: 'Nour coordinates the group schedule. The therapist checks the attendance note and adjusts the next appointment if a timetable conflict is confirmed.',
    transition: 'Review the agreed contact method and next group schedule before transition planning.',
    additionalNotes: [
      { id: 'NOTE-P-1035-03', kind: 'Session note', title: 'Group attendance follow-up', body: 'The group attendance entry was marked excused. Lea reported a timetable conflict to the care team. Staff will offer the next available group time and record the choice in the schedule.', author: 'Therapist A', date: iso(-2), time: '11:50', status: 'Signed' }
    ],
    additionalAttendance: [
      { id: 'ATT-P-1035-03', date: iso(-8), title: 'Group session', staff: 'Care team', status: 'Missed', note: 'No attendance follow-up recorded on this entry' },
      { id: 'ATT-P-1035-04', date: iso(-2), title: 'Group session', staff: 'Care team', status: 'Excused', note: 'Timetable conflict reported; alternative time to confirm' }
    ]
  },
  'P-1044': {
    additionalNotes: [
      { id: 'NOTE-P-1044-03', kind: 'Session note', title: 'Group session summary', body: 'Draft group session summary awaiting review of the agreed next step and therapist signature.', author: 'Therapist B', date: iso(-3), time: '12:10', status: 'Draft' }
    ]
  },
  'P-1025': {
    intake: 'Tarek is attending the outpatient pathway following a prior residential stay. The current work focuses on keeping the follow-up appointment and coordinating agreed contact.',
    preferences: 'Phone contact agreed for appointment coordination. Do not use family contact unless the consent register is updated.',
    continuity: 'Therapist A owns the next follow-up session. Maya confirms the appointment and records the outcome.',
    transition: 'Review the next month of appointments and confirm the agreed contact cadence.',
    additionalNotes: [
      { id: 'NOTE-P-1025-03', kind: 'Progress note', title: 'Outpatient contact plan', body: 'The team confirmed a follow-up session for tomorrow. Tarek agreed to phone contact for scheduling. The outcome and any next appointment should be recorded after the session.', author: 'Therapist A', date: iso(-1), time: '16:20', status: 'Signed' }
    ]
  }
};

function sampleRecord(patient, index) {
  const lead = patient.therapist || (index % 2 ? 'Therapist B' : 'Therapist A');
  const phase = phases[index % phases.length];
  const isFocus = patient.id === 'P-1042';
  const profile = caseProfiles[patient.id];
  const planGoals = isFocus ? [
    { id: 'GOAL-1', title: 'Maintain a consistent weekly session routine', detail: 'Attend scheduled individual and group appointments and review barriers with the therapist.', owner: lead, due: iso(7), status: 'In progress', progress: 70 },
    { id: 'GOAL-2', title: 'Prepare a practical support plan for transition', detail: 'Identify agreed support contacts and a first follow-up appointment.', owner: patient.coordinator, due: iso(14), status: 'In progress', progress: 35 },
    { id: 'GOAL-3', title: 'Review communication preferences', detail: 'Confirm what information may be shared and with whom.', owner: patient.coordinator, due: iso(3), status: 'Needs review', progress: 20 }
  ] : [
    { id: `GOAL-${index + 1}-1`, title: priorities[index % priorities.length], detail: 'Review progress at the next team check-in and agree an achievable next step.', owner: lead, due: iso(7 + index % 5), status: 'In progress', progress: 25 + (index * 11) % 55 },
    { id: `GOAL-${index + 1}-2`, title: 'Agree the next contact and handoff', detail: 'Document the responsible staff member, date and preferred contact method.', owner: patient.coordinator, due: iso(12 + index % 4), status: 'Planned', progress: 0 }
  ];

  return {
    phase,
    pathway: patient.program === 'Residential' ? 'Residential recovery program' : 'Outpatient recovery program',
    lead,
    background: {
      intake: profile?.intake || `${patient.name} entered the ${patient.program.toLowerCase()} pathway following a ${patient.referral?.toLowerCase() || 'recorded referral'}. The assigned team is confirming the weekly plan and next appointment.`,
      preferences: profile?.preferences || `Preferred language: ${patient.language || 'to confirm'}. Contact method: ${patient.contactPreference || 'to confirm'}. Follow the current consent register before sharing information.`,
      continuity: profile?.continuity || `${patient.coordinator} coordinates practical handoffs. ${lead} reviews the care-plan goals and next session.`,
      transition: profile?.transition || 'The team will document a practical next appointment and support contact before transition.'
    },
    reviewDue: iso(7 + index % 6),
    carePlan: {
      updated: iso(-(index % 5)),
      reviewDue: iso(7 + index % 6),
      focus: isFocus ? 'Build a steady care routine and prepare a supported transition.' : 'Keep care goals, appointments and team handoffs aligned.',
      goals: planGoals
    },
    notes: [
      {
        id: `NOTE-${patient.id}-01`,
        kind: 'Progress note',
        title: isFocus ? 'Weekly plan review' : 'Care team check-in',
        body: isFocus ? 'Reviewed the current weekly schedule and agreed to keep the next individual session and group appointment visible in the plan. Follow up on the preferred contact method at the next review.' : 'Reviewed current appointments, open team tasks and the next contact. The plan remains active pending the scheduled review.',
        author: lead,
        date: iso(-1 - index % 4),
        time: '11:20',
        status: 'Signed'
      },
      {
        id: `NOTE-${patient.id}-02`,
        kind: 'Coordination note',
        title: 'Next step confirmed',
        body: 'Coordinator reviewed the upcoming appointment and the current communication preference. Any change will be documented in the consent section.',
        author: patient.coordinator,
        date: iso(-4 - index % 3),
        time: '15:10',
        status: 'Signed'
      }
    ],
    comments: [
      { id: `COM-${patient.id}-01`, date: iso(-2), author: patient.coordinator, body: 'Please confirm the next appointment and check whether the document register is complete.' },
      { id: `COM-${patient.id}-02`, date: iso(-1), author: lead, body: 'The next care-plan review should include the current session routine and the agreed contact preference.' }
    ],
    aiReviews: [],
    reports: [
      {
        id: `RPT-${patient.id}-01`,
        type: 'Weekly progress',
        title: 'Weekly progress report',
        periodStart: iso(-14),
        periodEnd: iso(-8),
        overview: isFocus ? 'The prior week focused on maintaining appointment continuity and clarifying the next care-plan review.' : 'The prior week focused on scheduled sessions, team coordination and the next agreed action.',
        engagement: isFocus ? 'Attended the most recent recorded individual appointment. Group attendance is awaiting confirmation.' : 'Attendance and follow-up are recorded in the appointment log.',
        goals: 'Care-plan goals remain in progress. Review the goal status with the assigned therapist.',
        nextSteps: isFocus ? 'Confirm the next session, review the support plan and update consent preferences.' : 'Confirm the next appointment and review the open care-plan goal.',
        status: 'Draft',
        author: lead,
        createdAt: iso(-1)
      }
    ],
    documents: [
      { id: `DOC-${patient.id}-01`, name: 'Intake questionnaire', category: 'Intake', status: 'On file', date: patient.admitted, owner: patient.coordinator, sample: true, extractedText: `Fictional intake questionnaire for ${patient.name}. Preferred language: ${patient.language || 'to confirm'}. Referral: ${patient.referral || 'not recorded'}. Preferred contact: ${patient.contactPreference || 'to confirm'}. Program discussed: ${patient.program}. Staff to confirm any sharing preference before family contact.` },
      { id: `DOC-${patient.id}-02`, name: 'Care plan agreement', category: 'Care plan', status: index % 4 === 0 ? 'Needs review' : 'On file', date: iso(-3), owner: lead, sample: true, extractedText: `Fictional care plan agreement for ${patient.name}. Current focus: ${isFocus ? 'Build a steady care routine and prepare a supported transition.' : 'Keep care goals, appointments and team handoffs aligned.'} Assigned therapist: ${lead}. Next review should confirm goals, appointments and ownership of follow-up actions.` },
      { id: `DOC-${patient.id}-03`, name: 'Discharge planning checklist', category: 'Transition', status: 'Requested', date: iso(0), owner: patient.coordinator, sample: true }
    ],
    consents: [
      { id: `CON-${patient.id}-01`, label: 'Care team information sharing', scope: 'Assigned care team', status: 'Recorded', date: patient.admitted, reviewDue: iso(30) },
      { id: `CON-${patient.id}-02`, label: 'Family updates', scope: patient.consent || 'Confirm preference', status: /no family|require consent|confirm/i.test(patient.consent || '') ? 'Needs confirmation' : 'Recorded', date: iso(-2), reviewDue: iso(14) },
      { id: `CON-${patient.id}-03`, label: 'Aftercare contact', scope: 'Contact method to confirm before discharge', status: 'Needs confirmation', date: iso(0), reviewDue: iso(14) }
    ],
    attendance: [
      { id: `ATT-${patient.id}-01`, date: iso(-1), title: 'Individual session', staff: lead, status: 'Attended', note: 'Attendance recorded' },
      { id: `ATT-${patient.id}-02`, date: iso(-4), title: 'Group session', staff: 'Care team', status: index % 4 === 0 ? 'Excused' : 'Attended', note: index % 4 === 0 ? 'Reason documented by team' : 'Attendance recorded' }
    ]
  };
}

export function ensureClinicalData(data) {
  data.clinical ||= {};
  data.patients.forEach((patient, index) => {
    const sample = sampleRecord(patient, index);
    const record = data.clinical[patient.id] ||= sample;
    for (const [key, value] of Object.entries(sample)) {
      if (record[key] == null) record[key] = value;
    }
    for (const document of record.documents || []) {
      if (document.sample && !document.extractedText) {
        document.extractedText = sample.documents.find(item => item.id === document.id)?.extractedText || '';
      }
    }
    const profile = caseProfiles[patient.id];
    for (const note of profile?.additionalNotes || []) if (!record.notes.some(item => item.id === note.id)) record.notes.push({ ...note });
    for (const comment of profile?.additionalComments || []) if (!record.comments.some(item => item.id === comment.id)) record.comments.push({ ...comment });
    for (const item of profile?.additionalAttendance || []) if (!record.attendance.some(entry => entry.id === item.id)) record.attendance.push({ ...item });
    record.notes.sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')) || String(b.time || '').localeCompare(String(a.time || '')));
    record.comments.sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')));
  });
  return data;
}

export function recordSummary(data, patientId) {
  const record = data.clinical?.[patientId];
  if (!record) return null;
  const attended = record.attendance.filter(item => item.status === 'Attended').length;
  const total = record.attendance.length;
  return {
    openGoals: record.carePlan.goals.filter(goal => goal.status !== 'Completed').length,
    reports: record.reports.length,
    documentsDue: record.documents.filter(doc => doc.status !== 'On file').length,
    attendance: total ? `${attended}/${total}` : '—'
  };
}
