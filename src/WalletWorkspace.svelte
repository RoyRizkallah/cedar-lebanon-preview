<script>
  import { walletBalanceCents, walletTransactionsFor, walletOrdersFor } from './wallet.js';
  import { dialogFocus } from './dialogFocus.js';
  import './wallet.css';

  export let data;
  export let role;
  export let staff;
  export let focusPatient = '';
  export let page = 'wallets';
  export let onDeposit = () => false;
  export let onPurchase = () => false;
  export let onOpenPatient = () => {};
  export let onCreateOrder = () => false;
  export let onCancelOrder = () => false;
  export let onFulfillOrder = () => false;
  export let onDeclineOrder = () => false;

  let patientId = '';
  let amount = '';
  let description = '';
  let note = '';
  let formError = '';
  let notice = '';
  let entryType = '';
  let orderDialog = '';
  let activeOrderId = '';
  let requestItem = '';
  let requestQuantity = 1;
  let requestNote = '';
  let orderAmount = '';
  let orderError = '';
  let orderFilter = 'All statuses';
  let orderSearch = '';

  $: isResident = role === 'Resident';
  $: isRsa = role === 'RSA';
  $: isFinance = role === 'Finance' || role === 'Director';
  $: resident = isResident ? data.patients.find(item => item.id === staff?.patientId && item.program === 'Residential' && item.status !== 'Archived') : null;
  $: patients = isResident ? (resident ? [resident] : [])
    : isRsa ? data.patients.filter(item => item.program === 'Residential' && item.rsa === staff?.assignment && item.status !== 'Archived')
      : isFinance ? data.patients.filter(item => item.program === 'Residential' && item.status !== 'Archived') : [];
  $: if (patients.length && !patients.some(item => item.id === patientId)) patientId = patients[0].id;
  $: if (focusPatient && patients.some(item => item.id === focusPatient)) patientId = focusPatient;
  $: selectedPatient = patients.find(item => item.id === patientId) || patients[0];
  $: transactions = isResident
    ? walletTransactionsFor(data, resident?.id)
    : selectedPatient ? walletTransactionsFor(data, selectedPatient.id) : [];
  $: totalFunds = patients.reduce((sum, patient) => sum + walletBalanceCents(data, patient.id), 0);
  $: totalPurchases = patients.reduce((sum, patient) => sum + walletTransactionsFor(data, patient.id).filter(item => item.type === 'purchase').length, 0);
  $: lastUpdated = transactions[0]?.date || '';
  $: projectedBalance = walletBalanceCents(data, patientId) + (entryType === 'credit' ? 1 : -1) * (Number(amount) || 0) * 100;
  $: insufficientFunds = entryType === 'purchase' && Number(amount) > 0 && projectedBalance < 0;
  $: canFulfillOrders = isRsa || role === 'Director';
  $: orders = isResident ? walletOrdersFor(data, resident?.id) : (data.walletOrders || []).filter(order => patients.some(patient => patient.id === order.patientId)).slice().sort((a,b) => String(b.requestedAt).localeCompare(String(a.requestedAt)));
  $: pendingOrders = orders.filter(order => order.status === 'Requested');
  $: visibleOrders = orders.filter(order => (orderFilter === 'All statuses' || order.status === orderFilter) && (!orderSearch.trim() || `${order.item} ${order.id} ${patientName(order.patientId)} ${order.note || ''}`.toLowerCase().includes(orderSearch.trim().toLowerCase())));
  $: activeOrder = orders.find(order => order.id === activeOrderId);
  $: orderBalanceAfter = walletBalanceCents(data, activeOrder?.patientId) - (Number(orderAmount) || 0) * 100;
  $: orderInsufficient = orderDialog === 'fulfill' && Number(orderAmount) > 0 && orderBalanceAfter < 0;

  function dollars(cents) { return '$' + (Number(cents || 0) / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
  function dateLabel(value) {
    if (!value) return '—';
    return new Date(String(value).slice(0,10) + 'T12:00:00').toLocaleDateString('en-LB', { day: 'numeric', month: 'short', year: 'numeric' });
  }
  function patientName(id) { return data.patients.find(patient => patient.id === id)?.name || id; }
  function openOrder(kind, order = null) { orderDialog = kind; activeOrderId = order?.id || ''; requestItem = ''; requestQuantity = 1; requestNote = ''; orderAmount = ''; orderError = ''; notice = ''; }
  function closeOrder() { orderDialog = ''; activeOrderId = ''; orderError = ''; }
  function saveOrder() {
    orderError = '';
    try {
      const accepted = orderDialog === 'request' ? onCreateOrder({ item: requestItem, quantity: requestQuantity, note: requestNote }) : orderDialog === 'fulfill' ? onFulfillOrder({ orderId: activeOrderId, amount: orderAmount, note: requestNote }) : onDeclineOrder({ orderId: activeOrderId, note: requestNote });
      if (accepted !== true) return;
      const wasRequest = orderDialog === 'request';
      notice = wasRequest ? 'Your request was sent to the Cedar team.' : orderDialog === 'fulfill' ? 'Order fulfilled and wallet updated.' : 'Request declined. The resident can see your note.';
      closeOrder();
      if (wasRequest) navigatePage('orders');
    } catch (error) { orderError = error?.message || 'This request could not be saved.'; }
  }
  function cancelOrder(order) {
    try { if (onCancelOrder({ orderId: order.id }) === true) notice = 'Request cancelled. Your wallet balance has not changed.'; }
    catch (error) { notice = error?.message || 'This request could not be cancelled.'; }
  }
  function navigatePage(next) {
    if (typeof location !== 'undefined') location.hash = next;
  }
  function startEntry(kind, id = '') {
    patientId = id || selectedPatient?.id || patients[0]?.id || '';
    amount = '';
    description = '';
    note = '';
    formError = '';
    notice = '';
    entryType = kind;
  }
  function closeEntry() { entryType = ''; formError = ''; }
  function saveEntry() {
    formError = '';
    notice = '';
    const payload = { patientId, amount, description, note };
    try {
      const accepted = entryType === 'purchase' ? onPurchase(payload) : onDeposit(payload);
      if (accepted !== true) return;
      notice = entryType === 'purchase' ? 'Purchase recorded and wallet balance updated.' : 'Wallet top-up recorded.';
      closeEntry();
    } catch (error) {
      formError = error?.message || 'This wallet entry could not be saved.';
    }
  }
</script>

<section class="wallet-workspace" data-wallet-role={role.toLowerCase()}>
  {#if notice}<div class="wallet-notice" role="status">{notice}</div>{/if}
  {#if isResident}
    <div class="wallet-page-intro">
      <div><span class="wallet-kicker">YOUR CEDAR STAY</span><h1>{page === 'orders' ? 'Your orders' : page === 'overview' ? 'Welcome back' : 'Your wallet'}<span class="wallet-serif">{resident?.name ? ', ' + resident.name.split(' ')[0] : ''}</span></h1><p>Keep track of your personal spending during your stay.</p></div>
      {#if resident}<button class="wallet-primary-button" type="button" on:click={() => openOrder('request')}>Request an item <span aria-hidden="true">＋</span></button>{:else}<span class="wallet-demo-chip">RESIDENT PREVIEW</span>{/if}
    </div>
    {#if resident}
      {#if page === 'overview'}
        <section class="wallet-hero wallet-resident-hero">
          <div><span>AVAILABLE BALANCE</span><strong>{dollars(walletBalanceCents(data, resident.id))}</strong><p>Your current spending balance at Cedar.</p></div>
          <div class="wallet-hero-mark" aria-hidden="true"><span>$</span></div>
        </section>
        <button class="wallet-request-banner" type="button" on:click={() => navigatePage('orders')}><span><strong>{pendingOrders.length ? `${pendingOrders.length} request${pendingOrders.length === 1 ? '' : 's'} with the Cedar team` : 'Something you need during your stay?'}</strong><small>{pendingOrders.length ? 'Follow the status of your requests in My orders.' : 'Send an item request online. Staff will confirm the cost when it is fulfilled.'}</small></span><span aria-hidden="true">→</span></button>
        <div class="wallet-resident-grid">
          <section class="wallet-panel wallet-activity-panel"><div class="wallet-panel-heading"><div><span class="wallet-kicker">RECENT ACTIVITY</span><h2>Your latest wallet activity</h2></div><button class="wallet-text-button" type="button" on:click={() => navigatePage('orders')}>View orders <span aria-hidden="true">→</span></button></div>
            {@render TransactionList(transactions, dollars, dateLabel, 'Your wallet activity will appear here.', true)}
          </section>
          <aside class="wallet-panel wallet-help-card"><span class="wallet-help-icon" aria-hidden="true">?</span><span class="wallet-kicker">HOW IT WORKS</span><h2>Request here, receive from the team</h2><p>Submit the item you need. Staff handles the purchase, confirms the actual cost, and updates your wallet when it is handed over. Speak with the team to add funds.</p><div class="wallet-help-foot"><span>Wallet overview</span><strong>Updated {dateLabel(transactions[0]?.date)}</strong></div></aside>
        </div>
      {:else if page === 'orders'}
        <section class="wallet-orders-summary"><div><span>AWAITING THE TEAM</span><strong>{pendingOrders.length}</strong></div><div><span>AVAILABLE BALANCE</span><strong>{dollars(walletBalanceCents(data, resident.id))}</strong></div><div><span>FULFILLED REQUESTS</span><strong>{orders.filter(order => order.status === 'Fulfilled').length}</strong></div></section>
        <section class="wallet-panel wallet-order-panel"><div class="wallet-panel-heading"><div><span class="wallet-kicker">YOUR REQUESTS</span><h2>Order status</h2><p>Your wallet is charged only after staff fulfills a request.</p></div><div class="wallet-order-filters"><label><span class="sr-only">Filter orders by status</span><select bind:value={orderFilter} aria-label="Filter orders by status"><option>All statuses</option><option>Requested</option><option>Fulfilled</option><option>Declined</option><option>Cancelled</option></select></label></div></div>{@render OrderList(visibleOrders, true)}</section>
        <section class="wallet-panel"><div class="wallet-panel-heading"><div><span class="wallet-kicker">PURCHASE HISTORY</span><h2>Items and services</h2><p>Every purchase shown here was manually recorded by Cedar staff.</p></div></div>
          {@render TransactionList(transactions, dollars, dateLabel, 'You do not have any recorded orders yet.', false, true)}
        </section>
        <p class="wallet-fine-print">Your balance changes when a staff member records a deposit or completes a purchase request.</p>
      {:else}
        <section class="wallet-hero wallet-resident-hero"><div><span>AVAILABLE BALANCE</span><strong>{dollars(walletBalanceCents(data, resident.id))}</strong><p>Funds currently available for personal orders.</p></div><div class="wallet-hero-mark" aria-hidden="true"><span>$</span></div></section>
        <section class="wallet-panel"><div class="wallet-panel-heading"><div><span class="wallet-kicker">WALLET HISTORY</span><h2>Money in and out</h2><p>Deposits add to your balance. Completed purchases are deducted.</p></div><span class="wallet-ledger-count">{transactions.length} entries</span></div>{@render TransactionList(transactions, dollars, dateLabel, 'Your wallet activity will appear here.')}</section>
        <p class="wallet-fine-print">Request an item using the button above. Speak with the Cedar team to add money to your wallet.</p>
      {/if}
    {:else}
      <div class="wallet-empty"><span class="wallet-empty-mark">C</span><h2>Resident view is not assigned</h2><p>This preview opens only for a resident linked to a Cedar patient record.</p></div>
    {/if}
  {:else}
    <div class="wallet-page-intro">
      <div><span class="wallet-kicker">{isRsa ? 'RESIDENT SUPPORT' : 'RESIDENT ACCOUNTS'}</span><h1>{isRsa ? 'Resident wallets' : 'Wallet ledger'}{' '}<span class="wallet-serif">& activity.</span></h1><p>{isRsa ? 'Record a resident’s completed request and keep the balance clear.' : 'Record manual wallet top-ups and review resident purchases.'}</p></div>
      {#if isFinance}<button class="wallet-primary-button" type="button" on:click={() => startEntry('credit')}><span aria-hidden="true">＋</span> Add funds</button>{/if}
    </div>
    <div class="wallet-stats">
      <article><span>RESIDENTS IN VIEW</span><strong>{patients.length}</strong><small>{isRsa ? 'Assigned to your daily support' : 'Active residential accounts'}</small></article>
      <article><span>COMBINED BALANCE</span><strong>{dollars(totalFunds)}</strong><small>Current fictional wallet balances</small></article>
      <article><span>RECORDED PURCHASES</span><strong>{totalPurchases}</strong><small>Manually fulfilled by Cedar staff</small></article>
    </div>
    {#if patients.length}
      <section class="wallet-panel wallet-order-panel"><div class="wallet-panel-heading"><div><span class="wallet-kicker">RESIDENT REQUESTS</span><h2>Order queue <span class="wallet-pending-count">{pendingOrders.length} pending</span></h2><p>{canFulfillOrders ? 'Confirm the actual total only after the item is bought and handed over.' : 'Review requests and their fulfillment status.'}</p></div><div class="wallet-order-filters"><input type="search" bind:value={orderSearch} aria-label="Search resident orders" placeholder="Find item or resident"/><select bind:value={orderFilter} aria-label="Filter orders by status"><option>All statuses</option><option>Requested</option><option>Fulfilled</option><option>Declined</option><option>Cancelled</option></select></div></div>{@render OrderList(visibleOrders, false)}</section>
      <div class="wallet-work-grid">
        <section class="wallet-panel wallet-resident-list"><div class="wallet-panel-heading"><div><span class="wallet-kicker">{isRsa ? 'YOUR ASSIGNED RESIDENTS' : 'ACTIVE ACCOUNTS'}</span><h2>{isRsa ? 'Residents in your care' : 'Resident balances'}</h2><p>{isRsa ? 'Select a resident to view recent activity and record a fulfilled request.' : 'Choose an account to inspect its manual activity.'}</p></div><label class="wallet-select-wrap"><span>ACCOUNT</span><select bind:value={patientId} aria-label="Choose a resident">{#each patients as patient}<option value={patient.id}>{patient.name} · {patient.id}</option>{/each}</select></label></div>
          {#if selectedPatient}
            <div class="wallet-selected-person"><div class="wallet-person-avatar">{selectedPatient.name.split(' ').map(word => word[0]).slice(0,2).join('')}</div><div class="wallet-person-info"><strong>{selectedPatient.name}</strong><span>{selectedPatient.id} <i>·</i> {selectedPatient.program || 'Cedar resident'}{#if selectedPatient.room && selectedPatient.room !== '—'} <i>·</i> Room {selectedPatient.room}{/if}</span></div><div class="wallet-person-balance"><span>AVAILABLE</span><strong>{dollars(walletBalanceCents(data, selectedPatient.id))}</strong></div></div>
            <div class="wallet-actions-row">{#if isRsa}<button class="wallet-primary-button" type="button" on:click={() => startEntry('purchase', selectedPatient.id)}>Record offline purchase <span aria-hidden="true">→</span></button>{:else if role === 'Director'}<button class="wallet-text-button" type="button" on:click={() => onOpenPatient(selectedPatient.id)}>Open resident record <span aria-hidden="true">→</span></button>{:else}<span>Wallet activity is managed from the finance desk.</span>{/if}{#if isRsa}<span>For a website request, use Fulfill request in the order queue above.</span>{/if}</div>
          {/if}
        </section>
        <section class="wallet-panel"><div class="wallet-panel-heading"><div><span class="wallet-kicker">ACCOUNT HISTORY</span><h2>{selectedPatient ? selectedPatient.name.split(' ')[0] + '’s wallet activity' : 'Wallet activity'}</h2><p>Deposits and completed purchases, newest first.</p></div><span class="wallet-ledger-count">{transactions.length} entries</span></div>{@render TransactionList(transactions, dollars, dateLabel, 'No wallet activity has been recorded for this resident.')}</section>
      </div>
      {#if entryType}
        <div class="wallet-dialog-backdrop" role="presentation" on:click={(event) => { if (event.target === event.currentTarget) closeEntry(); }}>
          <form class="wallet-dialog" use:dialogFocus={{onClose:closeEntry}} on:submit|preventDefault={saveEntry}>
            <div class="wallet-dialog-head"><div><span class="wallet-kicker">{entryType === 'purchase' ? 'RESIDENT REQUEST' : 'MANUAL TOP-UP'}</span><h2>{entryType === 'purchase' ? 'Record fulfilled purchase' : 'Add wallet funds'}</h2><p>{entryType === 'purchase' ? 'Use this when an item or service has been handed to the resident.' : 'Record a top-up that was received outside the website.'}</p></div><button class="wallet-close" type="button" aria-label="Close" on:click={closeEntry}>×</button></div>
            <div class="wallet-form-grid">
              <label class="wallet-field wallet-field-full"><span>RESIDENT</span><select bind:value={patientId} required>{#each patients as patient}<option value={patient.id}>{patient.name} · {patient.id}</option>{/each}</select></label>
              <label class="wallet-field"><span>AMOUNT (USD)</span><div class="wallet-amount-input"><b>$</b><input type="number" min="0.01" step="0.01" bind:value={amount} required placeholder="0.00" /></div></label>
              <div class="wallet-field"><span>{entryType === 'purchase' ? 'AVAILABLE AFTER' : 'CURRENT BALANCE'}</span><strong class="wallet-readout" aria-live="polite">{insufficientFunds ? 'Insufficient funds' : dollars(projectedBalance)}</strong></div>
              <label class="wallet-field wallet-field-full"><span>{entryType === 'purchase' ? 'ITEM OR SERVICE' : 'TOP-UP SOURCE'}</span><input bind:value={description} required maxlength="100" placeholder={entryType === 'purchase' ? 'e.g. Personal care pack' : 'e.g. Cash received at reception'} /></label>
              <label class="wallet-field wallet-field-full"><span>NOTE <small>OPTIONAL</small></span><textarea bind:value={note} rows="3" maxlength="240" placeholder={entryType === 'purchase' ? 'Who fulfilled the request? Add a short handoff detail.' : 'Add a short reference for the staff record.'}></textarea></label>
            </div>
            {#if formError}<p class="wallet-form-error" role="alert">{formError}</p>{/if}
            <div class="wallet-dialog-actions"><button class="wallet-secondary-button" type="button" on:click={closeEntry}>Cancel</button><button class="wallet-primary-button" type="submit" disabled={insufficientFunds}>{entryType === 'purchase' ? 'Confirm fulfilled order' : 'Record top-up'}</button></div>
          </form>
        </div>
      {/if}
    {:else}
      <div class="wallet-empty"><span class="wallet-empty-mark">C</span><h2>{isRsa ? 'No residents assigned yet' : 'No active wallet accounts'}</h2><p>{isRsa ? 'Once residents are assigned to you, their balances and requests will appear here.' : 'Active patient records will appear here when they are eligible for the wallet preview.'}</p></div>
    {/if}
  {/if}
</section>

{#if orderDialog}
  <div class="wallet-dialog-backdrop" role="presentation" on:click={event => { if (event.target === event.currentTarget) closeOrder(); }}>
    <form class="wallet-dialog wallet-order-dialog" use:dialogFocus={{onClose:closeOrder}} on:submit|preventDefault={saveOrder}>
      <div class="wallet-dialog-head"><div><span class="wallet-kicker">{orderDialog === 'request' ? 'RESIDENT REQUEST' : 'STAFF FULFILLMENT'}</span><h2>{orderDialog === 'request' ? 'What would you like?' : orderDialog === 'fulfill' ? 'Fulfill this request' : 'Decline this request'}</h2><p>{orderDialog === 'request' ? 'Send the details to your assigned support team. Nothing is deducted yet.' : orderDialog === 'fulfill' ? 'Record the actual total after the item is bought and handed over.' : 'Let the resident know why this item cannot be provided.'}</p></div><button class="wallet-close" type="button" aria-label="Close order form" on:click={closeOrder}>×</button></div>
      {#if orderDialog === 'request'}
        <div class="wallet-form-grid"><label class="wallet-field wallet-field-full"><span>ITEM OR SERVICE</span><input data-autofocus bind:value={requestItem} minlength="2" maxlength="100" required placeholder="e.g. Pellegrino sparkling water"/></label><label class="wallet-field"><span>QUANTITY</span><input type="number" min="1" max="20" step="1" bind:value={requestQuantity} required/></label><div class="wallet-field"><span>AVAILABLE WALLET BALANCE</span><strong class="wallet-readout">{dollars(walletBalanceCents(data, resident?.id))}</strong></div><label class="wallet-field wallet-field-full"><span>DETAILS <small>OPTIONAL</small></span><textarea bind:value={requestNote} rows="3" maxlength="300" placeholder="Size, preference, or anything the team should know"></textarea></label></div>
        <div class="wallet-order-explainer"><span aria-hidden="true">1 → 2 → 3</span><p>Send your request. Staff confirms availability and buys the item. The actual cost is deducted when it is handed over.</p></div>
      {:else if activeOrder}
        <div class="wallet-order-context"><span>{patientName(activeOrder.patientId)}</span><strong>{activeOrder.quantity} × {activeOrder.item}</strong>{#if activeOrder.note}<p>{activeOrder.note}</p>{/if}</div>
        <div class="wallet-form-grid">
          {#if orderDialog === 'fulfill'}<label class="wallet-field"><span>ACTUAL TOTAL (USD)</span><div class="wallet-amount-input"><b>$</b><input data-autofocus type="number" min="0.01" step="0.01" bind:value={orderAmount} required placeholder="0.00"/></div></label><div class="wallet-field"><span>BALANCE AFTER</span><strong class="wallet-readout" aria-live="polite">{orderInsufficient ? 'Insufficient funds' : dollars(orderBalanceAfter)}</strong></div>{/if}
          <label class="wallet-field wallet-field-full"><span>{orderDialog === 'decline' ? 'REASON FOR THE RESIDENT' : 'FULFILLMENT NOTE'}{#if orderDialog === 'fulfill'} <small>OPTIONAL</small>{/if}</span><textarea bind:value={requestNote} rows="3" minlength={orderDialog === 'decline' ? 3 : undefined} maxlength="240" required={orderDialog === 'decline'} placeholder={orderDialog === 'decline' ? 'e.g. Item unavailable today; please request an alternative.' : 'Optional handover detail or receipt reference'}></textarea></label>
        </div>
      {/if}
      {#if orderError}<p class="wallet-form-error" role="alert">{orderError}</p>{/if}
      <div class="wallet-dialog-actions"><button class="wallet-secondary-button" type="button" on:click={closeOrder}>Cancel</button><button class="wallet-primary-button" type="submit" disabled={orderInsufficient}>{orderDialog === 'request' ? 'Send request' : orderDialog === 'fulfill' ? 'Confirm fulfillment & deduct' : 'Decline request'}</button></div>
    </form>
  </div>
{/if}

{#snippet OrderList(list, residentView)}
  {#if list.length}
    <div class="wallet-order-list">
      {#each list as order (order.id)}
        <article class="wallet-order-card" data-order-id={order.id}>
          <div class="wallet-order-top"><span class="wallet-order-status" class:fulfilled={order.status === 'Fulfilled'} class:closed={order.status === 'Cancelled' || order.status === 'Declined'}>{order.status}</span><small>{dateLabel(order.requestedAt)}</small></div>
          <div class="wallet-order-content"><span class="wallet-order-quantity">{order.quantity}<small>QTY</small></span><div><h3>{order.item}</h3><span class="wallet-order-meta">{residentView ? 'Sent to the Cedar team' : patientName(order.patientId) + ' · ' + order.patientId}</span>{#if order.note}<p>{order.note}</p>{/if}{#if order.staffNote}<p class="wallet-order-staff-note"><strong>Team update:</strong> {order.staffNote}</p>{/if}</div>{#if order.status === 'Fulfilled'}<strong class="wallet-order-cost">{dollars(order.actualCostCents)}<small>Deducted from wallet</small></strong>{/if}</div>
          {#if order.status === 'Requested'}<div class="wallet-order-actions"><span>No funds deducted yet</span>{#if residentView}<button class="wallet-text-button wallet-cancel-order" type="button" on:click={() => cancelOrder(order)}>Cancel request</button>{:else if canFulfillOrders}<button class="wallet-secondary-button" type="button" on:click={() => openOrder('decline', order)}>Decline</button><button class="wallet-primary-button" type="button" on:click={() => openOrder('fulfill', order)}>Fulfill request <span aria-hidden="true">→</span></button>{/if}</div>{:else}<div class="wallet-order-closed-detail">{order.status === 'Fulfilled' ? `Handed over by ${order.fulfilledBy || 'Cedar staff'}` : order.status === 'Cancelled' ? 'Cancelled before purchase. Your wallet was not charged.' : 'Declined before purchase. Your wallet was not charged.'}</div>{/if}
        </article>
      {/each}
    </div>
  {:else}<div class="wallet-order-empty"><span aria-hidden="true">↗</span><strong>{orders.length ? 'No requests match this view' : residentView ? 'Your next request starts here' : 'No resident requests yet'}</strong><p>{orders.length ? 'Choose another status or clear the search to see more requests.' : residentView ? 'Request an item using the button above. You can follow its status here.' : 'Requests submitted by residents will appear here for the assigned support team.'}</p>{#if orders.length}<button class="wallet-text-button" type="button" on:click={() => { orderFilter = 'All statuses'; orderSearch = ''; }}>Clear filters</button>{/if}</div>{/if}
{/snippet}

{#snippet TransactionList(transactions, dollars, dateLabel, empty, compact = false, purchasesOnly = false)}
  {@const visible = purchasesOnly ? transactions.filter(item => item.type === 'purchase') : transactions}
  {#if visible.length}
    <div class:wallet-list-compact={compact} class="wallet-transaction-list">
      {#each visible as item (item.id)}
        <article class="wallet-transaction">
          <span class:wallet-icon-credit={item.type === 'credit'} class:wallet-icon-purchase={item.type === 'purchase'} class="wallet-transaction-icon" aria-hidden="true">{item.type === 'credit' ? '＋' : '↗'}</span>
          <div class="wallet-transaction-copy"><strong>{item.description}</strong><span>{dateLabel(item.date)} <i>·</i> {item.type === 'credit' ? 'Funds added' : 'Purchase'}{#if item.recordedBy} <i>·</i> {item.recordedBy}{/if}</span>{#if item.note && !compact}<small>{item.note}</small>{/if}</div>
          <strong class:wallet-amount-credit={item.type === 'credit'} class:wallet-amount-purchase={item.type === 'purchase'} class="wallet-transaction-amount">{item.type === 'credit' ? '+' : '−'}{dollars(item.amountCents)}</strong>
        </article>
      {/each}
    </div>
  {:else}<div class="wallet-empty-activity">{empty}</div>{/if}
{/snippet}
