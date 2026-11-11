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
import { archiveProgram, assignProgram, createProgram, endAssignment, restoreProgram, updateProgram } from './programs.js';
import { addWalletDeposit, addWalletPurchase } from './wallet.js';
import { approveRequest, cancelRequest, completeRequest, createRequest, declineRequest, uploadInvoice } from './requests.js';
import { addRoom, removeRoom, setRoomStatus, updateRoom } from './rooms.js';
import { logVisit, reportIncident, returnLeave, reviewIncident, runLeaveAlerts, startLeave } from './safety.js';
import { book, cancelAppointment, completeAppointment, recordPrescription, recordPsychiatrist } from './scheduling.js';
import { addCheckin, addComment } from './support.js';
import { SLOTS } from './commandSlots.js';
import { canDo, canSee, canSeeTab, isResident, RESIDENTS } from './people.js';
import { completeTask, reviewPrescription } from './tasks.js';

// A notification is marked read only by the person it was sent to.
function markRead(state, id, staffId) {
  const item = state.notifications.find(entry => entry.id === id);
  if (item && item.to !== staffId) throw new Error('Not your notification.');
  if (item) item.read = true;
}
function markAllRead(state, staffId) { for (const item of state.notifications) if (item.to === staffId) item.read = true; }
// The wallet records who handled the money; that is always the person signed in.
const walletDeposit = (state, payload, staffId) => addWalletDeposit(state, { ...payload, recordedBy: staffId });
const walletPurchase = (state, payload, staffId) => addWalletPurchase(state, { ...payload, recordedBy: staffId });
// Finance issues the month's invoices for everyone not yet invoiced, as one change.
function invoiceMonths(state, patientIds, month, staffId) {
  for (const patientId of patientIds) invoiceMonth(state, patientId, month, staffId);
  return patientIds.length;
}

export const FUNCTIONS = {
  admit, completeStep, rebookPsychologist, undoStep, addContact, removeContact, updateContact, dischargePatient, addDocument, attachScan, signDocument,
  addBankLine, addManualEntry, approveExpense, createExpense, createInvoice, invoiceMonth, matchBank, payExpense, recordPayment, rejectExpense, reversePayment, voidInvoice,
  appendRow, fileForm, reviewRisk, signLater, closeLead, convertLead, reopenLead, replyToLead, addOrder, correctDose, recordDose, recordTest, stopOrder,
  approveOrder, raiseOrder, receiveOrder, rejectOrder, setKitchenCeiling,
  createInquiry, declineInquiry, logCall, markNoShow, moveInquiry, recordFollowUp, reopenInquiry, runFollowUpAlerts, runInquiryAging, scheduleAssessment, sendClarification, startFollowUp, updateInquiry,
  archiveProgram, assignProgram, createProgram, endAssignment, restoreProgram, updateProgram, walletDeposit, walletPurchase, invoiceMonths, approveRequest, cancelRequest, completeRequest, createRequest, declineRequest, uploadInvoice,
  addRoom, removeRoom, setRoomStatus, updateRoom, logVisit, reportIncident, returnLeave, reviewIncident, runLeaveAlerts, startLeave,
  book, cancelAppointment, completeAppointment, recordPrescription, recordPsychiatrist, addCheckin, addComment, completeTask, reviewPrescription,
  markRead, markAllRead
};

// Run by the server's clock, never on request from a browser.
export const SYSTEM = new Set(['runFollowUpAlerts', 'runInquiryAging', 'runLeaveAlerts']);

