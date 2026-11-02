// Dates are local calendar days ('YYYY-MM-DD'); moments are ISO timestamps.
const pad = value => String(value).padStart(2, '0');

export const dayOf = date => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
export const todayISO = (now = new Date()) => dayOf(now);
// The local calendar day of a timestamp (a plain 'YYYY-MM-DD' passes through). Never slice an ISO timestamp: that gives the UTC day.
export const localDay = value => /^\d{4}-\d{2}-\d{2}$/.test(String(value)) ? String(value) : dayOf(new Date(value));
export const parseDay = iso => { const [y, m, d] = iso.slice(0, 10).split('-').map(Number); return new Date(y, m - 1, d, 12); };
export const addDays = (iso, n) => { const date = parseDay(iso); date.setDate(date.getDate() + n); return dayOf(date); };
export const daysBetween = (fromIso, toIso) => Math.round((parseDay(toIso) - parseDay(fromIso)) / 86400000);
export const hoursBetween = (a, b) => (new Date(b) - new Date(a)) / 3600000;
export const weekday = iso => parseDay(iso).getDay();
export const atTime = (iso, hhmm) => new Date(`${iso}T${hhmm}:00`).toISOString();
export const minutesOf = hhmm => { const [h, m] = hhmm.split(':').map(Number); return h * 60 + m; };
export const hhmm = minutes => `${pad(Math.floor(minutes / 60))}:${pad(minutes % 60)}`;

export const fmtDate = (iso, options = { day: 'numeric', month: 'short' }) => iso ? parseDay(localDay(iso)).toLocaleDateString('en-GB', options) : '';
export const fmtDay = iso => fmtDate(iso, { weekday: 'short', day: 'numeric', month: 'short' });
export const fmtDateTime = moment => moment ? new Date(moment).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '';
export const fmtTime = moment => new Date(moment).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });

export function fmtAgo(moment, now = new Date()) {
  const minutes = Math.max(0, Math.round((now - new Date(moment)) / 60000));
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return days < 30 ? `${days}d ago` : fmtDate(dayOf(new Date(moment)));
}

export function fmtDuration(hours) {
  if (hours < 1) return `${Math.max(1, Math.round(hours * 60))}m`;
  if (hours < 48) return `${Math.floor(hours)}h`;
  return `${Math.floor(hours / 24)}d`;
}
