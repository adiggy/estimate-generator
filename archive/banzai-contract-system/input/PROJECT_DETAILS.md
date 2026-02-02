# Banzai! Entertainment - Contract Management System

## Client

**Banzai! Entertainment, Inc.** — a North Carolina corporation producing episodic content (film/TV series), operating across the US and Mexico.

---

## Problem Statement

Banzai has **50-60 contracts per project** spanning extras, cast, and crew. Currently, the process is manual: a producer talks to a cast member or crew member, fills in the first page of a standard contract, reviews it, then puts the full contract into DocuSign for signatures. The team (Donald, Andrea in Portland, and a third party in Mexico) needs a streamlined, location-independent way to generate these contracts without running into access issues (they were locked out of Google Docs due to multi-location sign-ins being flagged as suspicious).

**What they need:** An online form creator that generates the cover page (page 1) of each contract, which then gets attached to the full legal contract and routed through DocuSign for signing.

---

## Workflow (As Described by Client)

```
Producer accesses form
       |
       v
Selects Project Name + Episode (e.g. "3 Days" Epi.01)
       |
       v
Selects contract type: CAST or CREW
       |
       v
Fills in the one-page form (on phone or computer)
       |
       v
Form submitted --> PDF generated preserving layout
       |
       v
Banzai team reviews submitted form
       |
       v
Cover page attached to full contract template
       |
       v
Full contract sent via DocuSign for e-signature
       |
       v
Signed contract archived (per-project subfolders)
```

---

## Contract Templates

### 1. Cast Contract (Low Budget, Non-Union, Actor)

First-page fields (yellow fill-in blanks):

| Field | Notes |
|---|---|
| Effective Date | Day + Month, 2026 |
| Actor Name | Individual non-union actor |
| Production Title | e.g. "3 Days" — per project/episode |
| Episode Number | e.g. Epi.01 |
| **Actor Details** | |
| Name | |
| Address | |
| Phone | |
| WhatsApp Number | |
| Email | |
| Role | |
| Screen Credit | |
| Performance Rate | $ amount + daily / weekly / flat (select one) |
| Rehearsal Rate | $ amount + daily / weekly / flat (select one) |
| Estimated Total | $ amount |
| Profit Participation | __% of total of 15% per episode (See Para. 8) |
| Guaranteed Minimum | See Para. 5e |
| **Transportation & Accommodations** | |
| Hotel | ___ night(s) at ___ OR room in separate apartment/house at ___ |
| Travel Expenses | Ground transportation from ___ to ___ |
| Meals | If travel > 6 hours: 1 meal + non-alcoholic drinks reimbursed |
| Agent | Name + Phone |
| Start Date / End Date | |
| Emergency Contact + Phone | |
| Bank Account and CLABE | **TWO lines** (banking info can be long/detailed) |

### 2. Crew Deal Memo (Independent Contractor)

First-page fields (yellow fill-in blanks):

| Field | Notes |
|---|---|
| Effective Date | Day + Month, 2026 |
| Contractor Name | Individual independent contractor |
| Production Title | Per project/episode |
| Episode Number | e.g. Epi.01 |
| **Contractor Details** | |
| Name | |
| Address | |
| Phone | |
| WhatsApp Number | |
| Email | |
| Crew Title | |
| Screen Credit | |
| Compensation | $ amount + MXN / Dlrs + per project / day / week (select one each) |
| Profit Participation | __% of total of 7% per episode (See Para. 7) |
| Rentals | |
| Loan Out | Company name + Phone |
| Loan Out Address | |
| Start Date / End Date | |
| Emergency Contact + Phone | |
| Bank Account and CLABE | **TWO lines** (banking info can be long/detailed) |

---

## Key Design Requirements

1. **Per-project/episode customization** — The form title, production name, and episode number are pre-set per project so the producer doesn't have to re-enter them each time.
2. **Password-protected access** — Producer enters a password to access the project's forms.
3. **Two contract types** — Cast and Crew, each with their own field set.
4. **Mobile-friendly** — Producers and talent need to fill forms on phones as well as computers.
5. **PDF output** — Submitted form must preserve its layout and be exportable/sendable as a PDF that matches the original contract cover-page formatting.
6. **Two bank lines** — The Bank Account and CLABE field needs two full lines since banking details (especially Mexican CLABE numbers) can be long.
7. **Multi-currency support** — Crew compensation can be in MXN or USD.
8. **Multi-location access** — The team operates from NC, Portland, and Mexico simultaneously — no system that flags multi-location access as suspicious.

---

## DocuSign Integration

The client's existing workflow uses DocuSign for the final signing step. Integration options:

### Option A: Manual (Current Workflow)
- Form generates a PDF cover page
- Banzai team manually attaches it to the full contract
- Uploads to DocuSign, sends for signature using the email from the form

