import type { CategoryId } from '@/challenges/categories';
import type { SeriesId } from '@/challenges/series';

export type Difficulty = 'novice' | 'intermediate' | 'advanced' | 'expert';

export type Tech = 'css' | 'tailwind' | 'ts' | 'react' | 'motion' | 'svg' | 'waapi';

export type RuntimeKind = 'dom' | 'react' | 'module';

export type GradeMode = 'auto' | 'rubric' | 'hybrid';

export type ChallengeFiles = Readonly<Record<string, string>>;

export interface RubricItem {
  id: string;
  label: string;
  detail?: string | undefined;
}

export interface ChallengeSeriesRef {
  id: SeriesId;
  label: string;
}

export interface Challenge {
  /** Always `${categoryId}/${slug}`. */
  id: string;
  title: string;
  categoryId: CategoryId;
  difficulty: Difficulty;
  tech: readonly Tech[];
  runtime: RuntimeKind;
  /** Markdown prompt. */
  brief: string;
  /** Acceptance criteria, shown to the user verbatim. */
  goals: readonly string[];
  starter: ChallengeFiles;
  /** Reference solution. Drives the spoiler and the target preview. */
  solution: ChallengeFiles;
  /** Markdown: why it works, the pitfall, the related pattern. */
  explanation: string;
  gradeMode: GradeMode;
  rubric?: readonly RubricItem[] | undefined;
  /** Progressive, revealed one at a time. Hints never downgrade solve quality. */
  hints: readonly string[];
  series?: ChallengeSeriesRef | undefined;
  relatedIds: readonly string[];
  estimatedMinutes: number;
  tags: readonly string[];
  graderTimeoutMs?: number | undefined;
}
