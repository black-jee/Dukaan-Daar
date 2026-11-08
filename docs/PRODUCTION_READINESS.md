# Production readiness and release gate

KhataLink handles personal and financial records. A successful frontend build and isolated SQL suite are necessary, but are not, by themselves, production approval.

## Database deployment workflow

The ordered Supabase CLI migration chain is:

1. `supabase/migrations/20261108000000_initial_schema.sql`
2. `supabase/migrations/20261108000100_harden_financial_ledger.sql`
3. `supabase/migrations/20261108000200_prevent_financial_history_cascade_deletes.sql`

The initial migration is the versioned base schema. `supabase/schema.sql` is a deprecated, comment-only pointer; do not execute it. The timestamped migrations above are the only canonical database setup path. CI replays the timestamped migration chain against disposable PostgreSQL 17 and verifies a custom-format dump/restore into a second disposable database.

For a remote project, link only the intended project and inspect proposed changes with `supabase db push --dry-run --remote`. The corresponding `supabase db push --remote` applies migrations. Do not run it against the connected project without explicit approval.

## Latest verified checkpoint

- Commit `fc34b45a9e3455600f77088020c272f128a4741f` passed GitHub Actions run #165 (verified 2026-11-08): all three CI jobs succeeded, including full migration replay, financial ledger/RLS/idempotency/reversal/concurrency tests, privileged-delete safeguards, a disposable PostgreSQL dump/restore check, real local Supabase Auth/PostgREST with two merchants and two customers, dependency audits, TypeScript, lint, and production build.
- The npm audit report for the dependency tree used by this branch reported **zero vulnerabilities** in both the full dependency tree and production-only tree.
- A committed `package-lock.json` now makes installs reproducible; CI uses `npm ci`.
- Public discovery is served through `public.public_shops`, a security-barrier view containing only `id`, `name`, `category`, `address`, `latitude`, `longitude`, `upi_id`, and `description`. Anonymous users have no direct SELECT privilege on `public.shops`; authenticated direct table reads are restricted by RLS to the shop owner. CI additionally verifies anonymous denial on profiles, customer links, transactions and reversal records, plus cross-customer isolation. It also verifies that privileged Auth-user/profile/shop deletes are blocked when they could erase ledger history.
- Customer discovery and QR join pages use the restricted view. The customer join policy uses the same active-shop view and a private, fixed-search-path role helper to avoid recursive RLS evaluation.
- The connected Supabase project `wzsvvwhvbbbrxuaqdyue` was rechecked read-only: it remains healthy with zero application tables and zero recorded migrations. A read-only Storage inspection found zero buckets and zero Storage RLS policies. The repository has no implemented upload feature or Storage API usage; Storage is intentionally left unconfigured until a concrete upload requirement exists. See `docs/STORAGE_SECURITY_DESIGN.md` for future controls and isolated test requirements.
- The deprecated `supabase/schema.sql` file was converted to a comment-only pointer to prevent accidental use of the old prototype schema.
- PR #1 remains open, draft, and unmerged. No production migration or deployment has been performed.
- The latest verified run is [GitHub Actions #165](https://github.com/black-jee/Dukaan-Daar/actions/runs/42450668942); its three jobs completed successfully. Keep the branch on `chore/production-readiness`; do not merge PR #1 as part of preview preparation.

## Product and security decisions

- Anyone may self-register as a Shop Owner. Signup metadata accepts only `merchant` or `customer`; missing/invalid values default to `customer`.
- Public shop fields are name, category, address, map coordinates, UPI ID, and description. Internal owner and activation metadata are not exposed through the public view.
- Financial records and customer information remain restricted to the relevant merchant/customer participants.
- A UPI deep link initiates a payment only. The app must never mark a transfer settled based solely on returning from another app.
- Ledger corrections are compensating reversals; do not delete or mutate original transaction rows.

## Remaining release blockers

- **Real Supabase Auth/JWT:** the disposable PostgreSQL harness models Supabase's `request.jwt.claims` JSON payload and checks `sub`, `role`, and `aud` resolution through `auth.uid()`, `auth.role()`, and `auth.jwt()`; this alone does not verify signatures. A second CI job now starts a disposable local Supabase stack, applies the canonical migrations, and exercises GoTrue signup/session creation, profile triggers and role normalization, JWT-authenticated PostgREST RLS, public discovery, customer joining, merchant-only ledger RPC authorization, refresh, and logout. This is isolated local integration coverage, not a test against the connected hosted project. Real-account email deliverability and user-acceptance testing remain outstanding.
- **Storage:** no upload feature is currently implemented. Storage remains intentionally unconfigured; if uploads are added, private bucket/object RLS and isolated tests defined in `docs/STORAGE_SECURITY_DESIGN.md` are mandatory before release.
- **Account deletion and retention:** migration `20261108000200` now blocks Auth-user/profile/shop/customer deletion when it would affect linked records or ledger history. This is a safety stop, not a complete deletion workflow. Deactivate accounts/shops until a tested PII-anonymization, tombstone, and retention workflow exists.
- **Operations:** local CI now performs a custom-format PostgreSQL dump/restore smoke test against disposable databases and verifies ledger summaries plus delete restrictions survive restoration. This does not test Supabase-managed backups, Auth identity recovery, offsite encryption/retention, or a hosted restore drill. Complete the operational requirements in `docs/BACKUP_RESTORE_READINESS.md`, then verify monitoring, incident response, and recovery procedures before launch.
- **Application acceptance:** test signup/confirmation, login/logout, password reset, shop creation, QR joining, credit/payment entry, reversals, refresh/expired sessions, slow network, and mobile accessibility using separate real accounts.
- **Hosting:** the CI build does not verify production host configuration, domains, environment variables, Auth redirects, cookies, or runtime integration. Use a preview deployment first; production deployment remains unverified.
- **Financial operations:** UPI settlement must be merchant-confirmed; reconcile ledger correctness and retention rules before real money/records are used.

## Local Auth integration test

`supabase-auth-integration` in GitHub Actions starts a disposable local Supabase stack and applies the timestamped migrations. `scripts/test-supabase-auth.mjs` uses the local Auth and PostgREST APIs with actual issued access/refresh tokens; the test data and credentials exist only inside the ephemeral CI environment. The local email confirmation setting is disabled solely to allow automated signup/session tests without an email inbox.

This test does not connect to or mutate the hosted Supabase project `wzsvvwhvbbbrxuaqdyue`. Run #164 passed the local Supabase Auth/PostgREST integration with two merchants and two customers: GoTrue signup/session creation, profile triggers and role normalization, JWT-authenticated merchant/shop and customer/ledger isolation, public discovery, self-join enforcement, cross-merchant transaction denial, merchant-only ledger RPC authorization, refresh, and logout. This does not test hosted project accounts.

## Automated cross-account coverage and remaining acceptance

CI creates two independent merchant accounts (M1, M2) and two customer accounts (C1, C2), each with a separate shop and link, using real local GoTrue-issued JWTs. It verifies the core isolation rules below. Repeat the workflow with separate human-controlled accounts during pre-release acceptance.

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


## Preview deployment gate (reviewed 2026-11-08)

A Vercel preview is the preferred first hosting validation because this is a standard Next.js App Router application. However, a preview that exercises authentication and dashboard routes needs a reachable Supabase API whose schema matches the migrations.

The current app middleware calls Supabase Auth session validation for every matched request and throws when the public Supabase URL/key are missing. The connected hosted project currently has no application tables or migrations. Therefore:
- Do not deploy a preview configured against the empty hosted project and describe it as functional.
- Do not apply migrations to that hosted project merely to unblock preview. That is a separate, explicit database approval.
- A genuine end-to-end preview requires a separate disposable Supabase project/environment with the canonical migrations applied, or explicit approval to prepare the intended hosted project. Keep preview and production credentials separate.
- A static/build-only preview is not a substitute: login, signup, middleware session refresh, dashboard profile reads, shop discovery, QR joining, and ledger actions cannot be accepted without a live isolated backend.

### Hosting configuration checklist

For a Vercel preview connected to an isolated test backend:
1. Import `black-jee/Dukaan-Daar` and select branch `chore/production-readiness`; keep PR #1 draft and unmerged.
2. Use the Next.js framework preset and repository root. Do not add Cloudflare/OpenNext adapter settings to Vercel.
3. Set Preview-only variables: `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` for the isolated test project. The legacy `NEXT_PUBLIC_SUPABASE_ANON_KEY` is fallback-only. Never add a service-role/secret key to any `NEXT_PUBLIC_*` variable.
4. In that isolated Supabase Auth configuration, add the exact Vercel preview origin and callback URL(s) used by the app to allowed redirect URLs; set the site URL deliberately. Do not use a wildcard redirect that permits arbitrary origins.
5. Enable email confirmation for a production-like test and verify email delivery separately. The CI local stack disables confirmation only for automated integration tests.
6. Test signup, confirmation callback, login, refresh, logout, password recovery, protected-route redirects, merchant/customer separation, shop creation, QR join, transaction entry, and reversal on mobile and desktop.
7. Confirm no preview deployment variables are inherited by Production. Do not promote the preview to production.

### Current preview status

**Blocked pending an isolated hosted backend or explicit live-database approval.** The repository build and CI are green, but no browser-based end-to-end suite or hosted preview has been verified. This is a hosting/backend dependency, not a reason to weaken RLS or skip the database release gate.
