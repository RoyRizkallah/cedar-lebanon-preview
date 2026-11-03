// Treatment programs: a therapist designs a weekly plan of sessions with goals, then gives it to patients.
import { nextId } from './ids.js';
import { addDays, todayISO, weekday, minutesOf, hhmm } from './dates.js';
import { SERVICES, book, clash } from './scheduling.js';
import { notify } from './notifications.js';
import { log } from './activity.js';
import { canDo, staffName } from './people.js';

export const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
export const DAY_NAMES = { Mon: 'Monday', Tue: 'Tuesday', Wed: 'Wednesday', Thu: 'Thursday', Fri: 'Friday', Sat: 'Saturday' };
export const SESSION_KINDS = ['Group', 'Individual', 'Family', 'Drama therapy', 'Psychoeducation', 'Fitness', 'Mindfulness', 'Workshop'];

// One-to-one sessions are booked per patient; everything else is one booking the patients join.
const ONE_TO_ONE = ['Individual', 'Family'];
const LAST_END = minutesOf('18:00');
const FITNESS = ['Fitness session', 'Movement & yoga', 'Tennis', 'Personal training', 'Boxing / MMA'];

function serviceFor(session) {
  if (session.kind === 'Individual') return session.leader === 'nabila' ? 'Psychologist session' : 'Therapist session';
  if (session.kind === 'Family') return 'Therapist session';
  if (session.kind === 'Drama therapy') return 'Drama therapy';
  if (session.kind === 'Fitness') return SERVICES.find(service => FITNESS.includes(service.name) && service.provider === session.leader)?.name || 'Fitness session';
  return 'Group';
}

// Every date the program meets for this assignment, from a given day on.
function occurrences(program, assignment, fromDay) {
  const list = [];
  for (let day = fromDay > assignment.start ? fromDay : assignment.start; day < assignment.end; day = addDays(day, 1)) {
    const key = DAYS[(weekday(day) + 6) % 7];
    for (const session of program.sessions.filter(item => item.day === key)) list.push({ day, session });
  }
  return list;
}

function bookFrom(state, program, assignment, fromDay, staffId) {
  const { patientId } = assignment;
  assignment.conflicts = (assignment.conflicts || []).filter(item => item.date < fromDay);
  for (const { day, session } of occurrences(program, assignment, fromDay)) {
    const provider = session.leader || undefined;
    const base = { service: serviceFor(session), provider, date: day, minutes: session.minutes, title: session.title };
    const miss = reason => assignment.conflicts.push({ date: day, time: session.time, title: session.title, reason });
    if (ONE_TO_ONE.includes(session.kind)) {
      // Back to back with the leader's other patients, until the day runs out.
      let start = minutesOf(session.time);
      let busy;
      while ((busy = clash(state, { ...base, patientId, start: hhmm(start) })) && start + session.minutes <= LAST_END) start = minutesOf(busy.start) + busy.minutes;
      if (!busy && start + session.minutes > LAST_END) { miss('It would run past 18:00'); continue; }
      if (busy) { miss(busy.provider === provider ? `${staffName(provider)} is fully booked that day` : 'The patient is busy then'); continue; }
      const made = book(state, { ...base, start: hhmm(start), patientId, quiet: true }, 'system');
      Object.assign(made, { bookedBy: staffId, programId: program.id, programSessionId: session.id });
      continue;
    }
    const shared = state.appointments.find(item => item.programSessionId === session.id && item.date === day && item.status === 'Booked');
    const own = clash(state, { patientId, date: day, start: session.time, minutes: session.minutes, ignoreId: shared?.id });
    if (own && (!shared || own.id !== shared.id)) { miss('The patient is busy then'); continue; }
    if (shared) { if (!shared.patientIds.includes(patientId)) shared.patientIds.push(patientId); continue; }
    try {
      const made = book(state, { ...base, start: session.time, patientIds: [patientId], quiet: true }, 'system');
      Object.assign(made, { bookedBy: staffId, programId: program.id, programSessionId: session.id });
    } catch { miss(`${staffName(provider) || 'The leader'} is busy then`); }
  }
}

// Take the patient out of the program's sessions from a given day; a shared session left empty is cancelled.
function unbookFrom(state, assignment, fromDay, staffId) {
  for (const item of state.appointments.filter(entry => entry.programId === assignment.programId && entry.status === 'Booked' && entry.date >= fromDay)) {
    if (item.patientId === assignment.patientId) Object.assign(item, { status: 'Cancelled', cancelledBy: staffId, cancelledAt: new Date().toISOString() });
    if (item.patientIds?.includes(assignment.patientId)) {
      item.patientIds = item.patientIds.filter(id => id !== assignment.patientId);
      if (!item.patientIds.length) Object.assign(item, { status: 'Cancelled', cancelledBy: staffId, cancelledAt: new Date().toISOString() });
    }
  }
  assignment.conflicts = (assignment.conflicts || []).filter(item => item.date < fromDay);
}

// Books an existing assignment from a given day (used by the sample data).
export const bookAssignment = (state, assignment, fromDay, staffId) => bookFrom(state, state.programs.find(item => item.id === assignment.programId), assignment, fromDay, staffId);

// Discharge ends the program on the day; the discharge itself clears the calendar.
export function endProgramFor(state, patientId, day, staffId) {
  const assignment = activeAssignment(state, patientId);
  if (assignment) Object.assign(assignment, { status: 'Ended', end: day, endedBy: staffId, conflicts: (assignment.conflicts || []).filter(item => item.date <= day) });
  return assignment;
}

export const programBookings = (state, assignment) => state.appointments.filter(item => item.programId === assignment.programId && item.status === 'Booked' && (item.patientId === assignment.patientId || item.patientIds?.includes(assignment.patientId)));

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
  const tomorrow = addDays(todayISO(now), 1);
  const active = state.programAssignments.filter(item => item.programId === id && item.status === 'Active');
  for (const assignment of active) unbookFrom(state, assignment, tomorrow, staffId);
  Object.assign(program, clean, { sessions: withIds(program, clean.sessions), updatedBy: staffId, updatedAt: now.toISOString() });
  // The week changed: what is still ahead is booked again from tomorrow.
  for (const assignment of active) bookFrom(state, program, assignment, tomorrow, staffId);
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
  if (current) { unbookFrom(state, current, from, staffId); Object.assign(current, { status: 'Ended', end: addDays(from, -1), endedBy: staffId }); }
  const assignment = { id: nextId('PA', state.programAssignments), programId, patientId, start: from, end: addDays(from, program.weeks * 7), status: 'Active', by: staffId, at: now.toISOString() };
  state.programAssignments.push(assignment);
  bookFrom(state, program, assignment, from, staffId);
  const team = Object.values(patient.assigned || {}).filter(id => id && id !== staffId);
  notify(state, { to: team, title: `${patient.clinicalName} starts ${program.name}`, body: `${program.weeks} weeks from ${from}, ${program.sessions.length} sessions a week`, link: `#/programs/${program.id}`, fallback: `#/patients/${patient.id}` });
  log(state, staffId, `Put ${patient.clinicalName} on ${program.name}`, `#/programs/${program.id}`);
  return assignment;
}

export function endAssignment(state, assignmentId, staffId, now = new Date()) {
  allowed(staffId);
  const assignment = state.programAssignments.find(item => item.id === assignmentId);
  if (assignment?.status !== 'Active') throw new Error('This patient is not on the program any more.');
  unbookFrom(state, assignment, addDays(todayISO(now), 1), staffId);
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
