// Guarantees a promise settles within `ms`. On timeout it REJECTS so the caller's
// try/catch (and the route error boundary) fires — a hung DB/network call can never
// leave a page stuck on its loading skeleton.

export class TimeoutError extends Error {
  constructor(label: string) {
    super(`Timed out after waiting for: ${label}`);
    this.name = "TimeoutError";
  }
}

// Accepts a PromiseLike so Supabase/Postgrest query builders (thenables, not real
// Promises) can be wrapped directly without an extra await.
export function withTimeout<T>(promise: PromiseLike<T>, ms: number, label: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new TimeoutError(label)), ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (err) => {
        clearTimeout(timer);
        reject(err);
      },
    );
  });
}

/** Run a data loader with a hard timeout. On timeout/error it logs and rethrows,
 *  so the nearest error.tsx renders a recoverable "Something went wrong" screen
 *  instead of an endless skeleton. */
export async function loadOrThrow<T>(label: string, fn: () => Promise<T>, ms = 7000): Promise<T> {
  try {
    return await withTimeout(fn(), ms, label);
  } catch (err) {
    console.error(`[loadOrThrow] ${label} failed`, err instanceof Error ? err.message : err);
    throw err;
  }
}
