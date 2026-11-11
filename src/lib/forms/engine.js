// Draws no UI: prefill, computed fields, gates, validation, filing and the rules written under each form.
import { CLINICAL_FORMS } from './clinical.js';
import { FITNESS_FORMS } from './fitness.js';
import { NURSING_FORMS } from './nursing.js';
import { addDays, fmtDate, todayISO } from '../dates.js';
import { nextId } from '../ids.js';
import { staffName, isResident, RESIDENTS, canSeeTab } from '../people.js';
import { notify } from '../notifications.js';
import { log } from '../activity.js';

export const FORMS = [...CLINICAL_FORMS, ...FITNESS_FORMS, ...NURSING_FORMS];
export const formById = id => FORMS.find(form => form.id === id);
export const allFields = form => [...form.header, ...form.sections.flatMap(section => section.fields)];
const fieldOf = (form, id) => allFields(form).find(field => field.id === id);
const patientOf = (state, id) => state.patients.find(patient => patient.id === id);
const nameList = ids => ids.map(staffName).join(' or ');

export const FOLLOWUP_OFFSETS = [['1 week', 7], ['1 month', 30], ['3 months', 90]];
export const PROGRESS_METRICS = ['Weight (kg)', 'Key measurements', 'BMI', 'Strength benchmark', 'Endurance benchmark', 'Posture rating', 'Attendance %', 'Wellbeing avg', 'Nutrition (trend)', 'Injuries / holds'];

const COMPUTE = {
  bmi: values => {
    const weight = Number(values.weight), height = Number(values.height);
    return weight > 0 && height > 0 ? Math.round((weight / (height / 100) ** 2) * 10) / 10 : '';
  },
  followupDates: values => values.dischargeDate ? FOLLOWUP_OFFSETS.map(([, days]) => fmtDate(addDays(values.dischargeDate, days), { day: 'numeric', month: 'short', year: 'numeric' })).join(' / ') : ''
};

export function computeAuto(form, values) {
  const out = { ...values };
  for (const field of allFields(form)) if (field.type === 'auto') out[field.id] = COMPUTE[field.compute]?.(out) ?? '';
  return out;
}

export const isSectionLocked = (section, values) => !!section.gate && !section.gate.when(values || {});

export function isEmpty(field, value) {
  if (field.type === 'signature') return !value?.at;
  if (Array.isArray(value)) return value.length === 0;
  return value === undefined || value === null || String(value).trim() === '';
}

export function isRequired(field, values) {
  if (field.required || field.requiredWhen?.(values)) return true;
  return field.type === 'signature' && !field.later && !field.optionalWhen?.(values);
}

// A draft saves with anything missing. Filing needs every required field in the unlocked sections.
export function validateForm(form, values = {}, { final = false } = {}) {
  if (!final) return [];
  const errors = [];
  const check = field => { if (isRequired(field, values) && isEmpty(field, values[field.id])) errors.push(`${field.label} is required.`); };
  form.header.forEach(check);
  for (const section of form.sections) if (!isSectionLocked(section, values)) section.fields.forEach(check);
  for (const field of allFields(form)) {
    const value = values[field.id];
    if (field.type === 'signature' && field.signer && value?.by && !field.signer.includes(value.by)) errors.push(`Only ${nameList(field.signer)} can sign ${field.label}.`);
  }
  return errors;
}

