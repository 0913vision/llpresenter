const kept = new Set<() => void>();

/**
 * Registers a drawing that outlives the panel that showed it, such as a screen
 * preview kept while 진행 is away.
 *
 * @returns A function that forgets the drawing once it has freed itself.
 */
export function keepDrawing(release: () => void): () => void {
  kept.add(release);
  return () => {
    kept.delete(release);
  };
}

/** Frees every kept drawing: renderers, subscriptions, timers, and holders. */
export function releaseKeptDrawings(): void {
  const releases = [...kept];
  kept.clear();
  for (const release of releases) release();
}
