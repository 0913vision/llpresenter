import {join} from 'node:path';
import {describe, expect, it, vi} from 'vitest';
import {removeStaleTempFiles} from './staleTempFiles';

const UUID = '3b9d0c52-7e1f-4a2b-8c3d-4e5f60718293';
const TEMP = `.a.llsong.${UUID}.tmp`;
const NOW = 1_000_000;

const mocks = vi.hoisted(() => ({
  readdir: vi.fn<() => Promise<Array<{name: string; isFile: () => boolean}>>>(),
  lstat: vi.fn<() => Promise<{mtimeMs: number}>>(),
  rm: vi.fn<() => Promise<void>>(),
}));

vi.mock('node:fs/promises', () => mocks);

function missing(): Error {
  return Object.assign(new Error('gone'), {code: 'ENOENT'});
}

function oneTempFile(): void {
  mocks.readdir.mockResolvedValue([{name: TEMP, isFile: () => true}]);
  mocks.lstat.mockResolvedValue({mtimeMs: NOW - 120_000});
}

describe('removeStaleTempFiles failures', () => {
  it('reports a stale file that cannot be removed, by the Error message', async () => {
    oneTempFile();
    mocks.rm.mockRejectedValue(new Error('File is busy'));
    expect(await removeStaleTempFiles('C:/data', NOW)).toEqual([
      {file: join('C:/data', TEMP), message: 'File is busy'},
    ]);
  });

  it('reports a failure that is not an Error by its text', async () => {
    oneTempFile();
    mocks.rm.mockRejectedValue('invented failure');
    expect(await removeStaleTempFiles('C:/data', NOW)).toEqual([
      {file: join('C:/data', TEMP), message: 'invented failure'},
    ]);
  });

  it('ignores a file that another process removed first', async () => {
    oneTempFile();
    mocks.rm.mockRejectedValue(missing());
    expect(await removeStaleTempFiles('C:/data', NOW)).toEqual([]);
  });

  it('reports a folder whose listing fails with a value that is not an Error', async () => {
    mocks.readdir.mockRejectedValue('invented listing failure');
    expect(await removeStaleTempFiles('C:/data', NOW)).toEqual([
      {file: 'C:/data', message: 'invented listing failure'},
    ]);
  });
});
