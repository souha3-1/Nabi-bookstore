import { describe, it, expect, vi, beforeEach } from 'vitest';

const insertMock = vi.fn();
vi.mock('../supabase', () => ({
  supabase: { from: () => ({ insert: insertMock }) },
}));

import { validateContactInput, submitContactMessage } from '../contact';

describe('validateContactInput', () => {
  const base = { name: 'Jane', email: 'jane@example.com', topic: 'Book recommendation' as const, message: 'Hello there' };

  it('accepts valid input', () => {
    expect(validateContactInput(base)).toBeNull();
  });
  it('flags a too-short name', () => {
    expect(validateContactInput({ ...base, name: 'J' })).toEqual({ ok: false, error: 'invalid_input', field: 'name' });
  });
  it('flags an invalid email', () => {
    expect(validateContactInput({ ...base, email: 'not-an-email' })).toEqual({ ok: false, error: 'invalid_input', field: 'email' });
  });
  it('flags an empty message', () => {
    expect(validateContactInput({ ...base, message: '   ' })).toEqual({ ok: false, error: 'invalid_input', field: 'message' });
  });
});

describe('submitContactMessage', () => {
  beforeEach(() => { insertMock.mockReset(); });

  it('returns ok on a successful insert', async () => {
    insertMock.mockResolvedValue({ error: null });
    const result = await submitContactMessage({ name: 'Jane', email: 'jane@example.com', topic: 'Order question', message: 'Where is my order?' });
    expect(result).toEqual({ ok: true });
  });

  it('does not call supabase when input is invalid', async () => {
    const result = await submitContactMessage({ name: 'J', email: 'jane@example.com', topic: 'Order question', message: 'Hi' });
    expect(result).toEqual({ ok: false, error: 'invalid_input', field: 'name' });
    expect(insertMock).not.toHaveBeenCalled();
  });

  it('returns an unknown error when supabase fails', async () => {
    insertMock.mockResolvedValue({ error: { code: '500', message: 'boom' } });
    const result = await submitContactMessage({ name: 'Jane', email: 'jane@example.com', topic: 'Order question', message: 'Hi there' });
    expect(result).toEqual({ ok: false, error: 'unknown' });
  });
});
