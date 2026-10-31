import { iso } from './data.js';

const MAX_SOURCE_TEXT = 16000;

function plain(value) { return String(value ?? '').trim(); }

export function buildPatientEvidence(patient, record, sessions = [], followups = []) {
  const sources = [];
  const add = (id, type, title, date, text, tab, readable = true) => {
    const content = plain(text);
    sources.push({ id: plain(id), type, title: plain(title), date: plain(date), text: content.slice(0, MAX_SOURCE_TEXT), tab, readable: readable && !!content, truncated: content.length > MAX_SOURCE_TEXT });
  };

  add(`PROFILE-${patient.id}`, 'Patient profile', 'Current profile', patient.admitted,
    `Program: ${patient.program}. Status: ${patient.status}. Pathway: ${record.pathway}. Phase: ${record.phase}. Therapist: ${patient.therapist}. Coordinator: ${patient.coordinator}. Current task: ${patient.care}. Preferred language: ${patient.language || 'not recorded'}. Preferred contact: ${patient.contactPreference || 'not recorded'}.`, 'Overview');
  add(`CONTEXT-${patient.id}`, 'Intake context', 'Admission and continuity summary', patient.admitted,
    `Intake: ${record.background?.intake || 'Not recorded'} Preferences: ${record.background?.preferences || 'Not recorded'} Team handoff: ${record.background?.continuity || 'Not recorded'} Transition: ${record.background?.transition || 'Not recorded'}`, 'Overview');
  add(`PLAN-${patient.id}`, 'Care plan', 'Current care plan', record.carePlan.updated,
    `Focus: ${record.carePlan.focus}. Review due: ${record.carePlan.reviewDue}.`, 'Care plan');
  for (const goal of record.carePlan.goals || []) add(goal.id, 'Care goal', goal.title, goal.due,
    `Status: ${goal.status}. Progress recorded: ${goal.progress}%. Owner: ${goal.owner}. Detail: ${goal.detail}`, 'Care plan');
  for (const note of record.notes || []) add(note.id, note.kind || 'Note', note.title, note.date,
    `Signed by ${note.author} at ${note.time}. ${note.body}`, 'Notes');
  for (const comment of record.comments || []) add(comment.id, 'Team comment', `Comment by ${comment.author}`, comment.date,
    comment.body, 'Notes');
  for (const report of record.reports || []) {
    if (report.generatedBy === 'Cedar case review') continue;
    add(report.id, 'Existing report', report.title, report.createdAt,
      `Status: ${report.status}. Overview: ${report.overview}. Engagement: ${report.engagement}. Goals: ${report.goals}. Next steps: ${report.nextSteps}`, 'Reports');
  }
  for (const session of sessions.filter(item => item.patientRef === patient.id || item.meta?.includes(patient.id))) {
    add(session.id, 'Scheduled session', session.title, session.date,
      `Time: ${session.time}. Assigned staff: ${session.owner}. Details: ${session.meta || ''}. Location: ${session.location || 'not recorded'}.`, 'Attendance');
  }
  for (const item of record.attendance || []) add(item.id, 'Attendance', item.title, item.date,
    `Status: ${item.status}. Staff: ${item.staff}. Context: ${item.note || 'not recorded'}.`, 'Attendance');
  for (const item of followups.filter(entry => entry.patient === patient.id)) add(item.id, 'Follow-up', item.action, item.due,
    `Status: ${item.status}. Owner: ${item.owner}. Time: ${item.time}. Consent: ${item.consent}. Outcome: ${item.outcome || 'not recorded'}.`, 'Timeline');
  for (const document of record.documents || []) add(document.id, 'Document', document.name, document.date,
    document.extractedText || '', 'Documents', !!document.extractedText);
  for (const consent of record.consents || []) add(consent.id, 'Consent register', consent.label, consent.date,
    `Status: ${consent.status}. Scope: ${consent.scope}. Review due: ${consent.reviewDue}.`, 'Consent');

  const documents = sources.filter(source => source.type === 'Document');
  return {
    patientId: patient.id,
    sources,
    coverage: {
      total: sources.length,
      readable: sources.filter(source => source.readable).length,
      documents: documents.length,
      readableDocuments: documents.filter(source => source.readable).length,
      unavailableDocuments: documents.filter(source => !source.readable).map(source => source.title),
      truncatedSources: sources.filter(source => source.truncated).map(source => source.id)
    }
  };
}

