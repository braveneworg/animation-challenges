import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';

import { useProgressRepository } from '@/app/repository-provider';
import type { Challenge } from '@/challenges/types';
import { Button } from '@/components/ui/button';
import { Markdown } from '@/components/ui/markdown';
import { recordSolutionViewed } from '@/data/operations';
import { invalidateChallengeData } from '@/data/queries';
import { CodeEditor } from '@/features/workspace/editor/CodeEditor';
import { useWorkspaceStore } from '@/stores';

/** Spec §5.3: always one click, never gated. First reveal stamps viewedSolutionAt. */
export function SpoilerSection({ challenge }: { challenge: Challenge }): React.JSX.Element {
  const repo = useProgressRepository();
  const queryClient = useQueryClient();
  const everRevealed = useWorkspaceStore((state) => state.byChallenge[challenge.id]?.spoilerShown ?? false);
  const setSpoilerShown = useWorkspaceStore((state) => state.setSpoilerShown);
  const [open, setOpen] = useState(false);
  const headingRef = useRef<HTMLHeadingElement | null>(null);

  useEffect(() => {
    if (open) headingRef.current?.focus();
  }, [open]);

  const show = (): void => {
    setOpen(true);
    if (!everRevealed) {
      setSpoilerShown(challenge.id, true);
      void recordSolutionViewed(repo, challenge.id)
        .then(() => invalidateChallengeData(queryClient, challenge.id))
        .catch((error: unknown) => console.error('failed to record solution view', error));
    }
  };

  if (!open) {
    return (
      <section className="space-y-2">
        <Button type="button" variant="secondary" size="sm" onClick={show}>
          Reveal solution
        </Button>
        <p className="text-muted-foreground text-xs">
          Viewing before your first pass records the solve as assisted — it never blocks progress.
        </p>
      </section>
    );
  }

  return (
    <section aria-labelledby={`solution-${challenge.id}`} className="space-y-3">
      <h3 id={`solution-${challenge.id}`} ref={headingRef} tabIndex={-1} className="text-sm font-semibold">
        Solution
      </h3>
      {Object.entries(challenge.solution).map(([path, contents]) => (
        <div key={path} className="space-y-1">
          <p className="font-mono text-xs">{path}</p>
          <div className="h-48">
            <CodeEditor path={path} value={contents} ariaLabel={`Solution: ${path}`} readOnly />
          </div>
        </div>
      ))}
      <Markdown source={challenge.explanation} />
      <Button type="button" variant="ghost" size="sm" onClick={() => setOpen(false)}>
        Hide solution
      </Button>
    </section>
  );
}
