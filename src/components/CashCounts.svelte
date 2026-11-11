<script>
  // The weekly petty-cash count (Structure & Delegation, Part 4). Georgio counts without seeing what the box should hold;
  // Omar or Melyssa, present at the count, signs it; Finance sees the expected amount and any variance, and Kteish reconciles.
  import { act } from '../lib/act.js';
  import { db, session } from '../lib/store.svelte.js';
  import { CASH_WITNESSES } from '../lib/cash.js';
  import { formatCents } from '../lib/wallet.js';
  import { staffName, canDo } from '../lib/people.js';
  import { fmtDate } from '../lib/dates.js';
  import { say } from '../lib/ui.svelte.js';

  const me = session.staffId;
  const counts = canDo(me, 'pettyCash');
  const finance = canDo(me, 'reconcileCash') || canDo(me, 'recordFinance');
  let draft = $state({ counted: '', witness: CASH_WITNESSES[0], note: '' });
  let reconciling = $state(null);
  let error = $state('');
  const list = $derived((db.cashCounts || []).slice().sort((a, b) => String(b.at).localeCompare(String(a.at))));
  const toSign = $derived(list.filter(item => item.witness === me && !item.witnessedAt));

  function run(change, message) {
    error = '';
    try { change(); say(message); return true; } catch (e) { error = e.message; return false; }
  }
  const tone = item => (item.varianceCents === undefined ? '' : item.varianceCents === 0 ? 'ok' : 'urgent');
</script>

<div class="stack" style="gap: 16px">
  {#if counts}
    <form class="panel panel-body stack" onsubmit={event => { event.preventDefault(); if (run(() => act('recordCashCount', $state.snapshot(draft)), 'Count recorded. The witness is asked to sign.')) draft = { counted: '', witness: draft.witness, note: '' }; }}>
      <strong>This week's count</strong>
      <p class="muted" style="margin: 0">Count the box with Omar or Melyssa present. Enter what you counted; Finance compares it with the ledger.</p>
      <div class="grid-2">
        <label class="field"><span>Cash counted <span class="hint">USD</span></span><input class="input" inputmode="decimal" placeholder="0.00" bind:value={draft.counted} /></label>
        <label class="field"><span>Witness present</span><select class="select" bind:value={draft.witness}>{#each CASH_WITNESSES as id}<option value={id}>{staffName(id)}</option>{/each}</select></label>
      </div>
      <label class="field"><span>Note</span><input class="input" bind:value={draft.note} /></label>
      <div class="row">{#if error}<span class="error">{error}</span>{/if}<button class="btn dark" type="submit">Record the count</button></div>
    </form>
  {/if}

  {#each toSign as item (item.id)}
    <p class="notice warn">Sign the count of {fmtDate(item.date)}: {formatCents(item.countedCents)} counted by {staffName(item.countedBy)} with you present.
      <button class="btn sm dark" style="margin-left: 8px" onclick={() => run(() => act('witnessCashCount', item.id), 'Count signed')}>Sign</button></p>
  {/each}

  <section class="panel table-wrap">
    <table class="table cards">
      <thead><tr><th>Date</th><th>Counted</th>{#if finance}<th>Expected</th><th>Difference</th>{/if}<th>Witness</th><th>Reconciled</th><th></th></tr></thead>
      <tbody>
        {#each list as item (item.id)}
          <tr>
            <td data-label="Date" class="num">{fmtDate(item.date)}</td>
            <td data-label="Counted" class="num">{formatCents(item.countedCents)}<div class="faint" style="font-size: 12px">by {staffName(item.countedBy)}</div></td>
            {#if finance}
              <td data-label="Expected" class="num">{formatCents(item.expectedCents)}</td>
              <td data-label="Difference"><span class="pill {tone(item)}">{item.varianceCents === 0 ? 'Matches' : `${formatCents(Math.abs(item.varianceCents))} ${item.varianceCents < 0 ? 'short' : 'over'}`}</span></td>
            {/if}
            <td data-label="Witness">{staffName(item.witness)}{item.witnessedAt ? ', signed' : ', not signed yet'}</td>
            <td data-label="Reconciled">{item.reconciledAt ? `${staffName(item.reconciledBy)}, ${fmtDate(item.reconciledAt)}` : 'Not yet'}</td>
            <td>{#if !item.reconciledAt && canDo(me, 'reconcileCash')}<button class="btn sm" onclick={() => { error = ''; reconciling = { id: item.id, note: '' }; }}>Reconcile</button>{/if}</td>
          </tr>
          {#if reconciling?.id === item.id}
            <tr><td colspan="7">
              <form class="row wrap" onsubmit={event => { event.preventDefault(); if (run(() => act('reconcileCashCount', item.id, reconciling.note), 'Count reconciled')) reconciling = null; }}>
                <input class="input" style="flex: 1; min-width: 220px" placeholder="Opening + top-ups − disbursements: what you found" bind:value={reconciling.note} />
                <button class="btn dark" type="submit">Save</button>
              </form>
            </td></tr>
          {/if}
        {:else}
          <tr><td colspan="7" class="faint">No counts yet.</td></tr>
        {/each}
      </tbody>
    </table>
  </section>
  {#if error && !counts}<p class="error" role="alert">{error}</p>{/if}
</div>
