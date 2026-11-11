<script>
  import Icon from '../components/Icon.svelte';
  import FormView from '../components/FormView.svelte';
  import PatientProfile from './PatientProfile.svelte';
  import { db, session } from '../lib/store.svelte.js';
  import { canDo, visiblePatients, hasRole } from '../lib/people.js';
  const floor = hasRole(session.staffId, 'rsa');
  import { PROGRAMS } from '../lib/pipeline.js';
  import { riskLevel, onWatch, formById } from '../lib/forms/engine.js';
  import { placeLabel } from '../lib/admission.js';
  import { upcomingFor } from '../lib/scheduling.js';
  import { daysBetween, todayISO, fmtDay, fmtDate } from '../lib/dates.js';
  import { go } from '../lib/ui.svelte.js';

  let { args = [] } = $props();
  const me = session.staffId;
  const today = todayISO(session.now);
  const showRisk = canDo(me, 'viewRisk');
  let view = $state('Admitted');
  let query = $state('');
  let program = $state('');
  let risk = $state('');
  let review = $state(args[0] === 'review' && args[1] ? { formId: 'review', entryId: args[1] } : null);
  let layout = $state('cards');
  // Clinical staff start the weekly review; Ahmed opens the latest one to read and sign.
  const writesReview = formById('review').owners.includes(me);
  const latestReview = $derived(db.forms.filter(entry => entry.formId === 'review' && entry.status === 'Filed').sort((a, b) => String(b.filedAt).localeCompare(String(a.filedAt)))[0]);

  const rows = $derived(visiblePatients(db, me, { includeDischarged: true })
    .filter(patient => patient.status === view)
    .filter(patient => !query.trim() || `${patient.fullName} ${patient.roomId} ${patient.id}`.toLowerCase().includes(query.trim().toLowerCase()))
    .filter(patient => !program || patient.program === program)
    .map(patient => ({ patient, risk: showRisk ? riskLevel(db, patient.id) : null, next: floor ? null : upcomingFor(db, patient.id, today)[0] }))
    .filter(row => !risk || row.risk === risk)
    .sort((a, b) => (a.patient.roomId || 'zz').localeCompare(b.patient.roomId || 'zz', undefined, { numeric: true }) || a.patient.fullName.localeCompare(b.patient.fullName)));
</script>

