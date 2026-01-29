# OS Beta Reference

## Database Schema

| Table | Purpose |
|-------|---------|
| `projects` | All work items with status, priority, billing info |
| `chunks` | 1-3 hour work units for scheduling |
| `time_logs` | Tracked time entries (billable/non-billable) |
| `invoices` | Draft, sent, and paid invoices |
| `oauth_tokens` | Google Calendar tokens |

**Key Fields:**
- **Money in cents:** `rate = 12000` means $120.00
- **Status values:** `active`, `waiting_on`, `paused`, `done`, `invoiced`
- **Priority:** `1` = priority, `0` = normal, `-1` = later, `-2` = maybe
- **Billing platforms:** `os` (new) vs `bonsai_legacy` (hosting)

**Status Colors:**
- `active` - Green (#22c55e)
- `waiting_on` - Yellow (#eab308)
- `paused` - Gray (#6b7280)
- `done` - Blue (#3b82f6)
- `invoiced` - Purple (#8b5cf6)

---

## API Endpoints

All endpoints under `/api/os-beta/`:

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
| `/proposals` | GET, POST | OS Beta proposals |
| `/proposals/{id}` | GET, PUT, DELETE | Single proposal operations |
| `/stats` | GET | CFO metrics (unbilled, unpaid, revenue) |
| `/search?q=term` | GET | Global search |
| `/stripe/checkout-session` | POST | Stripe Checkout link |
| `/stripe/customer/{clientId}` | GET | Stripe customer info |
| `/stripe/charge` | POST | Charge saved card |

**Time Log Actions (PUT /time-logs/{id}):**
- `action: 'pause'` - Pause timer, accumulate seconds
- `action: 'resume'` - Resume paused timer
- `action: 'stop'` - Stop without finalizing
- `action: 'finalize'` - Round to 15 min, mark ready for invoice
- `action: 'set_time'` - Manually set accumulated_seconds

**Invoice Creation (POST /invoices):**
- Include `time_log_ids` array to mark logs as invoiced
- Include `line_items` array with description, quantity, rate, amount

---

## UI Pages

| Route | Page | Purpose |
|-------|------|---------|
| `/dashboard/os-beta` | Dashboard | Overview, stats, recent projects |
| `/dashboard/os-beta/proposals` | Proposals | OS Beta proposals list |
| `/dashboard/os-beta/proposals/{id}/edit` | Proposal Edit | Edit with delete option |
| `/dashboard/os-beta/projects` | Projects | Active projects grid |
| `/dashboard/os-beta/projects/{id}` | Project Details | Metadata, phases, Gantt |
| `/dashboard/os-beta/hosting` | Hosting | Bonsai clients, MRR display |
| `/dashboard/os-beta/time` | Time Tracking | Mobile-first timer |
| `/dashboard/os-beta/invoices` | Invoices | List, create, edit |
| `/dashboard/os-beta/schedule` | Schedule | Weekly schedule, draft generation |
| `/dashboard/os-beta/timeline` | Master Timeline | Gantt of ALL projects |

---

## Scheduling System

**Work Hours (Adrial's schedule):**
- **Start:** 12:00 PM
- **End:** 7:30 PM (~7 schedulable hours)
- **Weekends:** Off

**Features:**
1. **Configurable start date** - POST body accepts `startDate`
2. **Calendar rocks** - Reads Google Calendar to avoid existing events
3. **Interleaved scheduling** - Round-robin through ALL active projects
4. **Phase ordering** - Respects `phase_order` and `draft_order`
5. **Draft vs Published** - Generate as draft, publish to commit
6. **Multi-week support** - Schedules all chunks across needed weeks

**API:**
```bash
# Generate schedule starting today
curl -X POST http://localhost:3002/api/os-beta/schedule/generate

# Generate from specific date
curl -X POST http://localhost:3002/api/os-beta/schedule/generate \
  -H "Content-Type: application/json" \
  -d '{"startDate": "2026-01-26"}'
```

**Response:** `scheduled`, `projects`, `rocksAvoided`, `dateRange`

**Chunk Ordering:**
- SQL: `ORDER BY phase_order ASC NULLS LAST, draft_order ASC NULLS LAST`
- Scheduler MUST NOT overwrite `phase_order` or `draft_order`

**Constants (DO NOT CHANGE):**
```javascript
WORK_START_HOUR = 12
WORK_END_HOUR = 20
MAX_HOURS_PER_DAY = 7
```

---

## CLI Scripts

| Command | Purpose |
|---------|---------|
| `npm run import-legacy` | Import Airtable CSV (use `--dry-run` first) |
| `npm run time-log start {project-id} "desc"` | Start timer |
| `npm run time-log stop` | Stop active timer |
| `npm run time-log log {project-id} "desc" --duration 2h` | Log completed time |
| `npm run time-log status` | Check active timer |
| `npm run time-log list {project-id}` | List recent logs |
| `npm run invoice --client {id}` | Invoice for client |
| `npm run invoice --project {id}` | Invoice for project |
| `npm run chunker {project-id}` | Break into chunks |
| `npm run schedule --week` | Schedule coming week |
| `npm run quick-project input/file.md` | Create from markdown |

---

## Quick Project Creation

For in-progress projects without full proposals:

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

---

## Time Tracking

**Timer UI:**
- Large HH:MM:SS display (clickable to edit)
- No spinner buttons (just type)
- Pause/Resume with accumulated time
- Finalize rounds UP to nearest 15 minutes

**Time Log States:**
- `active` - Running
- `paused` - Paused, time saved
- `stopped` - Stopped, not finalized
- `finalized` - Ready for invoicing

---

## Conversion: Proposal to Project

1. Create project record with `proposal_id` link
2. Create chunks from phases (1-3 hour chunks)
3. Set `phase_order` and `draft_order` to preserve sequence
4. **DO NOT modify the proposal** - leave status as "draft"

---

## Files Reference

| File | Purpose |
|------|---------|
| `scripts/schema_extension.sql` | Database schema |
| `scripts/lib/db.js` | Database utilities |
| `scripts/import-legacy.js` | Airtable importer |
| `scripts/time-log.js` | Time tracking CLI |
| `scripts/generate-invoice.js` | Invoice CLI |
| `scripts/chunker.js` | Scope breakdown |
| `scripts/scheduler.js` | Calendar scheduling |
| `scripts/convert-proposals.js` | Proposal conversion |
| `app/api/os-beta/*` | Vercel API endpoints |
| `server.js` | Local Express server |

**UI Components (`app/src/os-beta/`):**
| File | Purpose |
|------|---------|
| `OsApp.jsx` | Main shell |
| `components/ConfirmModal.jsx` | Confirmation dialog |
| `pages/ProjectsPage.jsx` | Projects grid |
| `pages/ProjectDetailsPage.jsx` | Project details, Gantt |
| `pages/HostingPage.jsx` | Hosting clients |
| `pages/TimePage.jsx` | Timer |
| `pages/InvoicesPage.jsx` | Invoices |
| `pages/SchedulePage.jsx` | Week calendar |
| `pages/MasterTimelinePage.jsx` | All projects Gantt |

---

## Legacy Data Import

Status mapping from Airtable:

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
