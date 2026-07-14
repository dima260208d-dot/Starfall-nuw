/** When true, party/profile battle writes are suppressed (headless AI training sims). */
let headlessDepth = 0;

export function isHeadlessSim(): boolean {
  return headlessDepth > 0;
}

export function runHeadlessSim<T>(fn: () => T): T {
  headlessDepth += 1;
  try {
    return fn();
  } finally {
    headlessDepth -= 1;
  }
}
