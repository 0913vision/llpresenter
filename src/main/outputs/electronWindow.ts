import {BrowserWindow} from 'electron';
import {centeredRect, sameRect, type Rect, type Size} from '../displays/rect';
import type {Logger} from '../log';
import {
  blockNavigation,
  loadPage,
  preloadPath,
  startLoading,
  type PageRequest,
} from '../windows/page';
import {
  discardTestFrames,
  windowTestOptions,
  type WindowMode,
} from '../windows/testWindows';
import type {OutputWindowEvents, OutputWindowHandle} from './outputWindow';
import type {OutputScreen} from './screens';
import {OnTopKeeper} from './onTopKeeper';
import {WindowPlacement} from './windowPlacement';

export const OUTPUT_BACKGROUND = '#000000';
const CAPTURE_BACKGROUND = '#00b140';
const PING_SCRIPT = '0';

function halfOf({width, height}: Rect): Size {
  return {width: Math.round(width / 2), height: Math.round(height / 2)};
}

/** What an Electron output window needs besides its screen and events. */
export interface ElectronOutputWindowOptions {
  readonly log: Logger;
  readonly mode: WindowMode;
  readonly control: Pick<BrowserWindow, 'isDestroyed' | 'moveAbove'>;
}

function createBrowserWindow(
  screen: OutputScreen,
  mode: WindowMode,
): BrowserWindow {
  const {webPreferences: testPreferences, ...testOptions} =
    windowTestOptions(mode);
  return new BrowserWindow({
    show: false,
    paintWhenInitiallyHidden: true,
    focusable: true,
    title: screen.name,
    backgroundColor:
      screen.method === 'capture' ? CAPTURE_BACKGROUND : OUTPUT_BACKGROUND,
    minimizable: screen.method !== 'capture',
    maximizable: screen.method !== 'capture',
    resizable: screen.method !== 'capture',
    ...testOptions,
    webPreferences: {
      preload: preloadPath,
      sandbox: true,
      contextIsolation: true,
      nodeIntegration: false,
      spellcheck: false,
      // NOTE(0913vision): An output keeps drawing at full rate even when
      // Windows reports it as covered or in the background.
      backgroundThrottling: false,
      ...testPreferences,
    },
  });
}

function enterFullScreen(win: BrowserWindow, monitorBounds: Rect): void {
  if (win.isFullScreen() && sameRect(win.getBounds(), monitorBounds)) return;
  if (win.isFullScreen()) win.setFullScreen(false);
  // NOTE(0913vision): Windows makes a window full screen on the monitor it
  // overlaps most. A smaller window in the middle of the monitor stays on it
  // even when setBounds sizes it wrong across monitors with different scale
  // factors.
  if (!sameRect(win.getContentBounds(), monitorBounds)) {
    win.setBounds(centeredRect(monitorBounds, halfOf(monitorBounds)));
  }
  win.setFullScreen(true);
}

function listen(win: BrowserWindow, events: OutputWindowEvents): void {
  win.on('close', event => {
    event.preventDefault();
    events.onCloseRequested();
  });
  win.on('page-title-updated', event => event.preventDefault());
  win.webContents.on('render-process-gone', (_event, {reason, exitCode}) =>
    events.onRendererGone({reason, exitCode}),
  );
}

type OutputPresentation = Pick<
  OutputWindowHandle,
  | 'showFullScreen'
  | 'showWindowed'
  | 'showCapture'
  | 'prepareForMonitorRemoval'
  | 'bringToFront'
  | 'bounds'
  | 'hide'
  | 'setAlwaysOnTop'
> & {readonly dispose: () => void};

