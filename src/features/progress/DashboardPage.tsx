import { useQuery } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import { useMemo } from 'react';

import { useProgressRepository } from '@/app/repository-provider';
import { CATEGORIES } from '@/challenges/categories';
import { challengeRegistry } from '@/challenges/registry';
import { challengeSlug } from '@/challenges/types';
import { Button } from '@/components/ui/button';
import { progressQueryOptions } from '@/data/queries';
import {
  continueChallenge,
  overallCompletion,
  summarizeCategories,
  weakestCategory,
} from '@/features/progress/dashboard-selectors';
import { ProgressRing } from '@/features/progress/ProgressRing';

export function DashboardPage(): React.JSX.Element {
  const repo = useProgressRepository();
  const { data: progressList = [] } = useQuery(progressQueryOptions(repo));
  const progressById = useMemo(
    () => new Map(progressList.map((record) => [record.challengeId, record])),
    [progressList],
  );
  const { challenges } = challengeRegistry;
  const completion = overallCompletion(challenges, progressById);
  const categorySummaries = summarizeCategories(CATEGORIES, challenges, progressById);
  const categories = categorySummaries.filter((summary) => summary.authored > 0);
  const next = continueChallenge(challenges, progressList);
  const hasActivity = progressList.length > 0;
  const weakest = hasActivity ? weakestCategory(categorySummaries) : null;

  return (
    <section className="mx-auto max-w-5xl space-y-8">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground text-sm">
          {completion.solved} of {completion.authored} authored solved · {completion.planned} planned.
        </p>
      </header>

      {next !== null ? (
        <Button asChild>
          <Link
            to="/challenges/$categoryId/$slug"
            params={{ categoryId: next.categoryId, slug: challengeSlug(next.id) }}
          >
            Continue: {next.title}
          </Link>
        </Button>
      ) : (
        <Button asChild variant="outline">
          <Link to="/challenges">Browse the catalog</Link>
        </Button>
      )}

      {weakest !== null ? (
        <p className="text-sm">
          Weakest category:{' '}
          <Link to="/challenges" search={{ category: weakest.categoryId }} className="underline underline-offset-4">
            Practice {weakest.title}
          </Link>{' '}
          ({weakest.solved}/{weakest.authored} solved)
        </p>
      ) : null}

      <section aria-labelledby="category-progress" className="space-y-3">
        <h2 id="category-progress" className="text-lg font-semibold">
          By category
        </h2>
        <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {categories.map((summary) => (
            <li key={summary.categoryId} className="flex flex-col items-center gap-1 text-center">
              <ProgressRing label={summary.title} solved={summary.solved} authored={summary.authored} />
              <Link
                to="/challenges"
                search={{ category: summary.categoryId }}
                className="text-sm underline-offset-4 hover:underline"
              >
                {summary.title}
              </Link>
              <span className="text-muted-foreground text-xs">{summary.plannedCount} planned</span>
            </li>
          ))}
        </ul>
      </section>
    </section>
  );
}
