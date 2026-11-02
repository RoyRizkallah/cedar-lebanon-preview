<script>
  import FormList from '../FormList.svelte';
  import { db } from '../../lib/store.svelte.js';
  import { progressSummary } from '../../lib/forms/engine.js';

  let { patient, onform } = $props();
  const summary = $derived(progressSummary(db, patient.id));
</script>

<div class="stats" style="margin-bottom: 18px">
  <div class="stat"><div class="label">Session attendance</div><div class="value">{summary.attendancePct ?? '—'}{#if summary.attendancePct !== null}<small>%</small>{/if}</div></div>
  <div class="stat"><div class="label">Wellbeing average</div><div class="value">{summary.wellbeingAvg ?? '—'}{#if summary.wellbeingAvg !== null}<small>/ 5</small>{/if}</div></div>
  <div class="stat"><div class="label">BMI</div><div class="value">{summary.bmi.at(-1) ?? '—'}</div></div>
  <div class="stat"><div class="label">Injuries</div><div class="value">{summary.injuries}</div></div>
</div>

<FormList {patient} formIds={['clearance', 'attendance', 'injury', 'wellbeing', 'progress', 'nutrition']} onopen={(formId, entryId) => onform(formId, entryId)} />
