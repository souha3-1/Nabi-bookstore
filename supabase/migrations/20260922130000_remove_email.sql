-- Nabi Books — clean-up after the checkout update (20260922120000_delivery_options.sql).
-- No email is collected any more, so the email column and the first version of place_order() can go.
-- Run this ONCE, but only AFTER the new site (with the wilaya and commune pickers) is live: until then the live
-- checkout still uses the first version of the function.

drop function if exists public.place_order(text, text, text, text, text, text, jsonb, integer, uuid);
alter table public.orders drop column if exists customer_email;
