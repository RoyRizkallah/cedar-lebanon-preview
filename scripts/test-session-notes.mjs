import assert from 'node:assert/strict';
import { SERVICES, noteFormFor, sessionKind } from '../src/lib/scheduling.js';
import { sessionsWeek } from '../src/lib/sessions.js';
import { formById } from '../src/lib/forms/engine.js';
import { addDays, todayISO, weekday } from '../src/lib/dates.js';
import { seed } from '../src/lib/seed.js';
import { withSsr } from './lib/ssr.mjs';

// One map decides each session's note: individual therapy -> Form 3, groups and drama -> Form 4, every fitness service -> fitness Form 2.
assert.equal(noteFormFor('Psychologist session'), 'session');
assert.equal(noteFormFor('Therapist session'), 'session');
assert.equal(noteFormFor('Group'), 'group');
assert.equal(noteFormFor('Drama therapy'), 'group');
for (const service of ['Fitness session', 'Physiotherapy', 'Movement & yoga', 'Tennis', 'Personal training', 'Boxing / MMA']) {
  assert.equal(noteFormFor(service), 'attendance', service);
  assert.equal(sessionKind(service), 'Fitness', service);
}
assert.equal(noteFormFor('Assessment'), null, 'an assessment before admission has no session note');
assert.equal(noteFormFor('Nursing appointment'), null);
// Every service a trainer or Nazha leads has a note they are allowed to write.
for (const service of SERVICES.filter(item => ['zeina', 'tony-j', 'tony-am', 'raymond', 'nazha'].includes(item.provider))) {
  assert.ok(formById(noteFormFor(service.name)).owners.includes(service.provider), `${service.provider} writes the ${service.name} note`);
}

// Their sessions appear on the Sessions page.
const state = seed();
const today = todayISO();
const monday = addDays(today, -((weekday(today) + 6) % 7));
const nextMonday = addDays(monday, 7);
for (const [id, kind] of [['zeina', 'Fitness'], ['nazha', 'Group']]) {
  const items = [...sessionsWeek(state, id, monday).items, ...sessionsWeek(state, id, nextMonday).items];
  assert.ok(items.length > 0, `${id} has sessions`);
  assert.ok(items.every(item => item.kind === kind), `${id}: ${kind}`);
}

await withSsr(async ({ load, html }) => {
  const { session } = await load('/src/lib/store.svelte.js');
  session.staffId = 'nazha';
  const page = await html('/src/pages/Sessions.svelte', { args: [] });
  assert.ok(page.includes('Drama therapy') || page.includes('Playback theatre') || page.includes('Warm-up and story'), 'Nazha sees her drama sessions');
});

console.log('Session note checks passed.');
