import { Button } from '@/components/ui/button';

export function App(): React.JSX.Element {
  return (
    <main className="bg-background text-foreground flex min-h-dvh flex-col items-center justify-center gap-4">
      <h1 className="text-3xl font-semibold tracking-tight">Animation Challenges</h1>
      <Button>Tailwind and shadcn are wired up</Button>
    </main>
  );
}
