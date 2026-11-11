// Family visits, day leave and incident reports.
import { nextId } from './ids.js';
import { todayISO, fmtDateTime } from './dates.js';
import { notify } from './notifications.js';
import { log } from './activity.js';
import { canDo, visiblePatients } from './people.js';
import { onWatch } from './forms/engine.js';

export const INCIDENT_TYPES = ['Aggression', 'Self-harm', 'Absconding', 'Substance found', 'Rule breach', 'Medical', 'Property damage', 'Other'];
// RSA & Floor SOP 3.4: three levels, each with its response and who is called.
export const LEVELS = [
  { level: 1, name: 'Behavioural', response: 'De-escalate; behaviour log and nightly update. Omar reviews.' },
  { level: 2, name: 'Serious', response: 'Senior on shift takes over. Omar and Ahmed called the same day; report within the hour.' },
  { level: 3, name: 'Emergency', response: 'Act first. Calls now: Fadia for anything health, Ahmed, and Amer. Report after the response.' }
];
export const levelName = level => { const item = LEVELS.find(entry => entry.level === Number(level)); return item ? `Level ${item.level}, ${item.name.toLowerCase()}` : ''; };
const HEALTH = ['Self-harm', 'Medical'];
// Omar sees every report; Ahmed from Level 2; Amer, and Fadia for health, at Level 3.
export function incidentCalls(level, type) {
  if (level === 1) return ['omar'];
  if (level === 2) return ['omar', 'ahmed'];
  return ['omar', 'ahmed', 'amer', ...(HEALTH.includes(type) ? ['fadia'] : [])];
}
const patientOf = (state, id) => { const patient = state.patients.find(item => item.id === id && item.status === 'Admitted'); if (!patient) throw new Error('Choose a patient in care.'); return patient; };

export function logVisit(state, { patientId, visitor, relation = '', date, start = '', end = '', note = '' }, staffId) {
  const patient = patientOf(state, patientId);
  if (!String(visitor || '').trim()) throw new Error('Add the visitor’s name.');
  const visit = { id: nextId('VIS', state.visits), patientId, visitor: visitor.trim(), relation: relation.trim(), date: date || todayISO(), start, end, note: String(note).trim(), loggedBy: staffId, at: new Date().toISOString() };
  state.visits.push(visit);
  log(state, staffId, `Visit logged for ${patient.fullName}: ${visit.visitor}`, '#/safety/visits');
  return visit;
}

export function leaveStatus(leave, now = new Date()) {
  if (leave.returnedAt) return leave.returnedAt > leave.dueBack ? 'Returned late' : 'Returned';
  return now.toISOString() > new Date(leave.dueBack).toISOString() ? 'Overdue' : 'Out';
}

export function startLeave(state, { patientId, out, dueBack, escort = '', reason = '', clinicalOk = false }, staffId) {
  const patient = patientOf(state, patientId);
  if (state.leaves.some(item => item.patientId === patientId && !item.returnedAt)) throw new Error(`${patient.fullName} is already out on leave.`);
  if (onWatch(state, patientId) && !clinicalOk) throw new Error(`${patient.fullName} is on watch: confirm the clinical team agreed to this leave.`);
  const leaving = new Date(out || Date.now()).toISOString();
  const back = new Date(dueBack).toISOString();
  if (!dueBack || back <= leaving) throw new Error('The return time must be after the time out.');
  const leave = { id: nextId('LV', state.leaves), patientId, out: leaving, dueBack: back, escort: escort.trim(), reason: reason.trim(), by: staffId, ...(clinicalOk ? { clinicalOk: true } : {}) };
  state.leaves.push(leave);
  log(state, staffId, `${patient.fullName} out on leave until ${fmtDateTime(back)}`, '#/safety/leave');
  return leave;
}

