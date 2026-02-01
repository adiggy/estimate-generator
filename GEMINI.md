# GEMINI.md - Project Manager Context

**Strictly for Gemini (Project Manager) eyes only.**

## Roles
- **Project Manager:** Gemini (Antigravity)
- **Senior Developer:** Claude Code (CLI)

## Purpose
This file serves as the private project management log and context store for Gemini.

## 🔴 CRITICAL RULE: NO FILE CREATION
- **Gemini (You) must NOT create files in this repository.**
- **Exceptions:** You may ONLY create/edit `GEMINI.md` (this file) and `MASTER_PROMPT.md` (if needed for context).
- **Workflow:** You analyze the project, plan the architecture, and generate **PROMPTS** for the User to feed into Claude Code. Claude Code is the *only* agent authorized to write code (TS, SQL, CSS, etc.).

## Project Definition: Adrial Designs OS (Agency OS)
We are extending the existing "Proposal Generator" into a full "Agency Operating System".

### Architecture
- **"Local-First, AI-Worker" Mode**
- **App:** React/Vite (UI) + Neon (DB).
- **Worker:** Claude Code CLI (for complex logic).
- **Sandboxing:** New features in `/dashboard/os-beta/`.

### Core User "Need-to-Haves"
1.  **NO External AI SDKs:** The scripts (`scheduler.ts`, etc.) must be "dumb" tools run by Claude Code (the intelligence).
2.  **Bonsai Replacement:** 
    - Invoicing (Hourly capped).
    - Search (GIN Index on line items).
    - Hosting (Legacy billing separation).

## Current Status
- **Phase 0 (Foundation):** Schema extension and migration. 
- **Action:** User is ready to run the schema extension via Claude Code.

## Decision Log
- **2026-01-25: Bonsai Historical Invoices:** User will keep Bonsai as the archive for historical invoice search. The new OS will handle all *new* invoices going forward with full line-item search via GIN index. No Bonsai invoice import script is needed.

---

# 🔍 COMPREHENSIVE FUNCTIONALITY AUDIT REPORT
**Date:** 2026-01-25  
**Auditor:** Gemini (Antigravity)

## Executive Summary

I have thoroughly reviewed the entire Adrial Designs OS codebase, examining the React frontend, Express API server, Vercel serverless functions, database layer, and CLI scripts. The application is well-structured overall, but I've identified several bugs, UX issues, and areas for improvement that should be addressed.

---

## 🐛 BUGS & CRITICAL ISSUES

### 1. Server OAuth Callback Hardcoded URL (HIGH)
**File:** `server.js` (line 851)  
**Issue:** The Google OAuth callback success page has a hardcoded `http://localhost:5173` URL, which will break in production.
```html
<a href="http://localhost:5173/dashboard/os-beta" ...>
```
**Fix:** Use a relative URL or environment variable for the redirect.

### 2. Vercel API MRR Calculation Inconsistency (MEDIUM)
**Files:** `server.js` vs `app/api/os-beta/[...path].js`  
**Issue:** The MRR calculation logic differs significantly between local dev and production:
- **server.js** (lines 674-696): Complex SQL with CTEs to find recurring invoice amounts
- **Vercel API** (lines 784-788): Simple count of `bonsai_legacy` projects × $39
```javascript
// Vercel (simplified)
SELECT COUNT(*) * 3900 as total FROM projects WHERE billing_platform = 'bonsai_legacy' AND status = 'active'
```
The Vercel version will give inaccurate MRR if hosting rates vary.

### 3. Missing `set_time` Action in Vercel API (MEDIUM)
**File:** `app/api/os-beta/[...path].js`  
**Issue:** The `handleTimeLogById` function in Vercel doesn't implement the `set_time` action that exists in `server.js` (lines 432-444). Users editing timer time in production won't work.

### 4. Proposals Convert Endpoint Bug (MEDIUM)
**File:** `server.js` (lines 746-751)  
**Issue:** When converting a proposal, the status update targets the `proposals` table, but OS Beta proposals are in `os_beta_proposals`:
```javascript
await db.sql`UPDATE proposals SET data = ... WHERE id = ${req.params.id}` // Wrong table!
```
Should be `os_beta_proposals`.

### 5. Unused Import in ProjectsPage (LOW)
**File:** `app/src/os-beta/pages/ProjectsPage.jsx` (line 3)  
**Issue:** `Circle` icon is imported but never used.

---

## 🎨 USER EXPERIENCE ISSUES

### 1. TimePage Shows Only Active Projects (IMPROVEMENT NEEDED)
**File:** `app/src/os-beta/pages/TimePage.jsx` (line 339)  
**Issue:** The new timer project selector only fetches `status=active` projects. Users may need to log time against `waiting_on` or `paused` projects.
**Recommendation:** Show all non-completed projects or add a filter.

### 2. No Create Project Button (MISSING FEATURE)
**File:** `app/src/os-beta/pages/ProjectsPage.jsx`  
**Issue:** There's no way to create a new project from the Projects page UI. Users must convert proposals or use CLI.
**Recommendation:** Add a "New Project" button with a modal form.

### 3. InvoicesPage Missing Rate Customization (UX GAP)
**File:** `app/src/os-beta/pages/InvoicesPage.jsx` (line 272-273)  
**Issue:** The rate is hardcoded as `12000` ($120/hr) when displaying/editing line items. This doesn't respect project-specific rates.
**Recommendation:** Pass the project rate or allow rate editing per line item.

