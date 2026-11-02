<script>
  import Icon from './Icon.svelte';
  import { db, session } from '../lib/store.svelte.js';
  import { prepareCaseReview } from '../lib/assist/caseReview.js';

  let { onapply } = $props();
  let prep = $state(null);

  function prepare() {
    prep = prepareCaseReview(db, session.now);
    onapply(prep);
  }
</script>

<section class="assist" aria-label="Prepare this week">
  <header class="assist-head">
    <span class="assist-mark"><Icon name="sparkle" size={19} stroke={2} /></span>
    <div class="grow"><strong>Prepare this week's review</strong><span>Reads the last 7 days of filed records and raises the standing flags. Decisions stay with the team.</span></div>
    {#if !prep}<button class="btn dark" type="button" onclick={prepare}><Icon name="sparkle" size={15} />Prepare</button>{/if}
  </header>
  {#if prep}
    <div class="assist-body">
      <p><strong>{prep.flagged} of {prep.rows.length} patients need depth this week.</strong> The table below is filled in with each patient's phase and status; flagged patients come first.</p>
      <ul class="prep-list">
        {#each prep.summaries.filter(item => item.summary.flags.length) as { patient, summary } (patient.id)}
          <li><strong>{patient.clinicalName}</strong><span class="choices">{#each summary.flags as flag (flag.key)}<span class="pill {flag.key === 'incident' || flag.key === 'relapse' ? 'urgent' : 'warn'}" title={flag.detail}>{flag.label}</span>{/each}</span></li>
        {/each}
      </ul>
      <span class="faint" style="font-size: 12px">Preview of Cedar Assist. Prepared in this browser from filed records; nothing is sent anywhere.</span>
    </div>
  {/if}
</section>

<style>
  .prep-list { list-style: none; margin: 4px 0; padding: 0; display: flex; flex-direction: column; gap: 6px; }
  .prep-list li { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; font-size: 13.5px; }
  .prep-list strong { min-width: 90px; }
</style>
