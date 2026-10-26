import {getEventListeners} from 'node:events';
import {mkdir, readdir, readFile, writeFile} from 'node:fs/promises';
import {dirname, join} from 'node:path';
import {describe, expect, it, onTestFinished, vi} from 'vitest';
import {makeTempDir} from '../../../test/temp-dir';
import {
  createMediaId,
  createMediaPlaylistId,
  type MediaId,
} from '@shared/schema/ids';
import {
  parseMediaDocument,
  type MediaEditResult,
  type MediaImportProgress,
} from '@shared/schema/mediaEdit';
import type {MediaItem} from '@shared/schema/mediaList';
import {expectSuccess} from '@shared/schema/testHelpers';
import {recordingLogger} from '../displays/testing';
import {EMPTY_MEDIA_LIST} from '../store/defaults';
import {MediaStore, type MediaItemsCommit} from '../store/mediaStore';
import type {CopyOptions} from './copyFile';
import type {Analysis, AnalysisRequest} from './mediaAnalyser';
import {Thumbnails} from './thumbnails';
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
  const analyse = vi.fn<(request: AnalysisRequest) => Promise<Analysis>>(() =>
    Promise.resolve({kind: 'read', facts: {}}),
  );
  const saveThumbnail = vi.fn<
    (mediaId: MediaId, jpeg: Uint8Array, file: string) => Promise<void>
  >(() => Promise.resolve());
  const log = recordingLogger();
  const importer = new MediaImporter({
    store: () => Promise.resolve(store),
    report: value => reports.push(value),
    chooseFiles: () => Promise.resolve([]),
    createId: () => createMediaId(uuid(++next)),
    analyse,
    saveThumbnail,
    log,
    copyIntoFolder: true,
    ...options,
  });
  onTestFinished(() => importer.dispose());
  const source = async (name: string, text = 'invented media') => {
    await writeFile(join(root, name), text);
    return join(root, name);
  };
  return {
    root,
    sources,
    media,
    importer,
    reports,
    items,
    add,
    source,
    analyse,
    saveThumbnail,
    log,
  };
}

const signal = () => new AbortController().signal;

const ENDED = new Set(['complete', 'failed', 'cancelled']);

// NOTE(0913vision): Jobs copy real files, which can take over the default
// second when the whole suite runs at once.
const JOB_END_TIMEOUT_MS = 5_000;

async function ended(reports: readonly MediaImportProgress[], count: number) {
  await vi.waitFor(
    () =>
      expect(reports.filter(({phase}) => ENDED.has(phase))).toHaveLength(count),
    {timeout: JOB_END_TIMEOUT_MS},
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
    expect(reports.some(report => report.phase === 'copying')).toBe(false);
    expect(reports.at(-1)).toMatchObject({phase: 'complete', percent: 100});
  });

  it('imports the original using the default when the preference read rejects', async () => {
    const {importer, items, reports, source, log} = await setup({
      copyIntoFolder: () =>
        Promise.reject(new Error('Invented preferences read failure')),
    });
    const file = await source('Original.mp4');
    await importer.import(filesOf([file]), signal());
    await ended(reports, 1);
    expect(items[0]?.file).toBe(file);
    expect(reports.at(-1)).toMatchObject({phase: 'complete'});
    expect(reports.some(report => report.phase === 'copying')).toBe(false);
    expect(log.messages('warn')).toEqual([
      'could not read media copy preference; using the default',
    ]);
    expect(await readFile(file, 'utf8')).toBe('invented media');
  });

  it('snapshots one policy per batch while queued jobs keep their admitted policy', async () => {
    let copying = false;
    const policy = vi.fn(() => Promise.resolve(copying));
    const {importer, items, reports, source, media, analyse} = await setup({
      copyIntoFolder: policy,
    });
    let finish: (value: Analysis) => void = () => undefined;
    analyse.mockImplementationOnce(
      () =>
        new Promise(resolve => {
          finish = resolve;
        }),
    );
    const paths = await Promise.all(
      ['First.mp4', 'Second.mp4', 'Third.mp4'].map(name => source(name)),
    );
    await importer.import(filesOf(paths.slice(0, 2)), signal());
    await vi.waitFor(() => expect(analyse).toHaveBeenCalledOnce());
    copying = true;
    await importer.import(filesOf(paths.slice(2)), signal());
    finish({kind: 'read', facts: {}});
    await ended(reports, 3);
    expect(policy).toHaveBeenCalledTimes(2);
    expect(items.map(item => item.file)).toEqual([
      paths[0],
      paths[1],
      'Third.mp4',
    ]);
    expect(await readdir(media)).toEqual(['Third.mp4']);
    expect(await readFile(paths[0] ?? '', 'utf8')).toBe('invented media');
  });

  it.each(['failure', 'cancellation'] as const)(
    'keeps an original after analysis %s without copying',
    async outcome => {
      const {importer, reports, source, analyse, add} = await setup({
        copyIntoFolder: false,
      });
      const file = await source('Original.mp4');
      analyse.mockImplementationOnce(async () => {
        if (outcome === 'cancellation') {
          await importer.cancel(createMediaId(uuid(1)));
        }
        return {
          kind: 'cant-play',
          reason: 'unsupported',
          message: 'Invented decode failure',
        };
      });
      await importer.import(filesOf([file]), signal());
      await ended(reports, 1);
      expect(add).not.toHaveBeenCalled();
      expect(await readFile(file, 'utf8')).toBe('invented media');
      expect(reports.at(-1)?.phase).toBe(
        outcome === 'cancellation' ? 'cancelled' : 'failed',
      );
    },
  );

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

