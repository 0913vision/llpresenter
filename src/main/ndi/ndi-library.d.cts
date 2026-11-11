export function runtimePath(env?: NodeJS.ProcessEnv): string | null;
export function openReal(env?: NodeJS.ProcessEnv): {
  send(data: Buffer): void;
  sync(): void;
  close(): void;
};
