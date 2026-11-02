// Patient documents with their signature state: signed on screen, or a signed scan uploaded.
import { nextId } from './ids.js';
import { canDo, hasRole } from './people.js';
import { log } from './activity.js';

export const DOC_TYPES = ['Admission agreement', 'Consent', 'Prescription', 'Invoice (fatoura)', 'Other'];
export const SIGNED = ['Signed electronically', 'Signed scan uploaded'];

const find = (state, id) => {
  const document = state.documents.find(item => item.id === id);
  if (!document) throw new Error('This document was not found.');
  return document;
};
const allowed = staffId => { if (!canDo(staffId, 'manageDocuments') && !hasRole(staffId, 'rsa')) throw new Error('You cannot manage documents.'); };

export function addDocument(state, { patientId, type, title, fileId, fileName, note = '' }, staffId) {
  if (!canDo(staffId, 'manageDocuments')) throw new Error('You cannot manage documents.');
  if (!DOC_TYPES.includes(type)) throw new Error('Choose a document type.');
  if (!state.patients.some(patient => patient.id === patientId)) throw new Error('Choose the patient.');
  const document = { id: nextId('D', state.documents), patientId, type, title: String(title || type).trim(), status: 'Awaiting signature', note: String(note).trim(), createdAt: new Date().toISOString(), createdBy: staffId };
  if (fileId) Object.assign(document, { fileId, fileName, status: type === 'Prescription' || type === 'Invoice (fatoura)' ? 'Received' : 'Signed scan uploaded' });
  state.documents.push(document);
  log(state, staffId, `Added ${document.title}`, `#/patients/${patientId}/documents`);
  return document;
}

export function signDocument(state, id, signature, staffId) {
  allowed(staffId);
  const document = find(state, id);
  if (SIGNED.includes(document.status)) throw new Error('This document is already signed.');
  if (!signature?.at || !String(signature.name || '').trim()) throw new Error('Capture the signature first.');
  Object.assign(document, { status: 'Signed electronically', signedBy: signature.name.trim(), signedAt: signature.at, signature: signature.image, capturedBy: staffId });
  log(state, staffId, `${document.title} signed electronically`, `#/patients/${document.patientId}/documents`);
  return document;
}

export function attachScan(state, id, { fileId, fileName }, staffId) {
  allowed(staffId);
  const document = find(state, id);
  if (!fileId) throw new Error('Choose the scanned file.');
  Object.assign(document, { status: 'Signed scan uploaded', fileId, fileName, signedAt: new Date().toISOString(), capturedBy: staffId });
  log(state, staffId, `Signed scan uploaded for ${document.title}`, `#/patients/${document.patientId}/documents`);
  return document;
}

export const documentsFor = (state, patientId) => state.documents.filter(item => item.patientId === patientId).sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
