<script>
  import { dialogFocus } from './dialogFocus.js';
  import Registry from './Registry.svelte';
  import { scrollRegion } from './registry.js';
  import Icon from './Icon.svelte';
  import PatientIntelligence from './PatientIntelligence.svelte';
  import { iso, prettyDate } from './data.js';
  import { saveAttachment, readAttachment, extractDocumentText } from './clinicalFiles.js';

  export let patient;
  export let record;
  export let role;
  export let staff;
  export let sessions = [];
  export let followups = [];
  export let reviewRequest = 0;
  export let patientTabRequest = { tab: '', version: 0 };
  export let onPersist = () => {};
  export let onNotice = () => {};
  export let onSchedule = () => {};

  const tabs = ['Overview', 'AI review', 'Care plan', 'Notes', 'Reports', 'Attendance', 'Documents', 'Consent', 'Timeline'];
  let tab = 'Overview';
  let editor = '';
  let form = {};
  let editingId = '';
  let formError = '';
  let attachmentFile = null;
  let selectedReportId = '';
  let selectedNoteId = '';
  let currentPatientId = '';
  let lastReviewRequest = 0;
  let lastTabRequest = 0;
  let commentDraft = '';

  $: if (patient?.id && patient.id !== currentPatientId) {
    currentPatientId = patient.id;
    tab = 'Overview';
    editor = '';
    selectedReportId = '';
    selectedNoteId = '';
  }
  $: if (reviewRequest && reviewRequest !== lastReviewRequest) { lastReviewRequest = reviewRequest; tab = 'AI review'; }
  $: if (patientTabRequest?.version && patientTabRequest.version !== lastTabRequest) { lastTabRequest = patientTabRequest.version; tab = patientTabRequest.tab; if (tab === 'Notes' && patientTabRequest.sourceId) selectedNoteId = patientTabRequest.sourceId; if (tab === 'Reports' && patientTabRequest.sourceId) selectedReportId = patientTabRequest.sourceId; }
  $: canPlan = role === 'Director' || role === 'Therapist';
  $: canNotes = ['Director', 'Therapist', 'Coordinator'].includes(role);
  $: canReports = role === 'Director' || role === 'Therapist';
  $: canAttend = role === 'Director' || role === 'Therapist';
  $: canDocuments = ['Director', 'Therapist', 'Coordinator'].includes(role);
  $: canConsent = role === 'Director' || role === 'Coordinator';
  $: canReview = ['Director', 'Coordinator', 'Therapist'].includes(role);
  $: openGoals = record.carePlan.goals.filter(goal => goal.status !== 'Completed').length;
  $: attended = record.attendance.filter(item => item.status === 'Attended').length;
  $: selectedReport = record.reports.find(item => item.id === selectedReportId) || record.reports[0];
  $: selectedNote = record.notes.find(item => item.id === selectedNoteId) || record.notes[0];
  $: patientSessions = sessions.filter(item => item.patientRef === patient.id || item.meta?.includes(patient.id)).sort((a,b) => a.date.localeCompare(b.date) || a.time.localeCompare(b.time));
  $: patientFollowups = followups.filter(item => item.patient === patient.id);
  $: timeline = [
    ...record.notes.map(item => ({ id: item.id, date: item.date, label: item.title, type: item.kind, meta: item.author, tab:'Notes' })),
    ...record.reports.map(item => ({ id: item.id, date: item.createdAt, label: item.title, type: 'Report', meta: item.status, tab:'Reports' })),
    ...record.attendance.map(item => ({ id: item.id, date: item.date, label: item.title, type: 'Attendance', meta: item.status, tab:'Attendance' })),
    ...record.documents.map(item => ({ id: item.id, date: item.date, label: item.name, type: 'Document', meta: item.status, tab:'Documents' })),
    ...(record.comments || []).map(item=>({id:item.id,date:item.date,label:item.body,type:'Team comment',meta:item.author,tab:'Notes'})),
    ...(record.consents || []).map(item=>({id:item.id,date:item.date,label:item.label,type:'Permission',meta:item.status,tab:'Consent'}))
  ].sort((a,b) => b.date.localeCompare(a.date));

  function start(kind, item = null) {
    if ((kind === 'goal' && !canPlan) || (kind === 'note' && !canNotes) || (kind === 'report' && !canReports) || (kind === 'attendance' && !canAttend) || (kind === 'document' && !canDocuments) || (kind === 'consent' && !canConsent)) return;
    editor = kind;
    editingId = item?.id || '';
    formError = '';
    attachmentFile = null;
    form = item ? { ...item } : kind === 'goal'
      ? { title: '', detail: '', owner: staff.assignment, due: iso(7), status: 'Planned', progress: 0 }
      : kind === 'note'
      ? { kind: role === 'Coordinator' ? 'Coordination note' : 'Progress note', title: '', body: '' }
      : kind === 'report'
      ? { type: 'Weekly progress', title: 'Weekly progress report', periodStart: iso(-7), periodEnd: iso(0), overview: '', engagement: '', goals: '', nextSteps: '', status: 'Draft' }
      : kind === 'attendance'
      ? { date: iso(0), title: '', staff: staff.assignment, status: 'Attended', note: '' }
      : kind === 'document'
      ? { name: '', category: 'Care plan', status: 'On file', date: iso(0), owner: staff.assignment }
      : { label: '', scope: '', status: 'Needs confirmation', date: iso(0), reviewDue: iso(30) };
  }

  function closeEditor() { editor = ''; form = {}; editingId = ''; formError = ''; attachmentFile = null; }
  function changed(action) { onPersist(patient.id, action); onNotice(action); }
  function signSelectedNote() {
    if (!selectedNote || selectedNote.status !== 'Draft' || selectedNote.author !== staff.name || !canNotes) return;
    selectedNote.status = 'Signed';
    selectedNote.signedBy = staff.name;
    selectedNote.signedAt = iso(0);
    changed('Clinical note signed.');
  }
  function nextId(prefix) { return `${prefix}-${Date.now()}`; }

  function addComment() {
    if (!canNotes || !commentDraft.trim()) return;
    record.comments.unshift({ id: nextId('COM'), date: iso(0), author: staff.name, body: commentDraft.trim() });
    commentDraft = '';
    changed('Team comment added.');
  }

  function openEvidence(source) {
    tab = source.tab;
    if (source.tab === 'Notes' && source.type !== 'Team comment') selectedNoteId = source.id;
    if (source.tab === 'Reports') selectedReportId = source.id;
  }

  async function saveEditor() {
    if (!editor) return;
    const kind = editor;
    const now = iso(0);
    if (kind === 'goal') {
      if (!form.title?.trim()) { formError = 'Give the goal a clear title.'; return; }
      const value = { title: form.title.trim(), detail: form.detail?.trim() || '', owner: form.owner || staff.assignment, due: form.due || iso(7), status: form.status || 'Planned', progress: Math.min(100, Math.max(0, Number(form.progress) || 0)) };
      if (editingId) Object.assign(record.carePlan.goals.find(item => item.id === editingId), value);
      else record.carePlan.goals.unshift({ id: nextId('GOAL'), ...value });
      record.carePlan.updated = now;
      changed(editingId ? 'Care-plan goal updated.' : 'Care-plan goal added.');
    } else if (kind === 'note') {
      if (!form.title?.trim() || !form.body?.trim()) { formError = 'A title and note are required.'; return; }
      const value = { id: nextId('NOTE'), kind: role === 'Coordinator' ? 'Coordination note' : form.kind || 'Progress note', title: form.title.trim(), body: form.body.trim(), author: staff.name, date: now, time: new Date().toLocaleTimeString('en-LB', { hour: '2-digit', minute: '2-digit', hour12: false }), status: 'Signed' };
      record.notes.unshift(value);
      selectedNoteId = value.id;
      changed('Signed note added.');
    } else if (kind === 'report') {
      if (!form.title?.trim() || !form.overview?.trim() || !form.nextSteps?.trim()) { formError = 'Title, overview and next steps are required.'; return; }
      if (form.periodStart > form.periodEnd) { formError = 'The period start must be before the end.'; return; }
      const value = { type: form.type, title: form.title.trim(), periodStart: form.periodStart, periodEnd: form.periodEnd, overview: form.overview.trim(), engagement: form.engagement?.trim() || '', goals: form.goals?.trim() || '', nextSteps: form.nextSteps.trim(), status: 'Draft', author: staff.name, createdAt: form.createdAt || now };
      if (editingId) Object.assign(record.reports.find(item => item.id === editingId), value);
      else { const newReport = { id: nextId('RPT'), ...value }; record.reports.unshift(newReport); selectedReportId = newReport.id; }
      changed(editingId ? 'Report draft updated.' : 'Report draft created.');
    } else if (kind === 'attendance') {
      if (!form.title?.trim()) { formError = 'Enter the session or activity.'; return; }
      const value = { date: form.date || now, title: form.title.trim(), staff: form.staff || staff.assignment, status: form.status || 'Attended', note: form.note?.trim() || '' };
      if (editingId) Object.assign(record.attendance.find(item => item.id === editingId), value);
      else record.attendance.unshift({ id: nextId('ATT'), ...value });
      changed('Attendance updated.');
    } else if (kind === 'document') {
      if (!form.name?.trim()) { formError = 'Enter a document name.'; return; }
      if (attachmentFile && attachmentFile.size > 10 * 1024 * 1024) { formError = 'Choose a file smaller than 10 MB.'; return; }
      const id = editingId || nextId('DOC');
      let extraction = null;
      let extractionError = '';
      if (attachmentFile) {
        try { await saveAttachment(id, attachmentFile); }
        catch { formError = 'The browser could not save this local attachment.'; return; }
        try { extraction = await extractDocumentText(attachmentFile); }
        catch (error) { extractionError = error.message || 'Text extraction was unavailable.'; }
      }
      const value = { name: form.name.trim(), category: form.category || 'Other', status: form.status || 'On file', date: form.date || now, owner: form.owner || staff.assignment, sample: !attachmentFile && !!form.sample, hasFile: !!attachmentFile || !!form.hasFile, extractedText: attachmentFile ? (extraction?.text || '') : (form.extractedText || ''), extractionError: attachmentFile ? extractionError : (form.extractionError || ''), extractionTruncated: attachmentFile ? !!extraction?.truncated : !!form.extractionTruncated };
      if (editingId) Object.assign(record.documents.find(item => item.id === editingId), value);
      else record.documents.unshift({ id, ...value });
      changed(attachmentFile ? 'Local attachment saved.' : 'Document register updated.');
      if (extractionError) onNotice(`Attachment saved; AI cannot read its content yet. ${extractionError}`);
    } else if (kind === 'consent') {
      if (!form.label?.trim() || !form.scope?.trim()) { formError = 'Enter the consent label and scope.'; return; }
      const value = { label: form.label.trim(), scope: form.scope.trim(), status: form.status || 'Needs confirmation', date: form.date || now, reviewDue: form.reviewDue || iso(30) };
      if (editingId) Object.assign(record.consents.find(item => item.id === editingId), value);
      else record.consents.unshift({ id: nextId('CON'), ...value });
      changed('Consent register updated.');
    }
    closeEditor();
  }

  function finalize(report) {
    if (!canReports || report.status === 'Final') return;
    report.status = 'Final';
    report.finalizedAt = iso(0);
    changed('Report marked final.');
  }

  async function openDocument(doc) {
    if (!doc.hasFile) { onNotice('This sample document is a register entry; no file is attached.'); return; }
    try {
      const file = await readAttachment(doc.id);
      if (!file) { onNotice('The local attachment is no longer available in this browser.'); return; }
      const url = URL.createObjectURL(file);
      const link = document.createElement('a');
      link.href = url;
      link.download = file.name || doc.name;
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 60000);
    } catch { onNotice('The local attachment could not be opened.'); }
  }

  function printReport(report) {
    const escape = value => String(value || '').replace(/[&<>"']/g, character => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' })[character]);
    const documentHtml = `<!doctype html><html><head><meta charset="utf-8"><title>${escape(report.title)} · ${escape(patient.id)}</title><style>body{font:15px/1.6 Arial,sans-serif;color:#20372d;max-width:760px;margin:48px auto;padding:0 24px}header{border-bottom:2px solid #1c4a3a;padding-bottom:22px;margin-bottom:28px}h1{font:normal 34px Georgia,serif;margin:10px 0}h2{font-size:13px;letter-spacing:.12em;text-transform:uppercase;color:#527b60;margin:28px 0 8px}p{white-space:pre-wrap;margin:0}.meta{color:#6b8071;font-size:13px}.notice{margin-top:34px;padding:12px;background:#eef4ec;color:#486d53;font-size:12px}@media print{body{margin:18mm auto}.notice{border:1px solid #ccc}}</style></head><body><header><div class="meta">CEDAR LEBANON · FICTIONAL DEMO REPORT</div><h1>${escape(report.title)}</h1><div class="meta">${escape(patient.id)} · ${escape(report.type)} · ${escape(prettyDate(report.periodStart))}–${escape(prettyDate(report.periodEnd))} · ${escape(report.status)}</div></header><h2>Overview</h2><p>${escape(report.overview)}</p><h2>Engagement and attendance</h2><p>${escape(report.engagement)}</p><h2>Care-plan goals</h2><p>${escape(report.goals)}</p><h2>Next steps</h2><p>${escape(report.nextSteps)}</p><div class="notice">Prepared by ${escape(report.author)} · ${escape(report.createdAt)}. Fictional demo data; not a clinical document.</div><script>window.onload=()=>window.print()<\/script></body></html>`;
    const view = window.open('', '_blank');
    if (!view) { onNotice('Allow pop-ups to print this report.'); return; }
    view.opener = null;
    view.document.write(documentHtml);
    view.document.close();
  }
</script>

<div class="clinical-record">
  <div class="record-masthead">
    <div class="record-identity"><span class="record-monogram">{patient.name.split(/\s+/).map(part => part[0]).slice(0,2).join('')}</span><div><div class="record-kicker">PATIENT RECORD · {patient.id}</div><h2>{patient.name}</h2><p>{record.pathway} <span>·</span> {record.phase} <span>·</span> Admitted {prettyDate(patient.admitted, {day:'numeric',month:'long',year:'numeric'})}</p></div></div>
    <div class="record-status"><span class:archived={patient.status === 'Archived'} class="record-status-dot"></span>{patient.status === 'Archived' ? 'Archived record' : 'Active care'}</div>
  </div>

  <div class="record-summary">
    <div><span>Care-plan goals</span><strong>{openGoals}<small> open</small></strong><p>Review {prettyDate(record.carePlan.reviewDue)}</p></div>
    <div><span>Attendance</span><strong>{attended}<small> / {record.attendance.length}</small></strong><p>Recorded appointments</p></div>
    <div><span>Reports</span><strong>{record.reports.length}</strong><p>{record.reports.filter(item => item.status === 'Draft').length} drafts to review</p></div>
    <div><span>Documents</span><strong>{record.documents.filter(item => item.status !== 'On file').length}<small> pending</small></strong><p>Register needs attention</p></div>
  </div>

  <nav class="record-tabs" aria-label="Patient record sections">{#each tabs.filter(item => item !== 'AI review' || canReview) as item}<button class:active={tab === item} on:click={() => tab = item}>{item}</button>{/each}</nav>

  {#if tab === 'Overview'}
    <div class="record-grid">
      <section class="record-panel record-focus"><div class="record-section-head"><div><span class="record-section-kicker">CURRENT PATHWAY</span><h3>Care at a glance</h3></div><span class="record-soft-tag">{record.phase}</span></div><p class="record-lead">{record.carePlan.focus}</p><div class="record-details"><div><span>Assigned therapist</span><strong>{patient.therapist}</strong></div><div><span>Care coordinator</span><strong>{patient.coordinator}</strong></div>{#if patient.program === 'Residential'}<div><span>Assigned RSA</span><strong>{patient.rsa || 'Unassigned'}</strong></div>{/if}<div><span>Program</span><strong>{patient.program}</strong></div><div><span>Room / setting</span><strong>{patient.room === '—' ? 'Outpatient / unplaced' : patient.room}</strong></div><div><span>Next appointment</span><strong>{patient.next}</strong></div><div><span>Care-plan review</span><strong>{prettyDate(record.carePlan.reviewDue)}</strong></div><div><span>Age range</span><strong>{patient.ageBand || 'Not recorded'}</strong></div><div><span>Preferred language</span><strong>{patient.language || 'Not recorded'}</strong></div><div><span>Referral source</span><strong>{patient.referral || 'Not recorded'}</strong></div><div><span>Preferred contact</span><strong>{patient.contactPreference || 'Confirm with coordinator'}</strong></div></div></section>
      <section class="record-panel"><div class="record-section-head"><div><span class="record-section-kicker">WHAT NEEDS ATTENTION</span><h3>Open work</h3></div></div><div class="record-priority-list">{#each record.carePlan.goals.filter(goal => goal.status !== 'Completed').slice(0,3) as goal}<button on:click={() => tab = 'Care plan'}><span class="record-priority-icon"><Icon name="heart" size={15}/></span><span><strong>{goal.title}</strong><small>{goal.owner} · Due {prettyDate(goal.due)}</small></span><Icon name="chevron" size={14}/></button>{/each}{#each record.documents.filter(doc => doc.status !== 'On file').slice(0,2) as doc}<button on:click={() => tab = 'Documents'}><span class="record-priority-icon amber"><Icon name="inbox" size={15}/></span><span><strong>{doc.name}</strong><small>{doc.status} · {doc.category}</small></span><Icon name="chevron" size={14}/></button>{/each}</div></section>
    </div>
    <section class="record-panel record-background"><div class="record-section-head"><div><span class="record-section-kicker">ADMISSION & CONTINUITY</span><h3>Case context</h3><p>A concise working history from the fictional intake record.</p></div></div><div class="record-background-grid"><div><span>01 / Why Cedar</span><p>{record.background?.intake}</p></div><div><span>02 / Communication & consent</span><p>{record.background?.preferences}</p></div><div><span>03 / Team handoff</span><p>{record.background?.continuity}</p></div><div><span>04 / Transition planning</span><p>{record.background?.transition}</p></div></div></section>
    <div class="record-grid">
      <section class="record-panel"><div class="record-section-head"><div><span class="record-section-kicker">SCHEDULE</span><h3>Appointments & follow-up</h3></div><button class="text-link" on:click={onSchedule}>Open calendar →</button></div><div class="record-simple-list">{#each patientSessions.slice(0,3) as item}<div><span class="record-date-box">{prettyDate(item.date)}</span><span><strong>{item.title}</strong><small>{item.time} · {item.owner} · {item.meta}</small></span></div>{:else}<p class="record-empty">No linked calendar events. Add a patient reference to the appointment.</p>{/each}{#each patientFollowups.slice(0,2) as item}<div><span class="record-date-box">{prettyDate(item.due)}</span><span><strong>{item.action}</strong><small>Aftercare · {item.owner} · {item.status}</small></span></div>{/each}</div></section>
      <section class="record-panel"><div class="record-section-head"><div><span class="record-section-kicker">LAST DOCUMENTED</span><h3>Recent activity</h3></div><button class="text-link" on:click={() => tab = 'Timeline'}>Full timeline →</button></div><div class="record-simple-list">{#each timeline.slice(0,5) as item}<div><span class="record-timeline-dot"></span><span><strong>{item.label}</strong><small>{item.type} · {prettyDate(item.date)} · {item.meta}</small></span></div>{/each}</div></section>
    </div>
  {:else if tab === 'AI review'}
    <PatientIntelligence {patient} {record} {sessions} {followups} {staff} onOpenSource={openEvidence} onOpenReports={() => tab = 'Reports'} onPersist={(action) => changed(action)} onNotice={onNotice}/>
  {:else if tab === 'Care plan'}
    <section class="record-panel"><div class="record-section-head"><div><span class="record-section-kicker">SHARED PLAN</span><h3>Care plan & goals</h3><p>Last updated {prettyDate(record.carePlan.updated)} · Next review {prettyDate(record.carePlan.reviewDue)}</p></div>{#if canPlan}<button class="btn btn-primary btn-tiny" on:click={() => start('goal')}><Icon name="plus" size={14}/> Add goal</button>{/if}</div><div class="record-plan-focus"><span>Current focus</span><p>{record.carePlan.focus}</p></div><Registry items={record.carePlan.goals} label="Patient goals" scope={patient.id} searchKeys={['title','detail','owner']} fields={[{key:'status',label:'Status'},{key:'owner',label:'Owner'}]} dateKey="due" dateLabel="Review date" sorts={[{key:'due',label:'Review due soonest'},{key:'progress',label:'Least progress first'}]} let:rows><div class="record-goals">{#each rows as goal}<article class="record-goal"><div class="record-goal-top"><span class:complete={goal.status === 'Completed'} class="record-goal-status">{goal.status}</span><small>{goal.owner} · Due {prettyDate(goal.due)}</small></div><h4>{goal.title}</h4><p>{goal.detail}</p><div class="record-progress"><span style:width={goal.progress + '%'}></span></div><div class="record-goal-foot"><small>{goal.progress}% progress recorded</small>{#if canPlan}<button class="text-link" on:click={() => start('goal', goal)}>Update goal</button>{/if}</div></article>{/each}</div></Registry></section>
  {:else if tab === 'Notes'}
    <div class="record-grid record-split"><section class="record-panel"><div class="record-section-head"><div><span class="record-section-kicker">CHART NOTES</span><h3>Chart notes</h3></div>{#if canNotes}<button class="btn btn-primary btn-tiny" on:click={() => start('note')}><Icon name="plus" size={14}/> Add note</button>{/if}</div><Registry items={record.notes} label="Patient notes" compact scope={patient.id} searchKeys={['title','body','author']} fields={[{key:'kind',label:'Note type'},{key:'author',label:'Author'}]} dateKey="date" dateLabel="Written date" sorts={[{key:'date',desc:true,label:'Newest first'},{key:'date',label:'Oldest first'}]} hint="The open note stays visible while you filter this list." let:rows><div class="record-select-list">{#each rows as note}<button class:active={selectedNote?.id === note.id} on:click={() => selectedNoteId = note.id}><span class="record-note-kind">{note.kind}</span><strong>{note.title}</strong><small>{prettyDate(note.date)} · {note.author}</small></button>{/each}</div></Registry></section><section class="record-panel record-paper">{#if selectedNote}<span class="record-section-kicker">{selectedNote.kind.toUpperCase()} · {selectedNote.status.toUpperCase()}</span><h3>{selectedNote.title}</h3><p class="record-paper-meta">{prettyDate(selectedNote.date, {day:'numeric',month:'long',year:'numeric'})} at {selectedNote.time} · {selectedNote.author}</p><div class="record-paper-body">{selectedNote.body}</div>{#if selectedNote.status === 'Signed'}<div class="record-signature"><Icon name="shield" size={16}/> Signed entry · Add an addendum for corrections</div>{:else}<div class="record-draft-notice"><Icon name="clock" size={16}/><span>Draft entry · Awaiting signature by {selectedNote.author}</span>{#if canNotes && selectedNote.author === staff.name}<button type="button" class="btn btn-primary btn-tiny" on:click={signSelectedNote}>Sign note</button>{/if}</div>{/if}{/if}</section></div>
    <section class="record-panel record-comments"><div class="record-section-head"><div><span class="record-section-kicker">TEAM DISCUSSION</span><h3>Comments & handoffs</h3><p>Short working updates sit alongside signed clinical notes.</p></div></div><Registry items={record.comments || []} label="Team comments" compact scope={patient.id} searchKeys={['body','author']} fields={[{key:'author',label:'Author'}]} dateKey="date" sorts={[{key:'date',desc:true,label:'Newest first'},{key:'date',label:'Oldest first'}]} let:rows><div class="record-comment-list">{#each rows as comment}<article><span class="record-comment-avatar">{comment.author.slice(0,1)}</span><div><strong>{comment.author} <small>· {prettyDate(comment.date)}</small></strong><p>{comment.body}</p></div></article>{:else}<p class="record-empty">No team comments yet.</p>{/each}</div></Registry>{#if canNotes}<form class="record-comment-form" on:submit|preventDefault={addComment}><label for="team-comment">Add a team comment</label><textarea id="team-comment" bind:value={commentDraft} placeholder="A handoff, question or practical update"></textarea><button class="btn btn-primary btn-tiny" type="submit" disabled={!commentDraft.trim()}>Post comment</button></form>{/if}</section>
  {:else if tab === 'Reports'}
    <div class="record-grid record-split"><section class="record-panel"><div class="record-section-head"><div><span class="record-section-kicker">REPORT LIBRARY</span><h3>Patient reports</h3></div>{#if canReports}<button class="btn btn-primary btn-tiny" on:click={() => start('report')}><Icon name="plus" size={14}/> New report</button>{/if}</div><Registry items={record.reports} label="Patient reports" compact scope={patient.id} searchKeys={['title','type','author','overview']} fields={[{key:'type',label:'Report type'},{key:'status',label:'Status'},{key:'author',label:'Author'}]} dateKey="createdAt" dateLabel="Created date" sorts={[{key:'createdAt',desc:true,label:'Newest first'},{key:'createdAt',label:'Oldest first'}]} hint="The open report stays visible while you filter this list." let:rows><div class="record-select-list">{#each rows as report}<button class:active={selectedReport?.id === report.id} on:click={() => selectedReportId = report.id}><span class="record-note-kind">{report.type} · {report.status}</span><strong>{report.title}</strong><small>{prettyDate(report.periodStart)} – {prettyDate(report.periodEnd)} · {report.author}</small></button>{:else}<p class="record-empty">No reports yet. Create the first draft.</p>{/each}</div></Registry></section><section class="record-panel record-paper">{#if selectedReport}<div class="record-report-header"><div><span class="record-section-kicker">{selectedReport.type.toUpperCase()} · {selectedReport.status.toUpperCase()}</span><h3>{selectedReport.title}</h3><p class="record-paper-meta">{prettyDate(selectedReport.periodStart)} – {prettyDate(selectedReport.periodEnd)} · Prepared by {selectedReport.author}</p></div><div class="record-report-actions"><button class="btn btn-outline btn-tiny" on:click={() => printReport(selectedReport)}>Print / PDF</button>{#if canReports && selectedReport.status === 'Draft'}<button class="btn btn-soft btn-tiny" on:click={() => start('report', selectedReport)}>Edit draft</button><button class="btn btn-primary btn-tiny" on:click={() => finalize(selectedReport)}>Mark final</button>{/if}</div></div><div class="record-report-body"><div><span>01 / Overview</span><p>{selectedReport.overview}</p></div><div><span>02 / Engagement</span><p>{selectedReport.engagement || 'Not documented yet.'}</p></div><div><span>03 / Goals</span><p>{selectedReport.goals || 'Not documented yet.'}</p></div><div><span>04 / Next steps</span><p>{selectedReport.nextSteps}</p></div></div>{/if}</section></div>
  {:else if tab === 'Attendance'}
    <section class="record-panel"><div class="record-section-head"><div><span class="record-section-kicker">APPOINTMENT RECORD</span><h3>Attendance log</h3><p>Record attended, excused and missed sessions with context.</p></div>{#if canAttend}<button class="btn btn-primary btn-tiny" on:click={() => start('attendance')}><Icon name="plus" size={14}/> Record attendance</button>{/if}</div><Registry items={record.attendance} label="Attendance entries" pageSize={25} scope={patient.id} searchKeys={['title','staff','note']} fields={[{key:'status',label:'Status'},{key:'staff',label:'Staff'}]} dateKey="date" dateLabel="Session date" sorts={[{key:'date',desc:true,label:'Newest first'},{key:'date',label:'Oldest first'},{key:'title',label:'Session title'}]} columns={[{key:'date',label:'Date'},{key:'title',label:'Session'},{key:'staff',label:'Staff'},{key:'status',label:'Status'},{key:'note',label:'Note'}]} let:rows><div class="record-table-wrap" use:scrollRegion role="region" aria-label="Data table — scroll horizontally to see all columns"><table class="record-table"><thead><tr><th>Date</th><th>Session / activity</th><th>Staff</th><th>Status</th><th>Note</th><th></th></tr></thead><tbody>{#each rows as item}<tr><td>{prettyDate(item.date)}</td><td><strong>{item.title}</strong></td><td>{item.staff}</td><td><span class:missed={item.status === 'Missed'} class:excused={item.status === 'Excused'} class="record-attendance-status">{item.status}</span></td><td>{item.note}</td><td>{#if canAttend}<button class="text-link" on:click={() => start('attendance', item)}>Edit</button>{/if}</td></tr>{/each}</tbody></table></div></Registry></section>
  {:else if tab === 'Documents'}
    <section class="record-panel"><div class="record-section-head"><div><span class="record-section-kicker">DOCUMENT REGISTER</span><h3>Files & requests</h3><p>Track required documents and local demo attachments.</p></div>{#if canDocuments}<button class="btn btn-primary btn-tiny" on:click={() => start('document')}><Icon name="plus" size={14}/> Add document</button>{/if}</div><Registry items={record.documents} label="Patient documents" scope={patient.id} searchKeys={['name','category','owner']} fields={[{key:'category',label:'Category'},{key:'status',label:'Status'},{key:'owner',label:'Owner'},{id:'readable',key:item=>item.extractedText?'Readable':'Content unavailable',label:'AI review content'}]} dateKey="date" dateLabel="Document date" sorts={[{key:'date',desc:true,label:'Newest first'},{key:'name',label:'Document name'}]} let:rows><div class="record-document-list">{#each rows as doc}<article class:source-target={patientTabRequest?.sourceId === doc.id}><span class="record-doc-icon"><Icon name="inbox" size={19}/></span><span><strong>{doc.name}</strong><small>{doc.category} · {doc.owner} · {prettyDate(doc.date)} · {doc.extractedText ? 'Readable for AI review' : 'Content unavailable for AI review'}</small></span><span class:pending={doc.status !== 'On file'} class="record-doc-status">{doc.status}</span>{#if doc.hasFile}<button class="text-link" on:click={() => openDocument(doc)}>Download</button>{/if}{#if canDocuments}<button class="text-link" on:click={() => start('document', doc)}>Manage</button>{/if}</article>{#if doc.extractedText}<details class="record-doc-preview"><summary>Read extracted text</summary><p>{doc.extractedText}</p>{#if doc.extractionTruncated}<small>Only the first 16,000 characters were extracted.</small>{/if}</details>{:else if doc.extractionError}<p class="record-doc-error">{doc.extractionError}</p>{/if}{/each}</div></Registry><p class="record-safety-note">Attachments added here stay in this browser’s local storage. PDF and DOCX text extraction runs on the local Node server. Use fictional files only.</p></section>
  {:else if tab === 'Consent'}
    <section class="record-panel"><div class="record-section-head"><div><span class="record-section-kicker">CONSENT & ACCESS</span><h3>Communication permissions</h3><p>Record who may receive information and when to review each permission.</p></div>{#if canConsent}<button class="btn btn-primary btn-tiny" on:click={() => start('consent')}><Icon name="plus" size={14}/> Add permission</button>{/if}</div><Registry items={record.consents} label="Permissions" scope={patient.id} searchKeys={['label','scope']} fields={[{key:'status',label:'Status'},{id:'review',key:item=>item.reviewDue<iso(0)?'Review overdue':item.reviewDue<=iso(7)?'Review within 7 days':'Later review',label:'Review timing'}]} dateKey="reviewDue" dateLabel="Review date" sorts={[{key:'reviewDue',label:'Review due soonest'},{key:'date',desc:true,label:'Recently recorded'}]} let:rows><div class="record-consent-list">{#each rows as item}<article><span class:pending={item.status !== 'Recorded'} class="record-consent-icon"><Icon name="shield" size={18}/></span><div><h4>{item.label}</h4><p>{item.scope}</p><small>Recorded {prettyDate(item.date)} · Review {prettyDate(item.reviewDue)}</small></div><span class:pending={item.status !== 'Recorded'} class="record-doc-status">{item.status}</span>{#if canConsent}<button class="text-link" on:click={() => start('consent', item)}>Update</button>{/if}</article>{/each}</div></Registry><p class="record-safety-note">A recorded permission here is a demo status. Verify the signed consent source before sharing any real information.</p></section>
  {:else if tab === 'Timeline'}
    <section class="record-panel"><div class="record-section-head"><div><span class="record-section-kicker">CONNECTED HISTORY</span><h3>Record timeline</h3><p>Notes, comments, reports, attendance, permissions and documents in date order.</p></div></div><Registry items={timeline} label="Timeline events" pageSize={25} scope={patient.id} searchKeys={['label','type','meta']} fields={[{key:'type',label:'Event type'}]} dateKey="date" dateLabel="Event date" sorts={[{key:'date',desc:true,label:'Newest first'},{key:'date',label:'Oldest first'}]} let:rows><div class="record-timeline">{#each rows as item}<div><span class="record-timeline-rail"></span><time>{prettyDate(item.date, {day:'numeric',month:'short',year:'numeric'})}</time><span><strong>{item.label}</strong><small>{item.type} · {item.meta}</small><button class="text-link timeline-open" on:click={()=>openEvidence({tab:item.tab,id:item.id,type:item.type})}>Open source →</button></span></div>{/each}</div></Registry></section>
  {/if}
</div>

{#if editor}
  <div class="modal-backdrop" role="presentation" on:click={(event) => { if (event.target === event.currentTarget) closeEditor(); }}><form class="modal record-editor" use:dialogFocus={{onClose:closeEditor}} on:submit|preventDefault={saveEditor}><div class="modal-head"><div><div class="eyebrow">{patient.id} / {editor}</div><h2>{editingId ? 'Update' : 'Add'} {editor}</h2></div><button type="button" class="icon-btn" aria-label="Close" on:click={closeEditor}><Icon name="close"/></button></div><div class="modal-body"><div class="form-grid">
    {#if editor === 'goal'}<div class="form-field full"><label for="goal-title">Goal</label><input id="goal-title" required bind:value={form.title} placeholder="A clear and measurable care goal"/></div><div class="form-field full"><label for="goal-detail">Plan and evidence</label><textarea id="goal-detail" bind:value={form.detail} placeholder="What will the team do, and how will progress be reviewed?"></textarea></div><div class="form-field"><label for="goal-owner">Owner</label><input id="goal-owner" bind:value={form.owner}/></div><div class="form-field"><label for="goal-due">Review by</label><input id="goal-due" type="date" bind:value={form.due}/></div><div class="form-field"><label for="goal-status">Status</label><select id="goal-status" bind:value={form.status}><option>Planned</option><option>In progress</option><option>Needs review</option><option>Completed</option></select></div><div class="form-field"><label for="goal-progress">Progress (%)</label><input id="goal-progress" type="number" min="0" max="100" bind:value={form.progress}/></div>
    {:else if editor === 'note'}<div class="form-field"><label for="note-kind">Type</label><select id="note-kind" bind:value={form.kind} disabled={role === 'Coordinator'}><option>Progress note</option><option>Session note</option><option>Coordination note</option><option>Care-plan review</option><option>Addendum</option></select></div><div class="form-field"><label for="note-title">Title</label><input id="note-title" required bind:value={form.title}/></div><div class="form-field full"><label for="note-body">Documented observation and next step</label><textarea id="note-body" class="record-long-input" required bind:value={form.body}></textarea></div><p class="form-help">Saving signs this demo entry. Add an addendum for corrections.</p>
    {:else if editor === 'report'}<div class="form-field"><label for="report-type">Type</label><select id="report-type" bind:value={form.type}><option>Weekly progress</option><option>Case review</option><option>Transition summary</option><option>Discharge summary</option></select></div><div class="form-field"><label for="report-title">Title</label><input id="report-title" required bind:value={form.title}/></div><div class="form-field"><label for="report-start">Period start</label><input id="report-start" type="date" required bind:value={form.periodStart}/></div><div class="form-field"><label for="report-end">Period end</label><input id="report-end" type="date" required bind:value={form.periodEnd}/></div><div class="form-field full"><label for="report-overview">Overview</label><textarea id="report-overview" required bind:value={form.overview}></textarea></div><div class="form-field full"><label for="report-engagement">Engagement and attendance</label><textarea id="report-engagement" bind:value={form.engagement}></textarea></div><div class="form-field full"><label for="report-goals">Progress against goals</label><textarea id="report-goals" bind:value={form.goals}></textarea></div><div class="form-field full"><label for="report-next">Next steps and owner</label><textarea id="report-next" required bind:value={form.nextSteps}></textarea></div>
    {:else if editor === 'attendance'}<div class="form-field"><label for="attendance-date">Date</label><input id="attendance-date" type="date" required bind:value={form.date}/></div><div class="form-field"><label for="attendance-status">Status</label><select id="attendance-status" bind:value={form.status}><option>Attended</option><option>Excused</option><option>Missed</option><option>Rescheduled</option></select></div><div class="form-field full"><label for="attendance-title">Session or activity</label><input id="attendance-title" required bind:value={form.title}/></div><div class="form-field full"><label for="attendance-staff">Staff member</label><input id="attendance-staff" bind:value={form.staff}/></div><div class="form-field full"><label for="attendance-note">Context / follow-up</label><textarea id="attendance-note" bind:value={form.note}></textarea></div>
    {:else if editor === 'document'}<div class="form-field full"><label for="document-name">Document name</label><input id="document-name" required bind:value={form.name}/></div><div class="form-field"><label for="document-category">Category</label><select id="document-category" bind:value={form.category}><option>Intake</option><option>Care plan</option><option>Consent</option><option>Report</option><option>Transition</option><option>Other</option></select></div><div class="form-field"><label for="document-status">Status</label><select id="document-status" bind:value={form.status}><option>On file</option><option>Requested</option><option>Needs review</option><option>Archived</option></select></div><div class="form-field"><label for="document-owner">Owner</label><input id="document-owner" bind:value={form.owner}/></div><div class="form-field"><label for="document-date">Recorded date</label><input id="document-date" type="date" bind:value={form.date}/></div><div class="form-field full"><label for="document-file">Local file (optional, 10 MB maximum)</label><input id="document-file" type="file" on:change={(event) => attachmentFile = event.currentTarget.files?.[0] || null}/></div><p class="form-help">Only attach fictional demo files. Attachments are saved in this browser.</p>
    {:else if editor === 'consent'}<div class="form-field full"><label for="consent-label">Permission</label><input id="consent-label" required bind:value={form.label}/></div><div class="form-field full"><label for="consent-scope">Scope and conditions</label><textarea id="consent-scope" required bind:value={form.scope}></textarea></div><div class="form-field"><label for="consent-status">Status</label><select id="consent-status" bind:value={form.status}><option>Recorded</option><option>Needs confirmation</option><option>Withdrawn</option><option>Expired</option></select></div><div class="form-field"><label for="consent-date">Recorded</label><input id="consent-date" type="date" bind:value={form.date}/></div><div class="form-field full"><label for="consent-review">Review by</label><input id="consent-review" type="date" bind:value={form.reviewDue}/></div>
    {/if}
  </div>{#if formError}<div class="form-error" role="alert">{formError}</div>{/if}</div><div class="modal-foot"><span class="modal-spacer"></span><button type="button" class="btn btn-outline" on:click={closeEditor}>Cancel</button><button type="submit" class="btn btn-primary">Save {editor === 'report' ? 'draft' : 'record'}</button></div></form></div>
{/if}
