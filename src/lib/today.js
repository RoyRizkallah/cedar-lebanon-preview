// The wider day around a person's own tasks: the house right now, this week's milestones,
// what the floor flagged, and what colleagues just did. Everything respects who can see what.
import { addDays, todayISO, daysBetween, localDay } from './dates.js';
import { canSee, visiblePatients, STAFF } from './people.js';
import { roundFor } from './medication.js';
import { leaveStatus } from './safety.js';
import { plannedDischarge } from './discharge.js';
import { placeLabel } from './admission.js';

const WEEK = 7;
const STAY_DAYS = [7, 30, 60, 90];

export function houseToday(state, staffId, now = new Date()) {
  const today = todayISO(now);
  const inCare = state.patients.filter(patient => patient.status === 'Admitted');
  const arriving = state.onboardings.filter(item => !item.admittedPatientId && item.steps.room?.arrivalDate === today);
  const away = state.leaves.filter(leave => leave.out <= now.toISOString() && ['Out', 'Overdue'].includes(leaveStatus(leave, now)));
  const late = away.filter(leave => leaveStatus(leave, now) === 'Overdue');
  const due = roundFor(state, today).filter(item => item.status === 'Due');
  const sessions = state.appointments.filter(item => item.date === today && item.status !== 'Cancelled');
  const items = [
    { id: 'in-care', label: 'In care', value: inCare.length, note: `${inCare.filter(patient => patient.program !== 'Outpatient').length} living in`, link: '#/patients', page: 'patients' },
    { id: 'arriving', label: 'Arriving today', value: arriving.length, note: arriving.length ? 'Room ready to check' : 'No arrivals', link: '#/admissions', page: 'admissions' },
    { id: 'leave', label: 'Out on leave', value: away.length, note: late.length ? `${late.length} late back` : 'All on time', link: '#/safety/leave', page: 'safety', tone: late.length ? 'urgent' : undefined },
    { id: 'doses', label: 'Doses still due', value: due.length, note: 'Today’s rounds', link: '#/medication', page: 'medication', tone: due.length ? 'warn' : undefined },
    { id: 'visits', label: 'Visits today', value: state.visits.filter(visit => visit.date === today).length, note: 'Family and friends', link: '#/safety/visits', page: 'safety' },
    { id: 'sessions', label: 'Sessions today', value: sessions.length, note: `${sessions.filter(item => item.status === 'Completed').length} done so far`, link: '#/schedule', page: 'schedule' }
  ];
  return items.filter(item => canSee(staffId, item.page)).map(({ page, ...item }) => item);
}

export function milestonesFor(state, staffId, now = new Date(), days = WEEK) {
  const today = todayISO(now);
  const last = addDays(today, days);
  const inWindow = date => date && date >= today && date <= last;
  const patients = visiblePatients(state, staffId);
  const list = [];
  for (const patient of patients) {
    for (const n of STAY_DAYS) {
      const date = addDays(patient.admittedAt, n - 1);
      if (inWindow(date)) list.push({ date, kind: 'stay', patientId: patient.id, text: `Day ${n} for ${patient.clinicalName}`, sub: n === 7 ? 'First week done' : `${n} days in care` });
    }
    const assignment = state.programAssignments?.find(item => item.patientId === patient.id && item.status === 'Active');
    const program = assignment && state.programs.find(item => item.id === assignment.programId);
    if (program && inWindow(addDays(assignment.end, -1))) list.push({ date: addDays(assignment.end, -1), kind: 'program', patientId: patient.id, text: `${patient.clinicalName} finishes ${program.name}`, sub: 'Plan what comes next' });
    const leaving = plannedDischarge(state, patient.id);
    if (inWindow(leaving)) list.push({ date: leaving, kind: 'discharge', patientId: patient.id, text: `${patient.clinicalName} leaves`, sub: 'Planned discharge' });
  }
  if (canSee(staffId, 'admissions')) {
    for (const onboarding of state.onboardings.filter(item => !item.admittedPatientId && inWindow(item.steps.room?.arrivalDate))) {
      const inquiry = state.inquiries.find(item => item.id === onboarding.inquiryId);
      if (inquiry && !inquiry.outcome) list.push({ date: onboarding.steps.room.arrivalDate, kind: 'arrival', patientId: '', text: `${inquiry.name} arrives`, sub: onboarding.steps.room.roomId ? placeLabel(state, onboarding.steps.room.roomId, onboarding.steps.room.bed) : 'Room to confirm', link: '#/admissions' });
    }
  }
  return list.sort((a, b) => a.date.localeCompare(b.date) || a.text.localeCompare(b.text));
}

export function floorNotes(state, staffId, now = new Date(), limit = 6) {
  const since = addDays(todayISO(now), -2);
  const mine = new Set(visiblePatients(state, staffId).map(patient => patient.id));
  const name = id => state.patients.find(patient => patient.id === id)?.clinicalName || '';
  const checkins = state.checkins.filter(item => mine.has(item.patientId) && item.mood !== 'Settled' && (item.date || localDay(item.at)) >= since)
    .map(item => ({ at: item.at || `${item.date}T12:00:00`, by: item.by, patientId: item.patientId, kind: 'checkin', tone: 'warn', text: `${name(item.patientId)}: ${item.mood}`, sub: item.note }));
  const comments = state.comments.filter(item => mine.has(item.patientId) && localDay(item.at) >= since)
    .map(item => ({ at: item.at, by: item.by, patientId: item.patientId, kind: 'comment', tone: '', text: name(item.patientId), sub: item.text }));
  return [...checkins, ...comments].sort((a, b) => String(b.at).localeCompare(String(a.at))).slice(0, limit);
}

export function teamFeed(state, staffId, now = new Date(), limit = 6) {
  const since = addDays(todayISO(now), -3);
  // People only: automatic entries are not news.
  return state.activity.filter(item => item.by !== staffId && STAFF.some(person => person.id === item.by) && localDay(item.at) >= since)
    .sort((a, b) => String(b.at).localeCompare(String(a.at))).slice(0, limit);
}

export const daysAway = (date, now = new Date()) => daysBetween(todayISO(now), date);
