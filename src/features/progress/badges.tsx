import type { GradeMode } from '@/challenges/types';
import { Badge } from '@/components/ui/badge';
import type { ProgressStatus, SolveQuality } from '@/data/records';

const STATUS_LABELS: Record<ProgressStatus, string> = {
  unsolved: 'Unsolved',
  attempted: 'Attempted',
  solved: 'Solved',
};

export function StatusBadge({ status }: { status: ProgressStatus }): React.JSX.Element {
  const variant = status === 'solved' ? 'default' : status === 'attempted' ? 'secondary' : 'outline';
  return <Badge variant={variant}>{STATUS_LABELS[status]}</Badge>;
}

const QUALITY_LABELS: Record<SolveQuality, string> = {
  clean: 'Clean solve',
  assisted: 'Assisted solve',
};

/** Assistance is badged, never punished: this badge records HOW a solve happened, nothing more. */
export function QualityBadge({ quality }: { quality: SolveQuality }): React.JSX.Element {
  return <Badge variant={quality === 'clean' ? 'default' : 'secondary'}>{QUALITY_LABELS[quality]}</Badge>;
}

const GRADE_MODE_LABELS: Record<GradeMode, string> = {
  auto: 'Auto-graded',
  rubric: 'Self-assessed',
  hybrid: 'Auto + self-assessed',
};

/** Spec §2: the UI always shows which mode graded a pass, so "solved" never overclaims. */
export function GradeModeBadge({ mode }: { mode: GradeMode }): React.JSX.Element {
  return <Badge variant="outline">{GRADE_MODE_LABELS[mode]}</Badge>;
}
