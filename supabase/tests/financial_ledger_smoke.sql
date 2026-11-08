-- Integration smoke tests for the base schema + hardening migration.
-- Run as the postgres superuser in an isolated disposable database.
\set ON_ERROR_STOP on

-- Seed identities through auth.users so the real signup trigger is exercised.
insert into auth.users (id, raw_user_meta_data) values
  ('10000000-0000-4000-8000-000000000001', '{"full_name":"Merchant One","role":"merchant"}'),
  ('10000000-0000-4000-8000-000000000002', '{"full_name":"Merchant Two","role":"merchant"}'),
  ('20000000-0000-4000-8000-000000000001', '{"full_name":"Customer One"}'),
  ('20000000-0000-4000-8000-000000000002', '{"full_name":"Customer Two","role":"customer"}'),
  ('20000000-0000-4000-8000-000000000003', '{"full_name":"Invalid Role","role":"superadmin"}');

do $$
begin
  if (select role from public.profiles where id='20000000-0000-4000-8000-000000000001') <> 'customer' then
    raise exception 'Missing role did not default to customer';
  end if;
  if (select role from public.profiles where id='20000000-0000-4000-8000-000000000003') <> 'customer' then
    raise exception 'Invalid role did not default to customer';
  end if;
  if (select role from public.profiles where id='10000000-0000-4000-8000-000000000001') <> 'merchant' then
    raise exception 'Explicit merchant role was not accepted under open-registration policy';
  end if;
end;
$$;

insert into public.shops (id, owner_id, name, category, address, latitude, longitude, upi_id, description)
values
  ('30000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001','Merchant One Shop','Grocery','Public address',23.18,79.95,'merchant1@upi','Public description'),
  ('30000000-0000-4000-8000-000000000002','10000000-0000-4000-8000-000000000002','Merchant Two Shop','Tea','Other address',23.19,79.96,'merchant2@upi','Other description');

insert into public.shop_customers (shop_id, customer_id, credit_limit)
values
  ('30000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000001',100.00),
  ('30000000-0000-4000-8000-000000000002','20000000-0000-4000-8000-000000000002',100.00);

-- Anonymous visitors discover only the approved public-shop view.
set role anon;
do $test$
begin
  if (select count(*) from public.public_shops) <> 2 then
    raise exception 'Anonymous public shop discovery did not return both shops';
  end if;
  if has_table_privilege(current_user, 'public.shops', 'SELECT') then
    raise exception 'Anonymous users must not query the internal shops table';
  end if;
  if has_table_privilege(current_user, 'public.profiles', 'SELECT')
     or has_table_privilege(current_user, 'public.shop_customers', 'SELECT')
     or has_table_privilege(current_user, 'public.transactions', 'SELECT')
     or has_table_privilege(current_user, 'public.transaction_reversals', 'SELECT') then
    raise exception 'Anonymous users must not query private profile or financial tables';
  end if;
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'public_shops'
      and column_name in ('owner_id', 'is_active', 'created_at', 'updated_at')
  ) then
    raise exception 'Public shop view exposes internal metadata';
  end if;
  if (select upi_id from public.public_shops where id='30000000-0000-4000-8000-000000000001') <> 'merchant1@upi' then
    raise exception 'Public shop view omitted approved UPI field';
  end if;
end;
$test$;
reset role;

-- A customer can discover active shops but cannot read any row from the internal shops table.
set role authenticated;
select set_config('request.jwt.claim.sub','20000000-0000-4000-8000-000000000002',false);
do $test$
begin
  if (select count(*) from public.public_shops) <> 2 then
    raise exception 'Authenticated customer cannot discover public shops';
  end if;
  if (select count(*) from public.shops) <> 0 then
    raise exception 'Customer can read internal shop rows';
  end if;
  if (select count(*) from public.profiles where id='20000000-0000-4000-8000-000000000001') <> 0 then
    raise exception 'Customer can read another customer profile';
  end if;
  if (select count(*) from public.shop_customers where customer_id='20000000-0000-4000-8000-000000000001') <> 0 then
    raise exception 'Customer can read another customer link';
  end if;
  if (select count(*) from public.transactions) <> 0 then
    raise exception 'Customer can read another customer ledger';
  end if;
end;
$test$;
-- Joining remains possible because the RLS check uses the public active-shop view.
insert into public.shop_customers (shop_id, customer_id)
values ('30000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000002');
reset role;

