<script>
  import Icon from '../components/Icon.svelte';
  import Bars from '../components/Bars.svelte';
  import { db } from '../lib/store.svelte.js';
  import { admissionsInsights } from '../lib/insights.js';

  let { args = [] } = $props();
  const data = $derived(admissionsInsights(db));
  const leadCount = $derived(data.channels.reduce((sum, row) => sum + row.leads, 0));
  const overall = $derived(leadCount ? Math.round((data.channels.reduce((sum, row) => sum + row.converted, 0) / leadCount) * 100) : null);
</script>

<main class="content wide">
  <div class="page-head">
    <div><h1>Insights</h1><p>Cedar Intelligence looks across leads and the pipeline and says what stands out. Every figure links back to the records.</p></div>
  </div>

  <section class="brain">
    <div class="brain-main">
      <span class="brain-mark"><Icon name="sparkle" size={22} stroke={2} /></span>
      <span class="eyebrow">Cedar Intelligence</span>
      <div class="big num">{overall ?? '—'}<small>{overall === null ? '' : '%'}</small></div>
      <p>of {leadCount} leads became inquiries. What stands out this month is below.</p>
      <span class="preview">Preview: calculated in this browser from your records. The live version adds an AI explanation of the same figures.</span>
    </div>
    <dl class="brain-facts">
      <div><dt>Leads</dt><dd class="num">{leadCount}</dd></div>
      <div><dt>Became inquiries</dt><dd class="num">{data.channels.reduce((sum, row) => sum + row.converted, 0)}</dd></div>
      <div><dt>{data.stageTime[0]?.from} to {data.stageTime[0]?.to}</dt><dd class="num">{data.stageTime[0]?.medianDays ?? '—'}<small> days</small></dd></div>
    </dl>
  </section>

  <ol class="insight-cards">
    {#each data.observations as item, index (index)}
      <li class="insight tone-{item.tone || 'none'}">
        <div class="insight-top">
          <span class="insight-icon"><Icon name={item.tone === 'urgent' || item.tone === 'warn' ? 'alert' : item.tone === 'ok' ? 'check-circle' : 'sparkle'} size={17} /></span>
          <span class="insight-no num">{String(index + 1).padStart(2, '0')}</span>
        </div>
        <p>{item.text}</p>
        <a href={item.source === 'Leads' ? '#/leads' : '#/pipeline'}>{item.source}<Icon name="chevron" size={14} /></a>
      </li>
    {/each}
  </ol>

  <div class="two">
    <section class="panel">
      <div class="panel-head"><h3>Conversion by channel</h3><span class="faint" style="font-size: 13px">Leads that became inquiries</span></div>
      <div class="panel-body"><Bars channels unit="%" rows={data.channels.filter(row => row.rate !== null).map(row => ({ label: row.channel, value: row.rate }))} /></div>
    </section>
    <section class="panel">
      <div class="panel-head"><h3>First reply by channel</h3><span class="faint" style="font-size: 13px">Median minutes to the first answer</span></div>
      <div class="panel-body"><Bars channels unit=" min" rows={data.channels.filter(row => row.reply !== null).map(row => ({ label: row.channel, value: Math.round(row.reply) }))} /></div>
    </section>
  </div>

  <section class="panel journey-panel">
    <div class="panel-head"><h3>Time between stages</h3><span class="faint" style="font-size: 13px">Median days</span></div>
    <ol class="journey">
      {#each data.stageTime as row (row.from)}
        <li>
          <span class="stage">{row.from}</span>
          <span class="gap"><strong class="num">{row.medianDays ?? '—'}<small> days</small></strong><span class="faint">{row.count} inquiries made this step</span></span>
          {#if row === data.stageTime.at(-1)}<span class="stage last">{row.to}</span>{/if}
        </li>
      {/each}
    </ol>
  </section>
</main>

<style>
  /* Cedar Intelligence: one headline figure, then each observation as its own card */
  .brain { position: relative; overflow: hidden; display: grid; grid-template-columns: minmax(0, 1.4fr) minmax(0, 1fr); gap: 24px; align-items: end; padding: 30px 32px; border-radius: 32px; background: var(--hero); color: var(--on-ink); box-shadow: var(--shadow-2); }
  .brain::before { content: ""; position: absolute; left: 30%; top: -140px; width: 420px; height: 420px; border-radius: 50%; background: radial-gradient(circle, rgb(124 252 0 / 0.2), transparent 65%); pointer-events: none; }
  .brain-main { position: relative; display: flex; flex-direction: column; gap: 6px; align-items: flex-start; }
  .brain-mark { width: 46px; height: 46px; border-radius: 15px; display: inline-flex; align-items: center; justify-content: center; background: var(--lime); color: var(--on-lime); box-shadow: 0 0 30px rgb(124 252 0 / 0.45); margin-bottom: 8px; }
  .eyebrow { font-size: 12.5px; font-weight: 750; color: var(--on-ink-2); text-transform: uppercase; letter-spacing: 0.08em; }
  .big { font-size: 72px; font-weight: 800; letter-spacing: -0.05em; line-height: 1; color: var(--lime); }
  .big small { font-size: 30px; }
  .brain p { margin: 0; font-size: 15px; font-weight: 600; }
  .preview { font-size: 12px; color: var(--on-ink-2); margin-top: 6px; max-width: 520px; }
  .brain-facts { position: relative; display: grid; gap: 8px; margin: 0; }
  .brain-facts div { display: flex; align-items: baseline; justify-content: space-between; gap: 12px; padding: 12px 16px; border-radius: 18px; background: rgb(255 255 255 / 0.07); }
  .brain-facts dt { font-size: 13px; color: var(--on-ink-2); font-weight: 650; }
  .brain-facts dd { margin: 0; font-size: 22px; font-weight: 800; }
  .brain-facts small { font-size: 12px; font-weight: 600; color: var(--on-ink-2); }

  .insight-cards { list-style: none; margin: 18px 0 0; padding: 0; display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 14px; }
  .insight { --tone: var(--text-3); --tone-soft: var(--sunk); display: flex; flex-direction: column; gap: 12px; padding: 20px 22px; border-radius: 26px; background: var(--paper); box-shadow: inset 0 4px 0 var(--tone), var(--shadow-1); }
  .insight.tone-ok { --tone: var(--ok); --tone-soft: var(--ok-soft); }
  .insight.tone-warn { --tone: var(--warn); --tone-soft: var(--warn-soft); }
  .insight.tone-urgent { --tone: var(--urgent); --tone-soft: var(--urgent-soft); }
  .insight-top { display: flex; align-items: center; justify-content: space-between; }
  .insight-icon { width: 38px; height: 38px; border-radius: 12px; display: inline-flex; align-items: center; justify-content: center; background: var(--tone-soft); color: var(--tone); }
  .insight-no { font-size: 30px; font-weight: 800; letter-spacing: -0.04em; color: var(--line-strong); }
  .insight p { margin: 0; font-size: 15.5px; font-weight: 650; line-height: 1.45; letter-spacing: -0.005em; }
  .insight a { margin-top: auto; align-self: flex-start; display: inline-flex; align-items: center; gap: 2px; font-size: 12.5px; font-weight: 700; color: var(--text-2); padding: 4px 10px; border-radius: 999px; background: var(--subtle); text-decoration: none; }
  .insight a:hover { background: var(--sunk); }

  .two { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 16px; margin-top: 18px; }
  .journey-panel { margin-top: 16px; }
  .journey { list-style: none; margin: 0; padding: 4px 18px 20px; display: flex; flex-wrap: wrap; align-items: center; gap: 10px 0; }
  .journey li { display: flex; align-items: center; }
  .stage { padding: 10px 16px; border-radius: 16px; background: var(--strong); color: var(--on-strong); font-size: 13.5px; font-weight: 750; white-space: nowrap; }
  .stage.last { background: var(--lime); color: var(--on-lime); }
  .gap { position: relative; display: flex; flex-direction: column; align-items: center; min-width: 150px; padding: 0 14px 14px; }
  .gap::after { content: ""; position: absolute; left: 6px; right: 6px; bottom: 4px; height: 3px; border-radius: 3px; background: linear-gradient(90deg, var(--line-strong), var(--lime)); }
  .gap strong { font-size: 24px; font-weight: 800; letter-spacing: -0.03em; line-height: 1.1; }
  .gap small { font-size: 12px; font-weight: 600; color: var(--text-3); }
  .gap .faint { font-size: 11.5px; text-align: center; }
  @media (max-width: 900px) {
    .brain { grid-template-columns: 1fr; padding: 24px; }
    .big { font-size: 56px; }
    .two { grid-template-columns: 1fr; }
    .journey { flex-direction: column; align-items: stretch; }
    .journey li { flex-direction: column; align-items: stretch; }
    .gap { padding: 8px 0 12px; }
    .gap::after { display: none; }
  }
</style>
