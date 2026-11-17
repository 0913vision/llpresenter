import {useEffect, useLayoutEffect, useRef, type JSX} from 'react';
import {emptyLayers} from '@core/live/state';
import {mediaUrl} from '@contracts/ipc/mediaUrls';
import {DEFAULT_TEXT_STYLE} from '@core/themes/textStyle';
import {OUTPUT_REVEAL_DEADLINE_MS} from '@core/output/revealDeadline';
import {OutputRenderer} from '@renderer/rendering/outputRenderer';
import {openPreviewMedia} from '@renderer/rendering/previewMedia';
import {fontsLoading, previewReady} from '@renderer/rendering/fontsLoading';
import {ScreenFrames} from '@renderer/rendering/screenFrames';
import {useLive} from '@renderer/session/live';
import type {LlpApi} from '@contracts/ipc/api';
import styles from './ScreenPreview.module.css';

const noLayers = emptyLayers();

interface View {
  host: HTMLDivElement;
  renderer: OutputRenderer;
  key: string;
}

interface ParkedView {
  readonly view: View;
  /** The live state the view showed; another one means it is out of date. */
  readonly state: unknown;
}

// NOTE(0913vision): the last finished picture of each screen, kept while 진행
// is away. It comes back only while the live state is the one it showed (its
// clock keeps running meanwhile), and the preview always draws again behind
// it and swaps, so a setting the live state does not carry is corrected
// within one drawing.
const parked = new WeakMap<LlpApi, Map<string, ParkedView>>();

function park(api: LlpApi | undefined, screenId: string, view: View): void {
  view.host.remove();
  if (api === undefined || !previewReady(view.renderer)) {
    view.renderer.dispose();
    return;
  }
  const views = parked.get(api) ?? new Map<string, ParkedView>();
  parked.set(api, views);
  views.get(screenId)?.view.renderer.dispose();
  views.set(screenId, {view, state: useLive.getState().state});
}

function unpark(api: LlpApi | undefined, screenId: string): View | null {
  const views = api === undefined ? undefined : parked.get(api);
  const kept = views?.get(screenId);
  if (kept === undefined) return null;
  views?.delete(screenId);
  if (kept.state === useLive.getState().state) return kept.view;
  kept.view.renderer.dispose();
  return null;
}

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
  const kept = useRef<View | null>(null);

  useLayoutEffect(() => {
    const screen = screenRef.current;
    const view = unpark(window.llp, screenId);
    if (!screen || view === null) return;
    screen.append(view.host);
    kept.current = {...view, key: ''};
  }, [screenId]);

  useEffect(() => {
    const screen = screenRef.current;
    if (!screen) return undefined;
    const previewMedia = openPreviewMedia(window.llp);
    let front: View | null = kept.current;
    kept.current = null;
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
            (!previewReady(renderer) || fontsLoading(document.fonts)) &&
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
      if (front !== null) park(api, screenId, front);
      previewMedia?.dispose();
    };
  }, [screenId]);

  const classes = [styles.screen];
  if (chroma) classes.push(styles.chroma);
  return <div ref={screenRef} className={classes.join(' ')} />;
}
