<script>
  import Icon from './Icon.svelte';
  import { GROUPS, GROUP_ICONS, pagesFor, isResident } from '../lib/people.js';

  let { staffId, current, counts = {}, open = false, onnavigate } = $props();
  // Sections with the pages each person can open; a section with one page shows just that page.
  const sections = $derived(GROUPS.map(group => ({ group, pages: pagesFor(staffId).filter(page => page.group === group) })).filter(section => section.pages.length));
</script>

<aside class="sidebar" class:open aria-label="Main navigation">
  <a class="brand" href="#/" onclick={onnavigate}>
    <!-- The owner's logo exactly as supplied, colours untouched. -->
    <img class="logo" src="/logo.png" alt="Cedar Rehab, Addiction Rehabilitation & Prevention Center" width="640" height="531" />
    <small>{isResident(staffId) ? 'Resident space' : 'Staff workspace'}</small>
  </a>
  <nav class="nav">
    {#each sections as { group, pages } (group)}
      <section class="nav-group">
        <h2 class="nav-cat"><span class="cat-icon"><Icon name={GROUP_ICONS[group]} size={15} stroke={2} /></span>{group}</h2>
        {#each pages as page (page.id)}
          <a class="nav-item" href={`#/${page.id}`} aria-current={current === page.id ? 'page' : undefined} onclick={onnavigate}>
            <span class="item-icon"><Icon name={page.icon} size={18} /></span>
            <span class="grow">{page.label}</span>
            {#if counts[page.id]?.value}<span class="count" class:hot={counts[page.id].hot} title={counts[page.id].title}>{counts[page.id].value}</span>{/if}
          </a>
        {/each}
      </section>
    {/each}
  </nav>
</aside>
