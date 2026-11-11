# Local Backend Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the Cedar Rehab preview into a working system on this laptop. Staff sign in with their own password, every change is checked and saved by a server into one database file, uploaded files live on disk, and each person's browser receives only what their role may see.

**Architecture:**
- The server runs the same rule modules the browser uses (`src/lib/*.js`). Each change is sent as a named command, and the server applies it as the signed-in person, with the server's own clock.
- State stays one JSON document, versioned, in SQLite (`node:sqlite`), alongside users, sessions, an audit log and file metadata.
- Before sending state to a browser, the server reduces it to that person's view.
- Without a server (the static Netlify preview), the app keeps working exactly as today. The same `act()` call then runs locally.

**Tech Stack:** Node 24 (`node:http`, `node:sqlite`, `node:crypto`), Svelte 5 and Vite 7 (existing). No new npm dependencies.

**Spec:** Roy's request of 11 Nov 2026: "commit and push and start with the backend… do everything, you have a green light." The standing constraints come from the conversation: build locally first, ask before any hosting or deploy, and put in no real patient data until he says so.

## Global Constraints

- No new npm dependencies. Use `node:sqlite`, `node:crypto` and `node:http` only.
- The server listens on `127.0.0.1` only. No hosting, deploy or public exposure without Roy's explicit go-ahead.
- Data lives in `CEDAR_DATA` (default `D:/Cedar/data`), which is git-ignored. Nothing in `data/` is ever committed.
- Passwords are never stored, printed or committed in clear. They are hashed with scrypt (N=16384, r=8, p=1, 64-byte key, 16-byte salt).
- Session cookie `cedar_session`: random 32 bytes, stored hashed (SHA-256), HttpOnly, SameSite=Strict, 12-hour lifetime.
- Every POST must be `content-type: application/json`, except file upload, which carries `x-cedar-upload: 1`. Anything else gets 415.
- The static preview (no `/api`) behaves exactly as today. The full test suite and `scripts/walkthrough.mjs` keep passing in preview mode.
- File uploads are capped at 15 MB (413 above that).
- Temporary files go to D: (`TMP`/`TEMP` set to `D:/claude-tmp` when running checks), because C: is full.

## Review Focus

1. **Two staff change the same thing at once.** The server applies each command to its current state, in arrival order, and both browsers end up showing the server's state. Nothing is silently lost. Test: Task 4, "two sessions act in turn; both see both changes".
2. **The session expires mid-task.** `act` returns 401 and the browser shows the sign-in screen. The change is not applied anywhere, and nothing is half-saved. Test: Task 4, "expired session gets 401 and no audit row with ok=1".
3. **A crafted request names another person as the actor.** The server ignores any staff id the client sends in the actor position and always uses the session's user. Test: Task 4, "Georgio cannot act as Amer".
4. **Asking for a file one may not see.** `GET /api/files/:id` returns 404 unless the id appears in the caller's view. Test: Task 5, "Melyssa cannot fetch a prescription scan".
5. **A server restart.** Sessions, state and files survive. Test: Task 4, "state and session survive reopening the database".

---

### Task 1: Command registry and `act()`

**Files:**
- Create: `src/lib/commands.js`, `src/lib/act.js`
- Modify: `src/lib/store.svelte.js` (export a `replaceState(next)` helper)
- Test: `scripts/test-commands.mjs`

**Interfaces:**
- Produces:
  - `COMMANDS: Record<string, { fn, slots: Array<'arg'|'me'|'now'> }>` in `src/lib/commands.js`.
  - `applyCommand(state, name, args, staffId, now): any` in the same file.
    - It throws `Error('Unknown command: <name>')`.
    - It fills `'me'` with `staffId` and `'now'` with `now`, and passes `args` in order into the `'arg'` slots.
  - `act(name, ...args): any` in `src/lib/act.js`. Preview mode: `commit(state => applyCommand(state, name, args, session.staffId, session.now))`.
- Slots are derived from each function's own parameter list (top-level split of `fn.toString()`):
  - A parameter named `staffId` (or `by`) becomes `'me'`.
  - A parameter named `now` becomes `'now'`.
  - Every other parameter after `state` becomes `'arg'`.
- Register every state-changing function the UI calls (the ~90 found by grepping `state => fnName(` in `src/**/*.svelte`), plus `invoiceMonth` and `markAllRead`.
- `markRead` and `markAllRead` get wrapper commands that take `me`. A notification not addressed to the actor throws `Error('Not your notification.')`.

