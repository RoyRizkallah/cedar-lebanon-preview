<script>
  import Icon from '../components/Icon.svelte';
  import FormView from '../components/FormView.svelte';
  import { db, session, commit } from '../lib/store.svelte.js';
  import { tasksFor, completeTask, reviewPrescription } from '../lib/tasks.js';
  import { staffById, canSeeTab } from '../lib/people.js';
  import { fmtDay, fmtDate, todayISO, minutesOf, hhmm } from '../lib/dates.js';
  import { go, say } from '../lib/ui.svelte.js';

  let { args = [] } = $props();
  const me = session.staffId;
  const person = staffById(me);
  const today = todayISO(session.now);
  const work = $derived(tasksFor(db, me, session.now));
  const hour = session.now.getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';
  const nowMinutes = session.now.getHours() * 60 + session.now.getMinutes();
  const agenda = $derived(db.appointments.filter(item => item.date === today && item.status !== 'Cancelled' && item.provider === me).sort((a, b) => a.start.localeCompare(b.start)));
  const clinical = canSeeTab(me, 'clinical');
  const who = item => {
    if (item.patientIds) return `${item.patientIds.length} patients`;
    const patient = db.patients.find(p => p.id === item.patientId);
    if (patient) return clinical ? patient.clinicalName : patient.fullName;
    return db.inquiries.find(i => i.id === item.inquiryId)?.name || '';
  };
  const ICONS = { 'inquiry-followup': 'phone', 'followup-call': 'phone', review: 'clock', note: 'pen', admission: 'door', form: 'document', sign: 'pen', request: 'bag', prescription: 'pill' };
  const columns = $derived([
    { key: 'overdue', title: 'Overdue', hint: 'Past their date', items: work.overdue },
    { key: 'today', title: 'Today', hint: 'Due before you leave', items: work.today },
    { key: 'upcoming', title: 'Coming up', hint: 'Next two weeks', items: work.upcoming }
  ]);
  const total = $derived(work.overdue.length + work.today.length);
  // The day ribbon spans the working day, widened to fit any early or late appointment.
  const START = $derived(Math.min(8 * 60, ...agenda.map(item => minutesOf(item.start))));
  const END = $derived(Math.max(18 * 60, ...agenda.map(item => minutesOf(item.start) + item.minutes)));
  const pos = minutes => `${((minutes - START) / (END - START)) * 100}%`;
  const hours = $derived(Array.from({ length: Math.floor((END - START) / 60) + 1 }, (_, index) => START + index * 60));

  let note = $state(null);
  function act(item) {
    if (item.kind === 'note') { note = { formId: 'session', patientId: item.patientId, appointmentId: item.appointmentId }; return; }
    if (item.taskId) { commit(state => completeTask(state, item.taskId, me)); say('Marked done'); return; }
    if (item.kind === 'prescription') { commit(state => reviewPrescription(state, item.docId, me)); say('Prescription reviewed'); return; }
    go(item.link);
  }
  const actionLabel = item => item.taskId ? 'Mark done' : item.kind === 'prescription' ? 'Mark reviewed' : item.kind === 'note' ? 'Write note' : item.kind === 'sign' ? 'Sign' : 'Open';
</script>

