<script>
  import CashCounts from '../components/CashCounts.svelte';
  import { act } from '../lib/act.js';
  import Icon from '../components/Icon.svelte';
  import Ring from '../components/Ring.svelte';
  import { db, session } from '../lib/store.svelte.js';
  import { canDo } from '../lib/people.js';
  import { ACCOUNTS, EXPENSE_CATEGORIES, PAYMENT_METHODS, PAYERS, usd, accountName, paidOf, openBalance, invoiceStatus, createInvoice, recordPayment, reversePayment, addBankLine, voidInvoice, createExpense, approveExpense, rejectExpense, payExpense, addManualEntry, buildJournal, trialBalance, totals, bankJournalLines, matchBank, payerBalances } from '../lib/finance.js';
  import { fmtDate, todayISO } from '../lib/dates.js';
  import { downloadCsv } from '../lib/csv.js';
  import { dialogFocus } from '../lib/dialogFocus.js';
  import { say } from '../lib/ui.svelte.js';

  let { args = [] } = $props();
  const me = session.staffId;
  const today = todayISO(session.now);
  const TABS = [['overview', 'Overview'], ['invoices', 'Invoices'], ['expenses', 'Bills'], ['cash', 'Petty cash'], ['ledger', 'Journal'], ['trial', 'Trial balance'], ['bank', 'Bank'], ['payers', 'Payers']];
  const tab = $derived(TABS.some(([id]) => id === args[0]) ? args[0] : 'overview');

  let query = $state('');
  let status = $state('');
  let dialog = $state(null);
  let error = $state('');

  const name = id => db.patients.find(patient => patient.id === id)?.fullName || id;
  const journal = $derived(buildJournal(db));
  const sums = $derived(totals(journal));
  const trial = $derived(trialBalance(journal));
  const invoices = $derived(db.finance.invoices.map(item => ({ ...item, state: invoiceStatus(item, today), open: openBalance(item), paid: paidOf(item), patient: name(item.patientId) }))
    .filter(item => (!status || item.state === status) && (!query.trim() || `${item.id} ${item.patient} ${item.payer} ${item.description}`.toLowerCase().includes(query.trim().toLowerCase())))
    .sort((a, b) => b.issued.localeCompare(a.issued) || b.id.localeCompare(a.id)));
  const allOpen = $derived(db.finance.invoices.filter(item => item.status !== 'Void'));
  const overdue = $derived(allOpen.filter(item => invoiceStatus(item, today) === 'Overdue'));
  const month = today.slice(0, 7);
  const uninvoiced = $derived(db.patients.filter(patient => patient.status === 'Admitted' && patient.monthlyAmount && !db.finance.invoices.some(item => item.patientId === patient.id && item.status !== 'Void' && item.issued.startsWith(month))));
  const bankLines = $derived(bankJournalLines(journal));
  const tone = state => ({ Paid: 'ok', 'Part-paid': 'info', Overdue: 'urgent', Due: 'warn', Void: '' })[state];

  function run(action, message) {
    error = '';
    try { const result = action(); if (message) say(message); return result ?? true; } catch (e) { error = e.message; return null; }
  }
  const close = () => { dialog = null; error = ''; };
  function invoiceAll() {
    let count = 0;
    run(() => { count = act('invoiceMonths', uninvoiced.map(patient => patient.id), month); });
    say(`${count} invoice${count === 1 ? '' : 's'} issued for this month`);
  }
  const exportInvoices = () => downloadCsv('cedar-invoices', [
    { label: 'Invoice', value: 'id' }, { label: 'Patient', value: 'patient' }, { label: 'Payer', value: 'payer' }, { label: 'Description', value: 'description' },
    { label: 'Issued', value: 'issued' }, { label: 'Due', value: 'due' }, { label: 'Amount', value: 'amount' }, { label: 'Paid', value: 'paid' }, { label: 'Open', value: 'open' }, { label: 'Status', value: 'state' }], invoices);
</script>

