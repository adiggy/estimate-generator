# Adrial Designs OS - Claude Workflow

## Team Roles

- **Project Manager:** Gemini (Antigravity) - Strategy, coordination, requirements
- **Senior Developer:** Claude Code - Implementation, architecture, coding

---

## ⚠️ CRITICAL ARCHITECTURE RULES

These rules exist because bugs occurred when they were violated. DO NOT modify code in ways that break these rules.

### 1. Firewall Between Proposals and OS-Beta

**The live proposals system and OS-beta are COMPLETELY SEPARATE.**

- **Proposals** live at root URL (`/`, `/{proposal-id}`)
- **OS-Beta** lives at `/dashboard/os-beta/*`
- OS-Beta code must NEVER modify the `proposals` table
- When converting a proposal to a project, create a NEW record in `projects` table
- DO NOT update `proposal.status` when converting - proposals stay "draft" forever

**Why:** A bug once caused 4 client-facing proposals to show "accepted" status when the conversion code modified them.

### 2. Scheduler Must Preserve Chunk Order

**The scheduler must NOT overwrite `phase_order` or `draft_order` fields.**

- `phase_order` = which phase a chunk belongs to (set during proposal conversion)
- `draft_order` = sequence within a phase (set during proposal conversion)
- The scheduler only sets `draft_scheduled_start` and `draft_scheduled_end`

**Why:** A bug once overwrote `draft_order` during scheduling, causing chunks to display out of sequence.

### 3. Scheduler Must Not Infinite Loop

**The scheduler must advance `slotIndex` even when no slots are available.**

```javascript
// CORRECT - always advance slotIndex
if (scheduledSlots.length > 0) {
  // ... schedule the chunk
  slotIndex = tempSlotIndex
} else {
  slotIndex = tempSlotIndex  // STILL ADVANCE even on failure
}
```

**Why:** A bug caused the server to hang at 100% CPU when the scheduler got stuck in an infinite loop.

### 4. Two API Implementations Must Stay in Sync

**Both `server.js` (local) and `app/api/os-beta.js` (Vercel) implement the same APIs.**

When modifying scheduler, time tracking, or other features:
1. Update `server.js` for local development
2. Update `app/api/os-beta.js` for production

**Why:** Features can work locally but break in production if only one file is updated.

---

## Overview

This is the **Agency Operating System** for Adrial Designs, combining:
1. **Proposal Generator** - Create client proposals from input documents
2. **Project Management** - Track all projects with status, priority, and billing
3. **Time Tracking** - Start/stop timers, log billable hours
4. **Invoicing** - Generate invoices from tracked time and chunks

**Architecture:** "Local-First, AI-Worker"
- **App** = React UI for viewing/managing data (Vite + Neon)
- **Worker** = Claude Code via CLI for intelligent tasks (scheduling, chunking, invoice drafting)

**Production Safety:** Proposals at root `/`, OS features sandboxed at `/dashboard/os-beta/`

---

## Part 1: Proposal Generator

This tool generates design proposals for Adrial Designs. Claude creates complete proposal JSON files based on input documents, which are then edited in the browser-based proposal editor.

## Folder Structure

```
estimate-generator/
├── input/               # Drop client documents here (PDFs, emails, notes)
├── archive/             # Archived inputs organized by client-project
│   └── {client}-{project}/
│       ├── input/       # Original input documents
│       └── proposal.pdf # Latest exported PDF
├── data/
│   ├── templates/       # Project type templates (benefits, upsells, phases)
│   │   ├── web.json
│   │   ├── logo.json
│   │   ├── print.json
│   │   └── app.json
│   ├── clients.json     # Client database with discount info
│   └── proposals/       # Generated proposal JSON files
├── app/                 # React frontend (Vite + Tailwind)
│   └── api/             # Vercel serverless API routes
├── scripts/
│   └── push-proposal.js # Sync local proposals to Neon database
└── server.js            # Express API server (port 3002, local dev only)
```

---

## Workflow

### Step 1: User Drops Documents into `/input`

Place any relevant project materials:
- Scope documents or RFPs
- Email threads
- Meeting notes
- Client briefs
- Reference images/assets

### Step 2: User Initiates Proposal Creation

User tells Claude something like:
> "New project. Check the input folder and create a proposal."

### Step 3: Claude Reads, Analyzes, and Identifies Project Type

**PDF Handling - CRITICAL:**

Before reading ANY PDF, you MUST follow this workflow to prevent API errors:

1. **DO NOT attempt to read the PDF directly** - this will cause API limit errors for large documents
2. **Run the chunking script first:**
   ```bash
   python split_pdf.py
   ```
   This script expects PDFs in `input/` and outputs 30-page chunks to `working/`
3. **Read chunks sequentially:** Read `working/chunk_01.pdf`, analyze, then `chunk_02.pdf`, etc.
4. **Process one chunk at a time** - do not attempt to read multiple chunks simultaneously

The `split_pdf.py` script automatically:
- Finds the PDF in `input/` folder
- Splits it into 30-page chunks
- Saves chunks as `working/chunk_XX.pdf`
- Reports total page count and chunks created

Claude reads all files in `/input` and extracts:
- Project type (web, logo, print, app)
- Project name and description
- Scope of work and deliverables
- Timeline constraints
- Budget indicators (if mentioned)
- Technical requirements

### Step 4: Claude Asks for Missing Required Information

**IMPORTANT:** Do NOT guess or fabricate client details. If not found in inputs, ASK the user for:

- Client contact name
- Company/organization name
- Email address (optional)
- Any unclear scope details

Example:
> "I found details about the [project]. Before I create the proposal, I need:
> - Client contact name
> - Company/organization name"

### Step 5: Claude Creates Complete Proposal (Automatic)

Once required info is provided, **immediately** create the proposal:

1. **Load the appropriate template** from `/data/templates/{type}.json`
2. **Add/update client** in `/data/clients.json` if new
3. **Create proposal JSON** in `/data/proposals/` with filename: `YYYY-MM-DD-project-slug.json`
4. Use template's `benefits`, `upsells`, and customize `phases` based on project scope

