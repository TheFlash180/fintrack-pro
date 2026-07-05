import { describe, expect, it } from 'vitest';
import { dedupeHash } from '../dedupe';

describe('dedupeHash', () => {
  it('is stable for identical transactions', async () => {
    const a = await dedupeHash('2026-06-02', -845.5, 'Purchase Checkers Sandton');
    const b = await dedupeHash('2026-06-02', -845.5, 'Purchase Checkers Sandton');
    expect(a).toBe(b);
    expect(a).toMatch(/^[0-9a-f]{64}$/);
  });

  it('normalises whitespace and case in descriptions', async () => {
    const a = await dedupeHash('2026-06-02', -845.5, '  Purchase   CHECKERS Sandton ');
    const b = await dedupeHash('2026-06-02', -845.5, 'purchase checkers sandton');
    expect(a).toBe(b);
  });

  it('differs when any field differs', async () => {
    const base = await dedupeHash('2026-06-02', -845.5, 'Purchase Checkers');
    expect(await dedupeHash('2026-06-03', -845.5, 'Purchase Checkers')).not.toBe(base);
    expect(await dedupeHash('2026-06-02', -845.51, 'Purchase Checkers')).not.toBe(base);
    expect(await dedupeHash('2026-06-02', -845.5, 'Purchase Spar')).not.toBe(base);
  });
});
