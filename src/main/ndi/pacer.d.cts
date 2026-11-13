export function createPacer(
  send: () => void,
  rate?: {n: number; d: number},
): {sent(): void; stop(): void};
