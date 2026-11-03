// One inbox for every channel people reach Cedar Rehab on.
import { createInquiry } from './pipeline.js';
import { log } from './activity.js';
import { todayISO } from './dates.js';

export const CHANNELS = ['WhatsApp', 'Instagram', 'Facebook', 'Email', 'Website', 'Phone'];
export const LEAD_STATUSES = ['New', 'Replied', 'Converted', 'Closed'];
export const CLOSE_REASONS = ['Not relevant', 'Spam', 'Wrong number', 'Went elsewhere', 'Duplicate', 'Other'];

const find = (state, id) => {
  const lead = state.leads.find(item => item.id === id);
  if (!lead) throw new Error('This lead was not found.');
  return lead;
};

export function replyToLead(state, id, text, staffId, now = new Date()) {
  const lead = find(state, id);
  const body = String(text || '').trim();
  if (!body) throw new Error('Write a reply first.');
  lead.messages.push({ from: 'staff', by: staffId, at: now.toISOString(), text: body, delivery: `Queued on ${lead.channel}` });
  if (lead.status === 'New') lead.status = 'Replied';
  log(state, staffId, `Replied to ${lead.name} on ${lead.channel}`, `#/leads/${id}`);
  return lead;
}

export function convertLead(state, id, fields, staffId, now = new Date()) {
  const lead = find(state, id);
  if (lead.inquiryId) throw new Error('This lead is already an inquiry.');
  const contact = lead.handle || '';
  const inquiry = createInquiry(state, {
    name: lead.name, source: lead.channel, leadId: lead.id,
    phone: /^\+?\d[\d\s]+$/.test(contact) ? contact : '', email: contact.includes('@') && !contact.startsWith('@') ? contact : '',
    commPreference: lead.channel === 'WhatsApp' ? 'WhatsApp' : lead.channel === 'Email' ? 'Email' : undefined,
    ...fields
  }, staffId, now);
  Object.assign(lead, { status: 'Converted', inquiryId: inquiry.id });
  return inquiry;
}

export function closeLead(state, id, reason, staffId) {
  const lead = find(state, id);
  if (!CLOSE_REASONS.includes(reason)) throw new Error('Choose why this lead is closing.');
  if (lead.status === 'Converted') throw new Error('This lead is already an inquiry.');
  Object.assign(lead, { status: 'Closed', closeReason: reason, closedBy: staffId });
  log(state, staffId, `Closed lead from ${lead.name}: ${reason.toLowerCase()}`, `#/leads/${id}`);
  return lead;
}

// A lead closed by mistake comes back as it was: unanswered, or answered.
export function reopenLead(state, id, staffId) {
  const lead = find(state, id);
  if (lead.status !== 'Closed') throw new Error('This lead is not closed.');
  lead.status = lead.messages.some(message => message.from === 'staff') ? 'Replied' : 'New';
  delete lead.closeReason;
  delete lead.closedBy;
  log(state, staffId, `Reopened lead from ${lead.name}`, `#/leads/${id}`);
  return lead;
}

// Lead to inquiry, everywhere: leads that became inquiries out of all leads received in the window.
export function conversionRate(leads) {
  const converted = leads.filter(lead => lead.status === 'Converted').length;
  return { leads: leads.length, converted, pct: leads.length ? Math.round((converted / leads.length) * 100) : null };
}

const firstReplyMinutes = lead => {
  const first = lead.messages.find(message => message.from === 'staff');
  return first ? (new Date(first.at) - new Date(lead.receivedAt)) / 60000 : null;
};

export function leadStats(state, now = new Date()) {
  const today = todayISO(now);
  const byChannel = Object.fromEntries(CHANNELS.map(channel => [channel, 0]));
  for (const lead of state.leads) byChannel[lead.channel] = (byChannel[lead.channel] || 0) + 1;
  const times = state.leads.map(firstReplyMinutes).filter(value => value !== null).sort((a, b) => a - b);
  const median = times.length ? (times.length % 2 ? times[(times.length - 1) / 2] : (times[times.length / 2 - 1] + times[times.length / 2]) / 2) : null;
  return {
    today: state.leads.filter(lead => todayISO(new Date(lead.receivedAt)) === today).length,
    unanswered: state.leads.filter(lead => lead.status === 'New').length,
    medianFirstResponseMins: median === null ? null : Math.round(median),
    converted: state.leads.filter(lead => lead.status === 'Converted').length,
    byChannel
  };
}

export const lastMessage = lead => lead.messages.at(-1);
