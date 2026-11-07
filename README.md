# KhataLink – Digital Khata & Micro-Credit Management

A fully functional dual-role (Merchant + Customer) web application for tracking micro-credit at local shops (tea stalls, kirana, paan shops, etc.).

**Stack:** Next.js 15 (App Router) + TypeScript + Tailwind CSS + Supabase (Auth, Postgres, Realtime, RLS)  
**Deploy target:** Cloudflare Pages (or Vercel / any Node host)

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

Run it. This creates tables, RLS policies, the `add_transaction` function, and enables Realtime.

### 3. Clone / Extract this repo
```bash
cd khatalink
cp .env.example .env.local
```

Edit `.env.local`:
```
NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOi...
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
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Yes | Anon / public key |
| `SUPABASE_SERVICE_ROLE_KEY` | No | Only if you later add admin scripts |

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

The schema already stores `phone` on profiles.

---

## Security Notes
- All data access is protected by Row Level Security.
- The `add_transaction` function runs as `SECURITY DEFINER` but still checks `auth.uid()`.
- Customers cannot see other customers’ balances or shop totals.
- Transactions are append-only (reversals are recorded, not deleted).

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
