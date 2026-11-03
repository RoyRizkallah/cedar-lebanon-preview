// Every report is a plain table: title, columns, rows. The page renders it, prints it, and exports it as CSV.
import { addDays, daysBetween, todayISO, localDay } from './dates.js';
import { CHANNELS } from './leads.js';
import { STAGES, PROGRAMS } from './pipeline.js';
import { riskLevel } from './forms/engine.js';
import { buildJournal, trialBalance, payerBalances, openBalance, invoiceStatus, paidOf } from './finance.js';
import { INCIDENT_TYPES } from './safety.js';
import { staffName } from './people.js';
import { dashboard } from './kpis.js';
import { patientsOn, programBookings } from './programs.js';

const pct = (part, whole) => (whole ? `${Math.round((part / whole) * 100)}%` : '—');
const money = value => Math.round(value);

export const REPORT_GROUPS = [
  { id: 'operations', label: 'Operations', staff: ['gm', 'director', 'admin', 'ops'] },
  { id: 'admissions', label: 'Admissions', staff: ['gm', 'director', 'admin'] },
  { id: 'care', label: 'Care delivery', staff: ['director', 'clinical-director'] },
  { id: 'finance', label: 'Finance', staff: ['gm', 'finance'] }
];

function months(today, count = 6) {
  const out = [];
  let cursor = `${today.slice(0, 7)}-01`;
  for (let i = 0; i < count; i++) { out.unshift(cursor.slice(0, 7)); cursor = addDays(cursor, -1).slice(0, 7) + '-01'; }
  return out;
}
const monthName = month => new Date(`${month}-01T12:00:00`).toLocaleDateString('en-GB', { month: 'short', year: 'numeric' });

