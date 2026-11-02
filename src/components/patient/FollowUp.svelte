<script>
  import Icon from '../Icon.svelte';
  import FormList from '../FormList.svelte';
  import { db, session, commit } from '../../lib/store.svelte.js';
  import { completeTask } from '../../lib/tasks.js';
  import { staffName } from '../../lib/people.js';
  import { fmtDay, fmtDateTime, todayISO } from '../../lib/dates.js';
  import { say } from '../../lib/ui.svelte.js';

  let { patient, onform } = $props();
  const me = session.staffId;
  const today = todayISO(session.now);
  const calls = $derived(db.tasks.filter(task => task.kind === 'followup-call' && task.patientId === patient.id).sort((a, b) => a.due.localeCompare(b.due)));
</script>

{#if patient.status !== 'Discharged'}
  <div class="panel empty"><strong>Follow-up starts after discharge</strong>Calls at one week, one month and three months are scheduled for Melyssa when the discharge plan is filed.</div>
{:else}
  <p class="muted" style="margin-bottom: 14px">A wellbeing check, not a therapy call. Anything concerning goes to the Clinical Director the same day.</p>
  <section class="panel" style="margin-bottom: 18px">
    <div class="panel-head"><h3>Scheduled calls</h3><span class="faint" style="font-size: 13px">Preference: {patient.commPreference}</span></div>
    <ul class="list">
      {#each calls as task (task.id)}
        <li>
          <Icon name={task.status === 'done' ? 'check-circle' : 'circle'} />
          <div class="grow"><div class="title">{task.title}</div><div class="sub">{task.status === 'done' ? `Made by ${staffName(task.doneBy)}, ${fmtDateTime(task.doneAt)}` : `Due ${fmtDay(task.due)}`}</div></div>
          {#if task.status === 'open'}
            {#if task.due < today}<span class="pill urgent">Overdue</span>{:else if task.due === today}<span class="pill warn">Today</span>{/if}
            {#if me === 'melyssa'}<button class="btn sm" onclick={() => { commit(state => completeTask(state, task.id, me)); say('Call recorded. Log the outcome below.'); }}>Call made</button>{/if}
          {/if}
        </li>
      {/each}
    </ul>
  </section>
  <FormList {patient} formIds={['aftercare']} onopen={(formId, entryId) => onform(formId, entryId)} />
{/if}
