import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
import {expect, it} from 'vitest';

interface TransitionClock {
  presented(now: number): void;
  pause(): void;
  start(seconds: number): void;
  stop(): void;
  progress(now: number): number;
  finish(): {
    readonly set: number;
    readonly taken: number;
    readonly frames: number;
    readonly late: number;
  } | null;
}

const loaded: {
  module: {exports: {createTransitionClock?: (hz: number) => TransitionClock}};
} = {module: {exports: {}}};
runInNewContext(
  readFileSync(
    new URL('../../../src/main/presenter/transitionClock.cjs', import.meta.url),
    'utf8',
  ),
  loaded,
);

function createTransitionClock(hz: number): TransitionClock {
  const create = loaded.module.exports.createTransitionClock;
  if (create === undefined) throw new Error('Missing transition clock');
  return create(hz);
}

const FRAME = 1000 / 60;

/** A clock of a monitor that has shown frames for a while. */
function measured(reportedHz: number) {
  const clock = createTransitionClock(reportedHz);
  let now = 1000;
  for (let index = 0; index < 60; index += 1) {
    clock.presented(now);
    now += FRAME;
  }
  return {clock, now};
}

function frames(from: number): readonly number[] {
  return Array.from({length: 600}, (_, index) => from + index * FRAME);
}

/** Every step of a transition, shown at the times a monitor takes frames. */
function play(
  clock: TransitionClock,
  seconds: number,
  times: readonly number[],
): readonly number[] {
  clock.start(seconds);
  const steps: number[] = [];
  for (const time of times) {
    const step = clock.progress(time);
    steps.push(step);
    clock.presented(time);
    if (step === 1) break;
  }
  return steps;
}

it('lasts its time on a monitor that shows half the frames it reports', () => {
  const {clock, now} = measured(120);
  expect(play(clock, 4, frames(now))).toHaveLength(240);
  expect(clock.finish()?.set).toBe(4000);
});

it('moves the same amount in every frame although frames are timed unevenly', () => {
  const {clock, now} = measured(60);
  const jitter = [0, 2, -3, 1, 4, -4];
  const times = frames(now).map(
    (time, index) => time + (jitter[index % jitter.length] ?? 0),
  );
  const steps = play(clock, 1, times);
  const sizes = steps.slice(1).map((step, index) => step - (steps[index] ?? 0));
  expect(Math.max(...sizes) - Math.min(...sizes)).toBeLessThan(0.001);
});

it('keeps its time when frames are late, and says so', () => {
  const {clock, now} = measured(60);
  const times = frames(now).filter((_, index) => index % 10 !== 5);
  const steps = play(clock, 1, times);
  expect(steps.at(-1)).toBe(1);
  expect(steps.length).toBeLessThan(60);
  const report = clock.finish();
  expect(report?.late).toBeGreaterThan(3);
  expect(report?.taken).toBeGreaterThan(900);
  expect(report?.taken).toBeLessThan(1050);
});

it('trusts the reported rate only until frames were measured', () => {
  const clock = createTransitionClock(60);
  expect(play(clock, 1, frames(0))).toHaveLength(60);
});

it('does not measure a pause as a frame', () => {
  const {clock, now} = measured(60);
  clock.pause();
  clock.presented(now + 5000);
  expect(play(clock, 1, frames(now + 5000 + FRAME))).toHaveLength(60);
});

it('is over when it is stopped', () => {
  const {clock, now} = measured(60);
  clock.start(1);
  expect(clock.progress(now)).toBeLessThan(1);
  clock.stop();
  expect(clock.progress(now)).toBe(1);
  expect(clock.finish()).toBeNull();
});
