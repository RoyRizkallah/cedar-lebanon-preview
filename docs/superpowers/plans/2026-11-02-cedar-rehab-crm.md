# Cedar Rehab CRM Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the Cedar Lebanon preview with a clean Cedar Rehab CRM built around the owner's 14 forms and the 2026-10-31 meeting requirements.

**Architecture:** Svelte 5 + Vite single-page app, hash-routed. All business rules live in plain JS modules under `src/lib/` that take and return plain data, so Node tests can run them without a browser. Svelte pages under `src/pages/` read one reactive store and call those modules. Forms are data (schemas) drawn by one renderer.

**Tech Stack:** Svelte 5, Vite 7, Node 24 test scripts (`node:assert`), headless Chrome for screenshots. No new dependencies.

**Spec:** `docs/superpowers/specs/2026-11-02-cedar-rehab-crm-design.md`

## Global Constraints

- Brand: "Cedar Rehab". Tagline: "Addiction Rehabilitation & Prevention Center".
- Colours: ink `#1C1C1C`, lime `#7CFC00` (fills only, ink text on it), link and focus `#2F6B00`.
- Staff names exactly: Ahmed, Clinical Director, Nabila, Fadia, Melyssa, John, RSA team. Named recipients: Wael, Shady.
- Pipeline stages exactly: `New Inquiry`, `Assessment`, `Agreement`. Outcomes: `Admitted`, `Declined`.
- Programs exactly: `Inpatient`, `Outpatient`, `Detox`, `Detox + Inpatient`.
- Communication preferences exactly: `Phone call`, `WhatsApp`, `Email`, `Not comfortable talking on the phone`.
- Lead channels exactly: `WhatsApp`, `Instagram`, `Facebook`, `Email`, `Website`, `Phone`.
- Potential revenue: a number, defaulting to 0, never empty.
- Form labels are copied verbatim from the .docx files (extracted text: see Task 2).
- localStorage key `cedar-rehab-v1`; IndexedDB database `cedar-rehab-files`.
- Clinical forms are never readable by `melyssa` or `rsa`.
- No new npm dependencies.

## Review Focus

1. Dropping a pipeline card on its own column, or dropping twice quickly, must not add stage history or reset time in stage. Test this in Task 4: `moveInquiry` to the same stage is a no-op.
2. Old `cedar-demo-v1` data in a reviewer's browser must not crash the new app. The store ignores it and seeds fresh. Test this in Task 1 (`loadState` with a foreign or corrupt payload returns the seed).
3. Booking the earliest slot when the provider's day is full, or on Sunday, must roll to the next working day and never overlap. Test this in Task 5.
4. A required signature or field left empty must block "Sign & file" with a message, but saving a draft must still work. Test this in Task 2 (`validateForm` distinguishes draft from final).
5. A purchase that exceeds the wallet balance must be refused and the request stays open. Test this in Task 8.

---

### Task 1: Foundation: brand, store, people, access, app shell

**Files:**
- Create: `public/logo.png` (≈640 px wide), `public/logo-mark.png` (the tree mark only, 128 px), `public/favicon.png`, all from `logo.jpg` with PIL.
- Create: `src/lib/dates.js`, `src/lib/store.js`, `src/lib/seed.js`, `src/lib/people.js`, `src/lib/ids.js`
- Create: `src/styles/tokens.css`, `src/styles/base.css`, `src/styles/components.css`
- Create: `src/App.svelte` (replaces the old one), `src/components/Sidebar.svelte`, `src/components/Topbar.svelte`, `src/components/Icon.svelte` (keep the existing icon set and add `whatsapp`, `instagram`, `facebook`, `mail`, `globe`, `phone`, `pen`, `upload`, `alert`, `pill`, `dumbbell`, `flag`)
- Keep: `src/lib/registry.js` (moved from `src/registry.js`), `src/lib/dialogFocus.js` (moved)
- Delete: every other file under `src/`, and `scripts/test-*.mjs` plus `scripts/check-*.mjs` and `scripts/browser-qa.mjs`. First copy the whole old `src/` and `scripts/` to `.agent-work/pre-rebuild-20261102/`.
- Test: `scripts/test-foundation.mjs`