- [ ] **Step 1: Write `scripts/test-commands.mjs`.** It asserts:
  - `COMMANDS.recordDose.slots` deep-equals `['arg', 'me', 'now']`.
  - `COMMANDS.completeStep.slots` deep-equals `['arg', 'arg', 'arg', 'me', 'now']`.
  - `applyCommand(seed(now), 'reportIncident', [{ type: 'Aggression', level: 1, description: 'x' }], 'alaa', now).reportedBy === 'alaa'`.
  - `applyCommand(state, 'nope', [], 'amer', now)` throws `/Unknown command: nope/`.
  - Every UI call site name (read from the grep at test time) exists in `COMMANDS`.
  - `markRead` of Amer's notification by Melyssa throws `/Not your notification/`.
- [ ] **Step 2:** `node scripts/test-commands.mjs`. Expected: FAIL, because `src/lib/commands.js` is not found.
- [ ] **Step 3:** Implement `commands.js` and `act.js` as specified above.
- [ ] **Step 4:** `node scripts/test-commands.mjs`. Expected: `Command checks passed.`
- [ ] **Step 5:** Commit: `feat: name every change as a command the server can run`.

### Task 2: Route every UI change through `act()`

**Files:**
- Modify: every `src/**/*.svelte` and `src/App.svelte` call site that uses `commit(state => fn(state, …))` or `run(state => fn(state, …))`.
- Create (scratch only, not committed): the codemod script in `D:/claude-tmp`.
- Test: `scripts/test-commands.mjs` (extended) and the existing full suite plus the walkthrough.

**Interfaces:**
- Consumes `act(name, ...args)` from Task 1.
- Call-site rules:
  - `fn(state, A, B, me[, now])` becomes `act('fn', A, B)`. Drop the `me`/`session.staffId` and `session.now`/`now` arguments sitting in `'me'`/`'now'` slots.
  - A page's local `run(action, message)` helper now calls `action()` instead of `commit(action)`, and call sites pass `() => act(…)`.
  - A closure that makes several changes becomes one registered composite command in `commands.js`. For example, the Finance page's "invoice the month" loop becomes `invoiceMonthAll(state, month, staffId)`.

- [ ] **Step 1: Extend `test-commands.mjs`.** Grep `src/**/*.svelte` and `src/App.svelte` for `commit(`. Expected matches: zero outside `src/lib/store.svelte.js` and `src/lib/act.js`.
- [ ] **Step 2:** Run it. Expected: FAIL, listing the remaining call sites.
- [ ] **Step 3:** Apply the codemod, then hand-convert the compound closures it reports.
- [ ] **Step 4:** `npm run build && npm test`, then the walkthrough on a rebuilt server. Expected: build exit 0, `All N check files passed.`, `Walkthrough passed.`
- [ ] **Step 5:** Commit: `refactor: screens change data only through act()`.

### Task 3: Database, accounts and sessions

**Files:**
- Create: `server/store.mjs`, `server/auth.mjs`, `server/admin.mjs`
- Modify: `.gitignore` (add `data/`)
- Test: `scripts/test-server-store.mjs`

**Interfaces:**
- `openStore(dir): Store` in `server/store.mjs`. It creates `dir/cedar.db` with these tables:
  - `state(id INTEGER PRIMARY KEY CHECK(id=1), version INTEGER, json TEXT, updated_at TEXT)`
  - `users(staff_id TEXT PRIMARY KEY, hash TEXT, salt TEXT, disabled INTEGER DEFAULT 0, updated_at TEXT)`
  - `sessions(token_hash TEXT PRIMARY KEY, staff_id TEXT, expires_at TEXT)`
  - `audit(id INTEGER PRIMARY KEY, at TEXT, staff_id TEXT, command TEXT, args TEXT, ok INTEGER, error TEXT)`
  - `files(id TEXT PRIMARY KEY, name TEXT, type TEXT, size INTEGER, uploaded_by TEXT, at TEXT)`
- `Store` methods:
  - `getState() -> { version, state }`
  - `saveState(state) -> version`
  - `audit(row)`
  - `setPassword(staffId, password)`, which throws if the password is under 10 characters or `staffId` is not in `STAFF`/`RESIDENTS`
  - `checkPassword(staffId, password) -> boolean`
  - `createSession(staffId) -> token`
  - `sessionUser(token) -> staffId | null`, which deletes the session if it has expired
  - `endSession(token)`
  - `addFile(meta)` and `file(id)`
  - `close()`
