-- Disposable PostgreSQL compatibility layer for Supabase SQL replay tests.
-- This file is used ONLY by the GitHub Actions PostgreSQL service.
create role anon nologin;
create role authenticated nologin;
create role service_role nologin bypassrls;

create schema auth;
create table auth.users (
  id uuid primary key,
  phone text,
  raw_user_meta_data jsonb not null default '{}'::jsonb
);

-- Mirrors Supabase's request-claim lookup for isolated SQL tests.
-- This does not verify JWT signatures; it only models PostgREST's trusted
-- request.jwt.claims session context after gateway token validation.
create or replace function auth.jwt()
returns jsonb
language sql
stable
as $function$
  select coalesce(
    nullif(current_setting('request.jwt.claims', true), '')::jsonb,
    '{}'::jsonb
  );
$function$;

create or replace function auth.uid()
returns uuid
language sql
stable
as $function$
  select coalesce(
    nullif(current_setting('request.jwt.claim.sub', true), '')::uuid,
    nullif(auth.jwt() ->> 'sub', '')::uuid
  );
$function$;

create or replace function auth.role()
returns text
language sql
stable
as $function$
  select coalesce(
    nullif(current_setting('request.jwt.claim.role', true), ''),
    nullif(auth.jwt() ->> 'role', '')
  );
$function$;

grant usage on schema public, auth to anon, authenticated, service_role;
grant execute on function auth.uid() to anon, authenticated, service_role;
grant select on auth.users to authenticated;

create publication supabase_realtime;
