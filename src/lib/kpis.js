// Business figures for Ahmed. Percentages are whole numbers; null means there is nothing to measure yet.
import { addDays, daysBetween, hoursBetween, todayISO } from './dates.js';
import { CHANNELS } from './leads.js';
import { STAGES, potentialTotals, reviewDue, isOpen } from './pipeline.js';
import { riskLevel } from './forms/engine.js';
import { invoiceStatus, openBalance, paidOf } from './finance.js';

const pct = (part, whole) => (whole ? Math.round((part / whole) * 100) : null);
const median = values => {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return Math.round(sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2);
};
const dayOf = moment => todayISO(new Date(moment));

export function dashboard(state, now = new Date()) {
  const today = todayISO(now);
  const monthStart = `${today.slice(0, 8)}01`;
  const last30 = addDays(today, -30);
  const last90 = addDays(today, -90);

  const recentLeads = state.leads.filter(lead => dayOf(lead.receivedAt) >= last30);
  const firstReplies = recentLeads.map(lead => {
    const reply = lead.messages.find(message => message.from === 'staff');
    return reply ? (new Date(reply.at) - new Date(lead.receivedAt)) / 60000 : null;
  }).filter(value => value !== null);
  const leads = {
    last30: recentLeads.length,
    byChannel: Object.fromEntries(CHANNELS.map(channel => [channel, recentLeads.filter(lead => lead.channel === channel).length])),
    medianFirstResponseMins: median(firstReplies),
    unanswered: state.leads.filter(lead => lead.status === 'New').length,
    conversionPct: pct(recentLeads.filter(lead => lead.status === 'Converted').length, recentLeads.filter(lead => lead.status !== 'Closed').length)
  };

  const open = state.inquiries.filter(isOpen);
  const cohort = state.inquiries.filter(item => dayOf(item.createdAt) >= last90);
  const pipeline = {
    counts: Object.fromEntries(STAGES.map(stage => [stage, open.filter(item => item.stage === stage).length])),
    potential: potentialTotals(state),
    reviewsOverdue: open.filter(item => reviewDue(item, now)).length,
    urgentOpen: open.filter(item => item.urgency === 'Urgent').length,
    reached: STAGES.map(stage => cohort.filter(item => item.stageHistory.some(step => step.stage === stage)).length).concat(cohort.filter(item => item.outcome === 'Admitted').length),
    admittedPct: pct(cohort.filter(item => item.outcome === 'Admitted').length, cohort.length)
  };

  const admitted = state.patients.filter(patient => patient.status === 'Admitted');
  const discharged = state.patients.filter(patient => patient.status === 'Discharged' && patient.dischargedAt);
  const beds = state.rooms.reduce((sum, room) => sum + Number(room.beds || 0), 0);
  const occupied = admitted.filter(patient => patient.roomId).length;
  const census = {
    admitted: admitted.length, beds, occupied, occupancyPct: pct(occupied, beds),
    admissionsThisMonth: state.patients.filter(patient => patient.admittedAt >= monthStart).length,
    dischargesThisMonth: discharged.filter(patient => patient.dischargedAt >= monthStart).length,
    averageStayDays: discharged.length ? Math.round(discharged.reduce((sum, patient) => sum + daysBetween(patient.admittedAt, patient.dischargedAt), 0) / discharged.length) : null,
    monthlyContracted: admitted.reduce((sum, patient) => sum + Number(patient.monthlyAmount || 0), 0)
  };

  const filed = id => state.forms.filter(entry => entry.formId === id && entry.status === 'Filed');
  const sessions = state.appointments.filter(item => ['Psychologist session', 'Therapist session'].includes(item.service) && item.status === 'Completed' && item.patientId && dayOf(item.completedAt) >= last30);
  const onTime = sessions.filter(item => {
    const note = state.forms.find(entry => entry.id === item.noteFormId);
    return note?.status === 'Filed' && hoursBetween(item.completedAt, note.filedAt) <= 24;
  });
  const intakeCohort = state.patients.filter(patient => patient.admittedAt >= last90 && daysBetween(patient.admittedAt, today) >= 3);
  const clinical = {
    notesOnTimePct: pct(onTime.length, sessions.length),
    sessions: sessions.length,
    plansOverdue: admitted.filter(patient => daysBetween(patient.admittedAt, today) > 7 && !filed('plan').some(entry => entry.patientId === patient.id)).length,
    intakeOnTimePct: pct(intakeCohort.filter(patient => filed('intake').some(entry => entry.patientId === patient.id && daysBetween(patient.admittedAt, dayOf(entry.filedAt)) <= 3)).length, intakeCohort.length),
    elevatedRisk: admitted.filter(patient => ['Medium', 'High'].includes(riskLevel(state, patient.id))).length
  };

  const calls = state.tasks.filter(task => task.kind === 'followup-call' && task.status !== 'cancelled' && task.due < today);
  const outcomes = { Well: 0, Struggling: 0, Relapsed: 0 };
  for (const entry of filed('aftercare')) {
    const latest = (entry.values.contacts || []).filter(row => row.status).at(-1);
    if (latest && latest.status in outcomes) outcomes[latest.status] += 1;
  }
  const aftercare = {
    onTimePct: pct(calls.filter(task => task.status === 'done' && dayOf(task.doneAt) <= task.due).length, calls.length),
    callsDue: calls.length, outcomes
  };

  const rows = filed('attendance').filter(entry => entry.values.date >= last30).flatMap(entry => entry.values.patients || []).filter(row => row.attended !== 'Held');
  const fitness = {
    attendancePct: pct(rows.filter(row => row.attended === 'Attended').length, rows.length),
    injuriesThisMonth: filed('injury').filter(entry => (entry.values.date || '') >= monthStart).length,
    injuries30: filed('injury').filter(entry => (entry.values.date || '') >= last30).length
  };

  const invoices = (state.finance?.invoices || []).filter(item => item.status !== 'Void');
  const overdueList = invoices.filter(item => invoiceStatus(item, today) === 'Overdue');
  const money = {
    invoicedThisMonth: invoices.filter(item => item.issued >= monthStart).reduce((sum, item) => sum + item.amount, 0),
    collectedThisMonth: invoices.flatMap(item => item.payments || []).filter(payment => !payment.reversed && payment.date >= monthStart).reduce((sum, payment) => sum + payment.amount, 0),
    owed: invoices.reduce((sum, item) => sum + openBalance(item), 0),
    overdue: overdueList.reduce((sum, item) => sum + openBalance(item), 0),
    overdueCount: overdueList.length,
    collectionPct: pct(invoices.reduce((sum, item) => sum + paidOf(item), 0), invoices.reduce((sum, item) => sum + item.amount, 0))
  };
  const safety = {
    openIncidents: (state.incidents || []).filter(item => item.status === 'Open').length,
    incidents30: (state.incidents || []).filter(item => item.date >= last30).length,
    positiveScreens30: (state.medication?.tests || []).filter(test => test.result === 'Positive' && test.date >= last30).length,
    onLeave: (state.leaves || []).filter(leave => !leave.returnedAt).length,
    dosesNotGiven7: (state.medication?.doses || []).filter(dose => dose.status !== 'Given' && dose.date >= addDays(today, -7)).length
  };

  return { leads, pipeline, census, clinical, aftercare, fitness, money, safety };
}
