<script>
  import Icon from '../Icon.svelte';
  import { act } from '../../lib/act.js';
  import SignaturePad from '../SignaturePad.svelte';
  import { db, session } from '../../lib/store.svelte.js';
  import { walletBalanceCents, walletTransactionsFor, formatCents, hasWallet } from '../../lib/wallet.js';
  import { staffName, canDo } from '../../lib/people.js';
  import { fmtDate, todayISO } from '../../lib/dates.js';
  import { say } from '../../lib/ui.svelte.js';

  let { patient } = $props();
  const me = session.staffId;
  const balance = $derived(walletBalanceCents(db, patient.id));
  const history = $derived(walletTransactionsFor(db, patient.id));
  const requests = $derived(db.requests.filter(item => item.patientId === patient.id).sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt))));
  // Family statements (Finance SOP 4.3): issued by Finance only, monthly or on request.
  const statements = $derived((db.statements || []).filter(item => item.patientId === patient.id).sort((a, b) => b.month.localeCompare(a.month) || String(b.issuedAt).localeCompare(String(a.issuedAt))));
  let month = $state(todayISO(session.now).slice(0, 7));
  let statementError = $state('');
  function issue() {
    statementError = '';
    try { act('issueStatement', patient.id, month); say('Statement issued'); } catch (e) { statementError = e.message; }
  }
  let entry = $state(null);
  let error = $state('');
  // Cash goes out only against the patient's signature (Finance SOP 4.2).
  let signing = $state(false);

  function save(signature) {
    error = '';
    try {
      const payload = { patientId: patient.id, amount: entry.amount, description: entry.description, signature };
      act(entry.kind === 'credit' ? 'walletDeposit' : 'walletPurchase', payload);
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
    <form class="panel panel-body stack" style="margin-top: 12px" onsubmit={event => { event.preventDefault(); if (entry.kind === 'purchase') signing = true; else save(); }}>
      <strong>{entry.kind === 'credit' ? 'Money received for this patient' : 'Item bought and handed over'}</strong>
      <div class="grid-2">
        <label class="field"><span>Amount <span class="hint">USD</span></span><input class="input" inputmode="decimal" bind:value={entry.amount} placeholder="0.00" /></label>
        <label class="field"><span>{entry.kind === 'credit' ? 'From' : 'What was bought'}</span><input class="input" bind:value={entry.description} /></label>
      </div>
      <div class="row">{#if error}<span class="error">{error}</span>{/if}<button class="btn dark" type="submit">{entry.kind === 'purchase' ? 'Patient signs' : 'Save'}</button><button class="btn ghost" type="button" onclick={() => { entry = null; }}>Cancel</button></div>
    </form>
  {/if}
  {#if signing}<SignaturePad title="Received from petty cash" signerName={patient.fullName} onclose={() => { signing = false; }} onsign={signature => { signing = false; save(signature); }} />{/if}

  <section class="panel" style="margin-top: 16px">
    <div class="panel-head"><h3>Family statements</h3>
      {#if canDo(me, 'issueStatement')}<div class="row" style="gap: 6px"><input class="input" type="month" aria-label="Statement month" bind:value={month} style="width: 160px" /><button class="btn sm dark" onclick={issue}>Issue statement</button></div>{/if}
    </div>
    {#if statementError}<p class="error" role="alert" style="margin: 0 16px 10px">{statementError}</p>{/if}
    <ul class="list">
      {#each statements as item (item.id)}
        <li style="display: block">
          <details>
            <summary><strong>{item.month}</strong><span class="faint"> issued {fmtDate(item.issuedAt)} by {staffName(item.issuedBy)}. Closing balance {formatCents(item.closingCents)}</span></summary>
            <table class="table" style="margin-top: 8px">
              <tbody>
                <tr><td>Opening balance</td><td class="num">{formatCents(item.openingCents)}</td></tr>
                <tr><td>Top-ups received</td><td class="num">+{formatCents(item.topUpsCents)}</td></tr>
                {#each item.disbursements as line}<tr><td>{fmtDate(line.date)}, {line.description}</td><td class="num">−{formatCents(line.amountCents)}</td></tr>{/each}
                <tr><td><strong>Closing balance</strong></td><td class="num"><strong>{formatCents(item.closingCents)}</strong></td></tr>
              </tbody>
            </table>
          </details>
        </li>
      {:else}<li class="faint">No statement issued yet. Finance issues one each month, and on request.</li>{/each}
    </ul>
  </section>

  <div class="wallet-grid">
    <section class="panel">
      <div class="panel-head"><h3>History</h3></div>
      <ul class="list">
        {#each history as item (item.id)}
          <li><div class="grow"><div class="title">{item.description}</div><div class="sub">{fmtDate(item.date)}, {staffName(item.recordedBy)}{item.signedBy ? `, signed by ${item.signedBy}` : ''}</div></div>
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
