import { useQuery } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import { Collapsible } from 'radix-ui';
import { useMemo } from 'react';

import { useProgressRepository } from '@/app/repository-provider';
import { challengeRegistry } from '@/challenges/registry';
import { SERIES } from '@/challenges/series';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { attemptsQueryOptions, progressQueryOptions } from '@/data/queries';
import type { ProgressRecord } from '@/data/records';
import { GradeModeBadge, QualityBadge, StatusBadge } from '@/features/progress/badges';
import { overallCompletion, solveQualityCounts, summarizeSeries } from '@/features/progress/dashboard-selectors';

function AttemptHistory({ challengeId }: { challengeId: string }): React.JSX.Element {
  const repo = useProgressRepository();
  const { data: attempts = [], isPending } = useQuery(attemptsQueryOptions(repo, challengeId));
  // Spec §2 (binding, see global-constraints.md): the UI always shows which mode graded a pass,
  // so every attempt history row is badged with the challenge's grade mode, not only passed ones.
  const challenge = challengeRegistry.byId.get(challengeId);
  if (isPending) return <p className="text-muted-foreground text-sm">Loading attempts…</p>;
  if (attempts.length === 0) return <p className="text-muted-foreground text-sm">No attempts recorded.</p>;
  const newestFirst = [...attempts].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  return (
    <ol className="space-y-2">
      {newestFirst.map((attempt) => (
        <li key={attempt.id} className="border-border rounded-md border p-2 text-sm">
          <p className="flex flex-wrap items-center gap-2">
            <Badge variant={attempt.passed ? 'default' : 'outline'}>{attempt.passed ? 'Passed' : 'Failed'}</Badge>
            {challenge !== undefined ? <GradeModeBadge mode={challenge.gradeMode} /> : null}
            <span className="text-muted-foreground text-xs">
              {new Date(attempt.createdAt).toLocaleString()} · {attempt.durationMs}ms
            </span>
          </p>
          {attempt.failures.length > 0 ? (
            <ul className="mt-1 space-y-1">
              {attempt.failures.map((failure) => (
                <li key={`${failure.message}:${failure.hint ?? ''}:${failure.actual ?? ''}:${failure.expected ?? ''}`}>
                  <p className="font-medium">{failure.message}</p>
                  {failure.hint !== undefined ? <p className="text-muted-foreground">Hint: {failure.hint}</p> : null}
                </li>
              ))}
            </ul>
          ) : null}
        </li>
      ))}
    </ol>
  );
}

function progressRow(record: ProgressRecord): React.JSX.Element | null {
  const challenge = challengeRegistry.byId.get(record.challengeId);
  if (challenge === undefined) return null;
  return (
    <li key={record.challengeId} className="border-border rounded-md border p-3">
      <Collapsible.Root>
        <Collapsible.Trigger asChild>
          <Button type="button" variant="ghost" className="w-full justify-between gap-2">
            <span className="truncate">{challenge.title}</span>
            <span className="flex items-center gap-1.5">
              <StatusBadge status={record.status} />
              {record.solveQuality != null ? <QualityBadge quality={record.solveQuality} /> : null}
              <span className="text-muted-foreground text-xs">
                {record.attempts} {record.attempts === 1 ? 'attempt' : 'attempts'} · {record.hintsRevealed}{' '}
                {record.hintsRevealed === 1 ? 'hint' : 'hints'} used
              </span>
            </span>
          </Button>
        </Collapsible.Trigger>
        <Collapsible.Content className="pt-2">
          <AttemptHistory challengeId={record.challengeId} />
          <p className="mt-2">
            <Link
              to="/challenges/$categoryId/$slug"
              params={{ categoryId: challenge.categoryId, slug: challenge.id.split('/')[1] ?? '' }}
              className="text-sm underline underline-offset-4"
            >
              Open workspace
            </Link>
          </p>
        </Collapsible.Content>
      </Collapsible.Root>
    </li>
  );
}

export function ProgressPage(): React.JSX.Element {
  const repo = useProgressRepository();
  const { data: progressList = [] } = useQuery(progressQueryOptions(repo));
  const progressById = useMemo(
    () => new Map(progressList.map((record) => [record.challengeId, record])),
    [progressList],
  );
  const { challenges } = challengeRegistry;
  const completion = overallCompletion(challenges, progressById);
  const quality = solveQualityCounts(progressList);
  const seriesSummaries = summarizeSeries(SERIES, challenges, progressById);
  const active = progressList.filter((record) => record.status !== 'unsolved' || record.attempts > 0);

  return (
    <section className="mx-auto max-w-5xl space-y-8">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">Progress</h1>
        <p className="text-muted-foreground text-sm">
          {completion.solved} solved of {completion.authored} authored ({completion.planned} planned) · {quality.clean}{' '}
          clean · {quality.assisted} assisted.
        </p>
      </header>

      <section aria-labelledby="series-completion" className="space-y-2">
        <h2 id="series-completion" className="text-lg font-semibold">
          Series
        </h2>
        <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {seriesSummaries.map((series) => (
            <li
              key={series.id}
              className="border-border flex items-center justify-between rounded-md border px-3 py-2 text-sm"
            >
              <span>{series.label}</span>
              <span className="text-muted-foreground">
                {series.solved} of {series.authored} authored ways solved · {series.plannedMembers} planned
              </span>
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="attempt-history" className="space-y-2">
        <h2 id="attempt-history" className="text-lg font-semibold">
          Attempt history
        </h2>
        {active.length === 0 ? (
          <p className="text-muted-foreground">No attempts yet — pick a challenge from the catalog to start.</p>
        ) : (
          <ul className="space-y-2">{active.map((record) => progressRow(record))}</ul>
        )}
      </section>
    </section>
  );
}
