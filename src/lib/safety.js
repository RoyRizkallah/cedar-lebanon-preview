// Family visits, day leave and incident reports.
import { nextId } from './ids.js';
import { todayISO, fmtDateTime } from './dates.js';
import { notify } from './notifications.js';
import { log } from './activity.js';
import { canDo, whoCan } from './people.js';

export const INCIDENT_TYPES = ['Aggression', 'Self-harm', 'Absconding', 'Substance found', 'Rule breach', 'Medical', 'Property damage', 'Other'];
export const SEVERITIES = ['Low', 'Medium', 'High'];
const REVIEWERS = () => whoCan('reviewIncident');
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

export function startLeave(state, { patientId, out, dueBack, escort = '', reason = '' }, staffId) {
  const patient = patientOf(state, patientId);
  if (state.leaves.some(item => item.patientId === patientId && !item.returnedAt)) throw new Error(`${patient.fullName} is already out on leave.`);
  const leaving = new Date(out || Date.now()).toISOString();
  const back = new Date(dueBack).toISOString();
  if (!dueBack || back <= leaving) throw new Error('The return time must be after the time out.');
  const leave = { id: nextId('LV', state.leaves), patientId, out: leaving, dueBack: back, escort: escort.trim(), reason: reason.trim(), by: staffId };
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

export function reportIncident(state, { patientId = '', date, time = '', type, severity, description, actionTaken = '' }, staffId) {
  if (!INCIDENT_TYPES.includes(type)) throw new Error('Choose the type of incident.');
  if (!SEVERITIES.includes(severity)) throw new Error('Choose the severity.');
  if (!String(description || '').trim()) throw new Error('Describe what happened.');
  const patient = patientId ? patientOf(state, patientId) : null;
  const incident = { id: nextId('INC', state.incidents), patientId, date: date || todayISO(), time, type, severity, description: description.trim(), actionTaken: String(actionTaken).trim(), reportedBy: staffId, at: new Date().toISOString(), status: 'Open' };
  state.incidents.push(incident);
  notify(state, { to: [...REVIEWERS(), 'omar'], title: `${severity} incident: ${type}${patient ? `, ${patient.clinicalName}` : ''}`, body: incident.description, link: '#/safety/incidents', urgent: severity === 'High' });
  log(state, staffId, `Incident reported: ${type}`, '#/safety/incidents');
  return incident;
}

export function reviewIncident(state, incidentId, { outcome }, staffId) {
  if (!canDo(staffId, 'reviewIncident')) throw new Error('Incidents are reviewed by Ahmed or Wael.');
  const incident = state.incidents.find(item => item.id === incidentId);
  if (!incident || incident.status === 'Reviewed') throw new Error('This incident is already reviewed.');
  if (!String(outcome || '').trim()) throw new Error('Record the outcome of the review.');
  Object.assign(incident, { status: 'Reviewed', outcome: outcome.trim(), reviewedBy: staffId, reviewedAt: new Date().toISOString() });
  log(state, staffId, `Incident ${incident.id} reviewed`, '#/safety/incidents');
  return incident;
}
