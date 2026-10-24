import {describe, expect, it} from 'vitest';
import {
  DEFAULT_JUDGE_OPTIONS,
  judgeOptionsFor,
  judgeRun,
  type JudgeOptions,
} from './judge.mts';
import type {SoakSample} from './record.mts';

const MINUTE_MS = 60_000;
const SAMPLE_EVERY_MS = 30_000;
const BASE_KB = 200_000;
const GC_SWING_KB = 8_000;

interface RunShape {
  readonly fromMinute?: number;
  readonly minutes?: number;
  readonly everyMs?: number;
  readonly pidAt?: (minute: number) => number;
  readonly fps?: number;
}

function sampleAt(elapsedMs: number, privateKb: number): SoakSample {
  return {
    elapsedMs,
    processes: [{name: 'main', pid: 100, workingSetKb: privateKb, privateKb}],
    outputs: [],
  };
}

const HIGH_KB = 50 * 1024;

function windowMinutes(index: number): readonly [number, number] {
  const {warmUpMs, requiredMs, windowCount} = DEFAULT_JUDGE_OPTIONS;
  const width = (requiredMs - warmUpMs) / windowCount;
  const start = warmUpMs + index * width;
  return [start / MINUTE_MS, (start + width) / MINUTE_MS];
}

function inWindow(minute: number, index: number): boolean {
  const [start, end] = windowMinutes(index);
  return minute >= start && minute < end;
}

function sawtooth(minute: number): number {
  return (minute % 3) * GC_SWING_KB;
}

function soakRun(
  privateKbAt: (minute: number) => number,
  shape: RunShape = {},
): SoakSample[] {
  const {
    fromMinute = 0,
    minutes = 60,
    everyMs = SAMPLE_EVERY_MS,
    pidAt = () => 100,
  } = shape;
  const samples: SoakSample[] = [];
  for (
    let elapsedMs = fromMinute * MINUTE_MS;
    elapsedMs <= minutes * MINUTE_MS;
    elapsedMs += everyMs
  ) {
    const minute = elapsedMs / MINUTE_MS;
    const privateKb = privateKbAt(minute);
    samples.push({
      elapsedMs,
      processes: [
        {name: 'main', pid: pidAt(minute), workingSetKb: privateKb, privateKb},
      ],
      outputs: [{screen: 'main', fps: shape.fps ?? 60}],
    });
  }
  return samples;
}

