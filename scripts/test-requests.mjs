import assert from 'node:assert/strict';
import { createRequest, completeRequest, cancelRequest, uploadInvoice } from '../src/lib/requests.js';
import { walletBalanceCents } from '../src/lib/wallet.js';
import { seed } from '../src/lib/seed.js';
import { withSsr } from './lib/ssr.mjs';

const state = seed();
const patient = state.patients.find(item => item.status === 'Admitted' && item.program !== 'Outpatient');

assert.throws(() => createRequest(state, { patientId: patient.id, item: 'Soap', quantity: 0 }, 'georgio'), /Choose a quantity from 1 to 20\./);
assert.throws(() => createRequest(state, { patientId: patient.id, item: 'x', quantity: 1 }, 'georgio'), /Describe the item in 2 to 100 characters\./);
assert.throws(() => createRequest(state, { patientId: patient.id, item: 'Soap', quantity: 1 }, 'john'), /cannot create requests/);
const request = createRequest(state, { patientId: patient.id, item: 'Running shoes', quantity: '1', note: 'Size 43' }, 'georgio');
assert.equal(request.status, 'Open');
assert.equal(request.createdBy, 'georgio');

const balance = walletBalanceCents(state, patient.id);
const tooMuch = ((balance + 100) / 100).toFixed(2);
assert.throws(() => completeRequest(state, request.id, { amount: tooMuch, fileId: 'file-1', fileName: 'fatoura.jpg', signature: { at: '2026-11-02T10:00:00Z', name: 'Patient' } }, 'georgio'), /higher than the available wallet balance/);
assert.equal(request.status, 'Open');
const invoicesBefore = state.documents.filter(doc => doc.type === 'Invoice (fatoura)').length;
assert.throws(() => completeRequest(state, request.id, { amount: '10.00' }, 'georgio'), /Scan or attach the invoice/);

assert.throws(() => completeRequest(state, request.id, { amount: '12.50', fileId: 'file-1', fileName: 'fatoura.jpg', signature: { at: '2026-11-02T10:00:00Z', name: 'Patient' } }, 'alaa'), /petty cash, held by Georgio/);
assert.throws(() => completeRequest(state, request.id, { amount: '12.50', fileId: 'file-1', fileName: 'fatoura.jpg' }, 'georgio'), /patient signs/);
completeRequest(state, request.id, { amount: '12.50', fileId: 'file-1', fileName: 'fatoura.jpg', signature: { at: '2026-11-02T10:00:00Z', name: 'Patient' } }, 'georgio');
assert.equal(request.status, 'Done');
assert.equal(request.amountCents, 1250);
assert.equal(walletBalanceCents(state, patient.id), balance - 1250);
const invoices = state.documents.filter(doc => doc.type === 'Invoice (fatoura)');
assert.equal(invoices.length, invoicesBefore + 1);
assert.equal(invoices.at(-1).patientId, patient.id);
assert.equal(request.invoiceDocId, invoices.at(-1).id);
assert.throws(() => completeRequest(state, request.id, { amount: '1', fileId: 'f' }, 'georgio'), /already closed/);

const second = createRequest(state, { patientId: patient.id, item: 'Notebook', quantity: 2 }, 'melyssa');
cancelRequest(state, second.id, 'georgio');
assert.equal(second.status, 'Cancelled');
assert.equal(walletBalanceCents(state, patient.id), balance - 1250, 'cancelled requests are never charged');

const scan = uploadInvoice(state, { patientId: patient.id, fileId: 'file-2', fileName: 'pharmacy.jpg', note: 'Pharmacy' }, 'georgio');
assert.equal(scan.type, 'Invoice (fatoura)');
assert.throws(() => uploadInvoice(state, { patientId: patient.id }, 'georgio'), /Scan or attach the invoice/);

await withSsr(async ({ load, html }) => {
  const { session } = await load('/src/lib/store.svelte.js');
  session.staffId = 'georgio';
  const page = await html('/src/pages/Requests.svelte', { args: [] });
  for (const text of ['Requests', 'New request', 'Upload invoice', 'Phone charger (USB-C)']) assert.ok(page.includes(text), text);
});

console.log('Request checks passed.');