**Interfaces (produces):**
- `dates.js`: `todayISO(): string`, `addDays(iso, n): string`, `hoursBetween(isoA, isoB): number`, `fmtDate(iso): string`, `fmtDateTime(iso): string`, `fmtAgo(isoDateTime, now?): string`
- `ids.js`: `nextId(prefix: string, list: {id}[]): string` (for example `INQ-0007`)
- `people.js`: `STAFF: {id, name, title, initials}[]` (ids: `ahmed`, `clinical-director`, `nabila`, `fadia`, `melyssa`, `john`, `rsa`); `PAGES` (ids: `dashboard`, `today`, `leads`, `pipeline`, `admissions`, `patients`, `schedule`, `requests`); `canSee(staffId, page): boolean`; `canSeeTab(staffId, tab): boolean` for tabs `overview`, `clinical`, `followup`, `medical`, `fitness`, `documents`, `wallet`; `canDo(staffId, action): boolean`; `visiblePatients(state, staffId)`. The matrix is copied from the spec's Access table.
- `store.js`: `state` (Svelte `$state` object exported from a `.svelte.js` module, so the file is `src/lib/store.svelte.js`), `loadState(raw?: string): State`, `persist()`, `resetState()`, `session.staffId`
- `seed.js`: `seed(now = new Date()): State`, where State is `{ version: 1, leads, inquiries, onboardings, patients, rooms, appointments, forms, documents, wallet: {transactions}, requests, tasks, notifications, activity }`. It holds fictional people only: 14 leads across all 6 channels, 9 inquiries across the 3 stages (1 urgent, 1 over 48 h), 2 onboardings, 8 admitted patients, 12 rooms × 2 beds, a week of appointments, and a few filed forms so the KPIs are not empty.

- [ ] **Step 1: Back up the old tree and generate the logo assets.** Run `cp -r src scripts .agent-work/pre-rebuild-20261102/`, then a PIL script (in the scratchpad) that writes the 3 PNGs. Check: the three files exist and `logo.png` is under 120 KB.
- [ ] **Step 2: Write the failing test** `scripts/test-foundation.mjs` asserting:
  - `canSee('melyssa','leads') === true`, `canSee('rsa','pipeline') === false`, `canSee('ahmed','dashboard') === true`, `canSee('john','dashboard') === false`
  - `canSeeTab('melyssa','clinical') === false`, `canSeeTab('rsa','clinical') === false`, `canSeeTab('nabila','clinical') === true`, `canSeeTab('john','fitness') === true`, `canSeeTab('melyssa','followup') === true`
  - `canDo('melyssa','bookPsychologist') === false`
  - `loadState('{"inquiries":[1]}')` and `loadState('not json')` both equal a fresh seed's shape (`version === 1`, `leads.length === 14`)
  - every seed inquiry has `typeof potentialRevenue === 'number'`
  - SSR-rendering `App.svelte` for each staff id (via the vite `ssrLoadModule` pattern from the old `test-workspace.mjs`) contains that person's name, and contains "Leads" only for `ahmed` and `melyssa`
- [ ] **Step 3: Run it.** `node scripts/test-foundation.mjs`. Expected: FAIL (modules missing).
- [ ] **Step 4: Implement the modules, styles and shell.**
  - The shell routes on `location.hash` (`#/pipeline`, `#/patients/P-0003/clinical`).
  - The sidebar shows the logo, then the pages the current profile can see, with live counts.
  - The top bar has global search (patients and inquiries; Ctrl/⌘K), the notification bell, and the profile switcher labelled "Preview: viewing as".
- [ ] **Step 5: Run it.** Expected: `Foundation checks passed.`
- [ ] **Step 6: Update `package.json` scripts** to `test` = run every `scripts/test-*.mjs` in sequence. Run `npm run build`. Expected: build succeeds.

### Task 2: Forms engine, 14 schemas, renderer, signature pad

**Files:**
- Create: `src/lib/forms/engine.js`, `src/lib/forms/clinical.js`, `src/lib/forms/fitness.js`
- Create: `src/components/FormView.svelte`, `src/components/SignaturePad.svelte`, `src/components/FormList.svelte`
- Test: `scripts/test-forms.mjs`

**Interfaces (produces):**
- Field shape: `{ id, label, type: 'text'|'notes'|'date'|'time'|'number'|'one'|'all'|'lmh'|'scale5'|'auto'|'signature'|'photo'|'table', options?, unit?, hint?, required?, columns? (table), rows? (fixed table rows), compute? (auto) }`
- Section shape: `{ title, fields, gate?: { field, equals } }`. A gated section stays locked until `values[field] === equals`.
- Form shape: `{ id, family: 'clinical'|'fitness', number, title, purpose (verbatim italic line), owner: staffId[], rule? (verbatim footnote), header: Field[], sections }`
- `CLINICAL_FORMS` (ids `intake`, `plan`, `session`, `group`, `review`, `family`, `discharge`, `aftercare`) and `FITNESS_FORMS` (ids `clearance`, `attendance`, `injury`, `wellbeing`, `progress`, `nutrition`)
- `engine.js`: `formById(id)`, `computeAuto(form, values, ctx): values` (BMI = kg / (cm/100)², 1 decimal); `isSectionLocked(section, values): boolean`; `validateForm(form, values, {final}): string[]` (final requires all signature fields and every `required` field; a draft requires nothing); `fileForm(state, {formId, patientId, values, staffId, final})`, which appends to `state.forms` and applies the side effects below; `riskLevel(state, patientId): 'Low'|'Medium'|'High'|null` (latest intake risk or review-down entry).
- Side effects in `fileForm`:
  - `intake`: any Medium or High risk → notify `ahmed`.
  - `session`: a non-"None" risk flag → notify `ahmed`, plus `fadia` when the escalation text mentions Fadia.
  - `discharge`: create 3 `followup-call` tasks for `melyssa` at +7, +30 and +90 days from the discharge date.
  - `aftercare`: any "routed" box other than "Not needed" → notify `clinical-director`.
  - `injury`: "Significant" or "Escalated to Fadia = Yes" → notify `fadia`.
  - `nutrition`: "Requirements sent to kitchen = Yes" → activity "Requirements sent to Shady".
