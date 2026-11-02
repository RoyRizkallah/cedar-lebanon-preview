<script>
  import Icon from './Icon.svelte';
  import { db, session } from '../lib/store.svelte.js';
  import { weekSummary } from '../lib/assist/caseReview.js';

  let { patientId } = $props();
  const summary = $derived(weekSummary(db, patientId, session.now));
</script>

<section class="assist" aria-label="This week">
  <header class="assist-head">
    <span class="assist-mark"><Icon name="sparkle" size={19} stroke={2} /></span>
    <div class="grow"><strong>This week</strong><span>Last 7 days, from filed records. Preview of Cedar Assist.</span></div>
  </header>
  <div class="assist-body">
    {#if summary.flags.length}
      <div class="choices">{#each summary.flags as flag (flag.key)}<span class="pill {flag.key === 'incident' || flag.key === 'relapse' ? 'urgent' : 'warn'}" title={flag.detail}>{flag.label}</span>{/each}</div>
    {/if}
    <p>{summary.brief}</p>
  </div>
</section>
