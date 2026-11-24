import type {LlpApi} from '@contracts/ipc/api';
import {mediaUrl} from '@contracts/ipc/mediaUrls';
import {RENDERER_LOG_LIMITS} from '@core/schema/app/ipcPayloads';
import {OutputRenderer} from '../rendering/outputRenderer';
import {MediaPreloader} from './mediaPreloader';
import {SlideSwitch} from './slideSwitch';
import {OUTPUT_REVEAL_DEADLINE_MS} from '@core/output';
import type {SlideTransition} from '@core/schema/slides/slideTransition';
import {slideChangeOf, slideMoved} from './slideChange';
import type {LiveState} from '@core/schema/live/live';
import {ScreenFrames} from '../rendering/screenFrames';
import {startFrameRateMeter, type FrameRateMeter} from './frameRateMeter';
import {followLiveState} from './liveFeed';
import {followPlaybackProblems} from '../rendering/playbackProblem';
import {previewMediaOf} from '../rendering/previewMedia';

/** What an output window runs on. */
export interface OutputContext {
  readonly root: HTMLElement;
  readonly api: LlpApi;
  readonly screenId: string;
  readonly ndi?: boolean;
  /** Blends slide transitions outside the page, when a presenter shows it. */
  readonly presentTransition?: (effect: SlideTransition) => void;
}

type ErrorReport = (message: string, error: unknown) => void;
export const READY_RECHECK_MS = 100;

/** How often an output that waits to be revealed checks its frame. */
export const READY_POLL_MS = 16;

const MOTION_EVENTS = [
  'playing',
  'pause',
  'ended',
  'emptied',
  'transitionrun',
  'transitionend',
  'transitioncancel',
  'animationstart',
  'animationend',
  'animationcancel',
] as const;

function drawnContent(state: LiveState): string {
  return JSON.stringify([
    state.layers,
    state.blackScreen,
    state.stageMessage,
    state.clearEffects,
    state.timers,
    state.testPatterns,
    state.stageTimerId,
    state.item,
    state.themeOutput,
  ]);
}

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
 * log instead of showing it, and reports moving frame rates or static health
 * once a second after the first live state is drawn (docs/spec/03-output.md).
 *
 * @returns A function that stops everything it started.
 */