function section(text, sourceIds) { return { text, sourceIds: [...new Set(sourceIds)].filter(Boolean) }; }

export function buildVerifiedPatientReview(patient, record, evidence, sessions = [], followups = []) {
  const goals = record.carePlan.goals || [];
  const attendance = record.attendance || [];
  const attended = attendance.filter(item => item.status === 'Attended').length;
  const missed = attendance.filter(item => item.status === 'Missed').length;
  const open = goals.filter(item => item.status !== 'Completed');
  const nextSessions = sessions.filter(item => (item.patientRef === patient.id || item.meta?.includes(patient.id)) && item.date >= iso(0)).sort((a, b) => a.date.localeCompare(b.date) || a.time.localeCompare(b.time));
  const openFollowups = followups.filter(item => item.patient === patient.id && item.status !== 'Completed');
  const recentNotes = [...(record.notes || [])].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 3);
  const unreadable = evidence.coverage.unavailableDocuments;
  const pendingConsents = (record.consents || []).filter(item => item.status !== 'Recorded');
  const nextGoal = [...open].sort((a, b) => a.due.localeCompare(b.due))[0];
  const lastNote = recentNotes[0];
  const findings = [
    { title: 'Admission and continuity', text: `${patient.name} is recorded in the ${record.pathway.toLowerCase()} with ${patient.therapist} as therapist and ${patient.coordinator} as coordinator. ${record.background?.continuity || 'The next team handoff is not documented.'}`, sourceIds: [`PROFILE-${patient.id}`, `CONTEXT-${patient.id}`] },
    { title: 'Care-plan review', text: `${open.length} of ${goals.length} goals remain open. ${nextGoal ? `The earliest recorded goal review is ${nextGoal.due} for “${nextGoal.title}” (${nextGoal.owner}).` : 'No open goal review is recorded.'} The plan review is due ${record.carePlan.reviewDue}.`, sourceIds: [`PLAN-${patient.id}`, ...goals.map(item => item.id)] },
    { title: 'Sessions and engagement', text: `${attended} of ${attendance.length} attendance entries are marked attended${missed ? `; ${missed} are marked missed` : ''}. ${nextSessions.length ? `The next linked session is ${nextSessions[0].date} at ${nextSessions[0].time} with ${nextSessions[0].owner}.` : 'No future linked session is recorded.'}`, sourceIds: [...attendance.map(item => item.id), ...nextSessions.slice(0, 1).map(item => item.id)] },
    { title: 'Document and permission checks', text: `${evidence.coverage.readableDocuments} of ${evidence.coverage.documents} registered documents have readable text.${unreadable.length ? ` Content unavailable: ${unreadable.join(', ')}.` : ''} ${pendingConsents.length} communication permission${pendingConsents.length === 1 ? '' : 's'} require confirmation or review.`, sourceIds: [...(record.documents || []).map(item => item.id), ...pendingConsents.map(item => item.id)] },
    { title: 'Team follow-through', text: `${openFollowups.length} open follow-up${openFollowups.length === 1 ? '' : 's'} are recorded.${lastNote ? ` The latest signed note is “${lastNote.title}” (${lastNote.date}, ${lastNote.author}).` : ''}`, sourceIds: [...openFollowups.map(item => item.id), ...recentNotes.map(item => item.id)] }
  ];
  const attendanceDetail = attendance.length ? attendance.map(item => `${item.date}: ${item.title} — ${item.status}${item.note ? ` (${item.note})` : ''}`).join('\n') : 'No attendance entries have been recorded.';
  const goalDetail = goals.length ? goals.map(item => `${item.title} — ${item.status}; ${item.progress}% recorded progress; owner ${item.owner}; review ${item.due}.`).join('\n') : 'No care goals have been entered.';
  const followupDetail = openFollowups.length ? openFollowups.map(item => `${item.action} — ${item.owner}, due ${item.due}.`).join('\n') : 'No open aftercare follow-up is recorded.';
  const noteDetail = recentNotes.length ? recentNotes.map(item => `${item.date} · ${item.title}: ${item.body}`).join('\n') : 'No signed note is available in this review.';
  const draft = {
    overview: section(`PATIENT CONTEXT\n${patient.name} entered the ${record.pathway.toLowerCase()} on ${patient.admitted}. ${record.background?.intake || ''}\n\nCURRENT FOCUS\n${record.carePlan.focus}\n\nRECENT DOCUMENTATION\n${noteDetail}`, [`PROFILE-${patient.id}`, `CONTEXT-${patient.id}`, `PLAN-${patient.id}`, ...recentNotes.map(item => item.id)]),
    engagement: section(`RECORDED CONTACT\n${attendanceDetail}\n\nSCHEDULED NEXT CONTACT\n${nextSessions.length ? `${nextSessions[0].title} on ${nextSessions[0].date} at ${nextSessions[0].time}, assigned to ${nextSessions[0].owner}.` : 'No future linked session is currently recorded.'}\n\nAttendance counts describe entries in this record only; they do not measure treatment response.`, [`PROFILE-${patient.id}`, ...attendance.map(item => item.id), ...nextSessions.slice(0, 1).map(item => item.id)]),
    goals: section(`CURRENT PLAN\n${record.carePlan.focus}\n\nGOAL STATUS\n${goalDetail}\n\nPlan review due ${record.carePlan.reviewDue}. The assigned team should confirm each status at the review.`, [`PLAN-${patient.id}`, ...goals.map(item => item.id)]),
    nextSteps: section(`DOCUMENTED FOLLOW-THROUGH\n${followupDetail}\n\nTEAM HANDOFF\n${record.background?.continuity || 'Confirm ownership of the next handoff.'}\n\nRECORD CHECKS\n${unreadable.length ? `Read or request the missing document content: ${unreadable.join(', ')}.` : 'All registered documents with an on-file status have readable text in this preview.'} ${pendingConsents.length ? `Review ${pendingConsents.length} communication permission${pendingConsents.length === 1 ? '' : 's'} before sharing information.` : ''}\n\nTRANSITION\n${record.background?.transition || 'Confirm the next appointment and contact plan.'}`, [`CONTEXT-${patient.id}`, ...openFollowups.map(item => item.id), ...(record.documents || []).filter(item => !item.extractedText).map(item => item.id), ...pendingConsents.map(item => item.id)])
  };
  return { mode: 'Verified record summary', summary: `${patient.name} is in the ${record.phase.toLowerCase()} phase of the ${record.pathway.toLowerCase()}. The documented focus is to ${record.carePlan.focus.charAt(0).toLowerCase()}${record.carePlan.focus.slice(1)} The review draws on ${evidence.coverage.readable} readable record items and flags ${unreadable.length} document${unreadable.length === 1 ? '' : 's'} without readable content. Findings describe recorded facts for staff to verify.`, findings, draft, limitations: unreadable.length ? [`${unreadable.length} registered document${unreadable.length === 1 ? '' : 's'} could not be read.`] : [] };
}

