// Physical Therapy & Fitness forms, field for field from Cedar_Rehab_Fitness_Forms.docx.
import { field as f, LEVELS, YES_NO, ACTIVITIES } from './field.js';

const patient = f('patient', 'Patient name', 'text', { prefill: 'fullName', readonly: true });
const cleared = { when: values => values.medicallyCleared === 'Yes', label: 'Gate two below is not started until the answer above is “Yes.”' };
const yesNo = (id, label, extra) => f(id, label, 'one', { options: YES_NO, ...extra });
const scale = (id, label) => f(id, label, 'scale5');

export const FITNESS_FORMS = [
  {
    id: 'clearance', family: 'fitness', number: 1, title: 'Physical Assessment & Activity Clearance', owners: ['fadia', 'john'],
    purpose: "The two-gate form. Gate one is Fadia's medical clearance; gate two is John's assessment and activity plan. On a tablet, gate two stays locked until gate one is marked cleared.",
    header: [patient, f('patientId', 'Patient ID', 'text', { prefill: 'patientId', readonly: true }), f('room', 'Room', 'text', { prefill: 'roomId' }), f('date', 'Date', 'date', { prefill: 'today' })],
    sections: [
      { title: 'Gate one — Medical clearance', by: 'Nurse: Fadia', editors: ['fadia'], fields: [
        yesNo('medicallyCleared', 'Medically cleared for physical activity?', { required: true }),
        f('limits', 'Limits / restrictions', 'all', { options: ['No high-intensity', 'No contact (MMA/boxing)', 'Hydration caution', 'Cardiac caution', 'Mobility / joint limit', 'Other'] }),
        f('clearanceNotes', 'Clearance notes', 'notes'),
        f('clearedBy', 'Cleared by (Fadia)', 'signature', { signer: ['fadia'] }),
        f('clearanceDate', 'Clearance date', 'date', { prefill: 'today' }),
        f('medicalReviewDate', 'Medical review date', 'date')
      ] },
      { title: 'Gate two — Physical assessment & plan', by: 'John', editors: ['john'], gate: cleared, fields: [
        f('weight', 'Weight', 'number', { unit: 'kg' }),
        f('height', 'Height', 'number', { unit: 'cm' }),
        f('bmi', 'BMI', 'auto', { compute: 'bmi', hint: 'calculated automatically' }),
        f('restingHr', 'Resting heart rate', 'number', { unit: 'bpm' }),
        f('measurements', 'Key measurements', 'text', { hint: 'waist / other' }),
        f('postureFindings', 'Posture findings', 'notes'),
        scale('postureRating', 'Posture rating'),
        f('mobility', 'Mobility findings', 'notes'),
        f('injuryHistory', 'Injury history', 'notes'),
        f('gut', 'Gut Status', 'text'),
        f('fitnessLevel', 'Current fitness level', 'one', { options: ['Beginner', 'Moderate', 'Advanced'] }),
        f('strength', 'Strength benchmark (baseline)', 'text'),
        f('endurance', 'Endurance benchmark (baseline)', 'text')
      ] },
      { title: 'Activity plan', by: "John — within Fadia's clearance", editors: ['john'], gate: cleared, fields: [
        f('gym', 'Gym / personal training', 'one', { options: LEVELS }),
        f('tennis', 'Tennis (off-site)', 'one', { options: LEVELS }),
        f('mma', 'MMA / boxing', 'one', { options: LEVELS }),
        f('yoga', 'Movement / yoga', 'one', { options: LEVELS }),
        f('physio', 'Physiotherapy', 'text', { hint: 'frequency' }),
        f('targetSessions', 'Target sessions per week', 'number'),
        f('planNotes', 'Plan notes', 'notes'),
        f('assessedBy', 'Assessed by (John)', 'signature', { signer: ['john'] }),
        f('sentToAdmin', 'Plan sent to Admin for scheduling', 'one', { options: ['Yes'] })
      ] }
    ]
  },
  {
    id: 'attendance', family: 'fitness', number: 2, title: 'Session Attendance & Observation Log', owners: ['john', 'zeina', 'tony-j', 'tony-am', 'raymond'], multi: true,
    purpose: 'One per session. The instructor records who attended and any observations, then it goes to John. Alarming behaviour is also escalated immediately.',
    header: [f('date', 'Date', 'date', { prefill: 'appointmentDate' }), f('instructor', 'Instructor', 'text', { prefill: 'staffName' }), f('time', 'Time', 'time', { prefill: 'appointmentStart' })],
    sections: [
      { title: '', fields: [
        f('activity', 'Activity', 'one', { options: ACTIVITIES, prefill: 'appointmentActivity' }),
        f('location', 'Location', 'one', { options: ['On-site', 'Off-site (tennis)'] })
      ] },
      { title: 'Patients this session', fields: [
        f('patients', 'Patients this session', 'table', { prefill: 'fitnessRoster', columns: [
          { id: 'patient', label: 'Patient', type: 'text', readonly: true }, { id: 'attended', label: 'Attended / Absent / Held', type: 'one', options: ['Attended', 'Absent', 'Held'] },
          { id: 'observations', label: 'Observations (pain, fatigue, injury, capability)', type: 'text' }, { id: 'alarming', label: 'Alarming? (flag)', type: 'check' }
        ] })
      ] },
      { title: 'Close', fields: [
        f('reportedToJohn', 'Reported to John', 'one', { options: ['Yes'] }),
        f('escalatedTo', 'Escalated to', 'all', { options: ['Fadia', 'Ahmed', 'Admin', 'None'] }),
        f('instructorSignature', 'Instructor signature', 'signature')
      ] }
    ]
  },
  {
    id: 'injury', family: 'fitness', number: 3, title: 'Injury Report', owners: ['john', 'fadia'],
    purpose: "Completed the same day for any injury during activity. Minor injuries are John's; anything involving medical safety escalates to Fadia and, if needed, the emergency procedure.",
    header: [patient, f('date', 'Date', 'date', { prefill: 'today' }), f('time', 'Time', 'time'), f('location', 'Location', 'text'), f('instructor', 'Instructor present', 'text')],
    sections: [
      { title: 'What happened', fields: [
        f('activity', 'Activity during injury', 'one', { options: ACTIVITIES }),
        f('bodyPart', 'Body part / area', 'text'),
        f('description', 'Description & how it happened', 'notes'),
        f('photo', 'Photo of injury / area', 'photo'),
        f('severity', 'Severity', 'one', { options: ['Minor', 'Significant'], required: true }),
        yesNo('sessionStopped', 'Session stopped for the patient?'),
        f('immediateAction', 'Immediate action taken', 'notes')
      ] },
      { title: 'Assessment & escalation', fields: [
        f('johnAssessment', "John's assessment", 'notes'),
        f('rehabPlan', 'Treatment / rehab plan', 'notes'),
        yesNo('escalatedFadia', 'Escalated to Fadia?'),
        yesNo('emergency', 'Emergency procedure activated?'),
        yesNo('hospital', 'Ambulance / hospital?'),
        yesNo('familyInformed', 'Family informed?'),
        yesNo('planAdjusted', 'Activity plan adjusted?'),
        yesNo('reclearance', 'Re-clearance required?'),
        f('recordedBy', 'Recorded by', 'signature'),
        f('reviewedBy', 'Reviewed by (John / Fadia)', 'signature', { signer: ['john', 'fadia'], later: true })
      ] }
    ]
  },
  {
    id: 'wellbeing', family: 'fitness', number: 4, title: 'Weekly Wellbeing Check-in', owners: ['john', 'resident'],
    purpose: 'A short self-rating the patient completes each week — the subjective side of physical progress. Quick to tap through on a tablet.',
    rule: "Averages feed into the patient's Progress Record automatically.",
    header: [patient, f('weekEnding', 'Week ending', 'date', { prefill: 'today' })],
    sections: [
      { title: '', fields: [
        scale('energy', 'Energy this week'),
        scale('sleep', 'Sleep quality'),
        scale('mood', 'Mood'),
        scale('activityFeel', 'How activity is feeling for me'),
        f('teamNote', 'Anything I want the team to know', 'notes'),
        f('completedBy', 'Completed by patient', 'signature')
      ] }
    ]
  },
  {
    id: 'progress', family: 'fitness', number: 5, title: 'Progress Record', owners: ['john'], living: true,
    purpose: 'One per patient, owned by John. Baseline and each monthly re-measurement sit side by side so change is visible at a glance. Attendance and wellbeing pull in automatically from the other forms.',
    rule: "The department's monthly summary — attendance and progress across all patients — is produced from these records for the management review.",
    header: [patient, f('admissionDate', 'Admission date', 'date', { prefill: 'admittedAt' }), f('assignedBy', 'Assigned by (John)', 'text', { prefill: 'John' })],
    sections: [
      { title: 'Metrics over the stay', fields: [
        f('metrics', 'Metrics over the stay', 'table', { prefill: 'progressRows', fixedRows: true, columns: [
          { id: 'metric', label: 'Metric', type: 'text', readonly: true }, { id: 'baseline', label: 'Baseline', type: 'text' },
          { id: 'm1', label: 'Month 1', type: 'text' }, { id: 'm2', label: 'Month 2', type: 'text' }, { id: 'm3', label: 'Month 3', type: 'text' }
        ] }),
        f('baselineNotes', 'Notes — baseline', 'notes'),
        f('latestNotes', 'Notes — latest month', 'notes')
      ] }
    ]
  },
  {
    id: 'nutrition', family: 'fitness', number: 6, title: 'Nutrition Assessment', owners: ['john', 'fadia'],
    purpose: 'Completed by the nutritionist once the role is filled. Medical dietary needs come from Fadia; the resulting requirements go to the kitchen through the operations process.',
    header: [patient, f('date', 'Date', 'date', { prefill: 'today' }), f('nutritionist', 'Nutritionist', 'text')],
    sections: [
      { title: 'Assessment', fields: [
        f('weight', 'Weight', 'number', { unit: 'kg' }),
        f('height', 'Height', 'number', { unit: 'cm' }),
        f('bmi', 'BMI', 'auto', { compute: 'bmi', hint: 'calculated automatically' }),
        f('dietaryHistory', 'Dietary history & habits', 'notes'),
        f('medicalNeeds', 'Medical dietary needs (from Fadia)', 'notes'),
        f('allergies', 'Allergies / intolerances', 'all', { options: ['None', 'Nuts', 'Dairy', 'Gluten', 'Shellfish', 'Other'] })
      ] },
      { title: 'Plan', fields: [
        f('goals', 'Nutritional goals', 'notes'),
        f('dietaryPlan', 'Dietary plan', 'notes'),
        f('kitchen', 'Kitchen requirements (to Shady)', 'notes'),
        f('sentToKitchen', 'Requirements sent to kitchen', 'one', { options: ['Yes'] }),
        f('followUp', 'Follow-up interval', 'one', { options: ['2 weeks', 'Monthly', 'As needed'] }),
        f('nutritionistSignature', 'Nutritionist signature', 'signature')
      ] }
    ]
  }
];
