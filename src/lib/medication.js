// Medication rounds and drug screens. Fadia records; Ahmed and the Clinical Director can read.
import { nextId } from './ids.js';
import { todayISO } from './dates.js';
import { notify } from './notifications.js';
import { log } from './activity.js';
import { canDo } from './people.js';

export const ROUTES = ['Oral', 'Sublingual', 'Injection', 'Topical', 'Inhaled'];
export const DOSE_STATUSES = ['Given', 'Refused', 'Missed', 'Held'];
export const SUBSTANCES = ['Alcohol', 'Cannabis', 'Cocaine', 'Opioids', 'Benzodiazepines', 'Amphetamines', 'Other'];

const med = state => (state.medication ||= { orders: [], doses: [], tests: [] });
const allowed = staffId => { if (!canDo(staffId, 'recordMedication')) throw new Error('Medication is recorded by Fadia, or Imad under her supervision.'); };
const patientOf = (state, id) => { const patient = state.patients.find(item => item.id === id && item.status === 'Admitted'); if (!patient) throw new Error('Choose a patient in care.'); return patient; };

export function addOrder(state, { patientId, drug, dose, route = 'Oral', times = [], startDate, endDate = '', prescriptionDocId = '', note = '' }, staffId) {
  allowed(staffId);
  const patient = patientOf(state, patientId);
  if (!String(drug || '').trim()) throw new Error('Add the medication.');
  if (!String(dose || '').trim()) throw new Error('Add the dose.');
  const slots = [...new Set(times.filter(time => /^\d\d:\d\d$/.test(time)))].sort();
  if (!slots.length) throw new Error('Choose at least one round time.');
  const order = { id: nextId('MED', med(state).orders), patientId, drug: drug.trim(), dose: dose.trim(), route, times: slots, startDate: startDate || todayISO(), endDate, prescriptionDocId, note: String(note).trim(), status: 'Active', createdBy: staffId, createdAt: new Date().toISOString() };
  med(state).orders.push(order);
  log(state, staffId, `Medication started for ${patient.clinicalName}: ${order.drug} ${order.dose}`, `#/medication`);
  return order;
}

export function stopOrder(state, orderId, staffId) {
  allowed(staffId);
  const order = med(state).orders.find(item => item.id === orderId);
  if (!order) throw new Error('This medication was not found.');
  Object.assign(order, { status: 'Stopped', endDate: todayISO(), stoppedBy: staffId });
  log(state, staffId, `Medication stopped: ${order.drug}`, '#/medication');
  return order;
}

const activeOn = (order, date) => order.status === 'Active' ? order.startDate <= date && (!order.endDate || order.endDate >= date) : order.startDate <= date && order.endDate && order.endDate > date;

// Every dose due on a day, with what was recorded against it.
export function roundFor(state, date) {
  const { orders, doses } = med(state);
  return orders.filter(order => activeOn(order, date)).flatMap(order => order.times.map(time => {
    const record = doses.find(dose => dose.orderId === order.id && dose.date === date && dose.time === time);
    return { key: `${order.id}-${date}-${time}`, orderId: order.id, patientId: order.patientId, drug: order.drug, dose: order.dose, route: order.route, date, time, status: record?.status || 'Due', record };
  })).sort((a, b) => a.time.localeCompare(b.time) || a.patientId.localeCompare(b.patientId));
}

export function recordDose(state, { orderId, date, time, status, note = '' }, staffId) {
  allowed(staffId);
  const order = med(state).orders.find(item => item.id === orderId);
  if (!order) throw new Error('This medication was not found.');
  if (!DOSE_STATUSES.includes(status)) throw new Error('Choose Given, Refused, Missed or Held.');
  if (med(state).doses.some(dose => dose.orderId === orderId && dose.date === date && dose.time === time)) throw new Error('This dose is already recorded.');
  if (status !== 'Given' && !String(note).trim()) throw new Error('Add a note for a dose that was not given.');
  const dose = { id: nextId('DOSE', med(state).doses), orderId, patientId: order.patientId, date, time, status, note: String(note).trim(), by: staffId, at: new Date().toISOString() };
  med(state).doses.push(dose);
  if (status === 'Refused' || status === 'Missed') {
    const patient = state.patients.find(item => item.id === order.patientId);
    notify(state, { to: 'clinical-director', title: `Dose ${status.toLowerCase()}: ${patient.clinicalName}`, body: `${order.drug} ${order.dose} at ${time}. ${dose.note}`, link: '#/medication' });
  }
  return dose;
}

export function recordTest(state, { patientId, date, result, substances = [], note = '' }, staffId) {
  allowed(staffId);
  const patient = patientOf(state, patientId);
  if (!['Negative', 'Positive'].includes(result)) throw new Error('Choose Negative or Positive.');
  if (result === 'Positive' && !substances.length) throw new Error('Choose the substances detected.');
  const test = { id: nextId('UDS', med(state).tests), patientId, date: date || todayISO(), type: 'Urine drug screen', result, substances: result === 'Positive' ? substances : [], note: String(note).trim(), by: staffId, at: new Date().toISOString() };
  med(state).tests.push(test);
  if (result === 'Positive') notify(state, { to: ['ahmed', 'clinical-director'], title: `Positive drug screen: ${patient.clinicalName}`, body: test.substances.join(', '), link: '#/medication/tests' });
  log(state, staffId, `Drug screen for ${patient.clinicalName}: ${result}`, '#/medication/tests');
  return test;
}
