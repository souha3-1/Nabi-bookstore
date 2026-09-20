import type { Product } from '@/lib/catalog';

export type CartItem = { id: string; quantity: number; variant?: string };

export const CART_KEY = 'nabi-books-cart';

// Only a sanity limit for damaged data; the real limit for each product is its stock.
const MAX_SAVED_QUANTITY = 999;

// Shipping rule shown in the bag. The order function on the server (Phase 12) must use the same numbers.
export const FREE_SHIPPING_FROM = 6000;
export const SHIPPING_FEE = 600;
export const shippingFor = (subtotal: number) => (subtotal === 0 || subtotal >= FREE_SHIPPING_FROM ? 0 : SHIPPING_FEE);

// Turns anything found in storage into a clean bag: valid lines only, whole quantities of at least 1,
// and one line per product and variant.
export function sanitizeCart(value: unknown): CartItem[] {
  if (!Array.isArray(value)) return [];
  const lines = new Map<string, CartItem>();
  for (const raw of value) {
    if (typeof raw !== 'object' || raw === null) continue;
    const { id, quantity, variant } = raw as Record<string, unknown>;
    if (typeof id !== 'string' || id === '') continue;
    if (typeof quantity !== 'number' || !Number.isInteger(quantity) || quantity < 1) continue;
    const label = typeof variant === 'string' && variant !== '' ? variant : 'Default';
    const key = `${id}\u0000${label}`;
    const total = Math.min(MAX_SAVED_QUANTITY, (lines.get(key)?.quantity ?? 0) + quantity);
    lines.set(key, { id, quantity: total, variant: label });
  }
  return [...lines.values()];
}

// Reads a saved bag from its JSON text (nothing, or damaged text, gives an empty bag).
export function parseSavedCart(json: string | null): CartItem[] {
  if (!json) return [];
  try { return sanitizeCart(JSON.parse(json)); } catch { return []; }
}

export function readSavedCart(): CartItem[] {
  try { return parseSavedCart(localStorage.getItem(CART_KEY)); } catch { return []; }
}

// Saving can fail (private browsing, full storage); the bag then simply lives in memory until the tab closes.
export function saveToStorage(key: string, value: unknown) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* ignore */ }
}

// Keeps only products that still exist and never more of a product than is in stock (its stock is shared by all variants).
export function fitCartToStock(cart: CartItem[], find: (id: string) => Product | undefined): CartItem[] {
  const left = new Map<string, number>();
  const fitted: CartItem[] = [];
  for (const item of cart) {
    const product = find(item.id);
    if (!product) continue;
    const room = left.get(item.id) ?? product.stock;
    const quantity = Math.min(item.quantity, room);
    left.set(item.id, room - quantity);
    if (quantity > 0) fitted.push(quantity === item.quantity ? item : { ...item, quantity });
  }
  return fitted.length === cart.length && fitted.every((line, index) => line === cart[index]) ? cart : fitted;
}
