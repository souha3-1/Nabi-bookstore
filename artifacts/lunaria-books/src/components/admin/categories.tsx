import { type FormEvent, useEffect, useState } from 'react';
import { Link, useLocation, useParams } from 'wouter';
import { supabase } from '@/lib/supabase';

type Category = { id: string; slug: string; name: string; sort_order: number };

export function AdminCategoriesList() {
  const [categories, setCategories] = useState<Category[] | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    supabase.from('categories').select('*').order('sort_order').then(({ data, error: err }) => {
      if (err) { setError(err.message); return; }
      setCategories(data ?? []);
    });
  }, []);

  return (
    <div>
      <div className="flex items-center justify-between">
        <h1 className="font-display text-3xl text-[#30263B]">Categories</h1>
        <Link href="/admin/categories/new" className="bg-[#48458F] px-4 py-2 text-sm font-bold text-white">New category</Link>
      </div>
      {error && <p role="alert" className="mt-4 text-sm text-[#B23A48]">{error}</p>}
      <div className="mt-6 divide-y divide-[#eadbd9] border border-[#eadbd9] bg-white">
        {categories === null && <p className="p-4 text-sm text-[#746875]">Loading…</p>}
        {categories?.map((category) => (
          <div key={category.id} className="flex items-center justify-between px-4 py-3 text-sm">
            <div>
              <p className="font-semibold text-[#30263B]">{category.name}</p>
              <p className="text-xs text-[#746875]">/{category.slug} · order {category.sort_order}</p>
            </div>
            <Link href={`/admin/categories/${category.id}`} className="text-[#48458F] hover:underline">Edit</Link>
          </div>
        ))}
      </div>
    </div>
  );
}

export function AdminCategoryForm() {
  const params = useParams<{ id?: string }>();
  const isNew = !params.id;
  const [, navigate] = useLocation();
  const [form, setForm] = useState<Omit<Category, 'id'>>({ slug: '', name: '', sort_order: 0 });
  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!isNew) {
      supabase.from('categories').select('*').eq('id', params.id).single().then(({ data, error: err }) => {
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
    const result = isNew
      ? await supabase.from('categories').insert(form)
      : await supabase.from('categories').update(form).eq('id', params.id);
    setSaving(false);
    if (result.error) { setError(result.error.message); return; }
    navigate('/admin/categories');
  }

  if (loading) return <p className="text-sm text-[#746875]">Loading…</p>;

  const input = "mt-1 w-full border border-[#eadbd9] bg-white px-3 py-2 text-sm outline-none focus:border-[#48458F]";
  const label = "block text-xs font-bold uppercase tracking-[.1em] text-[#746875]";

  return (
    <div>
      <h1 className="font-display text-3xl text-[#30263B]">{isNew ? 'New category' : 'Edit category'}</h1>
      {error && <p role="alert" className="mt-4 text-sm text-[#B23A48]">{error}</p>}
      <form onSubmit={submit} className="mt-6 grid max-w-md gap-4">
        <label className={label}>Name
          <input required className={input} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        </label>
        <label className={label}>Slug
          <input required className={input} value={form.slug} onChange={(e) => setForm({ ...form, slug: e.target.value })} />
        </label>
        <label className={label}>Sort order
          <input required type="number" className={input} value={form.sort_order} onChange={(e) => setForm({ ...form, sort_order: Number(e.target.value) })} />
        </label>
        <div className="mt-2 flex gap-3">
          <button type="submit" disabled={saving} className="bg-[#48458F] px-5 py-2.5 text-sm font-bold text-white disabled:opacity-60">
            {saving ? 'Saving…' : 'Save'}
          </button>
          <Link href="/admin/categories" className="px-5 py-2.5 text-sm text-[#746875]">Cancel</Link>
        </div>
      </form>
    </div>
  );
}
