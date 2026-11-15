const listeners = new Set<(itemId: string) => void>();

export function reportPrepOpenFailure(itemId: string): void {
  for (const listener of listeners) listener(itemId);
}

export function followPrepOpenFailures(
  listener: (itemId: string) => void,
): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
