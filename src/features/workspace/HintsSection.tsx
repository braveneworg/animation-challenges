import { useQueryClient } from '@tanstack/react-query';

import { useProgressRepository } from '@/app/repository-provider';
import type { Challenge } from '@/challenges/types';
import { Button } from '@/components/ui/button';
import { Markdown } from '@/components/ui/markdown';
import { recordHintRevealed } from '@/data/operations';
import { invalidateChallengeData } from '@/data/queries';
import { useWorkspaceStore } from '@/stores';

export function HintsSection({ challenge }: { challenge: Challenge }): React.JSX.Element {
  const repo = useProgressRepository();
  const queryClient = useQueryClient();
  const revealedCount = useWorkspaceStore((state) => state.byChallenge[challenge.id]?.revealedHintCount ?? 0);
  const revealNextHint = useWorkspaceStore((state) => state.revealNextHint);
  // Plan 04 left clamping to the UI: stored counts may exceed hints.length after content edits.
  const visible = Math.min(revealedCount, challenge.hints.length);
  const done = visible >= challenge.hints.length;

  const reveal = (): void => {
    if (done) return;
    revealNextHint(challenge.id);
    void recordHintRevealed(repo, challenge.id)
      .then(() => invalidateChallengeData(queryClient, challenge.id))
      .catch((error: unknown) => console.error('failed to record hint reveal', error));
  };

  return (
    <section aria-labelledby={`hints-${challenge.id}`} className="space-y-2">
      <h3 id={`hints-${challenge.id}`} className="text-sm font-semibold">
        Hints
      </h3>
      {visible > 0 ? (
        <ol className="list-decimal space-y-1 pl-5">
          {challenge.hints.slice(0, visible).map((hint) => (
            <li key={hint}>
              <Markdown source={hint} />
            </li>
          ))}
        </ol>
      ) : null}
      <Button type="button" variant="outline" size="sm" onClick={reveal} disabled={done}>
        {done ? 'All hints revealed' : `Reveal hint ${visible + 1} of ${challenge.hints.length}`}
      </Button>
      <p className="text-muted-foreground text-xs">Hints never downgrade a solve.</p>
    </section>
  );
}
