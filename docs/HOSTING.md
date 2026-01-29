# Hosting & Billing Reference

## Current State (Jan 2026)

**Billing Platforms:**
- **Bonsai** - Current invoicing for recurring hosting and project work
- **Stripe** - Payment processor (receives payments from Bonsai)
- **OS Beta** - Future invoicing (not yet handling payments)

**Key Finding:** Bonsai stores card data, NOT Stripe. To charge directly through Stripe, customers need to re-enter cards.

---

## hosting_billing Table (Source of Truth)

```sql
hosting_billing (
  id TEXT PRIMARY KEY,              -- project_id
  client_id TEXT,                   -- e.g., 'burk-uzzle'
  client_name TEXT,
  contact_name TEXT,
  email TEXT,
  stripe_customer_id TEXT,          -- when card saved
  stripe_status TEXT,               -- 'ready' or 'needs_setup'
  project_id TEXT,
  project_name TEXT,
  rate_cents INTEGER,               -- monthly charge
  webflow_cost_cents INTEGER,       -- Webflow cost
  profit_cents INTEGER,             -- rate - webflow_cost
  last_invoice_date DATE,
  next_billing_date DATE,
  billing_platform TEXT,            -- 'bonsai_legacy' or 'os'
  billing_frequency TEXT,           -- 'monthly' or 'annual'
  historical_charges INTEGER,       -- hosting invoices only
  historical_total_usd NUMERIC,
  checkout_link TEXT,               -- Stripe Checkout URL
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
)
```

**Note:** Clients with multiple hosting projects have multiple rows.

---

## Webflow Pricing Tiers

| Plan | Monthly Cost |
|------|--------------|
| CMS | $29/mo |
| Business | $49/mo |
| Basic | $18/mo |
| Annual CMS | $23/mo ($276/yr) |
| Legacy (30% off) | $20.30/mo |

**Hosting Page Filter:** Only shows clients with `webflow_cost > 0` (active).

---

## Annual Clients (5 total)

| Client | Annual Amount | Monthly Equivalent |
|--------|---------------|-------------------|
| Ainsworth & Associates | $372.60 | $31.05 |
| Self-Care Info | $372.60 | $31.05 |
| Silverstone Jewelers | $372.60 | $31.05 |
| Cliff Cottage Inn | $487.20 | $40.60 |
| Colorado State University | $487.20 | $40.60 |

`rate_cents` stores monthly equivalent for MRR consistency.

---

## Current Totals (Jan 2026)

- Monthly MRR: $1,250.95
- Monthly Profit: $385.35
- Historical hosting revenue: $47,482.80 across 1,049 invoices
- 33 active hosting projects (28 monthly, 5 annual)

**Known Issue:** Resonant Body has negative profit (-$1.91/mo)

---

## Stripe Billing API

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/os-beta/stripe/checkout-session` | POST | Create Checkout link |
| `/api/os-beta/stripe/customer/:clientId` | GET | Get customer & payment methods |
| `/api/os-beta/stripe/charge` | POST | Charge saved card |
| `/api/os-beta/webhooks/stripe` | POST | Handle webhook events |

**Checkout Session:**
```javascript
POST /api/os-beta/stripe/checkout-session
{ "clientId": "burk-uzzle" }
// Returns: { checkoutUrl, customerId, sessionId }
```

---

## Migration Strategy (Future)

**Gradual Migration:**
1. Keep Bonsai for existing recurring clients
2. When card fails/expires → send Stripe Checkout link
3. New clients → go directly through Stripe
4. Natural migration over 1-2 years as cards expire

**Email Flow (When Ready):**
1. OS generates email with Stripe Checkout link + billing info
2. Resend sends email
3. Client enters card on Stripe's hosted page
4. Webhook creates Stripe Customer
5. On billing date, OS charges via Stripe

**Timing:** Send migration emails 10-14 days before billing date.

---

## Scripts Reference

| Script | Purpose |
|--------|---------|
| `scripts/add-webflow-costs.js` | Add Webflow costs to hosting |
| `scripts/export-hosting-csv.js` | Export hosting_billing to CSV |
| `scripts/check-stripe-rates.js` | Query Stripe for actual charges |
| `scripts/fix-rates-from-stripe.js` | Update DB from Stripe data |
| `scripts/fix-hosting-history.js` | Recalculate hosting-only history |
| `scripts/fix-client-data.js` | Manual corrections |
| `scripts/consolidate-hosting-clients.js` | Merge data sources |
| `scripts/match_stripe_v4.js` | Match Stripe to Bonsai clients |

---

## Bonsai Data Exports

Located in `legacy_data/bonsai/`:

| File | Contents |
|------|----------|
| `adrial_invoice_export_*.csv` | 1,517 invoices |
| `adrial_companiescontact_export_*.csv` | 70 clients |
| `adrial_project_export_*.csv` | Projects |
| `adrial_timeentry_export_*.csv` | Time entries |

**Invoice CSV Columns:** 0: status, 1: total_amount, 11: issued_date, 13: paid_date, 14: invoice_number, 15: project_name, 16: client_name, 17: client_email

---

## Output Files

| File | Contents |
|------|----------|
| `legacy_data/stripe_by_bonsai_client.csv` | 75 clients with ALL charges |
| `legacy_data/stripe_migration_status.csv` | Active hosting with history |
| `legacy_data/hosting_billing_dates.csv` | 32 clients with billing dates |

---

## Environment Variables

```
STRIPE_SECRET_KEY=sk_live_xxx
```

**Future:**
```
RESEND_API_KEY=re_xxx
STRIPE_WEBHOOK_SECRET=whsec_xxx
```

---

## Data Relationships

```
Bonsai Invoice #2595
    ↓ (description contains invoice #)
Stripe Charge ch_xxx
    ↓ (matched via script)
OS Invoice record
    ↓ (client_id link)
OS Client / Hosting Project
```