### Step 6: Claude Archives Input Documents

After creating the proposal JSON:

1. Create archive folder: `/archive/{clientId}-{project-slug}/input/`
2. Move all files from `/input/` to the archive folder
3. Confirm the `archivePath` field in proposal matches

This keeps `/input/` empty for future projects.

### Step 7: Claude Opens Proposal in Browser

After archiving, start the server (if needed) and open the proposal:

1. **Start servers** if not already running:
   ```bash
   npm start
   ```
   Run in background. Wait 3 seconds for startup.

2. **Check which port Vite is using** by reading the server output (typically 5173-5176)

3. **Open the proposal** using the correct port:
   ```bash
   open "http://localhost:{port}/{proposal-id}"
   ```

   Note: The route is `/{proposal-id}` directly, NOT `/proposal/{proposal-id}`.

### Step 8: User Reviews and Edits in Browser

1. Edit any field by clicking on it
2. Changes auto-save every second
3. Print to PDF and **save to archive folder** as `proposal.pdf`

### Step 9: Push to Production (When Ready to Share)

When the proposal is ready to share with the client:

```bash
npm run push-proposal {proposal-id}
```

Then share the client view link:
```
https://adesigns-estimate.vercel.app/{proposal-id}?view=1
```

---

## Proposal JSON Schema

**Benefits by project type:**
- **Web, Logo, Print:** Benefits come from shared templates in `/data/templates/`. Do NOT include `benefits` in the proposal JSON.
- **App:** Each app is unique, so include custom `benefits` array directly in the proposal JSON tailored to that app's functionality.

```json
{
  "id": "2026-01-19-project-slug",
  "createdAt": "2026-01-19",
  "updatedAt": "2026-01-19",
  "status": "draft",
  "projectType": "web",  // "web", "logo", "print", or "app"
  "archivePath": "archive/client-slug-project-slug",

  "clientId": "client-slug",
  "clientName": "Client Full Name",
  "clientRole": "Job Title",           // Optional
  "clientEmail": "email@example.com",  // Optional
  "clientCompany": "Organization Name", // Optional
  "projectName": "Project Title",
  "date": "January 19, 2026",
  "expirationDate": "February 19, 2026",

  "projectDescription": "2-4 sentence overview of the project goals.",

  "estimatedTimeline": "8-10 weeks from kickoff to launch.",  // Displayed after estimate

  "internalNotes": "Notes for Adrial only - won't print.",

  "phases": [],      // Customized per project (NOT from template)

  // For app projects ONLY - include custom benefits:
  "benefits": [
    { "icon": "Shield", "title": "Feature Name", "description": "What this feature does for the user." }
  ],

  // For complex projects - detailed feature breakdown (markdown supported)
  "projectSpecifics": "## Section Header\n- **Feature:** Description of feature.\n- **Another Feature:** More details.",

  // What's NOT included in the estimate (markdown supported)
  "exclusions": "- Content creation\n- Off-page SEO\n- Additional features not listed",

  "discountPercent": 0,
  "monthlyFee": 39,  // From template (39 for web/app, 0 for logo/print)

  "contactInfo": {
    "name": "Adrial Dale",
    "phone": "(919) 968-8818",
    "email": "adrial@adrialdesigns.com",
    "website": "www.adrialdesigns.com"
  }
}
```

---

## Project Templates

Templates are stored in `/data/templates/` and contain:
- `type` - identifier (web, logo, print, app)
- `label` - display name
- `benefits` - 6-9 items for "What's Included" section (ignored for app projects—use custom benefits)
- `upsells` - 2-3 items for "Also Available" section
- `defaultPhases` - starting point phases (customize per project)
- `monthlyFee` - default monthly fee (39 for web/app, 0 for logo/print)
- `designIncludes` - standard features included in design work (web/app only)
- `hostingIncludes` - features included with monthly hosting fee (web/app only)

**Available templates:**
| Type | File | Use For |
|------|------|---------|
| `web` | `web.json` | Websites, web apps, landing pages |
| `logo` | `logo.json` | Logo design, brand marks, visual identity |
| `print` | `print.json` | Brochures, flyers, marketing materials |
| `app` | `app.json` | Mobile apps, software UI design |

To edit templates, modify the JSON files directly in `/data/templates/`.

---

## Phase Estimation Guidelines

1. **Break work into logical phases** - typically 4-5 phases for apps, consolidate related features together
2. **Use realistic hour ranges** - low is optimistic, high is conservative
3. **Standard rate is $120/hr** unless client has a discount
4. **Efficient workflow pricing** - Adrial uses AI-assisted development, so estimates should be competitive with senior freelance designers/developers while staying well below agency rates. This typically reflects ~40% efficiency gain over traditional estimates.
5. **Customize from template** - use `defaultPhases` as starting point, adjust descriptions and hours for specific project
6. **For app projects** - include custom `benefits` array in the proposal JSON tailored to that app's specific functionality (see schema above)

---

## Client Database

Check `/data/clients.json` before creating proposals. If client exists, use their:
- `id` for the proposal's `clientId`
- `discountPercent` for the proposal's `discountPercent`
- Any relevant info from `notes` for `internalNotes`

If client is new, add them to `clients.json`:

```json
{
  "id": "client-slug",
  "name": "Client Name",
  "company": "Company Name",
  "email": "email@example.com",
  "phone": "555-555-5555",
  "discountPercent": 0,
  "notes": "How you met, payment history, preferences, etc."
}
```

---

## Brand Identity

**Typography:** Gilmer (Regular 400, Bold 700)
- Font files in `/app/public/fonts/`

**Colors:**
- Brand Red: `#d72027`
- Brand Orange: `#f69220`
- Brand Slate: `#2b303a`
- Brand Gray: `#9ca3af`

---

## Available Icons

