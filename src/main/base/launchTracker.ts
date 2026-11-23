import type {LaunchTaskId} from '@core/schema/launch';

/** Follows the tasks of the launch. */
export interface LaunchTracker {
  /** Follows a task until its work settles; `null` counts as a failure. */
  track<T>(task: LaunchTaskId, work: Promise<T>): Promise<T>;
  /** Tells how many of the parts of a task are done. */
  advance(task: LaunchTaskId, done: number, total: number): void;
}

/** Follows nothing, for what opens outside a launch. */
export const NO_LAUNCH: LaunchTracker = {
  track: (_task, work) => work,
  advance: () => undefined,
};

/** Told how many of the parts that are known so far are done. */
export type OnProgress = (done: number, total: number) => void;

/** Counts parts whose number is only known while they are done. */
export class PartCounter {
  private done = 0;
  private total = 0;

  constructor(private readonly onProgress: OnProgress) {}

  expect(parts: number): void {
    this.total += parts;
    this.onProgress(this.done, this.total);
  }

  add(parts: number): void {
    this.done += parts;
    this.onProgress(this.done, this.total);
  }
}
