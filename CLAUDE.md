# Adrial Designs OS - Claude Workflow

## Team Roles

- **Project Manager:** Gemini (Antigravity) - Strategy, coordination, requirements
- **Senior Developer:** Claude Code - Implementation, architecture, coding

---

## Reference Documentation

Detailed documentation is split into separate files to keep this file lean:

| File | Contents |
|------|----------|
| `docs/PROPOSALS.md` | Proposal JSON schema, templates, estimation, versioning, PDF export |
| `docs/OS-BETA.md` | API endpoints, UI pages, scheduling, time tracking, CLI scripts |
| `docs/HOSTING.md` | hosting_billing schema, Stripe integration, migration strategy |
| `docs/SECURITY.md` | Authentication, rate limiting, CORS, input validation |

**Read these files when working on specific features.**

---

## CRITICAL ARCHITECTURE RULES

These rules exist because bugs occurred when they were violated. **DO NOT modify code in ways that break these rules.**

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

### 5. All API Calls Must Use authFetch

**Never use raw `fetch()` for API calls in page components.**

```javascript
// WRONG - will fail with 401 Unauthorized
const res = await fetch(`${API_BASE}/projects`)

// CORRECT - includes auth token automatically
import { authFetch } from '../lib/auth'
const res = await authFetch(`${API_BASE}/projects`)
```

**Why:** All API endpoints require authentication. Using raw `fetch()` causes blank pages because the API returns 401.

---

## Overview

This is the **Agency Operating System** for Adrial Designs, combining:
1. **Proposal Generator** - Create client proposals from input documents
2. **Project Management** - Track all projects with status, priority, and billing
3. **Time Tracking** - Start/stop timers, log billable hours
4. **Invoicing** - Generate invoices from tracked time and chunks

**Architecture:** "Local-First, AI-Worker"
- **App** = React UI for viewing/managing data (Vite + Neon)
- **Worker** = Claude Code via CLI for intelligent tasks

**URLs:**
- **Local:** `http://localhost:5173` (proposals) / `http://localhost:5173/dashboard/os-beta` (OS)
- **Production:** `https://adesigns-estimate.vercel.app`

---

## Folder Structure

```
estimate-generator/
├── input/               # Drop client documents here
├── archive/             # Archived inputs by client-project
├── data/
│   ├── templates/       # Project templates (web, logo, print, app)
│   ├── clients.json     # Client database
│   └── proposals/       # Generated proposal JSON files
├── docs/                # Reference documentation
├── app/                 # React frontend + Vercel API routes
├── scripts/             # CLI tools and utilities
└── server.js            # Local Express API (port 3002)
```

---

## Part 1: Proposal Generator

### Workflow Summary

1. **User drops documents** into `/input/`
2. **Claude reads and analyzes** - identifies project type, extracts scope
3. **Claude asks for missing info** - client name, company (DO NOT guess)
4. **Claude creates proposal** - JSON in `/data/proposals/YYYY-MM-DD-slug.json`
5. **Claude archives inputs** - moves to `/archive/{client}-{project}/input/`
6. **Claude writes research notes** - creates `RESEARCH.md` in archive input folder (see below)
7. **Claude opens browser** - `npm start` then `open "http://localhost:{port}/{id}"`
8. **User reviews and edits** - make any adjustments in the UI
9. **Export PDF to archive** - save PDF to `/archive/{client}-{project}/` folder for future reference
10. **Push to production** - `npm run push-proposal {id}`

### Research Notes (RESEARCH.md)

**After creating a proposal, always create `/archive/{client}-{project}/input/RESEARCH.md`**

This file preserves context for future reference and revisions. Include:

```markdown
# {Project Name} - Research Notes

## Project Overview
- Client, company, contact info
- Project type and high-level summary
- Key deadlines or constraints

## Source Documents Analyzed
- List each input file and what it contained
- Note any documents that were particularly informative

## Scope Decisions
- What's included and why
- What's excluded and why
- Any assumptions made

## Estimation Rationale
- How hours were calculated for each phase
- Comparable past projects referenced
- Risk factors that influenced estimates

## Technical Considerations
- Platform/technology choices
- Integration requirements
- Known constraints or dependencies

## Open Questions / Future Considerations
- Items that may come up later
- Potential scope creep areas
- Things to clarify if proposal is accepted
```

