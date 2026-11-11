import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { COMMANDS, FUNCTIONS, applyCommand } from '../src/lib/commands.js';
import { slotsFromSource, render, SLOT_FILE } from './lib/command-slots.mjs';
import { seed } from '../src/lib/seed.js';

// Every change the screens make is a named command, so the server can run it as the signed-in person.
const now = new Date('2026-11-11T10:00:00');
assert.deepEqual(COMMANDS.recordDose.slots, ['arg', 'me', 'now']);
assert.deepEqual(COMMANDS.completeStep.slots, ['arg', 'arg', 'arg', 'me', 'now']);

const state = seed(now);
assert.equal(applyCommand(state, 'reportIncident', [{ type: 'Aggression', level: 1, description: 'x' }], 'alaa', now).reportedBy, 'alaa');
assert.throws(() => applyCommand(state, 'nope', [], 'amer', now), /Unknown command: nope/);

// Notifications are marked read only by the person they were sent to.
const note = state.notifications[0];
const other = note.to === 'melyssa' ? 'amer' : 'melyssa';
assert.throws(() => applyCommand(state, 'markRead', [note.id], other, now), /Not your notification/);
applyCommand(state, 'markRead', [note.id], note.to, now);
assert.equal(note.read, true);

// A form is always filed as the person signed in, whatever the browser puts in it.
assert.deepEqual(COMMANDS.fileForm.slots, ['arg+me']);
const patient = state.patients.find(item => item.status === 'Admitted');
const entry = applyCommand(state, 'fileForm', [{ formId: 'escort', patientId: patient.id, values: {}, staffId: 'fadia' }], 'georgio', now);
assert.equal(entry.createdBy, 'georgio');

// Every function a screen changes data with is registered.
const root = fileURLToPath(new URL('../src', import.meta.url));
const walk = dir => readdirSync(dir).flatMap(name => { const path = join(dir, name); return statSync(path).isDirectory() ? walk(path) : [path]; });
const sources = walk(root).filter(path => path.endsWith('.svelte'));
const acting = sources.filter(path => /import \{ act \} from '[./]+(lib\/)?act\.js'/.test(readFileSync(path, 'utf8')));
const called = new Set(acting.flatMap(path => [...readFileSync(path, 'utf8').matchAll(/\bact\('([a-zA-Z]+)'/g)].map(match => match[1])));
const missing = [...called].filter(name => !COMMANDS[name]);
assert.deepEqual(missing, [], `not registered: ${missing.join(', ')}`);
assert.ok(called.size > 80, 'the screens change data through act()');
// No screen changes data any other way.
const direct = sources.filter(path => /\bcommit\(/.test(readFileSync(path, 'utf8')));
assert.deepEqual(direct, [], 'screens call commit() directly');
// The wallet always records the signed-in person as the one who handled the money.
const wallet = seed(now);
const resident = wallet.patients.find(item => item.status === 'Admitted');
assert.equal(applyCommand(wallet, 'walletDeposit', [{ patientId: resident.id, amount: '20', description: 'Family deposit', recordedBy: 'amer' }], 'kteish', now).recordedBy, 'kteish');
// The slot table the app runs on (built code renames parameters) matches the source.
assert.equal(readFileSync(SLOT_FILE, 'utf8').replace(/\r\n/g, '\n'), render(slotsFromSource(FUNCTIONS)), 'src/lib/commandSlots.js is stale: run node scripts/gen-command-slots.mjs');
console.log('Command checks passed.');
