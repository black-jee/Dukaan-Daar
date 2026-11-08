-- Secure, one-time role selection for newly created Google OAuth accounts.
-- Existing Google users have no claim row, so login can never change their role.

begin;

create table if not exists private.google_signup_role_claims (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

revoke all on private.google_signup_role_claims from public, anon, authenticated;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $$
declare
  requested_role text;
begin
  requested_role := coalesce(new.raw_user_meta_data ->> 'role', 'customer');
  if requested_role not in ('merchant', 'customer') then
    requested_role := 'customer';
  end if;

  insert into public.profiles (id, full_name, phone, role)
  values (
    new.id,
    coalesce(
      nullif(btrim(new.raw_user_meta_data ->> 'full_name'), ''),
      nullif(btrim(new.raw_user_meta_data ->> 'name'), ''),
      'User'
    ),
    coalesce(new.phone, nullif(btrim(new.raw_user_meta_data ->> 'phone'), '')),
    requested_role
  )
  on conflict (id) do nothing;

  if new.raw_app_meta_data ->> 'provider' = 'google' then
    insert into private.google_signup_role_claims (user_id)
    values (new.id)
    on conflict (user_id) do nothing;
  end if;

  return new;
end;
$$;

create or replace function public.claim_google_signup_role(p_role text)
returns boolean
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $$
declare
  v_user_id uuid := auth.uid();
  v_provider text;
  v_claimed_user_id uuid;
begin
  if v_user_id is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  if p_role not in ('merchant', 'customer') then
    raise exception 'Invalid signup role' using errcode = '22023';
  end if;

  select u.raw_app_meta_data ->> 'provider'
    into v_provider
  from auth.users u
  where u.id = v_user_id;

  if v_provider is distinct from 'google' then
    return false;
  end if;

  delete from private.google_signup_role_claims c
  where c.user_id = v_user_id
  returning c.user_id into v_claimed_user_id;

  if v_claimed_user_id is null then
    return false;
  end if;

  update public.profiles
  set role = p_role
  where id = v_user_id;

  if not found then
    raise exception 'Profile not found for Google signup' using errcode = 'P0002';
  end if;

  return true;
end;
$$;

revoke all on function public.claim_google_signup_role(text) from public, anon;
grant execute on function public.claim_google_signup_role(text) to authenticated;

commit;
