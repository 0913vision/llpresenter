import {
  BrowserWindow,
  screen as displays,
  utilityProcess,
  type OffscreenSharedTexture,
  type UtilityProcess,
  type WebContents,
} from 'electron';
import {join} from 'node:path';
import type {SlideTransition} from '@core/schema/slideTransition';
import {sameRect, type Rect, type Size} from '../displays/rect';
import type {Logger} from '../log';
import {
  blockNavigation,
  preloadPath,
  startLoading,
  type PageRequest,
} from '../windows/page';
import type {OutputWindowEvents, OutputWindowHandle} from './outputWindow';
import type {OutputScreen} from './screens';
import {
  watchPlaybackProblems,
  type PlaybackProblemBoard,
} from './playbackProblems';
import {OUTPUT_BACKGROUND} from './electronWindow';
import {
  clearDesktopPreviewSource,
  setDesktopPreviewSource,
} from './desktopPreviewSources';

const PING_SCRIPT = '0';
const DEFAULT_SIZE: Size = {width: 1920, height: 1080};
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

/** Starts the slide transition the page of `screenId` just cut to. */
export function presentTransition(
  screenId: string,
  effect: SlideTransition,
): void {
  transitionTargets.get(screenId)?.(effect);
}

export interface PresentedWindowOptions {
  readonly log: Logger;
  readonly playbackProblems?: PlaybackProblemBoard;
  /** The ordinary output window, for window and capture placements and as the fallback. */
  readonly window: () => OutputWindowHandle;
}

