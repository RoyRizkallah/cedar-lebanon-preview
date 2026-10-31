<script>
  import Icon from './Icon.svelte';
  import { optionsFor, queryRows, downloadRows } from './registry.js';
  export let items = [];
  export let label = 'Records';
  export let fields = [];
  export let searchKeys = ['id','name'];
  export let dateKey = '';
  export let dateLabel = 'Date';
  export let sorts = [];
  export let scope = '';
  export let compact = false;
  export let columns = [];
  export let hint = '';
  let rows = [];
  export function getRows() { return rows; }
  export let pageSize = 0;
  let pageNumber = 1;
  $: { query; values; from; to; sort; items; pageSize; pageNumber=1; }
  $: totalPages = pageSize ? Math.max(1,Math.ceil(rows.length/pageSize)) : 1;
  $: pageRows = pageSize ? rows.slice((pageNumber-1)*pageSize,pageNumber*pageSize) : rows;
  let query='', values={}, from='', to='', sort=0, previousScope=scope;
  let expanded = false;
  $: if (scope !== previousScope) { reset(); previousScope=scope; }
  $: rows = queryRows(items,{query,values,from,to,sort},fields,searchKeys,dateKey,sorts);
  $: active = Object.values(values).filter(Boolean).length + (query.trim()?1:0) + (from?1:0) + (to?1:0);
  export function reset() { query=''; values={}; from=''; to=''; sort=0; }
</script>
<div class="registry" class:registry-compact={compact} role="region" aria-label={label + ' filters'}>
  <div class="registry-primary">
    <label class="registry-search"><span>Search {label.toLowerCase()}</span><div><Icon name="search" size={17}/><input type="search" placeholder="Search by name, reference or keyword" bind:value={query}/>{#if query}<button type="button" aria-label="Clear search" on:click={()=>query=''}><Icon name="close" size={14}/></button>{/if}</div></label>
    {#if sorts.length}<label class="registry-sort"><span>Sort by</span><select aria-label={label + ' sort order'} bind:value={sort}>{#each sorts as order,index}<option value={index}>{order.label}</option>{/each}</select></label>{/if}
    {#if columns.length}<button class="btn btn-outline registry-export" disabled={!rows.length} on:click={()=>downloadRows('cedar-'+label.toLowerCase().replaceAll(' ','-'),columns,rows)}><Icon name="download" size={15}/> Export view</button>{/if}
  </div>
  {#if fields.length || dateKey}<details class="registry-refine" bind:open={expanded}><summary><Icon name="filter" size={14}/><span>Filters</span>{#if active}<b>{active}</b>{/if}<span class="registry-refine-hint">{expanded ? 'Hide options' : `${fields.length + (dateKey ? 2 : 0)} options`}</span></summary><div class="registry-fields">
    {#each fields as field}<label><span>{field.label}</span><select aria-label={label + ' ' + field.label} value={values[field.id || field.key] || ''} on:change={event=>values={...values,[field.id || field.key]:event.currentTarget.value}}><option value="">Any</option>{#each optionsFor(items,field) as option}<option value={option}>{option}</option>{/each}</select></label>{/each}
    {#if dateKey}<div class="registry-dates" role="group" aria-label={dateLabel + ' range'}><label><span>{dateLabel} from</span><input type="date" aria-label={label + ' ' + dateLabel + ' from'} bind:value={from} max={to || undefined}/></label><label><span>{dateLabel} to</span><input type="date" aria-label={label + ' ' + dateLabel + ' to'} bind:value={to} min={from || undefined}/></label></div>{/if}
  </div></details>{/if}
  {#if from && to && from > to}<p class="registry-error" role="alert">The end date must be on or after the start date.</p>{/if}
  <div class="registry-result"><span role="status" aria-live="polite"><strong>{rows.length}</strong> of {items.length} {label.toLowerCase()}{active ? ' match' : ''}</span>{#if active || Number(sort)!==0}<button type="button" class="text-link" on:click={reset}>Reset view</button>{/if}</div>
  {#if active}<div class="registry-chips">{#if query.trim()}<button on:click={()=>query=''}>Search: {query}<Icon name="close" size={12}/></button>{/if}{#each fields.filter(field=>values[field.id || field.key]) as field}<button on:click={()=>values={...values,[field.id || field.key]:''}}>{field.label}: {values[field.id || field.key]}<Icon name="close" size={12}/></button>{/each}{#if from}<button on:click={()=>from=''}>From {from}<Icon name="close" size={12}/></button>{/if}{#if to}<button on:click={()=>to=''}>To {to}<Icon name="close" size={12}/></button>{/if}</div>{/if}
  {#if hint}<p class="registry-hint">{hint}</p>{/if}
</div>
{#if rows.length}<slot rows={pageRows}/>{#if pageSize && rows.length > 10}<nav class="registry-pagination" aria-label={label + ' pagination'}><span>{(pageNumber-1)*pageSize+1}–{Math.min(pageNumber*pageSize,rows.length)} of {rows.length} matching</span><label>Per page<select aria-label={label + ' per page'} bind:value={pageSize}>{#each [10,25,50] as size}<option value={size}>{size}</option>{/each}</select></label><div><button aria-label={'Previous page of ' + label.toLowerCase()} disabled={pageNumber<=1} on:click={()=>pageNumber-=1}>←</button><span>{pageNumber} / {totalPages}</span><button aria-label={'Next page of ' + label.toLowerCase()} disabled={pageNumber>=totalPages} on:click={()=>pageNumber+=1}>→</button></div></nav>{/if}{:else}<div class="registry-empty"><span><Icon name="search" size={22}/></span><h3>{items.length ? 'No matching records' : 'No records yet'}</h3><p>{items.length ? 'Try a different keyword or remove a filter to broaden this view.' : 'New records will appear here once they are added.'}</p>{#if active}<button class="btn btn-outline" on:click={reset}>Clear all filters</button>{/if}</div>{/if}
