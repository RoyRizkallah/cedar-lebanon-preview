<script>
  import Icon from './Icon.svelte';
  import './rsa.css';
  import { iso, prettyDate } from './data.js';

  export let data;
  export let staff;
  export let page;
  export let focusPatient = '';
  export let onSaveCheckin = () => {};
  export let onNavigate = () => {};
  export let onOpenCheckin = () => {};
  export let onOpenPatient = () => {};

  let search = '';
  let statusFilter = 'All statuses';
  let selectedPatient = '';
  let status = 'Settled';
  let note = '';
  let followUp = '';
  let feedback = '';

  $: today = iso(0);
  $: residents = (data?.patients || []).filter(patient => patient.rsa === staff.assignment && patient.status !== 'Archived' && patient.program === 'Residential');
  $: selectedPatient = focusPatient && residents.some(patient => patient.id === focusPatient) ? focusPatient : '';
  $: checkins = (data?.supportCheckins || []).filter(item => residents.some(patient => patient.id === item.patientId)).sort((a, b) => `${b.date}${b.id}`.localeCompare(`${a.date}${a.id}`));
  $: checkedInToday = new Set(checkins.filter(item => item.date === today).map(item => item.patientId));
  $: dueToday = residents.filter(patient => !checkedInToday.has(patient.id));
  $: completedToday = residents.length - dueToday.length;
  $: visibleResidents = residents.filter(patient => {
    const query = search.trim().toLowerCase();
    return !query || [patient.name, patient.id, patient.room, patient.program].some(value => String(value || '').toLowerCase().includes(query));
  });
  $: visibleCheckins = checkins.filter(item => {
    const patient = residents.find(person => person.id === item.patientId);
    const query = search.trim().toLowerCase();
    const matchesQuery = !query || [item.patientId, patient?.name, item.status, item.note, item.followUp, item.recordedBy].some(value => String(value || '').toLowerCase().includes(query));
    return matchesQuery && (statusFilter === 'All statuses' || item.status === statusFilter);
  });
  $: selectedPatientId = selectedPatient || dueToday[0]?.id || residents[0]?.id || '';

  function saveCheckin(event) {
    event.preventDefault();
    if (!selectedPatientId) return;
    const resident = residents.find(patient => patient.id === selectedPatientId);
    if (!resident) return;
    if (onSaveCheckin({ patientId: selectedPatientId, status, note: note.trim(), followUp: followUp.trim() }) !== true) return;
    feedback = `Check-in saved for ${resident.name}.`;
    note = '';
    followUp = '';
    selectedPatient = '';
    setTimeout(() => feedback = '', 3500);
  }

  function openResident(patient) {
    onOpenPatient(patient.id);
  }
</script>

