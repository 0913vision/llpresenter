import {readdir, readFile, writeFile} from 'node:fs/promises';
import {join} from 'node:path';
import {describe, expect, it, vi} from 'vitest';
import {makeTempDir} from '../../../test/temp-dir';
import type {WriteProblem} from './atomicWrite';
import {RecoveryCopies, type RecoveryTarget} from './recoveryCopies';
import {Saver, type SaverOptions} from './saver';

type CopyResult = Awaited<ReturnType<SaverOptions['copies']['keepPrevious']>>;

const COPIED: CopyResult = {ok: true, value: undefined};

function songTarget(file: string): RecoveryTarget {
  return {file, kind: 'song', id: 'song-1'};
}

async function settle(): Promise<void> {
  await new Promise(resolve => setTimeout(resolve, 0));
}

describe('Saver', () => {
  it('keeps a copy of the previous version, then writes the new text', async () => {
    const folder = await makeTempDir();
    const file = join(folder, 'song.llsong');
    await writeFile(file, 'version 1');
    const recovery = join(folder, '.복구 사본');
    const saver = new Saver({
      copies: new RecoveryCopies({folder: recovery, keep: () => 10}),
      reportCopyProblem: vi.fn(),
    });

    const result = await saver.save({target: songTarget(file), text: 'v2'});

    expect(result.ok).toBe(true);
    expect(await readFile(file, 'utf8')).toBe('v2');
    const copies = await readdir(join(recovery, 'song', 'song-1'));
    expect(copies).toHaveLength(1);
    expect(
      await readFile(join(recovery, 'song', 'song-1', copies[0] ?? ''), 'utf8'),
    ).toBe('version 1');
  });

  it('reports a recovery copy it cannot make and still saves', async () => {
    const folder = await makeTempDir();
    const file = join(folder, 'song.llsong');
    await writeFile(file, 'version 1');
    const blocker = join(folder, 'blocker');
    await writeFile(blocker, 'a file where the recovery folder should be');
    const report = vi.fn<(problem: WriteProblem) => void>();
    const saver = new Saver({
      copies: new RecoveryCopies({folder: blocker, keep: () => 10}),
      reportCopyProblem: report,
    });

    const result = await saver.save({target: songTarget(file), text: 'v2'});

    expect(result.ok).toBe(true);
    expect(await readFile(file, 'utf8')).toBe('v2');
    expect(report).toHaveBeenCalledWith(expect.objectContaining({file}));
  });

  it('writes overlapping saves in order when the first copy is slow', async () => {
    let finishFirstCopy = (): void => undefined;
    const keepPrevious = vi
      .fn<SaverOptions['copies']['keepPrevious']>()
      .mockImplementationOnce(
        () =>
          new Promise(resolve => {
            finishFirstCopy = () => resolve(COPIED);
          }),
      )
      .mockResolvedValue(COPIED);
    const written: string[] = [];
    const saver = new Saver({
      copies: {keepPrevious},
      reportCopyProblem: vi.fn(),
      writeText: (_file, text) => {
        written.push(text);
        return Promise.resolve({ok: true, value: undefined});
      },
    });

    const older = saver.save({target: songTarget('a.llsong'), text: 'older'});
    const newer = saver.save({target: songTarget('a.llsong'), text: 'newer'});
    await settle();
    expect(keepPrevious).toHaveBeenCalledTimes(1);
    finishFirstCopy();
    await Promise.all([older, newer]);

    expect(written).toEqual(['older', 'newer']);
    expect(keepPrevious).toHaveBeenCalledTimes(2);
  });

  it('becomes idle once every save has finished', async () => {
    const written: string[] = [];
    const saver = new Saver({
      copies: {keepPrevious: () => Promise.resolve(COPIED)},
      reportCopyProblem: vi.fn(),
      writeText: async (_file, text) => {
        await settle();
        written.push(text);
        return {ok: true, value: undefined};
      },
    });

    const saves = [
      saver.save({target: songTarget('a.llsong'), text: 'a'}),
      saver.save({target: songTarget('b.llsong'), text: 'b'}),
    ];
    await saver.idle();

    expect(written.sort()).toEqual(['a', 'b']);
    await Promise.all(saves);
  });
});
