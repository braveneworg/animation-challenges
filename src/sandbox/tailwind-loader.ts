import { forEachStep } from '@/sandbox/sequence';

/** Bounded wait for the Tailwind JIT: ~4s of frames at 60Hz before giving up (grader assertions then fail loudly). */
const MAX_PROBE_FRAMES = 240;

let loadPromise: Promise<void> | null = null;
let probeCounter = 0;

/**
 * Loads `@tailwindcss/browser` exactly once and guarantees a `text/tailwindcss` input stylesheet
 * exists (spec §6.2: only challenges whose `tech` includes `tailwind` pay for it — the harness
 * gates on `wantsTailwind`). Call BEFORE injecting the payload's styles and markup, so the
 * library's mutation observer is watching when they arrive.
 */
export async function loadTailwind(doc: Document): Promise<void> {
  if (doc.querySelector('style[data-ac-tw-input]') === null) {
    const input = doc.createElement('style');
    input.setAttribute('type', 'text/tailwindcss');
    input.setAttribute('data-ac-tw-input', '');
    input.textContent = "@import 'tailwindcss';";
    doc.head.append(input);
  }
  loadPromise = loadPromise ?? import('@tailwindcss/browser').then(() => undefined);
  await loadPromise;
}

/**
 * Bounded wait for a JIT compile pass that covers everything injected before this call. The probe
 * class carries a UNIQUE arbitrary value per call (`mt-[<n>px]`), so it can only compute once a
 * compile pass triggered after the probe's own insertion has landed — and because the JIT batches
 * mutations, that pass also covers all earlier injections. A recycled probe class ('hidden') would
 * pass instantly from the previous compile and prove nothing about THIS payload.
 *
 * Guarantee is bounded, not absolute: classes added later (a React render, grader-driven DOM work)
 * need a subsequent call — the harness re-invokes this (and re-applies the idempotent media flip
 * and hover rewrite) after the entry module runs.
 */
export async function waitForTailwind(doc: Document, nativeNextFrame: () => Promise<void>): Promise<void> {
  probeCounter += 1;
  const px = 100_000 + probeCounter; // far outside any plausible challenge value, unique per call
  const probe = doc.createElement('div');
  probe.className = `mt-[${px}px]`;
  probe.setAttribute('data-ac-tw-probe', '');
  doc.body.append(probe);
  try {
    let compiled = false;
    await forEachStep(MAX_PROBE_FRAMES, async () => {
      const win = doc.defaultView;
      if (win !== null && win.getComputedStyle(probe).marginTop === `${px}px`) {
        compiled = true;
        return false; // early stop — a compiled probe must not burn the remaining frames
      }
      await nativeNextFrame();
      return undefined;
    });
    if (!compiled) {
      console.warn('tailwind did not compile within the probe budget; utility classes may be unstyled');
    }
  } finally {
    probe.remove();
  }
}
