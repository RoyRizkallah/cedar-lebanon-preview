// Cedar Assist preview: a week at a glance per patient, from filed records only.
// Raises the standing flags written on the Case Review Record; decisions stay with the team.
import { addDays, todayISO, daysBetween, localDay, fmtDate } from '../dates.js';
import { riskLevel } from '../forms/engine.js';

const WINDOW_DAYS = 7;
const DISCHARGE_SOON_DAYS = 14;
const FLAG_ORDER = ['incident', 'relapse', 'refusal', 'medication', 'discharge'];
const day = moment => (moment ? localDay(moment) : '');
const average = values => { const list = values.map(Number).filter(Boolean); return list.length ? Math.round((list.reduce((a, b) => a + b, 0) / list.length) * 10) / 10 : null; };

export function weekSummary(state, patientId, now = new Date()) {
  const today = todayISO(now);
  const from = addDays(today, -WINDOW_DAYS);
  const patient = state.patients.find(item => item.id === patientId);
  const filed = formId => state.forms.filter(entry => entry.formId === formId && entry.status === 'Filed');
  const inWeek = entry => (entry.values?.date || day(entry.filedAt)) >= from;

  const sessions = filed('session').filter(entry => entry.patientId === patientId && inWeek(entry));
  const flagsRaised = sessions.flatMap(entry => entry.values.riskFlags || []);
  const injuries = filed('injury').filter(entry => entry.patientId === patientId && inWeek(entry));
  const refusals = sessions.filter(entry => entry.values.attendance === 'Refused').length
    + filed('group').filter(inWeek).flatMap(entry => entry.values.attendance || []).filter(row => row.patientId === patientId && !row.present).length
    + filed('attendance').filter(inWeek).flatMap(entry => entry.values.patients || []).filter(row => row.patientId === patientId && row.attended === 'Absent').length;
  const prescriptions = (state.documents || []).filter(doc => doc.patientId === patientId && doc.type === 'Prescription' && day(doc.createdAt) >= from);
  const plan = filed('plan').filter(entry => entry.patientId === patientId).sort((a, b) => String(b.filedAt).localeCompare(String(a.filedAt)))[0];
  const plannedDischarge = plan?.values?.plannedDischarge;
  const dischargeSoon = String(patient?.phase || '').startsWith('4') || (plannedDischarge && daysBetween(today, plannedDischarge) >= 0 && daysBetween(today, plannedDischarge) <= DISCHARGE_SOON_DAYS);
  const checkins = filed('wellbeing').filter(entry => entry.patientId === patientId).sort((a, b) => String(b.values.weekEnding).localeCompare(String(a.values.weekEnding)));
  const score = entry => entry && average(['energy', 'sleep', 'mood', 'activityFeel'].map(id => entry.values[id]));

  const incidents = [...new Set(flagsRaised.filter(flag => ['Self-harm', 'Absconding', 'Aggression'].includes(flag)))];
  const flags = [];
  if (incidents.length || injuries.length) flags.push({ key: 'incident', label: 'Incident', detail: [incidents.join(', ').toLowerCase(), injuries.length ? `injury (${injuries.map(entry => (entry.values.bodyPart || '').toLowerCase()).filter(Boolean).join(', ') || 'reported'})` : ''].filter(Boolean).join('; ') });
  if (flagsRaised.includes('Relapse / craving')) flags.push({ key: 'relapse', label: 'Relapse', detail: 'relapse or craving flagged in session' });
  if (refusals >= 2) flags.push({ key: 'refusal', label: 'Refusal pattern', detail: `${refusals} refusals or absences` });
  if (prescriptions.length) flags.push({ key: 'medication', label: 'Medication change', detail: 'new prescription received' });
  if (dischargeSoon) flags.push({ key: 'discharge', label: 'Approaching discharge', detail: plannedDischarge ? `planned discharge ${fmtDate(plannedDischarge)}` : 'in discharge preparation' });
  flags.sort((a, b) => FLAG_ORDER.indexOf(a.key) - FLAG_ORDER.indexOf(b.key));

  const wellbeing = checkins.length ? { latest: score(checkins[0]), previous: score(checkins[1]) ?? null } : null;
  const parts = flags.map(flag => flag.detail);
  if (wellbeing) parts.push(`wellbeing ${wellbeing.latest}${wellbeing.previous !== null ? ` (was ${wellbeing.previous})` : ''}`);
  const brief = flags.length
    ? parts.map((part, index) => index ? part : part[0].toUpperCase() + part.slice(1)).join('; ') + '.'
    : `Steady week: ${sessions.length} session${sessions.length === 1 ? '' : 's'} noted${wellbeing ? `, wellbeing ${wellbeing.latest}` : ''}.`;

  return { flags, brief, risk: riskLevel(state, patientId), sessions: sessions.length, wellbeing };
}

export function prepareCaseReview(state, now = new Date()) {
  const summaries = state.patients.filter(patient => patient.status === 'Admitted').map(patient => ({ patient, summary: weekSummary(state, patient.id, now) }))
    .sort((a, b) => b.summary.flags.length - a.summary.flags.length || a.patient.clinicalName.localeCompare(b.patient.clinicalName));
  return {
    rows: summaries.map(({ patient, summary }) => ({ patientId: patient.id, patient: patient.clinicalName, phase: patient.phase, status: summary.brief, decisions: '', action: '' })),
    highRisk: summaries.filter(({ summary }) => ['Medium', 'High'].includes(summary.risk)).map(({ patient }) => patient.clinicalName).join(', '),
    flagged: summaries.filter(({ summary }) => summary.flags.length).length,
    summaries
  };
}
