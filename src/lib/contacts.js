// The people around a patient: who to call in an emergency, who may hear about treatment, who may visit.
import { nextId } from './ids.js';
import { canDo } from './people.js';
import { log } from './activity.js';
import { RELATIONSHIPS } from './pipeline.js';

export const CONTACT_RELATIONS = RELATIONSHIPS.filter(item => item !== 'Self');

const patientOf = (state, id) => {
  const patient = state.patients.find(item => item.id === id);
  if (!patient) throw new Error('This patient was not found.');
  patient.contacts ||= [];
  return patient;
};
const allowed = staffId => { if (!canDo(staffId, 'manageContacts')) throw new Error('You cannot change contacts.'); };

function checked(fields) {
  const name = String(fields.name || '').trim();
  if (name.length < 2) throw new Error('Add the contact’s full name.');
  if (!CONTACT_RELATIONS.includes(fields.relation)) throw new Error('Choose their relationship to the patient.');
  const phone = String(fields.phone || '').trim();
  if ((phone.match(/\d/g) || []).length < 7 || /[^\d\s+()-]/.test(phone)) throw new Error('Add a phone number with at least 7 digits.');
  return { name, relation: fields.relation, phone, emergency: !!fields.emergency, canDiscuss: !!fields.canDiscuss, canVisit: !!fields.canVisit };
}

// The emergency contact; with none marked, nobody.
export const emergencyContact = patient => (patient.contacts || []).find(item => item.emergency) || null;

// Only one emergency contact at a time: marking one clears the others.
const claimEmergency = (patient, id) => { for (const item of patient.contacts) if (item.id !== id) item.emergency = false; };

export function addContact(state, patientId, fields, staffId) {
  allowed(staffId);
  const patient = patientOf(state, patientId);
  const contact = { id: nextId('CT', state.patients.flatMap(item => item.contacts || [])), ...checked(fields) };
  patient.contacts.unshift(contact);
  if (contact.emergency) claimEmergency(patient, contact.id);
  log(state, staffId, `Added ${contact.name} (${contact.relation.toLowerCase()}) to ${patient.clinicalName}'s contacts`, `#/patients/${patientId}`);
  return contact;
}

export function updateContact(state, patientId, contactId, changes, staffId) {
  allowed(staffId);
  const patient = patientOf(state, patientId);
  const contact = patient.contacts.find(item => item.id === contactId);
  if (!contact) throw new Error('This contact was not found.');
  Object.assign(contact, checked({ ...contact, ...changes }));
  if (contact.emergency) claimEmergency(patient, contact.id);
  return contact;
}

export function removeContact(state, patientId, contactId, staffId) {
  allowed(staffId);
  const patient = patientOf(state, patientId);
  const contact = patient.contacts.find(item => item.id === contactId);
  if (!contact) throw new Error('This contact was not found.');
  if (contact.emergency && patient.status === 'Admitted') throw new Error('Mark another emergency contact before removing this one.');
  patient.contacts = patient.contacts.filter(item => item.id !== contactId);
}
