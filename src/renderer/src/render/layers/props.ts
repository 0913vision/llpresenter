import {MAX_ACTIVE_PROPS} from '@shared/schema/overlayState';
import {classes} from '../classes';
import {defineLayer} from '../layer';
import {OverlayImageView} from '../overlayImage';
import type {TimerNow} from '@shared/timerClock';
import type {LyricStyle} from '../lyricStyle';
import {OverlayTextView} from '../overlayText';
import {
  fillTimerTokens,
  hasTickingToken,
  type RenderTimers,
} from '../timerTokens';

const TIMER_TICK_MS = 1000;
const NO_TIMERS: RenderTimers = {
  list: [],
  runs: undefined,
  now: () => ({
    timer: performance.timeOrigin + performance.now(),
    wall: Date.now(),
  }),
};

interface PropView {
  readonly box: HTMLElement;
  readonly text: OverlayTextView;
  readonly image: OverlayImageView;
  id: string | null;
  template: string | null;
}

export const propsLayer = defineLayer({
  kind: 'prop',
  order: 2,
  look: 'prop',
  create: (parent, options) => {
    const pool: PropView[] = [];
    let scale = 1;
    let timers = NO_TIMERS;
    let ticker: ReturnType<typeof setInterval> | null = null;
    const tick = (): void => {
      const now = timers.now();
      for (const view of pool) {
        if (view.template === null) continue;
        view.text.replace(fillTimerTokens(view.template, timers, now));
      }
    };
    // NOTE(0913vision): One interval per window redraws 타이머 values from
    // the shared clock, so main sends nothing per second.
    const showText = (
      view: PropView,
      {text, style}: {readonly text: string; readonly style: LyricStyle},
      now: TimerNow,
    ): void => {
      const filled = fillTimerTokens(text, timers, now);
      if (view.template === text) view.text.replace(filled, style);
      else view.text.show(filled, style);
      view.template = text;
    };
    const followTicking = (): void => {
      const ticking = pool.some(
        ({template}) => template !== null && hasTickingToken(template, timers),
      );
      if (ticking && ticker === null) {
        ticker = setInterval(tick, TIMER_TICK_MS);
      } else if (!ticking && ticker !== null) {
        clearInterval(ticker);
        ticker = null;
      }
    };
    const acquire = (): PropView => {
      const box = document.createElement('div');
      box.className = classes.layer;
      const view = {
        box,
        text: new OverlayTextView(box),
        image: new OverlayImageView(box, options),
        id: null,
        template: null,
      };
      view.text.rescale(scale);
      parent.append(box);
      pool.push(view);
      return view;
    };
    return {
      render: (layers, frame) => {
        timers = frame?.timers ?? NO_TIMERS;
        const now = timers.now();
        const id = frame?.screen?.id;
        const items =
          layers.prop?.items
            ?.slice(0, MAX_ACTIVE_PROPS)
            .filter(item => id !== undefined && item.targets.includes(id)) ??
          [];
        for (const view of pool) {
          if (items.some(item => item.propId === view.id)) continue;
          view.id = null;
          view.template = null;
          view.text.show(null);
          view.image.show(null);
          view.box.hidden = true;
        }
        for (const [index, item] of items.entries()) {
          const view =
            pool.find(view => view.id === item.propId) ??
            pool.find(view => view.id === null) ??
            acquire();
          view.id = item.propId;
          view.box.hidden = false;
          view.box.style.zIndex = String(index);
          if (item.content.kind === 'text') {
            view.image.show(null);
            showText(view, item.content, now);
          } else {
            view.template = null;
            view.text.show(null);
            view.image.show(item.content.media);
          }
        }
        followTicking();
      },
      rescale: next => {
        scale = next;
        for (const view of pool) view.text.rescale(scale);
      },
      dispose: () => {
        if (ticker !== null) clearInterval(ticker);
        ticker = null;
        for (const view of pool) {
          view.text.dispose();
          view.image.dispose();
          view.box.remove();
        }
        pool.length = 0;
      },
    };
  },
});
