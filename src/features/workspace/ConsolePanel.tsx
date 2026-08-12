import { Button } from '@/components/ui/button';
import type { ConsoleLine } from '@/features/workspace/use-preview-frame';

const LEVEL_CLASSES: Record<ConsoleLine['level'], string> = {
  log: 'text-foreground',
  info: 'text-foreground',
  warn: 'text-amber-600 dark:text-amber-400',
  error: 'text-destructive',
};

// Property-style function type (not method shorthand): destructuring a method-shorthand
// signature trips oxlint's type-aware `typescript/unbound-method` (the callback has no `this`
// to lose, but the rule can't tell method syntax from a real method). Same call surface.
export function ConsolePanel({
  lines,
  onClear,
}: {
  lines: readonly ConsoleLine[];
  onClear: () => void;
}): React.JSX.Element {
  return (
    <div className="flex h-full min-h-0 flex-col gap-2 p-2">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">Console</h3>
        <Button type="button" variant="ghost" size="sm" onClick={onClear}>
          Clear console
        </Button>
      </div>
      <div role="log" aria-label="Sandbox console" className="min-h-0 flex-1 overflow-y-auto font-mono text-xs">
        {lines.length === 0 ? (
          <p className="text-muted-foreground">Console output from your code appears here after Run.</p>
        ) : (
          <ul className="space-y-0.5">
            {lines.map((line) => (
              <li key={line.id} className={LEVEL_CLASSES[line.level]}>
                {line.text}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
