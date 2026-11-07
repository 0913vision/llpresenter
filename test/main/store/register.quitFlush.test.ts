import {
  ask,
  developmentContext,
  mockLog,
  register,
  songDocument,
} from '@fixtures/main/store/registerFixtures';
import {appEndpoints} from '@contracts/ipc/app';
import {contentEndpoints} from '@contracts/ipc/content';
import {parseEditResult} from '@core/schema/contentEdit';
import {parseSong} from '@core/schema/song';
import {readFile} from 'node:fs/promises';
import {join} from 'node:path';
import {describe, expect, it} from 'vitest';
import {installMockClock} from '@fixtures/mockClock';
import {DATA_FOLDER_NAME} from '@main/store/locations';
import {HYMN_ONE_ID, hymnOne, writeJson} from '@fixtures/main/store/testFiles';

const NEW_TITLE = '방금 저장한 제목';

async function titleOn(file: string): Promise<string | undefined> {
  const parsed = parseSong(await readFile(file, 'utf8'), file);
  return parsed.ok ? parsed.value.data.title : undefined;
}

/**
 * Opens a store over one song, saves a new title, and stops with the clock
 * inside the 0.5 s write delay: the edit is accepted and the file still holds
 * the old title.
 */
async function savedInsideWriteDelay() {
  const context = await developmentContext();
  const file = join(
    context.appDataFolder,
    DATA_FOLDER_NAME,
    'Songs',
    'original-name.llsong',
  );
  await writeJson(file, hymnOne());
  const store = await register(mockLog(), context);
  const current = (await songDocument(HYMN_ONE_ID)).song;
  const clock = installMockClock();
  const answer = parseEditResult(
    await ask(contentEndpoints.edit.channel, {
      type: 'song.update',
      song: {...current, title: NEW_TITLE},
      baseRevision: 1,
    }),
  );
  expect(answer).toMatchObject({ok: true, value: {ok: true}});
  await clock.advance(100);
  expect(await titleOn(file)).toBe(hymnOne()['title']);
  return {store, file, clock};
}

describe('quitting right after a song save', () => {
  it('writes the song when the data store closes inside the write delay', async () => {
    const {store, file} = await savedInsideWriteDelay();

    await store.dispose();

    expect(await titleOn(file)).toBe(NEW_TITLE);
  });

  it('writes the song when the closing handshake asks to save pending edits', async () => {
    const {file} = await savedInsideWriteDelay();

    const saved = await ask(appEndpoints.savePending.channel);

    expect(saved).toBe(true);
    expect(await titleOn(file)).toBe(NEW_TITLE);
  });
});
