<script>
  import Icon from '../components/Icon.svelte';
  import FormView from '../components/FormView.svelte';
  import { formById } from '../lib/forms/engine.js';
  import { db, session, commit } from '../lib/store.svelte.js';
  import { SERVICES, serviceByName, earliestSlot, book, cancelAppointment, completeAppointment, needsNote, recordPsychiatrist, recordPrescription, scheduleScope, canCancel } from '../lib/scheduling.js';
  import { staffName, canDo, canSeeTab, visiblePatients, hasRole } from '../lib/people.js';
  import { addDays, todayISO, weekday, fmtDay, fmtDate, minutesOf, hhmm } from '../lib/dates.js';
  import { putFile } from '../lib/files.js';
  import { dialogFocus } from '../lib/dialogFocus.js';
  import { onMount } from 'svelte';
  import { say, takeIntent } from '../lib/ui.svelte.js';

  let { args = [] } = $props();
  const me = session.staffId;
  const today = todayISO(session.now);
  const PROVIDERS = [...[...new Set(SERVICES.map(service => service.provider))].filter(id => id !== 'external').map(id => [id, staffName(id)]), ['external', 'External psychiatrist']];
  const scope = scheduleScope(me);
  const visibleProviders = scope === 'all' ? PROVIDERS : PROVIDERS.filter(([id]) => scope.includes(id));
  const isProvider = PROVIDERS.some(([id]) => id === me);

  let weekStart = $state(addDays(today, -((weekday(today) + 6) % 7)));
  let who = $state(isProvider && scheduleScope(me) === 'all' ? me : 'all');
  let selected = $state(null);
  let booking = $state(null);
  let psychiatrist = $state(null);
  let form = $state(null);
  let error = $state('');
  let file = $state(null);
  let prescriptionNote = $state('');

  const days = $derived(Array.from({ length: 6 }, (_, index) => addDays(weekStart, index)));
  const shown = $derived(db.appointments.filter(item => item.status !== 'Cancelled' && item.date >= days[0] && item.date <= days[5] && (scope === 'all' || scope.includes(item.provider)) && (who === 'all' || item.provider === who))
    .sort((a, b) => a.start.localeCompare(b.start)));
  const patients = $derived(visiblePatients(db, me));
  const clinicalViewer = canSeeTab(me, 'clinical');
  const label = item => {
    if (item.patientIds) return `${item.patientIds.length} patients`;
    const patient = db.patients.find(p => p.id === item.patientId);
    if (patient) return clinicalViewer ? patient.clinicalName : patient.fullName;
    const inquiry = db.inquiries.find(i => i.id === item.inquiryId);
    return inquiry ? `${inquiry.name} (admission)` : '';
  };
  // The week as a time grid: 08:00 to 18:00, stretched to fit anything earlier or later.
  const PPM = 1.35;
  const GRID_START = $derived(Math.min(8 * 60, ...shown.map(item => Math.floor(minutesOf(item.start) / 60) * 60)));
  const GRID_END = $derived(Math.max(18 * 60, ...shown.map(item => Math.ceil((minutesOf(item.start) + item.minutes) / 60) * 60)));
  const gridHours = $derived(Array.from({ length: (GRID_END - GRID_START) / 60 + 1 }, (_, index) => GRID_START + index * 60));
  const nowMin = session.now.getHours() * 60 + session.now.getMinutes();
  // Side-by-side lanes for bookings that overlap in time (different people at the same hour).
  function lanes(items) {
    const placed = [];
    const ends = [];
    for (const item of [...items].sort((a, b) => a.start.localeCompare(b.start))) {
      const start = minutesOf(item.start);
      let lane = ends.findIndex(value => value <= start);
      if (lane === -1) { lane = ends.length; ends.push(0); }
      ends[lane] = start + item.minutes;
      placed.push({ item, lane, start, finish: start + item.minutes });
    }
    return placed.map(entry => ({ ...entry, of: Math.max(...placed.filter(other => other.start < entry.finish && entry.start < other.finish).map(other => other.lane)) + 1 }));
  }
  const end = item => hhmm(minutesOf(item.start) + item.minutes);
  const locked = item => item.service === 'Psychologist session' && !canDo(me, 'bookPsychologist');
  const bookable = SERVICES.filter(service => !service.external && (service.name !== 'Psychologist session' || canDo(me, 'bookPsychologist')));

  function run(action, message) {
    error = '';
    try { const result = commit(action); if (message) say(message); return result ?? true; } catch (e) { error = e.message; return false; }
  }

  function startBooking() {
    error = '';
    const service = bookable.find(item => item.provider === me) || bookable[0];
    booking = { service: service.name, patientId: patients[0]?.id || '', date: '', start: '' };
    propose();
  }
  onMount(() => { if (takeIntent('book') && canDo(me, 'bookService')) startBooking(); });

  function propose() {
    const service = serviceByName(booking.service);
    try {
      const slot = earliestSlot(db, { provider: service.provider, minutes: service.minutes, from: today, patientId: ['Group', 'Fitness session'].includes(service.name) ? undefined : booking.patientId });
      Object.assign(booking, slot);
      error = '';
    } catch (e) { error = e.message; }
  }
  function confirmBooking() {
    const group = ['Group', 'Fitness session'].includes(booking.service);
    const fields = { ...$state.snapshot(booking), ...(group ? { patientIds: patients.filter(p => p.program !== 'Outpatient').map(p => p.id), patientId: undefined, title: booking.service === 'Group' ? 'Therapy group' : 'Gym' } : {}) };
    if (run(state => book(state, fields, me), `${booking.service} booked for ${fmtDay(booking.date)} at ${booking.start}`)) booking = null;
  }
  async function savePrescription() {
    let stored = { id: '', name: '' };
    if (file) stored = await putFile(file);
    if (run(state => recordPrescription(state, { patientId: selected.patientId, appointmentId: selected.id, fileId: stored.id, fileName: stored.name, note: prescriptionNote }, me), 'Prescription linked to the patient')) {
      selected = null; file = null; prescriptionNote = '';
    }
  }
  // Offer to write a form only to the people who complete it; others can open what exists.
  const writes = formId => formById(formId).owners.includes(me);
  function openNote(formId, item) {
    form = { formId, entryId: item.noteFormId || null, patientId: item.patientId || null, appointmentId: item.id };
    selected = null;
  }
