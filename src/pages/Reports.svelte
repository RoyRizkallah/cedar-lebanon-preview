<script>
  import Icon from '../components/Icon.svelte';
  import Bars from '../components/Bars.svelte';
  import { db, session } from '../lib/store.svelte.js';
  import { hasRole } from '../lib/people.js';
  import { REPORT_GROUPS, buildReports, reportHeadlines } from '../lib/reports.js';
  import { fmtDate, todayISO } from '../lib/dates.js';
  import { downloadCsv, downloadSections } from '../lib/csv.js';

  let { args = [] } = $props();
  const me = session.staffId;
  const groups = REPORT_GROUPS.filter(group => hasRole(me, ...group.staff));
  const group = $derived(groups.find(item => item.id === args[0]) || groups[0]);
  const tables = $derived(buildReports(db, group.id, session.now));
  const heads = $derived(reportHeadlines(db, group.id, session.now));
  const GROUP_ICONS = { operations: 'building', admissions: 'funnel', care: 'stethoscope', finance: 'receipt' };
  const prepared = fmtDate(todayISO(session.now), { day: 'numeric', month: 'long', year: 'numeric' });
  const value = (row, column) => typeof column.value === 'function' ? column.value(row) : row[column.value];
  const shown = (row, column) => { const v = value(row, column); return typeof v === 'number' && /USD/.test(column.label) ? `$${v.toLocaleString('en-US')}` : v; };
  const bars = table => {
    const usd = /USD/.test(table.columns.find(column => column.value === table.chart)?.label);
    return table.rows.map(row => ({ label: String(value(row, table.columns[0])), value: row[table.chart], display: usd ? `$${row[table.chart].toLocaleString('en-US')}` : undefined }));
  };
  const chartLabel = table => (table.columns.find(column => column.value === table.chart)?.label || '').replace(' (USD)', '');
  // Charts that add nothing (one row, or every bar zero) are left out.
  const hasChart = table => table.chart && table.rows.length > 1 && table.rows.some(row => row[table.chart] > 0);
</script>

<main class="content wide">
  <div class="page-head">
    <div><h1>Reports</h1><p>Figures straight from the records. Prepared {prepared}; print it or take it to Excel.</p></div>
    <div class="actions no-print">
      <button class="btn" onclick={() => window.print()}><Icon name="print" size={16} />Print</button>
      <button class="btn primary" onclick={() => downloadSections(`cedar-${group.id}-${todayISO(session.now)}`, tables)}><Icon name="download" size={16} />Download all</button>
    </div>
  </div>

  {#if groups.length > 1}
    <nav class="groups no-print" aria-label="Report groups">
      {#each groups as item (item.id)}
        <a href={`#/reports/${item.id}`} aria-current={group.id === item.id ? 'page' : undefined}><Icon name={GROUP_ICONS[item.id] || 'document'} size={16} />{item.label}</a>
      {/each}
    </nav>
  {/if}
  <h2 class="print-only">Cedar Rehab: {group.label} report, {prepared}</h2>

  <section class="heads" aria-label="Headline figures">
    {#each heads as head, index (head.label)}
      <div class="head" class:lead={index === 0} class:urgent={head.tone === 'urgent'} class:warn={head.tone === 'warn'}>
        <span class="label">{head.label}</span>
        <strong class="num">{head.value}</strong>
        <span class="note">{head.note}</span>
      </div>
    {/each}
  </section>

  <div class="report-grid">
    {#each tables as table, index (table.id)}
      <section class="report">
        <header class="report-head">
          <span class="r-no num">{index + 1}</span>
          <div class="grow"><h3>{table.title}</h3><span class="faint">{table.rows.length} {table.rows.length === 1 ? 'row' : 'rows'}{hasChart(table) ? `; bars show ${chartLabel(table).toLowerCase()}` : ''}</span></div>
          <button class="btn sm ghost no-print" onclick={() => downloadCsv(`cedar-${table.id}`, table.columns, table.rows)}><Icon name="download" size={14} />CSV</button>
        </header>
        {#if hasChart(table)}<div class="chart"><Bars rows={bars(table)} /></div>{/if}
        <div class="table-wrap">
          <table class="table">
            <thead><tr>{#each table.columns as column, col (column.label)}<th class:num={col > 0}>{column.label}</th>{/each}</tr></thead>
            <tbody>
              {#each table.rows as row, rowIndex (rowIndex)}<tr>{#each table.columns as column, col (column.label)}<td class:num={col > 0}>{shown(row, column)}</td>{/each}</tr>
              {:else}<tr><td colspan={table.columns.length} class="faint">Nothing recorded yet.</td></tr>{/each}
            </tbody>
          </table>
        </div>
      </section>
    {/each}
  </div>
</main>

<style>
  /* Pick a group, read its four headline figures, then each report as bars over its table */
  .groups { display: flex; gap: 6px; flex-wrap: wrap; margin-bottom: 12px; }
  .groups a { display: inline-flex; align-items: center; gap: 7px; height: 34px; padding: 0 14px; border-radius: 17px; background: var(--paper); box-shadow: var(--shadow-1); color: var(--text-2); font-size: 13px; font-weight: 700; text-decoration: none; }
  .groups a:hover { color: var(--text); text-decoration: none; }
  .groups a[aria-current='page'] { background: var(--strong); color: var(--on-strong); }

  .heads { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 10px; margin-bottom: 12px; }
  .head { display: flex; flex-direction: column; gap: 2px; padding: 12px 16px; border-radius: 16px; background: var(--paper); box-shadow: var(--shadow-1); min-width: 0; }
  .head .label { font-size: 12.5px; font-weight: 650; color: var(--text-2); }
  .head strong { font-size: 24px; font-weight: 800; letter-spacing: -0.03em; line-height: 1.15; }
  .head .note { font-size: 12px; color: var(--text-3); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .head.lead { background: var(--hero); color: var(--on-ink); }
  .head.lead .label, .head.lead .note { color: var(--on-ink-2); }
  .head.lead strong { color: var(--lime); }
  .head.warn strong { color: var(--warn); }
  .head.urgent strong { color: var(--urgent); }

  .report-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(min(100%, 460px), 1fr)); gap: 12px; align-items: start; }
  .report { background: var(--paper); border-radius: 16px; box-shadow: var(--shadow-1); overflow: hidden; min-width: 0; }
  .report-head { display: flex; align-items: center; gap: 10px; padding: 12px 14px 8px; }
  .report-head h3 { font-size: 14.5px; font-weight: 800; }
  .report-head .faint { font-size: 12px; }
  .r-no { width: 28px; height: 28px; border-radius: 9px; display: inline-flex; align-items: center; justify-content: center; flex: none; background: var(--strong); color: var(--on-strong); font-size: 12.5px; font-weight: 800; }
  .chart { padding: 4px 16px 10px; }
  .chart :global(.bars) { gap: 6px; }
  .chart :global(.bars li) { grid-template-columns: 120px 1fr 64px; font-size: 12.5px; }
  .chart :global(.track) { height: 9px; }
  .report .table-wrap { padding: 0 4px 6px; border-top: 1px solid var(--line); }
  .report td:first-child { white-space: nowrap; }
  .print-only { display: none; }
  @media (max-width: 900px) { .heads { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
  @media print {
    .print-only { display: block; margin-bottom: 10px; }
    .heads { grid-template-columns: repeat(4, 1fr); }
    .report { break-inside: avoid; box-shadow: none; border: 1px solid #ccc; }
    .head { box-shadow: none; border: 1px solid #ccc; }
  }
</style>
