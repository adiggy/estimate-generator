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
- **App:** Next.js (UI) + Neon (DB).
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
