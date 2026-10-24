import {readdir, readFile, writeFile} from 'node:fs/promises';
import {join} from 'node:path';
import {describe, expect, it, vi} from 'vitest';
import {makeTempDir} from '../../../test/temp-dir';
import {FileWriter} from './fileWriter';
import {RecoveryCopies} from './recoveryCopies';
import {Saver} from './saver';

describe('Saver', () => {
  it('keeps a copy of the previous version, then writes the new text', async () => {
    const folder = await makeTempDir();
    const file = join(folder, 'song.llsong');
    await writeFile(file, 'version 1');
    const recovery = join(folder, '.복구 사본');
    const saver = new Saver(
      new FileWriter(),
      new RecoveryCopies({folder: recovery, keep: () => 10}),
      vi.fn(),
    );

    const result = await saver.save({
      target: {file, kind: 'song', id: 'song-1'},
      text: 'version 2',
    });

    expect(result.ok).toBe(true);
    expect(await readFile(file, 'utf8')).toBe('version 2');
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
    const report = vi.fn();
    const saver = new Saver(
      new FileWriter(),
      new RecoveryCopies({folder: blocker, keep: () => 10}),
      report,
    );

    const result = await saver.save({
      target: {file, kind: 'song', id: 'song-1'},
      text: 'version 2',
    });

    expect(result.ok).toBe(true);
    expect(await readFile(file, 'utf8')).toBe('version 2');
    expect(report).toHaveBeenCalledWith(expect.objectContaining({file}));
  });
});
