// The inquiry pipeline: New Inquiry → Assessment → Agreement. Admission happens separately.
import { nextId } from './ids.js';
import { addDays, daysBetween, hoursBetween, todayISO } from './dates.js';
import { staffName, canDo, hasRole } from './people.js';
import { book } from './scheduling.js';
import { notify } from './notifications.js';
import { log } from './activity.js';
import { openOnboarding, releaseOnboarding } from './admission.js';

export const STAGES = ['New Inquiry', 'Assessment', 'Agreement'];
export const PROGRAMS = ['Inpatient', 'Outpatient', 'Detox', 'Detox + Inpatient'];
export const COMM_PREFS = ['Phone call', 'WhatsApp', 'Email', 'Not comfortable talking on the phone'];
export const SOURCES = ['WhatsApp', 'Instagram', 'Facebook', 'Email', 'Website', 'Phone', 'Referral', 'Walk-in'];
export const DRUGS = ['Alcohol', 'Cannabis', 'Cocaine', 'Opioids', 'Benzodiazepines', 'Amphetamines', 'Ketamine', 'Other'];
// The rooms a family can ask for, and the monthly rate the owner set for each.
export const ROOM_RATES = { 'Standard room': 7500, 'Private room': 12000, Bungalow: 15000 };
export const ROOM_PREFERENCES = Object.keys(ROOM_RATES);
// "Other" means the drug was typed in.
export const drugLabel = inquiry => inquiry?.drugOfChoice === 'Other' ? inquiry.drugOther || 'Other' : inquiry?.drugOfChoice || '';
// Quiet inquiries: after 72 hours in New Inquiry they move to the follow-up log, due a week after the first contact.
export const AUTO_FOLLOW_UP_HOURS = 72;
export const FIRST_FOLLOW_UP_DAYS = 7;
// After the follow-up, an inquiry still without an assessment moves to its own log.
export const INACTIVE = 'Inactive';
export const CALL_OUTCOMES = ['Reached', 'No answer', 'Messaged instead', 'Call back requested'];
export const RELATIONSHIPS = ['Self', 'Parent', 'Spouse or partner', 'Sibling', 'Child', 'Other family', 'Friend', 'Employer', 'Doctor or therapist', 'Other'];
// Not ready for an assessment yet: the inquiry waits here until its follow-up date.
export const FOLLOW_UP = 'Follow-up';
export const FOLLOW_UP_DAYS = 2;
export const REVIEW_AFTER_HOURS = 48;

export const money = value => `$${Number(value || 0).toLocaleString('en-US')}`;
export const toRevenue = value => Math.max(0, Math.round(Number(String(value ?? '').replace(/[^\d.]/g, '')) || 0));
export const noPhone = inquiry => inquiry?.commPreference === 'Not comfortable talking on the phone';
export const isOpen = inquiry => !inquiry.outcome;
const find = (state, id) => {
  const inquiry = state.inquiries.find(item => item.id === id);
  if (!inquiry) throw new Error('This inquiry was not found.');
  return inquiry;
};

export function notifyUrgent(state, inquiry) {
  notify(state, {
    to: ['amer', 'ahmed', inquiry.contactPerson],
    title: `Urgent inquiry: ${inquiry.name}`,
    body: [inquiry.program, drugLabel(inquiry), noPhone(inquiry) ? 'Not comfortable on the phone' : ''].filter(Boolean).join(', '),
    link: `#/pipeline/${inquiry.id}`,
    urgent: true
  });
}

// A referral records who referred them; "Other" drugs and previous detox or rehab say what they were.
function checkDetails(fields) {
  if (fields.source === 'Referral' && !String(fields.referrerName || '').trim()) throw new Error('Type who referred them.');
  if (fields.drugOfChoice === 'Other' && !String(fields.drugOther || '').trim()) throw new Error('Type the drug when you choose Other.');
  if (fields.previousDetox === 'Yes' && !String(fields.detoxDetail || '').trim()) throw new Error('Say where and when the previous detox was.');
  if (fields.previousRehab === 'Yes' && !String(fields.rehabDetail || '').trim()) throw new Error('Say where and when the previous rehab was.');
}
const detailsOf = fields => ({
  drugOther: fields.drugOfChoice === 'Other' ? String(fields.drugOther || '').trim() : '',
  previousRehab: ['Yes', 'No'].includes(fields.previousRehab) ? fields.previousRehab : '',
  detoxDetail: fields.previousDetox === 'Yes' ? String(fields.detoxDetail || '').trim() : '',
  rehabDetail: fields.previousRehab === 'Yes' ? String(fields.rehabDetail || '').trim() : '',
  roomPreference: ROOM_PREFERENCES.includes(fields.roomPreference) ? fields.roomPreference : ''
});

