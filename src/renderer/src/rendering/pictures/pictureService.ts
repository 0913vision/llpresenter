import type {LiveLayers} from '@core/live/state';
import {OUTPUT_REVEAL_DEADLINE_MS} from '@core/output/revealDeadline';
import {DEFAULT_TEXT_STYLE} from '@core/themes/textStyle';
import {mediaUrl} from '@contracts/ipc/mediaUrls';
import {fontsLoading, fontsStamp, previewReady} from '../fontsLoading';
import type {RenderScreen, ThemeFrame} from '../layer';
import {OutputRenderer} from '../outputRenderer';
import {openPreviewMedia} from '../previewMedia';

/** What a picture shows: the layers and how the screen draws them. */
export interface PictureSpec {
  readonly layers: LiveLayers;
  readonly appearance: {
    readonly screen: RenderScreen;
    readonly theme: ThemeFrame;
    readonly background: string;
    readonly checker: boolean;
  };
}

/** Every picture is drawn at the output size and shown scaled. */
export const DRAWING_WIDTH = 1920;
export const DRAWING_HEIGHT = 1080;
/** Finished pictures kept for reuse after their view leaves. */
const KEPT_PICTURES = 240;

interface Drawing {
  readonly key: string;
  readonly host: HTMLDivElement;
  /** What the drawing read beyond its key: media records and the font set. */
  readonly inputs: () => string;
  readonly dispose: () => void;
  stamp: string;
}

interface Pending {
  readonly drawing: Drawing;
  readonly renderer: OutputRenderer;
  readonly started: number;
  readonly finish: () => void;
}

/** Marks a promise settled, so React's `use` reads it without waiting. */
function markSettled(promise: Promise<void>): void {
  Reflect.set(promise, 'status', 'fulfilled');
  Reflect.set(promise, 'value', undefined);
}

const layouts = new WeakMap<object, string>();

function layoutKey(layout: ThemeFrame['layout']): string {
  let key = layouts.get(layout);
  if (key === undefined) {
    key = JSON.stringify(layout);
    layouts.set(layout, key);
  }
  return key;
}

/** The identity of a picture: equal keys draw the same picture. */
export function pictureKey({layers, appearance}: PictureSpec): string {
  return JSON.stringify([
    layers.slide,
    layers.media,
    appearance.screen,
    appearance.theme.themeId,
    appearance.theme.revision,
    appearance.theme.item,
    appearance.theme.emptyColor,
    layoutKey(appearance.theme.layout),
    appearance.background,
    appearance.checker,
  ]);
}

function settled(): Promise<void> {
  const done = Promise.resolve();
  markSettled(done);
  return done;
}

/**
 * Draws slide pictures out of sight, before any view shows them, and hands a
 * finished picture to the view that shows it. A view never shows a picture
 * while it draws: it waits (suspends) until the picture is finished, so the
 * frame that first shows a picture shows it complete.
 */
export class PictureService {
  private room: HTMLDivElement | null = null;
  /** Finished pictures nobody shows, oldest first. */
  private readonly free = new Map<string, Drawing[]>();
  private freeCount = 0;
  private readonly pending = new Set<Pending>();
  /** Pictures on screen, by key, to copy when one key shows twice. */
  private readonly shown = new Map<string, Drawing[]>();
  private readonly waits = new Map<string, Promise<void>>();
  private frame = 0;

  constructor(
    private readonly options: {readonly waitForReady?: boolean} = {},
  ) {}

  /**
   * Shows pictures as they draw instead of waiting for them and keeps none,
   * where nothing is laid out or loaded (jsdom in tests).
   */
  readonly drawInPlace =
    typeof navigator !== 'undefined' && navigator.userAgent.includes('jsdom');

  /** Resolves once a finished picture for the spec is ready to be shown. */
  whenDrawn(spec: PictureSpec): Promise<void> {
    if (this.drawInPlace) return settled();
    const key = pictureKey(spec);
    if (this.hasFree(key)) return settled();
    const waiting = this.waits.get(key);
    if (waiting !== undefined) return waiting;
    let finish = (): void => undefined;
    const wait = new Promise<void>(resolve => {
      finish = resolve;
    });
    Reflect.set(wait, 'status', 'pending');
    this.waits.set(key, wait);
    this.draw(key, spec, () => {
      markSettled(wait);
      this.waits.delete(key);
      finish();
    });
    return wait;
  }

