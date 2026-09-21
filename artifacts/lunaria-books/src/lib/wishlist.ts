export const WISHLIST_KEY = 'nabi-books-wishlist';

// Turns anything found in storage into a clean list of product ids: text only, no empty ids, no repeats.
export function sanitizeWishlist(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.filter((id): id is string => typeof id === 'string' && id !== ''))];
}

// Reads a saved wishlist from its JSON text (nothing, or damaged text, gives an empty list).
export function parseSavedWishlist(json: string | null): string[] {
  if (!json) return [];
  try { return sanitizeWishlist(JSON.parse(json)); } catch { return []; }
}

export function readSavedWishlist(): string[] {
  try { return parseSavedWishlist(localStorage.getItem(WISHLIST_KEY)); } catch { return []; }
}
