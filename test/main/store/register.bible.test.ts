import {
  ask,
  askForService,
  developmentContext,
  mockLog,
  register,
} from '@fixtures/main/store/registerFixtures';
import {settingsEndpoints} from '@contracts/ipc/settings';
import {chunkedTranslationFile} from '@fixtures/core/bible/testFiles';
import {parseBibleLookupRequest} from '@core/schema/bibleLookup';
import {parseShowService} from '@core/schema/showService';
import {mkdir, writeFile} from 'node:fs/promises';
import {join} from 'node:path';
import {describe, expect, it, vi} from 'vitest';
import * as chapterFile from '@main/bible/chapterFile';
import {DATA_FOLDER_NAME} from '@main/store/locations';
import {
  itemId,
  service,
  SUNDAY_ID,
  writeJson,
} from '@fixtures/main/store/testFiles';

describe('registerStore', () => {
  it('projects saved Bible items from the installed chunked translation and refreshes removed translations', async () => {
    const context = await developmentContext();
    const root = join(context.appDataFolder, DATA_FOLDER_NAME);
    const bibleFolder = join(context.appDataFolder, 'bible');
    await mkdir(bibleFolder, {recursive: true});
    await writeFile(
      join(bibleFolder, 'sample.llbible'),
      chunkedTranslationFile().bytes,
    );
    const bibleItem = {
      id: itemId(60),
      bible: {
        translation: 'sample',
        ref: '요한복음 3:16-18',
        split: 'verse',
        reference: 'every',
        verseNumbers: false,
        translationName: false,
      },
    };
    await writeJson(
      join(root, 'Services', `${SUNDAY_ID}.llservice`),
      service(SUNDAY_ID, '2026-11-01T11:00', [
        bibleItem,
        {
          ...bibleItem,
          id: itemId(61),
          bible: {...bibleItem.bible, ref: '창세기 1:1'},
        },
      ]),
    );
    await writeJson(join(root, 'Settings', 'bible.json'), {
      format: 'llsettings.bible',
      schemaVersion: 1,
      recents: [],
      translations: [
        {
          id: 'sample',
          name: 'Invented',
          lang: 'ko',
          file: 'sample.llbible',
          default: true,
        },
      ],
    });
    const readChapter = vi.spyOn(chapterFile, 'readBibleChapter');
    const store = await register(mockLog(), context, () => true);
    const shown = parseShowService(await askForService());
    if (!shown.ok || shown.value === null) {
      throw new Error('Missing projected service');
    }
    expect(shown.value.tiles[itemId(60)]).toMatchObject([
      {label: '3:16', lines: ['Invented book 43, chapter 3, verse 16']},
      {label: '3:17'},
      {label: '3:18'},
    ]);
    expect(shown.value.rows).toEqual([
      {
        kind: 'bible',
        id: itemId(60),
        title: '요한복음 3:16-18',
        bible: {
          ref: '요한복음 3:16-18',
          translation: 'sample',
          verseNumbers: false,
          translationName: false,
        },
      },
      {
        kind: 'bible',
        id: itemId(61),
        title: '창세기 1:1',
        problem: 'missing-bible',
      },
    ]);
    const reader = store.bible;
    const request = parseBibleLookupRequest({
      translation: 'sample',
      input: '요한복음 3:16-18',
    });
    if (!request.ok) throw new Error('Invalid request fixture');
    expect((await reader.lookup(request.value)).result.ok).toBe(true);
    expect(readChapter).toHaveBeenCalledOnce();
    const document = (await store.settings)?.get('bible');
    if (document?.name !== 'bible') throw new Error('Missing Bible document');
    expect(
      await ask(settingsEndpoints.edit.channel, {
        type: 'settings.update',
        name: 'bible',
        baseRevision: document.revision,
        value: {...document.value, translations: []},
      }),
    ).toMatchObject({ok: true});
    const removed = parseShowService(await askForService());
    if (!removed.ok || removed.value === null) {
      throw new Error('Missing refreshed service');
    }
    expect(removed.value.tiles).toEqual({});
    for (const row of removed.value.rows) {
      expect(row).not.toHaveProperty('bible');
    }
    expect(
      removed.value.rows.every(
        row => row.kind !== 'header' && row.problem === 'missing-bible',
      ),
    ).toBe(true);
    await store.dispose();
    await expect(reader.lookup(request.value)).rejects.toThrow(
      'Bible lookup is unavailable',
    );
  });
});
