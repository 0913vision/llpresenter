import {
  LAUNCH_TASK_IDS,
  type LaunchTaskId,
  type LaunchTimes,
} from '@core/schema/launch';

interface LaunchTask {
  /** What the launch window says while it runs. */
  readonly label: string;
  /** What it prepares, for a problem card. */
  readonly name: string;
  /** When it ends before any launch was measured, in ms. */
  readonly endsAt: number;
}

const TASKS: Readonly<Record<LaunchTaskId, LaunchTask>> = {
  files: {label: '곡과 예배 읽는 중', name: '곡과 예배', endsAt: 150},
  settings: {label: '설정 불러오는 중', name: '설정', endsAt: 250},
  window: {label: '창 만드는 중', name: '창', endsAt: 300},
  media: {label: '미디어 불러오는 중', name: '미디어', endsAt: 400},
  content: {label: '예배 여는 중', name: '예배', endsAt: 500},
  page: {label: '화면 불러오는 중', name: '화면', endsAt: 700},
  view: {label: '슬라이드 준비하는 중', name: '슬라이드', endsAt: 1100},
  outputs: {label: '출력 화면 준비하는 중', name: '출력 화면', endsAt: 1400},
  quiet: {label: '마무리하는 중', name: '마무리', endsAt: 2400},
};

const TASK_TIME_RANGE = {min: 20, max: 15_000};

export function launchTaskLabel(task: LaunchTaskId): string {
  return TASKS[task].label;
}

export function launchTaskName(task: LaunchTaskId): string {
  return TASKS[task].name;
}

/** When a task is expected to end, in ms after the launch began. */
export function expectedEnd(task: LaunchTaskId, times: LaunchTimes): number {
  return times[task] ?? TASKS[task].endsAt;
}

/** The tasks in the order they are expected to end. */
export function launchOrder(times: LaunchTimes): readonly LaunchTaskId[] {
  return LAUNCH_TASK_IDS.toSorted(
    (a, b) => expectedEnd(a, times) - expectedEnd(b, times),
  );
}

/** What is expected next time, halfway to what this launch took. */
export function learnedTimes(
  before: LaunchTimes,
  measured: LaunchTimes,
): LaunchTimes {
  const learned: Partial<Record<LaunchTaskId, number>> = {};
  for (const task of LAUNCH_TASK_IDS) {
    const took = measured[task];
    if (took === undefined) {
      const known = before[task];
      if (known !== undefined) learned[task] = known;
      continue;
    }
    const middle = Math.round((expectedEnd(task, before) + took) / 2);
    learned[task] = Math.min(
      TASK_TIME_RANGE.max,
      Math.max(TASK_TIME_RANGE.min, middle),
    );
  }
  return learned;
}

/** A task as the bar of the launch window sees it. */
export interface LaunchBarTask {
  /** When it is expected to end, in ms after the launch began. */
  readonly endsAt: number;
  /** How many of its parts are done, of `total`; 0 of 0 for no parts. */
  readonly done: number;
  readonly total: number;
  /** When it ended, or `null` while it runs. */
  readonly ended: number | null;
}

/**
 * How much of the bar is full, and the task that runs now, or -1. Every task
 * has the part of the bar up to the time it is expected to end. The bar moves
 * on through the part of the task that runs, as its parts are done or as its
 * time passes, and never leaves that part before the task has ended.
 *
 * The launch window runs this function in its own page, so it uses nothing
 * outside itself.
 *
 * @param tasks - In the order they are expected to end.
 */
export function launchFraction(
  tasks: readonly LaunchBarTask[],
  now: number,
): {readonly fraction: number; readonly current: number} {
  const last = tasks[tasks.length - 1];
  const current = tasks.findIndex(task => task.ended === null);
  const task = tasks[current];
  if (last === undefined || task === undefined) {
    return {fraction: 1, current: -1};
  }
  let from = 0;
  let since = 0;
  for (const before of tasks.slice(0, current)) {
    from = before.endsAt;
    since = Math.max(since, before.ended ?? 0);
  }
  const span = Math.max(1, task.endsAt - from);
  const passed = Math.max(0, now - since) / span;
  const timed = passed < 1 ? 0.95 * passed : 1 - 0.05 / passed;
  const counted =
    task.total > 0
      ? Math.max(
          task.done / task.total,
          Math.min(timed, (task.done + 0.95) / task.total),
        )
      : timed;
  return {
    fraction: (from + span * Math.min(counted, 1)) / Math.max(1, last.endsAt),
    current,
  };
}
