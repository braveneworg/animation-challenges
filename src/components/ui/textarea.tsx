import { cn } from '@/lib/utils';

export function Textarea({ className, ...props }: React.ComponentProps<'textarea'>): React.JSX.Element {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        'border-input focus-visible:border-ring focus-visible:ring-ring/50 aria-invalid:border-destructive flex min-h-20 w-full rounded-md border bg-transparent px-3 py-2 text-sm shadow-xs outline-none focus-visible:ring-[3px] disabled:opacity-50',
        className,
      )}
      {...props}
    />
  );
}
