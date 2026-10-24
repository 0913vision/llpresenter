import {describe, expect, it} from 'vitest';
import {DEFAULT_JUDGE_OPTIONS, judgeOptionsFor, judgeRun} from './judge.mts';
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

describe('judgeOptionsFor', () => {
  it('keeps the defaults for a 60-minute run', () => {
    expect(judgeOptionsFor(60 * MINUTE_MS)).toEqual(DEFAULT_JUDGE_OPTIONS);
  });

  it('shortens the warm-up for a short trial run', () => {
    expect(judgeOptionsFor(6 * MINUTE_MS)).toEqual({
      ...DEFAULT_JUDGE_OPTIONS,
      requiredMs: 6 * MINUTE_MS,
      warmUpMs: 30_000,
    });
  });

  it('judges a short flat trial run', () => {
    const samples = soakRun(() => BASE_KB, {minutes: 5, everyMs: 10_000});
    expect(judgeRun(samples, judgeOptionsFor(5 * MINUTE_MS)).passed).toBe(true);
  });
});
