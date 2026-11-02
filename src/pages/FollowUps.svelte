<script>
  import Icon from '../components/Icon.svelte';
  import InquiryDrawer from '../components/InquiryDrawer.svelte';
  import { db, session, commit } from '../lib/store.svelte.js';
  import { FOLLOW_UP_DAYS, CALL_OUTCOMES, followUpAgain, moveInquiry, declineInquiry, money, followUpPotential, noPhone } from '../lib/pipeline.js';
  import { staffName } from '../lib/people.js';
  import { fmtDay, todayISO, daysBetween } from '../lib/dates.js';
  import { dialogFocus } from '../lib/dialogFocus.js';
  import { go, say } from '../lib/ui.svelte.js';

  let { args = [] } = $props();
  const me = session.staffId;
  const today = todayISO(session.now);
  let dialog = $state(null);
  let error = $state('');

  const rows = $derived(db.inquiries.filter(item => item.stage === 'Follow-up' && !item.outcome).sort((a, b) => a.followUp.due.localeCompare(b.followUp.due)));
  const due = $derived(rows.filter(item => item.followUp.due <= today));
  const overdue = $derived(rows.filter(item => item.followUp.due < today));
  const when = item => {
    const days = daysBetween(today, item.followUp.due);
    return days < 0 ? { text: `${-days} day${days === -1 ? '' : 's'} late`, tone: 'urgent' } : days === 0 ? { text: 'Today', tone: 'warn' } : { text: `In ${days} day${days === 1 ? '' : 's'}`, tone: '' };
  };
  const who = item => item.relationship && item.relationship !== 'Self' ? `${item.callerName || 'Someone'} (${item.relationship.toLowerCase()})` : 'The person themselves';

  function run(action, message) {
    error = '';
    try { commit(action); say(message); return true; } catch (e) { error = e.message; return false; }
  }
  function save() {
    const d = $state.snapshot(dialog);
    const ok = d.kind === 'again'
      ? run(state => followUpAgain(state, d.id, { days: Number(d.days), outcome: d.outcome, note: d.note }, me), `Next follow-up in ${d.days} days`)
      : run(state => declineInquiry(state, d.id, d.reason, me), 'Inquiry closed');
    if (ok) dialog = null;
  }
</script>

<main class="content">
  <div class="page-head">
    <div><h1>Follow-ups</h1><p>People who aren’t ready for an assessment yet. Each one comes due after {FOLLOW_UP_DAYS} days and the contact person gets a reminder. Schedule the assessment when they’re ready.</p></div>
  </div>

  <section class="fu-stats">
    <div class="stat hero"><div class="label">Due now</div><div class="value num">{due.length}</div><div class="note">{overdue.length} of them late</div></div>
    <div class="stat"><div class="label">Waiting</div><div class="value num">{rows.length}</div><div class="note">people in follow-up</div></div>
    <div class="stat"><div class="label">Potential on hold</div><div class="value num">{money(followUpPotential(db))}</div><div class="note">per month, not in pipeline totals</div></div>
  </section>
  {#if error && !dialog}<p class="error" role="alert" style="margin-bottom: 12px">{error}</p>{/if}

  <div class="panel table-wrap">
    <table class="table cards">
      <thead><tr><th>Person</th><th>Who is inquiring</th><th>Follow up</th><th>Round</th><th>Note</th><th>Contact</th><th class="num">Potential</th><th></th></tr></thead>
      <tbody>
        {#each rows as item (item.id)}
          {@const w = when(item)}
          <tr class:highlight={args[0] === item.id}>
            <td class="lead-cell"><a href={`#/followups/${item.id}`} class="name">{item.name}</a><div class="faint" style="font-size: 12.5px">{item.program}{noPhone(item) ? ', message only' : ''}</div></td>
            <td data-label="Who is inquiring">{who(item)}</td>
            <td data-label="Follow up"><span class="pill {w.tone}">{w.text}</span><div class="faint" style="font-size: 12px; margin-top: 3px">{fmtDay(item.followUp.due)}</div></td>
            <td data-label="Round" class="num">{item.followUp.round}</td>
            <td data-label="Note" class="note-cell">{item.followUp.note || '—'}</td>
            <td data-label="Contact">{staffName(item.contactPerson)}</td>
            <td data-label="Potential" class="num">{money(item.potentialRevenue)}</td>
            <td>
              <div class="row" style="justify-content: flex-end; gap: 6px; flex-wrap: wrap">
                <button class="btn sm dark" onclick={() => run(state => moveInquiry(state, item.id, 'Assessment', me), `${item.name} moved to Assessment`)}>Schedule assessment</button>
                <button class="btn sm" onclick={() => { error = ''; dialog = { kind: 'again', id: item.id, name: item.name, days: FOLLOW_UP_DAYS, outcome: 'No answer', note: '' }; }}>Follow up again</button>
                <button class="btn sm ghost danger" onclick={() => { error = ''; dialog = { kind: 'close', id: item.id, name: item.name, reason: '' }; }}>Close</button>
              </div>
            </td>
          </tr>
        {:else}
          <tr><td colspan="8"><div class="empty"><strong>Nobody is waiting for a follow-up</strong>Use “Follow up later” on an inquiry that isn’t ready for an assessment.</div></td></tr>
        {/each}
      </tbody>
    </table>
  </div>
</main>

{#if args[0] && args[1] === 'open'}<InquiryDrawer id={args[0]} onclose={() => go('followups')} />{/if}

{#if dialog}
  <div class="scrim" onclick={() => { dialog = null; }} aria-hidden="true"></div>
  <form class="dialog" use:dialogFocus={{ onClose: () => { dialog = null; } }} onsubmit={event => { event.preventDefault(); save(); }}>
    <header class="drawer-head"><div class="grow"><h2>{dialog.kind === 'again' ? 'Follow up again' : 'Close inquiry'}</h2><p class="muted" style="margin-top: 4px">{dialog.name}</p></div></header>
    <div class="drawer-body stack">
      {#if dialog.kind === 'again'}
        <fieldset class="field"><legend>How did this follow-up go?</legend><div class="choices" style="margin-top: 6px">{#each CALL_OUTCOMES as outcome}<label class="choice"><input type="radio" name="out" value={outcome} bind:group={dialog.outcome} /><span>{outcome}</span></label>{/each}</div></fieldset>
        <div class="grid-2"><label class="field"><span>Next follow-up in <span class="hint">days</span></span><input class="input" type="number" min="1" max="60" bind:value={dialog.days} /></label><label class="field"><span>Note</span><input class="input" bind:value={dialog.note} /></label></div>
      {:else}
        <label class="field"><span>Why is this inquiry closing?</span><input class="input" bind:value={dialog.reason} placeholder="For example: went to another centre" /></label>
      {/if}
      {#if error}<p class="error" role="alert">{error}</p>{/if}
    </div>
    <footer class="drawer-foot"><button class="btn" type="button" onclick={() => { dialog = null; }}>Cancel</button><button class="btn primary" type="submit">Save</button></footer>
  </form>
{/if}

<style>
  .fu-stats { display: grid; grid-template-columns: 1.2fr 1fr 1fr; gap: 14px; margin-bottom: 22px; }
  .name { font-weight: 800; color: var(--text); font-size: 15px; }
  .note-cell { max-width: 280px; color: var(--text-2); }
  tr.highlight td { background: var(--leaf); }
  @media (max-width: 900px) { .fu-stats { grid-template-columns: 1fr 1fr; } .fu-stats .hero { grid-column: span 2; } }
</style>
