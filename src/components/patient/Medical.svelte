<script>
  import Icon from '../Icon.svelte';
  import { db, session } from '../../lib/store.svelte.js';
  import { staffName, canDo, hasRole } from '../../lib/people.js';
  import { fmtDay, fmtDate, fmtDateTime } from '../../lib/dates.js';
  import { openFile } from '../../lib/files.js';

  let { patient, onform } = $props();
  const me = session.staffId;
  const seesPrescriptions = canDo(me, 'recordMedication') || hasRole(me, 'clinical-director');
  const clearance = $derived(db.forms.filter(entry => entry.formId === 'clearance' && entry.patientId === patient.id).at(-1));
  const nursing = $derived(db.appointments.filter(item => item.patientId === patient.id && ['Nursing appointment', 'Blood test'].includes(item.service) && item.status !== 'Cancelled').sort((a, b) => b.date.localeCompare(a.date)));
  const psychiatry = $derived(db.appointments.filter(item => item.patientId === patient.id && item.service === 'External psychiatrist' && item.status !== 'Cancelled').sort((a, b) => b.date.localeCompare(a.date)));
  const prescriptions = $derived(db.documents.filter(item => item.patientId === patient.id && item.type === 'Prescription').sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt))));
</script>

<div class="stack" style="gap: 20px">
  {#if patient.nursingNote}<p class="notice"><Icon name="stethoscope" size={15} />At admission, nursing noted: {patient.nursingNote}</p>{/if}
  <section class="panel">
    <div class="panel-head"><h3>Medical clearance for activity</h3>{#if clearance || hasRole(me, 'nurse', 'pt')}<button class="btn sm" onclick={() => onform('clearance', clearance?.id || null)}>{clearance ? 'Open' : 'Start'}</button>{/if}</div>
    <div class="panel-body">
      {#if !clearance}<p class="muted">Not assessed yet. Fadia completes gate one of the Physical Assessment & Activity Clearance form.</p>
      {:else}
        <p><span class="pill {clearance.values.medicallyCleared === 'Yes' ? 'ok' : clearance.values.medicallyCleared === 'No' ? 'urgent' : ''}">{clearance.values.medicallyCleared === 'Yes' ? 'Cleared' : clearance.values.medicallyCleared === 'No' ? 'Not cleared' : 'Pending'}</span>
          {#if clearance.values.limits?.length}<span class="muted"> Limits: {clearance.values.limits.join(', ')}.</span>{/if}
          {#if clearance.values.medicalReviewDate}<span class="faint"> Medical review {fmtDate(clearance.values.medicalReviewDate)}.</span>{/if}
        </p>
      {/if}
    </div>
  </section>

  <section class="panel">
    <div class="panel-head"><h3>Nursing and blood tests</h3>{#if me === 'fadia'}<a class="btn sm" href="#/schedule">Book</a>{/if}</div>
    <ul class="list">
      {#each nursing as item (item.id)}
        <li><div class="grow"><div class="title">{item.service}</div><div class="sub">{fmtDay(item.date)} at {item.start}</div></div><span class="pill {item.status === 'Completed' ? 'ok' : ''}">{item.status}</span></li>
      {:else}<li class="faint">None recorded.</li>{/each}
    </ul>
  </section>

  <section class="panel">
    <div class="panel-head"><h3>External psychiatrist</h3>{#if me === 'fadia'}<a class="btn sm" href="#/schedule">Record appointment</a>{/if}</div>
    <ul class="list">
      {#each psychiatry as item (item.id)}
        <li><div class="grow"><div class="title">{item.external?.psychiatrist}</div><div class="sub">{fmtDay(item.date)} at {item.start}. Arranged by {staffName(item.recordedBy || 'fadia')}.</div></div><span class="pill {item.status === 'Completed' ? 'ok' : ''}">{item.status}</span></li>
      {:else}<li class="faint">No psychiatrist appointments.</li>{/each}
    </ul>
  </section>

  {#if seesPrescriptions}
    <section class="panel">
      <div class="panel-head"><h3>Prescriptions</h3><span class="faint" style="font-size: 12.5px">Sent by the external psychiatrist to Fadia</span></div>
      <ul class="list">
        {#each prescriptions as item (item.id)}
          <li><Icon name="pill" /><div class="grow"><div class="title">{item.note || item.title}</div><div class="sub">Received {fmtDateTime(item.createdAt)} by {staffName(item.createdBy)}</div></div>
            {#if item.fileId}<button class="btn sm" onclick={() => openFile(item.fileId)}>Open file</button>{/if}</li>
        {:else}<li class="faint">No prescriptions received.</li>{/each}
      </ul>
    </section>
  {/if}
</div>
