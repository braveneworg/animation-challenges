import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import type { RubricItem } from '@/challenges/types';
import { ResultsPanel, rubricConfirmationSchema, type ResultsPanelProps } from '@/features/workspace/ResultsPanel';
import { makeChallenge } from '@/test/challenge-fixture';

const rubric: RubricItem[] = [
  { id: 'feel', label: 'Feels springy', detail: 'Overshoots once, then settles' },
  { id: 'calm', label: 'Respects reduced motion' },
];

function renderPanel(overrides: Partial<ResultsPanelProps> = {}): { confirmed: number[]; failed: RubricItem[][] } {
  const confirmed: number[] = [];
  const failed: RubricItem[][] = [];
  const props: ResultsPanelProps = {
    challenge: makeChallenge('css-transitions/fixture'),
    report: null,
    summary: null,
    awaitingRubric: false,
    onConfirmRubric: () => confirmed.push(1),
    onRecordRubricFail: (unchecked) => failed.push([...unchecked]),
    ...overrides,
  };
  render(<ResultsPanel {...props} />);
  return { confirmed, failed };
}

describe('rubricConfirmationSchema', () => {
  it('accepts only a fully confirmed rubric', () => {
    const schema = rubricConfirmationSchema(rubric);
    expect(schema.safeParse({ checkedIds: ['feel', 'calm'] }).success).toBe(true);
    expect(schema.safeParse({ checkedIds: ['feel'] }).success).toBe(false);
    expect(schema.safeParse({ checkedIds: [] }).success).toBe(false);
  });
});

describe('ResultsPanel', () => {
  it('shows failures with hints and actual/expected values', () => {
    renderPanel({
      summary: {
        passed: false,
        failures: [
          { message: 'The card should rise', hint: 'Use transform', actual: 'matrix(1,0,0,1,0,0)', expected: 'a lift' },
        ],
        durationMs: 200,
        completedAt: '2026-08-10T00:00:00.000Z',
      },
      report: {
        challengeId: 'css-transitions/fixture',
        passed: false,
        assertions: [
          { ok: true, message: 'exists', hint: 'h', actual: null, expected: null },
          {
            ok: false,
            message: 'The card should rise',
            hint: 'Use transform',
            actual: 'matrix(1,0,0,1,0,0)',
            expected: 'a lift',
          },
        ],
        threw: null,
        timedOut: false,
        durationMs: 200,
      },
    });
    expect(screen.getByText(/1 of 2 checks passed/i)).toBeTruthy();
    expect(screen.getByText('The card should rise')).toBeTruthy();
    expect(screen.getByText(/use transform/i)).toBeTruthy();
    expect(screen.getByText(/matrix\(1,0,0,1,0,0\)/)).toBeTruthy();
  });

  it('shows a pass with the grade-mode badge', () => {
    renderPanel({
      summary: { passed: true, failures: [], durationMs: 150, completedAt: '2026-08-10T00:00:00.000Z' },
    });
    expect(screen.getByText(/passed/i)).toBeTruthy();
    expect(screen.getByText('Auto-graded')).toBeTruthy();
  });

  it('blocks rubric confirmation until every box is checked, then confirms', async () => {
    const { confirmed } = renderPanel({
      challenge: makeChallenge('css-transitions/fixture', { gradeMode: 'rubric', rubric }),
    });
    fireEvent.click(screen.getByRole('button', { name: /confirm rubric/i }));
    expect(await screen.findByRole('alert')).toBeTruthy();
    expect(confirmed).toHaveLength(0);
    fireEvent.click(screen.getByRole('checkbox', { name: /feels springy/i }));
    fireEvent.click(screen.getByRole('checkbox', { name: /respects reduced motion/i }));
    // shouldValidate on setValue clears the stale error reactively, without needing a second submit.
    await waitFor(() => expect(screen.queryByRole('alert')).toBeNull());
    fireEvent.click(screen.getByRole('button', { name: /confirm rubric/i }));
    await screen.findByRole('button', { name: /confirm rubric/i });
    expect(confirmed).toHaveLength(1);
  });

  it('records unchecked items as a failed self-assessment', () => {
    const { failed } = renderPanel({
      challenge: makeChallenge('css-transitions/fixture', { gradeMode: 'rubric', rubric }),
    });
    fireEvent.click(screen.getByRole('checkbox', { name: /feels springy/i }));
    fireEvent.click(screen.getByRole('button', { name: /record as not passed/i }));
    expect(failed).toHaveLength(1);
    expect(failed[0]?.map((item) => item.id)).toEqual(['calm']);
  });

  it('gates the hybrid rubric behind a grader pass', () => {
    renderPanel({
      challenge: makeChallenge('css-transitions/fixture', { gradeMode: 'hybrid', rubric }),
      awaitingRubric: false,
    });
    const confirm = screen.getByRole('button', { name: /confirm rubric/i });
    expect(confirm.hasAttribute('disabled')).toBe(true);
  });
});
