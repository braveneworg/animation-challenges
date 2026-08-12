import { describe, expect, it } from 'vitest';

import { NotFoundScreen } from '@/app/NotFoundScreen';
import { RouteErrorScreen } from '@/app/RouteErrorScreen';
import { router } from '@/app/router';

describe('router wiring', () => {
  it('registers the not-found screen as the default not-found component', () => {
    expect(router.options.defaultNotFoundComponent).toBe(NotFoundScreen);
  });

  it('registers the error screen as the default error component', () => {
    expect(router.options.defaultErrorComponent).toBe(RouteErrorScreen);
  });
});
