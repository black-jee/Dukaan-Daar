# Production readiness and release gate

This project handles financial records between merchants and customers. A successful frontend build alone is not a release approval.

## Current release sequence

1. Apply `supabase/schema.sql` to a new, empty Supabase project.
2. Apply `supabase/migrations/20261108000100_harden_financial_ledger.sql`.
3. Generate database types from the live project and compare them with `src/types/database.ts`.
4. Run Supabase Security Advisor and Performance Advisor; resolve every critical/high finding.
5. Configure Auth site URL and redirect allow-list for local, preview, and production origins. Keep email confirmation enabled for real users.
6. Configure publishable key and project URL in the hosting provider. Never put a secret/service-role key in a browser bundle or public environment variable.
7. Run the cross-account checks below against a disposable test project.
8. Deploy a preview, exercise every route and auth flow, then promote only the verified build.

## Required account-isolation tests

Use two merchant accounts (M1, M2) and two customer accounts (C1, C2). Create one shop per merchant and link customers independently.

- Anonymous visitors can discover active shops, but cannot read profiles, customer links, or ledger entries.
- C1 can read only C1's own profile, shop links, balances, and transactions.
- C1 cannot read C2's profile, balance, transaction history, or reversal records.
- M1 can read only customers and transactions belonging to M1's shops.
- M1 cannot read M2's customer records or ledger.
- A customer cannot insert a shop link for another user or join an inactive shop.
- A customer cannot change role, shop ownership, credit limit, balance, link status, or ledger rows.
- A merchant cannot directly insert, update, or delete ledger rows or write a balance.
- Only the owning merchant can call `add_transaction` or `reverse_transaction`.
- Invalid types, zero/negative values, fractional paise, excessive amounts, overpayments, blocked/paused credit, and cross-shop/customer IDs are rejected.
- Two concurrent credits at the credit limit serialize correctly and cannot exceed the limit.
- A transaction cannot be reversed twice. Reversals append a compensating entry; the original entry remains unchanged.
- Failed transactions leave both the ledger and cached balance unchanged.

## Functional acceptance tests

- Signup with email confirmation enabled; confirm email; sign in; sign out; password reset.
- Merchant creates/edits a shop; QR code opens the correct join page.
- Customer joins a shop once; duplicate joins show a useful message.
- Merchant records credit and verified payment; customer sees updated passbook.
- Credit limit, blocked and paused states behave correctly.
- UPI deep link opens with the correct payee and amount. The app must not mark a UPI transfer as paid automatically.
- Refresh, expired session, slow network, and API errors produce recoverable UI states.
- Mobile layout and keyboard/screen-reader basics are checked on real devices.

## Release blockers

- Supabase project access for the new project must be granted to the connected integration before live schema inspection or deployment verification.
- The hardening migration has been committed but has **not** been applied to the live database.
- CI has been added, but a passing GitHub Actions run must be observed before calling the branch green.
- No production host/domain or deployment environment has been configured or verified yet.
- Backup/restore and Auth email delivery must be checked in the actual Supabase plan and project settings before launch.

## Operational controls

- Keep schema changes as reviewed migrations; never edit live production tables manually without a tracked migration.
- Keep a tested rollback/forward-fix plan for every migration.
- Take and verify backups before the first real financial data is stored.
- Monitor Supabase Auth, Postgres, and application errors; do not log tokens, cookies, passwords, or full personal/financial records.
- Treat UPI deep links as payment initiation only. Settlement is confirmed by the merchant, not by the redirect.
