const RADIUS = 26;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

interface ProgressRingProps {
  label: string;
  solved: number;
  authored: number;
}

export function ProgressRing({ label, solved, authored }: ProgressRingProps): React.JSX.Element {
  const fraction = authored > 0 ? Math.min(Math.max(solved / authored, 0), 1) : 0;
  return (
    // oxlint's jsx-a11y/prefer-tag-over-role rejects `role="img"` on any host element, `<svg>`
    // included, and a bare `<svg>` carries no implicit img role (verified empirically — without an
    // explicit role, `getByRole('img', ...)` finds nothing) — so there is no ARIA-role-free way to
    // expose this dynamic, theme-aware ring through the `<svg>` element itself. Instead, a real
    // `<img>` (the rule's own recommended tag) carries the accessible name, and the decorative
    // `<svg>` that actually paints the ring is `aria-hidden` so its lack of a role is a non-issue.
    // Visually identical output; the accessible name now comes from the tag jsx-a11y prefers.
    <span className="relative inline-block size-16">
      <img alt={`${label}: ${solved} of ${authored} solved`} className="sr-only" />
      <svg viewBox="0 0 64 64" className="size-16" aria-hidden="true">
        <circle cx="32" cy="32" r={RADIUS} fill="none" strokeWidth="6" className="stroke-muted" />
        <circle
          cx="32"
          cy="32"
          r={RADIUS}
          fill="none"
          strokeWidth="6"
          strokeLinecap="round"
          strokeDasharray={CIRCUMFERENCE}
          strokeDashoffset={CIRCUMFERENCE * (1 - fraction)}
          transform="rotate(-90 32 32)"
          className="stroke-primary"
        />
        <text x="32" y="36" textAnchor="middle" className="fill-foreground text-[0.7rem] font-semibold">
          {solved}/{authored}
        </text>
      </svg>
    </span>
  );
}
