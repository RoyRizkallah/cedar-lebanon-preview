<script>
  import Icon from '../components/Icon.svelte';
  import Ring from '../components/Ring.svelte';
  import SignaturePad from '../components/SignaturePad.svelte';
  import { db, session, commit } from '../lib/store.svelte.js';
  import { PAYERS } from '../lib/finance.js';
  import { STEPS, STEP_LABELS, STEP_OWNERS, PAYMENT_TERMS, completeStep, undoStep, canAdmit, admit, freeBeds, inquiryOf, isOutpatient, isActive, linkedPsychologist, rebookPsychologist } from '../lib/admission.js';
  import { money } from '../lib/pipeline.js';
  import { staffName, canDo, hasRole } from '../lib/people.js';
  import { fmtDay, fmtDate, fmtDateTime, todayISO } from '../lib/dates.js';
  import { putFile } from '../lib/files.js';
  import { go, say } from '../lib/ui.svelte.js';

  let { args = [] } = $props();
  const me = session.staffId;

  let openStep = $state(null);
  let inputs = $state({});
  let signing = $state(null);
  let error = $state('');

  // Only people still in Agreement; moving an inquiry back or declining it takes it off this list.
  const active = $derived(db.onboardings.filter(item => isActive(db, item)).sort((a, b) => String(a.openedAt).localeCompare(String(b.openedAt))));
  const recent = $derived(db.onboardings.filter(item => item.admittedPatientId).sort((a, b) => String(b.admittedAt).localeCompare(String(a.admittedAt))).slice(0, 5));
  const mine = step => STEP_OWNERS[step].includes(me);
  const psychOf = onboarding => linkedPsychologist(db, onboarding);

  function run(action, message) {
    error = '';
    try { const result = commit(action); if (message) say(message); return result ?? true; } catch (e) { error = e.message; return false; }
  }
  function toggle(onboarding, step) {
    error = '';
    const key = `${onboarding.id}:${step}`;
    openStep = openStep === key ? null : key;
    const inquiry = inquiryOf(db, onboarding);
    inputs = { note: '', monthlyAmount: inquiry?.potentialRevenue || '', terms: PAYMENT_TERMS[0], payer: PAYERS[0], arrivalDate: '', bed: freeBeds(db, onboarding.id)[0]?.join('/') || '' };
  }
  function done(onboarding, step, payload) {
    if (run(state => completeStep(state, onboarding.id, step, payload, me), `${STEP_LABELS[step]} done`)) openStep = null;
  }
  async function upload(event, onboarding) {
    const file = event.currentTarget.files?.[0];
    if (!file) return;
    const stored = await putFile(file);
    done(onboarding, 'agreement', { fileId: stored.id, fileName: stored.name });
  }
</script>