export function prefillValues(form, { state, patient, appointment, staffId, now = new Date() }) {
  const roster = ids => (ids || []).map(id => patientOf(state, id)).filter(Boolean);
  const sources = {
    clinicalName: () => patient?.clinicalName, fullName: () => patient?.fullName, patientId: () => patient?.id, age: () => patient?.age,
    admittedAt: () => patient?.admittedAt, dischargedAt: () => patient?.dischargedAt, phase: () => patient?.phase, roomId: () => patient?.roomId,
    today: () => todayISO(now), staffName: () => staffName(staffId),
    appointmentDate: () => appointment?.date || todayISO(now), appointmentStart: () => appointment?.start, appointmentTitle: () => appointment?.title,
    appointmentActivity: () => appointment?.title === 'Gym' ? 'Gym' : appointment?.service === 'Physiotherapy' ? 'Physio' : appointment?.title,
    sessionNo: () => state.forms.filter(entry => entry.formId === 'session' && entry.patientId === patient?.id && entry.status === 'Filed').length + 1,
    groupRoster: () => roster(appointment?.patientIds).map(item => ({ patientId: item.id, patient: item.clinicalName, present: true, observation: '' })),
    fitnessRoster: () => roster(appointment?.patientIds || (appointment?.patientId ? [appointment.patientId] : [])).map(item => ({ patientId: item.id, patient: item.fullName, attended: 'Attended', observations: '', alarming: false })),
    caseloadRoster: () => state.patients.filter(item => item.status === 'Admitted').map(item => ({ patientId: item.id, patient: item.clinicalName, phase: item.phase, status: '', decisions: '', action: '' })),
    highRiskList: () => state.patients.filter(item => item.status === 'Admitted' && ['Medium', 'High'].includes(riskLevel(state, item.id))).map(item => item.clinicalName).join(', '),
    followupRows: () => FOLLOWUP_OFFSETS.map(([contact, days]) => ({ contact, due: patient?.dischargedAt ? addDays(patient.dischargedAt, days) : '', madeBy: '', reached: '', status: '', notes: '' })),
    progressRows: () => PROGRESS_METRICS.map(metric => ({ metric, baseline: '', m1: '', m2: '', m3: '' })),
    firstThreeDays: () => ['Day 1 (0–24 h)', 'Day 2 (24–48 h)', 'Day 3 (48–72 h)'].map(period => ({ period, checks: '', watch: '', initials: '' })),
    residentRows: () => state.patients.filter(item => item.status === 'Admitted').map(item => ({ patientId: item.id, patient: item.fullName, againstRecord: '', preparer: '', checker: '', notes: '' }))
  };
  const values = {};
  for (const field of allFields(form)) {
    if (!field.prefill) continue;
    const value = sources[field.prefill] ? sources[field.prefill]() : field.prefill;
    if (field.type === 'one' && !field.options.includes(value)) continue;
    if (value !== undefined && value !== null && value !== '') values[field.id] = value;
  }
  return computeAuto(form, values);
}

const RISK_ORDER = ['Low', 'Medium', 'High'];
const maxRisk = values => ['riskSelfHarm', 'riskAbscond', 'riskAggression'].map(id => values[id]).filter(Boolean).sort((a, b) => RISK_ORDER.indexOf(b) - RISK_ORDER.indexOf(a))[0] || null;

// The intake rating carries until a later reviewed-down (or up) entry replaces it.
export function riskLevel(state, patientId) {
  const intake = state.forms.filter(entry => entry.formId === 'intake' && entry.patientId === patientId && entry.status === 'Filed').sort((a, b) => String(b.filedAt).localeCompare(String(a.filedAt)))[0];
  const review = (patientOf(state, patientId)?.riskReviews || []).at(-1);
  if (review && (!intake || review.at > intake.filedAt)) return review.level;
  return intake ? maxRisk(intake.values) : null;
}

// On watch: a resident rated Medium or High. The floor sees this flag; only the clinical team sees the rating.
export const onWatch = (state, patientId) => ['Medium', 'High'].includes(riskLevel(state, patientId));

export function reviewRisk(state, patientId, level, note, staffId) {
  if (!RISK_ORDER.includes(level)) throw new Error('Choose Low, Medium or High.');
  if (!String(note || '').trim()) throw new Error('Add the basis for this review.');
  const patient = patientOf(state, patientId);
  (patient.riskReviews ||= []).push({ level, note: note.trim(), by: staffId, at: new Date().toISOString() });
  if (level !== 'Low') notify(state, { to: 'ahmed', title: `Risk reviewed to ${level} for ${patient.clinicalName}`, body: note.trim(), link: `#/patients/${patientId}/clinical` });
  log(state, staffId, `Risk reviewed to ${level} for ${patient.clinicalName}`, `#/patients/${patientId}/clinical`);
}

