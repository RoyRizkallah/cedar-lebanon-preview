import { tasksFor } from './tasks.js';
import { roundFor } from './medication.js';
import { invoiceStatus } from './finance.js';
import { todayISO } from './dates.js';
import { canDo } from './people.js';

// Live numbers beside each sidebar entry: only work waiting on this person.
export function navCounts(state, staffId, now = new Date()) {
  const counts = {};
  const work = tasksFor(state, staffId, now);
  const due = work.overdue.length + work.today.length;
  if (due) counts.today = { value: due, hot: work.overdue.length > 0, title: `${work.overdue.length} overdue, ${work.today.length} today` };
  const newLeads = state.leads.filter(lead => lead.status === 'New').length;
  if (newLeads) counts.leads = { value: newLeads, title: `${newLeads} new leads` };
  const urgent = state.inquiries.filter(item => !item.outcome && item.urgency === 'Urgent').length;
  if (urgent) counts.pipeline = { value: urgent, hot: true, title: `${urgent} urgent` };
  const onboarding = state.onboardings.filter(item => { const inquiry = state.inquiries.find(entry => entry.id === item.inquiryId); return !item.admittedPatientId && inquiry?.stage === 'Agreement' && !inquiry.outcome; }).length;
  if (onboarding && canDo(staffId, 'confirmAdmission')) counts.admissions = { value: onboarding, title: `${onboarding} in progress` };
  const requests = state.requests.filter(item => item.status === 'Open').length;
  if (requests && staffId) counts.requests = { value: requests, title: `${requests} open` };
  const today = todayISO(now);
  const dueFollowUps = state.inquiries.filter(item => item.stage === 'Follow-up' && !item.outcome && item.followUp?.due <= today).length;
  if (dueFollowUps && canDo(staffId, 'editInquiry')) counts.followups = { value: dueFollowUps, hot: true, title: `${dueFollowUps} follow-ups due` };
  if (canDo(staffId, 'recordMedication')) {
    const due = roundFor(state, today).filter(item => item.status === 'Due').length;
    if (due) counts.medication = { value: due, title: `${due} doses still to record today` };
  }
  if (canDo(staffId, 'reviewIncident')) {
    const open = state.incidents.filter(item => item.status === 'Open').length;
    if (open) counts.safety = { value: open, hot: true, title: `${open} incidents to review` };
  }
  if (canDo(staffId, 'recordFinance')) {
    const overdue = state.finance.invoices.filter(item => invoiceStatus(item, today) === 'Overdue').length;
    if (overdue) counts.finance = { value: overdue, hot: true, title: `${overdue} overdue invoices` };
  }
  return counts;
}
