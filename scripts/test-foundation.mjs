import assert from 'node:assert/strict';
import { canSee, canSeeTab, canDo, STAFF, visiblePatients, staffById } from '../src/lib/people.js';
import { loadState } from '../src/lib/persist.js';
import { seed } from '../src/lib/seed.js';
import { withSsr } from './lib/ssr.mjs';

assert.equal(canSee('melyssa', 'leads'), true);
assert.equal(canSee('georgio', 'pipeline'), false);
assert.equal(canSee('ahmed', 'dashboard'), true);
assert.equal(canSee('john', 'dashboard'), false);
assert.equal(canSeeTab('melyssa', 'clinical'), false);
assert.equal(canSeeTab('omar', 'clinical'), false);
assert.equal(canSeeTab('nabila', 'clinical'), true);
assert.equal(canSeeTab('john', 'fitness'), true);
assert.equal(canSeeTab('melyssa', 'followup'), true);
assert.equal(canDo('melyssa', 'bookPsychologist'), false);
// The owner's org chart (docs/org-chart.md): every named person, with their real role.
assert.deepEqual(STAFF.map(person => person.name), ['Amer Khattab', 'Ahmed Khattab', 'Wael', 'Nabila', 'Nazha', 'Fadia', 'Melyssa', 'Rabih', 'Kteish', 'Mazen', 'John', 'Zeina', 'Tony J.', 'Tony AM', 'Raymond', 'Omar', 'Georgio', 'Alaa', 'Dania', 'Imad']);
assert.equal(staffById('amer').title, 'General Manager');
assert.equal(staffById('ahmed').title, 'Clinical & Program Director');
assert.equal(staffById('clinical-director').name, 'Wael');
assert.equal(staffById('melyssa').title, 'Admin & Admissions Manager');
assert.equal(new Set(STAFF.map(person => person.initials)).size, STAFF.length, 'initials tell people apart');
// Finance belongs to Amer, Rabih and Kteish; only Amer or Rabih approve bills.
for (const id of ['amer', 'rabih', 'kteish']) assert.equal(canSee(id, 'finance'), true, id);
for (const id of ['melyssa', 'ahmed', 'mazen']) assert.equal(canSee(id, 'finance'), false, id);
assert.deepEqual(STAFF.filter(person => canDo(person.id, 'approveExpense')).map(person => person.id), ['amer', 'rabih']);
assert.equal(canSee('amer', 'dashboard'), true);
// Operations: Mazen runs rooms and purchasing requests.
assert.equal(canSee('mazen', 'rooms') && canDo('mazen', 'manageRooms') && canSee('mazen', 'requests'), true);
// Nazha writes group notes; trainers log fitness attendance; Imad records doses under Fadia.
assert.equal(canSeeTab('nazha', 'clinical'), true);
for (const id of ['zeina', 'tony-j', 'tony-am', 'raymond']) assert.equal(canSeeTab(id, 'fitness') && !canSeeTab(id, 'clinical'), true, id);
assert.equal(canDo('imad', 'recordMedication') && canSee('imad', 'medication'), true);
assert.equal(canDo('georgio', 'recordMedication'), false);
// Petty cash is held by Georgio: wallet purchases are his.
assert.equal(canDo('georgio', 'pettyCash'), true);
assert.equal(canDo('alaa', 'pettyCash'), false);
// RSAs see their own residents; Omar, the senior RSA, sees every resident.
{
  const state = seed();
  const inpatients = state.patients.filter(patient => patient.status === 'Admitted' && patient.program !== 'Outpatient');
  assert.equal(visiblePatients(state, 'omar').length, inpatients.length);
  const rsas = ['georgio', 'alaa', 'dania', 'imad'];
  for (const id of rsas) assert.ok(visiblePatients(state, id).length > 0, `${id} has residents`);
  assert.equal(rsas.reduce((sum, id) => sum + visiblePatients(state, id).length, 0), inpatients.length, 'each resident has one RSA');
}

// Old preview data or a corrupt copy must never crash the new workspace.
for (const raw of ['{"inquiries":[1]}', 'not json', null]) {
  const state = loadState(raw);
  assert.equal(state.version, 3);
  assert.equal(state.leads.length, 14);
}
const fresh = seed();
assert.deepEqual(loadState(JSON.stringify(fresh)).inquiries.map(item => item.id), fresh.inquiries.map(item => item.id));
for (const inquiry of fresh.inquiries) assert.equal(typeof inquiry.potentialRevenue, 'number', inquiry.id);

await withSsr(async ({ html }) => {
  for (const person of STAFF) {
    const page = await html('/src/App.svelte', { staffId: person.id });
    assert.ok(page.includes(person.name), `${person.id} sees their name`);
    assert.equal(page.includes('href="#/leads"'), ['amer', 'ahmed', 'melyssa'].includes(person.id), `${person.id} Leads visibility`);
  }
});

console.log('Foundation checks passed.');
