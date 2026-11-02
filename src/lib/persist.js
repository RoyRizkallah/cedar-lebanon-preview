import { seed, SEED_VERSION } from './seed.js';

export const STORAGE_KEY = 'cedar-rehab-v1';
const COLLECTIONS = ['leads', 'inquiries', 'onboardings', 'patients', 'rooms', 'appointments', 'forms', 'documents', 'requests', 'tasks', 'notifications', 'activity', 'visits', 'leaves', 'incidents', 'checkins', 'comments', 'programs', 'programAssignments'];

// Accept only a saved copy of this workspace; anything else (the old preview, a damaged copy) starts fresh.
export function loadState(raw) {
  try {
    const stored = JSON.parse(raw);
    if (stored?.version === SEED_VERSION && COLLECTIONS.every(key => Array.isArray(stored[key])) && Array.isArray(stored.wallet?.transactions) && Array.isArray(stored.finance?.invoices) && Array.isArray(stored.medication?.orders)) return stored;
  } catch { /* fall through to fresh sample data */ }
  return seed();
}
