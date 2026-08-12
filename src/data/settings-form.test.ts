import { describe, expect, it } from 'vitest';

import { SETTINGS_FORM_DEFAULTS, settingsFormResolver, type SettingsFormValues } from '@/data/settings-form';

const RESOLVER_OPTIONS = { fields: {}, shouldUseNativeValidation: false, criteriaMode: 'firstError' } as const;

describe('settingsFormResolver', () => {
  it('accepts the defaults with no errors', async () => {
    const result = await settingsFormResolver(SETTINGS_FORM_DEFAULTS, undefined, RESOLVER_OPTIONS);
    expect(result.errors).toEqual({});
    expect(result.values).toEqual(SETTINGS_FORM_DEFAULTS);
  });

  it('rejects an out-of-range grader timeout with a field error', async () => {
    const values: SettingsFormValues = { ...SETTINGS_FORM_DEFAULTS, graderTimeoutMs: 500 };
    const result = await settingsFormResolver(values, undefined, RESOLVER_OPTIONS);
    expect(result.errors.graderTimeoutMs).toBeDefined();
    expect(result.values).toEqual({});
  });

  it('accepts an empty apiBaseUrl (mirror off) and rejects a malformed one', async () => {
    const off = await settingsFormResolver({ ...SETTINGS_FORM_DEFAULTS, apiBaseUrl: '' }, undefined, RESOLVER_OPTIONS);
    expect(off.errors).toEqual({});
    const bad = await settingsFormResolver(
      { ...SETTINGS_FORM_DEFAULTS, apiBaseUrl: 'not a url' },
      undefined,
      RESOLVER_OPTIONS,
    );
    expect(bad.errors.apiBaseUrl).toBeDefined();
  });
});
