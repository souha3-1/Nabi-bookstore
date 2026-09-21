-- Nabi Books — checkout update: wilaya + commune, and home delivery or stop desk.
-- Adds to the checkout from the first version (20260921120000_place_order.sql):
--   * orders now store the wilaya, the commune and the delivery method; a stop desk pickup needs no street address
--   * place_order() gets a new list of parameters (no email). The old version keeps working until
--     20260922130000_remove_email.sql removes it, so the live site is not interrupted while you deploy.
-- Everything the first version guaranteed still holds: prices, stock and shipping come from the database,
-- stock is locked while checking, and a retried request returns the original order.
-- Run this file ONCE in the Supabase SQL editor, after 20260921120000_place_order.sql.

alter table public.orders add column if not exists client_request_id uuid unique;
alter table public.orders add column if not exists wilaya_code smallint;
alter table public.orders add column if not exists commune text;
alter table public.orders add column if not exists delivery_method text not null default 'home';
alter table public.orders drop constraint if exists orders_delivery_method_check;
alter table public.orders add constraint orders_delivery_method_check check (delivery_method in ('home', 'stop_desk'));
alter table public.orders alter column delivery_address drop not null;   -- a stop desk pickup has no street address
alter table public.order_items add column if not exists line_number integer not null default 1;  -- keeps the lines in the order of the bag

-- Builds the answer for an order (used by place_order only; nobody can call it directly).
create or replace function public.order_summary(p_order_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'order_number', o.order_number, 'subtotal', o.subtotal, 'shipping_fee', o.shipping_fee, 'total', o.total,
    'delivery_method', o.delivery_method, 'wilaya', o.wilaya, 'commune', o.commune,
    'items', (select coalesce(jsonb_agg(jsonb_build_object('title', i.product_title_snapshot, 'variant', i.variant, 'quantity', i.quantity, 'unit_price', i.unit_price, 'line_total', i.line_total) order by i.line_number, i.id), '[]'::jsonb)
              from public.order_items i where i.order_id = o.id)
  )
  from public.orders o where o.id = p_order_id;
$$;
revoke all on function public.order_summary(uuid) from public, anon, authenticated;

