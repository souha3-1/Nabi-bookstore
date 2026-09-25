import { supabase } from './supabase';
import { isValidEmail, normalizeEmail } from './validation';

export type ContactTopic = 'Book recommendation' | 'Order question' | 'Shop visit' | 'Something else';

export type ContactFormInput = {
  name: string;
  email: string;
  topic: ContactTopic;
  message: string;
};

export type ContactSubmitResult =
  | { ok: true }
  | { ok: false; error: 'invalid_input'; field: 'name' | 'email' | 'message' }
  | { ok: false; error: 'unknown' };

export function validateContactInput(input: ContactFormInput): ContactSubmitResult | null {
  const name = input.name.trim();
  if (name.length < 2 || name.length > 80) {
    return { ok: false, error: 'invalid_input', field: 'name' };
  }
  const email = normalizeEmail(input.email);
  if (!isValidEmail(email)) {
    return { ok: false, error: 'invalid_input', field: 'email' };
  }
  const message = input.message.trim();
  if (message.length < 1 || message.length > 2000) {
    return { ok: false, error: 'invalid_input', field: 'message' };
  }
  return null;
}

export async function submitContactMessage(input: ContactFormInput): Promise<ContactSubmitResult> {
  const validationError = validateContactInput(input);
  if (validationError) return validationError;

  const { error } = await supabase.from('contact_messages').insert({
    name: input.name.trim(),
    email: normalizeEmail(input.email),
    topic: input.topic,
    message: input.message.trim(),
  });

  if (error) return { ok: false, error: 'unknown' };
  return { ok: true };
}
