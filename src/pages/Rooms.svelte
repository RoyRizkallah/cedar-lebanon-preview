<script>
  import { act } from '../lib/act.js';
  import Icon from '../components/Icon.svelte';
  import Ring from '../components/Ring.svelte';
  import { db, session } from '../lib/store.svelte.js';
  import { canDo } from '../lib/people.js';
  import { ROOM_STATUSES, WINGS, roomBoard, setRoomStatus, addRoom, updateRoom, removeRoom } from '../lib/rooms.js';
  import { fmtDate } from '../lib/dates.js';
  import { dialogFocus } from '../lib/dialogFocus.js';
  import { say } from '../lib/ui.svelte.js';

  let { args = [] } = $props();
  const me = session.staffId;
  const manage = canDo(me, 'manageRooms');
  let editing = $state(null);
  let error = $state('');
  const board = $derived(roomBoard(db, session.now));
  const beds = $derived(board.flatMap(room => room.beds));
  const occupied = $derived(beds.filter(bed => bed.patient).length);
  const held = $derived(beds.filter(bed => bed.heldFor).length);
  const showNames = me !== 'rsa' || true;

  function run(action, message) {
    error = '';
    try { const result = action(); if (message) say(message); return result ?? true; } catch (e) { error = e.message; return null; }
  }
  function save() {
    const d = $state.snapshot(editing);
    const ok = d.isNew ? run(() => act('addRoom', d), `Room ${d.id} added`) : run(() => act('updateRoom', d.id, d), `Room ${d.id} updated`);
    if (ok) editing = null;
  }
</script>

