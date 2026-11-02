// Every page renders for every person allowed to open it, with its key content, and stays hidden from everyone else.
import assert from 'node:assert/strict';
import { STAFF, RESIDENTS, PAGES, canSee } from '../src/lib/people.js';
import { withSsr } from './lib/ssr.mjs';

const EXPECT = {
  finance: ['Finance', 'Owed to Cedar', 'Invoices'],
  sessions: ['Sessions', 'Notes filed'],
  medication: ['Medication', 'Round'],
  rooms: ['Rooms &amp; beds', 'Occupied'],
  safety: ['Visits &amp; incidents', 'Report incident'],
  reports: ['Reports', 'CSV'],
  insights: ['Insights', 'Cedar Intelligence'],
  home: ['Hello, Karim', 'Available in your wallet', 'Send request'],
  dashboard: ['Money', 'Safety', 'Potential revenue'],
  requests: ['Resident support', 'Daily check-ins'],
  followups: ['Follow-ups', 'Maya Sleiman', 'Schedule assessment', 'Rima Sleiman (parent)'],
  programs: ['Programs', 'Foundations: first 28 days', 'The week', 'Patients on this program']
};
const PAGE_FILES = { finance: 'Finance', sessions: 'Sessions', medication: 'Medication', rooms: 'Rooms', safety: 'Safety', reports: 'Reports', insights: 'Insights', home: 'Home', dashboard: 'Dashboard', requests: 'Requests', today: 'Today', leads: 'Leads', pipeline: 'Pipeline', admissions: 'Admissions', patients: 'Patients', schedule: 'Schedule', followups: 'FollowUps', programs: 'Programs' };

await withSsr(async ({ load, html }) => {
  const { session } = await load('/src/lib/store.svelte.js');
  for (const person of [...STAFF, RESIDENTS[0]]) {
    for (const page of PAGES) {
      if (!canSee(person.id, page.id)) continue;
      session.staffId = person.id;
      const out = await html(`/src/pages/${PAGE_FILES[page.id]}.svelte`, { args: [] });
      for (const text of EXPECT[page.id] || []) assert.ok(out.includes(text), `${person.id} on ${page.id}: missing "${text}"`);
    }
  }
  // The sidebar groups pages into sections, and the resident sees only their own space.
  const amer = await html('/src/App.svelte', { staffId: 'amer' });
  for (const group of ['My work', 'Intake', 'Care', 'Operations', 'Finance']) assert.ok(amer.includes(group), `sidebar section ${group}`);
  // Phones get a dock with the person's four main pages, then More for the rest.
  const dock = amer.slice(amer.indexOf('class="tabbar"'));
  assert.deepEqual([...dock.matchAll(/class="tab-label">([^<]+)</g)].map(match => match[1]).slice(0, 5), ['Today', 'Dashboard', 'Pipeline', 'Leads', 'More']);
  const resident = await html('/src/App.svelte', { staffId: 'resident-p0001' });
  assert.ok(resident.includes('href="#/home"'));
  for (const hidden of ['#/patients', '#/finance', '#/today', '#/leads']) assert.ok(!resident.includes(`href="${hidden}"`), `resident must not see ${hidden}`);
  assert.equal(canSee('melyssa', 'medication'), false);
  assert.equal(canSee('rsa', 'finance'), false);
  assert.equal(canSee('john', 'safety'), true, 'everyone can report an incident');
});

console.log('UI checks passed.');
