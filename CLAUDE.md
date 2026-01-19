# Estimate Generator - Claude Workflow

## Overview

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
└── server.js            # Express API server (port 3002)
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

### Step 7: User Reviews and Edits in Browser

1. Open http://localhost:5174
2. Click the proposal from the dashboard
3. Edit any field by clicking on it
4. Changes auto-save every second
5. Print to PDF and **save to archive folder** as `proposal.pdf`

---

## Proposal JSON Schema

**IMPORTANT:** Benefits and upsells are NOT stored in proposals. They come from the shared template based on `projectType`. Editing a template updates ALL proposals of that type.

```json
{
  "id": "2026-01-19-project-slug",
  "createdAt": "2026-01-19",
  "updatedAt": "2026-01-19",
  "status": "draft",
  "projectType": "web",  // "web", "logo", "print", or "app" - links to template
  "archivePath": "archive/client-slug-project-slug",

  "clientId": "client-slug",
  "clientName": "Client Full Name",
  "clientCompany": "Organization Name",  // Optional, shown after client name
  "projectName": "Project Title",
  "date": "January 19, 2026",
  "expirationDate": "February 19, 2026",

  "projectDescription": "2-4 sentence overview of the project goals.",

  "estimatedTimeline": "8-10 weeks from kickoff to launch.",  // Displayed after estimate

  "internalNotes": "Notes for Adrial only - won't print.",

  "phases": [],      // Customized per project (NOT from template)

  "discountPercent": 0,
  "monthlyFee": 39,  // From template (0 for non-web projects)

  "contactInfo": {
    "name": "Adrial Dale",
    "phone": "(919) 968-8818",
    "email": "adrial@adrialdesigns.com",
    "website": "www.adrialdesigns.com"
  }
}
```

**DO NOT include `benefits` or `upsells` in proposal JSON.** These are pulled from `/data/templates/{projectType}.json` at render time.

---

## Project Templates

Templates are stored in `/data/templates/` and contain:
- `type` - identifier (web, logo, print, app)
- `label` - display name
- `benefits` - 6 items for "What's Included" section
- `upsells` - 3 items for "Also Available" section
- `defaultPhases` - starting point phases (customize per project)
- `monthlyFee` - default monthly fee (39 for web, 0 for others)

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

1. **Break work into logical phases** - typically 3-6 phases for simple projects, up to 10 for comprehensive builds
2. **Use realistic hour ranges** - low is optimistic, high is conservative
3. **Standard rate is $120/hr** unless client has a discount
4. **Customize from template** - use `defaultPhases` as starting point, adjust descriptions and hours for specific project
5. **For larger projects** - consider adding dedicated phases for Documentation, Training, and Post-Launch Support

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

## Running the App

```bash
# Start both servers
npm start

# Or separately:
npm run api   # Express API on port 3002
npm run dev   # Vite dev server on port 5173/5174
```

---

## Updating an Existing Proposal

When asked to update a proposal:
1. Read the proposal JSON to find the `archivePath`
2. Review the original input documents in `{archivePath}/input/`
3. Make requested changes to the proposal JSON
4. Remind user to re-export PDF to the same archive folder
