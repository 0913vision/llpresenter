import type {LlpApi} from '@shared/ipc';
import {mediaUrl} from '@shared/media';
import {RENDERER_LOG_LIMITS} from '@shared/schema/ipcPayloads';
import {DEFAULT_LYRIC_STYLE} from '../render/lyricStyle';
import {OutputRenderer} from '../render/outputRenderer';
import {startFrameRateMeter} from './frameRateMeter';
import {followLiveState} from './liveFeed';

/** What an output window runs on. */
export interface OutputContext {
  readonly root: HTMLElement;
  readonly api: LlpApi;
  readonly screenId: string;
}

type ErrorReport = (message: string, error: unknown) => void;

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
 * log instead of showing it, and reports the frame rate once a second
 * (docs/spec/03-output.md).
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
  const stopFollowing = followLiveState(
    api.live,
    state => renderer.render(state.layers),
    report,
  );
  const stopMeter = startFrameRateMeter({
    report: fps => api.output.reportFrameRate({screenId, fps}),
  });
  return () => {
    stopMeter();
    stopFollowing();
    renderer.dispose();
    stopCatching();
  };
}
