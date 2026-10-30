const FADE_STEP_MS = 20;

interface AudioFadeOptions {
  readonly durationMs: number;
  readonly now: () => number;
  readonly gain: (fraction: number) => void;
  readonly end: () => void;
  readonly onError: (error: unknown) => void;
}

/** A bounded audio envelope; the deadline stops playback even if clock sampling stalls. */
export function fadeAudio({
  durationMs,
  now,
  gain,
  end,
  onError,
}: AudioFadeOptions): () => void {
  const started = now();
  let stopped = false;
  const cancel = (): void => {
    if (stopped) return;
    stopped = true;
    clearInterval(tick);
    clearTimeout(deadline);
  };
  const finish = (): void => {
    if (stopped) return;
    cancel();
    try {
      gain(0);
    } catch (error) {
      onError(error);
    } finally {
      try {
        end();
      } catch (error) {
        onError(error);
      }
    }
  };
  const tick = setInterval(() => {
    if (stopped) return;
    try {
      gain(Math.max(0, 1 - Math.max(0, now() - started) / durationMs));
    } catch (error) {
      onError(error);
      finish();
    }
  }, FADE_STEP_MS);
  const deadline = setTimeout(finish, durationMs);
  return cancel;
}