export function createInquiry(state, fields, staffId, now = new Date()) {
  const name = String(fields.name || '').trim();
  if (!name) throw new Error('Add the person’s name.');
  checkDetails(fields);
  const at = now.toISOString();
  const inquiry = {
    id: nextId('INQ', state.inquiries), name, phone: String(fields.phone || '').trim(), email: String(fields.email || '').trim(),
    source: fields.source || 'Phone', program: PROGRAMS.includes(fields.program) ? fields.program : 'Inpatient', contactPerson: fields.contactPerson || staffId,
    drugOfChoice: fields.drugOfChoice || '', yearsOfUse: fields.yearsOfUse === '' || fields.yearsOfUse == null ? '' : Math.max(0, Number(fields.yearsOfUse) || 0),
    previousDetox: ['Yes', 'No'].includes(fields.previousDetox) ? fields.previousDetox : '', commPreference: COMM_PREFS.includes(fields.commPreference) ? fields.commPreference : 'Phone call',
    urgency: fields.urgency === 'Urgent' ? 'Urgent' : 'Normal', potentialRevenue: toRevenue(fields.potentialRevenue) || ROOM_RATES[fields.roomPreference] || 0,
    relationship: RELATIONSHIPS.includes(fields.relationship) ? fields.relationship : 'Self', callerName: String(fields.callerName || '').trim(),
    referrerName: fields.source === 'Referral' ? String(fields.referrerName || '').trim() : '',
    ...detailsOf(fields),
    stage: 'New Inquiry', createdAt: at, stageHistory: [{ stage: 'New Inquiry', at, by: staffId }], calls: [], notes: String(fields.notes || '').trim()
  };
  if (fields.leadId) inquiry.leadId = fields.leadId;
  state.inquiries.push(inquiry);
  const day = todayISO(now);
  for (const [days, title] of [[7, 'Follow-up call 1 of 2'], [30, 'Final follow-up call']]) {
    state.tasks.push({ id: nextId('T', state.tasks), kind: 'inquiry-followup', title, owner: inquiry.contactPerson, due: addDays(day, days), inquiryId: inquiry.id, link: `#/pipeline/${inquiry.id}`, status: 'open', createdBy: staffId });
  }
  if (inquiry.urgency === 'Urgent') notifyUrgent(state, inquiry);
  log(state, staffId, `Created inquiry for ${name} from ${inquiry.source}`, `#/pipeline/${inquiry.id}`);
  return inquiry;
}

const EDITABLE = ['name', 'relationship', 'callerName', 'phone', 'email', 'source', 'referrerName', 'program', 'contactPerson', 'drugOfChoice', 'drugOther', 'yearsOfUse', 'previousDetox', 'detoxDetail', 'previousRehab', 'rehabDetail', 'roomPreference', 'commPreference', 'urgency', 'potentialRevenue', 'notes'];

export function updateInquiry(state, id, patch, staffId) {
  const inquiry = find(state, id);
  const becameUrgent = patch.urgency === 'Urgent' && inquiry.urgency !== 'Urgent';
  // Check the whole change before applying any of it: a refused save leaves the record as it was.
  const next = {};
  for (const key of EDITABLE) if (key in patch) next[key] = key === 'potentialRevenue' ? toRevenue(patch[key]) : typeof patch[key] === 'string' ? patch[key].trim() : patch[key];
  if ('name' in next && !next.name) throw new Error('Add the person’s name.');
  checkDetails({ ...inquiry, ...next });
  Object.assign(inquiry, next);
  if ('contactPerson' in patch) for (const task of state.tasks) if (task.inquiryId === id && task.status === 'open') task.owner = inquiry.contactPerson;
  if (becameUrgent) notifyUrgent(state, inquiry);
  log(state, staffId, `Updated inquiry for ${inquiry.name}`, `#/pipeline/${id}`);
  return inquiry;
}

