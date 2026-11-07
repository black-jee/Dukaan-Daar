# Static SQL and application security review

Date: 2026-11-08
Branch: `chore/production-readiness`
Scope: source review only. No SQL was executed against the connected production Supabase project.

## Confirmed live-project state

The Supabase project `wzsvvwhvbbbrxuaqdyue` is healthy, but its `public` schema has no application tables and no recorded migrations. The repository schema and hardening migration have not been applied.

## Product decisions confirmed

- Merchant self-registration is intentionally open. The signup trigger accepts `merchant` metadata, constrains values to `merchant` or `customer`, and defaults invalid/missing values to `customer`. Client updates cannot modify the persisted role.
- Public discovery intentionally exposes shop name, category, address, latitude/longitude, UPI ID, and description. The current active-shop read policy and column grants match this decision. Financial records and customer data remain participant-scoped.

## Release blockers

### High: immutable ledger conflicts with cascading account/shop deletion

The base schema defines cascading foreign keys from profiles/shops to ledger-related rows, while the hardening migration blocks every transaction UPDATE/DELETE and reversal foreign keys use RESTRICT. Normal user/shop deletion can therefore fail partway through cascades. Until a tested retention/anonymization workflow exists, accounts and shops must be deactivated rather than hard-deleted; preserve ledger rows and their foreign-key anchors. Before real financial data is stored, design a controlled PII-anonymization process that preserves financial audit records and satisfies applicable retention obligations.

### Medium: signup role default needs a complete policy

Merchant self-registration is an explicit product decision. The trigger accepts `merchant` or `customer`, defaults missing/invalid metadata to `customer`, and the client has no grant to update the persisted role.

### Medium: SQL migration has not been replay-tested

The initial schema and hardening migration replayed successfully together in the disposable PostgreSQL 17 GitHub Actions service. Ledger/RLS/idempotency/reversal smoke tests and concurrent duplicate-submission verification passed. This isolated test does not replace final Supabase Auth/JWT, storage, backup/restore, or real-account acceptance testing; the live project remains untouched.

## Test cases required before release

- Fresh database: apply `supabase/schema.sql`, then the hardening migration in order.
- Auth signup with missing, invalid, customer, and merchant metadata.
- Customer cannot create shops or modify credit limits, balances, roles, or ledger rows.
- Open merchant registration is accepted, but customer-to-merchant privilege escalation is denied.
- Merchant cannot read or mutate another merchant's customers or ledger.
- Anonymous shop discovery returns only approved public fields.
- Duplicate idempotency key with identical payload replays exactly once.
- Reuse of an idempotency key with a different payload fails.
- Two concurrent duplicate submissions with the same idempotency key serialize and produce exactly one ledger row and one balance change. Broader concurrent credit-limit boundary testing remains required.
- Overpayment, blocked/paused customer credit, and credit-limit boundaries behave as intended.
- Reversal is single-use, audited, and correct after subsequent transactions.
- Account deletion/retention does not mutate or erase the immutable ledger.

## Environment and verification blockers

- A disposable PostgreSQL 17 service and Supabase Auth compatibility bootstrap run in GitHub Actions. The database job passed in runs #50 and #51; it uses an ephemeral CI container, not a Supabase development branch or the live project.
- No dependency lockfile is committed; CI still uses `npm install`, not reproducible `npm ci`.
- Application CI failed typechecking on run #50. A follow-up fix converts the generated database interface to a type alias to preserve relationship tuple types; verification is running on commit `47b428def60500ec874e0347e2036f701f398009`. Lint and build have not yet been confirmed on that commit.
- No live migration, PR merge, or deployment has been performed.

## Safety rule

Do not apply the schema or migration to `wzsvvwhvbbbrxuaqdyue` until isolated replay tests, application tests, security tests, and explicit release approval are complete.
