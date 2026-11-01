import {
  ask,
  askForService,
  developmentContext,
  disposers,
  electron,
  mockLog,
  mockProblems,
  register,
  songDocument,
} from './testing/registerFixtures';
import {contentEndpoints} from '@contracts/ipc/content';
import {liveEndpoints} from '@contracts/ipc/live';
import {serviceEndpoints} from '@contracts/ipc/service';
import {parseEditResult} from '@core/schema/contentEdit';
import {parseGroupedSong} from '@core/schema/groupedSong';
import {parseShowService} from '@core/schema/showService';
import {readFile} from 'node:fs/promises';
import {join} from 'node:path';
import {describe, expect, it} from 'vitest';
import {makeTempDir} from '../../../test/temp-dir';
import {openAppConfig} from './appConfigFile';
import {DATA_FOLDER_NAME} from './locations';
import {registerStore} from './register';
import {
  HYMN_ONE_ID,
  hymnOne,
  itemId,
  service,
  SUNDAY_ID,
  writeJson,
} from './testFiles';

describe('registerStore', () => {
  it('pushes edited song tiles without a live-state push and flushes before disposal', async () => {
    const context = await developmentContext();
    const root = join(context.appDataFolder, DATA_FOLDER_NAME);
    const file = join(root, 'Songs', 'original-name.llsong');
    await writeJson(file, {...hymnOne(), future: {enabled: true}});
    await writeJson(
      join(root, 'Services', 'open.llservice'),
      service(SUNDAY_ID, '2026-11-01T11:00', [
        {id: itemId(1), song: HYMN_ONE_ID},
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
      groups: current.groups
        .slice(0, 1)
        .map(group => ({...group, slides: [{lines: ['새로 편집한 가사']}]})),
      arrangements: [],
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
        revision: 2,
        tiles: {[itemId(1)]: [{lines: ['새로 편집한 가사']}]},
      },
    });
    expect(
      electron.send.mock.calls.filter(
        ([channel]) => channel === serviceEndpoints.changed.channel,
      ),
    ).toHaveLength(1);
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

    expect(parseGroupedSong(await readFile(file, 'utf8'), file)).toMatchObject({
      ok: true,
      value: {
        data: {
          groups: [{slides: [{lines: ['새로 편집한 가사']}]}],
          future: {enabled: true},
        },
      },
    });
    expect(electron.handlers.size).toBe(0);
  });

  it('reads and edits content requested while the data is still loading', async () => {
    const context = await developmentContext();
    const store = await register(mockLog(), context, () => true);

    const created = parseEditResult(
      await ask(contentEndpoints.edit.channel, {type: 'song.create'}),
    );
    if (!created.ok || !created.value.ok) {
      throw new Error('Could not create a test song');
    }
    expect(await ask(contentEndpoints.songs.list.channel)).toMatchObject([
      {id: created.value.value.id, title: '새 곡'},
    ]);
    expect(
      await ask(contentEndpoints.songs.get.channel, created.value.value.id),
    ).toMatchObject({revision: 1, access: 'editable'});
    await store.dispose();
    expect(electron.handlers.size).toBe(0);
  });

  it('logs and refuses malformed edits and document ids without changing files', async () => {
    const context = await developmentContext();
    const log = mockLog();
    await register(log, context, () => true);

    expect(
      await ask(contentEndpoints.edit.channel, {type: 'song.update', song: {}}),
    ).toMatchObject({ok: false, error: {reason: 'invalid'}});
    expect(
      await ask(contentEndpoints.songs.get.channel, '../outside'),
    ).toBeNull();
    expect(await ask(contentEndpoints.services.get.channel, 7)).toBeNull();
    expect(await ask(contentEndpoints.templates.get.channel, null)).toBeNull();
    expect(await ask(contentEndpoints.songs.list.channel)).toEqual([]);
    expect(log.warn).toHaveBeenCalledTimes(4);
  });

  it('answers content reads and edits safely when no data folder could be opened', async () => {
    const log = mockLog();
    const appConfig = await openAppConfig({
      file: join(await makeTempDir(), 'app.json'),
      log,
    });
    const store = registerStore({
      problems: mockProblems(),
      log,
      appConfig,
      isAnyOutputOn: () => false,
      context: () => {
        throw new Error('missing data');
      },
    });
    disposers.push(store.dispose);

    expect(
      await ask(contentEndpoints.edit.channel, {type: 'song.create'}),
    ).toMatchObject({ok: false, error: {reason: 'not-found'}});
    expect(await ask(contentEndpoints.songs.list.channel)).toEqual([]);
    expect(await ask(contentEndpoints.services.list.channel)).toEqual([]);
    expect(await ask(contentEndpoints.templates.list.channel)).toEqual([]);
    expect(
      await ask(contentEndpoints.songs.get.channel, HYMN_ONE_ID),
    ).toBeNull();
  });
});
