import assert from 'node:assert/strict';
import { dashboard } from '../src/lib/kpis.js';
import { tasksFor } from '../src/lib/tasks.js';
import { potentialTotals } from '../src/lib/pipeline.js';
import { seed } from '../src/lib/seed.js';
import { openBalance } from '../src/lib/finance.js';
import { completeStep } from '../src/lib/admission.js';
import { withSsr } from './lib/ssr.mjs';

const now = new Date('2026-11-02T12:00:00');
const at = (day, time = '10:00') => new Date(`${day}T${time}:00`).toISOString();
const base = () => ({ leads: [], inquiries: [], onboardings: [], patients: [], rooms: [], appointments: [], forms: [], documents: [], wallet: { transactions: [] }, requests: [], tasks: [], notifications: [], activity: [] });

// Occupancy counts beds held by admitted patients.
const census = base();
census.rooms = [{ id: '101', beds: 2 }, { id: '102', beds: 2 }];
census.patients = [
  { id: 'P-1', status: 'Admitted', roomId: '101', bed: 1, admittedAt: '2026-10-20', monthlyAmount: 6000 },
  { id: 'P-2', status: 'Admitted', roomId: '101', bed: 2, admittedAt: '2026-11-01', monthlyAmount: 3500 },
  { id: 'P-3', status: 'Admitted', roomId: '102', bed: 1, admittedAt: '2026-09-01', monthlyAmount: 6000 },
  { id: 'P-4', status: 'Discharged', roomId: '', admittedAt: '2026-08-01', dischargedAt: '2026-09-10', monthlyAmount: 6000 },
  { id: 'P-5', status: 'Discharged', roomId: '', admittedAt: '2026-09-01', dischargedAt: '2026-10-21', monthlyAmount: 6000 }
];
let kpi = dashboard(census, now);
assert.equal(kpi.census.occupancyPct, 75);
assert.equal(kpi.census.admitted, 3);
assert.equal(kpi.census.admissionsThisMonth, 1);
assert.equal(kpi.census.averageStayDays, 45);
assert.equal(kpi.census.monthlyContracted, 15500);
assert.equal(kpi.aftercare.onTimePct, null, 'no calls due yet gives no percentage');

// Session notes filed within 24 hours of the session.
const notes = base();
notes.appointments = [
  { id: 'A1', service: 'Psychologist session', provider: 'nabila', patientId: 'P-1', date: '2026-10-28', start: '10:00', minutes: 50, status: 'Completed', completedAt: at('2026-10-28', '10:50'), noteFormId: 'F1' },
  { id: 'A2', service: 'Therapist session', provider: 'clinical-director', patientId: 'P-1', date: '2026-10-29', start: '10:00', minutes: 50, status: 'Completed', completedAt: at('2026-10-29', '10:50'), noteFormId: 'F2' },
  { id: 'A3', service: 'Psychologist session', provider: 'nabila', patientId: 'P-1', date: '2026-10-30', start: '10:00', minutes: 50, status: 'Completed', completedAt: at('2026-10-30', '10:50') },
  { id: 'A4', service: 'Fitness session', provider: 'john', patientIds: ['P-1'], date: '2026-10-30', start: '15:00', minutes: 60, status: 'Completed', completedAt: at('2026-10-30', '16:00') }
];
notes.forms = [
  { id: 'F1', formId: 'session', status: 'Filed', filedAt: at('2026-10-28', '18:00'), patientId: 'P-1', values: {} },
  { id: 'F2', formId: 'session', status: 'Filed', filedAt: at('2026-10-31', '18:00'), patientId: 'P-1', values: {} }
];
assert.equal(dashboard(notes, now).clinical.notesOnTimePct, 33);
notes.forms[1].filedAt = at('2026-10-29', '18:00');
assert.equal(dashboard(notes, now).clinical.notesOnTimePct, 67);