<main class="content">
  <div class="page-head">
    <div><h1>Admissions</h1><p>Five steps for each person in Agreement. When all are done, admitting creates the patient file and their wallet.</p></div>
  </div>
  {#if error && !openStep}<p class="error" role="alert" style="margin-bottom: 12px">{error}</p>{/if}

  <div class="stack">
    {#each active as onboarding (onboarding.id)}
      {@const inquiry = inquiryOf(db, onboarding)}
      {@const count = STEPS.filter(step => onboarding.steps[step].done).length}
      <article class="panel admission">
        <header class="admission-head">
          <span class="person-avatar">{inquiry.name.split(' ').map(part => part[0]).slice(0, 2).join('')}</span>
          <div class="grow">
            <div class="row wrap" style="gap: 8px"><h2>{inquiry.name}</h2><span class="pill">{inquiry.program}</span>{#if inquiry.urgency === 'Urgent'}<span class="pill urgent">Urgent</span>{/if}</div>
            <p class="muted" style="font-size: 13px; margin-top: 2px">Started {fmtDate(onboarding.openedAt)}. Offer {money(inquiry.potentialRevenue)} a month. <a href={`#/pipeline/${inquiry.id}`}>Inquiry</a></p>
          </div>
          <div class="progress" aria-label={`${count} of 5 steps done`}><Ring value={count * 20} size={64} stroke={7} tone={count === 5 ? 'lime' : 'ink'} /><span><strong class="num">{count}/5</strong>steps done</span></div>
          {#if canDo(me, 'confirmAdmission')}
            <button class="btn admit" class:ready={canAdmit(onboarding)} disabled={!canAdmit(onboarding)} onclick={() => { const patient = run(state => admit(state, onboarding.id, me), `${inquiry.name} admitted. Wallet created.`); if (patient) go(`patients/${patient.id}`); }}><Icon name="check-circle" size={17} />Admit patient</button>
          {/if}
        </header>

        <ol class="steps">
          {#each STEPS as step, index (step)}
            {@const state = onboarding.steps[step]}
            {@const key = `${onboarding.id}:${step}`}
            <li class:done={state.done} class:mine={!state.done && mine(step)} class:open={openStep === key}>
              <button class="step" onclick={() => toggle(onboarding, step)} aria-expanded={openStep === key}>
                <span class="mark">{#if state.done}<Icon name="check" size={18} stroke={2.6} />{:else}{index + 1}{/if}</span>
                <span class="grow"><strong>{STEP_LABELS[step]}</strong>
                  <span class="faint">{state.done ? `${staffName(state.by)}, ${fmtDate(state.at)}` : mine(step) ? 'Your step' : `Waiting on ${STEP_OWNERS[step].filter(id => !hasRole(id, 'gm', 'director')).map(staffName).join(' or ')}`}</span>
                </span>
              </button>
            </li>
          {/each}
        </ol>

        {#each STEPS as step (step)}
          {#if openStep === `${onboarding.id}:${step}`}
            {@const state = onboarding.steps[step]}
            <div class="step-panel">
              {#if state.done}
                <p><strong>{STEP_LABELS[step]}</strong> done by {staffName(state.by)}, {fmtDateTime(state.at)}.
                  {#if state.monthlyAmount} {money(state.monthlyAmount)} a month, {state.terms.toLowerCase()}{state.payer ? `, paid by ${state.payer.toLowerCase()}` : ''}.{/if}
                  {#if state.roomId} Room {state.roomId}, bed {state.bed}.{/if}
                  {#if state.arrivalDate} Arriving {fmtDay(state.arrivalDate)}.{/if}
                  {#if step === 'room' && !state.roomId} Outpatient, no room needed.{/if}
                  {#if state.note} {state.note}{/if}
                </p>
                {#if mine(step)}<button class="btn ghost sm" onclick={() => run(s => undoStep(s, onboarding.id, step, me), 'Step reopened')}>Reopen step</button>{/if}
              {:else if !mine(step)}
                <p class="muted">This step is completed by {STEP_OWNERS[step].map(staffName).join(' or ')}.</p>
                {#if step === 'psychologist' && psychOf(onboarding)}<p class="faint">Session booked {fmtDay(psychOf(onboarding).date)} at {psychOf(onboarding).start} with Nabila ({psychOf(onboarding).status.toLowerCase()}).</p>{/if}
              {:else if step === 'nursing'}
                <label class="field"><span>Nursing notes</span><textarea class="textarea" rows="2" bind:value={inputs.note} placeholder="Vitals, medication, anything the team should know"></textarea></label>
                <button class="btn dark" onclick={() => done(onboarding, 'nursing', { note: inputs.note })}>Mark nursing assessment done</button>
              {:else if step === 'psychologist'}
                {@const appointment = psychOf(onboarding)}
                {#if !appointment}
                  <p class="muted">No session is booked. The last one may have been cancelled.</p>
                  <button class="btn dark" onclick={() => { const booked = run(state => rebookPsychologist(state, onboarding.id, me)); if (booked) say(`Booked ${fmtDay(booked.date)} at ${booked.start}`); }}>Book earliest session</button>
                {:else if appointment.status !== 'Completed'}
                  <p>Session booked automatically for <strong>{fmtDay(appointment.date)} at {appointment.start}</strong> with Nabila. Mark it completed in the schedule, then come back here.</p>
                  <a class="btn sm" href="#/schedule">Open schedule</a>
                {:else}
                  <p>Session completed {fmtDateTime(appointment.completedAt)}.</p>
                  <button class="btn dark" onclick={() => done(onboarding, 'psychologist', {})}>Mark psychologist step done</button>
                {/if}
              {:else if step === 'financial'}
                <div class="grid-2">
                  <label class="field"><span>Agreed monthly amount <span class="hint">USD</span></span><input class="input" type="number" min="0" step="100" bind:value={inputs.monthlyAmount} /></label>
                  <label class="field"><span>Payment terms</span><select class="select" bind:value={inputs.terms}>{#each PAYMENT_TERMS as term}<option>{term}</option>{/each}</select></label>
                  <label class="field"><span>Who pays</span><select class="select" bind:value={inputs.payer}>{#each PAYERS as payer}<option>{payer}</option>{/each}</select></label>
                </div>
                <button class="btn dark" onclick={() => done(onboarding, 'financial', $state.snapshot(inputs))}>Save financial arrangement</button>
              {:else if step === 'agreement'}
                <p class="muted">Have {inquiry.name} sign on this screen, or upload the scanned signed copy.</p>
                <div class="row wrap">
                  <button class="btn dark" onclick={() => { signing = onboarding; }}><Icon name="pen" size={15} />Sign on screen</button>
                  <label class="btn"><Icon name="upload" size={15} />Upload signed scan<input class="sr-only" type="file" accept="image/*,application/pdf" capture="environment" onchange={event => upload(event, onboarding)} /></label>
                </div>
              {:else if step === 'room'}
                {#if isOutpatient(inquiry)}
                  <p class="muted">Outpatient program: no bed is needed.</p>
                  <button class="btn dark" onclick={() => done(onboarding, 'room', {})}>Confirm no room needed</button>
                {:else}
                  {@const beds = freeBeds(db, onboarding.id)}
                  <label class="field" style="max-width: 280px"><span>Free beds ({beds.length})</span>
                    <select class="select" bind:value={inputs.bed}>{#each beds as [room, bed]}<option value={`${room}/${bed}`}>Room {room}, bed {bed}</option>{/each}</select>
                  </label>
                  <label class="field" style="max-width: 220px"><span>Expected arrival</span><input class="input" type="date" bind:value={inputs.arrivalDate} /></label>
                  <button class="btn dark" disabled={!beds.length} onclick={() => { const [roomId, bed] = inputs.bed.split('/'); done(onboarding, 'room', { roomId, bed: Number(bed), arrivalDate: inputs.arrivalDate }); }}>Assign bed</button>
                {/if}
              {/if}
              {#if error}<p class="error" role="alert">{error}</p>{/if}
            </div>
          {/if}
        {/each}
      </article>
    {:else}
      <div class="panel empty"><strong>No admissions in progress</strong>Moving an inquiry to Agreement starts one here.</div>
    {/each}
  </div>

  {#if recent.length}
    <div class="section-title" style="margin-top: 32px"><h2>Recently admitted</h2></div>
    <ul class="list panel">
      {#each recent as onboarding (onboarding.id)}
        {@const patient = db.patients.find(item => item.id === onboarding.admittedPatientId)}
        <li class="clickable" onclick={() => go(`patients/${patient.id}`)} onkeydown={event => event.key === 'Enter' && go(`patients/${patient.id}`)} tabindex="0" role="link">
          <Icon name="check-circle" /><div class="grow"><div class="title">{patient.fullName}</div><div class="sub">{patient.program}{patient.roomId ? `, room ${patient.roomId}` : ''}. Admitted {fmtDate(patient.admittedAt)}, wallet created.</div></div><Icon name="chevron" />
        </li>
      {/each}
    </ul>
  {/if}
</main>

{#if signing}
  <SignaturePad title="Admission agreement" signerName={inquiryOf(db, signing).name} onclose={() => { signing = null; }} onsign={signature => { const onboarding = signing; signing = null; done(onboarding, 'agreement', { signature }); }} />
{/if}

<style>
  .admission { padding: 8px; border-radius: 20px; }
  .admission-head { display: flex; align-items: center; gap: 13px; padding: 14px 15px 8px; flex-wrap: wrap; }
  .admission-head h2 { font-size: 17px; font-weight: 800; letter-spacing: -0.02em; }
  .person-avatar { width: 54px; height: 54px; border-radius: 50%; display: inline-flex; align-items: center; justify-content: center; flex: none; background: linear-gradient(135deg, #b6f56b, #7cfc00); color: var(--on-lime); font-weight: 800; font-size: 17px; box-shadow: 0 8px 20px rgb(80 160 0 / 0.25); }
  .progress { display: flex; align-items: center; gap: 8px; }
  .progress :global(.ring strong) { font-size: 14px; }
  .progress :global(.ring small) { display: none; }
  .progress > span { display: flex; flex-direction: column; font-size: 12.5px; color: var(--text-2); font-weight: 600; line-height: 1.25; }
  .progress > span strong { font-size: 15px; color: var(--text); font-weight: 800; }
  .admit { height: 50px; padding: 0 17px; border-radius: 17px; font-size: 15px; background: var(--sunk); color: var(--text-3); box-shadow: none; }
  .admit.ready { background: var(--lime); color: var(--on-lime); box-shadow: 0 0 0 6px rgb(124 252 0 / 0.18), 0 14px 30px rgb(80 160 0 / 0.35); animation: breathe 2.4s ease-in-out infinite; }
  .admit.ready:hover { background: var(--lime-press); }
  @keyframes breathe { 50% { box-shadow: 0 0 0 10px rgb(124 252 0 / 0.08), 0 14px 30px rgb(80 160 0 / 0.35); } }

  /* The five steps as one connected journey */
  .steps { list-style: none; margin: 0; padding: 13px 10px 11px; display: grid; grid-template-columns: repeat(5, minmax(0, 1fr)); gap: 0; }
  .steps li { position: relative; }
  .steps li:not(:last-child)::after { content: ""; position: absolute; z-index: 0; top: 36px; left: calc(50% + 26px); right: calc(-50% + 26px); height: 4px; border-radius: 4px; background: var(--line); }
  .steps li.done:not(:last-child)::after { background: linear-gradient(90deg, var(--lime), #c5f59a); }
  .step { position: relative; z-index: 1; width: 100%; display: flex; flex-direction: column; align-items: center; gap: 10px; padding: 10px 8px 10px; border: 0; border-radius: 15px; background: transparent; text-align: center; color: inherit; transition: background 0.15s; }
  .step:hover { background: var(--subtle); }
  .step strong { display: block; font-size: 13.5px; font-weight: 800; line-height: 1.3; }
  .step .grow { display: flex; flex-direction: column; gap: 2px; }
  .step .faint { font-size: 12px; }
  .mark { width: 48px; height: 48px; border-radius: 50%; display: inline-flex; align-items: center; justify-content: center; flex: none; background: var(--paper); font-size: 15px; font-weight: 800; color: var(--text-3); box-shadow: inset 0 0 0 3px var(--line-strong); }
  li.done .mark { background: var(--lime); color: var(--on-lime); box-shadow: 0 0 0 5px var(--leaf), 0 6px 16px rgb(80 160 0 / 0.3); }
  li.mine .mark { background: var(--leaf); color: var(--moss); box-shadow: inset 0 0 0 3px #8fd14f; }
  li.mine .step .faint { color: var(--moss); font-weight: 750; }
  li.open .step { background: var(--sunk); }
  li.open .mark { box-shadow: 0 0 0 5px var(--paper), 0 0 0 7px var(--strong); }

  .step-panel { margin: 0 12px 12px; padding: 15px; border-radius: 15px; background: var(--subtle); display: flex; flex-direction: column; gap: 10px; align-items: flex-start; box-shadow: inset 0 0 0 1px var(--line); }
  .step-panel .field, .step-panel .grid-2 { width: 100%; max-width: 560px; }
  @media (max-width: 1000px) {
    .steps { grid-template-columns: 1fr; gap: 6px; }
    .steps li:not(:last-child)::after { top: 60px; bottom: -10px; left: 33px; right: auto; width: 4px; height: auto; }
    .step { flex-direction: row; text-align: left; align-items: center; }
  }
</style>
