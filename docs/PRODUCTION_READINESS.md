# Production readiness and release gate

KhataLink handles personal and financial records. A successful frontend build is necessary but is not, by itself, production approval.

## Database deployment workflow

The ordered Supabase CLI migration chain is:

1. `supabase/migrations/20261108000000_initial_schema.sql`
2. `supabase/migrations/20261108000100_harden_financial_ledger.sql`

The initial migration is a versioned copy of `supabase/schema.sql`; keep the reference schema and migration aligned when the base schema changes. CI replays the versioned migrations in timestamp order against a disposable PostgreSQL 17 database.

For a remote project, the safe review command is `supabase db push --dry-run --remote` after explicitly linking the intended project. The corresponding `supabase db push --remote` applies migrations and must not be run against the connected project without explicit approval. Supabase documents timestamp-ordered migration replay and dry-run review for remote pushes. <https://supabase.com/docs/guides/deployment/database-migrations>

## Verified checkpoint

- GitHub Actions has passed TypeScript typechecking, ESLint, the Next.js production build, initial migration replay, hardening migration replay, ledger/RLS/idempotency/reversal smoke tests, and concurrent duplicate-submission verification on the current tested branch checkpoint.
- The anonymous shop-column test confirms public access to `id`, `name`, `category`, `address`, `latitude`, `longitude`, `upi_id`, and `description`, while denying `owner_id` and `is_active`.
- The connected Supabase project `wzsvvwhvbbbrxuaqdyue` was rechecked read-only: it remains healthy with zero application tables and zero recorded migrations.
- PR #1 remains open, draft, and unmerged. No production migration or deployment has been performed.

## Product decisions confirmed

- Anyone may self-register as a Shop Owner. Signup metadata accepts only `merchant` or `customer`; missing/invalid values default to `customer`.
- Public shop fields are name, category, address, map coordinates, UPI ID, and description. The public read grant is column-scoped; internal ownership and activation metadata are not exposed to anonymous users.
- Financial records and customer information remain restricted to the relevant merchant/customer participants.
- A UPI deep link initiates a payment only. The app must never mark a transfer settled based solely on returning from another app.

## Remaining release blockers

- **Dependency reproducibility:** no `package-lock.json` is committed; CI still uses `npm install`, not `npm ci`.
- **Dependency security:** dependency installation reports 9 npm vulnerabilities (7 moderate, 2 high). Exact advisories and transitive paths still need a reviewed audit; do not run a breaking blanket upgrade.
- **Account deletion and retention:** hard deletion can conflict with immutable ledger rows and foreign-key anchors. Use deactivation until a tested PII-anonymization/retention workflow is designed and reviewed.
- **Real Supabase Auth/JWT:** disposable PostgreSQL tests simulate `auth.uid()`; they do not replace testing with actual Supabase Auth sessions, email confirmation, refresh, role claims, and cross-account policies.
- **Storage:** no production storage bucket/policy verification has been completed. Keep private documents/assets private by default.
- **Operations:** backup/restore, monitoring, incident response, and recovery procedures are not yet verified.
- **Application acceptance:** exercise signup/confirmation, login/logout, password reset, shop creation, QR joining, credit/payment entry, reversals, refresh/expired sessions, slow network, and mobile accessibility with separate real test accounts.
- **Hosting:** a successful CI build does not prove a production host, domain, environment variables, redirects, or runtime integration are configured. Preview and production deployment remain unverified.

## Required cross-account tests

Use two merchants (M1, M2) and two customers (C1, C2), with separate shops and links.

- Anonymous users can discover active shops and read only approved public shop columns.
- Anonymous users cannot read `owner_id`, `is_active`, profiles, customer links, balances, transactions, or reversals.
- C1 can read only C1's profile, links, balances, and transactions; C1 cannot read C2's records.
- M1 can read only customers and transactions belonging to M1's shops; M1 cannot read M2's ledger.
- Customers cannot create shops, join on behalf of another user, join inactive shops, or change roles, ownership, credit limits, balances, link status, or ledger rows.
- Only the owning merchant can call `add_transaction` or `reverse_transaction`.
- Invalid transaction types, zero/negative values, fractional paise, excessive amounts, overpayments, blocked/paused credit, and cross-shop/customer IDs are rejected.
- Concurrent credits at the credit-limit boundary cannot exceed the limit.
- Repeating an identical request with the same idempotency key creates exactly one ledger row and one balance change; changed-payload reuse fails.
- A transaction cannot be reversed twice. Reversals append a compensating entry and preserve the original entry.
- Failed transactions leave both the ledger and cached balance unchanged.

## Functional acceptance tests

- Signup with email confirmation; confirm email; sign in; sign out; password reset.
- Merchant creates/edits a shop; QR code opens the correct join page.
- Customer joins once; duplicate joins show a useful message.
- Merchant records credit and verified payment; customer sees the updated passbook.
- Credit limit, blocked, and paused states behave correctly.
- UPI deep link contains the correct payee and amount; settlement is merchant-confirmed.
- Refresh, expired session, slow network, and API errors produce recoverable UI states.
- Mobile layout and keyboard/screen-reader basics are checked on real devices.

## Operational controls

- Keep schema changes as reviewed migrations; never edit the live database manually.
- Keep a tested rollback/forward-fix plan for every migration.
- Take and verify backups before storing real financial data.
- Monitor Supabase Auth, Postgres, and application errors; never log tokens, cookies, passwords, or full personal/financial records.
- Do not merge PR #1, apply live migrations, or promote a deployment until the owner explicitly approves.