// Who may run each change. The screens hide what a role cannot do; this enforces it for whatever a browser sends.
// Many rules check further inside (who owns an admission step, who may sign a line); these are the outer gate.
const can = action => staffId => canDo(staffId, action);
const page = id => staffId => canSee(staffId, id);
const tab = id => staffId => canSeeTab(staffId, id);
const staff = staffId => !isResident(staffId);
const anyone = () => true;
const residentPatient = staffId => RESIDENTS.find(person => person.id === staffId)?.patientId;
const INTAKE = ['createInquiry', 'declineInquiry', 'logCall', 'markNoShow', 'moveInquiry', 'recordFollowUp', 'reopenInquiry', 'scheduleAssessment', 'sendClarification', 'startFollowUp', 'updateInquiry'];
const BOOKS = ['addBankLine', 'addManualEntry', 'createExpense', 'createInvoice', 'invoiceMonth', 'invoiceMonths', 'matchBank', 'payExpense', 'recordPayment', 'reversePayment', 'voidInvoice'];
const ACCESS = {
  ...Object.fromEntries(INTAKE.map(name => [name, can('editInquiry')])),
  ...Object.fromEntries(BOOKS.map(name => [name, can('recordFinance')])),
  ...Object.fromEntries(['closeLead', 'convertLead', 'reopenLead', 'replyToLead'].map(name => [name, page('leads')])),
  ...Object.fromEntries(['archiveProgram', 'assignProgram', 'createProgram', 'endAssignment', 'restoreProgram', 'updateProgram'].map(name => [name, can('managePrograms')])),
  ...Object.fromEntries(['addRoom', 'removeRoom', 'setRoomStatus', 'updateRoom'].map(name => [name, can('manageRooms')])),
  ...Object.fromEntries(['addContact', 'removeContact', 'updateContact'].map(name => [name, can('manageContacts')])),
  ...Object.fromEntries(['addDocument', 'attachScan', 'signDocument'].map(name => [name, can('manageDocuments')])),
  ...Object.fromEntries(['addOrder', 'correctDose', 'recordTest', 'stopOrder'].map(name => [name, can('recordMedication')])),
  ...Object.fromEntries(['approveOrder', 'rejectOrder', 'setKitchenCeiling'].map(name => [name, can('approveOrder')])),
  ...Object.fromEntries(['logVisit', 'startLeave', 'returnLeave'].map(name => [name, can('logVisit')])),
  ...Object.fromEntries(['book', 'cancelAppointment', 'completeAppointment'].map(name => [name, can('bookService')])),
  ...Object.fromEntries(['recordPrescription', 'recordPsychiatrist'].map(name => [name, can('recordPsychiatrist')])),
  ...Object.fromEntries(['runFollowUpAlerts', 'runInquiryAging', 'runLeaveAlerts'].map(name => [name, anyone])),
  admit: can('confirmAdmission'), completeStep: page('admissions'), undoStep: page('admissions'), rebookPsychologist: page('admissions'),
  dischargePatient: can('discharge'),
  approveExpense: can('approveExpense'), rejectExpense: can('approveExpense'),
  // Forms check who completes and who signs each line inside; a resident completes only their own check-in.
  fileForm: anyone, appendRow: staff, signLater: staff, reviewRisk: tab('clinical'),
  recordDose: can('giveMedication'),
  raiseOrder: can('raiseOrder'), receiveOrder: page('orders'),
  walletDeposit: can('topUpWallet'), walletPurchase: can('pettyCash'), completeRequest: can('pettyCash'),
  approveRequest: staff, declineRequest: staff, uploadInvoice: can('createRequest'),
  createRequest: (staffId, [fields]) => (isResident(staffId) ? fields?.patientId === residentPatient(staffId) : canDo(staffId, 'createRequest')),
  cancelRequest: (staffId, [id], state) => (isResident(staffId) ? state.requests.find(item => item.id === id)?.patientId === residentPatient(staffId) : canSee(staffId, 'requests')),
  reportIncident: staff, reviewIncident: staff,
  addCheckin: page('requests'), addComment: staffId => staff(staffId) && canSee(staffId, 'patients'),
  // A task is closed by the person it belongs to, or by intake on an inquiry.
  completeTask: (staffId, [id], state) => state.tasks.find(item => item.id === id)?.owner === staffId || canDo(staffId, 'editInquiry'),
  reviewPrescription: can('viewPrescriptions'),
  markRead: anyone, markAllRead: anyone
};

// Which argument is the actor and which the clock, generated from the source (built code renames parameters).
export const COMMANDS = Object.fromEntries(Object.entries(FUNCTIONS).map(([name, fn]) => [name, { fn, slots: SLOTS[name] || [], access: ACCESS[name] }]));

export function applyCommand(state, name, args = [], staffId, now = new Date()) {
  const command = typeof name === 'string' && Object.hasOwn(COMMANDS, name) ? COMMANDS[name] : null;
  if (!command) throw new Error(`Unknown command: ${name}`);
  if (!command.access || !command.access(staffId, args, state)) throw new Error('Your role cannot make this change.');
  const given = [...args];
  const values = command.slots.map(slot => (slot === 'me' ? staffId : slot === 'now' ? now : slot === 'arg+me' ? { ...given.shift(), staffId } : given.shift()));
  return command.fn(state, ...values);
}