- Uses `notify(state, {to, title, link, urgent?})` from Task 3's `src/lib/notifications.js`. Create that file here with only `notify` and `unreadFor(state, staffId)`; Task 3 extends it.

- [ ] **Step 1: Write the schemas.** Use the extracted text of both documents (re-extract with the python-docx command in `scripts/extract-forms.py`, also added in this task) as the source for every label and option. Group the fitness Form 1 sections as gate one, gate two `{gate:{field:'medicallyCleared', equals:'Yes'}}`, and activity plan (same gate).
- [ ] **Step 2: Write the failing test** `scripts/test-forms.mjs` asserting:
  - `CLINICAL_FORMS.length === 8`, `FITNESS_FORMS.length === 6`
  - the intake form has fields labelled exactly `Self-harm / suicide risk`, `Absconding risk`, `Aggression risk`, all of type `lmh`
  - session form `Attendance` options deep-equal `['Attended','Refused','Rescheduled']`
  - `computeAuto(clearance, {weight:80, height:180}).bmi === 24.7`
  - `isSectionLocked(clearance.sections[1], {medicallyCleared:'No'}) === true` and `false` for `'Yes'`
  - `validateForm(sessionForm, {}, {final:false})` is `[]`; with `{final:true}` it includes `'Therapist signature is required.'`
  - filing an intake with Aggression = High adds 1 notification to `ahmed`, and `riskLevel()` returns `'High'`
  - filing a discharge dated `2026-11-10` creates tasks due `2026-11-17`, `2026-12-10` and `2027-02-08`
- [ ] **Step 3: Run it.** `node scripts/test-forms.mjs`. Expected: FAIL.
- [ ] **Step 4: Implement `engine.js`, then `FormView.svelte`.**
  - `FormView` renders header fields in one row, then sections, tag-appropriate inputs, the purpose line under the title and the rule as a footnote.
  - Locked sections are shown dimmed with "Unlocks when …".
  - Buttons: "Save draft" and "Sign & file".
  - Filed forms are read-only, with "Add review entry" for table-type review sections (Form 2 monthly reviews).
  - `SignaturePad` uses pointer events on a canvas, stores a PNG data URL, has a "Clear" button, and records the signer's name and time.
- [ ] **Step 5: Run it.** Expected: `Forms checks passed.`

### Task 3: Lead inbox and notifications

**Files:**
- Create: `src/lib/leads.js`, `src/pages/Leads.svelte`, `src/components/Notifications.svelte`; extend `src/lib/notifications.js`
- Test: `scripts/test-leads.mjs`

**Interfaces (produces):**
- Lead: `{ id, channel, name, handle, receivedAt, status: 'New'|'Replied'|'Converted'|'Closed', messages: {from:'lead'|'staff', by?, at, text, delivery?}[], inquiryId? }`
- `replyToLead(state, leadId, text, staffId)`: appends a staff message with `delivery: 'Queued on <channel>'`; status becomes Replied.
- `convertLead(state, leadId, fields, staffId) → inquiry`: calls `createInquiry` from Task 4; the lead becomes Converted and is linked.
- `closeLead(state, leadId, reason, staffId)`
- `leadStats(state, now) → { today, unanswered, medianFirstResponseMins, byChannel: {channel: count} }`
- `notifications.js`: `notify(state, {to: staffId|staffId[], title, body?, link, urgent?, channels?})`. Default channels are `['In-app']`; urgent adds `'Email (queued)'` and `'WhatsApp (queued)'`. Also `unreadFor`, `markRead(state, id)`, `markAllRead(state, staffId)`.

- [ ] **Step 1: Write the failing test** asserting:
  - `leadStats` on the seed counts all 6 channels
  - a reply sets status Replied, and the message `delivery` is `'Queued on Instagram'` for an Instagram lead
  - converting sets status Converted and creates an inquiry in `New Inquiry` with `potentialRevenue === 0` and source = the lead's channel
  - an urgent notify to `['ahmed','melyssa']` creates 2 notifications whose `channels` deep-equal `['In-app','Email (queued)','WhatsApp (queued)']`
- [ ] **Step 2: Run it.** Expected: FAIL.
- [ ] **Step 3: Implement the modules and the page.**
  - Leads page: a two-pane inbox (list left, thread right; a single pane with back on mobile). Channel chips with counts, a status filter and search.
  - The stats strip above the list shows: Today, Unanswered, Median first reply.
  - The thread footer has a reply box with three actions: "Create inquiry", "Answer & keep" (the clarification reply from Task 4) and "Close".
  - The bell opens a panel listing notifications with their channel badges.
