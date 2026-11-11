<script>
  import Icon from './Icon.svelte';
  import InquiryFields from './InquiryFields.svelte';
  import ChannelBadge from './ChannelBadge.svelte';
  import { db, session, commit } from '../lib/store.svelte.js';
  import { assessmentFor, assessorName, drugLabel, markNoShow, startFollowUp, FOLLOW_UP_DAYS, updateInquiry, declineInquiry, reopenInquiry, logCall, sendClarification, clarificationChannel, noPhone, money, timeInStageHours, reviewDue, CALL_OUTCOMES } from '../lib/pipeline.js';
  import { completeTask } from '../lib/tasks.js';
  import AssessmentDialog from './AssessmentDialog.svelte';
  import { staffName, canDo } from '../lib/people.js';
  import { fmtDateTime, fmtDay, fmtDuration, todayISO } from '../lib/dates.js';
  import { dialogFocus } from '../lib/dialogFocus.js';
  import { say } from '../lib/ui.svelte.js';

  let { id, onclose } = $props();

  const inquiry = $derived(db.inquiries.find(item => item.id === id));
  const original = db.inquiries.find(item => item.id === id);
  let fields = $state(original ? structuredClone($state.snapshot(original)) : {});
  let call = $state({ outcome: 'Reached', notes: '' });
  let declining = $state(false);
  let following = $state(null);
  let assessing = $state(false);
  const assessment = $derived(assessmentFor(db, id));
  let reason = $state('');
  let error = $state('');
  const me = session.staffId;
  const editable = canDo(me, 'editInquiry') && !original?.outcome;
  const tasks = $derived(db.tasks.filter(task => task.inquiryId === id && task.kind === 'inquiry-followup'));
  const lead = $derived(inquiry?.leadId && db.leads.find(item => item.id === inquiry.leadId));
  const onboarding = $derived(db.onboardings.find(item => item.inquiryId === id));
  const today = todayISO(session.now);

  function run(action, message) {
    error = '';
    try { commit(action); if (message) say(message); return true; } catch (e) { error = e.message; return false; }
  }
  const save = () => run(state => updateInquiry(state, id, $state.snapshot(fields), me), 'Inquiry saved');
  const addCall = () => { if (run(state => logCall(state, id, $state.snapshot(call), me), 'Call logged')) call = { outcome: 'Reached', notes: '' }; };
</script>

