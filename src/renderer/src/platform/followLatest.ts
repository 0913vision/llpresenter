/** A value main keeps: its first read, and its pushes from then on. */
export interface LatestSource<T> {
  readonly read: () => Promise<T>;
  readonly subscribe: (listener: (value: T) => void) => () => void;
}

/**
 * Follows a value main keeps: every push, and the first read unless a push
 * came first, because a push is newer than the read, whose reply can arrive
 * after it. `failed` hears a read that failed, with whether a push had come.
 * Nothing is applied or reported after the returned stop.
 *
 * @returns A function that stops following it. Always call it.
 */
export function followLatest<T>(
  source: LatestSource<T>,
  {
    apply,
    failed,
  }: {
    readonly apply: (value: T) => void;
    readonly failed?: ((cause: unknown, pushed: boolean) => void) | undefined;
  },
): () => void {
  let active = true;
  let pushed = false;
  const stop = source.subscribe(value => {
    if (!active) return;
    pushed = true;
    apply(value);
  });
  source.read().then(
    value => {
      if (active && !pushed) apply(value);
    },
    (cause: unknown) => {
      if (active) failed?.(cause, pushed);
    },
  );
  return () => {
    active = false;
    stop();
  };
}