  /** Lets every drawing go, shown or kept. */
  reset(): void {
    cancelAnimationFrame(this.frame);
    this.frame = 0;
    for (const entry of this.pending) entry.drawing.dispose();
    this.pending.clear();
    for (const list of this.free.values()) {
      for (const drawing of list) drawing.dispose();
    }
    this.free.clear();
    this.freeCount = 0;
    this.shown.clear();
    this.waits.clear();
    this.room?.remove();
    this.room = null;
  }

  /** Draws pictures a view is likely to show next. */
  prepare(specs: readonly PictureSpec[]): void {
    for (const spec of specs) {
      this.whenDrawn(spec).catch(() => undefined);
    }
  }

  /**
   * Shows the spec's picture in the container, scaled to its size, and returns
   * how to take it back. A finished picture shows at once; otherwise it draws
   * in place, out of sight, and the picture it replaces stays until then.
   */
  show(
    spec: PictureSpec,
    container: HTMLElement,
    replacing?: () => void,
  ): () => void {
    const key = pictureKey(spec);
    const ready = this.takeFree(key) ?? this.copyShown(key);
    const shown = ready ?? this.drawShown(key, spec, () => replacing?.());
    if (ready !== undefined) replacing?.();
    const onScreen = this.shown.get(key) ?? [];
    this.shown.set(key, [...onScreen, shown]);
    // NOTE(0913vision): The size arrives from the resize observer before the
    // first paint; reading it here would lay the page out once per picture.
    container.append(shown.host);
    const observer =
      typeof ResizeObserver === 'undefined'
        ? null
        : new ResizeObserver(entries => {
            const width = entries.at(-1)?.contentRect.width ?? 0;
            shown.host.style.transform = `scale(${width / DRAWING_WIDTH})`;
          });
    observer?.observe(container);
    return () => {
      observer?.disconnect();
      const rest = (this.shown.get(key) ?? []).filter(each => each !== shown);
      if (rest.length === 0) this.shown.delete(key);
      else this.shown.set(key, rest);
      this.keep(shown);
    };
  }

  /**
   * Draws a picture where it is shown, out of sight until finished: for a
   * view that did not wait, such as tiles a scroll or a resize brings in.
   */
  private drawShown(
    key: string,
    spec: PictureSpec,
    finished: () => void,
  ): Drawing {
    const {drawing, renderer} = this.start(key, spec);
    drawing.host.style.visibility = 'hidden';
    this.pending.add({
      drawing,
      renderer,
      started: performance.now(),
      finish: () => {
        drawing.host.style.removeProperty('visibility');
        finished();
      },
    });
    this.schedule();
    return drawing;
  }

  /** A still copy of a picture already on screen, for a key shown twice. */
  private copyShown(key: string): Drawing | undefined {
    const original = this.shown.get(key)?.[0];
    if (original === undefined) return undefined;
    const copy = original.host.cloneNode(true);
    if (!(copy instanceof HTMLDivElement)) return undefined;
    copy.style.removeProperty('transform');
    return {
      key,
      host: copy,
      inputs: original.inputs,
      stamp: original.stamp,
      dispose: () => copy.remove(),
    };
  }

  private hasFree(key: string): boolean {
    const list = this.free.get(key);
    if (list === undefined) return false;
    const valid = list.filter(drawing => drawing.stamp === drawing.inputs());
    for (const stale of list.filter(drawing => !valid.includes(drawing))) {
      stale.dispose();
      this.freeCount -= 1;
    }
    if (valid.length === 0) this.free.delete(key);
    else this.free.set(key, valid);
    return valid.length > 0;
  }

  private takeFree(key: string): Drawing | undefined {
    if (!this.hasFree(key)) return undefined;
    const list = this.free.get(key) ?? [];
    const drawing = list.pop();
    if (list.length === 0) this.free.delete(key);
    if (drawing !== undefined) this.freeCount -= 1;
    return drawing;
  }

