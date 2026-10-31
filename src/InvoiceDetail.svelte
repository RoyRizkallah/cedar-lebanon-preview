<script>
  import { dialogFocus } from './dialogFocus.js';
  import Icon from './Icon.svelte';
  import { prettyDate } from './data.js';

  export let invoice;
  export let onClose = () => {};
  export let onPayment = () => {};
  export let onEdit = () => {};

  $: paid = Number(invoice.paid) || 0;
  $: balance = invoice.status === 'Void' ? 0 : Math.max(0, Number(invoice.amount) - paid);
  $: progress = Math.min(100, Math.round(paid / Math.max(1, invoice.amount) * 100));

  function exportPayments() {
    const rows = [['date','amount_usd','method','reference','note'],...(invoice.payments || []).map(item => [item.date,item.amount,item.method,item.reference,item.note])];
    const csv = rows.map(row => row.map(value => `"${String(value ?? '').replaceAll('"','""')}"`).join(',')).join('\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = `${invoice.id}-payments.csv`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 60000);
  }
</script>

<div class="admission-overlay" role="presentation" on:click={(event) => { if (event.target === event.currentTarget) onClose(); }}>
  <aside class="admission-drawer invoice-drawer" use:dialogFocus={{onClose}} aria-label="Invoice detail">
    <div class="admission-head"><div><div class="record-kicker">FINANCE / {invoice.id}</div><h2>Invoice detail</h2><p>{invoice.patient} · {invoice.payer}</p></div><button class="icon-btn" aria-label="Close invoice detail" on:click={onClose}><Icon name="close"/></button></div>
    <div class="admission-body">
      <div class="invoice-detail-total"><div><span>OPEN BALANCE</span><strong>${balance.toLocaleString()}</strong><small>Due {prettyDate(invoice.due, {day:'numeric',month:'long',year:'numeric'})}</small></div><span class:paid={invoice.status === 'Paid'} class="invoice-detail-status">{invoice.status}</span></div>
      <div class="invoice-detail-progress"><span style:width={progress + '%'}></span></div><div class="invoice-progress-label"><span>Paid ${paid.toLocaleString()}</span><span>Total ${invoice.amount.toLocaleString()}</span></div>
      <section class="admission-section"><div class="admission-section-head"><div><span>01 / ARRANGEMENT</span><h3>Funding details</h3></div>{#if invoice.status !== 'Void'}<button class="text-link" on:click={onEdit}>Edit invoice</button>{/if}</div><div class="invoice-detail-grid"><div><span>Patient reference</span><strong>{invoice.patient}</strong></div><div><span>Payer</span><strong>{invoice.payer}</strong></div><div><span>Funding</span><strong>{invoice.fundingType}</strong></div><div><span>Payment terms</span><strong>{invoice.paymentTerms}</strong></div><div><span>Finance owner</span><strong>{invoice.owner}</strong></div><div><span>Due date</span><strong>{prettyDate(invoice.due)}</strong></div></div><p class="invoice-description">{invoice.description}</p></section>
      <section class="admission-section"><div class="admission-section-head"><div><span>02 / TRANSACTIONS</span><h3>Payment history</h3></div><button class="text-link" on:click={exportPayments}>Export CSV</button></div><div class="invoice-payments">{#each invoice.payments || [] as item}<div><span class="invoice-payment-mark"><Icon name="wallet" size={15}/></span><span><strong>${Number(item.amount).toLocaleString()} · {item.method}</strong><small>{prettyDate(item.date)} · {item.reference}{item.note ? ` · ${item.note}` : ''}</small></span></div>{:else}<p class="record-empty">No payments recorded yet.</p>{/each}</div></section>
      {#if balance > 0 && invoice.status !== 'Void'}<button class="btn btn-primary" on:click={onPayment}>Record a payment <Icon name="arrow" size={14}/></button>{/if}
      <p class="record-safety-note">Fictional USD ledger. Payment entries are browser-local demo records, not processed transactions.</p>
    </div>
  </aside>
</div>
