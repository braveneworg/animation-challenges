import { Link } from '@tanstack/react-router';

import { CATEGORIES } from '@/challenges/categories';
import { challengeRegistry } from '@/challenges/registry';
import { Badge } from '@/components/ui/badge';

export function CatalogPage(): React.JSX.Element {
  const { challenges } = challengeRegistry;

  return (
    <section className="space-y-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">Challenges</h1>
        <p className="text-muted-foreground text-sm">
          {challenges.length} of {CATEGORIES.reduce((total, category) => total + category.plannedCount, 0)} authored.
        </p>
      </header>

      <ul className="space-y-2">
        {challenges.map((challenge) => (
          <li key={challenge.id}>
            <Link
              to="/challenges/$categoryId/$slug"
              params={{ categoryId: challenge.categoryId, slug: challenge.id.split('/')[1] ?? '' }}
              className="border-border hover:bg-accent flex items-center justify-between gap-4 rounded-lg border px-4 py-3 transition-colors"
            >
              <span className="font-medium">{challenge.title}</span>
              <Badge variant="secondary">{challenge.difficulty}</Badge>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
