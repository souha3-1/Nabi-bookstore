-- Nabi Books — Phase 15: product image storage.
-- No Storage bucket existed before this (existing images are static files bundled in the
-- frontend repo, referenced by the plain-text products.image_url column — unaffected by this).
-- This adds a bucket for images uploaded through the admin panel going forward: public read
-- (so the storefront can display them), admin-only write, using the same is_admin() helper
-- as the rest of Phase 15.
-- Run this file ONCE in the Supabase SQL editor.

insert into storage.buckets (id, name, public)
values ('product-images', 'product-images', true)
on conflict (id) do nothing;

create policy "Public can view product images"
  on storage.objects for select
  to anon, authenticated
  using (bucket_id = 'product-images');

create policy "Admins can upload product images"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'product-images' and public.is_admin());

create policy "Admins can update product images"
  on storage.objects for update
  to authenticated
  using (bucket_id = 'product-images' and public.is_admin())
  with check (bucket_id = 'product-images' and public.is_admin());

create policy "Admins can delete product images"
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'product-images' and public.is_admin());
