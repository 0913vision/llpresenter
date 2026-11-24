/** A fixed fraction, or a transition whose progress follows wall-clock time. */
export type TransitionProgress =
  number | {readonly startedAt: number; readonly duration: number};

/** CSS animation catches up when a progress bar mounts during a transition. */
export function progressStyle(progress: TransitionProgress) {
  if (typeof progress === 'number') {
    return {transform: `scaleX(${progress})`};
  }
  return {
    animationDuration: `${progress.duration}ms`,
    animationDelay: `${progress.startedAt - Date.now()}ms`,
  };
}
