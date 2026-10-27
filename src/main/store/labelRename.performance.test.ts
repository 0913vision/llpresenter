import {mkdir, writeFile} from 'node:fs/promises';
import {join, resolve} from 'node:path';
import {expect, it} from 'vitest';
import {
  parseSettingsDocument,
  type LabelRename,
} from '@shared/schema/settingsDocuments';
import {parseGroupedSong} from '@shared/schema/groupedSong';
import {expectSuccess} from '@shared/schema/testHelpers';
import {makeTempDir} from '../../../test/temp-dir';
import {recordingLogger} from '../displays/testing';
import {ContentStore} from './contentStore';
import {documentFiles} from './documentFiles';
import {resolveLocations} from './locations';
import {RecoveryCopies} from './recoveryCopies';
import {Saver} from './saver';
import {SettingsStore} from './settingsStore';
import {itemId} from './testFiles';

const SONG_COUNT = 1_000;
const SEED_CHUNK = 25;

it('records a 1000-song label rename and a queued edit using atomic writes and recovery copies', async () => {
  const folder = await makeTempDir();
  const {locations} = resolveLocations(
    {},
    {documents: folder, developmentFolder: folder},
  );
  await mkdir(locations.songs, {recursive: true});
  await mkdir(locations.settings, {recursive: true});
  const songs = Array.from({length: SONG_COUNT}, (_value, index) => {
    const file = join(locations.songs, `${itemId(index + 1)}.llsong`);
    return {
      ...expectSuccess(
        parseGroupedSong(
          JSON.stringify({
            format: 'llsong',
            schemaVersion: 1,
            id: itemId(index + 1),
            title: `Invented song ${index + 1}`,
            slides: [
              {label: 'Before', lines: ['Invented line']},
              {label: 'Before', lines: ['Another invented line']},
            ],
          }),
          file,
        ),
      ),
      file,
    };
  });
  for (let index = 0; index < songs.length; index += SEED_CHUNK) {
    await Promise.all(
      songs
        .slice(index, index + SEED_CHUNK)
        .map(song => writeFile(song.file, JSON.stringify(song.data))),
    );
  }
  const document = expectSuccess(
    parseSettingsDocument({
      name: 'labels',
      access: 'editable',
      revision: 1,
      value: {
        format: 'llsettings.labels',
        schemaVersion: 1,
        labels: [{name: 'Before', color: 'teal', key: null}],
      },
    }),
  );
  await writeFile(
    join(locations.settings, 'labels.json'),
    JSON.stringify(document.value),
  );
  const log = recordingLogger();
  const copies = new RecoveryCopies({
    folder: locations.recovery,
    keep: () => 10,
  });
  const saver = new Saver({
    copies,
    reportCopyProblem: error =>
      log.warn('could not keep a recovery copy', error),
  });
  const files = documentFiles({saver, copies, log});
  const settings = new SettingsStore({
    documents: new Map([['labels', document]]),
    problems: [],
    log,
    saving: {folder: locations.settings, files},
  });
  const content = new ContentStore({
    locations,
    songs: new Map(songs.map(song => [song.data.id, song])),
    services: new Map(),
    templates: new Map(),
    files,
    log,
    events: {
      songChanged: () => undefined,
      songsListChanged: () => undefined,
      serviceChanged: () => undefined,
      servicesListChanged: () => undefined,
      templateChanged: () => undefined,
      templatesListChanged: () => undefined,
    },
  });
  try {
    const rename: LabelRename = {
      type: 'labels.rename',
      name: 'labels',
      from: 'Before',
      to: 'After',
      baseRevision: 1,
    };
    const started = performance.now();
    const renaming = content.renameLabel(settings, rename);
    const nextEdit = content
      .apply({type: 'song.create'})
      .then(result => ({result, elapsedMs: performance.now() - started}));
    expect((await renaming).ok).toBe(true);
    const renameMs = performance.now() - started;
    const queued = await nextEdit;
    expect(queued.result.ok).toBe(true);
    await content.flush();
    const completeMs = performance.now() - started;
    expect(content.storedSongs().size).toBe(SONG_COUNT + 1);
    expect(
      [...content.storedSongs().values()].filter(song => song.revision === 2),
    ).toHaveLength(SONG_COUNT);
    expect(log.messages('warn')).toEqual([]);
    expect(log.messages('error')).toEqual([]);
    const evidence = {
      songCount: SONG_COUNT,
      slidesPerSong: 2,
      renameMs,
      queuedEditMs: queued.elapsedMs,
      completeMs,
      atomicWrites: true,
      recoveryCopies: true,
      eventConsumers: 'no-op',
      platform: process.platform,
      node: process.version,
    };
    const coverage = resolve('coverage');
    await mkdir(coverage, {recursive: true});
    await writeFile(
      join(coverage, 'label-rename-budget.json'),
      `${JSON.stringify(evidence, null, 2)}\n`,
    );
    console.info(
      `Label rename ${SONG_COUNT} songs: ${renameMs.toFixed(1)} ms; queued edit: ${queued.elapsedMs.toFixed(1)} ms; complete: ${completeMs.toFixed(1)} ms`,
    );
  } finally {
    await content.flush();
    content.dispose();
    await settings.dispose();
  }
});
