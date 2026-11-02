<script>
  import Bars from '../components/Bars.svelte';
  import Ring from '../components/Ring.svelte';
  import { db, session } from '../lib/store.svelte.js';
  import { dashboard } from '../lib/kpis.js';
  import { canSee } from '../lib/people.js';
  import { money } from '../lib/pipeline.js';
  import { fmtDate, todayISO } from '../lib/dates.js';

  let { args = [] } = $props();
  const k = $derived(dashboard(db, session.now));
  // Partners both see the money headline; only Finance and Amer open the books.
  const books = canSee(session.staffId, 'finance') ? '#/finance/invoices' : undefined;
  const show = (value, suffix = '') => (value === null || value === undefined ? '—' : `${value}${suffix}`);
  const minutes = value => value === null ? '—' : value < 60 ? `${value} min` : `${Math.round(value / 6) / 10} h`;
  const funnel = $derived(['New Inquiry', 'Assessment', 'Agreement', 'Admitted'].map((label, index) => ({ label, value: k.pipeline.reached[index] })));
  const outcomes = $derived([
    { label: 'Well', value: k.aftercare.outcomes.Well, color: 'var(--ok)' },
    { label: 'Struggling', value: k.aftercare.outcomes.Struggling, color: 'var(--warn)' },
    { label: 'Relapsed', value: k.aftercare.outcomes.Relapsed, color: 'var(--urgent)' }
  ]);
</script>

