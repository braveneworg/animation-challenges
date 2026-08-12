import { AlertDialog } from 'radix-ui';

import { Button } from '@/components/ui/button';

interface ConfirmDialogProps {
  trigger: React.ReactNode;
  title: string;
  description: string;
  confirmLabel: string;
  // Property-style function type (not method shorthand): destructuring a method-shorthand
  // signature trips oxlint's type-aware `typescript/unbound-method` (the callback has no `this`
  // to lose, but the rule can't tell method syntax from a real method). Same call surface.
  onConfirm: () => void;
}

/** Radix AlertDialog wrapper: focus-trapped, labelled, Escape/Cancel backs out, Action confirms. */
export function ConfirmDialog({
  trigger,
  title,
  description,
  confirmLabel,
  onConfirm,
}: ConfirmDialogProps): React.JSX.Element {
  return (
    <AlertDialog.Root>
      <AlertDialog.Trigger asChild>{trigger}</AlertDialog.Trigger>
      <AlertDialog.Portal>
        <AlertDialog.Overlay className="fixed inset-0 z-40 bg-black/50" />
        <AlertDialog.Content className="bg-background border-border fixed top-1/2 left-1/2 z-50 w-[min(24rem,90vw)] -translate-x-1/2 -translate-y-1/2 rounded-lg border p-6 shadow-lg">
          <AlertDialog.Title className="text-lg font-semibold">{title}</AlertDialog.Title>
          <AlertDialog.Description className="text-muted-foreground mt-2 text-sm">
            {description}
          </AlertDialog.Description>
          <div className="mt-4 flex justify-end gap-2">
            <AlertDialog.Cancel asChild>
              <Button type="button" variant="outline">
                Cancel
              </Button>
            </AlertDialog.Cancel>
            <AlertDialog.Action asChild>
              <Button type="button" variant="destructive" onClick={onConfirm}>
                {confirmLabel}
              </Button>
            </AlertDialog.Action>
          </div>
        </AlertDialog.Content>
      </AlertDialog.Portal>
    </AlertDialog.Root>
  );
}
