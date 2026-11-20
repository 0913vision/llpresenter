export function takeLatestFrame<T>(
  next: () => T | null,
  release: (frame: T) => void,
  limit?: number,
): T | null;
