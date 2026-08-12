import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { z } from 'zod';

import type { Challenge, RubricItem } from '@/challenges/types';
import { Button } from '@/components/ui/button';
import { GradeModeBadge } from '@/features/progress/badges';
import type { GradeRunReport } from '@/runner/types';
import type { RunSummary } from '@/stores/workspace-store';

export interface ResultsPanelProps {
  challenge: Challenge;
  report: GradeRunReport | null;
  summary: RunSummary | null;
  awaitingRubric: boolean;
  // Property-style function types (not method shorthand): destructuring a method-shorthand
  // signature trips oxlint's type-aware `typescript/unbound-method` (the callback has no `this`
  // to lose, but the rule can't tell method syntax from a real method). Same call surface.
  onConfirmRubric: () => void;
  onRecordRubricFail: (unchecked: readonly RubricItem[]) => void;
}

// Both Zod generics are pinned to the same shape (Output AND Input): the default `z.ZodType<T>`
// leaves Input as `unknown`, which zodResolver's stricter Zod4Type constraint rejects under
// `exactOptionalPropertyTypes` — a behavior-neutral widening of the brief's literal annotation.
export function rubricConfirmationSchema(
  rubric: readonly RubricItem[],
): z.ZodType<{ checkedIds: string[] }, { checkedIds: string[] }> {
  return z.object({
    checkedIds: z.array(z.string()).refine((ids) => rubric.every((item) => ids.includes(item.id)), {
      message: 'Confirm every rubric item before recording a pass.',
    }),
  });
}

interface RubricFormProps {
  rubric: readonly RubricItem[];
  disabled: boolean;
  onConfirm: () => void;
  onRecordFail: (unchecked: readonly RubricItem[]) => void;
}

/** Spec §7.4: the rubric self-check is a real form — checkbox array, all required, RHF + Zod. */
function RubricForm({ rubric, disabled, onConfirm, onRecordFail }: RubricFormProps): React.JSX.Element {
  const form = useForm<{ checkedIds: string[] }>({
    resolver: zodResolver(rubricConfirmationSchema(rubric)),
    defaultValues: { checkedIds: [] },
  });
  const checkedIds = form.watch('checkedIds');
  const toggle = (id: string, checked: boolean): void => {
    const next = checked ? [...checkedIds, id] : checkedIds.filter((value) => value !== id);
    form.setValue('checkedIds', next);
  };
  const submit = form.handleSubmit(() => onConfirm());

  return (
    <form
      aria-label="Rubric self-check"
      onSubmit={(event) => {
        void submit(event);
      }}
      className="space-y-2"
    >
      <h4 className="text-sm font-semibold">Self-check</h4>
      {rubric.map((item) => (
        <label key={item.id} className="flex items-start gap-2 text-sm">
          <input
            type="checkbox"
            checked={checkedIds.includes(item.id)}
            onChange={(event) => toggle(item.id, event.target.checked)}
            className="mt-0.5"
          />
          <span>
            {item.label}
            {item.detail !== undefined ? <span className="text-muted-foreground"> — {item.detail}</span> : null}
          </span>
        </label>
      ))}
      {form.formState.errors.checkedIds ? (
        <p role="alert" className="text-destructive text-sm">
          {form.formState.errors.checkedIds.message}
        </p>
      ) : null}
      <div className="flex flex-wrap gap-2">
        <Button type="submit" size="sm" disabled={disabled}>
          Confirm rubric — record pass
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={disabled}
          onClick={() => onRecordFail(rubric.filter((item) => !checkedIds.includes(item.id)))}
        >
          Record as not passed
        </Button>
      </div>
      {disabled ? (
        <p className="text-muted-foreground text-xs">Pass the automated checks first, then confirm.</p>
      ) : null}
    </form>
  );
}

export function ResultsPanel({
  challenge,
  report,
  summary,
  awaitingRubric,
  onConfirmRubric,
  onRecordRubricFail,
}: ResultsPanelProps): React.JSX.Element {
  const rubric = challenge.rubric ?? [];
  const showRubric = (challenge.gradeMode === 'rubric' || challenge.gradeMode === 'hybrid') && rubric.length > 0;
  const rubricDisabled = challenge.gradeMode === 'hybrid' && !awaitingRubric;
  const okCount = report === null ? 0 : report.assertions.filter((assertion) => assertion.ok).length;

  return (
    <section aria-label="Results" className="h-full space-y-4 overflow-y-auto p-3">
      <div className="flex items-center gap-2">
        <h3 className="text-sm font-semibold">Results</h3>
        <GradeModeBadge mode={challenge.gradeMode} />
      </div>

      {summary === null && report === null ? (
        <p className="text-muted-foreground text-sm">
          {challenge.gradeMode === 'rubric'
            ? 'Run your code, compare it with the target view, then self-assess below.'
            : 'Submit to see graded results here.'}
        </p>
      ) : null}

      {report !== null ? (
        <p className="text-sm">
          {okCount} of {report.assertions.length} checks passed
        </p>
      ) : null}

      {summary !== null && summary.passed ? <p className="text-sm font-semibold">Passed</p> : null}
      {awaitingRubric ? <p className="text-sm">Checks passed — confirm the rubric below to record the solve.</p> : null}

      {summary !== null && !summary.passed && summary.failures.length > 0 ? (
        <ul aria-label="Failing checks" className="space-y-3">
          {summary.failures.map((failure) => (
            <li
              key={`${failure.message}:${failure.hint ?? ''}:${failure.actual ?? ''}:${failure.expected ?? ''}`}
              className="border-border space-y-1 rounded-md border p-2 text-sm"
            >
              <p className="font-medium">{failure.message}</p>
              {failure.hint !== undefined ? <p className="text-muted-foreground">Hint: {failure.hint}</p> : null}
              {failure.actual !== undefined ? <p className="font-mono text-xs">actual: {failure.actual}</p> : null}
              {failure.expected !== undefined ? (
                <p className="font-mono text-xs">expected: {failure.expected}</p>
              ) : null}
            </li>
          ))}
        </ul>
      ) : null}

      {summary !== null && summary.passed ? (
        <ul aria-label="Goals met" className="list-disc space-y-1 pl-5 text-sm">
          {challenge.goals.map((goal) => (
            <li key={goal}>{goal}</li>
          ))}
        </ul>
      ) : null}

      {showRubric ? (
        <RubricForm
          rubric={rubric}
          disabled={rubricDisabled}
          onConfirm={onConfirmRubric}
          onRecordFail={onRecordRubricFail}
        />
      ) : null}
    </section>
  );
}
