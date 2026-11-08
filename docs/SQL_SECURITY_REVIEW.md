# Static SQL and application security review

Date: 2026-11-08  
Branch: `chore/production-readiness`  
Scope: source review and disposable PostgreSQL CI replay. No SQL was executed against the connected Supabase project.

## Confirmed live-project state

The Supabase project `wzsvvwhvbbbrxuaqdyue` is healthy. Read-only checks confirm zero application tables and zero recorded migrations. The repository migrations have not been applied to the live project.

## Product decisions confirmed

- Merchant self-registration is intentionally open. The signup trigger accepts `merchant` or `customer` and defaults missing/invalid metadata to `customer`; authenticated clients cannot update their own role.
- Public discovery intentionally exposes shop name, category, address, latitude/longitude, UPI ID, and description.
- Public discovery is exposed through `public.public_shops`, a security-barrier view containing only approved fields. It is owned by the migration role so the view can read active shops without exposing the underlying RLS-protected table.
- `anon` has no direct SELECT privilege on `public.shops`. Authenticated users may SELECT the table, but the only direct SELECT policy is owner-scoped, so merchants can read their own shop rows and customers cannot read internal shop rows.
- Discovery, QR join, and customer passbook pages use `public_shops`; merchant management pages use the owner-scoped `shops` table.
- The customer-join RLS check queries the public active-shop view. Merchant/customer role checks use `private.current_profile_role()`, a stable SECURITY DEFINER helper with a fixed search path, to avoid recursive RLS evaluation. The private schema is not intended as a PostgREST-exposed schema.
- Financial records and customer information remain participant-scoped.

## Database migration chain and verification

- `20261108000000_initial_schema.sql` is the baseline migration.
- `20261108000100_harden_financial_ledger.sql` applies least-privilege grants, participant-scoped RLS, immutable transaction rows, append-only reversal audit, merchant-only transaction RPCs, idempotency, and balance/credit-limit enforcement.
- `supabase/schema.sql` is now a comment-only deprecated pointer and must not be executed; the timestamped migration chain is canonical.
- GitHub Actions replays the ordered migration files in a disposable PostgreSQL 17 service, then runs ledger/RLS/idempotency/reversal tests and concurrent duplicate-submission verification.
- The latest verified CI checkpoint passed migration replay, shop-view privacy tests, customer join, ledger tests, concurrent duplicate submission, `npm ci`, dependency audit gates, typecheck, lint, and production build.
- The npm audit report for the committed lockfile reports zero vulnerabilities across all dependencies and across production dependencies only.
- These tests are not a substitute for real Supabase Auth/JWT, Storage, backup/restore, or real-account acceptance testing.

## High-priority design constraint: ledger retention

The base schema uses cascading foreign keys from profiles/shops to ledger-related rows, while the hardening migration makes transactions immutable and reversal foreign keys restrictive. Hard deletion of Auth users or shops can therefore conflict with the ledger's audit requirements. Until a tested retention/anonymization workflow exists, deactivate accounts/shops and preserve ledger rows and their foreign-key anchors. Design and test controlled PII anonymization before real financial data is stored.

## Remaining security and release work

- Real Supabase Auth/JWT tests with multiple accounts remain required.
- Storage bucket/object policies remain unverified.
- Broader concurrent credit-limit boundary tests remain required.
- Account deletion, PII retention, backup/restore, operational monitoring, UPI settlement controls, and full frontend acceptance remain release blockers.
- Production host/domain, redirects, runtime configuration, and deployment remain unverified.

## Safety rule

Do not apply the migrations to `wzsvvwhvbbbrxuaqdyue` until isolated replay, application, security, and acceptance gates are complete and the owner explicitly approves the live change. Do not merge PR #1 or promote a deployment without that approval.
