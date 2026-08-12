import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { RouterProvider } from '@tanstack/react-router';
import { useState } from 'react';

import { RepositoryProvider } from '@/app/repository-provider';
import { router } from '@/app/router';
import { useThemeEffect } from '@/app/theme';

export function AppProviders(): React.JSX.Element {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: { staleTime: 30_000, refetchOnWindowFocus: false },
        },
      }),
  );
  useThemeEffect();

  return (
    <QueryClientProvider client={queryClient}>
      <RepositoryProvider>
        <RouterProvider router={router} />
      </RepositoryProvider>
    </QueryClientProvider>
  );
}
