// Readable, sequential ids per record type: INQ-0007, P-0012 …
export function nextId(prefix, list = []) {
  const top = list.reduce((max, item) => {
    const match = String(item?.id || '').match(new RegExp(`^${prefix}-(\\d+)$`));
    return match ? Math.max(max, Number(match[1])) : max;
  }, 0);
  return `${prefix}-${String(top + 1).padStart(4, '0')}`;
}
