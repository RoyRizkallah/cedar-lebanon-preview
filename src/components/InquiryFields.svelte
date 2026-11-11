<script>
  import { PROGRAMS, COMM_PREFS, SOURCES, DRUGS, RELATIONSHIPS, ROOM_PREFERENCES, ROOM_RATES, money } from '../lib/pipeline.js';
  import { STAFF } from '../lib/people.js';

  // `fields` is a $state object owned by the parent; inputs write straight into it.
  let { fields, disabled = false, compact = false } = $props();
  const contacts = STAFF.filter(person => ['melyssa', 'ahmed'].includes(person.id));
</script>

<div class="stack" style="gap: 18px">
  <fieldset class="grid-2" {disabled} style="border: 0; padding: 0; margin: 0">
    <label class="field span-all"><span>Name of the person who needs help</span><input class="input" bind:value={fields.name} required /></label>
    <label class="field"><span>Who is inquiring</span><select class="select" bind:value={fields.relationship}>{#each RELATIONSHIPS as relation}<option value={relation}>{relation === 'Self' ? 'The person themselves' : relation}</option>{/each}</select></label>
    {#if fields.relationship && fields.relationship !== 'Self'}
      <label class="field"><span>Their name</span><input class="input" bind:value={fields.callerName} placeholder="Who we are talking to" /></label>
    {:else}<span></span>{/if}
    <label class="field"><span>Phone</span><input class="input" type="tel" bind:value={fields.phone} /></label>
    <label class="field"><span>Email</span><input class="input" type="email" bind:value={fields.email} /></label>
    {#if !compact}
      <label class="field"><span>Came in through</span><select class="select" bind:value={fields.source}>{#each SOURCES as source}<option>{source}</option>{/each}</select></label>
      {#if fields.source === 'Referral'}<label class="field"><span>Referred by</span><input class="input" bind:value={fields.referrerName} placeholder="For example: Dr. Haddad, or a former patient" /></label>{/if}
    {/if}
    <label class="field"><span>Contact person</span><select class="select" bind:value={fields.contactPerson}>{#each contacts as person}<option value={person.id}>{person.name}</option>{/each}</select></label>
  </fieldset>

  <fieldset class="field" {disabled}>
    <legend>Communication preference</legend>
    <div class="choices" style="margin-top: 6px">
      {#each COMM_PREFS as pref}<label class="choice"><input type="radio" name="comm" value={pref} bind:group={fields.commPreference} /><span>{pref}</span></label>{/each}
    </div>
  </fieldset>

  <fieldset class="grid-2" {disabled} style="border: 0; padding: 0; margin: 0">
    <label class="field"><span>Program</span><select class="select" bind:value={fields.program}>{#each PROGRAMS as program}<option>{program}</option>{/each}</select></label>
    <label class="field"><span>Drug of choice</span><select class="select" bind:value={fields.drugOfChoice}><option value="">Not known yet</option>{#each DRUGS as drug}<option>{drug}</option>{/each}</select></label>
    {#if fields.drugOfChoice === 'Other'}<label class="field"><span>Which drug</span><input class="input" bind:value={fields.drugOther} placeholder="Type the drug" /></label>{/if}
    <label class="field"><span>Duration of use <span class="hint">years</span></span><input class="input" type="number" min="0" inputmode="numeric" bind:value={fields.yearsOfUse} /></label>
    {#each [['previousDetox', 'detoxDetail', 'Previous detox'], ['previousRehab', 'rehabDetail', 'Previous rehab']] as [key, detail, label] (key)}
      <fieldset class="field">
        <legend>{label}</legend>
        <div class="choices" style="margin-top: 6px">{#each ['Yes', 'No'] as option}<label class="choice"><input type="radio" name={key} value={option} bind:group={fields[key]} /><span>{option}</span></label>{/each}</div>
        {#if fields[key] === 'Yes'}<input class="input" style="margin-top: 6px" bind:value={fields[detail]} placeholder="Where and when" aria-label={`${label}: where and when`} />{/if}
      </fieldset>
    {/each}
    <label class="field"><span>Room wanted</span><select class="select" bind:value={fields.roomPreference} onchange={() => { if (!Number(fields.potentialRevenue)) fields.potentialRevenue = ROOM_RATES[fields.roomPreference] || ''; }}><option value="">Not discussed yet</option>{#each ROOM_PREFERENCES as room}<option value={room}>{room}, {money(ROOM_RATES[room])} a month</option>{/each}</select></label>
    <fieldset class="field">
      <legend>Urgency</legend>
      <div class="choices" style="margin-top: 6px">
        <label class="choice"><input type="radio" name="urgency" value="Normal" bind:group={fields.urgency} /><span>Normal</span></label>
        <label class="choice risk-High"><input type="radio" name="urgency" value="Urgent" bind:group={fields.urgency} /><span>Urgent</span></label>
      </div>
    </fieldset>
    <label class="field"><span>Potential revenue <span class="hint">USD, 0 if no offer yet</span></span><input class="input" type="number" min="0" step="100" inputmode="numeric" bind:value={fields.potentialRevenue} placeholder="0" /></label>
  </fieldset>

  {#if fields.urgency === 'Urgent'}
    <p class="pill urgent" style="height: auto; padding: 8px 12px; white-space: normal">Saving as urgent alerts Ahmed, the Clinical Director and the contact person in the app, by email and on WhatsApp.</p>
  {/if}
  {#if !compact}
    <label class="field"><span>Notes</span><textarea class="textarea" rows="3" bind:value={fields.notes}></textarea></label>
  {/if}
</div>
