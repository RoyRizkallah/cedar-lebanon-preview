// RSA daily check-ins and the team's comments on a patient file (practical notes, never clinical content).
import { nextId } from './ids.js';
import { todayISO } from './dates.js';
import { log } from './activity.js';

export const MOODS = ['Settled', 'Low', 'Unsettled', 'Needs follow-up'];

export function addCheckin(state, { patientId, mood, note, date }, staffId) {
  const patient = state.patients.find(item => item.id === patientId && item.status === 'Admitted');
  if (!patient) throw new Error('Choose a resident in care.');
  if (!MOODS.includes(mood)) throw new Error('Choose how they seemed.');
  if (!String(note || '').trim()) throw new Error('Add a short note.');
  const checkin = { id: nextId('CHK', state.checkins), patientId, date: date || todayISO(), mood, note: note.trim(), by: staffId, at: new Date().toISOString() };
  state.checkins.push(checkin);
  log(state, staffId, `Check-in with ${patient.fullName}: ${mood}`, '#/requests/checkins');
  return checkin;
}

export function addComment(state, { patientId, text }, staffId) {
  if (!state.patients.some(item => item.id === patientId)) throw new Error('Choose the patient.');
  if (!String(text || '').trim()) throw new Error('Write a comment first.');
  const comment = { id: nextId('CM', state.comments), patientId, text: text.trim(), by: staffId, at: new Date().toISOString() };
  state.comments.push(comment);
  return comment;
}

export const checkinsToday = (state, today = todayISO()) => state.checkins.filter(item => item.date === today);