- [ ] **Step 4: Run it.** Expected: `Lead checks passed.`

### Task 4: Pipeline

**Files:**
- Create: `src/lib/pipeline.js`, `src/pages/Pipeline.svelte`, `src/components/InquiryDrawer.svelte`
- Test: `scripts/test-pipeline.mjs`

**Interfaces (produces):**
- Inquiry: `{ id, name, phone, email, source, program, contactPerson, drugOfChoice, yearsOfUse, previousDetox: 'Yes'|'No'|'', commPreference, urgency: 'Normal'|'Urgent', potentialRevenue: number, stage, outcome?: 'Admitted'|'Declined', createdAt, stageHistory: {stage, at, by}[], calls: {id, at, by, outcome, notes}[], notes }`
- `STAGES`, `PROGRAMS`, `COMM_PREFS` (exact values from Global Constraints)
- `createInquiry(state, fields, staffId) → inquiry`: coerces `potentialRevenue` (`Number(v) || 0`, minimum 0) and creates 2 tasks (`kind:'inquiry-followup'`, due +7 and +30 days, titles `Follow-up call 1 of 2` and `Final follow-up call`, owner = contactPerson); urgent → `notifyUrgent`.
- `updateInquiry(state, id, patch, staffId)`: changing urgency to Urgent triggers `notifyUrgent` once.
- `moveInquiry(state, id, stage, staffId)`: a no-op if the stage is unchanged; appends to `stageHistory`; entering `Agreement` calls `openOnboarding` (Task 6).
- `declineInquiry(state, id, reason, staffId)`: cancels the open follow-up tasks.
- `logCall(state, id, {outcome, notes}, staffId)`
- `timeInStageHours(inquiry, now)`, `reviewDue(inquiry, now)`: true when in New Inquiry for ≥ 48 h
- `sendClarification(state, id, staffId)`: channel = WhatsApp if commPreference is `Not comfortable talking on the phone` or `WhatsApp`, Email if `Email`, else the source channel; logs the activity "Clarification reply queued on <channel>".
- `potentialTotals(state) → { inquiry, assessment, combined, agreement }` (open inquiries only)
- `notifyUrgent(state, inquiry)`: to `ahmed`, `clinical-director` and the contact person (deduplicated), urgent.

- [ ] **Step 1: Write the failing test** asserting:
  - `createInquiry` with `potentialRevenue: ''` stores `0`, and creates tasks due +7 and +30 days
  - moving to the same stage leaves `stageHistory.length` unchanged
  - `reviewDue` is true at 48 h and false at 47 h
  - declining marks both follow-up tasks `cancelled`
  - an urgent inquiry for contact person `melyssa` notifies exactly `ahmed`, `clinical-director` and `melyssa`
  - `potentialTotals` on `[{stage:'New Inquiry',potentialRevenue:3000},{stage:'Assessment',potentialRevenue:5000},{stage:'Agreement',potentialRevenue:7000}]` gives `{inquiry:3000, assessment:5000, combined:8000, agreement:7000}`
  - `sendClarification` with commPreference `Not comfortable talking on the phone` uses WhatsApp
- [ ] **Step 2: Run it.** Expected: FAIL.
- [ ] **Step 3: Implement the module and the board.**
  - **Board columns:** 3 columns with count and potential total in each header; a filter row (search, contact person, program, urgent only).
  - **Card:** name, program, contact person avatar, time in stage, revenue, an `Urgent` badge, a `Review due` badge, and a phone-off icon when the person is not comfortable on the phone.
  - **Moving cards:** HTML5 drag and drop plus a "Move to" menu on every card.
  - **Drawer:** the full field form, a call log with "Log call", the stage history, and the follow-up tasks.
  - **Header actions:** "New inquiry" and "Declined" (closed list).
- [ ] **Step 4: Run it.** Expected: `Pipeline checks passed.`

### Task 5: Scheduling

**Files:**
- Create: `src/lib/scheduling.js`, `src/pages/Schedule.svelte`, `src/components/BookDialog.svelte`
- Test: `scripts/test-scheduling.mjs`

