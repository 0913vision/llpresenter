import type {LlpApi} from '@contracts/ipc/api';
import {mediaUrl} from '@contracts/ipc/mediaUrls';
import {rendererErrorEntry} from '@core/schema/app/ipcPayloads';
import {OutputRenderer} from '@renderer/rendering/outputRenderer';
import {MediaPreloader} from './mediaPreloader';
import {SlideSwitch} from './slideSwitch';
import {OUTPUT_REVEAL_DEADLINE_MS} from '@core/output';
import type {SlideTransition} from '@core/schema/slides/slideTransition';
import {slideChangeOf, slideMoved} from './slideChange';
import type {LiveState} from '@core/schema/live/live';
import {ScreenFrames} from '@renderer/rendering/screen/screenFrames';
import {startFrameRateMeter, type FrameRateMeter} from './frameRateMeter';
import {followLiveState} from './liveFeed';
import {followPlaybackProblems} from '@renderer/rendering/media/playbackProblem';
import {previewMediaOf} from '@renderer/rendering/media/previewMedia';
import {RevealReadiness} from './revealReadiness';

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
    api.log.write(rendererErrorEntry(message, error));
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
  let drawCount = 0;
  let drawnState = '';
  let fontsReady = typeof document.fonts === 'undefined';
  const enabled = (): boolean => latest?.outputs[screenId] === true;
  const reveal = new RevealReadiness({
    complete: () => complete(),
    frameKey: () => frameKey(),
    version: () => latest?.version ?? null,
    enabled,
    report: ({version, ready}) =>
      api.output.reportReady({
        screenId,
        version,
        ready,
        width: window.innerWidth,
        height: window.innerHeight,
      }),
    onStandbyReady: () => {
      meter?.stop();
      meter = null;
    },
    onShown: () => draw(),
    onError: report,
  });
  const draw = (): void => {
    if (latest === null) return;
    if (!enabled()) {
      reveal.restart();
      reveal.forgetFrames();
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
        transitions: enabled() && !reveal.isPending && !slides.changing,
      });
      hasFrame = true;
      drawCount += 1;
      reportFrameRates();
      reveal.watch();
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
  const resized = (): void => {
    reveal.restart();
    reveal.forgetFrames();
    if (!enabled()) draw();
    reveal.watch();
    meter?.refresh();
  };
  window.addEventListener('resize', resized);
  const raise = (): void => {
    if (enabled()) api.output.showWindow(screenId);
  };
  root.addEventListener('pointerdown', raise);
  const reportFrameRates = (): void => {
    if (!enabled() && !reveal.isPending) return;
    meter ??= startFrameRateMeter({
      // NOTE(0913vision): Only a pending reveal needs readiness work.
      onFrame: time => reveal.noteFrame(time),
      active: () =>
        reveal.isPending || (enabled() && slides.renderer().moving()),
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
    if (wasEnabled !== enabled()) reveal.restart();
    const content = drawnContent(state);
    if (content !== drawnState || wasEnabled !== enabled()) {
      drawnState = content;
      draw();
    }
    reportFrameRates();
    reveal.watch();
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
        revealing: reveal.isPending,
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
    reveal.stop();
    preloader?.dispose();
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
