import { zodResolver } from '@hookform/resolvers/zod';

import { SETTINGS_DEFAULTS, settingsRecordSchema, type SettingsRecord } from '@/data/records';

export type SettingsFormValues = SettingsRecord;

/**
 * Identical to the storage schema on purpose: what the form validates is exactly what
 * persists. Number inputs must use RHF's { valueAsNumber: true } — the schema does not
 * coerce strings, so storage stays strict.
 */
export const settingsFormSchema = settingsRecordSchema;

export const SETTINGS_FORM_DEFAULTS: SettingsFormValues = SETTINGS_DEFAULTS;

export const settingsFormResolver = zodResolver(settingsFormSchema);
