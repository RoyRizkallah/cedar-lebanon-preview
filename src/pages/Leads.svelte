<script>
  import { act } from '../lib/act.js';
  import Icon from '../components/Icon.svelte';
  import ChannelBadge from '../components/ChannelBadge.svelte';
  import InquiryFields from '../components/InquiryFields.svelte';
  import { db, session } from '../lib/store.svelte.js';
  import { CHANNELS, CLOSE_REASONS, leadStats, replyToLead, convertLead, closeLead, reopenLead, lastMessage } from '../lib/leads.js';
  import { CLARIFICATION_REPLY } from '../lib/pipeline.js';
  import { staffName } from '../lib/people.js';
  import { fmtAgo, fmtDateTime } from '../lib/dates.js';
  import { dialogFocus } from '../lib/dialogFocus.js';
  import { go, say } from '../lib/ui.svelte.js';

  let { args = [] } = $props();

  let channel = $state('All');
  let status = $state('Open');
  let query = $state('');
  let reply = $state('');
  let closing = $state('');
  let error = $state('');
  let converting = $state(null);

  const selectedId = $derived(args[0] || '');
  const stats = $derived(leadStats(db, session.now));
  const statusMatch = lead => status === 'All' || (status === 'Open' ? ['New', 'Replied'].includes(lead.status) : lead.status === status);
  const list = $derived(db.leads
    .filter(lead => (channel === 'All' || lead.channel === channel) && statusMatch(lead))
    .filter(lead => !query.trim() || `${lead.name} ${lead.handle} ${lead.messages.map(m => m.text).join(' ')}`.toLowerCase().includes(query.trim().toLowerCase()))
    .sort((a, b) => String(lastMessage(b).at).localeCompare(String(lastMessage(a).at))));
  const lead = $derived(db.leads.find(item => item.id === selectedId));
  const responseText = minutes => minutes === null ? '—' : minutes < 60 ? `${minutes} min` : `${Math.round(minutes / 6) / 10} h`;

  function send() {
    error = '';
    try { act('replyToLead', lead.id, reply); reply = ''; say(`Reply queued on ${lead.channel}`); } catch (e) { error = e.message; }
  }
  function startConvert() {
    converting = { name: lead.name, phone: /^\+?\d/.test(lead.handle) ? lead.handle : '', email: lead.handle.includes('@') && !lead.handle.startsWith('@') ? lead.handle : '', source: lead.channel, contactPerson: session.staffId === 'ahmed' ? 'melyssa' : session.staffId, commPreference: lead.channel === 'WhatsApp' ? 'WhatsApp' : lead.channel === 'Email' ? 'Email' : 'Phone call', program: 'Inpatient', drugOfChoice: '', yearsOfUse: '', previousDetox: '', urgency: 'Normal', potentialRevenue: 0, notes: lastMessage(lead).text };
  }
  function convert() {
    error = '';
    try {
      const inquiry = act('convertLead', lead.id, $state.snapshot(converting));
      converting = null;
      say(`${inquiry.name} added to New Inquiry`);
    } catch (e) { error = e.message; }
  }
</script>

