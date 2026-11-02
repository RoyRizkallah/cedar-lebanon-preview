// Treatment programs: a therapist designs a weekly plan of sessions with goals, then gives it to patients.
import { nextId } from './ids.js';
import { addDays, todayISO } from './dates.js';
import { notify } from './notifications.js';
import { log } from './activity.js';
import { canDo } from './people.js';

export const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
export const DAY_NAMES = { Mon: 'Monday', Tue: 'Tuesday', Wed: 'Wednesday', Thu: 'Thursday', Fri: 'Friday', Sat: 'Saturday' };
export const SESSION_KINDS = ['Group', 'Individual', 'Family', 'Drama therapy', 'Psychoeducation', 'Fitness', 'Mindfulness', 'Workshop'];

const allowed = staffId => { if (!canDo(staffId, 'managePrograms')) throw new Error('Programs are created by the therapists: Wael, Nabila and Nazha.'); };
const find = (state, id) => {
  const program = state.programs.find(item => item.id === id);
  if (!program) throw new Error('This program was not found.');
  return program;
};

function checked({ name, focus = '', weeks, goals = [], sessions = [] }) {
  const title = String(name || '').trim();
  if (title.length < 3 || title.length > 80) throw new Error('Name the program in 3 to 80 characters.');
  const length = Number(weeks);
  if (!Number.isInteger(length) || length < 1 || length > 26) throw new Error('A program runs for 1 to 26 weeks.');
  const list = sessions.map(session => {
    if (!DAYS.includes(session.day)) throw new Error('Sessions run Monday to Saturday.');
    if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(session.time || '')) throw new Error('Give each session a start time.');
    if (!SESSION_KINDS.includes(session.kind)) throw new Error('Choose the kind of session.');
    const label = String(session.title || '').trim();
    if (label.length < 2) throw new Error('Give each session a title.');
    return { id: session.id || '', day: session.day, time: session.time, minutes: Number(session.minutes) || 60, kind: session.kind, title: label, leader: session.leader || '' };
  });
  return { name: title, focus: String(focus).trim(), weeks: length, goals: goals.map(goal => String(goal).trim()).filter(Boolean), sessions: list };
}

const withIds = (program, sessions) => {
  let next = Math.max(0, ...program.sessions.map(item => Number(String(item.id).split('-').pop()) || 0));
  return sessions.map(session => ({ ...session, id: session.id || `${program.id}-S-${++next}` }));
};

export function createProgram(state, fields, staffId, now = new Date()) {
  allowed(staffId);
  const clean = checked(fields);
  const program = { id: nextId('PRG', state.programs), ...clean, sessions: [], status: 'Active', createdBy: staffId, createdAt: now.toISOString() };
  program.sessions = withIds(program, clean.sessions);
  state.programs.push(program);
  log(state, staffId, `Created the program ${program.name}`, `#/programs/${program.id}`);
  return program;
}

export function updateProgram(state, id, changes, staffId, now = new Date()) {
  allowed(staffId);
  const program = find(state, id);
  const clean = checked({ ...program, ...changes });
  Object.assign(program, clean, { sessions: withIds(program, clean.sessions), updatedBy: staffId, updatedAt: now.toISOString() });
  return program;
}

export function archiveProgram(state, id, staffId, now = new Date()) {
  allowed(staffId);
  const program = find(state, id);
  Object.assign(program, { status: 'Archived', archivedBy: staffId, archivedAt: now.toISOString() });
  log(state, staffId, `Archived the program ${program.name}`, '#/programs');
  return program;
}

export function restoreProgram(state, id, staffId) {
  allowed(staffId);
  const program = find(state, id);
  program.status = 'Active';
  return program;
}

export const activeAssignment = (state, patientId) => state.programAssignments.find(item => item.patientId === patientId && item.status === 'Active');

export function assignProgram(state, programId, patientId, { start }, staffId, now = new Date()) {
  allowed(staffId);
  const program = find(state, programId);
  if (program.status !== 'Active') throw new Error('This program is archived. Restore it or pick another.');
  const patient = state.patients.find(item => item.id === patientId && item.status === 'Admitted');
  if (!patient) throw new Error('Choose an admitted patient.');
  const from = start || todayISO(now);
  const current = activeAssignment(state, patientId);
  if (current?.programId === programId) throw new Error(`${patient.clinicalName} is already on this program.`);
  // One program at a time: starting a new one closes the last on the day before.
  if (current) Object.assign(current, { status: 'Ended', end: addDays(from, -1), endedBy: staffId });
  const assignment = { id: nextId('PA', state.programAssignments), programId, patientId, start: from, end: addDays(from, program.weeks * 7), status: 'Active', by: staffId, at: now.toISOString() };
  state.programAssignments.push(assignment);
  const team = Object.values(patient.assigned || {}).filter(id => id && id !== staffId);
  notify(state, { to: team, title: `${patient.clinicalName} starts ${program.name}`, body: `${program.weeks} weeks from ${from}, ${program.sessions.length} sessions a week`, link: `#/programs/${program.id}` });
  log(state, staffId, `Put ${patient.clinicalName} on ${program.name}`, `#/programs/${program.id}`);
  return assignment;
}

export function endAssignment(state, assignmentId, staffId, now = new Date()) {
  allowed(staffId);
  const assignment = state.programAssignments.find(item => item.id === assignmentId);
  if (assignment?.status !== 'Active') throw new Error('This patient is not on the program any more.');
  Object.assign(assignment, { status: 'Ended', end: todayISO(now), endedBy: staffId });
  return assignment;
}

// The program a patient follows on a given day, or null.
export function programFor(state, patientId, day) {
  const assignment = state.programAssignments.find(item => item.patientId === patientId && item.status === 'Active' && item.start <= day);
  const program = assignment && state.programs.find(item => item.id === assignment.programId);
  return program ? { assignment, program } : null;
}

export const programWeek = program => DAYS.map(day => ({ day, sessions: program.sessions.filter(item => item.day === day).sort((a, b) => a.time.localeCompare(b.time)) }));
export const patientsOn = (state, programId) => state.programAssignments.filter(item => item.programId === programId && item.status === 'Active');
