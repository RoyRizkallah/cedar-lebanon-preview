<script>
  import Icon from '../Icon.svelte';
  import { session, commit } from '../../lib/store.svelte.js';
  import { CONTACT_RELATIONS, addContact, updateContact, removeContact, emergencyContact } from '../../lib/contacts.js';
  import { canDo } from '../../lib/people.js';
  import { say } from '../../lib/ui.svelte.js';

  // Who to call, who may hear about treatment, who may visit. Everyone on the team can see this; RSAs need it most.
  let { patient } = $props();
  const me = session.staffId;
  const manage = canDo(me, 'manageContacts');
  const contacts = $derived(patient.contacts || []);
  let editing = $state(null);
  let error = $state('');
  const blank = () => ({ id: '', name: '', relation: 'Parent', phone: '', emergency: !emergencyContact(patient), canDiscuss: false, canVisit: true });

  function run(action, message) {
    error = '';
    try { commit(action); say(message); return true; } catch (e) { error = e.message; return false; }
  }
  function save() {
    const fields = $state.snapshot(editing);
    const ok = fields.id
      ? run(state => updateContact(state, patient.id, fields.id, fields, me), 'Contact saved')
      : run(state => addContact(state, patient.id, fields, me), `${fields.name} added`);
    if (ok) editing = null;
  }
</script>

<section class="panel">
  <div class="panel-head"><h3>Contacts</h3>{#if manage && !editing}<button class="btn sm" onclick={() => { error = ''; editing = blank(); }}><Icon name="plus" size={14} />Add contact</button>{/if}</div>
  {#if !emergencyContact(patient) && patient.status === 'Admitted'}<p class="notice warn" style="margin: 0 18px 8px"><Icon name="alert" size={15} />No emergency contact yet.</p>{/if}
  <ul class="people">
    {#each contacts as contact (contact.id)}
      <li>
        <div class="grow">
          <strong>{contact.name}</strong><span class="faint"> · {contact.relation}</span>
          <div class="tags">
            {#if contact.emergency}<span class="pill urgent">Emergency</span>{/if}
            <span class="pill" class:ok={contact.canDiscuss}>{contact.canDiscuss ? 'May hear about treatment' : 'No treatment details'}</span>
            {#if contact.canVisit}<span class="pill">Approved visitor</span>{/if}
          </div>
        </div>
        <a class="btn sm" href={`tel:${contact.phone.replace(/\s/g, '')}`}><Icon name="phone" size={14} />{contact.phone}</a>
        {#if manage}<button class="btn sm ghost icon" aria-label={`Edit ${contact.name}`} onclick={() => { error = ''; editing = { ...contact }; }}><Icon name="pen" size={14} /></button>{/if}
      </li>
    {:else}<li class="faint">No contacts recorded.</li>{/each}
  </ul>
  {#if editing}
    <form class="edit stack" onsubmit={event => { event.preventDefault(); save(); }}>
      <div class="grid-3">
        <label class="field"><span>Name</span><input class="input" bind:value={editing.name} required /></label>
        <label class="field"><span>Relationship</span><select class="select" bind:value={editing.relation}>{#each CONTACT_RELATIONS as relation}<option>{relation}</option>{/each}</select></label>
        <label class="field"><span>Phone</span><input class="input" type="tel" bind:value={editing.phone} placeholder="+961 3 123 456" required /></label>
      </div>
      <div class="row wrap" style="gap: 14px">
        <label class="check"><input type="checkbox" bind:checked={editing.emergency} />Emergency contact</label>
        <label class="check"><input type="checkbox" bind:checked={editing.canDiscuss} />May hear about treatment (patient agreed)</label>
        <label class="check"><input type="checkbox" bind:checked={editing.canVisit} />Approved visitor</label>
      </div>
      {#if error}<p class="error" role="alert">{error}</p>{/if}
      <div class="row">
        <button class="btn primary sm" type="submit">{editing.id ? 'Save contact' : 'Add contact'}</button>
        <button class="btn ghost sm" type="button" onclick={() => { editing = null; }}>Cancel</button>
        {#if editing.id}<span class="grow"></span><button class="btn ghost danger sm" type="button" onclick={() => { if (run(state => removeContact(state, patient.id, editing.id, me), 'Contact removed')) editing = null; }}>Remove</button>{/if}
      </div>
    </form>
  {/if}
</section>

<style>
  .people { list-style: none; margin: 0; padding: 0 18px 10px; }
  .people li { display: flex; align-items: center; gap: 10px; padding: 8px 0; border-bottom: 1px solid var(--line); }
  .people li:last-child { border-bottom: 0; }
  .people strong { font-size: 14px; }
  .tags { display: flex; flex-wrap: wrap; gap: 4px; margin-top: 4px; }
  .tags .pill { height: 22px; font-size: 11px; }
  .edit { padding: 12px 18px 16px; border-top: 1px solid var(--line); }
  .check { display: inline-flex; align-items: center; gap: 6px; font-size: 13px; font-weight: 600; }
</style>
