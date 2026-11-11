// Fictional sample records for accounting, medication, visits, leave, incidents, check-ins and comments.
import { addDays } from './dates.js';

export function seedCare(state, today) {
  const day = n => addDays(today, n);
  const at = (n, time) => new Date(`${day(n)}T${time}:00`).toISOString();
  const month = today.slice(0, 7);
  const previous = addDays(`${month}-01`, -1).slice(0, 7);
  const admitted = state.patients.filter(patient => patient.status === 'Admitted');
  const payers = ['Self-pay', 'Family', 'Self-pay', 'Insurance', 'Family', 'Employer', 'Self-pay', 'Family', 'Self-pay', 'Sponsor'];
  state.patients.forEach((patient, index) => { patient.payer = payers[index % payers.length]; });

  // Invoices: last month mostly settled, this month issued on the 1st.
  let inv = 0;
  const invoice = (patient, issued, paidShare, method = 'Bank transfer') => {
    const id = `INV-${String(++inv).padStart(4, '0')}`;
    const label = new Date(`${issued}T12:00:00`).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });
    const payments = paidShare > 0 ? [{ id: `PAY-${id}-1`, amount: Math.round(patient.monthlyAmount * paidShare), method, date: addDays(issued, 4), reference: `TRF-${1000 + inv}`, by: 'melyssa' }] : [];
    state.finance.invoices.push({ id, patientId: patient.id, payer: patient.payer, amount: patient.monthlyAmount, issued, due: addDays(issued, 7), description: `${label} program fee`, status: 'Open', payments, createdBy: 'melyssa' });
  };
  state.patients.filter(patient => patient.status === 'Discharged').forEach(patient => invoice(patient, `${patient.dischargedAt.slice(0, 7)}-01`, 1));
  admitted.forEach((patient, index) => {
    if (patient.admittedAt < `${month}-01`) invoice(patient, `${previous}-01`, index === 2 ? 0.5 : index === 5 ? 0 : 1, index % 3 === 0 ? 'Cash' : 'Bank transfer');
    invoice(patient, `${month}-01`, index % 4 === 0 ? 1 : 0);
  });

  state.finance.expenses.push(
    { id: 'EXP-0001', supplier: 'Beirut Medical Supply', description: 'Detox kits and test strips', category: '5100', amount: 640, date: day(-12), due: day(2), reference: 'BMS-2201', status: 'Paid', payments: [{ id: 'EPAY-EXP-0001-1', amount: 640, method: 'Bank transfer', date: day(-5), reference: 'BNK-5501', by: 'melyssa' }], createdBy: 'melyssa' },
    { id: 'EXP-0002', supplier: 'Mount Lebanon Facilities', description: 'Monthly maintenance visit', category: '5200', amount: 380, date: day(-8), due: day(6), reference: 'MLF-88', status: 'Approved', payments: [], createdBy: 'melyssa', approvedBy: 'ahmed' },
    { id: 'EXP-0003', supplier: 'Shady’s kitchen suppliers', description: 'Weekly groceries', category: '5300', amount: 910, date: day(-3), due: day(11), reference: 'KS-341', status: 'Pending approval', payments: [], createdBy: 'melyssa' },
    { id: 'EXP-0004', supplier: 'Haddad Accounting', description: 'Monthly bookkeeping review', category: '5400', amount: 450, date: day(-15), due: day(-1), reference: 'HA-10', status: 'Approved', payments: [], createdBy: 'melyssa', approvedBy: 'ahmed' }
  );
  state.finance.manualEntries.push({ id: 'MAN-0001', date: day(-10), description: 'Petty cash float', reference: 'PC-1', debitAccount: '1020', creditAccount: '1010', amount: 300, by: 'ahmed' });
  const receipt = state.finance.invoices.find(item => item.payments.length && item.payments[0].method === 'Bank transfer');
  state.finance.bankEntries.push(
    { id: 'BANK-0001', date: receipt.payments[0].date, description: 'Incoming transfer', amount: receipt.payments[0].amount, reference: receipt.payments[0].reference, matchedJournalId: `J-${receipt.payments[0].id}` },
    { id: 'BANK-0002', date: day(-5), description: 'Beirut Medical Supply', amount: -640, reference: 'BNK-5501', matchedJournalId: 'J-EPAY-EXP-0001-1' },
    { id: 'BANK-0003', date: day(-2), description: 'Incoming transfer, reference unclear', amount: 1200, reference: 'STMT-778', matchedJournalId: '' },
    { id: 'BANK-0004', date: day(-1), description: 'Bank charges', amount: -18, reference: 'FEE-11', matchedJournalId: '' }
  );

  // Medication rounds for detox and the patient with a new prescription.
  const byName = name => state.patients.find(patient => patient.fullName === name);
  const orders = [
    ['MED-0001', 'Tony Farah', 'Diazepam (taper)', '10 mg', ['08:00', '14:00', '20:00'], -4],
    ['MED-0002', 'Jad Saliba', 'Buprenorphine', '8 mg', ['08:00'], -18],
    ['MED-0003', 'Elie Mansour', 'Sertraline', '50 mg', ['08:00'], -2],
    ['MED-0004', 'Ziad Fakhoury', 'Thiamine', '100 mg', ['08:00', '20:00'], -1],
    ['MED-0005', 'Hadi Nasr', 'Naltrexone', '50 mg', ['20:00'], -50]
  ];
  for (const [id, name, drug, dose, times, start] of orders) {
    const patient = byName(name);
    state.medication.orders.push({ id, patientId: patient.id, drug, dose, route: 'Oral', times, startDate: day(start), endDate: '', note: '', status: 'Active', createdBy: 'fadia', createdAt: at(start, '09:00') });
  }
  let doseSeq = 0;
  for (const order of state.medication.orders) {
    for (const n of [-1, 0]) {
      if (order.startDate > day(n)) continue;
      for (const time of order.times) {
        if (n === 0 && time > '09:00') continue;
        const refused = order.id === 'MED-0001' && n === -1 && time === '20:00';
        state.medication.doses.push({ id: `DOSE-${String(++doseSeq).padStart(4, '0')}`, orderId: order.id, patientId: order.patientId, date: day(n), time, status: refused ? 'Refused' : 'Given', note: refused ? 'Said he felt too drowsy.' : '', by: 'fadia', at: at(n, time) });
      }
    }
  }
  state.medication.tests.push(
    { id: 'UDS-0001', patientId: byName('Jad Saliba').id, date: day(-6), type: 'Urine drug screen', result: 'Negative', substances: [], note: '', by: 'fadia' },
    { id: 'UDS-0002', patientId: byName('Marc Aoun').id, date: day(-3), type: 'Urine drug screen', result: 'Positive', substances: ['Cannabis'], note: 'After weekend leave.', by: 'fadia' },
    { id: 'UDS-0003', patientId: byName('Karim Haddad').id, date: day(-1), type: 'Urine drug screen', result: 'Negative', substances: [], note: '', by: 'fadia' }
  );

  // Visits, leave and incidents.
  state.visits.push(
    { id: 'VIS-0001', patientId: byName('Karim Haddad').id, visitor: 'Rima H.', relation: 'Sister', date: day(-1), start: '16:00', end: '17:00', note: 'Brought clothes.', loggedBy: 'omar' },
    { id: 'VIS-0002', patientId: byName('Lara Khalil').id, visitor: 'Nadine K.', relation: 'Mother', date: day(-2), start: '15:30', end: '16:30', note: '', loggedBy: 'melyssa' }
  );
  state.leaves.push(
    { id: 'LV-0001', patientId: byName('Marc Aoun').id, out: at(-4, '10:00'), dueBack: at(-4, '18:00'), returnedAt: at(-4, '19:20'), escort: 'Father', reason: 'Family lunch', by: 'melyssa', returnedBy: 'dania' },
    { id: 'LV-0002', patientId: byName('Karim Haddad').id, out: at(0, '09:30'), dueBack: at(0, '17:00'), escort: 'Sister', reason: 'Job interview', by: 'melyssa' }
  );
  state.incidents.push(
    { id: 'INC-0001', patientId: byName('Elie Mansour').id, date: day(-4), time: '20:15', type: 'Aggression', severity: 'Medium', description: 'Shouted at a peer over the TV remote.', actionTaken: 'Separated; talked down by RSA.', reportedBy: 'omar', status: 'Reviewed', outcome: 'Discussed in individual session.', reviewedBy: 'ahmed' },
    { id: 'INC-0002', patientId: byName('Marc Aoun').id, date: day(-3), time: '19:40', type: 'Substance found', severity: 'High', description: 'Cannabis found in jacket after leave.', actionTaken: 'Confiscated; drug screen done.', reportedBy: 'fadia', status: 'Open' }
  );

  // RSA check-ins and team comments.
  admitted.filter(patient => patient.program !== 'Outpatient').slice(0, 5).forEach((patient, index) => {
    state.checkins.push({ id: `CHK-${String(index + 1).padStart(4, '0')}`, patientId: patient.id, date: day(index < 3 ? 0 : -1), mood: ['Settled', 'Settled', 'Low', 'Needs follow-up', 'Settled'][index], note: ['Joined breakfast and the morning walk.', 'Asked about laundry day.', 'Quiet; missed lunch.', 'Wants help calling his employer.', 'Calm, reading in the garden.'][index], by: patient.assigned.rsa, at: at(index < 3 ? 0 : -1, '09:30') });
  });
  state.comments.push(
    { id: 'CM-0001', patientId: admitted[0].id, text: 'Sister visits on Saturdays; she prefers WhatsApp.', by: 'melyssa', at: at(-2, '11:00') },
    { id: 'CM-0002', patientId: admitted[0].id, text: 'Employer letter needed before discharge.', by: 'ahmed', at: at(-1, '15:20') }
  );

  // Rooms: wing, access and readiness.
  state.rooms.forEach(room => Object.assign(room, { access: room.wing === 'Ground' ? 'Step-free' : 'Standard', status: room.id === '7' ? 'Cleaning' : 'Ready', notes: room.id === '7' ? 'Deep clean after a discharge, ready tomorrow.' : '' }));
}