**Why:** Enables quick context restoration when revisiting proposals for revisions, follow-up projects, or reference.

### PDF Handling - CRITICAL

Before reading ANY PDF:
1. **DO NOT read directly** - causes API errors for large docs
2. **Run:** `python split_pdf.py` - chunks to `working/`
3. **Read chunks sequentially** - `working/chunk_01.pdf`, etc.

### Key Commands

```bash
npm start                           # Start both servers
npm run push-proposal {id}          # Push to production
node scripts/backup-proposal.js {id} [name]  # Save version
```

**Client view link:** `https://adesigns-estimate.vercel.app/{id}?view=1`

### Client Notes

Add a `clientNote` field to proposal JSON to display a highlighted message at the top of the proposal:

```json
{
  "clientNote": "Note: This proposal was previously part of a larger project..."
}
```

This displays in an amber-highlighted box above the Overview section.

### PDF Export

- Use the "Save as PDF" button in the proposal view (or browser print)
- Header and sidebar are automatically hidden in print mode
- The document title is set to `{ProjectName}-{ClientName}` for the suggested filename

### Brand Assets

- **Logo:** `app/public/logo-adesigns.jpg` - used in proposals and invoices
- **Fonts:** Gilmer (Regular & Bold) in `app/public/fonts/`
- **Colors:** Defined in `app/src/index.css` under `@theme`

**See `docs/PROPOSALS.md` for JSON schema, templates, and estimation guidelines.**

---

## Part 2: OS Beta

### Key Concepts

- **Money in cents:** `rate = 12000` means $120.00
- **Status values:** `active`, `waiting_on`, `paused`, `done`, `invoiced`
- **Priority:** `1` = priority, `0` = normal, `-1` = later, `-2` = maybe

### Workflow: Proposal to Invoice

1. **Create Proposal** → JSON, push to Neon
2. **Convert to Project** → Creates record with `proposal_id` link
3. **Break into Chunks** → 1-3 hour work units
4. **Schedule Work** → Draft schedule, review, publish to calendar
5. **Track Time** → Start/stop timer or log hours
6. **Generate Invoice** → Select unbilled time, create invoice
7. **Send & Track** → Mark sent, track payment

### Scheduler Constants (DO NOT CHANGE)

```javascript
WORK_START_HOUR = 12  // Noon
WORK_END_HOUR = 20    // 8 PM (actual ~7:30)
MAX_HOURS_PER_DAY = 7
// Weekends: Off
```

### Time Tracking

- Timer rounds UP to nearest 15 minutes on finalize
- States: `active`, `paused`, `stopped`, `finalized`

**See `docs/OS-BETA.md` for API endpoints, UI pages, and CLI scripts.**

---

## Part 3: Hosting & Billing

### Current State

- **Bonsai** = current invoicing (stores card data)
- **Stripe** = payment processor
- **OS Beta** = future invoicing

### Key Stats (Jan 2026)

- Monthly MRR: $1,250.95
- Monthly Profit: $385.35
- 33 active hosting projects

**See `docs/HOSTING.md` for schema, Stripe integration, and migration strategy.**

---

## Known Bug Fixes (DO NOT REINTRODUCE)

### Bug 1: Proposal Status Leak
- **Symptom:** Live proposals showed "accepted"
- **Cause:** Convert-to-project updated proposal.status
- **Fix:** Projects created independently, proposals unchanged
- **Location:** `server.js` ~line 785

### Bug 2: Scheduler Infinite Loop
- **Symptom:** Server hung at 100% CPU
- **Cause:** `slotIndex` didn't advance when no slots available
- **Fix:** Always advance `slotIndex`
- **Location:** `server.js` schedule/generate endpoint

### Bug 3: Chunk Order Corruption
- **Symptom:** Chunks out of sequence after scheduling
- **Cause:** Scheduler set `draft_order = ${i}`
- **Fix:** Only set `draft_scheduled_start/end`
- **Location:** `server.js` schedule/generate endpoint

