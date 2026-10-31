<script>
  import { onMount } from 'svelte';
  import Icon from './Icon.svelte';
  import { sidebarConfig } from './sidebarConfig.js';
  import { canViewPage, visiblePatients } from './roles.js';
  import { dialogFocus } from './dialogFocus.js';
  export let role;
  export let staff;
  export let patients;
  export let onNavigate;
  export let onPatient;
  let open = false;
  let query = '';
  let active = 0;
  $: pages = sidebarConfig[role].sections.flatMap(section => section.items.map(([id, title, icon]) => ({ id, title, icon, detail:section.label, kind:'Page' })));
  $: people = canViewPage(role, 'patients') ? visiblePatients(role,patients,staff).filter(p=>p.status!=='Archived').map(p=>({id:p.id,title:p.name,icon:'users',detail:`${p.id} · ${p.program}`,kind:'Patient'})) : [];
  $: results = (query.trim() ? [...pages,...people].filter(item=>`${item.title} ${item.detail}`.toLowerCase().includes(query.trim().toLowerCase())) : pages).slice(0,9);
  function launch(){query='';active=0;open=true;}
  function choose(item){if(!item)return;open=false;if(item.kind==='Patient')onPatient(item.id,'Overview');else onNavigate(item.id);}
  function handleKeys(event){
    if(event.key==='ArrowDown'||event.key==='ArrowUp'){event.preventDefault();active=(active+(event.key==='ArrowDown'?1:-1)+results.length)%Math.max(1,results.length);document.getElementById(`quick-result-${active}`)?.scrollIntoView({block:'nearest'});}
    if(event.key==='Enter'){event.preventDefault();choose(results[active]);}
  }
  onMount(()=>{const shortcut=event=>{if((event.ctrlKey||event.metaKey)&&event.key.toLowerCase()==='k'){event.preventDefault();if(document.querySelector('[aria-modal="true"]')&&!open)return;open?open=false:launch();}};window.addEventListener('keydown',shortcut);return()=>window.removeEventListener('keydown',shortcut);});
</script>

<button class="workspace-search-trigger" aria-label="Search workspace" aria-haspopup="dialog" on:click={launch}><Icon name="search" size={16}/><span>Find a page{canViewPage(role,'patients')?' or patient':''}</span><kbd>Ctrl K</kbd></button>
{#if open}
<div class="workspace-search-overlay" role="presentation" on:click={event=>{if(event.target===event.currentTarget)open=false;}}>
  <div class="workspace-search-dialog" use:dialogFocus={{onClose:()=>open=false}} aria-label="Search workspace">
    <div class="workspace-search-input"><Icon name="search" size={21}/><input data-autofocus aria-label={canViewPage(role,'patients') ? 'Find a page or patient' : 'Find a page'} role="combobox" aria-autocomplete="list" aria-expanded="true" aria-controls="workspace-search-results" aria-activedescendant={results.length ? `quick-result-${active}` : undefined} placeholder="Where would you like to go?" bind:value={query} on:input={()=>active=0} on:keydown={handleKeys}/><button aria-label="Close search" on:click={()=>open=false}><Icon name="close" size={18}/></button></div>
    <div class="workspace-search-caption">{query.trim()?'MATCHING RESULTS':'QUICK NAVIGATION'}<span>{role} workspace</span></div>
    <div class="workspace-search-results" id="workspace-search-results" role="listbox" aria-label="Search results">
      {#each results as item,index}<button role="option" aria-selected={index===active} id="quick-result-{index}" class:highlighted={index===active} on:click={()=>choose(item)}><span class="workspace-search-result-icon"><Icon name={item.icon} size={19}/></span><span><strong>{item.title}</strong><small>{item.detail}</small></span><span class="workspace-search-kind">{item.kind}</span><Icon name="arrow" size={15}/></button>{:else}<div class="workspace-search-empty"><Icon name="search" size={25}/><strong>No results for “{query}”</strong><p>Try a page name{people.length?', patient name or record ID':''}.</p></div>{/each}
    </div>
    <div class="workspace-search-foot"><span><kbd>↑</kbd><kbd>↓</kbd> to navigate <kbd>↵</kbd> to open</span><span><kbd>esc</kbd> to close</span></div>
  </div>
</div>
{/if}
