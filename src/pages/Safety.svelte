<script>
  import { onMount } from 'svelte';
  import Icon from '../components/Icon.svelte';
  import { db, session, commit } from '../lib/store.svelte.js';
  import { INCIDENT_TYPES, SEVERITIES, logVisit, startLeave, returnLeave, leaveStatus, reportIncident, reviewIncident } from '../lib/safety.js';
  import { staffName, visiblePatients, canDo } from '../lib/people.js';
  import { incidentsFor } from '../lib/safety.js';
  import { onWatch } from '../lib/forms/engine.js';
  import { fmtDate, fmtDateTime, todayISO } from '../lib/dates.js';
  import { downloadCsv } from '../lib/csv.js';
  import { dialogFocus } from '../lib/dialogFocus.js';
  import { say, takeIntent } from '../lib/ui.svelte.js';

  let { args = [] } = $props();
  const me = session.staffId;
  const today = todayISO(session.now);
  const logsVisits = canDo(me, 'logVisit');
  const reviews = canDo(me, 'reviewIncident');
  const TABS = logsVisits ? [['incidents', 'Incidents'], ['visits', 'Visits'], ['leave', 'Leave']] : [['incidents', 'Incidents']];
  const tab = $derived(TABS.some(([id]) => id === args[0]) ? args[0] : 'incidents');
  let dialog = $state(null);
  let error = $state('');

  const inCare = $derived(visiblePatients(db, me).length ? visiblePatients(db, me) : db.patients.filter(p => p.status === 'Admitted'));
  const name = id => db.patients.find(p => p.id === id)?.fullName || 'No patient involved';
  const incidents = $derived(incidentsFor(db, me).sort((a, b) => (a.status === 'Open' ? 0 : 1) - (b.status === 'Open' ? 0 : 1) || b.date.localeCompare(a.date)));
  const leaves = $derived(db.leaves.map(leave => ({ ...leave, state: leaveStatus(leave, session.now) })).sort((a, b) => (a.returnedAt ? 1 : 0) - (b.returnedAt ? 1 : 0) || b.out.localeCompare(a.out)));
  const out = $derived(leaves.filter(leave => !leave.returnedAt));
  const openIncidents = $derived(incidents.filter(item => item.status === 'Open'));
  // Minutes as "2 h 05 m" for the live leave countdown.
  const clock = minutes => minutes >= 60 ? `${Math.floor(minutes / 60)} h ${String(minutes % 60).padStart(2, '0')} m` : `${minutes} m`;

  const open = kind => {
    error = '';
    const patientId = inCare[0]?.id;
    dialog = kind === 'incident' ? { kind, patientId: '', type: 'Aggression', severity: 'Medium', description: '', actionTaken: '', date: today }
      : kind === 'visit' ? { kind, patientId, visitor: '', relation: '', date: today, start: '', end: '' }
      : kind === 'leave' ? { kind, patientId, out: `${today}T${new Date().toTimeString().slice(0, 5)}`, dueBack: `${today}T18:00`, escort: '', reason: '' }
      : { kind, id: kind.id, outcome: '' };
  };
  onMount(() => { if (takeIntent('incident')) open('incident'); if (takeIntent('visit')) open('visit'); });

  function run(action, message) {
    error = '';
    try { const result = commit(action); if (message) say(message); return result ?? true; } catch (e) { error = e.message; return null; }
  }
  function submit() {
    const d = $state.snapshot(dialog);
    const ok = {
      incident: () => run(state => reportIncident(state, d, me), 'Incident reported to Ahmed and the Clinical Director'),
      visit: () => run(state => logVisit(state, d, me), 'Visit logged'),
      leave: () => run(state => startLeave(state, d, me), 'Leave started'),
      review: () => run(state => reviewIncident(state, d.id, d, me), 'Incident reviewed')
    }[d.kind]();
    if (ok) dialog = null;
  }
  const SEV = { Low: 'ok', Medium: 'warn', High: 'urgent' };
</script>