**Interfaces (produces):**
- Appointment: `{ id, service, provider: staffId|'external', patientId?|inquiryId?, date, start: 'HH:MM', minutes, status: 'Booked'|'Completed'|'Cancelled', external?: {psychiatrist}, noteFormId? }`
- `SERVICES`: `{ name, provider, minutes, auto }[]`. Nursing appointment (fadia, 30), Blood test (fadia, 15), Therapist session (clinical-director, 50), Psychologist session (nabila, 50, auto), Physiotherapy (john, 45), Fitness session (john, 60), External psychiatrist (external, 30, manual).
- `earliestSlot(state, {provider, minutes, from: isoDate}) → {date, start}`: Mon–Sat 09:00–17:00, 15-min steps, starting the day after `from`, up to 14 days; throws `'No free slot in the next 14 days.'`
- `book(state, appt, staffId)`: throws `'This time overlaps another booking for <provider name>.'` on overlap; throws `'Psychologist appointments are booked automatically and can't be changed here.'` when `staffId === 'melyssa'` and the service is Psychologist session.
- `autoBookPsychologist(state, {inquiryId|patientId}, from) → appointment`
- `completeAppointment(state, id, staffId)`
- `notesOverdue(state, staffId, now) → appointment[]`: completed psychologist or therapist sessions older than 24 h with no `noteFormId`.
- `recordPrescription(state, {patientId, appointmentId, fileId, note}, staffId)`: adds a document of type Prescription and notifies `fadia`.

- [ ] **Step 1: Write the failing test** asserting:
  - from Friday 2026-11-06 with an empty calendar, the slot is `2026-11-07 09:00` (Saturday)
  - from Saturday 2026-11-07, the slot is `2026-11-09 09:00` (Sunday skipped)
  - with nabila booked 09:00–16:15 on the next day, a 50-min slot rolls to the following day at 09:00
  - an overlapping `book` throws the overlap message
  - `book` by `melyssa` for Psychologist session throws the permission message
  - `notesOverdue` returns a session completed 25 h ago without a note and ignores one at 23 h
  - `recordPrescription` creates 1 notification to `fadia`
- [ ] **Step 2: Run it.** Expected: FAIL.
- [ ] **Step 3: Implement the module and the page.**
  - **Week view:** one column per day (a day list on mobile); colour per service; a provider filter, defaulting to own appointments.
  - **"Book earliest" dialog:** pick the service and patient → shows the proposed slot → Confirm.
  - **Psychiatrist (Fadia):** "Record psychiatrist appointment" (date, time, psychiatrist name), then "Prescription received" (file upload).
  - **Melyssa:** psychologist appointments show a lock icon and no edit controls.
- [ ] **Step 4: Run it.** Expected: `Scheduling checks passed.`

### Task 6: Admission onboarding → patient + wallet

**Files:**
- Create: `src/lib/admission.js`, `src/pages/Admissions.svelte`; move `src/wallet.js` → `src/lib/wallet.js`, adapted to `state.wallet.transactions` and with the order functions removed (requests replace them in Task 8)
- Test: `scripts/test-admission.mjs` (also covers wallet basics)

**Interfaces (produces):**
- Onboarding: `{ id, inquiryId, openedAt, steps: { nursing: Step, psychologist: Step, financial: Step & {monthlyAmount, terms}, agreement: Step & {documentId}, room: Step & {roomId, bed} }, psychologistAppointmentId, admittedPatientId? }` where `Step = {done, by, at}`
- `STEP_OWNERS = { nursing:['fadia','ahmed'], psychologist:['nabila','clinical-director','ahmed'], financial:['melyssa','ahmed'], agreement:['melyssa','ahmed'], room:['melyssa','ahmed'] }`
- `openOnboarding(state, inquiryId, staffId)`: idempotent; calls `autoBookPsychologist`.
- `completeStep(state, onboardingId, step, payload, staffId)`: throws `'This step belongs to <names>.'` when not an owner. The psychologist step requires the booked appointment to be Completed.
- `canAdmit(onboarding) → boolean`
- `admit(state, onboardingId, staffId) → patient`:
  - Patient: `{id, fullName, clinicalName ('First L.'), program, roomId, bed, admittedAt, phase: '1 Stabilization', assigned: {psychologist:'nabila', nurse:'fadia', fitness:'john', rsa:'rsa'}, commPreference, status:'Admitted'}`
  - Creates the wallet with an opening transaction of 0 (`type:'opened'`).
  - Sets the inquiry outcome to Admitted and cancels its follow-ups.
  - Creates a draft `discharge` form.
  - Creates tasks `Intake Psychological Assessment` (due +3 days) and `Treatment Plan` (due +7 days) for `clinical-director`.
- Wallet: `walletBalanceCents`, `addWalletDeposit`, `addWalletPurchase`, `walletTransactionsFor` (same contracts as the old module).

- [ ] **Step 1: Write the failing test** asserting:
  - `moveInquiry` to Agreement opens exactly 1 onboarding and 1 psychologist appointment, and moving there twice still gives 1
  - `completeStep(..., 'nursing', ..., 'melyssa')` throws `'This step belongs to Fadia, Ahmed.'`
  - `admit` before all steps throws `'Complete all admission steps first.'`
  - after all steps, `admit` returns a patient with `clinicalName` `'Rami K.'` for full name `'Rami Khoury'`; `walletBalanceCents === 0` and a wallet `opened` entry exists; the inquiry outcome is `'Admitted'`; follow-up tasks are cancelled; 2 clinical tasks exist
  - the old wallet deposit and purchase checks hold (a purchase over balance throws `'This purchase is higher than the available wallet balance.'`)
