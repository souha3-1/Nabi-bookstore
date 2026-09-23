-- Nabi Books — Phase 15: admin authorization.
-- Customers stay fully unauthenticated (unchanged). This adds a minimal admin layer:
-- an admin_users table (who is an admin), an is_admin() helper (same SECURITY DEFINER
-- pattern as place_order/order_summary), and RLS policies that gate admin-only reads
-- and writes on categories, products, orders and order_items.
-- Run this file ONCE in the Supabase SQL editor.

-- ----------------------------------------------------------------- admin_users
create table public.admin_users (
  user_id     uuid primary key references auth.users (id) on delete cascade,
  created_at  timestamptz not null default now()
);

alter table public.admin_users enable row level security;
-- No policies on purpose: nobody queries this table directly, only through
-- is_admin() below, which runs as the table owner and so bypasses RLS.
revoke all on public.admin_users from anon, authenticated;

insert into public.admin_users (user_id) values ('7a8a1cbb-12d6-40cb-9c74-7698c3b300b5');

-- ------------------------------------------------------------------- is_admin
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.admin_users where user_id = auth.uid());
$$;

revoke all on function public.is_admin() from public;
grant execute on function public.is_admin() to anon, authenticated;

-- ----------------------------------------------------------------- categories
grant insert, update, delete on public.categories to authenticated;

create policy "Admins can insert categories"
  on public.categories for insert
  to authenticated
  with check (public.is_admin());

create policy "Admins can update categories"
  on public.categories for update
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

create policy "Admins can delete categories"
  on public.categories for delete
  to authenticated
  using (public.is_admin());

-- -------------------------------------------------------------------- products
-- No delete policy: products are archived (is_active = false), never deleted,
-- since historical orders reference them.
grant insert, update on public.products to authenticated;

create policy "Admins can read all products"
  on public.products for select
  to authenticated
  using (public.is_admin());

create policy "Admins can insert products"
  on public.products for insert
  to authenticated
  with check (public.is_admin());

create policy "Admins can update products"
  on public.products for update
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- ---------------------------------------------------------------------- orders
grant select, update on public.orders to authenticated;
grant select on public.order_items to authenticated;

create policy "Admins can read all orders"
  on public.orders for select
  to authenticated
  using (public.is_admin());

create policy "Admins can update orders"
  on public.orders for update
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

create policy "Admins can read all order items"
  on public.order_items for select
  to authenticated
  using (public.is_admin());
