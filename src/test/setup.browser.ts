import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';

// React Testing Library only self-registers cleanup when `globals: true` exposes afterEach —
// this project keeps globals off, so the browser project loads this file instead (Plan 01 carry-forward).
afterEach(() => {
  cleanup();
});
