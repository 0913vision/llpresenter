import {mkdir, writeFile} from 'node:fs/promises';
import {join} from 'node:path';
import {describe, expect, it, vi} from 'vitest';
import {makeTempDir} from '../../../test/temp-dir';
import {createMediaId, type MediaId} from '@shared/schema/ids';
import {
  parseMediaDocument,
  type MediaDocument,
  type MediaEditResult,
} from '@shared/schema/mediaEdit';
import {MEDIA_LIMITS, type MediaItem} from '@shared/schema/mediaList';
import {expectSuccess} from '@shared/schema/testHelpers';
import {recordingLogger} from '../displays/testing';
import {EMPTY_MEDIA_LIST} from '../store/defaults';
import type {MediaItemsCommit} from '../store/mediaStore';
import type {MediaKind} from './mediaKinds';
import {MediaRelinker, type RelinkStore} from './mediaRelinker';

const mediaId = (index: number): MediaId =>
  createMediaId(`00000000-0000-4000-8000-${String(index).padStart(12, '0')}`);

function mediaDocument(items: readonly object[]): MediaDocument {
  return expectSuccess(
    parseMediaDocument({
      name: 'media',
      revision: 4,
      access: 'editable',
      value: {...EMPTY_MEDIA_LIST, items},
    }),
  );
}

interface Stored {
  readonly id: MediaId;
  /** The item's absolute file now. */
  readonly file: string;
  readonly missing?: boolean;
}

async function setup(stored: readonly Stored[]) {
  const folder = await makeTempDir();
  const document = mediaDocument(
    stored.map(({id, file}) => ({
      id,
      name: 'Invented',
      kind: 'image',
      file,
      size: 1,
    })),
  );
  const files = new Map(stored.map(({id, file}) => [id, file]));
  const replace = vi.fn<(commit: MediaItemsCommit) => Promise<MediaEditResult>>(
    commit =>
      Promise.resolve({
        ok: true,
        value: {id: commit.items[0]?.id ?? '', revision: 5},
      }),
  );
  const store: RelinkStore = {
    get: () => document,
    folder,
    fileOf: id => {
      for (const [key, file] of files) if (key === id) return file;
      return null;
    },
    replace,
  };
  const chooseFile = vi.fn<(kind: MediaKind) => Promise<string | null>>(() =>
    Promise.resolve(null),
  );
  const recheck = vi.fn<(mediaIds: readonly MediaId[]) => void>();
  const log = recordingLogger();
  const missing = new Set(
    stored.filter(entry => entry.missing === true).map(({id}) => id),
  );
  const relinker = new MediaRelinker({
    store: () => Promise.resolve(store),
    chooseFile,
    isMissing: id => missing.has(id),
    recheck,
    log,
  });
  return {folder, relinker, replace, chooseFile, recheck, log};
}

async function file(path: string, bytes = 'invented'): Promise<string> {
  await writeFile(path, bytes);
  return path;
}

function committed(replace: {
  readonly mock: {readonly calls: ReadonlyArray<readonly [MediaItemsCommit]>};
}): readonly MediaItem[] {
  return replace.mock.calls.flatMap(([commit]) => commit.items);
}

const signal = new AbortController().signal;
const A = mediaId(1);

