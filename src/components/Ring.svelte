<script>
  // A single percentage as a ring, with the number written in the middle (one value, so no legend is needed).
  let { value = null, size = 120, stroke = 12, label = '', tone = 'lime' } = $props();
  const r = $derived((size - stroke) / 2);
  const c = $derived(2 * Math.PI * r);
  const shown = $derived(value === null ? 0 : Math.max(0, Math.min(100, value)));
</script>

<figure class="ring" style:width={`${size}px`} style:--num={`${Math.round(size * 0.24)}px`} style:--cap={`${Math.max(9, Math.round(size * 0.105))}px`} style:--inner={`${size - stroke * 2 - 6}px`} aria-label={`${label}: ${value === null ? 'no data' : `${value}%`}`}>
  <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="presentation">
    <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke-width={stroke} class="track" />
    <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke-width={stroke} class="fill tone-{tone}" stroke-linecap="round" stroke-dasharray={`${(shown / 100) * c} ${c}`} transform={`rotate(-90 ${size / 2} ${size / 2})`} />
  </svg>
  <figcaption><strong class="num">{value === null ? '—' : value}<small>{value === null ? '' : '%'}</small></strong>{#if label}<span>{label}</span>{/if}</figcaption>
</figure>

<style>
  .ring { position: relative; margin: 0; flex: none; }
  .track { stroke: rgb(127 140 127 / 0.18); }
  .fill { transition: stroke-dasharray 0.6s cubic-bezier(.2,.7,.2,1); }
  .tone-lime { stroke: var(--lime); filter: drop-shadow(0 0 6px rgb(var(--lime-rgb) / 0.45)); }
  .tone-ink { stroke: var(--strong); }
  .tone-warn { stroke: #f2a33a; }
  figcaption { position: absolute; inset: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; }
  /* Type scales with the ring, and the caption never spills past the stroke */
  strong { font-size: var(--num); font-weight: 800; letter-spacing: -0.03em; line-height: 1; }
  small { font-size: 0.5em; margin-left: 1px; opacity: 0.7; }
  span { max-width: var(--inner); font-size: var(--cap); font-weight: 650; opacity: 0.7; margin-top: 2px; line-height: 1.1; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
</style>
