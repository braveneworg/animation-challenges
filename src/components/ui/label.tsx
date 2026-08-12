import { cn } from '@/lib/utils';

export function Label({ className, htmlFor, ...props }: React.ComponentProps<'label'>): React.JSX.Element {
  return (
    <label
      htmlFor={htmlFor}
      data-slot="label"
      className={cn('text-sm leading-none font-medium', className)}
      {...props}
    />
  );
}
