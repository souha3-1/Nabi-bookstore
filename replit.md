# Nabi Novels & Stationery

An independent-bookstore storefront for Algeria: guest-only checkout, a Supabase-backed catalog, cart and wishlist, and an admin panel for managing products, categories and orders.

## Run & Operate

- `pnpm --filter @workspace/lunaria-books run dev` — run the storefront (Vite dev server)
- `pnpm run typecheck` — full typecheck across all workspace packages
- `pnpm run build` — typecheck + build all packages
- `supabase db push` — apply pending migrations (requires the Supabase CLI linked to the project)
- Required env (`artifacts/lunaria-books/.env.local`, and in Vercel): `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- Frontend: React 19 + Vite, `wouter` for routing, TanStack Query, Tailwind CSS
- Backend: Supabase — Postgres, Row Level Security, Auth, Storage, Edge Functions. No separate API server.
- Checkout: a single `place_order()` Postgres RPC (`SECURITY DEFINER`) does all pricing/stock validation server-side; the site has no customer accounts
- Admin auth: Supabase Auth, gated by an `admin_users` table + `is_admin()` RLS helper
- Order notifications: a Supabase Edge Function (`notify-new-order`) messages the shop owner on Telegram
- Hosting: Vercel (static build, SPA rewrites)

## Where things live

- `artifacts/lunaria-books` — the storefront and admin app; this is the only deployed frontend
- `supabase/schema.sql` — source of truth for the base DB schema (run once); `supabase/migrations/` holds every change since
- `supabase/functions/notify-new-order` — the order-notification Edge Function
- `lib/api-client-react`, `lib/api-zod`, `lib/api-spec` — legacy Orval-generated API client packages from an earlier Express/Drizzle backend; not used by the storefront, kept in the workspace but not part of the deployed app

## Architecture decisions

- Guest-only checkout: no customer accounts. Orders are written entirely server-side via `place_order()`, so prices, stock, and totals are never trusted from the browser.
- Admin access is an explicit allowlist (`admin_users`), not a role or claim — checked through a single `SECURITY DEFINER` helper (`is_admin()`) reused by every admin-gated policy.
- No traditional backend: the storefront talks to Supabase directly. The original Express + Drizzle `api-server` and its `lib/db` package were removed as unused legacy code (Phase 12).
- A product's `slug` is the identifier used in URLs, cart, and wishlist storage. It's auto-generated from the title on creation only, and is never regenerated when a product is edited, so existing links, carts, and wishlists don't break.

## Product

Nabi Novels & Stationery: an independent Algiers bookshop selling books, notebooks, and paper goods, with guest checkout (home delivery or stop-desk) across Algeria.

## User preferences

_Populate as you build — explicit user instructions worth remembering across sessions._

## Gotchas

- `pnpm run typecheck` runs a full workspace build (`tsc --build`) — if it fails on a package you didn't touch, check that package before assuming your own change broke it.
- `supabase/.temp/` is local Supabase CLI cache — never commit it.
- `lib/api-client-react`, `lib/api-zod`, `lib/api-spec` are legacy: confirm something still imports them before building anything new on top.

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
