-- Nabi Books — Phase 10: guest checkout.
-- The browser cannot write to orders directly (no policies, no privileges). Instead it calls
-- place_order(), which checks everything on the server and writes the order in one step:
--   * prices, stock and the shipping fee always come from the database, never from the browser
--   * stock is locked while checking, so two visitors cannot both take the last copy
--   * a retried request (same p_request_id) returns the original order instead of a duplicate
-- Run this file ONCE in the Supabase SQL editor.

alter table public.orders add column if not exists client_request_id uuid unique;
alter table public.order_items add column if not exists line_number integer not null default 1;  -- keeps the lines in the order of the bag

create or replace function public.place_order(
  p_name text,
  p_phone text,
  p_email text,
  p_address text,
  p_wilaya text,
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
  v_email text := nullif(btrim(coalesce(p_email, '')), '');
  v_address text := btrim(coalesce(p_address, ''));
  v_wilaya text := btrim(coalesce(p_wilaya, ''));
  v_notes text := nullif(btrim(coalesce(p_notes, '')), '');
  v_slugs text[];
  v_problems jsonb;
  v_subtotal bigint;
  v_shipping integer;
  v_total integer;
  v_order_id uuid;
  v_order_number bigint;
  v_existing public.orders%rowtype;
begin
  -- ---- 1. the details
  if char_length(v_name) not between 2 and 80 then return jsonb_build_object('ok', false, 'error', 'invalid_input', 'field', 'name'); end if;
  if v_phone !~ '^(\+213|00213|0)[0-9]{8,9}$' then return jsonb_build_object('ok', false, 'error', 'invalid_input', 'field', 'phone'); end if;
  if v_email is not null and (char_length(v_email) > 120 or v_email !~ '^[^\s@]+@[^\s@]+\.[^\s@]+$') then return jsonb_build_object('ok', false, 'error', 'invalid_input', 'field', 'email'); end if;
  if char_length(v_address) not between 5 and 250 then return jsonb_build_object('ok', false, 'error', 'invalid_input', 'field', 'address'); end if;
  if char_length(v_wilaya) not between 2 and 60 then return jsonb_build_object('ok', false, 'error', 'invalid_input', 'field', 'wilaya'); end if;
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
    select * into v_existing from public.orders where client_request_id = p_request_id;
    if found then
      return jsonb_build_object(
        'ok', true, 'duplicate', true,
        'order_number', v_existing.order_number, 'subtotal', v_existing.subtotal,
        'shipping_fee', v_existing.shipping_fee, 'total', v_existing.total,
        'items', (select coalesce(jsonb_agg(jsonb_build_object('title', i.product_title_snapshot, 'variant', i.variant, 'quantity', i.quantity, 'unit_price', i.unit_price, 'line_total', i.line_total) order by i.line_number, i.id), '[]'::jsonb)
                  from public.order_items i where i.order_id = v_existing.id)
      );
    end if;
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
    insert into public.orders (customer_name, customer_phone, customer_email, delivery_address, wilaya, notes, subtotal, shipping_fee, total, client_request_id)
    values (v_name, v_phone, v_email, v_address, v_wilaya, v_notes, v_subtotal, v_shipping, v_total, p_request_id)
    returning id, order_number into v_order_id, v_order_number;
  exception when unique_violation then
    -- the same request arrived twice at the same moment; return the first one
    select * into v_existing from public.orders where client_request_id = p_request_id;
    return jsonb_build_object(
      'ok', true, 'duplicate', true,
      'order_number', v_existing.order_number, 'subtotal', v_existing.subtotal,
      'shipping_fee', v_existing.shipping_fee, 'total', v_existing.total,
      'items', (select coalesce(jsonb_agg(jsonb_build_object('title', i.product_title_snapshot, 'variant', i.variant, 'quantity', i.quantity, 'unit_price', i.unit_price, 'line_total', i.line_total) order by i.line_number, i.id), '[]'::jsonb)
                from public.order_items i where i.order_id = v_existing.id)
    );
  end;

  insert into public.order_items (order_id, product_id, product_title_snapshot, variant, quantity, unit_price, line_total, line_number)
  select v_order_id, p.id, p.title, nullif(btrim(e.line->>'variant'), ''), (e.line->>'quantity')::int, p.price, p.price * (e.line->>'quantity')::int, e.position::int
    from jsonb_array_elements(p_items) with ordinality as e(line, position)
    join public.products p on p.slug = e.line->>'slug' and p.is_active;

  update public.products p
     set stock_quantity = p.stock_quantity - t.qty
    from (select e->>'slug' as slug, sum((e->>'quantity')::int)::int as qty from jsonb_array_elements(p_items) e group by 1) t
   where p.slug = t.slug;

  return jsonb_build_object(
    'ok', true, 'duplicate', false,
    'order_number', v_order_number, 'subtotal', v_subtotal, 'shipping_fee', v_shipping, 'total', v_total,
    'items', (select coalesce(jsonb_agg(jsonb_build_object('title', i.product_title_snapshot, 'variant', i.variant, 'quantity', i.quantity, 'unit_price', i.unit_price, 'line_total', i.line_total) order by i.line_number, i.id), '[]'::jsonb)
              from public.order_items i where i.order_id = v_order_id)
  );
end;
$$;

-- Only the storefront may call it; nobody gets direct access to the order tables.
revoke all on function public.place_order(text, text, text, text, text, text, jsonb, integer, uuid) from public;
grant execute on function public.place_order(text, text, text, text, text, text, jsonb, integer, uuid) to anon, authenticated;