export function returnLeave(state, leaveId, staffId, now = new Date()) {
  const leave = state.leaves.find(item => item.id === leaveId);
  if (!leave || leave.returnedAt) throw new Error('This leave is already closed.');
  Object.assign(leave, { returnedAt: now.toISOString(), returnedBy: staffId });
  const patient = state.patients.find(item => item.id === leave.patientId);
  if (leaveStatus(leave) === 'Returned late') notify(state, { to: ['ahmed', 'omar'], title: `Late return from leave: ${patient.fullName}`, body: `Due ${fmtDateTime(leave.dueBack)}, back ${fmtDateTime(leave.returnedAt)}`, link: '#/safety/leave' });
  log(state, staffId, `${patient.fullName} back from leave`, '#/safety/leave');
  return leave;
}

export function reportIncident(state, { patientId = '', date, time = '', type, level, description, actionTaken = '' }, staffId) {
  if (!INCIDENT_TYPES.includes(type)) throw new Error('Choose the type of incident.');
  level = Number(level);
  if (!LEVELS.some(item => item.level === level)) throw new Error('Choose the level: 1, 2 or 3.');
  if (!String(description || '').trim()) throw new Error('Describe what happened.');
  const patient = patientId ? patientOf(state, patientId) : null;
  const incident = { id: nextId('INC', state.incidents), patientId, date: date || todayISO(), time, type, level, description: description.trim(), actionTaken: String(actionTaken).trim(), reportedBy: staffId, at: new Date().toISOString(), status: 'Open' };
  state.incidents.push(incident);
  notify(state, { to: incidentCalls(level, type), title: `Level ${level} incident (${incident.id}): ${type}${patient ? `, ${patient.clinicalName}` : ''}`, body: incident.description, link: '#/safety/incidents', urgent: level > 1 });
  log(state, staffId, `Incident reported: ${type}`, '#/safety/incidents');
  return incident;
}

// Omar reviews Level 1; Ahmed reviews from Level 2.
export const canReview = (incident, staffId) => canDo(staffId, 'reviewIncident') || (incident?.level === 1 && staffId === 'omar');
export function reviewIncident(state, incidentId, { outcome }, staffId) {
  const incident = state.incidents.find(item => item.id === incidentId);
  if (!canReview(incident, staffId)) throw new Error(incident?.level === 1 ? 'Level 1 incidents are reviewed by Omar or Ahmed.' : 'Level 2 and 3 incidents are reviewed by Ahmed.');
  if (!incident || incident.status === 'Reviewed') throw new Error('This incident is already reviewed.');
  if (!String(outcome || '').trim()) throw new Error('Record the outcome of the review.');
  Object.assign(incident, { status: 'Reviewed', outcome: outcome.trim(), reviewedBy: staffId, reviewedAt: new Date().toISOString() });
  log(state, staffId, `Incident ${incident.id} reviewed`, '#/safety/incidents');
  return incident;
}

// Incidents someone may see: those about residents they look after (or about nobody in particular).
// Only the care team, and whoever reported it, read what happened.
export function incidentsFor(state, staffId) {
  const mine = new Set(visiblePatients(state, staffId, { includeDischarged: true }).map(patient => patient.id));
  const details = canDo(staffId, 'viewIncidentDetail');
  return state.incidents.filter(item => !item.patientId || mine.has(item.patientId)).map(item =>
    details || item.reportedBy === staffId ? item : { ...item, redacted: true, description: 'Details are with the care team.', actionTaken: '', outcome: item.outcome ? 'Reviewed.' : '' });
}

// When a resident isn't back by the agreed time, Ahmed, Omar and their RSA are alerted once, urgently.
export function runLeaveAlerts(state, now = new Date()) {
  for (const leave of state.leaves.filter(item => !item.returnedAt && !item.lateAlerted && leaveStatus(item, now) === 'Overdue')) {
    const patient = state.patients.find(item => item.id === leave.patientId);
    leave.lateAlerted = true;
    notify(state, { to: ['ahmed', 'omar', patient?.assigned?.rsa], title: `Not back from leave: ${patient?.fullName}`, body: `Due back ${fmtDateTime(leave.dueBack)}${leave.escort ? `, with ${leave.escort}` : ''}. Call them, then report absconding if needed.`, link: '#/safety/leave', urgent: true });
  }
}
export const leaveAlertsDue = (state, now = new Date()) => state.leaves.some(item => !item.returnedAt && !item.lateAlerted && leaveStatus(item, now) === 'Overdue');
