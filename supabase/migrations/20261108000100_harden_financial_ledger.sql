-- Production hardening for KhataLink.
-- Apply AFTER the initial schema.sql on a fresh project.
-- This migration intentionally removes direct client writes to financial state.
begin;

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

-- Normalize nullable prototype columns before enforcing production invariants.
update public.shop_customers
set credit_limit = coalesce(credit_limit, 500.00),
    current_balance = coalesce(current_balance, 0.00),
    status = coalesce(status, 'active')
where credit_limit is null or current_balance is null or status is null;

alter table public.shop_customers
  alter column credit_limit set default 500.00,
  alter column credit_limit set not null,
  alter column current_balance set default 0.00,
  alter column current_balance set not null,
  alter column status set default 'active',
  alter column status set not null,
  add constraint shop_customers_credit_limit_nonnegative check (credit_limit >= 0),
  add constraint shop_customers_balance_nonnegative check (current_balance >= 0);

create table if not exists public.transaction_reversals (
  id uuid primary key default gen_random_uuid(),
  original_transaction_id uuid not null unique references public.transactions(id) on delete restrict,
  reversal_transaction_id uuid not null unique references public.transactions(id) on delete restrict,
  reversed_by uuid not null references public.profiles(id) on delete restrict,
  reason text not null check (length(btrim(reason)) between 3 and 500),
  created_at timestamptz not null default now(),
  constraint transaction_reversals_distinct_transactions check (original_transaction_id <> reversal_transaction_id)
);

alter table public.transactions
  add column idempotency_key uuid,
  add constraint transactions_idempotency_key_key unique (idempotency_key);

create index if not exists idx_transactions_customer_created
  on public.transactions(customer_id, created_at desc);
create index if not exists idx_shop_customers_customer_shop
  on public.shop_customers(customer_id, shop_id);

create or replace function public.handle_updated_at()
returns trigger
language plpgsql
set search_path = pg_catalog
as $$
begin
  new.updated_at := pg_catalog.now();
  return new;
