<script>
  import Icon from '../components/Icon.svelte';
  import { db, session, commit } from '../lib/store.svelte.js';
  import { RESIDENTS } from '../lib/people.js';
  import { walletBalanceCents, walletTransactionsFor, formatCents } from '../lib/wallet.js';
  import { createRequest, cancelRequest } from '../lib/requests.js';
  import { upcomingFor } from '../lib/scheduling.js';
  import { fmtDate, fmtDay, todayISO } from '../lib/dates.js';
  import { say } from '../lib/ui.svelte.js';

  let { args = [] } = $props();
  const me = session.staffId;
  const patientId = RESIDENTS.find(person => person.id === me)?.patientId;
  const patient = $derived(db.patients.find(item => item.id === patientId));
  const balance = $derived(walletBalanceCents(db, patientId));
  const history = $derived(walletTransactionsFor(db, patientId).filter(item => item.type !== 'opened').slice(0, 8));
  const requests = $derived(db.requests.filter(item => item.patientId === patientId).sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt))));
  const next = $derived(upcomingFor(db, patientId, todayISO(session.now)).slice(0, 4));
  let item = $state('');
  let quantity = $state(1);
  let note = $state('');
  let error = $state('');

  function ask() {
    error = '';
    try { commit(state => createRequest(state, { patientId, item, quantity, note }, me)); item = ''; quantity = 1; note = ''; say('Request sent to the support team'); } catch (e) { error = e.message; }
  }
  const STATUS = { Open: ['warn', 'Waiting'], Done: ['ok', 'Bought'], Cancelled: ['', 'Cancelled'] };
</script>

<main class="content">
  {#if patient}
    <div class="page-head"><div><h1>Hello, {patient.fullName.split(' ')[0]}</h1><p>Your wallet, your requests and what is coming up. Nothing here is shared with other residents.</p></div></div>

    <div class="home-grid">
      <section class="wallet-card">
        <span class="label">Available in your wallet</span>
        <strong class="num">{formatCents(balance)}</strong>
        <span class="hint">Your family can add money through the front desk. Items are paid from here when they are bought for you.</span>
      </section>

      <section class="panel">
        <div class="panel-head"><h3>Ask for something</h3></div>
        <form class="panel-body stack" onsubmit={event => { event.preventDefault(); ask(); }}>
          <div class="grid-3">
            <label class="field" style="grid-column: span 2"><span>What do you need?</span><input class="input" bind:value={item} placeholder="For example: phone charger" /></label>
            <label class="field"><span>How many</span><input class="input" type="number" min="1" max="20" bind:value={quantity} /></label>
          </div>
          <label class="field"><span>Anything else <span class="hint">optional</span></span><input class="input" bind:value={note} /></label>
          <div class="row">{#if error}<span class="error">{error}</span>{/if}<button class="btn primary" type="submit" style="margin-left: auto">Send request</button></div>
        </form>
      </section>
    </div>

    <div class="home-grid" style="margin-top: 16px">
      <section class="panel">
        <div class="panel-head"><h3>My requests</h3></div>
        <ul class="list">
          {#each requests as request (request.id)}
            <li>
              <div class="grow"><div class="title">{request.quantity} × {request.item}</div><div class="sub">Asked {fmtDate(request.createdAt)}{request.amountCents ? `, cost ${formatCents(request.amountCents)}` : ''}</div></div>
              <span class="pill {STATUS[request.status][0]}">{STATUS[request.status][1]}</span>
              {#if request.status === 'Open'}<button class="btn sm ghost" onclick={() => { commit(state => cancelRequest(state, request.id, me)); say('Request cancelled'); }}>Cancel</button>{/if}
            </li>
          {:else}<li class="faint">You have not asked for anything yet.</li>{/each}
        </ul>
      </section>
      <section class="panel">
        <div class="panel-head"><h3>Wallet history</h3></div>
        <ul class="list">
          {#each history as entry (entry.id)}
            <li><div class="grow"><div class="title">{entry.description}</div><div class="sub">{fmtDate(entry.date)}</div></div><strong class="num" style:color={entry.type === 'credit' ? 'var(--ok)' : ''}>{entry.type === 'credit' ? '+' : '−'}{formatCents(entry.amountCents)}</strong></li>
          {:else}<li class="faint">No money in or out yet.</li>{/each}
        </ul>
      </section>
    </div>

    {#if next.length}
      <section class="panel" style="margin-top: 16px">
        <div class="panel-head"><h3>Coming up</h3></div>
        <ul class="list">{#each next as item (item.id)}<li><Icon name="calendar" size={16} /><div class="grow"><div class="title">{item.service === 'Group' ? item.title : item.service}</div><div class="sub">{fmtDay(item.date)} at {item.start}</div></div></li>{/each}</ul>
      </section>
    {/if}
  {/if}
</main>

<style>
  .home-grid { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1.4fr); gap: 11px; }
  .wallet-card { position: relative; overflow: hidden; display: flex; flex-direction: column; gap: 8px; padding: 20px; border-radius: var(--r-lg); background: var(--hero); color: var(--on-ink); box-shadow: var(--shadow-2); }
  .wallet-card::after { content: ''; position: absolute; right: -60px; top: -60px; width: 220px; height: 220px; border-radius: 50%; background: radial-gradient(circle, rgb(124 252 0 / 0.33), transparent 70%); }
  .wallet-card .label { color: var(--on-ink-2); font-weight: 600; }
  .wallet-card strong { font: 800 52px/1 var(--font); color: var(--lime); letter-spacing: -0.04em; }
  .wallet-card .hint { color: var(--on-ink-2); font-size: 13px; margin-top: auto; }
  @media (max-width: 900px) { .home-grid { grid-template-columns: 1fr; } }
</style>