{#if page === 'overview'}
  <section class="rsa-page" aria-labelledby="rsa-overview-title">
    <div class="page-intro rsa-intro">
      <div><div class="eyebrow">RESIDENT SUPPORT / {staff.name}</div><h1 id="rsa-overview-title" class="page-title">A steady day, <span class="serif">one check-in at a time.</span></h1><p class="page-desc">Your assigned residents, daily check-ins, and practical follow-through in one calm workspace.</p></div>
      <div class="intro-actions"><button class="btn btn-primary" on:click={() => onNavigate('checkins')}><Icon name="plus" size={15}/> Record a check-in</button></div>
    </div>

    <section class="rsa-welcome">
      <div class="rsa-welcome-copy"><span class="rsa-kicker">YOUR SUPPORT BOARD · {prettyDate(today)}</span><h2>Small moments of support add up.</h2><p>Keep each resident’s daily check-in clear and practical. Record what happened and who needs a follow-up.</p><button class="rsa-welcome-link" on:click={() => onNavigate('caseload')}>View my residents <Icon name="arrow" size={15}/></button></div>
      <div class="rsa-welcome-mark"><Icon name="heart" size={48} stroke={1.25}/><span>{completedToday}<small>of {residents.length} checked in</small></span></div>
    </section>

    <div class="rsa-stat-grid">
      <button class="rsa-stat-card" on:click={() => onNavigate('caseload')}><span>Assigned residents</span><strong>{residents.length}</strong><small>Active in your caseload</small><Icon name="users" size={17}/></button>
      <button class="rsa-stat-card is-due" on:click={() => onNavigate('checkins')}><span>Check-ins to complete</span><strong>{dueToday.length}</strong><small>For today</small><Icon name="clock" size={17}/></button>
      <button class="rsa-stat-card" on:click={() => onNavigate('checkins')}><span>Recorded today</span><strong>{completedToday}</strong><small>Across your caseload</small><Icon name="check" size={17}/></button>
    </div>

    <div class="rsa-columns">
      <section class="data-card rsa-panel">
        <div class="rsa-panel-head"><div><span class="rsa-panel-label">TODAY’S SUPPORT</span><h2>Check-in list</h2><p>One brief status for each assigned resident.</p></div><button class="text-link" on:click={() => onNavigate('checkins')}>Open check-ins <Icon name="arrow" size={13}/></button></div>
        <div class="rsa-resident-list">
          {#each residents.slice(0, 6) as patient}
            {@const latest = checkins.find(item => item.patientId === patient.id && item.date === today)}
          <article class="rsa-resident-row"><span class="rsa-avatar">{patient.name.split(/\s+/).map(part => part[0]).slice(0, 2).join('')}</span><span class="rsa-resident-main"><strong>{patient.name}</strong><small>{patient.id} <i>·</i> Room {patient.room || 'to confirm'}</small></span>{#if latest}<span class="rsa-status-tag" class:soft={latest.status !== 'Settled'} class:due={latest.status === 'Needs follow-up'}>{latest.status}</span>{:else}<span class="rsa-status-tag due">To check in</span>{/if}<button class="rsa-icon-button" aria-label={'Focus ' + patient.name + ' in caseload'} on:click={() => openResident(patient)}><Icon name="chevron" size={15}/></button></article>
          {:else}
            <div class="rsa-empty"><span><Icon name="users" size={20}/></span><strong>No residents assigned yet</strong><small>Assigned residents will appear here when the demo caseload is set up.</small></div>
          {/each}
        </div>
      </section>

      <aside class="rsa-side-stack">
        <section class="data-card rsa-panel rsa-priority-panel"><div class="rsa-panel-head"><div><span class="rsa-panel-label">NEEDS A MOMENT</span><h2>Still to check in</h2><p>These residents have no entry for today.</p></div><span class="rsa-count-pill">{dueToday.length}</span></div>
          <div class="rsa-due-list">{#each dueToday.slice(0, 4) as patient}<button class="rsa-due-row" on:click={() => onOpenCheckin(patient.id)}><span class="rsa-avatar small">{patient.name.split(/\s+/).map(part => part[0]).slice(0, 2).join('')}</span><span><strong>{patient.name}</strong><small>Room {patient.room || 'to confirm'}</small></span><Icon name="arrow" size={14}/></button>{:else}<p class="rsa-clear-note"><Icon name="check" size={15}/> All assigned residents have a check-in today.</p>{/each}</div>
          {#if dueToday.length > 4}<button class="text-link rsa-panel-foot" on:click={() => onNavigate('checkins')}>See all {dueToday.length} residents</button>{/if}
        </section>
        <section class="rsa-guidance"><span class="rsa-guidance-icon"><Icon name="shield" size={18}/></span><div><strong>Keep notes practical</strong><p>Record observable support needs and next steps. Clinical decisions belong with the care team.</p></div></section>
      </aside>
    </div>
  </section>
{:else if page === 'caseload'}
  <section class="rsa-page" aria-labelledby="rsa-caseload-title">
    <div class="page-intro rsa-intro"><div><div class="eyebrow">RESIDENT SUPPORT / ASSIGNED CASELOAD</div><h1 id="rsa-caseload-title" class="page-title">Your residents, <span class="serif">in view.</span></h1><p class="page-desc">A focused list of active residents assigned to {staff.shortName}. Open a profile when the team needs to coordinate support.</p></div><div class="intro-actions"><button class="btn btn-primary" on:click={() => onNavigate('checkins')}><Icon name="check" size={15}/> Daily check-ins</button></div></div>
    <section class="data-card rsa-list-card"><div class="rsa-list-toolbar"><div><span class="rsa-panel-label">ACTIVE CASELOAD</span><strong>{visibleResidents.length} residents</strong></div><label class="rsa-search"><Icon name="search" size={16}/><input type="search" bind:value={search} placeholder="Find a resident or room" aria-label="Find a resident or room"/><kbd>⌘ K</kbd></label></div>
      <div class="rsa-caseload-grid">{#each visibleResidents as patient}
        {@const latest = checkins.find(item => item.patientId === patient.id)}
        {@const todayEntry = checkins.find(item => item.patientId === patient.id && item.date === today)}
        <article class="rsa-caseload-card"><div class="rsa-card-top"><span class="rsa-avatar large">{patient.name.split(/\s+/).map(part => part[0]).slice(0, 2).join('')}</span><span class="rsa-status-tag" class:due={!todayEntry || todayEntry.status === 'Needs follow-up'} class:soft={!!todayEntry && todayEntry.status === 'Request noted'}>{todayEntry ? todayEntry.status : 'Check-in due'}</span></div><h2>{patient.name}</h2><p>{patient.id} <i>·</i> {patient.program || 'Residential'} <i>·</i> Room {patient.room || 'to confirm'}</p><div class="rsa-card-detail"><span><small>Coordinator</small><strong>{patient.coordinator || 'To confirm'}</strong></span><span><small>Last check-in</small><strong>{latest ? prettyDate(latest.date) : 'No history yet'}</strong></span></div><div class="rsa-card-actions"><button class="btn btn-outline btn-tiny" on:click={() => openResident(patient)}>Open wallet</button><button class="btn btn-soft btn-tiny" on:click={() => onOpenCheckin(patient.id)}>Record check-in</button></div></article>
      {:else}<div class="rsa-empty full"><span><Icon name="search" size={20}/></span><strong>{search ? 'No residents match that search' : 'No residents assigned yet'}</strong><small>{search ? 'Try a name, patient reference, or room.' : 'Active residents assigned to your workspace will appear here.'}</small></div>{/each}</div>
    </section>
  </section>
{:else if page === 'checkins'}
  <section class="rsa-page" aria-labelledby="rsa-checkins-title">
    <div class="page-intro rsa-intro"><div><div class="eyebrow">RESIDENT SUPPORT / DAILY LOG</div><h1 id="rsa-checkins-title" class="page-title">Daily check-ins, <span class="serif">kept simple.</span></h1><p class="page-desc">Record a brief status for an assigned resident. Add a follow-up only when another team member needs to act.</p></div><span class="rsa-date-chip"><Icon name="calendar" size={15}/>{prettyDate(today)}</span></div>
    <div class="rsa-checkin-layout">
      <section class="data-card rsa-form-card"><div class="rsa-form-head"><span class="rsa-form-icon"><Icon name="check" size={20}/></span><div><span class="rsa-panel-label">NEW ENTRY</span><h2>Record a resident check-in</h2><p>This creates a dated support note visible in your check-in history.</p></div></div>
        <form class="rsa-checkin-form" on:submit|preventDefault={saveCheckin}>
          <label>Resident<select bind:value={selectedPatientId} required><option value="" disabled>Select assigned resident</option>{#each residents as patient}<option value={patient.id}>{patient.name} · {patient.id}</option>{/each}</select></label>
          <fieldset><legend>How did the check-in go?</legend><div class="rsa-status-picks">{#each ['Settled', 'Needs follow-up', 'Request noted'] as choice}<button type="button" class:active={status === choice} class:attention={choice === 'Needs follow-up'} on:click={() => status = choice}>{#if choice === 'Settled'}<Icon name="check" size={14}/>{:else if choice === 'Needs follow-up'}<Icon name="clock" size={14}/>{:else}<Icon name="inbox" size={14}/>{/if}{choice}</button>{/each}</div></fieldset>
          <label>Brief support note <span class="rsa-optional">Required</span><textarea bind:value={note} rows="3" minlength="8" maxlength="500" required placeholder="A practical observation or support provided today"></textarea><small class="rsa-field-hint">Write at least 8 characters. Keep it factual and useful for the next handoff.</small></label>
          <label>Follow-up for the team <span class="rsa-optional">Optional</span><input bind:value={followUp} maxlength="180" placeholder="e.g. Ask coordinator to confirm the appointment time"/></label>
          {#if feedback}<p class="rsa-feedback" role="status"><Icon name="check" size={15}/>{feedback}</p>{/if}
          <div class="rsa-form-actions"><span>Saved with today’s date and your staff name.</span><button type="submit" class="btn btn-primary" disabled={!selectedPatientId}><Icon name="check" size={15}/> Save check-in</button></div>
        </form>
      </section>
      <aside class="rsa-checkin-aside"><section class="rsa-today-card"><span class="rsa-panel-label">TODAY’S COVERAGE</span><strong>{completedToday}<small> / {residents.length}</small></strong><p>assigned residents checked in</p><div class="rsa-progress"><span style={`width:${residents.length ? (completedToday / residents.length) * 100 : 0}%`}></span></div><div class="rsa-progress-caption"><span>Completed</span><span>{dueToday.length} remaining</span></div></section><section class="rsa-checkin-tip"><Icon name="sparkle" size={17}/><div><strong>Short and useful</strong><p>A check-in is a continuity note, not a treatment note. Escalate immediate concerns through Cedar’s normal team process.</p></div></section></aside>
    </div>
    <section class="data-card rsa-history-card"><div class="rsa-history-head"><div><span class="rsa-panel-label">RECENT ACTIVITY</span><h2>Check-in history</h2><p>Entries for your current assigned residents.</p></div><div class="rsa-history-filters"><label class="rsa-search compact"><Icon name="search" size={16}/><input type="search" bind:value={search} placeholder="Search history" aria-label="Search check-in history"/></label><select bind:value={statusFilter} aria-label="Filter check-ins by status"><option>All statuses</option><option>Settled</option><option>Needs follow-up</option><option>Request noted</option></select></div></div>
      {#if visibleCheckins.length}<div class="rsa-history-list">{#each visibleCheckins as item}
        {@const patient = residents.find(person => person.id === item.patientId)}
        <article class="rsa-history-row"><span class="rsa-history-date"><strong>{new Date(`${item.date}T12:00:00`).getDate()}</strong><small>{new Date(`${item.date}T12:00:00`).toLocaleDateString('en-LB', {month:'short'})}</small></span><span class="rsa-history-person"><strong>{patient?.name || item.patientId}</strong><small>{item.patientId} · {prettyDate(item.date)} · {item.recordedBy || staff.name}</small></span><span class="rsa-status-tag" class:due={item.status === 'Needs follow-up'} class:soft={item.status === 'Request noted'}>{item.status}</span><span class="rsa-history-note">{item.followUp || item.note || 'No additional note recorded'}{#if item.followUp && item.note}<small>{item.note}</small>{/if}</span></article>
      {/each}</div>{:else}<div class="rsa-empty history-empty"><span><Icon name="inbox" size={20}/></span><strong>{checkins.length ? 'No check-ins match these filters' : 'No check-in history yet'}</strong><small>{checkins.length ? 'Clear the search or choose a different status.' : 'The first saved check-in will appear here.'}</small></div>{/if}
    </section>
  </section>
{/if}
