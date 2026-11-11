// The local database: the workspace as one versioned document, accounts, sessions, the audit log and file records.
import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { randomBytes, scryptSync, timingSafeEqual, createHash } from 'node:crypto';
import { seed } from '../src/lib/seed.js';
import { STAFF, RESIDENTS } from '../src/lib/people.js';

const SESSION_HOURS = 12;
const SCRYPT = { N: 16384, r: 8, p: 1 };
const hashToken = token => createHash('sha256').update(token).digest('hex');
const derive = (password, salt) => scryptSync(password, salt, 64, SCRYPT);

// Everything about patients and money starts empty for real use; the house itself (rooms, programs) is kept.
const PATIENT_DATA = ['leads', 'inquiries', 'onboardings', 'patients', 'appointments', 'forms', 'documents', 'requests', 'tasks', 'notifications', 'activity', 'visits', 'leaves', 'incidents', 'checkins', 'comments', 'programAssignments', 'orders'];
export function initialState({ demo = false, now = new Date() } = {}) {
  const state = seed(now);
  if (demo) return state;
  for (const key of PATIENT_DATA) state[key] = [];
  state.wallet = { transactions: [] };
  state.finance = { invoices: [], expenses: [], manualEntries: [], bankEntries: [] };
  state.medication = { orders: [], doses: [], tests: [] };
  state.kitchenCeiling = null;
  for (const room of state.rooms) room.status = 'Ready';
  return state;
}

export function openStore(dir) {
  mkdirSync(dir, { recursive: true });
  const db = new DatabaseSync(join(dir, 'cedar.db'));
  db.exec(`
    PRAGMA journal_mode = WAL;
    CREATE TABLE IF NOT EXISTS state (id INTEGER PRIMARY KEY CHECK (id = 1), version INTEGER NOT NULL, json TEXT NOT NULL, updated_at TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS users (staff_id TEXT PRIMARY KEY, hash TEXT NOT NULL, salt TEXT NOT NULL, disabled INTEGER NOT NULL DEFAULT 0, updated_at TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS sessions (token_hash TEXT PRIMARY KEY, staff_id TEXT NOT NULL, expires_at TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS audit (id INTEGER PRIMARY KEY AUTOINCREMENT, at TEXT NOT NULL, staff_id TEXT, command TEXT, args TEXT, ok INTEGER, error TEXT);
    CREATE TABLE IF NOT EXISTS files (id TEXT PRIMARY KEY, name TEXT, type TEXT, size INTEGER, uploaded_by TEXT, at TEXT);
  `);
  const known = id => STAFF.some(person => person.id === id) || RESIDENTS.some(person => person.id === id);

  return {
    dir,
    getState() {
      const row = db.prepare('SELECT version, json FROM state WHERE id = 1').get();
      return row ? { version: row.version, state: JSON.parse(row.json) } : null;
    },
    saveState(state) {
      const now = new Date().toISOString();
      const current = db.prepare('SELECT version FROM state WHERE id = 1').get();
      const version = (current?.version || 0) + 1;
      db.prepare('INSERT INTO state (id, version, json, updated_at) VALUES (1, ?, ?, ?) ON CONFLICT(id) DO UPDATE SET version = excluded.version, json = excluded.json, updated_at = excluded.updated_at')
        .run(version, JSON.stringify(state), now);
      return version;
    },
    setPassword(staffId, password) {
      if (!known(staffId)) throw new Error(`Unknown staff id: ${staffId}`);
      if (String(password || '').length < 10) throw new Error('Passwords need at least 10 characters.');
      const salt = randomBytes(16);
      db.prepare('INSERT INTO users (staff_id, hash, salt, updated_at) VALUES (?, ?, ?, ?) ON CONFLICT(staff_id) DO UPDATE SET hash = excluded.hash, salt = excluded.salt, disabled = 0, updated_at = excluded.updated_at')
        .run(staffId, derive(password, salt).toString('hex'), salt.toString('hex'), new Date().toISOString());
      // A new password ends every session opened with the old one.
      db.prepare('DELETE FROM sessions WHERE staff_id = ?').run(staffId);
    },
    checkPassword(staffId, password) {
      const row = db.prepare('SELECT hash, salt, disabled FROM users WHERE staff_id = ?').get(String(staffId));
      if (!row || row.disabled) return false;
      const expected = Buffer.from(row.hash, 'hex');
      const given = derive(String(password || ''), Buffer.from(row.salt, 'hex'));
      return given.length === expected.length && timingSafeEqual(given, expected);
    },
    users: () => db.prepare('SELECT staff_id, disabled, updated_at FROM users ORDER BY staff_id').all(),
    disable: staffId => { db.prepare('UPDATE users SET disabled = 1 WHERE staff_id = ?').run(staffId); db.prepare('DELETE FROM sessions WHERE staff_id = ?').run(staffId); },
    createSession(staffId, from = new Date()) {
      const token = randomBytes(32).toString('base64url');
      const expires = new Date(from.getTime() + SESSION_HOURS * 3600 * 1000).toISOString();
      db.prepare('INSERT INTO sessions (token_hash, staff_id, expires_at) VALUES (?, ?, ?)').run(hashToken(token), staffId, expires);
      return token;
    },
    sessionUser(token) {
      if (!token) return null;
      const row = db.prepare('SELECT staff_id, expires_at FROM sessions WHERE token_hash = ?').get(hashToken(token));
      if (!row) return null;
      if (row.expires_at <= new Date().toISOString()) { db.prepare('DELETE FROM sessions WHERE token_hash = ?').run(hashToken(token)); return null; }
      return row.staff_id;
    },
    endSession: token => { if (token) db.prepare('DELETE FROM sessions WHERE token_hash = ?').run(hashToken(token)); },
    audit({ staffId, command, args, ok, error = '' }) {
      db.prepare('INSERT INTO audit (at, staff_id, command, args, ok, error) VALUES (?, ?, ?, ?, ?, ?)').run(new Date().toISOString(), staffId || null, command, JSON.stringify(args ?? null), ok ? 1 : 0, error);
    },
    auditRows: (limit = 100) => db.prepare('SELECT * FROM (SELECT * FROM audit ORDER BY id DESC LIMIT ?) ORDER BY id').all(limit),
    addFile: meta => db.prepare('INSERT INTO files (id, name, type, size, uploaded_by, at) VALUES (?, ?, ?, ?, ?, ?)').run(meta.id, meta.name, meta.type, meta.size, meta.uploadedBy, new Date().toISOString()),
    file: id => db.prepare('SELECT * FROM files WHERE id = ?').get(String(id)) || null,
    // A consistent copy of the database file, for the daily backup.
    backup: target => db.exec(`VACUUM INTO '${target.replace(/'/g, "''")}'`),
    close: () => db.close()
  };
}
