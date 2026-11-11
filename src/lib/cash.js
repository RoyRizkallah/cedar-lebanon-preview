// Patient petty cash control (Structure & Delegation, Part 4): the person who holds the cash never keeps the accounts.
// Georgio counts the box each week with Omar or Melyssa present, and both sign. Kteish reconciles the count
// against the wallets (opening + top-ups − disbursements = cash counted). Any variance reaches Amer the same day,
// whatever the amount. Statements to families are prepared and issued by Finance only.
import { nextId } from './ids.js';
import { todayISO } from './dates.js';
import { canDo, staffName } from './people.js';
import { walletBalanceCents, formatCents } from './wallet.js';
import { notify } from './notifications.js';
import { log } from './activity.js';

export const CASH_WITNESSES = ['omar', 'melyssa'];
const counts = state => (state.cashCounts ||= []);
const find = (state, id) => { const count = counts(state).find(item => item.id === id); if (!count) throw new Error('This count was not found.'); return count; };

// What the box should hold: every resident's wallet balance, from the ledger.
export const cashHeldCents = state => [...new Set(state.wallet.transactions.map(item => item.patientId))].reduce((sum, patientId) => sum + walletBalanceCents(state, patientId), 0);

function cents(value) {
  const raw = String(value ?? '').trim();
  if (!/^\d+(?:\.\d{1,2})?$/.test(raw)) throw new Error('Enter the amount counted, in dollars.');
  const [whole, fraction = ''] = raw.split('.');
  return Number(whole) * 100 + Number(fraction.padEnd(2, '0'));
}

export function recordCashCount(state, { counted, witness, note = '' }, staffId, now = new Date()) {
  if (!canDo(staffId, 'pettyCash')) throw new Error('The weekly count is done by Georgio, the petty-cash custodian.');
  if (!CASH_WITNESSES.includes(witness) || witness === staffId) throw new Error('The count is witnessed by Omar or Melyssa.');
  const countedCents = cents(counted);
  const expectedCents = cashHeldCents(state);
  const count = { id: nextId('CC', counts(state)), date: todayISO(now), countedCents, expectedCents, varianceCents: countedCents - expectedCents, countedBy: staffId, witness, note: String(note).trim(), at: now.toISOString() };
  counts(state).push(count);
  notify(state, { to: witness, title: 'Sign the weekly cash count', body: `Counted by ${staffName(staffId)}: ${formatCents(countedCents)}.`, link: '#/requests' });
  if (count.varianceCents !== 0) {
    notify(state, { to: ['amer', 'kteish'], title: 'Petty cash count does not match', body: `${formatCents(Math.abs(count.varianceCents))} ${count.varianceCents < 0 ? 'short' : 'over'}, counted ${count.date}.`, link: '#/finance', urgent: true });
  }
  log(state, staffId, 'Weekly petty cash count recorded', '#/requests');
  return count;
}

export function witnessCashCount(state, id, staffId, now = new Date()) {
  const count = find(state, id);
  if (count.witness !== staffId) throw new Error(`This count is signed by ${staffName(count.witness)}, who was present.`);
  if (count.witnessedAt) throw new Error('This count is already signed.');
  Object.assign(count, { witnessedBy: staffId, witnessedAt: now.toISOString() });
  return count;
}

export function reconcileCashCount(state, id, note, staffId, now = new Date()) {
  if (!canDo(staffId, 'reconcileCash')) throw new Error('Counts are reconciled by Kteish.');
  const count = find(state, id);
  if (count.reconciledAt) throw new Error('This count is already reconciled.');
  if (!count.witnessedAt) throw new Error(`The witness (${staffName(count.witness)}) signs the count before it is reconciled.`);
  Object.assign(count, { reconciledBy: staffId, reconciledAt: now.toISOString(), reconcileNote: String(note || '').trim() });
  log(state, staffId, `Petty cash count ${count.id} reconciled`, '#/finance');
  return count;
}

// A family statement for one month: opening balance, top-ups, each disbursement with date and purpose, closing balance.
export function issueStatement(state, patientId, month, staffId, now = new Date()) {
  if (!canDo(staffId, 'issueStatement')) throw new Error('Statements are prepared and issued by Finance.');
  if (!/^\d{4}-\d{2}$/.test(String(month))) throw new Error('Choose the month.');
  const patient = state.patients.find(item => item.id === patientId);
  if (!patient) throw new Error('Choose the patient.');
  const mine = state.wallet.transactions.filter(item => item.patientId === patientId && Number.isSafeInteger(item.amountCents) && item.amountCents > 0);
  const signed = item => (item.type === 'credit' ? item.amountCents : ['purchase', 'refund'].includes(item.type) ? -item.amountCents : 0);
  const openingCents = mine.filter(item => String(item.date) < `${month}-01`).reduce((sum, item) => sum + signed(item), 0);
  const inMonth = mine.filter(item => String(item.date).startsWith(month)).sort((a, b) => String(a.date).localeCompare(String(b.date)));
  const topUpsCents = inMonth.filter(item => item.type === 'credit').reduce((sum, item) => sum + item.amountCents, 0);
  const disbursements = inMonth.filter(item => ['purchase', 'refund'].includes(item.type)).map(item => ({ date: item.date, description: item.description, amountCents: item.amountCents }));
  const statement = {
    id: nextId('ST', (state.statements ||= [])), patientId, month, openingCents, topUpsCents, disbursements,
    closingCents: openingCents + inMonth.reduce((sum, item) => sum + signed(item), 0), issuedBy: staffId, issuedAt: now.toISOString()
  };
  state.statements.push(statement);
  log(state, staffId, `Statement issued for ${patient.fullName}, ${month}`, `#/patients/${patientId}/wallet`);
  return statement;
}
