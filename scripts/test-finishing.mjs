import assert from 'node:assert/strict';
import { invoiceMonth, buildJournal, trialBalance, addBankLine, ACCOUNTS } from '../src/lib/finance.js';
import { walletBalanceCents, addWalletDeposit, addWalletPurchase } from '../src/lib/wallet.js';
import { logCall, createInquiry } from '../src/lib/pipeline.js';
import { fileForm } from '../src/lib/forms/engine.js';
import { tasksFor } from '../src/lib/tasks.js';
import { createRequest } from '../src/lib/requests.js';
import { addDays, todayISO } from '../src/lib/dates.js';
import { seed } from '../src/lib/seed.js';
import { withSsr } from './lib/ssr.mjs';

const now = new Date();
const today = todayISO(now);
const balanced = state => trialBalance(buildJournal(state)).reduce((sum, row) => sum + Math.round(row.debit * 100) - Math.round(row.credit * 100), 0) === 0;

// 1. A patient admitted mid-month is billed from their first day, not as overdue from the 1st.
{
  const state = seed();
  const patient = state.patients.find(item => item.status === 'Admitted');
  Object.assign(patient, { admittedAt: '2026-12-16', monthlyAmount: 6000 });
  const invoice = invoiceMonth(state, patient.id, '2026-12', 'kteish');
  assert.equal(invoice.issued, '2026-12-16');
  assert.equal(invoice.due, '2026-12-23');
  assert.equal(invoice.amount, 3097, '16 of 31 days');
  assert.match(invoice.description, /from 16 Dec/);
  const full = invoiceMonth(state, patient.id, '2027-01', 'kteish');
  assert.equal(full.amount, 6000);
  assert.equal(full.issued, '2027-01-01');
}

// 2. Wallet money is held for patients: deposits, purchases and refunds reach the books, which still balance.
{
  const state = seed();
  assert.ok(ACCOUNTS.some(account => account.code === '2200' && account.type === 'Liability'));
  const held = Math.round(trialBalance(buildJournal(state)).find(row => row.code === '2200').balance * 100);
  const wallets = state.patients.reduce((sum, patient) => sum + walletBalanceCents(state, patient.id), 0);
  assert.equal(Math.abs(held), wallets, 'the books hold exactly what the wallets hold');
  const patient = state.patients.find(item => item.status === 'Admitted' && item.program !== 'Outpatient');
  addWalletDeposit(state, { patientId: patient.id, amount: '50.00', description: 'Family deposit', recordedBy: 'melyssa' });
  assert.ok(buildJournal(state).some(entry => entry.kind === 'Wallet' && entry.lines.some(line => line.account === '2200' && line.credit === 50)));
  assert.ok(balanced(state));
}

// 3. Bank statement lines can be added, so reconciliation can go on.
{
  const state = seed();
  const count = state.finance.bankEntries.length;
  assert.throws(() => addBankLine(state, { date: today, description: 'Fee', amount: 0 }, 'kteish'), /amount/);
  assert.throws(() => addBankLine(state, { date: today, description: 'Fee', amount: -12 }, 'melyssa'), /Finance is handled/);
  const line = addBankLine(state, { date: today, description: 'Card terminal fee', amount: -12.5, reference: 'FEE-12' }, 'kteish');
  assert.equal(state.finance.bankEntries.length, count + 1);
  assert.equal(line.amount, -12.5);
  assert.equal(line.matchedJournalId, '');
}

// 4. Logging the call closes the call that was due, so the two records never drift apart.
{
  const state = seed();
  const inquiry = createInquiry(state, { name: 'Walid Saab', phone: '+961 70 101 010' }, 'melyssa', new Date(now.getTime() - 8 * 86400000));
  const due = state.tasks.filter(task => task.inquiryId === inquiry.id && task.status === 'open').sort((a, b) => a.due.localeCompare(b.due));
  assert.ok(due[0].due <= today, 'the first follow-up call is due');
  logCall(state, inquiry.id, { outcome: 'Reached', notes: 'Still thinking' }, 'melyssa', now);
  assert.equal(due[0].status, 'done');
  assert.equal(due[1].status, 'open', 'the later call stays');
  // Aftercare: a reached row on Form 8 closes that call's task.
  const patient = state.patients.find(item => item.status === 'Discharged');
  const task = { id: 'T-AFT', kind: 'followup-call', title: '1 week follow-up call', owner: 'melyssa', due: today, patientId: patient.id, status: 'open', link: '' };
  state.tasks.push(task);
  fileForm(state, { formId: 'aftercare', patientId: patient.id, values: { contacts: [{ contact: '1 week', due: today, madeBy: 'Melyssa', reached: 'Reached', status: 'Well', notes: '' }, { contact: '1 month', due: addDays(today, 23) }, { contact: '3 months', due: addDays(today, 83) }] }, staffId: 'melyssa', final: true });
  assert.equal(task.status, 'done');
}

// 5. Countersigning a case review opens that review.
{
  const state = seed();
  const review = fileForm(state, { formId: 'review', values: { weekOf: today, rows: [] }, staffId: 'ahmed', final: true });
  const sign = tasksFor(state, 'ahmed', now).today.concat(tasksFor(state, 'ahmed', now).overdue).find(item => item.id === `sign-${review.id}`);
  assert.equal(sign?.link, `#/patients/review/${review.id}`);
}

// 6. A wallet too low for what is waiting asks Melyssa to get it topped up.
{
  const state = seed();
  const patient = state.patients.find(item => item.status === 'Admitted' && item.program !== 'Outpatient' && walletBalanceCents(state, item.id) > 2000 && !state.requests.some(request => request.patientId === item.id && ['Open', 'Awaiting approval'].includes(request.status)));
  const spend = walletBalanceCents(state, patient.id) - 500;
  addWalletPurchase(state, { patientId: patient.id, amount: (spend / 100).toFixed(2), description: 'Gym shoes', recordedBy: 'georgio', signature: { at: '2026-11-02T10:00:00Z', name: 'Patient' } });
  assert.ok(!tasksFor(state, 'melyssa', now).today.some(item => item.id === `topup-${patient.id}`), 'nothing waiting yet');
  createRequest(state, { patientId: patient.id, item: 'Notebook', quantity: 1 }, patient.assigned.rsa);
  assert.ok(tasksFor(state, 'melyssa', now).today.some(item => item.id === `topup-${patient.id}`));
}

// 7. Residents fill in their own weekly wellbeing check-in; John sees it.
{
  const state = seed();
  const before = state.notifications.length;
  const entry = fileForm(state, { formId: 'wellbeing', patientId: 'P-0001', values: { weekEnding: today, energy: 4, sleep: 3, mood: 4, activityFeel: 5, teamNote: 'Sleeping better', completedBy: { name: 'Karim Haddad', by: 'resident-p0001', at: now.toISOString() } }, staffId: 'resident-p0001', final: true });
  assert.equal(entry.status, 'Filed');
  assert.throws(() => fileForm(state, { formId: 'wellbeing', patientId: 'P-0002', values: { weekEnding: today, energy: 4 }, staffId: 'resident-p0001', final: true }), /completed by/);
  assert.ok(state.notifications.slice(0, state.notifications.length - before).some(item => item.to === 'john'));
}

await withSsr(async ({ load, html }) => {
  const { session } = await load('/src/lib/store.svelte.js');
  session.staffId = 'resident-p0001';
  assert.ok((await html('/src/pages/Home.svelte', { args: [] })).includes('How was your week'), 'the resident is invited to check in');
});

console.log('Finishing checks passed.');