<main class="content wide inbox-page">
  <section class="leads-top">
    <div class="lt-title">
      <h1>Leads</h1>
      <p>Every message from WhatsApp, Instagram, Facebook, email, the website and phone calls, in one inbox.</p>
    </div>
    <div class="lt-hero" class:calm={!stats.unanswered}>
      <span class="label">Unanswered</span>
      <strong class="num">{stats.unanswered}</strong>
      <span class="note">{stats.unanswered ? 'waiting for a first reply' : 'everyone has an answer'}</span>
    </div>
    <div class="lt-stat"><span>Today</span><strong class="num">{stats.today}</strong></div>
    <div class="lt-stat"><span>Median first reply</span><strong class="num">{responseText(stats.medianFirstResponseMins)}</strong></div>
    <div class="lt-stat"><span>Became inquiries</span><strong class="num">{stats.converted}<small>/ {db.leads.length}</small></strong></div>
  </section>

  <nav class="channel-strip" aria-label="Channel">
    <button class="ch-chip" aria-pressed={channel === 'All'} onclick={() => { channel = 'All'; }}><span class="all-dot">All</span><b>{db.leads.length}</b></button>
    {#each CHANNELS as name}
      <button class="ch-chip" aria-pressed={channel === name} onclick={() => { channel = name; }}><ChannelBadge channel={name} small />{name}<b>{stats.byChannel[name]}</b></button>
    {/each}
  </nav>

  <div class="messenger" class:has-selection={!!lead}>
    <aside class="convos">
      <div class="convo-filters">
        <input class="input" type="search" placeholder="Search messages" aria-label="Search messages" bind:value={query} />
        <select class="select" aria-label="Status" bind:value={status}>
          <option value="Open">Open</option><option>New</option><option>Replied</option><option>Converted</option><option>Closed</option><option>All</option>
        </select>
      </div>
      <ul class="convo-list" aria-label="Leads">
        {#each list as item (item.id)}
          <li class="convo" class:active={item.id === selectedId} class:unread={item.status === 'New'} onclick={() => go(`leads/${item.id}`)} onkeydown={event => event.key === 'Enter' && go(`leads/${item.id}`)} tabindex="0" role="button" aria-current={item.id === selectedId ? 'true' : undefined}>
            <span class="who"><span class="initial">{item.name.slice(0, 1).toUpperCase()}</span><span class="badge-wrap"><ChannelBadge channel={item.channel} small /></span></span>
            <div class="grow">
              <div class="row between"><span class="name">{item.name}</span><span class="time">{fmtAgo(lastMessage(item).at, session.now)}</span></div>
              <div class="row between" style="gap: 8px"><span class="snippet">{lastMessage(item).from === 'staff' ? 'You: ' : ''}{lastMessage(item).text}</span>
                {#if item.status === 'New'}<span class="unread-dot" aria-label="Unanswered"></span>{:else if item.status === 'Converted'}<span class="pill ok">Inquiry</span>{:else if item.status === 'Closed'}<span class="pill">Closed</span>{/if}
              </div>
            </div>
          </li>
        {:else}
          <li><div class="empty" style="width: 100%"><strong>No leads here</strong>Try another channel or status.</div></li>
        {/each}
      </ul>
    </aside>

    <section class="conversation">
      {#if lead}
        <header class="thread-head">
          <button class="btn ghost icon back" aria-label="Back to leads" onclick={() => go('leads')}><Icon name="chevron-left" /></button>
          <span class="who big"><span class="initial">{lead.name.slice(0, 1).toUpperCase()}</span><span class="badge-wrap"><ChannelBadge channel={lead.channel} small /></span></span>
          <div class="grow"><h2>{lead.name}</h2><p class="faint">{lead.channel}, {lead.handle}</p></div>
          <div class="thread-actions">
          {#if lead.inquiryId}
            <a class="btn" href={`#/pipeline/${lead.inquiryId}`}>Open inquiry</a>
          {:else if lead.status !== 'Closed'}
            {#if closing !== lead.id}<button class="btn ghost" onclick={() => { closing = lead.id; }}>Close</button>
            {:else}
              <span class="close-as" role="group" aria-label="Why is this lead closing?">
                {#each CLOSE_REASONS as why}<button class="btn sm ghost" onclick={() => { act('closeLead', lead.id, why); closing = ''; say(`Lead closed: ${why.toLowerCase()}`); }}>{why}</button>{/each}
                <button class="btn sm ghost icon" aria-label="Keep it open" onclick={() => { closing = ''; }}><Icon name="close" size={14} /></button>
              </span>
            {/if}
            <button class="btn primary" onclick={startConvert}><Icon name="plus" size={16} />Create inquiry</button>
          {:else}
            <span class="pill">Closed: {lead.closeReason || 'Not relevant'}</span>
            <button class="btn" onclick={() => { act('reopenLead', lead.id); say('Lead reopened'); }}>Reopen</button>
          {/if}
          </div>
        </header>
        <div class="thread" aria-live="polite">
          <p class="day-chip">First message {fmtDateTime(lead.receivedAt)}</p>
          {#each lead.messages as message, index (index)}
            <div class="bubble {message.from}">
              <p>{message.text}</p>
              <span>{message.from === 'staff' ? `${staffName(message.by)}, ` : ''}{fmtDateTime(message.at)}{message.delivery ? ` · ${message.delivery}` : ''}</span>
            </div>
          {/each}
        </div>
        {#if lead.status !== 'Closed'}
          <form class="composer" onsubmit={event => { event.preventDefault(); send(); }}>
            <label class="sr-only" for="reply">Reply on {lead.channel}</label>
            <textarea id="reply" class="textarea" rows="2" placeholder={`Reply on ${lead.channel}`} bind:value={reply} onkeydown={event => { if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) send(); }}></textarea>
            <div class="row between wrap">
              <button class="btn ghost sm" type="button" onclick={() => { reply = CLARIFICATION_REPLY; }}>Use clarification reply</button>
              <div class="row">{#if error}<span class="error">{error}</span>{/if}<button class="btn dark" type="submit"><Icon name="send" size={15} />Send</button></div>
            </div>
          </form>
        {/if}
      {:else}
        <div class="pick">
          <span class="pick-icon"><Icon name="inbox" size={30} /></span>
          <strong>Choose a conversation</strong>
          <span>Reply, turn it into an inquiry, or close it.</span>
        </div>
      {/if}
    </section>

    {#if lead}
      <aside class="contact">
        <span class="who huge"><span class="initial">{lead.name.slice(0, 1).toUpperCase()}</span><span class="badge-wrap"><ChannelBadge channel={lead.channel} /></span></span>
        <h3>{lead.name}</h3>
        <p class="faint">{lead.handle}</p>
        <span class="pill {lead.status === 'New' ? 'urgent' : lead.status === 'Converted' ? 'ok' : lead.status === 'Replied' ? 'info' : ''}">{lead.status === 'New' ? 'Waiting for a reply' : lead.status}</span>
        <dl>
          <div><dt>Channel</dt><dd>{lead.channel}</dd></div>
          <div><dt>First message</dt><dd>{fmtAgo(lead.receivedAt, session.now)}</dd></div>
          <div><dt>Messages</dt><dd>{lead.messages.length}</dd></div>
          {#if lead.inquiryId}<div><dt>Inquiry</dt><dd><a href={`#/pipeline/${lead.inquiryId}`}>{lead.inquiryId}</a></dd></div>{/if}
        </dl>
      </aside>
    {/if}
  </div>
</main>

{#if converting}
  <div class="scrim" onclick={() => { converting = null; }} aria-hidden="true"></div>
  <section class="drawer" use:dialogFocus={{ onClose: () => { converting = null; } }}>
    <header class="drawer-head"><div class="grow"><h2>Create inquiry</h2><p class="muted" style="margin-top: 4px">From {lead.channel}. It starts in New Inquiry with two follow-up calls scheduled.</p></div><button class="btn ghost icon" aria-label="Close" onclick={() => { converting = null; }}><Icon name="close" /></button></header>
    <div class="drawer-body"><InquiryFields fields={converting} /></div>
    <footer class="drawer-foot">{#if error}<span class="error" style="margin-right: auto">{error}</span>{/if}<button class="btn" onclick={() => { converting = null; }}>Cancel</button><button class="btn primary" onclick={convert}>Create inquiry</button></footer>
  </section>
{/if}

<style>
  .close-as { display: inline-flex; flex-wrap: wrap; gap: 4px; align-items: center; padding: 3px; border-radius: 14px; background: var(--sunk); }
  .leads-top { display: grid; grid-template-columns: minmax(0, 1.6fr) minmax(200px, 1fr) repeat(3, minmax(130px, 0.7fr)); gap: 10px; margin-bottom: 10px; align-items: stretch; }
  .lt-title { padding: 17px 20px; border-radius: 19px; background: linear-gradient(112deg, var(--paper) 0%, var(--paper) 55%, var(--leaf) 100%); box-shadow: var(--shadow-1); }
  .lt-title h1 { font-size: 30px; letter-spacing: -0.04em; }
  .lt-title p { color: var(--text-2); margin-top: 4px; }
  .lt-hero { position: relative; overflow: hidden; display: flex; flex-direction: column; justify-content: center; padding: 14px 17px; border-radius: 19px; background: var(--hero); color: var(--on-ink); box-shadow: var(--shadow-2); }
  .lt-hero::after { content: ""; position: absolute; right: -60px; top: -60px; width: 200px; height: 200px; border-radius: 50%; background: radial-gradient(circle, rgb(239 90 36 / 0.45), transparent 65%); }
  .lt-hero.calm::after { background: radial-gradient(circle, rgb(var(--lime-rgb) / 0.35), transparent 65%); }
  .lt-hero .label, .lt-hero .note { position: relative; z-index: 1; color: var(--on-ink-2); font-weight: 650; font-size: 13px; }
  .lt-hero strong { position: relative; z-index: 1; font-size: 41px; font-weight: 800; letter-spacing: -0.05em; line-height: 1; color: #ffb59a; margin: 4px 0; }
  .lt-hero.calm strong { color: var(--lime); }
  .lt-stat { display: flex; flex-direction: column; justify-content: center; gap: 6px; padding: 13px 14px; border-radius: 16px; background: var(--paper); box-shadow: var(--shadow-1); }
  .lt-stat span { color: var(--text-2); font-size: 13px; font-weight: 650; }
  .lt-stat strong { font-size: 22px; font-weight: 800; letter-spacing: -0.035em; line-height: 1.05; }
  .lt-stat small { font-size: 14px; color: var(--text-3); margin-left: 3px; }

  .channel-strip { display: flex; gap: 8px; overflow-x: auto; scrollbar-width: none; padding: 2px 2px 10px; }
  .ch-chip { flex: none; display: inline-flex; align-items: center; gap: 8px; height: 44px; padding: 0 11px 0 8px; border: 0; border-radius: 15px; background: var(--paper); color: var(--text-2); font-weight: 700; box-shadow: var(--shadow-1); }
  .ch-chip b { min-width: 24px; height: 24px; padding: 0 7px; border-radius: 12px; background: var(--sunk); font-size: 12px; line-height: 24px; color: var(--text-2); text-align: center; }
  .ch-chip[aria-pressed="true"] { background: var(--strong); color: var(--on-strong); }
  .ch-chip[aria-pressed="true"] b { background: rgb(127 140 127 / 0.25); color: inherit; }
  .all-dot { width: 28px; height: 28px; border-radius: 9px; background: var(--leaf); color: var(--moss); display: inline-flex; align-items: center; justify-content: center; font-size: 11px; }

  /* The inbox fills the window down to the bottom edge; the lists scroll inside it */
  .inbox-page { display: flex; flex-direction: column; height: calc(100vh - var(--topbar)); padding-bottom: 16px; }
  .messenger { display: grid; grid-template-columns: minmax(300px, 380px) minmax(0, 1fr); gap: 10px; flex: 1 1 0; min-height: 416px; }
  .messenger.has-selection { grid-template-columns: minmax(300px, 380px) minmax(0, 1fr) 280px; }
  .convos, .conversation, .contact { background: var(--paper); border-radius: 19px; box-shadow: var(--shadow-1); min-height: 0; overflow: hidden; }
  .convos { display: flex; flex-direction: column; }
  .convo-filters { display: flex; gap: 8px; padding: 10px; }
  .convo-filters .input { height: 42px; border-radius: 14px; background: var(--sunk); border-color: transparent; }
  .convo-filters .select { width: 116px; flex: none; height: 42px; border-radius: 14px; }
  .convo-list { list-style: none; margin: 0; padding: 0 8px 8px; overflow-y: auto; flex: 1; }
  .convo { display: flex; gap: 8px; align-items: center; padding: 9px 10px; border-radius: 14px; cursor: pointer; transition: background 0.12s; }
  .convo:hover { background: var(--subtle); }
  .convo.active { background: var(--leaf); }
  .convo .name { font-weight: 750; color: var(--text); }
  .convo.unread .name { font-weight: 850; }
  .convo .time { font-size: 11.5px; color: var(--text-3); flex: none; font-weight: 600; }
  .snippet { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; min-width: 0; font-size: 13px; color: var(--text-2); }
  .convo.unread .snippet { color: var(--text); font-weight: 600; }
  .unread-dot { width: 10px; height: 10px; border-radius: 50%; background: #ef5a24; flex: none; box-shadow: 0 0 0 3px var(--urgent-soft); }
  .who { position: relative; flex: none; width: 46px; height: 46px; }
  .who .initial { width: 46px; height: 46px; border-radius: 50%; display: inline-flex; align-items: center; justify-content: center; background: var(--sunk); color: var(--text); font-weight: 800; font-size: 17px; }
  .convo.active .who .initial { background: var(--paper); }
  .who .badge-wrap { position: absolute; right: -4px; bottom: -4px; border-radius: 9px; box-shadow: 0 0 0 3px var(--paper); }
  .who.big { width: 48px; height: 48px; } .who.big .initial { width: 48px; height: 48px; }
  .who.huge { width: 88px; height: 88px; } .who.huge .initial { width: 88px; height: 88px; font-size: 25px; background: var(--leaf); color: var(--moss); }

  .conversation { display: flex; flex-direction: column; }
  .thread-head { display: flex; align-items: center; gap: 8px; padding: 11px 14px; border-bottom: 1px solid var(--line); flex-wrap: wrap; }
  .thread-head h2 { font-size: 18px; }
  .thread-head p { font-size: 13px; }
  .thread-actions { display: flex; gap: 8px; }
  .thread-head .back { display: none; }
  .thread { flex: 1; overflow-y: auto; padding: 15px 18px; display: flex; flex-direction: column; gap: 10px; background: radial-gradient(circle at 20% 0%, var(--leaf), transparent 45%), var(--subtle); }
  .day-chip { align-self: center; padding: 4px 10px; border-radius: 12px; background: var(--paper); color: var(--text-3); font-size: 12px; font-weight: 650; box-shadow: var(--shadow-1); }
  .bubble { max-width: min(560px, 80%); padding: 11px 12px; border-radius: 15px 15px 15px 6px; background: var(--paper); box-shadow: var(--shadow-1); font-size: 15px; line-height: 1.5; }
  .bubble.staff { align-self: flex-end; border-radius: 15px 15px 6px 15px; background: var(--strong); color: var(--on-strong); }
  .bubble p { white-space: pre-wrap; }
  .bubble span { display: block; margin-top: 6px; font-size: 11.5px; color: var(--text-3); }
  .bubble.staff span { color: color-mix(in srgb, var(--on-strong) 62%, transparent); }
  .composer { display: flex; flex-direction: column; gap: 8px; padding: 10px 13px; border-top: 1px solid var(--line); }
  .composer .textarea { min-height: 64px; border-radius: 14px; background: var(--sunk); border-color: transparent; }
  .pick { margin: auto; display: flex; flex-direction: column; align-items: center; gap: 6px; text-align: center; color: var(--text-2); padding: 28px; }
  .pick strong { font-size: 18px; color: var(--text); }
  .pick-icon { width: 72px; height: 72px; border-radius: 16px; display: inline-flex; align-items: center; justify-content: center; background: var(--leaf); color: var(--moss); margin-bottom: 8px; }

  .contact { display: flex; flex-direction: column; align-items: center; text-align: center; gap: 6px; padding: 20px 15px; overflow-y: auto; }
  .contact h3 { font-size: 19px; margin-top: 10px; }
  .contact .faint { font-size: 13px; margin-bottom: 6px; word-break: break-all; }
  .contact dl { width: 100%; margin: 12px 0 0; display: flex; flex-direction: column; gap: 4px; text-align: left; }
  .contact dl div { display: flex; justify-content: space-between; gap: 10px; padding: 8px 10px; border-radius: 14px; background: var(--subtle); font-size: 13px; }
  .contact dt { color: var(--text-2); font-weight: 600; }
  .contact dd { margin: 0; font-weight: 750; }

  @media (max-width: 1300px) {
    .messenger.has-selection { grid-template-columns: minmax(280px, 340px) minmax(0, 1fr); }
    .contact { display: none; }
    .leads-top { grid-template-columns: repeat(4, minmax(0, 1fr)); }
    .lt-title { grid-column: 1 / -1; }
  }
  @media (max-width: 900px) {
    .leads-top { grid-template-columns: repeat(2, minmax(0, 1fr)); }
    .lt-hero { grid-column: span 2; }
    .lt-stat:last-child { grid-column: span 2; }
    .inbox-page { height: auto; }
    .messenger, .messenger.has-selection { grid-template-columns: 1fr; height: auto; min-height: 0; flex: none; }
    .messenger.has-selection .convos { display: none; }
    .messenger:not(.has-selection) .conversation { display: none; }
    .conversation { min-height: 70vh; }
    .thread-head .back { display: inline-flex; }
    .thread-actions { width: 100%; }
    .thread-actions .btn { flex: 1; }
  }
</style>
