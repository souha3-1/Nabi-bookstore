import { describe, it, expect } from 'vitest';
import { isValidEmail, normalizeEmail } from '../validation';

describe('normalizeEmail', () => {
  it('trims whitespace and lowercases', () => {
    expect(normalizeEmail('  Jane@Example.COM  ')).toBe('jane@example.com');
  });
});

describe('isValidEmail', () => {
  it('accepts a normal address', () => {
    expect(isValidEmail('jane@example.com')).toBe(true);
  });
  it('rejects a missing @', () => {
    expect(isValidEmail('jane.example.com')).toBe(false);
  });
  it('rejects a missing domain dot', () => {
    expect(isValidEmail('jane@example')).toBe(false);
  });
  it('rejects an address over 120 characters', () => {
    const long = 'a'.repeat(115) + '@a.com';
    expect(isValidEmail(long)).toBe(false);
  });
});
