// Cedar Intelligence (preview): admissions observations calculated from the records. No model is used;
// the live version would add an AI explanation on top of these same verified figures.
import { hoursBetween } from './dates.js';
import { CHANNELS, conversionRate } from './leads.js';
import { STAGES, potentialTotals, isOpen } from './pipeline.js';

const median = values => { if (!values.length) return null; const s = [...values].sort((a, b) => a - b); const m = Math.floor(s.length / 2); return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };
const days = hours => Math.round((hours / 24) * 10) / 10;

export function admissionsInsights(state) {
  const channels = CHANNELS.map(channel => {
    const leads = state.leads.filter(lead => lead.channel === channel);
    const { converted, pct } = conversionRate(leads);
    const replies = leads.map(lead => { const reply = lead.messages.find(m => m.from === 'staff'); return reply ? (new Date(reply.at) - new Date(lead.receivedAt)) / 60000 : null; }).filter(v => v !== null);
    return { channel, leads: leads.length, converted, rate: pct, reply: median(replies) };
  });
  const stageTime = STAGES.slice(0, -1).map((stage, index) => {
    const spans = state.inquiries.map(inquiry => {
      const from = inquiry.stageHistory.find(step => step.stage === stage);
      const to = inquiry.stageHistory.find(step => step.stage === STAGES[index + 1]);
      return from && to ? hoursBetween(from.at, to.at) : null;
    }).filter(v => v !== null);
    return { from: stage, to: STAGES[index + 1], medianDays: spans.length ? days(median(spans)) : null, count: spans.length };
  });
  const declined = state.inquiries.filter(item => item.outcome === 'Declined');
  const dropStage = STAGES.map(stage => ({ stage, count: declined.filter(item => item.stage === stage).length })).sort((a, b) => b.count - a.count)[0];
  const open = state.inquiries.filter(isOpen);
  const demand = Object.entries(open.reduce((acc, item) => ({ ...acc, [item.program]: (acc[item.program] || 0) + 1 }), {})).sort((a, b) => b[1] - a[1])[0];
  const best = channels.filter(row => row.rate !== null && row.leads >= 2).sort((a, b) => b.rate - a.rate)[0];
  const slowest = channels.filter(row => row.reply !== null).sort((a, b) => b.reply - a.reply)[0];
  const waiting = state.leads.filter(lead => lead.status === 'New');
  const potential = potentialTotals(state);
  const noPhone = open.filter(item => item.commPreference === 'Not comfortable talking on the phone').length;

  const observations = [];
  if (best) observations.push({ tone: 'ok', text: `${best.channel} converts best: ${best.converted} of ${best.leads} leads became inquiries (${best.rate}%).`, source: 'Leads' });
  if (slowest) observations.push({ tone: slowest.reply > 60 ? 'warn' : '', text: `Slowest first reply is on ${slowest.channel}, a median of ${Math.round(slowest.reply)} minutes.`, source: 'Leads' });
  if (waiting.length) observations.push({ tone: 'urgent', text: `${waiting.length} lead${waiting.length === 1 ? ' is' : 's are'} still waiting for a first reply.`, source: 'Leads' });
  const firstStep = stageTime[0];
  if (firstStep.medianDays !== null) observations.push({ tone: firstStep.medianDays > 2 ? 'warn' : 'ok', text: `Inquiries take a median of ${firstStep.medianDays} days to reach Assessment${firstStep.medianDays > 2 ? ', longer than the 48-hour review window' : ''}.`, source: 'Pipeline' });
  if (dropStage?.count) observations.push({ tone: 'warn', text: `Most declines happen in ${dropStage.stage} (${dropStage.count} of ${declined.length}).`, source: 'Pipeline' });
  if (demand) observations.push({ tone: '', text: `${demand[0]} is the most requested program among open inquiries (${demand[1]} of ${open.length}).`, source: 'Pipeline' });
  if (noPhone) observations.push({ tone: '', text: `${noPhone} open ${noPhone === 1 ? 'inquiry prefers' : 'inquiries prefer'} not to talk on the phone; follow up by message.`, source: 'Pipeline' });
  observations.push({ tone: 'ok', text: `$${potential.combined.toLocaleString('en-US')} a month is in play across New Inquiry and Assessment, with $${potential.agreement.toLocaleString('en-US')} more in Agreement.`, source: 'Pipeline' });

  return { channels, stageTime, observations };
}