<main class="content wide">
  <div class="page-head">
    <div><h1>Rooms & beds</h1><p>Who is in each bed, what is held for an admission, and whether the room is ready.</p></div>
    {#if manage}<div class="actions"><button class="btn primary" onclick={() => { error = ''; editing = { isNew: true, id: '', wing: 'Upper', beds: 2, access: 'Standard', notes: '' }; }}><Icon name="plus" size={16} />Add room</button></div>{/if}
  </div>

  <div class="house">
    <div class="occ-hero">
      <div class="grow">
        <span class="eyebrow">Occupied</span>
        <div class="big num">{occupied}<small>of {beds.length} beds</small></div>
        <div class="legend">
          <span><i class="k taken"></i>In a bed</span><span><i class="k held"></i>Held</span><span><i class="k free"></i>Free</span>
        </div>
      </div>
      <Ring value={beds.length ? Math.round((occupied / beds.length) * 100) : 0} size={78} stroke={10} label="Occupancy" />
    </div>
    <div class="mini"><Icon name="clock" size={18} /><div><strong class="num">{held}</strong><span>Held for admissions</span></div></div>
    <div class="mini"><Icon name="bed" size={18} /><div><strong class="num">{board.filter(room => room.status === 'Ready').reduce((sum, room) => sum + room.free, 0)}</strong><span>Free and ready</span></div></div>
    <div class="mini" class:attn={board.some(room => room.status !== 'Ready')}><Icon name="door" size={18} /><div><strong class="num">{board.filter(room => room.status !== 'Ready').length}</strong><span>Rooms not ready</span></div></div>
  </div>
  {#if error && !editing}<p class="error" role="alert" style="margin-bottom: 12px">{error}</p>{/if}

  <div class="plan">
    {#each WINGS as wing (wing)}
      {@const rooms = board.filter(room => (room.wing || 'Ground') === wing)}
      {#if rooms.length}
        {@const used = rooms.reduce((sum, room) => sum + room.beds.filter(bed => bed.patient).length, 0)}
        <section class="floor">
          <header class="floor-label">
            <span class="floor-mark">{wing[0]}</span>
            <div><h2>{wing} floor</h2><span class="faint">{rooms.length} rooms, {used} of {rooms.reduce((sum, room) => sum + room.beds.length, 0)} beds in use</span></div>
          </header>
          <div class="corridor">
            {#each rooms as room (room.id)}
              <article class="room" class:not-ready={room.status !== 'Ready'}>
                <header>
                  <div class="grow"><h3><span class="door"><Icon name="door" size={14} /></span>Room {room.id}</h3><span class="faint">{room.beds.length} {room.beds.length === 1 ? 'bed' : 'beds'}{room.access === 'Step-free' ? ', step-free' : ''}</span></div>
                  {#if manage}
                    <select class="status-select s-{room.status.toLowerCase()}" aria-label={`Room ${room.id} status`} value={room.status} onchange={event => { const value = event.currentTarget.value; if (!run(() => act('setRoomStatus', room.id, value), `Room ${room.id}: ${value}`)) event.currentTarget.value = room.status; }}>
                      {#each ROOM_STATUSES as status}<option>{status}</option>{/each}
                    </select>
                  {:else}<span class="pill {room.status === 'Ready' ? 'ok' : 'warn'}">{room.status}</span>{/if}
                </header>
                <div class="beds">
                  {#each room.beds as bed (bed.bed)}
                    {#if bed.patient}
                      <a class="bed taken" href={`#/patients/${bed.patient.id}`} title={bed.patient.fullName}>
                        <span class="pillow"></span>
                        {#if bed.label}<span class="bed-no">{bed.label}</span>{/if}
                        <strong>{bed.patient.fullName}</strong>
                        <span class="sub">Day {bed.day}{bed.plannedDischarge ? `, leaving ${fmtDate(bed.plannedDischarge)}` : ''}</span>
                      </a>
                    {:else if bed.heldFor}
                      <div class="bed held"><span class="pillow"></span>{#if bed.label}<span class="bed-no">{bed.label}</span>{/if}<strong>Held</strong><span class="sub">For {bed.heldFor}</span></div>
                    {:else}
                      <div class="bed free"><span class="pillow"></span>{#if bed.label}<span class="bed-no">{bed.label}</span>{/if}<strong>Free</strong><span class="sub">{room.status === 'Ready' ? 'Ready for admission' : room.status}</span></div>
                    {/if}
                  {/each}
                </div>
                {#if room.notes}<p class="room-note"><Icon name="pen" size={13} />{room.notes}</p>{/if}
                {#if manage}<footer><button class="btn sm ghost" onclick={() => { error = ''; editing = { ...$state.snapshot(room), isNew: false, beds: room.beds.length }; }}>Edit</button></footer>{/if}
              </article>
            {/each}
          </div>
        </section>
      {/if}
    {/each}
  </div>
</main>

{#if editing}
  <div class="scrim" onclick={() => { editing = null; }} aria-hidden="true"></div>
  <form class="dialog" use:dialogFocus={{ onClose: () => { editing = null; } }} onsubmit={event => { event.preventDefault(); save(); }}>
    <header class="drawer-head"><div class="grow"><h2>{editing.isNew ? 'Add room' : `Room ${editing.id}`}</h2></div></header>
    <div class="drawer-body stack">
      <div class="grid-2">
        <label class="field"><span>Room number</span><input class="input" bind:value={editing.id} disabled={!editing.isNew} /></label>
        <label class="field"><span>Beds</span><input class="input" type="number" min="1" max="4" bind:value={editing.beds} /></label>
      </div>
      <div class="grid-2">
        <label class="field"><span>Floor</span><select class="select" bind:value={editing.wing}>{#each WINGS as wing}<option>{wing}</option>{/each}</select></label>
        <label class="field"><span>Access</span><select class="select" bind:value={editing.access}><option>Standard</option><option>Step-free</option></select></label>
      </div>
      <label class="field"><span>Housekeeping note</span><input class="input" bind:value={editing.notes} /></label>
      {#if error}<p class="error" role="alert">{error}</p>{/if}
    </div>
    <footer class="drawer-foot">
      {#if !editing.isNew}<button class="btn ghost danger" type="button" style="margin-right: auto" onclick={() => { if (run(() => act('removeRoom', editing.id), `Room ${editing.id} removed`)) editing = null; }}>Remove room</button>{/if}
      <button class="btn" type="button" onclick={() => { editing = null; }}>Cancel</button><button class="btn primary" type="submit">Save</button>
    </footer>
  </form>
{/if}

<style>
  /* The house at a glance: one dark occupancy card, three small counters */
  .house { display: grid; grid-template-columns: minmax(340px, 1.6fr) repeat(3, minmax(0, 1fr)); gap: 10px; margin-bottom: 17px; }
  .occ-hero { display: flex; align-items: center; gap: 14px; padding: 17px 18px; border-radius: 20px; background: var(--hero); color: var(--on-ink); box-shadow: var(--shadow-2); position: relative; overflow: hidden; }
  .occ-hero::after { content: ""; position: absolute; right: -60px; top: -60px; width: 220px; height: 220px; border-radius: 50%; background: radial-gradient(circle, rgb(var(--lime-rgb) / 0.22), transparent 70%); pointer-events: none; }
  .occ-hero :global(.ring) { color: var(--on-ink); }
  .eyebrow { font-size: 12.5px; font-weight: 750; color: var(--on-ink-2); text-transform: uppercase; letter-spacing: 0.08em; }
  .big { font-size: 42px; font-weight: 800; letter-spacing: -0.05em; line-height: 1; margin: 6px 0 12px; color: var(--lime); }
  .big small { font-size: 15px; font-weight: 650; letter-spacing: 0; color: var(--on-ink-2); margin-left: 8px; }
  .legend { display: flex; gap: 10px; flex-wrap: wrap; font-size: 12px; color: var(--on-ink-2); font-weight: 650; }
  .legend span { display: inline-flex; align-items: center; gap: 6px; }
  .k { width: 12px; height: 12px; border-radius: 4px; display: inline-block; }
  .k.taken { background: var(--lime); }
  .k.held { background: #f2a33a; }
  .k.free { box-shadow: inset 0 0 0 1.5px var(--on-ink-2); }
  .mini { display: flex; flex-direction: column; justify-content: space-between; gap: 10px; padding: 14px; border-radius: 18px; background: var(--paper); box-shadow: var(--shadow-1); color: var(--text-2); }
  .mini > :global(svg) { width: 38px; height: 38px; padding: 9px; border-radius: 12px; background: var(--leaf); color: var(--moss); }
  .mini.attn > :global(svg) { background: var(--warn-soft); color: var(--warn); }
  .mini strong { display: block; font-size: 25px; font-weight: 800; letter-spacing: -0.04em; color: var(--text); line-height: 1; }
  .mini span { font-size: 13px; font-weight: 600; }

  /* Floor plan: each floor is a band, rooms sit along its corridor, beds are drawn as beds */
  .plan { display: flex; flex-direction: column; gap: 15px; }
  .floor { display: grid; grid-template-columns: 210px 1fr; gap: 13px; padding: 13px; border-radius: 22px; background: var(--subtle); box-shadow: inset 0 0 0 1px var(--line); }
  .floor-label { display: flex; flex-direction: column; gap: 8px; padding: 8px 6px; }
  .floor-label h2 { font-size: 19px; font-weight: 800; letter-spacing: -0.02em; }
  .floor-label .faint { font-size: 12.5px; }
  .floor-mark { width: 56px; height: 56px; border-radius: 18px; display: inline-flex; align-items: center; justify-content: center; background: var(--strong); color: var(--on-strong); font-size: 19px; font-weight: 800; }
  .corridor { display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 10px; position: relative; }
  .room { display: flex; flex-direction: column; background: var(--paper); border-radius: 16px; box-shadow: var(--shadow-1); overflow: hidden; border-top: 5px solid var(--lime); }
  .room.not-ready { border-top-color: #f2a33a; background: repeating-linear-gradient(-45deg, var(--paper) 0 14px, var(--subtle) 14px 28px); }
  .room header { display: flex; align-items: center; gap: 10px; padding: 10px 11px 8px; }
  .room h3 { display: flex; align-items: center; gap: 8px; font-size: 16px; font-weight: 800; letter-spacing: -0.01em; }
  .door { width: 26px; height: 26px; border-radius: 8px; display: inline-flex; align-items: center; justify-content: center; background: var(--sunk); color: var(--text-2); }
  .room .faint { font-size: 12px; }
  .beds { display: grid; grid-template-columns: repeat(auto-fill, minmax(118px, 1fr)); gap: 8px; padding: 2px 10px 10px; }
  .bed { position: relative; display: flex; flex-direction: column; gap: 1px; min-height: 96px; padding: 28px 10px 8px; border-radius: 16px 16px 10px 10px; color: inherit; text-decoration: none; min-width: 0; }
  .bed strong { font-size: 13px; font-weight: 750; line-height: 1.25; overflow: hidden; text-overflow: ellipsis; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; }
  .bed .sub { font-size: 11.5px; color: var(--text-2); }
  .pillow { position: absolute; top: 9px; left: 12px; right: 34px; height: 12px; border-radius: 6px; }
  .bed-no { position: absolute; top: 6px; right: 8px; width: 22px; height: 22px; border-radius: 7px; display: inline-flex; align-items: center; justify-content: center; font-weight: 800; font-size: 11px; }
  .bed.taken { background: var(--hero); color: var(--on-ink); box-shadow: var(--shadow-1); transition: transform 0.15s, box-shadow 0.15s; }
  .bed.taken:hover { transform: translateY(-2px); box-shadow: var(--shadow-2); text-decoration: none; }
  .bed.taken .sub { color: var(--on-ink-2); }
  .bed.taken .pillow { background: rgb(255 255 255 / 0.16); }
  .bed.taken .bed-no { background: var(--lime); color: var(--on-lime); }
  .bed.held { background: var(--warn-soft); box-shadow: inset 0 0 0 1.5px #f2a33a; }
  .bed.held .pillow { background: rgb(242 163 58 / 0.3); }
  .bed.held .bed-no { background: #f2a33a; color: #fff; }
  .bed.free { background: var(--paper); box-shadow: inset 0 0 0 1.5px var(--line-strong); }
  .bed.free .pillow { background: var(--sunk); }
  .bed.free .bed-no { background: var(--lime-soft); color: var(--moss); }
  .room-note { display: flex; gap: 6px; align-items: flex-start; margin: 0 10px 10px; font-size: 12.5px; color: var(--text-2); }
  .room-note :global(svg) { flex: none; margin-top: 2px; }
  .room footer { margin-top: auto; padding: 0 8px 8px; display: flex; justify-content: flex-end; }
  .status-select { height: 30px; border-radius: 999px; padding: 0 8px; border: 1px solid var(--line-strong); background: var(--paper); color: var(--text); font-size: 12px; font-weight: 700; }
  .status-select.s-ready { background: var(--ok-soft); color: var(--ok); border-color: transparent; }
  .status-select.s-cleaning { background: var(--warn-soft); color: var(--warn); border-color: transparent; }
  .status-select.s-maintenance { background: var(--urgent-soft); color: var(--urgent); border-color: transparent; }
  @media (max-width: 1200px) { .house { grid-template-columns: repeat(3, minmax(0, 1fr)); } .occ-hero { grid-column: 1 / -1; } }
  @media (max-width: 900px) {
    .floor { grid-template-columns: minmax(0, 1fr); padding: 10px; }
    .floor-label { flex-direction: row; align-items: center; }
    .corridor { grid-template-columns: minmax(0, 1fr); }
  }
  @media (max-width: 600px) { .house { grid-template-columns: minmax(0, 1fr); } .big { font-size: 33px; } }
</style>
