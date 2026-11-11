// Sample filed forms for the fictional patients, written the way staff would fill them in.
import { addDays, daysBetween } from './dates.js';
import { FOLLOWUP_OFFSETS, PROGRESS_METRICS } from './forms/engine.js';

export function seedForms(state, today) {
  let seq = 0;
  const sig = (by, name, date) => ({ by, name, at: new Date(`${date}T14:00:00`).toISOString() });
  const add = (formId, fields) => {
    const at = new Date(`${fields.date}T15:00:00`).toISOString();
    const entry = { id: `F-${String(++seq).padStart(4, '0')}`, formId, patientId: fields.patientId ?? null, createdBy: fields.by, createdAt: at, updatedAt: at, updatedBy: fields.by, status: fields.status || 'Filed', values: fields.values };
    if (entry.status === 'Filed') Object.assign(entry, { filedAt: at, filedBy: fields.by });
    if (fields.appointmentId) entry.appointmentId = fields.appointmentId;
    if (fields.patientIds) entry.patientIds = fields.patientIds;
    state.forms.push(entry);
    return entry;
  };
  const patients = state.patients;
  const admitted = patients.filter(patient => patient.status === 'Admitted');
  const risks = { 'P-0002': ['High', 'Medium', 'Low', 'Expressed hopelessness during withdrawal; on 15-minute checks for the first week. Ahmed informed same day.'], 'P-0003': ['Low', 'Low', 'Medium', 'Raised voice at staff twice on day one; settled after structure explained.'] };

  for (const patient of patients) {
    const stay = daysBetween(patient.admittedAt, patient.dischargedAt || today);
    if (stay >= 3) {
      const [selfHarm, abscond, aggression, notes] = risks[patient.id] || ['Low', 'Low', 'Low', ''];
      const date = addDays(patient.admittedAt, 2);
      add('intake', { patientId: patient.id, by: 'samar', date, values: {
        patient: patient.clinicalName, age: patient.age, admissionDate: patient.admittedAt, assessmentDate: date,
        substances: `${patient.program === 'Outpatient' ? 'Weekend' : 'Daily'} use; history recorded at assessment.`, previousTreatment: 'One previous attempt without structured aftercare.',
        mentalHealth: 'Low mood and poor sleep during heavy use.', familySocial: 'Lives with family; supportive sibling.', legal: 'Voluntary',
        stageOfChange: 'Preparation', motivation: '“I want my mornings back.”', riskSelfHarm: selfHarm, riskAbscond: abscond, riskAggression: aggression, riskNotes: notes,
        strengths: 'Employed before admission; engaged in first group.', crossChecked: 'Yes — pictures agree', impression: 'Build routine first; relapse prevention from week two.',
        conductedBy: sig('ahmed', 'Ahmed Khattab', date), countersigned: sig('ahmed', 'Ahmed Khattab', date)
      } });
    }
    if (stay >= 7) {
      const date = addDays(patient.admittedAt, 6);
      add('plan', { patientId: patient.id, by: 'samar', date, values: {
        patient: patient.clinicalName, planDate: date, phaseAtWriting: '1 Stabilization', plannedDischarge: addDays(patient.admittedAt, 60),
        presenting: 'Dependence with disrupted sleep and work.', goals: 'Sleep through the night; repair trust at home; return to work.',
        modalities: ['CBT', 'Relapse prevention', 'Group therapy'], focus: 'Triggers at home; evening cravings.', familyInvolvement: 'Updates only', phase: patient.phase,
        patientView: 'Agrees; wants more gym time.', patientSignature: sig('samar', patient.fullName, date), directorSignature: sig('ahmed', 'Ahmed Khattab', date),
        seenByAhmed: stay > 20 ? sig('ahmed', 'Ahmed', addDays(date, 1)) : undefined,
        reviews: stay > 35 ? [{ date: addDays(patient.admittedAt, 34), moved: 'Sleep improved; cravings less frequent.', changes: 'Moved to consolidation phase.', initials: 'CD' }] : []
      } });
    }
    if (patient.status === 'Admitted') {
      add('discharge', { patientId: patient.id, by: 'samar', date: patient.admittedAt, status: 'Draft', values: { patient: patient.clinicalName, admissionDate: patient.admittedAt } });
    } else {
      add('discharge', { patientId: patient.id, by: 'samar', date: patient.dischargedAt, values: {
        patient: patient.clinicalName, admissionDate: patient.admittedAt, dischargeDate: patient.dischargedAt, dischargeType: 'Planned',
        living: 'Returning to family home.', structure: 'Back to work part-time from week two.', triggers: 'Friday evenings; old contacts. Plan agreed.', support: 'Sibling, sponsor.',
        continuing: 'Weekly outpatient group.', psychiatric: 'Monthly review arranged with Fadia.', contactFirst: 'Agreed & explained', whoToCall: 'Melyssa, Cedar reception', readmission: 'Yes',
        followupDates: FOLLOWUP_OFFSETS.map(([, days]) => addDays(patient.dischargedAt, days)).join(' / '),
        directorSignature: sig('ahmed', 'Ahmed Khattab', patient.dischargedAt), ahmedSignature: sig('ahmed', 'Ahmed', patient.dischargedAt), patientCopy: sig('samar', patient.fullName, patient.dischargedAt)
      } });
      const outcome = { 'P-0011': ['Well', 'Well'], 'P-0012': ['Struggling'], 'P-0013': [] }[patient.id] || [];
      const rows = FOLLOWUP_OFFSETS.map(([contact, days], index) => {
        const due = addDays(patient.dischargedAt, days);
        const done = outcome[index];
        state.tasks.push({ id: `T-${String(state.tasks.length + 1).padStart(4, '0')}`, kind: 'followup-call', title: `${contact} follow-up call`, owner: 'melyssa', due, patientId: patient.id, link: `#/patients/${patient.id}/followup`, status: done ? 'done' : 'open', doneBy: done ? 'melyssa' : undefined, doneAt: done ? new Date(`${due}T11:00:00`).toISOString() : undefined });
        return { contact, due, madeBy: done ? `${due}, Melyssa` : '', reached: done ? 'Reached' : '', status: done || '', notes: done === 'Struggling' ? 'Low mood, missed two meetings. Routed same day.' : done ? 'Attending group; sleeping well.' : '' };
      });
      if (outcome.length) add('aftercare', { patientId: patient.id, by: 'melyssa', date: rows[outcome.length - 1].due, values: { patient: patient.clinicalName, dischargeDate: patient.dischargedAt, contactGiven: 'Melyssa, Cedar reception', contacts: rows, routed: outcome.includes('Struggling') ? ['1 week'] : ['Not needed'], routingOutcome: outcome.includes('Struggling') ? 'Clinical Director called back; outpatient session booked.' : '' } });
    }
  }

  // Session notes for completed individual sessions — all but one, so the overdue rule has something to show.
  const completed = state.appointments.filter(item => ['Psychologist session', 'Therapist session'].includes(item.service) && item.status === 'Completed' && item.patientId).sort((a, b) => a.date.localeCompare(b.date) || a.start.localeCompare(b.start));
  const missing = completed.filter(item => item.provider === 'nabila' && daysBetween(item.date, today) >= 2).at(-1);
  const counts = {};
  for (const item of completed) {
    if (item === missing) continue;
    const patient = patients.find(entry => entry.id === item.patientId);
    counts[patient.id] = (counts[patient.id] || 0) + 1;
    const by = item.provider;
    const flag = patient.id === 'P-0002' && counts[patient.id] === 1;
    const entry = add('session', { patientId: patient.id, by, date: item.date, appointmentId: item.id, values: {
      patient: patient.clinicalName, date: item.date, sessionNo: counts[patient.id], attendance: 'Attended', themes: flag ? 'Cravings at night; thoughts of leaving.' : 'Routine, sleep, triggers at home.',
      riskFlags: flag ? ['Absconding', 'Relapse / craving'] : ['None'], escalatedTo: flag ? 'Ahmed' : '', progress: 'Practise urge-surfing; review next session.', therapistSignature: sig(by, by === 'nabila' ? 'Nabila' : 'Clinical Director', item.date)
    } });
    item.noteFormId = entry.id;
  }

  // Group notes, fitness attendance logs and wellbeing check-ins.
  for (const item of state.appointments.filter(entry => entry.status === 'Completed' && entry.patientIds)) {
    const roster = item.patientIds.map(id => patients.find(entry => entry.id === id));
    if (item.service === 'Group') {
      item.noteFormId = add('group', { by: 'samar', date: item.date, appointmentId: item.id, patientIds: item.patientIds, values: {
        date: item.date, group: item.title, facilitator: 'Clinical Director', coFacilitator: 'Nabila', groupType: item.title, theme: 'Handling weekends',
        attendance: roster.map((patient, index) => ({ patientId: patient.id, patient: patient.clinicalName, present: index !== 3, observation: index === 3 ? 'Refused; stayed in room.' : 'Engaged.' })),
        dynamics: 'Supportive; two members led.', observations: 'Follow up refusal in case review.', escalations: ['None'], facilitatorSignature: sig('ahmed', 'Ahmed Khattab', item.date)
      } }).id;
    } else {
      item.noteFormId = add('attendance', { by: 'john', date: item.date, appointmentId: item.id, patientIds: item.patientIds, values: {
        date: item.date, instructor: 'John', time: item.start, activity: 'Gym', location: 'On-site',
        patients: roster.map((patient, index) => ({ patientId: patient.id, patient: patient.fullName, attended: (index + daysBetween(item.date, today)) % 5 === 0 ? 'Absent' : 'Attended', observations: index === 1 ? 'Knee discomfort on squats.' : '', alarming: false })),
        reportedToJohn: 'Yes', escalatedTo: ['None'], instructorSignature: sig('john', 'John', item.date)
      } }).id;
    }
  }
  const inpatients = admitted.filter(patient => patient.program !== 'Outpatient');
  inpatients.forEach((patient, index) => {
    const stay = daysBetween(patient.admittedAt, today);
    if (stay < 3) {
      add('clearance', { patientId: patient.id, by: 'fadia', date: addDays(patient.admittedAt, 1), status: 'Draft', values: { patient: patient.fullName, patientId: patient.id, room: patient.roomId, date: addDays(patient.admittedAt, 1), medicallyCleared: 'Yes', limits: ['Hydration caution'], clearanceNotes: 'Cleared for low intensity during withdrawal week.', clearedBy: sig('fadia', 'Fadia', addDays(patient.admittedAt, 1)), clearanceDate: addDays(patient.admittedAt, 1), medicalReviewDate: addDays(patient.admittedAt, 14) } });
      return;
    }
    const weight = 68 + index * 4, height = 168 + (index % 4) * 5;
    add('clearance', { patientId: patient.id, by: 'john', date: addDays(patient.admittedAt, 2), values: {
      patient: patient.fullName, patientId: patient.id, room: patient.roomId, date: addDays(patient.admittedAt, 2), medicallyCleared: 'Yes', limits: index === 1 ? ['No contact (MMA/boxing)'] : [],
      clearanceNotes: 'No acute concerns.', clearedBy: sig('fadia', 'Fadia', addDays(patient.admittedAt, 1)), clearanceDate: addDays(patient.admittedAt, 1), medicalReviewDate: addDays(patient.admittedAt, 30),
      weight, height, bmi: Math.round((weight / (height / 100) ** 2) * 10) / 10, restingHr: 64 + index * 3, measurements: `Waist ${80 + index * 3} cm`, postureFindings: 'Rounded shoulders.', postureRating: 3,
      mobility: 'Tight hamstrings.', injuryHistory: index === 2 ? 'Old left knee strain.' : 'None reported.', gut: 'Normal', fitnessLevel: index % 2 ? 'Beginner' : 'Moderate', strength: '10 push-ups', endurance: '12 min brisk walk',
      gym: 'Moderate', tennis: index % 2 ? 'Not cleared' : 'Low', mma: index === 1 ? 'Not cleared' : 'Low', yoga: 'Moderate', physio: index === 2 ? 'Twice weekly' : '', targetSessions: 4, planNotes: 'Build gradually.',
      assessedBy: sig('john', 'John', addDays(patient.admittedAt, 2)), sentToAdmin: 'Yes'
    } });
    for (const week of [14, 7]) {
      if (stay < week) continue;
      const date = addDays(today, -week + 1);
      add('wellbeing', { patientId: patient.id, by: 'john', date, values: { patient: patient.fullName, weekEnding: date, energy: 3 + (index + week) % 3, sleep: 2 + (index % 3), mood: 3 + (week === 7 ? 1 : 0), activityFeel: 4, teamNote: '', completedBy: sig('john', patient.fullName, date) } });
    }
    add('progress', { patientId: patient.id, by: 'john', date: addDays(patient.admittedAt, 2), values: { patient: patient.fullName, admissionDate: patient.admittedAt, assignedBy: 'John',
      metrics: PROGRESS_METRICS.map(metric => ({ metric, baseline: metric === 'Weight (kg)' ? String(weight) : metric === 'Strength benchmark' ? '10 push-ups' : metric === 'Posture rating' ? '3' : '', m1: stay > 30 && metric === 'Weight (kg)' ? String(weight + 2) : '', m2: '', m3: '' })),
      baselineNotes: 'Baseline taken at clearance.', latestNotes: '' } });
  });
  const hurt = inpatients[2];
  add('injury', { patientId: hurt.id, by: 'john', date: addDays(today, -5), values: { patient: hurt.fullName, date: addDays(today, -5), time: '08:40', location: 'Gym', instructor: 'John', activity: 'Gym', bodyPart: 'Left knee', description: 'Felt a twinge on the third set of squats.', severity: 'Minor', sessionStopped: 'Yes', immediateAction: 'Ice, rest, stopped lower-body work.', johnAssessment: 'Mild strain; no swelling.', rehabPlan: 'Two physio sessions, then reassess.', escalatedFadia: 'No', emergency: 'No', hospital: 'No', familyInformed: 'No', planAdjusted: 'Yes', reclearance: 'No', recordedBy: sig('john', 'John', addDays(today, -5)) } });
}
