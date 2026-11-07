# Static SQL and application security review

Date: 2026-11-08
Branch: `chore/production-readiness`
Scope: source review only. No SQL was executed against the connected production Supabase project.

## Confirmed live-project state

The Supabase project `wzsvvwhvbbbrxuaqdyue` is healthy, but its `public` schema has no application tables and no recorded migrations. The repository schema and hardening migration have not been applied.

## Release blockers

### Critical: shop discovery exposes all shop columns

The hardening migration grants `SELECT` on every column in `public.shops` to `anon` and `authenticated`, and the `shops_public_active` policy makes every column of active shops readable. The join page currently uses `.select("*")`. This exposes address, latitude/longitude, UPI ID, and description to unauthenticated callers. Decide the public data contract and implement a safe public projection (for example, a restricted view/RPC or explicit column grants with a compatible client query) before release.

### High: merchant role is self-selected at signup

The signup page sends `role` in user-controlled Auth metadata and the database trigger accepts `merchant`. The RLS shop-insert policy trusts that profile role. This means anyone can create a merchant account. This is acceptable only if open merchant registration is an intentional product rule. If approval is required, derive merchant authorization from a server-controlled approval/invitation flow; never trust client metadata for privilege elevation.

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
- Merchant cannot read or mutate another merchant's customers or ledger.
- Anonymous shop discovery returns only approved public fields.
- Duplicate idempotency key with identical payload replays exactly once.
- Reuse of an idempotency key with a different payload fails.
- Concurrent credit/payment requests serialize and preserve the correct balance.
- Overpayment, blocked/paused customer credit, and credit-limit boundaries behave as intended.
- Reversal is single-use, audited, and correct after subsequent transactions.
- Account deletion/retention does not mutate or erase the immutable ledger.

## Environment and verification blockers

- No disposable database has been provisioned. Supabase development branches may incur additional usage charges, so none was created.
- No dependency lockfile is committed; CI still uses `npm install`, not reproducible `npm ci`.
- GitHub Actions has not produced a workflow run for the reviewed head; the Vercel check was pending at the last status check.
- No live migration, PR merge, or deployment has been performed.

## Safety rule

Do not apply the schema or migration to `wzsvvwhvbbbrxuaqdyue` until isolated replay tests, application tests, security tests, and explicit release approval are complete.
