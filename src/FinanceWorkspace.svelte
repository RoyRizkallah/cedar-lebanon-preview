<script>
  import { dialogFocus } from './dialogFocus.js';
  import Registry from './Registry.svelte';
  import { scrollRegion } from './registry.js';
  import Icon from './Icon.svelte';
  import { iso, prettyDate } from './data.js';
  import { accounts, expenseCategories, money, buildJournal, trialBalance, bankJournalLines, payerBalances, totals } from './finance.js';

  export let page;
  export let data;
  export let role;
  export let staff;
  export let onNavigate = () => {};
  export let onPersist = () => {};
  export let onNotice = () => {};
  export let onPayment = () => {};

  let modal = '';
  let form = {};
  let error = '';
  let financeView;
  let ledgerTab = 'Journal';
  let selectedMatches = {};
  let selectedPayer = '';

  $: finance = data.finance;
  $: journal = buildJournal(data);
  $: trial = trialBalance(journal);
  $: figures = totals(journal);
  $: bankLines = bankJournalLines(journal);
  $: payers = payerBalances(data.invoices);
  $: payments = data.invoices.flatMap(invoice => (invoice.payments || []).map(payment => ({ ...payment, invoice: invoice.id, patient: invoice.patient, payer: invoice.payer })) ).sort((a,b) => b.date.localeCompare(a.date));
  $: openInvoices = data.invoices.filter(item => item.status !== 'Void' && Number(item.paid || 0) < Number(item.amount || 0));
  $: overdueInvoices = openInvoices.filter(item => item.due < iso(0));
  $: approvedExpenses = finance.expenses.filter(item => item.status !== 'Pending approval');
  $: unpaidExpenses = approvedExpenses.filter(item => Number(item.amount) > (item.payments || []).reduce((sum,payment)=>sum+Number(payment.amount),0));
  $: unmatchedBank = finance.bankEntries.filter(item => !item.matchedJournalId);
  $: unmatchedBooks = bankLines.filter(item => !finance.bankEntries.some(bank => bank.matchedJournalId === item.id));
  $: if (payers.length && !payers.some(item => item.name === selectedPayer)) selectedPayer = payers[0].name;
  $: payer = payers.find(item => item.name === selectedPayer);

  const titles = {
    payments: ['Payments', 'Payments received', 'Trace cash received back to the invoice, payer and payment reference.'],
    expenses: ['Expenses', 'Supplier expenses', 'Capture supplier bills, approve them, then record settlement.'],
    ledger: ['General ledger', 'General ledger', 'Inspect journal entries, accounts and a live trial balance.'],
    reconciliation: ['Reconciliation', 'Bank reconciliation', 'Match fictional bank statement lines to recorded receipts and payments.'],
    payers: ['Payer accounts', 'Payer accounts', 'Review billed, received and open amounts by payer.']
  };

  function begin(kind, item = null) {
    modal = kind;
    error = '';
    form = kind === 'expense' ? { supplier: '', description: '', category: '5200', amount: '', date: iso(0), due: iso(14), receiptRef: '' }
      : kind === 'expensePayment' ? { expenseId: item.id, amount: Math.max(0, item.amount - (item.payments || []).reduce((sum,payment)=>sum+Number(payment.amount),0)), date: iso(0), method: 'Bank transfer', reference: '' }
      : kind === 'bank' ? { date: iso(0), description: '', reference: '', amount: '' }
      : { date: iso(0), description: '', reference: '', debitAccount: '5200', creditAccount: '1010', amount: '' };
  }

  function save() {
    const amount = Number(form.amount);
    if (!Number.isFinite(amount) || amount === 0) { error = 'Enter a non-zero amount.'; return; }
    if (modal === 'expense') {
      if (amount < 0 || !form.supplier?.trim() || !form.description?.trim() || !form.receiptRef?.trim()) { error = 'Supplier, description, receipt reference and a positive amount are required.'; return; }
      finance.expenses.unshift({ id: `EXP-${Date.now()}`, date: form.date, due: form.due, supplier: form.supplier.trim(), description: form.description.trim(), category: form.category, amount, status: 'Pending approval', owner: staff.assignment, receiptRef: form.receiptRef.trim(), payments: [] });
      onPersist('Supplier expense captured for approval.');
      onNotice('Expense captured. Approve it before it reaches the ledger.');
    } else if (modal === 'expensePayment') {
      const expense = finance.expenses.find(item => item.id === form.expenseId);
      const remaining = expense.amount - (expense.payments || []).reduce((sum,payment)=>sum+Number(payment.amount),0);
      if (!expense || expense.status === 'Pending approval' || amount < 0 || amount > remaining) { error = 'Payment must be within the approved open balance.'; return; }
      expense.payments.push({ id: `EPAY-${Date.now()}`, date: form.date, amount, method: form.method, reference: form.reference?.trim() || 'Unreferenced' });
      expense.status = amount >= remaining ? 'Paid' : 'Part-paid';
      onPersist(`Expense payment recorded for ${expense.id}.`);
      onNotice('Supplier payment recorded in the journal.');
    } else if (modal === 'bank') {
      if (!form.description?.trim()) { error = 'Describe the statement line.'; return; }
      finance.bankEntries.unshift({ id: `BANK-${Date.now()}`, date: form.date, description: form.description.trim(), amount, reference: form.reference?.trim() || '—', matchedJournalId: '' });
      onPersist('Bank statement line added.');
      onNotice('Statement line added for reconciliation.');
    } else if (modal === 'adjustment') {
      if (amount < 0 || !form.description?.trim() || form.debitAccount === form.creditAccount) { error = 'Use two different accounts, a description and a positive amount.'; return; }
      finance.manualEntries.unshift({ id: `J-ADJ-${Date.now()}`, date: form.date, description: form.description.trim(), reference: form.reference?.trim() || 'Manual adjustment', debitAccount: form.debitAccount, creditAccount: form.creditAccount, amount, postedBy: staff.name });
      onPersist('Balanced manual journal entry posted.');
      onNotice('Balanced journal entry posted.');
    }
    modal = '';
  }

  function approve(expense) {
    if (expense.status !== 'Pending approval') return;
    expense.status = 'Approved';
    expense.approvedBy = staff.name;
    expense.approvedAt = iso(0);
    onPersist(`${expense.id} approved for the expense ledger.`);
    onNotice('Expense approved and posted to accounts payable.');
  }

  function reverse(item) {
    if (item.kind !== 'Adjustment' || finance.manualEntries.some(entry => entry.reverses === item.id)) return;
    const original = finance.manualEntries.find(entry => entry.id === item.id);
    if (!original) return;
    finance.manualEntries.unshift({ id: `J-REV-${Date.now()}`, date: iso(0), description: `Reversal · ${original.description}`, reference: original.id, debitAccount: original.creditAccount, creditAccount: original.debitAccount, amount: original.amount, postedBy: staff.name, reverses: original.id });
    onPersist(`${item.id} reversed by a new balanced entry.`);
    onNotice('A reversing entry was posted. The original remains in the journal.');
  }

  function match(bank) {
    const journalId = selectedMatches[bank.id];
    const line = bankLines.find(item => item.id === journalId);
    if (!line || Math.abs(line.amount - bank.amount) > .001 || finance.bankEntries.some(item => item.matchedJournalId === journalId)) { onNotice('Choose an unmatched book entry with the same amount.'); return; }
    bank.matchedJournalId = journalId;
    onPersist(`${bank.id} reconciled with ${journalId}.`);
    onNotice('Statement line matched.');
  }

  function unmatch(bank) { bank.matchedJournalId = ''; onPersist(`${bank.id} match removed.`); onNotice('Bank match removed.'); }

  function downloadCsv() {
    const cell = value => `"${String(value ?? '').replaceAll('"','""')}"`;
    let rows = [];
    const visible = financeView?.getRows() || [];
    if (page === 'payments') rows = [['date','invoice','payer','patient','amount','method','reference'],...visible.map(item=>[item.date,item.invoice,item.payer,item.patient,item.amount,item.method,item.reference])];
    if (page === 'expenses') rows = [['date','expense','supplier','category','description','amount','status','receipt'],...visible.map(item=>[item.date,item.id,item.supplier,item.category,item.description,item.amount,item.status,item.receiptRef])];
    if (page === 'ledger' && ledgerTab === 'Journal') rows = [['date','entry','description','reference','account','debit','credit'],...visible.flatMap(item=>item.lines.map(line=>[item.date,item.id,item.description,item.reference,line.account,line.debit,line.credit]))];
    if (page === 'reconciliation') rows = [['date','statement','description','amount','reference','matched_entry'],...visible.map(item=>[item.date,item.id,item.description,item.amount,item.reference,item.matchedJournalId])];
    if (page === 'payers') rows = [['payer','invoices','billed','received','open'],...visible.map(item=>[item.name,item.invoices,item.billed,item.received,item.open])];
    if (page === 'ledger' && ledgerTab === 'Trial balance') rows = [['account','name','type','debit','credit','net'],...visible.map(item=>[item.code,item.name,item.type,item.debit,item.credit,item.balance])];
    if (page === 'ledger' && ledgerTab === 'Chart of accounts') rows = [['account','name','type'],...visible.map(item=>[item.code,item.name,item.type])];
    const url = URL.createObjectURL(new Blob([rows.map(row=>row.map(cell).join(',')).join('\n')],{type:'text/csv;charset=utf-8'}));
    const link = document.createElement('a'); link.href = url; link.download = `cedar-${page}.csv`; link.click(); setTimeout(()=>URL.revokeObjectURL(url),60000);
  }
