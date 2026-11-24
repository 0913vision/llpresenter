import type {BrowserWindow} from 'electron';
import {
  expectedEnd,
  isLaunchTaskCounted,
  launchOrder,
  launchTaskLabel,
  launchTaskName,
  learnedTimes,
} from '@core/app';
import {
  LAUNCH_TASK_IDS,
  type LaunchTaskId,
  type LaunchTimes,
} from '@core/schema/launch';
import type {LaunchTracker} from '../base/launchTracker';
import type {Logger} from '../base/log';
import type {AppConfigFile} from '../store/locations/appConfigFile';
import type {LaunchBar, LaunchPlan} from '../windows/splash';

/** A task is slow when it takes this much more than expected. */
const SLOW = {factor: 2, ms: 1000};

function isNothing(value: unknown): boolean {
  return value === null;
}

interface TaskRecord {
  readonly beganAt: number;
  readonly endedAt?: number;
  readonly failed?: boolean;
}

export interface LaunchProgressOptions {
  readonly splash: Pick<BrowserWindow, 'isDestroyed' | 'close'>;
  /** Opens the bar of the launch window. */
  readonly openBar: (plan: LaunchPlan) => Pick<LaunchBar, 'advance' | 'end'>;
  readonly config: Pick<AppConfigFile, 'launchTimes' | 'setLaunchTimes'>;
  readonly log: Logger;
}

/**
 * Follows the tasks of the launch: on the bar of the launch window, in the
 * log, and for the launches after it, which expect what this one took.
 */
export class LaunchProgress implements LaunchTracker {
  private readonly startedAt = performance.now();
  private readonly tasks = new Map<LaunchTaskId, TaskRecord>();
  private readonly expected: LaunchTimes;
  private readonly bar: Pick<LaunchBar, 'advance' | 'end'>;
  private readonly listeners = new Set<
    (failed: readonly LaunchTaskId[]) => void
  >();
  private hasEnded = false;

  constructor(private readonly options: LaunchProgressOptions) {
    this.expected = options.config.launchTimes;
    this.bar = options.openBar({
      elapsed: 0,
      tasks: launchOrder(this.expected).map(id => ({
        id,
        label: launchTaskLabel(id),
        name: launchTaskName(id),
        counted: isLaunchTaskCounted(id),
        endsAt: expectedEnd(id, this.expected),
      })),
    });
  }

  /** Whether the launch window is still there. */
  get isShown(): boolean {
    return !this.options.splash.isDestroyed();
  }

  begin(task: LaunchTaskId): void {
    if (this.tasks.has(task)) return;
    const beganAt = this.now();
    this.tasks.set(task, {beganAt});
    this.options.log.info('launch task began', {task, at: beganAt});
  }

  advance(task: LaunchTaskId, done: number, total: number): void {
    this.begin(task);
    if (this.isOpen(task)) this.bar.advance(task, done, total);
  }

  finish(task: LaunchTaskId): void {
    const record = this.close(task, false);
    if (record === null) return;
    const {log} = this.options;
    const expected = expectedEnd(task, this.expected);
    const detail = {
      task,
      at: record.endedAt,
      took: record.endedAt - record.beganAt,
      expected,
    };
    if (record.endedAt > expected * SLOW.factor + SLOW.ms) {
      log.warn('launch task was slow', detail);
    } else {
      log.info('launch task ended', detail);
    }
  }

  fail(task: LaunchTaskId, error: unknown): void {
    const record = this.close(task, true);
    if (record === null) return;
    const {beganAt, endedAt} = record;
    this.options.log.error('launch task failed', {
      task,
      at: endedAt,
      took: endedAt - beganAt,
      error: error instanceof Error ? error.message : String(error),
    });
  }

  async track<T>(task: LaunchTaskId, work: Promise<T>): Promise<T> {
    this.begin(task);
    try {
      const result = await work;
      if (isNothing(result)) this.fail(task, 'nothing was opened');
      else this.finish(task);
      return result;
    } catch (error: unknown) {
      this.fail(task, error);
      throw error;
    }
  }

  /** What began and did not end in time is not waited for any more. */
  giveUp(): void {
    for (const task of this.unfinished()) {
      if (this.tasks.has(task)) this.fail(task, 'it took too long');
    }
  }

  /** Calls the listener once the launch ended with tasks that failed. */
  onFailure(listener: (failed: readonly LaunchTaskId[]) => void): void {
    this.listeners.add(listener);
  }

  /** The launch window goes, and the control window shows. */
  end(): void {
    if (this.hasEnded) return;
    this.hasEnded = true;
    if (this.isShown) this.options.splash.close();
    const failed = [...this.tasks].flatMap(([task, record]) =>
      record.failed === true ? [task] : [],
    );
    this.options.log.info('launch ended', {
      ms: this.now(),
      tasks: this.ends(),
      failed,
      unfinished: this.unfinished(),
    });
    if (failed.length === 0) this.learn();
    else for (const listener of this.listeners) listener(failed);
  }

  /** What the launch did, one line per task, for 진단 정보. */
  report(): readonly string[] {
    return [...this.tasks].map(([task, {beganAt, endedAt, failed}]) =>
      endedAt === undefined
        ? `${task}: began at ${beganAt} ms, not ended`
        : `${task}: ${beganAt} to ${endedAt} ms, expected ${expectedEnd(task, this.expected)}${failed === true ? ', failed' : ''}`,
    );
  }

  private now(): number {
    return Math.round(performance.now() - this.startedAt);
  }

  private isOpen(task: LaunchTaskId): boolean {
    const record = this.tasks.get(task);
    return record !== undefined && record.endedAt === undefined;
  }

  private close(
    task: LaunchTaskId,
    failed: boolean,
  ): {readonly beganAt: number; readonly endedAt: number} | null {
    this.begin(task);
    const record = this.tasks.get(task);
    if (record === undefined || record.endedAt !== undefined) return null;
    const closed = {...record, endedAt: this.now(), failed};
    this.tasks.set(task, closed);
    this.bar.end(task, failed);
    return closed;
  }

  private unfinished(): readonly LaunchTaskId[] {
    return LAUNCH_TASK_IDS.filter(
      task => this.tasks.get(task)?.endedAt === undefined,
    );
  }

  private ends(): LaunchTimes {
    const ends: Partial<Record<LaunchTaskId, number>> = {};
    for (const [task, {endedAt}] of this.tasks) {
      if (endedAt !== undefined) ends[task] = endedAt;
    }
    return ends;
  }

  private learn(): void {
    const {config} = this.options;
    config.setLaunchTimes(learnedTimes(config.launchTimes, this.ends()));
  }
}
