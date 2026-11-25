import {THEME_CANVAS} from '@core/schema/screens/screens';
import {BrowserWindow, screen as displays, type WebContents} from 'electron';
import type {SlideTransition} from '@core/schema/slides/slideTransition';
import {sameRect, type Rect, type Size} from '../../displays/rect';
import type {Logger} from '../../base/log';
import {
  blockNavigation,
  preloadPath,
  startLoading,
  type PageRequest,
} from '../../base/renderers/page';
import {type OutputWindowEvents, OUTPUT_BACKGROUND} from '../outputWindow';
import type {OutputScreen} from '../screens';
import {
  watchPlaybackProblems,
  type PlaybackProblemBoard,
} from '../health/playbackProblems';
import {publishNativeMirror, setNativeMirror} from '../previews/nativeMirror';
import {PRESENTER_STALL_MS, PresenterFrames} from './presenterFrames';
import {PresenterProcess, type PresenterMessage} from './presenterProcess';

const PING_SCRIPT = '0';
const DEFAULT_SIZE: Size = THEME_CANVAS;
const UTILITY_TIMEOUT_MS = 5000;
const FIRST_TEXTURE_TIMEOUT_MS = 5000;

// NOTE(0913vision): Chromium paces every window by the primary display's
// vblank on Windows. A full screen output on a monitor with another refresh
// rate therefore shows its frames unevenly, and a moving wipe edge reads as a
// band. Full screen outputs draw their page offscreen and hand each frame to a
// presenter window on the monitor, which shows it at that monitor's own
// refresh and blends slide transitions there.

/** Hands a slide transition of one screen's page to its presenter. */
const transitionTargets = new Map<string, (effect: SlideTransition) => void>();

/** Ends the transition `screenId` is in and starts this one, unless it's a cut. */
export function presentTransition(
  screenId: string,
  effect: SlideTransition,
): void {
  transitionTargets.get(screenId)?.(effect);
}

/** One screen's page drawn offscreen and shown by its presenter process. */
export interface PresenterPart {
  previewContents(): WebContents | null;
  prepare(bounds: Rect): void;
  show(bounds: Rect, onTop: boolean): void;
  setOnTop(onTop: boolean): void;
  hide(): void;
  contentSize(): Size;
  bounds(): Rect | null;
  configure(screen: OutputScreen): void;
  reload(): Promise<void>;
  crashRenderer(): void;
  ping(): Promise<void>;
  destroy(): void;
}

/**
 * The presenter of one screen: its page drawn offscreen, the frames on their
 * way, and the presenter process that shows them on the monitor. `fail` runs
 * once when it cannot go on, and the screen falls back to its output window.
 */