// The assessment is a real booking: a date, a time, an assessor (Amer, Ahmad, or someone named) and how it happens.
export const ASSESSMENT_MODES = ['In person', 'Phone', 'Video'];
export const ASSESSORS = ['amer', 'ahmed', 'other'];
export const assessorName = appointment => appointment?.assessorName || staffName(appointment?.provider);
export const assessmentFor = (state, inquiryId) => state.appointments
  .filter(item => item.service === 'Assessment' && item.inquiryId === inquiryId && !['Cancelled', 'No-show'].includes(item.status))
  .sort((a, b) => `${b.date}${b.start}`.localeCompare(`${a.date}${a.start}`))[0] || null;

function cancelAssessment(state, inquiryId, staffId, now) {
  for (const item of state.appointments.filter(entry => entry.service === 'Assessment' && entry.inquiryId === inquiryId && entry.status === 'Booked')) {
    Object.assign(item, { status: 'Cancelled', cancelledBy: staffId, cancelledAt: now.toISOString() });
  }
}

export function scheduleAssessment(state, id, { date, start, assessor = 'ahmed', assessorName: typed = '', mode = 'In person' }, staffId, now = new Date()) {
  if (!canDo(staffId, 'editInquiry')) throw new Error('You cannot book assessments.');
  const inquiry = find(state, id);
  if (inquiry.outcome) throw new Error(`This inquiry is closed as ${inquiry.outcome}.`);
  if (!ASSESSORS.includes(assessor)) throw new Error('The assessor is Amer, Ahmad or someone you name.');
  if (assessor === 'other' && !String(typed).trim()) throw new Error('Type the assessor’s name.');
  // Someone from outside the staff list has no calendar here, so their slot never clashes.
  const provider = assessor === 'other' ? 'external' : assessor;
  if (!ASSESSMENT_MODES.includes(mode)) throw new Error('Choose whether it happens in person, by phone or by video.');
  // A rebooking frees the old slot first, so moving it half an hour never clashes with itself; if the new slot fails, the old one stays.
  const replacing = assessmentFor(state, id)?.status === 'Booked' ? assessmentFor(state, id) : null;
  if (replacing) replacing.status = 'Cancelled';
  let appointment;
  try {
    appointment = book(state, { service: 'Assessment', provider, date, start, inquiryId: id, title: `${mode} assessment: ${inquiry.name}` }, staffId);
    if (assessor === 'other') appointment.assessorName = String(typed).trim();
  } catch (error) {
    if (replacing) replacing.status = 'Booked';
    throw error;
  }
  if (replacing) Object.assign(replacing, { cancelledBy: staffId, cancelledAt: now.toISOString() });
  appointment.mode = mode;
  if (inquiry.stage !== 'Assessment') moveInquiry(state, id, 'Assessment', staffId, now);
  if (assessor !== 'other') notify(state, { to: provider, title: `Assessment booked: ${inquiry.name}`, body: `${mode}, ${date} at ${start}`, link: `#/pipeline/${id}` });
  return appointment;
}

// They didn't come: the booking is kept as a no-show, they stay in Assessment, and rebooking becomes a task.
export function markNoShow(state, id, staffId, now = new Date()) {
  if (!canDo(staffId, 'editInquiry')) throw new Error('You cannot change assessments.');
  const inquiry = find(state, id);
  const booked = assessmentFor(state, id);
  if (booked?.status !== 'Booked') throw new Error('There is no booked assessment to mark.');
  Object.assign(booked, { status: 'No-show', markedBy: staffId, markedAt: now.toISOString() });
  inquiry.noShows = (inquiry.noShows || 0) + 1;
  log(state, staffId, `${inquiry.name} did not come to the assessment`, `#/pipeline/${id}`);
  return booked;
}

export function moveInquiry(state, id, stage, staffId, now = new Date()) {
  const inquiry = find(state, id);
  if (!STAGES.includes(stage)) throw new Error('Choose New Inquiry, Assessment or Agreement.');
  if (inquiry.outcome) throw new Error(`This inquiry is closed as ${inquiry.outcome}.`);
  if (inquiry.stage === stage) return inquiry;
  if (inquiry.stage === 'Agreement') releaseOnboarding(state, id, now);
  if (inquiry.stage === FOLLOW_UP) delete inquiry.followUp;
  if (stage === 'New Inquiry') cancelAssessment(state, id, staffId, now);
  inquiry.stage = stage;
  inquiry.stageHistory.push({ stage, at: now.toISOString(), by: staffId });
  if (stage === 'Agreement') openOnboarding(state, id, staffId, now);
  log(state, staffId, `Moved ${inquiry.name} to ${stage}`, `#/pipeline/${id}`);
  return inquiry;
}

