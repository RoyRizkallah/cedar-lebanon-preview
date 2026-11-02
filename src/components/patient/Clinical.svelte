<script>
  import Icon from '../Icon.svelte';
  import FormList from '../FormList.svelte';
  import WeekSummary from '../WeekSummary.svelte';
  import CaseReport from '../CaseReport.svelte';
  import { db, session, commit } from '../../lib/store.svelte.js';
  import { riskLevel, reviewRisk } from '../../lib/forms/engine.js';
  import { staffName } from '../../lib/people.js';
  import { fmtDateTime } from '../../lib/dates.js';
  import { say } from '../../lib/ui.svelte.js';

  let { patient, onform } = $props();
  const me = session.staffId;
  const canReview = ['clinical-director', 'nabila'].includes(me);
  const risk = $derived(riskLevel(db, patient.id));
  let reviewing = $state(false);
  let level = $state('Low');
  let note = $state('');
  let error = $state('');
  let report = $state(false);

  function save() {
    error = '';
    try { commit(state => reviewRisk(state, patient.id, level, note, me)); reviewing = false; note = ''; say(`Risk reviewed to ${level}`); } catch (e) { error = e.message; }
  }
</script>

<div class="row between wrap" style="gap: 10px">
  <p class="confidential" style="margin: 0; flex: 1"><Icon name="lock" size={14} />Clinical records use first name and initial only, and never enter the CRM, the admin file, or family communication.</p>
  <button class="btn" onclick={() => { report = true; }}><Icon name="sparkle" size={16} />Case report</button>
</div>

{#if patient.status === 'Admitted'}<WeekSummary patientId={patient.id} />{/if}

<section class="panel" style="margin: 14px 0 20px">
  <div class="panel-head">
    <h3>Risk</h3>
    {#if canReview && risk}<button class="btn sm" onclick={() => { reviewing = !reviewing; level = risk; }}>Review risk</button>{/if}
  </div>
  <div class="panel-body stack" style="gap: 10px">
    {#if risk}
      <p><span class="pill {risk === 'High' ? 'urgent' : risk === 'Medium' ? 'warn' : 'ok'}">{risk}</span> <span class="muted">Carried into the treatment plan and every session note until reviewed.</span></p>
      {#each (patient.riskReviews || []).slice().reverse() as item, index (index)}
        <p class="faint" style="font-size: 13px">Reviewed to {item.level} by {staffName(item.by)}, {fmtDateTime(item.at)}: {item.note}</p>
      {/each}
    {:else}
      <p class="muted">No intake assessment filed yet.</p>
    {/if}
    {#if reviewing}
      <div class="choices" role="radiogroup" aria-label="Risk level">
        {#each ['Low', 'Medium', 'High'] as option}<label class="choice risk-{option}"><input type="radio" name="risk" value={option} bind:group={level} /><span>{option}</span></label>{/each}
      </div>
      <input class="input" placeholder="Basis for the review" aria-label="Basis for the review" bind:value={note} />
      <div class="row">{#if error}<span class="error">{error}</span>{/if}<button class="btn dark" onclick={save}>Save review</button></div>
    {/if}
  </div>
</section>

<FormList {patient} formIds={['intake', 'plan', 'session', 'group', 'review', 'family', 'discharge']} onopen={(formId, entryId) => onform(formId, entryId)} />

{#if report}<CaseReport patientId={patient.id} onclose={() => { report = false; }} />{/if}
