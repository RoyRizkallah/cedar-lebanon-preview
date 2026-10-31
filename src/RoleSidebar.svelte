<script>
  import { onMount, tick } from 'svelte';
  import { navigationFocus } from './dialogFocus.js';
  import Icon from './Icon.svelte';
  import { sidebarConfig } from './sidebarConfig.js';
  import { iso } from './data.js';
  import { walletBalanceCents } from './wallet.js';

  export let role;
  export let staff;
  export let data;
  export let page;
  export let open = false;
  export let onClose = () => {};
  export let onNavigate = () => {};

  let navElement;
  let lastScrolledPage = '';
  let compact = false;
  onMount(() => {
    const media = window.matchMedia('(max-width: 900px)');
    const update = () => compact = media.matches;
    update();
    media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
  });

  $: config = sidebarConfig[role];
  $: myPatients = role === 'Therapist' ? data.patients.filter(item => item.therapist === staff.assignment && item.status !== 'Archived') : [];
  $: openGoals = myPatients.reduce((total, patient) => total + (data.clinical?.[patient.id]?.carePlan?.goals || []).filter(goal => goal.status !== 'Completed').length, 0);
  $: drafts = myPatients.reduce((total, patient) => total + (data.clinical?.[patient.id]?.reports || []).filter(report => report.status === 'Draft').length, 0);
  $: handoffs = data.inquiries.filter(item => item.owner === staff.assignment && item.stage !== 'Arrival planned').length;
  $: arrivals = data.inquiries.filter(item => item.stage === 'Arrival planned' && item.deskOwner === staff.assignment).length;
  $: dueFollowups = data.followups.filter(item => item.owner === staff.assignment && item.status !== 'Completed' && item.due <= iso(0)).length;
  $: approvals = (data.finance?.expenses || []).filter(item => item.status === 'Pending approval').length;
  $: bankLines = (data.finance?.bankEntries || []).filter(item => !item.matchedJournalId).length;
  $: decisionFiles = data.inquiries.filter(item => item.stage === 'Awaiting decision').length;
  $: rsaResidents = role === 'RSA' ? data.patients.filter(item => item.rsa === staff.assignment && item.status !== 'Archived' && item.program === 'Residential') : [];
  $: checkedInToday = new Set((data.supportCheckins || []).filter(item => item.date === iso(0)).map(item => item.patientId));
  $: rsaCheckinsDue = rsaResidents.filter(patient => !checkedInToday.has(patient.id)).length;
  $: pendingWalletOrders = (data.walletOrders || []).filter(item => item.status === 'Requested');
  $: rsaOrdersDue = role === 'RSA' ? pendingWalletOrders.filter(item => rsaResidents.some(patient => patient.id === item.patientId)).length : 0;
  $: residentOrdersDue = role === 'Resident' ? pendingWalletOrders.filter(item => item.patientId === staff.patientId).length : 0;
  $: focusCount = role === 'Director' ? decisionFiles : role === 'Coordinator' ? handoffs : role === 'Therapist' ? openGoals : role === 'Finance' ? bankLines : role === 'RSA' ? rsaCheckinsDue : role === 'Resident' ? `$${(walletBalanceCents(data, staff.patientId) / 100).toFixed(2)}` : arrivals;
  $: if (navElement && page !== lastScrolledPage) {
    lastScrolledPage = page;
    tick().then(() => {
      const active = navElement?.querySelector('[aria-current="page"]');
      if (!active) return;
      const top = active.getBoundingClientRect().top - navElement.getBoundingClientRect().top + navElement.scrollTop;
      if (top < navElement.scrollTop || top + active.offsetHeight > navElement.scrollTop + navElement.clientHeight)
        navElement.scrollTop = Math.max(0, top - 18);
    });
  }

  $: navCounts = {
    handoffs: role === 'Coordinator' ? handoffs : 0,
    careplans: role === 'Therapist' ? openGoals : 0,
    clinicalreports: role === 'Therapist' ? drafts : 0,
    arrivals: role === 'Reception' ? arrivals : 0,
    aftercare: ['Coordinator', 'Therapist'].includes(role) ? dueFollowups : 0,
    expenses: role === 'Finance' ? approvals : 0,
    reconciliation: role === 'Finance' ? bankLines : 0,
    checkins: role === 'RSA' ? rsaCheckinsDue : 0,
    wallets: role === 'RSA' ? rsaOrdersDue : 0,
    orders: role === 'Resident' ? residentOrdersDue : 0
  };
</script>

<aside use:navigationFocus={{open,compact,onClose}} aria-label="{role} workspace navigation" class:open class="sidebar role-sidebar" class:director={role === 'Director'} class:coordinator={role === 'Coordinator'} class:therapist={role === 'Therapist'} class:finance={role === 'Finance'} class:reception={role === 'Reception'} class:rsa={role === 'RSA'} class:resident={role === 'Resident'}>
  <div class="brand"><div class="brand-mark"><Icon name="leaf" size={24} stroke={1.65}/></div><div><div class="brand-name">CEDAR<span style="font-weight:400">.</span></div><div class="brand-sub">Lebanon · Recovery</div></div><button class="sidebar-close" aria-label="Close menu" on:click={onClose}><Icon name="close" size={19}/></button></div>

  <div class="role-sidebar-identity">
    <span class="role-sidebar-identity-icon"><Icon name={config.icon} size={19}/></span>
    <div><span class="role-sidebar-overline">YOUR WORKSPACE</span><strong>{config.title}</strong><small>{config.subtitle}</small></div>
  </div>

  <nav bind:this={navElement} class="nav-list role-sidebar-nav" aria-label="{role} navigation">
    {#each config.sections as section}
      <div class="role-sidebar-section">
        <div class="role-sidebar-section-label">{section.label}</div>
        {#each section.items as [id, label, icon]}
          <button class:active={page === id} class="nav-btn" aria-current={page === id ? 'page' : undefined} on:click={() => onNavigate(id)}>
            <Icon name={icon} size={17}/><span>{label}</span>
            {#if navCounts[id] > 0}<span class="nav-counter">{navCounts[id]}</span>{/if}
          </button>
        {/each}
      </div>
    {/each}
  </nav>

  <div class="sidebar-bottom">
    <button class="role-sidebar-focus" on:click={() => onNavigate(config.focus.page)}>
      <span class="role-sidebar-focus-top"><Icon name={config.focus.icon} size={16}/>{config.focus.label}</span>
      <span class="role-sidebar-focus-number">{focusCount}</span>
      <span class="role-sidebar-focus-text">{config.focus.text}</span>
      <span class="role-sidebar-focus-link">Open worklist <Icon name="arrow" size={13}/></span>
    </button>
    <div class="role-sidebar-person"><span class="role-sidebar-avatar">{staff.initials}</span><span><strong>{staff.name}</strong><small>{role} preview · fictional data</small></span></div>
    <div class="sidebar-footer"><span>CEDAR OS · LOCAL PREVIEW</span><span>FICTIONAL DATA</span></div>
  </div>
</aside>
