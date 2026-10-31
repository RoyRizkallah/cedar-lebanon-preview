<script>
  import { dialogFocus } from './dialogFocus.js';
  import Icon from './Icon.svelte';
  import { iso, prettyDate } from './data.js';

  export let inquiry;
  export let role;
  export let staff;
  export let onClose = () => {};
  export let onPersist = () => {};
  export let onConvert = () => {};
  export let onOpenPatient = () => {};

  const stages = ['New inquiry', 'Intake review', 'Awaiting decision', 'Arrival planned'];
  const checks = [
    ['firstContact', 'First conversation', 'Record an initial contact and the agreed next step.'],
    ['consent', 'Information sharing', 'Confirm the permission needed for intake coordination.'],
    ['questionnaire', 'Intake questionnaire', 'Check that the required intake information is on file.'],
    ['assessment', 'Staff assessment', 'Record that an authorized team member reviewed suitability.'],
    ['funding', 'Funding arrangement', 'Clarify payer and the administrative next step.']
  ];

  let draft = {};
  let contactGate = 'Phone';
  let activeId = '';
  let message = '';
  $: if (inquiry?.id !== activeId) {
    activeId = inquiry?.id;
    draft = { ...inquiry };
    contactGate = inquiry.preferredContact || 'Phone';
    message = '';
  }
  $: canDecide = role === 'Director' || role === 'Coordinator';
  $: canEdit = canDecide || role === 'Reception';
  $: checklistDone = Object.values(inquiry.checklist || {}).filter(Boolean).length;

  function history(action) {
    inquiry.history = [{ id: `H-${Date.now()}`, date: iso(0), action, by: staff.name }, ...(inquiry.history || [])];
    onPersist(inquiry.id, action);
  }
  function saveDetails() {
    if (!canEdit) return;
    if (!draft.subject?.trim() || !draft.next?.trim()) { message = 'The person reference and next action are required.'; return; }
    if (contactGate === 'Phone' && !draft.contactPhone?.trim()) { message = 'Enter a phone number.'; return; }
    if (contactGate === 'Email' && !draft.contactEmail?.trim()) { message = 'Enter an email address.'; return; }
    const editable = canDecide
      ? ['subject','program','preferredContact','contactPhone','contactEmail','contactNote','location','owner','deskOwner','therapist','next','date','handoff']
      : ['subject','preferredContact','contactPhone','contactEmail','contactNote','location','deskOwner','next','date','handoff'];
    draft.preferredContact = contactGate;
    for (const key of editable) inquiry[key] = typeof draft[key] === 'string' ? draft[key].trim() : draft[key];
    history('Intake details updated');
    message = 'Intake details saved.';
  }
  function toggleCheck(key) {
    if (!canEdit || (role === 'Reception' && !['firstContact','questionnaire'].includes(key))) return;
    inquiry.checklist[key] = !inquiry.checklist[key];
    inquiry.documents = !!inquiry.checklist.questionnaire;
    history(`${checks.find(item => item[0] === key)?.[1]} ${inquiry.checklist[key] ? 'completed' : 'reopened'}`);
  }
  function moveTo(stage) {
    if (!canEdit || stages.indexOf(stage) > (role === 'Reception' ? 1 : 3)) return;
    if (stage === 'Arrival planned' && inquiry.decision !== 'Approved by staff') { message = 'An authorized staff approval is required before planning an arrival.'; return; }
    inquiry.stage = stage;
    history(`Moved to ${stage}`);
    message = '';
  }
  function setDecision(value) {
    if (!canDecide) return;
    if (value === 'Approved by staff' && (!inquiry.checklist.consent || !inquiry.checklist.questionnaire || !inquiry.checklist.assessment)) {
      message = 'Confirm sharing, questionnaire and assessment before recording approval.';
      return;
    }
    inquiry.decision = value;
    history(`Staff decision: ${value}`);
    message = '';
  }
</script>

