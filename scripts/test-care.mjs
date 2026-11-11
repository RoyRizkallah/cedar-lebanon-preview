import assert from 'node:assert/strict';
import { addOrder, stopOrder, roundFor, recordDose, recordTest } from '../src/lib/medication.js';
import { logVisit, startLeave, returnLeave, leaveStatus, reportIncident, reviewIncident } from '../src/lib/safety.js';
import { roomBoard, setRoomStatus, addRoom, updateRoom, removeRoom } from '../src/lib/rooms.js';
import { sessionsWeek } from '../src/lib/sessions.js';
import { addCheckin, addComment } from '../src/lib/support.js';
import { seed } from '../src/lib/seed.js';

const now = new Date('2026-11-02T10:00:00');
const state = seed(now);
const patient = state.patients.find(item => item.status === 'Admitted' && item.roomId && !state.leaves.some(leave => leave.patientId === item.id && !leave.returnedAt));
const count = to => state.notifications.filter(item => item.to === to).length;

// ---- Medication rounds ----
assert.throws(() => addOrder(state, { patientId: patient.id, drug: 'Diazepam', dose: '5 mg', times: ['08:00'] }, 'melyssa'), /Medication is recorded by Fadia/);
assert.throws(() => addOrder(state, { patientId: patient.id, drug: '', dose: '5 mg', times: ['08:00'] }, 'fadia'), /Add the medication/);
const order = addOrder(state, { patientId: patient.id, drug: 'Diazepam', dose: '5 mg', route: 'Oral', times: ['08:00', '20:00'], startDate: '2026-11-02' }, 'fadia');
const round = roundFor(state, '2026-11-02').filter(item => item.orderId === order.id);
assert.deepEqual(round.map(item => item.time), ['08:00', '20:00']);
assert.ok(round.every(item => item.status === 'Due'));
recordDose(state, { orderId: order.id, date: '2026-11-02', time: '08:00', status: 'Given' }, 'fadia');
assert.throws(() => recordDose(state, { orderId: order.id, date: '2026-11-02', time: '08:00', status: 'Given' }, 'fadia'), /already recorded/);
assert.throws(() => recordDose(state, { orderId: order.id, date: '2026-11-02', time: '20:00', status: 'Refused' }, 'fadia'), /Add a note/);
const cd = count('ahmed');
recordDose(state, { orderId: order.id, date: '2026-11-02', time: '20:00', status: 'Refused', note: 'Felt drowsy' }, 'fadia');
assert.equal(count('ahmed'), cd + 1, 'a refused dose alerts the Clinical Director');
assert.deepEqual(roundFor(state, '2026-11-02').filter(item => item.orderId === order.id).map(item => item.status), ['Given', 'Refused']);
stopOrder(state, order.id, 'fadia', new Date('2026-11-02T12:00:00'));
assert.equal(roundFor(state, '2026-11-03').filter(item => item.orderId === order.id).length, 0, 'stopped orders leave the round');

// ---- Drug tests ----
assert.throws(() => recordTest(state, { patientId: patient.id, result: 'Positive', substances: [] }, 'fadia'), /Choose the substances/);
const ahmed = count('ahmed');
recordTest(state, { patientId: patient.id, date: '2026-11-02', result: 'Positive', substances: ['Cannabis'] }, 'fadia');
assert.equal(count('ahmed'), ahmed + 1);
recordTest(state, { patientId: patient.id, date: '2026-11-02', result: 'Negative', substances: [] }, 'fadia');
assert.equal(count('ahmed'), ahmed + 1, 'negative tests alert nobody');