For `benefits` and `upsells`, use these Lucide icon names:
- `Palette` - Design, creativity, custom work
- `Layout` - Structure, code, systems
- `Smartphone` - Mobile, responsive, devices
- `BarChart3` - Analytics, data, metrics
- `Shield` - Security, trust, ownership
- `Zap` - Speed, performance, efficiency
- `Megaphone` - Marketing, SEO, promotion
- `RefreshCw` - Updates, revisions, maintenance
- `PenTool` - Branding, identity, creative

---

## Running the App (Local Development)

```bash
# Start both servers
npm start

# Or separately:
npm run api   # Express API on port 3002
npm run dev   # Vite dev server on port 5173/5174
```

---

## Production Deployment

The app is deployed on **Vercel** with a **Neon PostgreSQL** database.

**Live URL:** https://adesigns-estimate.vercel.app

### Database (Neon)

**Source of Truth:** All client and project data lives in **Neon PostgreSQL** (cloud database). Local files in `legacy_data/` are exports/backups only.

**Connection:** `DATABASE_URL` environment variable in `.env`

Proposals, templates, and clients are stored in Neon PostgreSQL with JSONB columns:
- `proposals` table: `id` (TEXT), `data` (JSONB), `created_at`, `updated_at`
- `templates` table: `type` (TEXT), `data` (JSONB)
- `clients` table: `id` (TEXT), `data` (JSONB), `stripe_customer_id` (TEXT)

**Clients Table Schema:**
```sql
clients (
  id TEXT PRIMARY KEY,           -- e.g., 'donald-whittier'
  data JSONB,                    -- Client details (see below)
  stripe_customer_id TEXT        -- Stripe Customer ID (e.g., 'cus_xxx')
)
```

**Client Data JSONB Fields:**
```json
{
  "id": "client-slug",
  "name": "Client Company Name",
  "contactName": "Primary Contact Person",
  "email": "billing@example.com",
  "historicalCharges": 51,        // Past Stripe charges count
  "historicalTotal": 2027.21,     // Past Stripe charges total ($)
  "cardholderName": "Name on Card",
  "projectCount": 2,              // Number of hosting projects
  "monthlyTotal": 7800,           // Total monthly rate (cents)
  "monthlyProfit": 2600           // Total monthly profit (cents)
}
```

**Local Data Files (exports only):**
- `legacy_data/stripe_migration_status.csv` - Current hosting clients export
- `legacy_data/hosting_billing_dates.csv` - Billing dates from Bonsai
- `legacy_data/stripe_by_bonsai_client.csv` - Historical Stripe charges
- `legacy_data/bonsai/` - Bonsai platform exports

**Script to Consolidate/Export:**
```bash
node scripts/fix-client-data.js      # Fix historical charges & billing dates
node scripts/export-hosting-csv.js   # Export to CSV
```

### Hosting Billing Table

The `hosting_billing` table contains all hosting clients with complete billing data:

```sql
hosting_billing (
  id TEXT PRIMARY KEY,              -- project_id (unique per hosting project)
  client_id TEXT,                   -- e.g., 'donald-whittier'
  client_name TEXT,                 -- e.g., 'Donald Whittier'
  contact_name TEXT,                -- e.g., 'Dan May'
  email TEXT,                       -- billing email
  stripe_customer_id TEXT,          -- Stripe Customer ID when card saved
  stripe_status TEXT,               -- 'ready' or 'needs_setup'
  project_id TEXT,                  -- hosting project ID
  project_name TEXT,                -- e.g., 'Banzai website hosting'
  rate_cents INTEGER,               -- monthly rate in cents
  webflow_cost_cents INTEGER,       -- Webflow cost in cents
  profit_cents INTEGER,             -- rate - webflow_cost
  last_invoice_date DATE,           -- last Bonsai invoice date
  next_billing_date DATE,           -- next billing date
  billing_platform TEXT,            -- 'bonsai_legacy' or 'os'
  historical_charges INTEGER,       -- past Stripe charge count
  historical_total_usd NUMERIC,     -- past Stripe charge total
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
)
```

**Note:** Clients with multiple hosting projects (e.g., Donald Whittier) have multiple rows.

### Syncing Local Proposals to Production

After creating/editing a proposal locally, push it to Neon:

```bash
# Push a single proposal
npm run push-proposal 2026-01-19-project-slug

# Push all proposals
npm run push-all-proposals
```

The push script reads from `/data/proposals/` and upserts to Neon.

### Environment Variables (Vercel)

Required in Vercel project settings:
- `DATABASE_URL` - Neon connection string
- `EDIT_PIN` - PIN for edit mode authentication (currently: 6350)

---

## Shareable Client Links

Clients can view proposals via a shareable link without needing to authenticate.

### View Mode URL Format
```
https://adesigns-estimate.vercel.app/{proposal-id}?view=1
```

### View Mode Features
- Read-only (no editing)
- "Download PDF" button (instead of Print)
- Page break indicators hidden
- Page numbers in table of contents hidden
- Mobile responsive layout
- Clickable email (mailto:) and phone (tel:) links

### Edit Mode
- Requires PIN authentication (6350)
- Access via URL without `?view=1` parameter
- Dashboard at root URL shows all proposals
- Full editing capabilities

### Copying the Shareable Link
In edit mode, click "Copy link" button in the toolbar to copy the view-mode URL to clipboard.

---

## Mobile Responsiveness

The proposal view is fully responsive:
- **Benefits/Upsells grids:** 1 column on mobile → 2 on tablet → 3 on desktop
- **Design/Hosting includes:** 1 column on mobile → 2 on tablet+
- **Estimate table:** Hours column hidden on mobile, visible on sm+ screens
- **Header:** Logo and contact info stack vertically on mobile
- **Overview section:** Full width on mobile, 60% on larger screens
- **All print layouts preserved** - PDF exports use desktop layout regardless of screen size

---

## Updating an Existing Proposal

When asked to update a proposal:
1. Read the proposal JSON to find the `archivePath`
2. Review the original input documents in `{archivePath}/input/`
3. Make requested changes to the proposal JSON
4. Remind user to re-export PDF to the same archive folder

