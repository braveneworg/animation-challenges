import type { Challenge } from '@/challenges/types';

interface WorkspacePageProps {
  challenge: Challenge;
}

export function WorkspacePage({ challenge }: WorkspacePageProps): React.JSX.Element {
  return (
    <section className="mx-auto max-w-5xl space-y-2">
      <h1 className="text-2xl font-semibold tracking-tight">{challenge.title}</h1>
      <p className="font-mono text-sm">{challenge.id}</p>
    </section>
  );
}