<main class="content wide">
  <div class="page-head">
    <div><h1>Finance</h1><p>Invoices come from each patient’s agreed monthly amount. Every receipt, bill and adjustment posts to a balanced journal.</p></div>
    <div class="actions">
      <button class="btn" onclick={() => { dialog = { kind: 'expense', supplier: '', description: '', category: '5100', amount: '', date: today }; }}><Icon name="document" size={16} />Record bill</button>
      <button class="btn primary" onclick={() => { dialog = { kind: 'invoice', patientId: db.patients.find(p => p.status === 'Admitted')?.id, payer: 'Self-pay', amount: '', description: 'Program fee' }; }}><Icon name="plus" size={16} />New invoice</button>
    </div>
  </div>

  <nav class="tabs" aria-label="Finance sections" style="margin-bottom: 22px">
    {#each TABS as [id, label] (id)}<a href={`#/finance/${id}`} aria-current={tab === id ? 'page' : undefined}>{label}</a>{/each}
  </nav>
  {#if error && !dialog}<p class="error" role="alert" style="margin-bottom: 12px">{error}</p>{/if}

  {#if tab === 'overview'}
    {@const billed = allOpen.reduce((sum, item) => sum + item.amount, 0)}
    {@const collected = allOpen.reduce((sum, item) => sum + paidOf(item), 0)}
    {@const aging = ['Due', 'Part-paid', 'Overdue'].map(state => [state, allOpen.filter(item => invoiceStatus(item, today) === state).reduce((sum, item) => sum + openBalance(item), 0)])}
    {@const agingTotal = aging.reduce((sum, [, value]) => sum + value, 0)}
    <div class="bento">
      <section class="owed">
        <div class="owed-main">
          <span class="eyebrow">Owed to Cedar</span>
          <div class="big num">{usd(sums.receivables)}</div>
          <p>{overdue.length} overdue invoices{overdue.length ? `, ${usd(overdue.reduce((sum, item) => sum + openBalance(item), 0))} past due` : ''}</p>
          {#if agingTotal}
            <div class="aging" role="img" aria-label="Open balance by status">
              {#each aging as [state, value] (state)}{#if value}<i class="a-{state.toLowerCase()}" style:flex-grow={value}></i>{/if}{/each}
            </div>
            <ul class="aging-key">
              {#each aging as [state, value] (state)}<li><i class="a-{state.toLowerCase()}"></i>{state}<strong class="num">{usd(value)}</strong></li>{/each}
            </ul>
          {/if}
        </div>
        <div class="owed-ring">
          <Ring value={billed ? Math.round((collected / billed) * 100) : null} size={113} stroke={13} label="Collected" />
          <span class="faint-ink">{usd(collected)} of {usd(billed)}</span>
        </div>
      </section>
      <div class="tile"><span class="t-icon"><Icon name="receipt" size={18} /></span><div class="label">Revenue billed</div><div class="value num">{usd(sums.revenue)}</div><div class="note">All time, net of voids</div></div>
      <div class="tile"><span class="t-icon warn"><Icon name="document" size={18} /></span><div class="label">Cedar owes</div><div class="value num">{usd(sums.payables)}</div><div class="note">Approved bills not yet paid</div></div>
      <div class="tile"><span class="t-icon"><Icon name="building" size={18} /></span><div class="label">Bank</div><div class="value num">{usd(sums.bank)}</div><div class="note">Cash on hand {usd(sums.cash)}</div></div>
      <div class="tile" class:neg={sums.net < 0}><span class="t-icon"><Icon name="chart" size={18} /></span><div class="label">Net result</div><div class="value num">{usd(sums.net)}</div><div class="note">Revenue less expenses</div></div>
    </div>
    <div class="two">
      <section class="panel month-card" class:todo={uninvoiced.length}>
        <div class="panel-head"><h3>This month’s invoices</h3>{#if uninvoiced.length}<button class="btn sm dark" onclick={invoiceAll}>Invoice {uninvoiced.length} patient{uninvoiced.length === 1 ? '' : 's'}</button>{/if}</div>
        <div class="panel-body">{#if uninvoiced.length}<p>{uninvoiced.map(p => p.fullName).join(', ')} {uninvoiced.length === 1 ? 'has' : 'have'} no program-fee invoice for this month yet.</p>{:else}<p class="muted"><Icon name="check-circle" size={16} /> Every patient in care is invoiced for this month.</p>{/if}</div>
      </section>
      <section class="panel">
        <div class="panel-head"><h3>Overdue</h3><a class="faint" href="#/finance/invoices" style="font-size: 13px">All invoices</a></div>
        <ul class="list overdue-list">
          {#each overdue as item (item.id)}<li><span class="avatar sm">{name(item.patientId).split(' ').map(part => part[0]).slice(0, 2).join('')}</span><div class="grow"><div class="title">{name(item.patientId)}</div><div class="sub">{item.id}, due {fmtDate(item.due)}, {item.payer}</div></div><strong class="num owe">{usd(openBalance(item))}</strong></li>
          {:else}<li class="faint">Nothing overdue.</li>{/each}
        </ul>
      </section>
    </div>

  {:else if tab === 'cash'}
    <CashCounts />
  {:else if tab === 'invoices'}
    <div class="toolbar">
      <input class="input" type="search" placeholder="Search invoice, patient or payer" aria-label="Search invoices" bind:value={query} />
      <select class="select" aria-label="Status" bind:value={status}><option value="">Any status</option>{#each ['Due', 'Part-paid', 'Overdue', 'Paid', 'Void'] as option}<option>{option}</option>{/each}</select>
      <button class="btn" style="margin-left: auto" onclick={exportInvoices}><Icon name="download" size={16} />Export CSV</button>
    </div>
    <div class="panel table-wrap">
      <table class="table cards">
        <thead><tr><th>Invoice</th><th>Patient</th><th>Payer</th><th>Due</th><th class="num">Amount</th><th class="num">Open</th><th>Status</th><th></th></tr></thead>
        <tbody>
          {#each invoices as item (item.id)}
            <tr>
              <td class="lead-cell"><strong>{item.id}</strong><div class="faint" style="font-size: 12px">{item.description}</div></td>
              <td data-label="Patient">{item.patient}</td><td data-label="Payer">{item.payer}</td><td data-label="Due">{fmtDate(item.due)}</td>
              <td data-label="Amount" class="num">{usd(item.amount)}</td><td data-label="Open" class="num">{usd(item.open)}</td>
              <td data-label="Status"><span class="pill {tone(item.state)}">{item.state}</span></td>
              <td><div class="row" style="justify-content: flex-end; gap: 6px">
                {#if item.open > 0}<button class="btn sm dark" onclick={() => { dialog = { kind: 'payment', id: item.id, amount: item.open, method: 'Bank transfer', date: today, reference: '' }; }}>Record payment</button>{/if}
                {#if item.paid > 0}<button class="btn sm ghost" onclick={() => { dialog = { kind: 'reverse', id: item.id, paymentId: (item.payments || []).filter(payment => !payment.reversed).at(-1)?.id, reason: '' }; }}>Reverse payment</button>{/if}
                {#if item.state !== 'Void' && !item.paid}<button class="btn sm ghost danger" onclick={() => { dialog = { kind: 'void', id: item.id, reason: '' }; }}>Void</button>{/if}
              </div></td>
            </tr>
          {:else}<tr><td colspan="8"><div class="empty"><strong>No invoices match</strong></div></td></tr>{/each}
        </tbody>
      </table>
    </div>

  {:else if tab === 'expenses'}
    <div class="panel table-wrap">
      <table class="table cards">
        <thead><tr><th>Supplier</th><th>Category</th><th>Due</th><th class="num">Amount</th><th>Status</th><th></th></tr></thead>
        <tbody>
          {#each [...db.finance.expenses].reverse() as item (item.id)}
            <tr>
              <td class="lead-cell"><strong>{item.supplier}</strong><div class="faint" style="font-size: 12px">{item.description}</div></td>
              <td data-label="Category">{accountName(item.category)}</td><td data-label="Due">{fmtDate(item.due)}</td><td data-label="Amount" class="num">{usd(item.amount)}</td>
              <td data-label="Status"><span class="pill {item.status === 'Paid' ? 'ok' : item.status === 'Approved' ? 'info' : item.status === 'Rejected' ? '' : 'warn'}" title={item.rejectReason || ''}>{item.status}</span></td>
              <td><div class="row" style="justify-content: flex-end">
                {#if item.status === 'Pending approval' && canDo(me, 'approveExpense')}<button class="btn sm ghost danger" onclick={() => { dialog = { kind: 'reject', id: item.id, reason: '' }; }}>Reject</button><button class="btn sm dark" onclick={() => run(() => act('approveExpense', item.id), 'Bill approved')}>Approve</button>{/if}
                {#if item.status === 'Approved'}<button class="btn sm dark" onclick={() => { dialog = { kind: 'bill-payment', id: item.id, amount: item.amount - item.payments.reduce((s, p) => s + p.amount, 0), method: 'Bank transfer', date: today, reference: '' }; }}>Pay</button>{/if}
              </div></td>
            </tr>
          {/each}
        </tbody>
      </table>
    </div>

  {:else if tab === 'ledger'}
    <div class="toolbar">
      <button class="btn" onclick={() => { dialog = { kind: 'manual', date: today, description: '', debitAccount: '5500', creditAccount: '1020', amount: '' }; }}><Icon name="plus" size={16} />Journal entry</button>
      <button class="btn" style="margin-left: auto" onclick={() => downloadCsv('cedar-journal', [{ label: 'Entry', value: 'id' }, { label: 'Date', value: 'date' }, { label: 'Type', value: 'kind' }, { label: 'Description', value: 'description' }, { label: 'Lines', value: item => item.lines.map(line => `${line.account} Dr ${line.debit} Cr ${line.credit}`).join('; ') }], journal)}><Icon name="download" size={16} />Export CSV</button>
    </div>
    <div class="panel table-wrap">
      <table class="table">
        <thead><tr><th>Date</th><th>Entry</th><th>Account</th><th class="num">Debit</th><th class="num">Credit</th></tr></thead>
        <tbody>
          {#each journal.slice(0, 80) as item (item.id)}
            {#each item.lines as line, index (index)}
              <tr class:first={index === 0}>
                <td>{index === 0 ? fmtDate(item.date) : ''}</td>
                <td>{#if index === 0}<strong>{item.description}</strong> <span class="pill" style="margin-left: 4px">{item.kind}</span>{/if}</td>
                <td>{line.account} {accountName(line.account)}</td>
                <td class="num">{line.debit ? usd(line.debit) : ''}</td><td class="num">{line.credit ? usd(line.credit) : ''}</td>
              </tr>
            {/each}
          {/each}
        </tbody>
      </table>
    </div>

  {:else if tab === 'trial'}
    <div class="panel table-wrap">
      <table class="table">
        <thead><tr><th>Account</th><th>Type</th><th class="num">Debit</th><th class="num">Credit</th><th class="num">Balance</th></tr></thead>
        <tbody>
          {#each trial as row (row.code)}<tr><td><strong>{row.code}</strong> {row.name}</td><td>{row.type}</td><td class="num">{usd(row.debit)}</td><td class="num">{usd(row.credit)}</td><td class="num">{usd(row.balance)}</td></tr>{/each}
          <tr class="total"><td colspan="2"><strong>Totals</strong></td><td class="num"><strong>{usd(trial.reduce((s, r) => s + r.debit, 0))}</strong></td><td class="num"><strong>{usd(trial.reduce((s, r) => s + r.credit, 0))}</strong></td><td class="num"><span class="pill ok">Balanced</span></td></tr>
        </tbody>
      </table>
    </div>

  {:else if tab === 'bank'}
    <div class="row between wrap" style="margin-bottom: 14px; gap: 10px"><p class="muted" style="margin: 0">Match each statement line to the journal entry it belongs to.</p>{#if canDo(me, 'recordFinance')}<button class="btn" onclick={() => { dialog = { kind: 'bank', date: today, description: '', amount: '', reference: '' }; }}><Icon name="plus" size={15} />Add statement line</button>{/if}</div>
    <div class="panel table-wrap">
      <table class="table cards">
        <thead><tr><th>Statement line</th><th>Date</th><th class="num">Amount</th><th>Matched to</th></tr></thead>
        <tbody>
          {#each db.finance.bankEntries as line (line.id)}
            <tr>
              <td class="lead-cell"><strong>{line.description}</strong><div class="faint" style="font-size: 12px">{line.reference}</div></td>
              <td data-label="Date">{fmtDate(line.date)}</td><td data-label="Amount" class="num" style:color={line.amount < 0 ? 'var(--urgent)' : 'var(--ok)'}>{usd(line.amount)}</td>
              <td data-label="Matched to">
                <select class="select" style="height: 34px; min-width: 240px" aria-label={`Match ${line.description}`} value={line.matchedJournalId} onchange={event => run(() => act('matchBank', line.id, event.currentTarget.value), event.currentTarget.value ? 'Matched' : 'Unmatched')}>
                  <option value="">Not matched</option>
                  {#each bankLines.filter(entry => entry.amount === line.amount || entry.id === line.matchedJournalId) as entry (entry.id)}<option value={entry.id}>{fmtDate(entry.date)}: {entry.description}</option>{/each}
                </select>
              </td>
            </tr>
          {/each}
        </tbody>
      </table>
    </div>

  {:else if tab === 'payers'}
    <div class="panel table-wrap">
      <table class="table cards">
        <thead><tr><th>Payer</th><th class="num">Invoices</th><th class="num">Billed</th><th class="num">Received</th><th class="num">Open</th><th class="num">Overdue</th></tr></thead>
        <tbody>
          {#each payerBalances(db, today) as row (row.name)}<tr><td class="lead-cell"><strong>{row.name}</strong></td><td data-label="Invoices" class="num">{row.invoices}</td><td data-label="Billed" class="num">{usd(row.billed)}</td><td data-label="Received" class="num">{usd(row.received)}</td><td data-label="Open" class="num">{usd(row.open)}</td><td data-label="Overdue" class="num" style:color={row.overdue ? 'var(--urgent)' : ''}>{usd(row.overdue)}</td></tr>{/each}
        </tbody>
      </table>
    </div>
  {/if}
</main>

{#if dialog}
  <div class="scrim" onclick={close} aria-hidden="true"></div>
  <form class="dialog" use:dialogFocus={{ onClose: close }} onsubmit={event => {
    event.preventDefault();
    const d = $state.snapshot(dialog);
    const done = {
      invoice: () => run(() => act('createInvoice', d), 'Invoice issued'),
      payment: () => run(() => act('recordPayment', d.id, d), 'Payment recorded'),
      void: () => run(() => act('voidInvoice', d.id, d.reason), 'Invoice voided'),
      reverse: () => run(() => act('reversePayment', d.id, d.paymentId, d.reason), 'Payment reversed'),
      reject: () => run(() => act('rejectExpense', d.id, d.reason), 'Bill rejected'),
      bank: () => run(() => act('addBankLine', d), 'Statement line added'),
      expense: () => run(() => act('createExpense', d), 'Bill recorded and sent to Amer and Rabih for approval'),
      'bill-payment': () => run(() => act('payExpense', d.id, d), 'Bill paid'),
      manual: () => run(() => act('addManualEntry', d), 'Journal entry posted')
    }[d.kind]();
    if (done) close();
  }}>
    <header class="drawer-head"><div class="grow"><h2>{({ invoice: 'New invoice', payment: 'Record payment', void: 'Void invoice', reverse: 'Reverse a payment', reject: 'Reject bill', bank: 'Add statement line', expense: 'Record bill', 'bill-payment': 'Pay bill', manual: 'Journal entry' })[dialog.kind]}</h2></div></header>
    <div class="drawer-body stack">
      {#if dialog.kind === 'invoice'}
        <label class="field"><span>Patient</span><select class="select" bind:value={dialog.patientId}>{#each db.patients as p}<option value={p.id}>{p.fullName}</option>{/each}</select></label>
        <div class="grid-2"><label class="field"><span>Payer</span><select class="select" bind:value={dialog.payer}>{#each PAYERS as payer}<option>{payer}</option>{/each}</select></label><label class="field"><span>Amount <span class="hint">USD</span></span><input class="input" inputmode="decimal" bind:value={dialog.amount} /></label></div>
        <label class="field"><span>Description</span><input class="input" bind:value={dialog.description} /></label>
      {:else if dialog.kind === 'payment' || dialog.kind === 'bill-payment'}
        <div class="grid-2"><label class="field"><span>Amount</span><input class="input" inputmode="decimal" bind:value={dialog.amount} /></label><label class="field"><span>Date</span><input class="input" type="date" bind:value={dialog.date} /></label></div>
        <div class="grid-2"><label class="field"><span>Method</span><select class="select" bind:value={dialog.method}>{#each PAYMENT_METHODS as method}<option>{method}</option>{/each}</select></label><label class="field"><span>Reference</span><input class="input" bind:value={dialog.reference} /></label></div>
      {:else if dialog.kind === 'reverse'}
        {@const live = (db.finance.invoices.find(item => item.id === dialog.id)?.payments || []).filter(payment => !payment.reversed)}
        <label class="field"><span>Payment</span><select class="select" bind:value={dialog.paymentId}>{#each live as payment (payment.id)}<option value={payment.id}>{usd(payment.amount)}, {payment.method}, {fmtDate(payment.date)}{payment.reference ? `, ${payment.reference}` : ''}</option>{/each}</select></label>
        <label class="field"><span>Reason</span><input class="input" bind:value={dialog.reason} placeholder="For example: typed 600 instead of 60" /></label>
        <p class="faint">The receipt stays on record; a reversing entry is posted and the balance reopens.</p>
      {:else if dialog.kind === 'bank'}
        <div class="grid-2"><label class="field"><span>Date</span><input class="input" type="date" bind:value={dialog.date} /></label><label class="field"><span>Amount <span class="hint">negative for money out</span></span><input class="input" inputmode="decimal" bind:value={dialog.amount} /></label></div>
        <div class="grid-2"><label class="field"><span>Description</span><input class="input" bind:value={dialog.description} placeholder="As on the statement" /></label><label class="field"><span>Reference</span><input class="input" bind:value={dialog.reference} /></label></div>
      {:else if dialog.kind === 'reject'}
        <label class="field"><span>Reason</span><input class="input" bind:value={dialog.reason} placeholder="For example: duplicate of an earlier bill" /></label>
        <p class="faint">The bill stays on record as rejected and never reaches the books.</p>
      {:else if dialog.kind === 'void'}
        <label class="field"><span>Reason</span><input class="input" bind:value={dialog.reason} placeholder="For example: billed in error" /></label>
        <p class="faint">A reversing entry is posted; the invoice stays on record.</p>
      {:else if dialog.kind === 'expense'}
        <div class="grid-2"><label class="field"><span>Supplier</span><input class="input" bind:value={dialog.supplier} /></label><label class="field"><span>Amount</span><input class="input" inputmode="decimal" bind:value={dialog.amount} /></label></div>
        <label class="field"><span>What for</span><input class="input" bind:value={dialog.description} /></label>
        <div class="grid-2"><label class="field"><span>Category</span><select class="select" bind:value={dialog.category}>{#each EXPENSE_CATEGORIES as account}<option value={account.code}>{account.name}</option>{/each}</select></label><label class="field"><span>Bill date</span><input class="input" type="date" bind:value={dialog.date} /></label></div>
      {:else if dialog.kind === 'manual'}
        <label class="field"><span>Description</span><input class="input" bind:value={dialog.description} /></label>
        <div class="grid-2"><label class="field"><span>Debit</span><select class="select" bind:value={dialog.debitAccount}>{#each ACCOUNTS as account}<option value={account.code}>{account.code} {account.name}</option>{/each}</select></label><label class="field"><span>Credit</span><select class="select" bind:value={dialog.creditAccount}>{#each ACCOUNTS as account}<option value={account.code}>{account.code} {account.name}</option>{/each}</select></label></div>
        <div class="grid-2"><label class="field"><span>Amount</span><input class="input" inputmode="decimal" bind:value={dialog.amount} /></label><label class="field"><span>Date</span><input class="input" type="date" bind:value={dialog.date} /></label></div>
      {/if}
      {#if error}<p class="error" role="alert">{error}</p>{/if}
    </div>
    <footer class="drawer-foot"><button class="btn" type="button" onclick={close}>Cancel</button><button class="btn primary" type="submit">Save</button></footer>
  </form>
{/if}

<style>
  /* Overview bento: what Cedar is owed leads, the other balances sit beside it */
  .bento { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); grid-auto-rows: minmax(132px, auto); gap: 10px; }
  .owed { grid-column: span 2; grid-row: span 2; position: relative; overflow: hidden; display: flex; align-items: center; gap: 15px; padding: 20px 21px; border-radius: 22px; background: var(--hero); color: var(--on-ink); box-shadow: var(--shadow-2); }
  .owed::after { content: ""; position: absolute; right: -90px; top: -90px; width: 300px; height: 300px; border-radius: 50%; background: radial-gradient(circle, rgb(var(--lime-rgb) / 0.22), transparent 70%); pointer-events: none; }
  .owed-main { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 6px; }
  .eyebrow { font-size: 12.5px; font-weight: 750; color: var(--on-ink-2); text-transform: uppercase; letter-spacing: 0.08em; }
  .big { font-size: clamp(30px, 4.4vw, 47px); font-weight: 800; letter-spacing: -0.05em; line-height: 1; color: var(--lime); }
  .owed p { margin: 0; font-size: 13.5px; color: var(--on-ink-2); font-weight: 600; }
  .aging { display: flex; gap: 3px; height: 12px; margin-top: 10px; border-radius: 6px; overflow: hidden; }
  .aging i, .aging-key i { display: block; flex-basis: 0; }
  .a-due { background: var(--lime); }
  .a-part-paid { background: #7cc4ff; }
  .a-overdue { background: #ff8a7a; }
  .aging-key { list-style: none; margin: 8px 0 0; padding: 0; display: flex; flex-wrap: wrap; gap: 6px 11px; font-size: 12px; color: var(--on-ink-2); font-weight: 650; }
  .aging-key li { display: inline-flex; align-items: center; gap: 6px; }
  .aging-key i { width: 10px; height: 10px; border-radius: 3px; }
  .aging-key strong { color: var(--on-ink); }
  .owed-ring { display: flex; flex-direction: column; align-items: center; gap: 8px; z-index: 1; }
  .owed-ring :global(figcaption) { color: var(--on-ink); }
  .faint-ink { font-size: 12px; color: var(--on-ink-2); font-weight: 650; }
  .tile { display: flex; flex-direction: column; gap: 2px; padding: 14px 15px; border-radius: 18px; background: var(--paper); box-shadow: var(--shadow-1); }
  .tile .label { font-size: 13px; font-weight: 700; color: var(--text-2); margin-top: auto; }
  .tile .value { font-size: 22px; font-weight: 800; letter-spacing: -0.04em; line-height: 1.1; }
  .tile .note { font-size: 12px; color: var(--text-3); }
  .tile.neg .value { color: var(--urgent); }
  .t-icon { width: 38px; height: 38px; border-radius: 12px; display: inline-flex; align-items: center; justify-content: center; background: var(--leaf); color: var(--moss); margin-bottom: 12px; }
  .t-icon.warn { background: var(--warn-soft); color: var(--warn); }

  .two { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 11px; margin-top: 12px; }
  .month-card.todo { box-shadow: inset 0 0 0 2px var(--lime), var(--shadow-1); }
  .month-card .muted { display: inline-flex; align-items: center; gap: 8px; }
  .overdue-list .owe { color: var(--urgent); }
  tr.total td { background: var(--subtle); }
  tr.first td { border-top: 1px solid var(--line-strong); }
  @media (max-width: 1200px) { .bento { grid-template-columns: repeat(2, minmax(0, 1fr)); } .owed { grid-row: auto; } }
  @media (max-width: 900px) { .two { grid-template-columns: 1fr; } }
  @media (max-width: 600px) { .bento { grid-template-columns: 1fr 1fr; } .owed { flex-direction: column; align-items: stretch; padding: 15px; } .owed-ring { align-self: center; } .tile { padding: 11px; } .tile .value { font-size: 17px; } }
</style>
