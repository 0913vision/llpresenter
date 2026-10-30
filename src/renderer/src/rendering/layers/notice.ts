import {
  MAX_OVERLAY_TIMER_MS,
  nextNoticeChange,
  noticePosition,
} from '@core/overlays/noticeClock';
import {defineLayer} from '../layer';
import {OverlayImageView} from '../overlayImage';
import type {NoticePlayback} from '@core/live/state';

export const noticeLayer = defineLayer({
  kind: 'notice',
  order: 5,
  look: 'notice',
  create: (parent, options) => {
    const view = new OverlayImageView(parent, options);
    let playback: NoticePlayback | null = null;
    let held: {source: NoticePlayback; playback: NoticePlayback} | null = null;
    let timer: ReturnType<typeof setTimeout> | null = null;
    let disposed = false;
    const stopTimer = (): void => {
      if (timer !== null) clearTimeout(timer);
      timer = null;
    };
    const show = (id: string | null): void => {
      try {
        view.show(id);
      } catch (error) {
        options.onError('could not draw the notice layer', error);
      }
    };
    const draw = (): void => {
      stopTimer();
      if (disposed || playback === null) {
        show(null);
        return;
      }
      const now = Date.now();
      show(playback.media[noticePosition(playback, now)] ?? null);
      const delay = nextNoticeChange(playback, now);
      if (delay !== null) {
        timer = setTimeout(draw, Math.min(delay, MAX_OVERLAY_TIMER_MS));
      }
    };
    return {
      render: (layers, frame) => {
        let candidate = layers.notice?.playback;
        if (
          candidate !== undefined &&
          frame?.clearOpacity?.notice !== undefined
        ) {
          if (held?.source !== candidate) {
            held = {
              source: candidate,
              playback: {
                ...candidate,
                pausedAt: candidate.pausedAt ?? Date.now(),
              },
            };
          }
          candidate = held.playback;
        } else held = null;
        const next =
          frame?.screen !== undefined &&
          candidate?.targets.includes(frame.screen.id)
            ? candidate
            : null;
        if (next === playback) return;
        playback = next;
        draw();
      },
      dispose: () => {
        disposed = true;
        stopTimer();
        view.dispose();
      },
    };
  },
});
