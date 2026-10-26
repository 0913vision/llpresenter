import type {LlpApi} from '@shared/ipc';
import {mediaUrl} from '@shared/media';
import {RENDERER_LOG_LIMITS} from '@shared/schema/ipcPayloads';
import {DEFAULT_LYRIC_STYLE} from '../render/lyricStyle';
import {OutputRenderer} from '../render/outputRenderer';
import type {LiveState} from '@shared/live';
import {ScreenFrames} from '../render/screenFrames';
import {startFrameRateMeter} from './frameRateMeter';
import {followLiveState} from './liveFeed';

/** What an output window runs on. */
export interface OutputContext {
  readonly root: HTMLElement;
  readonly api: LlpApi;
  readonly screenId: string;
}

type ErrorReport = (message: string, error: unknown) => void;
export const READY_RECHECK_MS = 100;

function describeError(error: unknown): string {
  const text =
    error instanceof Error
      ? (error.stack ?? `${error.name}: ${error.message}`)
      : String(error);
  return text.slice(0, RENDERER_LOG_LIMITS.detail);
}

function catchUncaughtErrors(report: ErrorReport): () => void {
  const onError = (event: ErrorEvent): void => {
    report('uncaught error in an output window', event.error ?? event.message);
  };
  const onRejection = (event: PromiseRejectionEvent): void => {
    report('unhandled rejection in an output window', event.reason);
  };
  window.addEventListener('error', onError);
  window.addEventListener('unhandledrejection', onRejection);
  return () => {
    window.removeEventListener('error', onError);
    window.removeEventListener('unhandledrejection', onRejection);
  };
}

/**
 * Runs one output window: draws the live state, sends every error to the main
 * log instead of showing it, and reports the frame rate once a second from the
 * time the first live state is drawn (docs/spec/03-output.md).
 *
 * @returns A function that stops everything it started.
 */
export function startOutput({root, api, screenId}: OutputContext): () => void {
  const report: ErrorReport = (message, error) => {
    api.log.write({
      level: 'error',
      message: message.slice(0, RENDERER_LOG_LIMITS.message),
      detail: describeError(error),
    });
  };
  const stopCatching = catchUncaughtErrors(report);
  const renderer = new OutputRenderer(root, {
    lyricStyle: DEFAULT_LYRIC_STYLE,
    mediaUrl,
    onError: report,
  });
  let latest: LiveState | null = null;
  let stopped = false;
  let revealPending = true;
  let lastAttempt = -Infinity;
  let enableEpoch = 0;
  let stableFrame = '';
  let fontsReady = typeof document.fonts === 'undefined';
  let readyInFlight = false;
  const enabled = (): boolean => latest?.outputs[screenId] === true;
  const draw = (): void => {
    if (latest === null) return;
    if (!enabled()) revealPending = true;
    const frame = frames.frame(latest);
    renderer.render(latest.layers, {
      ...frame,
      transitions: enabled() && !revealPending,
    });
    stableFrame = '';
  };
  const frames = new ScreenFrames({
    settings: api.settings,
    clock: () => api.live.clock(),
    screenId,
    onChange: draw,
    onError: report,
    onGap: (message, gap) =>
      api.log.write({
        level: 'warn',
        message,
        detail: `${gap.kind} ${gap.id} on screen ${screenId}`.slice(
          0,
          RENDERER_LOG_LIMITS.detail,
        ),
      }),
  });
  let stopMeter: (() => void) | null = null;
  if (!fontsReady) {
    void document.fonts.ready
      .then(() => {
        fontsReady = true;
      })
      .catch((error: unknown) =>
        report('could not prepare output fonts', error),
      );
  }
  const reportReady = (time: number): void => {
    if (
      stopped ||
      readyInFlight ||
      latest === null ||
      !enabled() ||
      !revealPending
    ) {
      return;
    }
    const version = latest.version;
    const width = window.innerWidth;
    const height = window.innerHeight;
    const frameKey = `${version}/${width}/${height}`;
    const complete =
      fontsReady && frames.frame(latest) !== undefined && renderer.ready();
    if (complete && stableFrame !== frameKey) {
      stableFrame = frameKey;
      return;
    }
    if (!complete) stableFrame = '';
    if (time - lastAttempt < READY_RECHECK_MS) return;
    lastAttempt = time;
    const epoch = enableEpoch;
    readyInFlight = true;
    void api.output
      .reportReady({
        screenId,
        version,
        ready: complete,
        width,
        height,
      })
      .then(shown => {
        if (!stopped && enableEpoch === epoch && enabled() && shown) {
          revealPending = false;
          draw();
        }
      })
      .catch((error: unknown) =>
        report('could not report a ready output frame', error),
      )
      .finally(() => {
        readyInFlight = false;
      });
  };
  const resized = (): void => {
    lastAttempt = -Infinity;
    stableFrame = '';
  };
  window.addEventListener('resize', resized);
  const raise = (): void => {
    if (enabled()) api.output.showWindow(screenId);
  };
  root.addEventListener('pointerdown', raise);
  const reportFrameRates = (): void => {
    stopMeter ??= startFrameRateMeter({
      onFrame: reportReady,
      report: fps => api.output.reportFrameRate({screenId, fps}),
    });
  };
  // NOTE(0913vision): The main process takes the first frame rate report as
  // the sign that the page drew the live state, so the meter starts only
  // once the first state is drawn.
  const stopFollowing = followLiveState(
    api.live,
    state => {
      const wasEnabled = enabled();
      latest = state;
      if (wasEnabled !== enabled()) {
        enableEpoch += 1;
        revealPending = true;
        lastAttempt = -Infinity;
      }
      draw();
      reportFrameRates();
    },
    report,
  );
  return () => {
    stopped = true;
    window.removeEventListener('resize', resized);
    root.removeEventListener('pointerdown', raise);
    stopMeter?.();
    stopFollowing();
    frames.dispose();
    renderer.dispose();
    stopCatching();
  };
}