<div class="scrim" onclick={onclose} aria-hidden="true"></div>
<section class="drawer wide" use:dialogFocus={{ onClose: onclose }}>
  {#if !inquiry}
    <div class="drawer-body"><div class="empty"><strong>Inquiry not found</strong></div></div>
  {:else}
    <header class="drawer-head">
      <div class="grow">
        <div class="row wrap" style="gap: 8px; margin-bottom: 4px">
          <span class="pill {inquiry.outcome === 'Declined' ? '' : inquiry.outcome ? 'ok' : 'dark'}">{inquiry.outcome || inquiry.stage}</span>
          {#if inquiry.urgency === 'Urgent'}<span class="pill urgent">Urgent</span>{/if}
          {#if reviewDue(inquiry, session.now)}<span class="pill warn">Review due</span>{/if}
          <span class="faint" style="font-size: 12px">{inquiry.id}, in {inquiry.stage} for {fmtDuration(timeInStageHours(inquiry, session.now))}</span>
        </div>
        <h2>{inquiry.name}</h2>
        {#if inquiry.relationship && inquiry.relationship !== 'Self'}<p class="via">Inquiry by {inquiry.callerName || 'a family member'}, {inquiry.relationship.toLowerCase()}</p>{/if}
        <p class="muted" style="margin-top: 2px">{inquiry.program}{drugLabel(inquiry) ? `, ${drugLabel(inquiry)}` : ''}{inquiry.yearsOfUse !== '' ? `, ${inquiry.yearsOfUse} years` : ''}. Potential {money(inquiry.potentialRevenue)}. Contact: {staffName(inquiry.contactPerson)}.</p>      </div>
      <button class="btn ghost icon" aria-label="Close" data-autofocus onclick={onclose}><Icon name="close" /></button>
    </header>

    <div class="drawer-body stack" style="gap: 22px">
      {#if noPhone(inquiry)}
        <p class="notice warn"><Icon name="phone-off" size={16} />Not comfortable talking on the phone. Message on {clarificationChannel(inquiry)} instead of calling.</p>
      {/if}

      <div class="row wrap">
        {#if inquiry.phone && !noPhone(inquiry)}<a class="btn" href={`tel:${inquiry.phone.replace(/\s/g, '')}`}><Icon name="phone" size={16} />Call {inquiry.phone}</a>{/if}
        {#if editable}
          <button class="btn" onclick={() => run(state => sendClarification(state, id, me), `Clarification reply queued on ${clarificationChannel(inquiry)}`)} title="Sends the standard reply and keeps the inquiry where it is">
            <Icon name="send" size={15} />Answer &amp; keep
          </button>
          {#if inquiry.stage !== 'Agreement'}<button class="btn" onclick={() => { assessing = true; }}><Icon name="calendar" size={15} />{assessment ? 'Rebook assessment' : 'Book assessment'}</button>{/if}
          <button class="btn" onclick={() => { following = following ? null : { days: FOLLOW_UP_DAYS, note: '' }; }}><Icon name="clock" size={15} />Follow up later</button>
          <button class="btn ghost danger" onclick={() => { declining = !declining; }}>Decline</button>
        {/if}
        {#if inquiry.outcome === 'Declined' && canDo(me, 'editInquiry')}<button class="btn" onclick={() => run(state => reopenInquiry(state, id, me), 'Inquiry reopened')}>Reopen</button>{/if}
        {#if onboarding}<a class="btn" href="#/admissions">Open admission</a>{/if}
        {#if lead}<a class="btn ghost" href={`#/leads/${lead.id}`}><ChannelBadge channel={lead.channel} small />Conversation</a>{/if}
      </div>

      {#if following}
        <form class="panel panel-body stack" style="gap: 10px; padding-top: 18px" onsubmit={event => { event.preventDefault(); if (run(state => startFollowUp(state, id, $state.snapshot(following), me), `Moved to Follow-ups. Reminder in ${following.days} days.`)) { following = null; onclose(); } }}>
          <strong>Not ready for an assessment yet</strong>
          <div class="grid-2"><label class="field"><span>Remind me in <span class="hint">days</span></span><input class="input" type="number" min="1" max="60" bind:value={following.days} /></label><label class="field"><span>Why, or what to ask next time</span><input class="input" bind:value={following.note} /></label></div>
          <div class="row"><button class="btn dark" type="submit">Move to follow-up</button><button class="btn ghost" type="button" onclick={() => { following = null; }}>Cancel</button></div>
        </form>
      {/if}
      {#if assessment?.status === 'Booked' && editable}<button class="btn sm ghost" onclick={() => run(state => markNoShow(state, id, me), 'Marked as no-show. Rebook when you reach them.')}>They didn't come: mark no-show</button>{/if}
      {#if assessment}<p class="notice ok"><Icon name="calendar" size={15} />Assessment {assessment.status === 'Completed' ? 'done' : 'booked'}: {fmtDay(assessment.date)} at {assessment.start} with {assessorName(assessment)}, {(assessment.mode || 'In person').toLowerCase()}.</p>
      {:else if inquiry.stage === 'Assessment'}<p class="notice warn"><Icon name="calendar" size={15} />In Assessment, but nothing is booked yet.</p>{/if}
      {#if inquiry.followUp}<p class="notice warn"><Icon name="clock" size={15} />In follow-up until {inquiry.followUp.due}. {inquiry.followUp.note}</p>{/if}
      {#if declining}
        <form class="panel panel-body stack" style="gap: 10px" onsubmit={event => { event.preventDefault(); if (run(state => declineInquiry(state, id, reason, me), 'Inquiry closed as declined')) onclose(); }}>
          <label class="field"><span>Why is this inquiry closing?</span><input class="input" bind:value={reason} placeholder="For example: chose another center" /></label>
          <p class="faint" style="font-size: 12px">Its follow-up calls are cancelled.</p>
          <div class="row"><button class="btn danger" type="submit">Close as declined</button><button class="btn ghost" type="button" onclick={() => { declining = false; }}>Cancel</button></div>
        </form>
      {/if}
      {#if inquiry.declineReason}<p class="notice">Declined: {inquiry.declineReason}</p>{/if}
      {#if error}<p class="error" role="alert">{error}</p>{/if}

      <section>
        <div class="section-title"><h2>Calls</h2><span class="faint">{inquiry.calls.length} logged</span></div>
        {#if editable}
          <form class="panel panel-body stack" style="gap: 10px; margin-bottom: 10px" onsubmit={event => { event.preventDefault(); addCall(); }}>
            <div class="choices" role="radiogroup" aria-label="Call outcome">
              {#each CALL_OUTCOMES as outcome}<label class="choice"><input type="radio" name="outcome" value={outcome} bind:group={call.outcome} /><span>{outcome}</span></label>{/each}
            </div>
            <div class="row"><input class="input" placeholder="Notes from the call" aria-label="Call notes" bind:value={call.notes} /><button class="btn dark" type="submit">Log call</button></div>
            <p class="faint" style="font-size: 12px">Logged as called by {staffName(me)}, {fmtDateTime(session.now)}.</p>
          </form>
        {/if}
        <ul class="list panel">
          {#each [...inquiry.calls].reverse() as entry (entry.id)}
            <li><span class="avatar sm">{staffName(entry.by).slice(0, 1)}</span><div class="grow"><div class="title">{entry.outcome}{entry.notes ? `: ${entry.notes}` : ''}</div><div class="sub">Called by {staffName(entry.by)}, {fmtDateTime(entry.at)}</div></div></li>
          {:else}
            <li class="faint">No calls yet.</li>
          {/each}
        </ul>
      </section>

      <section>
        <div class="section-title"><h2>Follow-up calls</h2><span class="faint">Stop automatically on admission or decline</span></div>
        <ul class="list panel">
          {#each tasks as task (task.id)}
            <li>
              <Icon name={task.status === 'done' ? 'check-circle' : 'circle'} />
              <div class="grow"><div class="title">{task.title}</div><div class="sub">{task.status === 'done' ? `Done by ${staffName(task.doneBy)}, ${fmtDateTime(task.doneAt)}` : task.status === 'cancelled' ? 'Cancelled' : `Due ${fmtDay(task.due)}, ${staffName(task.owner)}`}</div></div>
              {#if task.status === 'open'}
                {#if task.due < today}<span class="pill urgent">Overdue</span>{:else if task.due === today}<span class="pill warn">Today</span>{/if}
                {#if editable}<button class="btn sm" onclick={() => run(state => completeTask(state, task.id, me), 'Follow-up recorded')}>Mark done</button>{/if}
              {/if}
            </li>
          {/each}
        </ul>
      </section>

      <section>
        <div class="section-title"><h2>Details</h2></div>
        <InquiryFields {fields} disabled={!editable} />
        {#if editable}<div class="row" style="margin-top: 14px"><button class="btn primary" onclick={save}>Save changes</button></div>{/if}
      </section>

      <section>
        <div class="section-title"><h2>Stage history</h2></div>
        <ol class="timeline">
          {#each inquiry.stageHistory as step, index (index)}
            <li><strong>{step.stage}</strong><span class="faint">{fmtDateTime(step.at)}, {staffName(step.by)}</span></li>
          {/each}
          {#if inquiry.outcome}<li><strong>{inquiry.outcome}</strong><span class="faint">{fmtDateTime(inquiry.closedAt)}</span></li>{/if}
        </ol>
      </section>
    </div>
  {/if}
</section>

{#if assessing}<AssessmentDialog {id} onclose={() => { assessing = false; }} />{/if}

<style>
  .via { font-size: 13px; font-weight: 700; color: var(--moss); margin-top: 2px; }
  .timeline { list-style: none; margin: 0; padding: 0 0 0 14px; border-left: 2px solid var(--line); display: flex; flex-direction: column; gap: 12px; }
  .timeline li { position: relative; display: flex; flex-direction: column; font-size: 13px; }
  .timeline li::before { content: ""; position: absolute; left: -20px; top: 5px; width: 10px; height: 10px; border-radius: 50%; background: var(--paper); border: 2px solid var(--ink); }
  .timeline li:last-child::before { background: var(--lime); border-color: var(--ink); }
</style>
