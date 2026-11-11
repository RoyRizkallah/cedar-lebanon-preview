# Cedar Rehab — staff workspace

A CRM and patient workspace for Cedar Rehab (Addiction Rehabilitation & Prevention Center), built from:

- the owner's clinical forms (`Cedar_Rehab_Clinical_Forms.docx`)
- the owner's physical therapy & fitness forms (`Cedar_Rehab_Fitness_Forms.docx`)
- the requirements meeting of 31 October 2026

The design is in `docs/superpowers/specs/2026-11-02-cedar-rehab-crm-design.md`.

It runs two ways:

- **Preview** (the hosted review link, or `npm start` with no database): fictional patients, kept in the browser. Switching people with "Preview: view the workspace as" is not a sign-in.
- **Local server** (below): each person signs in with their own password, every change is checked and saved by the server, and each browser receives only what that person's role may see. It runs on this computer only.

Messages to WhatsApp, Instagram, Facebook and email are recorded as "queued" rather than sent. **No real patient data goes in until Roy approves it**, and hosting it for other devices is a separate, explicit decision (it will need HTTPS and disk encryption at least).

## Run it

```sh
npm install
npm run dev          # development server
npm run build
npm start            # serves dist/ at http://localhost:4173 (npm start -- 4174 for another port)
```

Add `?as=<id>` to the address to open the workspace as that person, for example `?as=melyssa`, `?as=amer` or `?as=georgio`. The ids are in [src/lib/people.js](src/lib/people.js).

## Run with the local server

```sh
npm run build
npm run admin -- init --demo             # sample data; leave out --demo for an empty house (rooms only, no patients)
npm run admin -- passwd melyssa          # type the password (10+ characters); repeat for each person
npm start                                # http://localhost:4173, now asking for a sign-in
```

- **Where data lives:** `data/` next to the app, or the folder in `CEDAR_DATA`. It holds `cedar.db` (the workspace, accounts, sessions, audit log), `files/` (uploads) and `backups/` (a copy of the database on the first change of each day; the newest 30 are kept). `data/` is never committed.
- **Accounts:** `npm run admin -- users` lists them; `npm run admin -- disable <id>` closes one and ends its sessions. Passwords are stored only as scrypt hashes. Five wrong passwords lock that name for 15 minutes on the computer that guessed (nobody can lock a colleague out from elsewhere); a session lasts 12 hours. Node 22.13 or newer is needed (built-in SQLite).
- **How a change works:** the screen runs it at once for a quick answer, then the server runs the same rules ([src/lib/commands.js](src/lib/commands.js)) as the signed-in person on its own clock, saves it, writes it to the audit log, and sends each open browser its fresh view ([src/lib/view.js](src/lib/view.js)). A change the server refuses is undone on screen, with the reason.
- **What each person receives:** no clinical records outside the clinical team, no prescriptions outside nursing and the clinical lead, no books outside Finance and Amer, only your own notifications, and residents only their own space. Uploaded files open only for someone whose view refers to them.
- **Checks:** `npm test` covers the store, the API, the permissions, the views and petty cash. After `npm run build`, three browser checks run against a scratch server:
  - `node scripts/smoke-server.mjs`: sign in, make a change, reload, sign out.
  - `node scripts/walk-server.mjs`: the whole walkthrough (a WhatsApp lead becomes an admitted patient), each step signed in as the person who does it.
  - `node scripts/roles-server.mjs`: every person opens every page and patient tab their role allows; any error fails it.
  - `node scripts/screens.mjs <url> <folder> staff:page:390,...` takes screenshots (under 600 px it emulates a phone) and warns about any page wider than the screen.
- After adding or changing a command, run `node scripts/gen-command-slots.mjs` (the tests say so if it is stale).

## Who sees what

People and roles follow the owner's org chart ([docs/org-chart.md](docs/org-chart.md)). Access is set by role, so a new hire gets the right pages by being given a role.

