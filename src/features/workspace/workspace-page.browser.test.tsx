import { fireEvent, screen, waitFor } from '@testing-library/react';
import { page } from '@vitest/browser/context';
import { describe, expect, it } from 'vitest';

import { challenge as hoverLiftChallenge } from '@/challenges/css-transitions/hover-lift';
import { useWorkspaceStore } from '@/stores';
import { renderApp } from '@/test/app-harness';

const HOVER_LIFT = '/challenges/css-transitions/hover-lift';
const HOVER_LIFT_ID = 'css-transitions/hover-lift';

describe('workspace desktop layout', () => {
  it('renders three panes with two keyboard-resizable separators persisting to the store', async () => {
    await page.viewport(1280, 800);
    renderApp({ path: HOVER_LIFT });
    await screen.findByRole('button', { name: 'Submit' });
    const separators = screen.getAllByRole('separator');
    expect(separators).toHaveLength(2);
    const first = separators[0];
    if (first === undefined) throw new Error('missing separator');
    first.focus();
    fireEvent.keyDown(first, { key: 'ArrowRight' });
    await waitFor(() => expect(useWorkspaceStore.getState().paneSizes[0]).toBeCloseTo(30, 5));
  });

  it('Run mounts the submission into the visible preview frame without recording an attempt', async () => {
    await page.viewport(1280, 800);
    const { repository } = renderApp({ path: HOVER_LIFT });
    fireEvent.click(await screen.findByRole('button', { name: 'Run' }));
    const yours = await screen.findByLabelText('Your output');
    // The iframe element exists before Run — the discriminating fact is the MOUNTED starter markup
    // (allow-same-origin sandbox, so the stage is inspectable):
    await waitFor(
      () => {
        const iframe = yours.querySelector('iframe');
        expect(iframe?.contentDocument?.querySelector('.card')).toBeTruthy();
      },
      { timeout: 20_000 },
    );
    expect(await repository.listAttempts(HOVER_LIFT_ID)).toHaveLength(0);
  }, 40_000);

  it('END-TO-END: submitting the starter records a failing attempt with hinted failures and announces it', async () => {
    await page.viewport(1280, 800);
    const { repository } = renderApp({ path: HOVER_LIFT });
    fireEvent.click(await screen.findByRole('button', { name: 'Submit' }));
    await waitFor(
      async () => {
        const attempts = await repository.listAttempts(HOVER_LIFT_ID);
        expect(attempts).toHaveLength(1);
      },
      { timeout: 30_000 },
    );
    const attempts = await repository.listAttempts(HOVER_LIFT_ID);
    expect(attempts[0]?.passed).toBe(false);
    expect(attempts[0]?.failures.length).toBeGreaterThan(0);
    expect(attempts[0]?.failures[0]?.hint).toBeTruthy();
    const progress = await repository.listProgress();
    expect(progress.find((record) => record.challengeId === HOVER_LIFT_ID)?.status).toBe('attempted');
    const status = screen.getByRole('status');
    expect(status.textContent).toContain('Submission failed');
    expect(screen.getAllByText(/checks passed/i).length).toBeGreaterThan(0);
  }, 60_000);

  it('Reset restores starter files after an edit; Clear also downgrades the record', async () => {
    await page.viewport(1280, 800);
    const { repository } = renderApp({ path: HOVER_LIFT });
    // renderApp resets stores, so seed the draft after render; the assertions below check the
    // STORE, which Reset must rewrite regardless of what the editor showed at mount:
    useWorkspaceStore.getState().setDraftFile(HOVER_LIFT_ID, 'styles.css', '/* edited */');
    fireEvent.click(await screen.findByRole('button', { name: 'Reset' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Reset files' }));
    await waitFor(() => {
      const drafts = useWorkspaceStore.getState().byChallenge[HOVER_LIFT_ID]?.draftFiles ?? {};
      expect(drafts['styles.css']).not.toBe('/* edited */');
    });
    fireEvent.click(screen.getByRole('button', { name: 'Clear' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Clear and mark unsolved' }));
    await waitFor(async () => {
      const progress = await repository.listProgress();
      expect(progress.find((record) => record.challengeId === HOVER_LIFT_ID)?.status).toBe('unsolved');
    });
  }, 40_000);

  it('Reset never touches an already-solved progress record; Clear downgrades it but keeps attempts and resets workspace UI state', async () => {
    await page.viewport(1280, 800);
    const { repository } = renderApp({ path: HOVER_LIFT });

    // Seed a SOLVED record with attempt history directly through the harness repository, bypassing
    // the UI entirely — Reset must leave this completely untouched (draft-only semantics); only
    // Clear may downgrade it.
    const seededAt = new Date().toISOString();
    await repository.addAttempt({
      id: 'seed-attempt-1',
      challengeId: HOVER_LIFT_ID,
      createdAt: seededAt,
      passed: true,
      failures: [],
      durationMs: 120,
    });
    await repository.upsertProgress({
      id: HOVER_LIFT_ID,
      challengeId: HOVER_LIFT_ID,
      status: 'solved',
      solveQuality: 'clean',
      attempts: 1,
      hintsRevealed: 0,
      firstSolvedAt: seededAt,
      lastAttemptAt: seededAt,
      updatedAt: seededAt,
    });

    // Seed workspace UI state (revealed hint, spoiler shown, an edited draft) so Clear's UI reset
    // is observable, and so Reset's promise to leave the record alone is tested against a record
    // that would visibly change if Reset ever called recordClear.
    useWorkspaceStore.getState().revealNextHint(HOVER_LIFT_ID);
    useWorkspaceStore.getState().setSpoilerShown(HOVER_LIFT_ID, true);
    useWorkspaceStore.getState().setDraftFile(HOVER_LIFT_ID, 'styles.css', '/* edited */');

    fireEvent.click(await screen.findByRole('button', { name: 'Reset' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Reset files' }));
    await waitFor(() => {
      const drafts = useWorkspaceStore.getState().byChallenge[HOVER_LIFT_ID]?.draftFiles ?? {};
      expect(drafts['styles.css']).toBe(hoverLiftChallenge.starter['styles.css']);
    });

    // Reset must leave the progress record and attempt history completely untouched.
    const afterReset = await repository.listProgress();
    const afterResetRecord = afterReset.find((record) => record.challengeId === HOVER_LIFT_ID);
    expect(afterResetRecord?.status).toBe('solved');
    expect(afterResetRecord?.solveQuality).toBe('clean');
    expect(afterResetRecord?.attempts).toBe(1);
    expect(afterResetRecord?.firstSolvedAt).toBe(seededAt);
    expect(await repository.listAttempts(HOVER_LIFT_ID)).toHaveLength(1);

    fireEvent.click(screen.getByRole('button', { name: 'Clear' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Clear and mark unsolved' }));
    await waitFor(async () => {
      const progress = await repository.listProgress();
      expect(progress.find((record) => record.challengeId === HOVER_LIFT_ID)?.status).toBe('unsolved');
    });

    // Clear downgrades the record but keeps attempt history (spec: attempts kept).
    const afterClear = await repository.listProgress();
    const afterClearRecord = afterClear.find((record) => record.challengeId === HOVER_LIFT_ID);
    expect(afterClearRecord?.solveQuality).toBeNull();
    expect(afterClearRecord?.attempts).toBe(1);
    expect(await repository.listAttempts(HOVER_LIFT_ID)).toHaveLength(1);

    // Clear also resets workspace UI state (hints accordion, spoiler flag) — the whole per-challenge
    // entry is gone, taking the seeded revealed hint, spoiler flag, and draft with it.
    expect(useWorkspaceStore.getState().byChallenge[HOVER_LIFT_ID]).toBeUndefined();
  }, 40_000);
});

describe('workspace mobile layout (390px)', () => {
  it('shows the segmented pane tab bar and the symbol toolbar, keeping panes mounted across switches', async () => {
    await page.viewport(390, 844);
    renderApp({ path: HOVER_LIFT });
    const briefTab = await screen.findByRole('tab', { name: 'Brief' });
    expect(screen.getByRole('tab', { name: 'Editor' })).toBeTruthy();
    expect(screen.getByRole('tab', { name: 'Output' })).toBeTruthy();
    fireEvent.click(screen.getByRole('tab', { name: 'Editor' }));
    expect(await screen.findByRole('toolbar', { name: /editor symbols/i })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Submit' })).toBeTruthy();
    fireEvent.click(briefTab);
    // The editor pane stays mounted (parity: no state loss when flipping tabs). It is hidden from
    // the accessibility tree while inactive, so assert against the DOM, not a role query:
    expect(document.querySelector('[role="toolbar"]')).toBeTruthy();
    await page.viewport(1280, 800);
  }, 40_000);
});
