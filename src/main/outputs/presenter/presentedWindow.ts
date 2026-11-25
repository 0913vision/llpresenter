import {THEME_CANVAS} from '@core/schema/screens/screens';
import type {Rect, Size} from '../../displays/rect';
import type {Logger} from '../../base/log';
import type {OutputWindowEvents, OutputWindowHandle} from '../outputWindow';
import type {OutputScreen} from '../screens';
import type {PlaybackProblemBoard} from '../health/playbackProblems';
import {createPresenterPart, type PresenterPart} from './presenterPart';

const DEFAULT_SIZE: Size = THEME_CANVAS;

/**
 * What a presented window uses: the log, the optional playback problem board,
 * and the maker of the ordinary output window.
 */
export interface PresentedWindowOptions {
  readonly log: Logger;
  readonly playbackProblems?: PlaybackProblemBoard;
  /** The ordinary output window, for window and capture placements and as the fallback. */
  readonly window: () => OutputWindowHandle;
}

/**
 * The output of one screen. In full screen it is drawn by a presenter at the
 * monitor's refresh; in window and capture placements, or when the presenter
 * cannot run, it is the ordinary Electron output window. After a fallback the
 * presenter is asked again once the output has been off.
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
    options.log.warn('output presenter unavailable; using the output window', {
      screen: current.id,
      reason: String(reason),
    });
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
      // NOTE(0913vision): Turning the output off and on is how an operator
      // tries again, so the next full screen asks the presenter once more
      // instead of keeping the output window until the app restarts.
      failed = false;
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
