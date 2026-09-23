import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';

export type LowStockProduct = {
  id: string;
  title: string;
  stock_quantity: number;
  low_stock_threshold: number;
};

// Shared by the dashboard's low-stock list and the sidebar badge, so both stay in sync
// off one query instead of duplicating the "stock_quantity <= low_stock_threshold" logic.
// Includes out-of-stock items too (stock_quantity = 0 is always <= threshold).
export function useLowStockProducts() {
  const [products, setProducts] = useState<LowStockProduct[] | null>(null);
  useEffect(() => {
    let cancelled = false;
    supabase.from('products').select('id, title, stock_quantity, low_stock_threshold').eq('is_active', true)
      .then(({ data }) => {
        if (cancelled) return;
        setProducts((data ?? []).filter((p) => p.stock_quantity <= p.low_stock_threshold));
      });
    return () => { cancelled = true; };
  }, []);
  return products;
}
