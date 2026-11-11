<script>
  // The patient's stay as the treatment plan defines it: four phases, today's position, and the planned discharge.
  import { db, session } from '../lib/store.svelte.js';
  import { daysBetween, todayISO, fmtDate } from '../lib/dates.js';

  let { patient, showPhase = true } = $props();
  const PHASES = ['Stabilization', 'Core treatment', 'Consolidation', 'Discharge prep'];
  const current = $derived(Math.max(0, Number(String(patient.phase).slice(0, 1)) - 1));
  const plan = $derived(db.forms.filter(entry => entry.formId === 'plan' && entry.patientId === patient.id && entry.status === 'Filed').sort((a, b) => String(b.filedAt).localeCompare(String(a.filedAt)))[0]);
  const planned = $derived(plan?.values.plannedDischarge);
  const end = $derived(patient.dischargedAt || todayISO(session.now));
  const day = $derived(daysBetween(patient.admittedAt, end) + 1);
  const total = $derived(planned ? Math.max(day, daysBetween(patient.admittedAt, planned) + 1) : null);
</script>

<div class="journey" aria-label={showPhase ? `Phase ${current + 1} of 4, ${PHASES[current]}` : `Day ${day}`}>
  {#if showPhase}
    <ol>
      {#each PHASES as phase, index (phase)}
        <li class:done={index < current || patient.status === 'Discharged'} class:now={index === current && patient.status !== 'Discharged'}>
          <span class="bar"></span><span class="name">{index + 1} {phase}</span>
        </li>
      {/each}
    </ol>
  {/if}
  <p class="stay"><strong>Day {day}</strong>{#if total}{` of about ${total}`}{/if}{#if planned && patient.status !== 'Discharged'}, planned discharge {fmtDate(planned)}{/if}</p>
</div>

<style>
  .journey { display: flex; flex-direction: column; gap: 8px; }
  ol { list-style: none; margin: 0; padding: 0; display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 6px; }
  li { display: flex; flex-direction: column; gap: 6px; min-width: 0; }
  .bar { height: 6px; border-radius: 999px; background: var(--sunk); }
  .done .bar { background: var(--strong); }
  .now .bar { background: var(--lime); box-shadow: 0 0 10px rgb(var(--lime-rgb) / 0.5); }
  .name { font-size: 12px; color: var(--text-3); font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .now .name { color: var(--text); }
  .stay { font-size: 13px; color: var(--text-2); }
  .stay strong { color: var(--text); }
</style>
