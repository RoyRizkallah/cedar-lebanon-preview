# Cedar Lebanon staff workspace

A local Svelte frontend with a Node server, built from the workflow ideas in `RecoveryOS_Visual_Proposal.pdf`. The visual design is original. The current release is an interactive **fictional-data preview** for reviewing Cedar's staff workflows. It is not a production patient record system.

## Render review build

Render uses `render.yaml` to run `npm ci && npm run build:review` and publish `dist` as a static site. Keep the preview limited to fictional information: the role switcher demonstrates workspaces but does not authenticate users. Each reviewer's changes are stored in that reviewer's browser and do not sync between devices.

The public review keeps the source-linked, verified patient summaries and admissions calculations. Optional local-model synthesis and PDF/DOCX text extraction require the local Node server and are unavailable in this static review build. TXT, MD, CSV, and JSON text files remain readable in the browser.

## Run locally

```sh
npm install
npm run dev
```

The Vite development server prints its local address. For document reading and the optional local AI endpoints, use the Node server:

```sh
npm run build
npm start
```

Open `http://localhost:4173/` for the workspace or `http://localhost:4173/design-preview.html` for the original static HTML design proposal. The live workspace contains the current role pages and filter controls. Nothing is deployed or published by these commands.

If another preview already occupies port 4173, run `npm start -- 4174` and open `http://localhost:4174/`. Use the Node server for the full preview, including document reading and patient-review endpoints.

## Walk through the preview

Use the **View as** role and staff controls in the top bar. Each role has a visibly distinct sidebar with its own navigation groups, live work counts, and assigned-work shortcut. Each workspace also has its own home, actions, and assigned work:

| Workspace | Main work |
| --- | --- |
| Director | Center overview, all operations, clinical records, case reviews, resident wallets, finance, reports, admissions intelligence |
| Coordinator | Intake decisions, dedicated handoff queue, patient coordination, case reviews, rooms, follow-ups, operations reports |
| Therapist | Assigned caseload, care-plan worklist, clinical report library, notes, team comments, case reviews, sessions, attendance, follow-ups |
| Finance | Invoices, payment register, manual resident wallet top-ups, supplier expenses, journal and trial balance, bank reconciliation, payer accounts, financial reports |
| Reception | First inquiries, intake scheduling, assigned arrivals board, room readiness |
| RSA | Assigned residential residents, daily support check-ins, resident website requests, and recording fulfilled or offline purchases against resident wallets |
| Resident | Personal wallet balance, deposit and purchase history, and an item request form with live request status in the local preview |

The role selector is a **preview control**, not authentication. Role checks and assignments in the browser demonstrate intended boundaries only.

Press **Ctrl K** (or **Command K**) to find a page or an assigned patient. Use the arrow keys and Enter to open a result. On phones, **Switch patient** opens the compact directory. Dialogs and the mobile navigation keep keyboard focus inside until closed; Escape closes them and returns focus to the opening control. The UI respects reduced-motion settings and uses local system fonts.

### Connected workflows

- **Admission to care:** capture an inquiry, track contact and document checks, record a staff decision, plan arrival, then create the linked patient record.
- **Clinical work:** review a patient's overview and timeline; update care goals; write signed notes and team comments; draft and finalize printable reports; record attendance; register documents and local attachments; track consent.
- **Patient case review:** open a patient's **AI review** tab to gather the current profile, admission context, care plan, notes, team comments, existing reports, linked sessions, attendance, follow-ups, document text, and consent register. The review shows source IDs, document coverage, missing content, and a formatted report draft with print/PDF support. A therapist or director can save that draft in the patient's Reports tab; a coordinator can use the review for handoffs. Reviews are marked stale when the underlying record changes. A detailed, calculated report works without a model. With a local model configured, Cedar adds a source-linked synthesis that staff must verify. It does not diagnose or make treatment decisions.
- **Rooms and placement:** directors and coordinators can add single or twin rooms, edit wing, number, access, readiness and housekeeping notes, and remove empty rooms. Capacity updates across the workspace. Occupied beds block unsafe room removal, capacity reduction and maintenance status. Reception can inspect readiness without changing rooms.
- **Scheduling and aftercare:** link sessions to patients and record attendance from the calendar; complete an aftercare contact and assign its next task.
- **Resident support:** directors and coordinators assign an RSA in the patient form. Each RSA sees only assigned residential residents, records dated practical check-ins, and can fulfill or decline requests from those residents. RSAs can also record an offline purchase after staff provides the item.
- **Resident web orders:** a resident submits an item, quantity, and optional details from My orders, then follows its status. They can cancel while it is pending. The assigned RSA or a director records the actual cost only after purchase and handover; declined or cancelled requests are never charged. A pending request does not reserve or deduct funds.
- **Resident wallets:** Finance or a director records funds received outside the website. Fulfilled and offline purchases reduce the available balance, and a purchase cannot exceed it. The resident's view shows their own balance, request status, and purchase history. These wallet entries are separate from the center's accounting ledger in this fictional preview.
- **Finance:** create invoices with funding and terms, record receipts with method and reference, and inspect payer balances. Capture supplier bills, approve them, record payments, and match fictional bank statement lines. The general ledger creates balanced entries from invoices, receipts and expenses; it includes manual adjustments, reversals, a chart of accounts, and a trial balance. Unpaid invoices can be voided with a visible reversing entry. CSV exports are available on the finance pages.
- **Reports:** inspect operational, admissions, care-delivery, and financial views according to role; export their CSV data.
- **Cedar Intelligence:** investigate admissions trends using calculated figures, clear date windows, record counts, and an exportable evidence log. The figures come from fictional historical inquiry data.

