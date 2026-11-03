import assert from 'node:assert/strict';
import { closeLead, reopenLead, replyToLead, conversionRate, CLOSE_REASONS } from '../src/lib/leads.js';
import { runLeaveAlerts, startLeave } from '../src/lib/safety.js';
import { dashboard } from '../src/lib/kpis.js';
import { buildReports, reportHeadlines } from '../src/lib/reports.js';
import { admissionsInsights } from '../src/lib/insights.js';
import { addDays, todayISO } from '../src/lib/dates.js';
import { seed } from '../src/lib/seed.js';

const now = new Date();

// Closing a lead takes a reason from a short list, and a closed lead can be reopened.
{
  const state = seed();
  const lead = state.leads.find(item => item.status === 'New');
  assert.ok(CLOSE_REASONS.includes('Spam') && CLOSE_REASONS.includes('Went elsewhere'));
  assert.throws(() => closeLead(state, lead.id, '', 'melyssa'), /Choose why/);
  assert.throws(() => closeLead(state, lead.id, 'Because', 'melyssa'), /Choose why/);
  closeLead(state, lead.id, 'Wrong number', 'melyssa');
  assert.equal(lead.status, 'Closed');
  assert.equal(lead.closeReason, 'Wrong number');
  reopenLead(state, lead.id, 'melyssa');
  assert.equal(lead.status, 'New', 'back to unanswered when nobody had replied');
  assert.equal(lead.closeReason, undefined);
  replyToLead(state, lead.id, 'Hello, how can we help?', 'melyssa', now);
  closeLead(state, lead.id, 'Not relevant', 'melyssa');
  reopenLead(state, lead.id, 'melyssa');
  assert.equal(lead.status, 'Replied', 'replied leads reopen as replied');
  assert.throws(() => reopenLead(state, lead.id, 'melyssa'), /not closed/);
}

// Late back from leave: Ahmed, Omar and the resident's RSA are alerted once, urgently, when the time passes.
{
  const state = seed();
  const patient = state.patients.find(item => item.status === 'Admitted' && item.assigned?.rsa && !state.leaves.some(leave => leave.patientId === item.id && !leave.returnedAt));
  const out = new Date(now.getTime() - 5 * 3600000).toISOString();
  const dueBack = new Date(now.getTime() - 3600000).toISOString();
  const leave = startLeave(state, { patientId: patient.id, out, dueBack, escort: 'Brother', reason: 'Family lunch' }, 'melyssa');
  const before = state.notifications.length;
  runLeaveAlerts(state, now);
  const alerts = state.notifications.slice(0, state.notifications.length - before).filter(item => item.title.includes(patient.fullName));
  assert.deepEqual(alerts.map(item => item.to).sort(), ['ahmed', 'omar', patient.assigned.rsa].sort());
  assert.ok(alerts.every(item => item.urgent));
  assert.ok(leave.lateAlerted);
  const count = state.notifications.length;
  runLeaveAlerts(state, now);
  assert.equal(state.notifications.length, count, 'only once');
}

// One definition per figure: lead conversion is leads that became inquiries out of all leads received, in the stated window.
{
  const state = seed();
  const recent = state.leads.filter(lead => todayISO(new Date(lead.receivedAt)) >= addDays(todayISO(now), -30));
  assert.equal(dashboard(state, now).leads.conversionPct, conversionRate(recent).pct);
  const channels = buildReports(state, 'admissions', now).find(table => table.id === 'channels');
  const insight = admissionsInsights(state).channels;
  for (const row of channels.rows) {
    const same = insight.find(item => item.channel === row.channel);
    assert.equal(row.rate, same.rate === null ? '—' : `${same.rate}%`, `${row.channel}: Reports and Insights agree`);
    assert.equal(row.leads, same.leads);
  }
  assert.match(channels.title, /all time/);
  const heads = reportHeadlines(state, 'admissions', now);
  assert.match(heads.find(item => item.label.startsWith('Lead to inquiry')).label + heads.find(item => item.label.startsWith('Lead to inquiry')).note, /30 days/);
  assert.equal(reportHeadlines(state, 'operations', now).find(item => item.label === 'Average stay').note, 'Of patients discharged');
  assert.match(buildReports(state, 'care', now).find(table => table.id === 'notes').title, /all time/);
  assert.match(reportHeadlines(state, 'care', now)[0].note, /30 days/);
}

console.log('Follow-through checks passed.');
