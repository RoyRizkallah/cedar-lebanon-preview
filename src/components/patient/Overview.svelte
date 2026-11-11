<script>
  import { act } from '../../lib/act.js';
  import { db, session } from '../../lib/store.svelte.js';
  import { addComment } from '../../lib/support.js';
  import { placeLabel } from '../../lib/admission.js';
  import Contacts from './Contacts.svelte';
  import { staffName, hasRole, canSeeTab, canSee, canDo } from '../../lib/people.js';
  import { programFor, DAYS } from '../../lib/programs.js';
  import { upcomingFor } from '../../lib/scheduling.js';
  import { walletBalanceCents, formatCents } from '../../lib/wallet.js';
  import { fmtDate, fmtDay, fmtDateTime, todayISO } from '../../lib/dates.js';

  let { patient } = $props();
  const me = session.staffId;
  const upcoming = $derived(canDo(me, 'viewTherapyBookings') ? upcomingFor(db, patient.id, todayISO(session.now)).slice(0, 6) : []);
  const seesPhase = canDo(me, 'viewTherapyBookings');
  const comments = $derived(db.comments.filter(item => item.patientId === patient.id).sort((a, b) => String(b.at).localeCompare(String(a.at))));
  // The program this patient follows, and what it has for them today.
  const plan = $derived(programFor(db, patient.id, todayISO(session.now)));
  const todayKey = DAYS[(new Date(`${todayISO(session.now)}T12:00:00`).getDay() + 6) % 7];
  const todays = $derived(plan ? plan.program.sessions.filter(item => item.day === todayKey).sort((a, b) => a.time.localeCompare(b.time)) : []);
  let comment = $state('');
  let error = $state('');
  function post() { error = ''; try { act('addComment', { patientId: patient.id, text: comment }); comment = ''; } catch (e) { error = e.message; } }
  const team = [['Psychologist', 'psychologist'], ['Therapist', 'therapist'], ['Nurse', 'nurse'], ['Physical therapy & fitness', 'fitness'], ['Resident support', 'rsa']];
</script>

<div class="overview">
  <section class="panel">
    <div class="panel-head"><h3>Stay</h3></div>
    <dl class="kv panel-body">
      <dt>Program</dt><dd>{patient.program}</dd>
      <dt>Room</dt><dd>{patient.roomId ? placeLabel(db, patient.roomId, patient.bed) : 'No room (outpatient)'}</dd>
      <dt>Admitted</dt><dd>{fmtDate(patient.admittedAt, { day: 'numeric', month: 'long', year: 'numeric' })}</dd>
      {#if seesPhase}<dt>Phase</dt><dd>{patient.phase}</dd>{/if}
      <dt>Contact preference</dt><dd>{patient.commPreference}</dd>
      {#if hasRole(me, 'admin', 'gm', 'director')}
        <dt>Phone</dt><dd>{patient.phone || '—'}</dd>
        <dt>Agreed amount</dt><dd>${Number(patient.monthlyAmount || 0).toLocaleString('en-US')} a month{patient.paymentTerms ? `, ${patient.paymentTerms.toLowerCase()}` : ''}</dd>
        {#if patient.payer}<dt>Paid by</dt><dd>{patient.payer}</dd>{/if}
      {/if}
      {#if canSeeTab(me, 'wallet')}<dt>Wallet</dt><dd>{formatCents(walletBalanceCents(db, patient.id))}</dd>{/if}
    </dl>
  </section>

  <section class="panel">
    <div class="panel-head"><h3>Care team</h3></div>
    <dl class="kv panel-body">
      {#each team as [label, key]}<dt>{label}</dt><dd>{staffName(patient.assigned?.[key])}</dd>{/each}
    </dl>
  </section>

  <Contacts {patient} />

  <section class="panel">
    <div class="panel-head"><h3>Program</h3>{#if plan && canSee(me, 'programs')}<a class="faint" href={`#/programs/${plan.program.id}`}>Open</a>{/if}</div>
    <div class="panel-body">
      {#if plan}
        <p style="margin: 0; font-weight: 750">{plan.program.name}</p>
        <p class="faint" style="margin: 2px 0 10px; font-size: 13px">Since {fmtDay(plan.assignment.start)}, until {fmtDay(plan.assignment.end)}. Set by {staffName(plan.assignment.by)}.</p>
        {#each todays as item (item.id)}<div class="row" style="gap: 10px; padding: 4px 0"><strong class="num" style="width: 46px">{item.time}</strong><span class="grow">{item.title}</span><span class="faint" style="font-size: 12.5px">{staffName(item.leader)}</span></div>
        {:else}<p class="faint" style="margin: 0">Nothing on the program today.</p>{/each}
      {:else}<p class="faint" style="margin: 0">Not on a program yet.{hasRole(me, 'clinical-director', 'psychologist', 'drama') ? ' Give them one from Programs.' : ''}</p>{/if}
    </div>
  </section>

  <section class="panel span-all">
    <div class="panel-head"><h3>Team comments</h3><span class="faint" style="font-size: 12.5px">Practical notes for everyone on the team. Clinical detail belongs in the clinical forms.</span></div>
    <form class="row comment-box" onsubmit={event => { event.preventDefault(); post(); }}>
      <input class="input" placeholder="Add a comment" aria-label="Add a comment" bind:value={comment} />
      <button class="btn dark" type="submit">Post</button>
    </form>
    {#if error}<p class="error" style="padding: 0 20px 10px">{error}</p>{/if}
    <ul class="list">
      {#each comments as item (item.id)}<li style="align-items: flex-start"><span class="avatar sm">{staffName(item.by).slice(0, 1)}</span><div class="grow"><div>{item.text}</div><div class="sub">{staffName(item.by)}, {fmtDateTime(item.at)}</div></div></li>
      {:else}<li class="faint">No comments yet.</li>{/each}
    </ul>
  </section>

  {#if !hasRole(me, 'rsa')}
    <section class="panel span-all">
      <div class="panel-head"><h3>Upcoming appointments</h3><a href="#/schedule" class="faint" style="font-size: 13px">Schedule</a></div>
      <ul class="list">
        {#each upcoming as item (item.id)}
          <li><div class="grow"><div class="title">{item.service === 'Group' ? item.title : item.service}</div><div class="sub">{fmtDay(item.date)} at {item.start}, {item.provider === 'external' ? item.external?.psychiatrist : staffName(item.provider)}</div></div>{#if item.auto}<span class="pill line">Auto</span>{/if}</li>
        {:else}
          <li class="faint">Nothing booked.</li>
        {/each}
      </ul>
    </section>
  {/if}
</div>

<style>
  .comment-box { padding: 14px 20px; border-bottom: 1px solid var(--line); }
  .overview { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 16px; }
  @media (max-width: 800px) { .overview { grid-template-columns: 1fr; } }
</style>
