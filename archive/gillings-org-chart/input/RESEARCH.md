# UNC Gillings Interactive Org Chart — Research Notes

## Project Overview
- **Client:** Elizabeth French, Senior Associate Dean for Strategy, UNC Gillings School of Global Public Health
- **Project type:** Web application — self-service interactive org chart replacing a static PDF
- **Existing relationship:** Adrial updates the org chart PDF a few times per year
- **Key requirement:** Client wants to update it themselves without needing a designer
- **Build approach:** Claude Code (AI-assisted development) for efficiency

## Source Documents Analyzed

1. **org-chart-Gillings-Leadership-2026-Jan.pdf** — The current org chart as a designed 8.5x11 PDF. Single page, landscape-oriented layout. UNC branding (Carolina blue header). "Updated May 2025" timestamp. ~30 people with photos, names, credentials, titles.

## Current Org Chart Structure

### Hierarchy
- **Dean:** Nancy Messonnier, MD, Bryson Distinguished Professor
- **Vice Dean:** Robert Smith III, PhD

### Departments (Left Column — 8 Chairs)
1. Biostatistics — Michael Hudgens, PhD
2. Environmental Sciences & Engineering — Rebecca Fry, PhD
3. Epidemiology — Maria Gallo, PhD
4. Health Behavior — Kurt Ribisl, PhD
5. Health Policy & Management — Kristin Reiter, PhD
6. Public Health Leadership & Practice — Vaughn Upshaw, DrPH, EdD
7. Maternal & Child Health — Alessandra Bazzano, PhD, MPH
8. Nutrition — Raz Shaikh, PhD

### Mission & Strategic Priority Areas (Center)
- **Faculty/Staff Affairs:** Mark Holmes, PhD (Senior Assoc Dean); Kim Ramsey-White, PhD (Assoc Dean for Wellbeing)
- **Research:** Alexia Kelley, PhD (Interim Assoc Dean)
- **Academics:** Dana Rice, DrPH (Assoc Dean); Laura Linnan, ScD (Senior Assoc Dean); Ciara Zachary, MPH, PhD (Asst Dean, Master's); Shelley Golden, PhD (Asst Dean, Doctoral); Jane Monaco, DrPH (Asst Dean, Undergrad)
- **Practice:** Dorothy Cilenti, DrPH (Assoc Dean); Amy Lanou, PhD (NC Institute for Public Health Director)
- **Global Health:** Suzanne Maman, PhD (Assoc Dean)
- **Advancement:** Mary Margaret Carroll (Assoc Dean)

### Strategy, Innovation & Implementation (Right-Center)
- Strategy — Elizabeth French, MA (Senior Assoc Dean)
- Communications & Marketing — Matthew Chamberlin (Assoc Dean)
- Dean's Office — Rhesia Lewis, MSEd (Asst Director)
- Innovation — Anne Glauber, MPH (Director)
- Strategic Analysis & Business Intelligence — Deytia Lima Rojas, PhD (Asst Dean)

### Central Administration (Right Column)
- Facilities — Brent Wishart, MPM (Senior Director)
- Finance & Business — Tiffany Farina, EdD, CRA, CFRA (Assoc Dean)
- Human Resources — Position Vacant
- IT & Project Planning — Kathy Anderson, PhD (Assoc Dean)
- Student Affairs — Charletta Sims Evans, MEd (Assoc Dean)

### Other Elements
- External Advisory Boards: SPH Advisory Council, Alumni Association Governing Board, Practice Advisory Committee, Public Health Foundation Board
- Student Leaders: Minority Student Caucus, Student Global Health Committee, Student Government

## Scope Decisions

### Included
- Responsive web view (shareable link, works on all devices)
- Self-service editor (password-protected, no code skills needed)
- Print-ready 8.5x11 PDF download
- Clickable links to Gillings about pages for each person
- Vacancy placeholder support
- All current ~30 personnel pre-populated at launch

### Excluded
- Headshot photography/editing
- Bio content on Gillings website
- Org chart hierarchy restructuring (tool preserves current structure)

## Estimation Rationale

AI-assisted development with Claude Code. This is a well-defined data display + CRUD app.

- **Data Architecture (3-5 hrs):** Mapping ~30 positions from the PDF into a structured data model. Hierarchy is clear from the existing chart. Setting up project scaffolding.
- **Web Interface (8-12 hrs):** The main layout work. Need to translate the PDF's visual hierarchy into a responsive web layout. Desktop view should approximate the PDF layout. Mobile needs a different approach (probably collapsible sections). Each card needs photo, name, credentials, title, link.
- **Editor (6-10 hrs):** Password-gated CRUD interface. Add/edit/remove people, upload photos, manage sections. The higher end accounts for photo upload handling and making the editor intuitive for non-technical users.
- **Print/PDF (4-6 hrs):** CSS print media queries to produce a clean 8.5x11 output. This is the trickiest part — making a complex org chart look good both responsively AND in a fixed print layout. May need a separate print-specific layout.
- **Testing & Launch (3-5 hrs):** Populating all current data, cross-device testing, deployment, training walkthrough.

### Totals
- 24-38 hours = $2,880-$4,560
- Rate: $120/hr (freelancer with AI-assisted development)
- Monthly hosting: $39/mo

## Technical Considerations

- **Print layout is the hardest part:** The current PDF packs a lot of information into a single page with a specific spatial arrangement. Replicating this in a print stylesheet while also having a responsive web version will require careful CSS work.
- **Photo management:** Need a way for the client to upload/replace headshot photos. Consider image optimization on upload.
- **About page links:** Each person's Gillings about page URL needs to be stored and maintained. URLs may change if Gillings restructures their site.
- **Vacant positions:** The current chart has one vacancy (HR). The system needs to handle this gracefully — placeholder image, "Position Vacant" text.
- **UNC branding:** The chart uses Carolina blue, UNC logo, and specific typography. Need to match the institutional look.

## Open Questions / Future Considerations

- **Authentication:** Simple password protection is scoped. If Gillings later wants to tie into UNC's SSO/Shibboleth, that would be a separate project.
- **Version history:** Could be useful to see what the org chart looked like on a given date. Not in scope but could be added later.
- **Multiple org charts:** If other UNC departments want similar tools, the system could be templated.
- **Automated about-page link validation:** Could periodically check that the Gillings URLs haven't gone stale.