// The seeded workspace: pipeline potential and lead channels agree with their sources.
const state = seed(now);
kpi = dashboard(state, now);
assert.deepEqual(kpi.pipeline.potential, potentialTotals(state));
const monthStart = '2026-11-01';
assert.equal(kpi.leads.byChannel.WhatsApp, state.leads.filter(lead => lead.channel === 'WhatsApp' && lead.receivedAt.slice(0, 10) >= '2026-10-03').length);
assert.ok(kpi.census.occupancyPct > 0 && kpi.census.occupancyPct <= 100);
assert.ok(kpi.clinical.notesOnTimePct < 100, 'the missing seeded note lowers the rate');
assert.deepEqual(Object.keys(kpi.aftercare.outcomes), ['Well', 'Struggling', 'Relapsed']);
assert.ok(monthStart);

// Today: a follow-up due today is in "today"; cancelled tasks never show.
state.tasks.push({ id: 'T-9001', kind: 'inquiry-followup', title: 'Follow-up call 1 of 2', owner: 'melyssa', due: '2026-11-02', status: 'open', link: '#/pipeline' });
state.tasks.push({ id: 'T-9002', kind: 'inquiry-followup', title: 'Cancelled call', owner: 'melyssa', due: '2026-11-02', status: 'cancelled', link: '#/pipeline' });
const melyssa = tasksFor(state, 'melyssa', now);
assert.ok(melyssa.today.some(item => item.taskId === 'T-9001'));
assert.ok(![...melyssa.overdue, ...melyssa.today, ...melyssa.upcoming].some(item => item.taskId === 'T-9002'));
assert.ok([...melyssa.overdue, ...melyssa.today].some(item => item.kind === 'review'), 'the 60-hour-old inquiry needs review');
assert.ok(tasksFor(state, 'nabila', now).overdue.some(item => item.kind === 'note'), 'the missing session note is overdue');
assert.ok(tasksFor(state, 'clinical-director', now).overdue.concat(tasksFor(state, 'clinical-director', now).today, tasksFor(state, 'clinical-director', now).upcoming).some(item => item.kind === 'form'), 'Ziad needs an intake');
assert.ok(tasksFor(state, 'georgio', now).today.some(item => item.kind === 'request'));
assert.ok(tasksFor(state, 'fadia', now).today.some(item => item.kind === 'prescription'));

// Money and safety figures agree with their sources.
{
  const fresh = seed(now);
  const k = dashboard(fresh, now);
  assert.equal(k.money.owed, fresh.finance.invoices.filter(i => i.status !== 'Void').reduce((sum, i) => sum + openBalance(i), 0));
  assert.equal(k.safety.openIncidents, fresh.incidents.filter(i => i.status === 'Open').length);
  assert.equal(k.safety.onLeave, 1);
  // Monthly plan review: Hadi's last review was 24 days ago, so it is due within the fortnight.
  const cd = tasksFor(fresh, 'clinical-director', now);
  assert.ok([...cd.today, ...cd.upcoming, ...cd.overdue].some(item => item.title.startsWith('Monthly plan review: Hadi')));
  // A planned arrival shows on Melyssa's Today.
  const hiba = fresh.onboardings.find(item => item.steps.room && !item.steps.room.done && item.steps.nursing.done && item.steps.agreement.done);
  const [room, bed] = [fresh.rooms.find(r => !fresh.patients.some(p => p.status === 'Admitted' && p.roomId === r.id))?.id || '104', 2];
  completeStep(fresh, hiba.id, 'room', { roomId: '104', bed: 2, arrivalDate: '2026-11-02' }, 'melyssa');
  assert.ok(tasksFor(fresh, 'melyssa', now).today.some(item => item.title.startsWith('Arrival:')));
  assert.ok(room && bed);
}

await withSsr(async ({ load, html }) => {
  const { session } = await load('/src/lib/store.svelte.js');
  session.staffId = 'ahmed';
  const page = await html('/src/pages/Dashboard.svelte', { args: [] });
  for (const text of ['Dashboard', 'Potential revenue', 'Combined', 'not in combined', 'Occupancy', 'Session notes on time', 'Leads by channel']) assert.ok(page.includes(text), text);
  session.staffId = 'melyssa';
  assert.ok((await html('/src/pages/Today.svelte', { args: [] })).includes('Good'));
});

console.log('KPI checks passed.');
