-- Removes the invented star ratings from products; the storefront no longer shows or sorts by them.
-- Run this once on the live database, AFTER the site version without ratings is deployed.
alter table public.products drop column if exists rating;
