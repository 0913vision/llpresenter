import type {LlpApi} from '@shared/ipc';
import {RENDERER_LOG_LIMITS} from '@shared/schema/ipcPayloads';
import {AudioPlayer} from '../render/audioPlayer';
import {MainTimerClock} from '../render/mainTimerClock';
import {followLiveState} from './liveFeed';

/** Runs audio only in main's dedicated hidden window, muted unless explicitly allowed. */
export function startAudio({
  root,
  api,
  muted = true,
}: {
  readonly root: HTMLElement;
  readonly api: LlpApi;
  readonly muted?: boolean;
}): () => void {
  const report = (message: string, error: unknown): void => {
    api.log.write({
      level: 'error',
      message,
      detail: String(error).slice(0, RENDERER_LOG_LIMITS.detail),
    });
  };
  const reading = Promise.resolve().then(() => api.live.clock());
  const clock = new MainTimerClock(() => reading, report);
  const player = new AudioPlayer(root, {
    muted,
    now: () => clock.now().timer,
    onNext: trackVersion => api.live.send({type: 'audio.next', trackVersion}),
    onError: report,
  });
  let stopped = false;
  let stopFollowing: (() => void) | undefined;
  const begin = (): void => {
    if (!stopped) {
      stopFollowing = followLiveState(
        api.live,
        state => player.show(state),
        report,
      );
    }
  };
  void reading
    .then(begin, begin)
    .catch((error: unknown) => report('could not follow audio output', error));
  const stop = (): void => {
    if (stopped) return;
    stopped = true;
    window.removeEventListener('pagehide', stop);
    try {
      stopFollowing?.();
    } catch (error) {
      report('could not release audio output', error);
    } finally {
      player.dispose();
    }
  };
  window.addEventListener('pagehide', stop, {once: true});
  return stop;
}
