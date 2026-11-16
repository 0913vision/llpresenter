import {useEffect, useRef, type JSX} from 'react';
import {emptyLayers} from '@core/live/state';
import {mediaUrl} from '@contracts/ipc/mediaUrls';
import {DEFAULT_TEXT_STYLE} from '@core/themes/textStyle';
import {OUTPUT_REVEAL_DEADLINE_MS} from '@core/output/revealDeadline';
import {OutputRenderer} from '@renderer/rendering/outputRenderer';
import {openPreviewMedia} from '@renderer/rendering/previewMedia';
import {ScreenFrames} from '@renderer/rendering/screenFrames';
import {useLive} from '@renderer/session/live';
import styles from './ScreenPreview.module.css';

const noLayers = emptyLayers();

function reportDrawingError(message: string, error: unknown): void {
  const detail = error instanceof Error ? (error.stack ?? error.message) : '';
  window.llp?.log.write({level: 'error', message, detail});
}

/**
 * The picture of one screen: the output renderer, scaled into its parent frame,
 * fed with the live layers. It draws what the live state holds, never the
 * selection, and a change of the live state does not render React.
 *
 * @param chroma - Draws the empty picture green, as the 방송 화면 does.
 */
export function ScreenPreview({
  screenId,
  chroma,
}: {
  readonly screenId: string;
  readonly chroma: boolean;
}): JSX.Element {
  const screenRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const screen = screenRef.current;
    if (!screen) return undefined;
    const previewMedia = openPreviewMedia(window.llp);
    interface View {
      host: HTMLDivElement;
      renderer: OutputRenderer;
      key: string;
    }
    let front: View | null = null;
    let pending: View | null = null;
    let animation = 0;
    let stopped = false;
    const dispose = (view: View | null): void => {
      view?.renderer.dispose();
      view?.host.remove();
    };
    let frames: ScreenFrames | null = null;
    const draw = (): void => {
      const state = useLive.getState().state;
      const layers = state?.layers ?? noLayers;
      try {
        const frame = frames?.frame(state);
        if (frame === undefined) return;
        const instant = {...frame, transitions: false};
        const key = JSON.stringify([layers, instant]);
        if (pending?.key === key || (pending === null && front?.key === key)) {
          return;
        }
        cancelAnimationFrame(animation);
        dispose(pending);
        pending = null;
        if (front?.key === key) return;
        const host = document.createElement('div');
        Object.assign(host.style, {
          position: 'absolute',
          inset: '0',
          visibility: 'hidden',
        });
        screen.append(host);
        const renderer = new OutputRenderer(host, {
          textStyle: DEFAULT_TEXT_STYLE,
          mediaUrl,
          previewMedia,
          onError: reportDrawingError,
          mode: 'preview',
        });
        const view: View = {host, renderer, key};
        pending = view;
        renderer.render(layers, instant);
        const start = performance.now();
        const check = (): void => {
          if (stopped || pending !== view) return;
          const expired =
            performance.now() - start >= OUTPUT_REVEAL_DEADLINE_MS;
          if (
            (!renderer.ready() || document.fonts.status !== 'loaded') &&
            !expired
          ) {
            animation = requestAnimationFrame(check);
            return;
          }
          if (expired) renderer.revealIncomplete();
          const previous = front;
          previous?.host.remove();
          host.style.visibility = 'visible';
          front = view;
          pending = null;
          dispose(previous);
        };
        animation = requestAnimationFrame(check);
      } catch (error) {
        reportDrawingError('could not update the screen preview', error);
      }
    };
    const api = window.llp;
    frames =
      api === undefined
        ? null
        : new ScreenFrames({
            fonts: api.fonts,
            settings: api.settings,
            clock: () => api.live.clock(),
            wallClock: api.live,
            screenId,
            onChange: draw,
            onError: reportDrawingError,
          });
    draw();
    const unsubscribe = useLive.subscribe((next, previous) => {
      if (next.state !== previous.state) draw();
    });
    return () => {
      unsubscribe();
      stopped = true;
      cancelAnimationFrame(animation);
      frames?.dispose();
      dispose(pending);
      dispose(front);
      previewMedia?.dispose();
    };
  }, [screenId]);

  const classes = [styles.screen];
  if (chroma) classes.push(styles.chroma);
  return <div ref={screenRef} className={classes.join(' ')} />;
}
