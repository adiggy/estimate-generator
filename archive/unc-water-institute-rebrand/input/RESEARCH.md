# Water Institute Website Rebrand - Research Notes

## Project Overview

- **Client:** Catherine Rierson, Conference & Project Coordinator
- **Company:** UNC Water Institute (part of Gillings School of Global Public Health)
- **Email:** waterinstitute@unc.edu
- **Project Type:** Website rebrand (existing site, new brand compliance)
- **Deadline:** February 28, 2026 (hard deadline - university mandate)
- **Kickoff Required:** End of January 2026 to meet deadline

## Source Documents Analyzed

### 1. UNC Branding Update.pdf
- University-wide brand architecture mandate
- All units must comply by February 28, 2026
- Key requirements: retire standalone logos, implement signature system, use UNC toolbar

### 2. Gillings_School_of_Global_Public_Health_Brand_Book.pdf
- Comprehensive brand guidelines for the Gillings School
- Logo/signature specifications (interlocking NC + wordmark)
- Typography: Open Sans (Bold for headings, Regular for body)
- Color palette: Carolina Blue (#4B9CD3), Navy (#13294B)
- Argyle pattern graphic elements and usage guidelines
- Header/footer component specifications
- Unit naming conventions ("The Water Institute" in Open Sans Bold)

### 3. uncwi.webflow folder (existing website export)
- Complete Webflow export of current Water Institute site
- **33 static pages** identified across multiple sections
- **14 CMS collection templates** with ~1,000 content items
- Current site built by Adrial Designs (existing relationship)

## Site Audit Results

### Static Pages (33 total)

**Core Pages (4)**
- Homepage, 404 Error, Join Us, Donors and Granters

**About Section (4 pages)**
- About Landing, History & Process, Our Team, Job Openings

**Our Work Section (11 pages)**
- Our Work Landing, Conferences, Research Profiles, Our Projects
- Publications, Calendar of Events, NC Water News Newsletter
- What's on Tap Newsletter, Knowledge Hub, Student Page, Student Blogs

**Conference Pages (14 pages)**
- Water & Health Conference main page and registration
- Archive pages for 2022, 2023, 2024, 2025 conferences
- Environmental Health Services LMIC page

### CMS Collections (14 templates, ~1,000 items)

| Collection | Item Count | Notes |
|------------|------------|-------|
| Team Profiles | 35 | Staff bios with photos |
| Projects | 40 | Research project details |
| Knowledge Hub | 51 | Educational articles |
| Research Profiles | 3 | Featured research |
| Conference Archives | 15 | Past conference info |
| Events | 274 | Calendar items |
| Publications | ~500-600 | Academic papers, reports |
| Student Blogs | 5 | Student-written content |
| Job Openings | Variable | Current positions |
| Announcements | Variable | News items |
| Conference FAQs | Variable | Per-conference |
| Conference Links | Variable | Per-conference |
| Conference Updates | Variable | Per-conference |
| Banners | Variable | Promotional |

## Scope Decisions

### Included
- Full brand audit of all 33 pages and 14 templates
- New header component with UNC toolbar
- New footer with Gillings School signature
- Typography migration to Open Sans
- Argyle graphic integration where appropriate
- All CMS template restyling
- Migration of ~1,000 CMS items to new database
- Headless CMS architecture (Supabase + Sanity)
- 301 redirect migration
- Cross-browser testing
- Two revision rounds per phase

### Excluded
- Content creation/copywriting (using existing content)
- New photography (reusing all existing images)
- SEO optimization beyond current setup
- Social media profile updates
- Print collateral
- Ongoing maintenance post-launch

### Assumptions
- All existing images/graphics will be reused as-is
- Client will handle their own hosting infrastructure
- Content review/approval will happen promptly to meet deadline
- No significant content restructuring needed (just brand application)

## Estimation Rationale

### Phase-by-Phase Breakdown

**Brand Audit & Planning (11-13 hrs)**
- 33 pages + 14 templates = 47 items to audit
- ~15 min average per item for thorough review
- Documentation and roadmap creation

**Design System & Components (18-21 hrs)**
- Header component with UNC toolbar: 4-5 hrs
- Footer with Gillings signature: 3-4 hrs
- Typography system setup: 4-5 hrs
- Argyle elements library: 4-5 hrs
- Component documentation: 2-3 hrs

**Static Page Development (36-44 hrs)**
- 33 pages at ~1-1.5 hrs average
- Homepage and conference landing pages need extra attention
- Some pages are simple (404) while others are complex (conference pages)

**CMS Templates & Migration (43-54 hrs)**
- 14 templates at ~2-3 hrs each: 28-42 hrs
- Migration of ~1,000 items: 15-20 hrs (scripted but needs QA)
- Sanity schema setup included

**Development & Integration (21-28 hrs)**
- Headless CMS setup (Supabase + Sanity): 8-10 hrs
- CSS updates for typography/colors: 5-7 hrs
- Header/footer integration: 4-5 hrs
- Build optimization: 4-6 hrs

**QA & Brand Compliance (14-19 hrs)**
- Cross-browser testing (Chrome, Safari, Firefox, Edge): 4-5 hrs
- Device testing (mobile, tablet, desktop): 3-4 hrs
- Brand compliance checklist review: 3-4 hrs
- 301 redirect migration and testing: 2-3 hrs
- Final client review and deploy: 2-3 hrs

### Comparable Projects
- This is an existing Adrial Designs site, so familiarity reduces some risk
- Brand compliance projects typically have clear requirements (brand book)
- CMS migration is the main risk area (volume of content)

### Risk Factors Reflected in Estimates
- Rush timeline (4 weeks) - no buffer for delays
- Large content volume (~1,000 items) - migration could surface issues
- Conference pages complexity - 14 separate conference pages with different states
- University stakeholder approvals - potential review delays (not in our control)

## Technical Considerations

### Architecture Change
- **Current:** Webflow-hosted site
- **New:** Headless CMS with separate content database
  - **Frontend:** React-based static site (likely Next.js or Astro)
  - **Content:** Sanity CMS for content management
  - **Database:** Supabase for structured data
  - **Hosting:** Client's infrastructure (not included in scope)

### Why Headless?
- Faster page loads (static generation)
- Easier content editing for non-technical staff
- More flexible for future development
- Better separation of content and presentation

### Integration Requirements
- UNC toolbar implementation (may need to fetch from UNC central)
- Existing URL structure must be preserved (301 redirects)
- RSS feeds for newsletters should continue working

### Known Constraints
- Hard deadline: February 28, 2026
- Must match exact brand specifications (university compliance)
- Existing content must not be lost in migration

## Open Questions / Future Considerations

### Items That May Come Up
- Will they want the Global Lead-Free Water (GLFW) site updated too?
  - **UPDATE (Jan 28, 2026):** Yes - separated into standalone proposal `2026-01-28-glfw-rebrand`
- Potential requests for new features during the rebrand
- Additional conference pages for future years

### Potential Scope Creep Areas
- "While you're in there, can you also..." requests
- Content restructuring beyond brand application
- SEO improvements
- New page requests

### Things to Clarify if Accepted
- Exact hosting environment and deployment process
- Who reviews/approves brand compliance (Gillings comms team?)
- Content freeze date for migration
- Staging environment access

## Related Proposals

- **2026-01-28-glfw-rebrand** - Global Lead-Free Water website rebrand (separated from this project)
  - Single-page scrolling site
  - 12-18 hrs ($1,440-$2,160)
  - Same client, same brand requirements

---

*Last updated: January 28, 2026*