export function validateModelReview(value, evidence) {
  if (!value || typeof value.summary !== 'string' || !Array.isArray(value.findings) || !value.draft) return null;
  const known = new Set(evidence.sources.filter(source => source.readable).map(source => source.id));
  const cleanIds = ids => Array.isArray(ids) ? [...new Set(ids.filter(id => known.has(id)))].slice(0, 12) : [];
  const findings = value.findings.slice(0, 6).map(item => ({ title: plain(item.title).slice(0, 80), text: plain(item.text).slice(0, 650), sourceIds: cleanIds(item.sourceIds) })).filter(item => item.title && item.text && item.sourceIds.length);
  if (!findings.length) return null;
  const draft = {};
  for (const key of ['overview', 'engagement', 'goals', 'nextSteps']) {
    const item = value.draft[key];
    const sourceIds = cleanIds(item?.sourceIds);
    if (!plain(item?.text) || !sourceIds.length) return null;
    draft[key] = section(plain(item.text).slice(0, 1400), sourceIds);
  }
  return { mode: 'Local AI synthesis', summary: plain(value.summary).slice(0, 900), findings, draft, limitations: Array.isArray(value.limitations) ? value.limitations.slice(0, 4).map(item => plain(item).slice(0, 240)) : [] };
}

export function evidenceFingerprint(evidence) {
  let hash = 2166136261;
  for (const source of evidence.sources) for (const character of `${source.id}|${source.text}|`) hash = Math.imul(hash ^ character.charCodeAt(0), 16777619);
  return (hash >>> 0).toString(36);
}
