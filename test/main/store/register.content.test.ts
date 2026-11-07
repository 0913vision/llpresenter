import {
  ask,
  askForService,
  developmentContext,
  electron,
  mockLog,
  register,
  songDocument,
} from '@fixtures/main/store/registerFixtures';
import {contentEndpoints} from '@contracts/ipc/content';
import {liveEndpoints} from '@contracts/ipc/live';
import {serviceEndpoints} from '@contracts/ipc/service';
import {parseEditResult} from '@core/schema/contentEdit';
import {parseSong} from '@core/schema/song';
import {parseShowService} from '@core/schema/showService';
import {readFile} from 'node:fs/promises';
import {join} from 'node:path';
import {describe, expect, it} from 'vitest';
import {DATA_FOLDER_NAME} from '@main/store/locations';
import {
  HYMN_ONE_ID,
  hymnOne,
  itemId,
  service,
  SUNDAY_ID,
  writeJson,
} from '@fixtures/main/store/testFiles';

describe('registerStore', () => {
  it('keeps service item tiles independent of a library edit and flushes before disposal', async () => {
    const context = await developmentContext();
    const root = join(context.appDataFolder, DATA_FOLDER_NAME);
    const file = join(root, 'Songs', 'original-name.llsong');
    await writeJson(file, {...hymnOne(), future: {enabled: true}});
    await writeJson(
      join(root, 'Services', 'open.llservice'),
      service(SUNDAY_ID, '2026-11-01T11:00', [
        {slides: hymnOne().slides, id: itemId(1), song: HYMN_ONE_ID},
      ]),
    );
    const store = await register(mockLog(), context, () => true);
    const before = parseShowService(await askForService());
    if (!before.ok || before.value === null) {
      throw new Error('Missing test service');
    }
    const current = (await songDocument(HYMN_ONE_ID)).song;
    const edited = {
      ...current,
      slides: current.slides
        .slice(0, 1)
        .map(slide => ({...slide, lines: ['새로 편집한 가사']})),
    };

    const answer = parseEditResult(
      await ask(contentEndpoints.edit.channel, {
        type: 'song.update',
        song: edited,
        baseRevision: 1,
      }),
    );
    const after = parseShowService(await askForService());

    expect(answer).toMatchObject({
      ok: true,
      value: {ok: true, value: {id: HYMN_ONE_ID, revision: 2}},
    });
    expect(after).toMatchObject({
      ok: true,
      value: {
        revision: before.value.revision,
        tiles: before.value.tiles,
      },
    });
    expect(
      electron.send.mock.calls.filter(
        ([channel]) => channel === serviceEndpoints.changed.channel,
      ),
    ).toHaveLength(0);
    expect(
      electron.send.mock.calls.some(
        ([channel]) => channel === liveEndpoints.changed.channel,
      ),
    ).toBe(false);
    expect(
      electron.send.mock.calls.some(
        ([channel]) => channel === contentEndpoints.songs.changed.channel,
      ),
    ).toBe(true);
    await store.dispose();

    expect(parseSong(await readFile(file, 'utf8'), file)).toMatchObject({
      ok: true,
      value: {
        data: {
          slides: [{lines: ['새로 편집한 가사']}],
          future: {enabled: true},
        },
      },
    });
    expect(electron.handlers.size).toBe(0);
  });
});