export function startOutput({
  root,
  api,
  screenId,
  ndi = false,
  presentTransition,
}: OutputContext): () => void {
  const stopPlaybackProblems = followPlaybackProblems(
    root,
    api.output.reportPlaybackProblems,
  );
  const report: ErrorReport = (message, error) => {
    api.log.write({
      level: 'error',
      message: message.slice(0, RENDERER_LOG_LIMITS.message),
      detail: describeError(error),
    });
  };
  const stopCatching = catchUncaughtErrors(report);
  const slides = new SlideSwitch({
    create: () =>
      new OutputRenderer(root, {
        transparent: ndi,
        mediaUrl,
        previewMedia: previewMediaOf(api),
        onError: report,
      }),
    present: presentTransition,
    onLate: incoming => {
      api.log.write({
        level: 'warn',
        message: `incoming slide not ready after ${OUTPUT_REVEAL_DEADLINE_MS} ms; showing it anyway`,
        detail: JSON.stringify({
          screenId,
          elements: incoming.unreadyElements(),
          fontsReady,
        }),
      });
    },
    onError: report,
  });
  let preloader: MediaPreloader | null = null;
  let hasFrame = false;
  let latest: LiveState | null = null;
  let stopped = false;
  let revealPending = true;
  let lastAttempt = -Infinity;
  let lastReady = false;
  let enableEpoch = 0;
  let drawCount = 0;
  let drawnState = '';
  let seenFrame = '';
  let paintedFrame = '';
  let fontsReady = typeof document.fonts === 'undefined';
  let readyInFlight = false;
  let readyTimer: ReturnType<typeof setTimeout> | null = null;
  const enabled = (): boolean => latest?.outputs[screenId] === true;
  /** The screen waits again to be revealed, as when it was just turned on. */
  const restartReveal = (): void => {
    enableEpoch += 1;
    revealPending = true;
    lastAttempt = -Infinity;
    lastReady = false;
  };
  /** Forgets the frames seen so far, so readiness waits for a new paint. */
  const forgetFrames = (): void => {
    seenFrame = '';
    paintedFrame = '';
  };
  const draw = (): void => {
    if (latest === null) return;
    if (!enabled()) {
      restartReveal();
      forgetFrames();
    }
    hasFrame = false;
    try {
      const frame = frames.frame(latest);
      if (frame === undefined) return;
      if (frame.screen?.kind === 'audience') {
        preloader ??= new MediaPreloader(api);
      } else if (frame.screen !== undefined && preloader !== null) {
        preloader.dispose();
        preloader = null;
      }
      slides.renderer().render(latest.layers, {
        ...frame,
        standby: !enabled(),
        ...(!enabled() ? {clearEffects: []} : {}),
        transitions: enabled() && !revealPending && !slides.changing,
      });
      hasFrame = true;
      drawCount += 1;
      reportFrameRates();
      watchReadiness();
    } catch (error) {
      report('could not update the output frame', error);
    }
  };
  const frames = new ScreenFrames({
    transparent: ndi,
    fonts: api.fonts,
    settings: api.settings,
    clock: () => api.live.clock(),
    wallClock: api.live,
    screenId,
    onChange: draw,
    onError: report,
  });
  let meter: FrameRateMeter | null = null;
  const refreshMotion = (): void => meter?.refresh();
  for (const event of MOTION_EVENTS) {
    root.addEventListener(event, refreshMotion, true);
  }
  if (!fontsReady) {
    void document.fonts.ready
      .then(() => {
        fontsReady = true;
      })
      .catch((error: unknown) =>
        report('could not prepare output fonts', error),
      );
  }
  const complete = (): boolean =>
    fontsReady && hasFrame && slides.renderer().ready();
  const frameKey = (): string =>
    `${drawCount}/${window.innerWidth}/${window.innerHeight}`;
  // NOTE(0913vision): Only a pending reveal needs readiness work. A frame is
  // painted once the next animation frame sees the same completed drawing.
  const noteFrame = (time: number): void => {
    if (!revealPending) return;
    const key = complete() ? frameKey() : '';
    if (key === '') paintedFrame = '';
    else if (key === seenFrame) paintedFrame = key;
    seenFrame = key;
    reportReady(time);
  };
  const reportReady = (time: number): void => {
    if (stopped || readyInFlight || latest === null || !revealPending) {
      return;
    }
    const version = latest.version;
    const width = window.innerWidth;
    const height = window.innerHeight;
    // NOTE(0913vision): An unpainted frame must reach main as not ready so it
    // can wake a hidden native compositor without treating a timer as a paint.
    const ready = complete() && paintedFrame === frameKey();
    if (time - lastAttempt < READY_RECHECK_MS && (!ready || lastReady)) return;
    lastAttempt = time;
    lastReady = ready;
    const epoch = enableEpoch;
    readyInFlight = true;
    void api.output
      .reportReady({
        screenId,
        version,
        ready,
        width,
        height,
      })
      .then(shown => {
        if (stopped || enableEpoch !== epoch) return;
        if (!enabled() && ready) {
          revealPending = false;
          if (readyTimer !== null) clearTimeout(readyTimer);
          readyTimer = null;
          meter?.stop();
          meter = null;
        } else if (enabled() && shown) {
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
  const watchReadiness = (): void => {
    if (stopped || readyTimer !== null || !revealPending) return;
    readyTimer = setTimeout(() => {
      readyTimer = null;
      reportReady(performance.now());
      watchReadiness();
    }, READY_POLL_MS);
  };
  const resized = (): void => {
    restartReveal();
    forgetFrames();
    if (!enabled()) draw();
    watchReadiness();
    meter?.refresh();
  };
  window.addEventListener('resize', resized);
  const raise = (): void => {
    if (enabled()) api.output.showWindow(screenId);
  };
  root.addEventListener('pointerdown', raise);
  const reportFrameRates = (): void => {
    if (!enabled() && !revealPending) return;
    meter ??= startFrameRateMeter({
      onFrame: noteFrame,
      active: () => revealPending || (enabled() && slides.renderer().moving()),
      reportIdle: () => api.output.reportHealth({screenId}),
      report: fps => api.output.reportFrameRate({screenId, fps}),
    });
    meter.refresh();
  };
  // NOTE(0913vision): The main process takes reports as signs of life, so
  // the meter starts only
  // once the first state is drawn.
  const applyState = (state: LiveState): void => {
    const wasEnabled = enabled();
    latest = state;
    if (wasEnabled !== enabled()) restartReveal();
    const content = drawnContent(state);
    if (content !== drawnState || wasEnabled !== enabled()) {
      drawnState = content;
      draw();
    }
    reportFrameRates();
    watchReadiness();
  };
  const stopFollowing = followLiveState(
    api.live,
    state => {
      const slide = state.layers.slide;
      if (slideMoved(latest, state) && slide !== null) {
        preloader?.request({itemId: slide.itemId, index: slide.position});
      }
      const change = slideChangeOf(latest, state, {
        id: screenId,
        kind: frames.screenKind(),
        on: enabled(),
        revealing: revealPending,
      });
      if (change.kind === 'change') {
        slides.change(change.effect, {
          draw: () => applyState(state),
          complete,
        });
        return;
      }
      if (change.end) slides.end();
      applyState(state);
    },
    report,
  );
  return () => {
    stopped = true;
    preloader?.dispose();
    if (readyTimer !== null) clearTimeout(readyTimer);
    window.removeEventListener('resize', resized);
    root.removeEventListener('pointerdown', raise);
    meter?.stop();
    for (const event of MOTION_EVENTS) {
      root.removeEventListener(event, refreshMotion, true);
    }
    stopFollowing();
    frames.dispose();
    slides.dispose();
    stopCatching();
    stopPlaybackProblems();
  };
}