- [ ] **Step 2: Run it.** Expected: FAIL.
- [ ] **Step 3: Implement the module and the page.** The Admissions page shows one row per onboarding, with 5 step pills (done / your step / waiting on <name>). Clicking opens the step panel (nursing note; psychologist appointment status; amount + terms; agreement e-sign or upload; room and bed picker showing free beds). "Admit patient" is enabled only when all 5 are done.
- [ ] **Step 4: Run it.** Expected: `Admission checks passed.`

### Task 7: Patients list and patient profile

**Files:**
- Create: `src/pages/Patients.svelte`, `src/pages/PatientProfile.svelte`, `src/components/patient/Overview.svelte`, `Clinical.svelte`, `Medical.svelte`, `Fitness.svelte`, `Documents.svelte`, `Wallet.svelte`, `FollowUp.svelte`; `src/lib/documents.js`, `src/lib/files.js` (IndexedDB put/get, moved from the old `clinicalFiles.js` idea)
- Test: `scripts/test-patients.mjs`

**Interfaces (produces):**
- `documents.js`: `DOC_TYPES = ['Admission agreement','Consent','Prescription','Invoice (fatoura)','Other']`; `addDocument(state, {patientId, type, title, fileId?}, staffId)`; `signDocument(state, docId, {signature, signer}, staffId)` (status becomes `Signed electronically`); `attachScan(state, docId, fileId, staffId)` (status becomes `Signed scan uploaded`)
- `progressSummary(state, patientId) → { bmi: number[], attendancePct, wellbeingAvg }` in `src/lib/forms/engine.js` (computes Fitness Form 5's auto rows)

- [ ] **Step 1: Write the failing test** asserting:
  - SSR-rendering `PatientProfile` for a seeded patient as `melyssa` contains "Follow-up log" and does not contain "Intake Psychological Assessment"; as `clinical-director` it contains it
  - as `rsa` the tabs are exactly Overview and Wallet & requests
  - `signDocument` sets the status `Signed electronically` and records the signer
  - `progressSummary` with 3 attendance rows (2 Attended, 1 Absent) gives `attendancePct === 67`, and wellbeing ratings 4,4,3,5 give `wellbeingAvg === 4`
- [ ] **Step 2: Run it.** Expected: FAIL.
- [ ] **Step 3: Implement.**
  - **Patients list:** search, a program filter, and a risk filter visible to clinical staff only. Each row shows name, program, room, phase, days admitted, and the next appointment.
  - **Profile header:** name (clinicalName on the Clinical tab), program, room, day N of stay, a risk badge (clinical viewers only), and a communication-preference badge.
  - **Tabs:** gated by `canSeeTab`.
  - **Clinical tab:** the form list with status (Not started / Draft / Filed date / Due by date), each opening `FormView`.
  - **Medical tab:** nursing appointments, blood tests, psychiatrist appointments, prescriptions, medical clearance.
  - **Fitness tab:** the 6 forms plus the progress chart.
  - **Documents tab:** the list with sign / upload actions.
  - **Wallet tab:** balance, history, top-up (melyssa, ahmed), and requests.
  - **Multi-patient forms**, with no single patient home:
    - Clinical Form 4 (Group Session Note) and Fitness Form 2 (Session Attendance & Observation Log) open from the matching group or fitness appointment in Schedule. Their attendance table is prefilled with the booked patients.
    - Clinical Form 5 (Case Review Record) opens from a "Weekly case review" button on the Patients page, for clinical staff only. Its patient table is prefilled with all admitted patients.
    - Each filed form is also listed on every included patient's tab.
- [ ] **Step 4: Run it.** Expected: `Patient checks passed.`

### Task 8: RSA requests and invoice scans

**Files:**
- Create: `src/lib/requests.js`, `src/pages/Requests.svelte`
- Test: `scripts/test-requests.mjs`

**Interfaces (produces):**
- Request: `{ id, patientId, item, quantity, note, status: 'Open'|'Done'|'Cancelled', createdBy, createdAt, invoiceDocId?, amountCents? }`
- `createRequest(state, {patientId, item, quantity, note}, staffId)`: item 2–100 chars, quantity 1–20, same messages as the old wallet orders.
- `completeRequest(state, id, {amount, fileId}, staffId)`: stores the fatoura as a document of type `Invoice (fatoura)` linked to the patient and records a wallet purchase; refused when over balance, leaving the request Open.
- `cancelRequest(state, id, staffId)`
- `uploadInvoice(state, {patientId, fileId, amount?, note}, staffId)`: a standalone fatoura scan.

- [ ] **Step 1: Write the failing test** asserting:
  - creating a request with quantity 0 throws `'Choose a quantity from 1 to 20.'`
  - completing with an amount over balance throws and the status stays `'Open'`
  - completing within balance gives status Done, reduces the balance by that amount, and adds 1 `Invoice (fatoura)` document for that patient
- [ ] **Step 2: Run it.** Expected: FAIL.
- [ ] **Step 3: Implement.** The page has: "New request" (patient picker limited to visible patients, item, quantity, note); tabs Open, Done, All; and "Upload invoice" (a camera-capable file input `accept="image/*,application/pdf" capture="environment"`).
- [ ] **Step 4: Run it.** Expected: `Request checks passed.`

### Task 9: Today page, tasks and KPI dashboard

**Files:**
- Create: `src/lib/tasks.js`, `src/lib/kpis.js`, `src/pages/Today.svelte`, `src/pages/Dashboard.svelte`, `src/components/Stat.svelte`, `src/components/Bars.svelte`
- Test: `scripts/test-kpis.mjs`

**Interfaces (produces):**
- `tasks.js`: `tasksFor(state, staffId, now) → {overdue, today, upcoming}` merging stored tasks with derived ones:
  - inquiry reviews due (contact person)
  - notes overdue (Task 5)
  - admission steps waiting on this person
  - forms due (intake within 72 h of admission, plan within 7 days)
  - open RSA requests (rsa)
  - prescriptions to review (fadia)
- `completeTask(state, id, staffId, note?)` records `doneBy` and `doneAt`.
- `kpis.js`: `dashboard(state, now) → { leads, pipeline, census, clinical, aftercare, fitness }`, with exactly the metrics in the spec's KPI section. Percentages are integers; `null` when the denominator is 0 (shown as "—").

- [ ] **Step 0: Load the `dataviz` skill** before writing `Bars.svelte` or choosing chart colours.
- [ ] **Step 1: Write the failing test** asserting on a small fixture:
  - occupancy 3 of 4 beds = `75`
  - session notes: 3 completed sessions, 2 noted within 24 h = `67`
  - no discharges gives aftercare on-time `null`
  - `pipeline.potential` equals `potentialTotals`
  - `leads.byChannel.WhatsApp` counts correctly
  - `tasksFor('melyssa')` includes a follow-up due today in `today`, and excludes cancelled tasks
- [ ] **Step 2: Run it.** Expected: FAIL.
- [ ] **Step 3: Implement.**
  - **Today:** greeting, date, then 3 groups (Overdue, Today, Coming up), each item one line with a direct action button; an empty state reads "You're clear for today."
  - **Dashboard:** six sections with compact stat tiles, a lead-by-channel bar, a pipeline funnel, and potential revenue tiles (Inquiry / Assessment / Combined + Agreement "not in combined").
- [ ] **Step 4: Run it.** Expected: `KPI checks passed.`

### Task 10: Server, docs, end-to-end verification

**Files:**
- Modify: `server/index.mjs` (remove the analytics and AI endpoints and the import of `../src/analytics.js`; keep static serving and PDF/DOCX extraction), `README.md` (rewrite for Cedar Rehab: run, roles, checks), `index.html` (title "Cedar Rehab", theme-color `#1C1C1C`, favicon.png), `package.json` (name `cedar-rehab-crm`)
- Delete: `public/design-preview.html`, `public/preview.css`, `public/responsive.css`, `public/favicon.svg`
- Create: `scripts/screens.mjs` (headless Chrome `--screenshot` for every page × profile at 1440×900 and 390×844, into `artifacts/rebuild-20261102/`)

- [ ] **Step 1:** `npm test`. Expected: every `* checks passed.` line, exit 0.
- [ ] **Step 2:** `npm run build`. Expected: built, no errors.
- [ ] **Step 3:** `npm start` in the background, then `node scripts/screens.mjs`. Look at every screenshot. Fix anything cramped, overflowing, empty or unclear, and re-run until clean.
- [ ] **Step 4:** Walk-through check in the screenshots:
  - a lead becomes an inquiry
  - drag to Assessment, then Agreement
  - the psychologist slot appears in the schedule
  - complete the steps and admit
  - the wallet shows $0.00
  - the patient appears in the Admitted list
  - the clinical tab is hidden for Melyssa

---

## Addendum: Cedar Assist preview (spec addendum of 2026-11-02)

### Task 11: Session-note drafting

**Files:** Create `src/lib/assist/sessionDraft.js`, `src/components/DictatePanel.svelte`; modify `src/components/FormView.svelte` (panel above the sections, for `session` drafts only); Test `scripts/test-assist.mjs`.

**Interface:** `draftSessionNote(text: string) → { values: { attendance, themes, riskFlags: string[], escalatedTo, progress }, filled: string[] }`. It is pure, with no state.

- [ ] **Step 1:** Write a failing test:
  - `'Attended. Talked about sleep and cravings at night. Next session we practise urge surfing.'` gives attendance `Attended`, riskFlags `['Relapse / craving']`, escalatedTo `'Ahmed'`, and progress containing `urge surfing`.
  - `'Denies self-harm. No cravings this week.'` gives riskFlags `['None']` and escalatedTo `''`.
  - `'He refused the session'` gives `Refused`.
  - `'Says he wants to run away; withdrawal pain at night'` gives `['Absconding']` and escalatedTo `'Ahmed, Fadia'`.
  - `'أفكار انتحار'` gives `['Self-harm']`.
- [ ] **Step 2:** Implement, run, see it pass. Then build the panel:
  - a mic button using Web Speech, with a language choice;
  - a textarea and a "Draft the note" button;
  - a notice "Preview of Cedar Assist: drafted in your browser…";
  - drafted fields marked until edited.

### Task 12: Case review prep

**Files:** Create `src/lib/assist/caseReview.js`, `src/components/WeekSummary.svelte`; modify `src/components/FormView.svelte` (`review` drafts get "Prepare this week") and `src/components/patient/Clinical.svelte` (a "This week" card); Test `scripts/test-assist.mjs`.

**Interface:** `weekSummary(state, patientId, now) → { flags: {key, label, detail}[], brief: string, risk, sessions, wellbeing: {latest, previous}|null }` and `prepareCaseReview(state, now) → { rows: [{patientId, patient, phase, status, decisions:'', action:''}], highRisk: string, flagged: number }`.

- [ ] **Step 1:** Write a failing test on the seed:
  - P-0002, with a relapse flag in its first session, is flagged only if that session is within 7 days. Build the fixture with fixed dates.
  - An injury in the last 7 days raises `incident`.
  - A prescription in the last 7 days raises `medication change`.
  - Phase `4 Discharge prep` raises `approaching discharge`.
  - Two refusals or absences raise `refusal pattern`.
  - Rows are sorted with flagged patients first, and `highRisk` lists Medium and High patients.
- [ ] **Step 2:** Implement, run, see it pass. Then the UI, a screenshot pass, and an extension to the walkthrough.

---

## Addendum: UI v2 (Roy, 2026-11-02: "transform the UI to the highest level")

- **Direction (my call, Roy delegated taste):** keep the logo's ink and lime as the identity.
  - Bricolage Grotesque for display (h1, big figures) and Hanken Grotesk for UI, both self-hosted.
  - A dark ink sidebar that echoes the logo.
  - Light and dark themes (follows the system setting, with a toggle in the profile menu).
  - A Ctrl K command palette with actions as well as search.
  - Signature visuals carry information:
    - the patient journey stepper (phases 1–4 from the Treatment Plan, plus day of stay);
    - the 48-hour meter on New Inquiry cards;
    - the dashboard pulse (combined potential, plus leads over the last 14 days);
    - the Today page agenda with a "now" line.
- **Constraint:** existing tests' visible text stays. Every colour becomes a token, so dark mode is complete. Contrast is checked in both themes by screenshot.
- **Verify:** `npm test`, the build, the walkthrough, and screenshots of every page in both themes and on a phone.

### UI v2 scope additions (Roy, 2026-11-02)
Roy chose: full accounting, plus a sessions and groups hub, medication and drug tests, a rooms and bed board, and visits, leave and incidents.

- **Navigation groups:**
  - My work: Dashboard, Today
  - Intake: Leads, Pipeline, Admissions
  - Care: Admitted patients, Sessions, Medication, Rooms
  - Operations: Schedule, Visits & incidents, Requests
  - Finance: one page with tabs (Overview, Invoices, Expenses, Ledger, Trial balance, Bank, Payers)
- **Access (my call):**

  | Area | Who | Rule |
  |---|---|---|
  | Finance | Ahmed, Melyssa | Admin runs the books; no finance person is named |
  | Sessions hub | Ahmed, Clinical Director, Nabila, Fadia, John | Each sees their own scope, as in Schedule; shows note status only, never note content |
  | Medication | Fadia, Ahmed, Clinical Director | Fadia records; Ahmed and the Clinical Director read |
  | Rooms | Ahmed, Melyssa, Clinical Director, Fadia, RSA team | Melyssa and Ahmed change room status |
  | Visits & incidents | Everyone except Nabila and John for visits and leave | Every staff member can report an incident; Ahmed and the Clinical Director are notified and review it |

- **Data:** the seed version moves to 2, so saved v1 data reseeds. New collections:
  - `finance{invoices, expenses, manualEntries, bankEntries}`
  - `medication{orders, doses, tests}`
  - `visits`, `leaves`, `incidents`
  - `room.status`
- **Modules and tests:**

  | Module | Test | Covers |
  |---|---|---|
  | `src/lib/finance.js` | `test-finance` | Port of the old journal / trial balance / bank / payer rules, plus invoices from the agreed monthly amount, payments, void, expense approve/pay, manual entries |
  | `src/lib/medication.js` | `test-care` | Dose rounds, refusal or missed notifies Fadia, positive drug test notifies Ahmed and the Clinical Director |
  | `src/lib/safety.js` | `test-care` | Visits, leave out/return/late, incidents |
  | `src/lib/rooms.js` | `test-care` | Board derive, status change, no maintenance on an occupied room |
  | `src/lib/sessions.js` | `test-care` | Week hub derive |
