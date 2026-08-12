import { Link } from '@tanstack/react-router';

import { challengeSlug, type Challenge } from '@/challenges/types';
import { Badge } from '@/components/ui/badge';
import type { ProgressRecord } from '@/data/records';
import { challengeStatus } from '@/features/catalog/catalog-search';
import { QualityBadge, StatusBadge } from '@/features/progress/badges';
import { cn } from '@/lib/utils';
import type { CatalogViewMode } from '@/stores/workspace-store';

interface ChallengeCardProps {
  challenge: Challenge;
  record: ProgressRecord | undefined;
  view: CatalogViewMode;
}

export function ChallengeCard({ challenge, record, view }: ChallengeCardProps): React.JSX.Element {
  return (
    <Link
      to="/challenges/$categoryId/$slug"
      params={{ categoryId: challenge.categoryId, slug: challengeSlug(challenge.id) }}
      className={cn(
        'border-border hover:bg-accent block rounded-lg border px-4 py-3 transition-colors',
        view === 'list' && 'flex items-center justify-between gap-4',
      )}
    >
      <span className="flex min-w-0 flex-col gap-1">
        <span className="truncate font-medium">{challenge.title}</span>
        <span className="text-muted-foreground text-xs">
          ~{challenge.estimatedMinutes} min
          {challenge.series !== undefined ? ` · Series: ${challenge.series.label}` : ''}
        </span>
      </span>
      <span className="mt-2 flex flex-wrap items-center gap-1.5">
        <StatusBadge status={challengeStatus(record)} />
        {record?.solveQuality != null ? <QualityBadge quality={record.solveQuality} /> : null}
        <Badge variant="outline">{challenge.difficulty}</Badge>
        {challenge.tech.map((tech) => (
          <Badge key={tech} variant="secondary">
            {tech}
          </Badge>
        ))}
      </span>
    </Link>
  );
}
