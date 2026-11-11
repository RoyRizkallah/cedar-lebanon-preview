// Cedar Assist preview: a whole-stay case report assembled from filed records, each line naming its source.
import { daysBetween, todayISO, fmtDate } from '../dates.js';
import { riskLevel, progressSummary } from '../forms/engine.js';
import { weekSummary } from './caseReview.js';

export function caseReport(state, patientId, now = new Date()) {
  const patient = state.patients.find(item => item.id === patientId);
  const filed = formId => state.forms.filter(entry => entry.formId === formId && entry.status === 'Filed' && (entry.patientId === patientId || entry.patientIds?.includes(patientId))).sort((a, b) => String(a.filedAt).localeCompare(String(b.filedAt)));
  const intake = filed('intake').at(-1);
  const plan = filed('plan').at(-1);
  const sessions = filed('session');
  const groups = filed('group');
  const groupRows = groups.flatMap(entry => (entry.values.attendance || []).filter(row => row.patientId === patientId));
  const fitness = progressSummary(state, patientId);
  const orders = (state.medication?.orders || []).filter(order => order.patientId === patientId && order.status === 'Active');
  const tests = (state.medication?.tests || []).filter(test => test.patientId === patientId);
  const incidents = (state.incidents || []).filter(item => item.patientId === patientId);
  const discharge = state.forms.find(entry => entry.formId === 'discharge' && entry.patientId === patientId);
  const end = patient.dischargedAt || todayISO(now);
  const missing = [];
  if (!intake) missing.push('No intake assessment is filed.');
  if (!plan) missing.push('No treatment plan is filed.');
  if (!sessions.length) missing.push('No individual session notes are filed.');

  const sections = [
    { title: 'Stay', lines: [
      { text: `${patient.program}, admitted ${fmtDate(patient.admittedAt, { day: 'numeric', month: 'long', year: 'numeric' })}; day ${daysBetween(patient.admittedAt, end) + 1}${patient.dischargedAt ? `, discharged ${fmtDate(patient.dischargedAt)}` : `, phase ${patient.phase}`}.`, source: 'Patient file' },
      ...(intake ? [{ text: `Intake: ${intake.values.substances || 'substance history recorded'} Stage of change: ${intake.values.stageOfChange || 'not recorded'}.`, source: `Form 1, ${fmtDate(intake.filedAt)}` }] : [])
    ] },
    { title: 'Risk', lines: [
      { text: `Current rating: ${riskLevel(state, patientId) || 'not assessed'}.${intake?.values.riskNotes ? ` ${intake.values.riskNotes}` : ''}`, source: intake ? `Form 1, ${fmtDate(intake.filedAt)}` : 'Patient file' },
      ...sessions.filter(entry => (entry.values.riskFlags || []).some(flag => flag !== 'None')).map(entry => ({ text: `Flagged in session ${entry.values.sessionNo || ''}: ${entry.values.riskFlags.join(', ')}; escalated to ${entry.values.escalatedTo || 'not recorded'}.`, source: `Form 3, ${fmtDate(entry.values.date || entry.filedAt)}` }))
    ] },
    { title: 'Treatment', lines: plan ? [
      { text: `Goals: ${plan.values.goals || 'not recorded'}`, source: `Form 2, ${fmtDate(plan.filedAt)}` },
      { text: `Modalities: ${(plan.values.modalities || []).join(', ') || 'not recorded'}. Family involvement: ${plan.values.familyInvolvement || 'not recorded'}.`, source: `Form 2, ${fmtDate(plan.filedAt)}` },
      ...(plan.values.reviews || []).map(review => ({ text: `Review: ${review.moved} ${review.changes}`, source: `Form 2 review, ${fmtDate(review.date)}` }))
    ] : [] },
    { title: 'Engagement', lines: [
      { text: `${sessions.length} individual session${sessions.length === 1 ? '' : 's'} noted; ${sessions.filter(entry => entry.values.attendance === 'Attended').length} attended.`, source: 'Form 3' },
      { text: `Groups: present at ${groupRows.filter(row => row.present).length} of ${groupRows.length}.`, source: 'Form 4' },
      ...sessions.slice(-3).map(entry => ({ text: `Session ${entry.values.sessionNo || ''}: ${entry.values.themes || 'themes not recorded'}`, source: `Form 3, ${fmtDate(entry.values.date || entry.filedAt)}` })),
      ...(fitness.attendancePct !== null ? [{ text: `Fitness attendance ${fitness.attendancePct}%, wellbeing average ${fitness.wellbeingAvg ?? '—'} out of 5.`, source: 'Fitness forms 2 and 4' }] : [])
    ] },
    { title: 'Medical', lines: [
      ...orders.map(order => ({ text: `${order.drug} ${order.dose}, ${order.times.join(' and ')}.`, source: 'Medication rounds' })),
      ...tests.map(test => ({ text: `Drug screen ${test.result.toLowerCase()}${test.substances.length ? ` (${test.substances.join(', ')})` : ''}.`, source: `Drug screen, ${fmtDate(test.date)}` }))
    ] },
    { title: 'Incidents', lines: incidents.map(item => ({ text: `Level ${item.level} ${item.type.toLowerCase()}: ${item.description}${item.outcome ? ` Outcome: ${item.outcome}` : ''}`, source: `Incident, ${fmtDate(item.date)}` })) },
    { title: 'This week', lines: [{ text: weekSummary(state, patientId, now).brief, source: 'Last 7 days' }] },
    { title: 'Discharge', lines: [{ text: discharge?.status === 'Filed' ? `Discharge plan filed: ${discharge.values.dischargeType}. Follow-up calls at one week, one month and three months.` : 'Discharge plan started at admission, not yet completed.', source: 'Form 7' }] }
  ].filter(section => section.lines.length);

  return { patient, sections, missing, preparedAt: now.toISOString() };
}
