// Every change the screens make, by name. The browser (preview) and the server run the same functions;
// on the server the actor is always the signed-in person and the clock is the server's.
import { admit, completeStep, rebookPsychologist, undoStep } from './admission.js';
import { addContact, removeContact, updateContact } from './contacts.js';
import { dischargePatient } from './discharge.js';
import { addDocument, attachScan, signDocument } from './documents.js';
import { addBankLine, addManualEntry, approveExpense, createExpense, createInvoice, invoiceMonth, matchBank, payExpense, recordPayment, rejectExpense, reversePayment, voidInvoice } from './finance.js';
import { appendRow, fileForm, reviewRisk, signLater } from './forms/engine.js';
import { closeLead, convertLead, reopenLead, replyToLead } from './leads.js';
import { addOrder, correctDose, recordDose, recordTest, stopOrder } from './medication.js';
import { approveOrder, raiseOrder, receiveOrder, rejectOrder, setKitchenCeiling } from './orders.js';
import { createInquiry, declineInquiry, logCall, markNoShow, moveInquiry, recordFollowUp, reopenInquiry, runFollowUpAlerts, runInquiryAging, scheduleAssessment, sendClarification, startFollowUp, updateInquiry } from './pipeline.js';
import { archiveProgram, endAssignment, restoreProgram, updateProgram } from './programs.js';
import { approveRequest, cancelRequest, completeRequest, createRequest, declineRequest, uploadInvoice } from './requests.js';
import { addRoom, removeRoom, setRoomStatus, updateRoom } from './rooms.js';
import { logVisit, reportIncident, returnLeave, reviewIncident, runLeaveAlerts, startLeave } from './safety.js';
import { book, cancelAppointment, completeAppointment, recordPrescription, recordPsychiatrist } from './scheduling.js';
import { addCheckin, addComment } from './support.js';
import { completeTask, reviewPrescription } from './tasks.js';

// A notification is marked read only by the person it was sent to.
function markRead(state, id, staffId) {
  const item = state.notifications.find(entry => entry.id === id);
  if (item && item.to !== staffId) throw new Error('Not your notification.');
  if (item) item.read = true;
}
function markAllRead(state, staffId) { for (const item of state.notifications) if (item.to === staffId) item.read = true; }

const FUNCTIONS = {
  admit, completeStep, rebookPsychologist, undoStep, addContact, removeContact, updateContact, dischargePatient, addDocument, attachScan, signDocument,
  addBankLine, addManualEntry, approveExpense, createExpense, createInvoice, invoiceMonth, matchBank, payExpense, recordPayment, rejectExpense, reversePayment, voidInvoice,
  appendRow, fileForm, reviewRisk, signLater, closeLead, convertLead, reopenLead, replyToLead, addOrder, correctDose, recordDose, recordTest, stopOrder,
  approveOrder, raiseOrder, receiveOrder, rejectOrder, setKitchenCeiling,
  createInquiry, declineInquiry, logCall, markNoShow, moveInquiry, recordFollowUp, reopenInquiry, runFollowUpAlerts, runInquiryAging, scheduleAssessment, sendClarification, startFollowUp, updateInquiry,
  archiveProgram, endAssignment, restoreProgram, updateProgram, approveRequest, cancelRequest, completeRequest, createRequest, declineRequest, uploadInvoice,
  addRoom, removeRoom, setRoomStatus, updateRoom, logVisit, reportIncident, returnLeave, reviewIncident, runLeaveAlerts, startLeave,
  book, cancelAppointment, completeAppointment, recordPrescription, recordPsychiatrist, addCheckin, addComment, completeTask, reviewPrescription,
  markRead, markAllRead
};

// Run by the server's clock, never on request from a browser.
export const SYSTEM = new Set(['runFollowUpAlerts', 'runInquiryAging', 'runLeaveAlerts']);

// The parameters after `state`, split at top-level commas, as written in the function itself.
function parameters(fn) {
  const source = fn.toString();
  const start = source.indexOf('(');
  let depth = 0, end = start;
  for (let i = start; i < source.length; i++) {
    if ('([{'.includes(source[i])) depth++;
    else if (')]}'.includes(source[i]) && --depth === 0) { end = i; break; }
  }
  const names = [];
  let part = '', level = 0;
  for (const char of source.slice(start + 1, end)) {
    if ('([{'.includes(char)) level++;
    if (')]}'.includes(char)) level--;
    if (char === ',' && level === 0) { names.push(part); part = ''; } else part += char;
  }
  if (part.trim()) names.push(part);
  // A destructured options object is kept whole; a plain parameter loses its default value.
  return names.map(name => (name.trim().startsWith('{') ? name.trim() : name.split('=')[0].trim())).slice(1);
}
// A parameter named staffId is the actor; an options object that carries staffId gets the actor written into it.
const slotOf = name => (name === 'staffId' || name === 'by' ? 'me' : name === 'now' ? 'now' : name.startsWith('{') && /\bstaffId\b/.test(name) ? 'arg+me' : 'arg');

export const COMMANDS = Object.fromEntries(Object.entries(FUNCTIONS).map(([name, fn]) => [name, { fn, slots: parameters(fn).map(slotOf) }]));

export function applyCommand(state, name, args = [], staffId, now = new Date()) {
  const command = Object.hasOwn(COMMANDS, name) ? COMMANDS[name] : null;
  if (!command) throw new Error(`Unknown command: ${name}`);
  const given = [...args];
  const values = command.slots.map(slot => (slot === 'me' ? staffId : slot === 'now' ? now : slot === 'arg+me' ? { ...given.shift(), staffId } : given.shift()));
  return command.fn(state, ...values);
}