- `server/admin.mjs` CLI:
  - `node server/admin.mjs init [--demo] [--dir D]` writes the first state: `seed()` with `--demo`, otherwise `seed()` with every patient-related collection emptied, keeping rooms and staff.
  - `node server/admin.mjs passwd <staffId>` reads the password from stdin.
  - `node server/admin.mjs users` lists accounts, never hashes.

- [ ] **Step 1: Write `scripts/test-server-store.mjs`** against a fresh temp dir. It checks:
  - Init with demo gives version 1 and 14 leads.
  - `setPassword('amer', 'short')` throws `/10 characters/`.
  - `setPassword('nobody', …)` throws `/Unknown staff/`.
  - `checkPassword` returns true for the right password and false for a wrong one.
  - The users table never contains the clear password.
  - A session token works, `endSession` ends it, and an expired one returns null.
  - After `close()` and `openStore(dir)` again, state version and sessions persist.
  - A real (non-demo) init has `patients.length === 0`, `inquiries.length === 0` and `rooms.length === 8`.
- [ ] **Step 2:** Run it. Expected: FAIL, because the module is not found.
- [ ] **Step 3:** Implement the three files.
- [ ] **Step 4:** Run it. Expected: `Server store checks passed.`
- [ ] **Step 5:** Commit: `feat: local database, hashed passwords and sessions`.

### Task 4: The API

**Files:**
- Create: `server/api.mjs`
- Modify: `server/index.mjs` (route `/api/*` to `api.mjs`, keep static serving, read `CEDAR_DATA`)
- Test: `scripts/test-server-api.mjs`

**Interfaces:**
- Consumes `openStore` and `applyCommand`, plus `viewFor` (Task 5). Until Task 5 lands, it uses an identity view.
- Routes:
  - `POST /api/login {staffId, password}` returns `{ staffId }` and sets the cookie.
    - After 5 failures for a staff id within 15 minutes, it returns 429 for the rest of the window.
    - A wrong password returns 401 with `{ error: 'Wrong name or password.' }`.
  - `POST /api/logout`
  - `GET /api/me` returns `{ staffId }` or 401.
  - `GET /api/state` returns `{ version, state: viewFor(state, me) }`.
  - `POST /api/act {name, args}`:
    - On success it returns `{ ok: true, result, version, state: view }`.
    - A rule error returns 400 `{ error: message }` and leaves state unchanged.
    - Either way it writes an audit row.
  - `GET /api/events` is SSE that sends `version <n>` on every save.
- Background jobs: every 60 s, `runInquiryAging`, `runFollowUpAlerts` and `runLeaveAlerts` run on server time. A save happens only when one of them changes something.
- Backup: on the first save of each calendar day, copy `cedar.db` to `dir/backups/cedar-YYYY-MM-DD.db`, keeping the newest 30.

- [ ] **Step 1: Write `scripts/test-server-api.mjs`.** It spawns the server on a free port with a temp `CEDAR_DATA` initialised with `--demo` and passwords for amer, melyssa and georgio, then asserts:
  - With no cookie, `/api/state` returns 401.
  - A wrong password returns 401, and the sixth attempt returns 429.
  - Melyssa logs in, and `act('createInquiry', [{ name: 'Test Person', program: 'Inpatient' }])` returns ok and bumps the version.
  - Georgio cannot act as Amer: an `approveOrder` with any args returns 400 `/Amer/`, because the actor is always the session user.
  - Two sessions act in turn, and both see both changes.
  - A `POST` with `content-type: text/plain` returns 415.
  - An expired session gets 401, and no audit row with ok=1 is written.
  - State and session survive a server restart.
- [ ] **Step 2:** Run it. Expected: FAIL, because the server has no `/api`.
- [ ] **Step 3:** Implement `api.mjs` and wire it into `index.mjs`.
- [ ] **Step 4:** Run it. Expected: `Server API checks passed.`
- [ ] **Step 5:** Commit: `feat: sign-in and server-run changes over a local API`.

### Task 5: Each person receives only their view, and files

**Files:**
- Create: `src/lib/view.js`
- Modify: `server/api.mjs` (use `viewFor`; add `POST /api/files` and `GET /api/files/:id`)
- Test: `scripts/test-view.mjs`, plus file cases added to `scripts/test-server-api.mjs`

