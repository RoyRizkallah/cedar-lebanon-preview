<script>
  import Icon from '../components/Icon.svelte';
  import Ring from '../components/Ring.svelte';
  import FormView from '../components/FormView.svelte';
  import { FORMS } from '../lib/forms/engine.js';
  import { db, session, commit } from '../lib/store.svelte.js';
  import { ROUTES, SUBSTANCES, roundFor, recordDose, correctDose, addOrder, stopOrder, recordTest } from '../lib/medication.js';
  import { staffName, canDo } from '../lib/people.js';
  import { addDays, todayISO, fmtDate, fmtDay } from '../lib/dates.js';
  import { dialogFocus } from '../lib/dialogFocus.js';
  import { say } from '../lib/ui.svelte.js';

  let { args = [] } = $props();
  const me = session.staffId;
  const records = canDo(me, 'recordMedication');
  const gives = canDo(me, 'giveMedication');
  // Ward logs (SOP 2.3): about the medication store, not one patient.
  const WARD = FORMS.filter(form => form.ward);
  let wardForm = $state(null);
  const logEntries = id => db.forms.filter(entry => entry.formId === id).sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)));
  const today = todayISO(session.now);
  const tab = $derived(['orders', 'tests', 'logs'].includes(args[0]) ? args[0] : 'round');
  let date = $state(today);
  let noting = $state(null);
  let dialog = $state(null);
  let error = $state('');

  const patient = id => db.patients.find(p => p.id === id);
  const round = $derived(roundFor(db, date));
  const times = $derived([...new Set(round.map(item => item.time))]);
  const done = $derived(round.filter(item => item.status !== 'Due').length);
  const orders = $derived(db.medication.orders.slice().sort((a, b) => (a.status === 'Active' ? 0 : 1) - (b.status === 'Active' ? 0 : 1) || patient(a.patientId)?.fullName.localeCompare(patient(b.patientId)?.fullName)));
  const tests = $derived(db.medication.tests.slice().sort((a, b) => b.date.localeCompare(a.date)));
  const inCare = $derived(db.patients.filter(p => p.status === 'Admitted'));

  function run(action, message) {
    error = '';
    try { const result = commit(action); if (message) say(message); return result ?? true; } catch (e) { error = e.message; return null; }
  }
  const mark = (item, status, note = '') => run(state => recordDose(state, { orderId: item.orderId, date, time: item.time, status, note }, me), `${patient(item.patientId).clinicalName}: ${status.toLowerCase()}`);
</script>

