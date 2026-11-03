<script>
  import Icon from '../components/Icon.svelte';
  import FormView from '../components/FormView.svelte';
  import Overview from '../components/patient/Overview.svelte';
  import Clinical from '../components/patient/Clinical.svelte';
  import Medical from '../components/patient/Medical.svelte';
  import Fitness from '../components/patient/Fitness.svelte';
  import FollowUp from '../components/patient/FollowUp.svelte';
  import Documents from '../components/patient/Documents.svelte';
  import Wallet from '../components/patient/Wallet.svelte';
  import Journey from '../components/Journey.svelte';
  import DischargeDialog from '../components/DischargeDialog.svelte';
  import { db, session } from '../lib/store.svelte.js';
  import { tabsFor, canDo, canSeeTab, visiblePatients } from '../lib/people.js';
  import { riskLevel, onWatch, formById } from '../lib/forms/engine.js';
  import { daysBetween, todayISO, fmtDate } from '../lib/dates.js';
  import { noPhone } from '../lib/pipeline.js';
  import { emergencyContact } from '../lib/contacts.js';

  let { id, tab = 'overview', entry = '' } = $props();
  const me = session.staffId;
  const patient = $derived(db.patients.find(item => item.id === id));
  const allowed = $derived(!!patient && (visiblePatients(db, me, { includeDischarged: true }).some(item => item.id === id)));
  const tabs = tabsFor(me);
  const current = $derived(tabs.some(item => item.id === tab) ? tab : 'overview');
  const risk = $derived(patient && canDo(me, 'viewRisk') ? riskLevel(db, patient.id) : null);
  const day = $derived(patient ? daysBetween(patient.admittedAt, patient.dischargedAt || todayISO(session.now)) + 1 : 0);
  const panels = { overview: Overview, clinical: Clinical, medical: Medical, fitness: Fitness, followup: FollowUp, documents: Documents, wallet: Wallet };

  // A link can open one filed form directly: #/patients/<id>/<tab>/<form entry id>.
  // The link obeys the same tab rules: Admin can never open a clinical form this way.
  const tabOf = formId => formId === 'aftercare' ? 'followup' : formById(formId)?.family;
  const linked = db.forms.find(item => item.id === entry && (item.patientId === id || item.patientIds?.includes(id)) && canSeeTab(me, tabOf(item.formId)));
  let form = $state(linked ? { formId: linked.formId, entryId: linked.id, patientId: id } : null);
  const openForm = (formId, entryId = null, extra = {}) => { form = { formId, entryId, patientId: id, ...extra }; };
  let discharging = $state(false);
</script>

{#if !allowed}
  <main class="content"><div class="panel empty"><strong>Patient not available</strong>This file is not in your list. <a href="#/patients">Back to patients</a></div></main>
{:else}
  {@const Panel = panels[current]}
  <main class="content">
    <section class="banner">
      <a href="#/patients" class="back"><Icon name="chevron-left" size={15} />Admitted patients</a>
      <div class="banner-main">
        <span class="avatar lime portrait">{patient.fullName.split(' ').map(part => part[0]).slice(0, 2).join('')}</span>
        <div class="grow">
          <h1>{current === 'clinical' ? patient.clinicalName : patient.fullName}</h1>
          <div class="chips">
            <span class="chip">{patient.program}</span>
            {#if patient.roomId}<span class="chip">Room {patient.roomId}, bed {patient.bed}</span>{/if}
            <span class="chip">{patient.status === 'Discharged' ? `Discharged ${fmtDate(patient.dischargedAt)}` : `Day ${day} of stay`}</span>
            {#if patient.status === 'Discharged'}<span class="chip">{patient.dischargeType ? `${patient.dischargeType}, after` : 'After'} {day - 1} days</span>{/if}
            {#if risk}<span class="chip risk-{risk}" title="Latest risk rating">{risk} risk</span>
            {:else if patient.status === 'Admitted' && onWatch(db, patient.id)}<span class="chip warn" title="Extra care: ask the clinical team before leave or changes"><Icon name="alert" size={13} />On watch</span>{/if}
            {#if patient.status === 'Admitted' && !emergencyContact(patient)}<span class="chip warn"><Icon name="alert" size={13} />No emergency contact</span>{/if}
            {#if noPhone(patient)}<span class="chip warn"><Icon name="phone-off" size={13} />No phone calls</span>{/if}
          </div>
        </div>
        {#if patient.status === 'Admitted' && canDo(me, 'discharge')}<button class="btn dark sm" onclick={() => { discharging = true; }}><Icon name="door" size={14} /><span>Discharge</span></button>{/if}
        {#if canDo(me, 'viewTherapyBookings')}<div class="journey-box"><Journey {patient} /></div>{/if}
      </div>
    </section>

    {#if tab !== current}<p class="notice" style="margin-bottom: 10px"><Icon name="lock" size={15} />That section of the file isn't open to you, so this is the overview.</p>{/if}
    <nav class="tabs patient-tabs" aria-label="Patient sections">
      {#each tabs as item (item.id)}
        <a class="tab-link" href={`#/patients/${id}/${item.id}`} aria-current={current === item.id ? 'page' : undefined}>{item.label}</a>
      {/each}
    </nav>

    <Panel {patient} onform={openForm} />
  </main>
{/if}

{#if form}{#key form}<FormView {...form} onclose={() => { form = null; }} />{/key}{/if}
{#if discharging && patient}<DischargeDialog {patient} onclose={() => { discharging = false; }} />{/if}

<style>
  .banner { position: relative; overflow: hidden; isolation: isolate; padding: 15px 21px 20px; margin-bottom: 12px; border-radius: 20px; background: linear-gradient(115deg, var(--paper) 0%, var(--paper) 45%, var(--leaf) 100%); box-shadow: var(--shadow-1); }
  .banner::after { content: ""; position: absolute; z-index: -1; right: -100px; top: -140px; width: 420px; height: 420px; border-radius: 50%; background: radial-gradient(circle, rgb(124 252 0 / 0.2), transparent 65%); }
  .back { display: inline-flex; align-items: center; gap: 4px; font-size: 13px; font-weight: 650; color: var(--text-3); margin-bottom: 14px; }
  .banner-main { display: flex; align-items: center; gap: 15px; flex-wrap: wrap; }
  .portrait { width: 84px; height: 84px; font-size: 20px; box-shadow: 0 0 0 6px var(--paper), 0 12px 30px rgb(80 160 0 / 0.25); }
  .banner h1 { font-size: 30px; font-weight: 800; letter-spacing: -0.04em; }
  .chips { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 10px; }
  .chip { display: inline-flex; align-items: center; gap: 5px; height: 30px; padding: 0 10px; border-radius: 15px; background: var(--paper); box-shadow: var(--shadow-1); font-size: 12.5px; font-weight: 700; color: var(--text-2); }
  .chip.risk-High { background: var(--urgent-soft); color: var(--urgent); box-shadow: none; }
  .chip.risk-Medium, .chip.warn { background: var(--warn-soft); color: var(--warn); box-shadow: none; }
  .chip.risk-Low { background: var(--ok-soft); color: var(--ok); box-shadow: none; }
  .journey-box { width: min(420px, 100%); padding: 11px 13px; border-radius: 15px; background: var(--paper); box-shadow: var(--shadow-1); }
  .patient-tabs { margin-bottom: 14px; padding: 6px; border-radius: 16px; background: var(--sunk); width: max-content; max-width: 100%; }
  @media (max-width: 700px) { .banner { padding: 13px 13px 15px; } .banner h1 { font-size: 22px; } .portrait { width: 60px; height: 60px; font-size: 19px; } }
</style>
