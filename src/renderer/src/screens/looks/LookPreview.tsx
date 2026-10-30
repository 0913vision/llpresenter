import {
  useEffect,
  useEffectEvent,
  useLayoutEffect,
  useRef,
  type JSX,
} from 'react';
import {emptyLayers} from '@core/live/state';
import {mediaUrl} from '@contracts/ipc/media';
import type {Timer} from '@core/schema/timers';
import {DEFAULT_LYRIC_STYLE} from '@renderer/render/lyricStyle';
import {MainTimerClock} from '@renderer/render/mainTimerClock';
import {OutputRenderer} from '@renderer/render/outputRenderer';
import {useLive} from '@renderer/platform/live';
import {lookPreviewFrame, type LookPreviewInput} from './lookPreviewFrame';
import styles from './LookPreview.module.css';

const noLayers = emptyLayers();

function drawingError(message: string, cause: unknown): void {
  window.llp?.log.write({
    level: 'error',
    message,
    detail: cause instanceof Error ? cause.message : String(cause),
  });
}

/** Reuses output layers for a Look under edit without changing the main-owned live state. */
export function LookPreview(
  props: Omit<LookPreviewInput, 'state'> & {readonly timers: readonly Timer[]},
): JSX.Element {
  const root = useRef<HTMLDivElement>(null);
  const renderer = useRef<OutputRenderer | null>(null);
  const clock = useRef<MainTimerClock | null>(null);
  const draw = useEffectEvent((): void => {
    const state = useLive.getState().state;
    const frame = lookPreviewFrame({...props, state});
    renderer.current?.render(state?.layers ?? noLayers, {
      ...frame,
      ...(clock.current === null
        ? {}
        : {
            timers: {
              list: props.timers,
              runs: state?.timers,
              now: clock.current.now,
            },
          }),
    });
  });
  useLayoutEffect(() => {
    draw();
  }, [
    props.screen,
    props.lookId,
    props.looks,
    props.stageLayouts,
    props.timers,
  ]);
  useEffect(() => {
    if (root.current === null) return undefined;
    const instance = new OutputRenderer(root.current, {
      lyricStyle: DEFAULT_LYRIC_STYLE,
      mediaUrl,
      onError: drawingError,
      mode: 'preview',
    });
    renderer.current = instance;
    const api = window.llp;
    clock.current =
      api === undefined
        ? null
        : new MainTimerClock(() => api.live.clock(), drawingError);
    draw();
    const stop = useLive.subscribe((next, previous) => {
      if (next.state !== previous.state) draw();
    });
    return () => {
      stop();
      instance.dispose();
      renderer.current = null;
      clock.current = null;
    };
  }, []);
  return (
    <div
      className={styles.frame}
      aria-label={`${props.screen.name} Look 미리보기`}
      ref={root}
    />
  );
}
