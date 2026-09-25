import { describe, it, expect, vi, beforeEach } from 'vitest';

const insertMock = vi.fn();
vi.mock('../supabase', () => ({
  supabase: { from: () => ({ insert: insertMock }) },
}));

import { subscribeToNewsletter } from '../newsletter';

describe('subscribeToNewsletter', () => {
  beforeEach(() => { insertMock.mockReset(); });

  it('rejects an invalid email without calling supabase', async () => {
    const result = await subscribeToNewsletter('not-an-email');
    expect(result).toEqual({ ok: false, error: 'invalid_input' });
    expect(insertMock).not.toHaveBeenCalled();
  });

  it('returns ok on a successful insert', async () => {
    insertMock.mockResolvedValue({ error: null });
    const result = await subscribeToNewsletter('Jane@Example.com');
    expect(result).toEqual({ ok: true, duplicate: false });
    expect(insertMock).toHaveBeenCalledWith({ email: 'jane@example.com' });
  });

  it('treats a unique violation as an already-subscribed duplicate', async () => {
    insertMock.mockResolvedValue({ error: { code: '23505', message: 'duplicate key' } });
    const result = await subscribeToNewsletter('jane@example.com');
    expect(result).toEqual({ ok: true, duplicate: true });
  });

  it('returns an unknown error for other failures', async () => {
    insertMock.mockResolvedValue({ error: { code: '500', message: 'boom' } });
    const result = await subscribeToNewsletter('jane@example.com');
    expect(result).toEqual({ ok: false, error: 'unknown' });
  });
});
