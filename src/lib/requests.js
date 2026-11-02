// RSA requests on behalf of a patient. The invoice (fatoura) is scanned when the item is bought.
import { nextId } from './ids.js';
import { canDo, isResident, RESIDENTS } from './people.js';
import { addWalletPurchase, amountToCents, walletBalanceCents } from './wallet.js';
import { log } from './activity.js';

const find = (state, id) => {
  const request = state.requests.find(item => item.id === id);
  if (!request) throw new Error('This request was not found.');
  return request;
};
const patientOf = (state, id) => {
  const patient = state.patients.find(item => item.id === id && item.status === 'Admitted');
  if (!patient) throw new Error('Choose an admitted patient.');
  return patient;
};

export function createRequest(state, { patientId, item, quantity, note = '' }, staffId) {
  const own = isResident(staffId) && RESIDENTS.find(person => person.id === staffId)?.patientId === patientId;
  if (!canDo(staffId, 'createRequest') && !own) throw new Error('You cannot create requests.');
  const patient = patientOf(state, patientId);
  const name = String(item || '').trim();
  const count = Number(quantity);
  if (name.length < 2 || name.length > 100) throw new Error('Describe the item in 2 to 100 characters.');
  if (!Number.isInteger(count) || count < 1 || count > 20) throw new Error('Choose a quantity from 1 to 20.');
  if (String(note).length > 300) throw new Error('Keep the note within 300 characters.');
  const request = { id: nextId('R', state.requests), patientId, item: name, quantity: count, note: String(note).trim(), status: 'Open', createdBy: staffId, createdAt: new Date().toISOString() };
  state.requests.push(request);
  log(state, staffId, `Request for ${patient.fullName}: ${count} × ${name}`, '#/requests');
  return request;
}

function invoiceDocument(state, { patientId, fileId, fileName, note }, staffId) {
  if (!fileId) throw new Error('Scan or attach the invoice (fatoura).');
  const document = { id: nextId('D', state.documents), patientId, type: 'Invoice (fatoura)', title: `Invoice — ${String(note || fileName || 'purchase').trim()}`, status: 'Received', fileId, fileName, createdAt: new Date().toISOString(), createdBy: staffId };
  state.documents.push(document);
  return document;
}

export function completeRequest(state, id, { amount, fileId, fileName }, staffId) {
  const request = find(state, id);
  if (request.status !== 'Open') throw new Error('This request is already closed.');
  if (!canDo(staffId, 'pettyCash')) throw new Error('Purchases are paid from petty cash, held by Georgio.');
  const cents = amountToCents(amount);
  if (cents > walletBalanceCents(state, request.patientId)) throw new Error('This purchase is higher than the available wallet balance.');
  if (!fileId) throw new Error('Scan or attach the invoice (fatoura).');
  const document = invoiceDocument(state, { patientId: request.patientId, fileId, fileName, note: request.item }, staffId);
  addWalletPurchase(state, { patientId: request.patientId, amount, description: `${request.quantity} × ${request.item}`, recordedBy: staffId, requestId: request.id });
  Object.assign(request, { status: 'Done', amountCents: cents, invoiceDocId: document.id, completedAt: new Date().toISOString(), completedBy: staffId });
  log(state, staffId, `Bought ${request.quantity} × ${request.item}`, '#/requests');
  return request;
}

export function cancelRequest(state, id, staffId) {
  const request = find(state, id);
  if (request.status !== 'Open') throw new Error('This request is already closed.');
  if (isResident(staffId) && RESIDENTS.find(person => person.id === staffId)?.patientId !== request.patientId) throw new Error('You can only cancel your own requests.');
  Object.assign(request, { status: 'Cancelled', completedAt: new Date().toISOString(), completedBy: staffId });
  log(state, staffId, `Cancelled request: ${request.item}`, '#/requests');
  return request;
}

export function uploadInvoice(state, { patientId, fileId, fileName, note = '' }, staffId) {
  if (!canDo(staffId, 'createRequest')) throw new Error('You cannot upload invoices.');
  patientOf(state, patientId);
  const document = invoiceDocument(state, { patientId, fileId, fileName, note }, staffId);
  log(state, staffId, 'Invoice (fatoura) uploaded', `#/patients/${patientId}/wallet`);
  return document;
}
