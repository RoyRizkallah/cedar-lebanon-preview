import { iso } from './data.js';

export const accounts = [
  { code: '1010', name: 'Operating bank', type: 'Asset' },
  { code: '1020', name: 'Cash on hand', type: 'Asset' },
  { code: '1100', name: 'Accounts receivable', type: 'Asset' },
  { code: '2100', name: 'Accounts payable', type: 'Liability' },
  { code: '4100', name: 'Program revenue', type: 'Revenue' },
  { code: '5100', name: 'Clinical supplies', type: 'Expense' },
  { code: '5200', name: 'Facility operations', type: 'Expense' },
  { code: '5300', name: 'Food and hospitality', type: 'Expense' },
  { code: '5400', name: 'Professional services', type: 'Expense' },
  { code: '5500', name: 'Administrative expense', type: 'Expense' }
];

export const expenseCategories = accounts.filter(item => item.type === 'Expense');
const cents = value => Math.round(Number(value || 0) * 100);
const dollars = value => cents(value) / 100;
export const money = value => `$${dollars(value).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export function ensureFinanceData(data) {
  data.finance ||= {};
  data.finance.expenses ||= [
    { id: 'EXP-041', date: iso(-6), due: iso(4), supplier: 'Cedar Medical Supply', description: 'Group room supplies and printed materials', category: '5100', amount: 285, status: 'Approved', owner: 'Rana', receiptRef: 'RCPT-041', payments: [] },
    { id: 'EXP-042', date: iso(-4), due: iso(-1), supplier: 'North Coast Facilities', description: 'Monthly maintenance visit', category: '5200', amount: 620, status: 'Paid', owner: 'Omar', receiptRef: 'RCPT-042', payments: [{ id: 'EPAY-042', date: iso(-1), amount: 620, method: 'Bank transfer', reference: 'BNK-042' }] },
    { id: 'EXP-043', date: iso(-2), due: iso(8), supplier: 'Local Kitchen Partners', description: 'Residential meal service', category: '5300', amount: 450, status: 'Pending approval', owner: 'Rana', receiptRef: 'RCPT-043', payments: [] },
    { id: 'EXP-044', date: iso(-9), due: iso(2), supplier: 'Harbor Accounting', description: 'Monthly bookkeeping support', category: '5400', amount: 380, status: 'Approved', owner: 'Omar', receiptRef: 'RCPT-044', payments: [] }
  ];
  data.finance.manualEntries ||= [];
  data.finance.bankEntries ||= [
    { id: 'BANK-101', date: iso(-2), description: 'Self-pay program receipt', amount: 500, reference: 'DEMO-INV-019', matchedJournalId: 'J-PAY-PAY-INV-019-01' },
    { id: 'BANK-102', date: iso(-1), description: 'Facilities supplier payment', amount: -620, reference: 'BNK-042', matchedJournalId: 'J-EPAY-EPAY-042' },
    { id: 'BANK-103', date: iso(0), description: 'Unmatched bank credit', amount: 175, reference: 'STMT-103', matchedJournalId: '' }
  ];
  return data;
}

function entry(id, date, description, reference, lines, kind) { return { id, date, description, reference, lines, kind }; }

export function buildJournal(data) {
  const entries = [];
  for (const invoice of data.invoices || []) {
    const amount = dollars(invoice.amount);
    if (amount > 0) entries.push(entry(`J-INV-${invoice.id}`, invoice.issued || invoice.due, `Invoice ${invoice.id} · ${invoice.payer}`, invoice.id, [{ account: '1100', debit: amount, credit: 0 }, { account: '4100', debit: 0, credit: amount }], 'Invoice'));
    if (invoice.status === 'Void' && amount > 0) entries.push(entry(`J-VOID-${invoice.id}`, invoice.voidedAt || iso(0), `Voided invoice ${invoice.id}`, invoice.id, [{ account: '4100', debit: amount, credit: 0 }, { account: '1100', debit: 0, credit: amount }], 'Invoice reversal'));
    for (const payment of invoice.payments || []) {
      const paid = dollars(payment.amount);
      if (paid > 0) entries.push(entry(`J-PAY-${payment.id}`, payment.date, `Receipt for ${invoice.id} · ${payment.method}`, payment.reference || payment.id, [{ account: payment.method === 'Cash' ? '1020' : '1010', debit: paid, credit: 0 }, { account: '1100', debit: 0, credit: paid }], 'Receipt'));
    }
  }
  for (const expense of data.finance?.expenses || []) {
    const amount = dollars(expense.amount);
    if (amount > 0 && expense.status !== 'Pending approval') entries.push(entry(`J-EXP-${expense.id}`, expense.date, `${expense.supplier} · ${expense.description}`, expense.id, [{ account: expense.category, debit: amount, credit: 0 }, { account: '2100', debit: 0, credit: amount }], 'Expense'));
    for (const payment of expense.payments || []) {
      const paid = dollars(payment.amount);
      if (paid > 0) entries.push(entry(`J-EPAY-${payment.id}`, payment.date, `Payment to ${expense.supplier}`, payment.reference || payment.id, [{ account: '2100', debit: paid, credit: 0 }, { account: payment.method === 'Cash' ? '1020' : '1010', debit: 0, credit: paid }], 'Expense payment'));
    }
  }
  for (const manual of data.finance?.manualEntries || []) entries.push(entry(manual.id, manual.date, manual.description, manual.reference, [{ account: manual.debitAccount, debit: dollars(manual.amount), credit: 0 }, { account: manual.creditAccount, debit: 0, credit: dollars(manual.amount) }], 'Adjustment'));
  return entries.sort((a, b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id));
}

export function trialBalance(entries) {
  return accounts.map(account => {
    const lines = entries.flatMap(item => item.lines).filter(line => line.account === account.code);
    const debit = lines.reduce((sum, line) => sum + cents(line.debit), 0) / 100;
    const credit = lines.reduce((sum, line) => sum + cents(line.credit), 0) / 100;
    return { ...account, debit, credit, balance: (cents(debit) - cents(credit)) / 100 };
  });
}

export function bankJournalLines(entries) {
  return entries.map(item => {
    const amount = item.lines.filter(line => ['1010', '1020'].includes(line.account)).reduce((sum, line) => sum + cents(line.debit) - cents(line.credit), 0) / 100;
    return { id: item.id, date: item.date, description: item.description, reference: item.reference, amount };
  }).filter(item => item.amount !== 0);
}

export function payerBalances(invoices) {
  const active = invoices.filter(item => item.status !== 'Void');
  const names = [...new Set(active.map(item => item.payer))];
  return names.map(name => {
    const items = active.filter(item => item.payer === name);
    const billed = items.reduce((sum, item) => sum + cents(item.amount), 0) / 100;
    const received = items.reduce((sum, item) => sum + cents(item.paid), 0) / 100;
    return { name, invoices: items.length, billed, received, open: Math.max(0, (cents(billed) - cents(received)) / 100), items };
  }).sort((a, b) => b.open - a.open);
}

export function totals(entries) {
  const rows = trialBalance(entries);
  const sum = type => rows.filter(row => row.type === type).reduce((total, row) => total + (type === 'Revenue' || type === 'Liability' ? -cents(row.balance) : cents(row.balance)), 0) / 100;
  return { revenue: sum('Revenue'), expenses: sum('Expense'), receivables: rows.find(item => item.code === '1100')?.balance || 0, payables: -(rows.find(item => item.code === '2100')?.balance || 0), bank: rows.find(item => item.code === '1010')?.balance || 0, cash: rows.find(item => item.code === '1020')?.balance || 0 };
}
