import { describe, expect, it } from 'vitest';
import { noteIdSchema, noteInputSchema, safeInternalPath } from './validation';

describe('noteInputSchema', () => {
  it('trims valid input and rejects empty or oversized notes', () => {
    expect(noteInputSchema.parse({ body: '  remember this  ' })).toEqual({ body: 'remember this' });
    expect(noteInputSchema.safeParse({ body: '   ' }).success).toBe(false);
    expect(noteInputSchema.safeParse({ body: 'x'.repeat(5_001) }).success).toBe(false);
  });
});

describe('noteIdSchema', () => {
  it('accepts UUID identifiers only', () => {
    expect(noteIdSchema.safeParse('00000000-0000-4000-8000-000000000001').success).toBe(true);
    expect(noteIdSchema.safeParse('not-an-id').success).toBe(false);
  });
});

describe('safeInternalPath', () => {
  it('allows local paths and rejects external or backslash-normalized redirects', () => {
    expect(safeInternalPath('/app?tab=recent')).toBe('/app?tab=recent');
    expect(safeInternalPath('//example.com')).toBe('/app');
    expect(safeInternalPath('/\\example.com')).toBe('/app');
    expect(safeInternalPath('https://example.com')).toBe('/app');
  });
});
