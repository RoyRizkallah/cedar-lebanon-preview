import assert from 'node:assert/strict';
import { recordCashCount, witnessCashCount, reconcileCashCount, cashHeldCents, issueStatement } from '../src/lib/cash.js';
import { addWalletDeposit, addWalletPurchase } from '../src/lib/wallet.js';
import { applyCommand } from '../src/lib/commands.js';
import { viewFor } from '../src/lib/view.js';
import { seed } from '../src/lib/seed.js';

// Patient petty cash (Structure & Delegation, Part 4): the person who holds the cash never keeps the accounts.
const now = new Date('2026-11-14T18:00:00');
const sig = { at: now.toISOString(), name: 'Resident' };

// The weekly count: Georgio counts with Omar or Melyssa present; both sign; Kteish reconciles; any variance goes to Amer the same day.
{
  const state = seed(now);
  const held = cashHeldCents(state);
  assert.ok(held > 0, 'the box holds what the residents\' wallets hold');
  assert.throws(() => recordCashCount(state, { counted: '10', witness: 'omar' }, 'alaa', now), /Georgio/);
  assert.throws(() => recordCashCount(state, { counted: '10', witness: 'georgio' }, 'georgio', now), /Omar or Melyssa/);
  assert.throws(() => recordCashCount(state, { counted: '', witness: 'omar' }, 'georgio', now), /amount counted/);

  // A count that matches: no alert; the witness signs; Kteish reconciles.
  const exact = recordCashCount(state, { counted: (held / 100).toFixed(2), witness: 'melyssa' }, 'georgio', now);
  assert.equal(exact.varianceCents, 0);
  assert.ok(!state.notifications.some(item => item.to === 'amer' && /cash/i.test(item.title)));
  assert.throws(() => witnessCashCount(state, exact.id, 'omar', now), /Melyssa/, 'only the named witness signs');
  witnessCashCount(state, exact.id, 'melyssa', now);
  assert.equal(exact.witnessedBy, 'melyssa');
  assert.throws(() => reconcileCashCount(state, exact.id, 'Matches the ledger', 'georgio', now), /Kteish/);
  reconcileCashCount(state, exact.id, 'Matches the ledger', 'kteish', now);
  assert.equal(exact.reconciledBy, 'kteish');

  // A short count: Amer is told the same day, whatever the amount.
  const short = recordCashCount(state, { counted: ((held - 50) / 100).toFixed(2), witness: 'omar' }, 'georgio', now);
  assert.equal(short.varianceCents, -50);
  const alert = state.notifications.find(item => item.to === 'amer' && /cash count/i.test(item.title));
  assert.ok(alert?.urgent, 'Amer is alerted urgently');

  // Georgio never sees the balance he is meant to hold, nor the variance; Finance and Amer do.
  const georgio = viewFor(state, 'georgio');
  assert.ok(georgio.cashCounts.length === 2 && georgio.cashCounts.every(item => item.expectedCents === undefined && item.varianceCents === undefined));
  assert.equal(viewFor(state, 'kteish').cashCounts.find(item => item.id === short.id).varianceCents, -50);
  assert.equal(viewFor(state, 'nabila').cashCounts.length, 0);
  // And through the commands the server runs.
  applyCommand(state, 'recordCashCount', [{ counted: (held / 100).toFixed(2), witness: 'omar' }], 'georgio', now);
  assert.throws(() => applyCommand(state, 'reconcileCashCount', [short.id, 'x'], 'melyssa', now), /role cannot/);
}

// The family statement: Finance issues it; opening, top-ups, each disbursement with date and purpose, closing.
{
  const state = seed(now);
  const patient = state.patients.find(item => item.status === 'Admitted');
  addWalletDeposit(state, { patientId: patient.id, amount: '100', description: 'Family deposit', date: '2026-10-28', recordedBy: 'kteish' });
  addWalletDeposit(state, { patientId: patient.id, amount: '40', description: 'Family deposit', date: '2026-11-03', recordedBy: 'kteish' });
  addWalletPurchase(state, { patientId: patient.id, amount: '12.50', description: 'Phone card', date: '2026-11-05', recordedBy: 'georgio', signature: sig });
  assert.throws(() => issueStatement(state, patient.id, '2026-11', 'georgio', now), /Finance/);
  const statement = issueStatement(state, patient.id, '2026-11', 'kteish', now);
  assert.equal(statement.closingCents - statement.openingCents, statement.topUpsCents - statement.disbursements.reduce((sum, item) => sum + item.amountCents, 0));
  assert.ok(statement.disbursements.some(item => item.description === 'Phone card' && item.date === '2026-11-05'));
  assert.ok(statement.topUpsCents >= 4000);
  assert.equal(statement.issuedBy, 'kteish');
  assert.ok(state.statements.includes(statement));
}
console.log('Petty cash checks passed.');
