import { iso } from './data.js';

const validOwner = value => value && !/^(unassigned|unknown|none|—)$/i.test(String(value).trim());
const dayDifference = (date, asOf) => Math.floor((Date.parse(`${asOf}T12:00:00Z`) - Date.parse(`${date}T12:00:00Z`)) / 86400000);
const recent = (date, asOf, days = 14) => date && dayDifference(date, asOf) >= 0 && dayDifference(date, asOf) <= days;

export function buildCenterIntelligence(data, asOf = iso(0)) {
  const patients = (data.patients || []).filter(item => item.status !== 'Archived');
  const inquiries = data.inquiries || [];
  const sessions = data.sessions || [];
  const followups = data.followups || [];
  const clinical = data.clinical || {};
  const flags = [];
  const patterns = [];

  for (const inquiry of inquiries) {
    if (!validOwner(inquiry.owner)) flags.push({
      id: `owner-${inquiry.id}`, kind: 'Ownership', priority: 'high', owner: 'Unassigned', subject: inquiry.subject || inquiry.name,
      title: 'Intake has no named coordinator', detail: `${inquiry.id} is in ${inquiry.stage.toLowerCase()} with no coordinator assigned. Assign the next handoff owner.`,
      sourceIds: [inquiry.id], route: 'inquiry', recordId: inquiry.id, action: 'Assign coordinator'
    });
    const required = inquiry.stage === 'Intake review' ? ['firstContact', 'questionnaire']
      : ['Awaiting decision', 'Arrival planned'].includes(inquiry.stage) ? ['firstContact', 'consent', 'questionnaire', 'assessment'] : [];
    const missing = required.filter(key => inquiry.checklist?.[key] !== true);
    if (missing.length) flags.push({
      id: `intake-${inquiry.id}`, kind: 'Intake record', priority: inquiry.stage === 'Arrival planned' ? 'high' : 'review',
      owner: validOwner(inquiry.owner) ? inquiry.owner : 'Unassigned', subject: inquiry.subject || inquiry.name,
      title: `${missing.length} intake ${missing.length === 1 ? 'check' : 'checks'} incomplete`,
      detail: `${inquiry.id} · ${missing.map(key => ({ firstContact: 'first conversation', consent: 'sharing permission', questionnaire: 'questionnaire', assessment: 'staff assessment' })[key]).join(', ')}. Complete the record before advancing.`,
      sourceIds: [inquiry.id], route: 'inquiry', recordId: inquiry.id, action: 'Open intake checklist'
    });
  }

  for (const patient of patients) {
    const record = clinical[patient.id];
    if (!record) continue;
    for (const note of record.notes || []) {
      const age = dayDifference(note.date, asOf);
      if (note.status === 'Draft' && age >= 2) flags.push({
        id: `note-${note.id}`, kind: 'Clinical notes', priority: age >= 4 ? 'high' : 'review',
        owner: note.author || patient.therapist || 'Unassigned', subject: patient.name,
        title: 'Session note awaiting signature', detail: `${patient.id} · “${note.title}” has remained a draft for ${age} days. Review and sign the recorded note.`,
        sourceIds: [note.id], route: 'patient', recordId: patient.id, tab: 'Notes', action: 'Review note'
      });
    }
    for (const document of record.documents || []) {
      if (document.name === 'Care plan agreement' && document.status === 'Needs review') flags.push({
        id: `document-${document.id}`, kind: 'Documents', priority: 'review',
        owner: document.owner || patient.therapist || 'Unassigned', subject: patient.name,
        title: 'Care plan agreement needs review', detail: `${patient.id} · the agreement register is marked “Needs review.” Check the document status with the assigned team.`,
        sourceIds: [document.id], route: 'patient', recordId: patient.id, tab: 'Documents', action: 'Review document'
      });
    }

    const attendance = (record.attendance || []).filter(item => recent(item.date, asOf));
    const disruptions = attendance.filter(item => item.status === 'Missed' || item.status === 'Excused');
    if (disruptions.length >= 2) {
      const context = (record.notes || []).find(note => /timetable conflict|schedule conflict/i.test(note.body || ''));
      patterns.push({
        id: `attendance-${patient.id}`, tone: 'attention', patientId: patient.id, patientName: patient.name,
        title: 'Repeated attendance disruption',
        detail: `${disruptions.length} of ${attendance.length} recent attendance entries are missed or excused.${context ? ' A signed note records a timetable conflict.' : ''} Confirm the reason and the next suitable time with the patient.`,
        sourceIds: [...disruptions.map(item => item.id), ...(context ? [context.id] : [])], tab: 'Attendance', action: 'Review attendance'
      });
    }
    const preferenceNote = (record.notes || []).find(note => /afternoon group as easier/i.test(note.body || ''));
    const excusedGroup = attendance.find(item => item.status === 'Excused' && /group/i.test(item.title || ''));
    if (preferenceNote && excusedGroup) patterns.push({
      id: `routine-${patient.id}`, tone: 'watch', patientId: patient.id, patientName: patient.name,
      title: 'Group time preference to check',
      detail: 'A session note records a preference for an afternoon group, and a recent group entry is excused. Check whether the next offered time fits the documented preference.',
      sourceIds: [preferenceNote.id, excusedGroup.id], tab: 'Attendance', action: 'Review routine'
    });
    const nextSession = sessions.find(item => item.patientRef === patient.id && item.date >= asOf);
    const nextFollowup = followups.find(item => item.patient === patient.id && item.due >= asOf && item.status !== 'Completed');
    if (patient.program === 'Outpatient' && nextSession && nextFollowup) patterns.push({
      id: `continuity-${patient.id}`, tone: 'positive', patientId: patient.id, patientName: patient.name,
      title: 'Two upcoming contact points recorded',
      detail: `A ${nextSession.title.toLowerCase()} is scheduled for ${nextSession.date}, with a separate ${nextFollowup.action.toLowerCase()} due ${nextFollowup.due}. Confirm both remain agreed with the patient.`,
      sourceIds: [nextSession.id, nextFollowup.id], tab: 'Timeline', action: 'Open continuity plan'
    });
  }

  flags.sort((a, b) => (a.priority === 'high' ? 0 : 1) - (b.priority === 'high' ? 0 : 1) || a.kind.localeCompare(b.kind) || a.id.localeCompare(b.id));
  const occupiedBeds = (data.rooms || []).flatMap(room => room.beds || []).filter(Boolean).length;
  const totalBeds = (data.rooms || []).reduce((total, room) => total + (room.beds || []).length, 0);
  const dueFollowups = followups.filter(item => item.due <= asOf && item.status !== 'Completed');
  const draftReports = patients.flatMap(patient => clinical[patient.id]?.reports || []).filter(item => item.status === 'Draft').length;
  return {
    flags, patterns,
    owners: [...new Set(flags.map(flag => flag.owner))].sort(),
    stats: {
      activePatients: patients.length, occupiedBeds, totalBeds, openInquiries: inquiries.length,
      sessionsToday: sessions.filter(item => item.date === asOf).length,
      dueFollowups: dueFollowups.length, draftReports,
      documentationGaps: flags.filter(flag => ['Clinical notes', 'Documents'].includes(flag.kind)).length,
      highPriority: flags.filter(flag => flag.priority === 'high').length
    }
  };
}