| Person | Pages |
| --- | --- |
| Amer Khattab · General Manager | Dashboard, Today, Reports, Leads, Pipeline, Follow-ups, Admissions, Insights, patients (overview, documents, wallet), Rooms, Schedule, Visits & incidents, Resident support, Orders, Accounts. Approves bills and any order over $200, and sets the weekly kitchen ceiling. |
| Ahmed Khattab · Clinical Director | Dashboard, Today, Reports, the whole intake side, every patient tab and all psychology records, Sessions, Programs, Medication, Rooms, Schedule, Visits & incidents, Resident support. Reviews Level 2 and 3 incidents, countersigns, and signs off every discharge plan. No Accounts. |
| Nabila, Samar · Psychologists | Today, Admissions (the psychologist step), their assigned patients, Sessions, Programs, Schedule |
| Nazha · Drama Therapist | Today, patients (clinical), group notes, drama therapy sessions, Schedule |
| Fadia · Head Nurse | Today, Admissions (nursing step), patients (medical, nursing forms, fitness clearance, prescriptions), Medication (medications, logs), Rooms, Schedule |
| Melyssa · Admin & Admissions Manager | Today, Reports, Leads, Pipeline, Follow-ups, Admissions, Insights, patients (overview, follow-up log, documents, wallet), Rooms, Schedule, Resident support. No Accounts. |
| Rabih · Head of Finance | Accounts, Reports (finance), wallets, Orders, Admissions (payment step). Approves bills. |
| Kteish · Accountant | Accounts, Reports (finance), wallets, Orders, Admissions (payment step). Owns the patient ledger, so the final bill is his. |
| Mazen · Head of Operations | Rooms (manages them), Admissions (signs the room ready), Orders (raises maintenance, cleaning and supply orders), Reports (operations), Resident support, Visits & incidents |
| Shady · Head Chef | Today, Orders (raises kitchen orders) |
| Wissam, Ezdihar, Khadija, Hasna (Em Alaa), Ghassan · kitchen and housekeeping | Today. Housekeeping also sees Rooms. |
| John · Head of PT & Fitness | Today, Admissions (physiotherapy step), patients (fitness forms 1–6, medical), Sessions, Schedule |
| Zeina, Tony J., Tony AM, Raymond · trainers | Today, patients (fitness), session attendance logs, their own sessions on the Schedule |
| Omar · Senior RSA | Every resident (overview, medical, wallet), Rooms, Medication (meds window), Visits & incidents, Resident support. Told of every incident; reviews Level 1. Reviews escort logs. |
| Georgio, Alaa, Dania, Imad · RSAs | Every live-in resident, because one RSA can cover the house alone. They record each dose at the meds window and keep the escort log. Georgio alone hands out petty cash, against the resident's signature. Imad, a certified nurse, works under Fadia. |
| Resident (Karim H., Lara K.) | Their own space: wallet, purchases and item requests |

Clinical forms are never shown to Melyssa, Finance, Operations or the RSA team, including through direct links.

## How the work flows

1. **Leads.** Every message from WhatsApp, Instagram, Facebook, email, the website and phone lands in one inbox. From there, staff reply, use the standard clarification reply, turn the message into an inquiry, or close it.
2. **Pipeline.** Inquiries move from New Inquiry to Assessment to Agreement, by dragging or with "Move to".
   - Each inquiry records the contact person, called-by, drug of choice, years of use, previous detox, communication preference (including "Not comfortable talking on the phone"), urgency and potential revenue (0 when no offer has been made).
   - Each card shows how long it has been in its stage. After 48 hours in New Inquiry it shows "Review due".
   - Follow-up calls are booked at 1 week and 1 month. They stop on admission or decline.
   - A New Inquiry still there after 72 hours moves to the follow-up log, due one week after the first contact. A follow-up made with no assessment booked moves it to the inactive log.
   - Assessments are done by Amer, Ahmed or someone named; a missed one is marked as a no-show.
   - Marking an inquiry urgent alerts Amer, Ahmed and the contact person in the app, with the email and WhatsApp copies queued.
3. **Admissions.** Reaching Agreement opens eight steps:
   - Nursing (Fadia).
   - Physiotherapy (John).
   - Psychologist session (Nabila or Samar). This is booked automatically at the earliest free slot.
   - Financial arrangement: the monthly rate (Standard $7,500, Private $12,000, Bungalow $15,000) and the guarantor, who receives Finance's statements. A sponsor stands in for the guarantor.
   - Signed agreement, signed on screen or uploaded as a scan.
   - Payment received (Kteish, Rabih or Amer), or the sponsor's confirmation.
   - Room and bed: rooms 1 to 7 and the Bungalow, beds lettered a, b, c.
   - Room ready, signed by Mazen. Changing the bed undoes it.

   Admitting the person creates the patient file and their wallet, and starts the discharge plan.
4. **Patients.** Each patient file has tabs: overview, the 8 clinical forms (Form 8 is under "Follow-up log"), medical (clearance, nursing, external psychiatrist, prescriptions), the 6 fitness forms, documents and signatures, and wallet and requests.
5. **Schedule.** The week view books the earliest free slot from tomorrow, Monday to Saturday, 09:00 to 17:00, and never double-books a person or a patient. Fadia records external psychiatrist appointments and the prescriptions they send. A session without a note becomes overdue after 24 hours.
6. **Today.** Each person sees only their own work: overdue, today and coming up.
7. **Dashboard.** The partners' dashboard shows:
   - Potential revenue: inquiry, assessment and combined, with agreement shown separately.
   - Census, occupancy and the amount agreed per month.
   - Leads by channel and first-reply time.
   - Pipeline conversion.
   - Session notes on time, intake within 72 hours, overdue treatment plans and risk.
   - Aftercare outcomes and fitness attendance.

### Everything else a centre runs on

