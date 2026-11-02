// Accounting: invoices from each patient's agreed amount, receipts, supplier bills, a balanced journal,
// trial balance, bank reconciliation and payer balances. Amounts are dollars; sums are taken in cents.
import { nextId } from './ids.js';
import { addDays, todayISO } from './dates.js';
import { log } from './activity.js';
import { notify } from './notifications.js';
import { canDo, whoCan } from './people.js';

export const ACCOUNTS = [
  { code: '1010', name: 'Operating bank', type: 'Asset' },
  { code: '1020', name: 'Cash on hand', type: 'Asset' },
  { code: '1100', name: 'Accounts receivable', type: 'Asset' },
  { code: '2100', name: 'Accounts payable', type: 'Liability' },
  { code: '4100', name: 'Program revenue', type: 'Revenue' },
  { code: '5100', name: 'Clinical & medical supplies', type: 'Expense' },
  { code: '5200', name: 'Facility & maintenance', type: 'Expense' },
  { code: '5300', name: 'Food & kitchen', type: 'Expense' },
  { code: '5400', name: 'Professional services', type: 'Expense' },
  { code: '5500', name: 'Administration', type: 'Expense' }
];
export const EXPENSE_CATEGORIES = ACCOUNTS.filter(account => account.type === 'Expense');
export const PAYMENT_METHODS = ['Bank transfer', 'Cash', 'Card', 'Cheque', 'Sponsor remittance'];
export const PAYERS = ['Self-pay', 'Family', 'Employer', 'Insurance', 'Sponsor'];

