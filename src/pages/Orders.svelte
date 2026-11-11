<script>
  import { act } from '../lib/act.js';
  import Icon from '../components/Icon.svelte';
  import { db, session } from '../lib/store.svelte.js';
  import { ORDER_KINDS, APPROVAL_LIMIT, raiseOrder, approveOrder, rejectOrder, receiveOrder, setKitchenCeiling, kitchenSpend } from '../lib/orders.js';
  import { staffName, canDo } from '../lib/people.js';
  import { fmtDate, todayISO } from '../lib/dates.js';
  import { putFile, openFile } from '../lib/files.js';
  import { dialogFocus } from '../lib/dialogFocus.js';
  import { say } from '../lib/ui.svelte.js';

  const me = session.staffId;
  const raises = canDo(me, 'raiseOrder');
  const approves = canDo(me, 'approveOrder');
  let view = $state('Open');
  let dialog = $state(null);
  let error = $state('');

  const orders = $derived((db.orders || []).slice().sort((a, b) => String(b.at).localeCompare(String(a.at))));
  const shown = $derived(orders.filter(item => view === 'All' || (view === 'Open' ? ['Awaiting approval', 'Approved'].includes(item.status) : ['Received', 'Rejected'].includes(item.status))));
  const waiting = $derived(orders.filter(item => item.status === 'Awaiting approval'));
  const spent = $derived(kitchenSpend(db, session.now));
  const ceiling = $derived(db.kitchenCeiling?.amount || 0);
  const usd = value => `$${Number(value).toLocaleString('en-US')}`;
  const TONE = { 'Awaiting approval': 'warn', Approved: '', Received: 'ok', Rejected: 'urgent' };

  function run(action, message) {
    error = '';
    try { const result = action(); if (message) say(message); return result ?? true; } catch (e) { error = e.message; return null; }
  }
  async function save() {
    const d = $state.snapshot(dialog);
    let ok;
    if (d.type === 'raise') ok = run(() => act('raiseOrder', d), 'Order raised');
    else if (d.type === 'ceiling') ok = run(() => act('setKitchenCeiling', d.amount), 'Kitchen ceiling set');
    else if (d.type === 'reject') ok = run(() => act('rejectOrder', d.id, d.reason), 'Order not approved');
    else {
      const stored = dialog.file ? await putFile(dialog.file) : { id: '', name: '' };
      ok = run(() => act('receiveOrder', d.id, { amount: d.amount, fileId: stored.id, fileName: stored.name }), 'Received, receipt attached');
    }
    if (ok) dialog = null;
  }
</script>