### 4. SchedulePage Work Hours Default to Afternoon (UNEXPECTED)
**File:** `app/src/os-beta/pages/SchedulePage.jsx` (lines 57-58, 214)  
**Issue:** Work hours are set to 12 PM - 7 PM (`hours = Array.from({ length: 8 }, (_, i) => i + 12)`). This seems unusual for a typical workday.
**Recommendation:** Consider 9 AM - 5 PM as default, or make configurable.

### 5. Dashboard useEffect Missing Dependency (REACT WARNING)
**File:** `app/src/os-beta/OsApp.jsx` (lines 101-112)  
**Issue:** The StatsWidget's useEffect doesn't have a dependency array entry for API_BASE (though it's constant).
**Note:** This is minor but could trigger ESLint warnings.

### 6. Proposal Edit Link Goes to Wrong Project (POTENTIAL BUG)
**File:** `app/src/os-beta/pages/ProposalsPage.jsx` (lines 74-77)  
**Issue:** The "Visit Project" link uses `proposal.id` as the project ID:
```jsx
to={`/dashboard/os-beta/projects/${proposal.id}`}
```
But project IDs are actually in format `{client_id}-{project-slug}-{timestamp}`, not the proposal ID. This will 404 unless the IDs happen to match.

---

## 🏗️ ARCHITECTURE & CODE QUALITY

### 1. Duplicated API Logic (TECH DEBT)
**Issue:** The same API logic is implemented in three places:
1. `server.js` - Local Express server
2. `app/api/os-beta/[...path].js` - Vercel serverless
3. `scripts/lib/db.js` - CLI utilities

**Risk:** Changes need to be made in multiple places, leading to drift (as seen with MRR calculation).
**Recommendation:** Consider extracting shared logic into a common module.

### 2. No Input Validation on Frontend (SECURITY)
**Files:** Various pages  
**Issue:** Most form inputs don't have proper validation before sending to API. While the backend has some checks, frontend validation would improve UX.

### 3. Missing Error Boundaries (STABILITY)
**Issue:** No React error boundaries exist. A JS error in one component will crash the entire app.
**Recommendation:** Add error boundaries around major sections.

### 4. Confirm Modal Missing in Several Places (CONSISTENCY)
**File:** `app/src/os-beta/components/ConfirmModal.jsx` exists  
**Issue:** Only TimePage uses the ConfirmModal. Other destructive actions (delete invoice, clear schedule, delete project) use `window.confirm()`.
**Recommendation:** Use ConfirmModal consistently across the app.

---

## 📋 MISSING FEATURES / INCOMPLETE IMPLEMENTATIONS

### 1. Clients Page Not Implemented
**Observation:** The sidebar includes clients in the search, but there's no dedicated Clients page to view/edit client information.

### 2. Invoice PDF Export Not Implemented
**Issue:** There's no way to download/print an invoice from InvoicesPage. The proposal generator has print functionality, but invoices don't.

### 3. Project Details Chunk Management Incomplete
**File:** `app/src/os-beta/pages/ProjectDetailsPage.jsx` (not fully reviewed)  
**Observation:** The chunks system exists but the UI for managing chunks (add/edit/delete) from the project detail page should be verified.

### 4. Google Calendar Event Creation Placeholder
**File:** `server.js` (lines 1040-1041)  
**Issue:** The schedule publish endpoint just marks chunks as `scheduled` but doesn't actually create Google Calendar events:
```javascript
// For now, just mark as scheduled (calendar integration in production)
```

### 5. Schedule Rocks Endpoint Requires OAuth
**File:** `server.js` (lines 1205-1299)  
**Issue:** The rocks endpoint fails with 401 if Google Calendar isn't connected, but there's no graceful fallback in the SchedulePage UI.

---

## 💡 RECOMMENDED IMPROVEMENTS

### High Priority
1. **Fix the OAuth callback hardcoded URL** - Production will break
2. **Sync MRR calculation** between server.js and Vercel API
3. **Fix proposal convert table name** - Currently updating wrong table
4. **Add `set_time` action to Vercel API** - Timer editing broken in prod

### Medium Priority
5. **Add "Create Project" button** to ProjectsPage
6. **Respect project rates** in InvoicesPage line items
7. **Allow time logging** for non-active projects
8. **Implement Google Calendar** event creation in publish

### Low Priority / Polish
9. **Add invoice PDF export** functionality
10. **Create a Clients management page**
11. **Adjust work hours** in SchedulePage to standard 9-5
12. **Add React error boundaries**
13. **Consistent use of ConfirmModal** across all destructive actions
14. **Remove unused imports** (Circle in ProjectsPage)

---

## 📊 OVERALL ASSESSMENT

| Area | Rating | Notes |
|------|--------|-------|
| **Core Proposal Generator** | ⭐⭐⭐⭐⭐ | Solid, well-implemented |
| **OS Beta Dashboard** | ⭐⭐⭐⭐ | Good foundation, needs polish |
| **Time Tracking** | ⭐⭐⭐⭐ | Works well, minor UX improvements |
| **Invoicing** | ⭐⭐⭐ | Functional but missing PDF export |
| **Scheduling** | ⭐⭐⭐ | Draft works, calendar integration incomplete |
| **Code Architecture** | ⭐⭐⭐ | Duplication concern needs addressing |
| **Production Readiness** | ⭐⭐⭐ | Several bugs must be fixed first |

---

**Next Steps:** I recommend creating a prioritized backlog from this audit and having Claude Code address the High Priority items first before any new feature development.
