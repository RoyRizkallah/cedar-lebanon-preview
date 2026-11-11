import { loadState, STORAGE_KEY } from './persist.js';
import { seed } from './seed.js';
import { homePage, staffById } from './people.js';

const browserStorage = typeof localStorage === 'undefined' ? null : localStorage;
const read = key => { try { return browserStorage?.getItem(key) ?? null; } catch { return null; } };
// With the local server, data lives on the server only; nothing is written to this browser's storage.
export const storage = { off: false };
const write = (key, value) => { if (storage.off) return; try { browserStorage?.setItem(key, value); } catch { /* private mode: keep working in memory */ } };

export const db = $state(loadState(read(STORAGE_KEY)));
// ?as=<staff id> opens the preview as that person (used for review links and screenshots).
const asParam = typeof location === 'undefined' ? null : new URLSearchParams(location.search).get('as');
export const session = $state({ staffId: staffById(asParam) ? asParam : read('cedar-rehab-staff') || 'amer', now: new Date() });

// Every change goes through commit so it is saved and the screen refreshes together.
export function commit(change) {
  const result = change(db);
  write(STORAGE_KEY, JSON.stringify($state.snapshot(db)));
  return result;
}

// The server sends a whole new view of the data; the screen follows it.
export function replaceState(next) {
  for (const key of Object.keys(db)) delete db[key];
  Object.assign(db, next);
}

export function switchStaff(staffId) {
  session.staffId = staffId;
  write('cedar-rehab-staff', staffId);
  if (typeof location !== 'undefined') location.hash = `#/${homePage(staffId)}`;
}

export function resetData() {
  const fresh = seed();
  for (const key of Object.keys(db)) delete db[key];
  Object.assign(db, fresh);
  write(STORAGE_KEY, JSON.stringify(fresh));
}
