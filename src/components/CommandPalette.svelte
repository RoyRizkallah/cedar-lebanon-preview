<script>
  import Icon from './Icon.svelte';
  import ChannelBadge from './ChannelBadge.svelte';
  import { db, session } from '../lib/store.svelte.js';
  import { pagesFor, canSee, canDo, visiblePatients } from '../lib/people.js';
  import { go, act } from '../lib/ui.svelte.js';
  import { dialogFocus } from '../lib/dialogFocus.js';

  let { onclose } = $props();
  let query = $state('');
  let active = $state(0);
  const me = session.staffId;

  // Quick actions open the right page with its form already showing.
  const ACTIONS = [
    { label: 'New inquiry', icon: 'plus', page: 'pipeline', run: () => act('new-inquiry', 'pipeline') },
    { label: 'Book earliest appointment', icon: 'calendar', page: 'schedule', when: () => canDo(me, 'bookService'), run: () => act('book', 'schedule') },
    { label: 'Report an incident', icon: 'shield', page: 'safety', run: () => act('incident', 'safety/incidents') },
    { label: 'Log a family visit', icon: 'users', page: 'safety', when: () => canDo(me, 'logVisit'), run: () => act('visit', 'safety/visits') },
    { label: 'New resident request', icon: 'bag', page: 'requests', run: () => act('new-request', 'requests') },
    { label: 'Record a payment', icon: 'wallet', page: 'finance', run: () => go('finance/invoices') },
    { label: 'Medication round', icon: 'pill', page: 'medication', run: () => go('medication') }
  ].filter(item => (!item.page || canSee(me, item.page)) && (!item.when || item.when()));

  const results = $derived.by(() => {
    const words = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
    const match = text => words.every(word => text.toLowerCase().includes(word));
    const sections = [];
    const actions = ACTIONS.filter(item => !words.length || match(item.label)).map(item => ({ key: `a-${item.label}`, icon: item.icon, label: item.label, sub: 'Action', run: item.run }));
    if (words.length) {
      const patients = visiblePatients(db, me, { includeDischarged: true }).filter(p => match(`${p.fullName} ${p.id} ${p.roomId}`)).slice(0, 6)
        .map(p => ({ key: p.id, icon: 'user', label: p.fullName, sub: `${p.status}${p.roomId ? `, room ${p.roomId}` : ''}`, run: () => go(`patients/${p.id}`) }));
      const inquiries = canSee(me, 'pipeline') ? db.inquiries.filter(i => !i.outcome && match(`${i.name} ${i.phone} ${i.id}`)).slice(0, 5).map(i => ({ key: i.id, icon: 'columns', label: i.name, sub: `Inquiry, ${i.stage}`, run: () => go(`pipeline/${i.id}`) })) : [];
      const leads = canSee(me, 'leads') ? db.leads.filter(l => match(`${l.name} ${l.handle}`)).slice(0, 4).map(l => ({ key: l.id, channel: l.channel, label: l.name, sub: `Lead on ${l.channel}`, run: () => go(`leads/${l.id}`) })) : [];
      for (const [title, list] of [['Patients', patients], ['Inquiries', inquiries], ['Leads', leads]]) if (list.length) sections.push([title, list]);
    }
    if (actions.length) sections.push(['Actions', actions]);
    const pages = pagesFor(me).filter(page => !words.length || match(page.label)).map(page => ({ key: `p-${page.id}`, icon: page.icon, label: page.label, sub: 'Page', run: () => go(page.id) }));
    if (pages.length) sections.push(['Go to', pages]);
    return sections;
  });
  const flat = $derived(results.flatMap(([, items]) => items));

  function choose(item) { onclose(); item.run(); }
  function keys(event) {
    if (event.key === 'ArrowDown') { event.preventDefault(); active = Math.min(active + 1, flat.length - 1); }
    if (event.key === 'ArrowUp') { event.preventDefault(); active = Math.max(active - 1, 0); }
    if (event.key === 'Enter' && flat[active]) { event.preventDefault(); choose(flat[active]); }
  }
</script>

<div class="scrim" onclick={onclose} aria-hidden="true"></div>
<section class="palette" use:dialogFocus={{ onClose: onclose }} aria-label="Search and quick actions">
  <div class="palette-input">
    <Icon name="search" size={18} />
    <input data-autofocus placeholder="Search patients, inquiries, pages, or an action" bind:value={query} oninput={() => { active = 0; }} onkeydown={keys} aria-label="Search" role="combobox" aria-expanded="true" aria-controls="palette-results" />
    <kbd>Esc</kbd>
  </div>
  <div class="palette-results" id="palette-results" role="listbox">
    {#each results as [title, items] (title)}
      <p class="palette-group">{title}</p>
      {#each items as item (item.key)}
        {@const index = flat.indexOf(item)}
        <button role="option" aria-selected={index === active} class:active={index === active} onmousemove={() => { active = index; }} onclick={() => choose(item)}>
          {#if item.channel}<ChannelBadge channel={item.channel} small />{:else}<span class="palette-icon"><Icon name={item.icon} size={15} /></span>{/if}
          <span class="grow"><strong>{item.label}</strong></span>
          <span class="faint">{item.sub}</span>
        </button>
      {/each}
    {:else}
      <p class="empty">Nothing matches “{query}”.</p>
    {/each}
  </div>
</section>

<style>
  .palette { position: fixed; z-index: 75; top: 12vh; left: 50%; transform: translateX(-50%); width: min(640px, calc(100vw - 24px)); background: var(--paper); border: 1px solid var(--line); border-radius: 16px; box-shadow: var(--shadow-pop); overflow: hidden; animation: pop 0.16s cubic-bezier(.2,.7,.2,1); }
  @keyframes pop { from { opacity: 0; transform: translate(-50%, -6px) scale(0.98); } }
  .palette-input { display: flex; align-items: center; gap: 12px; padding: 16px 18px; border-bottom: 1px solid var(--line); color: var(--text-3); }
  .palette-input input { flex: 1; border: 0; outline: none; background: none; font-size: 16px; color: var(--text); }
  .palette-results { max-height: min(60vh, 460px); overflow-y: auto; padding: 6px; }
  .palette-group { padding: 10px 12px 4px; font-size: 12px; font-weight: 650; color: var(--text-3); }
  .palette-results button { display: flex; width: 100%; align-items: center; gap: 12px; padding: 9px 12px; border: 0; border-radius: 10px; background: none; text-align: left; color: var(--text); font-size: 14px; }
  .palette-results button.active { background: var(--sunk); }
  .palette-results button .faint { font-size: 12.5px; }
  .palette-icon { width: 26px; height: 26px; border-radius: 7px; display: inline-flex; align-items: center; justify-content: center; background: var(--sunk); color: var(--text-2); }
  .active .palette-icon { background: var(--ink-fixed); color: var(--lime); }
</style>
