import assert from 'node:assert/strict';
import { REPORT_GROUPS, buildReports, reportHeadlines } from '../src/lib/reports.js';
import { dashboard } from '../src/lib/kpis.js';
import { seed } from '../src/lib/seed.js';
import { withSsr } from './lib/ssr.mjs';

const now = new Date();
const state = seed();
const k = dashboard(state, now);

// Each group opens on four headline figures, taken from the same numbers as the dashboard.
for (const group of REPORT_GROUPS) {
  const heads = reportHeadlines(state, group.id, now);
  assert.equal(heads.length, 4, group.id);
  for (const head of heads) assert.ok(head.label && head.value !== undefined && head.note !== undefined, `${group.id}: ${head.label}`);
}
const finance = reportHeadlines(state, 'finance', now);
assert.deepEqual(finance.map(item => item.label), ['Invoiced this month', 'Collected this month', 'Owed to Cedar', 'Overdue']);
assert.equal(finance[0].value, `$${k.money.invoicedThisMonth.toLocaleString('en-US')}`);
assert.equal(finance[3].tone, k.money.overdue > 0 ? 'urgent' : undefined, 'overdue money is flagged');
assert.equal(reportHeadlines(state, 'operations', now)[1].value, `${k.census.occupancyPct}%`);
assert.equal(reportHeadlines(state, 'care', now)[0].value, `${k.clinical.notesOnTimePct}%`);

// Reports with one measure across categories carry a chart of that measure.
const admissions = buildReports(state, 'admissions', now);
assert.equal(admissions.find(table => table.id === 'channels').chart, 'leads');
assert.equal(buildReports(state, 'finance', now).find(table => table.id === 'billing').chart, 'billed');
for (const group of REPORT_GROUPS) {
  for (const table of buildReports(state, group.id, now).filter(item => item.chart)) {
    assert.ok(table.columns.some(column => column.value === table.chart), `${table.id} charts one of its own columns`);
    assert.ok(table.rows.every(row => typeof row[table.chart] === 'number'), `${table.id} charts numbers`);
  }
}

// Care delivery reports on programs: who is on each, and what is booked or still needs a time.
const programs = buildReports(state, 'care', now).find(table => table.id === 'care-programs');
assert.ok(programs, 'programs report');
assert.deepEqual(programs.rows.map(row => row.program), state.programs.filter(item => item.status === 'Active').map(item => item.name));
assert.equal(programs.rows.reduce((sum, row) => sum + row.patients, 0), state.programAssignments.filter(item => item.status === 'Active').length);

await withSsr(async ({ load, html }) => {
  const { session } = await load('/src/lib/store.svelte.js');
  session.staffId = 'amer';
  const page = await html('/src/pages/Reports.svelte', { args: ['finance'] });
  for (const text of ['Invoiced this month', 'Owed to Cedar', 'Billing by month', 'Download all']) assert.ok(page.includes(text), text);
});

console.log('Report checks passed.');