### Option B: Semi-Automated via DocuSign API
- Form submission triggers creation of a DocuSign envelope via [DocuSign eSignature REST API](https://developers.docusign.com/docs/esign-rest-api/)
- Cover page PDF is programmatically merged with the full contract template
- Envelope is created in **draft** status for Banzai to review before sending
- Once approved, Banzai clicks "Send" in DocuSign
- Signer receives the contract at the email address captured in the form

### Option C: Fully Automated via DocuSign + Templates
- Pre-upload full contract templates (cast + crew) to DocuSign as templates
- Form submission auto-populates DocuSign template fields (name, email, role, rate, etc.)
- Draft envelope created with all fields pre-filled
- Banzai reviews and sends
- Signed documents auto-archived to per-project folders

**Recommendation:** Start with **Option A** (get the form working, PDF generation solid), then upgrade to **Option B** once the workflow is validated. Option C is the end-state goal but requires significant DocuSign template setup.

---

## Technical Approach (Proposed)

### Web Form
- Hosted on Banzai's existing website (or standalone)
- Password-gated project selection page
- Dynamic form that loads Cast or Crew fields based on selection
- Responsive design for mobile/desktop
- Form validation for required fields, email format, phone format

### PDF Generation
- Server-side PDF generation that matches the original contract cover-page layout
- Yellow highlighted fill-in areas populated with form data
- Two-line bank account field
- Output PDF formatted to match the existing contract templates exactly

### Data Flow
```
[Web Form] --> [Server] --> [PDF Generated] --> [Email to Banzai team]
                                |
                                v
                        [Optional: DocuSign API]
                        Create draft envelope with
                        cover page + full contract
```

### Storage / Archival
- Submitted form data stored in database
- Generated PDFs stored per project/episode
- Folder structure: `/{project-name}/{episode}/cast/` and `/{project-name}/{episode}/crew/`

---

## Audio Transcriptions

### WhatsApp Audio 1 (Jan 29, 2026 — 20:25, ~2:46)

> I'm about to send you another request for the Banzai site. So I'm in the middle of two projects. Let me see if I can keep a proper train of thought. With these projects, we have like 50 to 60 contracts for each of the projects, from extras to casting, crew, etc. We have standard contracts for the crew, the standard contracts for the cast, and the cover page, the first page of each contract, is modified based on the individual's work, the description of the work, what we're paying them.
>
> If they get back endpoints, you'll see — I'll send you an email. Somehow, I'd like us to have some form that we can add to our website. So for productions, for example, a producer can be talking to somebody, and they can put in, for example, "three days." They put in the password. That pulls up, and then within that particular section, for "three days," it pulls up cast or crew. They click on the link for crew.
>
> And then in that single-page document — I'll send you the documents — it will have essentially that document, but in that document online, they can fill in the stuff on their computer or on their phone. Once they fill in that one page, that one page gets sent to us, and then we review it. Then we take that one page, which should be sent to us as a form. It should maintain its layout. Maybe it gets sent as a PDF. I don't know how that works.
>
> We take that. We put it as the first page of the contract. We review that all of the names and everything's correct. Then we end up having the full contract that we put into DocuSign. None of that is up to you. We manage that. And then we send that based on the email that was sent to us, that's put in there, to them to review the full contract and their information and for them to sign it. Is that something that you can add to the website?

### WhatsApp Audio 2 (Jan 29, 2026 — 20:57, ~1:40)

> Yeah, to be honest, Google Docs works fine for us, except that I just created a new account on Google yesterday. I'm managing that account. It's specifically dedicated to our contracts, right? So we're going to keep our drafts in there and then pull up and then create subfolders. And within the subfolders will be each DocuSign or each contract that has been signed, right? And those contracts will be saved.
>
> So I did that with Google yesterday, but Andrea is from Portland and we have a third party working out of another state in Mexico. And all three of us at different times during the day today and Google blocked it saying, "This looks really fishy. What's going on here? We need to make sure you're not like some bot, some spam that's taking advantage of us." So they locked the account.
>
> Really, we just need an online form creator. I'm going to send you an example in just a moment of the two documents.

---

## Client Email Context

> So — starting with these two pages (on both sheets we'd need TWO bank lines as banking info can be long and detailed), but we'd modify these blanks to each project name for each episode for the producer to quickly be able to fill the pertinent info out with the cast or crew, then we could generate the contracts to send to them to sign...

---

## Summary of Deliverables

1. **Online form system** — Password-protected, per-project forms for Cast and Crew contract cover pages
2. **PDF generation** — Submitted forms produce a formatted PDF matching the original contract layout
3. **Mobile-responsive design** — Works on phones and desktops
4. **DocuSign compatibility** — PDF output ready for DocuSign upload (with optional API integration later)
5. **Multi-user, multi-location** — No access restrictions for team members in different states/countries
