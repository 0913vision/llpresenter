import {mkdir, readFile, readdir, writeFile} from 'node:fs/promises';
import {join} from 'node:path';
import {describe, expect, it, vi} from 'vitest';
import {makeTempDir} from '../../../test/temp-dir';
import type {Logger} from '../log';
import {documentFiles} from './documentFiles';
import {RecoveryCopies} from './recoveryCopies';
import {Saver} from './saver';

function fakeLog(): Logger {
  return {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    flush: () => Promise.resolve(),
  };
}

describe('documentFiles', () => {
  it('keeps the final content before deleting a file that was just autosaved', async () => {
    const folder = await makeTempDir();
    const target = {
      file: join(folder, 'song.llsong'),
      kind: 'song',
      id: 'song-1',
    };
    const recovery = join(folder, 'recovery');
    const copies = new RecoveryCopies({
      folder: recovery,
      keep: () => 10,
      now: () => 0,
    });
    const saver = new Saver({copies, reportCopyProblem: vi.fn()});
    const files = documentFiles({saver, copies, log: fakeLog()});
    await writeFile(target.file, 'first content');
    await files.write({target, text: 'last content'});

    expect(await files.remove(target)).toEqual({ok: true, value: undefined});

    await expect(readFile(target.file)).rejects.toMatchObject({code: 'ENOENT'});
    const names = await readdir(join(recovery, target.kind, target.id));
    expect(
      await Promise.all(
        names
          .sort()
          .map(name =>
            readFile(join(recovery, target.kind, target.id, name), 'utf8'),
          ),
      ),
    ).toEqual(['first content', 'last content']);
  });

  it('waits for an in-flight save before copying and deleting', async () => {
    const folder = await makeTempDir();
    const target = {
      file: join(folder, 'song.llsong'),
      kind: 'song',
      id: 'song-1',
    };
    let release = (): void => undefined;
    const gate = new Promise<void>(resolve => {
      release = resolve;
    });
    const copies = new RecoveryCopies({
      folder: join(folder, 'recovery'),
      keep: () => 10,
    });
    const saver = new Saver({
      copies,
      reportCopyProblem: vi.fn(),
      writeText: async (file, text) => {
        await gate;
        await writeFile(file, text);
        return {ok: true, value: undefined};
      },
    });
    const files = documentFiles({saver, copies, log: fakeLog()});
    const saving = files.write({target, text: 'last content'});
    const deleting = files.remove(target);
    release();

    await Promise.all([saving, deleting]);

    await expect(readFile(target.file)).rejects.toMatchObject({code: 'ENOENT'});
    const recovery = join(folder, 'recovery', target.kind, target.id);
    const [name = ''] = await readdir(recovery);
    expect(await readFile(join(recovery, name), 'utf8')).toBe('last content');
  });

  it('reports a recovery failure and returns a deletion failure without throwing', async () => {
    const folder = await makeTempDir();
    const file = join(folder, 'a-directory');
    await mkdir(file);
    const log = fakeLog();
    const copies = {
      keepBeforeDelete: vi
        .fn<RecoveryCopies['keepBeforeDelete']>()
        .mockResolvedValue({ok: false, error: {file, message: 'copy failed'}}),
    };
    const saver = new Saver({
      copies: {keepPrevious: vi.fn()},
      reportCopyProblem: vi.fn(),
    });
    const files = documentFiles({saver, copies, log});

    expect(
      await files.remove({file, kind: 'song', id: 'song-1'}),
    ).toMatchObject({ok: false, error: {file}});
    expect(log.warn).toHaveBeenCalledWith('could not keep a recovery copy', {
      file,
      message: 'copy failed',
    });
  });
});
