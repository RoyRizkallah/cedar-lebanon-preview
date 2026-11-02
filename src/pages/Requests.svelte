<script>
  import { onMount } from 'svelte';
  import Icon from '../components/Icon.svelte';
  import { MOODS, addCheckin } from '../lib/support.js';
  import { db, session, commit } from '../lib/store.svelte.js';
  import { createRequest, completeRequest, cancelRequest, uploadInvoice } from '../lib/requests.js';
  import { walletBalanceCents, formatCents } from '../lib/wallet.js';
  import { visiblePatients, staffName, canDo } from '../lib/people.js';
  import { fmtAgo } from '../lib/dates.js';
  import { putFile, openFile } from '../lib/files.js';
  import { dialogFocus } from '../lib/dialogFocus.js';
  import { go, say, takeIntent } from '../lib/ui.svelte.js';
  import { todayISO } from '../lib/dates.js';

  let { args = [] } = $props();
  const me = session.staffId;
  const patients = $derived(visiblePatients(db, me));
  const startPatient = args[0] === 'new' ? args[1] : '';

  let view = $state('Open');
  const tab = $derived(args[0] === 'checkins' ? 'checkins' : 'requests');
  const today = todayISO(session.now);
  let checkin = $state({ patientId: '', mood: 'Settled', note: '' });
  const residents = $derived(patients.filter(p => p.program !== 'Outpatient'));
  const todays = $derived(db.checkins.filter(item => item.date === today).sort((a, b) => String(b.at).localeCompare(String(a.at))));
  const notYet = $derived(residents.filter(p => !todays.some(item => item.patientId === p.id)));
  function saveCheckin() {
    if (run(state => addCheckin(state, { ...$state.snapshot(checkin), patientId: checkin.patientId || notYet[0]?.id }, me), 'Check-in recorded')) checkin = { patientId: '', mood: 'Settled', note: '' };
  }
  onMount(() => { if (takeIntent('new-request')) creating = { patientId: patients[0]?.id || '', item: '', quantity: 1, note: '' }; });
  let creating = $state(args[0] === 'new' ? { patientId: startPatient || '', item: '', quantity: 1, note: '' } : null);
  let invoice = $state(null);
  let buying = $state(null);
  let error = $state('');

  const rows = $derived(db.requests.filter(item => canDo(me, 'pettyCash') || patients.some(p => p.id === item.patientId) || item.status !== 'Open')
    .filter(item => view === 'All' || item.status === view || (view === 'Done' && item.status === 'Cancelled'))
    .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt))));
  const patientName = id => db.patients.find(p => p.id === id)?.fullName || id;

  function run(action, message) {
    error = '';
    try { const result = commit(action); say(message); return result ?? true; } catch (e) { error = e.message; return null; }
  }
  function closeCreate() { creating = null; if (args[0] === 'new') go('requests'); }
  async function buy() {
    let stored = { id: '', name: '' };
    if (buying.file) stored = await putFile(buying.file);
    if (run(state => completeRequest(state, buying.id, { amount: buying.amount, fileId: stored.id, fileName: stored.name }, me), 'Purchase recorded and invoice attached')) buying = null;
  }
  async function saveInvoice() {
    let stored = { id: '', name: '' };
    if (invoice.file) stored = await putFile(invoice.file);
    if (run(state => uploadInvoice(state, { patientId: invoice.patientId, fileId: stored.id, fileName: stored.name, note: invoice.note }, me), 'Invoice linked to the patient')) invoice = null;
  }
</script>