For the model-written parts of patient reviews and admissions intelligence, run a local Ollama-compatible model at `127.0.0.1:11434` and set `CEDAR_LOCAL_MODEL` to its model name before `npm start`. No external AI API is used. The model receives only the fictional record sources sent from this browser to the local Node server. Its output remains a draft with source links and human review.

TXT, MD, CSV, and JSON attachments are read in the browser. PDF and DOCX text extraction requires the local Node server plus Python with `pypdf` and `python-docx` installed. The preview reads up to 16,000 characters per file; scanned PDFs need OCR before their content can be reviewed. Unreadable or truncated material is shown explicitly.

Changes persist in browser `localStorage`; attached demo documents use browser IndexedDB. The Director's reset control restores the sample data and clears those attachments. This is a single-browser preview; records do not synchronize across staff or devices. Use **fictional data only**. Real patient use requires a secure backend, authentication, enforced authorization, audit trails, encryption, backups, data governance, and deployment review.

## Finding and reviewing records

Every main register has keyword search, relevant facets, sort order, matching counts, removable filter chips, and a reset action. Date ranges are inclusive. Filters are scoped to the current page, staff workspace or patient, and do not change source records. Expand **Filters** to refine a list; the controls start collapsed so the records appear sooner. Wide tables support horizontal scrolling by touch or keyboard.

- **Operations:** filter inquiries by stage, program, coordinator, referral source and document readiness; patients by program, status and care team; rooms by wing, readiness, occupancy, type, access and ready-bed availability; appointments by staff and recording state; follow-ups by status, owner, contact method and due dates.
- **Clinical work:** filter care goals, clinical reports, handoffs, planned arrivals, notes, comments, attendance, documents, permissions and timeline events. The timeline includes all recorded history and links back to sources. Open patient, note and report selections remain visible while their directory is filtered.
- **Accounting:** filter invoices, receipts, collections, supplier bills, journal entries, accounts, bank matches and payer balances. Journal account filters retain both sides of matching entries. Trial-balance footer totals refer to visible accounts; filtered account subsets need not balance. Overview cards remain all time unless a report explicitly describes a filtered cohort.
- **Exports and longer lists:** CSV exports follow the matching set across all result pages. Larger registers have page controls and a page-size selector. Financial reporting distinguishes an invoice cohort's current balances from the separate all-time operating statement.

## Checks

```sh
npm run test:analytics
npm run test:roles
npm run test:clinical
npm run test:patient-ai
npm run test:finance
npm run test:workspace
node scripts/test-wallet.mjs
npm run test:filters
npm run build
```

`src/registry.js` filter logic is covered by `test:filters`. `scripts/check-filter-browser.mjs` exports `checkFilterBrowser(page, baseUrl)` for a Playwright Page in a fresh browser context against the built local server. It checks combined filters, exact CSV contents, pagination, handoff ordering and phone controls. Review captures and results are in `artifacts/ui-review/`.

`scripts/check-rsa-wallet-browser.mjs` exports `checkRsaWalletBrowser(page, baseUrl)` for a fresh Playwright Page against the running local server. It covers RSA assignment, finance top-up, offline purchase, resident web request, and a single wallet deduction on fulfillment.
