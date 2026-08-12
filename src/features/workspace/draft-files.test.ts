import { describe, expect, it } from 'vitest';

import { mergedDraftFiles } from '@/features/workspace/draft-files';

describe('mergedDraftFiles', () => {
  it('returns the starter when no drafts exist', () => {
    expect(mergedDraftFiles({ 'a.css': 'starter' }, undefined)).toEqual({ 'a.css': 'starter' });
  });

  it('overlays drafts per file, keeping untouched starter files', () => {
    expect(mergedDraftFiles({ 'a.css': 'starter-a', 'b.ts': 'starter-b' }, { 'a.css': 'edited-a' })).toEqual({
      'a.css': 'edited-a',
      'b.ts': 'starter-b',
    });
  });
});
