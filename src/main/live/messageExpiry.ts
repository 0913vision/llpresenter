import type {MessageExpiry} from '@shared/schema/overlayState';
import type {LiveStore} from './store';
import {MAX_OVERLAY_TIMER_MS} from '@shared/noticeClock';

/** Runs at most one main-process timer, rechecking deadlines after early wakes. */
export function followMessageExpiry(options: {
  readonly store: LiveStore;
  readonly send: (command: MessageExpiry) => void;
  readonly now: () => number;
}): () => void {
  let disposed = false;
  let timer: ReturnType<typeof setTimeout> | null = null;
  const cancel = (): void => {
    if (timer !== null) clearTimeout(timer);
    timer = null;
  };
  const schedule = (): void => {
    cancel();
    if (disposed) return;
    const next =
      options.store.state.layers.message?.items?.reduce<MessageExpiry | null>(
        (first, item) =>
          item.expiresAt !== null &&
          (first === null || item.expiresAt < first.expiresAt)
            ? {
                type: 'message.expire',
                messageId: item.messageId,
                expiresAt: item.expiresAt,
              }
            : first,
        null,
      );
    if (next == null) return;
    timer = setTimeout(
      () => {
        timer = null;
        if (disposed) return;
        options.send(next);
        schedule();
      },
      Math.max(
        0,
        Math.min(MAX_OVERLAY_TIMER_MS, next.expiresAt - options.now()),
      ),
    );
  };
  const stop = options.store.subscribe(schedule);
  schedule();
  return () => {
    disposed = true;
    cancel();
    stop();
  };
}
