# Production readiness and release gate

KhataLink handles personal and financial records. A successful frontend build and isolated SQL suite are necessary, but are not, by themselves, production approval.

## Database deployment workflow

The ordered Supabase CLI migration chain is:

1. `supabase/migrations/20261108000000_initial_schema.sql`
2. `supabase/migrations/20261108000100_harden_financial_ledger.sql`

The initial migration is the versioned base schema. `supabase/schema.sql` is a deprecated, comment-only pointer; do not execute it. The timestamped migrations above are the only canonical database setup path. CI replays the timestamped migration chain against disposable PostgreSQL 17.

For a remote project, link only the intended project and inspect proposed changes with `supabase db push --dry-run --remote`. The corresponding `supabase db push --remote` applies migrations. Do not run it against the connected project without explicit approval.

## Latest verified checkpoint

- Commit `3674583c6aac20512094a9410284d98622ba2e95` passed GitHub Actions: `npm ci`, full and production-only npm audit gates, TypeScript, ESLint, Next.js production build, baseline migration replay, hardening migration replay, RLS/ledger/idempotency/reversal smoke tests, and concurrent duplicate-submission verification.
- The npm audit report for the dependency tree used by this branch reported **zero vulnerabilities** in both the full dependency tree and production-only tree.
- A committed `package-lock.json` now makes installs reproducible; CI uses `npm ci`.
- Public discovery is served through `public.public_shops`, a security-barrier view containing only `id`, `name`, `category`, `address`, `latitude`, `longitude`, `upi_id`, and `description`. Anonymous users have no direct SELECT privilege on `public.shops`; authenticated direct table reads are restricted by RLS to the shop owner.
- Customer discovery and QR join pages use the restricted view. The customer join policy uses the same active-shop view and a private, fixed-search-path role helper to avoid recursive RLS evaluation.
- The connected Supabase project `wzsvvwhvbbbrxuaqdyue` was rechecked read-only: it remains healthy with zero application tables and zero recorded migrations.
- The deprecated `supabase/schema.sql` file was converted to a comment-only pointer to prevent accidental use of the old prototype schema.
- PR #1 remains open, draft, and unmerged. No production migration or deployment has been performed.

## Product and security decisions

- Anyone may self-register as a Shop Owner. Signup metadata accepts only `merchant` or `customer`; missing/invalid values default to `customer`.
- Public shop fields are name, category, address, map coordinates, UPI ID, and description. Internal owner and activation metadata are not exposed through the public view.
- Financial records and customer information remain restricted to the relevant merchant/customer participants.
- A UPI deep link initiates a payment only. The app must never mark a transfer settled based solely on returning from another app.
- Ledger corrections are compensating reversals; do not delete or mutate original transaction rows.

## Remaining release blockers

- **Real Supabase Auth/JWT:** disposable PostgreSQL tests simulate `auth.uid()`; they do not replace real Supabase Auth sessions, email confirmation, refresh, role claims, and cross-account testing.
- **Storage:** production storage bucket/object access policies have not been verified.
- **Account deletion and retention:** hard deletion conflicts with immutable ledger rows and foreign-key anchors. Deactivate accounts/shops until a tested PII-anonymization and retention workflow exists.
- **Operations:** backup/restore, monitoring, incident response, and recovery procedures are not yet verified.
- **Application acceptance:** test signup/confirmation, login/logout, password reset, shop creation, QR joining, credit/payment entry, reversals, refresh/expired sessions, slow network, and mobile accessibility using separate real accounts.
- **Hosting:** the CI build does not verify production host configuration, domains, environment variables, Auth redirects, cookies, or runtime integration. Use a preview deployment first; production deployment remains unverified.
- **Financial operations:** UPI settlement must be merchant-confirmed; reconcile ledger correctness and retention rules before real money/records are used.

## Required cross-account tests

Use two merchants (M1, M2) and two customers (C1, C2), with separate shops and links.

- Anonymous users can discover active shops through `public_shops` and read only approved public columns.
- Anonymous users cannot query `shops`, profiles, customer links, balances, transactions, or reversals.
- Customers can discover active shops but cannot read internal shop rows or other customers' financial records.
- A merchant can query only their own shop rows and only customers/transactions belonging to their shops.
- Customers cannot create shops, join on behalf of another user, join inactive shops, or change roles, ownership, credit limits, balances, link status, or ledger rows.
- Only the owning merchant can call `add_transaction` or `reverse_transaction`.
- Invalid transaction types, zero/negative values, fractional paise, excessive amounts, overpayments, blocked/paused credit, and cross-shop/customer IDs are rejected.
- Concurrent credits at the credit-limit boundary cannot exceed the limit.
- Repeating an identical request with the same idempotency key creates exactly one ledger row and one balance change; changed-payload reuse fails.
- A transaction cannot be reversed twice. Reversals append a compensating entry and preserve the original entry.
- Failed transactions leave both the ledger and cached balance unchanged.

## Operational controls

- Keep schema changes as reviewed migrations; never edit the live database manually.
- Keep a tested rollback/forward-fix plan for every migration.
- Take and verify backups before storing real financial data.
- Monitor Supabase Auth, Postgres, and application errors; never log tokens, cookies, passwords, or full personal/financial records.
- Do not merge PR #1, apply live migrations, or promote a deployment until the owner explicitly approves.
