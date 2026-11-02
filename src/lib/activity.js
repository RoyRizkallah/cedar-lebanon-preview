// A plain, newest-first record of what happened and who did it.
export function log(state, by, text, link = '') {
  const item = { id: `AC-${Date.now().toString(36)}-${state.activity.length + 1}`, at: new Date().toISOString(), by, text, link };
  state.activity.unshift(item);
  if (state.activity.length > 400) state.activity.length = 400;
  return item;
}
