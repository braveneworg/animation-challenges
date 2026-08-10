import { describe, expect, it } from 'vitest';

import { add } from '@/lib/sanity';

describe('unit project', () => {
  it('runs in node and resolves the @ alias', () => {
    expect(add(2, 3)).toBe(5);
  });
});