create or replace function public.place_order(
  p_name text,
  p_phone text,
  p_wilaya_code integer,
  p_wilaya text,
  p_commune text,
  p_delivery_method text,
  p_address text,
  p_notes text,
  p_items jsonb,
  p_expected_total integer default null,
  p_request_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  -- the shipping rule; keep in step with src/lib/cart.ts in the storefront
  c_free_shipping_from constant integer := 6000;
  c_shipping_fee constant integer := 600;

  v_name text := btrim(coalesce(p_name, ''));
  v_phone text := regexp_replace(coalesce(p_phone, ''), '[\s.()-]', '', 'g');
  v_wilaya text := btrim(coalesce(p_wilaya, ''));
  v_commune text := btrim(coalesce(p_commune, ''));
  v_method text := coalesce(p_delivery_method, '');
  v_address text := btrim(coalesce(p_address, ''));
  v_notes text := nullif(btrim(coalesce(p_notes, '')), '');
  v_slugs text[];
  v_problems jsonb;
  v_subtotal bigint;
  v_shipping integer;
  v_total integer;
  v_order_id uuid;
  v_existing_id uuid;
begin
  -- ---- 1. the details
  if char_length(v_name) not between 2 and 80 then return jsonb_build_object('ok', false, 'error', 'invalid_input', 'field', 'name'); end if;
  if v_phone !~ '^(\+213|00213|0)[0-9]{8,9}$' then return jsonb_build_object('ok', false, 'error', 'invalid_input', 'field', 'phone'); end if;
  if p_wilaya_code is null or p_wilaya_code not between 1 and 69 or char_length(v_wilaya) not between 2 and 60 then return jsonb_build_object('ok', false, 'error', 'invalid_input', 'field', 'wilaya'); end if;
  if char_length(v_commune) not between 2 and 80 then return jsonb_build_object('ok', false, 'error', 'invalid_input', 'field', 'commune'); end if;
  if v_method not in ('home', 'stop_desk') then return jsonb_build_object('ok', false, 'error', 'invalid_input', 'field', 'delivery_method'); end if;
  if v_method = 'home' and char_length(v_address) not between 5 and 250 then return jsonb_build_object('ok', false, 'error', 'invalid_input', 'field', 'address'); end if;
  if v_method = 'stop_desk' then v_address := ''; end if;
  if v_notes is not null and char_length(v_notes) > 500 then return jsonb_build_object('ok', false, 'error', 'invalid_input', 'field', 'notes'); end if;

  -- ---- 2. the lines: a list of {slug, variant, quantity}
  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) not between 1 and 30 then
    return jsonb_build_object('ok', false, 'error', 'invalid_input', 'field', 'items');
  end if;
  if exists (
    select 1 from jsonb_array_elements(p_items) e
    where jsonb_typeof(e) <> 'object'
       or coalesce(e->>'slug', '') = ''
       or char_length(e->>'slug') > 80
       or jsonb_typeof(e->'quantity') <> 'number'
       or (e->>'quantity') !~ '^[1-9][0-9]{0,2}$'
       or (jsonb_typeof(e->'variant') is not null and jsonb_typeof(e->'variant') not in ('string', 'null'))
       or char_length(coalesce(e->>'variant', '')) > 60
  ) then
    return jsonb_build_object('ok', false, 'error', 'invalid_input', 'field', 'items');
  end if;

  -- ---- 3. a retry of an order that already went through returns that order
  if p_request_id is not null then
    select id into v_existing_id from public.orders where client_request_id = p_request_id;
    if found then return public.order_summary(v_existing_id) || jsonb_build_object('ok', true, 'duplicate', true); end if;
  end if;

  -- ---- 4. lock the products (always in the same order, so two orders cannot block each other) and check stock
  select array_agg(distinct e->>'slug') into v_slugs from jsonb_array_elements(p_items) e;
  perform 1 from public.products p where p.slug = any(v_slugs) order by p.id for update;

  select coalesce(jsonb_agg(jsonb_build_object(
           'slug', t.slug, 'title', coalesce(p.title, t.slug), 'requested', t.qty, 'available', greatest(coalesce(p.stock_quantity, 0), 0)
         ) order by t.slug), '[]'::jsonb)
    into v_problems
    from (select e->>'slug' as slug, sum((e->>'quantity')::int) as qty from jsonb_array_elements(p_items) e group by 1) t
    left join public.products p on p.slug = t.slug and p.is_active
   where p.id is null or t.qty > p.stock_quantity;
  if jsonb_array_length(v_problems) > 0 then
    return jsonb_build_object('ok', false, 'error', 'stock', 'items', v_problems);
  end if;

  -- ---- 5. the money, from the database prices
  select sum(p.price::bigint * (e->>'quantity')::int) into v_subtotal
    from jsonb_array_elements(p_items) e
    join public.products p on p.slug = e->>'slug' and p.is_active;
  if v_subtotal is null or v_subtotal > 100000000 then return jsonb_build_object('ok', false, 'error', 'invalid_input', 'field', 'items'); end if;
  v_shipping := case when v_subtotal >= c_free_shipping_from then 0 else c_shipping_fee end;
  v_total := v_subtotal + v_shipping;
  if p_expected_total is not null and p_expected_total <> v_total then
    return jsonb_build_object('ok', false, 'error', 'price_changed', 'subtotal', v_subtotal, 'shipping_fee', v_shipping, 'total', v_total);
  end if;

  -- ---- 6. write the order, its lines, and take the stock
  begin
    insert into public.orders (customer_name, customer_phone, wilaya_code, wilaya, commune, delivery_method, delivery_address, notes, subtotal, shipping_fee, total, client_request_id)
    values (v_name, v_phone, p_wilaya_code, v_wilaya, v_commune, v_method, nullif(v_address, ''), v_notes, v_subtotal, v_shipping, v_total, p_request_id)
    returning id into v_order_id;
  exception when unique_violation then
    -- the same request arrived twice at the same moment; return the first one
    select id into v_existing_id from public.orders where client_request_id = p_request_id;
    return public.order_summary(v_existing_id) || jsonb_build_object('ok', true, 'duplicate', true);
  end;

  insert into public.order_items (order_id, product_id, product_title_snapshot, variant, quantity, unit_price, line_total, line_number)
  select v_order_id, p.id, p.title, nullif(btrim(e.line->>'variant'), ''), (e.line->>'quantity')::int, p.price, p.price * (e.line->>'quantity')::int, e.position::int
    from jsonb_array_elements(p_items) with ordinality as e(line, position)
    join public.products p on p.slug = e.line->>'slug' and p.is_active;

  update public.products p
     set stock_quantity = p.stock_quantity - t.qty
    from (select e->>'slug' as slug, sum((e->>'quantity')::int)::int as qty from jsonb_array_elements(p_items) e group by 1) t
   where p.slug = t.slug;

  return public.order_summary(v_order_id) || jsonb_build_object('ok', true, 'duplicate', false);
end;
$$;

-- Only the storefront may call it; nobody gets direct access to the order tables.
revoke all on function public.place_order(text, text, integer, text, text, text, text, text, jsonb, integer, uuid) from public;
grant execute on function public.place_order(text, text, integer, text, text, text, text, text, jsonb, integer, uuid) to anon, authenticated;