- **Finance (Amer, Rabih, Kteish):**
  - **Invoices and payments:** an invoice comes from each patient's agreed monthly amount, with one click for the whole month. Payments are recorded against invoices, and an unpaid invoice can be voided with a reversing entry.
  - **Bills:** supplier bills are approved by Amer or Rabih, then paid.
- **Orders (Shady, Mazen, Amer):** every purchase in one register. Up to $200 the sub-lead goes ahead; above that Amer approves before anything is bought. Kitchen orders inside Amer's weekly ceiling need no separate approval. Each order closes with its receipt.
  - **Books:** a balanced journal with manual entries, a trial balance, bank reconciliation and payer balances.
  - **Export:** CSV on every list.
- **Programs (Ahmed, Nabila, Samar, Nazha):**
  - A therapist builds a program: a name, a focus, its length in weeks, goals, and a Monday-to-Saturday week of sessions, each with a kind, time and leader. A new program can start as a copy of another.
  - Giving a program to a patient books its sessions on the Schedule for the whole length. Group-type sessions are one booking that each patient joins. Individual and family sessions are booked per patient, moving to the leader's next free time that day.
  - Anything that can't be booked is listed under the patient as "need a time". Editing the week rebooks what is still ahead, and ending a program takes the patient out of its future sessions.
  - Everyone else on the care team can read programs, and each patient's file shows their program and today's sessions.
- **Sessions:** the week's individual sessions, groups and fitness sessions, with attendance and whether each note is filed, due or overdue. Note content stays in the patient file.
- **Medication:**
  - Fadia (and Imad under her) starts and stops medications.
  - The RSA running each meds window records every dose as it is taken: given, refused, missed or held. A refused or missed dose alerts Fadia and Ahmed.
  - Urine drug screens. A positive screen alerts Ahmed.
  - Logs: medication access, weekly box preparation, weekly count and disposal (Nursing SOP 2.3).
- **Nursing forms** on each patient's Medical tab: the admission medical assessment, psychiatric consultations and off-site escorts.
- **Rooms & beds:**
  - A board of every bed: occupied, held for an admission, or free, with planned discharge dates.
  - Mazen, Melyssa and the partners add, edit and remove rooms, and set them to ready, cleaning or maintenance. A room with patients in it can't be removed or put under maintenance.
- **Visits & incidents:**
  - Family visits and day leave, with overdue returns flagged.
  - Anyone can report an incident at its level. Level 1 (behavioural) tells Omar, who reviews it. Level 2 (serious) calls Omar and Ahmed. Level 3 (emergency) calls Omar, Ahmed and Amer, and Fadia for anything health-related.
- **Resident support:** RSA requests, daily check-ins, and purchases from petty cash (Georgio) with the invoice scan and the resident's signature.
- **A resident's own space:** wallet balance, purchase history and item requests, with live status.
- **Reports:** operations, admissions, care delivery and finance, each printable and exportable.
- **Insights:** Cedar Intelligence picks out what stands out in leads and the pipeline. Like Cedar Assist, it is calculated in the browser.
- **Patient files:**
  - The phase journey and day of stay.
  - Team comments.
  - A printable case report that names the source of every line.
- **Everywhere:**
  - **Ctrl K:** search patients, inquiries and leads, or start an action.
  - **Theme:** light only.

### Cedar Assist (preview)

Both features run in the browser. Nothing is sent to an AI provider. They show what the AI version will do.

- **Dictate a session note.** In a new Individual Session Note, speak (Chrome or Edge; English, Arabic or French) or type what happened, then choose "Draft the note". Cedar fills in attendance, themes, risk flags, escalation (Ahmed always, and Fadia if anything medical comes up) and the plan for next session. Each filled field is marked "Drafted, please check" until someone edits it. Negated mentions such as "denies self-harm" or "no cravings" never raise a flag. The clinician still signs.
- **Prepare the weekly case review.** "Prepare" reads the last 7 days of filed records and raises the case review's standing flags:
  - incident
  - relapse
  - refusal pattern
  - medication change
  - approaching discharge

  It also fills in the review table, with flagged patients first, and the high-risk list. Decisions stay with the team. Each patient's Clinical tab shows the same "This week" summary.

The forms follow the owner's rules:
- Medium or High risk notifies Ahmed and stays on the patient until it is reviewed.
- The family session unlocks only after consent is given.
- Fitness gate two stays locked until Fadia clears gate one.
- BMI is calculated automatically.
- Filing the discharge plan books Melyssa's calls at 1 week, 1 month and 3 months.
- Injuries escalate to Fadia.

## Checks

```sh
npm test             # runs every scripts/test-*.mjs
npm run build
node scripts/walkthrough.mjs http://localhost:4173   # clicks through lead → admitted patient, notes, review, booking, purchase
node scripts/screens.mjs http://localhost:4173 artifacts/screens "melyssa:pipeline,ahmed:dashboard:390"
```

The walkthrough and screenshot scripts need Chrome or Edge, and the server running (`npm start`).
