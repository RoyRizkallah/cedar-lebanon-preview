<script>
  import Icon from '../components/Icon.svelte';
  import { db, session } from '../lib/store.svelte.js';
  import { hasRole } from '../lib/people.js';
  import { REPORT_GROUPS, buildReports } from '../lib/reports.js';
  import { fmtDate, todayISO } from '../lib/dates.js';
  import { downloadCsv } from '../lib/csv.js';

  let { args = [] } = $props();
  const me = session.staffId;
  const groups = REPORT_GROUPS.filter(group => hasRole(me, ...group.staff));
  const group = $derived(groups.find(item => item.id === args[0]) || groups[0]);
  const tables = $derived(buildReports(db, group.id, session.now));
  const GROUP_ICONS = { operations: 'building', admissions: 'funnel', care: 'stethoscope', finance: 'receipt' };
  const value = (row, column) => typeof column.value === 'function' ? column.value(row) : row[column.value];
</script>

<main class="content wide">
  <div class="page-head">
    <div><h1>Reports</h1><p>Figures straight from the records, ready to print or export. Prepared {fmtDate(todayISO(session.now), { day: 'numeric', month: 'long', year: 'numeric' })}.</p></div>
    <div class="actions no-print"><button class="btn" onclick={() => window.print()}><Icon name="print" size={16} />Print or save as PDF</button></div>
  </div>

  {#if groups.length > 1}
    <nav class="gallery no-print" aria-label="Report groups">
      {#each groups as item (item.id)}
        <a class="group-card" href={`#/reports/${item.id}`} aria-current={group.id === item.id ? 'page' : undefined}>
          <span class="g-icon"><Icon name={GROUP_ICONS[item.id] || 'document'} size={20} /></span>
          <strong>{item.label}</strong>
          <span class="g-sub">{group.id === item.id ? `${tables.length} reports open` : 'Open reports'}</span>
        </a>
      {/each}
    </nav>
  {/if}
  <h2 class="print-only" style="margin-bottom: 12px">Cedar Rehab: {group.label} report</h2>

  <div class="report-grid">
    {#each tables as table, index (table.id)}
      <section class="report">
        <header class="report-head">
          <span class="r-no num">{String(index + 1).padStart(2, '0')}</span>
          <div class="grow"><h3>{table.title}</h3><span class="faint">{table.rows.length} {table.rows.length === 1 ? 'row' : 'rows'}</span></div>
          <button class="btn sm ghost no-print" onclick={() => downloadCsv(`cedar-${table.id}`, table.columns, table.rows)}><Icon name="download" size={14} />CSV</button>
        </header>
        <div class="table-wrap">
          <table class="table">
            <thead><tr>{#each table.columns as column, index (column.label)}<th class:num={index > 0}>{column.label}</th>{/each}</tr></thead>
            <tbody>
              {#each table.rows as row, index (index)}<tr>{#each table.columns as column, col (column.label)}<td class:num={col > 0}>{typeof value(row, column) === 'number' && /USD/.test(column.label) ? Number(value(row, column)).toLocaleString('en-US') : value(row, column)}</td>{/each}</tr>
              {:else}<tr><td colspan={table.columns.length} class="faint">Nothing recorded yet.</td></tr>{/each}
            </tbody>
          </table>
        </div>
      </section>
    {/each}
  </div>
</main>

<style>
  /* A gallery of report groups to pick from, then the chosen group's reports as numbered cards */
  .gallery { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 12px; margin-bottom: 24px; }
  .group-card { display: flex; flex-direction: column; gap: 4px; padding: 18px 20px; border-radius: 26px; background: var(--paper); box-shadow: var(--shadow-1); color: var(--text); text-decoration: none; transition: transform 0.15s, box-shadow 0.15s; }
  .group-card:hover { transform: translateY(-2px); box-shadow: var(--shadow-2); text-decoration: none; }
  .group-card strong { font-size: 16px; font-weight: 800; margin-top: 10px; }
  .g-sub { font-size: 12.5px; color: var(--text-3); font-weight: 600; }
  .g-icon { width: 42px; height: 42px; border-radius: 14px; display: inline-flex; align-items: center; justify-content: center; background: var(--leaf); color: var(--moss); }
  .group-card[aria-current='page'] { background: var(--hero); color: var(--on-ink); box-shadow: var(--shadow-2); }
  .group-card[aria-current='page'] .g-sub { color: var(--on-ink-2); }
  .group-card[aria-current='page'] .g-icon { background: var(--lime); color: var(--on-lime); box-shadow: 0 0 24px rgb(124 252 0 / 0.4); }
  .report-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(min(100%, 520px), 1fr)); gap: 16px; align-items: start; }
  .report { background: var(--paper); border-radius: 26px; box-shadow: var(--shadow-1); overflow: hidden; min-width: 0; }
  .report-head { display: flex; align-items: center; gap: 14px; padding: 18px 20px 12px; }
  .report-head h3 { font-size: 16px; font-weight: 800; }
  .report-head .faint { font-size: 12px; }
  .r-no { width: 40px; height: 40px; border-radius: 13px; display: inline-flex; align-items: center; justify-content: center; flex: none; background: var(--strong); color: var(--on-strong); font-size: 14px; font-weight: 800; }
  .report .table-wrap { padding: 0 8px 10px; }
  .report td:first-child { white-space: nowrap; }
  .print-only { display: none; }
  @media print {
    .print-only { display: block; }
    .report { break-inside: avoid; box-shadow: none; border: 1px solid #ccc; }
  }
</style>
