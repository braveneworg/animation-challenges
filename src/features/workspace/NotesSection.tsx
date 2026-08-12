import { zodResolver } from '@hookform/resolvers/zod';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';

import { useProgressRepository } from '@/app/repository-provider';
import type { Challenge } from '@/challenges/types';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { invalidateChallengeData, noteQueryOptions } from '@/data/queries';

const noteFormSchema = z.object({ body: z.string().max(20_000, 'Notes are limited to 20,000 characters') });
type NoteFormValues = z.infer<typeof noteFormSchema>;

/** Spec §7.4: notes are a real form — RHF + Zod. Collapsed behind a toggle to keep the pane calm. */
export function NotesSection({ challenge }: { challenge: Challenge }): React.JSX.Element {
  const repo = useProgressRepository();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const { data: note } = useQuery(noteQueryOptions(repo, challenge.id));
  const form = useForm<NoteFormValues>({
    resolver: zodResolver(noteFormSchema),
    values: { body: note?.body ?? '' },
  });

  const onSubmit = form.handleSubmit(async (values) => {
    await repo.saveNote({
      id: challenge.id,
      challengeId: challenge.id,
      body: values.body,
      updatedAt: new Date().toISOString(),
    });
    await invalidateChallengeData(queryClient, challenge.id);
  });

  return (
    <section className="space-y-2">
      <Button type="button" variant="ghost" size="sm" aria-expanded={open} onClick={() => setOpen((value) => !value)}>
        Notes
      </Button>
      {open ? (
        <form
          onSubmit={(event) => {
            void onSubmit(event);
          }}
          className="space-y-2"
        >
          <label htmlFor={`note-${challenge.id}`} className="text-sm font-medium">
            Your notes
          </label>
          <Textarea id={`note-${challenge.id}`} rows={5} {...form.register('body')} />
          {form.formState.errors.body ? (
            <p role="alert" className="text-destructive text-sm">
              {form.formState.errors.body.message}
            </p>
          ) : null}
          <Button type="submit" size="sm" disabled={form.formState.isSubmitting}>
            Save note
          </Button>
        </form>
      ) : null}
    </section>
  );
}
