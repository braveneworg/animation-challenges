import { Link } from '@tanstack/react-router';

import { Button } from '@/components/ui/button';

export function NotFoundScreen(): React.JSX.Element {
  return (
    <section className="mx-auto max-w-5xl space-y-4">
      <h1 className="text-2xl font-semibold tracking-tight">Not found</h1>
      <p className="text-muted-foreground">That page or challenge does not exist.</p>
      <Button asChild variant="outline">
        <Link to="/challenges">Back to the catalog</Link>
      </Button>
    </section>
  );
}