export function buildReports(state, group, now = new Date()) {
  const today = todayISO(now);
  const recent = months(today);
  const tables = [];

  if (group === 'operations') {
    tables.push({ id: 'census-month', title: 'Admissions and discharges by month', columns: [{ label: 'Month', value: 'month' }, { label: 'Admitted', value: 'admitted' }, { label: 'Discharged', value: 'discharged' }, { label: 'Average stay of discharges (days)', value: 'stay' }],
      rows: recent.map(month => {
        const out = state.patients.filter(p => p.dischargedAt?.startsWith(month));
        return { month: monthName(month), admitted: state.patients.filter(p => p.admittedAt.startsWith(month)).length, discharged: out.length, stay: out.length ? Math.round(out.reduce((s, p) => s + daysBetween(p.admittedAt, p.dischargedAt), 0) / out.length) : '—' };
      }) });
    tables.push({ id: 'programs', title: 'Patients in care by program', columns: [{ label: 'Program', value: 'program' }, { label: 'Patients', value: 'count' }, { label: 'Agreed per month (USD)', value: 'amount' }],
      rows: PROGRAMS.map(program => { const list = state.patients.filter(p => p.status === 'Admitted' && p.program === program); return { program, count: list.length, amount: money(list.reduce((s, p) => s + Number(p.monthlyAmount || 0), 0)) }; }) });
    tables.push({ id: 'rooms', title: 'Rooms', columns: [{ label: 'Room', value: 'room' }, { label: 'Floor', value: 'wing' }, { label: 'Beds', value: 'beds' }, { label: 'Occupied', value: 'occupied' }, { label: 'Status', value: 'status' }],
      rows: state.rooms.map(room => ({ room: room.id, wing: room.wing || 'Ground', beds: room.beds, occupied: state.patients.filter(p => p.status === 'Admitted' && p.roomId === room.id).length, status: room.status || 'Ready' })) });
  }

  if (group === 'admissions') {
    tables.push({ id: 'channels', title: 'Leads by channel', columns: [{ label: 'Channel', value: 'channel' }, { label: 'Leads', value: 'leads' }, { label: 'Became inquiries', value: 'converted' }, { label: 'Conversion', value: 'rate' }],
      rows: CHANNELS.map(channel => { const list = state.leads.filter(l => l.channel === channel); const converted = list.filter(l => l.status === 'Converted').length; return { channel, leads: list.length, converted, rate: pct(converted, list.length) }; }) });
    tables.push({ id: 'funnel', title: 'Inquiries by furthest stage', columns: [{ label: 'Stage', value: 'stage' }, { label: 'Reached', value: 'count' }, { label: 'Of all inquiries', value: 'share' }],
      rows: [...STAGES, 'Admitted'].map(stage => { const count = state.inquiries.filter(i => stage === 'Admitted' ? i.outcome === 'Admitted' : i.stageHistory.some(step => step.stage === stage)).length; return { stage, count, share: pct(count, state.inquiries.length) }; }) });
    tables.push({ id: 'sources', title: 'Admissions by source', columns: [{ label: 'Source', value: 'source' }, { label: 'Inquiries', value: 'inquiries' }, { label: 'Admitted', value: 'admitted' }, { label: 'Declined', value: 'declined' }, { label: 'Admission rate', value: 'rate' }],
      rows: [...new Set(state.inquiries.map(i => i.source))].map(source => { const list = state.inquiries.filter(i => i.source === source); const admitted = list.filter(i => i.outcome === 'Admitted').length; return { source, inquiries: list.length, admitted, declined: list.filter(i => i.outcome === 'Declined').length, rate: pct(admitted, list.length) }; }) });
  }

  if (group === 'care') {
    const sessions = state.appointments.filter(a => ['Psychologist session', 'Therapist session'].includes(a.service) && a.status === 'Completed');
    tables.push({ id: 'notes', title: 'Session notes by clinician', columns: [{ label: 'Clinician', value: 'who' }, { label: 'Completed sessions', value: 'sessions' }, { label: 'Notes filed', value: 'filed' }, { label: 'Filed within 24 hours', value: 'onTime' }],
      rows: ['clinical-director', 'nabila'].map(id => {
        const list = sessions.filter(a => a.provider === id);
        const notes = list.map(a => state.forms.find(f => f.id === a.noteFormId)).filter(f => f?.status === 'Filed');
        const onTime = list.filter(a => { const f = state.forms.find(x => x.id === a.noteFormId); return f?.filedAt && (new Date(f.filedAt) - new Date(a.completedAt)) / 3600000 <= 24; }).length;
        return { who: staffName(id), sessions: list.length, filed: notes.length, onTime: pct(onTime, list.length) };
      }) });
    tables.push({ id: 'risk', title: 'Risk across patients in care', columns: [{ label: 'Rating', value: 'level' }, { label: 'Patients', value: 'count' }],
      rows: ['High', 'Medium', 'Low', 'Not assessed'].map(level => ({ level, count: state.patients.filter(p => p.status === 'Admitted' && (riskLevel(state, p.id) || 'Not assessed') === level).length })) });
    tables.push({ id: 'incidents', title: 'Incidents by type', columns: [{ label: 'Type', value: 'type' }, { label: 'Reported', value: 'count' }, { label: 'Open', value: 'open' }],
      rows: INCIDENT_TYPES.map(type => ({ type, count: state.incidents.filter(i => i.type === type).length, open: state.incidents.filter(i => i.type === type && i.status === 'Open').length })).filter(row => row.count) });
    tables.push({ id: 'screens', title: 'Drug screens', columns: [{ label: 'Result', value: 'result' }, { label: 'Screens', value: 'count' }],
      rows: ['Negative', 'Positive'].map(result => ({ result, count: (state.medication?.tests || []).filter(t => t.result === result).length })) });
    tables.push({ id: 'care-programs', title: 'Treatment programs', columns: [{ label: 'Program', value: 'program' }, { label: 'Built by', value: 'by' }, { label: 'Patients on it', value: 'patients' }, { label: 'Sessions booked ahead', value: 'booked' }, { label: 'Need a time', value: 'missing' }],
      rows: state.programs.filter(item => item.status === 'Active').map(program => {
        const on = patientsOn(state, program.id);
        return { program: program.name, by: staffName(program.createdBy), patients: on.length, booked: on.reduce((sum, item) => sum + programBookings(state, item).filter(entry => entry.date >= today).length, 0), missing: on.reduce((sum, item) => sum + (item.conflicts || []).filter(entry => entry.date >= today).length, 0) };
      }) });
    const doses = state.medication?.doses || [];
    tables.push({ id: 'doses', title: 'Medication rounds', columns: [{ label: 'Outcome', value: 'status' }, { label: 'Doses', value: 'count' }, { label: 'Share', value: 'share' }],
      rows: ['Given', 'Refused', 'Missed', 'Held'].map(status => ({ status, count: doses.filter(d => d.status === status).length, share: pct(doses.filter(d => d.status === status).length, doses.length) })) });
  }

  if (group === 'finance') {
    const invoices = state.finance.invoices.filter(i => i.status !== 'Void');
    tables.push({ id: 'billing', title: 'Billing by month', columns: [{ label: 'Month', value: 'month' }, { label: 'Invoiced (USD)', value: 'billed' }, { label: 'Collected (USD)', value: 'collected' }, { label: 'Still open (USD)', value: 'open' }],
      rows: recent.map(month => { const list = invoices.filter(i => i.issued.startsWith(month)); return { month: monthName(month), billed: money(list.reduce((s, i) => s + i.amount, 0)), collected: money(list.reduce((s, i) => s + paidOf(i), 0)), open: money(list.reduce((s, i) => s + openBalance(i), 0)) }; }) });
    const buckets = [['Not yet due', -Infinity, 0], ['1–30 days late', 1, 30], ['31–60 days late', 31, 60], ['Over 60 days late', 61, Infinity]];
    tables.push({ id: 'aging', title: 'What is owed, by age', columns: [{ label: 'Age', value: 'label' }, { label: 'Invoices', value: 'count' }, { label: 'Open (USD)', value: 'open' }],
      rows: buckets.map(([label, from, to]) => { const list = invoices.filter(i => openBalance(i) > 0 && daysBetween(i.due, today) >= from && daysBetween(i.due, today) <= to); return { label, count: list.length, open: money(list.reduce((s, i) => s + openBalance(i), 0)) }; }) });
    tables.push({ id: 'payers', title: 'Balances by payer', columns: [{ label: 'Payer', value: 'name' }, { label: 'Billed (USD)', value: 'billed' }, { label: 'Received (USD)', value: 'received' }, { label: 'Open (USD)', value: 'open' }], rows: payerBalances(state, today) });
    tables.push({ id: 'pnl', title: 'Income and expenses (all time)', columns: [{ label: 'Account', value: 'name' }, { label: 'Type', value: 'type' }, { label: 'Amount (USD)', value: 'amount' }],
      rows: trialBalance(buildJournal(state)).filter(row => ['Revenue', 'Expense'].includes(row.type)).map(row => ({ name: row.name, type: row.type, amount: money(Math.abs(row.balance)) })) });
  }
  return tables.map(table => (CHARTS[table.id] ? { ...table, chart: CHARTS[table.id] } : table));
}

