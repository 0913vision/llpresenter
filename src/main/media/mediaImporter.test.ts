import {readdir, writeFile} from 'node:fs/promises';
import {join} from 'node:path';
import {describe, expect, it, onTestFinished, vi} from 'vitest';
import {makeTempDir} from '../../../test/temp-dir';
import {createMediaId, createMediaPlaylistId} from '@shared/schema/ids';
import {
  parseMediaDocument,
  type MediaEditResult,
  type MediaImportProgress,
} from '@shared/schema/mediaEdit';
import type {MediaItem} from '@shared/schema/mediaList';
import {expectSuccess} from '@shared/schema/testHelpers';
import {recordingLogger} from '../displays/testing';
import {EMPTY_MEDIA_LIST} from '../store/defaults';
import type {MediaItemsCommit} from '../store/mediaStore';
import type {CopyOptions} from './copyFile';
import {
  IMPORTED_VIDEO_SOUND,
  MAX_IMPORT_JOBS,
  MediaImporter,
  type ImportStore,
  type MediaImporterOptions,
} from './mediaImporter';

const uuid = (index: number) =>
  `00000000-0000-4000-8000-${String(index).padStart(12, '0')}`;

const PLAYLIST = {kind: 'media', id: createMediaPlaylistId(uuid(900))} as const;

function fakeStore(folder: string) {
  const items: MediaItem[] = [];
  const document = expectSuccess(
    parseMediaDocument({
      name: 'media',
      revision: 1,
      access: 'editable',
      value: EMPTY_MEDIA_LIST,
    }),
  );
  const add = vi.fn((commit: MediaItemsCommit): Promise<MediaEditResult> => {
    items.push(...commit.items);
    return Promise.resolve({
      ok: true,
      value: {id: commit.items[0]?.id ?? '', revision: 2},
    });
  });
  const store: ImportStore = {folder, get: () => document, add};
  return {store, items, add};
}

async function setup(options: Partial<MediaImporterOptions> = {}) {
  const root = await makeTempDir();
  const sources = join(root, 'sources');
  const media = join(root, 'media');
  const {store, items, add} = fakeStore(media);
  const reports: MediaImportProgress[] = [];
  let next = 0;
  const importer = new MediaImporter({
    store: () => Promise.resolve(store),
    report: value => reports.push(value),
    chooseFiles: () => Promise.resolve([]),
    createId: () => createMediaId(uuid(++next)),
    log: recordingLogger(),
    ...options,
  });
  onTestFinished(() => importer.dispose());
  const source = async (name: string, text = 'invented media') => {
    await writeFile(join(root, name), text);
    return join(root, name);
  };
  return {root, sources, media, importer, reports, items, add, source};
}

const signal = () => new AbortController().signal;

const ENDED = new Set(['complete', 'failed', 'cancelled']);

async function ended(reports: readonly MediaImportProgress[], count: number) {
  await vi.waitFor(() =>
    expect(reports.filter(({phase}) => ENDED.has(phase))).toHaveLength(count),
  );
}

function filesOf(paths: readonly string[]) {
  return {source: {kind: 'files', paths}, playlist: null} as const;
}

