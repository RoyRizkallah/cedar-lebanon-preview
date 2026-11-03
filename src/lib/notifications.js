// In-app notifications. Urgent ones also record the email and WhatsApp copies waiting to be sent.
import { reachableLink } from './people.js';
export const URGENT_CHANNELS = ['In-app', 'Email (queued)', 'WhatsApp (queued)'];

// Each person's link only goes where they can look; the body carries the facts either way.
export function notify(state, { to, title, body = '', link = '', fallback = '', urgent = false, channels }) {
  const recipients = [...new Set([to].flat().filter(Boolean))];
  const at = new Date().toISOString();
  return recipients.map(recipient => {
    const item = { id: `N-${Date.now().toString(36)}-${state.notifications.length + 1}`, to: recipient, title, body, link: reachableLink(recipient, link, fallback), urgent, channels: channels || (urgent ? URGENT_CHANNELS : ['In-app']), at, read: false };
    state.notifications.unshift(item);
    return item;
  });
}

export const notificationsFor = (state, staffId) => state.notifications.filter(item => item.to === staffId).sort((a, b) => String(b.at).localeCompare(String(a.at)));
export const unreadFor = (state, staffId) => state.notifications.filter(item => item.to === staffId && !item.read).length;
export function markRead(state, id) { const item = state.notifications.find(entry => entry.id === id); if (item) item.read = true; }
export function markAllRead(state, staffId) { for (const item of state.notifications) if (item.to === staffId) item.read = true; }
