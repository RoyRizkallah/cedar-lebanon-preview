// Nursing & Medical forms, field for field from Cedar_Rehab_Nursing_Forms.docx and
// Cedar_Rehab_Form_Admission_Medical_Assessment.docx (owner's reply, 11 Nov 2026).
// Per-patient forms sit on the patient's Medical tab; the ward logs (no patient) sit on the Medication page.
// Form 1 (MAR) is the medication round and Form 2 (Prescription Log) is the medication list: recorded there, not twice.
import { field as f, YES_NO } from './field.js';

const patient = f('patient', 'Patient', 'text', { prefill: 'clinicalName', readonly: true });
const one = (id, label, options, extra) => f(id, label, 'one', { options, ...extra });
const all = (id, label, options, extra) => f(id, label, 'all', { options, ...extra });
const NURSE = ['fadia'];
// The Head Nurse and the RSAs on shift (keys, the meds window, escorts).
const FLOOR = ['fadia', 'imad', 'omar', 'georgio', 'alaa', 'dania'];

export const NURSING_FORMS = [
  {
    id: 'admission-medical', family: 'medical', number: 'A', title: 'Admission Medical Assessment', owners: NURSE, sop: '2.4',
    purpose: 'Completed by the Head Nurse within 24 hours of arrival, sooner where withdrawal risk is apparent. It sets what Cedar is medically responsible for from day one.',
    header: [patient, f('admissionAt', 'Admission date', 'date', { prefill: 'admittedAt' }), f('assessedOn', 'Assessment date', 'date', { prefill: 'today', required: true }), f('assessedBy', 'Assessed by', 'text', { prefill: 'staffName' })],
    sections: [
      { title: '1 · Substance use: the medical picture', fields: [
        all('substances', 'Substances involved', ['Alcohol', 'Opioids', 'Stimulants', 'Cannabis', 'Benzodiazepines', 'Other']),
        f('pattern', 'Pattern of use (what, how much, how often)', 'notes'),
        f('lastUse', 'Last use: substance, amount, when (sets the withdrawal clock)', 'text', { required: true }),
        one('withdrawalComplications', 'Previous withdrawal complications', ['None known', 'Yes, detailed below']),
        f('withdrawalHistory', 'Withdrawal & detox history (seizures, DTs, prior detox attempts)', 'notes')
      ] },
      { title: '2 · Current medication', fields: [
        f('medications', 'Medication', 'table', { columns: [
          { id: 'medication', label: 'Medication', type: 'text' }, { id: 'dose', label: 'Dose', type: 'text' }, { id: 'frequency', label: 'Frequency', type: 'text' },
          { id: 'prescriber', label: 'Prescriber', type: 'text' }, { id: 'verified', label: 'Verified (SOP 2.2)', type: 'one', options: YES_NO }
        ] }),
        f('surrendered', 'Medication brought in & surrendered (everything, prescribed or not)', 'notes'),
        one('lockedStorage', 'Surrendered items into locked storage', ['Logged (SOP 2.3)', 'None brought']),
        all('regimenConfirmed', 'Regimen confirmed with', ['Patient', 'Family', 'Prescriber', 'Pharmacy records'])
      ] },
      { title: '3 · Medical history', fields: [
        one('allergies', 'Allergies', ['None known', 'Yes, listed'], { required: true }),
        f('allergyDetail', 'Allergy detail (substance and reaction)', 'text'),
        f('chronic', 'Chronic conditions', 'notes'),
        f('pastSurgery', 'Past surgery / hospitalizations', 'notes'),
        f('psychiatricHistory', 'Psychiatric history relevant to medication', 'notes')
      ] },
      { title: '4 · Baseline vitals', fields: [
        f('bloodPressure', 'Blood pressure (mmHg)', 'text'), f('pulse', 'Pulse (bpm)', 'number'), f('temperature', 'Temperature (°C)', 'number'),
        f('spo2', 'Oxygen saturation (SpO₂ %)', 'number'), f('weight', 'Weight (kg)', 'number')
      ] },
      { title: '5 · Physical observations', fields: [
        f('injuries', 'Visible injuries, wounds, concerns (with the patient’s account of each)', 'notes'),
        f('injuryPhoto', 'Photo of injury / area', 'photo')
      ] },
      { title: '6 · Withdrawal risk & the first 72 hours', fields: [
        one('withdrawalRisk', 'Withdrawal risk', ['Low', 'Medium', 'High'], { required: true, hint: 'Low = routine daily checks · Medium = the scheduled monitoring below · High = intensified monitoring plus same-day contact with the treating doctor' }),
        f('expectedCourse', 'Expected course for this patient', 'notes'),
        f('monitoring', 'Monitoring plan', 'table', { prefill: 'firstThreeDays', fixedRows: true, columns: [
          { id: 'period', label: 'Period', type: 'text', readonly: true }, { id: 'checks', label: 'Checks & frequency', type: 'text' },
          { id: 'watch', label: 'What to watch for', type: 'text' }, { id: 'initials', label: 'Completed (initials)', type: 'text' }
        ] }),
        f('triggers', 'Escalation triggers: call the Head Nurse immediately if', 'notes'),
        one('rsaBriefed', 'Monitoring instructions given to the RSA team in writing', ['Yes, attached / posted']),
        f('briefedWho', 'Given to whom, and when', 'text')
      ] },
      { title: '7 · Actions & sign-off', fields: [
        one('psychiatricConsult', 'Psychiatric consultation', ['Routine (monthly)', 'Needed sooner, Ahmed informed same day']),
        f('firstBoxDue', 'Medication schedule set: first weekly box due', 'date'),
        one('activityClearance', 'Physical-activity clearance (PT&F gate one)', ['Cleared, clearance form issued', 'Deferred', 'Not cleared']),
        one('informed', 'Assessment complete: Ahmed informed', ['Yes'], { required: true }),
        f('signedBy', 'Assessed by: Head Nurse', 'signature', { signer: NURSE })
      ] }
    ]
  },
  {
    id: 'access-log', family: 'medical', number: 3, title: 'Medication Access Log', owners: FLOOR, sop: '2.3', ward: true, living: true,
    purpose: 'Medication storage stays locked; keys are held by the Head Nurse and the RSA on shift only. Every access is signed: who, when, why.',
    header: [f('logOpened', 'Log opened', 'date', { prefill: 'today' })],
    sections: [{ title: '', fields: [
      f('entries', 'Access', 'table', { columns: [
        { id: 'date', label: 'Date', type: 'date' }, { id: 'time', label: 'Time', type: 'time' }, { id: 'who', label: 'Who', type: 'text' },
        { id: 'reason', label: 'Reason', type: 'text' }, { id: 'signature', label: 'Signature', type: 'text' }
      ] })
    ] }]
  },
  {
    id: 'box-prep', family: 'medical', number: 4, title: 'Weekly Box Preparation Sheet', owners: ['fadia', 'imad'], sop: '2.3', ward: true,
    purpose: 'The Head Nurse prepares each weekly box against the current prescription record; a second person checks every box independently. No box reaches the floor without both signatures.',
    header: [f('weekBeginning', 'Week beginning', 'date', { prefill: 'today', required: true }), f('preparedBy', 'Prepared by (Head Nurse)', 'text', { prefill: 'staffName' }), f('secondChecker', 'Second checker', 'text', { required: true }), f('preparedOn', 'Date prepared', 'date', { prefill: 'today' })],
    sections: [{ title: 'Boxes prepared & checked', fields: [
      f('boxes', 'Boxes', 'table', { prefill: 'residentRows', columns: [
        { id: 'patient', label: 'Patient', type: 'text', readonly: true }, { id: 'againstRecord', label: 'Against prescription record', type: 'one', options: YES_NO },
        { id: 'preparer', label: 'Preparer initials', type: 'text' }, { id: 'checker', label: 'Second check initials', type: 'text' }, { id: 'notes', label: 'Notes', type: 'text' }
      ] })
    ] }]
  },
  {
    id: 'weekly-count', family: 'medical', number: 5, title: 'Weekly Count Sheet', owners: NURSE, sop: '2.3', ward: true,
    purpose: 'At the end of each week the Head Nurse counts what remains against what should remain, from the MAR. Differences are investigated the same day, never carried forward.',
    header: [f('weekEnding', 'Week ending', 'date', { prefill: 'today', required: true }), f('countedBy', 'Counted by', 'text', { prefill: 'staffName' }), f('countedAt', 'Date & time', 'text'), f('witness', 'Witness (if controlled meds)', 'text')],
    sections: [
      { title: 'The count', fields: [
        f('counts', 'Counts', 'table', { columns: [
          { id: 'medication', label: 'Medication', type: 'text' }, { id: 'expected', label: 'Expected remaining', type: 'number' }, { id: 'counted', label: 'Counted', type: 'number' },
          { id: 'difference', label: 'Difference', type: 'number' }, { id: 'cause', label: 'Cause found / action taken', type: 'text' }
        ] })
      ] },
      { title: 'Close', fields: [
        one('resolved', 'All differences resolved', ['Yes, causes found', 'No, escalated'], { required: true }),
        one('controlled', 'Unexplained controlled-medication difference', ['None', 'Reported to Ahmed & Amer same day'], { required: true }),
        f('signedBy', 'Head Nurse signature', 'signature', { signer: NURSE })
      ] }
    ]
  },
  {
    id: 'disposal', family: 'medical', number: 6, title: 'Medication Disposal Record', owners: NURSE, sop: '2.3', ward: true, living: true,
    purpose: 'Expired or discontinued medication, and anything not returned at discharge, is disposed of with a second person present. Both sign, always.',
    header: [f('logOpened', 'Log opened', 'date', { prefill: 'today' })],
    sections: [{ title: '', fields: [
      f('entries', 'Disposals', 'table', { columns: [
        { id: 'date', label: 'Date', type: 'date' }, { id: 'medication', label: 'Medication & quantity', type: 'text' },
        { id: 'reason', label: 'Reason', type: 'one', options: ['Expired', 'Discontinued', 'Discharge, not returned'] },
        { id: 'disposedBy', label: 'Disposed by', type: 'text' }, { id: 'witness', label: 'Witness', type: 'text' }
      ] })
    ] }]
  },
  {
    id: 'psych-consult', family: 'medical', number: 7, title: 'Psychiatric Consultation Record', owners: NURSE, sop: '2.5',
    purpose: 'One per consultation. The written brief goes to the psychiatrist in advance; the written outcome comes back from the psychiatrist directly. Nothing is actioned on the patient’s account.',
    header: [patient, f('date', 'Date', 'date', { prefill: 'today', required: true }), f('psychiatrist', 'Psychiatrist', 'text', { required: true }), one('format', 'Format', ['Remote', 'In person'])],
    sections: [
      { title: 'Before', fields: [
        one('briefSent', 'Written brief sent in advance', ['Yes', 'No, consultation postponed'], { required: true }),
        all('briefCovered', 'Brief covered', ['Current medication', 'Adherence / refusals (MAR)', 'Medical observations', 'Incidents since last review', 'Clinical context (Clinical Director)', 'Specific question for the doctor']),
        f('settledBy', 'Patient settled by / room prepared', 'text')
      ] },
      { title: 'After', fields: [
        one('outcomeReceived', 'Written outcome received from psychiatrist', ['Yes', 'Chased, not yet received']),
        f('outcome', 'Outcome summary', 'notes'),
        one('medicationChanges', 'Medication changes', ['None', 'Yes, entered in the Prescription Log']),
        f('monitor', 'Cedar must monitor', 'text'),
        f('nextReview', 'Next review due', 'date'),
        one('planImpact', 'Ahmed informed of treatment-plan impact', ['Yes', 'N/A']),
        f('recordedBy', 'Recorded by (Head Nurse), within 24 hours', 'signature', { signer: NURSE })
      ] }
    ]
  },
  {
    id: 'escort', family: 'medical', number: 8, title: 'Off-Site Escort Log', owners: FLOOR, sop: '2.7',
    purpose: 'One per trip out. A patient leaving the facility is one of the highest-risk events in a residential program; this log is the control around it.',
    header: [patient, f('date', 'Date', 'date', { prefill: 'today', required: true }), f('destination', 'Destination & purpose', 'text', { required: true }), f('duration', 'Expected duration', 'text')],
    sections: [
      { title: 'Before departure', fields: [
        one('necessary', 'Clinically necessary, cannot be done remotely', ['Confirmed (Head Nurse)'], { required: true }),
        all('approvedBy', 'Approved by', ['Ahmed', 'Amer (required for high-risk)']),
        one('riskLevel', 'Patient risk level', ['Standard, one escort', 'High, two escorts'], { required: true }),
        f('escorts', 'Escort(s) assigned', 'text', { required: true }),
        all('briefed', 'Escort briefed', ['Destination & duration', 'Risk profile', 'If patient attempts to leave', 'If patient attempts to obtain substances']),
        one('coverage', 'Floor coverage confirmed before departure', ['Yes, house never left short']),
        f('departure', 'Departure time', 'time')
      ] },
      { title: 'On return', fields: [
        f('returnTime', 'Actual return time', 'time'),
        one('deviations', 'Unplanned stops or deviations', ['None', 'Yes, reported to Omar at the time']),
        one('search', 'Search on return', ['Done, per risk assessment', 'Not required']),
        f('observations', 'Observations (reported to Omar and the Clinical Director)', 'notes'),
        one('outcomeCollected', 'Written outcome / prescription collected by Head Nurse', ['Yes', 'N/A, not a medical appointment']),
        f('escortSignature', 'Escort signature', 'signature'),
        f('reviewedBy', 'Reviewed by (Omar)', 'signature', { signer: ['omar'], later: true })
      ] }
    ]
  }
];
