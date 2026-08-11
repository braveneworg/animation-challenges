/**
 * Awaits `action(0) … action(count − 1)` strictly in order; an action resolving `false` stops the
 * remaining steps (bounded polling). Recursion, not a loop — `eslint(no-await-in-loop)` is an
 * error in this repo and disable comments are banned.
 */
export async function forEachStep(
  count: number,
  action: (index: number) => Promise<void | boolean>,
  index = 0,
): Promise<void> {
  if (index >= count) return;
  const outcome = await action(index);
  if (outcome === false) return;
  return forEachStep(count, action, index + 1);
}
