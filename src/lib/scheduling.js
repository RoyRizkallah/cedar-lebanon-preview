// Internal calendar: earliest free slot, no double booking, external psychiatrist recorded by Fadia.
import { nextId } from './ids.js';
import { addDays, weekday, minutesOf, hhmm, hoursBetween } from './dates.js';
import { STAFF, staffName, hasRole, canDo } from './people.js';
import { notify } from './notifications.js';
import { log } from './activity.js';

export const SERVICES = [
  { name: 'Psychologist session', provider: 'nabila', minutes: 50, auto: true },
  { name: 'Therapist session', provider: 'samar', minutes: 50 },
  { name: 'Nursing appointment', provider: 'fadia', minutes: 30 },
  { name: 'Blood test', provider: 'fadia', minutes: 15 },
  { name: 'Physiotherapy', provider: 'john', minutes: 45 },
  { name: 'Fitness session', provider: 'john', minutes: 60 },
  { name: 'Movement & yoga', provider: 'zeina', minutes: 60 },
  { name: 'Tennis', provider: 'tony-j', minutes: 60 },
  { name: 'Personal training', provider: 'tony-am', minutes: 45 },
  { name: 'Boxing / MMA', provider: 'raymond', minutes: 60 },
  { name: 'Drama therapy', provider: 'nazha', minutes: 60 },
  { name: 'Group', provider: 'samar', minutes: 60 },
  { name: 'Assessment', provider: 'ahmed', minutes: 60 },
  { name: 'External psychiatrist', provider: 'external', minutes: 30, external: true }
];
export const DAY_START = '09:00';
export const DAY_END = '17:00';
const STEP = 15;
const SEARCH_DAYS = 14;
const NOTE_SERVICES = ['Psychologist session', 'Therapist session'];

export const serviceByName = name => SERVICES.find(service => service.name === name);

// Which note each completed session needs, and how the Sessions page groups it. One map, used everywhere.
const FITNESS_SERVICES = ['Fitness session', 'Physiotherapy', 'Movement & yoga', 'Tennis', 'Personal training', 'Boxing / MMA'];
const NOTES = {
  'Psychologist session': { form: 'session', kind: 'Individual' },
  'Therapist session': { form: 'session', kind: 'Individual' },
  Group: { form: 'group', kind: 'Group' },
  'Drama therapy': { form: 'group', kind: 'Group' },
  ...Object.fromEntries(FITNESS_SERVICES.map(name => [name, { form: 'attendance', kind: 'Fitness' }]))
};
export const noteFormFor = service => NOTES[service]?.form || null;
export const sessionKind = service => NOTES[service]?.kind || null;
const live = item => item.status !== 'Cancelled';
const overlaps = (a, b) => minutesOf(a.start) < minutesOf(b.start) + b.minutes && minutesOf(b.start) < minutesOf(a.start) + a.minutes;
const involves = (item, patientId) => !!patientId && (item.patientId === patientId || !!item.patientIds?.includes(patientId));

export function clash(state, { provider, patientId, date, start, minutes, ignoreId }) {
  return state.appointments.find(item => live(item) && item.id !== ignoreId && item.date === date && item.provider !== 'external' &&
    (item.provider === provider || involves(item, patientId)) && overlaps(item, { start, minutes }));
}

export function earliestSlot(state, { provider, minutes, from, patientId }) {
  for (let offset = 1; offset <= SEARCH_DAYS; offset++) {
    const date = addDays(from, offset);
    if (weekday(date) === 0) continue;
    for (let start = minutesOf(DAY_START); start + minutes <= minutesOf(DAY_END); start += STEP) {
      if (!clash(state, { provider, patientId, date, start: hhmm(start), minutes })) return { date, start: hhmm(start) };
    }
  }
  throw new Error(`No free slot in the next ${SEARCH_DAYS} days.`);
}

function guard(service, staffId) {
  if (service === 'Psychologist session' && staffId !== 'system' && !canDo(staffId, 'bookPsychologist')) throw new Error("Psychologist appointments are booked automatically and can't be changed here.");
}

export function book(state, fields, staffId) {
  const service = serviceByName(fields.service);
  if (!service) throw new Error('Choose a service.');
  guard(service.name, staffId);
  if (!fields.date || !/^\d\d:\d\d$/.test(fields.start || '')) throw new Error('Choose a date and time.');
  const appointment = { service: service.name, provider: fields.provider || service.provider, minutes: Number(fields.minutes) || service.minutes, date: fields.date, start: fields.start };
  for (const key of ['patientId', 'patientIds', 'inquiryId', 'title', 'auto', 'external']) if (fields[key] !== undefined) appointment[key] = fields[key];
  const other = appointment.provider !== 'external' && clash(state, { ...appointment, patientId: appointment.patientId });
  if (other) throw new Error(`This time overlaps another booking for ${other.provider === appointment.provider ? staffName(appointment.provider) : 'this patient'}.`);
  Object.assign(appointment, { id: nextId('A', state.appointments), status: 'Booked', bookedBy: staffId, bookedAt: new Date().toISOString() });
  state.appointments.push(appointment);
  // Program bookings arrive in dozens; the program assignment is logged once instead.
  if (!fields.quiet) log(state, staffId, `Booked ${appointment.service} on ${appointment.date} at ${appointment.start}`, '#/schedule');
  return appointment;
}