describe('media relinking', () => {
  it('stores a file in the media folder by its relative path, with its size', async () => {
    const {folder, relinker, replace, chooseFile, recheck} = await setup([
      {id: A, file: 'D:\\gone\\a.png', missing: true},
    ]);
    await mkdir(join(folder, 'found'));
    chooseFile.mockResolvedValue(
      await file(join(folder, 'found', 'a.png'), 'twelve bytes'),
    );

    const result = await relinker.relink(A, signal);

    expect(result).toEqual({ok: true, value: {id: A, revision: 5}});
    expect(chooseFile).toHaveBeenCalledExactlyOnceWith('image');
    expect(replace).toHaveBeenCalledExactlyOnceWith({
      items: [
        expect.objectContaining({
          id: A,
          file: join('found', 'a.png'),
          size: 12,
        }),
      ],
      baseRevision: 4,
    });
    expect(recheck).toHaveBeenCalledExactlyOnceWith([A]);
  });

  it('stores a file outside the media folder by its full path', async () => {
    const {relinker, replace, chooseFile} = await setup([
      {id: A, file: 'D:\\gone\\a.png'},
    ]);
    const chosen = await file(join(await makeTempDir(), 'a.png'));
    chooseFile.mockResolvedValue(chosen);
    await relinker.relink(A, signal);
    expect(committed(replace)).toEqual([
      expect.objectContaining({file: chosen, size: 8}),
    ]);
  });

  it('relinks the missing media of the same old folder whose files are in the new folder', async () => {
    const old = await makeTempDir();
    const other = await makeTempDir();
    const found = await makeTempDir();
    const [b, c, d, e] = [mediaId(2), mediaId(3), mediaId(4), mediaId(5)];
    const {relinker, replace, chooseFile, recheck} = await setup([
      {id: A, file: join(old, 'a.png'), missing: true},
      {id: b, file: join(old, 'b.png'), missing: true},
      {id: c, file: join(old, 'c.png'), missing: true},
      {id: d, file: join(old, 'd.png')},
      {id: e, file: join(other, 'e.png'), missing: true},
    ]);
    for (const name of ['a.png', 'b.png', 'd.png', 'e.png']) {
      await file(join(found, name));
    }
    chooseFile.mockResolvedValue(join(found, 'a.png'));

    await relinker.relink(A, signal);

    expect(committed(replace).map(({id, file: path}) => [id, path])).toEqual([
      [A, join(found, 'a.png')],
      [b, join(found, 'b.png')],
    ]);
    expect(recheck).toHaveBeenCalledExactlyOnceWith([A, b]);
  });

  it('relinks at most one import batch at once', async () => {
    const old = await makeTempDir();
    const found = await makeTempDir();
    const stored = Array.from(
      {length: MEDIA_LIMITS.importBatch + 20},
      (_, index) => ({
        id: mediaId(index + 1),
        file: join(old, `${index}.png`),
        missing: true,
      }),
    );
    const {relinker, replace, chooseFile} = await setup(stored);
    await Promise.all(
      stored.map((_, index) => file(join(found, `${index}.png`))),
    );
    chooseFile.mockResolvedValue(join(found, '0.png'));
    await relinker.relink(A, signal);
    expect(committed(replace)).toHaveLength(MEDIA_LIMITS.importBatch);
  });

  it('changes nothing when the dialog is cancelled or the relink was aborted', async () => {
    const {folder, relinker, replace, chooseFile, recheck} = await setup([
      {id: A, file: 'D:\\gone\\a.png'},
    ]);
    expect(await relinker.relink(A, signal)).toEqual({ok: true, value: null});
    chooseFile.mockResolvedValue(await file(join(folder, 'a.png')));
    const aborted = new AbortController();
    aborted.abort();
    expect(await relinker.relink(A, aborted.signal)).toEqual({
      ok: true,
      value: null,
    });
    expect(replace).not.toHaveBeenCalled();
    expect(recheck).not.toHaveBeenCalled();
  });

  it('refuses media that no longer exists and a chosen file it cannot read', async () => {
    const {folder, relinker, replace, chooseFile, log} = await setup([
      {id: A, file: 'D:\\gone\\a.png'},
    ]);
    expect(await relinker.relink(mediaId(9), signal)).toMatchObject({
      ok: false,
      error: {reason: 'not-found'},
    });
    expect(chooseFile).not.toHaveBeenCalled();
    chooseFile.mockResolvedValue(join(folder, 'never-written.png'));
    expect(await relinker.relink(A, signal)).toMatchObject({
      ok: false,
      error: {reason: 'not-found'},
    });
    expect(log.messages('warn')).toEqual([
      'could not read a relinked media file',
    ]);
    expect(replace).not.toHaveBeenCalled();
  });

  it('refuses a second relink while one is open, and passes on a refused commit', async () => {
    const {folder, relinker, replace, chooseFile, recheck} = await setup([
      {id: A, file: 'D:\\gone\\a.png'},
    ]);
    const chosen = await file(join(folder, 'a.png'));
    let choose: (file: string | null) => void = () => undefined;
    chooseFile.mockReturnValueOnce(
      new Promise(resolve => {
        choose = resolve;
      }),
    );
    replace.mockResolvedValueOnce({
      ok: false,
      error: {reason: 'stale', message: 'The media list changed'},
    });
    const first = relinker.relink(A, signal);
    expect(await relinker.relink(A, signal)).toMatchObject({
      ok: false,
      error: {reason: 'invalid'},
    });
    choose(chosen);
    expect(await first).toMatchObject({ok: false, error: {reason: 'stale'}});
    expect(recheck).not.toHaveBeenCalled();
    chooseFile.mockResolvedValue(chosen);
    expect(await relinker.relink(A, signal)).toMatchObject({ok: true});
  });
});
