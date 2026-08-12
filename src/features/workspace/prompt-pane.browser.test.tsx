import { fireEvent, screen, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { getChallenge } from '@/challenges/registry';
import { PromptPane } from '@/features/workspace/PromptPane';
import { renderWithProviders } from '@/test/app-harness';

function hoverLift(): NonNullable<ReturnType<typeof getChallenge>> {
  const challenge = getChallenge('css-transitions/hover-lift');
  if (challenge === undefined) throw new Error('hover-lift missing from the registry');
  return challenge;
}

describe('PromptPane', () => {
  it('renders the brief as markdown and the goals verbatim', async () => {
    const challenge = hoverLift();
    renderWithProviders(<PromptPane challenge={challenge} />);
    expect(await screen.findByRole('heading', { name: challenge.title })).toBeTruthy();
    const goals = screen.getByRole('list', { name: /goals/i });
    expect(goals.textContent).toContain(challenge.goals[0] ?? '');
  });

  it('reveals hints one at a time, records each reveal, and clamps at the end', async () => {
    const challenge = hoverLift();
    const { repository } = renderWithProviders(<PromptPane challenge={challenge} />);
    const total = challenge.hints.length;
    const button = await screen.findByRole('button', { name: `Reveal hint 1 of ${total}` });
    fireEvent.click(button);
    expect(
      await screen.findByRole('button', { name: total > 1 ? `Reveal hint 2 of ${total}` : 'All hints revealed' }),
    ).toBeTruthy();
    await waitFor(async () => {
      const progress = await repository.listProgress();
      expect(progress.find((record) => record.challengeId === challenge.id)?.hintsRevealed).toBe(1);
    });
    for (let index = 1; index < total; index += 1) {
      fireEvent.click(screen.getByRole('button', { name: /reveal hint/i }));
    }
    const finished = await screen.findByRole('button', { name: 'All hints revealed' });
    expect(finished.hasAttribute('disabled')).toBe(true);
  });

  it('reveals the solution read-only with the explanation and stamps viewedSolutionAt', async () => {
    const challenge = hoverLift();
    const { repository } = renderWithProviders(<PromptPane challenge={challenge} />);
    fireEvent.click(await screen.findByRole('button', { name: /reveal solution/i }));
    expect(await screen.findByRole('heading', { name: /solution/i })).toBeTruthy();
    const readOnlyEditors = await screen.findAllByRole('textbox');
    expect(readOnlyEditors.length).toBeGreaterThan(0);
    expect(readOnlyEditors[0]?.getAttribute('contenteditable')).toBe('false');
    await waitFor(async () => {
      const progress = await repository.listProgress();
      expect(progress.find((record) => record.challengeId === challenge.id)?.viewedSolutionAt).toBeTruthy();
    });
  });

  it('saves a note through the repository', async () => {
    const challenge = hoverLift();
    const { repository } = renderWithProviders(<PromptPane challenge={challenge} />);
    fireEvent.click(await screen.findByRole('button', { name: /^notes$/i }));
    const textarea = await screen.findByLabelText(/your notes/i);
    fireEvent.change(textarea, { target: { value: 'transition transform + box-shadow' } });
    fireEvent.click(screen.getByRole('button', { name: /save note/i }));
    await waitFor(async () => {
      const note = await repository.getNote(challenge.id);
      expect(note?.body).toBe('transition transform + box-shadow');
    });
  });
});