export function autoBookPsychologist(state, { inquiryId, patientId }, from, staffId = 'system') {
  const slot = earliestSlot(state, { provider: 'nabila', minutes: 50, from, patientId });
  return book(state, { service: 'Psychologist session', provider: 'nabila', minutes: 50, ...slot, inquiryId, patientId, auto: true }, 'system');
}

// Whose calendars a person sees: their own (Fadia also the external psychiatrist); the partners and Melyssa see everyone.
export function scheduleScope(staffId) {
  if (canDo(staffId, 'seeAllBookings')) return 'all';
  // The Clinical Director oversees the therapists' sessions and notes.
  if (hasRole(staffId, 'clinical-director')) return STAFF.filter(person => hasRole(person.id, 'clinical-director', 'psychologist', 'drama')).map(person => person.id);
  return staffId === 'fadia' ? ['fadia', 'external'] : [staffId];
}

export function canCancel(staffId, appointment) {
  if (hasRole(staffId, 'gm', 'director')) return true;
  if (appointment.service === 'Psychologist session') return hasRole(staffId, 'psychologist', 'clinical-director');
  if (hasRole(staffId, 'admin')) return true;
  return appointment.provider === staffId || (appointment.provider === 'external' && staffId === 'fadia');
}

export function cancelAppointment(state, id, staffId) {
  const appointment = state.appointments.find(item => item.id === id);
  if (!appointment) throw new Error('This appointment was not found.');
  guard(appointment.service, staffId);
  if (!canCancel(staffId, appointment)) throw new Error('You can cancel only your own appointments.');
  if (appointment.status !== 'Booked') throw new Error(`This appointment is already ${appointment.status.toLowerCase()}.`);
  Object.assign(appointment, { status: 'Cancelled', cancelledBy: staffId, cancelledAt: new Date().toISOString() });
  log(state, staffId, `Cancelled ${appointment.service} on ${appointment.date}`, '#/schedule');
  return appointment;
}

export function completeAppointment(state, id, staffId, now = new Date()) {
  const appointment = state.appointments.find(item => item.id === id);
  if (!appointment) throw new Error('This appointment was not found.');
  if (appointment.status === 'Completed') throw new Error('This appointment is already completed.');
  if (appointment.status === 'Cancelled') throw new Error('This appointment was cancelled.');
  // Only the person who gave the session marks it done (it can unlock an admission step).
  if (appointment.provider !== 'external' && appointment.provider !== staffId) throw new Error(`${staffName(appointment.provider)} marks this session completed.`);
  Object.assign(appointment, { status: 'Completed', completedAt: now.toISOString(), completedBy: staffId });
  log(state, staffId, `Completed ${appointment.service}`, '#/schedule');
  return appointment;
}

export const needsNote = appointment => NOTE_SERVICES.includes(appointment.service) && appointment.status === 'Completed' && !!appointment.patientId && !appointment.noteFormId;

export function notesOverdue(state, staffId, now = new Date()) {
  return state.appointments.filter(item => item.provider === staffId && needsNote(item) && hoursBetween(item.completedAt, now) > 24);
}

export function recordPsychiatrist(state, { patientId, date, start, psychiatrist }, staffId) {
  if (!patientId) throw new Error('Choose the patient.');
  if (!String(psychiatrist || '').trim()) throw new Error('Add the psychiatrist’s name.');
  const appointment = book(state, { service: 'External psychiatrist', provider: 'external', patientId, date, start, external: { psychiatrist: psychiatrist.trim() } }, staffId);
  appointment.recordedBy = staffId;
  return appointment;
}

export function recordPrescription(state, { patientId, appointmentId, fileId, fileName, note = '' }, staffId) {
  const patient = state.patients.find(item => item.id === patientId);
  if (!patient) throw new Error('Choose the patient.');
  const appointment = state.appointments.find(item => item.id === appointmentId);
  if (appointment && appointment.status === 'Booked') Object.assign(appointment, { status: 'Completed', completedAt: new Date().toISOString(), completedBy: staffId });
  const document = { id: nextId('D', state.documents), patientId, type: 'Prescription', title: `Prescription — ${appointment?.external?.psychiatrist || 'external psychiatrist'}`, status: 'Received', appointmentId, fileId, fileName, note: String(note).trim(), createdAt: new Date().toISOString(), createdBy: staffId };
  state.documents.push(document);
  notify(state, { to: 'fadia', title: `Prescription received for ${patient.clinicalName}`, body: document.note || document.title, link: `#/patients/${patientId}/medical` });
  log(state, staffId, `Prescription received for ${patient.clinicalName}`, `#/patients/${patientId}/medical`);
  return document;
}

export const upcomingFor = (state, patientId, today) => state.appointments
  .filter(item => live(item) && item.status === 'Booked' && involves(item, patientId) && item.date >= today)
  .sort((a, b) => a.date.localeCompare(b.date) || a.start.localeCompare(b.start));