<div class="admission-overlay" role="presentation" on:click={(event) => { if (event.target === event.currentTarget) onClose(); }}>
  <aside class="admission-drawer" use:dialogFocus={{onClose}} aria-label="Admission file">
    <div class="admission-head"><div><div class="record-kicker">ADMISSION FILE · {inquiry.id}</div><h2>{inquiry.subject}</h2><p>{inquiry.name} · {inquiry.source} referral</p></div><button class="icon-btn" aria-label="Close admission file" on:click={onClose}><Icon name="close"/></button></div>
    <div class="admission-body">
      <div class="admission-stage"><span>JOURNEY STAGE</span><div>{#each stages as stage, index}<button class:active={inquiry.stage === stage} class:passed={stages.indexOf(inquiry.stage) > index} disabled={!canEdit || (role === 'Reception' && index > 1)} on:click={() => moveTo(stage)}><b>0{index+1}</b><small>{stage}</small></button>{/each}</div></div>
      <div class="admission-stats"><div><span>Checklist</span><strong>{checklistDone} / {checks.length}</strong></div><div><span>Decision</span><strong>{inquiry.decision}</strong></div><div><span>Next action</span><strong>{prettyDate(inquiry.date)}</strong></div></div>
      <section class="admission-section"><div class="admission-section-head"><div><span>01 / CONTACT</span><h3>Intake details</h3></div></div><div class="admission-form"><label>Person reference<input bind:value={draft.subject} disabled={!canEdit} placeholder="Fictional alias"/></label><label>Program<select bind:value={draft.program} disabled={!canDecide}><option>Residential</option><option>Outpatient</option></select></label><label>Preferred contact<select bind:value={contactGate} disabled={!canEdit} on:change={() => { draft.preferredContact = contactGate; }}><option>Phone</option><option>Email</option><option>In person</option></select></label><label>Location<input bind:value={draft.location} disabled={!canEdit}/></label>{#if contactGate === 'Phone'}<label class="wide">Phone number<input type="tel" bind:value={draft.contactPhone} disabled={!canEdit} placeholder="+961 71 000 000"/></label>{:else if contactGate === 'Email'}<label class="wide">Email address<input type="email" bind:value={draft.contactEmail} disabled={!canEdit} placeholder="name@example.com"/></label>{:else}<label class="wide">Visit notes<input bind:value={draft.contactNote} disabled={!canEdit} placeholder="Walk-in desk, preferred time"/></label>{/if}<label>Intake coordinator<select bind:value={draft.owner} disabled={!canDecide}><option>Unassigned</option><option>Maya</option><option>Nour</option></select></label><label>Front desk<select bind:value={draft.deskOwner} disabled={!canDecide}><option>Leila</option><option>Karim</option></select></label><label>Assigned therapist<select bind:value={draft.therapist} disabled={!canDecide}><option>Therapist A</option><option>Therapist B</option></select></label><label>Next action date<input type="date" bind:value={draft.date} disabled={!canEdit}/></label><label class="wide">Next action<input bind:value={draft.next} disabled={!canEdit}/></label><label class="wide">Handoff note<textarea bind:value={draft.handoff} disabled={!canEdit}></textarea></label></div>{#if canEdit}<button class="btn btn-primary btn-tiny" on:click={saveDetails}>Save intake details</button>{/if}</section>
      <section class="admission-section"><div class="admission-section-head"><div><span>02 / READINESS</span><h3>Intake checklist</h3></div><small>{checklistDone} completed</small></div><div class="admission-checklist">{#each checks as [key,label,description]}<button class:done={inquiry.checklist[key]} disabled={!canEdit || (role === 'Reception' && !['firstContact','questionnaire'].includes(key))} on:click={() => toggleCheck(key)}><span class="admission-checkmark">{inquiry.checklist[key] ? '✓' : ''}</span><span><strong>{label}</strong><small>{description}</small></span></button>{/each}</div></section>
      <section class="admission-section"><div class="admission-section-head"><div><span>03 / STAFF REVIEW</span><h3>Decision & handoff</h3></div></div><p class="admission-explain">An inquiry is not an admission. An authorized person records the decision after reviewing the intake file.</p><div class="admission-decisions">{#each ['Pending review','Approved by staff','Declined by staff'] as option}<button class:active={inquiry.decision === option} disabled={!canDecide} on:click={() => setDecision(option)}>{option}</button>{/each}</div>{#if inquiry.linkedPatient}<button class="btn btn-soft" on:click={() => onOpenPatient(inquiry.linkedPatient)}>Open linked patient record · {inquiry.linkedPatient} <Icon name="arrow" size={14}/></button>{:else if canDecide && inquiry.decision === 'Approved by staff' && inquiry.stage === 'Arrival planned'}<button class="btn btn-primary" on:click={() => onConvert(inquiry)}>Create patient record <Icon name="arrow" size={14}/></button>{/if}</section>
      <section class="admission-section"><div class="admission-section-head"><div><span>04 / HISTORY</span><h3>File activity</h3></div></div><div class="admission-history">{#each inquiry.history || [] as item}<div><span class="record-timeline-dot"></span><span><strong>{item.action}</strong><small>{item.by} · {prettyDate(item.date)}</small></span></div>{/each}</div></section>
    </div>
    {#if message}<div class="admission-message" role="status">{message}</div>{/if}
  </aside>
</div>
