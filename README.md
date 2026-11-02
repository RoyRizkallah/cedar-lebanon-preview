# Cedar Rehab — staff workspace

A CRM and patient workspace for Cedar Rehab (Addiction Rehabilitation & Prevention Center), built from:

- the owner's clinical forms (`Cedar_Rehab_Clinical_Forms.docx`)
- the owner's physical therapy & fitness forms (`Cedar_Rehab_Fitness_Forms.docx`)
- the requirements meeting of 31 October 2026

The design is in `docs/superpowers/specs/2026-11-02-cedar-rehab-crm-design.md`.

**This is a preview with fictional patients.** Records are kept in the browser (`localStorage`, with uploaded files in IndexedDB), so nothing is shared between devices. Switching people with "Preview: view the workspace as" is not a sign-in. Messages to WhatsApp, Instagram, Facebook and email are recorded as "queued" rather than sent. Real patient use needs a secure backend, logins, enforced permissions, audit, encryption and backups first.

## Run it

```sh
npm install
npm run dev          # development server
npm run build
npm start            # serves dist/ at http://localhost:4173 (npm start -- 4174 for another port)
```

Add `?as=<id>` to the address to open the workspace as that person, for example `?as=melyssa`, `?as=amer` or `?as=georgio`. The ids are in [src/lib/people.js](src/lib/people.js).

## Who sees what

People and roles follow the owner's org chart ([docs/org-chart.md](docs/org-chart.md)). Access is set by role, so a new hire gets the right pages by being given a role.

| Person | Pages |
| --- | --- |
| Amer Khattab · General Manager | Dashboard, Today, Reports, Leads, Pipeline, Follow-ups, Admissions, Insights, patients (overview, documents, wallet), Rooms, Schedule, Visits & incidents, Resident support, Accounts. Approves bills. |
| Ahmed Khattab · Clinical & Program Director | Dashboard, Today, Reports, the whole intake side, every patient tab, Sessions, Medication, Rooms, Schedule, Visits & incidents, Resident support. No Accounts. |
| Wael · Clinical Director | Today, Reports (care), Admissions, clinical forms 1–7, Sessions, Medication, Rooms, Schedule. Reviews incidents and countersigns. |
| Nabila · Junior Psychologist | Today, Admissions (her step), her assigned patients, Sessions, Schedule |
| Nazha · Drama Therapist | Today, patients (clinical), group notes, drama therapy sessions, Schedule |
| Fadia · Head Nurse | Today, Admissions (nursing step), patients (medical, fitness clearance, prescriptions), Medication, Rooms, Schedule |
| Melyssa · Admin & Admissions Manager | Today, Reports, Leads, Pipeline, Follow-ups, Admissions, Insights, patients (overview, follow-up log, documents, wallet), Rooms, Schedule, Resident support. No Accounts. |
| Rabih · Head of Finance | Accounts, Reports (finance), wallets. Approves bills. |
| Kteish · Accountant | Accounts, Reports (finance), wallets |
| Mazen · Head of Operations | Rooms (manages them), Reports (operations), Resident support (purchasing), Visits & incidents |
| John · Head of PT & Fitness | Today, patients (fitness forms 1–6, medical), Sessions, Schedule |
| Zeina, Tony J., Tony AM, Raymond · trainers | Today, patients (fitness), session attendance logs, their own sessions on the Schedule |
| Omar · Senior RSA | Every resident (overview, wallet), Rooms, Visits & incidents, Resident support. Alerted to incidents and late returns. |
| Georgio, Alaa, Dania, Imad · RSAs | Their own residents. Georgio holds petty cash, so purchases are his. Imad, a certified nurse, can record doses under Fadia. |
| Resident (Karim H., Lara K.) | Their own space: wallet, purchases and item requests |

Clinical forms are never shown to Melyssa, Finance, Operations or the RSA team, including through direct links.

## How the work flows

1. **Leads.** Every message from WhatsApp, Instagram, Facebook, email, the website and phone lands in one inbox. From there, staff reply, use the standard clarification reply, turn the message into an inquiry, or close it.
2. **Pipeline.** Inquiries move from New Inquiry to Assessment to Agreement, by dragging or with "Move to".
   - Each inquiry records the contact person, called-by, drug of choice, years of use, previous detox, communication preference (including "Not comfortable talking on the phone"), urgency and potential revenue (0 when no offer has been made).
   - Each card shows how long it has been in its stage. After 48 hours in New Inquiry it shows "Review due".
   - Follow-up calls are booked at 1 week and 1 month. They stop on admission or decline.
   - Marking an inquiry urgent alerts Amer, Ahmed, Wael and the contact person in the app, with the email and WhatsApp copies queued.
3. **Admissions.** Reaching Agreement opens five steps:
   - Nursing (Fadia).
   - Psychologist session (Nabila). This is booked automatically at the earliest free slot.
   - Financial arrangement.
   - Signed agreement, signed on screen or uploaded as a scan.
   - Room and bed.

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
  - **Books:** a balanced journal with manual entries, a trial balance, bank reconciliation and payer balances.
  - **Export:** CSV on every list.
- **Programs (Wael, Nabila, Nazha):**
  - A therapist builds a program: a name, a focus, its length in weeks, goals, and a Monday-to-Saturday week of sessions, each with a kind, time and leader. A new program can start as a copy of another.
  - Giving a program to a patient books its sessions on the Schedule for the whole length. Group-type sessions are one booking that each patient joins. Individual and family sessions are booked per patient, moving to the leader's next free time that day.
  - Anything that can't be booked is listed under the patient as "need a time". Editing the week rebooks what is still ahead, and ending a program takes the patient out of its future sessions.
  - Everyone else on the care team can read programs, and each patient's file shows their program and today's sessions.
- **Sessions:** the week's individual sessions, groups and fitness sessions, with attendance and whether each note is filed, due or overdue. Note content stays in the patient file.
- **Medication (Fadia, and Imad under her supervision):**
  - Daily rounds from active medications: given, refused, missed or held. A refused or missed dose alerts Wael.
  - Urine drug screens. A positive screen alerts Ahmed and Wael.
- **Rooms & beds:**
  - A board of every bed: occupied, held for an admission, or free, with planned discharge dates.
  - Mazen, Melyssa and the partners add, edit and remove rooms, and set them to ready, cleaning or maintenance. A room with patients in it can't be removed or put under maintenance.
- **Visits & incidents:**
  - Family visits and day leave, with overdue returns flagged.
  - Anyone can report an incident; Ahmed and Wael review it, and Omar is told.
- **Resident support:** RSA requests, daily check-ins, and purchases from petty cash (Georgio) with the invoice scan.
- **A resident's own space:** wallet balance, purchase history and item requests, with live status.
- **Reports:** operations, admissions, care delivery and finance, each printable and exportable.
- **Insights:** Cedar Intelligence picks out what stands out in leads and the pipeline. Like Cedar Assist, it is calculated in the browser.
- **Patient files:**
  - The phase journey and day of stay.
  - Team comments.
  - A printable case report that names the source of every line.
- **Everywhere:**
  - **Ctrl K:** search patients, inquiries and leads, or start an action.
  - **Theme:** light and dark, with a switch in the top bar.

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
