import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

function Probe(): React.JSX.Element {
  return <p>cleanup-probe</p>;
}

// Two identical tests: without a global afterEach(cleanup), the second test's DOM still contains
// the first test's render and getAllByText finds two probes. Tests within a file run in order.
describe('global RTL cleanup', () => {
  it('renders the probe exactly once', () => {
    render(<Probe />);
    expect(screen.getAllByText('cleanup-probe')).toHaveLength(1);
  });

  it('starts from a clean DOM because the shared setup file ran cleanup', () => {
    render(<Probe />);
    expect(screen.getAllByText('cleanup-probe')).toHaveLength(1);
  });
});
