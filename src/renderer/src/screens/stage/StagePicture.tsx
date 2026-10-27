import {useLayoutEffect, useRef, type JSX} from 'react';
import type {LiveState} from '@shared/live';
import {emptyLayers} from '@shared/live';
import type {StageLayout} from '@shared/schema/stageLayouts';
import type {Timer} from '@shared/schema/timers';
import {StageLayoutView} from '@renderer/render/stageLayout';
import {MainTimerClock} from '@renderer/render/mainTimerClock';
import {elementNames} from './stageEditor';
import styles from './StageCanvas.module.css';

/** Uses the output's stage renderer with sample text only where live content is absent. */
export function StagePicture({
  layout,
  live,
  timers,
}: {
  layout: StageLayout;
  live: LiveState | null;
  timers: readonly Timer[];
}): JSX.Element {
  const root = useRef<HTMLDivElement>(null);
  const view = useRef<StageLayoutView | null>(null);
  const clock = useRef<MainTimerClock | null>(null);
  useLayoutEffect(() => {
    const element = root.current;
    if (element === null) return undefined;
    const report = (message: string, cause: unknown): void => {
      window.llp?.log.write({
        level: 'error',
        message,
        detail: cause instanceof Error ? cause.message : String(cause),
      });
    };
    const renderer = new StageLayoutView(element, report);
    view.current = renderer;
    const api = window.llp;
    if (api !== undefined) {
      clock.current = new MainTimerClock(() => api.live.clock(), report);
    }
    const observer = new ResizeObserver(() => renderer.rescale());
    observer.observe(element);
    return () => {
      observer.disconnect();
      renderer.dispose();
      view.current = null;
      clock.current = null;
    };
  }, []);
  useLayoutEffect(() => {
    view.current?.render(live?.layers ?? emptyLayers(), {
      stage: {
        layout,
        samples: {...elementNames, timer: '00:00'},
        ...(live?.stageTimerId === undefined
          ? {}
          : {timerId: live.stageTimerId}),
      },
      stageMessage: live?.stageMessage ?? null,
      timers: {
        list: timers,
        runs: live?.timers,
        now: () =>
          clock.current?.now() ?? {
            timer: performance.timeOrigin + performance.now(),
            wall: Date.now(),
          },
      },
    });
  }, [layout, live, timers]);
  return <div ref={root} className={styles.picture} aria-hidden="true" />;
}
