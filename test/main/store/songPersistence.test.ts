import {fixtureSlideId} from '@fixtures/core/songs/slideFixtures';
import {mkdir, readFile, readdir, writeFile} from 'node:fs/promises';
import {dirname, join} from 'node:path';
import {beforeEach, expect, it, onTestFinished, vi} from 'vitest';
import {makeTempDir} from '@fixtures/tempDir';
import {type Song} from '@core/schema/song';
import {createSongId} from '@core/schema/ids';
import type {Logger} from '@main/log';
import {openAppConfig} from '@main/store/appConfigFile';
import {ContentStore, type ContentEvents} from '@main/store/contentStore';
import {loadStore} from '@main/store/fileStore';
import {DATA_FOLDER_NAME} from '@main/store/locations';
import {RecoveryCopies} from '@main/store/recoveryCopies';
import {Saver, type SaveRequest} from '@main/store/saver';

const fault = vi.hoisted(() => ({file: '', enabled: false}));

vi.mock('node:fs/promises', async importOriginal => {
  const actual = await importOriginal<typeof import('node:fs/promises')>();
  return {
    ...actual,
    rename: (...args: Parameters<typeof actual.rename>) => {
      if (fault.enabled && String(args[1]) === fault.file) {
        return Promise.reject(
          Object.assign(new Error('Invented locked song'), {code: 'EPERM'}),
        );
      }
      return actual.rename(...args);
    },
  };
});

const SONG_ID = createSongId('00000000-0000-4000-8000-000000000001');

const stored = {
  format: 'llsong',
  schemaVersion: 1,
  id: SONG_ID,
  title: 'Invented stored song',
  extension: {keep: true},
  slides: [
    {
      id: fixtureSlideId(1),
      lines: ['Invented dawn'],
      note: 'first',
      label: 'Verse',
    },
    {id: fixtureSlideId(2), lines: ['Invented noon'], label: 'Verse'},
    {id: fixtureSlideId(3), lines: ['Invented evening'], label: 'Chorus'},
  ],
};

beforeEach(() => {
  fault.file = '';
  fault.enabled = false;
});

function quietLog(): Logger {
  return {info: vi.fn(), warn: vi.fn(), error: vi.fn(), flush: async () => {}};
}

function events(): ContentEvents {
  return {
    songChanged: vi.fn(),
    songsListChanged: vi.fn(),
    serviceChanged: vi.fn(),
    servicesListChanged: vi.fn(),
    templateChanged: vi.fn(),
    templatesListChanged: vi.fn(),
  };
}

async function scenario(source: unknown = stored) {
  const folder = await makeTempDir();
  const file = join(folder, DATA_FOLDER_NAME, 'Songs', `${SONG_ID}.llsong`);
  const original = `${JSON.stringify(source, null, 2)}\n`;
  await mkdir(dirname(file), {recursive: true});
  await writeFile(file, original, 'utf8');
  const log = quietLog();
  const appConfig = await openAppConfig({file: join(folder, 'app.json'), log});
  const loaded = await loadStore({
    appConfig,
    developmentFolder: folder,
    documents: join(folder, 'unused-documents'),
  });
  if (!loaded.ok) throw new Error(loaded.error.message);
  const copies = new RecoveryCopies({
    folder: loaded.value.locations.recovery,
    keep: () => 10,
  });
  const saver = new Saver({
    copies,
    reportCopyProblem: problem =>
      log.warn('could not keep recovery copy', problem),
  });
  const write = vi.fn((request: SaveRequest) => saver.save(request));
  const content = new ContentStore({
    ...loaded.value,
    files: {
      write,
      remove: vi.fn(async () => ({ok: true as const, value: undefined})),
    },
    events: events(),
    log,
    writeDelayMs: 60_000,
  });
  onTestFinished(() => content.dispose());
  await appConfig.flush();
  fault.file = file;
  return {file, original, content, write, loaded: loaded.value};
}

function documentOf(content: ContentStore) {
  const document = content.song(SONG_ID);
  if (document === null) throw new Error('Missing invented song');
  return document;
}

function linesIn(song: Song): string[] {
  return song.slides.flatMap(slide => slide.lines);
}

async function revise(content: ContentStore, line: string) {
  const {song, revision} = documentOf(content);
  const result = await content.apply({
    type: 'song.update',
    baseRevision: revision,
    song: {
      ...song,
      slides: song.slides.map((slide, index) =>
        index === 0 ? {...slide, lines: [line]} : slide,
      ),
    },
  });
  expect(result.ok).toBe(true);
}

async function recoveryText(
  loaded: Awaited<ReturnType<typeof scenario>>['loaded'],
) {
  const folder = join(loaded.locations.recovery, 'song', SONG_ID);
  const files = await readdir(folder);
  expect(files).toHaveLength(1);
  const file = files[0];
  if (file === undefined) throw new Error('Missing recovery copy');
  return readFile(join(folder, file), 'utf8');
}

