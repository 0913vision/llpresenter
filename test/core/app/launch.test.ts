import {describe, expect, it} from 'vitest';
import {
  expectedEnd,
  launchFraction,
  launchOrder,
  learnedTimes,
  type LaunchBarTask,
} from '@core/app';
import {LAUNCH_TASK_IDS} from '@core/schema/app/launch';

function task(
  endsAt: number,
  {
    done = 0,
    total = 0,
    ended = null,
  }: Partial<Omit<LaunchBarTask, 'endsAt'>> = {},
): LaunchBarTask {
  return {endsAt, done, total, ended};
}

describe('the bar of the launch', () => {
  it('fills the part of the task that runs as its time passes', () => {
    const tasks = [task(400), task(1000)];
    expect(launchFraction(tasks, 0).fraction).toBe(0);
    expect(launchFraction(tasks, 200).fraction).toBeCloseTo(0.19);
    expect(launchFraction(tasks, 400).fraction).toBeCloseTo(0.38);
    expect(launchFraction(tasks, 400_000).fraction).toBeLessThan(0.4);
  });

  it('is at least as far as the parts that are done', () => {
    const at = (done: number, now: number) =>
      launchFraction([task(1000, {done, total: 4})], now).fraction;
    expect(at(0, 1)).toBeLessThan(0.01);
    expect(at(2, 1)).toBe(0.5);
    expect(at(2, 800)).toBeCloseTo(0.76);
    expect(at(0, 10_000)).toBeLessThan(1);
  });

  it('goes to the next task that runs, from when the ones before it ended', () => {
    const tasks = [task(400, {ended: 100}), task(1000)];
    expect(launchFraction(tasks, 100)).toEqual({fraction: 0.4, current: 1});
    expect(launchFraction(tasks, 400).fraction).toBeCloseTo(0.685);
  });

  it('is full once every task ended', () => {
    expect(launchFraction([task(400, {ended: 90})], 100)).toEqual({
      fraction: 1,
      current: -1,
    });
    expect(launchFraction([], 0).fraction).toBe(1);
  });
});

describe('what a launch is expected to take', () => {
  it('moves halfway to what the launch before took', () => {
    const learned = learnedTimes({files: 100, media: 300}, {files: 200});
    expect(learned).toEqual({files: 150, media: 300});
    expect(learnedTimes({}, {files: 450}).files).toBe(
      Math.round((expectedEnd('files', {}) + 450) / 2),
    );
  });

  it('keeps a time that one odd launch gives within bounds', () => {
    expect(learnedTimes({drawing: 2000}, {drawing: 900_000}).drawing).toBe(
      15_000,
    );
    expect(learnedTimes({files: 20}, {files: 1}).files).toBe(20);
  });

  it('orders the tasks by when they are expected to end', () => {
    expect(launchOrder({})).toEqual(LAUNCH_TASK_IDS);
    expect(launchOrder({files: 5000}).at(-1)).toBe('files');
  });
});