// What each form sets in motion when it is filed (or, for living logs, saved).
const EFFECTS = {
  intake(state, entry) {
    const level = maxRisk(entry.values);
    if (['Medium', 'High'].includes(level)) {
      const patient = patientOf(state, entry.patientId);
      notify(state, { to: 'ahmed', title: `${level} risk at intake: ${patient.clinicalName}`, body: entry.values.riskNotes, link: `#/patients/${patient.id}/clinical` });
    }
  },
  plan(state, entry) {
    const patient = patientOf(state, entry.patientId);
    if (entry.values.phase && patient) patient.phase = entry.values.phase;
  },
  session(state, entry) {
    const flags = (entry.values.riskFlags || []).filter(flag => flag !== 'None');
    if (!flags.length) return;
    const patient = patientOf(state, entry.patientId);
    const to = ['ahmed', /fadia/i.test(entry.values.escalatedTo || '') ? 'fadia' : null];
    notify(state, { to, title: `Session risk flag: ${patient.clinicalName}`, body: flags.join(', '), link: `#/patients/${patient.id}/clinical` });
  },
  group(state, entry) {
    const map = { 'Clinical Director': 'ahmed', Ahmed: 'ahmed', Fadia: 'fadia' };
    const to = (entry.values.escalations || []).map(name => map[name]).filter(Boolean);
    if (to.length) notify(state, { to, title: `Group escalation: ${entry.values.group || 'group session'}`, body: entry.values.observations, link: '#/schedule' });
  },
  // The plan sets the day. The discharge itself happens on that day, from the patient file (discharge.js).
  discharge(state, entry) {
    const patient = patientOf(state, entry.patientId);
    notify(state, { to: 'melyssa', title: `Discharge planned: ${patient.clinicalName}`, body: `${entry.values.dischargeType || 'Planned'}, ${fmtDate(entry.values.dischargeDate, { day: 'numeric', month: 'short' })}`, link: `#/patients/${patient.id}` });
  },
  aftercare(state, entry, staffId, previous) {
    // A call logged as made (reached or not) closes that call's task, so the log and the to-do list agree.
    for (const row of entry.values.contacts || []) {
      if (!row.reached || (previous?.contacts || []).some(old => old.contact === row.contact && old.reached)) continue;
      const task = state.tasks.find(item => item.patientId === entry.patientId && item.kind === 'followup-call' && item.status === 'open' && item.title.startsWith(`${row.contact} `));
      if (task) Object.assign(task, { status: 'done', doneBy: staffId, doneAt: new Date().toISOString(), note: [row.reached, row.status].filter(Boolean).join(', ') });
    }
    const added = (entry.values.routed || []).filter(item => item !== 'Not needed' && !(previous?.routed || []).includes(item));
    if (added.length) {
      const patient = patientOf(state, entry.patientId);
      notify(state, { to: 'ahmed', title: `Follow-up concern routed: ${patient.clinicalName}`, body: `${added.join(', ')} call`, link: `#/patients/${patient.id}/followup` });
    }
  },
  wellbeing(state, entry, staffId) {
    if (!isResident(staffId)) return;
    const patient = patientOf(state, entry.patientId);
    notify(state, { to: patient.assigned?.fitness || 'john', title: `Wellbeing check-in from ${patient.fullName}`, body: entry.values.teamNote || 'Filled in by the resident.', link: `#/patients/${patient.id}/fitness` });
  },
  clearance(state, entry, staffId, previous) {
    if (entry.values.sentToAdmin === 'Yes' && previous?.sentToAdmin !== 'Yes') {
      const patient = patientOf(state, entry.patientId);
      notify(state, { to: 'melyssa', title: `Activity plan ready to schedule: ${patient.fullName}`, body: `${entry.values.targetSessions || '—'} sessions per week`, link: `#/patients/${patient.id}/fitness` });
    }
  },
  attendance(state, entry, staffId) {
    const alarming = (entry.values.patients || []).filter(row => row.alarming);
    const map = { Fadia: 'fadia', Ahmed: 'ahmed', Admin: 'melyssa' };
    const to = [...(alarming.length && staffId !== 'john' ? ['john'] : []), ...(entry.values.escalatedTo || []).map(name => map[name]).filter(Boolean)];
    if (to.length) notify(state, { to, title: `Fitness session escalation (${entry.values.activity || 'session'})`, body: alarming.map(row => `${row.patient}: ${row.observations || 'flagged'}`).join('; '), link: '#/schedule' });
  },
  injury(state, entry) {
    if (entry.values.severity === 'Significant' || entry.values.escalatedFadia === 'Yes') {
      const patient = patientOf(state, entry.patientId);
      notify(state, { to: 'fadia', title: `Injury report: ${patient.fullName}`, body: `${entry.values.severity || ''} ${entry.values.bodyPart || ''}`.trim(), link: `#/patients/${patient.id}/fitness`, urgent: entry.values.emergency === 'Yes' });
    }
  },
  'admission-medical'(state, entry) {
    const patient = patientOf(state, entry.patientId);
    const risk = entry.values.withdrawalRisk;
    notify(state, { to: 'ahmed', title: risk === 'High' ? `High withdrawal risk: ${patient.clinicalName}` : `Admission medical assessment done: ${patient.clinicalName}`, body: [risk && `${risk} withdrawal risk`, entry.values.psychiatricConsult].filter(Boolean).join('. '), link: `#/patients/${patient.id}/medical`, urgent: risk === 'High' });
  },
  'psych-consult'(state, entry) {
    if (entry.values.planImpact !== 'Yes') return;
    const patient = patientOf(state, entry.patientId);
    notify(state, { to: 'ahmed', title: `Psychiatric consultation: ${patient.clinicalName}`, body: entry.values.outcome || 'The outcome affects the treatment plan.', link: `#/patients/${patient.id}/medical` });
  },
  escort(state, entry, staffId) {
    const patient = patientOf(state, entry.patientId);
    if (staffId !== 'omar') notify(state, { to: 'omar', title: `Escort log to review: ${patient.clinicalName}`, body: entry.values.destination, link: `#/patients/${patient.id}/medical` });
  },
  'weekly-count'(state, entry) {
    if (entry.values.controlled === 'None' && entry.values.resolved !== 'No, escalated') return;
    notify(state, { to: entry.values.controlled === 'None' ? 'ahmed' : ['ahmed', 'amer'], title: 'Medication count difference', body: `Week ending ${fmtDate(entry.values.weekEnding, { day: 'numeric', month: 'short' })}`, link: '#/medication/logs', urgent: entry.values.controlled !== 'None' });
  },
  nutrition(state, entry, staffId, previous) {
    if (entry.values.sentToKitchen === 'Yes' && previous?.sentToKitchen !== 'Yes') log(state, staffId, 'Nutrition requirements sent to Shady (kitchen)', `#/patients/${entry.patientId}/fitness`);
  }
};

