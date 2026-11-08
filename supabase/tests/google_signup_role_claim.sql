-- Exercise the one-time Google signup role claim using the CI Auth shim.
-- Existing Google accounts without a pending claim must never be promoted.

do $$
declare
  v_new_google uuid := '91000000-0000-4000-8000-000000000001';
  v_existing_google uuid := '91000000-0000-4000-8000-000000000002';
  v_email_user uuid := '91000000-0000-4000-8000-000000000003';
  v_claimed boolean;
  v_role text;
begin
  insert into auth.users (id, raw_user_meta_data, raw_app_meta_data)
  values
    (v_new_google, '{"name":"New Google"}', '{"provider":"google"}'),
    (v_existing_google, '{"name":"Existing Google"}', '{"provider":"google"}'),
    (v_email_user, '{"name":"Email User"}', '{"provider":"email"}');

  -- A newly created Google user receives exactly one role claim.
  perform set_config('request.jwt.claim.sub', v_new_google::text, true);
  select public.claim_google_signup_role('merchant') into v_claimed;
  if v_claimed is distinct from true then
    raise exception 'New Google signup did not consume its role claim';
  end if;

  select role into v_role from public.profiles where id = v_new_google;
  if v_role is distinct from 'merchant' then
    raise exception 'New Google signup role was not applied';
  end if;

  -- The claim is one-time: a second call cannot change the role.
  select public.claim_google_signup_role('customer') into v_claimed;
  if v_claimed is distinct from false then
    raise exception 'Google signup role claim was reusable';
  end if;
  select role into v_role from public.profiles where id = v_new_google;
  if v_role is distinct from 'merchant' then
    raise exception 'A consumed Google signup role claim changed the role';
  end if;

  -- Simulate a previously existing Google user: no pending claim exists.
  delete from private.google_signup_role_claims where user_id = v_existing_google;
  perform set_config('request.jwt.claim.sub', v_existing_google::text, true);
  select public.claim_google_signup_role('merchant') into v_claimed;
  if v_claimed is distinct from false then
    raise exception 'Existing Google account unexpectedly had a role claim';
  end if;
  select role into v_role from public.profiles where id = v_existing_google;
  if v_role is distinct from 'customer' then
    raise exception 'Existing Google account role was changed';
  end if;

  -- Non-Google accounts cannot consume this OAuth-only mechanism.
  perform set_config('request.jwt.claim.sub', v_email_user::text, true);
  select public.claim_google_signup_role('merchant') into v_claimed;
  if v_claimed is distinct from false then
    raise exception 'Non-Google account unexpectedly claimed an OAuth role';
  end if;
  select role into v_role from public.profiles where id = v_email_user;
  if v_role is distinct from 'customer' then
    raise exception 'Non-Google account role was changed';
  end if;
end;
$$;

select 'Google signup role-claim tests passed' as result;