// ---- Visits, leave, incidents ----
assert.throws(() => logVisit(state, { patientId: patient.id, visitor: '' }, 'melyssa'), /Add the visitor/);
const visit = logVisit(state, { patientId: patient.id, visitor: 'Mona H.', relation: 'Mother', date: '2026-11-02', start: '15:00', end: '16:00' }, 'rsa');
assert.equal(visit.loggedBy, 'rsa');
const leave = startLeave(state, { patientId: patient.id, out: '2026-11-02T10:00:00', dueBack: '2026-11-02T18:00:00', escort: 'Brother', clinicalOk: true }, 'melyssa');
assert.throws(() => startLeave(state, { patientId: patient.id, out: '2026-11-02T11:00:00', dueBack: '2026-11-02T19:00:00' }, 'melyssa'), /already out/);
assert.equal(leaveStatus(leave, new Date('2026-11-02T17:00:00')), 'Out');
assert.equal(leaveStatus(leave, new Date('2026-11-02T18:30:00')), 'Overdue');
const before = count('ahmed');
returnLeave(state, leave.id, 'melyssa', new Date('2026-11-02T19:10:00'));
assert.equal(leaveStatus(leave), 'Returned late');
assert.equal(count('ahmed'), before + 1, 'a late return alerts Ahmed');
assert.throws(() => reportIncident(state, { type: 'Aggression', severity: 'High', description: '' }, 'john'), /Describe what happened/);
const urgentBefore = state.notifications.filter(item => item.urgent).length;
const incident = reportIncident(state, { patientId: patient.id, type: 'Aggression', severity: 'High', description: 'Pushed a peer at dinner.', actionTaken: 'Separated; calm after 10 minutes.' }, 'john');
assert.equal(state.notifications.filter(item => item.urgent).length, urgentBefore + 2, 'high severity alerts Ahmed and Omar urgently');
assert.throws(() => reviewIncident(state, incident.id, { outcome: 'ok' }, 'john'), /reviewed by Ahmed/);
reviewIncident(state, incident.id, { outcome: 'Discussed in case review; behaviour plan updated.' }, 'ahmed');
assert.equal(incident.status, 'Reviewed');

// ---- Rooms ----
const board = roomBoard(state, now);
const occupied = board.find(room => room.beds.some(bed => bed.patient));
assert.ok(occupied.beds.some(bed => bed.patient?.id));
assert.throws(() => setRoomStatus(state, occupied.id, 'Maintenance', 'melyssa'), /has patients in it/);
assert.throws(() => setRoomStatus(state, occupied.id, 'Cleaning', 'john'), /Rooms are managed by Mazen, Melyssa or the partners/);
const added = addRoom(state, { id: '201', wing: 'Upper', beds: 1, access: 'Step-free' }, 'melyssa');
assert.equal(roomBoard(state, now).find(room => room.id === '201').beds.length, 1);
assert.throws(() => addRoom(state, { id: '201', beds: 2 }, 'melyssa'), /already exists/);
updateRoom(state, '201', { beds: 2, notes: 'Fresh linen Fridays' }, 'melyssa');
assert.throws(() => updateRoom(state, occupied.id, { beds: 0 }, 'melyssa'), /at least 1 bed|occupied/);
setRoomStatus(state, added.id, 'Maintenance', 'melyssa');
assert.equal(roomBoard(state, now).find(room => room.id === '201').status, 'Maintenance');
removeRoom(state, '201', 'melyssa');
assert.throws(() => removeRoom(state, occupied.id, 'melyssa'), /has patients in it/);

// ---- Sessions hub ----
const week = sessionsWeek(state, 'ahmed', '2026-10-26', now);
assert.ok(week.items.length > 0);
assert.ok(week.items.some(item => item.appointment.provider === 'samar'), 'the Clinical Director sees the psychologists’ sessions');
assert.ok(sessionsWeek(state, 'nabila', '2026-10-26', now).items.every(item => item.appointment.provider === 'nabila'), 'Nabila sees her own');
assert.ok(week.items.some(item => item.appointment.service === 'Group' && item.attendance));
const nabila = sessionsWeek(state, 'nabila', '2026-10-26', now);
assert.equal(nabila.summary.overdue, 1, 'the missing seeded note is overdue');

// ---- RSA check-ins and team comments ----
assert.throws(() => addCheckin(state, { patientId: patient.id, mood: 'Settled', note: '' }, 'rsa'), /Add a short note/);
const checkin = addCheckin(state, { patientId: patient.id, mood: 'Needs follow-up', note: 'Asked for help calling home.' }, 'rsa');
assert.equal(checkin.mood, 'Needs follow-up');
assert.throws(() => addComment(state, { patientId: patient.id, text: ' ' }, 'melyssa'), /Write a comment/);
assert.equal(addComment(state, { patientId: patient.id, text: 'Family visiting Saturday.' }, 'melyssa').by, 'melyssa');

console.log('Care module checks passed.');