// A note written from the patient file belongs to that day's completed session without a note.
function unnotedSession(state, patientId, date, staffId) {
  const candidates = state.appointments.filter(item => item.patientId === patientId && item.date === date && item.status === 'Completed' && !item.noteFormId && ['Psychologist session', 'Therapist session'].includes(item.service));
  return candidates.find(item => item.provider === staffId) || candidates[0] || null;
}

// Staff named on the form complete it; a form open to residents is completed by the resident it is about.
const completes = (form, staffId, patientId) => form.owners.includes(staffId) || (form.owners.includes('resident') && isResident(staffId) && RESIDENTS.find(person => person.id === staffId)?.patientId === patientId);

export function fileForm(state, { entryId, formId, patientId = null, patientIds, appointmentId, values, staffId, final = false }) {
  const form = formById(formId);
  if (!form) throw new Error('Unknown form.');
  if (!completes(form, staffId, patientId)) throw new Error(`${form.title} is completed by ${nameList(form.owners)}.`);
  let entry = entryId ? state.forms.find(item => item.id === entryId) : null;
  if (entryId && !entry) throw new Error('This form was not found.');
  // Saving goes back to the same record: the same form, about the same patient.
  if (entry && (entry.formId !== formId || (!entry.patientIds && (entry.patientId || null) !== (patientId || null)))) throw new Error('This is a different record.');
  if (entry?.status === 'Filed' && !form.living) throw new Error('This form is already filed.');
  // A signature is always the person saving it; signatures already on the record keep who made them.
  values = { ...values };
  for (const field of allFields(form).filter(item => item.type === 'signature')) {
    const value = values[field.id], before = entry?.values?.[field.id];
    if (!value?.at) continue;
    values[field.id] = before?.at === value.at ? before : { ...value, by: staffId };
  }
  const computed = computeAuto(form, values);
  const errors = validateForm(form, computed, { final });
  if (errors.length) throw new Error(errors.join(' '));
  const now = new Date().toISOString();
  const previous = entry ? { ...entry.values } : null;
  const wasFiled = entry?.status === 'Filed';
  if (!entry) {
    entry = { id: nextId('F', state.forms), formId, patientId, createdBy: staffId, createdAt: now, status: 'Draft' };
    if (patientIds) entry.patientIds = patientIds;
    if (appointmentId) entry.appointmentId = appointmentId;
    state.forms.push(entry);
  }
  Object.assign(entry, { values: computed, updatedAt: now, updatedBy: staffId });
  if (final) {
    Object.assign(entry, { status: 'Filed', filedAt: wasFiled ? entry.filedAt : now, filedBy: wasFiled ? entry.filedBy : staffId });
    const appointment = appointmentId ? state.appointments.find(item => item.id === appointmentId) : formId === 'session' ? unnotedSession(state, patientId, computed.date, staffId) : null;
    if (appointment) { appointment.noteFormId = entry.id; entry.appointmentId = appointment.id; }
    if (!wasFiled || form.living) EFFECTS[formId]?.(state, entry, staffId, previous);
    const subject = patientId ? (form.family === 'clinical' ? patientOf(state, patientId)?.clinicalName : patientOf(state, patientId)?.fullName) : '';
    log(state, staffId, `${wasFiled ? 'Updated' : 'Filed'} ${form.title}${subject ? ` for ${subject}` : ''}`, patientId ? `#/patients/${patientId}/${form.family}` : form.ward ? '#/medication/logs' : '');
  }
  return entry;
}

