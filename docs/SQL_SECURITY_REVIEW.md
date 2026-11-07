# Static SQL and application security review

Date: 2026-11-08  
Branch: `chore/production-readiness`  
Scope: source review and disposable PostgreSQL CI replay. No SQL was executed against the connected Supabase project.

## Confirmed live-project state

The Supabase project `wzsvvwhvbbbrxuaqdyue` is healthy. Read-only checks confirm zero application tables and zero recorded migrations. The repository migrations have not been applied to the live project.

## Product decisions confirmed

- Merchant self-registration is intentionally open. The signup trigger accepts `merchant` or `customer` and defaults missing/invalid metadata to `customer`; authenticated clients cannot update their own role.
- Public discovery intentionally exposes shop name, category, address, latitude/longitude, UPI ID, and description.
- Anonymous SELECT is column-scoped to `id`, `name`, `category`, `address`, `latitude`, `longitude`, `upi_id`, and `description`. The internal `owner_id` and `is_active` columns are not granted to `anon`. Authenticated users retain the table SELECT grant for owner/dashboard workflows.
- Financial records and customer information remain participant-scoped.

## Database migration chain and verification

- `20261108000000_initial_schema.sql` is the baseline migration, copied from `supabase/schema.sql`.
- `20261108000100_harden_financial_ledger.sql` applies least-privilege grants, participant-scoped RLS, immutable transaction rows, append-only reversal audit, merchant-only transaction RPCs, idempotency, and balance/credit-limit enforcement.
- GitHub Actions replays the ordered migration files in a disposable PostgreSQL 17 service, then runs ledger/RLS/idempotency/reversal tests and concurrent duplicate-submission verification.
- The current tested branch checkpoint passed the application typecheck, lint, production build, and database migration/security jobs.
- These tests are not a substitute for real Supabase Auth/JWT, Storage, backup/restore, or real-account acceptance testing.

## High-priority design constraint: ledger retention

The base schema uses cascading foreign keys from profiles/shops to ledger-related rows, while the hardening migration makes transactions immutable and reversal foreign keys restrictive. Hard deletion of Auth users or shops can therefore conflict with the ledger's audit requirements. Until a tested retention/anonymization workflow exists, deactivate accounts/shops and preserve ledger rows and their foreign-key anchors. Design and test controlled PII anonymization before real financial data is stored.

## Remaining security and release work

- Dependency installation reports 9 npm vulnerabilities (7 moderate, 2 high); detailed advisory paths and safe remediations remain to be reviewed.
- No `package-lock.json` is committed; CI uses `npm install` rather than reproducible `npm ci`.
- Real Supabase Auth/JWT tests with multiple accounts remain required.
- Storage bucket access and object policies remain unverified.
- Broader concurrent credit-limit boundary tests remain required.
- Account deletion, PII retention, backup/restore, operational monitoring, UPI settlement controls, and full frontend acceptance remain release blockers.
- Production host/domain, redirects, runtime configuration, and deployment remain unverified.

## Safety rule

Do not apply the migrations to `wzsvvwhvbbbrxuaqdyue` until isolated replay, application, security, and acceptance gates are complete and the owner explicitly approves the live change. Do not merge PR #1 or promote a deployment without that approval.
