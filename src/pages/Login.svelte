<script>
  import { STAFF, RESIDENTS } from '../lib/people.js';
  import { signIn } from '../lib/backend.svelte.js';

  const teams = [...new Set(STAFF.map(person => person.team))];
  let staffId = $state('');
  let password = $state('');
  let error = $state('');
  let busy = $state(false);

  async function submit(event) {
    event.preventDefault();
    error = '';
    if (!staffId) { error = 'Choose your name.'; return; }
    busy = true;
    try { await signIn(staffId, password); password = ''; } catch (e) { error = e.message; } finally { busy = false; }
  }
</script>

<main class="login">
  <form class="panel login-card" onsubmit={submit}>
    <img class="logo" src="/logo.png" alt="Cedar Rehab" width="640" height="531" />
    <h1>Sign in</h1>
    <p class="muted">Staff workspace. Your own name and password; nobody else's.</p>
    <label class="field"><span>Name</span>
      <select class="select" name="staff" bind:value={staffId} autocomplete="username">
        <option value="">Choose your name</option>
        {#each teams as team}
          <optgroup label={team}>{#each STAFF.filter(person => person.team === team) as person}<option value={person.id}>{person.name}, {person.title}</option>{/each}</optgroup>
        {/each}
        <optgroup label="Residents">{#each RESIDENTS as person}<option value={person.id}>{person.name}</option>{/each}</optgroup>
      </select>
    </label>
    <label class="field"><span>Password</span><input class="input" type="password" bind:value={password} autocomplete="current-password" /></label>
    {#if error}<p class="error" role="alert">{error}</p>{/if}
    <button class="btn primary" type="submit" disabled={busy}>{busy ? 'Signing in…' : 'Sign in'}</button>
    <p class="faint" style="font-size: 12.5px; margin: 0">Forgotten your password? Ask Amer to set a new one.</p>
  </form>
</main>

<style>
  .login { min-height: 100vh; display: grid; place-items: center; padding: 24px 16px; background: var(--sidebar); }
  .login-card { width: min(420px, 100%); display: flex; flex-direction: column; gap: 14px; padding: 28px 26px; }
  .logo { width: 120px; height: auto; align-self: center; }
  h1 { font-size: 24px; font-weight: 800; letter-spacing: -0.02em; margin: 4px 0 0; }
  .muted { margin: -6px 0 4px; }
</style>
