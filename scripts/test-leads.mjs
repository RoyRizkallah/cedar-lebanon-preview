import assert from 'node:assert/strict';
import { CHANNELS, leadStats, replyToLead, convertLead, closeLead } from '../src/lib/leads.js';
import { notify } from '../src/lib/notifications.js';
import { seed } from '../src/lib/seed.js';
import { withSsr } from './lib/ssr.mjs';

const now = new Date();
const state = seed(now);
assert.deepEqual(CHANNELS, ['WhatsApp', 'Instagram', 'Facebook', 'Email', 'Website', 'Phone']);

const stats = leadStats(state, now);
assert.deepEqual(Object.keys(stats.byChannel).sort(), [...CHANNELS].sort());
assert.equal(Object.values(stats.byChannel).reduce((sum, value) => sum + value, 0), state.leads.length);
assert.equal(stats.unanswered, state.leads.filter(lead => lead.status === 'New').length);
assert.equal(typeof stats.medianFirstResponseMins, 'number');

const insta = state.leads.find(lead => lead.channel === 'Instagram' && lead.status === 'New');
replyToLead(state, insta.id, 'Yes, we do. When can we talk?', 'melyssa');
assert.equal(insta.status, 'Replied');
assert.equal(insta.messages.at(-1).delivery, 'Queued on Instagram');
assert.throws(() => replyToLead(state, insta.id, '   ', 'melyssa'), /Write a reply first/);

const email = state.leads.find(lead => lead.channel === 'Email' && lead.status === 'New');
const inquiry = convertLead(state, email.id, { program: 'Detox', potentialRevenue: '' }, 'melyssa');
assert.equal(email.status, 'Converted');
assert.equal(email.inquiryId, inquiry.id);
assert.equal(inquiry.stage, 'New Inquiry');
assert.equal(inquiry.potentialRevenue, 0);
assert.equal(inquiry.source, 'Email');
assert.equal(inquiry.name, email.name);
assert.throws(() => convertLead(state, email.id, {}, 'melyssa'), /already an inquiry/);

const spam = state.leads.find(lead => lead.status === 'New');
closeLead(state, spam.id, 'Not relevant', 'melyssa');
assert.equal(spam.status, 'Closed');

const sent = notify(state, { to: ['ahmed', 'melyssa', 'ahmed'], title: 'Urgent inquiry', link: '#/pipeline', urgent: true });
assert.equal(sent.length, 2);
assert.deepEqual(sent[0].channels, ['In-app', 'Email (queued)', 'WhatsApp (queued)']);

await withSsr(async ({ load, html }) => {
  const { session } = await load('/src/lib/store.svelte.js');
  session.staffId = 'melyssa';
  const page = await html('/src/pages/Leads.svelte', { args: [] });
  for (const text of ['Leads', 'Unanswered', 'WhatsApp', 'Instagram', 'Nour Zein']) assert.ok(page.includes(text), text);
});

console.log('Lead checks passed.');
