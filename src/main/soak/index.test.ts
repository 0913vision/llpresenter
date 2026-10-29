import {readFile} from 'node:fs/promises';
import {join} from 'node:path';
import {beforeEach, describe, expect, it, vi} from 'vitest';
import {parseSample} from '../../../scripts/soak/record.mts';
import {installFakeClock} from '../../../test/fake-clock';
import {makeTempDir} from '../../../test/temp-dir';
import type {Logger} from '../log';
import {prepareSoakGarbageCollection, registerSoakRecorder} from './index';
import {SAMPLE_INTERVAL_MS, type OutputFrameRate} from './recorder';

interface FakePage {
  readonly url: string;
  readonly destroyed?: boolean;
  readonly run?: (code: string) => Promise<unknown>;
}

const fakes = vi.hoisted(() => {
  const pages: FakePage[] = [];
  const scripts: string[] = [];
  return {
    pages,
    scripts,
    appendSwitch: vi.fn<(name: string, value?: string) => void>(),
  };
});

vi.mock('electron', () => ({
  app: {
    commandLine: {appendSwitch: fakes.appendSwitch},
    getAppMetrics: () => [
      {
        pid: 10,
        type: 'Browser',
        memory: {workingSetSize: 150_000, privateBytes: 120_000},
      },
    ],
    quit: () => undefined,
  },
  webContents: {
    getAllWebContents: () =>
      fakes.pages.map((page, index) => ({
        isDestroyed: () => page.destroyed ?? false,
        getURL: () => page.url,
        getOSProcessId: () => 20 + index,
        executeJavaScript: async (code: string) => {
          fakes.scripts.push(`${page.url} ${code}`);
          return page.run?.(code);
        },
      })),
  },
}));

beforeEach(() => {
  fakes.pages.length = 0;
  fakes.scripts.length = 0;
  fakes.appendSwitch.mockReset();
});

function fakeLog(): Logger {
  return {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    flush: async () => undefined,
  };
}

async function recordOneSample(
  frameRates?: () => readonly OutputFrameRate[],
  log: Logger = fakeLog(),
): Promise<unknown> {
  const recordPath = join(await makeTempDir(), 'soak.jsonl');
  const clock = installFakeClock();
  const env = {LLP_SOAK_RECORD: recordPath};
  const stop = registerSoakRecorder(
    log,
    frameRates === undefined ? {env} : {env, frameRates},
  );
  await clock.advance(SAMPLE_INTERVAL_MS);
  await stop();
  const [line] = (await readFile(recordPath, 'utf8')).trim().split('\n');
  return parseSample(JSON.parse(line ?? 'null'));
}

describe('registerSoakRecorder', () => {
  it('records the frame rates it is given', async () => {
    expect(
      await recordOneSample(() => [{screen: 'main', fps: 59.9}]),
    ).toMatchObject({
      ok: true,
      value: {
        processes: [
          {name: 'main', pid: 10, workingSetKb: 150_000, privateKb: 120_000},
        ],
        outputs: [{screen: 'main', fps: 59.9}],
      },
    });
  });

  it('records no outputs without a frame rate source', async () => {
    expect(await recordOneSample()).toMatchObject({
      ok: true,
      value: {outputs: []},
    });
  });
});

describe('soak garbage collection', () => {
  const control = 'file:///C:/data/out/renderer/index.html';
  const audio = 'file:///C:/data/out/renderer/output.html?audio=muted';

  it('exposes gc to every renderer in a soak run', () => {
    prepareSoakGarbageCollection({LLP_SOAK_RECORD: 'C:\\data\\soak.jsonl'});
    expect(fakes.appendSwitch).toHaveBeenCalledWith('js-flags', '--expose-gc');
  });

  it('changes nothing outside a soak run', () => {
    prepareSoakGarbageCollection({});
    expect(fakes.appendSwitch).not.toHaveBeenCalled();
  });

  it('collects garbage in the tracked pages before it samples', async () => {
    fakes.pages.push(
      {url: control},
      {url: audio},
      {url: 'file:///C:/data/out/renderer/analysis.html'},
      {url: audio, destroyed: true},
    );
    await recordOneSample();
    expect(fakes.scripts).toEqual([
      `${control} globalThis.gc?.()`,
      `${audio} globalThis.gc?.()`,
    ]);
  });

  it('logs the pages that could not collect and still records the sample', async () => {
    const log = fakeLog();
    const gone = async (): Promise<never> => {
      throw new Error('render process gone');
    };
    fakes.pages.push(
      {url: control},
      {url: audio, run: gone},
      {url: audio, run: gone},
    );
    expect(await recordOneSample(undefined, log)).toMatchObject({ok: true});
    expect(log.warn).toHaveBeenCalledWith(
      'soak garbage collection failed',
      expect.objectContaining({
        message: 'could not collect garbage in 2 of 3 pages',
      }),
    );
  });
});
