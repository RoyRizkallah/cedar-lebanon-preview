// Fictional sample records. Every person, phone number and message here is invented.
import { todayISO, addDays, weekday, localDay } from './dates.js';
import { seedForms } from './seedForms.js';
import { nextRsa } from './people.js';
import { seedCare } from './seedCare.js';
import { seedPrograms } from './seedPrograms.js';
import { book, earliestSlot } from './scheduling.js';

// Raised whenever the sample data changes shape, so saved previews reload fresh.
export const SEED_VERSION = 6;

const ROOMS = ['101', '102', '103', '104', '105', '106'].map(id => ({ id, name: `Room ${id}`, beds: 2 }));

const PEOPLE = [
  // admitted
  { name: 'Karim Haddad', age: 34, program: 'Inpatient', room: '101', bed: 1, days: 41, drug: 'Alcohol', years: 9, monthly: 6000, phase: '3 Consolidation' },
  { name: 'Jad Saliba', age: 27, program: 'Detox + Inpatient', room: '101', bed: 2, days: 19, drug: 'Opioids', years: 4, monthly: 8500, phase: '2 Core treatment' },
  { name: 'Elie Mansour', age: 45, program: 'Inpatient', room: '102', bed: 1, days: 33, drug: 'Cocaine', years: 12, monthly: 6000, phase: '2 Core treatment' },
  { name: 'Tony Farah', age: 31, program: 'Detox', room: '102', bed: 2, days: 4, drug: 'Benzodiazepines', years: 3, monthly: 3500, phase: '1 Stabilization' },
  { name: 'Marc Aoun', age: 23, program: 'Inpatient', room: '103', bed: 1, days: 12, drug: 'Cannabis', years: 6, monthly: 6000, phase: '1 Stabilization' },
  { name: 'Hadi Nasr', age: 39, program: 'Detox + Inpatient', room: '104', bed: 1, days: 58, drug: 'Alcohol', years: 15, monthly: 8500, phase: '4 Discharge prep' },
  { name: 'Lara Khalil', age: 29, program: 'Inpatient', room: '105', bed: 1, days: 26, drug: 'Amphetamines', years: 5, monthly: 6000, phase: '2 Core treatment' },
  { name: 'Ziad Fakhoury', age: 52, program: 'Inpatient', room: '106', bed: 1, days: 2, drug: 'Alcohol', years: 20, monthly: 6000, phase: '1 Stabilization' },
  { name: 'Sami Daher', age: 36, program: 'Outpatient', days: 47, drug: 'Cannabis', years: 8, monthly: 1200, phase: '3 Consolidation' },
  { name: 'Nadim Rizk', age: 25, program: 'Outpatient', days: 15, drug: 'Cocaine', years: 2, monthly: 1200, phase: '2 Core treatment' },
  // discharged
  { name: 'Fouad Hayek', age: 41, program: 'Inpatient', days: 95, stay: 62, drug: 'Alcohol', years: 11, monthly: 6000, discharged: true, outcome: 'Well' },
  { name: 'Walid Sfeir', age: 33, program: 'Detox + Inpatient', days: 70, stay: 45, drug: 'Opioids', years: 7, monthly: 8500, discharged: true, outcome: 'Struggling' },
  { name: 'Maya Tannous', age: 28, program: 'Inpatient', days: 40, stay: 31, drug: 'Alcohol', years: 6, monthly: 6000, discharged: true, outcome: 'Well' }
];

const PREFS = ['Phone call', 'WhatsApp', 'Email', 'Not comfortable talking on the phone'];
const SOURCES = ['WhatsApp', 'Instagram', 'Phone', 'Website', 'Facebook', 'Email'];

export const clinicalNameOf = fullName => {
  const [first, ...rest] = String(fullName).trim().split(/\s+/);
  const last = rest.at(-1);
  return last ? `${first} ${last[0].toUpperCase()}.` : first;
};

const phoneFor = index => `+961 ${[3, 70, 71, 76, 78, 81][index % 6]} ${String(100 + index * 37).slice(-3)} ${String(400 + index * 53).slice(-3)}`;

