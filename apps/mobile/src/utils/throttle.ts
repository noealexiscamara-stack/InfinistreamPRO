/**
 * Invokes `fn` at most once per `intervalMs` (plus always the last call if flushed).
 * Used so import progress does not re-render React on every SQLite batch.
 */
export function createThrottledCallback<T extends unknown[]>(
  fn: ((...args: T) => void) | undefined,
  intervalMs = 1000
): ((...args: T) => void) & { flush: () => void } {
  if (!fn) {
    const noop = Object.assign((() => undefined) as (...args: T) => void, { flush: () => undefined });
    return noop;
  }

  let lastMs = 0;
  let pending: T | null = null;
  let timer: ReturnType<typeof setTimeout> | null = null;

  const flush = () => {
    if (timer) {
      clearTimeout(timer);
      timer = null;
    }
    if (pending) {
      const args = pending;
      pending = null;
      lastMs = Date.now();
      fn(...args);
    }
  };

  const wrapped = (...args: T) => {
    pending = args;
    const now = Date.now();
    if (now - lastMs >= intervalMs) {
      flush();
      return;
    }
    if (!timer) {
      timer = setTimeout(flush, intervalMs - (now - lastMs));
    }
  };

  return Object.assign(wrapped, { flush });
}