<main class="content">
  <div class="page-head">
    <div><h1>Resident support</h1><p>Items bought for patients. Scan the invoice when you buy; the wallet is charged then.</p></div>
    <div class="actions">
      <button class="btn" onclick={() => { error = ''; invoice = { patientId: patients[0]?.id || '', note: '', file: null }; }}><Icon name="camera" size={16} />Upload invoice</button>
      <button class="btn primary" onclick={() => { error = ''; creating = { patientId: patients[0]?.id || '', item: '', quantity: 1, note: '' }; }}><Icon name="plus" size={16} />New request</button>
    </div>
  </div>

  <nav class="tabs" aria-label="Resident support" style="margin-bottom: 18px">
    <a href="#/requests" aria-current={tab === 'requests' ? 'page' : undefined}>Requests</a>
    <a href="#/requests/checkins" aria-current={tab === 'checkins' ? 'page' : undefined}>Daily check-ins{notYet.length ? ` (${notYet.length} to do)` : ''}</a>
  </nav>

  {#if tab === 'checkins'}
    <div class="checkin-grid">
      <form class="panel panel-body stack" onsubmit={event => { event.preventDefault(); saveCheckin(); }}>
        <h3>Record a check-in</h3>
        <label class="field"><span>Resident</span><select class="select" bind:value={checkin.patientId}><option value="">{notYet[0] ? `${notYet[0].fullName} (next to check in)` : 'Choose a resident'}</option>{#each residents as p}<option value={p.id}>{p.fullName}</option>{/each}</select></label>
        <fieldset class="field"><legend>How they seemed</legend><div class="choices" style="margin-top: 6px">{#each MOODS as mood}<label class="choice {mood === 'Needs follow-up' ? 'risk-High' : mood === 'Settled' ? 'risk-Low' : ''}"><input type="radio" name="mood" value={mood} bind:group={checkin.mood} /><span>{mood}</span></label>{/each}</div></fieldset>
        <label class="field"><span>Note</span><textarea class="textarea" rows="2" bind:value={checkin.note} placeholder="Practical support, not clinical detail"></textarea></label>
        <div class="row">{#if error}<span class="error">{error}</span>{/if}<button class="btn primary" style="margin-left: auto" type="submit">Save check-in</button></div>
      </form>
      <div class="stack">
        {#if notYet.length}<p class="notice warn">Not checked in yet today: {notYet.map(p => p.fullName).join(', ')}.</p>{:else}<p class="notice ok">Every resident has been checked in today.</p>{/if}
        <ul class="list panel">
          {#each todays as item (item.id)}
            <li><span class="pill {item.mood === 'Settled' ? 'ok' : item.mood === 'Needs follow-up' ? 'urgent' : 'warn'}">{item.mood}</span><div class="grow"><div class="title">{patientName(item.patientId)}</div><div class="sub">{item.note}</div></div><span class="faint" style="font-size: 12px">{staffName(item.by)}</span></li>
          {:else}<li class="faint">No check-ins yet today.</li>{/each}
        </ul>
      </div>
    </div>
  {:else}
  <div class="toolbar"><div class="seg" role="group" aria-label="Status">{#each ['Open', 'Done', 'All'] as name}<button aria-pressed={view === name} onclick={() => { view = name; }}>{name}</button>{/each}</div></div>
  {#if error && !creating && !invoice}<p class="error" role="alert" style="margin-bottom: 10px">{error}</p>{/if}

  <ul class="list panel">
    {#each rows as request (request.id)}
      <li style="flex-wrap: wrap">
        <span class="avatar sm" style="background: var(--sunk); color: var(--ink)">{request.quantity}</span>
        <div class="grow">
          <div class="title">{request.item}</div>
          <div class="sub">For <a href={`#/patients/${request.patientId}/wallet`}>{patientName(request.patientId)}</a>{request.note ? `. ${request.note.replace(/\.$/, '')}` : ''}. {staffName(request.createdBy)}, {fmtAgo(request.createdAt, session.now)}.</div>
        </div>
        {#if request.status === 'Open'}
          <span class="faint num" style="font-size: 12.5px">Wallet {formatCents(walletBalanceCents(db, request.patientId))}</span>
          <button class="btn sm ghost" onclick={() => run(state => cancelRequest(state, request.id, me), 'Request cancelled')}>Cancel</button>
          {#if canDo(me, 'pettyCash')}<button class="btn sm dark" onclick={() => { error = ''; buying = { id: request.id, amount: '', file: null }; }}>Bought</button>{/if}
        {:else}
          {#if request.amountCents}<strong class="num">{formatCents(request.amountCents)}</strong>{/if}
          {#if request.invoiceDocId}{@const doc = db.documents.find(d => d.id === request.invoiceDocId)}{#if doc?.fileId}<button class="btn sm" onclick={() => openFile(doc.fileId)}>Invoice</button>{/if}{/if}
          <span class="pill {request.status === 'Done' ? 'ok' : ''}">{request.status}</span>
        {/if}
        {#if buying?.id === request.id}
          <form class="buy" onsubmit={event => { event.preventDefault(); buy(); }}>
            <label class="field"><span>Actual cost <span class="hint">USD</span></span><input class="input" inputmode="decimal" placeholder="0.00" bind:value={buying.amount} /></label>
            <label class="btn"><Icon name="camera" size={15} />{buying.file ? buying.file.name : 'Scan invoice (fatoura)'}<input class="sr-only" type="file" accept="image/*,application/pdf" capture="environment" onchange={event => { buying.file = event.currentTarget.files?.[0] || null; }} /></label>
            <button class="btn primary" type="submit">Save purchase</button>
            {#if error}<span class="error">{error}</span>{/if}
          </form>
        {/if}
      </li>
    {:else}
      <li><div class="empty" style="width: 100%"><strong>{view === 'Open' ? 'No open requests' : 'Nothing here yet'}</strong>{view === 'Open' ? 'New requests from patients appear here.' : ''}</div></li>
    {/each}
  </ul>
  {/if}
</main>

{#if creating}
  <div class="scrim" onclick={closeCreate} aria-hidden="true"></div>
  <section class="dialog" use:dialogFocus={{ onClose: closeCreate }}>
    <header class="drawer-head"><div class="grow"><h2>New request</h2><p class="muted" style="margin-top: 4px">On behalf of a patient. Nothing is charged until it is bought.</p></div></header>
    <form class="drawer-body stack" id="new-request" onsubmit={event => { event.preventDefault(); if (run(state => createRequest(state, $state.snapshot(creating), me), 'Request added')) closeCreate(); }}>
      <label class="field"><span>Patient</span><select class="select" bind:value={creating.patientId}>{#each patients as patient}<option value={patient.id}>{patient.fullName}{patient.roomId ? `, room ${patient.roomId}` : ''}</option>{/each}</select></label>
      <div class="grid-3">
        <label class="field" style="grid-column: span 2"><span>Item</span><input class="input" bind:value={creating.item} placeholder="What do they need?" /></label>
        <label class="field"><span>Quantity</span><input class="input" type="number" min="1" max="20" bind:value={creating.quantity} /></label>
      </div>
      <label class="field"><span>Note <span class="hint">optional</span></span><input class="input" bind:value={creating.note} /></label>
      {#if error}<p class="error" role="alert">{error}</p>{/if}
    </form>
    <footer class="drawer-foot"><button class="btn" onclick={closeCreate}>Cancel</button><button class="btn primary" type="submit" form="new-request">Add request</button></footer>
  </section>
{/if}

{#if invoice}
  <div class="scrim" onclick={() => { invoice = null; }} aria-hidden="true"></div>
  <section class="dialog" use:dialogFocus={{ onClose: () => { invoice = null; } }}>
    <header class="drawer-head"><div class="grow"><h2>Upload invoice</h2><p class="muted" style="margin-top: 4px">Photograph the fatoura and link it to the patient.</p></div></header>
    <div class="drawer-body stack">
      <label class="field"><span>Patient</span><select class="select" bind:value={invoice.patientId}>{#each patients as patient}<option value={patient.id}>{patient.fullName}</option>{/each}</select></label>
      <label class="btn" style="width: max-content"><Icon name="camera" size={16} />{invoice.file ? invoice.file.name : 'Take photo or choose file'}<input class="sr-only" type="file" accept="image/*,application/pdf" capture="environment" onchange={event => { invoice.file = event.currentTarget.files?.[0] || null; }} /></label>
      <label class="field"><span>What it is for <span class="hint">optional</span></span><input class="input" bind:value={invoice.note} placeholder="For example: pharmacy" /></label>
      {#if error}<p class="error" role="alert">{error}</p>{/if}
    </div>
    <footer class="drawer-foot"><button class="btn" onclick={() => { invoice = null; }}>Cancel</button><button class="btn primary" onclick={saveInvoice}>Save invoice</button></footer>
  </section>
{/if}

<style>
  .buy { flex-basis: 100%; display: flex; align-items: flex-end; gap: 10px; flex-wrap: wrap; padding: 10px; margin-top: 6px; border-radius: var(--r-md); background: #fafbf9; border: 1px solid var(--line); }
  .buy .field { width: 160px; }
  .checkin-grid { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1.2fr); gap: 11px; align-items: start; }
  @media (max-width: 900px) { .checkin-grid { grid-template-columns: 1fr; } }
</style>