describe('judgeRun', () => {
  it('passes memory that rises and falls with garbage collection', () => {
    const verdict = judgeRun(soakRun(m => BASE_KB + sawtooth(m)));
    expect(verdict.passed).toBe(true);
    expect(verdict.memory).toEqual([
      expect.objectContaining({name: 'main', trend: 'flat'}),
    ]);
  });

  it('fails memory that keeps growing under the sawtooth', () => {
    const verdict = judgeRun(soakRun(m => BASE_KB + 1024 * m + sawtooth(m)));
    expect(verdict.passed).toBe(false);
    expect(verdict.memory[0]?.trend).toBe('growing');
    expect(verdict.memory[0]?.baselinesKb).toHaveLength(
      DEFAULT_JUDGE_OPTIONS.windowCount,
    );
  });

  it('passes growth that is too small to matter', () => {
    const verdict = judgeRun(soakRun(m => BASE_KB + 10 * m));
    expect(verdict.memory[0]?.trend).toBe('flat');
    expect(verdict.passed).toBe(true);
  });

  it('passes memory that grows during startup and then levels off', () => {
    const verdict = judgeRun(
      soakRun(m => BASE_KB + 2048 * Math.min(m, 20) + sawtooth(m)),
    );
    expect(verdict.memory[0]?.trend).toBe('flat');
  });

  it('fails a steady rise of 12 MB over the hour', () => {
    const startKb = 244.9 * 1024;
    const verdict = judgeRun(
      soakRun(m => startKb + (12 * 1024 * m) / 60 + sawtooth(m)),
    );
    expect(verdict.memory[0]?.trend).toBe('growing');
    expect(verdict.memory[0]?.growthKbPerHour).toBeCloseTo(12 * 1024, -2);
    expect(verdict.passed).toBe(false);
  });

  it('passes flat memory with noise on top of garbage collection', () => {
    const noise = (m: number): number => (((m * 7919) % 13) - 6) * 300;
    const verdict = judgeRun(soakRun(m => BASE_KB + sawtooth(m) + noise(m)));
    expect(verdict.memory[0]?.trend).toBe('flat');
    expect(
      Math.abs(verdict.memory[0]?.growthKbPerHour ?? Infinity),
    ).toBeLessThan(DEFAULT_JUDGE_OPTIONS.maxGrowthKbPerHour);
    expect(verdict.passed).toBe(true);
  });

  it('fails a leak of 12 MB per hour that starts halfway', () => {
    const verdict = judgeRun(
      soakRun(m => BASE_KB + (12 * 1024 * Math.max(0, m - 30)) / 60),
    );
    expect(verdict.memory[0]?.trend).toBe('growing');
  });

  it('passes flat memory with one low window minimum among six', () => {
    const minima: ReadonlyArray<readonly [number, number]> = [
      [14, 200],
      [23, 200],
      [32, 200],
      [33, 150],
      [50, 200],
      [60, 200],
    ];
    const samples = minima.flatMap(([minute, megabytes]) =>
      [minute - 0.5, minute - 0.2, minute].map(at => {
        const kb = (megabytes + (at === minute ? 0 : 1)) * 1024;
        return sampleAt(at * MINUTE_MS, kb);
      }),
    );
    const verdict = judgeRun(samples, {
      ...DEFAULT_JUDGE_OPTIONS,
      windowCount: 6,
    });
    expect(verdict.memory[0]?.trend).toBe('flat');
  });

  it('passes flat memory with one low dip', () => {
    const verdict = judgeRun(
      soakRun(m => (m === 33 ? BASE_KB - 50 * 1024 : BASE_KB)),
    );
    expect(verdict.memory[0]?.trend).toBe('flat');
  });

  it('passes flat memory with one high window', () => {
    const verdict = judgeRun(
      soakRun(m => BASE_KB + (inWindow(m, 7) ? HIGH_KB : 0)),
    );
    expect(verdict.memory[0]?.baselinesKb[7]).toBe(BASE_KB + HIGH_KB);
    expect(verdict.memory[0]?.trend).toBe('flat');
  });

  it('still fails a steady rise with one high window in it', () => {
    const rise = (m: number): number => (12 * 1024 * m) / 60;
    const verdict = judgeRun(
      soakRun(m => BASE_KB + rise(m) + (inWindow(m, 1) ? HIGH_KB : 0)),
    );
    const [start] = windowMinutes(1);
    expect(verdict.memory[0]?.baselinesKb[1]).toBeGreaterThanOrEqual(
      BASE_KB + HIGH_KB + rise(start),
    );
    expect(verdict.memory[0]?.trend).toBe('growing');
  });

  it.each([0, 1, 2])(
    'cannot judge memory with %i windows, even when it rises',
    windowCount => {
      const verdict = judgeRun(
        soakRun(m => BASE_KB + 1024 * m),
        {...DEFAULT_JUDGE_OPTIONS, windowCount},
      );
      expect(verdict.memory[0]?.trend).toBe('unjudged');
      expect(verdict.passed).toBe(false);
    },
  );

  it('fails a record that is shorter than required', () => {
    const verdict = judgeRun(soakRun(() => BASE_KB, {minutes: 30}));
    expect(verdict.longEnough).toBe(false);
    expect(verdict.memory[0]?.trend).toBe('unjudged');
    expect(verdict.passed).toBe(false);
  });

  it('fails a record whose samples all sit in the last minute', () => {
    const verdict = judgeRun(
      soakRun(() => BASE_KB, {fromMinute: 59, everyMs: 3_500}),
    );
    expect(verdict.longEnough).toBe(true);
    expect(verdict.memory[0]?.trend).toBe('unjudged');
    expect(verdict.passed).toBe(false);
  });

  it('does not fill an empty last window with samples after the required time', () => {
    const samples = [
      ...soakRun(() => BASE_KB, {minutes: 50}),
      ...soakRun(() => BASE_KB, {fromMinute: 61, minutes: 62}),
    ];
    const verdict = judgeRun(samples);
    expect(verdict.memory[0]?.trend).toBe('unjudged');
    expect(verdict.passed).toBe(false);
  });

  it('does not let a drop after the required time hide growth', () => {
    const samples = [
      ...soakRun(m => BASE_KB + 1024 * m),
      ...soakRun(() => BASE_KB, {fromMinute: 61, minutes: 62}),
    ];
    expect(judgeRun(samples).memory[0]?.trend).toBe('growing');
  });

  it('fails a process that disappears halfway through', () => {
    const samples = soakRun(() => BASE_KB).map(sample =>
      sample.elapsedMs < 30 * MINUTE_MS
        ? {
            ...sample,
            processes: [
              ...sample.processes,
              {
                name: 'output:main',
                pid: 7,
                workingSetKb: BASE_KB,
                privateKb: BASE_KB,
              },
            ],
          }
        : sample,
    );
    const verdict = judgeRun(samples);
    expect(verdict.memory.map(m => [m.name, m.trend])).toEqual([
      ['main', 'flat'],
      ['output:main', 'unjudged'],
    ]);
    expect(verdict.passed).toBe(false);
  });

  it('fails memory that has too few samples to judge', () => {
    const verdict = judgeRun(soakRun(() => BASE_KB, {everyMs: 5 * MINUTE_MS}));
    expect(verdict.memory[0]?.trend).toBe('unjudged');
    expect(verdict.passed).toBe(false);
  });

  it('fails a run in which a process relaunched', () => {
    const verdict = judgeRun(
      soakRun(() => BASE_KB, {pidAt: m => (m < 30 ? 100 : 200)}),
    );
    expect(verdict.relaunches).toEqual([{name: 'main', count: 1}]);
    expect(verdict.passed).toBe(false);
  });

  it('fails an empty record', () => {
    expect(judgeRun([]).passed).toBe(false);
  });

  it('judges samples in time order even when they arrive out of order', () => {
    const samples = soakRun(m => BASE_KB + 1024 * m).reverse();
    expect(judgeRun(samples).memory[0]?.trend).toBe('growing');
  });

  it('summarizes each output frame rate after warm-up', () => {
    const samples = soakRun(() => BASE_KB, {fps: 50});
    expect(judgeRun(samples).fps).toEqual([
      {screen: 'main', medianFps: 50, lowestFps: 50, belowTarget: true},
    ]);
  });
});

