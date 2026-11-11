<script>
  import Icon from './Icon.svelte';
  import SignaturePad from './SignaturePad.svelte';
  import DictatePanel from './DictatePanel.svelte';
  import CaseReviewPrep from './CaseReviewPrep.svelte';
  import { dialogFocus } from '../lib/dialogFocus.js';
  import { db, session, commit } from '../lib/store.svelte.js';
  import { formById, prefillValues, computeAuto, isSectionLocked, isRequired, fileForm, signLater, appendRow, progressSummary, allFields, riskLevel } from '../lib/forms/engine.js';
  import { staffName } from '../lib/people.js';
  import { fmtDate, fmtDateTime } from '../lib/dates.js';
  import { say } from '../lib/ui.svelte.js';

  let { formId, entryId = null, patientId = null, appointmentId = null, onclose } = $props();
  const FAMILY = { clinical: 'Clinical', fitness: 'Physical therapy & fitness', medical: 'Nursing & medical' };

  const form = formById(formId);
  let currentId = $state(entryId);
  const entry = $derived(db.forms.find(item => item.id === currentId));
  const patient = $derived(db.patients.find(item => item.id === (entry?.patientId || patientId)));
  const appointment = db.appointments.find(item => item.id === (appointmentId || db.forms.find(f => f.id === entryId)?.appointmentId));
  const initial = db.forms.find(item => item.id === entryId);
  let values = $state(initial ? structuredClone($state.snapshot(initial.values)) : prefillValues(form, { state: db, patient: db.patients.find(item => item.id === patientId), appointment, staffId: session.staffId }));
  let errors = $state([]);
  let signing = $state(null);
  let draftRow = $state({});
  // Fields Cedar Assist filled in; each stays marked until a person edits it.
  let drafted = $state([]);

  const me = session.staffId;
  const filed = $derived(entry?.status === 'Filed');
  const canEdit = $derived(form.owners.includes(me) && (!filed || form.living));
  const shown = $derived(computeAuto(form, values));
  const summary = $derived(formId === 'progress' && patient ? progressSummary(db, patient.id) : null);
  // Form 1: a Medium or High rating carries into the treatment plan and every session note until reviewed down.
  const carriedRisk = $derived(['session', 'plan'].includes(formId) && patient ? riskLevel(db, patient.id) : null);
  const assistOpen = $derived(canEdit && !filed);
  function applyDraft({ values: draft, filled }) {
    for (const [key, value] of Object.entries(draft)) if (value !== undefined && (Array.isArray(value) ? value.length : value !== '')) values[key] = value;
    drafted = filled;
  }
  const touched = id => { if (drafted.includes(id)) drafted = drafted.filter(item => item !== id); };
  const pendingSignatures = $derived(filed ? allFields(form).filter(field => field.type === 'signature' && field.later && !entry.values[field.id]?.at) : []);

  const editable = section => canEdit && (!section?.editors || section.editors.includes(me));
  const canSign = (field, section) => editable(section) && (!field.signer || field.signer.includes(me));
  const isPatientLine = field => /patient/i.test(field.label);
  const toggle = (id, option) => { const list = new Set(values[id] || []); list.has(option) ? list.delete(option) : list.add(option); values[id] = [...list]; };

  function save(final) {
    errors = [];
    try {
      const rows = values.attendance || values.patients;
      const patientIds = form.multi && Array.isArray(rows) ? rows.map(row => row.patientId).filter(Boolean) : undefined;
      const saved = commit(state => fileForm(state, { entryId: currentId, formId, patientId: form.multi ? null : patient?.id, patientIds, appointmentId: appointment?.id, values: $state.snapshot(values), staffId: me, final }));
      currentId = saved.id;
      say(final ? (form.living ? 'Saved' : `${form.title} filed`) : 'Draft saved');
      if (final && !form.living) onclose();
    } catch (error) {
      errors = error.message.split(/(?<=\.)\s+/);
    }
  }

  function signed(signature) {
    const { field } = signing;
    signing = null;
    if (filed && field.later) {
      try { commit(state => signLater(state, currentId, field.id, signature, me)); say('Signed'); } catch (error) { errors = [error.message]; }
    } else {
      values[field.id] = { ...signature, by: me };
    }
  }

  function addReview(field) {
    try {
      commit(state => appendRow(state, currentId, field.id, $state.snapshot(draftRow), me));
      draftRow = {};
      say('Review entry added');
    } catch (error) { errors = [error.message]; }
  }

  async function photo(event, id) {
    const file = event.currentTarget.files?.[0];
    if (!file) return;
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, 900 / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(bitmap.width * scale); canvas.height = Math.round(bitmap.height * scale);
    canvas.getContext('2d').drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    values[id] = canvas.toDataURL('image/jpeg', 0.72);
  }