it('reads a file without writing it on read or idle flush', async () => {
  const {file, original, content, write} = await scenario();
  const {song} = documentOf(content);
  expect(song.schemaVersion).toBe(1);
  expect(linesIn(song)).toEqual([
    'Invented dawn',
    'Invented noon',
    'Invented evening',
  ]);
  expect(song).toMatchObject({extension: {keep: true}});
  expect(song.slides[0]).toMatchObject({note: 'first'});
  await content.flush();
  expect(write).not.toHaveBeenCalled();
  expect(await readFile(file, 'utf8')).toBe(original);
});

it('writes the edit and keeps the original bytes as the recovery copy', async () => {
  const {file, original, content, loaded} = await scenario();
  const ids = documentOf(content).song.slides.map(slide => slide.id);
  await revise(content, 'Invented revised dawn');
  await content.flush();
  const saved: unknown = JSON.parse(await readFile(file, 'utf8'));
  expect(saved).toMatchObject({schemaVersion: 1, extension: {keep: true}});
  expect(documentOf(content).song.slides.map(slide => slide.id)).toEqual(ids);
  expect(await recoveryText(loaded)).toBe(original);
});

it('preserves the file on atomic rename failure and retries the newest slide-deck edit', async () => {
  const {file, original, content, loaded} = await scenario();
  fault.enabled = true;
  await revise(content, 'Invented pending line');
  await content.flush();
  expect(await readFile(file, 'utf8')).toBe(original);
  expect(await recoveryText(loaded)).toBe(original);
  expect(
    (await readdir(dirname(file))).some(name => name.endsWith('.tmp')),
  ).toBe(false);
  expect(linesIn(documentOf(content).song)[0]).toBe('Invented pending line');
  await revise(content, 'Invented newest line');
  fault.enabled = false;
  await content.flush();
  const saved: unknown = JSON.parse(await readFile(file, 'utf8'));
  expect(saved).toMatchObject({schemaVersion: 1, extension: {keep: true}});
  expect(saved).toHaveProperty('slides.0.lines', ['Invented newest line']);
  expect(await recoveryText(loaded)).toBe(original);
});

it('reloads slide identities, labels and hot keys after saving', async () => {
  const {file, content} = await scenario();
  const {song, revision} = documentOf(content);
  const edited = {
    ...song,
    slides: song.slides.map((slide, index) =>
      index === 0 ? {...slide, hotKey: 'KeyK'} : slide,
    ),
  };
  expect(
    (
      await content.apply({
        type: 'song.update',
        baseRevision: revision,
        song: edited,
      })
    ).ok,
  ).toBe(true);
  await content.flush();
  const saved: unknown = JSON.parse(await readFile(file, 'utf8'));
  const reopened = await scenario(saved);
  expect(documentOf(reopened.content).song).toEqual(documentOf(content).song);
  expect(documentOf(reopened.content).song.slides[0]?.hotKey).toBe('KeyK');
  expect(linesIn(documentOf(reopened.content).song)).toEqual(linesIn(song));
});

it('keeps a known newer slide-deck file read-only without rewriting it', async () => {
  const source = {
    format: 'llsong',
    schemaVersion: 2,
    id: SONG_ID,
    title: 'Invented future song',
    future: {keep: true},
    slides: [
      {
        id: fixtureSlideId(4),
        lines: ['Invented future line'],
        hotKey: 'KeyA',
        label: 'Verse',
      },
    ],
  };
  const {file, original, content, write} = await scenario(source);
  const document = documentOf(content);
  expect(document.access).toBe('readOnly');
  expect(document.song.schemaVersion).toBe(2);
  const result = await content.apply({
    type: 'song.update',
    baseRevision: document.revision,
    song: {...document.song, title: 'Refused invented title'},
  });
  expect(result).toMatchObject({ok: false, error: {reason: 'read-only'}});
  await content.flush();
  expect(write).not.toHaveBeenCalled();
  expect(await readFile(file, 'utf8')).toBe(original);
});

it('skips a malformed slide-deck file once and leaves its original bytes intact', async () => {
  const {file, original, content, write, loaded} = await scenario({
    format: 'llsong',
    schemaVersion: 1,
    id: SONG_ID,
    title: 'Invented corrupt song',
    groups: 'not a group array',
  });
  expect(content.song(SONG_ID)).toBeNull();
  expect(loaded.problems.filter(problem => problem.file === file)).toHaveLength(
    1,
  );
  await content.flush();
  expect(write).not.toHaveBeenCalled();
  expect(await readFile(file, 'utf8')).toBe(original);
});
