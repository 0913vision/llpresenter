import {describe, expect, it, vi} from 'vitest';
import {parseSample} from '../../../scripts/soak/record.mts';
import {installFakeClock} from '../../../test/fake-clock';
import type {Logger} from '../log';
import {
  pageProcessName,
  processSamples,
  SAMPLE_INTERVAL_MS,
  sampleLine,
  soakSettings,
  startSoakRecording,
  type ProcessMetricLike,
  type SoakSettings,
} from './recorder';

function metric(
  type: string,
  pid: number,
  extra: Partial<ProcessMetricLike> = {},
): ProcessMetricLike {
  return {
    type,
    pid,
    memory: {workingSetSize: 150_000, privateBytes: 120_000},
    ...extra,
  };
}

function fakeLog(): Logger {
  return {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    flush: async () => undefined,
  };
}

describe('soakSettings', () => {
  it('records nothing without LLP_SOAK_RECORD', () => {
    expect(soakSettings({})).toBeNull();
    expect(soakSettings({LLP_SOAK_RECORD: ''})).toBeNull();
  });

  it('reads the record path and the exit time', () => {
    expect(
      soakSettings({
        LLP_SOAK_RECORD: 'D:\\soak.jsonl',
        LLP_SOAK_EXIT_MS: '60000',
      }),
    ).toEqual({recordPath: 'D:\\soak.jsonl', exitAfterMs: 60_000});
  });

  it.each(['', '0', '-5', 'soon'])('keeps running for exit time %j', exit => {
    expect(
      soakSettings({LLP_SOAK_RECORD: 'soak.jsonl', LLP_SOAK_EXIT_MS: exit})
        ?.exitAfterMs,
    ).toBeNull();
  });
});

describe('pageProcessName', () => {
  it.each([
    ['http://localhost:5185/index.html', 'control'],
    ['file:///D:/llp/out/renderer/index.html', 'control'],
    ['http://localhost:5185/output.html?screen=main', 'output:main'],
    ['file:///D:/llp/out/renderer/output.html?screen=stage', 'output:stage'],
  ])('names %s as %s', (url, name) => {
    expect(pageProcessName(url)).toBe(name);
  });

  it.each([
    'http://localhost:5185/output.html',
    'http://localhost:5185/gallery.html',
    'devtools://devtools/bundled/inspector.html',
    'not a url',
  ])('does not track %s', url => {
    expect(pageProcessName(url)).toBeNull();
  });
});

describe('processSamples', () => {
  const rendererName = (pid: number): string | null =>
    pid === 30 ? 'control' : null;

  it('names the main, GPU, utility, and known renderer processes', () => {
    const samples = processSamples(
      [
        metric('Browser', 10),
        metric('GPU', 20),
        metric('Tab', 30),
        metric('Utility', 40, {serviceName: 'network.mojom.NetworkService'}),
      ],
      rendererName,
    );
    expect(samples.map(s => s.name)).toEqual([
      'main',
      'gpu',
      'control',
      'utility:network.mojom.NetworkService',
    ]);
    expect(samples[0]).toEqual({
      name: 'main',
      pid: 10,
      workingSetKb: 150_000,
      privateKb: 120_000,
    });
  });

  it('leaves out unknown renderers and other process types', () => {
    expect(
      processSamples([metric('Tab', 99), metric('Zygote', 98)], rendererName),
    ).toEqual([]);
  });

  it('uses the working set where private memory is unknown', () => {
    const [sample] = processSamples(
      [metric('Browser', 10, {memory: {workingSetSize: 90_000}})],
      rendererName,
    );
    expect(sample?.privateKb).toBe(90_000);
  });
});

describe('sampleLine', () => {
  it('writes a line that the soak runner reads back unchanged', () => {
    const processes = processSamples([metric('Browser', 10)], () => null);
    const line = sampleLine(10_000.4, processes);
    expect(parseSample(JSON.parse(line))).toEqual({
      ok: true,
      value: {elapsedMs: 10_000, processes, outputs: []},
    });
  });
});

describe('startSoakRecording', () => {
  const settings: SoakSettings = {
    recordPath: 'soak.jsonl',
    exitAfterMs: 35_000,
  };

  function record(append: (line: string) => Promise<void>) {
    const log = fakeLog();
    const quit = vi.fn();
    const stop = startSoakRecording({
      settings,
      sample: elapsedMs => `{"elapsedMs":${elapsedMs}}`,
      append,
      quit,
      now: () => Date.now(),
      log,
    });
    return {log, quit, stop};
  }

  it('appends a line per interval, in order', async () => {
    const clock = installFakeClock();
    const lines: string[] = [];
    const {stop} = record(async line => {
      lines.push(line);
    });
    await clock.advance(3 * SAMPLE_INTERVAL_MS);
    stop();
    expect(lines).toEqual([
      '{"elapsedMs":10000}\n',
      '{"elapsedMs":20000}\n',
      '{"elapsedMs":30000}\n',
    ]);
  });

  it('quits after the exit time', async () => {
    const clock = installFakeClock();
    const {quit, stop} = record(async () => undefined);
    await clock.advance(34_000);
    expect(quit).not.toHaveBeenCalled();
    await clock.advance(1_000);
    expect(quit).toHaveBeenCalledOnce();
    stop();
  });

  it('logs a failed write and keeps recording', async () => {
    const clock = installFakeClock();
    const lines: string[] = [];
    let calls = 0;
    const {log, stop} = record(async line => {
      calls += 1;
      if (calls === 1) throw new Error('disk full');
      lines.push(line);
    });
    await clock.advance(2 * SAMPLE_INTERVAL_MS);
    stop();
    expect(log.error).toHaveBeenCalledWith(
      'soak record write failed',
      expect.any(Error),
    );
    expect(lines).toEqual(['{"elapsedMs":20000}\n']);
  });

  it('stops sampling and the quit timer when stopped', async () => {
    const clock = installFakeClock();
    const lines: string[] = [];
    const {quit, stop} = record(async line => {
      lines.push(line);
    });
    stop();
    await clock.runAll();
    expect(lines).toEqual([]);
    expect(quit).not.toHaveBeenCalled();
  });
});
