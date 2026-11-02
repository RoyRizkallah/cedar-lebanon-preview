<script>
  let { name = 'grid', size = 18, stroke = 1.8 } = $props();
</script>

<svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width={stroke} stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
  {#if name === 'grid'}<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>
  {:else if name === 'inbox'}<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 13h5l2 3h4l2-3h5"/>
  {:else if name === 'columns'}<rect x="3" y="4" width="5" height="16" rx="1.5"/><rect x="10" y="4" width="5" height="11" rx="1.5"/><rect x="17" y="4" width="4" height="7" rx="1.5"/>
  {:else if name === 'door'}<path d="M13 4h3a2 2 0 0 1 2 2v14M2 20h3m8 0h9"/><path d="M5 20V5.5a1 1 0 0 1 .8-1l6-1.3A1 1 0 0 1 13 4.2V20"/><path d="M10 12h.01"/>
  {:else if name === 'users'}<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/>
  {:else if name === 'user'}<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>
  {:else if name === 'calendar'}<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 10h18"/>
  {:else if name === 'bag'}<path d="M5 8h14l-1 13H6L5 8Z"/><path d="M9 8V6a3 3 0 0 1 6 0v2"/>
  {:else if name === 'wallet'}<rect x="3" y="5" width="18" height="15" rx="2"/><path d="M3 9h18M16 14h2"/>
  {:else if name === 'chart'}<path d="M4 20V5m0 15h17M8 16v-5m5 5V8m5 8V4"/>
  {:else if name === 'check'}<path d="m4 12 5 5L20 6"/>
  {:else if name === 'check-circle'}<circle cx="12" cy="12" r="9"/><path d="m8 12 3 3 5-6"/>
  {:else if name === 'circle'}<circle cx="12" cy="12" r="9"/>
  {:else if name === 'search'}<circle cx="10.8" cy="10.8" r="7.3"/><path d="m16.2 16.2 5 5"/>
  {:else if name === 'bell'}<path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9ZM10 21h4"/>
  {:else if name === 'menu'}<path d="M4 6h16M4 12h16M4 18h16"/>
  {:else if name === 'plus'}<path d="M12 5v14M5 12h14"/>
  {:else if name === 'chevron'}<path d="m9 18 6-6-6-6"/>
  {:else if name === 'chevron-left'}<path d="m15 18-6-6 6-6"/>
  {:else if name === 'chevron-down'}<path d="m6 9 6 6 6-6"/>
  {:else if name === 'close'}<path d="M6 6 18 18M18 6 6 18"/>
  {:else if name === 'clock'}<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>
  {:else if name === 'refresh'}<path d="M20 11a8 8 0 0 0-14-5L4 8m0-4v4h4M4 13a8 8 0 0 0 14 5l2-2m0 4v-4h-4"/>
  {:else if name === 'download'}<path d="M12 3v12m-4-4 4 4 4-4M4 18v3h16v-3"/>
  {:else if name === 'upload'}<path d="M12 16V4m-4 4 4-4 4 4M4 17v3h16v-3"/>
  {:else if name === 'document'}<path d="M6 3h9l4 4v14H6a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2Z"/><path d="M14 3v5h5M8 12h7M8 16h7"/>
  {:else if name === 'pen'}<path d="M4 20h4L19 9a2.8 2.8 0 0 0-4-4L4 16v4Z"/><path d="m13.5 6.5 4 4"/>
  {:else if name === 'dots'}<circle cx="5" cy="12" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/>
  {:else if name === 'alert'}<path d="M12 3 2 21h20L12 3Z"/><path d="M12 10v5M12 18h.01"/>
  {:else if name === 'flag'}<path d="M5 21V4m0 0h11l-2 4 2 4H5"/>
  {:else if name === 'lock'}<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/>
  {:else if name === 'pill'}<rect x="3" y="8.5" width="18" height="7" rx="3.5" transform="rotate(-45 12 12)"/><path d="m8.5 8.5 7 7"/>
  {:else if name === 'dumbbell'}<path d="M6 7v10M3 9.5v5M18 7v10M21 9.5v5M6 12h12"/>
  {:else if name === 'heart'}<path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8L12 21l8.8-8.6a5.5 5.5 0 0 0 0-7.8Z"/>
  {:else if name === 'send'}<path d="M21 3 10 14M21 3l-7 18-4-7-7-4 18-7Z"/>
  {:else if name === 'logout'}<path d="M15 4h4v16h-4M10 17l5-5-5-5M15 12H3"/>
  {:else if name === 'phone'}<path d="M5 3h4l2 5-2.5 1.5a11 11 0 0 0 6 6L16 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 5a2 2 0 0 1 2-2Z"/>
  {:else if name === 'phone-off'}<path d="M5 3h4l2 5-2.5 1.5a11 11 0 0 0 6 6L16 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 5a2 2 0 0 1 2-2Z"/><path d="M2 2l20 20" stroke-width="2.4"/>
  {:else if name === 'mail' || name === 'Email'}<rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 7 9 6 9-6"/>
  {:else if name === 'globe' || name === 'Website'}<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18"/>
  {:else if name === 'Phone'}<path d="M5 3h4l2 5-2.5 1.5a11 11 0 0 0 6 6L16 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 5a2 2 0 0 1 2-2Z"/>
  {:else if name === 'WhatsApp'}<path d="M4 20l1.3-4A8 8 0 1 1 8 18.7L4 20Z"/><path d="M9 9.5c0 2.5 2.5 5 5 5l1.2-1.2-2-1-.8.8a3 3 0 0 1-1.9-1.9l.8-.8-1-2L9 9.5Z"/>
  {:else if name === 'Instagram'}<rect x="3.5" y="3.5" width="17" height="17" rx="5"/><circle cx="12" cy="12" r="4"/><path d="M17.3 6.7h.01"/>
  {:else if name === 'Facebook'}<path d="M14 8h3V4h-3a4 4 0 0 0-4 4v3H7v4h3v6h4v-6h3l1-4h-4V8Z"/>
  {:else if name === 'filter'}<path d="M4 6h16M7 12h10M10 18h4"/>
  {:else if name === 'move'}<path d="M5 12h14m-4-4 4 4-4 4"/>
  {:else if name === 'sparkle'}<path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8L12 3Z"/><path d="M19 15.5l.7 1.8 1.8.7-1.8.7-.7 1.8-.7-1.8-1.8-.7 1.8-.7.7-1.8Z"/>
  {:else if name === 'mic'}<rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3"/>
  {:else if name === 'stop'}<rect x="6" y="6" width="12" height="12" rx="2"/>
  {:else if name === 'bed'}<path d="M2 20v-8a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v8"/><path d="M4 10V6a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v4"/><path d="M12 4v6M2 17h20"/>
  {:else if name === 'shield'}<path d="M12 21s7-3.5 7-9.5V5.5L12 3 5 5.5v6C5 17.5 12 21 12 21Z"/>
  {:else if name === 'sun'}<circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M4.9 4.9l1.4 1.4m11.4 11.4 1.4 1.4M2 12h2m16 0h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>
  {:else if name === 'moon'}<path d="M20 14.5A8 8 0 0 1 9.5 4 8 8 0 1 0 20 14.5Z"/>
  {:else if name === 'enter'}<path d="M9 10 4 15l5 5"/><path d="M20 4v7a4 4 0 0 1-4 4H4"/>
  {:else if name === 'print'}<path d="M6 9V3h12v6M6 18H4v-6a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v6h-2"/><rect x="6" y="14" width="12" height="7"/>
  {:else if name === 'funnel'}<path d="M3 4h18l-7 8.5V19l-4 2v-8.5L3 4Z"/>
  {:else if name === 'leaf'}<path d="M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.48 19 2c1 2 2 4.18 2 8 0 5.5-4.78 10-10 10Z"/><path d="M2 21c0-3 1.85-5.36 5.08-6C9.5 14.52 12 13 13 12"/>
  {:else if name === 'building'}<rect x="4" y="2" width="16" height="20" rx="2"/><path d="M9 22v-4h6v4M8 6h.01M16 6h.01M12 6h.01M12 10h.01M12 14h.01M16 10h.01M16 14h.01M8 10h.01M8 14h.01"/>
  {:else if name === 'receipt'}<path d="M4 2v20l2-1 2 1 2-1 2 1 2-1 2 1 2-1 2 1V2l-2 1-2-1-2 1-2-1-2 1-2-1-2 1Z"/><path d="M16 8h-6a2 2 0 1 0 0 4h4a2 2 0 1 1 0 4H8M12 17.5v-11"/>
  {:else if name === 'home'}<path d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1Z"/>
  {:else if name === 'stethoscope'}<path d="M4.8 2.3A.3.3 0 1 0 5 2H4a2 2 0 0 0-2 2v5a6 6 0 0 0 6 6 6 6 0 0 0 6-6V4a2 2 0 0 0-2-2h-1a.2.2 0 1 0 .3.3"/><path d="M8 15v1a6 6 0 0 0 6 6 6 6 0 0 0 6-6v-4"/><circle cx="20" cy="10" r="2"/>
  {:else if name === 'camera'}<path d="M4 8h3l2-3h6l2 3h3v11H4V8Z"/><circle cx="12" cy="13" r="3.5"/>
  {/if}
</svg>