<main class="content wide">
  <div class="page-head">
    <div><h1>Visits & incidents</h1><p>Anyone can report an incident; Ahmed and the Clinical Director review it. Visits and day leave are logged here.</p></div>
    <div class="actions">
      {#if logsVisits}<button class="btn" onclick={() => open('visit')}><Icon name="users" size={16} />Log visit</button><button class="btn" onclick={() => open('leave')}><Icon name="door" size={16} />Start leave</button>{/if}
      <button class="btn primary" onclick={() => open('incident')}><Icon name="alert" size={16} />Report incident</button>
    </div>
  </div>

  <div class="watchboard" class:has-out={out.length}>
    <div class="watch" class:calm={!openIncidents.length}>
      <span class="eyebrow">Incidents to review</span>
      <div class="big num">{openIncidents.length}</div>
      <p>{openIncidents.length ? `${openIncidents.filter(item => item.severity === 'High').length} high severity. ${incidents.length} on record.` : `Nothing waiting. ${incidents.length} on record.`}</p>
    </div>
    {#if out.length}
      <div class="out-strip">
        {#each out as leave (leave.id)}
          {@const left = Math.round((new Date(leave.dueBack) - session.now) / 60000)}
          <div class="out-card" class:late={leave.state === 'Overdue'}>
            <div class="out-top"><span class="live"></span><span class="out-label">{leave.state === 'Overdue' ? 'Overdue' : 'On leave'}</span><span class="countdown num">{left < 0 ? `${clock(-left)} late` : `${clock(left)} left`}</span></div>
            <strong>{name(leave.patientId)}</strong>
            <span class="out-sub">{leave.state === 'Overdue' ? 'Overdue, was due' : 'Out, due back'} {fmtDateTime(leave.dueBack)}{leave.escort ? `. With ${leave.escort}` : ''}</span>
            {#if logsVisits}<button class="btn sm back" onclick={() => run(state => returnLeave(state, leave.id, me), `${name(leave.patientId)} is back`)}><Icon name="enter" size={14} />Back now</button>{/if}
            {#if leave.state === 'Overdue'}<button class="btn sm ghost danger" onclick={() => { error = ''; dialog = { kind: 'incident', patientId: leave.patientId, type: 'Absconding', severity: 'High', description: `Did not return from leave; was due back ${fmtDateTime(leave.dueBack)}${leave.escort ? `, out with ${leave.escort}` : ''}.`, actionTaken: '', date: today }; }}><Icon name="alert" size={14} />Report absconding</button>{/if}
          </div>
        {/each}
      </div>
    {:else}
      <div class="all-in"><Icon name="home" size={22} /><div><strong>Everyone is in</strong><span>No one is out on day leave right now.</span></div></div>
    {/if}
  </div>

  {#if TABS.length > 1}
    <nav class="tabs" aria-label="Sections" style="margin-bottom: 20px">{#each TABS as [id, label] (id)}<a href={`#/safety/${id}`} aria-current={tab === id ? 'page' : undefined}>{label}</a>{/each}</nav>
  {/if}
  {#if error && !dialog}<p class="error" role="alert" style="margin-bottom: 12px">{error}</p>{/if}

  {#if tab === 'incidents'}
    <div class="toolbar"><button class="btn" style="margin-left: auto" onclick={() => downloadCsv('cedar-incidents', [{ label: 'Date', value: 'date' }, { label: 'Type', value: 'type' }, { label: 'Severity', value: 'severity' }, { label: 'Patient', value: row => name(row.patientId) }, { label: 'What happened', value: 'description' }, { label: 'Action taken', value: 'actionTaken' }, { label: 'Status', value: 'status' }, { label: 'Outcome', value: 'outcome' }], incidents)}><Icon name="download" size={16} />Export CSV</button></div>
    <div class="lanes">
      {#each [['Needs review', openIncidents], ['Reviewed', incidents.filter(item => item.status !== 'Open')]] as [title, items] (title)}
        <section class="lane" class:review-lane={title === 'Needs review'}>
          <header class="lane-head"><h2>{title}</h2><span class="count num">{items.length}</span></header>
          <ul class="feed">
            {#each items as item (item.id)}
              <li class="incident sev-{item.severity.toLowerCase()}">
                <span class="sev-mark"><Icon name={item.severity === 'Low' ? 'flag' : 'alert'} size={16} /></span>
                <div class="grow">
                  <div class="inc-top"><span class="pill {SEV[item.severity]}">{item.severity}</span><span class="faint num">{fmtDate(item.date)}{item.time ? ` at ${item.time}` : ''}</span></div>
                  <div class="title">{item.type}{item.patientId ? `, ${name(item.patientId)}` : ''}</div>
                  <div class="sub">{item.description}{item.actionTaken ? ` Action: ${item.actionTaken}` : ''}</div>
                  <div class="faint meta">Reported by {staffName(item.reportedBy)}{item.outcome ? `. Reviewed by ${staffName(item.reviewedBy)}: ${item.outcome}` : ''}</div>
                </div>
                {#if item.status === 'Open'}
                  {#if reviews}<button class="btn sm dark" onclick={() => { error = ''; dialog = { kind: 'review', id: item.id, outcome: '' }; }}>Review</button>{:else}<span class="pill warn">Open</span>{/if}
                {:else}<span class="pill ok">Reviewed</span>{/if}
              </li>
            {:else}<li class="empty"><strong>{title === 'Needs review' ? 'No incidents waiting' : 'No incidents'}</strong></li>{/each}
          </ul>
        </section>
      {/each}
    </div>
  {:else if tab === 'visits'}
    {@const visits = db.visits.slice().sort((a, b) => b.date.localeCompare(a.date) || (b.start || '').localeCompare(a.start || ''))}
    <ol class="visit-days">
      {#each [...new Set(visits.map(visit => visit.date))] as day (day)}
        <li class="vday">
          <div class="vdate"><strong class="num">{fmtDate(day, { day: 'numeric' })}</strong><span>{fmtDate(day, { month: 'short' })}</span></div>
          <ul class="visits">
            {#each visits.filter(visit => visit.date === day) as visit (visit.id)}
              <li class="visit">
                <span class="avatar sm">{visit.visitor[0]}</span>
                <div class="grow"><div class="title">{visit.visitor}{visit.relation ? `, ${visit.relation.toLowerCase()}` : ''}</div><div class="sub">Visited {name(visit.patientId)} on {fmtDate(visit.date)}{visit.start ? `, ${visit.start}${visit.end ? `–${visit.end}` : ''}` : ''}{visit.note ? `. ${visit.note}` : ''}</div></div>
                <span class="faint" style="font-size: 12.5px">{staffName(visit.loggedBy)}</span>
              </li>
            {/each}
          </ul>
        </li>
      {:else}<li class="panel empty"><strong>No visits logged</strong></li>{/each}
    </ol>
  {:else}
    <ul class="leave-list">
      {#each leaves as leave (leave.id)}
        <li class="leave s-{leave.state.toLowerCase()}"><span class="pill {leave.state === 'Returned' ? 'ok' : leave.state === 'Out' ? 'info' : 'urgent'}">{leave.state}</span><div class="grow"><div class="title">{name(leave.patientId)}</div><div class="sub">Out {fmtDateTime(leave.out)}, due back {fmtDateTime(leave.dueBack)}{leave.returnedAt ? `, back ${fmtDateTime(leave.returnedAt)}` : ''}{leave.escort ? `. With ${leave.escort}` : ''}{leave.reason ? `. ${leave.reason}` : ''}</div></div></li>
      {:else}<li class="panel empty"><strong>No leave recorded</strong></li>{/each}
    </ul>
  {/if}
</main>


{#if dialog}
  <div class="scrim" onclick={() => { dialog = null; }} aria-hidden="true"></div>
  <form class="dialog" use:dialogFocus={{ onClose: () => { dialog = null; } }} onsubmit={event => { event.preventDefault(); submit(); }}>
    <header class="drawer-head"><div class="grow"><h2>{({ incident: 'Report incident', visit: 'Log visit', leave: 'Start day leave', review: 'Review incident' })[dialog.kind]}</h2></div></header>
    <div class="drawer-body stack">
      {#if dialog.kind === 'incident'}
        <label class="field"><span>Patient involved</span><select class="select" bind:value={dialog.patientId}><option value="">No patient involved</option>{#each db.patients.filter(p => p.status === 'Admitted') as p}<option value={p.id}>{p.fullName}</option>{/each}</select></label>
        <div class="grid-2"><label class="field"><span>Type</span><select class="select" bind:value={dialog.type}>{#each INCIDENT_TYPES as type}<option>{type}</option>{/each}</select></label><label class="field"><span>Date</span><input class="input" type="date" bind:value={dialog.date} /></label></div>
        <fieldset class="field"><legend>Severity</legend><div class="choices" style="margin-top: 6px">{#each SEVERITIES as option}<label class="choice risk-{option}"><input type="radio" name="sev" value={option} bind:group={dialog.severity} /><span>{option}</span></label>{/each}</div></fieldset>
        <label class="field"><span>What happened</span><textarea class="textarea" rows="3" bind:value={dialog.description}></textarea></label>
        <label class="field"><span>Action taken</span><input class="input" bind:value={dialog.actionTaken} /></label>
        {#if dialog.severity === 'High'}<p class="notice urgent"><Icon name="alert" size={15} />High severity alerts Ahmed and the Clinical Director in the app, by email and on WhatsApp.</p>{/if}
      {:else if dialog.kind === 'visit'}
        <label class="field"><span>Resident</span><select class="select" bind:value={dialog.patientId}>{#each inCare as p}<option value={p.id}>{p.fullName}</option>{/each}</select></label>
        <div class="grid-2"><label class="field"><span>Visitor</span><input class="input" bind:value={dialog.visitor} /></label><label class="field"><span>Relation</span><input class="input" bind:value={dialog.relation} placeholder="Mother, friend…" /></label></div>
        <div class="grid-3"><label class="field"><span>Date</span><input class="input" type="date" bind:value={dialog.date} /></label><label class="field"><span>From</span><input class="input" type="time" bind:value={dialog.start} /></label><label class="field"><span>To</span><input class="input" type="time" bind:value={dialog.end} /></label></div>
      {:else if dialog.kind === 'leave'}
        <label class="field"><span>Resident</span><select class="select" bind:value={dialog.patientId}>{#each inCare as p}<option value={p.id}>{p.fullName}</option>{/each}</select></label>
        <div class="grid-2"><label class="field"><span>Out</span><input class="input" type="datetime-local" bind:value={dialog.out} /></label><label class="field"><span>Due back</span><input class="input" type="datetime-local" bind:value={dialog.dueBack} /></label></div>
        <div class="grid-2"><label class="field"><span>With</span><input class="input" bind:value={dialog.escort} /></label><label class="field"><span>Reason</span><input class="input" bind:value={dialog.reason} /></label></div>
        {#if onWatch(db, dialog.patientId)}<p class="notice warn"><Icon name="alert" size={15} />{name(dialog.patientId)} is on watch.</p><label class="check-line"><input type="checkbox" bind:checked={dialog.clinicalOk} />The clinical team agreed to this leave</label>{/if}
      {:else}
        <label class="field"><span>Outcome of the review</span><textarea class="textarea" rows="3" bind:value={dialog.outcome}></textarea></label>
      {/if}
      {#if error}<p class="error" role="alert">{error}</p>{/if}
    </div>
    <footer class="drawer-foot"><button class="btn" type="button" onclick={() => { dialog = null; }}>Cancel</button><button class="btn primary" type="submit">Save</button></footer>
  </form>
{/if}

<style>
  .check-line { display: flex; align-items: center; gap: 8px; font-size: 13.5px; font-weight: 650; }
  /* Pulse: what needs a decision now (incidents to review) and who is out of the house */
  .watchboard { display: grid; grid-template-columns: minmax(280px, 340px) minmax(0, 1fr); gap: 10px; margin-bottom: 16px; }
  .watch { position: relative; overflow: hidden; display: flex; flex-direction: column; gap: 4px; padding: 17px 18px; border-radius: 20px; background: var(--hero); color: var(--on-ink); box-shadow: var(--shadow-2); }
  .watch::after { content: ""; position: absolute; right: -70px; bottom: -70px; width: 220px; height: 220px; border-radius: 50%; background: radial-gradient(circle, rgb(255 110 90 / 0.28), transparent 70%); pointer-events: none; }
  .watch.calm::after { background: radial-gradient(circle, rgb(124 252 0 / 0.22), transparent 70%); }
  .eyebrow { font-size: 12.5px; font-weight: 750; color: var(--on-ink-2); text-transform: uppercase; letter-spacing: 0.08em; }
  .big { font-size: 50px; font-weight: 800; letter-spacing: -0.05em; line-height: 1; color: #ff8a7a; margin: 6px 0 4px; }
  .watch.calm .big { color: var(--lime); }
  .watch p { margin: 0; font-size: 13px; color: var(--on-ink-2); font-weight: 600; }
  .out-strip { display: grid; grid-template-columns: repeat(auto-fill, minmax(240px, 1fr)); gap: 8px; align-content: start; }
  .out-card { display: flex; flex-direction: column; gap: 4px; padding: 11px 13px; border-radius: 18px; background: var(--paper); box-shadow: inset 0 0 0 1.5px var(--info), var(--shadow-1); }
  .out-card.late { background: color-mix(in srgb, var(--urgent-soft) 60%, var(--paper)); box-shadow: inset 0 0 0 2px var(--urgent), var(--shadow-1); }
  .out-top { display: flex; align-items: center; gap: 8px; font-size: 12px; font-weight: 750; color: var(--info); }
  .out-card.late .out-top { color: var(--urgent); }
  .live { width: 9px; height: 9px; border-radius: 50%; background: currentColor; box-shadow: 0 0 0 0 currentColor; animation: live 1.8s ease-out infinite; }
  @keyframes live { 70% { box-shadow: 0 0 0 7px transparent; } 100% { box-shadow: 0 0 0 0 transparent; } }
  .countdown { margin-left: auto; font-size: 13px; font-weight: 800; }
  .out-card strong { font-size: 16px; font-weight: 800; margin-top: 4px; }
  .out-sub { font-size: 12.5px; color: var(--text-2); }
  .back { align-self: flex-start; margin-top: 8px; background: var(--strong); color: var(--on-strong); border-color: transparent; }
  .all-in { display: flex; align-items: center; gap: 10px; padding: 15px 17px; border-radius: 20px; background: var(--leaf); color: var(--moss); }
  .all-in strong { display: block; font-size: 16px; color: var(--text); }
  .all-in span { font-size: 13px; }

  /* Incidents: a review lane and the reviewed record, each a severity-coded feed */
  .lanes { display: grid; grid-template-columns: minmax(0, 1.25fr) minmax(0, 1fr); gap: 13px; align-items: start; }
  .lane { padding: 10px; border-radius: 20px; background: var(--subtle); box-shadow: inset 0 0 0 1px var(--line); }
  .lane.review-lane { background: var(--paper); box-shadow: var(--shadow-1); }
  .lane-head { display: flex; align-items: center; gap: 10px; padding: 6px 8px 10px; }
  .lane-head h2 { font-size: 17px; font-weight: 800; }
  .count { min-width: 26px; height: 26px; padding: 0 8px; border-radius: 13px; display: inline-flex; align-items: center; justify-content: center; background: var(--strong); color: var(--on-strong); font-size: 12.5px; font-weight: 800; }
  .feed { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 10px; }
  .incident { --sev: var(--ok); display: flex; align-items: flex-start; gap: 8px; padding: 10px 11px; border-radius: 14px; background: var(--paper); box-shadow: inset 4px 0 0 var(--sev), 0 0 0 1px var(--line); }
  .incident.sev-medium { --sev: var(--warn); }
  .incident.sev-high { --sev: var(--urgent); background: color-mix(in srgb, var(--urgent-soft) 40%, var(--paper)); }
  .sev-mark { width: 34px; height: 34px; border-radius: 11px; display: inline-flex; align-items: center; justify-content: center; flex: none; color: var(--sev); background: color-mix(in srgb, var(--sev) 14%, transparent); }
  .inc-top { display: flex; align-items: center; gap: 8px; margin-bottom: 4px; font-size: 12px; }
  .incident .title { font-weight: 800; font-size: 14.5px; }
  .incident .sub { font-size: 13px; color: var(--text-2); margin-top: 2px; }
  .meta { font-size: 12px; margin-top: 6px; }

  /* Visits as a dated timeline */
  .visit-days { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 10px; }
  .vday { display: grid; grid-template-columns: 74px minmax(0, 1fr); gap: 11px; }
  .vdate { display: flex; flex-direction: column; align-items: center; justify-content: center; align-self: start; width: 64px; height: 70px; border-radius: 14px; background: var(--strong); color: var(--on-strong); }
  .vdate strong { font-size: 20px; font-weight: 800; line-height: 1; letter-spacing: -0.03em; }
  .vdate span { font-size: 12px; font-weight: 700; opacity: 0.75; }
  .visits { list-style: none; margin: 0; padding: 0; display: grid; grid-template-columns: repeat(auto-fill, minmax(320px, 1fr)); gap: 10px; }
  .visit, .leave { display: flex; align-items: center; gap: 8px; padding: 10px 11px; border-radius: 14px; background: var(--paper); box-shadow: var(--shadow-1); }
  .visit .title, .leave .title { font-weight: 800; font-size: 14px; }
  .visit .sub, .leave .sub { font-size: 12.5px; color: var(--text-2); }
  .leave-list { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 8px; }
  .leave.s-overdue { box-shadow: inset 4px 0 0 var(--urgent), var(--shadow-1); }
  .leave.s-out { box-shadow: inset 4px 0 0 var(--info), var(--shadow-1); }
  @media (max-width: 1000px) { .watchboard, .lanes { grid-template-columns: 1fr; } }
  @media (max-width: 600px) { .vday { grid-template-columns: 1fr; } .vdate { flex-direction: row; gap: 6px; width: auto; height: 36px; padding: 0 10px; justify-self: start; } .vdate strong { font-size: 18px; } .visits { grid-template-columns: 1fr; } .incident { flex-wrap: wrap; } }
</style>