// Two people around each sample patient: the emergency contact who may hear about treatment, and a visitor.
const FIRST = ['Mona', 'Rima', 'Georges', 'Samir', 'Nadine', 'Hala', 'Tony', 'Maya', 'Joseph', 'Layla', 'Fadi', 'Carla'];
const KIN = [['Parent', 'Sibling'], ['Spouse or partner', 'Parent'], ['Sibling', 'Parent'], ['Parent', 'Other family']];
function familyFor(name, index) {
  const surname = name.split(' ').slice(1).join(' ') || name;
  const [first, second] = KIN[index % KIN.length];
  const phone = n => `+961 3 ${String(210000 + index * 97 + n * 13).slice(0, 3)} ${String(400 + index * 7 + n).padStart(3, '0')}`;
  return [
    { id: `CT-${String(index * 2 + 1).padStart(4, '0')}`, name: `${FIRST[(index * 2) % FIRST.length]} ${surname}`, relation: first, phone: phone(1), emergency: true, canDiscuss: true, canVisit: true },
    { id: `CT-${String(index * 2 + 2).padStart(4, '0')}`, name: `${FIRST[(index * 2 + 1) % FIRST.length]} ${surname}`, relation: second, phone: phone(2), emergency: false, canDiscuss: false, canVisit: true }
  ];
}