<main class="content">
  <section class="greeting">
    <div class="hello">
      <p class="date">{fmtDate(today, { weekday: 'long', day: 'numeric', month: 'long' })}</p>
      <h1>{greeting}, {person.name === 'RSA team' ? 'team' : person.name}</h1>
      <p class="line">{total ? `${total} ${total === 1 ? 'thing needs' : 'things need'} you today${work.overdue.length ? `, ${work.overdue.length} of them overdue` : ''}.` : 'Nothing is waiting on you today. Enjoy the calm.'}</p>
    </div>
    <div class="tally" aria-label="Your work at a glance">
      <div class:hot={work.overdue.length}><strong class="num">{work.overdue.length}</strong><span>Overdue</span></div>
      <div><strong class="num">{work.today.length}</strong><span>Today</span></div>
      <div><strong class="num">{work.upcoming.length}</strong><span>Coming up</span></div>
      <div><strong class="num">{agenda.length}</strong><span>Appointments</span></div>
    </div>
  </section>

  {#if agenda.length}
    <section class="ribbon panel" aria-label="Your day">
      <div class="ribbon-head"><h2>Your day</h2><a href="#/schedule" class="faint">Open schedule</a></div>
      <div class="track">
        {#each hours as h (h)}<span class="tick" style:left={pos(h)}><i>{hhmm(h)}</i></span>{/each}
        {#each agenda as item (item.id)}
          <a class="block s-{item.service.split(' ')[0].toLowerCase()}" class:done={item.status === 'Completed'} href="#/schedule" style:left={pos(minutesOf(item.start))} style:width={`calc(${pos(minutesOf(item.start) + item.minutes)} - ${pos(minutesOf(item.start))} - 4px)`} title={`${item.start} ${item.service}, ${who(item)}`}>
            <strong>{item.service === 'Group' ? item.title : item.service.replace(' session', '')}</strong><span>{item.start}, {who(item)}</span>
          </a>
        {/each}
        {#if nowMinutes >= START && nowMinutes <= END}<span class="now" style:left={pos(nowMinutes)}><b>Now</b></span>{/if}
      </div>
    </section>
  {/if}

  <section class="lanes">
    {#each columns as column (column.key)}
      <div class="lane lane-{column.key}">
        <header><h2>{column.title}</h2><span class="count">{column.items.length}</span><span class="faint hint">{column.hint}</span></header>
        {#each column.items as item (item.id)}
          <article class="task">
            <div class="row" style="align-items: flex-start; gap: 12px">
              <span class="kind"><Icon name={ICONS[item.kind] || 'check'} size={17} /></span>
              <a class="grow task-link" href={item.link}><strong>{item.title}</strong><span>{item.sub}</span></a>
            </div>
            <footer><span class="when">{column.key === 'today' ? 'Today' : fmtDay(item.due)}</span><button class="btn sm" class:dark={column.key !== 'upcoming'} onclick={() => act(item)}>{actionLabel(item)}</button></footer>
          </article>
        {:else}
          <p class="clear">{column.key === 'overdue' ? 'Nothing overdue.' : column.key === 'today' ? 'You’re clear for today.' : 'Nothing scheduled yet.'}</p>
        {/each}
      </div>
    {/each}
  </section>
</main>

{#if note}<FormView {...note} onclose={() => { note = null; }} />{/if}

<style>
  .greeting { position: relative; overflow: hidden; display: flex; align-items: flex-end; justify-content: space-between; gap: 24px; flex-wrap: wrap; padding: 36px 38px; margin-bottom: 22px; border-radius: 32px; background: var(--hero); color: var(--on-ink); box-shadow: var(--shadow-2); }
  .greeting::after { content: ""; position: absolute; right: -90px; top: -110px; width: 380px; height: 380px; border-radius: 50%; background: radial-gradient(circle, rgb(124 252 0 / 0.3), transparent 65%); pointer-events: none; }
  .hello { position: relative; z-index: 1; }
  .date { color: var(--lime); font-weight: 750; font-size: 14px; }
  .greeting h1 { color: #fff; font-size: 44px; letter-spacing: -0.04em; margin-top: 4px; }
  .line { color: var(--on-ink-2); font-size: 16px; margin-top: 8px; max-width: 52ch; }
  .tally { position: relative; z-index: 1; display: grid; grid-template-columns: repeat(4, auto); gap: 10px; }
  .tally div { min-width: 104px; padding: 14px 16px; border-radius: 20px; background: rgb(255 255 255 / 0.07); box-shadow: inset 0 0 0 1px rgb(255 255 255 / 0.08); }
  .tally strong { display: block; font-size: 30px; font-weight: 800; letter-spacing: -0.03em; color: #fff; line-height: 1.1; }
  .tally span { font-size: 12.5px; color: var(--on-ink-2); font-weight: 650; }
  .tally .hot { background: rgb(239 90 36 / 0.22); box-shadow: inset 0 0 0 1px rgb(239 90 36 / 0.45); }
  .tally .hot strong { color: #ffb59a; }

  .ribbon { padding: 18px 24px 30px; margin-bottom: 22px; }
  .ribbon-head { display: flex; align-items: baseline; justify-content: space-between; margin-bottom: 30px; }
  .ribbon-head h2 { font-size: 18px; }
  .ribbon-head a { font-size: 13px; }
  .track { position: relative; height: 74px; border-radius: 18px; background: var(--sunk); }
  .tick { position: absolute; top: 0; bottom: 0; width: 1px; background: var(--line-strong); }
  .tick i { position: absolute; top: -22px; left: -16px; font-style: normal; font-size: 11px; font-weight: 700; color: var(--text-3); }
  .block { --c: var(--text); position: absolute; top: 9px; bottom: 9px; min-width: 70px; display: flex; flex-direction: column; justify-content: center; padding: 0 10px; border-radius: 12px; background: var(--paper); box-shadow: inset 3px 0 0 var(--c), var(--shadow-1); color: inherit; text-decoration: none; overflow: hidden; white-space: nowrap; }
  .block:hover { text-decoration: none; box-shadow: inset 3px 0 0 var(--c), var(--shadow-2); z-index: 2; }
  .block strong { font-size: 12.5px; font-weight: 800; overflow: hidden; text-overflow: ellipsis; }
  .block span { font-size: 11.5px; color: var(--text-2); overflow: hidden; text-overflow: ellipsis; }
  .block.done { opacity: 0.55; }
  .s-psychologist { --c: var(--info); } .s-therapist { --c: var(--moss); } .s-nursing { --c: var(--warn); } .s-blood { --c: var(--urgent); }
  .s-physiotherapy, .s-fitness { --c: #0e7490; } .s-group { --c: var(--text); }
  .now { position: absolute; top: -6px; bottom: -6px; width: 2px; border-radius: 2px; background: var(--lime); box-shadow: 0 0 12px var(--lime); z-index: 3; }
  .now b { position: absolute; bottom: -22px; left: -16px; font-size: 11px; font-weight: 800; color: var(--moss); }

  .lanes { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 16px; align-items: start; }
  .lane { background: var(--sunk); border-radius: 28px; padding: 10px; }
  .lane header { display: flex; align-items: center; gap: 8px; padding: 10px 12px 14px; flex-wrap: wrap; }
  .lane header h2 { font-size: 17px; }
  .lane .count { min-width: 26px; padding: 0 9px; border-radius: 12px; background: var(--paper); font-size: 12px; font-weight: 800; text-align: center; line-height: 24px; }
  .lane .hint { margin-left: auto; font-size: 12px; }
  .lane-overdue header h2 { color: var(--urgent); }
  .lane-overdue .count { background: var(--urgent); color: #fff; }
  .task { background: var(--paper); border-radius: 20px; padding: 14px; margin-bottom: 10px; box-shadow: var(--shadow-1); display: flex; flex-direction: column; gap: 12px; transition: box-shadow 0.15s, transform 0.15s; }
  .task:hover { box-shadow: var(--shadow-2); transform: translateY(-1px); }
  .kind { width: 36px; height: 36px; border-radius: 12px; background: var(--leaf); color: var(--moss); display: inline-flex; align-items: center; justify-content: center; flex: none; }
  .lane-overdue .kind { background: var(--urgent-soft); color: var(--urgent); }
  .task-link { display: flex; flex-direction: column; gap: 2px; color: inherit; text-decoration: none; }
  .task-link:hover { text-decoration: none; }
  .task-link strong { font-size: 14px; font-weight: 800; line-height: 1.3; }
  .task-link span { font-size: 12.5px; color: var(--text-2); }
  .task footer { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
  .when { font-size: 12px; font-weight: 750; color: var(--text-3); }
  .clear { padding: 22px 12px 26px; text-align: center; color: var(--text-3); font-weight: 650; }
  @media (max-width: 1100px) { .lanes { grid-template-columns: 1fr; } .tally { grid-template-columns: repeat(2, auto); } }
  @media (max-width: 700px) { .greeting { padding: 26px 22px; } .greeting h1 { font-size: 32px; } .tally { width: 100%; grid-template-columns: repeat(2, 1fr); } .ribbon { overflow-x: auto; } .track { min-width: 720px; } }
</style>
