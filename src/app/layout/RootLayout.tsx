import { Link, Outlet } from '@tanstack/react-router';

const NAV_ITEMS: ReadonlyArray<{ to: string; label: string }> = [
  { to: '/', label: 'Dashboard' },
  { to: '/challenges', label: 'Challenges' },
  { to: '/progress', label: 'Progress' },
  { to: '/settings', label: 'Settings' },
];

export function RootLayout(): React.JSX.Element {
  return (
    <div className="bg-background text-foreground min-h-dvh">
      <header className="border-border border-b">
        <nav aria-label="Main" className="mx-auto flex max-w-5xl flex-wrap gap-4 px-4 py-3">
          {NAV_ITEMS.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              className="text-muted-foreground hover:text-foreground text-sm font-medium transition-colors"
              activeProps={{ className: 'text-foreground text-sm font-medium' }}
              activeOptions={{ exact: item.to === '/' }}
            >
              {item.label}
            </Link>
          ))}
        </nav>
      </header>
      <main className="mx-auto max-w-5xl px-4 py-8">
        <Outlet />
      </main>
    </div>
  );
}