export function seed(now = new Date()) {
  const today = todayISO(now);
  const day = n => addDays(today, n);
  const ago = hours => new Date(now.getTime() - hours * 3600000).toISOString();
  const moment = (n, time = '10:00') => new Date(`${day(n)}T${time}:00`).toISOString();

  const state = {
    version: SEED_VERSION, leads: [], inquiries: [], onboardings: [], patients: [], rooms: ROOMS.map(room => ({ ...room })),
    appointments: [], forms: [], documents: [], wallet: { transactions: [] }, requests: [], tasks: [], notifications: [], activity: [],
    finance: { invoices: [], expenses: [], manualEntries: [], bankEntries: [] }, medication: { orders: [], doses: [], tests: [] }, visits: [], leaves: [], incidents: [], checkins: [], comments: [], programs: [], programAssignments: []
  };
  let taskSeq = 0, docSeq = 0, apptSeq = 0, walletSeq = 0;
  const task = fields => state.tasks.push({ id: `T-${String(++taskSeq).padStart(4, '0')}`, status: 'open', ...fields });
  const doc = fields => { const item = { id: `D-${String(++docSeq).padStart(4, '0')}`, ...fields }; state.documents.push(item); return item; };
  const wallet = fields => state.wallet.transactions.push({ id: `W-${String(++walletSeq).padStart(4, '0')}`, ...fields });

  // Admitted and discharged patients, each with the inquiry they came from.
  PEOPLE.forEach((person, index) => {
    const inquiryId = `INQ-${String(index + 1).padStart(4, '0')}`;
    const patientId = `P-${String(index + 1).padStart(4, '0')}`;
    const admittedAt = day(-person.days);
    const createdAt = moment(-person.days - 9, '11:20');
    const source = SOURCES[index % SOURCES.length];
    const commPreference = PREFS[index % PREFS.length];
    state.inquiries.push({
      id: inquiryId, name: person.name, phone: phoneFor(index), email: '', source, program: person.program, contactPerson: 'melyssa',
      drugOfChoice: person.drug, yearsOfUse: person.years, previousDetox: index % 3 ? 'No' : 'Yes', commPreference, urgency: 'Normal',
      potentialRevenue: person.monthly, stage: 'Agreement', outcome: 'Admitted', createdAt,
      stageHistory: [
        { stage: 'New Inquiry', at: createdAt, by: 'melyssa' },
        { stage: 'Assessment', at: moment(-person.days - 7, '12:00'), by: 'melyssa' },
        { stage: 'Agreement', at: moment(-person.days - 3, '15:00'), by: 'melyssa' }
      ],
      calls: [{ id: `C-${inquiryId}-1`, at: moment(-person.days - 9, '12:05'), by: 'melyssa', outcome: 'Reached', notes: 'First conversation; assessment offered.' }],
      notes: '', closedAt: moment(-person.days, '09:00')
    });
    const patient = {
      id: patientId, inquiryId, fullName: person.name, clinicalName: clinicalNameOf(person.name), age: person.age, program: person.program,
      roomId: person.room || '', bed: person.bed || null, admittedAt, phase: person.phase || '4 Discharge prep',
      assigned: { psychologist: 'nabila', therapist: 'clinical-director', nurse: 'fadia', fitness: 'john', rsa: person.program === 'Outpatient' ? '' : nextRsa(state) },
      commPreference, phone: phoneFor(index), status: person.discharged ? 'Discharged' : 'Admitted', monthlyAmount: person.monthly,
      contacts: familyFor(person.name, index)
    };
    if (person.discharged) {
      patient.admittedAt = day(-person.days);
      patient.dischargedAt = day(-person.days + person.stay);
      patient.roomId = ''; patient.bed = null;
    }
    state.patients.push(patient);
    doc({ patientId, type: 'Admission agreement', title: 'Admission agreement', status: 'Signed electronically', createdAt: moment(-person.days - 1, '16:00'), createdBy: 'melyssa', signedBy: person.name, signedAt: moment(-person.days - 1, '16:30') });
    wallet({ patientId, type: 'opened', amountCents: 0, description: 'Wallet created at admission', date: patient.admittedAt, recordedBy: 'System' });
    if (!person.discharged && person.program !== 'Outpatient') {
      wallet({ patientId, type: 'credit', amountCents: 20000 + index * 2500, description: 'Family deposit', date: day(-Math.min(person.days, 10)), recordedBy: 'melyssa' });
      if (index % 2 === 0) wallet({ patientId, type: 'purchase', amountCents: 1800 + index * 150, description: 'Toiletries', date: day(-1), recordedBy: 'georgio' });
    }
  });

  // Current pipeline.
  const open = [
    { name: 'Georges Abi Nader', source: 'WhatsApp', program: 'Inpatient', drug: 'Alcohol', years: 7, detox: 'No', pref: 'WhatsApp', urgency: 'Normal', revenue: 0, stage: 'New Inquiry', hours: 3 },
    { name: 'Rita Saad', source: 'Instagram', program: 'Outpatient', drug: 'Cannabis', years: 3, detox: 'No', pref: 'Not comfortable talking on the phone', urgency: 'Normal', revenue: 1200, stage: 'New Inquiry', hours: 60 },
    { name: 'Omar Itani', source: 'Phone', program: 'Detox + Inpatient', drug: 'Opioids', years: 6, detox: 'Yes', pref: 'Phone call', urgency: 'Urgent', revenue: 8500, stage: 'New Inquiry', hours: 5 },
    { name: 'Chadi Merhi', source: 'Website', program: 'Inpatient', drug: 'Cocaine', years: 5, detox: 'No', pref: 'Email', urgency: 'Normal', revenue: 6000, stage: 'Assessment', hours: 80 },
    { name: 'Joelle Karam', source: 'Facebook', program: 'Detox', drug: 'Benzodiazepines', years: 2, detox: 'No', pref: 'Phone call', urgency: 'Normal', revenue: 3500, stage: 'Assessment', hours: 110 },
    { name: 'Bassel Hamdan', source: 'WhatsApp', program: 'Inpatient', drug: 'Alcohol', years: 14, detox: 'Yes', pref: 'WhatsApp', urgency: 'Normal', revenue: 6000, stage: 'Assessment', hours: 150 },
    { name: 'Fadi Chamoun', source: 'Email', program: 'Detox + Inpatient', drug: 'Alcohol', years: 10, detox: 'Yes', pref: 'Phone call', urgency: 'Normal', revenue: 8500, stage: 'Agreement', hours: 200 },
    { name: 'Hiba Moussa', source: 'Instagram', program: 'Inpatient', drug: 'Amphetamines', years: 4, detox: 'No', pref: 'Not comfortable talking on the phone', urgency: 'Normal', revenue: 6000, stage: 'Agreement', hours: 260 },
    { name: 'Ralph Haddad', source: 'Phone', program: 'Outpatient', drug: 'Cannabis', years: 2, detox: 'No', pref: 'Phone call', urgency: 'Normal', revenue: 0, stage: 'Assessment', hours: 400, declined: 'Chose a program closer to home.' }
  ];
  open.push(
    { name: 'Maya Sleiman', source: 'Facebook', program: 'Inpatient', drug: 'Alcohol', years: 5, detox: 'No', pref: 'WhatsApp', urgency: 'Normal', revenue: 6000, stage: 'New Inquiry', hours: 96, rel: 'Parent', caller: 'Rima Sleiman', follow: { days: 0, note: 'Mother wants to talk to the family first.' } },
    { name: 'Karl Nassif', source: 'Website', program: 'Outpatient', drug: 'Cocaine', years: 3, detox: 'No', pref: 'Email', urgency: 'Normal', revenue: 1200, stage: 'New Inquiry', hours: 70, rel: 'Self', follow: { days: 3, note: 'Waiting for his insurance answer.' } }
  );
  const RELS = ['Self', 'Parent', 'Self', 'Sibling', 'Spouse or partner', 'Self', 'Parent', 'Self', 'Employer'];
  open.forEach((item, offset) => {
    const index = PEOPLE.length + offset;
    const id = `INQ-${String(index + 1).padStart(4, '0')}`;
    const createdAt = ago(item.hours);
    const history = [{ stage: 'New Inquiry', at: createdAt, by: 'melyssa' }];
    if (item.stage !== 'New Inquiry') history.push({ stage: 'Assessment', at: ago(item.hours - 40), by: 'melyssa' });
    if (item.stage === 'Agreement') history.push({ stage: 'Agreement', at: ago(item.hours - 120), by: 'ahmed' });
    const inquiry = {
      id, name: item.name, relationship: item.rel || RELS[offset % RELS.length], callerName: item.caller || (item.rel || RELS[offset % RELS.length]) !== 'Self' ? (item.caller || `${['Rima', 'Nadim', 'Hala', 'Joe'][offset % 4]} ${item.name.split(' ').at(-1)}`) : '', phone: phoneFor(index), email: item.pref === 'Email' ? `${item.name.split(' ')[0].toLowerCase()}@example.com` : '',
      source: item.source, program: item.program, contactPerson: 'melyssa', drugOfChoice: item.drug, yearsOfUse: item.years, previousDetox: item.detox,
      commPreference: item.pref, urgency: item.urgency, potentialRevenue: item.revenue, stage: item.stage, createdAt, stageHistory: history,
      calls: item.hours > 20 ? [{ id: `C-${id}-1`, at: ago(item.hours - 2), by: 'melyssa', outcome: item.pref.startsWith('Not comfortable') ? 'Messaged instead' : 'Reached', notes: 'Explained the program and next step.' }] : [],
      notes: ''
    };
    if (item.declined) Object.assign(inquiry, { outcome: 'Declined', declineReason: item.declined, closedAt: ago(item.hours - 100) });
    if (item.follow) {
      inquiry.stage = 'Follow-up';
      inquiry.stageHistory.push({ stage: 'Follow-up', at: ago(item.hours - 30), by: 'melyssa' });
      inquiry.followUp = { since: ago(item.hours - 30), from: 'New Inquiry', due: day(item.follow.days), note: item.follow.note, round: 1, notified: false };
    }
    state.inquiries.push(inquiry);
    const createdDay = localDay(createdAt);
    const followStatus = item.declined ? 'cancelled' : 'open';
    task({ kind: 'inquiry-followup', title: 'Follow-up call 1 of 2', owner: 'melyssa', due: addDays(createdDay, 7), inquiryId: id, link: `#/pipeline/${id}`, status: followStatus });
    task({ kind: 'inquiry-followup', title: 'Final follow-up call', owner: 'melyssa', due: addDays(createdDay, 30), inquiryId: id, link: `#/pipeline/${id}`, status: followStatus });
    if (item.urgency === 'Urgent') {
      for (const to of ['ahmed', 'clinical-director', 'melyssa']) {
        state.notifications.push({ id: `N-${state.notifications.length + 1}`, to, title: `Urgent inquiry: ${item.name}`, body: `${item.program} · ${item.drug}`, link: `#/pipeline/${id}`, urgent: true, channels: ['In-app', 'Email (queued)', 'WhatsApp (queued)'], at: ago(item.hours), read: false });
      }
    }
  });

  // Appointments: a working week either side of today, never overlapping per provider.
  const toMin = time => Number(time.slice(0, 2)) * 60 + Number(time.slice(3));
  const people = item => item.patientIds || (item.patientId ? [item.patientId] : []);
  const clashes = fields => state.appointments.some(item => item.date === fields.date && toMin(item.start) < toMin(fields.start) + fields.minutes && toMin(fields.start) < toMin(item.start) + item.minutes &&
    ((item.provider === fields.provider && item.provider !== 'external') || people(item).some(id => people(fields).includes(id))));
  // Sample bookings follow the same rule as real ones: nobody is in two places at once.
  const appt = fields => { if (clashes(fields)) return null; const item = { id: `A-${String(++apptSeq).padStart(4, '0')}`, status: 'Booked', ...fields }; state.appointments.push(item); return item; };
  const admitted = state.patients.filter(patient => patient.status === 'Admitted');
  for (let n = -6; n <= 6; n++) {
    const date = day(n);
    if (weekday(date) === 0) continue;
    const past = n < 0;
    admitted.forEach((patient, index) => {
      if ((index + n + 20) % 3 !== 0) return;
      const slot = (index % 5);
      appt({ service: 'Psychologist session', provider: 'nabila', patientId: patient.id, date, start: ['09:00', '10:00', '11:00', '13:00', '14:00'][slot], minutes: 50, status: past ? 'Completed' : 'Booked', completedAt: past ? new Date(`${date}T${['09:50', '10:50', '11:50', '13:50', '14:50'][slot]}:00`).toISOString() : undefined });
    });
    admitted.forEach((patient, index) => {
      if ((index + n + 21) % 4 !== 0) return;
      appt({ service: 'Therapist session', provider: 'clinical-director', patientId: patient.id, date, start: ['09:30', '11:00', '14:00'][index % 3], minutes: 50, status: past ? 'Completed' : 'Booked', completedAt: past ? new Date(`${date}T12:00:00`).toISOString() : undefined });
    });
    const inpatients = admitted.filter(patient => patient.program !== 'Outpatient');
    appt({ service: 'Group', provider: 'clinical-director', patientIds: inpatients.map(patient => patient.id), date, start: '16:00', minutes: 60, status: past ? 'Completed' : 'Booked', title: ['Therapy group', 'Psychoeducation', 'Drama therapy'][(n + 6) % 3] });
    appt({ service: 'Fitness session', provider: 'john', patientIds: inpatients.slice(0, 5).map(patient => patient.id), date, start: '15:00', minutes: 60, status: past ? 'Completed' : 'Booked', title: 'Gym' });
    if (n % 2 === 0) appt({ service: 'Physiotherapy', provider: 'john', patientId: inpatients[(n + 6) % inpatients.length].id, date, start: '10:00', minutes: 45, status: past ? 'Completed' : 'Booked' });
    if (n % 3 === 0) appt({ service: 'Nursing appointment', provider: 'fadia', patientId: admitted[(n + 9) % admitted.length].id, date, start: '09:00', minutes: 30, status: past ? 'Completed' : 'Booked' });
    if (n === 1 || n === -2) appt({ service: 'Blood test', provider: 'fadia', patientId: admitted[3].id, date, start: '12:00', minutes: 15, status: past ? 'Completed' : 'Booked' });
  }
  appt({ service: 'External psychiatrist', provider: 'external', patientId: admitted[1].id, date: day(2), start: '12:00', minutes: 30, external: { psychiatrist: 'External psychiatrist' }, recordedBy: 'fadia' });
  const reviewed = appt({ service: 'External psychiatrist', provider: 'external', patientId: admitted[2].id, date: day(-3), start: '12:00', minutes: 30, status: 'Completed', completedAt: moment(-3, '12:30'), external: { psychiatrist: 'External psychiatrist' }, recordedBy: 'fadia' });
  doc({ patientId: admitted[2].id, type: 'Prescription', title: 'Prescription — external psychiatrist', status: 'Received', appointmentId: reviewed.id, createdAt: moment(-2, '09:15'), createdBy: 'fadia' });
  state.notifications.push({ id: `N-${state.notifications.length + 1}`, to: 'fadia', title: `Prescription received for ${admitted[2].clinicalName}`, body: 'External psychiatrist', link: `#/patients/${admitted[2].id}/medical`, urgent: false, channels: ['In-app'], at: moment(-2, '09:15'), read: false });

  // Admissions in progress for the two inquiries in Agreement.
  const agreements = state.inquiries.filter(item => item.stage === 'Agreement' && !item.outcome);
  agreements.forEach((inquiry, index) => {
    const psych = appt({ service: 'Psychologist session', provider: 'nabila', inquiryId: inquiry.id, date: day(index ? -1 : 1), start: '15:00', minutes: 50, status: index ? 'Completed' : 'Booked', completedAt: index ? moment(-1, '15:50') : undefined, auto: true });
    const by = (who, n) => ({ done: true, by: who, at: moment(n, '11:00') });
    const notDone = { done: false };
    state.onboardings.push({
      id: `ON-${String(index + 1).padStart(4, '0')}`, inquiryId: inquiry.id, openedAt: inquiry.stageHistory.at(-1).at, psychologistAppointmentId: psych.id,
      steps: index
        ? { nursing: by('fadia', -2), psychologist: by('nabila', -1), financial: { ...by('ahmed', -1), monthlyAmount: inquiry.potentialRevenue, terms: 'Monthly in advance' }, agreement: { ...by('melyssa', -1) }, room: notDone }
        : { nursing: by('fadia', -1), psychologist: notDone, financial: notDone, agreement: notDone, room: notDone }
    });
    if (index) state.onboardings.at(-1).steps.agreement.documentId = doc({ inquiryId: inquiry.id, type: 'Admission agreement', title: 'Admission agreement', status: 'Signed scan uploaded', createdAt: moment(-1, '10:00'), createdBy: 'melyssa', signedBy: inquiry.name, signedAt: moment(-1, '10:00') }).id;
  });

  // Leads from every channel; the converted ones point at the open inquiries above.
  const leadRows = [
    ['WhatsApp', 'Georges Abi Nader', '+961 70 214 552', 3.2, 'Converted', 'Hi, my brother needs help with drinking. Do you have a residential program?', 14],
    ['Instagram', 'Rita Saad', '@rita.saad', 61, 'Converted', 'Hello, I saw your page. Is outpatient therapy confidential?', 15],
    ['Phone', 'Omar Itani', '+961 3 448 120', 5.1, 'Converted', 'Missed call — called back. Urgent detox request for son.', 16],
    ['WhatsApp', 'Nour Zein', '+961 71 990 431', 0.4, 'New', 'Good evening, how much is one month in the center?'],
    ['Instagram', 'leb.recovery.journey', '@leb.recovery.journey', 1.1, 'New', 'Do you accept people from outside Lebanon?'],
    ['Facebook', 'Samer Kassab', 'facebook.com/samer.k', 2.6, 'New', 'I need information for my father, he refuses to go to the hospital.'],
    ['Email', 'Carla Hobeika', 'carla.h@example.com', 7.5, 'New', 'Could you send me the program brochure and fees for detox?'],
    ['Website', 'Tarek', 'Website form', 9, 'New', 'Requested a call back between 6 and 8 pm.'],
    ['WhatsApp', 'Lina', '+961 76 301 228', 20, 'Replied', 'Is there a female wing?'],
    ['Facebook', 'Antoine Rahme', 'facebook.com/a.rahme', 30, 'Replied', 'What are your visiting hours for families?'],
    ['Email', 'HR — Medline SAL', 'hr@medline.example', 52, 'Replied', 'We would like to refer an employee. What is the process?'],
    ['Website', 'Dana Yazbek', 'dana.y@example.com', 75, 'Replied', 'Assessment request for my husband.'],
    ['Instagram', 'promo.followers.boost', '@promo.followers.boost', 90, 'Closed', 'Grow your followers fast!!!'],
    ['WhatsApp', 'Bassel Hamdan', '+961 81 120 774', 152, 'Converted', 'I want to stop drinking. Can I come for an assessment?', 19]
  ];
  leadRows.forEach(([channel, name, handle, hours, status, text, inquiryIndex], index) => {
    const id = `L-${String(index + 1).padStart(4, '0')}`;
    const messages = [{ from: 'lead', at: ago(hours), text }];
    if (status === 'Replied' || status === 'Converted') messages.push({ from: 'staff', by: 'melyssa', at: ago(Math.max(0.1, hours - (index % 3 ? 0.4 : 1.6))), text: 'Thank you for reaching out to Cedar Rehab. We can talk whenever suits you — what is the best time?', delivery: `Queued on ${channel}` });
    const lead = { id, channel, name, handle, receivedAt: ago(hours), status, messages };
    if (status === 'Closed') lead.closeReason = 'Spam';
    if (inquiryIndex) {
      lead.inquiryId = `INQ-${String(inquiryIndex).padStart(4, '0')}`;
      const inquiry = state.inquiries.find(item => item.id === lead.inquiryId);
      if (inquiry) inquiry.leadId = id;
    }
    state.leads.push(lead);
  });

  // RSA requests.
  const residents = admitted.filter(patient => patient.program !== 'Outpatient');
  state.requests.push(
    { id: 'R-0001', patientId: residents[0].id, item: 'Phone charger (USB-C)', quantity: 1, note: '', status: 'Open', createdBy: residents[0].assigned.rsa, createdAt: ago(5) },
    { id: 'R-0002', patientId: residents[2].id, item: 'Running shoes, size 43', quantity: 1, note: 'For gym sessions with John.', status: 'Open', createdBy: residents[2].assigned.rsa, createdAt: ago(26) },
    { id: 'R-0003', patientId: residents[1].id, item: 'Toiletries pack', quantity: 1, note: '', status: 'Done', createdBy: residents[1].assigned.rsa, createdAt: ago(48), amountCents: 2400, completedAt: ago(30), completedBy: 'georgio' }
  );

  seedForms(state, today);
  seedCare(state, today);
  seedPrograms(state, today);
  wallet({ patientId: residents[1].id, type: 'purchase', amountCents: 2400, description: '1 × Toiletries pack', date: day(-1), recordedBy: 'georgio', requestId: 'R-0003' });
  state.activity.push({ id: 'AC-1', at: ago(3), by: 'melyssa', text: 'Created inquiry for Georges Abi Nader from WhatsApp', link: '#/pipeline' });

  // Assessments booked for the people in Assessment, at the assessor's earliest free hour; the last is left for Melyssa to book.
  const assessing = state.inquiries.filter(item => item.stage === 'Assessment' && !item.outcome);
  assessing.slice(0, -1).forEach((inquiry, index) => {
    const provider = index % 2 ? 'nabila' : 'clinical-director';
    const mode = ['In person', 'Video'][index % 2];
    const made = book(state, { service: 'Assessment', provider, ...earliestSlot(state, { provider, minutes: 60, from: today }), inquiryId: inquiry.id, title: `${mode} assessment: ${inquiry.name}`, quiet: true }, 'melyssa');
    made.mode = mode;
  });

  // Everyone's day: the meetings and chores a centre runs on, beyond what the records generate.
  const name = index => residents[index]?.clinicalName || 'a resident';
  [
    ['amer', 0, 'todo', 'Sign the Beirut Pharma supply contract', '#/finance/expenses'],
    ['amer', 2, 'meeting', 'Partners’ meeting with Ahmed: November numbers', '#/dashboard'],
    ['ahmed', 0, 'meeting', 'Weekly case review, 14:00', '#/sessions'],
    ['ahmed', 3, 'todo', 'Approve the December group timetable', '#/programs'],
    ['clinical-director', 0, 'meeting', 'Supervision with Nabila: two case files', '#/patients'],
    ['nabila', 1, 'todo', `Prepare relapse-prevention worksheet for ${name(1)}`, '#/patients'],
    ['nazha', 0, 'todo', 'Prepare props for playback theatre', '#/programs/PRG-0002'],
    ['nazha', 1, 'meeting', 'Share drama observations at case review', '#/programs'],
    ['fadia', 1, 'todo', 'Order next week’s blister packs from the pharmacy', '#/medication'],
    ['melyssa', 1, 'todo', 'Send the November staff rota to every team', '#/schedule'],
    ['rabih', -1, 'todo', 'Close the October books', '#/finance/journal'],
    ['rabih', 5, 'todo', 'Send monthly statements to insurers and employers', '#/finance/payers'],
    ['kteish', 0, 'todo', 'Reconcile petty cash with Georgio', '#/finance/bank'],
    ['mazen', 0, 'todo', 'Approve this week’s kitchen order from Shady', '#/requests'],
    ['mazen', 1, 'todo', 'Sign off the deep clean in room 106', '#/rooms'],
    ['john', 0, 'todo', 'Agree gym clearances for new residents with Fadia', '#/patients'],
    ['zeina', 0, 'todo', 'Plan next week’s movement and yoga sessions', '#/schedule'],
    ['tony-j', 1, 'todo', 'Book the tennis court for Thursday', '#/schedule'],
    ['tony-am', 0, 'todo', 'Update personal training plans', '#/patients'],
    ['raymond', 2, 'todo', 'Check boxing gloves and wraps', '#/schedule'],
    ['omar', 0, 'meeting', 'Evening handover to the night RSA, 20:00', '#/requests'],
    ['omar', 1, 'todo', 'Walk the floor with the new RSA rota', '#/patients'],
    ['georgio', 0, 'todo', 'Count petty cash before Kteish’s check', '#/requests'],
    ['alaa', 0, 'todo', 'Evening check-ins with your residents', '#/requests'],
    ['dania', 0, 'todo', 'Evening check-ins with your residents', '#/requests'],
    ['imad', 0, 'todo', 'Help Fadia with the 20:00 round', '#/medication']
  ].forEach(([owner, offset, kind, title, link]) => task({ kind, title, owner, due: day(offset), link }));

  // What the team did since yesterday, for the Today feed.
  [
    [1, 'fadia', 'Recorded the 08:00 medication round', '#/medication'],
    [2, 'nazha', 'Added "Letters not sent" to Expression & reconnection', '#/programs/PRG-0002'],
    [5, 'mazen', 'Set room 106 to cleaning', '#/rooms'],
    [7, 'clinical-director', `Filed a session note for ${name(0)}`, '#/sessions'],
    [9, 'omar', 'Logged the evening check-in round', '#/requests'],
    [20, 'rabih', 'Approved the Beirut Pharma bill', '#/finance/expenses'],
    [26, 'john', `Cleared ${name(2)} for the gym`, '#/patients'],
    [30, 'georgio', `Bought toiletries for ${name(1)} from petty cash`, '#/requests']
  ].forEach(([hours, by, text, link], index) => state.activity.push({ id: `AC-S${index + 1}`, at: ago(hours), by, text, link }));
  return state;
}
