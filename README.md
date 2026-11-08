# KhataLink – Digital Khata & Micro-Credit Management

KhataLink is a pre-production dual-role (Merchant + Customer) web application for tracking micro-credit at local shops (tea stalls, kirana, paan shops, etc.). Do not use it for real financial records until the release gates in `docs/PRODUCTION_READINESS.md` are complete.

**Stack:** Next.js 15 (App Router) + TypeScript + Tailwind CSS + Supabase (Auth, Postgres, Realtime, RLS)  
**Recommended preview host:** Vercel (production deployment not yet verified)

---

## Features Implemented

### Merchant
- Shop profile creation (name, category, address, UPI ID)
- Printable / digital QR code for customers to join
- Dashboard with Outstanding, Today’s Credit, Recoveries, Active Customers
- Quick entry: preset amounts (₹10/20/50/100…), custom amount, note, Credit / Payment toggle
- Per-customer credit limit + block/pause status
- Full transaction history (passbook style)
- Real-time balance updates

### Customer
- Join shops via QR / deep link or search
- Linked shops overview with live balances
- Passbook / ledger view per shop
- “Pay Dues” button → opens merchant’s UPI deep link (GPay / PhonePe / Paytm)
- Real-time push of new entries via Supabase Realtime

### Technical
- Row Level Security (customers only see their own ledgers)
- Atomic `add_transaction` RPC (balance + ledger update in one transaction)
- Credit-limit enforcement server-side
- Immutable ledger (no silent deletes)
- Offline-friendly design (works well on 2G/3G once loaded)

---

## Quick Start (Local)

### 1. Create Supabase Project
1. Create a new Supabase project.
2. Copy its Project URL and publishable key.
3. Keep email confirmation enabled for production; configure Auth redirect URLs for the app's local and deployed origins.

### 2. Apply Database Migrations
The repository now contains an ordered, CLI-managed migration chain:

- `supabase/migrations/20261108000000_initial_schema.sql`
- `supabase/migrations/20261108000100_harden_financial_ledger.sql`

For a disposable local Supabase stack, run `supabase start` and `supabase db reset` to replay the migrations. For a remote project, authenticate and link the intended project, then inspect the proposed changes with `supabase db push --dry-run --remote`. Applying with `supabase db push --remote` changes that remote database; do not run it against the connected project until the owner explicitly approves the live migration.

The hardening migration removes direct client writes to balances and ledger rows, scopes financial records to participants, restricts transaction creation to the shop owner, rejects overpayments, adds idempotency and audited compensating reversals, and exposes shop discovery only through a restricted `public_shops` view. Direct reads from `shops` are owner-scoped. Do not accept real users until the migration chain, Auth/JWT isolation, storage, backup/restore, and functional acceptance tests are verified.

### 3. Clone / Extract this repo
```bash
cd khatalink
cp .env.example .env.local
```

Edit `.env.local`:
```
NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
```

### 4. Install & Run
```bash
npm ci
npm run dev
```

Open http://localhost:3000

---

## Deployment

The application has a successful CI production build, but no hosting provider has been validated as a live release target yet. Vercel is the simplest standard Next.js deployment option: connect this GitHub repository, choose the Next.js preset, and configure the environment variables below. Use a preview deployment first and verify authentication redirects, cookies, protected routes, and database access before promoting production.

Cloudflare Workers with the OpenNext adapter is an alternative, but it requires its own adapter/runtime configuration and has not been verified for this branch. Do not use the retired `@cloudflare/next-on-pages` instructions for this App Router application.

### Environment Variables (Production)
| Variable | Required | Notes |
|----------|----------|-------|
| `NEXT_PUBLIC_SUPABASE_URL` | Yes | Project URL |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Yes | Supabase publishable key (preferred) |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Fallback | Legacy anon key for existing projects |

---

## Project Structure

```
khatalink/
├── src/
│   ├── app/                    # App Router pages
│   │   ├── page.tsx            # Landing + role selection
│   │   ├── login/              # Auth
│   │   ├── signup/
│   │   ├── join/[shopId]/     # QR deep-link join
│   │   └── dashboard/          # Role-based dashboards
│   │       ├── page.tsx
│   │       ├── shop/           # Merchant shop setup
│   │       ├── qr/             # QR generator
│   │       ├── entry/          # Fast transaction entry
│   │       ├── customers/      # Merchant customer list + detail
│   │       ├── ledger/[shopId] # Customer passbook
│   │       └── discover/       # Shop search
│   ├── components/
│   ├── lib/supabase/           # Browser + server clients + middleware
│   └── types/database.ts       # Generated-style types
├── supabase/config.toml       # Supabase CLI project config\n├── supabase/migrations/       # Ordered, versioned database migrations\n├── supabase/tests/            # Disposable PostgreSQL integration tests\n├── supabase/schema.sql       # Reference bootstrap schema
└── ...
```

---

## Phone OTP (Optional)
The current auth uses Email + Password for reliability and zero extra cost.  
To enable Phone OTP:
1. Supabase Dashboard → Authentication → Providers → Phone
2. Connect Twilio / MessageBird / Vonage
3. Update the login/signup forms to use `signInWithOtp({ phone })`

The schema already stores `phone` on profiles. SMS delivery may incur provider charges; keep it disabled until configured and budgeted.

---

## Security Notes
- Apply the complete ordered migration chain before accepting real users.
- Public discovery uses `public_shops`; do not query the internal `shops` table from customer-facing pages.
- Run `npm ci` for reproducible dependency installation. CI enforces `npm audit` and production-only audit gates.
- All exposed tables use Row Level Security and least-privilege grants.
- The service-role/secret key must never be placed in browser code or committed to Git.
- Only a shop owner can record ledger transactions; customers cannot mark their own UPI payments as settled.
- Overpayments are rejected rather than silently clipped.
- Ledger entries are append-only; corrections use a separate reversal record and compensating transaction.
- Review Supabase Security Advisor and Performance Advisor before launch.

---

## Next Improvements You Can Add
- Offline-first with SQLite / IndexedDB + background sync
- WhatsApp / SMS payment reminders
- Geolocation-based nearby shops (PostGIS)
- Multi-shop support for one merchant
- PWA install + push notifications
- Export ledger as PDF / CSV

---

Built with the product specification for **Digital Khata & Micro-Credit Management System**.

This branch remains pre-production. Live migrations, production deployment, and real financial use are blocked pending explicit approval and completion of the release checklist.
