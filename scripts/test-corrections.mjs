import assert from 'node:assert/strict';
import { createInvoice, recordPayment, reversePayment, voidInvoice, openBalance, createExpense, approveExpense, rejectExpense, buildJournal, trialBalance } from '../src/lib/finance.js';
import { addOrder, recordDose, correctDose, roundFor } from '../src/lib/medication.js';
import { addDays, todayISO } from '../src/lib/dates.js';
import { seed } from '../src/lib/seed.js';
import { dashboard } from '../src/lib/kpis.js';
import { buildReports } from '../src/lib/reports.js';

const now = new Date();
const today = todayISO(now);
const state = seed();
const patient = state.patients.find(item => item.status === 'Admitted');
const balanced = () => trialBalance(buildJournal(state)).reduce((sum, row) => sum + Math.round(row.debit * 100) - Math.round(row.credit * 100), 0) === 0;

// A mistyped payment is reversed with a reason: the receipt stays on record, the books stay balanced, the balance reopens.
{
  const collected = () => dashboard(state, now).money.collectedThisMonth;
  const billingCollected = () => buildReports(state, 'finance', now).find(table => table.id === 'billing').rows.at(-1).collected;
  const startCollected = collected();
  const startBilling = billingCollected();
  const invoice = createInvoice(state, { patientId: patient.id, amount: 1000, payer: 'Family' }, 'kteish', now);
  const payment = recordPayment(state, invoice.id, { amount: 600, method: 'Cash', date: today }, 'kteish');
  assert.equal(openBalance(invoice), 400);
  assert.throws(() => reversePayment(state, invoice.id, payment.id, '', 'kteish'), /reason/);
  assert.throws(() => reversePayment(state, invoice.id, payment.id, 'Typed 600 instead of 60', 'melyssa'), /Finance is handled/);
  reversePayment(state, invoice.id, payment.id, 'Typed 600 instead of 60', 'kteish');
  assert.equal(openBalance(invoice), 1000);
  assert.equal(collected(), startCollected, 'a reversed payment is not money collected');
  assert.equal(billingCollected(), startBilling, 'nor in the billing report');
  assert.ok(invoice.payments.find(item => item.id === payment.id).reversed, 'kept on record');
  assert.ok(buildJournal(state).some(item => item.id === `J-REV-${payment.id}`), 'a reversing entry');
  assert.ok(balanced(), 'the books balance');
  assert.throws(() => reversePayment(state, invoice.id, payment.id, 'again', 'kteish'), /already reversed/);
  recordPayment(state, invoice.id, { amount: 60, method: 'Cash', date: today }, 'kteish');
  assert.equal(openBalance(invoice), 940);
  // Once every payment is reversed, the invoice can be voided.
  const other = createInvoice(state, { patientId: patient.id, amount: 200, payer: 'Family' }, 'kteish', now);
  const wrong = recordPayment(state, other.id, { amount: 200, method: 'Bank transfer', date: today }, 'kteish');
  assert.throws(() => voidInvoice(state, other.id, 'Billed twice', 'kteish'), /has payments/);
  reversePayment(state, other.id, wrong.id, 'Belonged to another invoice', 'kteish');
  voidInvoice(state, other.id, 'Billed twice', 'kteish');
  assert.equal(other.status, 'Void');
  assert.ok(balanced());
}

// A bill can be rejected by Amer or Rabih, with a reason; it never reaches the books.
{
  const bill = createExpense(state, { supplier: 'Wrong Supplier', description: 'Duplicate', category: '5100', amount: 300, date: today }, 'kteish');
  assert.throws(() => rejectExpense(state, bill.id, 'Duplicate of EXP-0002', 'kteish'), /Amer or Rabih/);
  assert.throws(() => rejectExpense(state, bill.id, '', 'rabih'), /reason/);
  rejectExpense(state, bill.id, 'Duplicate of EXP-0002', 'rabih');
  assert.equal(bill.status, 'Rejected');
  assert.ok(!buildJournal(state).some(item => item.id === `J-EXP-${bill.id}`));
  assert.throws(() => approveExpense(state, bill.id, 'rabih'), /not waiting for approval/);
}

// A dose recorded wrongly is corrected with a reason, and the history is kept; doses are never recorded ahead of time.
{
  const order = addOrder(state, { patientId: patient.id, drug: 'Thiamine', dose: '100 mg', route: 'Oral', times: ['08:00'], startDate: addDays(today, -1) }, 'fadia');
  assert.throws(() => recordDose(state, { orderId: order.id, date: addDays(today, 1), time: '08:00', status: 'Given' }, 'fadia', now), /ahead of time/);
  const dose = recordDose(state, { orderId: order.id, date: today, time: '08:00', status: 'Given' }, 'fadia', now);
  assert.throws(() => correctDose(state, dose.id, { status: 'Refused', note: 'Patient refused', reason: '' }, 'fadia'), /reason/);
  assert.throws(() => correctDose(state, dose.id, { status: 'Refused', note: 'Patient refused', reason: 'Tapped the wrong button' }, 'georgio'), /recorded by Fadia/);
  const before = state.notifications.length;
  correctDose(state, dose.id, { status: 'Refused', note: 'Patient refused', reason: 'Tapped the wrong button' }, 'fadia');
  assert.equal(roundFor(state, today).find(item => item.orderId === order.id).status, 'Refused');
  assert.deepEqual(dose.corrections.map(item => [item.from, item.to, item.reason]), [['Given', 'Refused', 'Tapped the wrong button']]);
  assert.ok(state.notifications.length > before, 'a refused dose still alerts Wael');
}

console.log('Correction checks passed.');
