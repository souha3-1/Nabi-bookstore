import type { Product } from '@/lib/catalog';

// Lower-cases and strips accents so "ecole" finds "École" (Latin accents and Arabic vowel marks are ignored).
const normalize = (text: string) =>
  text.normalize('NFD').replace(/[\u0300-\u036f\u064b-\u065f\u0640]/g, '').toLowerCase();

// Every word the visitor typed must appear in the title, author or type (any order, any case).
// Products whose title matches come first; otherwise the catalog order is kept.
export function searchProducts(products: Product[], query: string): Product[] {
  const words = normalize(query).split(/\s+/).filter(Boolean);
  if (words.length === 0) return [];
  const matches = products.filter((product) => {
    const text = normalize(`${product.title} ${product.author ?? ''} ${product.type ?? ''}`);
    return words.every((word) => text.includes(word));
  });
  const inTitle = (product: Product) => {
    const title = normalize(product.title);
    return words.every((word) => title.includes(word));
  };
  return [...matches.filter(inTitle), ...matches.filter((product) => !inTitle(product))];
}
