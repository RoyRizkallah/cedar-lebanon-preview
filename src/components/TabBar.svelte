<script>
  import Icon from './Icon.svelte';
  import { pagesFor, canDo } from '../lib/people.js';

  // Phones get a thumb bar: the four pages this person uses most, then everything else under More.
  const PRIORITY = ['today', 'home', 'dashboard', 'pipeline', 'leads', 'patients', 'sessions', 'medication', 'requests', 'finance', 'rooms', 'schedule', 'safety', 'followups', 'admissions', 'reports', 'insights'];
  const SHORT = { patients: 'Patients', requests: 'Support', finance: 'Accounts', rooms: 'Rooms', safety: 'Visits', followups: 'Follow-ups', medication: 'Meds' };

  let { staffId, current, counts = {}, menuOpen = false, onmore } = $props();
  // The therapists who build programs keep them one tap away.
  const order = $derived(canDo(staffId, 'managePrograms') ? ['today', 'patients', 'programs', ...PRIORITY] : PRIORITY);
  const tabs = $derived([...new Set(order)].map(id => pagesFor(staffId).find(page => page.id === id)).filter(Boolean).slice(0, 4));
  const more = $derived(pagesFor(staffId).length > tabs.length);
  const inMore = $derived(!tabs.some(page => page.id === current));
</script>

<nav class="tabbar" aria-label="Quick navigation">
  {#each tabs as page (page.id)}
    <a href={`#/${page.id}`} class="tab" aria-current={current === page.id && !menuOpen ? 'page' : undefined}>
      <span class="tab-icon"><Icon name={page.icon} size={21} />{#if counts[page.id]?.value}<span class="tab-count" class:hot={counts[page.id].hot}>{counts[page.id].value}</span>{/if}</span>
      <span class="tab-label">{SHORT[page.id] || page.label}</span>
    </a>
  {/each}
  {#if more}
    <button class="tab" aria-expanded={menuOpen} aria-current={menuOpen || inMore ? 'page' : undefined} onclick={onmore}>
      <span class="tab-icon"><Icon name="grid" size={21} /></span>
      <span class="tab-label">More</span>
    </button>
  {/if}
</nav>
