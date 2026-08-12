import { useQuery } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import { useMemo } from 'react';

import { useProgressRepository } from '@/app/repository-provider';
import { challengeRegistry } from '@/challenges/registry';
import type { Challenge } from '@/challenges/types';
import { Badge } from '@/components/ui/badge';
import { Markdown } from '@/components/ui/markdown';
import { progressQueryOptions } from '@/data/queries';
import { GradeModeBadge, QualityBadge, StatusBadge } from '@/features/progress/badges';
import { HintsSection } from '@/features/workspace/HintsSection';
import { NotesSection } from '@/features/workspace/NotesSection';
import { seriesProgressFor } from '@/features/workspace/series-progress';
import { SpoilerSection } from '@/features/workspace/SpoilerSection';

export function PromptPane({ challenge }: { challenge: Challenge }): React.JSX.Element {
  const repo = useProgressRepository();
  const { data: progressList = [] } = useQuery(progressQueryOptions(repo));
  const progressById = useMemo(
    () => new Map(progressList.map((record) => [record.challengeId, record])),
    [progressList],
  );
  const record = progressById.get(challenge.id);
  const series = seriesProgressFor(challenge, challengeRegistry.challenges, progressById);

  return (
    <div className="h-full space-y-5 overflow-y-auto p-4">
      <header className="space-y-2">
        <h2 className="text-xl font-semibold tracking-tight">{challenge.title}</h2>
        <div className="flex flex-wrap items-center gap-2">
          <StatusBadge status={record?.status ?? 'unsolved'} />
          {record?.solveQuality != null ? <QualityBadge quality={record.solveQuality} /> : null}
          <GradeModeBadge mode={challenge.gradeMode} />
          <Badge variant="outline">{challenge.difficulty}</Badge>
          {challenge.tech.map((tech) => (
            <Badge key={tech} variant="secondary">
              {tech}
            </Badge>
          ))}
          <span className="text-muted-foreground text-xs">~{challenge.estimatedMinutes} min</span>
        </div>
      </header>

      <Markdown source={challenge.brief} />

      <section aria-labelledby={`goals-${challenge.id}`} className="space-y-2">
        <h3 id={`goals-${challenge.id}`} className="text-sm font-semibold">
          Goals
        </h3>
        <ul aria-labelledby={`goals-${challenge.id}`} className="list-disc space-y-1 pl-5 text-sm">
          {challenge.goals.map((goal) => (
            <li key={goal}>{goal}</li>
          ))}
        </ul>
      </section>

      {series !== null && challenge.series !== undefined ? (
        <section className="space-y-1 text-sm">
          <h3 className="font-semibold">Series: {challenge.series.label}</h3>
          <p className="text-muted-foreground">
            {series.solved} of {series.authored} ways solved
          </p>
          <ul className="space-y-1">
            {series.siblings.map((sibling) => (
              <li key={sibling.id}>
                <Link
                  to="/challenges/$categoryId/$slug"
                  params={{ categoryId: sibling.categoryId, slug: sibling.id.split('/')[1] ?? '' }}
                  className="underline underline-offset-4"
                >
                  {sibling.title}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <HintsSection challenge={challenge} />
      <SpoilerSection challenge={challenge} />
      <NotesSection challenge={challenge} />
    </div>
  );
}