export function startFollowUp(state, id, { days = FOLLOW_UP_DAYS, note = '' } = {}, staffId, now = new Date()) {
  const inquiry = find(state, id);
  if (inquiry.outcome) throw new Error(`This inquiry is closed as ${inquiry.outcome}.`);
  const wait = Number(days);
  if (!Number.isInteger(wait) || wait < 1) throw new Error('Follow up in at least one day.');
  if (inquiry.stage === 'Agreement') releaseOnboarding(state, id, now);
  cancelAssessment(state, id, staffId, now);
  const due = addDays(todayISO(now), wait);
  inquiry.followUp = { since: now.toISOString(), from: inquiry.stage === FOLLOW_UP ? inquiry.followUp?.from : inquiry.stage, due, note: String(note).trim(), round: 1, notified: false };
  if (inquiry.stage !== FOLLOW_UP) inquiry.stageHistory.push({ stage: FOLLOW_UP, at: now.toISOString(), by: staffId });
  inquiry.stage = FOLLOW_UP;
  log(state, staffId, `${inquiry.name} moved to follow-up until ${due}`, `#/followups/${id}`);
  return inquiry;
}

// The follow-up is made: the call is logged, and with no assessment booked the inquiry moves to its own log.
export function recordFollowUp(state, id, { outcome = 'No answer', note = '' } = {}, staffId, now = new Date()) {
  const inquiry = find(state, id);
  if (inquiry.stage !== FOLLOW_UP) throw new Error('This inquiry is not waiting for a follow-up.');
  logCall(state, id, { outcome, notes: note }, staffId, now);
  if (assessmentFor(state, id)) return inquiry;
  delete inquiry.followUp;
  inquiry.stage = INACTIVE;
  inquiry.stageHistory.push({ stage: INACTIVE, at: now.toISOString(), by: staffId });
  log(state, staffId, `${inquiry.name} moved to the inactive log after the follow-up`, `#/followups/${id}`);
  return inquiry;
}

// An inquiry left in New Inquiry for 72 hours goes to the follow-up log, due a week after the first contact.
export function runInquiryAging(state, now = new Date()) {
  for (const inquiry of state.inquiries.filter(item => !item.outcome && item.stage === 'New Inquiry' && timeInStageHours(item, now) >= AUTO_FOLLOW_UP_HOURS)) {
    const due = addDays(todayISO(new Date(inquiry.createdAt)), FIRST_FOLLOW_UP_DAYS);
    startFollowUp(state, inquiry.id, { days: Math.max(1, daysBetween(todayISO(now), due)), note: 'Moved automatically after 72 hours in New Inquiry.' }, 'system', now);
  }
}
export const inquiriesToAge = (state, now = new Date()) => state.inquiries.some(item => !item.outcome && item.stage === 'New Inquiry' && timeInStageHours(item, now) >= AUTO_FOLLOW_UP_HOURS);

// Remind the contact person once per round when a follow-up comes due.
export function runFollowUpAlerts(state, now = new Date()) {
  const today = todayISO(now);
  let sent = 0;
  for (const inquiry of state.inquiries) {
    if (inquiry.stage !== FOLLOW_UP || inquiry.outcome || inquiry.followUp?.notified || inquiry.followUp?.due > today) continue;
    notify(state, { to: inquiry.contactPerson, title: `Follow up with ${inquiry.name}`, body: inquiry.followUp.note || `Follow-up ${inquiry.followUp.round} is due today.`, link: `#/followups/${inquiry.id}` });
    inquiry.followUp.notified = true;
    sent++;
  }
  return sent;
}

export const followUpPotential = state => state.inquiries.filter(item => item.stage === FOLLOW_UP && !item.outcome).reduce((sum, item) => sum + toRevenue(item.potentialRevenue), 0);

