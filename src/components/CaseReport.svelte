<script>
  import Icon from './Icon.svelte';
  import { db, session } from '../lib/store.svelte.js';
  import { caseReport } from '../lib/assist/caseReport.js';
  import { fmtDateTime } from '../lib/dates.js';
  import { dialogFocus } from '../lib/dialogFocus.js';

  let { patientId, onclose } = $props();
  const report = caseReport(db, patientId, session.now);
</script>

<div class="scrim" onclick={onclose} aria-hidden="true"></div>
<section class="drawer wide case-report" use:dialogFocus={{ onClose: onclose }}>
  <header class="drawer-head">
    <span class="assist-mark"><Icon name="sparkle" size={19} stroke={2} /></span>
    <div class="grow">
      <h2>Case report: {report.patient.clinicalName}</h2>
      <p class="muted" style="margin-top: 4px">Prepared {fmtDateTime(report.preparedAt)} from filed records. Preview of Cedar Assist: assembled in this browser; the live version writes it with AI. Check it before sharing.</p>
    </div>
    <button class="btn ghost icon no-print" aria-label="Close" data-autofocus onclick={onclose}><Icon name="close" /></button>
  </header>
  <div class="drawer-body">
    <p class="confidential"><Icon name="lock" size={14} />Confidential clinical record. Not for the admin file or family communication.</p>
    {#if report.missing.length}<p class="notice warn" style="margin: 12px 0"><Icon name="alert" size={15} />{report.missing.join(' ')}</p>{/if}
    {#each report.sections as section (section.title)}
      <section class="report-section">
        <h3>{section.title}</h3>
        <ul>{#each section.lines as line, index (index)}<li><span>{line.text}</span><cite>{line.source}</cite></li>{/each}</ul>
      </section>
    {/each}
  </div>
  <footer class="drawer-foot no-print"><button class="btn" onclick={onclose}>Close</button><button class="btn primary" onclick={() => window.print()}><Icon name="print" size={16} />Print or save as PDF</button></footer>
</section>

<style>
  .report-section { padding: 16px 0; border-top: 1px solid var(--line); }
  .report-section:first-of-type { border-top: 0; }
  .report-section h3 { font: 650 16px/1.2 var(--font-display); margin-bottom: 8px; }
  .report-section ul { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 8px; }
  .report-section li { display: flex; gap: 16px; justify-content: space-between; align-items: baseline; }
  .report-section cite { flex: none; font-style: normal; font-size: 12px; color: var(--text-3); white-space: nowrap; }
  @media print {
    .case-report { position: static; width: auto; box-shadow: none; border: 0; }
    :global(.shell) { display: none !important; }
  }
</style>
