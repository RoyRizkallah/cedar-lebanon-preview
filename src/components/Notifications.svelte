<script>
  import Icon from './Icon.svelte';
  import { db, session, commit } from '../lib/store.svelte.js';
  import { notificationsFor, markRead, markAllRead } from '../lib/notifications.js';
  import { fmtAgo } from '../lib/dates.js';
  import { go } from '../lib/ui.svelte.js';
  import { dialogFocus } from '../lib/dialogFocus.js';

  let { onclose } = $props();
  const items = $derived(notificationsFor(db, session.staffId).slice(0, 30));

  function open(item) {
    commit(state => markRead(state, item.id));
    onclose();
    if (item.link) go(item.link);
  }
</script>

<div class="scrim" style="background: transparent" onclick={onclose} aria-hidden="true"></div>
<section class="popover notifications" aria-label="Notifications" use:dialogFocus={{ onClose: onclose }}>
  <header class="row between" style="padding: 8px 10px 10px">
    <h2 style="font-size: 15px">Notifications</h2>
    {#if items.some(item => !item.read)}<button class="btn ghost sm" style="width: auto" onclick={() => commit(state => markAllRead(state, session.staffId))}>Mark all read</button>{/if}
  </header>
  <div style="overflow-y: auto; max-height: min(70vh, 560px)">
    {#each items as item (item.id)}
      <button class="note" class:unread={!item.read} onclick={() => open(item)}>
        <span class="mark" class:urgent={item.urgent}>{#if item.urgent}<Icon name="alert" size={15} />{:else}<Icon name="bell" size={15} />{/if}</span>
        <span class="grow" style="min-width: 0">
          <strong>{item.title}</strong>
          {#if item.body}<span class="body">{item.body}</span>{/if}
          <span class="meta">{fmtAgo(item.at, session.now)}{#each item.channels as channel}<span class="pill line" style="height: 18px; font-size: 10.5px">{channel}</span>{/each}</span>
        </span>
      </button>
    {:else}
      <div class="empty"><strong>Nothing new</strong>Alerts about urgent inquiries, risk and prescriptions appear here.</div>
    {/each}
  </div>
</section>

<style>
  .notifications { position: fixed; top: 56px; right: 16px; width: min(400px, calc(100vw - 24px)); z-index: 62; }
  .note { align-items: flex-start !important; padding: 10px !important; }
  .note.unread { background: var(--subtle) !important; }
  .note strong { display: block; font-size: 13px; }
  .note.unread strong::after { content: ""; display: inline-block; width: 7px; height: 7px; margin-left: 6px; border-radius: 50%; background: var(--urgent); vertical-align: middle; }
  .body { display: block; color: var(--text-2); font-size: 12.5px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .meta { display: flex; flex-wrap: wrap; align-items: center; gap: 4px; margin-top: 4px; color: var(--text-3); font-size: 11.5px; }
  .mark { width: 28px; height: 28px; border-radius: 8px; display: inline-flex; align-items: center; justify-content: center; background: var(--sunk); flex: none; }
  .mark.urgent { background: var(--urgent-soft); color: var(--urgent); }
</style>
