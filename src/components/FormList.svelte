<script>
  import Icon from './Icon.svelte';
  import { db, session } from '../lib/store.svelte.js';
  import { formById } from '../lib/forms/engine.js';
  import { addDays, fmtDate, todayISO } from '../lib/dates.js';
  import { staffName } from '../lib/people.js';

  let { patient, formIds, onopen } = $props();

  // Forms filled once per stay, with the deadline the form itself states.
  const SINGLE = { intake: 3, plan: 7, discharge: null, clearance: null, progress: null, aftercare: null };
  // Group, case review and attendance logs start from the schedule or the patient list, not here.
  const STARTED_ELSEWHERE = ['group', 'review', 'attendance'];
  const today = todayISO(session.now);

  const entriesFor = id => db.forms.filter(entry => entry.formId === id && (entry.patientId === patient.id || entry.patientIds?.includes(patient.id)))
    .sort((a, b) => String(b.filedAt || b.updatedAt).localeCompare(String(a.filedAt || a.updatedAt)));
  const canStart = form => form.owners.includes(session.staffId) && !STARTED_ELSEWHERE.includes(form.id);

  function status(form, entries) {
    const latest = entries[0];
    if (latest?.status === 'Filed') return { text: `${form.living ? 'Updated' : 'Filed'} ${fmtDate(latest.updatedAt || latest.filedAt)} by ${staffName(latest.updatedBy || latest.filedBy)}`, tone: 'ok' };
    if (latest) return { text: `Draft, last saved ${fmtDate(latest.updatedAt)}`, tone: 'warn' };
    const days = SINGLE[form.id];
    if (days && patient.admittedAt) {
      const due = addDays(patient.admittedAt, days);
      return due < today ? { text: `Overdue since ${fmtDate(due)}`, tone: 'urgent' } : { text: `Due by ${fmtDate(due)}`, tone: 'warn' };
    }
    return { text: 'Not started', tone: '' };
  }
</script>

<ul class="list panel form-list">
  {#each formIds as id (id)}
    {@const form = formById(id)}
    {@const entries = entriesFor(id)}
    {@const single = id in SINGLE}
    {@const state = status(form, entries)}
    <li style="align-items: flex-start">
      <span class="num-badge">{form.number}</span>
      <div class="grow">
        <div class="row wrap" style="gap: 8px"><span class="title">{form.title}</span>
          {#if single}<span class="pill {state.tone}">{state.text}</span>{:else if entries.length}<span class="faint" style="font-size: 12.5px">{entries.length} on file</span>{/if}
        </div>
        {#if !single && entries.length}
          <ul class="entries">
            {#each entries.slice(0, 4) as entry (entry.id)}
              <li><button class="linkish" onclick={() => onopen(id, entry.id)}>{fmtDate(entry.values.date || entry.values.weekEnding || entry.createdAt)}{entry.status === 'Draft' ? ' (draft)' : ''}{entry.values.sessionNo ? `, session ${entry.values.sessionNo}` : ''}{entry.values.group ? `, ${entry.values.group}` : ''}{entry.values.severity ? `, ${entry.values.severity.toLowerCase()} ${entry.values.bodyPart || ''}` : ''}</button><span class="faint" style="margin-left: 6px">{staffName(entry.filedBy || entry.createdBy)}</span></li>
            {/each}
            {#if entries.length > 4}<li class="faint">and {entries.length - 4} earlier</li>{/if}
          </ul>
        {:else if !single}
          <p class="faint" style="font-size: 12.5px">{id === 'review' ? 'Started from Weekly case review on the patients list.' : STARTED_ELSEWHERE.includes(id) ? 'Written from the session in the schedule.' : 'None yet.'}</p>
        {/if}
      </div>
      {#if single && entries[0]}
        <button class="btn sm" onclick={() => onopen(id, entries[0].id)}>{entries[0].status === 'Filed' && !form.living ? 'Open' : form.owners.includes(session.staffId) ? 'Continue' : 'Open'}</button>
      {:else if canStart(form) && (!single || !entries.length)}
        <button class="btn sm" onclick={() => onopen(id, null)}><Icon name="plus" size={14} />{single ? 'Start' : 'New'}</button>
      {/if}
    </li>
  {/each}
</ul>

<style>
  .entries { list-style: none; margin: 6px 0 0; padding: 0; display: flex; flex-direction: column; gap: 3px; font-size: 13px; }
  .linkish { border: 0; background: none; padding: 0; color: var(--moss); font-weight: 600; text-align: left; }
  .linkish:hover { text-decoration: underline; }
</style>
