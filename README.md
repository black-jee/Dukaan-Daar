# KhataLink – Digital Khata & Micro-Credit Management

A fully functional dual-role (Merchant + Customer) web application for tracking micro-credit at local shops (tea stalls, kirana, paan shops, etc.).

**Stack:** Next.js 15 (App Router) + TypeScript + Tailwind CSS + Supabase (Auth, Postgres, Realtime, RLS)  
**Deploy target:** Vercel or Cloudflare Workers using the current OpenNext adapter

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
1. Go to [supabase.com](https://supabase.com) → New Project
2. Copy **Project URL** and **anon public** key
3. (Optional but recommended) Disable email confirmation for faster testing:  
   Authentication → Providers → Email → turn off “Confirm email”

### 2. Run the Database Schema
In Supabase Dashboard → **SQL Editor** → New query → paste the entire contents of:

```
supabase/schema.sql
```

Run it to create the initial tables. Then run the production-hardening migration:

```
supabase/migrations/20261108000100_harden_financial_ledger.sql
```

Run both scripts in order on a new, empty project. The hardening migration removes direct client writes to balances and ledger rows, restricts transaction creation to the shop owner, rejects overpayments, and adds audited compensating reversals. Do not expose the app to real users until the migration has been applied and the security tests have passed.

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
npm install
npm run dev
```

Open http://localhost:3000

---

## Deploy to Cloudflare Pages

### Option A – Official Next.js on Cloudflare (recommended)
1. Push this repo to GitHub
2. In Cloudflare Dashboard → Workers & Pages → Create → Connect to Git
3. Framework preset: **Next.js**
4. Build command: `npx @cloudflare/next-on-pages@1` (or use OpenNext)
5. Add environment variables:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
6. Deploy

**Simpler alternative for most users:**

Use **Vercel** (zero-config for Next.js):
```bash
npm i -g vercel
vercel
```
Add the same env vars in the Vercel dashboard.

Or stay on Cloudflare with the community adapter:
```bash
npm install -D @cloudflare/next-on-pages
npx @cloudflare/next-on-pages
```
Then deploy the `.vercel/output/static` folder (or follow current Cloudflare Next.js docs).

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
├── supabase/schema.sql         # Full Postgres schema + RLS + RPC
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
- Apply the production-hardening migration before accepting real users.
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
Ready to push to GitHub and connect your Supabase project.
