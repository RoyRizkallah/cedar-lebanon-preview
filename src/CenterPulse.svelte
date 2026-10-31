<script>
  import Icon from './Icon.svelte';
  export let occupied;
  export let available;
  export let capacity;
  export let sessions;
  export let inquiries;
  export let followups;
  export let onNavigate;
  const date = new Date();
</script>

<section class="center-pulse" aria-label="Center daily briefing">
  <div class="pulse-story">
    <div class="pulse-edition"><span class="pulse-live-dot"></span> DAILY BRIEFING <span class="pulse-edition-date">{date.toLocaleDateString('en-GB', { day:'2-digit', month:'short', year:'numeric', timeZone:'Asia/Beirut' })}</span></div>
    <h2>Room for care.<br/><em>Clarity for your day.</em></h2>
    <p>Your people, appointments and next steps.<br/>A shared view of the work that matters today.</p>
    <button class="pulse-link" on:click={() => onNavigate('schedule')}>View today’s schedule <span><Icon name="arrow" size={16}/></span></button>
    <svg class="pulse-botanical" width="180" height="240" viewBox="0 0 180 240" fill="none" aria-hidden="true"><path d="M87 228C92 165 115 92 158 18M103 168C47 162 19 124 20 87C65 90 101 115 103 168ZM124 114C119 71 131 34 158 18C168 63 161 94 124 114ZM92 203C129 178 150 148 151 119C111 133 91 166 92 203Z" stroke="currentColor" stroke-width="1"/><path d="M26 94C57 120 80 145 103 168M149 126C128 153 109 177 92 203M157 26C145 62 134 88 124 114" stroke="currentColor" stroke-width=".7"/></svg>
  </div>
  <div class="pulse-census">
    <div class="pulse-census-head"><span>RESIDENTIAL CENSUS</span><Icon name="bed" size={19}/></div>
    <div class="pulse-census-number">{occupied}<span>/ {capacity}</span></div>
    <p>people currently in residence</p>
    <div class="pulse-bed-grid" aria-label="{occupied} occupied of {capacity} beds">
      {#each Array.from({length:capacity}) as _, index}<span class:filled={index<occupied} class:unready={index>=occupied+available}></span>{/each}
    </div>
    <div class="pulse-census-legend"><span><i></i> {occupied} occupied</span><span><i class="ready"></i> {available} ready</span></div>
    <button on:click={() => onNavigate('rooms')}>Open room board <Icon name="arrow" size={15}/></button>
  </div>
  <div class="pulse-bottom">
    <button on:click={() => onNavigate('schedule')}><span class="pulse-metric-icon"><Icon name="calendar" size={19}/></span><span><strong>{sessions}</strong><span>Sessions today</span></span><Icon name="chevron" size={15}/></button>
    <button on:click={() => onNavigate('admissions')}><span class="pulse-metric-icon"><Icon name="inbox" size={19}/></span><span><strong>{inquiries}</strong><span>Active inquiries</span></span><Icon name="chevron" size={15}/></button>
    <button on:click={() => onNavigate('aftercare')}><span class="pulse-metric-icon amber"><Icon name="heart" size={19}/></span><span><strong>{followups}</strong><span>Follow-ups due</span></span><Icon name="chevron" size={15}/></button>
  </div>
</section>