**Interfaces:**
- `viewFor(state, staffId): State` returns a deep copy. The rules, all built on the existing `people.js` helpers:
  - `notifications`: only those `to === staffId`.
  - `forms`: an entry stays only if `canSeeTab(staffId, tabOf(family))`, where `tabOf` matches the PatientProfile mapping (aftercare to `followup`).
  - `medication`: emptied unless `canSee(staffId, 'medication') || canSeeTab(staffId, 'medical')`.
  - `documents`: `Prescription` documents are removed unless `canDo(staffId, 'viewPrescriptions')`.
  - `finance`: books are emptied unless `canSee(staffId, 'finance')`.
  - `incidents`: replaced by `incidentsFor(state, staffId)`.
  - `patients[].riskReviews`: removed unless `canDo(staffId, 'viewRisk')`.
  - Residents get only their own patient, wallet entries, requests and notifications, and every other collection empty.
- Files:
  - `POST /api/files` takes a raw body with `x-file-name` and `content-type` headers, writes `dir/files/<id>`, and returns `{ id, name }`.
  - `GET /api/files/:id` streams the file only if `JSON.stringify(viewFor(state, me))` contains the id. Otherwise it returns 404.

- [ ] **Step 1: Write `scripts/test-view.mjs`** on `seed(now)`. It asserts:
  - Melyssa's view has no form whose family is `clinical` and no prescription documents.
  - Georgio's view has empty `finance.invoices` and no `riskReviews`.
  - Nabila's view still has clinical forms.
  - Amer's notifications are all addressed to Amer.
  - The `resident-p0001` view has one patient, `P-0001`.
  - The input state is not mutated.
- Add to `test-server-api.mjs`:
  - Upload as Fadia and attach the file as a prescription document. Melyssa cannot fetch it (404); Fadia can (200, same bytes).
  - A 16 MB upload returns 413.
- [ ] **Step 2:** Run both. Expected: FAIL.
- [ ] **Step 3:** Implement `view.js` and the file routes.
- [ ] **Step 4:** Run both, then the full suite. Expected: `View checks passed.`, `Server API checks passed.`, `All N check files passed.`
- [ ] **Step 5:** Commit: `feat: each person's browser gets only what their role may see`.

### Task 6: The browser talks to the server

**Files:**
- Create: `src/lib/backend.svelte.js`, `src/pages/Login.svelte`, `scripts/smoke-server.mjs`
- Modify: `src/lib/act.js`, `src/lib/files.js`, `src/App.svelte`, `src/components/Topbar.svelte`, `src/lib/store.svelte.js`

**Interfaces:**
- `backend = $state({ on: false, checked: false, user: null })`.
- `startBackend()` calls `GET /api/me`:
  - A 404 or a network error means preview mode (`on: false`).
  - A 401 means `on: true` with no user, so the Login page shows.
  - A 200 loads `/api/state` into `db` (via `replaceState`) and opens `/api/events`.
- `act()` in server mode:
  1. Runs the command locally first for the immediate result. If that throws, the error is shown and nothing is sent.
  2. Posts the command.
  3. Replaces `db` with the returned view.
  4. A 400 response restores the server view and calls `say()` with the server's error. A 401 sets `backend.user = null`.
- `putFile` and `openFile` use `/api/files` when `backend.on`.
- `Topbar` in server mode hides "view as" and "reset data" and shows "Sign out".
- `App.sync()` skips the local jobs when `backend.on`, because the server runs them.
- `Login.svelte`: a staff name picker (the STAFF list) plus a password field. Errors come back in the server's words.

- [ ] **Step 1: Write `scripts/smoke-server.mjs`.** It starts the server with a demo temp dir and a password for Melyssa, then drives Chrome over CDP, the same way the walkthrough does:
  - The sign-in page shows.
  - A wrong password shows "Wrong name or password."
  - Melyssa signs in, creates an inquiry from Leads, and reloads; the inquiry is still there.
  - "Sign out" returns to sign-in.
- [ ] **Step 2:** Run it. Expected: FAIL, because there is no sign-in page.
- [ ] **Step 3:** Implement as above.
- [ ] **Step 4:** Run the smoke test, the full suite and the preview walkthrough. Expected: `Server smoke passed.`, `All N check files passed.`, `Walkthrough passed.`
- [ ] **Step 5:** Commit: `feat: sign in and work against the local server`.

### Task 7: Run book

**Files:**
- Modify: `README.md` (new section "Run with the local server")

- [ ] **Step 1:** Document four things:
  - The commands: `node server/admin.mjs init --demo`, `node server/admin.mjs passwd amer`, `npm run build`, `CEDAR_DATA=… node server/index.mjs 4180`.
  - Where data and backups live.
  - That it listens on this machine only.
  - That real patient data waits for Roy's go-ahead.
- [ ] **Step 2:** `npm test`. Expected: all pass.
- [ ] **Step 3:** Commit: `docs: how to run the local server`.