<main class="content wide">
  <div class="page-head">
    <div><h1>Orders</h1><p>Every purchase in one register. Up to ${APPROVAL_LIMIT} the sub-lead goes ahead; above that, Amer approves before anything is bought. Each order closes with its receipt.</p></div>
    {#if raises}<div class="actions"><button class="btn primary" onclick={() => { error = ''; dialog = { type: 'raise', item: '', supplier: '', amount: '', kind: me === 'shady' ? 'Kitchen' : 'Maintenance' }; }}><Icon name="plus" size={16} />Raise order</button></div>{/if}
  </div>

  <div class="stats" style="margin-bottom: 18px">
    <div class="stat"><div class="label">Waiting for Amer</div><div class="value">{waiting.length}</div></div>
    <div class="stat"><div class="label">Kitchen this week</div><div class="value">{usd(spent)}{#if ceiling}<small> of {usd(ceiling)}</small>{/if}</div>
      {#if approves}<button class="btn sm ghost" style="margin-top: 6px" onclick={() => { error = ''; dialog = { type: 'ceiling', amount: ceiling || '' }; }}>{ceiling ? 'Change ceiling' : 'Set weekly ceiling'}</button>{/if}
    </div>
    <div class="stat"><div class="label">Received this month</div><div class="value">{orders.filter(item => item.status === 'Received' && item.date.slice(0, 7) === todayISO(session.now).slice(0, 7)).length}</div></div>
  </div>

  <nav class="tabs" aria-label="Order views" style="margin-bottom: 14px">
    {#each ['Open', 'Closed', 'All'] as option}<button class="tab-link" aria-current={view === option ? 'page' : undefined} onclick={() => { view = option; }}>{option}</button>{/each}
  </nav>
  {#if error && !dialog}<p class="error" role="alert" style="margin-bottom: 12px">{error}</p>{/if}

  <div class="panel table-wrap">
    <table class="table cards">
      <thead><tr><th>Date</th><th>Order</th><th>Kind</th><th>Cost</th><th>Approval</th><th>Status</th><th></th></tr></thead>
      <tbody>
        {#each shown as order (order.id)}
          <tr>
            <td data-label="Date" class="num">{fmtDate(order.date)}</td>
            <td class="lead-cell"><strong>{order.item}</strong><div class="faint" style="font-size: 12.5px">{order.supplier || 'Supplier not named'}, raised by {staffName(order.requestedBy)}</div></td>
            <td data-label="Kind">{order.kind}</td>
            <td data-label="Cost" class="num">{usd(order.amount)}{#if order.paid}<div class="faint" style="font-size: 12.5px">paid {usd(order.paid)}</div>{/if}</td>
            <td data-label="Approval" style="font-size: 13px">{order.status === 'Rejected' ? `Not approved: ${order.rejectReason}` : order.approval || 'Needs Amer (over $200)'}</td>
            <td data-label="Status"><span class="pill {TONE[order.status]}">{order.status}</span></td>
            <td>
              <div class="row" style="gap: 6px; justify-content: flex-end">
                {#if order.status === 'Awaiting approval' && approves}
                  <button class="btn sm dark" onclick={() => run(() => act('approveOrder', order.id), 'Order approved')}>Approve</button>
                  <button class="btn sm ghost" onclick={() => { error = ''; dialog = { type: 'reject', id: order.id, reason: '' }; }}>Decline</button>
                {:else if order.status === 'Approved' && (order.requestedBy === me || raises)}
                  <button class="btn sm" onclick={() => { error = ''; dialog = { type: 'receive', id: order.id, amount: order.amount, file: null }; }}>Received</button>
                {:else if order.receiptFileId}
                  <button class="btn sm ghost" onclick={() => openFile(order.receiptFileId)}>Receipt</button>
                {/if}
              </div>
            </td>
          </tr>
        {:else}
          <tr><td colspan="7" class="faint">No orders here.</td></tr>
        {/each}
      </tbody>
    </table>
  </div>
</main>

{#if dialog}
  <div class="scrim" onclick={() => { dialog = null; }} aria-hidden="true"></div>
  <form class="dialog" use:dialogFocus={{ onClose: () => { dialog = null; } }} onsubmit={event => { event.preventDefault(); save(); }}>
    <header class="drawer-head"><div class="grow"><h2>{dialog.type === 'raise' ? 'Raise an order' : dialog.type === 'ceiling' ? 'Weekly kitchen ceiling' : dialog.type === 'reject' ? 'Decline the order' : 'Goods received'}</h2>
      {#if dialog.type === 'raise'}<p class="muted" style="margin-top: 4px">Over ${APPROVAL_LIMIT}, Amer is asked to approve before the purchase.</p>{/if}
      {#if dialog.type === 'ceiling'}<p class="muted" style="margin-top: 4px">Kitchen orders inside this weekly amount need no separate approval. Reviewed monthly.</p>{/if}
    </div></header>
    <div class="drawer-body stack">
      {#if dialog.type === 'raise'}
        <label class="field"><span>What is being ordered</span><input class="input" bind:value={dialog.item} data-autofocus /></label>
        <div class="grid-2">
          <label class="field"><span>Kind</span><select class="select" bind:value={dialog.kind}>{#each ORDER_KINDS as kind}<option>{kind}</option>{/each}</select></label>
          <label class="field"><span>Estimated cost <span class="hint">USD</span></span><input class="input" type="number" min="0" step="1" bind:value={dialog.amount} /></label>
        </div>
        <label class="field"><span>Supplier</span><input class="input" bind:value={dialog.supplier} placeholder="Wissam's Beirut run, a local shop…" /></label>
      {:else if dialog.type === 'ceiling'}
        <label class="field"><span>Ceiling per week <span class="hint">USD</span></span><input class="input" type="number" min="0" step="50" bind:value={dialog.amount} data-autofocus /></label>
      {:else if dialog.type === 'reject'}
        <label class="field"><span>Reason</span><input class="input" bind:value={dialog.reason} data-autofocus /></label>
      {:else}
        <label class="field"><span>Actually paid <span class="hint">USD</span></span><input class="input" type="number" min="0" step="0.01" bind:value={dialog.amount} /></label>
        <label class="btn"><Icon name="camera" size={15} />{dialog.file ? dialog.file.name : 'Photograph the receipt'}<input class="sr-only" type="file" accept="image/*,application/pdf" capture="environment" onchange={event => { dialog.file = event.currentTarget.files?.[0] || null; }} /></label>
      {/if}
      {#if error}<p class="error" role="alert">{error}</p>{/if}
    </div>
    <footer class="drawer-foot"><button class="btn" type="button" onclick={() => { dialog = null; }}>Cancel</button><button class="btn primary" type="submit">Save</button></footer>
  </form>
{/if}
