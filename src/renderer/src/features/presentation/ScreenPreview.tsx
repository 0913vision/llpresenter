import {useLayoutEffect, useRef, type JSX} from 'react';
import {emptyLayers} from '@core/live/state';
import {mediaUrl} from '@contracts/ipc/mediaUrls';
import type {LlpApi} from '@contracts/ipc/api';
import {DEFAULT_TEXT_STYLE} from '@core/themes/textStyle';
import {OUTPUT_REVEAL_DEADLINE_MS} from '@core/output/revealDeadline';
import {OutputRenderer} from '@renderer/rendering/outputRenderer';
import {openPreviewMedia} from '@renderer/rendering/previewMedia';
import {fontsLoading, previewReady} from '@renderer/rendering/fontsLoading';
import {ScreenFrames} from '@renderer/rendering/screenFrames';
import {keepDrawing} from '@renderer/rendering/keptDrawings';
import {useLive} from '@renderer/session/live';
import styles from './ScreenPreview.module.css';

const noLayers = emptyLayers();

interface View {
  readonly host: HTMLDivElement;
  readonly renderer: OutputRenderer;
  readonly key: string;
}

function reportDrawingError(message: string, error: unknown): void {
  const detail = error instanceof Error ? (error.stack ?? error.message) : '';
  window.llp?.log.write({level: 'error', message, detail});
}

function release(view: View | null): void {
  view?.renderer.dispose();
  view?.host.remove();
}

/**
 * Draws one screen from the live state into whichever element holds it. While
 * no panel shows it, it waits in an off-page holder of the panel's last size
 * and keeps following the live state, so the panel that shows it again has the
 * current picture in its first frame and never an old one.
 */
class ScreenDrawing {
  attached = true;
  get disposed(): boolean {
    return this.stopped;
  }
  private container: HTMLElement;
  private size = {width: 0, height: 0};
  private holder: HTMLDivElement | null = null;
  private front: View | null = null;
  private pending: View | null = null;
  private animation = 0;
  private stopped = false;
  private readonly media: ReturnType<typeof openPreviewMedia>;
  private readonly frames: ScreenFrames | null;
  private readonly stopLive: () => void;
  private readonly forget: () => void;

  constructor(
    api: LlpApi | undefined,
    screenId: string,
    container: HTMLElement,
  ) {
    this.container = container;
    this.measure();
    this.media = openPreviewMedia(api);
    this.frames =
      api === undefined
        ? null
        : new ScreenFrames({
            fonts: api.fonts,
            settings: api.settings,
            clock: () => api.live.clock(),
            wallClock: api.live,
            screenId,
            onChange: () => this.draw(),
            onError: reportDrawingError,
          });
    this.draw();
    this.stopLive = useLive.subscribe((next, previous) => {
      if (next.state !== previous.state) this.draw();
    });
    this.forget = keepDrawing(() => this.dispose());
  }

  attach(container: HTMLElement): void {
    this.attached = true;
    this.container = container;
    for (const view of [this.front, this.pending]) {
      if (view !== null) container.append(view.host);
    }
    this.holder?.remove();
    this.holder = null;
    this.measure();
  }

  detach(): void {
    this.attached = false;
    this.measure();
    const holder = document.createElement('div');
    holder.setAttribute('aria-hidden', 'true');
    Object.assign(holder.style, {
      position: 'fixed',
      left: '-100000px',
      top: '0',
      width: `${this.size.width}px`,
      height: `${this.size.height}px`,
      overflow: 'hidden',
      pointerEvents: 'none',
    });
    document.documentElement.append(holder);
    for (const view of [this.front, this.pending]) {
      if (view !== null) holder.append(view.host);
    }
    this.holder = holder;
    this.container = holder;
  }