<main class="content">
  <section class="bento">
    <article class="tile hero-tile">
      <div class="hero-top">
        <div>
          <p class="eyebrow-date">{fmtDate(todayISO(session.now), { weekday: 'long', day: 'numeric', month: 'long' })}</p>
          <h1>Dashboard</h1>
          <p class="hero-line">Last 30 days unless a figure says otherwise.</p>
        </div>
        <Ring value={k.census.occupancyPct} size={96} label="Occupancy" />
      </div>
      <div class="hero-figure">
        <span>Potential revenue in play</span>
        <strong class="num">{money(k.pipeline.potential.combined)}</strong>
        <em>Combined new inquiry and assessment, per month. Potential, not collected.</em>
      </div>
      <div class="hero-row">
        <div><strong class="num">{k.census.admitted}</strong><span>In care</span></div>
        <div><strong class="num">{k.census.occupied}/{k.census.beds}</strong><span>Beds used</span></div>
        <div><strong class="num">{money(k.census.monthlyContracted)}</strong><span>Agreed per month</span></div>
        <div><strong class="num">{show(k.census.averageStayDays)}<small> d</small></strong><span>Average stay</span></div>
      </div>
    </article>

    <a class="tile mini" href="#/pipeline"><span class="label">Inquiry potential</span><strong class="num">{money(k.pipeline.potential.inquiry)}</strong><span class="note">{k.pipeline.counts['New Inquiry']} in New Inquiry</span></a>
    <a class="tile mini" href="#/pipeline"><span class="label">Assessment potential</span><strong class="num">{money(k.pipeline.potential.assessment)}</strong><span class="note">{k.pipeline.counts.Assessment} in Assessment</span></a>
    <a class="tile mini leafy" href="#/admissions"><span class="label">Agreement</span><strong class="num">{money(k.pipeline.potential.agreement)}</strong><span class="note">{k.pipeline.counts.Agreement} in admission, not in combined</span></a>
    <div class="tile mini"><span class="label">Admissions this month</span><strong class="num">{k.census.admissionsThisMonth}</strong><span class="note">{k.census.dischargesThisMonth} discharges</span></div>

    <article class="tile money-tile">
      <header><h2>Money</h2>{#if books}<a href="#/finance" class="faint">Finance</a>{/if}</header>
      <div class="money-grid">
        <a href={books}><span>Invoiced this month</span><strong class="num">{money(k.money.invoicedThisMonth)}</strong></a>
        <a href={books}><span>Collected this month</span><strong class="num">{money(k.money.collectedThisMonth)}</strong></a>
        <a href={books}><span>Owed to Cedar</span><strong class="num">{money(k.money.owed)}</strong></a>
        <a href={books} class:alert={k.money.overdue > 0}><span>Overdue, {k.money.overdueCount} invoices</span><strong class="num">{money(k.money.overdue)}</strong></a>
      </div>
      <div class="collect"><Ring value={k.money.collectionPct} size={76} stroke={9} tone="ink" label="Collected" /><p>Of everything billed so far, {show(k.money.collectionPct, '%')} has been collected.</p></div>
    </article>

    <article class="tile safety-tile">
      <header><h2>Safety</h2><a href="#/safety" class="faint">Visits & incidents</a></header>
      <ul class="signals">
        <li class:alert={k.safety.openIncidents}><strong class="num">{k.safety.openIncidents}</strong><span>Incidents to review</span></li>
        <li><strong class="num">{k.safety.onLeave}</strong><span>Out on leave now</span></li>
        <li class:alert={k.safety.positiveScreens30}><strong class="num">{k.safety.positiveScreens30}</strong><span>Positive drug screens, 30 days</span></li>
        <li><strong class="num">{k.safety.dosesNotGiven7}</strong><span>Doses not given, 7 days</span></li>
      </ul>
    </article>

    <article class="tile leads-tile">
      <header><h2>Leads by channel</h2><a href="#/leads" class="faint">{k.leads.last30} leads</a></header>
      <Bars channels rows={Object.entries(k.leads.byChannel).map(([label, value]) => ({ label, value })).sort((a, b) => b.value - a.value)} />
      <dl class="mini-dl"><div><dt>Median first reply</dt><dd>{minutes(k.leads.medianFirstResponseMins)}</dd></div><div><dt>Unanswered now</dt><dd class:alert={k.leads.unanswered > 0}>{k.leads.unanswered}</dd></div><div><dt>Became inquiries</dt><dd>{show(k.leads.conversionPct, '%')}</dd></div></dl>
    </article>

    <article class="tile funnel-tile">
      <header><h2>Pipeline, last 90 days</h2><a href="#/pipeline" class="faint">Open pipeline</a></header>
      <Bars rows={funnel} />
      <dl class="mini-dl"><div><dt>Inquiries admitted</dt><dd>{show(k.pipeline.admittedPct, '%')}</dd></div><div><dt>Reviews overdue</dt><dd class:alert={k.pipeline.reviewsOverdue > 0}>{k.pipeline.reviewsOverdue}</dd></div><div><dt>Urgent open</dt><dd class:alert={k.pipeline.urgentOpen > 0}>{k.pipeline.urgentOpen}</dd></div></dl>
    </article>

    <article class="tile care-tile">
      <header><h2>Care quality</h2></header>
      <div class="rings">
        <div><Ring value={k.clinical.notesOnTimePct} size={78} stroke={9} /><p><strong>Session notes on time</strong><span>Within 24 hours, {k.clinical.sessions} sessions</span></p></div>
        <div><Ring value={k.clinical.intakeOnTimePct} size={78} stroke={9} /><p><strong>Intake within 72 hours</strong><span>Admissions in the last 90 days</span></p></div>
        <div><Ring value={k.fitness.attendancePct} size={78} stroke={9} tone="ink" /><p><strong>Fitness attendance</strong><span>{k.fitness.injuriesThisMonth} injuries this month</span></p></div>
      </div>
      <dl class="mini-dl"><div><dt>Treatment plans overdue</dt><dd class:alert={k.clinical.plansOverdue > 0}>{k.clinical.plansOverdue}</dd></div><div><dt>Medium or high risk</dt><dd>{k.clinical.elevatedRisk}</dd></div><div><dt>Aftercare calls on time</dt><dd>{show(k.aftercare.onTimePct, '%')}</dd></div></dl>
    </article>

    <article class="tile after-tile">
      <header><h2>Aftercare</h2><span class="faint">Latest call per discharged patient</span></header>
      <Bars rows={outcomes} />
    </article>
  </section>
</main>

<style>
  .bento { display: grid; grid-template-columns: repeat(12, minmax(0, 1fr)); gap: 12px; }
  .tile { background: var(--paper); border-radius: 18px; padding: 14px 18px; box-shadow: var(--shadow-1); color: inherit; text-decoration: none; min-width: 0; }
  a.tile:hover { box-shadow: var(--shadow-2); text-decoration: none; }
  .tile header { display: flex; align-items: baseline; justify-content: space-between; gap: 10px; margin-bottom: 10px; }
  .tile header h2 { font-size: 15px; }
  .tile header a, .tile header .faint { font-size: 13px; }

  .hero-tile { grid-column: span 8; grid-row: span 2; position: relative; overflow: hidden; background: var(--hero); color: var(--on-ink); display: flex; flex-direction: column; gap: 12px; padding: 18px 22px; }
  .hero-tile::after { content: ""; position: absolute; right: -80px; bottom: -120px; width: 360px; height: 360px; border-radius: 50%; background: radial-gradient(circle, rgb(124 252 0 / 0.25), transparent 65%); pointer-events: none; }
  .hero-top { display: flex; justify-content: space-between; align-items: flex-start; gap: 20px; position: relative; z-index: 1; }
  .hero-top :global(.ring) { color: #fff; }
  .eyebrow-date { color: var(--lime); font-weight: 750; font-size: 12.5px; }
  .hero-tile h1 { color: #fff; font-size: 26px; letter-spacing: -0.03em; }
  .hero-line { color: var(--on-ink-2); margin-top: 2px; font-size: 13px; }
  .hero-figure { position: relative; z-index: 1; }
  .hero-figure span { color: var(--on-ink-2); font-weight: 650; font-size: 13px; }
  .hero-figure strong { display: block; font-size: 42px; font-weight: 800; letter-spacing: -0.045em; line-height: 1; color: var(--lime); margin: 4px 0; text-shadow: 0 0 30px rgb(124 252 0 / 0.25); }
  .hero-figure em { font-style: normal; color: var(--on-ink-2); font-size: 12.5px; }
  .hero-row { position: relative; z-index: 1; margin-top: auto; display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; }
  .hero-row div { padding: 9px 12px; border-radius: 13px; background: rgb(255 255 255 / 0.07); box-shadow: inset 0 0 0 1px rgb(255 255 255 / 0.08); }
  .hero-row strong { display: block; color: #fff; font-size: 18px; font-weight: 800; letter-spacing: -0.03em; }
  .hero-row small { font-size: 13px; opacity: 0.7; }
  .hero-row span { color: var(--on-ink-2); font-size: 12px; font-weight: 650; }

  .mini { grid-column: span 2; display: flex; flex-direction: column; justify-content: space-between; gap: 2px; }
  .mini .label { color: var(--text-2); font-weight: 650; font-size: 12.5px; }
  .mini strong { font-size: 22px; font-weight: 800; letter-spacing: -0.035em; }
  .mini .note { color: var(--text-3); font-size: 12px; }
  .mini.leafy { background: var(--leaf); }
  .mini.leafy .label { color: var(--moss); }

  .money-tile { grid-column: span 7; display: grid; grid-template-columns: 1fr auto; grid-template-rows: auto 1fr; column-gap: 20px; }
  .money-tile header { grid-column: 1 / -1; }
  .money-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px; }
  .money-grid a { padding: 9px 12px; border-radius: 13px; background: var(--subtle); color: inherit; text-decoration: none; box-shadow: inset 0 0 0 1px var(--line); }
  .money-grid a:hover { background: var(--paper); box-shadow: var(--shadow-1); text-decoration: none; }
  .money-grid span { display: block; color: var(--text-2); font-size: 12.5px; font-weight: 650; }
  .money-grid strong { font-size: 19px; font-weight: 800; letter-spacing: -0.03em; }
  .money-grid a.alert strong { color: var(--urgent); }
  .collect { display: flex; flex-direction: column; align-items: center; gap: 6px; max-width: 150px; text-align: center; }
  .collect p { font-size: 12px; color: var(--text-2); }

  .safety-tile { grid-column: span 5; }
  .signals { list-style: none; margin: 0; padding: 0; display: grid; grid-template-columns: repeat(2, 1fr); gap: 8px; }
  .signals li { padding: 9px 12px; border-radius: 13px; background: var(--subtle); box-shadow: inset 0 0 0 1px var(--line); }
  .signals strong { display: block; font-size: 21px; font-weight: 800; letter-spacing: -0.03em; }
  .signals span { font-size: 12.5px; color: var(--text-2); font-weight: 650; }
  .signals li.alert { background: var(--urgent-soft); box-shadow: none; }
  .signals li.alert strong { color: var(--urgent); }

  .leads-tile, .funnel-tile { grid-column: span 6; }
  .care-tile { grid-column: span 8; }
  .after-tile { grid-column: span 4; }
  .rings { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 12px; }
  .rings > div { display: flex; flex-direction: column; align-items: center; gap: 6px; text-align: center; }
  .rings p strong { display: block; font-size: 13.5px; font-weight: 800; }
  .rings p span { font-size: 12px; color: var(--text-3); }
  .mini-dl { display: flex; flex-wrap: wrap; gap: 6px 24px; margin: 10px 0 0; padding-top: 10px; border-top: 1px solid var(--line); }
  .mini-dl dt { color: var(--text-2); font-size: 12.5px; font-weight: 600; }
  .mini-dl dd { margin: 1px 0 0; font-size: 17px; font-weight: 800; letter-spacing: -0.02em; }
  .alert { color: var(--urgent); }

  @media (max-width: 1200px) {
    .hero-tile { grid-column: span 12; grid-row: auto; }
    .mini { grid-column: span 3; }
    .money-tile, .safety-tile, .leads-tile, .funnel-tile, .care-tile, .after-tile { grid-column: span 12; }
  }
  @media (max-width: 700px) {
    .mini { grid-column: span 6; }
    .hero-tile { padding: 24px 22px; }
    .hero-figure strong { font-size: 44px; }
    .hero-row { grid-template-columns: repeat(2, 1fr); }
    .money-tile { grid-template-columns: 1fr; }
    .collect { flex-direction: row; max-width: none; text-align: left; }
    .rings { grid-template-columns: 1fr; }
  }
</style>