export function signLater(state, entryId, fieldId, signature, staffId) {
  const entry = state.forms.find(item => item.id === entryId);
  const field = entry && fieldOf(formById(entry.formId), fieldId);
  if (field?.type !== 'signature') throw new Error('This signature line was not found.');
  if (field.signer && !field.signer.includes(staffId)) throw new Error(`Only ${nameList(field.signer)} can sign this.`);
  // A line with no named signer is signed by someone who completes this form or works on its tab.
  const form = formById(entry.formId);
  if (!field.signer && !completes(form, staffId, entry.patientId) && !canSeeTab(staffId, entry.formId === 'aftercare' ? 'followup' : form.family)) throw new Error('You cannot sign this form.');
  entry.values[fieldId] = { ...signature, by: staffId };
  log(state, staffId, `Signed ${field.label} on ${formById(entry.formId).title}`);
  return entry;
}

export function appendRow(state, entryId, fieldId, row, staffId) {
  const entry = state.forms.find(item => item.id === entryId);
  const form = entry && formById(entry.formId);
  const field = form && fieldOf(form, fieldId);
  if (!field?.appendable) throw new Error('Entries cannot be added here.');
  if (!form.owners.includes(staffId)) throw new Error(`${form.title} is completed by ${nameList(form.owners)}.`);
  if (!Object.values(row).some(value => String(value ?? '').trim())) throw new Error('Write the review entry first.');
  (entry.values[fieldId] ||= []).push(row);
  log(state, staffId, `Added a review entry to ${form.title}`, entry.patientId ? `#/patients/${entry.patientId}/clinical` : '');
  return entry;
}

// Forms about this patient, including group and case-review records that list them.
export const formsFor = (state, patientId, family) => state.forms.filter(entry =>
  formById(entry.formId)?.family === family && (entry.patientId === patientId || !!entry.patientIds?.includes(patientId)));

// Fitness Form 5's automatic rows: attendance from Form 2, wellbeing from Form 4, BMI from Form 1.
export function progressSummary(state, patientId) {
  const filed = id => state.forms.filter(entry => entry.formId === id && entry.status === 'Filed');
  const rows = filed('attendance').flatMap(entry => (entry.values.patients || []).filter(row => row.patientId === patientId && row.attended !== 'Held'));
  const attended = rows.filter(row => row.attended === 'Attended').length;
  const ratings = filed('wellbeing').filter(entry => entry.patientId === patientId).flatMap(entry => ['energy', 'sleep', 'mood', 'activityFeel'].map(id => Number(entry.values[id])).filter(Boolean));
  const bmi = filed('clearance').filter(entry => entry.patientId === patientId && entry.values.bmi).map(entry => entry.values.bmi);
  const injuries = filed('injury').filter(entry => entry.patientId === patientId).length;
  return {
    bmi,
    attendancePct: rows.length ? Math.round((attended / rows.length) * 100) : null,
    wellbeingAvg: ratings.length ? Math.round((ratings.reduce((sum, value) => sum + value, 0) / ratings.length) * 10) / 10 : null,
    injuries
  };
}
