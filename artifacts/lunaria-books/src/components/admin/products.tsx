import { type FormEvent, useEffect, useState } from 'react';
import { Link, useLocation, useParams } from 'wouter';
import { supabase } from '@/lib/supabase';

type Category = { id: string; name: string };
type Product = {
  id: string;
  slug: string;
  category_id: string;
  title: string;
  author: string | null;
  product_type: string | null;
  description: string;
  details: string | null;
  price: number;
  stock_quantity: number;
  low_stock_threshold: number;
  image_url: string | null;
  variants: string[];
  badge: string | null;
  is_featured: boolean;
  is_active: boolean;
  sort_order: number;
};

// ---------------------------------------------------------------- list page
type ArchiveFilter = 'active' | 'archived' | 'all';

export function AdminProductsList() {
  const [products, setProducts] = useState<Product[] | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [error, setError] = useState('');
  const [archiveFilter, setArchiveFilter] = useState<ArchiveFilter>('active');

  async function load() {
    const [p, c] = await Promise.all([
      supabase.from('products').select('*').order('sort_order'),
      supabase.from('categories').select('id, name'),
    ]);
    if (p.error) { setError(p.error.message); return; }
    setProducts(p.data ?? []);
    setCategories(c.data ?? []);
  }
  useEffect(() => { load(); }, []);

  async function toggleActive(product: Product) {
    const { error: err } = await supabase.from('products').update({ is_active: !product.is_active }).eq('id', product.id);
    if (err) { setError(err.message); return; }
    load();
  }

  const categoryName = (id: string) => categories.find((c) => c.id === id)?.name ?? '—';
  const visibleProducts = products?.filter((p) =>
    archiveFilter === 'all' ? true : archiveFilter === 'active' ? p.is_active : !p.is_active
  );

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-display text-3xl text-[#30263B]">Products</h1>
        <div className="flex items-center gap-3">
          <select value={archiveFilter} onChange={(e) => setArchiveFilter(e.target.value as ArchiveFilter)}
            className="border border-[#eadbd9] bg-white px-3 py-2 text-sm">
            <option value="active">Active</option>
            <option value="archived">Archived</option>
            <option value="all">All</option>
          </select>
          <Link href="/admin/products/new" className="bg-[#48458F] px-4 py-2 text-sm font-bold text-white">New product</Link>
        </div>
      </div>
      {error && <p role="alert" className="mt-4 text-sm text-[#B23A48]">{error}</p>}
      <div className="mt-6 divide-y divide-[#eadbd9] border border-[#eadbd9] bg-white">
        {products === null && <p className="p-4 text-sm text-[#746875]">Loading…</p>}
        {visibleProducts?.length === 0 && <p className="p-4 text-sm text-[#746875]">No products match this filter.</p>}
        {visibleProducts?.map((product) => (
          <div key={product.id} className="flex items-center justify-between gap-4 px-4 py-3 text-sm">
            <div className="min-w-0">
              <p className={`truncate font-semibold ${product.is_active ? 'text-[#30263B]' : 'text-[#a89ba8] line-through'}`}>{product.title}</p>
              <p className="text-xs text-[#746875]">{categoryName(product.category_id)} · {product.price} DZD · stock {product.stock_quantity}</p>
            </div>
            <div className="flex shrink-0 items-center gap-3">
              {!product.is_active && <span className="rounded-full bg-[#eadbd9] px-2 py-0.5 text-xs text-[#746875]">archived</span>}
              <Link href={`/admin/products/${product.id}`} className="text-[#48458F] hover:underline">Edit</Link>
              <button onClick={() => toggleActive(product)} className="text-[#746875] hover:text-[#B23A48]">
                {product.is_active ? 'Archive' : 'Restore'}
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- form page
const emptyProduct: Omit<Product, 'id'> = {
  slug: '', category_id: '', title: '', author: '', product_type: '', description: '', details: '',
  price: 0, stock_quantity: 0, low_stock_threshold: 5, image_url: '', variants: [], badge: '',
  is_featured: false, is_active: true, sort_order: 0,
};

export function AdminProductForm() {
  const params = useParams<{ id?: string }>();
  const isNew = !params.id;
  const [, navigate] = useLocation();
  const [categories, setCategories] = useState<Category[]>([]);
  const [form, setForm] = useState<Omit<Product, 'id'>>(emptyProduct);
  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    supabase.from('categories').select('id, name').then(({ data }) => setCategories(data ?? []));
    if (!isNew) {
      supabase.from('products').select('*').eq('id', params.id).single().then(({ data, error: err }) => {
        if (err) { setError(err.message); return; }
        if (data) setForm(data);
        setLoading(false);
      });
    }
  }, [isNew, params.id]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError('');
    const payload = { ...form, variants: form.variants.filter(Boolean) };
    const result = isNew
      ? await supabase.from('products').insert(payload)
      : await supabase.from('products').update(payload).eq('id', params.id);
    setSaving(false);
    if (result.error) { setError(result.error.message); return; }
    navigate('/admin/products');
  }

  if (loading) return <p className="text-sm text-[#746875]">Loading…</p>;

  const input = "mt-1 w-full border border-[#eadbd9] bg-white px-3 py-2 text-sm outline-none focus:border-[#48458F]";
  const label = "block text-xs font-bold uppercase tracking-[.1em] text-[#746875]";

  return (
    <div>
      <h1 className="font-display text-3xl text-[#30263B]">{isNew ? 'New product' : 'Edit product'}</h1>
      {error && <p role="alert" className="mt-4 text-sm text-[#B23A48]">{error}</p>}
      <form onSubmit={submit} className="mt-6 grid max-w-2xl gap-4">
        <label className={label}>Title
          <input required className={input} value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
        </label>
        <label className={label}>Slug (used in the storefront URL)
          <input required className={input} value={form.slug} onChange={(e) => setForm({ ...form, slug: e.target.value })} />
        </label>
        <label className={label}>Category
          <select required className={input} value={form.category_id} onChange={(e) => setForm({ ...form, category_id: e.target.value })}>
            <option value="">Select a category</option>
            {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </label>
        <label className={label}>Author (books only)
          <input className={input} value={form.author ?? ''} onChange={(e) => setForm({ ...form, author: e.target.value })} />
        </label>
        <label className={label}>Product type (stationery, e.g. "Writing set")
          <input className={input} value={form.product_type ?? ''} onChange={(e) => setForm({ ...form, product_type: e.target.value })} />
        </label>
        <label className={label}>Description
          <textarea required className={input} rows={3} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
        </label>
        <label className={label}>Details (e.g. "Paperback · Poetry · rupi kaur")
          <input className={input} value={form.details ?? ''} onChange={(e) => setForm({ ...form, details: e.target.value })} />
        </label>
        <div className="grid grid-cols-3 gap-4">
          <label className={label}>Price (DZD)
            <input required type="number" min={0} className={input} value={form.price} onChange={(e) => setForm({ ...form, price: Number(e.target.value) })} />
          </label>
          <label className={label}>Stock
            <input required type="number" min={0} className={input} value={form.stock_quantity} onChange={(e) => setForm({ ...form, stock_quantity: Number(e.target.value) })} />
          </label>
          <label className={label}>Low-stock threshold
            <input required type="number" min={0} className={input} value={form.low_stock_threshold} onChange={(e) => setForm({ ...form, low_stock_threshold: Number(e.target.value) })} />
          </label>
        </div>
        <label className={label}>Image
          {form.image_url && (
            <img src={form.image_url} alt="" className="mt-2 h-32 w-32 rounded border border-[#eadbd9] object-cover" />
          )}
          <input type="file" accept="image/*" className="mt-2 block text-sm" disabled={uploading}
            onChange={async (e) => {
              const file = e.target.files?.[0];
              if (!file) return;
              setUploading(true);
              setError('');
              const path = `${crypto.randomUUID()}-${file.name}`;
              const { error: uploadErr } = await supabase.storage.from('product-images').upload(path, file);
              setUploading(false);
              if (uploadErr) { setError(uploadErr.message); return; }
              const { data } = supabase.storage.from('product-images').getPublicUrl(path);
              setForm((f) => ({ ...f, image_url: data.publicUrl }));
            }} />
          {uploading && <p className="mt-1 text-xs text-[#746875]">Uploading…</p>}
          <input className={`${input} mt-2`} value={form.image_url ?? ''} onChange={(e) => setForm({ ...form, image_url: e.target.value })} placeholder="/assets/products/example.png or paste a URL" />
        </label>
        <label className={label}>Variants (comma-separated, e.g. "Black, Blue, Red")
          <input className={input} value={form.variants.join(', ')} onChange={(e) => setForm({ ...form, variants: e.target.value.split(',').map((v) => v.trim()) })} />
        </label>
        <label className={label}>Badge (e.g. "New", "Bestseller")
          <input className={input} value={form.badge ?? ''} onChange={(e) => setForm({ ...form, badge: e.target.value })} />
        </label>
        <div className="flex gap-6">
          <label className="flex items-center gap-2 text-sm text-[#30263B]">
            <input type="checkbox" checked={form.is_featured} onChange={(e) => setForm({ ...form, is_featured: e.target.checked })} /> Featured
          </label>
          <label className="flex items-center gap-2 text-sm text-[#30263B]">
            <input type="checkbox" checked={form.is_active} onChange={(e) => setForm({ ...form, is_active: e.target.checked })} /> Active (visible to customers)
          </label>
        </div>
        <div className="mt-4 flex gap-3">
          <button type="submit" disabled={saving} className="bg-[#48458F] px-5 py-2.5 text-sm font-bold text-white disabled:opacity-60">
            {saving ? 'Saving…' : 'Save'}
          </button>
          <Link href="/admin/products" className="px-5 py-2.5 text-sm text-[#746875]">Cancel</Link>
        </div>
      </form>
    </div>
  );
}
