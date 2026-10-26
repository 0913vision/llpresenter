/** Runs one task at a time and keeps only the newest task that waits. */
export interface LatestRunner {
  readonly submit: (task: () => Promise<void>) => void;
}

export function createLatestRunner(): LatestRunner {
  let running = false;
  let waiting: (() => Promise<void>) | null = null;
  const start = (task: () => Promise<void>): void => {
    running = true;
    const finish = (): void => {
      running = false;
      const next = waiting;
      waiting = null;
      if (next !== null) start(next);
    };
    task().then(finish, finish);
  };
  return {
    submit: task => {
      if (running) waiting = task;
      else start(task);
    },
  };
}
