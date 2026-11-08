# Preview environment configuration

The `feat/launch-quality-ux` branch uses the existing KhataLink Supabase project for preview verification.

Required Vercel Preview environment variables:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`

Both values are public client configuration. Never put a Supabase service-role key, database password, OAuth client secret, or SMTP credential in a `NEXT_PUBLIC_` variable.

After changing Preview environment variables, create a new Preview deployment so the build and runtime receive the updated configuration. Production environment variables and deployments must remain separate.

## Verification checklist

- Confirm the deployment commit matches the current branch head.
- Confirm the homepage and middleware return successfully.
- Confirm sign-in and sign-up use the configured Supabase project.
- Confirm customer balances and passbooks remain scoped to each shop.
- Do not record real financial transactions during preview testing.
