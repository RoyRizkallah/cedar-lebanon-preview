<script>
  // Horizontal bars for one measure across a few categories. Values are written at the bar end.
  import ChannelBadge from './ChannelBadge.svelte';
  let { rows = [], unit = '', channels = false } = $props();
  const max = $derived(Math.max(1, ...rows.map(row => row.value)));
</script>

<ul class="bars">
  {#each rows as row (row.label)}
    <li title={`${row.label}: ${row.value}${unit}`}>
      <span class="label">{#if channels}<ChannelBadge channel={row.label} small />{/if}{row.label}</span>
      <span class="track"><i style:width={`${(row.value / max) * 100}%`} style:background={row.color || 'var(--ink)'}></i></span>
      <span class="value num">{row.display ?? `${row.value}${unit}`}</span>
    </li>
  {/each}
</ul>

<style>
  .bars { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 10px; }
  .bars li { display: grid; grid-template-columns: 130px 1fr 44px; align-items: center; gap: 10px; font-size: 13px; }
  .label { display: flex; align-items: center; gap: 8px; color: var(--text-2); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .track { height: 12px; background: var(--sunk); border-radius: 4px; overflow: hidden; }
  .track i { display: block; height: 100%; min-width: 2px; border-radius: 0 4px 4px 0; }
  .value { text-align: right; font-weight: 600; }
</style>
