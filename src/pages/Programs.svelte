<script>
  import Icon from '../components/Icon.svelte';
  import { db, session, commit } from '../lib/store.svelte.js';
  import { DAYS, DAY_NAMES, SESSION_KINDS, createProgram, updateProgram, archiveProgram, restoreProgram, assignProgram, endAssignment, programWeek, patientsOn, activeAssignment } from '../lib/programs.js';
  import { STAFF, canDo, hasRole, staffName } from '../lib/people.js';
  import { fmtDay, todayISO, addDays, daysBetween } from '../lib/dates.js';
  import { dialogFocus } from '../lib/dialogFocus.js';
  import { go, say } from '../lib/ui.svelte.js';

  let { args = [] } = $props();
  const me = session.staffId;
  const today = todayISO(session.now);
  const manage = canDo(me, 'managePrograms');
  const LEADERS = STAFF.filter(person => hasRole(person.id, 'clinical-director', 'psychologist', 'drama', 'nurse', 'pt', 'trainer'));
  const KIND_CLASS = { Group: 'k-group', Individual: 'k-one', Family: 'k-family', 'Drama therapy': 'k-drama', Psychoeducation: 'k-learn', Fitness: 'k-fit', Mindfulness: 'k-one', Workshop: 'k-learn' };

  let dialog = $state(null);
  let error = $state('');
  let goal = $state('');
  let assign = $state({ patientId: '', start: addDays(today, 1) });

  const active = $derived(db.programs.filter(item => item.status === 'Active'));
  const archived = $derived(db.programs.filter(item => item.status === 'Archived'));
  const program = $derived(db.programs.find(item => item.id === args[0]) || active[0] || db.programs[0]);
  const week = $derived(program ? programWeek(program) : []);
  const hours = $derived(program ? Math.round(program.sessions.reduce((sum, item) => sum + item.minutes, 0) / 6) / 10 : 0);
  const onIt = $derived(program ? patientsOn(db, program.id) : []);
  const candidates = $derived(db.patients.filter(patient => patient.status === 'Admitted' && !onIt.some(item => item.patientId === patient.id)));
  const patientOf = id => db.patients.find(patient => patient.id === id);
  const progress = item => {
    const total = Math.max(1, daysBetween(item.start, item.end));
    const done = Math.min(total, Math.max(0, daysBetween(item.start, today)));
    return { pct: Math.round((done / total) * 100), week: Math.min(program.weeks, Math.floor(done / 7) + 1), upcoming: item.start > today };
  };

  function run(action, message) {
    error = '';
    try { const result = commit(action); say(message); return result ?? true; } catch (e) { error = e.message; return false; }
  }
  function openProgram(existing) {
    error = '';
    dialog = existing
      ? { kind: 'program', id: existing.id, name: existing.name, focus: existing.focus, weeks: existing.weeks }
      : { kind: 'program', id: '', name: '', focus: '', weeks: 4, from: '' };
  }
  function openSession(day, existing) {
    error = '';
    // kind2 is the session's kind; kind says which dialog is open.
    dialog = existing ? { ...existing, kind: 'session', kind2: existing.kind } : { kind: 'session', id: '', day, time: '10:00', minutes: 60, kind2: 'Group', title: '', leader: me };
  }
  function save() {
    const d = $state.snapshot(dialog);
    if (d.kind === 'program') {
      if (d.id) { if (run(state => updateProgram(state, d.id, { name: d.name, focus: d.focus, weeks: Number(d.weeks) }, me, session.now), 'Program updated')) dialog = null; return; }
      const source = db.programs.find(item => item.id === d.from);
      let created;
      const ok = run(state => { created = createProgram(state, { name: d.name, focus: d.focus, weeks: Number(d.weeks), goals: source?.goals || [], sessions: (source?.sessions || []).map(({ id, ...rest }) => rest) }, me, session.now); }, 'Program created');
      if (ok) { dialog = null; go(`programs/${created.id}`); }
      return;
    }
    const entry = { id: d.id, day: d.day, time: d.time, minutes: Number(d.minutes), kind: d.kind2, title: d.title, leader: d.leader };
    const sessions = d.id ? program.sessions.map(item => (item.id === d.id ? entry : item)) : [...program.sessions, entry];
    if (run(state => updateProgram(state, program.id, { sessions }, me, session.now), d.id ? 'Session updated' : `Added to ${DAY_NAMES[d.day]}`)) dialog = null;
  }
  function removeSession(id) {
    if (run(state => updateProgram(state, program.id, { sessions: program.sessions.filter(item => item.id !== id) }, me, session.now), 'Session removed')) dialog = null;
  }
  function addGoal() {
    if (!goal.trim()) return;
    if (run(state => updateProgram(state, program.id, { goals: [...program.goals, goal] }, me, session.now), 'Goal added')) goal = '';
  }
  function giveProgram() {
    const patient = patientOf(assign.patientId);
    const moving = patient && activeAssignment(db, patient.id);
    if (moving && !confirm(`${patient.clinicalName} is on another program. Starting this one ends it the day before. Continue?`)) return;
    if (run(state => assignProgram(state, program.id, assign.patientId, { start: assign.start }, me, session.now), `${patient?.clinicalName || 'Patient'} starts ${fmtDay(assign.start)}`)) assign.patientId = '';
  }
