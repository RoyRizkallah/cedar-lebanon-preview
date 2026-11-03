<script>
  import Icon from '../components/Icon.svelte';
  import FormView from '../components/FormView.svelte';
  import { db, session } from '../lib/store.svelte.js';
  import { sessionsWeek } from '../lib/sessions.js';
  import { noteFormFor } from '../lib/scheduling.js';
  import { formById } from '../lib/forms/engine.js';
  import { staffName, canSeeTab } from '../lib/people.js';
  import { addDays, todayISO, weekday, fmtDate, fmtDay, minutesOf, hhmm } from '../lib/dates.js';

  let { args = [] } = $props();
  const me = session.staffId;
  const today = todayISO(session.now);
  const monday = date => addDays(date, -((weekday(date) + 6) % 7));
  let weekStart = $state(monday(today));
  let kind = $state('All');
  let form = $state(null);

  const week = $derived(sessionsWeek(db, me, weekStart, session.now));
  const items = $derived(week.items.filter(item => kind === 'All' || item.kind === kind));
  const days = $derived([...new Set(items.map(item => item.appointment.date))]);
  const clinical = canSeeTab(me, 'clinical');
  const who = appointment => {
    if (appointment.patientIds) return `${appointment.patientIds.length} patients`;
    const patient = db.patients.find(p => p.id === appointment.patientId);
    return patient ? (clinical ? patient.clinicalName : patient.fullName) : db.inquiries.find(i => i.id === appointment.inquiryId)?.name || '';
  };
  const noteForm = appointment => noteFormFor(appointment.service);
  const canOpen = item => {
    const id = noteForm(item.appointment);
    const family = formById(id).family;
    return item.appointment.status === 'Completed' && canSeeTab(me, family === 'clinical' ? 'clinical' : 'fitness') && (item.appointment.noteFormId || formById(id).owners.includes(me)) && (item.appointment.patientId || item.appointment.patientIds);
  };
  const TONE = { Filed: 'ok', Due: 'warn', Overdue: 'urgent', Upcoming: '' };
</script>

<main class="content">
  <div class="page-head">
    <div><h1>Sessions</h1><p>Therapy, groups and fitness for the week: who came, and whether each note is filed. Notes stay in the patient’s file.</p></div>
    <div class="actions">
      <div class="seg" role="group" aria-label="Kind">{#each ['All', 'Individual', 'Group', 'Fitness'] as option}<button aria-pressed={kind === option} onclick={() => { kind = option; }}>{option}</button>{/each}</div>
    </div>
  </div>

  <div class="toolbar">
    <button class="btn icon" aria-label="Previous week" onclick={() => { weekStart = addDays(weekStart, -7); }}><Icon name="chevron-left" /></button>
    <button class="btn" onclick={() => { weekStart = monday(today); }}>This week</button>
    <button class="btn icon" aria-label="Next week" onclick={() => { weekStart = addDays(weekStart, 7); }}><Icon name="chevron" /></button>
    <strong style="margin-left: 6px">{fmtDate(weekStart)} to {fmtDate(addDays(weekStart, 6), { day: 'numeric', month: 'short', year: 'numeric' })}</strong>
  </div>

  <div class="stats" style="margin-bottom: 20px">
    <div class="stat"><div class="label">Sessions</div><div class="value">{week.summary.sessions}</div></div>
    <div class="stat"><div class="label">Notes filed</div><div class="value">{week.summary.filed}</div></div>
    <div class="stat"><div class="label">Notes due</div><div class="value">{week.summary.due}</div><div class="note">Within 24 hours of the session</div></div>
    <div class="stat"><div class="label">Overdue notes</div><div class="value" style:color={week.summary.overdue ? 'var(--urgent)' : ''}>{week.summary.overdue}</div></div>
    <div class="stat"><div class="label">Attendance</div><div class="value">{week.summary.attendancePct ?? '—'}{#if week.summary.attendancePct !== null}<small>%</small>{/if}</div><div class="note">From filed notes and logs</div></div>
  </div>

  {#each days as day (day)}
    <div class="section-title"><h2 class:today={day === today}>{fmtDay(day)}{day === today ? ', today' : ''}</h2></div>
    <ul class="list panel">
      {#each items.filter(item => item.appointment.date === day) as item (item.appointment.id)}
        {@const a = item.appointment}
        <li>
          <span class="time num">{a.start}<small>{hhmm(minutesOf(a.start) + a.minutes)}</small></span>
          <span class="kind k-{item.kind.toLowerCase()}">{item.kind}</span>
          <div class="grow"><div class="title">{a.service === 'Group' ? a.title : a.service}</div><div class="sub">{who(a)}, {staffName(a.provider)}</div></div>
          {#if item.attendance}<span class="att num" title="Present of total">{item.attendance.present}/{item.attendance.total}</span>{/if}
          <span class="pill {TONE[item.noteStatus]}">{item.noteStatus === 'Upcoming' ? (a.status === 'Booked' ? 'Booked' : a.status) : `Note ${item.noteStatus.toLowerCase()}`}</span>
          {#if canOpen(item)}<button class="btn sm" onclick={() => { form = { formId: noteForm(a), entryId: a.noteFormId || null, patientId: a.patientId || null, appointmentId: a.id }; }}>{a.noteFormId ? 'Open' : 'Write'}</button>{/if}
        </li>
      {/each}
    </ul>
  {:else}
    <div class="panel empty"><strong>No sessions this week</strong>Book sessions from the schedule.</div>
  {/each}
</main>

{#if form}<FormView {...form} onclose={() => { form = null; }} />{/if}

<style>
  h2.today { color: var(--moss); }
  .time { display: flex; flex-direction: column; width: 48px; font-weight: 700; font-size: 13px; }
  .time small { font-weight: 500; color: var(--text-3); font-size: 11.5px; }
  .kind { flex: none; width: 78px; font-size: 12px; font-weight: 650; padding: 3px 8px; border-radius: 6px; text-align: center; background: var(--sunk); color: var(--text-2); }
  .k-individual { background: var(--info-soft); color: var(--info); }
  .k-group { background: var(--lime-soft); color: var(--moss); }
  .k-fitness { background: var(--warn-soft); color: var(--warn); }
  .att { font-weight: 700; font-size: 13px; color: var(--text-2); }
  @media (max-width: 640px) { .kind { display: none; } }
</style>
