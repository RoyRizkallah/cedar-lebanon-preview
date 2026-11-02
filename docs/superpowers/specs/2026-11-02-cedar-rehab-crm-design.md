# Cedar Rehab CRM — Design

**Date:** 2026-11-02 · **Owner:** Roy · **Status:** approved to build ("proceed, I trust you")

## Intent

Replace the current Cedar Lebanon preview with a clean, real-feeling CRM for Cedar Rehab. It should run the business the way the owner's documents describe it:

- `Cedar_Rehab_Clinical_Forms.docx`: 8 clinical forms.
- `Cedar_Rehab_Fitness_Forms.docx`: 6 physical-therapy and fitness forms.
- The meeting requirements of 2026-10-31: pipeline, leads, automations, scheduling, nurse/psychiatrist, admission, wallet, e-signature, potential revenue, RSA.
- `logo.jpg`: the brand.

Roy's words: change everything, follow the forms, perfect and very clean, easy to use, nothing unnecessary, remove wasted information, add the KPIs the business needs, add one page for all leads from every platform, and follow the names we have.

## Goals

- One clean workspace per real person, with only that person's work in it.
- Every form field from both documents, with the input type its tag names and the rules written under each form.
- A single lead inbox for WhatsApp, Instagram, Facebook, Email, Website and Phone.
- A drag-and-drop 3-stage pipeline with the inquiry fields, call log, 48-hour review, follow-up reminders and urgent escalation.
- Auto-scheduling at the earliest slot with no double booking.
- An admission checklist that creates the patient and their wallet.
- A management dashboard with business KPIs.

## Non-goals (this version)

- No real backend, real logins, or real sending of WhatsApp, email or Instagram messages. This stays a browser-stored preview with fictional patients. Every outbound message is recorded as "queued on <channel>" so the wiring point is obvious.
- No invoicing, general ledger, bank reconciliation, payer accounts, AI reports, Cedar Intelligence, or the Resident and Reception workspaces. None of these appear in the forms or the notes; they count as the "waste" to remove.
- No inventory or approval flow for RSA requests (the notes say keep it simple).

## Anti-goals

- Clinical form content must never be visible to Admin (Melyssa) or the RSA. The forms say: "These records never enter the CRM, the admin file, or family communication."
- No cluttered screens. Every element must be something a named person acts on or decides from.
- No invented business facts presented as real. Sample patients and leads are fictional and labelled as such.

## People (names from the documents)

| Profile | Shown as | Works on |
|---|---|---|
| ahmed | Ahmed · Management | Dashboard KPIs, everything readable, urgent and risk escalations, sign-offs ("Seen by Ahmed"), consent exceptions |
| clinical-director | Clinical Director | Clinical forms 1–7, countersigning, case review chair |
| nabila | Nabila · Psychologist | Own sessions and session notes, records case reviews (Form 5) |
| fadia | Fadia · Nurse | Medical clearance, nursing appointments, blood tests, external psychiatrist appointments, prescriptions |
| melyssa | Melyssa · Admin & Coordination | Leads, pipeline, calls, admissions admin, schedule (psychologist view-only), Form 8 follow-up calls, wallet top-ups |
| john | John · Physical Therapy & Fitness | Fitness forms 1–6 |
| rsa | RSA team | Patient requests, invoice (fatoura) scans, wallet purchases |

Wael (fitness escalation), Shady (kitchen), the nutritionist (role not yet filled) and the external psychiatrist appear only where the forms name them.

**Spelling:** the owner's forms use "Melyssa"; the meeting notes use "Melissa". The owner's spelling is used.

## Access

| Area | ahmed | clin. dir. | nabila | fadia | melyssa | john | rsa |
|---|---|---|---|---|---|---|---|
| Dashboard (KPIs) | ✓ | | | | | | |
| Today (own work) | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Leads, Pipeline | ✓ | | | | ✓ | | |
| Admissions | ✓ | ✓ own step | ✓ own step | ✓ own step | ✓ | | |
| Patients list | ✓ | ✓ | assigned | ✓ | ✓ | ✓ | assigned |
| Patient › Overview | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Patient › Clinical (forms 1–7) | ✓ | ✓ | own entries + read | | | | |
| Patient › Follow-up log (form 8) | ✓ | ✓ | | | ✓ | | |
| Patient › Medical | ✓ | read | | ✓ | | read clearance | |
| Patient › Fitness (forms 1–6) | ✓ | | | ✓ | | ✓ | |
| Patient › Documents & signatures | ✓ | | | ✓ prescriptions | ✓ | | |
| Patient › Wallet & requests | ✓ | | | | ✓ | | ✓ |
| Schedule | ✓ all | own | own | own + psychiatrist | all (psychologist slots view-only) | own | |
| Requests (RSA) | ✓ | | | | ✓ | | ✓ |

The role switcher is a preview control, not authentication. This is stated in the profile menu.

## Pipeline

