import { Link, Outlet } from '@tanstack/react-router';

const NAV_ITEMS: ReadonlyArray<{ to: string; label: string }> = [
  { to: '/', label: 'Dashboard' },
  { to: '/challenges', label: 'Challenges' },
  { to: '/progress', label: 'Progress' },
  { to: '/settings', label: 'Settings' },
];

export function RootLayout(): React.JSX.Element {
  return (
    <div className="bg-background text-foreground flex min-h-dvh flex-col">
      <a
        href="#main"
        className="bg-background focus:ring-ring sr-only focus:not-sr-only focus:absolute focus:z-50 focus:m-2 focus:rounded-md focus:px-3 focus:py-2 focus:ring-2"
      >
        Skip to main content
      </a>
      <header className="border-border border-b">
        <nav aria-label="Main" className="mx-auto flex w-full max-w-7xl flex-wrap gap-4 px-4 py-3">
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
      <main id="main" className="min-h-0 w-full flex-1 px-4 py-6">
        <Outlet />
      </main>
    </div>
  );
}
