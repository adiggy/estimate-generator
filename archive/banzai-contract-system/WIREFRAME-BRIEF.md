# Banzai Contract Form System — Wireframe Build Brief

## Goal

Build a simple, working wireframe prototype to demonstrate the workflow to the client before sending the proposal. This should be a single self-contained web app with placeholder content and basic styling — functional enough to click through the full workflow, but not production-ready.

## Tech Stack

- **Frontend:** React + Vite (or plain HTML/JS if simpler)
- **Backend:** Express.js (single `server.js`)
- **Database:** SQLite (file-based, zero config — just for the prototype)
- **PDF:** Basic PDF generation (use `pdf-lib` or `jspdf` — doesn't need to match the final layout perfectly)
- **Styling:** Keep it simple — Tailwind CDN, or a minimal CSS file. Clean and professional but clearly a wireframe.

## The App

This is a contract information collection system for a film/TV production company. They have 50-60 cast and crew per project. The workflow replaces a Google Sheets process that kept locking them out.

### Three Views

1. **Admin Dashboard** (password-protected) — staff creates contracts, tracks status, downloads PDFs
2. **Person Form** (public, unique link) — talent/crew fills in their personal info
3. **Login Page** — simple password entry for staff

---

## Detailed Workflow

### Step 1: Staff Logs In
- Simple password field (hardcode password as `banzai` for the demo)
- On success, redirect to dashboard

### Step 2: Staff Creates a New Contract
- Staff clicks "New Contract" on the dashboard
- Selects **Project** from a dropdown (pre-seed 1-2 projects like "Tres Dias: Chabela", "Untitled Pilot")
- Selects **Contract Type**: "Cast Contract" or "Crew Deal Memo"
- Fills in the **staff fields** (deal terms — see field lists below)
- Clicks "Create & Generate Link"
- System creates the record, generates a unique link (e.g., `/form/{unique-id}`)
- Shows the link so staff can copy it and send to the person (via text, email, whatever)

### Step 3: Person Clicks Their Unique Link
- No login required — the link is their access
- They see a clean form with only their fields to fill in (see field lists below)
- The top of the form shows the project name and contract type so they know what it's for
- They fill in their info and click "Submit"
- On submit, show a simple "Thank you" confirmation

### Step 4: Staff Checks Dashboard & Downloads PDF
- Dashboard shows all contracts with status:
  - **Pending** — link sent, waiting on person (show in yellow/amber)
  - **Completed** — person submitted their info (show in green)
- For completed contracts, staff can click **"Download PDF"** to get the cover page
- Staff takes that PDF and attaches it to their DocuSign envelope (outside this system)

---

## Field Lists

### Cast Contract — Staff Fields (Step 2)
| Field | Type | Notes |
|-------|------|-------|
| Production Title | Auto-filled from project | |
| Episode Number | Text | |
| Role | Text | e.g., "Dirección" |
| Screen Credit | Text | e.g., "Laura A. Martinez Hinojosa" |
| Performance Rate | Number | Dollar amount |
| Rehearsal Rate | Number | Dollar amount (optional) |
| Estimated Total | Number | |
| Compensation Currency | Select | MXN / USD |
| Profit Participation % | Number | Can be 0 |
| Guaranteed Minimum | Number | Optional |
| Hotel Nights | Number | Optional |
| Travel Expenses | Number | Optional |
| Meals | Text | Optional |
| Agent Name | Text | Optional |
| Agent Phone | Text | Optional |
| Start Date | Date | |
| End Date | Date | |

### Cast Contract — Person Fields (Step 3)
| Field | Type | Notes |
|-------|------|-------|
| Nombre (First Name) | Text | Required |
| Apellido Paterno (Father's Last Name) | Text | Required |
| Apellido Materno (Mother's Last Name) | Text | Optional |
| Address | Textarea | Full address |
| Phone | Text | |
| WhatsApp Number | Text | May differ from phone |
| Email | Email | |
| Emergency Contact Name | Text | |
| Emergency Contact Phone | Text | |
| Bank Account | Text | Full-width field — accounts can be very long |
| CLABE | Text | Full-width field — 18-digit Mexican banking number |

### Crew Deal Memo — Staff Fields (Step 2)
| Field | Type | Notes |
|-------|------|-------|
| Production Title | Auto-filled from project | |
| Episode Number | Text | |
| Crew Title | Text | e.g., "Asistente de Dirección" |
| Screen Credit | Text | |
| Compensation Amount | Number | |
| Compensation Currency | Select | MXN / USD |
| Pay Period | Select | Per Project / Per Day / Per Week |
| Profit Participation % | Number | Can be 0 |
| Rentals | Text | Optional, equipment rentals |
| Loan-Out Company | Text | Optional |
| Loan-Out Phone | Text | Optional |
| Loan-Out Address | Text | Optional |
| Start Date | Date | |
| End Date | Date | |

### Crew Deal Memo — Person Fields (Step 3)
Same as Cast Contract person fields (name, address, phone, WhatsApp, email, emergency contact, bank account, CLABE).

---

## Database Schema (SQLite)

```sql
CREATE TABLE projects (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL
);

CREATE TABLE contracts (
  id TEXT PRIMARY KEY,           -- UUID for the unique link
  project_id INTEGER NOT NULL,
  contract_type TEXT NOT NULL,   -- 'cast' or 'crew'
  status TEXT DEFAULT 'pending', -- 'pending' or 'completed'
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  completed_at DATETIME,

  -- Staff fields (filled in Step 2)
  episode_number TEXT,
  role_or_title TEXT,            -- "Role" for cast, "Crew Title" for crew
  screen_credit TEXT,
  compensation_amount REAL,
  compensation_currency TEXT,    -- 'MXN' or 'USD'
  pay_period TEXT,               -- 'project', 'day', 'week' (crew only)
  performance_rate REAL,         -- cast only
  rehearsal_rate REAL,           -- cast only
  estimated_total REAL,          -- cast only
  profit_participation REAL DEFAULT 0,
  guaranteed_minimum REAL,       -- cast only
  hotel_nights INTEGER,          -- cast only
  travel_expenses REAL,          -- cast only
  meals TEXT,                    -- cast only
  agent_name TEXT,               -- cast only
  agent_phone TEXT,              -- cast only
  rentals TEXT,                  -- crew only
  loanout_company TEXT,          -- crew only
  loanout_phone TEXT,            -- crew only
  loanout_address TEXT,          -- crew only
  start_date TEXT,
  end_date TEXT,

  -- Person fields (filled in Step 3)
  nombre TEXT,
  apellido_paterno TEXT,
  apellido_materno TEXT,
  address TEXT,
  phone TEXT,
  whatsapp TEXT,
  email TEXT,
  emergency_contact_name TEXT,
  emergency_contact_phone TEXT,
  bank_account TEXT,
  clabe TEXT,

  FOREIGN KEY (project_id) REFERENCES projects(id)
);
```

Seed the database with these projects:
- "Tres Dias: Chabela"
- "Untitled Pilot"

---

## Admin Dashboard Layout

```
┌─────────────────────────────────────────────────────┐
│  Banzai! Entertainment — Contract Manager            │
│                                          [Logout]    │
├─────────────────────────────────────────────────────┤
│                                                      │
│  [+ New Contract]                                    │
│                                                      │
│  Filter: [All Projects ▼]  [All Types ▼]            │
│                                                      │
│  ┌─────────────────────────────────────────────────┐ │
│  │ Tres Dias: Chabela                              │ │
│  ├─────────────────────────────────────────────────┤ │
│  │ Laura Martinez  │ Cast  │ ● Completed │ [PDF]   │ │
│  │ Ariana Landeros │ Crew  │ ○ Pending   │ [Link]  │ │
│  │ (unnamed)       │ Crew  │ ○ Pending   │ [Link]  │ │
│  └─────────────────────────────────────────────────┘ │
│                                                      │
│  ┌─────────────────────────────────────────────────┐ │
│  │ Untitled Pilot                                  │ │
│  ├─────────────────────────────────────────────────┤ │
│  │ (no contracts yet)                              │ │
│  └─────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────┘
```

- **Name column:** Shows person's name if they've submitted, "(unnamed)" if pending
- **Pending rows:** Show a "Copy Link" button so staff can re-grab the unique URL
- **Completed rows:** Show a "Download PDF" button
- Clicking a row could expand to show all the details (nice to have, not required)

---

## Person Form Layout

```
┌─────────────────────────────────────────────────────┐
│  Banzai! Entertainment                               │
│                                                      │
│  Tres Dias: Chabela — Crew Deal Memo                │
│                                                      │
│  Please complete your information below.             │
│                                                      │
│  Nombre *          [________________]                │
│  Apellido Paterno *[________________]                │
│  Apellido Materno  [________________]                │
│                                                      │
│  Address *         [________________]                │
│                    [________________]                │
│                                                      │
│  Phone *           [________________]                │
│  WhatsApp          [________________]                │
│  Email *           [________________]                │
│                                                      │
│  Emergency Contact [________________]                │
│  Emergency Phone   [________________]                │
│                                                      │
│  Bank Account *    [________________________________]│
│  CLABE *           [________________________________]│
│                                                      │
│  (Bank fields are full-width for long account #s)    │
│                                                      │
│                              [Submit]                │
└─────────────────────────────────────────────────────┘
```

---

## PDF Output

For the wireframe, generate a simple PDF with all the contract data laid out cleanly. It does NOT need to match the final contract layout. Just include:

- Header: "Banzai! Entertainment, Inc." + Contract Type
- Production title and episode
- All staff-entered deal terms
- All person-entered info
- Bank account and CLABE
- Date completed

Use `pdf-lib` or `jspdf` — whichever is easier to set up.

---

## Pre-seeded Demo Data

Seed 2-3 contracts so the dashboard isn't empty on first load:

1. **Laura Andrea Martinez Hinojosa** — Cast Contract, Tres Dias: Chabela, **Completed**
   - Role: Dirección, Screen Credit: Laura A. Martinez Hinojosa
   - Performance Rate: $12,000 MXN, DLRS: $689.93, Per Project
   - All person fields filled in with placeholder data

2. **Ariana Landeros Vargas** — Crew Deal Memo, Tres Dias: Chabela, **Completed**
   - Crew Title: Asistente de Dirección, $8,000 MXN, Per Project
   - All person fields filled in with placeholder data

3. **One pending contract** — Crew Deal Memo, Tres Dias: Chabela, **Pending**
   - Staff fields filled in, person fields empty
   - Shows as "(unnamed)" on dashboard with copy-link button

---

## Important Notes

- Keep the code simple and readable — this is a prototype, not production code
- No need for error handling beyond basic form validation (required fields)
- The password is just stored in a variable — no real auth system needed
- SQLite file can be gitignored — seed data runs on startup if DB doesn't exist
- The entire thing should be in one project folder, easy to `npm install && npm start`
- Use a single port (e.g., 3456) — Express serves both the API and the static frontend
- Do NOT overcomplicate this — the goal is to demonstrate the 3-step workflow to the client
