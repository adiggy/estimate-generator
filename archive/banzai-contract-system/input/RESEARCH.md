# Banzai! Entertainment — Contract Form System - Research Notes

## Project Overview
- **Client:** Donald Whittier, Banzai! Entertainment, Inc. (NC corporation)
- **Email:** donaldwhittier@mac.com
- **Project type:** Web application — online contract form system
- **High-level summary:** Replace manual contract cover page creation with a web-based form system that generates formatted PDFs for Cast and Crew contracts, organized by project/episode
- **Key constraint:** Must be accessible from NC, Portland, and Mexico simultaneously without lockout issues (Google Docs failed them for this reason)
- **Volume:** 50-60 contracts per project across extras, cast, and crew

## Source Documents Analyzed

1. **BANZAI_PROJECT_SCOPE.md** — Formal 3-phase scope document prepared for Donald. Defined the portal, forms, PDF generation, admin dashboard, and DocuSign integration phases.
2. **PROJECT_DETAILS.md** — Comprehensive requirements doc including workflow diagrams, field-by-field specifications for both contract types, DocuSign integration options (A/B/C), technical approach, and audio transcriptions.
3. **Cast - Donald - Hoja1 yellow.pdf** — Actual Cast Contract (Low Budget, Non-Union, Actor) cover page with yellow highlighted fill-in fields. Single page showing exact layout to replicate.
4. **CREW - Donald - Hoja1 yellow.pdf** — Actual Crew Deal Memo cover page with yellow highlighted fill-in fields. Single page showing exact layout to replicate.
5. **WhatsApp Audio 2026-01-29 at 20.25.29.opus** — Donald describing the workflow: producer talks to talent, fills in cover page, sends for review, attaches to full contract, routes through DocuSign. Transcription included in PROJECT_DETAILS.md.
6. **WhatsApp Audio 2026-01-29 at 20.57.08.opus** — Donald explaining the Google Docs lockout issue (multi-location flagged as suspicious). "We just need an online form creator." Transcription included in PROJECT_DETAILS.md.

## Scope Decisions

### Included
- Password-protected project portal with per-project/episode configuration
- Cast Contract form with all fields from the original cover page
- Crew Deal Memo form with all fields from the original cover page
- Server-side PDF generation matching original yellow-highlighted layouts
- Email delivery of submitted PDFs to Banzai team
- Admin dashboard for project management and submission review
- Contract status tracking (submitted, reviewed, sent to DocuSign, signed)
- Mobile-responsive design
- DocuSign API integration (as optional Phase 5)

### Excluded
- Full contract legal content (system generates cover page only)
- Contract language review or modifications
- DocuSign subscription fees
- Ongoing template changes post-launch

### Assumptions
- Banzai maintains their own DocuSign account
- Two contract types only (Cast and Crew) — no extras contract
- Banking fields need two full lines for CLABE numbers (Mexican banking)
- PDF layout must closely match the existing yellow-highlighted contract templates
- Can be hosted standalone or added to existing Banzai website

## Estimation Rationale

### Phase breakdown follows the client's own 3-phase scope document:
- **Discovery (6-10 hrs):** Two contract templates to map, straightforward schema. Field mapping is well-defined from the PDFs.
- **Form System (28-36 hrs):** Two distinct form types with multiple field types (text, selectors, multi-line). Password auth, project/episode hierarchy. Mobile responsive. The higher range accounts for the precise layout matching needed.
- **PDF Generation (16-22 hrs):** Server-side PDF rendering matching the exact yellow-highlighted layout of the originals. This is the most technically nuanced part — getting the layout pixel-close to the originals. Email integration adds modest complexity.
- **Admin Dashboard (20-28 hrs):** CRUD for projects/episodes, submission browser with search/filter, PDF preview alongside form data, status tracking. Standard dashboard scope.
- **DocuSign Integration (16-22 hrs, optional):** REST API integration, envelope creation, template merging, signer routing. Marked optional per PROJECT_DETAILS.md recommendation to validate the form workflow first.
- **Testing & Deployment (6-10 hrs):** Cross-device testing is important given mobile requirement. Training session for producers.

### Totals
- **Core system (Phases 1-4, 6):** 76-106 hours = $9,120 - $12,720
- **With DocuSign (all phases):** 92-128 hours = $11,040 - $15,360

### Rate: $120/hr standard

## Technical Considerations

- **Hosting:** Must be independently hosted — no Google/third-party platform dependencies that restrict multi-location access
- **PDF generation:** Need server-side solution that can reproduce the exact yellow-highlighted layout from the original contract templates. Libraries like Puppeteer or pdf-lib are candidates.
- **DocuSign API:** eSignature REST API for draft envelope creation. Cover page merging with full contract templates. Will need Banzai's DocuSign API credentials.
- **Authentication:** Simple password-per-project model (not individual user accounts). Admin dashboard needs separate auth.
- **Currency handling:** Crew compensation can be MXN or USD
- **Banking fields:** Two full lines for Bank Account and CLABE — Mexican CLABE numbers are 18 digits and banking details can be lengthy

## Open Questions / Future Considerations

- **Extras contracts:** Currently only Cast and Crew are scoped. Donald mentioned "extras" in the audio — may need a third form type later.
- **DocuSign template setup:** Option C (fully automated with DocuSign templates) requires pre-uploading contract templates to DocuSign. This is the end-state goal but needs significant template configuration on DocuSign's side.
- **Multi-language support:** Team operates in Mexico — may eventually need Spanish language forms.
- **Archival storage:** Long-term storage needs for signed contracts. Consider cloud storage integration.
- **Number of concurrent projects:** The password-per-project model works well for a few active projects but may need refinement if many projects are active simultaneously.
- **Integration with Banzai website:** Client mentioned it "can be added to the existing Banzai website" — need to determine if this means embedded iframe, subdomain, or standalone.