  dispose(): void {
    if (this.stopped) return;
    this.forget();
    this.stopLive();
    this.stopped = true;
    cancelAnimationFrame(this.animation);
    this.frames?.dispose();
    release(this.pending);
    release(this.front);
    this.pending = null;
    this.front = null;
    this.media?.dispose();
    this.holder?.remove();
    this.holder = null;
  }

  private measure(): void {
    const {width, height} = this.container.getBoundingClientRect();
    if (width > 0 && height > 0) this.size = {width, height};
  }

  private draw(): void {
    if (this.stopped) return;
    const state = useLive.getState().state;
    const layers = state?.layers ?? noLayers;
    try {
      const frame = this.frames?.frame(state);
      if (frame === undefined) return;
      const instant = {...frame, transitions: false};
      const key = JSON.stringify([layers, instant]);
      if (
        this.pending?.key === key ||
        (this.pending === null && this.front?.key === key)
      ) {
        return;
      }
      cancelAnimationFrame(this.animation);
      release(this.pending);
      this.pending = null;
      if (this.front?.key === key) return;
      const host = document.createElement('div');
      Object.assign(host.style, {
        position: 'absolute',
        inset: '0',
        visibility: 'hidden',
      });
      this.container.append(host);
      const renderer = new OutputRenderer(host, {
        textStyle: DEFAULT_TEXT_STYLE,
        mediaUrl,
        previewMedia: this.media,
        onError: reportDrawingError,
        mode: 'preview',
      });
      const view: View = {host, renderer, key};
      this.pending = view;
      renderer.render(layers, instant);
      const start = performance.now();
      const check = (): void => {
        if (this.stopped || this.pending !== view) return;
        const expired = performance.now() - start >= OUTPUT_REVEAL_DEADLINE_MS;
        if (
          (!previewReady(renderer) || fontsLoading(document.fonts)) &&
          !expired
        ) {
          this.animation = requestAnimationFrame(check);
          return;
        }
        if (expired) renderer.revealIncomplete();
        const previous = this.front;
        previous?.host.remove();
        host.style.visibility = 'visible';
        this.front = view;
        this.pending = null;
        release(previous);
      };
      this.animation = requestAnimationFrame(check);
    } catch (error) {
      reportDrawingError('could not update the screen preview', error);
    }
  }
}

const kept = new WeakMap<LlpApi, Map<string, ScreenDrawing>>();

function showDrawing(
  api: LlpApi | undefined,
  screenId: string,
  container: HTMLElement,
): ScreenDrawing {
  const drawings = api === undefined ? undefined : kept.get(api);
  const waiting = drawings?.get(screenId);
  if (waiting !== undefined && !waiting.attached && !waiting.disposed) {
    waiting.attach(container);
    return waiting;
  }
  const drawing = new ScreenDrawing(api, screenId, container);
  if (api !== undefined && (waiting === undefined || waiting.disposed)) {
    const map = drawings ?? new Map<string, ScreenDrawing>();
    kept.set(api, map);
    map.set(screenId, drawing);
  }
  return drawing;
}

function leaveDrawing(
  api: LlpApi | undefined,
  screenId: string,
  drawing: ScreenDrawing,
): void {
  if (api !== undefined && kept.get(api)?.get(screenId) === drawing) {
    drawing.detach();
    return;
  }
  drawing.dispose();
}

/**
 * The picture of one screen: the output renderer, scaled into its parent frame,
 * fed with the live layers. It draws what the live state holds, never the
 * selection, and a change of the live state does not render React. The drawing
 * of each screen outlives the panel, so leaving 진행 and coming back shows the
 * current picture at once.
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

  useLayoutEffect(() => {
    const screen = screenRef.current;
    if (!screen) return undefined;
    const api = window.llp;
    const drawing = showDrawing(api, screenId, screen);
    return () => leaveDrawing(api, screenId, drawing);
  }, [screenId]);

  const classes = [styles.screen];
  if (chroma) classes.push(styles.chroma);
  return <div ref={screenRef} className={classes.join(' ')} />;
}