describe('media import boundaries', () => {
  it.each([true, false])(
    'keeps an imported file when the media list applies it but fails to save (copy=%s)',
    async copyIntoFolder => {
      const root = await makeTempDir();
      const folder = join(root, 'media');
      const store = new MediaStore({
        document: expectSuccess(
          parseMediaDocument({
            name: 'media',
            revision: 1,
            access: 'editable',
            value: EMPTY_MEDIA_LIST,
          }),
        ),
        file: join(root, 'media.json'),
        mediaFolder: folder,
        developmentFolder: null,
        files: {
          write: request =>
            Promise.resolve({
              ok: false,
              error: {file: request.target.file, message: 'Invented full disk'},
            }),
          remove: () => Promise.resolve({ok: true, value: undefined}),
        },
        log: recordingLogger(),
        delayMs: 0,
      });
      onTestFinished(() => store.dispose());
      const reports: MediaImportProgress[] = [];
      const importer = new MediaImporter({
        store: () => Promise.resolve(store),
        report: value => reports.push(value),
        chooseFiles: () => Promise.resolve([]),
        createId: () => createMediaId(uuid(1)),
        copyIntoFolder,
        analyse: () => Promise.resolve({kind: 'read', facts: {}}),
        saveThumbnail: () => Promise.resolve(),
        log: recordingLogger(),
      });
      const source = join(root, 'Kept.png');
      await writeFile(source, 'invented');
      await importer.import(filesOf([source]), signal());
      await ended(reports, 1);
      expect(reports.at(-1)).toMatchObject({phase: 'complete'});
      if (copyIntoFolder) expect(await readdir(folder)).toEqual(['Kept.png']);
      expect(await readFile(source, 'utf8')).toBe('invented');
      expect(await store.backgroundOf(uuid(1))).toMatchObject({
        mediaId: uuid(1),
      });
      expect(store.get().value.items.map(({id}) => id)).toEqual([uuid(1)]);
    },
  );

  it('stops following the shared backend signal when each job ends', async () => {
    const {importer, reports, source} = await setup();
    const shared = new AbortController();
    for (const name of ['h.png', 'i.png', 'j.png']) {
      await importer.import(filesOf([await source(name)]), shared.signal);
    }
    await ended(reports, 3);
    expect(getEventListeners(shared.signal, 'abort')).toHaveLength(0);
  });

  it('removes the copy when a cancel wins after the copy and before the list', async () => {
    let cancel: () => Promise<unknown> = () => Promise.resolve();
    const copy = vi.fn(async ({to}: CopyOptions) => {
      await mkdir(dirname(to), {recursive: true});
      await writeFile(to, 'invented');
      await cancel();
      return {ok: true, value: 8} as const;
    });
    const {importer, reports, add, media, source} = await setup({copy});
    cancel = () => importer.cancel(createMediaId(uuid(1)));
    await importer.import(filesOf([await source('k.mp4')]), signal());
    await ended(reports, 1);
    expect(reports.at(-1)).toMatchObject({phase: 'cancelled'});
    expect(add).not.toHaveBeenCalled();
    expect(await readdir(media)).toEqual([]);
  });

  it('refuses a cancel once the item is joining the media list', async () => {
    const {importer, reports, add, media, source} = await setup();
    let admit: () => void = () => undefined;
    add.mockImplementationOnce(
      commit =>
        new Promise(resolve => {
          admit = () => {
            resolve({
              ok: true,
              value: {id: commit.items[0]?.id ?? '', revision: 2},
            });
          };
        }),
    );
    await importer.import(filesOf([await source('l.webm')]), signal());
    await vi.waitFor(() => expect(add).toHaveBeenCalledOnce());
    expect(await importer.cancel(createMediaId(uuid(1)))).toMatchObject({
      ok: false,
      error: {reason: 'invalid'},
    });
    admit();
    await ended(reports, 1);
    expect(reports.at(-1)).toMatchObject({phase: 'complete'});
    expect(await readdir(media)).toEqual(['l.webm']);
  });

  it('analyses each copied file, adds its duration and size, and keeps its thumbnail', async () => {
    const {importer, reports, items, analyse, saveThumbnail, media, source} =
      await setup();
    analyse.mockResolvedValue({
      kind: 'read',
      facts: {
        duration: 12.5,
        width: 1920,
        height: 1080,
        thumbnail: Buffer.from([1]),
      },
    });
    await importer.import(filesOf([await source('Dawn.mp4')]), signal());
    await ended(reports, 1);
    expect(
      reports.slice(-2).map(({phase, percent}) => [phase, percent]),
    ).toEqual([
      ['analysing', 100],
      ['complete', 100],
    ]);
    const request = analyse.mock.calls[0]?.[0];
    expect(request).toMatchObject({
      file: join(media, 'Dawn.mp4'),
      kind: 'video',
      thumbnail: true,
    });
    expect(request?.signal?.aborted).toBe(false);
    expect(items[0]).toMatchObject({duration: 12.5, width: 1920, height: 1080});
    expect(items[0]).not.toHaveProperty('thumbnail');
    expect(saveThumbnail).toHaveBeenCalledExactlyOnceWith(
      uuid(1),
      Buffer.from([1]),
      join(media, 'Dawn.mp4'),
    );
  });

  it('fails a file the decoders refuse and removes its copy', async () => {
    const {importer, reports, items, analyse, media, source, log} =
      await setup();
    analyse.mockResolvedValue({
      kind: 'cant-play',
      reason: 'unsupported',
      message: 'Invented demuxer error',
    });
    await importer.import(filesOf([await source('Odd.mov')]), signal());
    await ended(reports, 1);
    expect(reports.at(-1)).toMatchObject({
      phase: 'failed',
      message: '재생할 수 없는 형식',
    });
    expect(items).toEqual([]);
    expect(await readdir(media)).toEqual([]);
    expect(log.messages('info')).toEqual(['imported media can not play']);
  });

  it('adds a file analysis could not read without its facts', async () => {
    const {importer, reports, items, analyse, source, log} = await setup();
    analyse.mockResolvedValue({
      kind: 'unavailable',
      message: 'The analysis timed out',
    });
    await importer.import(filesOf([await source('Slow.mp4')]), signal());
    await ended(reports, 1);
    expect(reports.at(-1)).toMatchObject({phase: 'complete'});
    expect(items[0]).not.toHaveProperty('duration');
    expect(log.messages('warn')).toEqual(['imported media was not analysed']);
  });

  it('cancels a job while its file is analysed and removes the copy', async () => {
    const {importer, reports, items, analyse, media, source} = await setup();
    let finish: (analysis: Analysis) => void = () => undefined;
    analyse.mockImplementation(
      () =>
        new Promise(resolve => {
          finish = resolve;
        }),
    );
    const queued = await importer.import(
      filesOf([await source('Long.mp4')]),
      signal(),
    );
    await vi.waitFor(() => expect(analyse).toHaveBeenCalledOnce());
    const mediaId = queued.ok ? queued.value[0]?.mediaId : undefined;
    expect(await importer.cancel(createMediaId(mediaId ?? ''))).toEqual({
      ok: true,
      value: null,
    });
    expect(analyse.mock.calls[0]?.[0].signal?.aborted).toBe(true);
    finish({kind: 'read', facts: {duration: 1}});
    await ended(reports, 1);
    expect(reports.at(-1)).toMatchObject({phase: 'cancelled'});
    expect(items).toEqual([]);
    expect(await readdir(media)).toEqual([]);
  });

  it('keeps no thumbnail for an item relinked while its admission was still saving', async () => {
    const kept = new Map<string, Uint8Array>();
    const cache = {
      fileOf: () => Promise.resolve(null),
      put: (id: MediaId, jpeg: Uint8Array) => {
        kept.set(id, jpeg);
        return Promise.resolve<string | null>(`cache/${id}`);
      },
      remove: (id: MediaId) => {
        kept.delete(id);
        return Promise.resolve();
      },
    };
    const listed = {file: ''};
    let saved: (result: MediaEditResult) => void = () => undefined;
    const {importer, reports, analyse, add, media, source} = await setup({
      saveThumbnail: (mediaId, jpeg, file) =>
        thumbnails.save(mediaId, jpeg, file),
    });
    const thumbnails = new Thumbnails({
      cache,
      analyse,
      source: Promise.resolve({
        get: () =>
          expectSuccess(
            parseMediaDocument({
              name: 'media',
              revision: 2,
              access: 'editable',
              value: {
                ...EMPTY_MEDIA_LIST,
                items: [
                  {
                    id: uuid(1),
                    name: 'Dawn',
                    kind: 'video',
                    file: 'x',
                    size: 1,
                  },
                ],
              },
            }),
          ),
        fileOf: () => listed.file,
        subscribe: () => () => undefined,
      }),
      log: recordingLogger(),
    });
    analyse.mockResolvedValue({
      kind: 'read',
      facts: {thumbnail: Uint8Array.from([1])},
    });
    add.mockImplementation(
      () =>
        new Promise(resolve => {
          listed.file = join(media, 'Dawn.mp4');
          saved = resolve;
        }),
    );
    await importer.import(filesOf([await source('Dawn.mp4')]), signal());
    await vi.waitFor(() => expect(add).toHaveBeenCalledOnce());
    listed.file = 'D:/found/Dawn.mp4';
    saved({ok: true, value: {id: uuid(1), revision: 2}});
    await ended(reports, 1);
    expect(kept.size).toBe(0);
  });
});