</script>

<div class="finance-workspace">
  <div class="page-intro"><div><div class="eyebrow">{role === 'Director' ? 'DIRECTOR FINANCE' : 'FINANCE DESK'} / {titles[page][0].toUpperCase()}</div><h1 class="page-title">{titles[page][1]}</h1><p class="page-desc">{titles[page][2]}</p></div><div class="intro-actions"><button class="btn btn-outline" on:click={downloadCsv}><Icon name="download" size={15}/> Export view</button>{#if page === 'expenses'}<button class="btn btn-primary" on:click={() => begin('expense')}><Icon name="plus" size={15}/> New expense</button>{:else if page === 'ledger'}<button class="btn btn-primary" on:click={() => begin('adjustment')}><Icon name="plus" size={15}/> Journal entry</button>{:else if page === 'reconciliation'}<button class="btn btn-primary" on:click={() => begin('bank')}><Icon name="plus" size={15}/> Statement line</button>{/if}</div></div>

  {#if page === 'payments'}
    <div class="finance-stats"><article><span>RECEIVED TO DATE</span><strong>{money(payments.reduce((sum,item)=>sum+Number(item.amount),0))}</strong><small>Across recorded receipts</small></article><article><span>OPEN RECEIVABLES</span><strong>{money(figures.receivables)}</strong><small>{openInvoices.length} invoices with balance</small></article><article><span>PAST DUE</span><strong>{overdueInvoices.length}</strong><small>{money(overdueInvoices.reduce((sum,item)=>sum+item.amount-item.paid,0))} outstanding</small></article><article><span>RECENT RECEIPTS</span><strong>{payments.length}</strong><small>Traceable to invoice references</small></article></div>
    <section class="finance-panel"><div class="finance-panel-head"><div><span>RECEIPT REGISTER</span><h2>Payments received</h2><p>Each receipt creates a cash and receivables journal entry.</p></div></div><Registry items={payments} label="Payments" pageSize={25} bind:this={financeView} scope={page} searchKeys={['invoice','payer','patient','reference','method']} fields={[{key:'payer',label:'Payer'},{key:'method',label:'Method'}]} dateKey="date" dateLabel="Receipt date" sorts={[{key:'date',desc:true,label:'Newest first'},{key:'date',label:'Oldest first'},{key:'amount',desc:true,label:'Amount: high to low'},{key:'amount',label:'Amount: low to high'}]} hint="Summary figures show all receipts. Filters and CSV export apply to this register." let:rows><div class="finance-table-wrap" use:scrollRegion role="region" aria-label="Data table — scroll horizontally to see all columns"><table><thead><tr><th>Date</th><th>Invoice</th><th>Payer</th><th>Patient ref</th><th>Method / reference</th><th class="number">Amount</th></tr></thead><tbody>{#each rows as item}<tr><td>{prettyDate(item.date)}</td><td><strong>{item.invoice}</strong></td><td>{item.payer}</td><td>{item.patient}</td><td>{item.method}<small>{item.reference}</small></td><td class="number positive">{money(item.amount)}</td></tr>{:else}<tr><td colspan="6" class="finance-empty">No receipts match this search.</td></tr>{/each}</tbody></table></div></Registry></section>
    <section class="finance-panel"><div class="finance-panel-head"><div><span>COLLECTIONS QUEUE</span><h2>Invoices awaiting payment</h2></div><button class="text-link" on:click={() => onNavigate('billing')}>Full invoice ledger →</button></div><Registry items={openInvoices} label="Collections" pageSize={25} searchKeys={['id','patient','payer']} fields={[{key:'payer',label:'Payer'},{key:'owner',label:'Owner'},{id:'due',key:item=>item.due<iso(0)?'Overdue':'Not overdue',label:'Due status'}]} dateKey="due" dateLabel="Due date" sorts={[{key:'due',label:'Due soonest'},{key:item=>item.amount-item.paid,desc:true,label:'Largest balance'}]} let:rows><div class="finance-table-wrap" use:scrollRegion role="region" aria-label="Data table — scroll horizontally to see all columns"><table><thead><tr><th>Invoice</th><th>Payer</th><th>Due</th><th class="number">Balance</th><th></th></tr></thead><tbody>{#each rows as invoice}<tr><td><strong>{invoice.id}</strong></td><td>{invoice.payer}</td><td class:overdue={invoice.due < iso(0)}>{prettyDate(invoice.due)}</td><td class="number">{money(invoice.amount-invoice.paid)}</td><td><button class="btn btn-soft btn-tiny" on:click={() => onPayment(invoice)}>Record payment</button></td></tr>{/each}</tbody></table></div></Registry></section>
  {:else if page === 'expenses'}
    <div class="finance-stats"><article><span>APPROVED SPEND</span><strong>{money(approvedExpenses.reduce((sum,item)=>sum+Number(item.amount),0))}</strong><small>Posted to expense accounts</small></article><article><span>ACCOUNTS PAYABLE</span><strong>{money(figures.payables)}</strong><small>{unpaidExpenses.length} approved bills open</small></article><article><span>PAID TO SUPPLIERS</span><strong>{money(approvedExpenses.flatMap(item=>item.payments||[]).reduce((sum,item)=>sum+Number(item.amount),0))}</strong><small>Payments recorded</small></article><article><span>NEEDS APPROVAL</span><strong>{finance.expenses.filter(item=>item.status==='Pending approval').length}</strong><small>Held outside the ledger</small></article></div>
    <section class="finance-panel"><div class="finance-panel-head"><div><span>SUPPLIER BILLS</span><h2>Expense worklist</h2><p>Capture, approve and settle with a receipt reference.</p></div></div><Registry items={finance.expenses} label="Expenses" pageSize={25} bind:this={financeView} scope={page} searchKeys={['id','supplier','description','receiptRef','owner']} fields={[{key:'status',label:'Status'},{key:'supplier',label:'Supplier'},{key:'category',label:'Account'},{key:'owner',label:'Owner'}]} dateKey="date" dateLabel="Bill date" sorts={[{key:'date',desc:true,label:'Newest first'},{key:'due',label:'Due soonest'},{key:'amount',desc:true,label:'Largest amount'}]} hint="Summary figures show all expenses. Export includes only matching bills." let:rows><div class="finance-table-wrap" use:scrollRegion role="region" aria-label="Data table — scroll horizontally to see all columns"><table><thead><tr><th>Expense / date</th><th>Supplier & detail</th><th>Account</th><th>Receipt</th><th>Status</th><th class="number">Open</th><th></th></tr></thead><tbody>{#each rows as item}<tr><td><strong>{item.id}</strong><small>{prettyDate(item.date)} · due {prettyDate(item.due)}</small></td><td>{item.supplier}<small>{item.description}</small></td><td>{accounts.find(account=>account.code===item.category)?.name}</td><td>{item.receiptRef}</td><td><span class:pending={item.status==='Pending approval'} class:paid={item.status==='Paid'} class="finance-status">{item.status}</span></td><td class="number">{money(item.amount-(item.payments||[]).reduce((sum,payment)=>sum+Number(payment.amount),0))}</td><td>{#if item.status==='Pending approval'}<button class="btn btn-soft btn-tiny" on:click={() => approve(item)}>Approve</button>{:else if item.status!=='Paid'}<button class="btn btn-soft btn-tiny" on:click={() => begin('expensePayment',item)}>Pay</button>{/if}</td></tr>{:else}<tr><td colspan="7" class="finance-empty">No expenses match this search.</td></tr>{/each}</tbody></table></div></Registry></section>
  {:else if page === 'ledger'}
    <div class="finance-stats"><article><span>JOURNAL ENTRIES</span><strong>{journal.length}</strong><small>Invoices, receipts and expenses</small></article><article><span>PROGRAM REVENUE</span><strong>{money(figures.revenue)}</strong><small>Posted invoice value</small></article><article><span>APPROVED EXPENSES</span><strong>{money(figures.expenses)}</strong><small>Posted supplier costs</small></article><article><span>OPERATING RESULT</span><strong>{money(figures.revenue-figures.expenses)}</strong><small>Preview accrual view</small></article></div>
    <div class="finance-tabs">{#each ['Journal','Trial balance','Chart of accounts'] as item}<button class:active={ledgerTab===item} on:click={() => ledgerTab=item}>{item}</button>{/each}</div>
    {#if ledgerTab==='Journal'}<section class="finance-panel"><div class="finance-panel-head"><div><span>POSTED JOURNAL</span><h2>Transaction history</h2><p>Every entry has equal debits and credits. Corrections use a reversing entry.</p></div></div><Registry items={journal} label="Journal entries" pageSize={25} bind:this={financeView} scope={ledgerTab} searchKeys={['id','description','reference',item=>item.lines.map(line=>line.account).join(' ')]} fields={[{key:'kind',label:'Entry type'},{id:'account',key:item=>item.lines.map(line=>line.account+' · '+accounts.find(account=>account.code===line.account)?.name),label:'Account'}]} dateKey="date" dateLabel="Posting date" sorts={[{key:'date',desc:true,label:'Newest first'},{key:'date',label:'Oldest first'},{key:'id',label:'Entry reference'}]} hint="All lines of matching entries remain together. Summary figures show all posted activity." let:rows><div class="finance-journal">{#each rows as item}<article data-kind={item.kind}><div class="finance-journal-title"><span class="finance-journal-kind">{item.kind}</span><div><strong>{item.description}</strong><small>{item.id} · {prettyDate(item.date)} · {item.reference}</small></div>{#if item.kind==='Adjustment' && !finance.manualEntries.some(entry=>entry.reverses===item.id)}<button class="text-link" on:click={() => reverse(item)}>Reverse</button>{/if}</div><div class="finance-journal-lines"><div class="finance-journal-columns"><span>Account</span><span>Debit</span><span>Credit</span></div>{#each item.lines as line}<div><span>{line.account} · {accounts.find(account=>account.code===line.account)?.name}</span><span>{line.debit ? money(line.debit) : '—'}</span><span>{line.credit ? money(line.credit) : '—'}</span></div>{/each}</div></article>{/each}</div></Registry></section>
    {:else if ledgerTab==='Trial balance'}<section class="finance-panel"><div class="finance-panel-head"><div><span>CONTROL REPORT</span><h2>Trial balance</h2><p>Account balances calculated from all posted journal lines.</p></div></div><Registry items={trial} label="Account balances" bind:this={financeView} scope={ledgerTab} searchKeys={['code','name']} fields={[{key:'type',label:'Account type'},{id:'balance',key:item=>item.balance===0?'Zero balance':'Non-zero balance',label:'Balance'}]} sorts={[{key:'code',label:'Account code'},{key:'name',label:'Account name'}]} hint="Balances use all posted entries. The footer totals only visible accounts; a filtered subset may not balance." let:rows><div class="finance-table-wrap" use:scrollRegion role="region" aria-label="Data table — scroll horizontally to see all columns"><table><thead><tr><th>Account</th><th>Type</th><th class="number">Debits</th><th class="number">Credits</th><th class="number">Net</th></tr></thead><tbody>{#each rows as item}<tr><td><strong>{item.code} · {item.name}</strong></td><td>{item.type}</td><td class="number">{money(item.debit)}</td><td class="number">{money(item.credit)}</td><td class="number">{money(Math.abs(item.balance))} {item.balance<0?'Cr':'Dr'}</td></tr>{/each}<tr class="finance-total"><td colspan="2">VISIBLE ACCOUNTS</td><td class="number">{money(rows.reduce((sum,item)=>sum+item.debit,0))}</td><td class="number">{money(rows.reduce((sum,item)=>sum+item.credit,0))}</td><td></td></tr></tbody></table></div></Registry></section>
    {:else}<section class="finance-panel"><div class="finance-panel-head"><div><span>CHART OF ACCOUNTS</span><h2>How Cedar classifies activity</h2></div></div><Registry items={accounts} label="Accounts" bind:this={financeView} scope={ledgerTab} searchKeys={['code','name']} fields={[{key:'type',label:'Type'}]} sorts={[{key:'code',label:'Account code'},{key:'name',label:'Account name'}]} let:rows><div class="finance-account-grid">{#each rows as account}<article><span>{account.code}</span><strong>{account.name}</strong><small>{account.type}</small></article>{/each}</div></Registry></section>{/if}
  {:else if page === 'reconciliation'}
    <div class="finance-stats"><article><span>BANK LINES</span><strong>{finance.bankEntries.length}</strong><small>Fictional statement feed</small></article><article><span>UNMATCHED STATEMENT</span><strong>{unmatchedBank.length}</strong><small>Needs investigation</small></article><article><span>UNMATCHED BOOK CASH</span><strong>{unmatchedBooks.length}</strong><small>Receipts or payments to clear</small></article><article><span>BOOK BANK MOVEMENT</span><strong>{money(figures.bank)}</strong><small>From posted entries</small></article></div>
    <div class="finance-reconcile-grid"><section class="finance-panel"><div class="finance-panel-head"><div><span>STATEMENT SIDE</span><h2>Bank activity</h2><p>Match a line only when the amount agrees exactly.</p></div></div><Registry items={finance.bankEntries} label="Statement lines" bind:this={financeView} scope={page} searchKeys={['id','description','reference','matchedJournalId']} fields={[{id:'match',key:item=>item.matchedJournalId?'Matched':'Unmatched',label:'Match status'},{id:'direction',key:item=>item.amount<0?'Money out':'Money in',label:'Direction'}]} dateKey="date" dateLabel="Statement date" sorts={[{key:'date',desc:true,label:'Newest first'},{key:'amount',desc:true,label:'Amount: high to low'}]} let:rows><div class="finance-bank-list">{#each rows as bank}<article><div><strong>{bank.description}</strong><small>{bank.id} · {prettyDate(bank.date)} · {bank.reference}</small><span class:unmatched={!bank.matchedJournalId} class="finance-match-status">{bank.matchedJournalId ? `Matched to ${bank.matchedJournalId}` : 'Unmatched'}</span></div><div class="finance-bank-action"><strong class:negative={bank.amount<0}>{money(bank.amount)}</strong>{#if bank.matchedJournalId}<button class="text-link" on:click={() => unmatch(bank)}>Unmatch</button>{:else}<select aria-label={`Book entry for ${bank.id}`} bind:value={selectedMatches[bank.id]}><option value="">Choose book entry</option>{#each unmatchedBooks.filter(item=>Math.abs(item.amount-bank.amount)<.001) as item}<option value={item.id}>{item.id} · {item.description}</option>{/each}</select><button class="btn btn-soft btn-tiny" on:click={() => match(bank)}>Match</button>{/if}</div></article>{/each}</div></Registry></section><section class="finance-panel"><div class="finance-panel-head"><div><span>BOOK SIDE</span><h2>Cash entries awaiting clearance</h2></div></div><Registry items={unmatchedBooks} label="Uncleared entries" searchKeys={['id','description']} fields={[{id:'direction',key:item=>item.amount<0?'Money out':'Money in',label:'Direction'}]} dateKey="date" sorts={[{key:'date',desc:true,label:'Newest first'},{key:'amount',desc:true,label:'Amount: high to low'}]} let:rows><div class="finance-bank-list">{#each rows as item}<article><div><strong>{item.description}</strong><small>{item.id} · {prettyDate(item.date)}</small></div><strong class:negative={item.amount<0}>{money(item.amount)}</strong></article>{:else}<p class="finance-empty">All book cash entries are matched.</p>{/each}</div></Registry></section></div><div class="finance-note">This is a fictional reconciliation preview. Statement lines are entered separately from ledger transactions; a match records the link without creating or changing cash.</div>
  {:else if page === 'payers'}
    <div class="finance-stats"><article><span>PAYER ACCOUNTS</span><strong>{payers.length}</strong><small>Funding relationships</small></article><article><span>TOTAL BILLED</span><strong>{money(payers.reduce((sum,item)=>sum+item.billed,0))}</strong><small>Across current invoices</small></article><article><span>RECEIVED</span><strong>{money(payers.reduce((sum,item)=>sum+item.received,0))}</strong><small>Recorded receipts</small></article><article><span>OUTSTANDING</span><strong>{money(payers.reduce((sum,item)=>sum+item.open,0))}</strong><small>Available for follow-up</small></article></div>
    <div class="finance-reconcile-grid"><section class="finance-panel"><div class="finance-panel-head"><div><span>FUNDING DIRECTORY</span><h2>Payer balances</h2><p>Select a payer to inspect its invoices.</p></div></div><Registry items={payers} label="Payers" bind:this={financeView} scope={page} searchKeys={['name']} fields={[{id:'balance',key:item=>item.open>0?'Outstanding':'Settled',label:'Balance'}]} sorts={[{key:'open',desc:true,label:'Largest balance'},{key:'name',label:'Payer name'}]} hint="The selected account stays open while you refine the directory." let:rows><div class="finance-payer-list">{#each rows as item}<button class:active={selectedPayer===item.name} on:click={() => selectedPayer=item.name}><span><strong>{item.name}</strong><small>{item.invoices} invoices · {money(item.received)} received</small></span><b>{money(item.open)}</b><Icon name="chevron" size={14}/></button>{/each}</div></Registry></section><section class="finance-panel"><div class="finance-panel-head"><div><span>ACCOUNT DETAIL</span><h2>{payer ? payer.name : 'Select a payer'}</h2></div></div>{#if payer}<div class="finance-payer-summary"><div><span>Billed</span><strong>{money(payer.billed)}</strong></div><div><span>Received</span><strong>{money(payer.received)}</strong></div><div><span>Open</span><strong>{money(payer.open)}</strong></div></div><Registry items={payer.items} label="Payer invoices" scope={selectedPayer} searchKeys={['id','patient']} fields={[{key:'status',label:'Status'}]} dateKey="due" dateLabel="Due date" sorts={[{key:'due',label:'Due soonest'},{key:'amount',desc:true,label:'Largest amount'}]} let:rows><div class="finance-bank-list">{#each rows as invoice}<article><div><strong>{invoice.id} · {invoice.patient}</strong><small>Due {prettyDate(invoice.due)} · {invoice.status}</small></div><strong>{money(invoice.amount-invoice.paid)}</strong></article>{/each}</div></Registry><button class="btn btn-soft btn-tiny finance-payer-open" on:click={() => onNavigate('billing')}>Open invoice ledger <Icon name="arrow" size={13}/></button>{:else}<p class="finance-empty">Choose a payer on the left to see the funding detail.</p>{/if}</section></div>
  {/if}
  <p class="finance-disclaimer">Fictional accounting preview · USD · No bank connection or tax filing · Staff approval and source documentation remain required.</p>
</div>

{#if modal}<div class="modal-backdrop" role="presentation" on:click={event => { if(event.target===event.currentTarget) modal=''; }}><form class="modal finance-modal" use:dialogFocus={{onClose:()=>modal=''}} on:submit|preventDefault={save}><div class="modal-head"><h2>{modal==='expense'?'New supplier expense':modal==='expensePayment'?'Record supplier payment':modal==='bank'?'Add bank statement line':'Post journal adjustment'}</h2><button type="button" class="icon-btn" aria-label="Close" on:click={() => modal=''}><Icon name="close"/></button></div><div class="modal-body"><div class="finance-form-grid">{#if modal==='expense'}<div class="form-field"><label for="fx-supplier">Supplier</label><input id="fx-supplier" required bind:value={form.supplier}/></div><div class="form-field"><label for="fx-receipt">Receipt / bill reference</label><input id="fx-receipt" required bind:value={form.receiptRef}/></div><div class="form-field full"><label for="fx-desc">Description</label><input id="fx-desc" required bind:value={form.description}/></div><div class="form-field"><label for="fx-category">Expense account</label><select id="fx-category" bind:value={form.category}>{#each expenseCategories as account}<option value={account.code}>{account.code} · {account.name}</option>{/each}</select></div><div class="form-field"><label for="fx-due">Due date</label><input id="fx-due" type="date" required bind:value={form.due}/></div>{/if}{#if modal==='expensePayment'}<div class="form-field"><label for="fx-method">Method</label><select id="fx-method" bind:value={form.method}><option>Bank transfer</option><option>Card</option><option>Cash</option></select></div><div class="form-field"><label for="fx-ref">Payment reference</label><input id="fx-ref" bind:value={form.reference}/></div>{/if}{#if modal==='bank'}<div class="form-field full"><label for="fx-desc">Statement description</label><input id="fx-desc" required bind:value={form.description}/></div><div class="form-field"><label for="fx-ref">Bank reference</label><input id="fx-ref" bind:value={form.reference}/></div>{/if}{#if modal==='adjustment'}<div class="form-field full"><label for="fx-desc">Reason for adjustment</label><input id="fx-desc" required bind:value={form.description}/></div><div class="form-field"><label for="fx-debit">Debit account</label><select id="fx-debit" bind:value={form.debitAccount}>{#each accounts as account}<option value={account.code}>{account.code} · {account.name}</option>{/each}</select></div><div class="form-field"><label for="fx-credit">Credit account</label><select id="fx-credit" bind:value={form.creditAccount}>{#each accounts as account}<option value={account.code}>{account.code} · {account.name}</option>{/each}</select></div><div class="form-field full"><label for="fx-ref">Reference</label><input id="fx-ref" bind:value={form.reference}/></div>{/if}<div class="form-field"><label for="fx-date">Date</label><input id="fx-date" type="date" required bind:value={form.date}/></div><div class="form-field"><label for="fx-amount">{modal==='bank'?'Signed amount (+ in / − out)':'Amount (USD)'}</label><input id="fx-amount" type="number" step="0.01" required bind:value={form.amount}/></div></div>{#if error}<div class="form-error" role="alert">{error}</div>{/if}</div><div class="modal-foot"><button type="button" class="btn btn-outline" on:click={() => modal=''}>Cancel</button><button type="submit" class="btn btn-primary">{modal==='expense'?'Submit for approval':modal==='expensePayment'?'Record payment':modal==='bank'?'Add statement line':'Post balanced entry'}</button></div></form></div>{/if}