function windowWidthMs(options: JudgeOptions): number {
  return (options.requiredMs - options.warmUpMs) / options.windowCount;
}

describe('judgeOptionsFor', () => {
  it('keeps the defaults for a 60-minute run', () => {
    expect(judgeOptionsFor(60 * MINUTE_MS)).toEqual(DEFAULT_JUDGE_OPTIONS);
  });

  it('shortens the warm-up and the windows for a short trial run', () => {
    expect(judgeOptionsFor(6 * MINUTE_MS)).toEqual({
      ...DEFAULT_JUDGE_OPTIONS,
      requiredMs: 6 * MINUTE_MS,
      warmUpMs: 30_000,
      windowCount: 5,
    });
  });

  it('keeps windows of at least a minute while the run allows it', () => {
    const fiveWindows = judgeOptionsFor(327_273);
    expect(fiveWindows.windowCount).toBe(5);
    expect(windowWidthMs(fiveWindows)).toBeGreaterThanOrEqual(MINUTE_MS);
    expect(judgeOptionsFor(327_272).windowCount).toBe(4);
  });

  it('never goes below four windows, even when they get shorter than a minute', () => {
    const twoMinutes = judgeOptionsFor(2 * MINUTE_MS);
    expect(twoMinutes.windowCount).toBe(4);
    expect(windowWidthMs(twoMinutes)).toBe(27_500);
  });

  it('judges a short flat trial run', () => {
    const samples = soakRun(() => BASE_KB, {minutes: 5, everyMs: 10_000});
    expect(judgeRun(samples, judgeOptionsFor(5 * MINUTE_MS)).passed).toBe(true);
  });
});
