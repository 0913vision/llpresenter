import {readFile} from 'node:fs/promises';
import {join} from 'node:path';
import {describe, expect, it, vi} from 'vitest';
import {parseSample} from '../../../scripts/soak/record.mts';
import {installFakeClock} from '../../../test/fake-clock';
import {makeTempDir} from '../../../test/temp-dir';
import type {Logger} from '../log';
import {registerSoakRecorder} from './index';
import {SAMPLE_INTERVAL_MS, type OutputFrameRate} from './recorder';

vi.mock('electron', () => ({
  app: {
    getAppMetrics: () => [
      {
        pid: 10,
        type: 'Browser',
        memory: {workingSetSize: 150_000, privateBytes: 120_000},
      },
    ],
    quit: () => undefined,
  },
  webContents: {getAllWebContents: () => []},
}));

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
): Promise<unknown> {
  const recordPath = join(await makeTempDir(), 'soak.jsonl');
  const clock = installFakeClock();
  const env = {LLP_SOAK_RECORD: recordPath};
  const stop = registerSoakRecorder(
    fakeLog(),
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
