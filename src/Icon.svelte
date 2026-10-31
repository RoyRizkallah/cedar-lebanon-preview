<script>
  export let name = 'grid';
  export let size = 18;
  export let stroke = 1.8;
</script>

<svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width={stroke} stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
  {#if name === 'leaf'}<path d="M20.8 3.2C12 3 5.7 5.9 3.6 12.2c-1 3.2.1 6.2 2.9 7.2 6.8 2.4 14.2-5.4 14.3-16.2Z"/><path d="M3.3 20.7c3.1-5.7 7.4-9.5 13.4-12.4"/>
  {:else if name === 'grid'}<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>
  {:else if name === 'inbox'}<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 13h5l2 3h4l2-3h5"/>
  {:else if name === 'users'}<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/>
  {:else if name === 'calendar'}<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 10h18"/>
  {:else if name === 'bed'}<path d="M3 20v-9m0 5h18m0 4V9a2 2 0 0 0-2-2H9a2 2 0 0 0-2 2v7M3 11h4"/><path d="M7 11h5a2 2 0 0 1 2 2v3"/>
  {:else if name === 'wallet'}<rect x="3" y="5" width="18" height="15" rx="2"/><path d="M3 9h18M16 14h2"/>
  {:else if name === 'heart'}<path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8L12 21l8.8-8.6a5.5 5.5 0 0 0 0-7.8Z"/>
  {:else if name === 'sparkle'}<path d="m12 2 1.8 7.2L21 11l-7.2 1.8L12 20l-1.8-7.2L3 11l7.2-1.8L12 2ZM19 18l.6 2.4L22 21l-2.4.6L19 24l-.6-2.4L16 21l2.4-.6L19 18Z"/>
  {:else if name === 'filter'}<path d="M4 7h16M7 12h10M10 17h4"/>{:else if name === 'search'}<circle cx="10.8" cy="10.8" r="7.3"/><path d="m16.2 16.2 5 5"/>
  {:else if name === 'bell'}<path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9ZM10 21h4"/>
  {:else if name === 'menu'}<path d="M4 6h16M4 12h16M4 18h16"/>
  {:else if name === 'plus'}<path d="M12 5v14M5 12h14"/>
  {:else if name === 'arrow'}<path d="M5 12h14m-6-6 6 6-6 6"/>
  {:else if name === 'chevron'}<path d="m9 18 6-6-6-6"/>
  {:else if name === 'check'}<path d="m4 12 5 5L20 6"/>
  {:else if name === 'close'}<path d="M5 5 19 19M19 5 5 19"/>
  {:else if name === 'clock'}<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>
  {:else if name === 'refresh'}<path d="M20 11a8 8 0 0 0-14-5L4 8m0-4v4h4M4 13a8 8 0 0 0 14 5l2-2m0 4v-4h-4"/>
  {:else if name === 'download'}<path d="M12 3v12m-4-4 4 4 4-4M4 18v3h16v-3"/>
  {:else if name === 'shield'}<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z"/><path d="m9 12 2 2 4-4"/>
  {:else if name === 'chart'}<path d="M4 20V5m0 15h17M8 16v-5m5 5V8m5 8V4"/>
  {:else if name === 'document'}<path d="M6 3h9l4 4v14H6a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2Z"/><path d="M14 3v5h5M8 12h7M8 16h7"/>
  {:else if name === 'dots'}<circle cx="5" cy="12" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/>
  {/if}
</svg>
