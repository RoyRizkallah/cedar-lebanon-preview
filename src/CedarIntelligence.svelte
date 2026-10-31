<script>
  import Icon from './Icon.svelte';
  import Registry from './Registry.svelte';
  import { analyzeAdmissions } from './analytics.js';
  import { prettyDate } from './data.js';
  import { downloadRows, scrollRegion } from './registry.js';
  import { dialogFocus } from './dialogFocus.js';
  import { buildCenterIntelligence } from './centerIntelligence.js';
  import CenterSignals from './CenterSignals.svelte';

  export let analytics = [];
  export let workspace = {};
  export let onNavigate = () => {};
  export let onOpenPatient = () => {};
  export let onOpenInquiry = () => {};

  let section = 'overview';
  let metric = 'conversion';
  let period = 'current';
  let outcome = 'all';
  let source = 'all';
  let question = '';
  let questionError = '';
  let selectedRecord = null;
  let modelReading = null;
  let modelError = '';
  let modelLoading = false;
  let requestNumber = 0;
  let evidenceView;

  $: report = analyzeAdmissions(analytics, metric);
  $: center = buildCenterIntelligence(workspace);
  $: admission = analyzeAdmissions(analytics, 'conversion');
  $: response = analyzeAdmissions(analytics, 'response');
  $: selectedPeriod = period === 'current' ? report.current : report.previous;
  $: evidenceRows = selectedPeriod.filter(row =>
    (outcome === 'all' || (outcome === 'delayed' ? Number(row.responseHours) > 24 : row.outcome === outcome)) &&
    (source === 'all' || row.source === source)
  );
  $: delayedPrevious = report.previous.filter(row => Number(row.responseHours) > 24);
  $: delayedCurrent = report.current.filter(row => Number(row.responseHours) > 24);

  function chooseMetric(next) {
    metric = next;
    questionError = '';
    modelReading = null;
    modelError = '';
    requestNumber += 1;
    modelLoading = false;
  }

  function askQuestion() {
    const value = question.trim();
    if (!value) { questionError = 'Choose a question or enter one below.'; return; }
    if (/reply|replies|response|respond|24.hour|wait|speed|delay|slow/i.test(value)) chooseMetric('response');
    else if (/admission|conversion|convert|inquir|source|referral/i.test(value)) chooseMetric('conversion');
    else { questionError = 'This preview can investigate admissions and first reply times. Try one of those topics.'; return; }
    questionError = '';
    document.getElementById('intel-report')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  async function generateReading() {
    if (import.meta.env.MODE === 'review') { modelReading = null; modelError = 'AI commentary requires the local Cedar server and model. The verified figures and source records remain available here.'; return; }
    const request = ++requestNumber;
    modelReading = null;
    modelError = '';
    modelLoading = true;
    try {
      const response = await fetch('/api/investigate', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ metric, question: question.trim() || report.title }),
        signal: AbortSignal.timeout(7500)
      });
      if (!response.ok) throw new Error('unavailable');
      const reading = await response.json();
      if (request === requestNumber) modelReading = reading;
    } catch {
      if (request === requestNumber) modelError = 'AI commentary is unavailable here. The calculated report and source records are ready below.';
    } finally {
      if (request === requestNumber) modelLoading = false;
    }
  }

  function inspectDelayed() {
    period = 'current'; outcome = 'delayed'; source = 'all';
    document.getElementById('intel-evidence')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function inspectSource(name) {
    period = 'current'; outcome = 'all'; source = name;
    document.getElementById('intel-evidence')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function exportEvidence() {
    downloadRows('cedar-intelligence-evidence', [
      { key: 'id', label: 'Record' }, { key: 'date', label: 'Inquiry date' },
      { key: 'source', label: 'Source' }, { key: 'responseHours', label: 'First reply hours' },
      { key: 'outcome', label: 'Outcome' }
    ], evidenceView?.getRows() || evidenceRows);
  }

  function openFlag(flag) {
    if (flag.route === 'patient') onOpenPatient(flag.recordId, flag.tab, flag.sourceIds?.[0]);
    else if (flag.route === 'inquiry') onOpenInquiry(flag.recordId);
    else onNavigate(flag.route);
  }
</script>

<div class="page-intro intel-page-intro"><div><div class="eyebrow">07 / CEDAR INTELLIGENCE</div><h1 class="page-title">The center, <span class="serif">in focus.</span></h1><p class="page-desc">A live view of center activity, work that needs follow-through, and patterns worth a closer look.</p></div><div class="intel-intro-meta"><span class="intel-status-dot"></span><span>LOCAL WORKSPACE<br/><strong>Fictional preview records</strong></span></div></div>
<nav class="ci-tabs" aria-label="Cedar Intelligence sections"><button type="button" class:active={section === 'overview'} on:click={() => section = 'overview'}>Center overview</button><button type="button" class:active={section === 'work'} on:click={() => section = 'work'}>Work quality <span>{center.flags.length}</span></button><button type="button" class:active={section === 'patterns'} on:click={() => section = 'patterns'}>Patient patterns <span>{center.patterns.length}</span></button><button type="button" class:active={section === 'admissions'} on:click={() => section = 'admissions'}>Admissions trends</button></nav>
{#if section === 'admissions'}
<section class="intel-workbench" aria-label="Admissions intelligence workbench">
  <div class="intel-workbench-head"><span>01 / INVESTIGATE</span><p>Choose the signal to explore</p></div>
  <div class="intel-metric-strip" role="group" aria-label="Investigation metric">
    <button type="button" class:active={metric === 'conversion'} on:click={() => chooseMetric('conversion')} aria-pressed={metric === 'conversion'}>
      <span class="intel-metric-icon"><Icon name="chart" size={18}/></span><span class="intel-metric-copy"><small>ADMISSIONS</small><strong>Inquiry to admission</strong><em>{admission.currCount} of {admission.current.length} recent inquiries</em></span><span class="intel-metric-value">{admission.currRate}<small>%</small><i class:down={admission.delta < 0}>{admission.delta > 0 ? '+' : ''}{admission.delta} pts</i></span>
    </button>
    <button type="button" class:active={metric === 'response'} on:click={() => chooseMetric('response')} aria-pressed={metric === 'response'}>
      <span class="intel-metric-icon"><Icon name="clock" size={18}/></span><span class="intel-metric-copy"><small>FIRST CONTACT</small><strong>Replied within 24 hours</strong><em>{response.currCount} of {response.current.length} recent inquiries</em></span><span class="intel-metric-value">{response.currRate}<small>%</small><i class:down={response.delta < 0}>{response.delta > 0 ? '+' : ''}{response.delta} pts</i></span>
    </button>
  </div>
  <form class="intel-question" on:submit|preventDefault={askQuestion}>
    <label for="intel-question-input"><Icon name="sparkle" size={18}/> Ask Cedar about this sample</label>
    <div class="intel-question-entry"><input id="intel-question-input" bind:value={question} placeholder="Why did admissions fall?"/><button type="submit">Investigate <Icon name="arrow" size={15}/></button></div>
    {#if questionError}<p role="alert">{questionError}</p>{/if}
    <small>Supported topics: admissions and first reply times. Questions select a calculated report.</small>
  </form>
</section>

<section id="intel-report" class="intel-report" aria-live="polite">
  <div class="intel-report-main">
    <div class="intel-report-label"><span class="intel-status-dot"></span> 02 / VERIFIED BRIEFING <span>·</span> {report.title.toUpperCase()}</div>
    <h2>{report.headline}<span>.</span></h2>
    <p class="intel-report-lead">{report.currCount} of {report.current.length} recent inquiries met this measure, compared with {report.prevCount} of {report.previous.length} in the prior period.</p>
    <div class="intel-report-rule"></div>
    <div class="intel-report-context"><span>WHAT TO REVIEW NEXT</span><p>{metric === 'conversion' ? `First replies over 24 hours rose from ${delayedPrevious.length} to ${delayedCurrent.length}. Check the delayed inquiries before drawing a conclusion about admission outcomes.` : `First replies over 24 hours rose from ${delayedPrevious.length} to ${delayedCurrent.length}. Review those handoffs and confirm who owned each first response.`}</p><button type="button" on:click={inspectDelayed}>View delayed records <Icon name="arrow" size={15}/></button></div>
  </div>
  <div class="intel-report-chart" aria-label="Comparison of previous and recent period rates">
    <div class="intel-chart-heading"><div><small>PERIOD COMPARISON</small><strong>Same definition. Same window length.</strong></div><span>{report.delta > 0 ? '+' : ''}{report.delta} <small>POINTS</small></span></div>
    <div class="intel-chart-guide"><span>0%</span><span>25%</span><span>50%</span><span>75%</span><span>100%</span></div>
    <div class="intel-period"><div class="intel-period-top"><span>PREVIOUS / {report.previousLabel}</span><strong>{report.prevRate}%</strong></div><div class="intel-period-rail"><i style:width="{report.prevRate}%"></i></div><small>{report.prevCount} of {report.previous.length} inquiries</small></div>
    <div class="intel-period recent"><div class="intel-period-top"><span>RECENT / {report.currentLabel}</span><strong>{report.currRate}%</strong></div><div class="intel-period-rail"><i style:width="{report.currRate}%"></i></div><small>{report.currCount} of {report.current.length} inquiries</small></div>
    <div class="intel-chart-definition"><Icon name="shield" size={16}/><span>{report.definition}. Rates are rounded to whole percentages; change is in percentage points.</span></div>
  </div>
</section>

<div class="intel-analysis-grid">
  <section class="intel-findings" aria-labelledby="intel-findings-title">
    <div class="intel-section-head"><div><span>03 / READ THE SIGNAL</span><h2 id="intel-findings-title">What the records show</h2></div><span class="intel-evidence-count">24 SOURCE RECORDS</span></div>
    <div class="intel-finding-list">{#each report.evidence as point, index}<div class="intel-finding"><span>0{index + 1}</span><p>{point}</p></div>{/each}</div>
    <div class="intel-ai-note"><div class="intel-ai-heading"><Icon name="sparkle" size={18}/><div><strong>AI interpretation</strong><span>Optional commentary on verified aggregate figures</span></div></div>{#if modelLoading}<p>Reading the figures…</p>{:else if modelReading}<p>{modelReading.interpretation}</p><p><strong>Suggested review:</strong> {modelReading.nextStep}</p>{:else if modelError}<p role="status">{modelError}</p>{:else}<p>Generate a short reading after you have checked the underlying counts.</p>{/if}<button type="button" on:click={generateReading} disabled={modelLoading}>{modelLoading ? 'Generating…' : modelReading ? 'Refresh AI reading' : 'Generate AI reading'} <Icon name="arrow" size={14}/></button></div>
  </section>
  <section class="intel-sources" aria-labelledby="intel-sources-title">
    <div class="intel-section-head"><div><span>04 / FIND THE SHIFT</span><h2 id="intel-sources-title">By inquiry source</h2></div></div>
    <div class="intel-source-header"><span>SOURCE</span><span>PREVIOUS</span><span>RECENT</span><span>CHANGE</span></div>
    {#each report.bySource as group}<button type="button" class="intel-source-row" on:click={() => inspectSource(group.source)} aria-label="View recent {group.source} inquiries"><strong>{group.source}</strong><span>{group.before}<small>{group.beforeRate}%</small></span><span>{group.after}<small>{group.afterRate}%</small></span><em class:negative={group.afterRate - group.beforeRate < 0}>{group.afterRate - group.beforeRate > 0 ? '+' : ''}{group.afterRate - group.beforeRate} pts</em></button>{/each}
    <p class="intel-source-note">Select a source to inspect its recent records. Each rate uses that source’s inquiries as the denominator. Small groups can move sharply.</p>
  </section>
</div>

<section id="intel-evidence" class="intel-evidence" aria-labelledby="intel-evidence-title">
  <div class="intel-section-head"><div><span>05 / AUDIT THE ANSWER</span><h2 id="intel-evidence-title">Source records</h2><p>Every inquiry in the selected period is available below. Filters change this ledger, not the briefing above.</p></div><button type="button" class="intel-export" on:click={exportEvidence}><Icon name="download" size={16}/> Export visible rows</button></div>
  <div class="intel-evidence-toolbar"><div class="intel-period-toggle" role="group" aria-label="Evidence period"><button type="button" class:active={period === 'current'} on:click={() => period = 'current'}>Recent <span>{report.current.length}</span></button><button type="button" class:active={period === 'previous'} on:click={() => period = 'previous'}>Previous <span>{report.previous.length}</span></button></div><label>Outcome <select bind:value={outcome} aria-label="Filter outcome"><option value="all">All outcomes</option><option value="delayed">Reply after 24h</option><option value="Admitted">Admitted</option><option value="Not admitted">Not admitted</option></select></label><label>Source <select bind:value={source} aria-label="Filter source"><option value="all">All sources</option><option>Website</option><option>Phone</option><option>Referral</option><option>Family</option></select></label><span class="intel-row-count">{evidenceRows.length} in view</span></div>
  <Registry items={evidenceRows} label="Evidence records" pageSize={25} bind:this={evidenceView} scope={period+metric+outcome+source} searchKeys={['id','source','outcome']} dateKey="date" dateLabel="Inquiry date" sorts={[{key:'date',desc:true,label:'Newest first'},{key:row=>Number(row.responseHours),desc:true,label:'Slowest reply first'},{key:row=>Number(row.responseHours),label:'Fastest reply first'}]} let:rows>
    <div class="table-wrap" use:scrollRegion role="region" aria-label="Evidence table — scroll horizontally to see all columns"><table class="data-table intel-record-table"><thead><tr><th>RECORD</th><th>INQUIRY DATE</th><th>SOURCE</th><th>FIRST REPLY</th><th>OUTCOME</th><th></th></tr></thead><tbody>{#each rows as row}<tr><td><button type="button" class="intel-record-link" on:click={() => selectedRecord = row}>{row.id}</button></td><td>{prettyDate(row.date,{day:'numeric',month:'short',year:'numeric'})}</td><td>{row.source}</td><td><span class:late={Number(row.responseHours)>24} class="intel-reply-tag">{row.responseHours}h {Number(row.responseHours)>24 ? '· delayed' : '· on time'}</span></td><td><span class:admitted={row.outcome === 'Admitted'} class="intel-outcome">{row.outcome}</span></td><td><button type="button" class="intel-row-open" on:click={() => selectedRecord = row} aria-label="Inspect {row.id}"><Icon name="arrow" size={15}/></button></td></tr>{:else}<tr><td colspan="6" class="table-empty">No records match these filters.</td></tr>{/each}</tbody></table></div>
  </Registry>
  <div class="intel-evidence-foot"><span>Fictional historical sample · Current pipeline edits are separate</span><button type="button" on:click={() => onNavigate('admissions')}>Open live admissions <Icon name="arrow" size={14}/></button></div>
</section>

<div class="intel-method-foot"><div><Icon name="shield" size={17}/><p><strong>How this is calculated</strong>Two completed 14-day windows. The same measure and denominator are used for both. Association does not establish cause.</p></div><span>FICTIONAL DATA · NO PATIENT OUTCOME PREDICTIONS</span></div>
{:else}
<CenterSignals {section} {center} onSection={(value) => section = value} onOpenFlag={openFlag} {onOpenPatient}/>
{/if}

{#if selectedRecord}<div class="intel-drawer-backdrop" role="presentation" on:click={(event) => { if (event.target === event.currentTarget) selectedRecord = null; }}><div class="intel-record-drawer" use:dialogFocus={{onClose:() => selectedRecord = null}} aria-label="Evidence record {selectedRecord.id}"><div class="intel-drawer-head"><span>EVIDENCE / {selectedRecord.id}</span><button type="button" on:click={() => selectedRecord = null} aria-label="Close record"><Icon name="close" size={18}/></button></div><h2>Inquiry record</h2><p>A historical sample row used in the {period === 'current' ? 'recent' : 'previous'} comparison.</p><dl><div><dt>Record ID</dt><dd>{selectedRecord.id}</dd></div><div><dt>Inquiry date</dt><dd>{prettyDate(selectedRecord.date,{day:'numeric',month:'short',year:'numeric'})}</dd></div><div><dt>Inquiry source</dt><dd>{selectedRecord.source}</dd></div><div><dt>First reply</dt><dd>{selectedRecord.responseHours} hours · {Number(selectedRecord.responseHours) > 24 ? 'After 24 hours' : 'Within 24 hours'}</dd></div><div><dt>Outcome</dt><dd>{selectedRecord.outcome}</dd></div></dl><div class="intel-drawer-contribution"><span>IN THIS REPORT</span><p>This record counts in the {period === 'current' ? 'recent' : 'previous'} denominator. {metric === 'conversion' ? (selectedRecord.outcome === 'Admitted' ? 'It also counts as an admission.' : 'It does not count as an admission.') : (Number(selectedRecord.responseHours) <= 24 ? 'It also counts as an on-time first reply.' : 'It does not count as an on-time first reply.')}</p></div><button type="button" class="intel-drawer-close" on:click={() => selectedRecord = null}>Close record</button></div></div>{/if}
