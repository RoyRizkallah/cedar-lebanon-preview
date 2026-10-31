// Shared, pure list operations. Filtering never changes source records.
export const valueAt = (row, key) => typeof key === 'function' ? key(row) : String(key || '').split('.').reduce((value, part) => value?.[part], row);
export function optionsFor(items, field) {
  return field.options || [...new Set(items.flatMap(item => valueAt(item, field.key)).filter(value => value !== undefined && value !== null && value !== '').map(String))].sort((a,b) => a.localeCompare(b, undefined, {numeric:true}));
}
export function queryRows(items, {query='', values={}, from='', to='', sort=0} = {}, fields=[], searchKeys=[], dateKey='', sorts=[]) {
  const words = query.trim().toLocaleLowerCase().split(/\s+/).filter(Boolean);
  const result = items.filter(item => {
    const haystack = searchKeys.map(key => valueAt(item,key) ?? '').join(' ').toLocaleLowerCase();
    if (!words.every(word => haystack.includes(word))) return false;
    if (!fields.every(field => !values[field.id || field.key] || (Array.isArray(valueAt(item,field.key)) ? valueAt(item,field.key).map(String).includes(values[field.id || field.key]) : String(valueAt(item,field.key) ?? '') === values[field.id || field.key]))) return false;
    const date = String(valueAt(item,dateKey) ?? '').slice(0,10);
    return (!from || date >= from) && (!to || (!!date && date <= to));
  });
  const order = sorts[Number(sort)];
  if (order) result.sort((a,b) => {
    const av=valueAt(a,order.key), bv=valueAt(b,order.key);
    if (av == null || av === '') return bv == null || bv === '' ? 0 : 1;
    if (bv == null || bv === '') return -1;
    const comparison = typeof av === 'number' && typeof bv === 'number' ? av-bv : String(av).localeCompare(String(bv),undefined,{numeric:true,sensitivity:'base'});
    return comparison * (order.desc ? -1 : 1);
  });
  return result;
}
export function downloadRows(name, columns, rows) {
  const cell = value => '"' + String(value ?? '').replace(/^[=+@\t\r]/, "'$&").replaceAll('"','""') + '"';
  const content = [columns.map(column=>column.label), ...rows.map(row=>columns.map(column=>valueAt(row,column.key)))].map(row=>row.map(cell).join(',')).join('\r\n');
  const url=URL.createObjectURL(new Blob(['\uFEFF'+content],{type:'text/csv;charset=utf-8'}));
  const link=document.createElement('a'); link.href=url; link.download=name+'.csv'; link.click(); setTimeout(()=>URL.revokeObjectURL(url),1000);
}

// Make overflowing tables reachable by keyboard, without adding idle tab stops.
export function scrollRegion(node) {
  const update=()=>{const overflow=node.scrollWidth>node.clientWidth+1;node.toggleAttribute('data-overflow',overflow);if(overflow)node.tabIndex=0;else node.removeAttribute('tabindex');};
  const observer=new ResizeObserver(update);observer.observe(node);if(node.firstElementChild)observer.observe(node.firstElementChild);update();
  return {destroy(){observer.disconnect();}};
}
