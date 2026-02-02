# Banzai! Entertainment — Contract Form System
## Project Scope Overview

**Prepared for:** Donald, Banzai! Entertainment, Inc.
**Date:** February 1, 2026

---

### Overview

A web-based contract form system that allows Banzai producers to quickly fill out Cast and Crew contract cover pages per project/episode, generate formatted PDFs, and streamline the path to DocuSign for signing.

---

### Phase 1 — Online Form System & PDF Generation

**Password-Protected Project Portal**
- Secure landing page where producers enter a project password
- Once authenticated, producer selects the project/episode and contract type (Cast or Crew)
- Each project/episode has its own pre-configured title and episode number so producers don't re-enter them

**Cast Contract Form**
- All fields from the existing Cast Contract cover page: name, address, phone, WhatsApp, email, role, screen credit, performance rate, rehearsal rate, estimated total, profit participation, guaranteed minimum, transportation/accommodations, agent info, start/end dates, emergency contact, and bank account/CLABE (two full lines for banking details)
- Rate type selection (daily / weekly / flat)

**Crew Deal Memo Form**
- All fields from the existing Crew Deal Memo cover page: name, address, phone, WhatsApp, email, crew title, screen credit, compensation, profit participation, rentals, loan-out info, start/end dates, emergency contact, and bank account/CLABE (two full lines)
- Currency selection (MXN / USD) and pay period selection (per project / day / week)

**PDF Generation**
- On submission, a formatted PDF is generated matching the layout of the original contract cover pages
- PDF is emailed to the Banzai team for review
- Submitted data is stored and organized by project/episode for reference

**Mobile-Responsive Design**
- Forms work on phones, tablets, and desktops so producers and talent can fill them out from anywhere

---

### Phase 2 — Admin Dashboard

**Project & Episode Management**
- Admin interface to create and manage projects and episodes
- Set project passwords and configure project-specific details (production title, episode numbers)
- View and search all submitted forms by project, episode, contract type, or person name

**Submission Review**
- View submitted form data alongside the generated PDF
- Re-download or re-send PDFs as needed
- Track status of each contract (submitted, reviewed, sent to DocuSign, signed)

---

### Phase 3 — DocuSign Integration

**Draft Envelope Creation**
- When a form is submitted and reviewed, trigger creation of a DocuSign envelope via the DocuSign API
- Cover page PDF is automatically merged with the full contract template (cast or crew)
- Envelope is created in draft status for Banzai to review before sending

**Automated Routing**
- Signer's email address (captured in the form) is pre-populated in DocuSign
- One-click send from the admin dashboard after review

**Signed Document Archival**
- Completed/signed contracts are automatically saved back and organized by project/episode

---

### Hosting & Access

- Hosted independently (no reliance on Google accounts or third-party platforms that restrict multi-location access)
- Accessible from any location — NC, Portland, Mexico, or anywhere else — without lockout issues
- Can be added to the existing Banzai website or hosted as a standalone application

---

### Summary of Deliverables

| Phase | Deliverable |
|---|---|
| **Phase 1** | Online Cast & Crew forms, PDF generation, email delivery to Banzai team |
| **Phase 2** | Admin dashboard for project management, submission review, and status tracking |
| **Phase 3** | DocuSign API integration for draft envelope creation, automated routing, and archival |

---

*Please review and confirm this scope so we can proceed with a formal estimate and proposal.*
