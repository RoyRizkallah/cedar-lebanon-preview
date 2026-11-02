<script>
  import Icon from '../components/Icon.svelte';
  import InquiryDrawer from '../components/InquiryDrawer.svelte';
  import InquiryFields from '../components/InquiryFields.svelte';
  import { db, session, commit } from '../lib/store.svelte.js';
  import { STAGES, PROGRAMS, createInquiry, moveInquiry, reviewDue, timeInStageHours, noPhone, money, isOpen, potentialTotals, startFollowUp, FOLLOW_UP_DAYS } from '../lib/pipeline.js';
  import { dashboard } from '../lib/kpis.js';
  import { staffName, staffById, canDo, hasRole } from '../lib/people.js';
  import { fmtDuration, fmtDate } from '../lib/dates.js';
  import { dialogFocus } from '../lib/dialogFocus.js';
  import { onMount } from 'svelte';
  import { go, say, takeIntent } from '../lib/ui.svelte.js';

  let { args = [] } = $props();

  let view = $state('Open');
  let query = $state('');
  let contact = $state('');
  let program = $state('');
  let urgentOnly = $state(false);
  let dragging = $state(null);
  let over = $state('');
  let creating = $state(null);
  let error = $state('');
  const me = session.staffId;
  const editable = canDo(me, 'editInquiry');

  const filtered = $derived(db.inquiries.filter(item =>
    (!query.trim() || `${item.name} ${item.phone} ${item.id} ${item.drugOfChoice}`.toLowerCase().includes(query.trim().toLowerCase())) &&
    (!contact || item.contactPerson === contact) && (!program || item.program === program) && (!urgentOnly || item.urgency === 'Urgent')));
  const open = $derived(filtered.filter(isOpen));
  const declined = $derived(filtered.filter(item => item.outcome === 'Declined').sort((a, b) => String(b.closedAt).localeCompare(String(a.closedAt))));
  const column = stage => open.filter(item => item.stage === stage).sort((a, b) => (b.urgency === 'Urgent') - (a.urgency === 'Urgent') || String(a.stageHistory.at(-1).at).localeCompare(String(b.stageHistory.at(-1).at)));
  const potential = $derived(potentialTotals(db));
  const openAll = $derived(db.inquiries.filter(isOpen));
  const countIn = stage => openAll.filter(item => item.stage === stage).length;
  const admittedPct = $derived(dashboard(db, session.now).pipeline.admittedPct);
  const people = n => `${n} ${n === 1 ? 'person' : 'people'}`;
  const total = stage => column(stage).reduce((sum, item) => sum + Number(item.potentialRevenue || 0), 0);

  function move(id, stage) {
    error = '';
    try {
      if (stage === 'Follow-up') {
        commit(state => startFollowUp(state, id, {}, me));
        say(`${db.inquiries.find(item => item.id === id)?.name} moved to Follow-ups. Reminder in ${FOLLOW_UP_DAYS} days.`);
        return;
      }
      commit(state => moveInquiry(state, id, stage, me));
      const name = db.inquiries.find(item => item.id === id)?.name;
      say(stage === 'Agreement' ? `${name} moved to Agreement. Admission started.` : `${name} moved to ${stage}`);
    } catch (e) { error = e.message; }
  }
  function drop(stage) {
    if (dragging) move(dragging, stage);
    dragging = null; over = '';
  }
  function startCreate() {
    creating = { name: '', phone: '', email: '', source: 'Phone', contactPerson: hasRole(me, 'admin') ? me : 'melyssa', commPreference: 'Phone call', program: 'Inpatient', drugOfChoice: '', yearsOfUse: '', previousDetox: '', urgency: 'Normal', potentialRevenue: 0, notes: '' };
  }
  onMount(() => { if (takeIntent('new-inquiry') && editable) startCreate(); });

  function create() {
    error = '';
    try {
      const inquiry = commit(state => createInquiry(state, $state.snapshot(creating), me));
      creating = null;
      say(`${inquiry.name} added to New Inquiry`);
    } catch (e) { error = e.message; }
  }