---

## PDF Export & Print Layout

**PDF Filename:** Automatically set to `proposal_Project-Name_Client-Last-Name.pdf`

**Page Structure:**
- Page 1: Header, title block, overview, What's Included (benefits grid)
- Page 2+: Estimate table (headers repeat on each page if table overflows)
- Timeline + Also Available page (grouped together)
- Your Website Design Includes + Hosting Includes page (if applicable, from template)
- Project Specifics page (if `projectSpecifics` field is populated—for complex projects)
- What Is Not Included section (if `exclusions` field is populated)

**Print CSS Features:**
- Section headings: Red (#bb2225), uppercase, bold
- Table headers repeat at top of each page when estimate spans multiple pages
- Totals section stays together (`break-inside: avoid`)
- Timeline + Also Available grouped together, won't split across pages
- 0.5" top padding on overflow pages for breathing room

---

## Timeline Estimation

When estimating project timelines:
- **Calculate hours to weeks:** Total hours ÷ 20-25 hrs/week = build weeks
- **Add buffer:** +2-3 weeks for client review cycles
- **University/institutional clients:** Add extra time for slower approval cycles

**Typical ranges by project size:**
| Hours | Timeline |
|-------|----------|
| 50-80 hrs | 4-6 weeks |
| 100-150 hrs | 6-10 weeks |
| 150-220 hrs | 10-14 weeks |

Include post-launch support period if applicable (e.g., "followed by 30 days of post-launch support").

---

## Part 2: Agency Operating System (OS Beta)

### Accessing the OS

- **Local:** `http://localhost:5173/dashboard/os-beta`
- **Production:** `https://adesigns-estimate.vercel.app/dashboard/os-beta`

### Database Schema

The OS extends the existing Neon database with these tables:

| Table | Purpose |
|-------|---------|
| `projects` | All work items with status, priority, billing info |
| `chunks` | 1-3 hour work units for scheduling |
| `time_logs` | Tracked time entries (billable/non-billable) |
| `invoices` | Draft, sent, and paid invoices |
| `oauth_tokens` | Google Calendar tokens (future) |

**Key Fields:**
- **Money in cents:** `rate = 12000` means $120.00
- **Status values:** `active`, `waiting_on`, `paused`, `done`, `invoiced`
- **Priority:** `1` = priority, `0` = normal, `-1` = later, `-2` = maybe
- **Billing platforms:** `os` (new system) vs `bonsai_legacy` (hosting clients)

### CLI Scripts

| Command | Purpose |
|---------|---------|
| `npm run import-legacy` | Import Airtable CSV data (run with `--dry-run` first) |
| `npm run time-log start {project-id} "desc"` | Start timer |
| `npm run time-log stop` | Stop active timer |
| `npm run time-log log {project-id} "desc" --duration 2h` | Log completed time |
| `npm run time-log status` | Check active timer |
| `npm run time-log list {project-id}` | List recent logs |
| `npm run invoice --client {id}` | Generate invoice for client |
| `npm run invoice --project {id}` | Generate invoice for project |
| `npm run chunker {project-id}` | Break project into schedulable chunks |
| `npm run schedule --week` | Schedule chunks for coming week |
| `npm run quick-project input/file.md` | Create project from lightweight markdown input |

### API Endpoints

All OS endpoints are under `/api/os-beta/`:

| Endpoint | Methods | Purpose |
|----------|---------|---------|
| `/projects` | GET, POST | List/create projects |
| `/projects/{id}` | GET, PUT, DELETE | Single project operations |
| `/chunks` | GET, POST | List/create chunks |
| `/chunks/{id}` | GET, PUT, DELETE | Single chunk operations |
| `/time-logs` | GET, POST | List/create time entries |
| `/time-logs/{id}` | GET, PUT, DELETE | Single time log operations |
| `/invoices` | GET, POST | List/create invoices |
| `/invoices/{id}` | GET, PUT, DELETE | Single invoice operations |
| `/proposals` | GET, POST | OS Beta proposals (separate from live proposals) |
| `/proposals/{id}` | GET, PUT, DELETE | Single proposal operations |
| `/stats` | GET | CFO metrics (unbilled, unpaid, revenue) |
| `/search?q=term` | GET | Global search across all data |
| `/stripe/checkout-session` | POST | Generate Stripe Checkout link for card setup |
| `/stripe/customer/{clientId}` | GET | Get client's Stripe customer & payment methods |
| `/stripe/charge` | POST | Charge a client's saved card |
| `/webhooks/stripe` | POST | Stripe webhook handler |

**Stripe Billing Endpoints:**
- `POST /stripe/checkout-session` - Body: `{ clientId }` → Returns `{ sessionId, url, customerId }`
- `GET /stripe/customer/{clientId}` → Returns `{ hasStripeCustomer, customerId, paymentMethods[] }`
- `POST /stripe/charge` - Body: `{ clientId, amount, description }` → Charges saved card

**Time Log Actions (PUT /time-logs/{id}):**
- `action: 'pause'` - Pause active timer, accumulate seconds
- `action: 'resume'` - Resume paused timer
- `action: 'stop'` - Stop timer without finalizing
- `action: 'finalize'` - Finalize timer, round to 15 minutes, mark ready for invoice
- `action: 'set_time'` - Manually set accumulated_seconds (for editing timer)

**Invoice Creation (POST /invoices):**
- Include `time_log_ids` array to mark those logs as invoiced
- Include `line_items` array with description, quantity, rate, amount

**Invoice Update (PUT /invoices/{id}):**
- Can include `time_log_ids` to mark additional logs as invoiced (for adding to existing draft)

### UI Pages

| Route | Page | Purpose |
|-------|------|---------|
| `/dashboard/os-beta` | Dashboard | Overview with stats, recent projects |
| `/dashboard/os-beta/proposals` | Proposals | List of OS Beta proposals |
| `/dashboard/os-beta/proposals/{id}/edit` | Proposal Edit | Edit proposal with delete option |
| `/dashboard/os-beta/projects` | Projects | Smart grid of active projects (excludes hosting) |
| `/dashboard/os-beta/projects/{id}` | Project Details | Metadata, phases, chunks, Gantt timeline |
| `/dashboard/os-beta/hosting` | Hosting | Legacy Bonsai clients with MRR display |
| `/dashboard/os-beta/time` | Time Tracking | Mobile-first timer with editable display |
| `/dashboard/os-beta/invoices` | Invoices | Invoice list, creation, editing |
| `/dashboard/os-beta/invoices?create=1` | New Invoice | Auto-opens create invoice modal |
| `/dashboard/os-beta/schedule` | Schedule | Weekly schedule with draft generation |
| `/dashboard/os-beta/timeline` | Master Timeline | Gantt view of ALL projects interleaved |

### UI Features

**Header:**
- Live search with grouped results (Projects, Invoices, Clients)
- Click search icon or press `/` to open

**Time Tracking:**
- **Editable Timer:** Click HH:MM:SS display to edit time while running
- **15-Minute Rounding:** Finalized timers round UP to nearest 15 minutes
- **Ready to Invoice:** Section shows finalized but unbilled time entries
- **Create Invoice Link:** Quick link to invoices page with modal auto-open

**Invoices:**
- **Add to Existing Draft:** When creating invoice, option to add to existing draft for same client
- **Editable Line Items:** Click description or hours to edit inline
- **Projects/Hosting Tabs:** Separate views for project work vs recurring hosting
- **Status Workflow:** Draft → Sent → Paid (or Void)

**Projects:**
- **Metadata Display:** Status, priority, billing type, rate, budget, due date, last touched
- **View Proposal Link:** Quick link back to source proposal (if created from one)

**General:**
- **ConfirmModal:** Nice modal dialogs for delete confirmations (replaces browser alerts)
- **Brand Slate Buttons:** Primary buttons use brand-slate (#2b303a) not red

### Status Colors

- `active` - Green (#22c55e)
- `waiting_on` - Yellow (#eab308)
- `paused` - Gray (#6b7280)
- `done` - Blue (#3b82f6)
- `invoiced` - Purple (#8b5cf6)

### Scheduling System (CRITICAL FEATURES)

The scheduler assigns chunks to time slots while respecting all constraints.

**⚠️ CRITICAL: These features have been lost before - DO NOT remove them:**
1. Configurable start date
2. Calendar rocks (existing events)
3. Interleaved scheduling (round-robin)
4. Phase/draft ordering preservation

**Work Hours (Adrial's schedule):**
- **Start:** 12:00 PM
- **End:** 7:30 PM (8 slots available, 12-7pm + partial)
- **Max hours/day:** 7 schedulable hours
- **Weekends:** Off (Saturday & Sunday not scheduled)

**Scheduling Features:**
1. **Configurable start date** - POST body accepts `startDate` (e.g., `"2026-01-26"`)
   - If not provided, defaults to today (if weekday) or next Monday (if weekend)
2. **Calendar rocks** - Reads Google Calendar to avoid existing events
   - Fetches events from reference calendar
   - Marks those time slots as unavailable
   - Includes all-day events (blocks entire day)
3. **Interleaved scheduling** - Round-robin through ALL active projects
   - Each project gets 1 chunk scheduled, then moves to next project
   - Ensures all projects make progress each week
   - NOT sequential (don't finish one project before starting another)
4. **Phase ordering** - Respects `phase_order` and `draft_order` within each project
5. **Draft vs Published** - Schedule generates as draft, must be published to commit
6. **Multi-week support** - Calculates weeks needed from total hours, schedules all chunks

**API: Schedule Generation**
```bash
# Generate schedule starting today
curl -X POST http://localhost:3002/api/os-beta/schedule/generate

# Generate schedule from specific date
curl -X POST http://localhost:3002/api/os-beta/schedule/generate \
  -H "Content-Type: application/json" \
  -d '{"startDate": "2026-01-26"}'
```

**Response includes:**
- `scheduled` - Number of chunks scheduled
- `projects` - Number of projects included
- `rocksAvoided` - Calendar events that were avoided
- `dateRange` - Start and end dates of schedule

**Chunk Ordering:**
- Chunks have `phase_order` (which phase) and `draft_order` (order within phase)
- SQL: `ORDER BY phase_order ASC NULLS LAST, draft_order ASC NULLS LAST`
- The scheduler MUST NOT overwrite `phase_order` or `draft_order` - these are set during proposal conversion

**Google Calendar Integration:**
- **Reference calendar** (read): Contains existing events ("rocks") to schedule around
- **Work calendar** (write): Where published chunks are added as events
- Environment variables: `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REFERENCE_CALENDAR_ID`

**Constants (server.js) - DO NOT CHANGE WITHOUT PERMISSION:**
```javascript
WORK_START_HOUR = 12  // 12:00 PM - Adrial starts work at noon
WORK_END_HOUR = 20    // 8:00 PM (slot math, actual end ~7:30)
MAX_HOURS_PER_DAY = 7 // ~7 schedulable hours per day
```

**Schedule Page UI Features:**
- **Week View:** Calendar grid showing Mon-Fri, 12 PM - 7 PM
  - Navigate between weeks with arrow buttons
  - Shows rocks (calendar events) in gray
  - Shows scheduled chunks in red (brand color)
  - Click a chunk to navigate to project
- **List View:** Day-by-day list of scheduled chunks
  - Toggle between Week/List views with button group
- **Draft Summary:** Shows stats (chunks, hours, weeks, projects)
- **Revenue Forecast:** Projects billable revenue by week (shown below schedule)
- **Publish to Calendar:** Commits draft to Google Calendar

### Quick Project Creation (Skip Proposals)

For in-progress projects that don't need full proposals, use the lightweight input format:

**Markdown format:**
```markdown
# Project Name
Client: Client Name
Priority: high
Description: Brief description

## Phase 1 Name (10h)
## Phase 2 Name (8h)

## Phase 3 - With Tasks
- Task A (2h)
- Task B (3h)
```

**Priority values:** `high` (2), `priority` (1), `normal` (0), `low` (-1), `maybe` (-2)

**Run:** `npm run quick-project input/my-project.md`

### Workflow: From Proposal to Invoice

1. **Create Proposal** → Generate proposal JSON, push to Neon
2. **Convert to Project** → Create project record linked to proposal
3. **Break into Chunks** → Use `npm run chunker` or UI to create 1-3 hour work units
4. **Schedule Work** → Generate draft schedule, review in UI, publish to calendar
5. **Track Time** → Start/stop timer or log completed hours
6. **Generate Invoice** → Select unbilled time, create invoice
7. **Send & Track** → Mark invoice sent, track payment

**Alternative path (skip proposal):**
1. **Create Quick Project** → `npm run quick-project input/file.md`
2. Continue from step 4 above

### Legacy Data Import

The system imported 499 historical projects from Airtable. Status mapping:

| Airtable | OS Status | Priority |
|----------|-----------|----------|
| DONE | done | 0 |
| INVOICE | invoiced | 0 |
| WAITING ON | waiting_on | 0 |
| ACTIVE | active | 0 |
| PRIORITY | active | 1 |
| PAUSED/FUTURE | paused | 0 |
| LATER? | paused | -1 |
| MAYBE | paused | -2 |

### Known Bug Fixes (DO NOT REINTRODUCE)

This section documents bugs that were fixed. When modifying related code, ensure these bugs don't return.

**Bug 1: Proposal Status Leak**
- **Symptom:** Proposals on live site showed "accepted" status
- **Cause:** `server.js` convert-to-project code updated proposal.status
- **Fix:** Removed status update code - projects are created independently
- **Location:** `server.js` line ~785

**Bug 2: Scheduler Infinite Loop**
- **Symptom:** Server hung at 100% CPU during schedule generation
- **Cause:** When no slots available for a chunk, `slotIndex` didn't advance
- **Fix:** Always advance `slotIndex` even when `scheduledSlots.length === 0`
- **Location:** `server.js` schedule/generate endpoint

**Bug 3: Chunk Order Corruption**
- **Symptom:** Chunks displayed out of sequence after scheduling
- **Cause:** Scheduler was setting `draft_order = ${i}` during scheduling
- **Fix:** Removed draft_order modification - only set `draft_scheduled_start/end`
- **Location:** `server.js` schedule/generate endpoint

**Bug 4: Timeline Phases Stacking**
- **Symptom:** All phases rendered at same vertical position on Gantt view
- **Cause:** All phases had `top: '8px'` instead of calculated row positions
- **Fix:** Calculate `rowTop = idx * 48 + 8` for each phase
- **Location:** `ProjectDetailsPage.jsx` timeline rendering

**Bug 5: Features Dropped During Refactoring**
- **Symptom:** Scheduler missing lunch break, rocks, start date config
- **Cause:** Code refactoring removed features without documentation
- **Fix:** Document ALL scheduler features in CLAUDE.md
- **Prevention:** Always check CLAUDE.md before modifying scheduler

### Files Reference

| File | Purpose |
|------|---------|
| `scripts/schema_extension.sql` | Database schema for OS tables |
| `scripts/lib/db.js` | Shared database utilities (CRUD, search, stats) |
| `scripts/import-legacy.js` | Airtable CSV importer |
| `scripts/time-log.js` | Time tracking CLI |
| `scripts/generate-invoice.js` | Invoice generation CLI |
| `scripts/chunker.js` | Project scope breakdown |
| `scripts/scheduler.js` | Calendar scheduling with Google Calendar |
| `scripts/convert-proposals.js` | Convert proposals to projects |
| `app/api/os-beta/*` | Serverless API endpoints (Vercel) |
| `server.js` | Local Express API server (port 3002) |

**UI Components (`app/src/os-beta/`):**

| File | Purpose |
|------|---------|
| `OsApp.jsx` | Main shell with sidebar, header, search |
| `components/ConfirmModal.jsx` | Reusable confirmation dialog |
| `pages/ProjectsPage.jsx` | Projects grid with status filters |
| `pages/ProjectDetailsPage.jsx` | Project metadata, phases, Gantt timeline |
| `pages/ProposalsPage.jsx` | OS Beta proposals list with project links |
| `pages/ProposalEditPage.jsx` | Proposal editor with delete |
| `pages/HostingPage.jsx` | Hosting clients with MRR |
| `pages/TimePage.jsx` | Timer with editable display (no spinners) |
| `pages/InvoicesPage.jsx` | Invoice list, create modal, line item editing |
| `pages/SchedulePage.jsx` | Week view calendar + list view + revenue forecast |
| `pages/MasterTimelinePage.jsx` | Gantt view of ALL projects interleaved |

### Conversion From Proposal to Project

When converting a proposal to a project:

1. **Create project record** in `projects` table with `proposal_id` link
2. **Create chunks** from proposal phases (1-3 hour chunks based on phase hours)
3. **Set phase_order and draft_order** to preserve sequence
4. **DO NOT modify the proposal** - leave its status as "draft"

The `proposal_id` field links back to the source proposal for reference.

### Time Tracking Features

**Timer UI:**
- Large HH:MM:SS display (clickable to edit)
- Number inputs have NO spinner buttons (just type)
- Pause/Resume functionality with accumulated time
- Finalize rounds UP to nearest 15 minutes

**Time Log States:**
- `active` - Timer currently running
- `paused` - Timer paused, accumulating time saved
- `stopped` - Timer stopped but not finalized
- `finalized` - Ready for invoicing (15-min rounded)

### Master Timeline (Gantt View)

Shows ALL active projects on a single horizontal timeline:
- Each project is a colored bar spanning its scheduled date range
- Colors cycle through 10 distinct options
- Click a project bar to navigate to project details
- Shows progress (done hours / total hours)
- Draft schedules shown with dashed border

---

## Development Tips

### Starting Development
```bash
npm start  # Starts both API (3002) and Vite (5173)
```

### Testing Changes
1. Make code changes
2. Vite hot-reloads automatically
3. For API changes, restart with `npm run api`

### Database Changes
- Schema is in Neon PostgreSQL
- Use `scripts/schema_extension.sql` for reference
- Test locally before deploying

### Deploying to Production
1. Push to main branch
2. Vercel auto-deploys
3. API routes in `app/api/` are serverless functions

---

## Part 3: Hosting & Billing (Bonsai → Stripe Migration)

### Current State (As of Jan 2026)

**Billing Platforms:**
- **Bonsai** - Current invoicing platform for all recurring hosting and one-time project work
- **Stripe** - Payment processor (receives payments from Bonsai)
- **OS Beta** - Future invoicing platform (not yet handling payments)

**Key Finding:** Bonsai stores customer card data, NOT Stripe. Your Stripe account has charges but no reusable Stripe Customer objects. To charge cards directly through Stripe (bypassing Bonsai), customers would need to re-enter their cards.

### Hosting Profitability

The Hosting page (`/dashboard/os-beta/hosting`) shows MRR with Webflow costs:

**Database Fields:**
- `rate` - What you charge the client (cents)
- `webflow_cost` - What Webflow charges you (cents)
- Profit = rate - webflow_cost

**Webflow Pricing Tiers:**
| Plan | Monthly Cost |
|------|--------------|
| CMS | $29/mo |
| Business | $49/mo |
| Basic | $18/mo |
| Annual CMS | $23/mo ($276/yr) |
| Legacy (30% off) | $20.30/mo |

**Script:** `scripts/add-webflow-costs.js` - Maps Webflow sites to hosting clients

**Hosting Page Filter:** Only shows clients with `webflow_cost > 0` (active). Clients with $0 Webflow cost are defunct and hidden.

### Hosting Client Database (Source of Truth)

The `hosting_billing` table in Neon is the authoritative source for all hosting client data.

**Table: `hosting_billing`**
| Column | Type | Description |
|--------|------|-------------|
| `id` | SERIAL | Primary key |
| `client_id` | TEXT | Unique client identifier (e.g., `burk-uzzle`) |
| `client_name` | TEXT | Display name |
| `contact_name` | TEXT | Primary contact |
| `email` | TEXT | Billing email |
| `stripe_customer_id` | TEXT | Stripe Customer ID (if migrated) |
| `stripe_status` | TEXT | `ready` or `needs_setup` |
| `project_id` | TEXT | Hosting project ID |
| `project_name` | TEXT | Project display name |
| `rate_cents` | INT | Monthly charge in cents |
| `webflow_cost_cents` | INT | Monthly Webflow cost in cents |
| `profit_cents` | INT | Monthly profit (rate - webflow_cost) |
| `last_invoice_date` | DATE | Last Bonsai invoice date |
| `next_billing_date` | DATE | Next billing date |
| `billing_platform` | TEXT | `bonsai_legacy` or `os` |
| `billing_frequency` | TEXT | `monthly` or `annual` |
| `historical_charges` | INT | Total hosting invoices (hosting-only, not project work) |
| `historical_total_usd` | DECIMAL | Total hosting revenue historically |
| `checkout_link` | TEXT | Stripe Checkout URL for card setup |
| `created_at` | TIMESTAMP | Record creation |
| `updated_at` | TIMESTAMP | Last update |

**Billing Frequency:**
The `billing_frequency` field indicates whether the client is billed monthly or annually.
- `monthly` - Charged every month (default)
- `annual` - Charged once per year

**Annual Clients (5 total):**
| Client | Annual Amount | Monthly Equivalent |
|--------|---------------|-------------------|
| Ainsworth & Associates | $372.60 | $31.05 |
| Self-Care Info | $372.60 | $31.05 |
| Silverstone Jewelers | $372.60 | $31.05 |
| Cliff Cottage Inn | $487.20 | $40.60 |
| Colorado State University | $487.20 | $40.60 |

The `rate_cents` field always stores the **monthly equivalent** for consistency in MRR calculations.

**Rate Accuracy:**
The `rate_cents` values come from **actual Stripe charges**, not Bonsai invoice amounts. Bonsai shows pre-fee amounts, but Stripe shows what customers actually pay (including ~5% transaction fee passed to client).

To verify rates against Stripe:
```bash
node scripts/check-stripe-rates.js
```

**Historical Charges (Hosting Only):**
The `historical_charges` and `historical_total_usd` fields ONLY count Bonsai invoices where the project name contains "hosting". This excludes one-time project work (logos, websites, etc.) that would inflate the numbers.

To recalculate hosting-only history:
```bash
node scripts/fix-hosting-history.js
```

**Current Totals (Jan 2026):**
- Monthly MRR: $1,250.95
- Monthly Profit: $385.35
- Historical hosting revenue: $47,482.80 across 1,049 invoices

**Known Issues:**
- **Resonant Body** has negative profit (-$1.91/mo) - charging $27.09 but Webflow costs $29.00

**Scripts:**
| Script | Purpose |
|--------|---------|
| `scripts/export-hosting-csv.js` | Export hosting_billing table to CSV |
| `scripts/check-stripe-rates.js` | Query Stripe API for actual charge amounts by payer |
| `scripts/fix-rates-from-stripe.js` | Update rates based on Stripe charge data |
| `scripts/fix-hosting-history.js` | Recalculate historical charges (hosting invoices only) |
| `scripts/fix-client-data.js` | Manual corrections to client data |
| `scripts/consolidate-hosting-clients.js` | Merge data from multiple sources |

**CSV Export:** `legacy_data/stripe_migration_status.csv` - Generated from hosting_billing table, includes billing_frequency column

### Stripe Customer Mapping (Completed)

**What was done:**
1. Fetched all 1,316 Stripe charges via API
2. Extracted Bonsai invoice numbers from charge descriptions
3. Matched to Bonsai invoice export to get exact client names
4. Created mapping of Stripe payers → Bonsai clients
5. Filtered to hosting-only invoices (project name contains "hosting")

**Important:** The `stripe_by_bonsai_client.csv` contains ALL charges (including project work). For hosting-only history, use `scripts/fix-hosting-history.js` which filters Bonsai invoices to those with "hosting" in the project name.

**Output Files:**
| File | Contents |
|------|----------|
| `legacy_data/stripe_by_bonsai_client.csv` | All 75 Bonsai clients with ALL Stripe charges (includes project work) |
| `legacy_data/stripe_migration_status.csv` | Active hosting clients with hosting-only history |
| `legacy_data/hosting_billing_dates.csv` | 32 active hosting clients with next billing dates |

**Key Stats:**
- 1,316 total Stripe charges (all types)
- 1,049 hosting-only invoices
- $47,482.80 total hosting revenue historically
- 33 active hosting projects (28 monthly, 5 annual)

### Bonsai Data Exports

Located in `legacy_data/bonsai/`:

| File | Contents |
|------|----------|
| `adrial_invoice_export_*.csv` | 1,517 invoices with amounts, dates, client names |
| `adrial_companiescontact_export_*.csv` | 70 clients with contact names and emails |
| `adrial_project_export_*.csv` | Project names and details |
| `adrial_timeentry_export_*.csv` | Time entries |

**CSV Columns (Invoice Export):**
- 0: status, 1: total_amount, 11: issued_date, 13: paid_date
- 14: invoice_number, 15: project_name, 16: client_name, 17: client_email

### Migration Strategy (Future)

**Recommended Approach: Gradual Migration**

1. **Keep Bonsai for existing recurring clients** - Cards are stored there
2. **When a card fails/expires** - Send Stripe Checkout link instead of Bonsai update
3. **New clients** - Go directly through Stripe from day one
4. **Result** - Natural migration over 1-2 years as cards expire

**Email Migration Flow (When Ready):**
```
1. OS generates personalized email per client:
   - Stripe Checkout link to save new card
   - Their next billing date and amount

2. Resend sends the email

3. Client enters card on Stripe's hosted page

4. Webhook creates Stripe Customer with saved PaymentMethod

5. On billing date, OS charges via Stripe
```

**Timing Recommendation:**
- Send migration emails 10-14 days before billing date
- Gives time to act without forgetting
- Allows follow-up if needed

### Environment Variables (Stripe)

```
STRIPE_SECRET_KEY=sk_live_xxx  # Added to .env
```

**Future (when ready for full migration):**
```
RESEND_API_KEY=re_xxx          # For sending migration emails
STRIPE_WEBHOOK_SECRET=whsec_xxx # For payment confirmations
```

### Scripts Reference

| Script | Purpose |
|--------|---------|
| `scripts/add-webflow-costs.js` | Add Webflow costs to hosting projects |
| `scripts/match_stripe_v4.js` | Match Stripe charges to Bonsai clients |
| `scripts/quick-project.js` | Create projects without proposals |
| `scripts/export-hosting-csv.js` | Export hosting_billing table to CSV |
| `scripts/check-stripe-rates.js` | Query Stripe API for actual recurring charge amounts |
| `scripts/fix-rates-from-stripe.js` | Update DB rates based on Stripe charge data |
| `scripts/fix-hosting-history.js` | Recalculate historical charges (hosting-only) |
| `scripts/fix-client-data.js` | Manual corrections to historical data |
| `scripts/consolidate-hosting-clients.js` | Merge data from Bonsai, Stripe, billing CSVs |

### Stripe Billing API (Implemented)

These endpoints are in `server.js` for the migration workflow:

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/os-beta/stripe/checkout-session` | POST | Create Stripe Checkout link for card setup |
| `/api/os-beta/stripe/customer/:clientId` | GET | Get Stripe customer and payment methods |
| `/api/os-beta/stripe/charge` | POST | Charge a client's saved card |
| `/api/os-beta/webhooks/stripe` | POST | Handle Stripe webhook events |
| `/api/os-beta/email/billing-setup` | POST | Send billing setup email via Resend |

**Checkout Session Request:**
```javascript
POST /api/os-beta/stripe/checkout-session
{
  "clientId": "burk-uzzle",
  "successUrl": "https://...",  // optional
  "cancelUrl": "https://..."    // optional, defaults to adrialdesigns.com
}
```

**Response includes:** `checkoutUrl`, `customerId`, `sessionId`

### API Integration (Future)

**Stripe Invoice Flow (not yet implemented):**
```javascript
// 1. Create Stripe Customer (if new)
const customer = await stripe.customers.create({
  email: client.email,
  name: client.name
})

// 2. Create Invoice with line items
const invoice = await stripe.invoices.create({
  customer: customer.id,
  collection_method: 'send_invoice',
  days_until_due: 30
})

// 3. Add line items
await stripe.invoiceItems.create({
  customer: customer.id,
  invoice: invoice.id,
  description: 'Website hosting - February 2026',
  amount: 3900, // $39.00 in cents
  currency: 'usd'
})

// 4. Finalize and send
await stripe.invoices.finalizeInvoice(invoice.id)
await stripe.invoices.sendInvoice(invoice.id)
// Stripe handles all customer emails automatically
```

**Webhook Handler (future endpoint):**
```
POST /api/os-beta/webhooks/stripe
- invoice.paid → Update OS invoice status to 'paid'
- invoice.payment_failed → Alert for follow-up
- customer.subscription.updated → Sync changes
```

### Data Relationships

```
Bonsai Invoice #2595
    ↓ (description contains invoice #)
Stripe Charge ch_xxx
    ↓ (matched via script)
OS Invoice record
    ↓ (client_id link)
OS Client / Hosting Project
```

**Future (post-migration):**
```
OS Invoice
    → Stripe Invoice (stripe_invoice_id)
    → Stripe Customer (stripe_customer_id on client)
    → PaymentMethod (saved card)
```

---

Whenever we start a new round of work together, say "Ahoy matey, I have read the CLAUDE.md file and am all caught up!"