import assert from 'node:assert/strict';
import { buildJournal, trialBalance, totals, bankJournalLines, payerBalances, invoiceStatus, openBalance, createInvoice, invoiceMonth, recordPayment, voidInvoice, createExpense, approveExpense, payExpense, addManualEntry, matchBank } from '../src/lib/finance.js';
import { seed } from '../src/lib/seed.js';

const now = new Date('2026-11-02T10:00:00');
const state = seed(now);
const balanced = journal => journal.every(item => Math.round(item.lines.reduce((s, l) => s + l.debit * 100, 0)) === Math.round(item.lines.reduce((s, l) => s + l.credit * 100, 0)));

// Ported rules: every entry balances, the trial balance agrees, pending expenses never post.
let journal = buildJournal(state);
assert.ok(journal.length > 10);
assert.ok(balanced(journal));
const trial = trialBalance(journal);
assert.equal(Math.round(trial.reduce((s, r) => s + r.debit * 100, 0)), Math.round(trial.reduce((s, r) => s + r.credit * 100, 0)));
const pending = state.finance.expenses.find(item => item.status === 'Pending approval');
assert.ok(pending && !journal.some(item => item.id === `J-EXP-${pending.id}`), 'pending expense must not post');
const openSum = state.finance.invoices.filter(item => item.status !== 'Void').reduce((s, item) => s + openBalance(item), 0);
assert.equal(totals(journal).receivables, openSum);
assert.equal(payerBalances(state).reduce((s, row) => s + row.open, 0), openSum);

// Invoicing from the agreed monthly amount, once per month.
const patient = state.patients.find(item => item.status === 'Admitted' && item.monthlyAmount);
const fresh = state.patients.find(item => item.status === 'Admitted' && item.id !== patient.id && !state.finance.invoices.some(inv => inv.patientId === item.id && inv.issued.startsWith('2026-12')));
assert.throws(() => invoiceMonth(state, fresh.id, '2026-12', 'melyssa'), /handled by Amer, Rabih or Kteish/);
const december = invoiceMonth(state, fresh.id, '2026-12', 'kteish');
assert.equal(december.amount, fresh.monthlyAmount);
assert.equal(december.due, '2026-12-08');
assert.match(december.description, /December 2026 program fee/);
assert.throws(() => invoiceMonth(state, fresh.id, '2026-12', 'kteish'), /already invoiced for December 2026/);
assert.throws(() => createInvoice(state, { patientId: patient.id, amount: 0, payer: 'Self-pay' }, 'kteish'), /Enter an amount/);
assert.throws(() => createInvoice(state, { patientId: patient.id, amount: 100, payer: 'Self-pay' }, 'john'), /Finance is handled by Amer, Rabih or Kteish/);

// Payments: never more than what is open; status follows.
assert.equal(invoiceStatus(december, '2026-12-01'), 'Due');
assert.throws(() => recordPayment(state, december.id, { amount: december.amount + 1, method: 'Cash', date: '2026-12-02' }, 'kteish'), /more than the open balance/);
recordPayment(state, december.id, { amount: 1000, method: 'Bank transfer', date: '2026-12-02', reference: 'TRF-1' }, 'kteish');
assert.equal(invoiceStatus(december, '2026-12-03'), 'Part-paid');
assert.equal(invoiceStatus(december, '2026-12-20'), 'Overdue');
assert.throws(() => voidInvoice(state, december.id, 'Mistake', 'kteish'), /has payments/);
recordPayment(state, december.id, { amount: december.amount - 1000, method: 'Cash', date: '2026-12-05' }, 'kteish');
assert.equal(invoiceStatus(december, '2026-12-20'), 'Paid');
journal = buildJournal(state);
assert.ok(journal.some(item => item.kind === 'Receipt' && item.lines.some(line => line.account === '1020')), 'cash receipts post to cash on hand');

// Void reverses revenue and receivable.
const unpaid = createInvoice(state, { patientId: patient.id, amount: 750, payer: 'Self-pay', description: 'Extra therapy' }, 'rabih', now);
const before = totals(buildJournal(state)).receivables;
voidInvoice(state, unpaid.id, 'Billed in error', 'rabih');
journal = buildJournal(state);
assert.ok(journal.some(item => item.id === `J-VOID-${unpaid.id}`));
assert.equal(totals(journal).receivables, before - 750);

// Expenses post when approved and clear payables when paid.
const bill = createExpense(state, { supplier: 'Beirut Pharma', description: 'Detox kits', category: '5100', amount: 420, date: '2026-11-01', due: '2026-11-15' }, 'kteish');
assert.equal(bill.status, 'Pending approval');
assert.throws(() => approveExpense(state, bill.id, 'kteish'), /approved by Amer or Rabih/);
approveExpense(state, bill.id, 'rabih');
payExpense(state, bill.id, { amount: 420, method: 'Bank transfer', date: '2026-11-03', reference: 'BNK-77' }, 'kteish');
assert.equal(bill.status, 'Paid');
journal = buildJournal(state);
assert.ok(bankJournalLines(journal).some(line => line.reference === 'BNK-77' && line.amount === -420));

// Manual entries must use two different accounts; the books still balance.
assert.throws(() => addManualEntry(state, { debitAccount: '1010', creditAccount: '1010', amount: 10, description: 'x' }, 'rabih'), /two different accounts/);
addManualEntry(state, { date: '2026-11-02', debitAccount: '5500', creditAccount: '1020', amount: 35, description: 'Petty cash: stationery' }, 'rabih');
assert.ok(balanced(buildJournal(state)));

// Bank statement lines match journal entries one to one.
const line = state.finance.bankEntries.find(item => !item.matchedJournalId);
const target = bankJournalLines(buildJournal(state)).find(item => item.amount === line.amount) || bankJournalLines(buildJournal(state))[0];
matchBank(state, line.id, target.id, 'kteish');
assert.equal(line.matchedJournalId, target.id);

console.log('Finance checks passed.');