</script>

<main class="content wide">
  <div class="page-head">
    <div><h1>Schedule</h1><p>Working hours 09:00 to 17:00, Monday to Saturday. Bookings never overlap.</p></div>
    <div class="actions">
      {#if canDo(me, 'recordPsychiatrist')}<button class="btn" onclick={() => { error = ''; psychiatrist = { patientId: patients[0]?.id || '', date: addDays(today, 1), start: '12:00', psychiatrist: '' }; }}><Icon name="pill" size={16} />Record psychiatrist appointment</button>{/if}
      {#if canDo(me, 'bookService')}<button class="btn primary" onclick={startBooking}><Icon name="plus" size={16} />Book earliest</button>{/if}
    </div>
  </div>

  <div class="toolbar">
    <div class="row" style="gap: 4px">
      <button class="btn icon" aria-label="Previous week" onclick={() => { weekStart = addDays(weekStart, -7); }}><Icon name="chevron-left" /></button>
      <button class="btn" onclick={() => { weekStart = addDays(today, -((weekday(today) + 6) % 7)); }}>This week</button>
      <button class="btn icon" aria-label="Next week" onclick={() => { weekStart = addDays(weekStart, 7); }}><Icon name="chevron" /></button>
    </div>
    <strong style="margin: 0 8px">{fmtDate(days[0])} to {fmtDate(days[5], { day: 'numeric', month: 'short', year: 'numeric' })}</strong>
    {#if visibleProviders.length > 1}
      <select class="select" aria-label="Whose schedule" bind:value={who} style="margin-left: auto">
        <option value="all">{scope === 'all' ? 'Everyone' : 'All of mine'}</option>
        {#each visibleProviders as [id, name]}<option value={id}>{id === me ? `${name} (me)` : name}</option>{/each}
      </select>
    {/if}
  </div>
  {#if error && !booking && !psychiatrist && !selected}<p class="error" role="alert" style="margin-bottom: 10px">{error}</p>{/if}

  <div class="cal">
    <div class="cal-head">
      <span></span>
      {#each days as day (day)}
        {@const count = shown.filter(item => item.date === day).length}
        <div class="dayhead" class:today={day === today}>
          <span class="dname">{fmtDate(day, { weekday: 'short' })}</span>
          <strong class="dnum">{fmtDate(day, { day: 'numeric' })}</strong>
          <span class="dcount">{count ? `${count} booked` : 'Free'}</span>
        </div>
      {/each}
    </div>
    <div class="cal-body" style:height={`${(GRID_END - GRID_START) * PPM}px`}>
      <div class="hours">
        {#each gridHours as h (h)}<span style:top={`${(h - GRID_START) * PPM}px`}>{hhmm(h)}</span>{/each}
      </div>
      {#each days as day (day)}
        {@const items = lanes(shown.filter(item => item.date === day))}
        <section class="col" class:today={day === today} aria-label={fmtDay(day)}>
          {#each items as { item, lane, of } (item.id)}
            <button class="appt s-{item.service.split(' ')[0].toLowerCase()}" class:done={item.status === 'Completed'} class:short={item.minutes < 40}
              style:top={`${(minutesOf(item.start) - GRID_START) * PPM}px`} style:height={`${Math.max(item.minutes * PPM - 3, 22)}px`}
              style:left={`calc(${(lane / of) * 100}% + 3px)`} style:width={`calc(${100 / of}% - 6px)`}
              onclick={() => { error = ''; selected = item; }} title={`${item.start}–${end(item)} ${item.service}, ${label(item)}`}>
              <span class="time num">{item.start}–{end(item)}</span>
              <strong>{item.service === 'Group' ? item.title : item.service}</strong>
              <span class="who">{label(item)}</span>
              {#if who === 'all'}<span class="by">{item.provider === 'external' ? item.external?.psychiatrist : staffName(item.provider)}</span>{/if}
              <span class="flags">
                {#if item.status === 'Completed'}<span title="Completed"><Icon name="check" size={12} /></span>{/if}
                {#if needsNote(item) && item.provider === me}<span class="pill warn">Note due</span>{/if}
                {#if locked(item)}<span title="Booked automatically, view only"><Icon name="lock" size={12} /></span>{/if}
                {#if item.auto}<span class="pill line" title="Booked automatically at the earliest free slot">Auto</span>{/if}
              </span>
            </button>
          {/each}
          {#if day === today && nowMin >= GRID_START && nowMin <= GRID_END}<span class="nowline" style:top={`${(nowMin - GRID_START) * PPM}px`}></span>{/if}
        </section>
      {/each}
    </div>
  </div>
</main>

{#if selected}
  {@const item = selected}
  {@const mine = item.provider === me || hasRole(me, 'gm', 'director') || (item.provider === 'external' && canDo(me, 'recordPsychiatrist'))}
  <div class="scrim" onclick={() => { selected = null; }} aria-hidden="true"></div>
  <section class="dialog" use:dialogFocus={{ onClose: () => { selected = null; } }}>
    <header class="drawer-head"><div class="grow"><p class="faint" style="font-size: 12px">{item.status}{item.auto ? ', booked automatically' : ''}</p><h2>{item.service === 'Group' ? item.title : item.service}</h2></div><button class="btn ghost icon" aria-label="Close" data-autofocus onclick={() => { selected = null; }}><Icon name="close" /></button></header>
    <div class="drawer-body stack">
      <dl class="kv">
        <dt>When</dt><dd>{fmtDay(item.date)}, {item.start}–{end(item)}</dd>
        <dt>With</dt><dd>{item.provider === 'external' ? item.external?.psychiatrist : staffName(item.provider)}</dd>
        <dt>{item.patientIds ? 'Patients' : 'Patient'}</dt><dd>{item.patientIds ? item.patientIds.map(id => { const p = db.patients.find(x => x.id === id); return clinicalViewer ? p?.clinicalName : p?.fullName; }).join(', ') : label(item)}</dd>
        {#if item.recordedBy}<dt>Recorded by</dt><dd>{staffName(item.recordedBy)}</dd>{/if}
      </dl>
      {#if locked(item)}<p class="notice"><Icon name="lock" size={15} />Psychologist sessions are booked automatically. You can view them but not change them.</p>{/if}
      {#if item.service === 'External psychiatrist' && canDo(me, 'recordPsychiatrist')}
        <div class="panel panel-body stack" style="gap: 10px">
          <strong>Prescription received</strong>
          <label class="btn sm" style="width: max-content"><Icon name="upload" size={15} />{file ? file.name : 'Attach prescription'}<input class="sr-only" type="file" accept="image/*,application/pdf" capture="environment" onchange={event => { file = event.currentTarget.files?.[0] || null; }} /></label>
          <input class="input" placeholder="Medication and dose, as written" aria-label="Prescription note" bind:value={prescriptionNote} />
          <button class="btn dark" style="width: max-content" onclick={savePrescription}>Link to patient and notify Fadia</button>
        </div>
      {/if}
      {#if error}<p class="error" role="alert">{error}</p>{/if}
    </div>
    <footer class="drawer-foot">
      {#if item.status === 'Booked' && canCancel(me, item)}<button class="btn ghost danger" style="margin-right: auto" onclick={() => { if (run(state => cancelAppointment(state, item.id, me), 'Appointment cancelled')) selected = null; }}>Cancel appointment</button>{/if}
      {#if item.status === 'Booked' && mine && item.provider !== 'external'}<button class="btn" onclick={() => { if (run(state => completeAppointment(state, item.id, me), 'Marked completed')) selected = db.appointments.find(a => a.id === item.id); }}>Mark completed</button>{/if}
      {#if item.status === 'Completed' && ['Psychologist session', 'Therapist session'].includes(item.service) && clinicalViewer && item.patientId && (item.noteFormId || writes('session'))}
        <button class="btn primary" onclick={() => openNote('session', item)}>{item.noteFormId ? 'Open session note' : 'Write session note'}</button>
      {/if}
      {#if item.status === 'Completed' && item.service === 'Group' && clinicalViewer && (item.noteFormId || writes('group'))}<button class="btn primary" onclick={() => openNote('group', item)}>{item.noteFormId ? 'Open group note' : 'Write group note'}</button>{/if}
      {#if item.status === 'Completed' && ['Fitness session', 'Physiotherapy'].includes(item.service) && canSeeTab(me, 'fitness') && (item.noteFormId || writes('attendance'))}<button class="btn primary" onclick={() => openNote('attendance', item)}>{item.noteFormId ? 'Open attendance log' : 'Attendance log'}</button>{/if}
    </footer>
  </section>
{/if}

{#if booking}
  <div class="scrim" onclick={() => { booking = null; }} aria-hidden="true"></div>
  <section class="dialog" use:dialogFocus={{ onClose: () => { booking = null; } }}>
    <header class="drawer-head"><div class="grow"><h2>Book earliest</h2><p class="muted" style="margin-top: 4px">The next free slot from tomorrow is proposed. Change it if needed.</p></div></header>
    <div class="drawer-body stack">
      <label class="field"><span>Service</span><select class="select" bind:value={booking.service} onchange={propose}>{#each bookable as service}<option>{service.name}</option>{/each}</select></label>
      {#if !['Group', 'Fitness session'].includes(booking.service)}
        <label class="field"><span>Patient</span><select class="select" bind:value={booking.patientId} onchange={propose}>{#each patients as patient}<option value={patient.id}>{patient.fullName}</option>{/each}</select></label>
      {:else}<p class="faint">All residential patients are added to this session.</p>{/if}
      <p class="faint">With {staffName(serviceByName(booking.service).provider)}, {serviceByName(booking.service).minutes} minutes.</p>
      <div class="grid-2">
        <label class="field"><span>Date</span><input class="input" type="date" bind:value={booking.date} /></label>
        <label class="field"><span>Start</span><input class="input" type="time" step="900" bind:value={booking.start} /></label>
      </div>
      {#if error}<p class="error" role="alert">{error}</p>{/if}
    </div>
    <footer class="drawer-foot"><button class="btn" onclick={() => { booking = null; }}>Cancel</button><button class="btn primary" onclick={confirmBooking}>Book {booking.date ? `${fmtDay(booking.date)}, ${booking.start}` : ''}</button></footer>
  </section>
{/if}

{#if psychiatrist}
  <div class="scrim" onclick={() => { psychiatrist = null; }} aria-hidden="true"></div>
  <section class="dialog" use:dialogFocus={{ onClose: () => { psychiatrist = null; } }}>
    <header class="drawer-head"><div class="grow"><h2>Record psychiatrist appointment</h2><p class="muted" style="margin-top: 4px">Arranged outside Cedar. It appears in the patient’s record.</p></div></header>
    <div class="drawer-body stack">
      <label class="field"><span>Patient</span><select class="select" bind:value={psychiatrist.patientId}>{#each patients as patient}<option value={patient.id}>{patient.fullName}</option>{/each}</select></label>
      <label class="field"><span>Psychiatrist</span><input class="input" bind:value={psychiatrist.psychiatrist} placeholder="Name of the external psychiatrist" /></label>
      <div class="grid-2"><label class="field"><span>Date</span><input class="input" type="date" bind:value={psychiatrist.date} /></label><label class="field"><span>Time</span><input class="input" type="time" bind:value={psychiatrist.start} /></label></div>
      {#if error}<p class="error" role="alert">{error}</p>{/if}
    </div>
    <footer class="drawer-foot"><button class="btn" onclick={() => { psychiatrist = null; }}>Cancel</button><button class="btn primary" onclick={() => { if (run(state => recordPsychiatrist(state, $state.snapshot(psychiatrist), me), 'Psychiatrist appointment recorded')) psychiatrist = null; }}>Save</button></footer>
  </section>
{/if}

{#if form}<FormView {...form} onclose={() => { form = null; }} />{/if}

<style>
  /* Week calendar: an hour axis on the left, a column per day, bookings placed by time and length */
  .cal { background: var(--paper); border-radius: 20px; box-shadow: var(--shadow-1); padding: 8px 10px 13px; overflow-x: auto; }
  .cal-head, .cal-body { display: grid; grid-template-columns: 58px repeat(6, minmax(150px, 1fr)); min-width: 960px; }
  .cal-head { position: sticky; top: 0; z-index: 4; background: var(--paper); padding: 6px 0 10px; }
  .dayhead { display: flex; flex-direction: column; align-items: flex-start; gap: 0; padding: 8px 10px; margin: 0 4px; border-radius: 14px; }
  .dayhead .dname { font-size: 12.5px; font-weight: 750; color: var(--text-3); }
  .dayhead .dnum { font-size: 23px; font-weight: 800; letter-spacing: -0.04em; line-height: 1.05; }
  .dayhead .dcount { font-size: 12px; font-weight: 650; color: var(--text-2); }
  .dayhead.today { background: var(--hero); color: #fff; box-shadow: var(--shadow-2); }
  .dayhead.today .dname, .dayhead.today .dcount { color: var(--on-ink-2); }
  .dayhead.today .dnum { color: var(--lime); }
  .cal-body { position: relative; margin-top: 10px; }
  .hours { position: relative; }
  .hours span { position: absolute; right: 10px; transform: translateY(-50%); font-size: 11.5px; font-weight: 700; color: var(--text-3); }
  .col { position: relative; margin: 0 4px; border-radius: 16px; background-image: linear-gradient(to bottom, var(--line) 1px, transparent 1px); background-size: 100% 81px; }
  .col.today { background-color: var(--leaf); }
  .appt { --c: var(--text); position: absolute; z-index: 1; overflow: hidden; text-align: left; display: flex; flex-direction: column; gap: 0; padding: 6px 9px; border: 0; border-radius: 12px; background: var(--paper); box-shadow: inset 3px 0 0 var(--c), 0 0 0 1px var(--line), var(--shadow-1); font-size: 12px; color: inherit; transition: box-shadow 0.15s, transform 0.15s; }
  .appt:hover { z-index: 3; transform: scale(1.02); box-shadow: inset 3px 0 0 var(--c), 0 0 0 1px var(--line-strong), var(--shadow-2); }
  .appt > * { flex: none; min-width: 0; }
  .appt strong { font-size: 12.5px; font-weight: 800; line-height: 1.25; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .appt .time { color: var(--text-3); font-weight: 700; font-size: 11px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .appt .who, .appt .by { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .appt .who { color: var(--text-2); }
  .appt .by { color: var(--text-3); font-size: 11px; }
  .appt.short .who, .appt.short .by, .appt.short .flags { display: none; }
  .appt .flags { display: flex; gap: 4px; align-items: center; margin-top: 2px; color: var(--text-2); }
  .appt .flags:empty { display: none; }
  .appt .flags .pill { height: 18px; font-size: 10.5px; padding: 0 6px; }
  .appt.done { opacity: 0.6; }
  .s-psychologist { --c: var(--info); background: color-mix(in srgb, var(--info-soft) 70%, var(--paper)); }
  .s-therapist { --c: var(--moss); background: color-mix(in srgb, var(--leaf) 70%, var(--paper)); }
  .s-nursing { --c: var(--warn); background: color-mix(in srgb, var(--warn-soft) 70%, var(--paper)); }
  .s-blood { --c: var(--urgent); background: color-mix(in srgb, var(--urgent-soft) 70%, var(--paper)); }
  .s-physiotherapy { --c: #0e7490; }
  .s-fitness { --c: #5e5ce6; }
  .s-group { --c: var(--text); background: var(--sunk); }
  .s-external { --c: var(--text-3); }
  .nowline { position: absolute; z-index: 5; left: -4px; right: -4px; height: 2px; border-radius: 2px; background: var(--lime); box-shadow: 0 0 10px var(--lime); pointer-events: none; }
  .nowline::before { content: ""; position: absolute; left: -5px; top: -4px; width: 10px; height: 10px; border-radius: 50%; background: var(--lime); box-shadow: 0 0 0 3px var(--paper); }
</style>
