// Each admitted patient's wallet: deposits received outside the site, purchases made for them.
import { nextId } from './ids.js';
import { todayISO } from './dates.js';

const list = state => state.wallet.transactions;

export const walletTransactionsFor = (state, patientId) => list(state)
  .filter(item => item.patientId === patientId)
  .sort((a, b) => String(b.date).localeCompare(String(a.date)) || String(b.id).localeCompare(String(a.id)));

export function walletBalanceCents(state, patientId) {
  return list(state).reduce((balance, item) => {
    if (item.patientId !== patientId || !Number.isSafeInteger(item.amountCents) || item.amountCents <= 0) return balance;
    return item.type === 'credit' ? balance + item.amountCents : item.type === 'purchase' ? balance - item.amountCents : balance;
  }, 0);
}

export const hasWallet = (state, patientId) => list(state).some(item => item.patientId === patientId && item.type === 'opened');
export const formatCents = cents => `$${(cents / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export function amountToCents(value) {
  const raw = String(value ?? '').trim();
  if (!/^\d+(?:\.\d{1,2})?$/.test(raw)) throw new Error('Enter a positive amount with up to two decimal places.');
  const [whole, fraction = ''] = raw.split('.');
  const cents = Number(whole) * 100 + Number(fraction.padEnd(2, '0'));
  if (!Number.isSafeInteger(cents) || cents <= 0) throw new Error('Enter an amount greater than $0.00.');
  return cents;
}

export function openWallet(state, patientId, date = todayISO()) {
  if (hasWallet(state, patientId)) return null;
  const entry = { id: nextId('W', list(state)), patientId, type: 'opened', amountCents: 0, description: 'Wallet created at admission', date, recordedBy: 'System' };
  list(state).push(entry);
  return entry;
}

function record(state, payload, type) {
  const patientId = String(payload?.patientId || '').trim();
  if (!state.patients.some(patient => patient.id === patientId)) throw new Error('Choose an admitted patient.');
  const description = String(payload?.description || '').trim();
  if (!description) throw new Error(type === 'credit' ? 'Describe where the money came from.' : 'Describe what was bought.');
  const amountCents = amountToCents(payload?.amount);
  if (type === 'purchase' && amountCents > walletBalanceCents(state, patientId)) throw new Error('This purchase is higher than the available wallet balance.');
  const entry = { id: nextId('W', list(state)), patientId, type, amountCents, description, date: payload?.date || todayISO(), recordedBy: payload?.recordedBy || 'Cedar staff', note: String(payload?.note || '').trim() };
  if (payload?.requestId) entry.requestId = payload.requestId;
  list(state).push(entry);
  return entry;
}

export const addWalletDeposit = (state, payload) => record(state, payload, 'credit');
export const addWalletPurchase = (state, payload) => record(state, payload, 'purchase');
