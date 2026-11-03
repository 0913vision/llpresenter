import {
  MAX_OVERLAY_TIMER_MS,
  noticeStopDelay,
} from '@core/overlays/noticeClock';
import type {SingleLiveCommand} from '@core/live/commands';
import type {LiveStore} from './store';

/**
 * Stops a running 공지 whose every image left the library at the end of the
 * interval of the image on screen. It runs at most one main-process timer and
 * sends the same `notice.stop` as the 정지 button.
 *
 * @returns A function that stops following.
 */
export function followNoticeEnd(options: {
  readonly store: Pick<LiveStore, 'state' | 'subscribe'>;
  readonly send: (command: SingleLiveCommand) => void;
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
    const playback = options.store.state.layers.notice?.playback;
    if (playback === undefined) return;
    const delay = noticeStopDelay(playback, options.now());
    if (delay === null) return;
    const early = delay > MAX_OVERLAY_TIMER_MS;
    timer = setTimeout(
      () => {
        timer = null;
        if (disposed) return;
        if (
          !early &&
          options.store.state.layers.notice?.playback === playback
        ) {
          options.send({type: 'notice.stop'});
        }
        schedule();
      },
      Math.min(MAX_OVERLAY_TIMER_MS, delay),
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
