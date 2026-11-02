// Small shared UI state: the current route and a one-line confirmation toast.
export const route = $state({ page: '', args: [] });
export const toast = $state({ text: '', id: 0 });

export function readHash(hash) {
  const [page = '', ...args] = String(hash || '').replace(/^#\/?/, '').split('/').filter(Boolean).map(decodeURIComponent);
  return { page, args };
}

export function go(path) {
  if (typeof location !== 'undefined') location.hash = path.startsWith('#') ? path : `#/${path}`;
}

let timer;
export function say(text) {
  toast.text = text;
  toast.id += 1;
  clearTimeout(timer);
  timer = setTimeout(() => { toast.text = ''; }, 2600);
}

// A quick action chosen in the command palette, picked up by the page it opens.
export const intent = $state({ action: '' });
export function act(action, path) { intent.action = action; go(path); }
export const takeIntent = action => { if (intent.action !== action) return false; intent.action = ''; return true; };

// Light or dark, saved per browser; the first visit follows the device setting.
export const theme = $state({ mode: typeof document === 'undefined' ? 'light' : document.documentElement.dataset.theme || 'light' });
export function setTheme(mode) {
  theme.mode = mode;
  document.documentElement.dataset.theme = mode;
  try { localStorage.setItem('cedar-theme', mode); } catch { /* private mode */ }
}