</script>

<main class="content wide">
  <div class="page-head">
    <div><h1>Pipeline</h1><p>{people(openAll.filter(item => item.stage !== 'Follow-up').length)} on their way to Cedar{openAll.some(item => item.stage === 'Follow-up') ? `, ${openAll.filter(item => item.stage === 'Follow-up').length} more in follow-up` : ''}. Drag a card when they move forward; agreements continue in Admissions.</p></div>
    <div class="actions">
      <div class="seg" role="group" aria-label="View"><button aria-pressed={view === 'Open'} onclick={() => { view = 'Open'; }}>Open</button><button aria-pressed={view === 'Declined'} onclick={() => { view = 'Declined'; }}>Declined</button></div>
      {#if editable}<button class="btn primary" onclick={startCreate}><Icon name="plus" size={16} />New inquiry</button>{/if}
    </div>
  </div>

  <section class="money" aria-label="Potential revenue">
    <div class="stat hero">
      <div class="label">Potential revenue in play</div>
      <div class="value num">{money(potential.combined)}</div>
      <div class="note">per month, new inquiry and assessment</div>
      <div class="split" aria-hidden="true"><i style:width={`${potential.combined ? (potential.inquiry / potential.combined) * 100 : 0}%`}></i><i></i></div>
    </div>
    <div class="stat"><div class="label">New inquiry</div><div class="value num">{money(potential.inquiry)}</div><div class="note">{people(countIn('New Inquiry'))}</div></div>
    <div class="stat"><div class="label">Assessment</div><div class="value num">{money(potential.assessment)}</div><div class="note">{people(countIn('Assessment'))}</div></div>
    <a class="stat" href="#/admissions"><div class="label">In agreement</div><div class="value num">{money(potential.agreement)}</div><div class="note">{countIn('Agreement')} admitting now</div></a>
    <div class="stat"><div class="label">Admitted, 90 days</div><div class="value num">{admittedPct ?? '—'}{#if admittedPct !== null}<small>%</small>{/if}</div><div class="note">of inquiries</div></div>
  </section>

  <div class="toolbar">
    <input class="input" type="search" placeholder="Search name, phone or substance" aria-label="Search inquiries" bind:value={query} />
    <select class="select" aria-label="Contact person" bind:value={contact}><option value="">Any contact person</option><option value="melyssa">Melyssa</option><option value="ahmed">Ahmed</option></select>
    <select class="select" aria-label="Program" bind:value={program}><option value="">Any program</option>{#each PROGRAMS as name}<option>{name}</option>{/each}</select>
    <label class="choice"><input type="checkbox" bind:checked={urgentOnly} /><span>Urgent only</span></label>
    {#if error}<span class="error" role="alert">{error}</span>{/if}
  </div>

  {#if view === 'Open'}
    <div class="board">
      {#each STAGES as stage, index (stage)}
        <section class="column" class:over={over === stage} aria-label={stage}
          ondragover={event => { if (dragging) { event.preventDefault(); over = stage; } }} ondragleave={() => { if (over === stage) over = ''; }} ondrop={event => { event.preventDefault(); drop(stage); }}>
          <header class="column-head">
            <div class="row between"><h2>{stage}</h2><span class="count num">{column(stage).length}</span></div>
            <div class="row between faint" style="font-size: 12.5px"><span>{['First contact, first 48 hours', 'Assessment booked or done', 'Offer agreed, admission steps open'][index]}</span><span class="num" style="color: var(--ink); font-weight: 600">{money(total(stage))}</span></div>
          </header>
          <div class="cards">
            {#each column(stage) as item (item.id)}
              <article class="card" class:urgent={item.urgency === 'Urgent'} class:dragging={dragging === item.id} draggable={editable} ondragstart={event => { dragging = item.id; event.dataTransfer.effectAllowed = 'move'; event.dataTransfer.setData('text/plain', item.id); }} ondragend={() => { dragging = null; over = ''; }}>
                <a class="card-link" href={`#/pipeline/${item.id}`}>
                  <div class="row between" style="align-items: flex-start"><strong>{item.name}</strong>{#if noPhone(item)}<span title="Not comfortable talking on the phone" style="color: var(--warn); display: flex"><Icon name="phone-off" size={16} /></span>{/if}</div>
                  <span class="faint">{item.program}{item.drugOfChoice ? `, ${item.drugOfChoice}` : ''}</span>
                  {#if item.relationship && item.relationship !== 'Self'}<span class="via">Via {item.callerName || 'family'}, {item.relationship.toLowerCase()}</span>{/if}
                  {#if item.urgency === 'Urgent' || reviewDue(item, session.now)}
                    <span class="row" style="gap: 6px; margin-top: 2px">{#if item.urgency === 'Urgent'}<span class="pill urgent">Urgent</span>{/if}{#if reviewDue(item, session.now)}<span class="pill warn">Review due</span>{/if}</span>
                  {/if}
                </a>
                {#if item.stage === 'New Inquiry'}
                  {@const hours = timeInStageHours(item, session.now)}
                  <div class="clock" title={`${Math.floor(hours)} of 48 hours used before review`}><i style:width={`${Math.min(100, (hours / 48) * 100)}%`} class:late={hours >= 48} class:soon={hours >= 36 && hours < 48}></i></div>
                {/if}
                <footer class="row between">
                  <span class="row" style="gap: 6px"><span class="avatar sm" title={`Contact: ${staffName(item.contactPerson)}`}>{staffById(item.contactPerson)?.initials}</span><span class="faint row" style="gap: 3px" title="Time in this stage"><Icon name="clock" size={13} />{fmtDuration(timeInStageHours(item, session.now))}</span></span>
                  <span class="row" style="gap: 6px">
                    <strong class="num" style="font-size: 13px">{money(item.potentialRevenue)}</strong>
                    {#if editable}
                      <label class="move"><span class="sr-only">Move {item.name} to</span>
                        <select aria-label={`Move ${item.name} to`} value="" onchange={event => { const value = event.currentTarget.value; event.currentTarget.value = ''; if (value) move(item.id, value); }}>
                          <option value="" disabled selected>Move to</option>
                          {#each STAGES.filter(name => name !== item.stage) as target}<option value={target}>{target}</option>{/each}
                          <option value="Follow-up">Follow-up ({FOLLOW_UP_DAYS} days)</option>
                        </select>
                      </label>
                    {/if}
                  </span>
                </footer>
              </article>
            {:else}
              <p class="faint drop-hint">{editable ? 'Drag an inquiry here' : 'Nothing here'}</p>
            {/each}
          </div>
        </section>
      {/each}
    </div>
  {:else}
    <div class="panel table-wrap">
      <table class="table cards">
        <thead><tr><th>Name</th><th>Program</th><th>Closed</th><th>Reason</th><th>Stage reached</th></tr></thead>
        <tbody>
          {#each declined as item (item.id)}
            <tr class="clickable" onclick={() => go(`pipeline/${item.id}`)}><td class="lead-cell"><strong>{item.name}</strong></td><td data-label="Program">{item.program}</td><td data-label="Closed">{fmtDate(item.closedAt)}</td><td data-label="Reason">{item.declineReason}</td><td data-label="Stage">{item.stage}</td></tr>
          {:else}
            <tr><td colspan="5"><div class="empty"><strong>No declined inquiries</strong></div></td></tr>
          {/each}
        </tbody>
      </table>
    </div>
  {/if}
</main>

{#if args[0]}
  {#key args[0]}<InquiryDrawer id={args[0]} onclose={() => go('pipeline')} />{/key}
{/if}

{#if creating}
  <div class="scrim" onclick={() => { creating = null; }} aria-hidden="true"></div>
  <section class="drawer" use:dialogFocus={{ onClose: () => { creating = null; } }}>
    <header class="drawer-head"><div class="grow"><h2>New inquiry</h2><p class="muted" style="margin-top: 4px">Starts in New Inquiry. Follow-up calls are booked for one week and one month from today.</p></div><button class="btn ghost icon" aria-label="Close" onclick={() => { creating = null; }}><Icon name="close" /></button></header>
    <form class="drawer-body" id="new-inquiry" onsubmit={event => { event.preventDefault(); create(); }}><InquiryFields fields={creating} /></form>
    <footer class="drawer-foot">{#if error}<span class="error" style="margin-right: auto">{error}</span>{/if}<button class="btn" onclick={() => { creating = null; }}>Cancel</button><button class="btn primary" type="submit" form="new-inquiry">Create inquiry</button></footer>
  </section>
{/if}

<style>
  .money { display: grid; grid-template-columns: 1.4fr repeat(4, minmax(0, 1fr)); gap: 14px; margin-bottom: 26px; }
  .split { display: flex; height: 8px; border-radius: 8px; overflow: hidden; margin-top: 16px; background: #2c3b29; }
  .split i:first-child { background: var(--lime); }
  .split i:last-child { flex: 1; background: #c5f59a; }
  .board { display: grid; grid-template-columns: repeat(3, minmax(290px, 1fr)); gap: 18px; align-items: start; overflow-x: auto; padding-bottom: 8px; }
  .column { background: var(--sunk); border-radius: 28px; padding: 10px; min-height: 360px; transition: box-shadow 0.15s, background 0.15s; }
  .column.over { background: var(--leaf); box-shadow: inset 0 0 0 2px #8fd14f; }
  .column-head { padding: 12px 12px 14px; }
  .column-head h2 { font-size: 17px; font-weight: 800; }
  .column-head .count { min-width: 26px; padding: 0 9px; border-radius: 12px; background: var(--paper); font-size: 12px; font-weight: 800; text-align: center; line-height: 24px; }
  .cards { display: flex; flex-direction: column; gap: 10px; }
  .card { background: var(--paper); border-radius: 20px; padding: 16px 16px 14px; display: flex; flex-direction: column; gap: 10px; cursor: grab; box-shadow: var(--shadow-1); transition: box-shadow 0.15s, transform 0.15s; }
  .card:hover { box-shadow: var(--shadow-2); transform: translateY(-1px); }
  .card.urgent { box-shadow: inset 4px 0 0 #ef5a24, var(--shadow-1); }
  .card.dragging { opacity: 0.45; }
  .card-link { display: flex; flex-direction: column; gap: 3px; color: inherit; text-decoration: none; }
  .card-link:hover { text-decoration: none; }
  .card-link strong { font-size: 15.5px; font-weight: 800; }
  .card-link .faint { font-size: 13px; color: var(--text-2); }
  .via { font-size: 12px; font-weight: 700; color: var(--moss); }
  .clock { height: 5px; border-radius: 5px; background: var(--sunk); overflow: hidden; }
  .clock i { display: block; height: 100%; background: var(--lime); border-radius: inherit; }
  .clock i.soon { background: #f2a33a; }
  .clock i.late { background: #ef5a24; }
  .move select { height: 30px; border: 0; border-radius: 15px; background: var(--sunk); font: 650 12px var(--font); color: var(--text-2); padding: 0 10px; max-width: 98px; }
  .drop-hint { text-align: center; padding: 28px 8px; font-size: 13px; border: 2px dashed var(--line-strong); border-radius: 20px; }
  @media (max-width: 1200px) { .money { grid-template-columns: repeat(3, minmax(0, 1fr)); } .money .hero { grid-column: span 3; } }
  @media (max-width: 900px) {
    .money { grid-template-columns: repeat(2, minmax(0, 1fr)); } .money .hero { grid-column: span 2; }
    .board { grid-template-columns: repeat(3, 84vw); scroll-snap-type: x mandatory; margin: 0 -16px; padding: 0 16px 8px; }
    .column { scroll-snap-align: start; }
  }
</style>
