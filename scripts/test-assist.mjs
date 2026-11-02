import assert from 'node:assert/strict';
import { draftSessionNote } from '../src/lib/assist/sessionDraft.js';
import { weekSummary, prepareCaseReview } from '../src/lib/assist/caseReview.js';

// ---- Session-note drafting ----
let draft = draftSessionNote('Attended. Talked about sleep and cravings at night. Next session we practise urge surfing.');
assert.equal(draft.values.attendance, 'Attended');
assert.deepEqual(draft.values.riskFlags, ['Relapse / craving']);
assert.equal(draft.values.escalatedTo, 'Ahmed');
assert.match(draft.values.progress, /urge surfing/);
assert.match(draft.values.themes, /sleep and cravings/);
assert.ok(!draft.values.themes.includes('urge surfing'), 'the plan line is not repeated in themes');
assert.deepEqual(draft.filled.sort(), ['attendance', 'escalatedTo', 'progress', 'riskFlags', 'themes']);

draft = draftSessionNote('Denies self-harm. No cravings this week. Calm and engaged.');
assert.deepEqual(draft.values.riskFlags, ['None'], 'negated mentions never raise a flag');
assert.equal(draft.values.escalatedTo, '');

assert.equal(draftSessionNote('He refused the session today.').values.attendance, 'Refused');
assert.equal(draftSessionNote('Session moved to Thursday at his request.').values.attendance, 'Rescheduled');

draft = draftSessionNote('Says he wants to run away tonight. Withdrawal pain keeps him awake.');
assert.deepEqual(draft.values.riskFlags, ['Absconding']);
assert.equal(draft.values.escalatedTo, 'Ahmed, Fadia', 'medical content adds Fadia');

assert.deepEqual(draftSessionNote('تحدث عن أفكار انتحار الليلة الماضية').values.riskFlags, ['Self-harm']);
assert.deepEqual(draftSessionNote('Il a parlé de rechute et d’envie de boire.').values.riskFlags, ['Relapse / craving']);
assert.deepEqual(draftSessionNote('Shouted at a peer and threatened staff.').values.riskFlags, ['Aggression']);
assert.deepEqual(draftSessionNote('').values, { attendance: undefined, themes: '', riskFlags: [], escalatedTo: '', progress: '' });

// ---- Case review prep ----
const now = new Date('2026-11-10T12:00:00');
const at = day => new Date(`${day}T15:00:00`).toISOString();
const patient = (id, name, phase) => ({ id, fullName: name, clinicalName: name.replace(/ (\w)\w+$/, ' $1.'), status: 'Admitted', phase, admittedAt: '2026-10-01', roomId: '101' });
const state = {
  patients: [patient('P-1', 'Calm Patient', '2 Core treatment'), patient('P-2', 'Busy Patient', '2 Core treatment'), patient('P-3', 'Leaving Patient', '4 Discharge prep'), { ...patient('P-4', 'Gone Patient', '3 Consolidation'), status: 'Discharged' }],
  forms: [
    { id: 'F1', formId: 'session', status: 'Filed', patientId: 'P-2', filedAt: at('2026-11-08'), values: { date: '2026-11-08', attendance: 'Attended', riskFlags: ['Relapse / craving'] } },
    { id: 'F2', formId: 'session', status: 'Filed', patientId: 'P-2', filedAt: at('2026-11-05'), values: { date: '2026-11-05', attendance: 'Refused', riskFlags: ['None'] } },
    { id: 'F3', formId: 'session', status: 'Filed', patientId: 'P-1', filedAt: at('2026-10-20'), values: { date: '2026-10-20', attendance: 'Attended', riskFlags: ['Aggression'] } },
    { id: 'F4', formId: 'group', status: 'Filed', patientIds: ['P-2'], filedAt: at('2026-11-06'), values: { date: '2026-11-06', attendance: [{ patientId: 'P-2', present: false }] } },
    { id: 'F5', formId: 'injury', status: 'Filed', patientId: 'P-2', filedAt: at('2026-11-07'), values: { date: '2026-11-07', severity: 'Minor', bodyPart: 'Knee' } },
    { id: 'F6', formId: 'wellbeing', status: 'Filed', patientId: 'P-1', filedAt: at('2026-11-09'), values: { weekEnding: '2026-11-09', energy: 4, sleep: 4, mood: 4, activityFeel: 4 } },
    { id: 'F7', formId: 'wellbeing', status: 'Filed', patientId: 'P-1', filedAt: at('2026-11-02'), values: { weekEnding: '2026-11-02', energy: 3, sleep: 2, mood: 3, activityFeel: 4 } },
    { id: 'F8', formId: 'intake', status: 'Filed', patientId: 'P-2', filedAt: at('2026-10-03'), values: { riskSelfHarm: 'Low', riskAbscond: 'Medium', riskAggression: 'Low' } }
  ],
  documents: [{ id: 'D1', patientId: 'P-2', type: 'Prescription', createdAt: at('2026-11-09') }],
  appointments: [], tasks: [], requests: []
};

const calm = weekSummary(state, 'P-1', now);
assert.deepEqual(calm.flags, [], 'an aggression flag from three weeks ago is outside the week');
assert.deepEqual(calm.wellbeing, { latest: 4, previous: 3 });
const busy = weekSummary(state, 'P-2', now);
assert.deepEqual(busy.flags.map(flag => flag.key).sort(), ['incident', 'medication', 'refusal', 'relapse']);
assert.equal(busy.risk, 'Medium');
assert.match(busy.brief, /relapse/i);
assert.deepEqual(weekSummary(state, 'P-3', now).flags.map(flag => flag.key), ['discharge']);

const prep = prepareCaseReview(state, now);
assert.deepEqual(prep.rows.map(row => row.patientId), ['P-2', 'P-3', 'P-1'], 'flagged patients first; discharged excluded');
assert.equal(prep.flagged, 2);
assert.equal(prep.highRisk, 'Busy P.');
assert.ok(prep.rows.every(row => row.decisions === '' && row.action === ''), 'decisions stay with the team');
assert.equal(prep.rows[0].phase, '2 Core treatment');

console.log('Assist checks passed.');
