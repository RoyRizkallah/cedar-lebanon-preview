<script>
  import Sidebar from './components/Sidebar.svelte';
  import Topbar from './components/Topbar.svelte';
  import TabBar from './components/TabBar.svelte';
  import { db, session, commit } from './lib/store.svelte.js';
  import { runFollowUpAlerts, runInquiryAging, inquiriesToAge } from './lib/pipeline.js';
  import { runLeaveAlerts, leaveAlertsDue } from './lib/safety.js';
  import { canSee, homePage, PAGES } from './lib/people.js';
  import { route, toast, readHash } from './lib/ui.svelte.js';
  import { navCounts } from './lib/counts.js';
  import Notifications from './components/Notifications.svelte';
  import Leads from './pages/Leads.svelte';
  import Pipeline from './pages/Pipeline.svelte';
  import Schedule from './pages/Schedule.svelte';
  import Admissions from './pages/Admissions.svelte';
  import Patients from './pages/Patients.svelte';
  import Requests from './pages/Requests.svelte';
  import Orders from './pages/Orders.svelte';
  import Today from './pages/Today.svelte';
  import Dashboard from './pages/Dashboard.svelte';
  import Finance from './pages/Finance.svelte';
  import Sessions from './pages/Sessions.svelte';
  import Medication from './pages/Medication.svelte';
  import Rooms from './pages/Rooms.svelte';
  import Safety from './pages/Safety.svelte';
  import Reports from './pages/Reports.svelte';
  import Insights from './pages/Insights.svelte';
  import Home from './pages/Home.svelte';
  import FollowUps from './pages/FollowUps.svelte';
  import Programs from './pages/Programs.svelte';

  let { staffId = '' } = $props();
  if (staffId) session.staffId = staffId;

  let bellOpen = $state(false);
  let menuOpen = $state(false);

  function sync() {
    Object.assign(route, readHash(typeof location === 'undefined' ? '' : location.hash));
    session.now = new Date();
    // Follow-ups that came due since the last look notify their contact person once.
    if (typeof window !== 'undefined' && db.inquiries.some(item => item.stage === 'Follow-up' && !item.followUp?.notified)) commit(state => runFollowUpAlerts(state, session.now));
    // New inquiries untouched for 72 hours move to the follow-up log.
    if (typeof window !== 'undefined' && inquiriesToAge(db, session.now)) commit(state => runInquiryAging(state, session.now));
    // Residents late back from leave raise an urgent alert once.
    if (typeof window !== 'undefined' && leaveAlertsDue(db, session.now)) commit(state => runLeaveAlerts(state, session.now));
    menuOpen = false;
  }
  sync();

  const page = $derived(route.page && canSee(session.staffId, route.page) ? route.page : homePage(session.staffId));
  const counts = $derived(navCounts(db, session.staffId, session.now));
  const unread = $derived(db.notifications.filter(item => item.to === session.staffId && !item.read).length);
  const pages = { leads: Leads, pipeline: Pipeline, schedule: Schedule, admissions: Admissions, patients: Patients, requests: Requests, orders: Orders, today: Today, dashboard: Dashboard, finance: Finance, sessions: Sessions, medication: Medication, rooms: Rooms, safety: Safety, reports: Reports, insights: Insights, home: Home, followups: FollowUps, programs: Programs };
</script>

<svelte:window onhashchange={sync} />

<div class="shell">
  <Sidebar staffId={session.staffId} current={page} {counts} open={menuOpen} onnavigate={() => { menuOpen = false; }} />
  {#if menuOpen}<div class="scrim" style="z-index: 65" onclick={() => { menuOpen = false; }} aria-hidden="true"></div>{/if}
  <div class="main">
    <Topbar title={PAGES.find(item => item.id === page)?.label} onmenu={() => { menuOpen = true; }} {unread} onbell={() => { bellOpen = !bellOpen; }} />
    {#key session.staffId}
      {#if pages[page]}
        {@const Page = pages[page]}
        <Page args={route.args} />
      {/if}
    {/key}
  </div>
  <TabBar staffId={session.staffId} current={page} {counts} {menuOpen} onmore={() => { menuOpen = !menuOpen; }} />
</div>

{#if bellOpen}<Notifications onclose={() => { bellOpen = false; }} />{/if}

{#if toast.text}
  {#key toast.id}<div class="toast" role="status"><span class="dot"></span>{toast.text}</div>{/key}
{/if}
