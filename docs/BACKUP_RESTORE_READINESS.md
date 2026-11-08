# Backup and restore readiness

## Current data state

The connected hosted Supabase project has not received the application migrations and has no application tables or transaction records. No customer or merchant financial data should be stored there yet. The application currently has no Storage upload feature or Storage buckets.

The repository contains the schema migrations and isolated test fixtures; these are not a backup of hosted Auth users, project configuration, or future production data.

## Minimum release requirements

Before real financial records are accepted:

1. Decide and document a recovery point objective (maximum acceptable data loss) and recovery time objective (maximum acceptable outage).
2. Confirm which backup and point-in-time recovery capabilities are actually available on the chosen Supabase plan. Do not assume scheduled backups or point-in-time recovery are included in a free tier.
3. Configure an encrypted, access-controlled backup destination separate from the database project. Never put database URLs, passwords, JWT secrets, service-role keys, or backup files in Git or client-side environment variables.
4. Define the supported recovery process for the application database, Supabase Auth identities/configuration, and any future Storage objects separately. A PostgreSQL dump alone must not be represented as a complete Supabase project backup.
5. Run a restore into an isolated project/environment, not over the source project. Verify migrations, RLS policies, grants, Auth login, ledger balances, reversal audit records, and application connectivity.
6. Record the date, source, restore target, duration, validation results, and operator for every restore drill.
7. Re-run a restore drill after material schema, Auth, Storage, or hosting changes.

## Local CI restore smoke test

The database-migration-test CI job creates a custom-format pg_dump of its disposable PostgreSQL database, restores it into a second disposable database, and compares transaction/reversal/balance summaries. It also verifies that all six foreign-key delete restrictions survive the restore.

This test validates PostgreSQL dump/restore for the isolated schema and synthetic data only. It does not validate Supabase-managed backup behavior, Auth user recovery, hosted project configuration, encryption at rest, offsite retention, or Storage-object recovery.

## Operational backup handling

- Use a dedicated, least-privilege backup identity and short-lived credentials where supported.
- Encrypt backup files before transferring them to offsite storage; restrict access and log retrieval.
- Define retention periods and securely expire old backups.
- Keep schema migrations and release metadata in Git, but keep all database secrets and backup artifacts out of Git.
- Never restore a backup directly over the live project as a test.
- After recovery, verify financial ledger totals against the last known reconciliation record before allowing writes.

## Current release status

Backup/restore remains a release blocker until a real restore drill is completed using the chosen hosted Supabase plan and a documented recovery target. The local CI smoke test is useful evidence, but it is not a substitute for that operational exercise.
