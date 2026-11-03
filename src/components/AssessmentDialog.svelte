<script>
  import Icon from './Icon.svelte';
  import { db, session, commit } from '../lib/store.svelte.js';
  import { ASSESSMENT_MODES, scheduleAssessment, assessmentFor } from '../lib/pipeline.js';
  import { earliestSlot } from '../lib/scheduling.js';
  import { STAFF, hasRole } from '../lib/people.js';
  import { todayISO, fmtDay } from '../lib/dates.js';
  import { dialogFocus } from '../lib/dialogFocus.js';
  import { say } from '../lib/ui.svelte.js';

  // Booking the assessment is how an inquiry moves to Assessment: who, when and how.
  let { id, onclose } = $props();
  const me = session.staffId;
  const today = todayISO(session.now);
  const inquiry = db.inquiries.find(item => item.id === id);
  const current = assessmentFor(db, id);
  const ASSESSORS = STAFF.filter(person => hasRole(person.id, 'clinical-director', 'psychologist'));
  const first = (provider) => { try { return earliestSlot(db, { provider, minutes: 60, from: today }); } catch { return { date: '', start: '' }; } };
  let booking = $state({ provider: current?.provider || 'clinical-director', mode: current?.mode || 'In person', ...(current ? { date: current.date, start: current.start } : first('clinical-director')) });
  let error = $state('');

  function save() {
    error = '';
    try {
      commit(state => scheduleAssessment(state, id, $state.snapshot(booking), me, session.now));
      say(`Assessment booked for ${inquiry.name}: ${fmtDay(booking.date)} at ${booking.start}`);
      onclose();
    } catch (e) { error = e.message; }
  }
</script>

<div class="scrim" onclick={onclose} aria-hidden="true"></div>
<form class="dialog" use:dialogFocus={{ onClose: onclose }} onsubmit={event => { event.preventDefault(); save(); }}>
  <header class="drawer-head"><div class="grow"><h2>{current ? 'Rebook the assessment' : 'Book the assessment'}</h2><p class="muted" style="margin-top: 4px">{inquiry?.name}{current ? `. Now ${fmtDay(current.date)} at ${current.start}.` : '. Booking it moves them to Assessment.'}</p></div></header>
  <div class="drawer-body stack">
    <div class="grid-2">
      <label class="field"><span>Assessor</span>
        <select class="select" bind:value={booking.provider} onchange={() => { if (!current) Object.assign(booking, first(booking.provider)); }}>
          {#each ASSESSORS as person (person.id)}<option value={person.id}>{person.name}, {person.title}</option>{/each}
        </select>
      </label>
      <fieldset class="field"><legend>How</legend><div class="seg" style="margin-top: 6px">{#each ASSESSMENT_MODES as mode}<button type="button" aria-pressed={booking.mode === mode} onclick={() => { booking.mode = mode; }}>{mode}</button>{/each}</div></fieldset>
    </div>
    <div class="grid-2">
      <label class="field"><span>Date</span><input class="input" type="date" bind:value={booking.date} min={today} required /></label>
      <label class="field"><span>Time <span class="hint">60 minutes</span></span><input class="input" type="time" bind:value={booking.start} required /></label>
    </div>
    <p class="faint" style="margin: 0; font-size: 12.5px"><Icon name="calendar" size={13} /> Filled with the assessor's earliest free hour. Change it if the family asked for another time.</p>
    {#if error}<p class="error" role="alert">{error}</p>{/if}
  </div>
  <footer class="drawer-foot"><button class="btn" type="button" onclick={onclose}>Cancel</button><button class="btn primary" type="submit"><Icon name="calendar" size={16} />Book assessment</button></footer>
</form>
