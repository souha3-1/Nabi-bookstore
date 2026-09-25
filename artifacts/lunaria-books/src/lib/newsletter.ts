import { supabase } from './supabase';
import { isValidEmail, normalizeEmail } from './validation';

export type NewsletterSubmitResult =
  | { ok: true; duplicate: boolean }
  | { ok: false; error: 'invalid_input' }
  | { ok: false; error: 'unknown' };

const UNIQUE_VIOLATION = '23505';

export async function subscribeToNewsletter(rawEmail: string): Promise<NewsletterSubmitResult> {
  const email = normalizeEmail(rawEmail);
  if (!isValidEmail(email)) return { ok: false, error: 'invalid_input' };

  const { error } = await supabase.from('newsletter_subscribers').insert({ email });

  if (error) {
    if (error.code === UNIQUE_VIOLATION) return { ok: true, duplicate: true };
    return { ok: false, error: 'unknown' };
  }
  return { ok: true, duplicate: false };
}
