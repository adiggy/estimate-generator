# Proposal Generator Reference

## Proposal JSON Schema

**Benefits by project type:**
- **Web, Logo, Print:** Benefits come from shared templates in `/data/templates/`. Do NOT include `benefits` in the proposal JSON.
- **App:** Each app is unique, so include custom `benefits` array directly in the proposal JSON.

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
  "estimatedTimeline": "8-10 weeks from kickoff to launch.",
  "internalNotes": "Notes for Adrial only - won't print.",

  "phases": [],      // Customized per project (NOT from template)

  // For app projects ONLY:
  "benefits": [
    { "icon": "Shield", "title": "Feature Name", "description": "What this feature does." }
  ],

  // For complex projects (markdown supported):
  "projectSpecifics": "## Section Header\n- **Feature:** Description.",
  "exclusions": "- Content creation\n- Off-page SEO",

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

Templates in `/data/templates/` contain:
- `type` - identifier (web, logo, print, app)
- `label` - display name
- `benefits` - 6-9 items for "What's Included" (ignored for app projects)
- `upsells` - 2-3 items for "Also Available"
- `defaultPhases` - starting point phases (customize per project)
- `monthlyFee` - default monthly fee (39 for web/app, 0 for logo/print)
- `designIncludes` - standard features included (web/app only)
- `hostingIncludes` - features with monthly hosting (web/app only)

| Type | File | Use For |
|------|------|---------|
| `web` | `web.json` | Websites, web apps, landing pages |
| `logo` | `logo.json` | Logo design, brand marks, visual identity |
| `print` | `print.json` | Brochures, flyers, marketing materials |
| `app` | `app.json` | Mobile apps, software UI design |

---

## Phase Estimation Guidelines

1. **Break work into logical phases** - typically 4-5 phases for apps
2. **Use realistic hour ranges** - low is optimistic, high is conservative
3. **Standard rate is $120/hr** unless client has a discount
4. **Efficient workflow pricing** - AI-assisted development reflects ~40% efficiency gain
5. **Customize from template** - use `defaultPhases` as starting point
6. **For app projects** - include custom `benefits` array

**Timeline Estimation:**
| Hours | Timeline |
|-------|----------|
| 50-80 hrs | 4-6 weeks |
| 100-150 hrs | 6-10 weeks |
| 150-220 hrs | 10-14 weeks |

Formula: Total hours ÷ 20-25 hrs/week = build weeks, then add 2-3 weeks buffer.

---

## Client Database

Check `/data/clients.json` before creating proposals. New client format:

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

**Typography:** Gilmer (Regular 400, Bold 700) - `/app/public/fonts/`

**Colors:**
- Brand Red: `#d72027`
- Brand Orange: `#f69220`
- Brand Slate: `#2b303a`
- Brand Gray: `#9ca3af`

**Available Icons (Lucide):**
`Palette`, `Layout`, `Smartphone`, `BarChart3`, `Shield`, `Zap`, `Megaphone`, `RefreshCw`, `PenTool`

---

## Shareable Client Links

**View Mode:** `https://adesigns-estimate.vercel.app/{proposal-id}?view=1`
- Read-only, mobile responsive, clickable contact links

**Edit Mode:** URL without `?view=1`, requires PIN (6350)

---

## Proposal Versioning

Versions saved as JSON in `{archivePath}/versions/` with format `YYYY-MM-DD_HHMM_version-name.json`

**API Endpoints:**
| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/proposals/:id/versions` | POST | Save new version |
| `/api/proposals/:id/versions` | GET | List all versions |
| `/api/proposals/:id/versions/:filename` | GET | Get specific version |
| `/api/proposals/:id/versions/:filename` | DELETE | Delete a version |
| `/api/proposals/:id/versions/:filename/restore` | POST | Restore a version |

**CLI:** `node scripts/backup-proposal.js <proposal-id> [version-name]`

---

## PDF Export & Print Layout

**Filename:** `proposal_Project-Name_Client-Last-Name.pdf`

**Page Structure:**
- Page 1: Header, title, overview, What's Included
- Page 2+: Estimate table (headers repeat)
- Timeline + Also Available (grouped)
- Design Includes + Hosting Includes (if applicable)
- Project Specifics (if populated)
- What Is Not Included (if populated)

**Print CSS:** Section headings red (#bb2225), uppercase, bold. Table headers repeat. Totals stay together.