</script>

<main class="content">
  <div class="page-head">
    <div><h1>Programs</h1><p>Weekly plans the therapists build, then give to patients. The care team sees each patient's program on their file.</p></div>
    {#if manage}<div class="actions"><button class="btn primary" onclick={() => openProgram(null)}><Icon name="plus" size={16} />New program</button></div>{/if}
  </div>

  {#if !program}
    <section class="panel empty-state"><p>No programs yet.{manage ? ' Start one with "New program".' : ' The therapists will add them here.'}</p></section>
  {:else}
    <div class="prog-layout">
      <nav class="prog-list" aria-label="Programs">
        {#each active as item (item.id)}
          <a class="prog-card" href={`#/programs/${item.id}`} aria-current={item.id === program.id ? 'page' : undefined}>
            <strong>{item.name}</strong>
            <span class="meta">{item.weeks} weeks · {item.sessions.length} sessions a week</span>
            <span class="meta">By {staffName(item.createdBy)} · {patientsOn(db, item.id).length} on it</span>
          </a>
        {/each}
        {#if archived.length}
          <details class="archived"><summary>Archived ({archived.length})</summary>
            {#each archived as item (item.id)}<a class="prog-card dim" href={`#/programs/${item.id}`} aria-current={item.id === program.id ? 'page' : undefined}><strong>{item.name}</strong><span class="meta">{item.weeks} weeks</span></a>{/each}
          </details>
        {/if}
      </nav>

      <div class="prog-main">
        <section class="prog-hero">
          <div class="hero-text">
            <span class="eyebrow">{program.status === 'Archived' ? 'Archived program' : `Built by ${staffName(program.createdBy)}`}</span>
            <h2>{program.name}</h2>
            {#if program.focus}<p>{program.focus}</p>{/if}
          </div>
          <dl class="hero-facts">
            <div><dt>Length</dt><dd class="num">{program.weeks}<small> weeks</small></dd></div>
            <div><dt>Each week</dt><dd class="num">{program.sessions.length}<small> sessions, {hours} h</small></dd></div>
            <div><dt>On it now</dt><dd class="num">{onIt.length}<small> {onIt.length === 1 ? 'patient' : 'patients'}</small></dd></div>
          </dl>
          {#if manage}
            <div class="hero-actions">
              <button class="btn sm" onclick={() => openProgram(program)}><Icon name="pen" size={14} />Edit details</button>
              {#if program.status === 'Active'}<button class="btn sm ghost-ink" onclick={() => { if (confirm('Archive this program? Patients on it stay on it until you end it.')) run(state => archiveProgram(state, program.id, me, session.now), 'Program archived'); }}>Archive</button>
              {:else}<button class="btn sm ghost-ink" onclick={() => run(state => restoreProgram(state, program.id, me), 'Program restored')}>Restore</button>{/if}
            </div>
          {/if}
        </section>

        <section class="panel goals">
          <div class="panel-head"><h3>Goals</h3><span class="faint" style="font-size: 13px">What a patient should leave this program with</span></div>
          <ul class="goal-list">
            {#each program.goals as item, index (index)}
              <li><Icon name="check-circle" size={16} /><span class="grow">{item}</span>{#if manage}<button class="btn icon sm ghost" aria-label={`Remove goal: ${item}`} onclick={() => run(state => updateProgram(state, program.id, { goals: program.goals.filter((_, at) => at !== index) }, me, session.now), 'Goal removed')}><Icon name="close" size={14} /></button>{/if}</li>
            {:else}<li class="faint">No goals yet.</li>{/each}
          </ul>
          {#if manage}<form class="goal-add" onsubmit={event => { event.preventDefault(); addGoal(); }}><input class="input" bind:value={goal} placeholder="Add a goal, for example: name three triggers" /><button class="btn" type="submit">Add</button></form>{/if}
        </section>

        <section class="panel">
          <div class="panel-head"><h3>The week</h3><span class="faint" style="font-size: 13px">Repeats every week of the program</span></div>
          <div class="week">
            {#each week as { day, sessions } (day)}
              <div class="day">
                <h4>{DAY_NAMES[day]}</h4>
                {#each sessions as item (item.id)}
                  <button class="slot {KIND_CLASS[item.kind]}" disabled={!manage} onclick={() => openSession(day, item)}>
                    <span class="slot-time num">{item.time}<small> · {item.minutes} min</small></span>
                    <strong>{item.title}</strong>
                    <span class="slot-meta">{item.kind}{item.leader ? `, ${staffName(item.leader)}` : ''}</span>
                  </button>
                {:else}<p class="rest">Free day</p>{/each}
                {#if manage}<button class="add-slot" onclick={() => openSession(day, null)}><Icon name="plus" size={14} />Add</button>{/if}
              </div>
            {/each}
          </div>
        </section>

        <section class="panel">
          <div class="panel-head"><h3>Patients on this program</h3><span class="faint" style="font-size: 13px">{onIt.length} now</span></div>
          <ul class="people">
            {#each onIt as item (item.id)}
              {@const patient = patientOf(item.patientId)}
              {@const p = progress(item)}
              <li>
                <a class="who" href={`#/patients/${item.patientId}`}><span class="avatar sm">{patient?.clinicalName?.slice(0, 2)}</span><span><strong>{patient?.clinicalName}</strong><span class="faint">{p.upcoming ? `Starts ${fmtDay(item.start)}` : `Week ${p.week} of ${program.weeks}, ends ${fmtDay(item.end)}`}</span></span></a>
                <span class="meter" aria-label={`${p.pct}% through`}><i style={`width: ${p.pct}%`}></i></span>
                {#if manage}<button class="btn sm ghost" onclick={() => { if (confirm(`End ${patient?.clinicalName}'s program today?`)) run(state => endAssignment(state, item.id, me, session.now), 'Program ended'); }}>End</button>{/if}
              </li>
            {:else}<li class="faint">Nobody is on this program yet.</li>{/each}
          </ul>
          {#if manage && program.status === 'Active'}
            <form class="assign" onsubmit={event => { event.preventDefault(); giveProgram(); }}>
              <label class="field grow"><span>Patient</span>
                <select class="select" bind:value={assign.patientId} required>
                  <option value="">Choose a patient</option>
                  {#each candidates as patient (patient.id)}<option value={patient.id}>{patient.clinicalName}{activeAssignment(db, patient.id) ? ' (on another program)' : ''}</option>{/each}
                </select>
              </label>
              <label class="field"><span>Starts</span><input class="input" type="date" bind:value={assign.start} min={today} required /></label>
              <button class="btn primary" type="submit"><Icon name="plus" size={16} />Assign</button>
            </form>
          {/if}
          {#if error && !dialog}<p class="error" role="alert" style="margin: 0 18px 16px">{error}</p>{/if}
        </section>
      </div>
    </div>
  {/if}
</main>

{#if dialog}
  <div class="scrim" onclick={() => { dialog = null; }} aria-hidden="true"></div>
  <form class="dialog" use:dialogFocus={{ onClose: () => { dialog = null; } }} onsubmit={event => { event.preventDefault(); save(); }}>
    {#if dialog.kind === 'program'}
      <header class="drawer-head"><div class="grow"><h2>{dialog.id ? 'Edit program' : 'New program'}</h2></div></header>
      <div class="drawer-body stack">
        <label class="field"><span>Name</span><input class="input" bind:value={dialog.name} placeholder="For example: Foundations, first 28 days" required /></label>
        <label class="field"><span>Focus <span class="hint">what it is for, in a sentence</span></span><input class="input" bind:value={dialog.focus} /></label>
        <div class="grid-2">
          <label class="field"><span>Length <span class="hint">weeks</span></span><input class="input" type="number" min="1" max="26" bind:value={dialog.weeks} /></label>
          {#if !dialog.id}
            <label class="field"><span>Start from</span><select class="select" bind:value={dialog.from}><option value="">A blank week</option>{#each db.programs as item (item.id)}<option value={item.id}>A copy of {item.name}</option>{/each}</select></label>
          {/if}
        </div>
        {#if error}<p class="error" role="alert">{error}</p>{/if}
      </div>
    {:else}
      <header class="drawer-head"><div class="grow"><h2>{dialog.id ? 'Edit session' : `Add to ${DAY_NAMES[dialog.day]}`}</h2></div></header>
      <div class="drawer-body stack">
        <label class="field"><span>Title</span><input class="input" bind:value={dialog.title} placeholder="For example: Process group" required /></label>
        <div class="grid-2">
          <label class="field"><span>Kind</span><select class="select" bind:value={dialog.kind2}>{#each SESSION_KINDS as kind}<option>{kind}</option>{/each}</select></label>
          <label class="field"><span>Led by</span><select class="select" bind:value={dialog.leader}>{#each LEADERS as person (person.id)}<option value={person.id}>{person.name}, {person.title}</option>{/each}</select></label>
        </div>
        <div class="grid-3">
          <label class="field"><span>Day</span><select class="select" bind:value={dialog.day}>{#each DAYS as day}<option value={day}>{DAY_NAMES[day]}</option>{/each}</select></label>
          <label class="field"><span>Starts</span><input class="input" type="time" bind:value={dialog.time} /></label>
          <label class="field"><span>Minutes</span><input class="input" type="number" min="15" max="240" step="5" bind:value={dialog.minutes} /></label>
        </div>
        {#if error}<p class="error" role="alert">{error}</p>{/if}
      </div>
    {/if}
    <footer class="drawer-foot">
      {#if dialog.kind === 'session' && dialog.id}<button class="btn ghost danger" type="button" onclick={() => removeSession(dialog.id)}>Remove</button><span class="grow"></span>{/if}
      <button class="btn" type="button" onclick={() => { dialog = null; }}>Cancel</button>
      <button class="btn primary" type="submit">{dialog.kind === 'program' && !dialog.id ? 'Create program' : 'Save'}</button>
    </footer>
  </form>
{/if}

<style>
  /* A shelf of programs on the left; the chosen one opens as a hero, its goals, its week, and its people */
  .prog-layout { display: grid; grid-template-columns: 290px minmax(0, 1fr); gap: 20px; align-items: start; }
  .prog-list { position: sticky; top: calc(var(--topbar) + 8px); display: flex; flex-direction: column; gap: 10px; }
  .prog-card { display: flex; flex-direction: column; gap: 3px; padding: 16px 18px; border-radius: 22px; background: var(--paper); box-shadow: var(--shadow-1); color: var(--text); text-decoration: none; }
  .prog-card:hover { text-decoration: none; box-shadow: var(--shadow-2); }
  .prog-card strong { font-size: 15px; font-weight: 800; letter-spacing: -0.01em; }
  .prog-card .meta { font-size: 12.5px; color: var(--text-3); font-weight: 600; }
  .prog-card[aria-current='page'] { background: var(--strong); color: var(--on-strong); }
  .prog-card[aria-current='page'] .meta { color: var(--on-ink-2); }
  .prog-card.dim { opacity: 0.75; }
  .archived summary { cursor: pointer; padding: 6px 4px; font-size: 13px; font-weight: 700; color: var(--text-3); }
  .archived { display: flex; flex-direction: column; gap: 8px; }

  .prog-main { display: flex; flex-direction: column; gap: 16px; min-width: 0; }
  .prog-hero { position: relative; overflow: hidden; display: grid; grid-template-columns: minmax(0, 1.3fr) minmax(0, 1fr); gap: 20px; padding: 26px 28px; border-radius: 30px; background: var(--hero); color: var(--on-ink); box-shadow: var(--shadow-2); }
  .prog-hero::before { content: ""; position: absolute; right: -60px; top: -120px; width: 340px; height: 340px; border-radius: 50%; background: radial-gradient(circle, rgb(124 252 0 / 0.18), transparent 65%); pointer-events: none; }
  .hero-text { position: relative; display: flex; flex-direction: column; gap: 6px; }
  .eyebrow { font-size: 12.5px; font-weight: 700; color: var(--lime); }
  .prog-hero h2 { font-size: 30px; font-weight: 800; letter-spacing: -0.03em; line-height: 1.1; color: var(--on-ink); }
  .prog-hero p { margin: 0; color: var(--on-ink-2); font-size: 14.5px; max-width: 52ch; }
  .hero-facts { position: relative; display: grid; gap: 8px; margin: 0; }
  .hero-facts div { display: flex; align-items: baseline; justify-content: space-between; gap: 12px; padding: 10px 14px; border-radius: 16px; background: rgb(255 255 255 / 0.07); }
  .hero-facts dt { font-size: 13px; color: var(--on-ink-2); font-weight: 650; }
  .hero-facts dd { margin: 0; font-size: 20px; font-weight: 800; }
  .hero-facts small { font-size: 12px; font-weight: 600; color: var(--on-ink-2); }
  .hero-actions { position: relative; grid-column: 1 / -1; display: flex; gap: 8px; flex-wrap: wrap; }
  .ghost-ink { background: rgb(255 255 255 / 0.08); color: var(--on-ink); }

  .goal-list { list-style: none; margin: 0; padding: 0 18px 8px; display: flex; flex-direction: column; gap: 4px; }
  .goal-list li { display: flex; align-items: center; gap: 10px; padding: 6px 0; font-weight: 600; color: var(--text); }
  .goal-list li :global(svg) { color: var(--moss); flex: none; }
  .goal-add { display: flex; gap: 8px; padding: 0 18px 18px; }
  .goal-add .input { flex: 1; min-width: 0; }

  .week { display: grid; grid-template-columns: repeat(6, minmax(150px, 1fr)); gap: 10px; padding: 0 14px 16px; overflow-x: auto; }
  .day { display: flex; flex-direction: column; gap: 8px; padding: 10px; border-radius: 20px; background: var(--sunk); min-height: 180px; }
  .day h4 { font-size: 13px; font-weight: 800; padding: 2px 4px; }
  .slot { display: flex; flex-direction: column; gap: 2px; padding: 10px 11px; border: 0; border-radius: 14px; background: var(--paper); color: var(--text); text-align: left; font: inherit; cursor: pointer; box-shadow: var(--shadow-1); }
  .slot:disabled { cursor: default; }
  .slot:not(:disabled):hover { transform: translateY(-1px); box-shadow: var(--shadow-2); }
  .slot strong { font-size: 13.5px; font-weight: 750; line-height: 1.25; }
  .slot-time { font-size: 12px; font-weight: 800; }
  .slot-time small { font-weight: 600; color: var(--text-3); }
  .slot-meta { font-size: 11.5px; color: var(--text-3); font-weight: 600; }
  .slot.k-group { background: var(--strong); color: var(--on-strong); }
  .slot.k-group .slot-meta, .slot.k-group small { color: var(--on-ink-2); }
  .slot.k-one { background: var(--leaf); }
  .slot.k-family { background: var(--warn-soft); }
  .slot.k-drama { background: var(--info-soft); }
  .slot.k-fit { background: var(--ok-soft); }
  .rest { margin: 0; padding: 6px 4px; font-size: 12.5px; color: var(--text-3); }
  .add-slot { margin-top: auto; display: inline-flex; align-items: center; justify-content: center; gap: 4px; padding: 8px; border: 1.5px dashed var(--line-strong); border-radius: 14px; background: none; color: var(--text-2); font: inherit; font-size: 12.5px; font-weight: 700; cursor: pointer; }
  .add-slot:hover { border-color: var(--moss); color: var(--moss); }

  .people { list-style: none; margin: 0; padding: 0 18px 8px; display: flex; flex-direction: column; }
  .people li { display: grid; grid-template-columns: minmax(0, 1fr) 160px auto; align-items: center; gap: 14px; padding: 10px 0; border-bottom: 1px solid var(--line); }
  .people li:last-child { border-bottom: 0; }
  .people .who { display: flex; align-items: center; gap: 10px; color: var(--text); text-decoration: none; min-width: 0; }
  .people .who strong { display: block; font-size: 14px; }
  .people .who .faint { font-size: 12.5px; }
  .assign { display: flex; align-items: flex-end; gap: 10px; flex-wrap: wrap; padding: 12px 18px 18px; border-top: 1px solid var(--line); }
  .assign .grow { flex: 1 1 220px; }

  /* Below very wide screens the shelf sits above, so the whole week fits across */
  @media (max-width: 1500px) {
    .prog-layout { grid-template-columns: 1fr; }
    .prog-list { position: static; flex-direction: row; overflow-x: auto; scroll-snap-type: x mandatory; padding-bottom: 4px; }
    .prog-card { flex: 0 0 min(270px, 78vw); scroll-snap-align: start; }
    .archived { flex: 0 0 auto; }
  }
  @media (max-width: 1000px) {
    .prog-hero { grid-template-columns: 1fr; padding: 22px; }
  }
  @media (max-width: 720px) {
    .week { grid-template-columns: repeat(6, 78vw); scroll-snap-type: x mandatory; margin: 0; }
    .day { scroll-snap-align: start; }
    .people li { grid-template-columns: minmax(0, 1fr) auto; }
    .people .meter { grid-column: 1 / -1; grid-row: 2; }
    .prog-hero h2 { font-size: 24px; }
  }
</style>
