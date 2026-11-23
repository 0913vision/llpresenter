import {useLayoutEffect, useRef, type JSX} from 'react';
import {mediaUrl} from '@contracts/ipc/mediaUrls';
import {emptyLayers} from '@core/schema/live';
import {OutputRenderer} from '@renderer/rendering/outputRenderer';
import {previewMediaOf} from '@renderer/rendering/previewMedia';
import {ScreenFrames} from '@renderer/rendering/screenFrames';
import {useLive} from '@renderer/session/live';
import {classNames} from '@renderer/ui/classNames';
import styles from './ScreenPreview.module.css';

const noLayers = emptyLayers();

function reportDrawingError(message: string, error: unknown): void {
  const detail = error instanceof Error ? (error.stack ?? error.message) : '';
  window.llp?.log.write({level: 'error', message, detail});
}

/**
 * What a screen that is off would show now, drawn by the renderer of the
 * outputs: the slide and every layer over it, such as the clock, 무대
 * message, graphics, and messages, as still pictures.
 */
export function ScreenPreview({
  screenId,
  chroma,
}: {
  readonly screenId: string;
  readonly chroma: boolean;
}): JSX.Element {
  const host = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const api = window.llp;
    const parent = host.current;
    if (api === undefined || parent === null) return undefined;
    let stopped = false;
    const renderer = new OutputRenderer(parent, {
      mediaUrl,
      previewMedia: previewMediaOf(api),
      mode: 'preview',
      muted: true,
      onError: reportDrawingError,
    });
    const holder: {frames?: ScreenFrames} = {};
    const draw = (): void => {
      const {frames} = holder;
      if (stopped || frames === undefined) return;
      const live = useLive.getState().state;
      try {
        const frame = frames.frame(live);
        if (frame !== undefined) {
          renderer.render(live?.layers ?? noLayers, frame);
        }
      } catch (error) {
        reportDrawingError('could not update the screen preview', error);
      }
    };
    holder.frames = new ScreenFrames({
      fonts: api.fonts,
      settings: api.settings,
      clock: () => api.live.clock(),
      wallClock: api.live,
      screenId,
      onChange: draw,
      onError: reportDrawingError,
    });
    draw();
    const stopLive = useLive.subscribe((next, previous) => {
      if (next.state !== previous.state) draw();
    });
    return () => {
      stopped = true;
      stopLive();
      holder.frames?.dispose();
      renderer.dispose();
    };
  }, [screenId]);
  return (
    <div
      ref={host}
      className={classNames(styles.screen, chroma && styles.chroma)}
    />
  );
}