function presentOnScreen(
  win: BrowserWindow,
  {control, log}: ElectronOutputWindowOptions,
): OutputPresentation {
  const placement = new WindowPlacement(win, log);
  const onTop = new OnTopKeeper(win, log);
  let unplacedBounds: Rect | null = null;
  let wantedOnTop = false;
  let demoted = false;
  const setAlwaysOnTop = (on: boolean): void => {
    wantedOnTop = on;
    onTop.set(on);
  };
  const raise = (): void => {
    if (win.isMinimized()) win.showInactive();
    else if (!win.isVisible()) return;
    win.moveTop();
  };
  const showOnce = (): void => {
    if (win.isVisible()) return;
    win.showInactive();
    win.moveTop();
  };
  const orderWindow = (): void => {
    onTop.set(wantedOnTop);
    if (demoted && !control.isDestroyed()) {
      control.moveAbove(win.getMediaSourceId());
    }
  };
  const placeBehindControl = (): void => {
    demoted = true;
    setAlwaysOnTop(false);
    if (!control.isDestroyed()) control.moveAbove(win.getMediaSourceId());
  };
  const profile = (method: 'window' | 'capture') => {
    const normal = method === 'window';
    win.setBackgroundColor(normal ? OUTPUT_BACKGROUND : CAPTURE_BACKGROUND);
    win.setMinimizable(normal);
    win.setMaximizable(normal);
    win.setResizable(normal);
  };
  return {
    setAlwaysOnTop,
    showFullScreen: (monitorBounds, alwaysOnTop) => {
      unplacedBounds = null;
      demoted = false;
      wantedOnTop = alwaysOnTop;
      const place = () => {
        profile('window');
        win.setFocusable(true);
        // NOTE(0913vision): The keeper lets go while Windows moves the window
        // into full screen, so a level change mid-move is no loss.
        onTop.release();
        enterFullScreen(win, monitorBounds);
        orderWindow();
        showOnce();
      };
      placement.fullscreen(place);
    },
    showWindowed: (bounds, alwaysOnTop = false) => {
      wantedOnTop = alwaysOnTop;
      if (bounds !== null) unplacedBounds = bounds;
      const place = () => {
        profile('window');
        win.setFocusable(true);
        if (unplacedBounds !== null) {
          win.setBounds(unplacedBounds);
          placement.verifyBounds(unplacedBounds, orderWindow);
        }
        unplacedBounds = null;
        showOnce();
        orderWindow();
      };
      onTop.set(false);
      placement.windowed(place);
    },
    showCapture: (bounds, alwaysOnTop = false) => {
      unplacedBounds = null;
      wantedOnTop = alwaysOnTop;
      onTop.set(false);
      placement.windowed(() => {
        profile('capture');
        win.setFocusable(true);
        win.setContentBounds(bounds);
        placement.verifyContentBounds(bounds, orderWindow);
        showOnce();
        orderWindow();
      });
    },
    prepareForMonitorRemoval: placeBehindControl,
    bounds: () => (win.isDestroyed() ? null : win.getBounds()),
    bringToFront: () => {
      demoted = false;
      raise();
    },
    hide: () => {
      demoted = false;
      placement.cancel();
      onTop.release();
      win.hide();
    },
    dispose: () => {
      unplacedBounds = null;
      placement.dispose();
      onTop.dispose();
    },
  };
}

function presentOffscreen(win: BrowserWindow): OutputPresentation {
  // NOTE(0913vision): An offscreen window takes the size it would have on
  // screen, so its page lays out the same, but it never shows, takes focus,
  // goes full screen, or stays on top.
  return {
    setAlwaysOnTop: () => undefined,
    showFullScreen: monitorBounds => win.setContentBounds(monitorBounds),
    showWindowed: bounds => {
      if (bounds !== null) win.setBounds(bounds);
    },
    showCapture: bounds => win.setContentBounds(bounds),
    prepareForMonitorRemoval: () => undefined,
    bounds: () => (win.isDestroyed() ? null : win.getBounds()),
    bringToFront: () => undefined,
    hide: () => undefined,
    dispose: () => undefined,
  };
}

function presentationFor(
  win: BrowserWindow,
  options: ElectronOutputWindowOptions,
): OutputPresentation {
  switch (options.mode) {
    case 'normal':
      return presentOnScreen(win, options);
    case 'offscreen':
      return presentOffscreen(win);
  }
}

/**
 * Creates the hidden Electron window of one output and loads the output page
 * for its screen. It is a framed window that goes full screen, so moving
 * between full screen and window mode never reloads the page. Its close
 * button only reports the request; `destroy` closes it. In `offscreen` mode
 * it never appears, but its page still gets the size of its placement.
 */
export function createElectronOutputWindow(
  screen: OutputScreen,
  events: OutputWindowEvents,
  options: ElectronOutputWindowOptions,
): OutputWindowHandle {
  const {log, mode} = options;
  const win = createBrowserWindow(screen, mode);
  discardTestFrames(win.webContents, mode);
  const page: PageRequest = {name: 'output', query: {screen: screen.id}};
  win.removeMenu();
  blockNavigation(win);
  listen(win, events);
  loadPage(win, page, log);
  const {dispose, ...presentation} = presentationFor(win, options);
  win.once('closed', dispose);
  return {
    ...presentation,
    configure: screen => win.setTitle(screen.name),
    prepare: (bounds, kind) => {
      if (kind === 'window') win.setBounds(bounds);
      else win.setContentBounds(bounds);
    },
    contentSize: () => win.getContentBounds(),
    reload: () => startLoading(win, page),
    crashRenderer: () => {
      if (!win.isDestroyed()) win.webContents.forcefullyCrashRenderer();
    },
    ping: async () => {
      await win.webContents.executeJavaScript(PING_SCRIPT);
    },
    destroy: () => {
      win.removeListener('closed', dispose);
      dispose();
      if (!win.isDestroyed()) win.destroy();
    },
  };
}
