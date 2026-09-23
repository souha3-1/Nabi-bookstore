import { useEffect, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';

// Admin auth only. Customers never touch this file — the storefront stays guest-only.
export function useAdminSession() {
  const [session, setSession] = useState<Session | null | undefined>(undefined); // undefined = not loaded yet
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((_event, next) => setSession(next));
    return () => sub.subscription.unsubscribe();
  }, []);
  return { session, isLoading: session === undefined };
}

export async function adminSignIn(email: string, password: string) {
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  return error ? { ok: false as const, message: error.message } : { ok: true as const };
}

export async function adminSignOut() {
  await supabase.auth.signOut();
}