// The measure each report draws as bars beside its table.
const CHARTS = { 'census-month': 'admitted', programs: 'count', 'care-programs': 'patients', rooms: 'occupied', channels: 'leads', funnel: 'count', sources: 'inquiries', notes: 'sessions', risk: 'count', incidents: 'count', screens: 'count', doses: 'count', billing: 'billed', aging: 'open', payers: 'open', pnl: 'amount' };

// Four headline figures per group, from the same numbers as the dashboard.
const usd = value => `$${Math.round(value).toLocaleString('en-US')}`;
const percent = value => (value === null || value === undefined ? '—' : `${value}%`);
export function reportHeadlines(state, group, now = new Date()) {
  const k = dashboard(state, now);
  const heads = {
    operations: [
      { label: 'In care', value: String(k.census.admitted), note: `${k.census.occupied} of ${k.census.beds} beds in use` },
      { label: 'Occupancy', value: percent(k.census.occupancyPct), note: 'Beds in use now' },
      { label: 'Admitted this month', value: String(k.census.admissionsThisMonth), note: `${k.census.dischargesThisMonth} discharged` },
      { label: 'Average stay', value: k.census.averageStayDays === null ? '—' : `${k.census.averageStayDays} days`, note: 'Of patients in care' }
    ],
    admissions: [
      { label: 'Leads, 30 days', value: String(k.leads.last30), note: `${k.leads.unanswered} still unanswered`, tone: k.leads.unanswered ? 'warn' : undefined },
      { label: 'Lead to inquiry', value: percent(k.leads.conversionPct), note: `Median first reply ${k.leads.medianFirstResponseMins ?? '—'} min` },
      { label: 'Inquiry to admission', value: percent(k.pipeline.admittedPct), note: 'Last 90 days' },
      { label: 'Potential in play', value: usd(k.pipeline.potential.combined), note: 'Per month, inquiry and assessment' }
    ],
    care: [
      { label: 'Notes within 24 h', value: percent(k.clinical.notesOnTimePct), note: `Of ${k.clinical.sessions} sessions` },
      { label: 'Elevated risk', value: String(k.clinical.elevatedRisk), note: 'Medium or high, in care', tone: k.clinical.elevatedRisk ? 'warn' : undefined },
      { label: 'Open incidents', value: String(k.safety.openIncidents), note: `${k.safety.incidents30} in 30 days`, tone: k.safety.openIncidents ? 'urgent' : undefined },
      { label: 'Positive screens', value: String(k.safety.positiveScreens30), note: 'Last 30 days', tone: k.safety.positiveScreens30 ? 'urgent' : undefined }
    ],
    finance: [
      { label: 'Invoiced this month', value: usd(k.money.invoicedThisMonth), note: 'Net of voids' },
      { label: 'Collected this month', value: usd(k.money.collectedThisMonth), note: `${percent(k.money.collectionPct)} of all billing collected` },
      { label: 'Owed to Cedar', value: usd(k.money.owed), note: 'Open balance on invoices' },
      { label: 'Overdue', value: usd(k.money.overdue), note: `${k.money.overdueCount} invoices past due`, tone: k.money.overdue > 0 ? 'urgent' : undefined }
    ]
  };
  return heads[group] || [];
}

// Overdue invoice count for the reports header.
export const overdueCount = (state, today) => state.finance.invoices.filter(i => invoiceStatus(i, today) === 'Overdue').length;
export const lastActivity = state => state.activity[0] ? localDay(state.activity[0].at) : '';
