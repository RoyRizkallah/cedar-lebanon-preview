<script>
  import { act } from '../lib/act.js';
  import Icon from './Icon.svelte';
  import { db, session } from '../lib/store.svelte.js';
  import { DISCHARGE_TYPES, dischargePatient, dischargePreview, dischargeDay } from '../lib/discharge.js';
  import { formatCents } from '../lib/wallet.js';
  import { placeLabel } from '../lib/admission.js';
  import { todayISO, fmtDay } from '../lib/dates.js';
  import { dialogFocus } from '../lib/dialogFocus.js';
  import { say } from '../lib/ui.svelte.js';

  let { patient, onclose } = $props();
  const me = session.staffId;
  const today = todayISO(session.now);
  const plan = db.forms.filter(entry => entry.formId === 'discharge' && entry.patientId === patient.id && entry.status === 'Filed').at(-1);
  let date = $state(dischargeDay(db, patient.id) && dischargeDay(db, patient.id) < today ? dischargeDay(db, patient.id) : today);
  let type = $state(plan?.values.dischargeType || (plan ? 'Planned' : 'Self-discharge'));
  let note = $state('');
  let error = $state('');
  const p = $derived(dischargePreview(db, patient.id, date));

  function confirm() {
    error = '';
    try {
      act('dischargePatient', patient.id, { date, type, note });
      say(`${patient.clinicalName} discharged`);
      onclose();
    } catch (e) { error = e.message; }
  }
</script>

<div class="scrim" onclick={onclose} aria-hidden="true"></div>
<form class="dialog" use:dialogFocus={{ onClose: onclose }} onsubmit={event => { event.preventDefault(); confirm(); }}>
  <header class="drawer-head"><div class="grow"><h2>Discharge {patient.fullName}</h2><p class="muted" style="margin-top: 4px">{plan ? `Plan filed for ${fmtDay(plan.values.dischargeDate)}.` : 'No discharge plan is filed yet.'}</p></div></header>
  <div class="drawer-body stack">
    {#if plan && !(plan.values.directorSignature?.at || plan.values.ahmedSignature?.at)}<p class="notice warn"><Icon name="pen" size={16} />Waiting for Ahmed to sign off the plan. He finds it under Sign on his Today page.</p>{/if}
    {#if !plan}<p class="notice warn"><Icon name="alert" size={16} />Nabila, Samar or Ahmed files the Discharge &amp; Aftercare Plan first. Only a self-discharge can go ahead without it.</p>{/if}
    <div class="grid-2">
      <label class="field"><span>Leaving on</span><input class="input" type="date" bind:value={date} max={today} required /></label>
      <label class="field"><span>Kind of discharge</span><select class="select" bind:value={type}>{#each DISCHARGE_TYPES as option}<option>{option}</option>{/each}</select></label>
    </div>
    <label class="field"><span>Note <span class="hint">optional</span></span><input class="input" bind:value={note} placeholder="For example: left with his brother at 11:00" /></label>
    <div class="follows">
      <p class="label">What happens when you confirm</p>
      <ul>
        <li><Icon name="bed" size={15} />{p.room ? `${placeLabel(db, p.room, p.bed)} is freed` : 'No bed to free'}</li>
        <li><Icon name="heart" size={15} />{p.program ? `${p.program} ends` : 'Not on a program'}{p.sessions ? `; ${p.sessions} booked sessions are cancelled` : ''}</li>
        <li><Icon name="wallet" size={15} />{p.walletCents ? `${formatCents(p.walletCents)} wallet balance is returned to the family` : 'Wallet is empty'}</li>
        <li><Icon name="receipt" size={15} />Rabih is asked for the final bill{p.owed ? `; $${p.owed.toLocaleString('en-US')} is still open` : ''}</li>
        <li><Icon name="phone" size={15} />Aftercare calls are booked for Melyssa at 1 week, 1 month and 3 months</li>
      </ul>
    </div>
    {#if error}<p class="error" role="alert">{error}</p>{/if}
  </div>
  <footer class="drawer-foot"><button class="btn" type="button" onclick={onclose}>Cancel</button><button class="btn primary" type="submit"><Icon name="door" size={16} />Discharge</button></footer>
</form>

<style>
  .follows { padding: 12px 14px; border-radius: 14px; background: var(--subtle); box-shadow: inset 0 0 0 1px var(--line); }
  .follows .label { margin: 0 0 6px; font-size: 12.5px; font-weight: 750; color: var(--text-2); }
  .follows ul { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 6px; }
  .follows li { display: flex; align-items: center; gap: 8px; font-size: 13px; }
  .follows li :global(svg) { color: var(--moss); flex: none; }
</style>