  private keep(drawing: Drawing): void {
    if (this.drawInPlace) {
      drawing.dispose();
      return;
    }
    this.roomElement().append(drawing.host);
    drawing.host.style.removeProperty('transform');
    drawing.stamp = drawing.inputs();
    const list = this.free.get(drawing.key) ?? [];
    this.free.delete(drawing.key);
    this.free.set(drawing.key, [...list, drawing]);
    this.freeCount += 1;
    while (this.freeCount > KEPT_PICTURES) {
      const oldest = this.free.entries().next();
      if (oldest.done === true) break;
      const [key, drawings] = oldest.value;
      const gone = drawings.shift();
      if (drawings.length === 0) this.free.delete(key);
      gone?.dispose();
      this.freeCount -= 1;
    }
  }

  private roomElement(): HTMLDivElement {
    if (this.room !== null) return this.room;
    const room = document.createElement('div');
    room.dataset['pictureRoom'] = '';
    room.inert = true;
    room.setAttribute('aria-hidden', 'true');
    Object.assign(room.style, {
      position: 'fixed',
      left: '0',
      top: '0',
      width: `${DRAWING_WIDTH}px`,
      height: `${DRAWING_HEIGHT}px`,
      opacity: '0',
      pointerEvents: 'none',
      overflow: 'hidden',
      contain: 'strict',
      zIndex: '-1',
    });
    document.body.append(room);
    this.room = room;
    return room;
  }

  private draw(key: string, spec: PictureSpec, finish: () => void): void {
    const {drawing, renderer} = this.start(key, spec);
    this.pending.add({
      drawing,
      renderer,
      started: performance.now(),
      finish: () => {
        this.keep(drawing);
        finish();
      },
    });
    this.schedule();
  }

  private start(
    key: string,
    spec: PictureSpec,
  ): {readonly drawing: Drawing; readonly renderer: OutputRenderer} {
    const host = document.createElement('div');
    Object.assign(host.style, {
      position: 'absolute',
      left: '0',
      top: '0',
      width: `${DRAWING_WIDTH}px`,
      height: `${DRAWING_HEIGHT}px`,
      transformOrigin: '0 0',
      background:
        spec.appearance.screen.method === 'ndi'
          ? 'transparent'
          : spec.appearance.background,
    });
    this.roomElement().append(host);
    const media = openPreviewMedia(window.llp);
    const asked = new Set<string>();
    const renderer = new OutputRenderer(host, {
      transparent: spec.appearance.screen.method === 'ndi',
      textStyle: DEFAULT_TEXT_STYLE,
      mediaUrl,
      previewMedia:
        media === undefined
          ? undefined
          : {
              url: id => {
                asked.add(id);
                return media.url(id);
              },
              remaining: layer => media.remaining(layer),
            },
      mode: 'preview',
      onError: (message, error) => console.error(message, error),
    });
    const drawing: Drawing = {
      key,
      host,
      inputs: () =>
        JSON.stringify([
          fontsStamp(document.fonts),
          media?.describe([...asked].sort()) ?? '',
        ]),
      stamp: '',
      dispose: () => {
        renderer.dispose();
        media?.dispose();
        host.remove();
      },
    };
    renderer.render(spec.layers, {
      screen: spec.appearance.screen,
      theme: spec.appearance.theme,
      transitions: false,
      ...(spec.layers.slide === null ? {} : {slide: spec.layers.slide}),
    });
    return {drawing, renderer};
  }

  private schedule(): void {
    if (this.frame !== 0) return;
    this.frame = requestAnimationFrame(() => {
      this.frame = 0;
      for (const entry of this.pending) {
        const expired =
          performance.now() - entry.started >= OUTPUT_REVEAL_DEADLINE_MS;
        const ready =
          previewReady(entry.renderer) && !fontsLoading(document.fonts);
        if (!ready && (this.options.waitForReady === true || !expired)) {
          continue;
        }
        if (!ready) entry.renderer.revealIncomplete();
        this.pending.delete(entry);
        entry.finish();
      }
      if (this.pending.size > 0) this.schedule();
    });
  }
}

export const pictures = new PictureService();
