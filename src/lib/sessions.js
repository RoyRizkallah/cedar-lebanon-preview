// The week's therapy, group and fitness sessions with their attendance and note status. Shows status only, never note content.
import { addDays, hoursBetween } from './dates.js';
import { scheduleScope } from './scheduling.js';

const KINDS = { 'Psychologist session': 'Individual', 'Therapist session': 'Individual', Group: 'Group', 'Fitness session': 'Fitness', Physiotherapy: 'Fitness' };

export function sessionsWeek(state, staffId, weekStart, now = new Date()) {
  const end = addDays(weekStart, 6);
  const scope = scheduleScope(staffId);
  const items = state.appointments
    .filter(item => KINDS[item.service] && item.status !== 'Cancelled' && item.date >= weekStart && item.date <= end && (scope === 'all' || scope.includes(item.provider)))
    .sort((a, b) => a.date.localeCompare(b.date) || a.start.localeCompare(b.start))
    .map(appointment => {
      const note = state.forms.find(entry => entry.id === appointment.noteFormId);
      const late = appointment.status === 'Completed' && !note && hoursBetween(appointment.completedAt, now) > 24;
      const noteStatus = appointment.status !== 'Completed' ? 'Upcoming' : note?.status === 'Filed' ? 'Filed' : late ? 'Overdue' : 'Due';
      // Group and fitness logs list everyone; an individual note records one attendance answer.
      const rows = [note?.values?.attendance, note?.values?.patients].find(Array.isArray);
      const single = typeof note?.values?.attendance === 'string' ? note.values.attendance : null;
      const attendance = rows ? { present: rows.filter(row => row.present === true || row.attended === 'Attended').length, total: rows.length } : single ? { present: single === 'Attended' ? 1 : 0, total: 1 } : null;
      return { appointment, kind: KINDS[appointment.service], noteStatus, attendance };
    });
  const rows = items.filter(item => item.attendance);
  const present = rows.reduce((sum, item) => sum + item.attendance.present, 0);
  const total = rows.reduce((sum, item) => sum + item.attendance.total, 0);
  return {
    items,
    summary: { sessions: items.length, filed: items.filter(item => item.noteStatus === 'Filed').length, overdue: items.filter(item => item.noteStatus === 'Overdue').length, due: items.filter(item => item.noteStatus === 'Due').length, attendancePct: total ? Math.round((present / total) * 100) : null }
  };
}
