<script>
  import Icon from '../Icon.svelte';
  import SignaturePad from '../SignaturePad.svelte';
  import { db, session, commit } from '../../lib/store.svelte.js';
  import { DOC_TYPES, SIGNED, addDocument, signDocument, attachScan, documentsFor } from '../../lib/documents.js';
  import { staffName, canDo } from '../../lib/people.js';
  import { fmtDateTime } from '../../lib/dates.js';
  import { putFile, openFile } from '../../lib/files.js';
  import { say } from '../../lib/ui.svelte.js';

  let { patient } = $props();
  const me = session.staffId;
  const manage = canDo(me, 'manageDocuments');
  const docs = $derived(documentsFor(db, patient.id).filter(item => me === 'fadia' ? ['Prescription', 'Consent'].includes(item.type) : true));
  let adding = $state(null);
  let signing = $state(null);
  let error = $state('');

  function run(action, message) {
    error = '';
    try { const result = commit(action); say(message); return result; } catch (e) { error = e.message; return null; }
  }
  async function upload(event, doc) {
    const file = event.currentTarget.files?.[0];
    if (!file) return;
    const stored = await putFile(file);
    run(state => attachScan(state, doc.id, { fileId: stored.id, fileName: stored.name }, me), 'Signed scan uploaded');
  }
  function create() {
    const doc = run(state => addDocument(state, { patientId: patient.id, ...$state.snapshot(adding) }, me), 'Document added. It is waiting for a signature.');
    if (doc) adding = null;
  }
</script>

<div class="row between" style="margin-bottom: 12px">
  <p class="muted">Signed on screen or uploaded as a signed scan. Every document stays linked to this patient.</p>
  {#if manage}<button class="btn primary" onclick={() => { adding = { type: 'Consent', title: '' }; }}><Icon name="plus" size={16} />Add document</button>{/if}
</div>

{#if adding}
  <form class="panel panel-body stack" style="margin-bottom: 14px" onsubmit={event => { event.preventDefault(); create(); }}>
    <div class="grid-2">
      <label class="field"><span>Type</span><select class="select" bind:value={adding.type}>{#each DOC_TYPES as type}<option>{type}</option>{/each}</select></label>
      <label class="field"><span>Title</span><input class="input" bind:value={adding.title} placeholder="For example: family contact consent" /></label>
    </div>
    <div class="row"><button class="btn dark" type="submit">Add, then sign or upload</button><button class="btn ghost" type="button" onclick={() => { adding = null; }}>Cancel</button></div>
  </form>
{/if}
{#if error}<p class="error" role="alert" style="margin-bottom: 10px">{error}</p>{/if}

<div class="panel table-wrap">
  <table class="table cards">
    <thead><tr><th>Document</th><th>Type</th><th>Status</th><th>Added</th><th></th></tr></thead>
    <tbody>
      {#each docs as doc (doc.id)}
        <tr>
          <td class="lead-cell"><strong>{doc.title}</strong>{#if doc.signedBy}<div class="faint" style="font-size: 12px">Signed by {doc.signedBy}{doc.signedAt ? `, ${fmtDateTime(doc.signedAt)}` : ''}</div>{/if}</td>
          <td data-label="Type">{doc.type}</td>
          <td data-label="Status"><span class="pill {SIGNED.includes(doc.status) || doc.status === 'Received' ? 'ok' : 'warn'}">{doc.status}</span></td>
          <td data-label="Added">{fmtDateTime(doc.createdAt)}, {staffName(doc.createdBy)}</td>
          <td>
            <div class="row" style="justify-content: flex-end; gap: 6px">
              {#if doc.signature}<img src={doc.signature} alt={`Signature of ${doc.signedBy}`} style="height: 28px" />{/if}
              {#if doc.fileId}<button class="btn sm" onclick={() => openFile(doc.fileId)}>Open file</button>{/if}
              {#if manage && doc.status === 'Awaiting signature'}
                <button class="btn sm dark" onclick={() => { signing = doc; }}><Icon name="pen" size={14} />Sign</button>
                <label class="btn sm"><Icon name="upload" size={14} />Scan<input class="sr-only" type="file" accept="image/*,application/pdf" capture="environment" onchange={event => upload(event, doc)} /></label>
              {/if}
            </div>
          </td>
        </tr>
      {:else}
        <tr><td colspan="5"><div class="empty"><strong>No documents yet</strong></div></td></tr>
      {/each}
    </tbody>
  </table>
</div>

{#if signing}
  <SignaturePad title={signing.title} signerName={patient.fullName} onclose={() => { signing = null; }} onsign={signature => { const doc = signing; signing = null; run(state => signDocument(state, doc.id, signature, me), `${doc.title} signed`); }} />
{/if}
