<script>
  import Icon from './Icon.svelte';
  import CommandPalette from './CommandPalette.svelte';
  import { STAFF, RESIDENTS, staffById, canDo } from '../lib/people.js';
  import { session, switchStaff, resetData } from '../lib/store.svelte.js';
  import { say } from '../lib/ui.svelte.js';

  let { onmenu, unread = 0, onbell, title = '' } = $props();

  let palette = $state(false);
  let profileOpen = $state(false);
  const me = $derived(staffById(session.staffId));
  const teams = [...new Set(STAFF.map(person => person.team))];

  function globalKeys(event) {
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') { event.preventDefault(); palette = !palette; }
    if (event.key === 'Escape') profileOpen = false;
  }

  function choose(id) {
    profileOpen = false;
    switchStaff(id);
    say(`Now viewing as ${staffById(id).name}`);
  }
</script>

<svelte:window onkeydown={globalKeys} onclick={() => { profileOpen = false; }} />

<header class="topbar">
  <a class="phone-brand" href="#/" aria-label="Cedar Rehab home"><img src="/logo-mark.png" alt="" width="34" height="34" /></a>
  <strong class="phone-title">{title}</strong>
  <button class="btn icon icon-btn menu-btn" aria-label="Open navigation" onclick={onmenu}><Icon name="menu" /></button>
  <button class="search-trigger" onclick={() => { palette = true; }} aria-label="Search and quick actions">
    <Icon name="search" size={16} />
    <span class="grow">Search patients, inquiries, anything…</span>
    <kbd>Ctrl K</kbd>
  </button>

  <span class="spacer"></span>

  <button class="btn icon icon-btn bell" aria-label={`Notifications${unread ? `, ${unread} unread` : ''}`} onclick={onbell}>
    <Icon name="bell" />
    {#if unread}<span class="badge">{unread}</span>{/if}
  </button>

  <div style="position: relative">
    <button class="btn ghost profile" aria-haspopup="menu" aria-expanded={profileOpen} onclick={event => { event.stopPropagation(); profileOpen = !profileOpen; }}>
      <span class="avatar lime">{me?.initials}</span>
      <span class="who"><strong>{me?.name}</strong><span>{me?.title}</span></span>
      <Icon name="chevron-down" size={14} />
    </button>
    {#if profileOpen}
      <div class="popover profile-menu" role="menu" tabindex="-1" onclick={event => event.stopPropagation()} onkeydown={() => {}}>
        <p class="menu-label">Preview: view the workspace as</p>
        {#each teams as team (team)}
        <p class="menu-team">{team}</p>
        {#each STAFF.filter(person => person.team === team) as person (person.id)}
          <button role="menuitemradio" aria-checked={person.id === session.staffId} onclick={() => choose(person.id)}>
            <span class="avatar sm" class:lime={person.id === session.staffId}>{person.initials}</span>
            <span class="grow"><strong>{person.name}</strong><span class="faint">{person.title}</span></span>
            {#if person.id === session.staffId}<Icon name="check" size={16} />{/if}
          </button>
        {/each}
        {/each}
        <p class="menu-label">A resident’s own space</p>
        {#each RESIDENTS as person (person.id)}
          <button role="menuitemradio" aria-checked={person.id === session.staffId} onclick={() => choose(person.id)}>
            <span class="avatar sm" class:lime={person.id === session.staffId}>{person.initials}</span>
            <span class="grow"><strong>{person.name}</strong><span class="faint">Resident</span></span>
            {#if person.id === session.staffId}<Icon name="check" size={16} />{/if}
          </button>
        {/each}
        {#if canDo(session.staffId, 'resetData')}
          <hr />
          <button role="menuitem" onclick={() => { if (confirm('Reset all sample data? Changes made in this browser will be lost.')) { resetData(); profileOpen = false; say('Sample data restored'); } }}><Icon name="refresh" size={16} /> Reset sample data</button>
        {/if}
        <hr />
        <p class="menu-label" style="padding-bottom: 6px">Preview with fictional patients; changes stay in this browser. Switching views is not a sign-in.</p>
      </div>
    {/if}
  </div>
</header>

{#if palette}<CommandPalette onclose={() => { palette = false; }} />{/if}

<style>
  .search-trigger { flex: 1; max-width: 560px; display: flex; align-items: center; gap: 12px; height: 50px; padding: 0 10px 0 20px; border: 0; border-radius: 25px; background: var(--paper); color: var(--text-3); font-size: 15px; font-weight: 500; text-align: left; box-shadow: var(--shadow-1); }
  .search-trigger:hover { box-shadow: var(--shadow-2); }
  .bell { position: relative; }
  .badge { position: absolute; top: 6px; right: 6px; min-width: 18px; height: 18px; padding: 0 4px; border-radius: 999px; background: #ef5a24; color: #fff; font-size: 10.5px; font-weight: 800; line-height: 18px; box-shadow: 0 0 0 2px var(--canvas); }
  .profile { height: 50px; padding: 0 10px 0 5px; border-radius: 25px; box-shadow: none; background: transparent; }
  .profile:hover { background: var(--paper); box-shadow: var(--shadow-1); }
  .who { text-align: left; line-height: 1.2; }
  .who strong { display: block; font-size: 14px; font-weight: 800; }
  .who span { color: var(--text-3); font-size: 12px; font-weight: 600; }
  .profile-menu { right: 0; top: 58px; width: 300px; max-height: 76vh; overflow-y: auto; }
  .profile-menu strong { display: block; }
  .menu-team { margin: 8px 10px 2px; font-size: 11.5px; font-weight: 750; color: var(--text-3); }
  .profile-menu .faint { font-size: 12px; }
  .menu-label { padding: 8px 12px 4px; color: var(--text-3); font-size: 12px; font-weight: 650; }
  .icon-btn { width: 46px; height: 46px; border-radius: 23px; background: var(--paper); box-shadow: var(--shadow-1); }
  @media (max-width: 560px) { .search-trigger kbd, .search-trigger .grow { display: none; } .search-trigger { flex: 0 0 46px; padding: 0; justify-content: center; } }
</style>
