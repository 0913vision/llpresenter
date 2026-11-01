import {beforeEach, describe, expect, it, vi} from 'vitest';
import type {Logger} from '@main/log';
import {
  prepareSoakGarbageCollection,
  registerSoakRecorder,
} from '@main/soak/index';
import {
  sampleLine,
  startSoakRecording,
  type OutputFrameRate,
} from '@main/soak/recorder';

vi.mock('@main/soak/recorder', async importOriginal => ({
  ...(await importOriginal<typeof import('@main/soak/recorder')>()),
  startSoakRecording: vi.fn(() => () => Promise.resolve()),
  sampleLine: vi.fn(() => 'line'),
}));

interface MockPage {
  readonly url: string;
  readonly destroyed?: boolean;
  readonly run?: (code: string) => Promise<unknown>;
}

const mocks = vi.hoisted(() => {
  const pages: MockPage[] = [];
  const scripts: string[] = [];
  return {
    pages,
    scripts,
    appendSwitch: vi.fn<(name: string, value?: string) => void>(),
  };
});

vi.mock('electron', () => ({
  app: {
    commandLine: {appendSwitch: mocks.appendSwitch},
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
      mocks.pages.map((page, index) => ({
        isDestroyed: () => page.destroyed ?? false,
        getURL: () => page.url,
        getOSProcessId: () => 20 + index,
        executeJavaScript: async (code: string) => {
          mocks.scripts.push(`${page.url} ${code}`);
          return page.run?.(code);
        },
      })),
  },
}));

beforeEach(() => {
  mocks.pages.length = 0;
  mocks.scripts.length = 0;
  mocks.appendSwitch.mockReset();
  vi.mocked(startSoakRecording).mockClear();
  vi.mocked(sampleLine).mockClear();
});

function mockLog(): Logger {
  return {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    flush: async () => undefined,
  };
}

/** Starts a soak run and returns what it gave the recorder. */
function startRun(frameRates?: () => readonly OutputFrameRate[]) {
  const env = {LLP_SOAK_RECORD: 'C:\\data\\soak.jsonl'};
  registerSoakRecorder(
    mockLog(),
    frameRates === undefined ? {env} : {env, frameRates},
  );
  const options = vi.mocked(startSoakRecording).mock.calls[0]?.[0];
  if (options === undefined) throw new Error('Recording did not start');
  return options;
}

describe('registerSoakRecorder', () => {
  it('samples the app processes with the frame rates it is given', () => {
    const options = startRun(() => [{screen: 'main', fps: 59.9}]);

    expect(options.sample(1000)).toBe('line');
    expect(sampleLine).toHaveBeenCalledExactlyOnceWith(
      1000,
      [expect.objectContaining({name: 'main', pid: 10})],
      [{screen: 'main', fps: 59.9}],
    );
  });

  it('samples no outputs without a frame rate source', () => {
    const options = startRun();

    options.sample(1000);
    expect(sampleLine).toHaveBeenCalledWith(1000, expect.any(Array), []);
  });

  it('starts nothing outside a soak run', () => {
    registerSoakRecorder(mockLog(), {env: {}});
    expect(startSoakRecording).not.toHaveBeenCalled();
  });
});

describe('soak garbage collection', () => {
  const control = 'file:///C:/data/out/renderer/index.html';
  const audio = 'file:///C:/data/out/renderer/output.html?audio=muted';

  it('exposes gc to every renderer in a soak run', () => {
    prepareSoakGarbageCollection({LLP_SOAK_RECORD: 'C:\\data\\soak.jsonl'});
    expect(mocks.appendSwitch).toHaveBeenCalledWith('js-flags', '--expose-gc');
  });

  it('changes nothing outside a soak run', () => {
    prepareSoakGarbageCollection({});
    expect(mocks.appendSwitch).not.toHaveBeenCalled();
  });

  it('collects garbage in the tracked pages before it samples', async () => {
    mocks.pages.push(
      {url: control},
      {url: audio},
      {url: 'file:///C:/data/out/renderer/analysis.html'},
      {url: audio, destroyed: true},
    );
    await startRun().collectGarbage();
    expect(mocks.scripts).toEqual([
      `${control} globalThis.gc?.()`,
      `${audio} globalThis.gc?.()`,
    ]);
  });

  it('fails naming how many pages could not collect', async () => {
    const gone = async (): Promise<never> => {
      throw new Error('render process gone');
    };
    mocks.pages.push(
      {url: control},
      {url: audio, run: gone},
      {url: audio, run: gone},
    );
    await expect(startRun().collectGarbage()).rejects.toThrow(
      'could not collect garbage in 2 of 3 pages',
    );
  });
});
