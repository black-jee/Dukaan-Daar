-- Preserve financial history against privileged parent-row deletion.
-- The ledger is append-only, but the initial schema used ON DELETE CASCADE on
-- several parent foreign keys. Those cascades could erase ledger history when
-- an account or shop was deleted through a privileged path.
--
-- Account deletion is intentionally blocked until a reviewed PII-anonymization
-- and retention workflow is implemented. Shop deletion is blocked while any
-- customer link or transaction references it. Deactivation remains supported.

alter table public.profiles
  drop constraint if exists profiles_id_fkey,
  add constraint profiles_id_fkey
    foreign key (id) references auth.users(id) on delete restrict;

alter table public.shops
  drop constraint if exists shops_owner_id_fkey,
  add constraint shops_owner_id_fkey
    foreign key (owner_id) references public.profiles(id) on delete restrict;

alter table public.shop_customers
  drop constraint if exists shop_customers_shop_id_fkey,
  add constraint shop_customers_shop_id_fkey
    foreign key (shop_id) references public.shops(id) on delete restrict;

alter table public.shop_customers
  drop constraint if exists shop_customers_customer_id_fkey,
  add constraint shop_customers_customer_id_fkey
    foreign key (customer_id) references public.profiles(id) on delete restrict;

alter table public.transactions
  drop constraint if exists transactions_shop_id_fkey,
  add constraint transactions_shop_id_fkey
    foreign key (shop_id) references public.shops(id) on delete restrict;

alter table public.transactions
  drop constraint if exists transactions_customer_id_fkey,
  add constraint transactions_customer_id_fkey
    foreign key (customer_id) references public.profiles(id) on delete restrict;

comment on constraint profiles_id_fkey on public.profiles is
  'Restricts Auth user deletion until audited PII anonymization and retention workflow exists.';
comment on constraint shops_owner_id_fkey on public.shops is
  'Preserves shop ownership anchor; deactivate shops instead of deleting history.';
comment on constraint shop_customers_shop_id_fkey on public.shop_customers is
  'Prevents deleting a shop with linked customer/ledger history.';
comment on constraint shop_customers_customer_id_fkey on public.shop_customers is
  'Prevents deleting a customer profile referenced by shop links.';
comment on constraint transactions_shop_id_fkey on public.transactions is
  'Prevents shop deletion from cascading into immutable ledger history.';
comment on constraint transactions_customer_id_fkey on public.transactions is
  'Prevents customer deletion from cascading into immutable ledger history.';