### Bug 4: Timeline Phases Stacking
- **Symptom:** All phases at same Y position
- **Cause:** All had `top: '8px'`
- **Fix:** Calculate `rowTop = idx * 48 + 8`
- **Location:** `ProjectDetailsPage.jsx`

### Bug 5: Features Dropped in Refactoring
- **Symptom:** Scheduler missing rocks, start date config
- **Prevention:** Always check CLAUDE.md before modifying scheduler

---

## Development

```bash
npm start              # API (3002) + Vite (5173)
npm run api            # API only
npm run dev            # Vite only
```

### Deploying

**Only push when user confirms changes are working locally.**

1. Test changes thoroughly at `http://localhost:5173`
2. User confirms ready to deploy
3. Push to main branch → Vercel auto-deploys
4. API routes in `app/api/` are serverless

### Database

- **Neon PostgreSQL** is source of truth for all data
- Schema in `scripts/schema_extension.sql`
- `DATABASE_URL` in `.env`

**IMPORTANT: Local JSON files are NOT the database.**
- Proposals in `data/proposals/*.json` are local working files
- To make proposals visible in the app, you MUST push them to Neon: `npm run push-proposal {id}`
- The app (both local and production) reads from Neon, not from local JSON files
- Version history files in `archive/*/versions/` are stored locally and in git, not in Neon

### Deployment Workflow

**Work locally first, push when ready:**
1. Make changes and test locally at `http://localhost:5173`
2. Only push to git/Vercel when changes are verified working
3. Don't auto-push after every change - wait for user confirmation

---

## Authentication & Security

### Environment Variables (Required)

| Variable | Purpose |
|----------|---------|
| `LOGIN_PW` | Human-friendly PIN for login (any length) |
| `AUTH_SECRET` | High-entropy secret for token signing (32+ chars) |

Generate `AUTH_SECRET` with:
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

**IMPORTANT:** The server will refuse to start if `AUTH_SECRET` is not set or is less than 32 characters.

### Token Authentication

- **Token format:** HMAC-signed stateless tokens (`{expiresAt}.{signature}`)
- **Session duration:** 24 hours
- **Storage:** Token stored in `localStorage` as `authToken`
- **Signing:** Uses `AUTH_SECRET` (NOT the login PIN)

### Making Authenticated API Calls

**All page components MUST use `authFetch` instead of `fetch`:**

```javascript
import { authFetch } from '../lib/auth'

// In your component:
const res = await authFetch(`${API_BASE}/projects`)
```

The `authFetch` helper automatically:
- Adds `Authorization: Bearer <token>` header
- Sets `Content-Type: application/json`

**Location:** `app/src/lib/auth.js`

### Rate Limiting

- **Auth endpoints:** 5 requests per 15 minutes (brute force protection)
- **Verify endpoint:** 5 requests per 15 minutes (prevents token guessing)
- **API endpoints:** 100 requests per minute

### CORS Allowed Origins

```javascript
const allowedOrigins = [
  'http://localhost:5173',
  'http://localhost:3002',
  'https://adesigns-estimate.vercel.app',
  'https://adrialdesigns.com'
]
```

### Public Routes (No Auth Required)

Public routes use dedicated endpoints - there is NO query param bypass:

- `/api/public/proposals/:id` - Read-only proposal data for client view
- `/{proposal-id}?view=1` - Client proposal view (uses public API)

### OAuth Security

- Google OAuth uses CSRF state tokens (generated per request, 10-minute TTL)
- State is validated on callback to prevent CSRF attacks

---

## Quick Reference

| Task | Command/Location |
|------|------------------|
| Start dev servers | `npm start` |
| Push proposal | `npm run push-proposal {id}` |
| Start timer | `npm run time-log start {project-id} "desc"` |
| Stop timer | `npm run time-log stop` |
| Create invoice | `npm run invoice --project {id}` |
| Schedule week | `npm run schedule --week` |
| Quick project | `npm run quick-project input/file.md` |

---

Whenever we start a new round of work together, say "Ahoy matey, I have read the CLAUDE.md file and am all caught up!"
