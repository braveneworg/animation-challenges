export interface Debounced<Args extends readonly unknown[]> {
  (...args: Args): void;
  flush(): void;
  cancel(): void;
}

/**
 * Trailing-edge debounce for the §6.6 autosave backstop: drafts persist shortly after every
 * keystroke so an infinite-loop hang never costs work. `flush` exists so unmount and Run/Submit
 * can force the pending write through.
 */
export function debounce<Args extends readonly unknown[]>(
  fn: (...args: Args) => void,
  waitMs: number,
): Debounced<Args> {
  let timer: ReturnType<typeof setTimeout> | null = null;
  let pendingArgs: Args | null = null;

  const invoke = (): void => {
    if (pendingArgs === null) return;
    const args = pendingArgs;
    pendingArgs = null;
    fn(...args);
  };

  const debounced = (...args: Args): void => {
    pendingArgs = args;
    if (timer !== null) clearTimeout(timer);
    timer = setTimeout(() => {
      timer = null;
      invoke();
    }, waitMs);
  };

  debounced.flush = (): void => {
    if (timer !== null) {
      clearTimeout(timer);
      timer = null;
    }
    invoke();
  };

  debounced.cancel = (): void => {
    if (timer !== null) {
      clearTimeout(timer);
      timer = null;
    }
    pendingArgs = null;
  };

  return debounced;
}
