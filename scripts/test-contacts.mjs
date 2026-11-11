import assert from 'node:assert/strict';
import { addContact, updateContact, removeContact, emergencyContact, CONTACT_RELATIONS } from '../src/lib/contacts.js';
import { canDo } from '../src/lib/people.js';
import { seed } from '../src/lib/seed.js';
import { withSsr } from './lib/ssr.mjs';

const state = seed();
const admitted = state.patients.filter(patient => patient.status === 'Admitted');

// Every patient in the sample data has someone to call in an emergency.
for (const patient of admitted) assert.ok(emergencyContact(patient), `${patient.id} has an emergency contact`);
assert.ok(!CONTACT_RELATIONS.includes('Self'));

for (const id of ['melyssa', 'ahmed', 'amer', 'fadia', 'ahmed']) assert.equal(canDo(id, 'manageContacts'), true, id);
for (const id of ['georgio', 'john', 'rabih']) assert.equal(canDo(id, 'manageContacts'), false, id);

const patient = admitted[0];
const count = patient.contacts.length;
assert.throws(() => addContact(state, patient.id, { name: 'Mona', relation: 'Parent', phone: '+961 3 123 456' }, 'georgio'), /cannot/i);
assert.throws(() => addContact(state, patient.id, { name: 'M', relation: 'Parent', phone: '+961 3 123 456' }, 'melyssa'), /name/);
assert.throws(() => addContact(state, patient.id, { name: 'Mona Haddad', relation: 'Neighbour', phone: '+961 3 123 456' }, 'melyssa'), /relationship/);
assert.throws(() => addContact(state, patient.id, { name: 'Mona Haddad', relation: 'Parent', phone: '12' }, 'melyssa'), /phone/);
const mona = addContact(state, patient.id, { name: 'Mona Haddad', relation: 'Parent', phone: '+961 3 123 456', emergency: true, canDiscuss: false, canVisit: true }, 'melyssa');
assert.equal(patient.contacts.length, count + 1);
assert.equal(mona.emergency, true);
assert.equal(emergencyContact(patient).id, mona.id, 'the newest emergency contact comes first');

// Only one emergency contact at a time: marking another moves the flag.
const other = patient.contacts.find(item => item.id !== mona.id);
updateContact(state, patient.id, other.id, { emergency: true }, 'melyssa');
assert.equal(emergencyContact(patient).id, other.id);
assert.equal(patient.contacts.find(item => item.id === mona.id).emergency, false);

// A bad edit changes nothing.
assert.throws(() => updateContact(state, patient.id, mona.id, { phone: 'x' }, 'melyssa'), /phone/);
assert.equal(patient.contacts.find(item => item.id === mona.id).phone, '+961 3 123 456');

removeContact(state, patient.id, mona.id, 'melyssa');
assert.ok(!patient.contacts.some(item => item.id === mona.id));
assert.throws(() => removeContact(state, patient.id, other.id, 'melyssa'), /emergency contact/, 'the last emergency contact cannot be removed without a replacement');

await withSsr(async ({ load, html }) => {
  const { session, db } = await load('/src/lib/store.svelte.js');
  const id = db.patients.find(item => item.status === 'Admitted').id;
  session.staffId = 'georgio';
  const rsaView = await html('/src/pages/Patients.svelte', { args: [db.patients.find(item => item.status === 'Admitted' && item.assigned?.rsa === 'georgio').id] });
  assert.ok(rsaView.includes('Contacts') && rsaView.includes('Emergency'), 'RSAs see who to call');
  session.staffId = 'melyssa';
  assert.ok((await html('/src/pages/Patients.svelte', { args: [id] })).includes('Add contact'), 'Melyssa can add contacts');
});

console.log('Contact checks passed.');
