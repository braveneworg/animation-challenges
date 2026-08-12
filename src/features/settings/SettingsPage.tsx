import { useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useForm } from 'react-hook-form';

import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { invalidateAllData } from '@/data/queries';
import { GRADER_TIMEOUT_MS_MAX, GRADER_TIMEOUT_MS_MIN } from '@/data/records';
import { settingsFormResolver, type SettingsFormValues } from '@/data/settings-form';
import { clearProgressData, createBrowserStorage } from '@/data/storage';
import { useSettingsStore } from '@/stores';

const SELECT_CLASS =
  'border-input bg-background focus-visible:ring-ring/50 h-9 w-full rounded-md border px-2 text-sm focus-visible:ring-[3px] focus-visible:outline-none';

export function SettingsPage(): React.JSX.Element {
  const updateSettings = useSettingsStore((state) => state.updateSettings);
  const resetSettings = useSettingsStore((state) => state.resetSettings);
  const queryClient = useQueryClient();
  const [status, setStatus] = useState('');
  const form = useForm<SettingsFormValues>({
    resolver: settingsFormResolver,
    defaultValues: useSettingsStore.getState().settings,
  });

  const onSubmit = form.handleSubmit((values) => {
    // apiBaseUrl changes propagate automatically: RepositoryProvider is subscribed to the store
    // and rebuilds the repository (Task 3).
    updateSettings(values);
    form.reset(values);
    setStatus('Saved.');
  });

  const resetProgress = async (): Promise<void> => {
    // Seam obligation: clearProgressData ONLY — clearNamespace would also destroy settings and drafts.
    clearProgressData(createBrowserStorage());
    await invalidateAllData(queryClient);
    setStatus('Progress cleared. Settings and drafts were kept.');
  };

  return (
    <section className="mx-auto max-w-5xl space-y-8">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
        <output aria-live="polite" className="text-muted-foreground text-sm">
          {status}
        </output>
      </header>

      <form
        onSubmit={(event) => {
          void onSubmit(event);
        }}
        // Real Chromium enforces the number input's min/max as native constraint validation on
        // submit, which blocks the submit event before RHF's Zod resolver ever runs (no alert,
        // no store write, but also no visible feedback). noValidate hands validation entirely to
        // the resolver so the out-of-range case surfaces through the same role="alert" path as
        // every other schema violation.
        noValidate
        className="max-w-md space-y-4"
      >
        <div className="space-y-1">
          <Label htmlFor="settings-theme">Theme</Label>
          <select id="settings-theme" className={SELECT_CLASS} {...form.register('theme')}>
            <option value="system">System</option>
            <option value="light">Light</option>
            <option value="dark">Dark</option>
          </select>
        </div>

        <div className="flex items-center gap-2">
          <input id="settings-reduced-motion" type="checkbox" {...form.register('reducedMotionPreview')} />
          <Label htmlFor="settings-reduced-motion">Reduced-motion preview default</Label>
        </div>
        <p className="text-muted-foreground text-xs">
          Forces prefers-reduced-motion in the live preview frames. Grading is unaffected — accessibility challenges
          assert both branches themselves.
        </p>

        <div className="space-y-1">
          <Label htmlFor="settings-timeout">Grader timeout (ms)</Label>
          <Input
            id="settings-timeout"
            type="number"
            min={GRADER_TIMEOUT_MS_MIN}
            max={GRADER_TIMEOUT_MS_MAX}
            step={500}
            aria-describedby="settings-timeout-help"
            {...form.register('graderTimeoutMs', { valueAsNumber: true })}
          />
          <p id="settings-timeout-help" className="text-muted-foreground text-xs">
            {GRADER_TIMEOUT_MS_MIN}–{GRADER_TIMEOUT_MS_MAX}. A challenge with its own timeout always wins.
          </p>
          {form.formState.errors.graderTimeoutMs ? (
            <p role="alert" className="text-destructive text-sm">
              {form.formState.errors.graderTimeoutMs.message}
            </p>
          ) : null}
        </div>

        <div className="space-y-1">
          <Label htmlFor="settings-api">API base URL</Label>
          <Input id="settings-api" type="text" placeholder="http://localhost:3001" {...form.register('apiBaseUrl')} />
          <p className="text-muted-foreground text-xs">
            The optional JSON Server mirror (pnpm server). Leave empty to work purely locally.
          </p>
          {form.formState.errors.apiBaseUrl ? (
            <p role="alert" className="text-destructive text-sm">
              {form.formState.errors.apiBaseUrl.message}
            </p>
          ) : null}
        </div>

        <div className="flex gap-2">
          <Button type="submit">Save settings</Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              resetSettings();
              form.reset(useSettingsStore.getState().settings);
              setStatus('Settings reset to defaults.');
            }}
          >
            Reset to defaults
          </Button>
        </div>
      </form>

      <section aria-labelledby="danger-zone" className="space-y-2">
        <h2 id="danger-zone" className="text-lg font-semibold">
          Danger zone
        </h2>
        <ConfirmDialog
          trigger={
            <Button type="button" variant="destructive">
              Reset progress
            </Button>
          }
          title="Delete all progress?"
          description="Progress records, attempt history, notes, and profile are deleted. Settings and code drafts are kept."
          confirmLabel="Delete progress"
          onConfirm={() => {
            void resetProgress().catch((error: unknown) => console.error('reset progress failed', error));
          }}
        />
      </section>
    </section>
  );
}
