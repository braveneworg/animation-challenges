import { Link, type ErrorComponentProps } from '@tanstack/react-router';

import { Button } from '@/components/ui/button';

export function RouteErrorScreen({ error, reset }: ErrorComponentProps): React.JSX.Element {
  return (
    <section role="alert" className="mx-auto max-w-5xl space-y-4">
      <h1 className="text-2xl font-semibold tracking-tight">Something went wrong</h1>
      <p className="text-muted-foreground font-mono text-sm">{error.message}</p>
      <div className="flex gap-2">
        <Button onClick={reset}>Try again</Button>
        <Button asChild variant="outline">
          <Link to="/">Back to the dashboard</Link>
        </Button>
      </div>
    </section>
  );
}
