<script>
  import Registry from './Registry.svelte';
  import { scrollRegion } from './registry.js';
  import Icon from './Icon.svelte';
  import { iso, prettyDate } from './data.js';
  import { buildJournal, totals, money } from './finance.js';

  export let data;
  export let role;
  export let onNavigate = () => {};

  const reportTabs = ['Operations', 'Admissions', 'Care delivery', 'Finance'];
  let tab = role === 'Finance' ? 'Finance' : 'Operations';
  let windowDays = 7;
  let reportView;

  $: allowedTabs = role === 'Finance' ? ['Finance'] : role === 'Coordinator' ? reportTabs.filter(item => item !== 'Finance') : reportTabs;
  $: if (!allowedTabs.includes(tab)) tab = allowedTabs[0];
  $: activePatients = data.patients.filter(item => item.status !== 'Archived');
  $: occupiedBeds = data.rooms.flatMap(item => item.beds).filter(Boolean).length;
  $: totalBeds = data.rooms.flatMap(item => item.beds).length;
  $: windowEnd = iso(windowDays);
  $: upcomingSessions = data.sessions.filter(item => item.date >= iso(0) && item.date <= windowEnd);
  $: dueFollowups = data.followups.filter(item => item.status !== 'Completed' && item.due <= windowEnd);
  $: incompleteDocuments = data.inquiries.filter(item => !item.documents && item.stage !== 'New inquiry').length;
  $: reportsDraft = Object.values(data.clinical || {}).flatMap(item => item.reports || []).filter(item => item.status === 'Draft').length;
  $: attendance = Object.values(data.clinical || {}).flatMap(item => item.attendance || []);
  $: attended = attendance.filter(item => item.status === 'Attended').length;
  $: openGoals = Object.values(data.clinical || {}).flatMap(item => item.carePlan?.goals || []).filter(item => item.status !== 'Completed').length;
  $: consentReview = Object.values(data.clinical || {}).flatMap(item => item.consents || []).filter(item => item.status !== 'Recorded').length;
  $: billed = data.invoices.filter(item => item.status !== 'Void').reduce((sum, item) => sum + Number(item.amount || 0), 0);
  $: collected = data.invoices.filter(item => item.status !== 'Void').reduce((sum, item) => sum + Number(item.paid || 0), 0);
  $: balance = Math.max(0, billed - collected);
  $: overdue = data.invoices.filter(item => !['Paid','Void'].includes(item.status) && item.due < iso(0));
  $: overdueBalance = overdue.reduce((sum, item) => sum + Math.max(0, item.amount - (Number(item.paid) || 0)), 0);
  $: stages = ['New inquiry', 'Intake review', 'Awaiting decision', 'Arrival planned'].map(name => ({ name, count: data.inquiries.filter(item => item.stage === name).length }));
  $: sourceNames = [...new Set(data.inquiries.map(item => item.source))];
  $: sources = sourceNames.map(name => ({ name, count: data.inquiries.filter(item => item.source === name).length })).sort((a,b) => b.count - a.count);
  $: therapistNames = ['Therapist A', 'Therapist B'];
  $: therapistRows = therapistNames.map(name => ({
    name,
    patients: activePatients.filter(item => item.therapist === name).length,
    sessions: upcomingSessions.filter(item => item.owner === name).length,
    openGoals: activePatients.filter(item => item.therapist === name).flatMap(item => data.clinical?.[item.id]?.carePlan?.goals || []).filter(goal => goal.status !== 'Completed').length,
    draftReports: activePatients.filter(item => item.therapist === name).flatMap(item => data.clinical?.[item.id]?.reports || []).filter(report => report.status === 'Draft').length
  }));
  $: accounting = totals(buildJournal(data));

  function csvCell(value) { return `"${String(value ?? '').replaceAll('"','""')}"`; }
  function exportCsv() {
    let rows = [];
    if (tab === 'Operations') rows = [['metric','value'],['active_patients',activePatients.length],['beds_occupied',occupiedBeds],['beds_total',totalBeds],['sessions_in_window',upcomingSessions.length],['followups_due',dueFollowups.length]];
    else if (tab === 'Admissions') { const inquiries=reportView?.getRows() || data.inquiries; rows = [['stage','count'],...stages.map(item=>[item.name,inquiries.filter(inquiry=>inquiry.stage===item.name).length]),['incomplete_documents',inquiries.filter(item=>!item.documents && item.stage!=='New inquiry').length]]; }
    else if (tab === 'Care delivery') rows = [['therapist','patients','sessions_in_window','open_goals','draft_reports'],...(reportView?.getRows() || therapistRows).map(item => [item.name,item.patients,item.sessions,item.openGoals,item.draftReports])];
    else rows = [['invoice','patient','payer','owner','due','total','paid','balance','status'],...(reportView?.getRows() || data.invoices).map(item => [item.id,item.patient,item.payer,item.owner,item.due,item.amount,Number(item.paid)||0,item.status === 'Void' ? 0 : Math.max(0,item.amount-(Number(item.paid)||0)),item.status])];
    const content = rows.map(row => row.map(csvCell).join(',')).join('\n');
    const url = URL.createObjectURL(new Blob([content], { type: 'text/csv;charset=utf-8' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = `cedar-${tab.toLowerCase().replaceAll(' ','-')}-report.csv`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 60000);
  }
</script>

<div class="reports-page">
  <div class="page-intro"><div><div class="eyebrow">CENTER REPORTS / {role.toUpperCase()}</div><h1 class="page-title">A clearer picture of <span class="serif">the work.</span></h1><p class="page-desc">Operational reports calculated from the live fictional workspace records.</p></div><div class="intro-actions"><button class="btn btn-outline" on:click={exportCsv}><Icon name="download" size={16}/> Export report view</button></div></div>
  <div class="reports-toolbar"><div class="reports-tabs">{#each allowedTabs as item}<button class:active={tab === item} on:click={() => tab = item}>{item}</button>{/each}</div>{#if tab === 'Operations' || tab === 'Care delivery'}<label class="reports-window">Next <select aria-label="Reporting window" bind:value={windowDays}><option value={7}>7 days</option><option value={30}>30 days</option></select></label>{/if}</div>

  {#if tab === 'Operations'}
    <div class="report-metrics"><article><span>ACTIVE PATIENTS</span><strong>{activePatients.length}</strong><small>Current directory</small></article><article><span>BED OCCUPANCY</span><strong>{occupiedBeds}<em> / {totalBeds}</em></strong><small>{Math.round(occupiedBeds / totalBeds * 100)}% of capacity</small></article><article><span>SESSIONS COMING UP</span><strong>{upcomingSessions.length}</strong><small>Next {windowDays} days</small></article><article><span>FOLLOW-UPS DUE</span><strong>{dueFollowups.length}</strong><small>Open within window</small></article></div>
    <div class="reports-grid"><section class="report-panel"><div class="report-panel-head"><div><span>CAPACITY</span><h2>Residential picture</h2></div><button class="text-link" on:click={() => onNavigate('rooms')}>Room board →</button></div><div class="report-capacity"><div class="report-ring" style={`--fill:${Math.round(occupiedBeds / totalBeds * 100)}%`}><strong>{Math.round(occupiedBeds / totalBeds * 100)}%</strong><small>occupied</small></div><div><div class="report-key"><span class="report-key-dot dark"></span>Occupied beds <strong>{occupiedBeds}</strong></div><div class="report-key"><span class="report-key-dot light"></span>Available beds <strong>{totalBeds-occupiedBeds}</strong></div><div class="report-key"><span class="report-key-dot sand"></span>Planned arrivals <strong>{data.inquiries.filter(item=>item.stage==='Arrival planned').length}</strong></div></div></div></section><section class="report-panel"><div class="report-panel-head"><div><span>PRIORITIES</span><h2>Unfinished work</h2></div></div><div class="report-work"><button on:click={() => onNavigate('admissions')}><span>Intake files missing documents</span><strong>{incompleteDocuments}</strong></button><button on:click={() => onNavigate('aftercare')}><span>Follow-ups due in window</span><strong>{dueFollowups.length}</strong></button><button on:click={() => onNavigate('patients')}><span>Patient reports in draft</span><strong>{reportsDraft}</strong></button><button on:click={() => onNavigate('patients')}><span>Permissions to confirm</span><strong>{consentReview}</strong></button></div></section></div>
  {:else if tab === 'Admissions'}
<Registry items={data.inquiries} label="Admissions report" bind:this={reportView} scope={tab} searchKeys={['id','subject','name']} fields={[{key:'program',label:'Program'},{key:'source',label:'Referral source'},{key:'owner',label:'Coordinator'}]} dateKey="date" dateLabel="Planned contact" sorts={[{key:'date',desc:true,label:'Newest first'},{key:'date',label:'Oldest first'}]} hint="All charts and counts below use the matching inquiry cohort. Export includes its stage totals." let:rows>
{@const viewStages = stages.map(stage=>({...stage,count:rows.filter(item=>item.stage===stage.name).length}))}
{@const viewSources = [...new Set(rows.map(item=>item.source))].map(name=>({name,count:rows.filter(item=>item.source===name).length})).sort((a,b)=>b.count-a.count)}
{@const viewGaps = rows.filter(item=>!item.documents && item.stage!=='New inquiry').length}
    <div class="report-metrics"><article><span>MATCHING INQUIRIES</span><strong>{rows.length}</strong><small>Selected inquiry cohort</small></article><article><span>AWAITING REVIEW</span><strong>{viewStages[1].count + viewStages[2].count}</strong><small>Intake and decision</small></article><article><span>PLANNED ARRIVALS</span><strong>{viewStages[3].count}</strong><small>Staff confirmation required</small></article><article><span>DOCUMENT GAPS</span><strong>{viewGaps}</strong><small>Past first contact</small></article></div>
    <div class="reports-grid"><section class="report-panel"><div class="report-panel-head"><div><span>PIPELINE</span><h2>Where inquiries stand</h2></div><button class="text-link" on:click={() => onNavigate('admissions')}>Open admissions →</button></div><div class="report-bars">{#each viewStages as item}<div><span>{item.name}</span><div><i style:width={Math.max(0, item.count / Math.max(1,rows.length) * 100) + '%'}></i></div><strong>{item.count}</strong></div>{/each}</div></section><section class="report-panel"><div class="report-panel-head"><div><span>REFERRAL MIX</span><h2>How people reached Cedar</h2></div></div><div class="report-bars">{#each viewSources as item}<div><span>{item.name}</span><div><i class="sand" style:width={Math.max(0,item.count / Math.max(1,rows.length) * 100) + '%'}></i></div><strong>{item.count}</strong></div>{/each}</div><p class="report-footnote">These counts describe current fictional records. They are not a clinical outcome measure.</p></section></div>
  </Registry>
  {:else if tab === 'Care delivery'}
    <div class="report-metrics"><article><span>OPEN CARE GOALS</span><strong>{openGoals}</strong><small>Across active records</small></article><article><span>ATTENDANCE RECORDED</span><strong>{attended}<em> / {attendance.length}</em></strong><small>Attended entries</small></article><article><span>DRAFT REPORTS</span><strong>{reportsDraft}</strong><small>Awaiting review</small></article><article><span>UPCOMING SESSIONS</span><strong>{upcomingSessions.length}</strong><small>Next {windowDays} days</small></article></div>
    <section class="report-panel"><div class="report-panel-head"><div><span>TEAM LOAD</span><h2>Care delivery by therapist</h2></div><button class="text-link" on:click={() => onNavigate('patients')}>Patient records →</button></div><Registry items={therapistRows} label="Therapist workload" bind:this={reportView} scope={tab} searchKeys={['name']} fields={[{key:'name',label:'Therapist'},{id:'drafts',key:item=>item.draftReports>0?'Drafts outstanding':'No drafts',label:'Report queue'}]} sorts={[{key:'name',label:'Therapist name'},{key:'patients',desc:true,label:'Largest caseload'},{key:'sessions',desc:true,label:'Most upcoming sessions'},{key:'openGoals',desc:true,label:'Most open goals'}]} hint="Summary cards show center totals. This table and its CSV show matching therapists." let:rows><div class="report-table-wrap" use:scrollRegion role="region" aria-label="Data table — scroll horizontally to see all columns"><table class="report-table"><thead><tr><th>Therapist</th><th>Assigned patients</th><th>Upcoming sessions</th><th>Open goals</th><th>Draft reports</th></tr></thead><tbody>{#each rows as item}<tr><td><strong>{item.name}</strong></td><td>{item.patients}</td><td>{item.sessions}</td><td>{item.openGoals}</td><td>{item.draftReports}</td></tr>{/each}</tbody></table></div></Registry><p class="report-footnote">Operational workload only. This view does not score treatment quality or predict outcomes.</p></section>
  {:else if tab === 'Finance'}
<Registry items={data.invoices} label="Invoice report" bind:this={reportView} scope={tab} searchKeys={['id','patient','payer']} fields={[{key:'payer',label:'Payer'},{key:'owner',label:'Owner'},{key:'status',label:'Status'}]} dateKey="issued" dateLabel="Invoice issued" sorts={[{key:'due',label:'Due soonest'},{key:'amount',desc:true,label:'Largest amount'}]} hint="Invoice cohort: payments and balances below are current for matching invoices. Issue dates do not filter payment dates. The operating statement further below remains all time." let:rows>
{@const viewBilled = rows.filter(item=>item.status!=='Void').reduce((sum,item)=>sum+Number(item.amount||0),0)}
{@const viewCollected = rows.filter(item=>item.status!=='Void').reduce((sum,item)=>sum+Number(item.paid||0),0)}
{@const viewBalance = Math.max(0,viewBilled-viewCollected)}
{@const viewOverdue = rows.filter(item=>!['Paid','Void'].includes(item.status) && item.due<iso(0))}
{@const viewOverdueBalance = viewOverdue.reduce((sum,item)=>sum+Math.max(0,item.amount-Number(item.paid||0)),0)}
    <div class="report-metrics"><article><span>INVOICED</span><strong>${viewBilled.toLocaleString()}</strong><small>Fictional USD ledger</small></article><article><span>COLLECTED</span><strong>${viewCollected.toLocaleString()}</strong><small>Recorded payments</small></article><article><span>OPEN BALANCE</span><strong>${viewBalance.toLocaleString()}</strong><small>Across unpaid invoices</small></article><article><span>PAST DUE</span><strong>${viewOverdueBalance.toLocaleString()}</strong><small>{viewOverdue.length} invoices</small></article></div>
    <div class="reports-grid"><section class="report-panel"><div class="report-panel-head"><div><span>PAYMENT POSITION</span><h2>Collected and outstanding</h2></div><button class="text-link" on:click={() => onNavigate('billing')}>Invoice ledger →</button></div><div class="report-finance-bar"><span style:width={Math.max(0,Math.min(100,viewCollected / Math.max(1,viewBilled) * 100)) + '%'}></span></div><div class="report-finance-key"><span>Collected <strong>${viewCollected.toLocaleString()}</strong></span><span>Outstanding <strong>${viewBalance.toLocaleString()}</strong></span></div></section><section class="report-panel"><div class="report-panel-head"><div><span>AGING</span><h2>Balances to follow up</h2></div></div><div class="report-work">{#each viewOverdue as item}<button on:click={() => onNavigate('billing')}><span>{item.id} · {item.payer}<small>{item.patient} · due {prettyDate(item.due)}</small></span><strong>${Math.max(0,item.amount-(Number(item.paid)||0)).toLocaleString()}</strong></button>{:else}<p class="report-footnote">No overdue invoices in this ledger.</p>{/each}</div></section></div>
    </Registry>
    <div class="reports-grid finance-report-extra"><section class="report-panel"><div class="report-panel-head"><div><span>OPERATING STATEMENT · ALL TIME</span><h2>Income and approved costs</h2></div><button class="text-link" on:click={() => onNavigate('ledger')}>General ledger →</button></div><div class="report-work"><div><span>Program revenue</span><strong>{money(accounting.revenue)}</strong></div><div><span>Approved operating expenses</span><strong>{money(accounting.expenses)}</strong></div><div class="report-strong"><span>Operating result in this preview</span><strong>{money(accounting.revenue-accounting.expenses)}</strong></div></div><p class="report-footnote">Calculated from posted fictional journal entries. This preview is not a complete statutory statement.</p></section><section class="report-panel"><div class="report-panel-head"><div><span>WORKING CAPITAL · ALL TIME</span><h2>Amounts to collect and settle</h2></div></div><div class="report-work"><button on:click={() => onNavigate('payments')}><span>Accounts receivable</span><strong>{money(accounting.receivables)}</strong></button><button on:click={() => onNavigate('expenses')}><span>Accounts payable</span><strong>{money(accounting.payables)}</strong></button><button on:click={() => onNavigate('reconciliation')}><span>Unmatched statement lines</span><strong>{(data.finance?.bankEntries||[]).filter(item=>!item.matchedJournalId).length}</strong></button></div></section></div>
  {/if}
  <p class="report-disclaimer">Fictional demo data · Export reflects this browser’s current records · Staff review is required for all decisions.</p>
</div>
