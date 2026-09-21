import type { Product } from '@/lib/catalog';

// Lower-cases and strips accents so "ecole" finds "École" (Latin accents and Arabic vowel marks are ignored).
export const normalize = (text: string) =>
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

// Where the visitor's words appear inside a text, as [start, end) positions in the ORIGINAL text
// (accents and capitals are ignored, exactly like the search itself). Overlapping matches are merged.
export function findMatches(text: string, query: string): [number, number][] {
  const words = normalize(query).split(/\s+/).filter(Boolean);
  if (words.length === 0) return [];
  let plain = '';
  const starts: number[] = [];
  const ends: number[] = [];
  let position = 0;
  for (const char of text) {
    const simple = normalize(char);
    if (simple.length === 0 && ends.length > 0) ends[ends.length - 1] = position + char.length; // a lone accent mark stays with its letter
    for (let i = 0; i < simple.length; i++) { starts.push(position); ends.push(position + char.length); }
    plain += simple;
    position += char.length;
  }
  const ranges: [number, number][] = [];
  for (const word of words) {
    for (let at = plain.indexOf(word); at !== -1; at = plain.indexOf(word, at + 1)) ranges.push([starts[at], ends[at + word.length - 1]]);
  }
  ranges.sort((a, b) => a[0] - b[0]);
  const merged: [number, number][] = [];
  for (const range of ranges) {
    const last = merged[merged.length - 1];
    if (last && range[0] <= last[1]) last[1] = Math.max(last[1], range[1]);
    else merged.push([range[0], range[1]]);
  }
  return merged;
}