interface PresenterPart {
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
 * The output of one screen. In full screen it is drawn by a presenter at the
 * monitor's refresh; in window and capture placements, or when the presenter
 * cannot run, it is the ordinary Electron output window.
 */
export function createPresentedOutputWindow(
  screen: OutputScreen,
  events: OutputWindowEvents,
  options: PresentedWindowOptions,
): OutputWindowHandle {
  let current = screen;
  let window: OutputWindowHandle | null = null;
  let presenter: PresenterPart | null = null;
  let failed = false;
  let lastFullScreen: {bounds: Rect; onTop: boolean} | null = null;
  const closePresenter = (): void => {
    presenter?.destroy();
    presenter = null;
    transitionTargets.delete(current.id);
  };
  const closeWindow = (): void => {
    window?.destroy();
    window = null;
  };
  const ensureWindow = (): OutputWindowHandle => {
    if (window !== null) return window;
    window = options.window();
    window.configure(current);
    return window;
  };
  const fallBack = (reason: unknown): void => {
    if (failed) return;
    failed = true;
    options.log.warn(
      'output presenter unavailable; using the output window',
      reason,
    );
    closePresenter();
    if (lastFullScreen === null) return;
    const handle = ensureWindow();
    handle.prepare(lastFullScreen.bounds, 'fullscreen');
    handle.showFullScreen(lastFullScreen.bounds, lastFullScreen.onTop);
  };
  const ensurePresenter = (): PresenterPart => {
    if (presenter !== null) return presenter;
    closeWindow();
    const part = createPresenterPart(current, events, {
      log: options.log,
      playbackProblems: options.playbackProblems,
      fail: fallBack,
    });
    presenter = part;
    return part;
  };
  const active = (): OutputWindowHandle | PresenterPart | null =>
    presenter ?? window;
  return {
    previewContents: () => active()?.previewContents?.() ?? null,
    configure: next => {
      current = next;
      window?.configure(next);
      presenter?.configure(next);
    },
    prepare: (bounds, kind) => {
      if (kind === 'fullscreen' && !failed) {
        ensurePresenter().prepare(bounds);
        return;
      }
      closePresenter();
      ensureWindow().prepare(bounds, kind);
    },
    requestFrame: () => window?.requestFrame(),
    contentSize: () =>
      active()?.contentSize() ?? current.resolution ?? DEFAULT_SIZE,
    setAlwaysOnTop: onTop => {
      if (presenter !== null) presenter.setOnTop(onTop);
      else window?.setAlwaysOnTop(onTop);
    },
    showFullScreen: (bounds, onTop) => {
      lastFullScreen = {bounds, onTop};
      if (!failed) {
        ensurePresenter().show(bounds, onTop);
        return;
      }
      ensureWindow().showFullScreen(bounds, onTop);
    },
    showWindowed: (bounds, onTop) => {
      lastFullScreen = null;
      closePresenter();
      ensureWindow().showWindowed(bounds, onTop);
    },
    showCapture: (bounds, onTop) => {
      lastFullScreen = null;
      closePresenter();
      ensureWindow().showCapture(bounds, onTop);
    },
    prepareForMonitorRemoval: () => window?.prepareForMonitorRemoval(),
    bringToFront: () => {
      if (presenter !== null && lastFullScreen !== null) {
        presenter.setOnTop(lastFullScreen.onTop);
      } else window?.bringToFront();
    },
    bounds: () => active()?.bounds() ?? null,
    hide: () => {
      lastFullScreen = null;
      presenter?.hide();
      window?.hide();
    },
    reload: () => active()?.reload() ?? Promise.resolve(),
    crashRenderer: () => active()?.crashRenderer(),
    ping: () => active()?.ping() ?? Promise.resolve(),
    destroy: () => {
      closePresenter();
      closeWindow();
    },
  };
}

function createPresenterPart(
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
  let child: UtilityProcess | null = null;
  let spawned = false;
  let pending: Array<Record<string, unknown>> = [];
  let ready = false;
  let openKey = '';
  let shown: Rect | null = null;
  let onTop = true;
  let outstanding: OffscreenSharedTexture | null = null;
  let waiting: OffscreenSharedTexture | null = null;
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
    if (child === null) return;
    if (!spawned) {
      pending.push(message);
      return;
    }
    try {
      child.postMessage(message);
    } catch (error) {
      failWith(error);
    }
  };
  let desktopSource: string | undefined;
  const clearPreviewSource = (): void => {
    if (desktopSource !== undefined) {
      clearDesktopPreviewSource(current.id, desktopSource);
      desktopSource = undefined;
    }
  };
  // NOTE(0913vision): invalidate() can paint a bitmap without a texture in
  // shared texture mode; restarting the painting gives a full texture frame.
  const repaint = (): void => {
    if (win.isDestroyed()) return;
    win.webContents.stopPainting();
    win.webContents.startPainting();
  };
  const send = (texture: OffscreenSharedTexture): void => {
    const handle = texture.textureInfo.handle.ntHandle;
    if (handle?.length !== 8) {
      texture.release();
      failWith('unsupported texture handle');
      return;
    }
    outstanding = texture;
    post({
      type: 'frame',
      pid: process.pid,
      handle: handle.readBigUInt64LE(0).toString(16),
    });
  };
  const copied = (): void => {
    outstanding?.release();
    outstanding = null;
    const next = waiting;
    waiting = null;
    if (next !== null) send(next);
  };
  win.webContents.on('paint', event => {
    const texture = event.texture;
    if (!texture) return;
    if (closed) {
      texture.release();
      return;
    }
    // NOTE(0913vision): A still page paints once; keep its latest frame until
    // the presenter is ready instead of dropping it.
    if (child === null || !ready || outstanding !== null) {
      waiting?.release();
      waiting = texture;
      if (shown !== null && timer !== null && ready) stopTimer();
      return;
    }
    if (shown !== null && timer !== null) stopTimer();
    send(texture);
  });
  const start = (): void => {
    if (child !== null || closed) return;
    let worker: UtilityProcess;
    try {
      worker = utilityProcess.fork(
        join(__dirname, 'presenter/presenter-utility.cjs'),
        [],
        {serviceName: 'Output presenter'},
      );
    } catch (error) {
      failWith(error);
      return;
    }
    child = worker;
    worker.once('spawn', () => {
      if (child !== worker) return;
      spawned = true;
      const queued = pending;
      pending = [];
      for (const message of queued) post(message);
    });
    timer = setTimeout(
      () => failWith('presenter startup timeout'),
      UTILITY_TIMEOUT_MS,
    );
    worker.on(
      'message',
      (message: {type: string; message?: string; windowSource?: unknown}) => {
        if (child !== worker) return;
        if (message.type === 'ready') {
          ready = true;
          stopTimer();
          const held = waiting;
          waiting = null;
          if (held !== null) send(held);
          else repaint();
          if (shown !== null) {
            timer = setTimeout(
              () => failWith('no shared texture paint'),
              FIRST_TEXTURE_TIMEOUT_MS,
            );
          }
        }
        if (message.type === 'copied') copied();
        if (message.type === 'shown') {
          stopTimer();
          if (
            shown !== null &&
            typeof message.windowSource === 'string' &&
            /^window:\d+:0$/.test(message.windowSource)
          ) {
            clearPreviewSource();
            desktopSource = message.windowSource;
            setDesktopPreviewSource(current.id, desktopSource);
          }
        }
        if (message.type === 'transitioned') {
          log.info('output presenter transition', {
            screen: current.id,
            ...message,
          });
        }
        if (message.type === 'error') failWith(message.message);
      },
    );
    worker.on('exit', code => {
      if (child === worker) {
        clearPreviewSource();
        child = null;
        failWith(`presenter exited ${code}`);
      }
    });
  };
  const open = (bounds: Rect): void => {
    const display = displays.getDisplayMatching(bounds);
    const pixels = displays.dipToScreenRect(null, bounds);
    const hz = Math.round(display.displayFrequency) || 60;
    const key = `${JSON.stringify(pixels)}@${hz}`;
    if (key === openKey) return;
    clearPreviewSource();
    openKey = key;
    win.setContentSize(bounds.width, bounds.height);
    win.webContents.setFrameRate(Math.min(240, Math.max(1, hz)));
    start();
    ready = false;
    post({type: 'open', bounds: pixels, hz, topmost: onTop});
    log.info('output presenter opened', {screen: current.id, ...pixels, hz});
  };
  transitionTargets.set(screen.id, effect => {
    if (effect.kind === 'none') return;
    post({
      type: 'transition',
      kind: effect.kind,
      dir: effect.dir ?? 'left',
      sec: effect.sec,
    });
  });
  void startLoading(win, page).catch((error: unknown) => failWith(error));
  return {
    previewContents: () => (win.isDestroyed() ? null : win.webContents),
    prepare: bounds => open(bounds),
    show: (bounds, top) => {
      onTop = top;
      if (shown === null || !sameRect(shown, bounds)) open(bounds);
      shown = bounds;
      post({type: 'show', topmost: top});
      if (ready && timer === null) {
        timer = setTimeout(
          () => failWith('no shared texture paint'),
          FIRST_TEXTURE_TIMEOUT_MS,
        );
      }
    },
    setOnTop: top => {
      onTop = top;
      post({type: 'top', topmost: top});
    },
    hide: () => {
      shown = null;
      clearPreviewSource();
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
      clearPreviewSource();
      stopTimer();
      releaseProblems?.();
      outstanding?.release();
      waiting?.release();
      outstanding = null;
      waiting = null;
      const old = child;
      child = null;
      if (old !== null) {
        try {
          old.postMessage({type: 'stop'});
        } catch {
          old.kill();
        }
        setTimeout(() => old.kill(), 2000).unref();
      }
      if (!win.isDestroyed()) win.destroy();
    },
  };
}
