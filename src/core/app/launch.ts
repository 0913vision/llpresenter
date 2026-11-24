import {
  LAUNCH_TASK_IDS,
  type LaunchTaskId,
  type LaunchTimes,
} from '@core/schema/app/launch';

interface LaunchTask {
  /** What the launch window says while it runs. */
  readonly label: string;
  /** What it prepares, for a problem card. */
  readonly name: string;
  /** When it ends before any launch was measured, in ms. */
  readonly endsAt: number;
  /** Its parts are things that can be counted, such as files. */
  readonly counted?: true;
}

const TASKS: Readonly<Record<LaunchTaskId, LaunchTask>> = {
  files: {
    label: '곡과 예배 파일 읽는 중',
    name: '곡과 예배 파일',
    endsAt: 100,
    counted: true,
  },
  settings: {
    label: '설정 파일 읽는 중',
    name: '설정 파일',
    endsAt: 150,
    counted: true,
  },
  window: {label: '프로그램 창 만드는 중', name: '프로그램 창', endsAt: 200},
  media: {label: '미디어 목록 읽는 중', name: '미디어 목록', endsAt: 350},
  content: {label: '지난 예배 여는 중', name: '지난 예배', endsAt: 420},
  page: {
    label: '프로그램 화면 불러오는 중',
    name: '프로그램 화면',
    endsAt: 650,
  },
  data: {
    label: '예배 순서, 설정, 미디어 목록 받는 중',
    name: '예배 순서, 설정, 미디어 목록',
    endsAt: 800,
    counted: true,
  },
  pictures: {
    label: '슬라이드 배경 그림 불러오는 중',
    name: '슬라이드 배경 그림',
    endsAt: 1100,
    counted: true,
  },
  fonts: {label: '글꼴 불러오는 중', name: '글꼴', endsAt: 1120},
  outputs: {
    label: '출력 화면 그리는 중',
    name: '출력 화면',
    endsAt: 1150,
    counted: true,
  },
  drawing: {
    label: '프로그램 첫 화면 그리는 중',
    name: '프로그램 첫 화면',
    endsAt: 1300,
  },
};

const TASK_TIME_RANGE = {min: 20, max: 15_000};

/** What the launch window says while the task runs. */
export function launchTaskLabel(task: LaunchTaskId): string {
  return TASKS[task].label;
}

/** What the task prepares, as a problem card names it. */
export function launchTaskName(task: LaunchTaskId): string {
  return TASKS[task].name;
}

/** Whether the launch window shows how many parts of a task are done. */
export function isLaunchTaskCounted(task: LaunchTaskId): boolean {
  return TASKS[task].counted === true;
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
 * on through the part of the task that runs as its time passes, and faster
 * when more of its parts are done, and never leaves that part before the task
 * has ended.
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
  const counted = task.total > 0 ? task.done / task.total : 0;
  return {
    fraction:
      (from + span * Math.max(timed, counted)) / Math.max(1, last.endsAt),
    current,
  };
}