const cents = value => Math.round(Number(value || 0) * 100);
const dollars = value => cents(value) / 100;
export const usd = value => `$${dollars(value).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
export const accountName = code => ACCOUNTS.find(account => account.code === code)?.name || code;
const allowed = staffId => { if (!canDo(staffId, 'recordFinance')) throw new Error('Finance is handled by Amer, Rabih or Kteish.'); };
const books = state => (state.finance ||= { invoices: [], expenses: [], manualEntries: [], bankEntries: [] });
const positive = value => { const amount = dollars(value); if (!(amount > 0)) throw new Error('Enter an amount greater than 0.'); return amount; };
const monthLabel = month => new Date(`${month}-01T12:00:00`).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });

export const paidOf = invoice => (invoice.payments || []).reduce((sum, payment) => sum + cents(payment.amount), 0) / 100;
export const openBalance = invoice => invoice.status === 'Void' ? 0 : Math.max(0, cents(invoice.amount) - cents(paidOf(invoice))) / 100;

export function invoiceStatus(invoice, today = todayISO()) {
  if (invoice.status === 'Void') return 'Void';
  if (openBalance(invoice) <= 0) return 'Paid';
  if (invoice.due < today) return 'Overdue';
  return paidOf(invoice) > 0 ? 'Part-paid' : 'Due';
}

export function createInvoice(state, { patientId, payer = 'Self-pay', amount, issued, due, description = 'Program fee' }, staffId, now = new Date()) {
  allowed(staffId);
  const patient = state.patients.find(item => item.id === patientId);
  if (!patient) throw new Error('Choose the patient.');
  const total = positive(amount);
  const day = issued || todayISO(now);
  const invoice = { id: nextId('INV', books(state).invoices), patientId, payer, amount: total, issued: day, due: due || addDays(day, 7), description: String(description).trim() || 'Program fee', status: 'Open', payments: [], createdBy: staffId };
  books(state).invoices.push(invoice);
  log(state, staffId, `Invoice ${invoice.id} for ${patient.fullName}: ${usd(total)}`, '#/finance/invoices');
  return invoice;
}

// One program-fee invoice per patient per month, from the agreed monthly amount.
export function invoiceMonth(state, patientId, month, staffId) {
  const patient = state.patients.find(item => item.id === patientId);
  if (books(state).invoices.some(item => item.patientId === patientId && item.status !== 'Void' && item.issued.startsWith(month) && /program fee/i.test(item.description))) throw new Error(`${patient?.fullName} is already invoiced for ${monthLabel(month)}.`);
  return createInvoice(state, { patientId, payer: patient?.payer || 'Self-pay', amount: patient?.monthlyAmount, issued: `${month}-01`, due: addDays(`${month}-01`, 7), description: `${monthLabel(month)} program fee` }, staffId);
}

export function recordPayment(state, invoiceId, { amount, method = 'Bank transfer', date, reference = '' }, staffId) {
  allowed(staffId);
  const invoice = books(state).invoices.find(item => item.id === invoiceId);
  if (!invoice || invoice.status === 'Void') throw new Error('This invoice cannot take payments.');
  const paid = positive(amount);
  if (cents(paid) > cents(openBalance(invoice))) throw new Error(`This payment is more than the open balance (${usd(openBalance(invoice))}).`);
  const payment = { id: `PAY-${invoice.id}-${(invoice.payments || []).length + 1}`, amount: paid, method: PAYMENT_METHODS.includes(method) ? method : 'Bank transfer', date: date || todayISO(), reference: String(reference).trim(), by: staffId };
  (invoice.payments ||= []).push(payment);
  log(state, staffId, `Payment of ${usd(paid)} on ${invoice.id}`, '#/finance/invoices');
  return payment;
}

export function voidInvoice(state, invoiceId, reason, staffId) {
  allowed(staffId);
  const invoice = books(state).invoices.find(item => item.id === invoiceId);
  if (!invoice) throw new Error('This invoice was not found.');
  if ((invoice.payments || []).length) throw new Error('This invoice has payments; it cannot be voided.');
  if (!String(reason || '').trim()) throw new Error('Give a reason for voiding.');
  Object.assign(invoice, { status: 'Void', voidedAt: todayISO(), voidReason: reason.trim(), voidedBy: staffId });
  log(state, staffId, `Voided ${invoice.id}`, '#/finance/invoices');
  return invoice;
}

export function createExpense(state, { supplier, description, category, amount, date, due, reference = '' }, staffId) {
  allowed(staffId);
  if (!String(supplier || '').trim()) throw new Error('Add the supplier.');
  if (!EXPENSE_CATEGORIES.some(item => item.code === category)) throw new Error('Choose an expense category.');
  const expense = { id: nextId('EXP', books(state).expenses), supplier: supplier.trim(), description: String(description || '').trim(), category, amount: positive(amount), date: date || todayISO(), due: due || addDays(date || todayISO(), 14), reference, status: 'Pending approval', payments: [], createdBy: staffId };
  books(state).expenses.push(expense);
  notify(state, { to: whoCan('approveExpense'), title: `Bill to approve: ${expense.supplier}`, body: `${usd(expense.amount)}, ${expense.description}`, link: '#/finance/expenses' });
  log(state, staffId, `Recorded bill from ${expense.supplier}`, '#/finance/expenses');
  return expense;
}

export function approveExpense(state, expenseId, staffId) {
  if (!canDo(staffId, 'approveExpense')) throw new Error('Bills are approved by Amer or Rabih.');
  const expense = books(state).expenses.find(item => item.id === expenseId);
  if (expense?.status !== 'Pending approval') throw new Error('This bill is not waiting for approval.');
  Object.assign(expense, { status: 'Approved', approvedBy: staffId, approvedAt: new Date().toISOString() });
  log(state, staffId, `Approved bill ${expense.id}`, '#/finance/expenses');
  return expense;
}

export function payExpense(state, expenseId, { amount, method = 'Bank transfer', date, reference = '' }, staffId) {
  allowed(staffId);
  const expense = books(state).expenses.find(item => item.id === expenseId);
  if (expense?.status !== 'Approved') throw new Error('Only approved bills can be paid.');
  const owed = (cents(expense.amount) - expense.payments.reduce((sum, item) => sum + cents(item.amount), 0)) / 100;
  const paid = positive(amount);
  if (cents(paid) > cents(owed)) throw new Error(`This payment is more than what is owed (${usd(owed)}).`);
  expense.payments.push({ id: `EPAY-${expense.id}-${expense.payments.length + 1}`, amount: paid, method, date: date || todayISO(), reference: String(reference).trim(), by: staffId });
  if (cents(paid) === cents(owed)) expense.status = 'Paid';
  log(state, staffId, `Paid ${usd(paid)} to ${expense.supplier}`, '#/finance/expenses');
  return expense;
}

export function addManualEntry(state, { date, description, reference = '', debitAccount, creditAccount, amount }, staffId) {
  allowed(staffId);
  if (debitAccount === creditAccount) throw new Error('A journal entry needs two different accounts.');
  if (![debitAccount, creditAccount].every(code => ACCOUNTS.some(account => account.code === code))) throw new Error('Choose both accounts.');
  if (!String(description || '').trim()) throw new Error('Describe the entry.');
  const entry = { id: nextId('MAN', books(state).manualEntries), date: date || todayISO(), description: description.trim(), reference, debitAccount, creditAccount, amount: positive(amount), by: staffId };
  books(state).manualEntries.push(entry);
  log(state, staffId, `Journal entry: ${entry.description}`, '#/finance/ledger');
  return entry;
}

const entry = (id, date, description, reference, lines, kind) => ({ id, date, description, reference, lines, kind });

export function buildJournal(state) {
  const { invoices = [], expenses = [], manualEntries = [] } = books(state);
  const name = id => state.patients.find(patient => patient.id === id)?.fullName || id;
  const out = [];
  for (const invoice of invoices) {
    const amount = dollars(invoice.amount);
    out.push(entry(`J-INV-${invoice.id}`, invoice.issued, `Invoice ${invoice.id}, ${name(invoice.patientId)}`, invoice.id, [{ account: '1100', debit: amount, credit: 0 }, { account: '4100', debit: 0, credit: amount }], 'Invoice'));
    if (invoice.status === 'Void') out.push(entry(`J-VOID-${invoice.id}`, invoice.voidedAt || invoice.issued, `Voided invoice ${invoice.id}`, invoice.id, [{ account: '4100', debit: amount, credit: 0 }, { account: '1100', debit: 0, credit: amount }], 'Reversal'));
    for (const payment of invoice.payments || []) {
      const paid = dollars(payment.amount);
      out.push(entry(`J-${payment.id}`, payment.date, `Receipt for ${invoice.id}, ${payment.method}`, payment.reference || payment.id, [{ account: payment.method === 'Cash' ? '1020' : '1010', debit: paid, credit: 0 }, { account: '1100', debit: 0, credit: paid }], 'Receipt'));
    }
  }
  for (const expense of expenses) {
    const amount = dollars(expense.amount);
    if (expense.status !== 'Pending approval') out.push(entry(`J-EXP-${expense.id}`, expense.date, `${expense.supplier}, ${expense.description}`, expense.reference || expense.id, [{ account: expense.category, debit: amount, credit: 0 }, { account: '2100', debit: 0, credit: amount }], 'Bill'));
    for (const payment of expense.payments || []) {
      const paid = dollars(payment.amount);
      out.push(entry(`J-${payment.id}`, payment.date, `Payment to ${expense.supplier}`, payment.reference || payment.id, [{ account: '2100', debit: paid, credit: 0 }, { account: payment.method === 'Cash' ? '1020' : '1010', debit: 0, credit: paid }], 'Bill payment'));
    }
  }
  for (const manual of manualEntries) out.push(entry(`J-${manual.id}`, manual.date, manual.description, manual.reference, [{ account: manual.debitAccount, debit: dollars(manual.amount), credit: 0 }, { account: manual.creditAccount, debit: 0, credit: dollars(manual.amount) }], 'Adjustment'));
  return out.sort((a, b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id));
}

export function trialBalance(entries) {
  return ACCOUNTS.map(account => {
    const lines = entries.flatMap(item => item.lines).filter(line => line.account === account.code);
    const debit = lines.reduce((sum, line) => sum + cents(line.debit), 0) / 100;
    const credit = lines.reduce((sum, line) => sum + cents(line.credit), 0) / 100;
    return { ...account, debit, credit, balance: (cents(debit) - cents(credit)) / 100 };
  });
}

export function totals(entries) {
  const rows = trialBalance(entries);
  const balance = code => rows.find(row => row.code === code)?.balance || 0;
  const sum = type => rows.filter(row => row.type === type).reduce((total, row) => total + (type === 'Revenue' ? -cents(row.balance) : cents(row.balance)), 0) / 100;
  return { revenue: sum('Revenue'), expenses: sum('Expense'), net: (cents(sum('Revenue')) - cents(sum('Expense'))) / 100, receivables: balance('1100'), payables: -balance('2100'), bank: balance('1010'), cash: balance('1020') };
}

export function bankJournalLines(entries) {
  return entries.map(item => ({ id: item.id, date: item.date, description: item.description, reference: item.reference, amount: item.lines.filter(line => line.account === '1010').reduce((sum, line) => sum + cents(line.debit) - cents(line.credit), 0) / 100 }))
    .filter(item => item.amount !== 0);
}

export function matchBank(state, bankId, journalId, staffId) {
  allowed(staffId);
  const line = books(state).bankEntries.find(item => item.id === bankId);
  if (!line) throw new Error('This statement line was not found.');
  if (journalId && books(state).bankEntries.some(item => item.matchedJournalId === journalId && item.id !== bankId)) throw new Error('That journal entry is already matched.');
  line.matchedJournalId = journalId || '';
  log(state, staffId, journalId ? `Matched bank line ${bankId}` : `Unmatched bank line ${bankId}`, '#/finance/bank');
  return line;
}

export function payerBalances(state, today = todayISO()) {
  const active = books(state).invoices.filter(item => item.status !== 'Void');
  return [...new Set(active.map(item => item.payer))].map(name => {
    const items = active.filter(item => item.payer === name);
    return {
      name, invoices: items.length,
      billed: items.reduce((sum, item) => sum + cents(item.amount), 0) / 100,
      received: items.reduce((sum, item) => sum + cents(paidOf(item)), 0) / 100,
      open: items.reduce((sum, item) => sum + cents(openBalance(item)), 0) / 100,
      overdue: items.filter(item => invoiceStatus(item, today) === 'Overdue').reduce((sum, item) => sum + cents(openBalance(item)), 0) / 100
    };
  }).sort((a, b) => b.open - a.open);
}