describe('media import', () => {
  it('queues the files, copies them into the media folder, and adds them to the list and playlist', async () => {
    const {importer, reports, items, add, media, source} = await setup();
    const video = await source('Morning light.mp4');
    const image = await source('Notice.png');
    const queued = await importer.import(
      {source: {kind: 'files', paths: [video, image]}, playlist: PLAYLIST},
      signal(),
    );
    expect(queued).toEqual({
      ok: true,
      value: [
        {
          mediaId: uuid(1),
          fileName: 'Morning light.mp4',
          phase: 'queued',
          percent: 0,
        },
        {mediaId: uuid(2), fileName: 'Notice.png', phase: 'queued', percent: 0},
      ],
    });
    await ended(reports, 2);
    expect(reports.filter(({phase}) => phase === 'complete')).toHaveLength(2);
    expect(reports.find(({phase}) => phase === 'copying')).toBeDefined();
    expect(items).toEqual([
      {
        id: uuid(1),
        name: 'Morning light',
        kind: 'video',
        file: 'Morning light.mp4',
        size: 14,
        props: {audio: IMPORTED_VIDEO_SOUND},
      },
      {
        id: uuid(2),
        name: 'Notice',
        kind: 'image',
        file: 'Notice.png',
        size: 14,
      },
    ]);
    expect(add).toHaveBeenCalledWith(expect.anything(), PLAYLIST);
    expect((await readdir(media)).sort()).toEqual([
      'Morning light.mp4',
      'Notice.png',
    ]);
  });

  it('refers to the file in place when imports do not copy', async () => {
    const {importer, items, reports, source} = await setup({
      copyIntoFolder: false,
    });
    const audio = await source('Prelude.mp3');
    await importer.import(filesOf([audio]), signal());
    await ended(reports, 1);
    expect(items).toEqual([
      {id: uuid(1), name: 'Prelude', kind: 'audio', file: audio, size: 14},
    ]);
  });

  it('fails an unsupported file at once and never queues it', async () => {
    const {importer, source, add} = await setup();
    const text = await source('words.txt');
    expect(await importer.import(filesOf([text]), signal())).toEqual({
      ok: true,
      value: [
        {
          mediaId: uuid(1),
          fileName: 'words.txt',
          phase: 'failed',
          percent: 0,
          message: '지원하지 않는 형식',
        },
      ],
    });
    await importer.dispose();
    expect(add).not.toHaveBeenCalled();
  });

  it('cancels a waiting job and answers a cancel for an ended one', async () => {
    let release: () => void = () => undefined;
    const held = new Promise<void>(resolve => {
      release = resolve;
    });
    const copy = vi.fn(async ({onPercent}: CopyOptions) => {
      onPercent(50);
      await held;
      return {ok: true, value: 14} as const;
    });
    const {importer, reports, add, source} = await setup({copy});
    const first = await source('a.mp4');
    const second = await source('b.mp4');
    await importer.import(filesOf([first, second]), signal());
    expect(await importer.cancel(createMediaId(uuid(2)))).toEqual({
      ok: true,
      value: null,
    });
    release();
    await ended(reports, 2);
    expect(reports.at(-1)).toMatchObject({
      mediaId: uuid(2),
      phase: 'cancelled',
    });
    expect(add).toHaveBeenCalledOnce();
    expect(copy).toHaveBeenCalledOnce();
    expect((await importer.cancel(createMediaId(uuid(2)))).ok).toBe(false);
  });

  it('fails a file the list refuses and removes its copy', async () => {
    const {importer, reports, add, media, source} = await setup();
    add.mockResolvedValueOnce({
      ok: false,
      error: {reason: 'invalid', message: 'Invented refusal'},
    });
    await importer.import(filesOf([await source('c.webm')]), signal());
    await ended(reports, 1);
    expect(reports.at(-1)).toMatchObject({
      phase: 'failed',
      message: '미디어 목록에 넣지 못함',
    });
    expect(await readdir(media)).toEqual([]);
  });

  it('imports the files the dialog chooses, and nothing when it is cancelled', async () => {
    const chooseFiles = vi.fn<() => Promise<readonly string[]>>();
    const {importer, items, reports, source} = await setup({chooseFiles});
    chooseFiles.mockResolvedValueOnce([]);
    expect(
      await importer.import(
        {source: {kind: 'dialog'}, playlist: null},
        signal(),
      ),
    ).toEqual({ok: true, value: []});
    chooseFiles.mockResolvedValueOnce([await source('d.jpg')]);
    await importer.import({source: {kind: 'dialog'}, playlist: null}, signal());
    await ended(reports, 1);
    expect(items.map(({name}) => name)).toEqual(['d']);
  });

  it('cancels every job on dispose and waits for the running one', async () => {
    const copy = ({signal: abort}: CopyOptions) =>
      new Promise<{readonly ok: false; readonly error: string}>(resolve => {
        const stopped = () => {
          resolve({ok: false, error: 'Invented abort'});
        };
        if (abort.aborted) stopped();
        else abort.addEventListener('abort', stopped);
      });
    const {importer, reports, add, source} = await setup({copy});
    await importer.import(
      filesOf([await source('f.mp4'), await source('g.mp4')]),
      signal(),
    );
    await importer.dispose();
    expect(reports.filter(({phase}) => phase === 'cancelled')).toHaveLength(2);
    expect(add).not.toHaveBeenCalled();
  });

  it('refuses more jobs than it may hold, and new imports once closed', async () => {
    const {importer, source} = await setup({
      copy: () => new Promise(() => undefined),
    });
    const file = await source('e.png');
    const many = Array.from({length: MAX_IMPORT_JOBS + 1}, () => file);
    expect((await importer.import(filesOf(many), signal())).ok).toBe(false);
    const closing = new AbortController();
    closing.abort();
    expect((await importer.import(filesOf([file]), closing.signal)).ok).toBe(
      false,
    );
  });
});
