import {
  NDI_DEFAULT_FPS,
  NDI_DEFAULT_SOURCE_NAME,
} from '@core/schema/screens/screens';
import {BrowserWindow, type UtilityProcess} from 'electron';
import type {Logger} from '../../base/log';
import {blockNavigation, startLoading} from '../../base/renderers/page';
import {APP_PAGE} from '../../base/renderers/pagePreferences';
import type {OutputScreen} from '../screens';
import type {OutputWindowEvents, OutputWindowHandle} from '../outputWindow';
import {ndiSettingsChange} from './ndiSettings';
import {NDI_FRAME_HEIGHT, NDI_FRAME_WIDTH} from './textureQueue';

/** The hidden window an NDI output draws in, and the call that loads its page again. */
export interface NdiWindow {
  readonly win: BrowserWindow;
  readonly reload: () => Promise<void>;
}

/**
 * The hidden window an NDI output draws in: one NDI frame large, without a
 * frame, transparent, painting at 60 or 30 frames by the screen's rate, with
 * the output page loading. `sharedTexture` paints to the GPU texture the GPU
 * sender reads; otherwise it paints bitmaps. `reload` loads the page again.
 */
export function createNdiWindow(
  screen: OutputScreen,
  events: OutputWindowEvents,
  {
    sharedTexture,
    onLoadError,
  }: {
    readonly sharedTexture: boolean;
    readonly onLoadError: (error: unknown) => void;
  },
): NdiWindow {
  const win = new BrowserWindow({
    show: false,
    skipTaskbar: true,
    width: NDI_FRAME_WIDTH,
    height: NDI_FRAME_HEIGHT,
    useContentSize: true,
    frame: false,
    transparent: true,
    backgroundColor: '#00000000',
    webPreferences: {
      ...APP_PAGE,
      backgroundThrottling: false,
      offscreen: sharedTexture ? {useSharedTexture: true} : true,
    },
  });
  if (sharedTexture) win.webContents.stopPainting();
  win.setMinimumSize(NDI_FRAME_WIDTH, NDI_FRAME_HEIGHT);
  win.setContentSize(NDI_FRAME_WIDTH, NDI_FRAME_HEIGHT);
  win.webContents.setFrameRate(
    (screen.ndi?.fps ?? NDI_DEFAULT_FPS) > 30 ? 60 : 30,
  );
  const page = {name: 'output' as const, query: {screen: screen.id, ndi: '1'}};
  blockNavigation(win);
  win.on('page-title-updated', event => event.preventDefault());
  win.webContents.on('render-process-gone', (_event, details) =>
    events.onRendererGone(details),
  );
  void startLoading(win, page).catch(onLoadError);
  return {win, reload: () => startLoading(win, page)};
}

/** What stopping a sender uses of its process. */
export type StoppableSender = Pick<UtilityProcess, 'kill' | 'postMessage'> & {
  once(event: 'exit', listener: () => void): unknown;
};

/**
 * Asks a sender process to stop, or ends it at once when `now`; one that has
 * not exited after `timeoutMs` is ended. `exited` runs once it is gone.
 */
export function stopSender(
  sender: StoppableSender,
  {
    timeoutMs,
    now = false,
    log,
    exited,
  }: {
    readonly timeoutMs: number;
    readonly now?: boolean;
    readonly log?: Logger;
    readonly exited?: () => void;
  },
): void {
  const killTimer = setTimeout(() => sender.kill(), timeoutMs);
  killTimer.unref();
  sender.once('exit', () => {
    clearTimeout(killTimer);
    exited?.();
  });
  if (now) {
    sender.kill();
    return;
  }
  try {
    sender.postMessage({type: 'stop'});
  } catch (error) {
    log?.warn('NDI sender already stopped', error);
    clearTimeout(killTimer);
    sender.kill();
  }
}

/**
 * The environment a sender process starts with: the screen's frame rate and
 * NDI source name.
 */
export function ndiSenderEnv(screen: OutputScreen): NodeJS.ProcessEnv {
  return {
    ...process.env,
    LLP_NDI_FPS: String(screen.ndi?.fps ?? NDI_DEFAULT_FPS),
    LLP_NDI_DEFAULT_SOURCE_NAME: NDI_DEFAULT_SOURCE_NAME,
    LLP_NDI_SOURCE_NAME: screen.ndi?.sourceName ?? NDI_DEFAULT_SOURCE_NAME,
  };
}

/**
 * Follows new screen settings in the window: a new frame rate sets how often
 * the page draws.
 *
 * @returns Whether a running sender must restart for them.
 */
export function applyNdiSettings(
  win: BrowserWindow,
  current: OutputScreen,
  next: OutputScreen,
): boolean {
  const change = ndiSettingsChange(current, next);
  if (change.frameRate !== undefined) {
    win.webContents.setFrameRate(change.frameRate);
  }
  return change.restart;
}

/** What one NDI sender does when its output is configured, shown or hidden. */
export interface NdiSender {
  readonly configure: (screen: OutputScreen) => void;
  /** Starts sending, when the output shows; nothing while it sends. */
  readonly begin: () => void;
  /** Stops sending, when the output hides. */
  readonly stop: () => void;
  /** Draws the page again for the next frame. */
  readonly requestFrame: () => void;
  /** Stops for good and closes the window. */
  readonly destroy: () => void;
}

/**
 * The window handle of an NDI output. Its window never shows, so placing it
 * does nothing; showing it as a capture starts the sender, and hiding it
 * stops the sender.
 */
export function ndiOutputHandle(
  {win, reload}: NdiWindow,
  sender: NdiSender,
): OutputWindowHandle {
  return {
    previewContents: () => (win.isDestroyed() ? null : win.webContents),
    configure: sender.configure,
    prepare: () => undefined,
    requestFrame: sender.requestFrame,
    contentSize: () => ({width: NDI_FRAME_WIDTH, height: NDI_FRAME_HEIGHT}),
    setAlwaysOnTop: () => undefined,
    showFullScreen: () => undefined,
    showWindowed: () => undefined,
    showCapture: sender.begin,
    prepareForMonitorRemoval: () => undefined,
    bringToFront: () => undefined,
    bounds: () => null,
    hide: sender.stop,
    reload,
    crashRenderer: () => win.webContents.forcefullyCrashRenderer(),
    ping: async () => {
      await win.webContents.executeJavaScript('0');
    },
    destroy: sender.destroy,
  };
}
