# Project Definition: Adrial Designs OS (The Agency Operating System)

## 1. Executive Summary & Core Philosophy
I am transforming my existing "Proposal Generator" repository into a complete **Agency Operating System**. This system will handle Project Management, Intelligent Scheduling, Time Tracking, and Invoicing.

**Core Philosophy: "Local-First, AI-Worker"**
-   **The App (Headless UI):** A Next.js application running locally (`localhost:3000`) connected to Neon (PostgreSQL).
-   **The Worker (Claude Code CLI):** You (Claude Code) acts as the intelligent "Worker" in the terminal.

**Critical Constraints:**
-   **Sandboxing:** All new UI features must reside in `/dashboard/os-beta/`.
-   **Sacred Code:** DO NOT modify the existing `proposals` logic.

---

## 2. Architecture & Data Model (Refined)

### Database Schema Extension (Neon PostgreSQL)
1.  **`clients`**: Extended with Stripe mapping.
2.  **`projects`**:
    -   `status`: `active`, `waiting_on`, `stagnant`, `done` (Matches Airtable).
    -   `billing_platform`: `stripe` or `bonsai_legacy` (important for Hosting).
    -   `budget_low` / `budget_high`.
3.  **`chunks`** (The Atomic Unit):
    -   `id`, `project_id`.
    -   `phase_name` (Text) - For Gantt Grouping.
    -   `duration_hours` (Enum: `1`, `2`, `3`) - **AI Sets Default, User Can Edit**.
4.  **`invoices`**:
    -   `line_items` (JSONB) - Indexed with GIN for deep search.

---

## 3. The "Worker" Workflows (CLI Scripts)

### Workflow A: The "Planner" (Intelligent Chunking)
-   **Input:** Project Scope.
-   **Action:** Break down into Phases -> Chunks.
-   **Constraint:** AI proposes chunk sizes (1-3h), but **User has final edit authority** before scheduling.

### Workflow B: The "Interwoven" Scheduler
-   **READ:** Personal Calendar ("Adrial project").
-   **WRITE:** Work Calendar ("Adrial project chunks").
-   **Logic:**
    1.  Fetch `PENDING` chunks.
    2.  Score: `(Priority + Deadline + Recency)`.
    3.  Fit into "Adrial project" gaps.
    4.  Write to "Adrial project chunks".

### Workflow C: The "Auto-Invoicer"
-   **Trigger:** *"Draft invoice for Client X."*
-   **Logic:**
    1.  **Selection Step:** Fetch all unbilled completed chunks.
    2.  **Constraint:** Allow user to *select/unselect* chunks (Default: All checked).
    3.  **Guardrail:** Check sum vs `budget_high`.
    4.  Generate Stripe Draft.

---

## 4. UI Views (The Dashboard)

### 1. The Smart Grid (Management)
-   Columns: `Status`, `Priority`, `Last Touched`.
-   **Computed Column:** `Unbilled Hours`.
-   **Filter:** Exclude `billing_platform = 'bonsai_legacy'` (Hosting) projects by default.

### 2. The Gantt View (Bird's Eye)
-   **Visual:** Timeline of Project `Chunks` grouped by `phase_name`.
-   **Reactive:** Bars expand automatically if the Scheduler pushes chunks.

### 3. The Hosting Tab (Recurring Revenue)
-   **Purpose:** Dedicated view for `billing_platform = bonsai_legacy` projects.
-   **Metrics:** Show Total Recurring Monthly Revenue (MRR) from these clients.
-   **Logic:** Keep them separate from the active project workflow to reduce noise.

### 4. The Time Tracker (Mobile Optimized)
-   **Requirement:** The `/time` page must be **Mobile First**. Large buttons for "Start/Stop" and quick project selection, so Adrial can track time from his phone.

### 5. The CFO Dashboard (Revenue Metrics)
-   **Metrics:** Unbilled Work vs Unpaid Invoices vs Paid Revenue.

### 6. Global Search (Deep Search)
-   **Tech:** Use GIN Index on `line_items`. Solve the "Bonsai Pain Point" by making every invoice description searchable.

---

## 5. Implementation Roadmap

**Phase 1: Foundation & Data**
1.  **Schema:** Run `schema_extension.sql`.
2.  **Import:** Run `import-legacy.ts` (Map "Legacy" hosting clients to `bonsai_legacy`).

**Phase 2: The Logic**
3.  **Scheduler:** Build `scheduler.ts` (Two-Calendar Logic).
4.  **Chunker:** Build `chunker.ts` (AI + Manual Override).

**Phase 3: The UI**
5.  **Scaffold:** `/dashboard/os-beta/`.
6.  **Views:** Smart Grid, **Gantt Chart**, **Hosting Tab**, Mobile Time Tracker.

**Phase 4: Billing**
7.  **Invoicing:** Build `generate-invoice.ts` (Selection Modal).
8.  **Search:** Implement Deep Search.

---

**Ready?** Start by verifying the Schema has the new `billing_platform` enum.