export function createPresenterPart(
  screen: OutputScreen,
  events: OutputWindowEvents,
  {
    log,
    playbackProblems,
    fail,
  }: {
    log: Logger;
    playbackProblems: PlaybackProblemBoard | undefined;
    fail: (reason: unknown) => void;
  },
): PresenterPart {
  let current = screen;
  const win = new BrowserWindow({
    show: false,
    skipTaskbar: true,
    width: (screen.resolution ?? DEFAULT_SIZE).width,
    height: (screen.resolution ?? DEFAULT_SIZE).height,
    useContentSize: true,
    frame: false,
    backgroundColor: OUTPUT_BACKGROUND,
    webPreferences: {
      preload: preloadPath,
      sandbox: true,
      contextIsolation: true,
      nodeIntegration: false,
      backgroundThrottling: false,
      offscreen: {useSharedTexture: true},
    },
  });
  const page: PageRequest = {
    name: 'output',
    query: {screen: screen.id, presenter: '1'},
  };
  blockNavigation(win);
  win.on('page-title-updated', event => event.preventDefault());
  win.webContents.on('render-process-gone', (_event, details) =>
    events.onRendererGone(details),
  );
  const releaseProblems =
    playbackProblems === undefined
      ? undefined
      : watchPlaybackProblems(playbackProblems, win.webContents, {
          source: screen.id,
          name: () => current.name,
          retry: () => win.webContents.reload(),
        });
  let closed = false;
  let ready = false;
  let openKey = '';
  let shown: Rect | null = null;
  let onTop = true;
  let timer: ReturnType<typeof setTimeout> | null = null;
  const stopTimer = (): void => {
    if (timer !== null) clearTimeout(timer);
    timer = null;
  };
  const failWith = (reason: unknown): void => {
    if (closed) return;
    fail(reason);
  };
  const post = (message: Record<string, unknown>): void => {
    presenterProcess.post(message);
  };
  const mirrorPump = {
    enable: (enabled: boolean): void => post({type: 'mirror', enabled}),
    ack: (): void => post({type: 'mirror-ack'}),
  };
  // NOTE(0913vision): invalidate() can paint a bitmap without a texture in
  // shared texture mode; restarting the painting gives a full texture frame.
  const repaint = (): void => {
    if (win.isDestroyed()) return;
    win.webContents.stopPainting();
    win.webContents.startPainting();
  };
  const frames = new PresenterFrames({
    post: message => post({...message}),
    failed: failWith,
    stalled: () => {
      log.warn('output presenter stopped taking frames', {
        screen: current.id,
        waitedMs: PRESENTER_STALL_MS,
      });
      failWith('presenter stalled');
    },
  });
  // NOTE(0913vision): A still page paints once; its latest frame waits until
  // the presenter is ready instead of being dropped.
  win.webContents.on('paint', event => {
    const texture = event.texture;
    if (!texture) return;
    if (closed) {
      texture.release();
      return;
    }
    if (shown !== null && timer !== null && ready) stopTimer();
    frames.take(texture, presenterProcess.running && ready);
  });
  /** A shown screen whose presenter gets no picture in time falls back. */
  const awaitFirstPicture = (): void => {
    if (shown === null || timer !== null) return;
    timer = setTimeout(
      () => failWith('no shared texture paint'),
      FIRST_TEXTURE_TIMEOUT_MS,
    );
  };
  const mirrorFrame = (frame: unknown): void => {
    if (frame instanceof Uint8Array && frame.length === 640 * 360 * 4) {
      publishNativeMirror(current.id, frame);
    } else mirrorPump.ack();
  };
  /** What the presenter process says about the window, frames and preview. */
  const heard = (message: PresenterMessage): void => {
    switch (message.type) {
      case 'ready':
        ready = true;
        stopTimer();
        if (!frames.sendWaiting()) repaint();
        awaitFirstPicture();
        break;
      case 'copied':
        frames.copied(message.id);
        break;
      case 'shown':
        stopTimer();
        if (shown !== null) setNativeMirror(current.id, mirrorPump);
        break;
      case 'mirror-frame':
        mirrorFrame(message.frame);
        break;
      case 'mirror-error':
        log.warn('presenter preview unavailable', message.message);
        setNativeMirror(current.id, null);
        break;
      case 'reopened':
        log.warn('output presenter window was gone; opened again', {
          screen: current.id,
        });
        // NOTE(0913vision): The new window shows once it has a frame; the
        // page paints one for it, and a window that never gets one falls
        // back like a presenter that never paints.
        if (frames.idle) repaint();
        awaitFirstPicture();
        break;
      case 'replaced':
        log.warn('output presenter window was moved or hidden; put back', {
          screen: current.id,
          was: message.was,
        });
        break;
      case 'transitioned':
        log.info('output presenter transition', {
          screen: current.id,
          ...message,
        });
        break;
      case 'error':
        failWith(message.message);
        break;
      default:
        break;
    }
  };
  const presenterProcess = new PresenterProcess({
    message: heard,
    failed: failWith,
    exited: code => {
      setNativeMirror(current.id, null);
      failWith(`presenter exited ${code}`);
    },
  });
  const start = (): void => {
    if (presenterProcess.running || closed) return;
    if (!presenterProcess.start()) return;
    timer = setTimeout(
      () => failWith('presenter startup timeout'),
      UTILITY_TIMEOUT_MS,
    );
  };
  const open = (bounds: Rect): void => {
    const display = displays.getDisplayMatching(bounds);
    const pixels = displays.dipToScreenRect(null, bounds);
    const hz = Math.round(display.displayFrequency) || 60;
    const key = `${JSON.stringify(pixels)}@${hz}`;
    if (key === openKey) return;
    openKey = key;
    win.setContentSize(bounds.width, bounds.height);
    win.webContents.setFrameRate(Math.min(240, Math.max(1, hz)));
    start();
    ready = false;
    post({type: 'open', bounds: pixels, hz, topmost: onTop});
    log.info('output presenter opened', {screen: current.id, ...pixels, hz});
  };
  const transitionTo = (effect: SlideTransition): void => {
    post({
      type: 'transition',
      kind: effect.kind,
      dir: effect.dir ?? 'left',
      sec: effect.sec,
    });
  };
  transitionTargets.set(screen.id, transitionTo);
  void startLoading(win, page).catch((error: unknown) => failWith(error));
  return {
    previewContents: () => (win.isDestroyed() ? null : win.webContents),
    prepare: bounds => open(bounds),
    show: (bounds, top) => {
      onTop = top;
      if (shown === null || !sameRect(shown, bounds)) open(bounds);
      shown = bounds;
      post({type: 'show', topmost: top});
      if (ready) awaitFirstPicture();
    },
    setOnTop: top => {
      onTop = top;
      post({type: 'top', topmost: top});
    },
    hide: () => {
      shown = null;
      setNativeMirror(current.id, null);
      stopTimer();
      post({type: 'hide'});
    },
    contentSize: () => {
      const {width, height} = win.getContentBounds();
      return {width, height};
    },
    bounds: () => shown,
    configure: next => {
      current = next;
      win.setTitle(next.name);
    },
    reload: () => startLoading(win, page),
    crashRenderer: () => {
      if (!win.isDestroyed()) win.webContents.forcefullyCrashRenderer();
    },
    ping: async () => {
      await win.webContents.executeJavaScript(PING_SCRIPT);
    },
    destroy: () => {
      if (closed) return;
      closed = true;
      if (transitionTargets.get(screen.id) === transitionTo) {
        transitionTargets.delete(screen.id);
      }
      setNativeMirror(current.id, null);
      stopTimer();
      releaseProblems?.();
      frames.close();
      presenterProcess.stop();
      if (!win.isDestroyed()) win.destroy();
    },
  };
}