-- Merchant one can record ledger entries; duplicate retries must not double-post.
set role authenticated;
select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000001',false);
select public.add_transaction(
  '30000000-0000-4000-8000-000000000001',
  '20000000-0000-4000-8000-000000000001',
  25.00,'credit','40000000-0000-4000-8000-000000000001','first credit'
);
select public.add_transaction(
  '30000000-0000-4000-8000-000000000001',
  '20000000-0000-4000-8000-000000000001',
  25.00,'credit','40000000-0000-4000-8000-000000000001','first credit'
);
do $$
begin
  if (select count(*) from public.transactions where idempotency_key='40000000-0000-4000-8000-000000000001') <> 1 then
    raise exception 'Idempotent retry created duplicate ledger rows';
  end if;
  if (select current_balance from public.shop_customers where shop_id='30000000-0000-4000-8000-000000000001' and customer_id='20000000-0000-4000-8000-000000000001') <> 25.00 then
    raise exception 'Balance after idempotent retry is incorrect';
  end if;
end;
$$;

select public.add_transaction(
  '30000000-0000-4000-8000-000000000001',
  '20000000-0000-4000-8000-000000000001',
  10.00,'credit','40000000-0000-4000-8000-000000000002','second credit'
);

-- A changed payload cannot reuse the same idempotency key.
do $$
begin
  begin
    perform public.add_transaction(
      '30000000-0000-4000-8000-000000000001',
      '20000000-0000-4000-8000-000000000001',
      26.00,'credit','40000000-0000-4000-8000-000000000001','first credit'
    );
    raise exception 'Reused idempotency key with changed payload unexpectedly succeeded';
  exception when unique_violation then
    null;
  end;
end;
$$;

-- Reverse the second credit and verify compensating balance.
select public.reverse_transaction(
  (select id from public.transactions where idempotency_key='40000000-0000-4000-8000-000000000002'),
  'entry entered in error'
);
do $$
begin
  if (select current_balance from public.shop_customers where shop_id='30000000-0000-4000-8000-000000000001' and customer_id='20000000-0000-4000-8000-000000000001') <> 25.00 then
    raise exception 'Reversal did not restore expected balance';
  end if;
  if (select count(*) from public.transaction_reversals) <> 1 then
    raise exception 'Reversal audit record missing';
  end if;
end;
$$;

-- Customer one sees only their own linked data and cannot write the ledger or change role.
select set_config('request.jwt.claim.sub','20000000-0000-4000-8000-000000000001',false);
do $$
begin
  if (select count(*) from public.shop_customers) <> 1 then
    raise exception 'Customer can see another customer link';
  end if;
  if (select count(*) from public.transactions) <> 3 then
    raise exception 'Customer should see only their own three ledger rows';
  end if;
  if has_column_privilege(current_user, 'public.profiles', 'role', 'UPDATE') then
    raise exception 'Authenticated client unexpectedly has profile role update privilege';
  end if;
  if has_table_privilege(current_user, 'public.transactions', 'INSERT') then
    raise exception 'Authenticated client unexpectedly has direct transaction insert privilege';
  end if;
end;
$$;
reset role;

-- Merchant two cannot see merchant one's customer links or transactions.
set role authenticated;
select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000002',false);
do $$
begin
  if (select count(*) from public.shop_customers) <> 1 then
    raise exception 'Merchant can see another merchant customer link';
  end if;
  if (select count(*) from public.transactions) <> 0 then
    raise exception 'Merchant can see another merchant ledger';
  end if;
end;
$$;
reset role;

-- Customer cannot call the merchant-only ledger RPC.
set role authenticated;
select set_config('request.jwt.claim.sub','20000000-0000-4000-8000-000000000002',false);
do $$
begin
  begin
    perform public.add_transaction(
      '30000000-0000-4000-8000-000000000002',
      '20000000-0000-4000-8000-000000000002',
      1.00,'credit','40000000-0000-4000-8000-000000000003','unauthorized'
    );
    raise exception 'Customer unexpectedly recorded a transaction';
  exception when insufficient_privilege then
    null;
  end;
end;
$$;
reset role;

-- Direct ledger UPDATE/DELETE are rejected by immutable trigger even for table owner.
do $$
begin
  begin
    update public.transactions set note='tampered' where idempotency_key='40000000-0000-4000-8000-000000000001';
    raise exception 'Ledger update unexpectedly succeeded';
  exception when sqlstate '55000' then
    null;
  end;
end;
$$;

select 'database integration smoke tests passed' as result;
