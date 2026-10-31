import {
  askForService,
  developmentContext,
  mockLog,
  register,
} from './testing/registerFixtures';
import {readdir, utimes} from 'node:fs/promises';
import {join} from 'node:path';
import {describe, expect, it} from 'vitest';
import {DATA_FOLDER_NAME} from './locations';
import {writeJson} from './testFiles';

describe('startup upkeep through registerStore', () => {
  it('logs at most 50 problems and counts the rest', async () => {
    const context = await developmentContext();
    const songs = join(context.appDataFolder, DATA_FOLDER_NAME, 'Songs');
    await Promise.all(
      Array.from({length: 52}, (_value, index) =>
        writeJson(join(songs, `${index}.llsong`), '{"format": '),
      ),
    );
    const log = mockLog();
    await register(log, context);

    await askForService();

    expect(log.warn).toHaveBeenCalledTimes(51);
    expect(log.warn).toHaveBeenLastCalledWith(
      'skipped 2 more data files or parts of them',
    );
  });

  it('removes temporary files that a cut-off write left, before the backup', async () => {
    const context = await developmentContext();
    const songs = join(context.appDataFolder, DATA_FOLDER_NAME, 'Songs');
    const leftover = join(
      songs,
      '.a.llsong.3b9d0c52-7e1f-4a2b-8c3d-4e5f60718293.tmp',
    );
    await writeJson(leftover, 'half written');
    const twoMinutesAgo = (Date.now() - 120_000) / 1000;
    await utimes(leftover, twoMinutesAgo, twoMinutesAgo);
    const {dispose} = await register(mockLog(), context);

    await dispose();

    expect(await readdir(songs)).toEqual([]);
    const [backup = ''] = await readdir(
      join(context.appDataFolder, 'LoveLightBackups'),
    );
    expect(
      await readdir(
        join(context.appDataFolder, 'LoveLightBackups', backup, 'Songs'),
      ),
    ).toEqual([]);
  });

  it('skips the launch backup while an output is on', async () => {
    const context = await developmentContext();
    const log = mockLog();
    const {dispose} = await register(log, context, () => true);

    await dispose();

    expect(log.info).toHaveBeenCalledWith('skipped the launch backup', {
      reason: 'output-on',
    });
  });
});
