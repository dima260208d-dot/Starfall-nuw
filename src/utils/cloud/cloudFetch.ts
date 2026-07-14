/** Обёртка с таймаутом для облачных запросов. */
export async function withCloudTimeout<T>(
  promise: Promise<T>,
  ms = 12_000,
  label = "cloud",
): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | null = null;
  try {
    return await Promise.race([
      promise,
      new Promise<T>((_, reject) => {
        timer = setTimeout(() => {
          reject(new Error(`${label}: timeout after ${ms}ms`));
        }, ms);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

/** Как withCloudTimeout, но не бросает — для фоновой синхронизации. */
export async function tryCloudTimeout<T>(
  promise: Promise<T>,
  ms = 12_000,
  label = "cloud",
): Promise<{ ok: true; value: T } | { ok: false; error: string }> {
  try {
    const value = await withCloudTimeout(promise, ms, label);
    return { ok: true, value };
  } catch (e) {
    const error = e instanceof Error ? e.message : String(e);
    return { ok: false, error };
  }
}