end;
$$;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  requested_role text;
begin
  requested_role := new.raw_user_meta_data ->> 'role';
  if requested_role not in ('merchant', 'customer') then
    requested_role := 'customer';
  end if;

  insert into public.profiles (id, full_name, phone, role)
  values (
    new.id,
    coalesce(nullif(btrim(new.raw_user_meta_data ->> 'full_name'), ''), nullif(btrim(new.raw_user_meta_data ->> 'name'), ''), 'User'),
    coalesce(new.phone, nullif(btrim(new.raw_user_meta_data ->> 'phone'), '')),
    requested_role
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

create or replace function private.prevent_transaction_mutation()
returns trigger
language plpgsql
set search_path = pg_catalog
as $$
begin
  raise exception 'Ledger entries are immutable; create a compensating reversal instead.'
    using errcode = '55000';
end;
$$;

drop trigger if exists transactions_immutable on public.transactions;
create trigger transactions_immutable
before update or delete on public.transactions
for each row execute function private.prevent_transaction_mutation();

-- Remove permissive policies from the initial prototype.
drop policy if exists "Users can view own profile" on public.profiles;
drop policy if exists "Users can update own profile" on public.profiles;
drop policy if exists "Merchants can view their customers profiles" on public.profiles;
drop policy if exists "Anyone can view active shops" on public.shops;
drop policy if exists "Owners can manage their shops" on public.shops;
drop policy if exists "Customers can view their own links" on public.shop_customers;
drop policy if exists "Merchants can manage their shop customers" on public.shop_customers;
drop policy if exists "Customers can join shops (insert)" on public.shop_customers;
drop policy if exists "Customers can view their own transactions" on public.transactions;
drop policy if exists "Merchants can view/manage transactions of their shops" on public.transactions;

alter table public.profiles enable row level security;
alter table public.shops enable row level security;
alter table public.shop_customers enable row level security;
alter table public.transactions enable row level security;
alter table public.transaction_reversals enable row level security;

-- Least-privilege grants: role and identity columns cannot be changed by clients.
revoke all on public.profiles from anon, authenticated;
grant select on public.profiles to authenticated;
grant update (full_name, phone, avatar_url) on public.profiles to authenticated;

revoke all on public.shops from anon, authenticated;
grant select on public.shops to anon, authenticated;
grant insert on public.shops to authenticated;
grant update (name, category, address, latitude, longitude, upi_id, description, is_active)
  on public.shops to authenticated;

revoke all on public.shop_customers from anon, authenticated;
grant select on public.shop_customers to authenticated;
grant insert (shop_id, customer_id) on public.shop_customers to authenticated;
grant update (credit_limit, status) on public.shop_customers to authenticated;

revoke all on public.transactions from anon, authenticated;
grant select on public.transactions to authenticated;

revoke all on public.transaction_reversals from anon, authenticated;
grant select on public.transaction_reversals to authenticated;

-- Profile visibility: own profile, or customers linked to a shop owned by this merchant.
create policy profiles_select_scoped
on public.profiles for select to authenticated
using (
  id = (select auth.uid())
  or exists (
    select 1
    from public.shop_customers sc
    join public.shops s on s.id = sc.shop_id
    where sc.customer_id = profiles.id
      and s.owner_id = (select auth.uid())
  )
);

create policy profiles_update_own
on public.profiles for update to authenticated
using (id = (select auth.uid()))
with check (id = (select auth.uid()));

-- Active shops are discoverable; owners can also see/manage their inactive shop.
create policy shops_public_active
on public.shops for select to anon, authenticated
using (is_active = true);

create policy shops_owner_select
on public.shops for select to authenticated
using (owner_id = (select auth.uid()));

create policy shops_owner_insert
on public.shops for insert to authenticated
with check (
  owner_id = (select auth.uid())
  and exists (
    select 1 from public.profiles p
    where p.id = (select auth.uid()) and p.role = 'merchant'
  )
);

create policy shops_owner_update
on public.shops for update to authenticated
using (
  owner_id = (select auth.uid())
  and exists (
    select 1 from public.profiles p
    where p.id = (select auth.uid()) and p.role = 'merchant'
  )
)
with check (
  owner_id = (select auth.uid())
  and exists (
    select 1 from public.profiles p
    where p.id = (select auth.uid()) and p.role = 'merchant'
  )
);

-- Customers can join active shops. Merchants can only change allowed link settings.
create policy shop_customers_participant_select
on public.shop_customers for select to authenticated
using (
  customer_id = (select auth.uid())
  or exists (
    select 1 from public.shops s
    where s.id = shop_customers.shop_id and s.owner_id = (select auth.uid())
  )
);

create policy shop_customers_customer_join
on public.shop_customers for insert to authenticated
with check (
  customer_id = (select auth.uid())
  and exists (
    select 1 from public.profiles p
    where p.id = (select auth.uid()) and p.role = 'customer'
  )
  and exists (
    select 1 from public.shops s
    where s.id = shop_customers.shop_id and s.is_active = true
  )
);

create policy shop_customers_merchant_update
on public.shop_customers for update to authenticated
using (
  exists (
    select 1 from public.shops s
    where s.id = shop_customers.shop_id and s.owner_id = (select auth.uid())
  )
)
with check (
  exists (
    select 1 from public.shops s
    where s.id = shop_customers.shop_id and s.owner_id = (select auth.uid())
  )
  and credit_limit >= 0
  and status in ('active', 'blocked', 'paused')
);

-- Ledger is readable only by the customer concerned and the shop owner.
create policy transactions_participant_select
on public.transactions for select to authenticated
using (
  customer_id = (select auth.uid())
  or exists (
    select 1 from public.shops s
    where s.id = transactions.shop_id and s.owner_id = (select auth.uid())
  )
);

create policy reversals_participant_select
on public.transaction_reversals for select to authenticated
using (
  reversed_by = (select auth.uid())
  or exists (
    select 1
    from public.transactions t
    join public.shops s on s.id = t.shop_id
    where t.id = transaction_reversals.original_transaction_id
      and s.owner_id = (select auth.uid())
  )
  or exists (
    select 1
    from public.transactions t
    where t.id = transaction_reversals.original_transaction_id
      and t.customer_id = (select auth.uid())
  )
);

-- Only a shop owner may record a credit or a payment. Customer-side UPI launches
-- are not proof of settlement; the merchant records payment after verification.
drop function if exists public.add_transaction(uuid, uuid, numeric, text, text);

create or replace function public.add_transaction(
  p_shop_id uuid,
  p_customer_id uuid,
  p_amount numeric,
  p_type text,
  p_idempotency_key uuid,
  p_note text default null
)
returns public.transactions
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_sc public.shop_customers%rowtype;
  v_owner_id uuid;
  v_new_balance numeric(12,2);
  v_tx public.transactions%rowtype;
  v_actor uuid := auth.uid();
begin
  if v_actor is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;
  if p_amount is null or p_amount <= 0 or p_amount > 9999999999.99
     or p_amount <> round(p_amount, 2) then
    raise exception 'Amount must be positive and have at most two decimal places'
      using errcode = '22023';
  end if;
  if p_type is null or p_type not in ('credit', 'payment') then
    raise exception 'Invalid transaction type' using errcode = '22023';
  end if;
  if p_idempotency_key is null then
    raise exception 'An idempotency key is required' using errcode = '22023';
  end if;
  if p_note is not null and length(p_note) > 500 then
    raise exception 'Note must be 500 characters or fewer' using errcode = '22023';
  end if;

  select s.owner_id into v_owner_id
  from public.shops s
  where s.id = p_shop_id and s.is_active = true
  for update;

  if v_owner_id is null then
    raise exception 'Active shop not found' using errcode = 'P0002';
  end if;
  if v_owner_id <> v_actor then
    raise exception 'Only the shop owner can record transactions' using errcode = '42501';
  end if;

  select * into v_sc
  from public.shop_customers sc
  where sc.shop_id = p_shop_id and sc.customer_id = p_customer_id
  for update;

  if not found then
    raise exception 'Customer is not linked to this shop' using errcode = 'P0002';
  end if;

  if p_type = 'credit' then
    if v_sc.status <> 'active' then
      raise exception 'Customer is not eligible for new credit' using errcode = '42501';
    end if;
    v_new_balance := v_sc.current_balance + p_amount;
    if v_new_balance > v_sc.credit_limit then
      raise exception 'Credit limit exceeded' using errcode = '23514';
    end if;
  else
    if p_amount > v_sc.current_balance then
      raise exception 'Payment exceeds outstanding balance' using errcode = '23514';
    end if;
    v_new_balance := v_sc.current_balance - p_amount;
  end if;

  insert into public.transactions (
    shop_id, customer_id, amount, type, note, running_balance, created_by, idempotency_key
  ) values (
    p_shop_id, p_customer_id, p_amount, p_type, nullif(btrim(p_note), ''),
    v_new_balance, v_actor, p_idempotency_key
  )
  on conflict (idempotency_key) do nothing
  returning * into v_tx;

  if not found then
    select * into v_tx
    from public.transactions t
    where t.idempotency_key = p_idempotency_key;

    if v_tx.shop_id <> p_shop_id
       or v_tx.customer_id <> p_customer_id
       or v_tx.amount <> p_amount
       or v_tx.type <> p_type
       or v_tx.note is distinct from nullif(btrim(p_note), '')
       or v_tx.created_by <> v_actor then
      raise exception 'Idempotency key was already used for a different request'
        using errcode = '23505';
    end if;

    return v_tx;
  end if;

  update public.shop_customers
  set current_balance = v_new_balance
  where id = v_sc.id;

  return v_tx;
end;
$$;

create or replace function public.reverse_transaction(
  p_transaction_id uuid,
  p_reason text
)
returns public.transactions
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_original public.transactions%rowtype;
  v_sc public.shop_customers%rowtype;
  v_owner_id uuid;
  v_reversal public.transactions%rowtype;
  v_new_balance numeric(12,2);
  v_actor uuid := auth.uid();
  v_reversal_type text;
begin
  if v_actor is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;
  if p_reason is null or length(btrim(p_reason)) < 3 or length(p_reason) > 500 then
    raise exception 'A reversal reason between 3 and 500 characters is required'
      using errcode = '22023';
  end if;

  select * into v_original
  from public.transactions t
  where t.id = p_transaction_id
  for update;

  if not found then
    raise exception 'Transaction not found' using errcode = 'P0002';
  end if;

  select s.owner_id into v_owner_id
  from public.shops s
  where s.id = v_original.shop_id;

  if v_owner_id is distinct from v_actor then
    raise exception 'Only the shop owner can reverse a transaction' using errcode = '42501';
  end if;

  if exists (
    select 1 from public.transaction_reversals r
    where r.original_transaction_id = p_transaction_id
  ) then
    raise exception 'Transaction has already been reversed' using errcode = '23505';
  end if;

  select * into v_sc
  from public.shop_customers sc
  where sc.shop_id = v_original.shop_id
    and sc.customer_id = v_original.customer_id
  for update;

  if not found then
    raise exception 'Customer link not found' using errcode = 'P0002';
  end if;

  if v_original.type = 'credit' then
    if v_sc.current_balance < v_original.amount then
      raise exception 'Cannot reverse this credit because subsequent payments have consumed the balance'
        using errcode = '23514';
    end if;
    v_new_balance := v_sc.current_balance - v_original.amount;
    v_reversal_type := 'payment';
  else
    v_new_balance := v_sc.current_balance + v_original.amount;
    if v_new_balance > v_sc.credit_limit then
      raise exception 'Reversal would exceed the current credit limit; adjust the limit first'
        using errcode = '23514';
    end if;
    v_reversal_type := 'credit';
  end if;

  insert into public.transactions (
    shop_id, customer_id, amount, type, note, running_balance, created_by
  ) values (
    v_original.shop_id, v_original.customer_id, v_original.amount,
    v_reversal_type, 'Reversal of ' || v_original.id::text || ': ' || btrim(p_reason),
    v_new_balance, v_actor
  ) returning * into v_reversal;

  insert into public.transaction_reversals (
    original_transaction_id, reversal_transaction_id, reversed_by, reason
  ) values (
    v_original.id, v_reversal.id, v_actor, btrim(p_reason)
  );

  update public.shop_customers
  set current_balance = v_new_balance
  where id = v_sc.id;

  return v_reversal;
end;
$$;

revoke all on function public.add_transaction(uuid, uuid, numeric, text, uuid, text) from public, anon;
grant execute on function public.add_transaction(uuid, uuid, numeric, text, uuid, text) to authenticated;
revoke all on function public.reverse_transaction(uuid, text) from public, anon;
grant execute on function public.reverse_transaction(uuid, text) to authenticated;

-- Trigger functions are callable only as triggers, not as public RPC endpoints.
revoke all on function public.handle_new_user() from public, anon, authenticated;
revoke all on function public.handle_updated_at() from public, anon, authenticated;
revoke all on function private.prevent_transaction_mutation() from public, anon, authenticated;

-- Add tables to Realtime publication only when not already present.
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'transactions'
    ) then
      alter publication supabase_realtime add table public.transactions;
    end if;
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'shop_customers'
    ) then
      alter publication supabase_realtime add table public.shop_customers;
    end if;
  end if;
end;
$$;

commit;