<main class="content wide">
  <div class="page-head">
    <div><h1>Medication</h1><p>The RSA running each meds window records every dose as it is taken. Fadia starts and stops medication and keeps the logs.</p></div>
    {#if records}
      <div class="actions">
        <button class="btn" onclick={() => { dialog = { kind: 'test', patientId: inCare[0]?.id, date: today, result: 'Negative', substances: [], note: '' }; }}><Icon name="flag" size={16} />Record drug screen</button>
        <button class="btn primary" onclick={() => { dialog = { kind: 'order', patientId: inCare[0]?.id, drug: '', dose: '', route: 'Oral', times: '08:00', startDate: today }; }}><Icon name="plus" size={16} />Start medication</button>
      </div>
    {/if}
  </div>

  <nav class="tabs" aria-label="Medication sections" style="margin-bottom: 20px">
    <a href="#/medication" aria-current={tab === 'round' ? 'page' : undefined}>Round</a>
    <a href="#/medication/orders" aria-current={tab === 'orders' ? 'page' : undefined}>Medications</a>
    <a href="#/medication/tests" aria-current={tab === 'tests' ? 'page' : undefined}>Drug screens</a>
    <a href="#/medication/logs" aria-current={tab === 'logs' ? 'page' : undefined}>Logs</a>
  </nav>
  {#if error && !dialog}<p class="error" role="alert" style="margin-bottom: 12px">{error}</p>{/if}

  {#if tab === 'round'}
    {@const given = round.filter(item => item.status === 'Given').length}
    {@const missed = round.filter(item => !['Due', 'Given'].includes(item.status)).length}
    {@const nextTime = times.find(time => round.some(item => item.time === time && item.status === 'Due'))}
    <div class="round-layout">
      <aside class="round-card">
        <div class="day-nav">
          <button class="btn icon" aria-label="Previous day" onclick={() => { date = addDays(date, -1); }}><Icon name="chevron-left" /></button>
          <button class="btn today-btn" onclick={() => { date = today; }}>Today</button>
          <button class="btn icon" aria-label="Next day" onclick={() => { date = addDays(date, 1); }}><Icon name="chevron" /></button>
        </div>
        <strong class="day-name">{fmtDay(date)}</strong>
        <div class="round-ring">
          <Ring value={round.length ? Math.round((done / round.length) * 100) : null} size={113} stroke={13} label="Recorded" />
        </div>
        <p class="round-progress"><strong class="num">{done} of {round.length}</strong> recorded</p>
        <dl class="tally">
          <div><dt>Given</dt><dd class="num">{given}</dd></div>
          <div class:bad={missed}><dt>Not given</dt><dd class="num">{missed}</dd></div>
          <div><dt>Still due</dt><dd class="num">{round.length - done}</dd></div>
        </dl>
        {#if nextTime && date === today}<p class="next"><Icon name="clock" size={15} />Next round at <strong class="num">{nextTime}</strong></p>{/if}
      </aside>

      <ol class="timeline">
        {#each times as time (time)}
          {@const items = round.filter(item => item.time === time)}
          {@const complete = items.every(item => item.status !== 'Due')}
          <li class="slot" class:complete class:next={time === nextTime && date === today}>
            <div class="slot-time"><span class="node">{#if complete}<Icon name="check" size={14} stroke={2.6} />{/if}</span><h2 class="num">{time}</h2><span class="faint">{items.filter(item => item.status !== 'Due').length}/{items.length}</span></div>
            <ul class="doses">
              {#each items as item (item.key)}
                <li class="dose" class:due={item.status === 'Due'} class:given={item.status === 'Given'} class:off={!['Due', 'Given'].includes(item.status)}>
                  <span class="avatar sm">{patient(item.patientId).clinicalName.split(' ').map(part => part[0]).join('')}</span>
                  <div class="grow">
                    <div class="title">{patient(item.patientId).clinicalName}</div>
                    <div class="drug"><Icon name="pill" size={13} /><strong>{item.drug} {item.dose}</strong><span>{item.route}</span></div>
                    {#if item.record}<div class="sub">{item.status} by {staffName(item.record.by)}{item.record.note ? `: ${item.record.note}` : ''}</div>{/if}
                  </div>
                  {#if item.status === 'Due'}
                    {#if gives && date <= todayISO(session.now)}
                      <div class="dose-actions">
                        <button class="btn sm give" onclick={() => mark(item, 'Given')}><Icon name="check" size={14} stroke={2.4} />Given</button>
                        <button class="btn sm" onclick={() => { noting = { item, status: 'Refused', note: '' }; }}>Not given</button>
                      </div>
                    {:else}<span class="pill warn">Due</span>{/if}
                  {:else}
                    <span class="pill {item.status === 'Given' ? 'ok' : item.status === 'Held' ? '' : 'urgent'}">{item.status}</span>
                    {#if records}<button class="btn sm ghost" title="Correct a dose recorded wrongly" onclick={() => { error = ''; noting = { item, status: item.status, note: item.record?.note || '', correcting: true, reason: '' }; }}>Correct</button>{/if}
                  {/if}
                </li>
              {/each}
            </ul>
          </li>
        {:else}
          <li class="panel empty"><strong>No doses due</strong>Start a medication to add it to the rounds.</li>
        {/each}
      </ol>
    </div>

  {:else if tab === 'orders'}
    <div class="panel table-wrap">
      <table class="table cards">
        <thead><tr><th>Patient</th><th>Medication</th><th>Rounds</th><th>Since</th><th>Status</th><th></th></tr></thead>
        <tbody>
          {#each orders as order (order.id)}
            <tr>
              <td class="lead-cell"><strong>{patient(order.patientId)?.clinicalName}</strong></td>
              <td data-label="Medication">{order.drug} {order.dose}, {order.route.toLowerCase()}</td>
              <td data-label="Rounds" class="num">{order.times.join(', ')}</td>
              <td data-label="Since">{fmtDate(order.startDate)}</td>
              <td data-label="Status"><span class="pill {order.status === 'Active' ? 'ok' : ''}">{order.status}</span></td>
              <td>{#if records && order.status === 'Active'}<button class="btn sm ghost danger" onclick={() => run(state => stopOrder(state, order.id, me), 'Medication stopped')}>Stop</button>{/if}</td>
            </tr>
          {/each}
        </tbody>
      </table>
    </div>

  {:else if tab === 'logs'}
    <ul class="list panel form-list">
      {#each WARD as form (form.id)}
        {@const entries = logEntries(form.id)}
        {@const owner = form.owners.includes(me)}
        <li style="align-items: flex-start">
          <span class="num-badge">{form.number}</span>
          <div class="grow">
            <div class="title">{form.title}</div>
            <p class="faint" style="font-size: 12.5px; margin: 2px 0 0">{form.purpose}</p>
            {#if !form.living && entries.length}
              <ul class="entries">
                {#each entries.slice(0, 4) as entry (entry.id)}
                  <li><button class="linkish" onclick={() => { wardForm = { formId: form.id, entryId: entry.id }; }}>Week of {fmtDate(entry.values.weekBeginning || entry.values.weekEnding || entry.createdAt)}{entry.status === 'Draft' ? ' (draft)' : ''}</button><span class="faint" style="margin-left: 6px">{staffName(entry.filedBy || entry.createdBy)}</span></li>
                {/each}
              </ul>
            {:else if form.living && entries[0]}
              <p class="faint" style="font-size: 12.5px; margin: 4px 0 0">{(entries[0].values.entries || []).length} entries, last saved {fmtDate(entries[0].updatedAt)} by {staffName(entries[0].updatedBy)}</p>
            {/if}
          </div>
          {#if form.living && entries[0]}
            <button class="btn sm" onclick={() => { wardForm = { formId: form.id, entryId: entries[0].id }; }}>{owner ? 'Add entry' : 'Open'}</button>
          {:else if owner}
            <button class="btn sm" onclick={() => { wardForm = { formId: form.id, entryId: null }; }}><Icon name="plus" size={14} />{form.living ? 'Start log' : 'New'}</button>
          {/if}
        </li>
      {/each}
    </ul>

  {:else}
    <div class="screens">
      {#each tests as test (test.id)}
        <article class="screen" class:positive={test.result === 'Positive'}>
          <header><span class="pill {test.result === 'Positive' ? 'urgent' : 'ok'}">{test.result}</span><span class="faint num">{fmtDate(test.date)}</span></header>
          <h3>{patient(test.patientId)?.clinicalName}</h3>
          <p class="sub">{test.type}{test.substances.length ? `: ${test.substances.join(', ')}` : ''}{test.note ? `. ${test.note}` : ''}</p>
          <footer class="faint">Recorded by {staffName(test.by)}</footer>
        </article>
      {:else}<div class="panel empty"><strong>No drug screens recorded</strong></div>{/each}
    </div>
  {/if}
</main>

{#if wardForm}{#key wardForm}<FormView {...wardForm} onclose={() => { wardForm = null; }} />{/key}{/if}

{#if noting}
  <div class="scrim" onclick={() => { noting = null; }} aria-hidden="true"></div>
  <form class="dialog" use:dialogFocus={{ onClose: () => { noting = null; } }} onsubmit={event => { event.preventDefault(); const ok = noting.correcting ? run(state => correctDose(state, noting.item.record.id, { status: noting.status, note: noting.note, reason: noting.reason }, me), 'Dose corrected') : mark(noting.item, noting.status, noting.note); if (ok) noting = null; }}>
    <header class="drawer-head"><div class="grow"><h2>{noting.correcting ? 'Correct the dose record' : 'Dose not given'}</h2><p class="muted" style="margin-top: 4px">{patient(noting.item.patientId).clinicalName}, {noting.item.drug} {noting.item.dose} at {noting.item.time}. Fadia and Ahmed are told about refused and missed doses.</p></div></header>
    <div class="drawer-body stack">
      <div class="choices">{#each noting.correcting ? ['Given', 'Refused', 'Missed', 'Held'] : ['Refused', 'Missed', 'Held'] as option}<label class="choice"><input type="radio" name="dose" value={option} bind:group={noting.status} /><span>{option}</span></label>{/each}</div>
      {#if noting.status !== 'Given'}<label class="field"><span>Why it was not given</span><input class="input" bind:value={noting.note} data-autofocus /></label>{/if}
      {#if noting.correcting}<label class="field"><span>Reason for the correction <span class="hint">kept on the record</span></span><input class="input" bind:value={noting.reason} placeholder="For example: tapped Given by mistake" /></label>{/if}
      {#if error}<p class="error" role="alert">{error}</p>{/if}
    </div>
    <footer class="drawer-foot"><button class="btn" type="button" onclick={() => { noting = null; }}>Cancel</button><button class="btn primary" type="submit">Save</button></footer>
  </form>
{/if}

{#if dialog}
  <div class="scrim" onclick={() => { dialog = null; }} aria-hidden="true"></div>
  <form class="dialog" use:dialogFocus={{ onClose: () => { dialog = null; } }} onsubmit={event => {
    event.preventDefault();
    const d = $state.snapshot(dialog);
    const ok = d.kind === 'order'
      ? run(state => addOrder(state, { ...d, times: d.times.split(/[,\s]+/) }, me), 'Medication added to the rounds')
      : run(state => recordTest(state, d, me), d.result === 'Positive' ? 'Positive screen recorded. Ahmed and the Clinical Director are notified.' : 'Drug screen recorded');
    if (ok) dialog = null;
  }}>
    <header class="drawer-head"><div class="grow"><h2>{dialog.kind === 'order' ? 'Start medication' : 'Record drug screen'}</h2></div></header>
    <div class="drawer-body stack">
      <label class="field"><span>Patient</span><select class="select" bind:value={dialog.patientId}>{#each inCare as p}<option value={p.id}>{p.clinicalName}</option>{/each}</select></label>
      {#if dialog.kind === 'order'}
        <div class="grid-2"><label class="field"><span>Medication</span><input class="input" bind:value={dialog.drug} /></label><label class="field"><span>Dose</span><input class="input" bind:value={dialog.dose} placeholder="5 mg" /></label></div>
        <div class="grid-2"><label class="field"><span>Route</span><select class="select" bind:value={dialog.route}>{#each ROUTES as route}<option>{route}</option>{/each}</select></label><label class="field"><span>Round times <span class="hint">comma separated</span></span><input class="input" bind:value={dialog.times} /></label></div>
        <label class="field"><span>Start</span><input class="input" type="date" bind:value={dialog.startDate} /></label>
      {:else}
        <div class="choices">{#each ['Negative', 'Positive'] as option}<label class="choice {option === 'Positive' ? 'risk-High' : 'risk-Low'}"><input type="radio" name="result" value={option} bind:group={dialog.result} /><span>{option}</span></label>{/each}</div>
        {#if dialog.result === 'Positive'}<div class="choices" role="group" aria-label="Substances">{#each SUBSTANCES as substance}<label class="choice"><input type="checkbox" value={substance} bind:group={dialog.substances} /><span>{substance}</span></label>{/each}</div>{/if}
        <div class="grid-2"><label class="field"><span>Date</span><input class="input" type="date" bind:value={dialog.date} /></label><label class="field"><span>Note</span><input class="input" bind:value={dialog.note} /></label></div>
      {/if}
      {#if error}<p class="error" role="alert">{error}</p>{/if}
    </div>
    <footer class="drawer-foot"><button class="btn" type="button" onclick={() => { dialog = null; }}>Cancel</button><button class="btn primary" type="submit">Save</button></footer>
  </form>
{/if}

<style>
  /* Round: the day's progress on a dark card, the rounds as a timeline beside it */
  .round-layout { display: grid; grid-template-columns: 320px minmax(0, 1fr); gap: 15px; align-items: start; }
  .round-card { position: sticky; top: 16px; display: flex; flex-direction: column; align-items: center; gap: 8px; padding: 15px; border-radius: 20px; background: var(--hero); color: var(--on-ink); box-shadow: var(--shadow-2); overflow: hidden; }
  .round-card::before { content: ""; position: absolute; inset: auto -80px -80px auto; width: 240px; height: 240px; border-radius: 50%; background: radial-gradient(circle, rgb(var(--lime-rgb) / 0.2), transparent 70%); pointer-events: none; }
  .day-nav { display: flex; gap: 6px; width: 100%; }
  .day-nav .btn { background: rgb(255 255 255 / 0.08); color: var(--on-ink); box-shadow: none; border-color: transparent; }
  .day-nav .btn:hover { background: rgb(255 255 255 / 0.16); }
  .today-btn { flex: 1; }
  .day-name { font-size: 17px; font-weight: 800; letter-spacing: -0.01em; }
  .round-ring { margin: 6px 0 0; }
  .round-ring :global(figcaption) { color: var(--on-ink); }
  .round-progress { margin: 0; font-size: 13.5px; color: var(--on-ink-2); font-weight: 600; }
  .round-progress strong { color: var(--lime); font-size: 15px; }
  .tally { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; width: 100%; margin: 6px 0 0; }
  .tally div { padding: 8px 8px; border-radius: 16px; background: rgb(255 255 255 / 0.07); text-align: center; }
  .tally dt { font-size: 11.5px; color: var(--on-ink-2); font-weight: 650; }
  .tally dd { margin: 2px 0 0; font-size: 17px; font-weight: 800; }
  .tally .bad dd { color: #ff8a7a; }
  .next { display: inline-flex; align-items: center; gap: 6px; margin: 2px 0 0; font-size: 13px; color: var(--on-ink-2); }
  .next strong { color: var(--on-ink); }

  .timeline { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 6px; position: relative; }
  .slot { position: relative; display: grid; grid-template-columns: 120px minmax(0, 1fr); gap: 11px; padding-bottom: 13px; }
  .slot:not(:last-child)::before { content: ""; position: absolute; left: 13px; top: 34px; bottom: -6px; width: 3px; border-radius: 3px; background: var(--line); }
  .slot.complete:not(:last-child)::before { background: linear-gradient(var(--lime), #c5f59a); }
  .slot-time { display: flex; align-items: center; gap: 10px; align-self: start; padding-top: 8px; position: sticky; top: 16px; flex-wrap: wrap; }
  .slot-time h2 { font-size: 17px; font-weight: 800; letter-spacing: -0.03em; }
  .slot-time .faint { font-size: 12px; font-weight: 700; flex-basis: 100%; padding-left: 28px; margin-top: -6px; }
  .node { width: 29px; height: 29px; border-radius: 50%; display: inline-flex; align-items: center; justify-content: center; background: var(--paper); box-shadow: inset 0 0 0 3px var(--line-strong); flex: none; z-index: 1; }
  .slot.complete .node { background: var(--lime); color: var(--on-lime); box-shadow: 0 0 0 4px var(--leaf); }
  .slot.next .node { background: var(--paper); box-shadow: inset 0 0 0 3px var(--strong), 0 0 0 5px rgb(var(--lime-rgb) / 0.35); }
  .doses { list-style: none; margin: 0; padding: 0; display: grid; grid-template-columns: repeat(auto-fill, minmax(340px, 1fr)); gap: 10px; }
  .dose { display: flex; align-items: center; gap: 8px; padding: 10px 11px; border-radius: 15px; background: var(--paper); box-shadow: var(--shadow-1); min-width: 0; }
  .dose.due { box-shadow: inset 0 0 0 1.5px var(--line-strong), var(--shadow-1); }
  .slot.next .dose.due { box-shadow: inset 0 0 0 2px var(--lime), var(--shadow-2); }
  .dose.given { opacity: 0.72; }
  .dose.off { background: color-mix(in srgb, var(--urgent-soft) 55%, var(--paper)); }
  .dose .title { font-weight: 800; font-size: 14px; }
  .drug { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; font-size: 13px; color: var(--text-2); margin-top: 2px; }
  .drug strong { color: var(--text); font-weight: 700; }
  .drug span { font-size: 12px; padding: 1px 8px; border-radius: 999px; background: var(--sunk); }
  .dose .sub { font-size: 12px; color: var(--text-3); margin-top: 3px; }
  .dose-actions { display: flex; gap: 6px; flex: none; }
  .give { background: var(--lime); color: var(--on-lime); border-color: transparent; }
  .give:hover { background: var(--lime-press); }

  .entries { list-style: none; margin: 6px 0 0; padding: 0; display: flex; flex-direction: column; gap: 3px; font-size: 13px; }

  /* Drug screens as cards, positives stand out */
  .screens { display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 10px; }
  .screen { display: flex; flex-direction: column; gap: 6px; padding: 13px 14px; border-radius: 16px; background: var(--paper); box-shadow: var(--shadow-1); border-left: 5px solid var(--ok); }
  .screen.positive { border-left-color: var(--urgent); background: color-mix(in srgb, var(--urgent-soft) 45%, var(--paper)); }
  .screen header { display: flex; justify-content: space-between; align-items: center; }
  .screen h3 { font-size: 16px; font-weight: 800; }
  .screen .sub { margin: 0; font-size: 13px; color: var(--text-2); }
  .screen footer { margin-top: auto; font-size: 12px; }
  @media (max-width: 1000px) {
    .round-layout { grid-template-columns: 1fr; }
    .round-card { position: static; }
    .slot { grid-template-columns: 1fr; gap: 8px; }
    .slot-time { position: static; }
    .slot:not(:last-child)::before { display: none; }
    .doses { grid-template-columns: 1fr; }
  }
  @media (max-width: 520px) { .dose { flex-wrap: wrap; } .dose-actions { width: 100%; } .dose-actions .btn { flex: 1; } }
</style>
