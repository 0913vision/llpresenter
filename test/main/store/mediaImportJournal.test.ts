import {mkdir, readFile, writeFile} from 'node:fs/promises';
import {join} from 'node:path';
import {describe, expect, it} from 'vitest';
import {createMediaId} from '@core/schema/ids';
import {parseMediaImportJournal} from '@core/schema/mediaImportJournal';
import {makeTempDir} from '@fixtures/tempDir';
import {recordingLogger} from '@fixtures/main/displays/testing';
import {EMPTY_MEDIA_LIST} from '@main/store/defaults';
import {
  beginMediaImport,
  importTemporary,
  recoverMediaImports,
} from '@main/store/mediaImportJournal';

const ID = createMediaId('00000000-0000-4000-8000-000000000999');
const journal = {version: 1, mediaId: ID, file: 'copy.png'} as const;

describe('interrupted media import cleanup', () => {
  it('removes only owned unfinished files and is repeatable', async () => {
    const folder = await makeTempDir();
    await beginMediaImport(folder, journal);
    await writeFile(join(folder, journal.file), 'complete unregistered copy');
    await writeFile(importTemporary(folder, journal), 'partial copy');
    await writeFile(join(folder, 'unrelated.png'), 'user file');
    const log = recordingLogger();
    await recoverMediaImports(folder, EMPTY_MEDIA_LIST, log);
    await recoverMediaImports(folder, EMPTY_MEDIA_LIST, log);
    await expect(readFile(join(folder, journal.file))).rejects.toMatchObject({
      code: 'ENOENT',
    });
    await expect(
      readFile(importTemporary(folder, journal)),
    ).rejects.toMatchObject({code: 'ENOENT'});
    expect(await readFile(join(folder, 'unrelated.png'), 'utf8')).toBe(
      'user file',
    );
    expect(log.entries).toEqual([]);
  });

  it('protects a registered path even if another ID owns the journal', async () => {
    const folder = await makeTempDir();
    await beginMediaImport(folder, journal);
    await writeFile(join(folder, journal.file), 'registered bytes');
    await recoverMediaImports(
      folder,
      {
        ...EMPTY_MEDIA_LIST,
        items: [
          {
            id: createMediaId('00000000-0000-4000-8000-000000000998'),
            file: journal.file,
            name: 'Kept',
            kind: 'image',
            size: 16,
          },
        ],
      },
      recordingLogger(),
    );
    expect(await readFile(join(folder, journal.file), 'utf8')).toBe(
      'registered bytes',
    );
    await expect(
      readFile(join(folder, '.imports', `${ID}.json`)),
    ).rejects.toMatchObject({code: 'ENOENT'});
  });

  it('ignores malformed ownership without touching the claimed file', async () => {
    const folder = await makeTempDir();
    await mkdir(join(folder, '.imports'));
    await writeFile(join(folder, 'keep.png'), 'keep');
    await writeFile(
      join(folder, '.imports', `${ID}.json`),
      JSON.stringify({...journal, file: '../keep.png'}),
    );
    const log = recordingLogger();
    await recoverMediaImports(folder, EMPTY_MEDIA_LIST, log);
    expect(await readFile(join(folder, 'keep.png'), 'utf8')).toBe('keep');
    expect(log.messages('warn')).toEqual([
      'could not recover an interrupted media import',
    ]);
  });

  it.each(['../outside', 'a/b', 'a\\b', 'C:stream', '', '.', '..'])(
    'rejects unsafe filename %s',
    file => {
      expect(parseMediaImportJournal({...journal, file}).ok).toBe(false);
    },
  );
  it('rejects unknown versions and accepts the intended filename', () => {
    expect(parseMediaImportJournal(journal).ok).toBe(true);
    expect(parseMediaImportJournal({...journal, version: 2}).ok).toBe(false);
  });
});
