# Static SQL and application security review

Date: 2026-11-08
Branch: `chore/production-readiness`
Scope: source review only. No SQL was executed against the connected production Supabase project.

## Confirmed live-project state

The Supabase project `wzsvvwhvbbbrxuaqdyue` is healthy, but its `public` schema has no application tables and no recorded migrations. The repository schema and hardening migration have not been applied.

## Product decisions confirmed

- Merchant self-registration is intentionally open. The signup trigger accepts `merchant` metadata and the shop-owner policies use that persisted role. This is an explicit product choice, not an outstanding approval blocker. Client metadata must still be constrained to the two allowed roles, and customers must not be able to update their own role.
- Public discovery intentionally exposes shop name, category, address, latitude/longitude, UPI ID, and description. The current active-shop read policy and column grants match this decision. Financial records and customer data remain participant-scoped.

## Release blockers

### High: immutable ledger conflicts with cascading account/shop deletion

The base schema defines cascading foreign keys from profiles/shops to ledger-related rows, while the hardening migration blocks every transaction UPDATE/DELETE and reversal foreign keys use RESTRICT. Normal user/shop deletion can therefore fail partway through cascades. Define an explicit retention and anonymization workflow before real financial records are stored; do not solve this by allowing ordinary clients to delete ledger rows.

### Medium: signup role default needs a complete policy

The hardening trigger now defaults missing/invalid metadata to `customer`, but it still accepts `merchant` from client metadata. See the merchant authorization blocker above.

### Medium: SQL migration has not been replay-tested

The initial schema and hardening migration have only been statically reviewed. They must be tested together against a disposable PostgreSQL/Supabase environment before any production execution. The live project must remain untouched during this test.

## Test cases required before release

- Fresh database: apply `supabase/schema.sql`, then the hardening migration in order.
- Auth signup with missing, invalid, customer, and merchant metadata.
- Customer cannot create shops or modify credit limits, balances, roles, or ledger rows.
- Open merchant registration is accepted, but customer-to-merchant privilege escalation is denied.
- Merchant cannot read or mutate another merchant's customers or ledger.
- Anonymous shop discovery returns only approved public fields.
- Duplicate idempotency key with identical payload replays exactly once.
- Reuse of an idempotency key with a different payload fails.
- Concurrent credit/payment requests serialize and preserve the correct balance (not yet covered by the first smoke-test batch; add a two-session concurrency test before release).
- Overpayment, blocked/paused customer credit, and credit-limit boundaries behave as intended.
- Reversal is single-use, audited, and correct after subsequent transactions.
- Account deletion/retention does not mutate or erase the immutable ledger.

## Environment and verification blockers

- A disposable PostgreSQL 17 service and Supabase Auth compatibility bootstrap have now been added to GitHub Actions. This uses an ephemeral CI container, not a Supabase development branch or the live project. The workflow result is pending; migration replay and smoke-test success are not yet verified.
- No dependency lockfile is committed; CI still uses `npm install`, not reproducible `npm ci`.
- GitHub Actions run #42 was created for commit `fe520e97af2a2518f18960e80d0f4b1c3860d1ac`; its status was pending at the last check. Vercel was also pending.
- No live migration, PR merge, or deployment has been performed.

## Safety rule

Do not apply the schema or migration to `wzsvvwhvbbbrxuaqdyue` until isolated replay tests, application tests, security tests, and explicit release approval are complete.
