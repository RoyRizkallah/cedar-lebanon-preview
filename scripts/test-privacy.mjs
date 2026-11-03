import assert from 'node:assert/strict';
import { notify } from '../src/lib/notifications.js';
import { incidentsFor } from '../src/lib/safety.js';
import { documentsVisibleTo } from '../src/lib/documents.js';
import { reachableLink } from '../src/lib/people.js';
import { todayISO } from '../src/lib/dates.js';
import { seed } from '../src/lib/seed.js';
import { withSsr } from './lib/ssr.mjs';

// A notification only links to something the person can open; otherwise to the patient file, or nowhere.
assert.equal(reachableLink('fadia', '#/patients/P-1/clinical'), '#/patients/P-1');
assert.equal(reachableLink('clinical-director', '#/patients/P-1/clinical'), '#/patients/P-1/clinical');
assert.equal(reachableLink('melyssa', '#/patients/P-1/fitness'), '#/patients/P-1');
assert.equal(reachableLink('georgio', '#/programs/PRG-0001'), '');
assert.equal(reachableLink('georgio', '#/programs/PRG-0001', '#/patients/P-1'), '#/patients/P-1');
assert.equal(reachableLink('nabila', '#/programs/PRG-0001'), '#/programs/PRG-0001');
{
  const state = { notifications: [] };
  notify(state, { to: ['fadia', 'clinical-director'], title: 'Session risk flag', link: '#/patients/P-1/clinical' });
  assert.deepEqual(Object.fromEntries(state.notifications.map(item => [item.to, item.link])), { fadia: '#/patients/P-1', 'clinical-director': '#/patients/P-1/clinical' });
  notify(state, { to: ['georgio', 'nazha'], title: 'Starts a program', link: '#/programs/PRG-0001', fallback: '#/patients/P-1' });
  assert.equal(state.notifications.find(item => item.to === 'georgio').link, '#/patients/P-1');
  assert.equal(state.notifications.find(item => item.to === 'nazha').link, '#/programs/PRG-0001');
}

const state = seed();
// Incidents: everyone sees what happened to the residents they look after, but only the care team reads the details.
{
  const incident = state.incidents.find(item => item.patientId);
  const mazen = incidentsFor(state, 'mazen').find(item => item.id === incident.id);
  assert.ok(mazen.redacted && !mazen.description.includes(incident.description), 'Operations sees that it happened, not what');
  assert.equal(incidentsFor(state, 'omar').find(item => item.id === incident.id).description, incident.description, 'the senior RSA reads it');
  assert.equal(incidentsFor(state, 'clinical-director').find(item => item.id === incident.id).description, incident.description);
  const owner = state.patients.find(item => item.id === incident.patientId).assigned.rsa;
  const stranger = ['georgio', 'alaa', 'dania', 'imad'].find(id => id !== owner);
  assert.ok(!incidentsFor(state, stranger).some(item => item.id === incident.id), 'another RSA does not see residents who are not theirs');
  const mine = state.incidents.find(item => item.reportedBy === 'omar');
  if (mine) assert.ok(!incidentsFor(state, 'omar').find(item => item.id === mine.id).redacted, 'a reporter reads their own report');
}

// Prescriptions stay with nursing and the clinical lead.
{
  const doc = state.documents.find(item => item.type === 'Prescription');
  assert.ok(doc, 'sample prescription');
  assert.ok(documentsVisibleTo(state, doc.patientId, 'fadia').some(item => item.id === doc.id));
  assert.ok(documentsVisibleTo(state, doc.patientId, 'ahmed').some(item => item.id === doc.id));
  for (const id of ['melyssa', 'amer']) assert.ok(!documentsVisibleTo(state, doc.patientId, id).some(item => item.id === doc.id), id);
  assert.ok(documentsVisibleTo(state, doc.patientId, 'melyssa').length > 0, 'admin still sees agreements and consents');
}

// Finance and Operations open a patient file for money and rooms, not for therapy bookings or treatment phase.
await withSsr(async ({ load, html }) => {
  const { session, db } = await load('/src/lib/store.svelte.js');
  const today = todayISO();
  const booked = db.appointments.find(item => item.status === 'Booked' && item.date >= today && item.service === 'Psychologist session' && item.patientId && db.patients.find(p => p.id === item.patientId)?.status === 'Admitted');
  assert.ok(booked, 'sample psychologist booking ahead');
  const view = staff => { session.staffId = staff; return html('/src/pages/Patients.svelte', { args: [booked.patientId] }); };
  const rabih = await view('rabih');
  assert.ok(!rabih.includes('Psychologist session'), 'Finance does not see therapy bookings');
  assert.ok(!rabih.includes('<dt>Phase</dt>'), 'or the treatment phase');
  assert.ok((await view('fadia')).includes('Psychologist session'), 'the nurse does');
});

console.log('Privacy checks passed.');