const cancelFollowups = (state, id) => { for (const task of state.tasks) if (task.inquiryId === id && task.kind === 'inquiry-followup' && task.status === 'open') task.status = 'cancelled'; };

export function declineInquiry(state, id, reason, staffId, now = new Date()) {
  const inquiry = find(state, id);
  if (!String(reason || '').trim()) throw new Error('Add a short reason for declining.');
  Object.assign(inquiry, { outcome: 'Declined', declineReason: reason.trim(), closedAt: now.toISOString() });
  cancelAssessment(state, id, staffId, now);
  cancelFollowups(state, id);
  releaseOnboarding(state, id, now);
  log(state, staffId, `Closed ${inquiry.name} as declined`, `#/pipeline/${id}`);
  return inquiry;
}

export function reopenInquiry(state, id, staffId) {
  const inquiry = find(state, id);
  if (inquiry.outcome !== 'Declined') throw new Error('Only declined inquiries can be reopened.');
  delete inquiry.outcome; delete inquiry.declineReason; delete inquiry.closedAt;
  log(state, staffId, `Reopened ${inquiry.name}`, `#/pipeline/${id}`);
  return inquiry;
}

export function logCall(state, id, { outcome, notes = '' }, staffId, now = new Date()) {
  const inquiry = find(state, id);
  if (!CALL_OUTCOMES.includes(outcome)) throw new Error('Choose how the call went.');
  const call = { id: `C-${id}-${inquiry.calls.length + 1}`, at: now.toISOString(), by: staffId, outcome, notes: String(notes).trim() };
  inquiry.calls.push(call);
  // The earliest follow-up call that was due is now made.
  const due = state.tasks.filter(task => task.inquiryId === id && task.kind === 'inquiry-followup' && task.status === 'open' && task.due <= todayISO(now)).sort((a, b) => a.due.localeCompare(b.due))[0];
  if (due) Object.assign(due, { status: 'done', doneBy: staffId, doneAt: now.toISOString(), note: `${outcome}${call.notes ? `: ${call.notes}` : ''}` });
  log(state, staffId, `Call with ${inquiry.name}: ${outcome}`, `#/pipeline/${id}`);
  return call;
}

export const timeInStageHours = (inquiry, now = new Date()) => hoursBetween(inquiry.stageHistory.at(-1)?.at || inquiry.createdAt, now);
export const reviewDue = (inquiry, now = new Date()) => isOpen(inquiry) && inquiry.stage === 'New Inquiry' && timeInStageHours(inquiry, now) >= REVIEW_AFTER_HOURS;

// The channel a clarification reply goes out on follows the person's stated preference.
export function clarificationChannel(inquiry) {
  if (noPhone(inquiry) || inquiry.commPreference === 'WhatsApp') return 'WhatsApp';
  if (inquiry.commPreference === 'Email') return 'Email';
  return ['WhatsApp', 'Instagram', 'Facebook', 'Email'].includes(inquiry.source) ? inquiry.source : 'WhatsApp';
}

export const CLARIFICATION_REPLY = 'Thank you for contacting Cedar Rehab. Everything you share stays confidential. Whenever you are ready, we can book a free assessment at a time that suits you — just reply here.';

export function sendClarification(state, id, staffId, now = new Date()) {
  const inquiry = find(state, id);
  const channel = clarificationChannel(inquiry);
  inquiry.clarifications = [...(inquiry.clarifications || []), { at: now.toISOString(), by: staffId, channel }];
  const lead = inquiry.leadId && state.leads.find(item => item.id === inquiry.leadId);
  if (lead) lead.messages.push({ from: 'staff', by: staffId, at: now.toISOString(), text: CLARIFICATION_REPLY, delivery: `Queued on ${channel}` });
  log(state, staffId, `Clarification reply queued on ${channel} for ${inquiry.name}`, `#/pipeline/${id}`);
  return channel;
}

export function potentialTotals(state) {
  const open = state.inquiries.filter(isOpen);
  const sum = stage => open.filter(item => item.stage === stage).reduce((total, item) => total + toRevenue(item.potentialRevenue), 0);
  const inquiry = sum('New Inquiry'), assessment = sum('Assessment');
  return { inquiry, assessment, combined: inquiry + assessment, agreement: sum('Agreement') };
}

export const contactName = inquiry => staffName(inquiry.contactPerson);
