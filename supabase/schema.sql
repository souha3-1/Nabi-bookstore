-- Nabi Books — Phase 4: database schema
-- Guest-first shop: no customer accounts. Orders are created only by trusted
-- server-side code (a Supabase RPC or Edge Function, Phase 12), never directly
-- from the browser. Run this file ONCE in the Supabase SQL editor.

-- Keeps updated_at current on every UPDATE.
create function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ---------------------------------------------------------------- categories
create table public.categories (
  id          uuid primary key default gen_random_uuid(),
  slug        text not null unique,          -- 'book' | 'stationery' (same values as the frontend "kind")
  name        text not null,
  sort_order  integer not null default 0,
  created_at  timestamptz not null default now()
);

-- ------------------------------------------------------------------ products
create table public.products (
  id                   uuid primary key default gen_random_uuid(),
  slug                 text not null unique,  -- today's frontend ids, e.g. 'heaven' (used in /product/:id and in carts)
  category_id          uuid not null references public.categories (id),
  title                text not null,
  author               text,                  -- books
  product_type         text,                  -- stationery, e.g. 'Writing set'
  description          text not null default '',
  details              text,                  -- e.g. 'Paperback · Poetry · rupi kaur'
  price                integer not null check (price >= 0),          -- whole DZD (DA)
  rating               numeric(2,1) check (rating >= 0 and rating <= 5),
  stock_quantity       integer not null default 0 check (stock_quantity >= 0),
  low_stock_threshold  integer not null default 5 check (low_stock_threshold >= 0),
  image_url            text,
  variants             text[] not null default '{}',                 -- today's "colors"
  badge                text,
  is_featured          boolean not null default false,
  is_active            boolean not null default true,
  sort_order           integer not null default 0,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);

create index products_category_id_idx on public.products (category_id);
create index products_active_sort_idx on public.products (is_active, sort_order);

create trigger products_set_updated_at
  before update on public.products
  for each row execute function public.set_updated_at();

-- -------------------------------------------------------------------- orders
create table public.orders (
  id                uuid primary key default gen_random_uuid(),
  order_number      bigint generated always as identity (start with 1001) unique,
  customer_name     text not null,
  customer_phone    text not null,
  customer_email    text,
  delivery_address  text not null,
  wilaya            text not null,            -- city / wilaya
  notes             text,
  subtotal          integer not null check (subtotal >= 0),
  shipping_fee      integer not null default 0 check (shipping_fee >= 0),
  total             integer not null check (total >= 0),
  status            text not null default 'pending'
                    check (status in ('pending', 'confirmed', 'shipped', 'delivered', 'cancelled')),
  payment_method    text not null default 'cash_on_delivery',
  payment_status    text not null default 'pending'
                    check (payment_status in ('pending', 'paid', 'refunded')),
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  constraint orders_total_matches check (total = subtotal + shipping_fee)
);

create index orders_created_at_idx on public.orders (created_at desc);

create trigger orders_set_updated_at
  before update on public.orders
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------- order_items
create table public.order_items (
  id                      uuid primary key default gen_random_uuid(),
  order_id                uuid not null references public.orders (id) on delete cascade,
  product_id              uuid references public.products (id) on delete set null,
  product_title_snapshot  text not null,      -- history stays correct if the catalog changes
  variant                 text,
  quantity                integer not null check (quantity > 0),
  unit_price              integer not null check (unit_price >= 0),
  line_total              integer not null check (line_total >= 0),
  constraint order_items_line_total_matches check (line_total = unit_price * quantity)
);

create index order_items_order_id_idx on public.order_items (order_id);

-- ------------------------------------------------- security (RLS + privileges)
alter table public.categories  enable row level security;
alter table public.products    enable row level security;
alter table public.orders      enable row level security;
alter table public.order_items enable row level security;

-- Visitors may read the catalog, and only active products.
create policy "Anyone can read categories"
  on public.categories for select
  to anon, authenticated
  using (true);

create policy "Anyone can read active products"
  on public.products for select
  to anon, authenticated
  using (is_active);

-- orders and order_items get NO policies on purpose: the browser cannot read,
-- insert, update or delete them. Server-side code using the service role
-- bypasses RLS, which is how orders will be created safely later.

-- Belt and braces: also remove the table privileges themselves.
revoke all on public.categories, public.products, public.orders, public.order_items
  from anon, authenticated;
grant select on public.categories, public.products to anon, authenticated;