- **Stages:** New Inquiry → Assessment → Agreement. Closed outcomes are Admitted (only through admission) and Declined.
- **Inquiry fields:** name, phone, email, source channel, program, contact person, drug of choice, duration of use (years), previous detox (Yes/No), communication preference (Phone call · WhatsApp · Email · Not comfortable talking on the phone), urgency (Normal · Urgent), and potential revenue (number, default 0, never empty).
- **Programs:** Inpatient, Outpatient, Detox, Detox + Inpatient. *Builder's call:* the existing app had only Residential and Outpatient, and the notes say three existing options exist; Inpatient/Outpatient/Detox is the assumed set.
- **48-hour rule (decision 1, builder's call):** after 48 hours in New Inquiry, the card shows "Review due" and a task goes to the contact person. Nothing moves automatically, because staff own the decision.
- **Stage history:** every move is recorded with the person and time. Time-in-stage is shown on each card.
- **Calls:** each call is logged with called-by, date, outcome and notes, and appears in the activity history.
- **Follow-ups:** creating an inquiry adds 2 call tasks (+7 days, "Follow-up call 1 of 2"; +30 days, "Final follow-up call"). They are cancelled when the inquiry is admitted or declined. Whoever completes a task is recorded.
- **Urgent:** marking an inquiry Urgent notifies Ahmed, the Clinical Director and the contact person. Each notification shows its delivery as In-app (delivered), Email (queued) and WhatsApp (queued), and links to the inquiry. Only Leads/Pipeline users can open the inquiry details.
- **Clarification-only (decision 2, builder's call):** "Answer & keep" sends the standard clarification reply on the lead's communication preference (WhatsApp if "not comfortable on the phone" and no preference), logs it, and keeps the inquiry in New Inquiry.

## Leads inbox

One list of incoming messages across WhatsApp, Instagram, Facebook, Email, Website form and Phone. Filters: channel, status (New, Replied, Converted, Closed), and search.

Selecting a lead opens its thread with three actions:

- Reply: queued on the same channel.
- Create inquiry: prefilled, goes into New Inquiry, and the lead becomes Converted.
- Close as spam or not relevant.

The header shows:

- Today's count
- Unanswered
- Median first-response time
- Count per channel

## Scheduling

- **Services and default durations:** Nursing appointment 30m, Blood test 15m, Therapist session 50m, Psychologist session 50m, Physiotherapy 45m, Fitness session 60m, Group 60m, External psychiatrist (recorded only).
- **Working hours:** 09:00–17:00, Monday–Saturday.
- **Earliest slot:** start the next day; take the first gap for the provider that has no overlap. Search forward up to 14 days.
- **Psychologist session:** booked automatically when an inquiry enters Agreement (its admission starts). The booking is saved to the onboarding record and shown in the patient's upcoming appointments. *Builder's call for decision 3.*
- **Other internal services:** booked with "Book earliest", which proposes the slot for staff to confirm.
- **External psychiatrist:** Fadia records date, time and psychiatrist name. The "Prescription received" action uploads the file, links it to the patient and notifies Fadia.
- **Melyssa:** can see psychologist appointments but cannot create, move or cancel them.
- **Mandatory session note:** a completed psychologist or therapist session without a session note (Form 3) shows as overdue on the owner's Today page after 24 hours.

## Admission (decision 4, builder's call)

When an inquiry enters Agreement, an onboarding record is opened. It has 5 steps:

1. Nursing assessment (Fadia)
2. Psychologist session completed (Nabila; auto-booked)
3. Financial arrangement (Melyssa or Ahmed: monthly amount + payment terms)
4. Admission agreement signed (e-sign or scanned upload)
5. Room assigned (Melyssa)

When all 5 are done, Admit:

- Creates the patient (full name for admin, "First L." for clinical display)
- Creates their wallet at $0.00 (decision 5: creation plus top-ups and purchases already built)
- Closes the inquiry as Admitted and cancels its follow-ups
- Starts Form 7 (Discharge plan)
- Creates tasks for Form 1 (due within 72 hours) and Form 2 (due within 7 days) for the Clinical Director

## Forms

Each form is a schema that a single renderer draws. The schemas mirror the documents field by field, and labels are copied verbatim.

Tag → input:

| Tag | Input |
|---|---|
| text, notes | Text field / text area |
| date, time, number (+unit) | Date / time / number field |
| select one | Radio buttons |
| select all | Checkboxes |
| low-med-high | Three-option tap |
| 1–5 | Tap scale |
| auto | Read-only computed value |
| signature | Signature capture |
| photo | Camera / attach |
| table | Repeatable rows |

Rules from the documents:

- **Clinical Form 1:** any Medium or High risk requires the risk note and notifies Ahmed. The risk then shows on the patient header and on every later session note until a reviewed-down entry.
- **Clinical Form 2:** monthly reviews are dated entries appended to the plan, not rewrites.
- **Clinical Form 3:** a risk flag requires the "escalated to" field and notifies Ahmed (and Fadia if "medical" is flagged).
- **Clinical Form 6:** patient consent (or Ahmed's documented exception) is required before the session fields unlock.
- **Clinical Form 7:** follow-up dates create the 3 post-discharge calls for Melyssa (Form 8 rows: 1 week, 1 month, 3 months).
- **Clinical Form 8:** "Routed to Clinical Director" notifies the Clinical Director.
- **Fitness Form 1:** gate two is locked until gate one is "Yes". BMI is auto-calculated from weight and height.
- **Fitness Form 3:** "Significant" severity or "Escalated to Fadia = Yes" notifies Fadia.
- **Fitness Form 4:** the 4 ratings average into the Form 5 wellbeing avg.
- **Fitness Form 5:** attendance % comes from Form 2 rows; BMI and wellbeing are auto.
- **Fitness Form 6:** "Requirements sent to kitchen = Yes" records a note to Shady.

## Documents & e-signature

Patient documents have a type (Admission agreement, Consent, Prescription, Invoice (fatoura), Other), a status (Awaiting signature, Signed electronically, Signed scan uploaded) and who/when. An e-signature is captured on a signature pad and stored as an image with the signer's name and time. A scanned document is uploaded as a file (stored in IndexedDB) and linked to the patient.

## Potential revenue (decision 6, builder's call)

The dashboard shows:

- Inquiry potential (New Inquiry)
- Assessment potential
- Combined (the sum of those two, as specified)
- Agreement shown separately, labelled "not in combined"

Empty values count as 0.

## KPIs (Ahmed's dashboard)

- **Leads:** this month by channel, median first response, lead → inquiry conversion.
- **Pipeline:** count and potential per stage, reviews overdue (48 h), open urgent, conversion inquiry → admitted over the last 90 days.
- **Census:** admitted patients, occupancy % of beds, admissions and discharges this month, average length of stay.
- **Clinical quality:** session notes within 24 h %, treatment plans overdue (> 7 days), Form 1 within 72 h %, patients rated Medium/High risk.
- **Aftercare:** follow-up calls on time %, outcome mix (Well / Struggling / Relapsed).
- **Fitness:** session attendance %, injuries this month.

## Brand & UI

- **Name and logo:** "Cedar Rehab — Addiction Rehabilitation & Prevention Center", using the supplied logo (resized for the web).
- **Colours:** ink #1C1C1C, brand lime #7CFC00. Lime is used for fills and marks with ink text on top (contrast about 15:1), never as text on white. Dark green #2F6B00 for links and focus. Neutral greys; white surfaces.
- **Type:** system font stack, a tight scale, tabular numbers for figures.
- **Layout:** left sidebar (logo, the profile's pages, live counts) and a top bar (search, notifications, profile switcher).
- **Mobile:** below 900 px the sidebar becomes a drawer; tables become cards; the pipeline scrolls horizontally with a "Move to" menu.
- **Accessibility:** keyboard reachable throughout, a visible focus ring, reduced motion respected, dialogs trap focus. Drag and drop always has a "Move to" menu alternative (and works on touch that way).

## Storage

Browser localStorage key `cedar-rehab-v1`; files are stored in IndexedDB. The Ahmed profile menu has "Reset sample data". All sample data is fictional.

## Addendum (2026-11-02): Cedar Assist preview

Roy chose two AI features for the owner's approval: session-note dictation and case review prep. They are frontend only, with no backend and no AI provider. Each works for real in the browser and is labelled "Preview of Cedar Assist". The live version would use an AI model. In this preview nothing leaves the browser.

**Session-note dictation (Clinical Form 3)**
- Inside an editable Individual Session Note, the clinician either speaks or types rough notes.
- Speaking uses the browser's speech recognition (Web Speech API), in English, Arabic or French.
- "Draft the note" fills these fields: Attendance, Themes worked, Risk flags, If flagged — escalated to, and Plan progress & action for next session.
- Risk words are recognised in English, plus common Arabic and French terms. A negated mention ("denies self-harm", "no cravings") does not raise a flag.
- Escalation follows the form's rule: Ahmed always, and Fadia if the notes mention anything medical.
- The draft never signs. Every filled field is marked for review, and the clinician signs as usual.
- Where speech recognition is unavailable, typing still works.

**Case review prep (Clinical Form 5)**
- "Prepare this week" summarises each admitted patient's last 7 days from their filed records.
- It raises the form's standing flags:
  - incident: an injury report, or a session risk flag other than relapse;
  - relapse: a relapse or craving flag;
  - refusal pattern: two or more refusals or absences across sessions, groups and fitness;
  - medication change: a prescription received;
  - approaching discharge: phase 4, or a planned discharge within 14 days.
  - "RSA-reported concern" has no source record yet and is not raised.
- Flagged patients are listed first. The case review table is prefilled with each patient's phase and a brief status, and the high-risk list with patients rated Medium or High. Decisions and actions stay with the team.
- The same weekly summary appears on each patient's Clinical tab.