</script>

{#snippet signatureLine(field, section)}
  {@const value = (filed ? entry.values : values)[field.id]}
  {#if value?.at}
    <div class="sig">
      {#if value.image}<img src={value.image} alt={`Signature of ${value.name}`} />{/if}
      <span><strong>{value.name}</strong><span class="faint">Signed {fmtDateTime(value.at)}{value.by && value.name !== staffName(value.by) ? `, captured by ${staffName(value.by)}` : ''}</span></span>
      {#if !filed && canSign(field, section)}<button class="btn ghost sm" type="button" onclick={() => { values[field.id] = undefined; }}>Remove</button>{/if}
    </div>
  {:else if (filed ? field.later && (!field.signer || field.signer.includes(me)) : canSign(field, section))}
    <button class="btn sm" type="button" onclick={() => { signing = { field }; }}><Icon name="pen" size={15} />{field.signer ? `Sign as ${staffName(me)}` : isPatientLine(field) ? 'Capture patient signature' : 'Sign'}</button>
  {:else}
    <span class="faint">{field.signer ? `Awaiting ${field.signer.map(staffName).join(' or ')}` : 'Not signed'}</span>
  {/if}
{/snippet}

{#snippet control(field, section)}
  {@const locked = !editable(section) || field.readonly}
  {@const value = shown[field.id]}
  {#if field.type === 'signature'}
    {@render signatureLine(field, section)}
  {:else if locked && field.type !== 'table'}
    {#if Array.isArray(value)}<div class="choices">{#each value as item}<span class="pill">{item}</span>{:else}<span class="faint">—</span>{/each}</div>
    {:else if field.type === 'photo'}{#if value}<img src={value} alt={field.label} style="max-width: 280px; border-radius: 8px" />{:else}<span class="faint">No photo</span>{/if}
    {:else if field.type === 'date'}<span>{value ? fmtDate(value, { day: 'numeric', month: 'short', year: 'numeric' }) : '—'}</span>
    {:else}<span class="readonly-value">{value === undefined || value === '' ? '—' : `${value}${field.unit ? ` ${field.unit}` : ''}`}</span>{/if}
  {:else if field.type === 'text'}
    <input class="input" bind:value={values[field.id]} />
  {:else if field.type === 'notes'}
    <textarea class="textarea" rows="3" bind:value={values[field.id]}></textarea>
  {:else if field.type === 'number'}
    <div class="row"><input class="input" type="number" inputmode="decimal" min="0" style="max-width: 160px" bind:value={values[field.id]} />{#if field.unit}<span class="muted">{field.unit}</span>{/if}</div>
  {:else if field.type === 'date'}
    <input class="input" type="date" style="max-width: 200px" bind:value={values[field.id]} />
  {:else if field.type === 'time'}
    <input class="input" type="time" style="max-width: 140px" bind:value={values[field.id]} />
  {:else if field.type === 'auto'}
    <span class="readonly-value">{value === '' || value === undefined ? '—' : value}</span>
  {:else if field.type === 'one' || field.type === 'lmh' || field.type === 'scale5'}
    {@const options = field.type === 'lmh' ? ['Low', 'Medium', 'High'] : field.type === 'scale5' ? [1, 2, 3, 4, 5] : field.options}
    <div class="choices" role="radiogroup" aria-label={field.label}>
      {#each options as option}
        <label class={`choice ${field.type === 'lmh' ? `risk-${option}` : ''}`}><input type="radio" name={`${formId}-${field.id}`} value={option} checked={values[field.id] === option} onclick={() => { values[field.id] = values[field.id] === option ? undefined : option; }} /><span>{option}</span></label>
      {/each}
    </div>
  {:else if field.type === 'all'}
    <div class="choices" role="group" aria-label={field.label}>
      {#each field.options as option}
        <label class="choice"><input type="checkbox" checked={(values[field.id] || []).includes(option)} onchange={() => toggle(field.id, option)} /><span>{option}</span></label>
      {/each}
    </div>
  {:else if field.type === 'photo'}
    <div class="stack" style="gap: 8px">
      {#if values[field.id]}<img src={values[field.id]} alt={field.label} style="max-width: 280px; border-radius: 8px" />{/if}
      <label class="btn sm" style="width: max-content"><Icon name="camera" size={15} />{values[field.id] ? 'Replace photo' : 'Take or attach photo'}<input type="file" accept="image/*" capture="environment" class="sr-only" onchange={event => photo(event, field.id)} /></label>
    </div>
  {:else if field.type === 'table'}
    {@render table(field, section)}
  {/if}
{/snippet}

{#snippet table(field, section)}
  {@const rows = (filed && !form.living ? entry.values : values)[field.id] || []}
  {@const writable = editable(section) && !(filed && !form.living)}
  <div class="table-wrap form-table">
    <table class="table">
      <thead><tr>{#each field.columns as column}<th>{column.label}</th>{/each}</tr></thead>
      <tbody>
        {#each rows as row, index}
          <tr>
            {#each field.columns as column}
              <td>
                {#if !writable || column.readonly}
                  {column.type === 'check' ? (row[column.id] ? 'Yes' : 'No') : column.type === 'date' && row[column.id] ? fmtDate(row[column.id]) : row[column.id] || '—'}
                {:else if column.type === 'check'}
                  <input type="checkbox" aria-label={`${column.label}, row ${index + 1}`} bind:checked={values[field.id][index][column.id]} />
                {:else if column.type === 'one'}
                  <select class="select" aria-label={column.label} bind:value={values[field.id][index][column.id]}><option value="">—</option>{#each column.options as option}<option>{option}</option>{/each}</select>
                {:else}
                  <input class="input" type={['date', 'time', 'number'].includes(column.type) ? column.type : 'text'} aria-label={column.label} bind:value={values[field.id][index][column.id]} />
                {/if}
              </td>
            {/each}
          </tr>
        {:else}
          <tr><td colspan={field.columns.length} class="faint">No entries yet.</td></tr>
        {/each}
        {#if field.appendable && filed && form.owners.includes(me)}
          <tr class="append-row">
            {#each field.columns as column}
              <td><input class="input" type={['date', 'time', 'number'].includes(column.type) ? column.type : 'text'} aria-label={`New ${column.label}`} bind:value={draftRow[column.id]} /></td>
            {/each}
          </tr>
        {/if}
      </tbody>
    </table>
  </div>
  {#if field.appendable && filed && form.owners.includes(me)}
    <button class="btn sm" type="button" style="margin-top: 8px" onclick={() => addReview(field)}><Icon name="plus" size={15} />Add review entry</button>
  {:else if writable && !field.fixedRows && !field.prefill}
    <button class="btn ghost sm" type="button" style="margin-top: 8px" onclick={() => { values[field.id] = [...(values[field.id] || []), {}]; }}><Icon name="plus" size={15} />Add row</button>
  {/if}
{/snippet}

<div class="scrim" onclick={onclose} aria-hidden="true"></div>
<section class="drawer wide form-drawer" use:dialogFocus={{ onClose: onclose }}>
  <header class="drawer-head">
    <div class="grow">
      <p class="faint" style="font-size: 12px; margin-bottom: 2px">{FAMILY[form.family]} form {form.number}{form.sop ? ` · SOP ${form.sop}` : ''}</p>
      <h2>{form.title}</h2>
      <p class="muted" style="margin-top: 6px; max-width: 70ch">{form.purpose}</p>
    </div>
    {#if entry}<span class="pill {filed ? 'ok' : 'warn'}">{filed ? (form.living ? 'Saved' : 'Filed') : 'Draft'}</span>{/if}
    <button class="btn ghost icon" aria-label="Close" data-autofocus onclick={onclose}><Icon name="close" /></button>
  </header>

  <div class="drawer-body">
    {#if form.family === 'clinical'}
      <p class="confidential"><Icon name="lock" size={14} />Confidential clinical record. It never enters the CRM, the admin file, or family communication.</p>
    {:else if form.family === 'medical'}
      <p class="confidential"><Icon name="lock" size={14} />Medical record, held by the Head Nurse. It never enters the CRM or the admin file.</p>
    {/if}

    {#if carriedRisk === 'Medium' || carriedRisk === 'High'}
      <p class="notice {carriedRisk === 'High' ? 'urgent' : 'warn'}" style="margin-top: 10px"><Icon name="alert" size={16} /><span><strong>{carriedRisk} risk</strong> carried from the intake assessment. Any new disclosure goes to Ahmed the same day.</span></p>
    {/if}
    {#if assistOpen && formId === 'session'}<DictatePanel ondraft={applyDraft} />{/if}
    {#if assistOpen && formId === 'review'}<CaseReviewPrep onapply={prep => { values.patients = prep.rows; values.highRisk = prep.highRisk; drafted = ['patients', 'highRisk']; }} />{/if}

    <div class="form-header">
      {#each form.header as field (field.id)}
        <div class="field"><span>{field.label}</span>{@render control(field, null)}</div>
      {/each}
    </div>

    {#if summary}
      <div class="auto-note">
        <strong>From other forms</strong>
        <span>Attendance {summary.attendancePct ?? '—'}{summary.attendancePct !== null ? '%' : ''}</span>
        <span>Wellbeing average {summary.wellbeingAvg ?? '—'}</span>
        <span>BMI {summary.bmi.at(-1) ?? '—'}</span>
        <span>Injuries {summary.injuries}</span>
      </div>
    {/if}

    {#each form.sections as section, index (index)}
      {@const locked = isSectionLocked(section, filed && !form.living ? entry.values : values)}
      <section class="form-section" class:locked>
        {#if section.title}
          <div class="form-section-head"><h3>{section.title}</h3>{#if section.by}<span class="faint">{section.by}</span>{/if}</div>
        {/if}
        {#if locked}
          <p class="lock-note"><Icon name="lock" size={15} />{section.gate.label}</p>
        {:else}
          {#each section.fields as field (field.id)}
            <div class="form-row" class:table-row={field.type === 'table'} class:drafted={drafted.includes(field.id)} oninput={() => touched(field.id)} onchange={() => touched(field.id)} onclick={event => { if (event.target.matches('input[type=radio], input[type=checkbox]')) touched(field.id); }} role="presentation">
              {#if field.type !== 'table' || section.fields.length > 1}
                <div class="form-label">
                  <span>{field.label}{#if canEdit && isRequired(field, values) && field.type !== 'signature'}<span class="req" aria-label="required">*</span>{/if}</span>
                  {#if field.hint}<small>{field.hint}</small>{/if}
                  {#if drafted.includes(field.id)}<span class="drafted-tag">Drafted, please check</span>{/if}
                </div>
              {/if}
              <div class="form-control">{@render control(field, section)}</div>
            </div>
          {/each}
        {/if}
      </section>
    {/each}

    {#if form.rule}<p class="form-rule">{form.rule}</p>{/if}
    {#if entry}<p class="faint" style="font-size: 12px; margin-top: 16px">Started by {staffName(entry.createdBy)} {fmtDateTime(entry.createdAt)}{entry.filedAt ? `. Filed by ${staffName(entry.filedBy)} ${fmtDateTime(entry.filedAt)}.` : '.'}</p>{/if}
  </div>

  <footer class="drawer-foot" style="align-items: center">
    {#if errors.length}<p class="error" role="alert" style="margin-right: auto">{errors[0]}{errors.length > 1 ? ` (+${errors.length - 1} more)` : ''}</p>{/if}
    {#if canEdit}
      {#if form.living}
        <button class="btn primary" onclick={() => save(true)}>Save</button>
      {:else}
        <button class="btn" onclick={() => save(false)}>Save draft</button>
        <button class="btn primary" onclick={() => save(true)}><Icon name="check" size={16} />Sign &amp; file</button>
      {/if}
    {:else}
      {#if pendingSignatures.length}<span class="faint" style="margin-right: auto">Awaiting {pendingSignatures.map(field => field.label).join(', ')}</span>{/if}
      <button class="btn" onclick={onclose}>Close</button>
    {/if}
  </footer>
</section>

{#if signing}
  <SignaturePad title={signing.field.label} signerName={isPatientLine(signing.field) ? patient?.fullName || '' : staffName(me)} onsign={signed} onclose={() => { signing = null; }} />
{/if}
