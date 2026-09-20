import { useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';

import { supabase } from '@/lib/supabase';

export type ProductKind = 'book' | 'stationery';
export type Product = {
  id: string; kind: ProductKind; title: string; author?: string; type?: string;
  price: number; description: string; availability: string; image: string;
  colors: string[]; badge?: string; details: string; featured: boolean; stock: number;
};

// One row of public.products, joined with its category slug (see supabase/schema.sql).
type ProductRow = {
  slug: string; title: string; author: string | null; product_type: string | null;
  description: string; details: string | null; price: number;
  stock_quantity: number; low_stock_threshold: number; image_url: string | null;
  variants: string[] | null; badge: string | null; is_featured: boolean;
  categories: { slug: string } | null;
};

const availabilityLabel = (stock: number, threshold: number) =>
  stock <= 0 ? 'Out of stock' : stock <= threshold ? `Only ${stock} left` : 'In stock';

// Turns a database row into the shape the storefront components already use.
// The product's slug is the storefront id, so /product/:id URLs and saved carts keep working.
function toProduct(row: ProductRow): Product | null {
  const kind = row.categories?.slug;
  if (kind !== 'book' && kind !== 'stationery') return null;
  return {
    id: row.slug,
    kind,
    title: row.title,
    author: row.author ?? undefined,
    type: row.product_type ?? undefined,
    price: row.price,
    description: row.description,
    availability: availabilityLabel(row.stock_quantity, row.low_stock_threshold),
    image: row.image_url ?? '',
    colors: row.variants ?? [],
    badge: row.badge ?? undefined,
    details: row.details ?? '',
    featured: row.is_featured,
    stock: row.stock_quantity,
  };
}

async function fetchCatalog(): Promise<Product[]> {
  const { data, error } = await supabase
    .from('products')
    .select('*, categories(slug)')
    .eq('is_active', true)
    .order('sort_order', { ascending: true });
  if (error) throw error;
  return (data as unknown as ProductRow[]).map(toProduct).filter((product): product is Product => product !== null);
}

const NO_PRODUCTS: Product[] = [];

// Every component that calls this shares one cached request (React Query, key ['catalog']).
export function useCatalog() {
  const query = useQuery({ queryKey: ['catalog'], queryFn: fetchCatalog });
  const products = query.data ?? NO_PRODUCTS;
  const findProduct = useCallback((id: string) => products.find((product) => product.id === id), [products]);
  return {
    products,
    findProduct,
    isLoading: !query.data && (query.isPending || query.isFetching),
    isError: !query.data && query.isError && !query.isFetching,
    isReady: query.isSuccess,
    refetch: query.refetch,
  };
}
