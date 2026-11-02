<script>
  import Icon from '../Icon.svelte';
  import { db, session, commit } from '../../lib/store.svelte.js';
  import { walletBalanceCents, walletTransactionsFor, addWalletDeposit, addWalletPurchase, formatCents, hasWallet } from '../../lib/wallet.js';
  import { staffName, canDo } from '../../lib/people.js';
  import { fmtDate } from '../../lib/dates.js';
  import { say } from '../../lib/ui.svelte.js';

  let { patient } = $props();
  const me = session.staffId;
  const balance = $derived(walletBalanceCents(db, patient.id));
  const history = $derived(walletTransactionsFor(db, patient.id));
  const requests = $derived(db.requests.filter(item => item.patientId === patient.id).sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt))));
  let entry = $state(null);
  let error = $state('');

  function save() {
    error = '';
    try {
      const payload = { patientId: patient.id, amount: entry.amount, description: entry.description, recordedBy: me };
      commit(state => (entry.kind === 'credit' ? addWalletDeposit : addWalletPurchase)(state, payload));
      say(entry.kind === 'credit' ? 'Top-up recorded' : 'Purchase recorded');
      entry = null;
    } catch (e) { error = e.message; }
  }
</script>

{#if !hasWallet(db, patient.id)}
  <div class="panel empty"><strong>No wallet</strong>A wallet is created automatically when a patient is admitted.</div>
{:else}
  <div class="wallet-top panel">
    <div><p class="muted">Available balance</p><p class="balance num">{formatCents(balance)}</p></div>
    <div class="row wrap">
      {#if canDo(me, 'topUpWallet')}<button class="btn primary" onclick={() => { error = ''; entry = { kind: 'credit', amount: '', description: 'Family deposit' }; }}><Icon name="plus" size={16} />Record top-up</button>{/if}
      {#if canDo(me, 'pettyCash')}<button class="btn" onclick={() => { error = ''; entry = { kind: 'purchase', amount: '', description: '' }; }}>Record purchase</button>{/if}
      {#if canDo(me, 'createRequest')}<a class="btn" href={`#/requests/new/${patient.id}`}>New request</a>{/if}
    </div>
  </div>

  {#if entry}
    <form class="panel panel-body stack" style="margin-top: 12px" onsubmit={event => { event.preventDefault(); save(); }}>
      <strong>{entry.kind === 'credit' ? 'Money received for this patient' : 'Item bought and handed over'}</strong>
      <div class="grid-2">
        <label class="field"><span>Amount <span class="hint">USD</span></span><input class="input" inputmode="decimal" bind:value={entry.amount} placeholder="0.00" /></label>
        <label class="field"><span>{entry.kind === 'credit' ? 'From' : 'What was bought'}</span><input class="input" bind:value={entry.description} /></label>
      </div>
      <div class="row">{#if error}<span class="error">{error}</span>{/if}<button class="btn dark" type="submit">Save</button><button class="btn ghost" type="button" onclick={() => { entry = null; }}>Cancel</button></div>
    </form>
  {/if}

  <div class="wallet-grid">
    <section class="panel">
      <div class="panel-head"><h3>History</h3></div>
      <ul class="list">
        {#each history as item (item.id)}
          <li><div class="grow"><div class="title">{item.description}</div><div class="sub">{fmtDate(item.date)}, {staffName(item.recordedBy)}</div></div>
            <strong class="num" style:color={item.type === 'credit' ? 'var(--ok)' : ''}>{item.type === 'opened' ? '—' : `${item.type === 'credit' ? '+' : '−'}${formatCents(item.amountCents)}`}</strong></li>
        {/each}
      </ul>
    </section>
    <section class="panel">
      <div class="panel-head"><h3>Requests</h3><a class="faint" style="font-size: 13px" href="#/requests">All requests</a></div>
      <ul class="list">
        {#each requests as item (item.id)}
          <li><div class="grow"><div class="title">{item.quantity} × {item.item}</div><div class="sub">{fmtDate(item.createdAt)}, {staffName(item.createdBy)}</div></div><span class="pill {item.status === 'Done' ? 'ok' : item.status === 'Open' ? 'warn' : ''}">{item.status}</span></li>
        {:else}<li class="faint">No requests.</li>{/each}
      </ul>
    </section>
  </div>
{/if}

<style>
  .wallet-top { display: flex; align-items: center; justify-content: space-between; gap: 16px; padding: 20px 22px; flex-wrap: wrap; }
  .balance { font: 600 34px/1.1 var(--font-display); letter-spacing: -0.02em; margin-top: 4px; }
  .wallet-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 16px; margin-top: 16px; }
  @media (max-width: 800px) { .wallet-grid { grid-template-columns: 1fr; } }
</style>
