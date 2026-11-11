// Clinical & Program forms, field for field from Cedar_Rehab_Clinical_Forms.docx.
// Confidential: these records never enter the CRM, the admin file, or family communication.
import { field as f } from './field.js';

const patient = f('patient', 'Patient (first name + initial)', 'text', { prefill: 'clinicalName', readonly: true });
const LMH = { type: 'lmh' };
const anyRisk = values => ['riskSelfHarm', 'riskAbscond', 'riskAggression'].some(id => ['Medium', 'High'].includes(values[id]));
const flagged = values => (values.riskFlags || []).some(flag => flag !== 'None');

export const CLINICAL_FORMS = [
  {
    id: 'intake', family: 'clinical', number: 1, title: 'Intake Psychological Assessment', owners: ['nabila', 'samar', 'ahmed'],
    purpose: "Completed by the Clinical Director within 72 hours of arrival, after Fadia's medical assessment. Director writes the clinical-judgement sections and countersigns the whole.",
    rule: 'Any Medium or High risk rating: Ahmed is informed the same day, and the rating carries into the treatment plan and every session note until reviewed down.',
    header: [patient, f('age', 'Age', 'number', { prefill: 'age' }), f('admissionDate', 'Admission date', 'date', { prefill: 'admittedAt' }), f('assessmentDate', 'Assessment date', 'date', { prefill: 'today' })],
    sections: [
      { title: 'Substance use', fields: [
        f('substances', 'Substances, pattern & duration', 'notes', { hint: 'what, how much, how often, since when, last use' }),
        f('previousTreatment', 'Previous treatment attempts & outcomes', 'notes')
      ] },
      { title: 'History & context', fields: [
        f('mentalHealth', 'Mental health history', 'notes', { hint: 'diagnoses, episodes, current symptoms' }),
        f('familySocial', 'Family & social context', 'notes'),
        f('legal', 'Legal context', 'one', { options: ['Voluntary', 'Court-mandated', 'Mixed / other'] })
      ] },
      { title: 'Motivation', fields: [
        f('stageOfChange', 'Stage of change', 'one', { options: ['Precontemplation', 'Contemplation', 'Preparation', 'Action'] }),
        f('motivation', "Motivation — in the patient's words", 'notes')
      ] },
      { title: 'Risk assessment', fields: [
        f('riskSelfHarm', 'Self-harm / suicide risk', LMH.type),
        f('riskAbscond', 'Absconding risk', LMH.type),
        f('riskAggression', 'Aggression risk', LMH.type),
        f('riskNotes', 'Risk notes & basis', 'notes', { hint: 'any Medium or High requires a note and same-day escalation to Ahmed', requiredWhen: anyRisk })
      ] },
      { title: 'Strengths & formulation', fields: [
        f('strengths', 'Strengths & supports', 'notes'),
        f('crossChecked', 'Cross-checked with medical assessment (Fadia)', 'one', { options: ['Yes — pictures agree', 'Yes — discrepancy flagged', 'Not yet'] }),
        f('impression', 'Initial clinical impression & priorities', 'notes'),
        f('conductedBy', 'Conducted by', 'signature'),
        f('countersigned', 'Countersigned — Clinical Director', 'signature', { signer: ['ahmed'], later: true })
      ] }
    ]
  },
  {
    id: 'plan', family: 'clinical', number: 2, title: 'Treatment Plan', owners: ['nabila', 'samar', 'ahmed'],
    purpose: 'Written within 7 days of admission, discussed with the patient, signed by them, seen by Ahmed. Reviewed monthly and at every phase change — reviews are dated entries below, not rewrites.',
    rule: 'A significant event — relapse, incident, medication change, family rupture — triggers an off-cycle review entry the same week.',
    header: [patient, f('planDate', 'Plan date', 'date', { prefill: 'today' }), f('phaseAtWriting', 'Phase at writing', 'text', { prefill: 'phase' }), f('plannedDischarge', 'Planned discharge (approx.)', 'date')],
    sections: [
      { title: 'The plan', fields: [
        f('presenting', 'Presenting problems', 'notes'),
        f('goals', "Goals — in the patient's terms", 'notes'),
        f('modalities', 'Modalities', 'all', { options: ['CBT', 'Motivational interviewing', 'Relapse prevention', 'Group therapy', 'Drama therapy', 'Family work', 'Other'] }),
        f('focus', 'Individual session focus areas', 'notes'),
        f('familyInvolvement', 'Family involvement', 'one', { options: ['None', 'Updates only', 'Family sessions planned'] }),
        f('phase', 'Current phase', 'one', { options: ['1 Stabilization', '2 Core treatment', '3 Consolidation', '4 Discharge prep'] })
      ] },
      { title: 'Agreement', fields: [
        f('patientView', "Patient's view of the plan", 'notes', { hint: 'including any disagreement' }),
        f('patientSignature', 'Patient signature', 'signature'),
        f('directorSignature', 'Clinical Director signature', 'signature', { signer: ['ahmed'], later: true }),
        f('seenByAhmed', 'Seen by Ahmed', 'signature', { signer: ['ahmed'], later: true })
      ] },
      { title: 'Monthly reviews & phase changes', fields: [
        f('reviews', 'Monthly reviews & phase changes', 'table', { appendable: true, columns: [
          { id: 'date', label: 'Date', type: 'date' }, { id: 'moved', label: "What moved / what didn't", type: 'text' },
          { id: 'changes', label: 'Changes to the plan', type: 'text' }, { id: 'initials', label: 'Initials', type: 'text' }
        ] })
      ] }
    ]
  },
  {
    id: 'session', family: 'clinical', number: 3, title: 'Individual Session Note', owners: ['nabila', 'samar', 'ahmed'],
    purpose: 'One per session, filed within 24 hours. Three minutes to complete — brief is fine, absent is not.',
    rule: 'No secrecy promises. A disclosure of risk or relapse is contained in session, then escalated the same day — this note is where that trail starts.',
    header: [patient, f('date', 'Date', 'date', { prefill: 'appointmentDate' }), f('sessionNo', 'Session no.', 'number', { prefill: 'sessionNo' })],
    sections: [
      { title: '', fields: [
        f('attendance', 'Attendance', 'one', { options: ['Attended', 'Refused', 'Rescheduled'] }),
        f('themes', 'Themes worked', 'notes', { hint: '2–3 lines' }),
        f('riskFlags', 'Risk flags', 'all', { options: ['None', 'Self-harm', 'Absconding', 'Aggression', 'Relapse / craving'] }),
        f('escalatedTo', 'If flagged — escalated to, same day', 'text', { hint: 'Ahmed always; Fadia if medical', requiredWhen: flagged }),
        f('progress', 'Plan progress & action for next session', 'text'),
        f('therapistSignature', 'Therapist signature', 'signature')
      ] }
    ]
  },
  {
    id: 'group', family: 'clinical', number: 4, title: 'Group Session Note', owners: ['nabila', 'samar', 'ahmed', 'nazha'], multi: true,
    purpose: 'One per group, written the same day by the facilitator. Attendance is clinical data.',
    header: [f('date', 'Date', 'date', { prefill: 'appointmentDate' }), f('group', 'Group', 'text', { prefill: 'appointmentTitle' }), f('facilitator', 'Facilitator', 'text', { prefill: 'staffName' }), f('coFacilitator', 'Co-facilitator', 'text')],
    sections: [
      { title: '', fields: [
        f('groupType', 'Group type', 'one', { options: ['Therapy group', 'Psychoeducation', 'Drama therapy'], prefill: 'appointmentTitle' }),
        f('theme', 'Theme / focus', 'text')
      ] },
      { title: 'Attendance', fields: [
        f('attendance', 'Attendance', 'table', { prefill: 'groupRoster', columns: [
          { id: 'patient', label: 'Patient (first name + initial)', type: 'text', readonly: true }, { id: 'present', label: 'Present', type: 'check' },
          { id: 'observation', label: 'Engagement / observation', type: 'text' }
        ] })
      ] },
      { title: 'Close', fields: [
        f('dynamics', 'Group dynamics', 'notes'),
        f('observations', 'Individual observations for case review', 'notes'),
        f('escalations', 'Escalations', 'all', { options: ['None', 'Clinical Director', 'Ahmed', 'Fadia'] }),
        f('facilitatorSignature', 'Facilitator signature', 'signature')
      ] }
    ]
  },
  {
    id: 'review', family: 'clinical', number: 5, title: 'Case Review Record', owners: ['nabila', 'samar', 'ahmed'], multi: true,
    purpose: "One per weekly review — every patient touched, decisions owned. Nabila records; decisions that change treatment are copied into each patient's plan as a dated review entry.",
    rule: 'Standing flags forcing depth: any incident, relapse, refusal pattern, medication change, approaching discharge, or RSA-reported concern since last week.',
    header: [f('date', 'Date', 'date', { prefill: 'today' }), f('chairedBy', 'Chaired by', 'text', { prefill: 'Clinical Director' }), f('present', 'Present', 'text')],
    sections: [
      { title: 'Patients', fields: [
        f('patients', 'Patients', 'table', { prefill: 'caseloadRoster', columns: [
          { id: 'patient', label: 'Patient', type: 'text', readonly: true }, { id: 'phase', label: 'Phase', type: 'text' }, { id: 'status', label: 'Status (brief)', type: 'text' },
          { id: 'decisions', label: 'Decisions', type: 'text' }, { id: 'action', label: 'Action & owner', type: 'text' }
        ] })
      ] },
      { title: 'Sign-off', fields: [
        f('highRisk', 'High-risk list this week', 'text', { hint: "names carried to Ahmed's weekly report", prefill: 'highRiskList' }),
        f('directorSignature', 'Clinical Director signature', 'signature', { signer: ['ahmed'], later: true }),
        f('ahmedSignature', 'Ahmed signature', 'signature', { signer: ['ahmed'], later: true })
      ] }
    ]
  },
  {
    id: 'family', family: 'clinical', number: 6, title: 'Family Session Record', owners: ['nabila', 'samar', 'ahmed'],
    purpose: "Clinical family work only — Melyssa's administrative updates continue separately. Consent comes first, on this form, before the session.",
    header: [patient, f('date', 'Date', 'date', { prefill: 'today' }), f('ledBy', 'Led by', 'text', { prefill: 'staffName' })],
    sections: [
      { title: 'Consent — completed before the session', fields: [
        f('scope', 'Scope agreed with patient', 'notes', { hint: 'what may be shared; what stays private' }),
        f('patientConsent', 'Patient consent', 'signature', { hint: 'or Ahmed-documented exception below', optionalWhen: values => !!String(values.exception || '').trim() }),
        f('exception', "Exception (court-mandated etc.) — Ahmed's decision & basis", 'text')
      ] },
      { title: 'The session', gate: { when: values => !!values.patientConsent || !!String(values.exception || '').trim(), label: 'Unlocks once the patient consents or an exception is recorded above.' }, fields: [
        f('attending', 'Family members attending', 'text'),
        f('purpose', 'Purpose', 'one', { options: ['Psychoeducation', 'Relationship repair', 'Discharge alignment', 'Other'] }),
        f('workedOn', 'What was worked on', 'notes'),
        f('agreements', 'Agreements made', 'notes'),
        f('intoPlan', 'Anything entering the treatment plan', 'text'),
        f('signature', 'Signature', 'signature')
      ] }
    ]
  },
  {
    id: 'discharge', family: 'clinical', number: 7, title: 'Discharge & Aftercare Plan', owners: ['nabila', 'samar', 'ahmed'],
    purpose: 'Started at admission, completed and signed before departure. The patient leaves with their copy.',
    header: [patient, f('admissionDate', 'Admission date', 'date', { prefill: 'admittedAt' }), f('dischargeDate', 'Discharge date', 'date', { required: true })],
    sections: [
      { title: '', fields: [
        f('dischargeType', 'Discharge type', 'one', { options: ['Planned', 'Early (agreed)', 'Self-discharge'], required: true }),
        f('living', 'Living situation after discharge', 'notes'),
        f('structure', 'Work / study / daily structure', 'notes'),
        f('triggers', 'Triggers & relapse-prevention plan', 'notes'),
        f('support', 'Support network', 'notes'),
        f('continuing', 'Continuing therapy / groups outside', 'notes'),
        f('psychiatric', 'Psychiatric follow-up arrangement', 'text', { hint: 'coordinated with Fadia' })
      ] },
      { title: 'If things slip — the way back', fields: [
        f('contactFirst', 'Agreed with patient & family: at early warning signs or relapse, contact Cedar first', 'one', { options: ['Agreed & explained'] }),
        f('whoToCall', 'Who to call at Cedar & number', 'text'),
        f('readmission', 'Fast re-admission pathway explained', 'one', { options: ['Yes'] })
      ] },
      { title: 'Sign-off & follow-up schedule', fields: [
        f('followupDates', 'Follow-up due dates set', 'auto', { hint: '1 week / 1 month / 3 months', compute: 'followupDates' }),
        f('directorSignature', 'Clinical Director signature', 'signature', { signer: ['ahmed'], later: true }),
        f('ahmedSignature', 'Ahmed signature', 'signature', { signer: ['ahmed'], later: true }),
        f('patientCopy', 'Patient received their copy', 'signature')
      ] }
    ]
  },
  {
    id: 'aftercare', family: 'clinical', number: 8, title: 'Post-Discharge Follow-up Log', owners: ['melyssa', 'ahmed'], living: true,
    purpose: 'Calls are made by Admin (Melyssa) at 1 week, 1 month, and 3 months, and logged here. This is a wellbeing check, not a therapy call — anything concerning routes to the Clinical Director the same day.',
    header: [patient, f('dischargeDate', 'Discharge date', 'date', { prefill: 'dischargedAt' }), f('contactGiven', 'Cedar contact given', 'text')],
    sections: [
      { title: 'Contacts', fields: [
        f('contacts', 'Contacts', 'table', { prefill: 'followupRows', fixedRows: true, columns: [
          { id: 'contact', label: 'Contact', type: 'text', readonly: true }, { id: 'due', label: 'Due date', type: 'date', readonly: true },
          { id: 'madeBy', label: 'Made / by', type: 'text' }, { id: 'reached', label: 'Reached', type: 'one', options: ['Reached', 'No answer'] },
          { id: 'status', label: 'Status', type: 'one', options: ['Well', 'Struggling', 'Relapsed'] }, { id: 'notes', label: 'Notes / support offered', type: 'text' }
        ] })
      ] },
      { title: '', fields: [
        f('routed', 'Routed to Clinical Director', 'all', { options: ['Not needed', '1 week', '1 month', '3 months'] }),
        f('routingOutcome', 'Outcome of routing', 'text')
      ] }
    ]
  }
];