{#if args[0] && args[0] !== 'review'}
  {#key args.join('/')}<PatientProfile id={args[0]} tab={args[1] || 'overview'} entry={args[2] || ''} />{/key}
{:else}
  <main class="content">
    <div class="page-head">
      <div><h1>Admitted patients</h1><p>{rows.length} {view === 'Admitted' ? 'in care now' : 'discharged'}{me === 'nabila' || floor ? ', assigned to you' : ''}.</p></div>
      <div class="actions">
        <div class="seg" role="group" aria-label="Status"><button aria-pressed={view === 'Admitted'} onclick={() => { view = 'Admitted'; }}>In care</button><button aria-pressed={view === 'Discharged'} onclick={() => { view = 'Discharged'; }}>Discharged</button></div>
        {#if writesReview}<button class="btn primary" onclick={() => { review = { formId: 'review' }; }}><Icon name="users" size={16} />Weekly case review</button>
        {:else if canDo(me, 'caseReview') && latestReview}<button class="btn" onclick={() => { review = { formId: 'review', entryId: latestReview.id }; }}><Icon name="users" size={16} />Latest case review</button>{/if}
      </div>
    </div>

    <div class="toolbar">
      <input class="input" type="search" placeholder="Search name or room" aria-label="Search patients" bind:value={query} />
      <select class="select" aria-label="Program" bind:value={program}><option value="">Any program</option>{#each PROGRAMS as name}<option>{name}</option>{/each}</select>
      {#if showRisk}<select class="select" aria-label="Risk" bind:value={risk}><option value="">Any risk</option><option>High</option><option>Medium</option><option>Low</option></select>{/if}
      <div class="seg" role="group" aria-label="Layout" style="margin-left: auto"><button aria-pressed={layout === 'cards'} onclick={() => { layout = 'cards'; }}>Cards</button><button aria-pressed={layout === 'table'} onclick={() => { layout = 'table'; }}>Table</button></div>
    </div>

    {#if layout === 'cards'}
      <div class="people">
        {#each rows as { patient, risk: level, next } (patient.id)}
          {@const phase = Number(String(patient.phase).slice(0, 1)) || 1}
          <a class="person" href={`#/patients/${patient.id}`} class:risky={level === 'High'}>
            <header>
              <span class="avatar lime big">{patient.fullName.split(' ').map(part => part[0]).slice(0, 2).join('')}</span>
              <div class="grow"><strong>{patient.fullName}</strong><span>{patient.program}{patient.roomId ? `, room ${patient.roomId}` : ''}</span></div>
              {#if level}<span class="pill {level === 'High' ? 'urgent' : level === 'Medium' ? 'warn' : 'ok'}">{level}</span>
              {:else if !showRisk && onWatch(db, patient.id)}<span class="pill warn" title="Extra care: ask the clinical team before leave or changes">On watch</span>{/if}
            </header>
            {#if !floor && view === 'Admitted'}
              <div class="phases" aria-label={`Phase ${phase} of 4`}>{#each [1, 2, 3, 4] as n}<i class:done={n < phase} class:now={n === phase}></i>{/each}</div>
              <p class="phase-name">{patient.phase}</p>
            {/if}
            <footer>
              <div><strong class="num">{view === 'Admitted' ? daysBetween(patient.admittedAt, today) + 1 : fmtDate(patient.dischargedAt)}</strong><span>{view === 'Admitted' ? 'Day of stay' : 'Discharged'}</span></div>
              {#if !floor}<div class="next"><strong>{next ? (next.service === 'Group' ? next.title : next.service) : 'Nothing booked'}</strong><span>{next ? `${fmtDay(next.date)}, ${next.start}` : 'Next appointment'}</span></div>{/if}
            </footer>
          </a>
        {:else}
          <div class="panel empty" style="grid-column: 1 / -1"><strong>No patients match</strong>Clear the search or filters.</div>
        {/each}
      </div>
    {:else}
    <div class="panel table-wrap">
      <table class="table cards">
        <thead><tr><th>Patient</th><th>Program</th><th>Room</th><th>{view === 'Admitted' ? 'Day' : 'Discharged'}</th>{#if !floor}<th>Phase</th><th>Next</th>{/if}{#if showRisk}<th>Risk</th>{/if}</tr></thead>
        <tbody>
          {#each rows as { patient, risk: level, next } (patient.id)}
            <tr class="clickable" onclick={() => go(`patients/${patient.id}`)}>
              <td class="lead-cell"><a href={`#/patients/${patient.id}`} style="color: var(--ink); font-weight: 600">{patient.fullName}</a></td>
              <td data-label="Program">{patient.program}</td>
              <td data-label="Room">{patient.roomId ? placeLabel(db, patient.roomId, patient.bed) : '—'}</td>
              <td data-label={view === 'Admitted' ? 'Day' : 'Discharged'} class="num">{view === 'Admitted' ? daysBetween(patient.admittedAt, today) + 1 : fmtDate(patient.dischargedAt)}</td>
              {#if !floor}
                <td data-label="Phase">{patient.phase}</td>
                <td data-label="Next">{next ? `${next.service === 'Group' ? next.title : next.service}, ${fmtDay(next.date)} ${next.start}` : '—'}</td>
              {/if}
              {#if showRisk}<td data-label="Risk">{#if level}<span class="pill {level === 'High' ? 'urgent' : level === 'Medium' ? 'warn' : 'ok'}">{level}</span>{:else}<span class="faint">—</span>{/if}</td>{/if}
            </tr>
          {:else}
            <tr><td colspan="7"><div class="empty"><strong>No patients match</strong>Clear the search or filters.</div></td></tr>
          {/each}
        </tbody>
      </table>
    </div>
    {/if}
  </main>
{/if}

{#if review}<FormView {...review} onclose={() => { review = null; }} />{/if}

<style>
  .people { display: grid; grid-template-columns: repeat(auto-fill, minmax(290px, 1fr)); gap: 11px; }
  .person { display: flex; flex-direction: column; gap: 10px; padding: 14px; border-radius: 18px; background: var(--paper); box-shadow: var(--shadow-1); color: inherit; text-decoration: none; transition: box-shadow 0.15s, transform 0.15s; }
  .person:hover { box-shadow: var(--shadow-2); transform: translateY(-2px); text-decoration: none; }
  .person.risky { box-shadow: inset 0 0 0 2px var(--urgent-soft), var(--shadow-1); }
  .person header { display: flex; align-items: center; gap: 8px; }
  .person header strong { display: block; font-size: 16px; font-weight: 800; letter-spacing: -0.01em; }
  .person header span:not(.pill):not(.avatar) { font-size: 13px; color: var(--text-2); }
  .avatar.big { width: 48px; height: 48px; font-size: 15px; }
  .phases { display: grid; grid-template-columns: repeat(4, 1fr); gap: 5px; }
  .phases i { height: 6px; border-radius: 6px; background: var(--sunk); }
  .phases i.done { background: var(--strong); }
  .phases i.now { background: var(--lime); box-shadow: 0 0 8px rgb(var(--lime-rgb) / 0.5); }
  .phase-name { font-size: 12.5px; font-weight: 700; color: var(--text-2); margin-top: -6px; }
  .person footer { display: grid; grid-template-columns: auto 1fr; gap: 10px; padding-top: 10px; border-top: 1px solid var(--line); }
  .person footer strong { display: block; font-size: 20px; font-weight: 800; letter-spacing: -0.02em; line-height: 1.15; }
  .person footer .next strong { font-size: 13.5px; }
  .person footer span { font-size: 12px; color: var(--text-3); font-weight: 600; }
  .person footer .next { border-left: 1px solid var(--line); padding-left: 10px; min-width: 0; }
</style>
