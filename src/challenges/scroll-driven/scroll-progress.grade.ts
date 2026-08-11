import type { GradeContext } from '@/sandbox/grade-context';
import { pxNumber } from '@/sandbox/grader-utils';

/**
 * Grades `scroll-driven/scroll-progress`. Scroll-driven animations are scrubbed by scrolling, not
 * by the virtual clock: `ctx.scrollTo` waits the frames Chromium needs to restyle, and the grader
 * asserts computed state at three real scroll positions. It never calls `seek`/`settle` here — a
 * scroll timeline's currentTime is a percentage, and millisecond scrubbing does not apply.
 */
export async function grade(ctx: GradeContext): Promise<void> {
  const bar = ctx.query('.progress');
  if (bar === null) {
    throw new Error('the grader needs the `.progress` element from the starter markup — keep the class name');
  }

  const scroller = ctx.root.ownerDocument.scrollingElement;
  if (scroller === null) {
    throw new Error(
      'the sandbox document has no scrolling element — this indicates a harness regression, not a content bug',
    );
  }
  const maxScroll = scroller.scrollHeight - scroller.clientHeight;
  ctx.expect(maxScroll >= 1000, {
    message: 'The page has real room to scroll',
    hint: 'Keep the tall `.content` block — without overflow there is no progress to track.',
    actual: `${maxScroll}px of scrollable range`,
    expected: 'at least 1000px',
  });

  const timeline = ctx.computed(bar, 'animation-timeline');
  ctx.expect(timeline.startsWith('scroll('), {
    message: 'The bar is driven by a scroll() animation timeline',
    hint: 'After the `animation` shorthand, add `animation-timeline: scroll(root);` — order matters, the shorthand resets it.',
    actual: timeline,
    expected: "a value starting with 'scroll('",
  });

  const origin = ctx.computed(bar, 'transform-origin');
  ctx.expect(origin.startsWith('0px'), {
    message: 'The bar grows from the left edge',
    hint: 'Keep `transform-origin: 0 50%` — a centered origin makes the bar grow from the middle outward.',
    actual: origin,
    expected: 'an origin on the left edge (0px …)',
  });

  await ctx.scrollTo(0);
  const widthAtTop = pxNumber(ctx.computed(bar, 'width'));
  ctx.expectClose(ctx.matrix(bar).a, 0, 0.02, {
    message: 'At the top of the page the bar is at scaleX(0)',
    hint: 'The `from` keyframe (and the resting style) is `transform: scaleX(0)`.',
  });

  await ctx.scrollTo(maxScroll / 2);
  ctx.expectClose(ctx.matrix(bar).a, 0.5, 0.05, {
    message: 'Half-way down the page the bar is about half drawn',
    hint: 'Use `linear` timing — an eased curve makes the bar lie about reading progress.',
  });

  await ctx.scrollTo(maxScroll);
  ctx.expectClose(ctx.matrix(bar).a, 1, 0.02, {
    message: 'At the bottom the bar spans the full width',
    hint: 'The `to` keyframe is `transform: scaleX(1)`.',
  });
  ctx.expectClose(pxNumber(ctx.computed(bar, 'width')), widthAtTop, 0.5, {
    message: 'The width never animates — only the scale changes',
    hint: 'Grow with `transform: scaleX()`; animating `width` relayouts the page on every scrolled frame.',
  });
}
