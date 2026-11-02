// Run on Beirut time: anything recorded between midnight and 03:00 local must stay on that local day.
process.env.TZ = 'Asia/Beirut';
const assert = (await import('node:assert/strict')).default;
const { localDay, fmtDate } = await import('../src/lib/dates.js');
const { tasksFor } = await import('../src/lib/tasks.js');
const { weekSummary } = await import('../src/lib/assist/caseReview.js');

const earlyMorning = new Date(2026, 10, 2, 1, 30).toISOString(); // 2 Nov, 01:30 in Beirut
assert.equal(earlyMorning.slice(0, 10), '2026-11-01', 'sanity: the UTC date is the day before');
assert.equal(localDay(earlyMorning), '2026-11-02');
assert.equal(localDay('2026-11-02'), '2026-11-02', 'plain dates pass through');
assert.equal(fmtDate(earlyMorning), fmtDate('2026-11-02'), 'dates shown from a timestamp use the local day');

// A countersignature for a form filed at 01:30 is due today, not overdue.
const now = new Date(2026, 10, 2, 10, 0);
const state = { leads: [], inquiries: [], onboardings: [], appointments: [], documents: [], requests: [], tasks: [], notifications: [], activity: [],
  patients: [{ id: 'P-1', clinicalName: 'Test P.', fullName: 'Test Person', status: 'Admitted', admittedAt: '2026-10-20', phase: '2 Core treatment' }],
  forms: [{ id: 'F-1', formId: 'intake', patientId: 'P-1', status: 'Filed', filedAt: earlyMorning, values: { riskSelfHarm: 'Low', riskAbscond: 'Low', riskAggression: 'Low' } }] };
const work = tasksFor(state, 'clinical-director', now);
assert.ok(work.today.some(item => item.kind === 'sign'), 'countersign is due today');
assert.ok(!work.overdue.some(item => item.kind === 'sign'));

// A prescription received at 01:30 eight days later than 25 Oct is still inside the 7-day window on 9 Nov.
state.documents.push({ id: 'D-1', patientId: 'P-1', type: 'Prescription', createdAt: new Date(2026, 10, 2, 1, 30).toISOString() });
assert.ok(weekSummary(state, 'P-1', new Date(2026, 10, 9, 12, 0)).flags.some(flag => flag.key === 'medication'));

console.log('Time zone checks passed.');
