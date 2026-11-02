<script>
  import { dialogFocus } from '../lib/dialogFocus.js';

  let { title = 'Sign', signerName = '', onsign, onclose } = $props();

  let name = $state(signerName);
  let canvas;
  let drawing = false;
  let hasInk = $state(false);
  let last = null;

  function point(event) {
    const box = canvas.getBoundingClientRect();
    return [(event.clientX - box.left) * (canvas.width / box.width), (event.clientY - box.top) * (canvas.height / box.height)];
  }
  function down(event) {
    try { canvas.setPointerCapture(event.pointerId); } catch { /* some pens and test pointers can't be captured; drawing still works */ }
    drawing = true;
    last = point(event);
  }
  function move(event) {
    if (!drawing) return;
    const ctx = canvas.getContext('2d');
    const next = point(event);
    ctx.lineWidth = 2.6; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.strokeStyle = '#1c1c1c';
    ctx.beginPath(); ctx.moveTo(...last); ctx.lineTo(...next); ctx.stroke();
    last = next;
    hasInk = true;
  }
  function up() { drawing = false; }
  function clear() { canvas.getContext('2d').clearRect(0, 0, canvas.width, canvas.height); hasInk = false; }
  function sign() {
    onsign({ name: name.trim(), at: new Date().toISOString(), image: canvas.toDataURL('image/png') });
  }
</script>

<div class="scrim" onclick={onclose} aria-hidden="true"></div>
<div class="dialog" use:dialogFocus={{ onClose: onclose }}>
  <div class="drawer-head"><div class="grow"><h2>{title}</h2><p class="muted" style="margin-top: 4px">Sign inside the box with a finger, pen or mouse.</p></div></div>
  <div class="drawer-body stack">
    <label class="field"><span>Name</span><input class="input" bind:value={name} /></label>
    <div>
      <canvas bind:this={canvas} width="900" height="300" style="width: 100%; height: 150px; border: 1px dashed var(--line-strong); border-radius: var(--r-md); background: #fff; touch-action: none; cursor: crosshair"
        onpointerdown={down} onpointermove={move} onpointerup={up} onpointercancel={up} aria-label="Signature area"></canvas>
      <div class="row between" style="margin-top: 6px"><span class="faint" style="font-size: 12px">Signed electronically with the date and time.</span><button class="btn ghost sm" type="button" onclick={clear}>Clear</button></div>
    </div>
  </div>
  <div class="drawer-foot">
    <button class="btn" type="button" onclick={onclose}>Cancel</button>
    <button class="btn primary" type="button" disabled={!hasInk || !name.trim()} onclick={sign}>Sign</button>
  </div>
</div>
