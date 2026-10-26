import {describe, expect, it, onTestFinished, vi} from 'vitest';
import {createMediaId, type MediaId} from '@shared/schema/ids';
import {parseMediaDocument, type MediaDocument} from '@shared/schema/mediaEdit';
import type {MissingMedia} from '@shared/schema/mediaFiles';
import {expectSuccess} from '@shared/schema/testHelpers';
import {EMPTY_MEDIA_LIST} from '../store/defaults';
import {
  MAX_PARALLEL_FILE_CHECKS,
  MissingFiles,
  type MissingFilesSource,
} from './missingFiles';

const mediaId = (index: number): MediaId =>
  createMediaId(`00000000-0000-4000-8000-${String(index).padStart(12, '0')}`);

function mediaDocument(ids: readonly MediaId[]): MediaDocument {
  return expectSuccess(
    parseMediaDocument({
      name: 'media',
      revision: 1,
      access: 'editable',
      value: {
        ...EMPTY_MEDIA_LIST,
        items: ids.map(id => ({
          id,
          name: `Invented ${id.slice(-2)}`,
          kind: 'image',
          file: `${id}.png`,
          size: 1,
        })),
      },
    }),
  );
}

// NOTE(0913vision): A file is an absolute path, or null for a path the library
// refuses.
function fakeSource(files: ReadonlyMap<MediaId, string | null>) {
  const state = {files, document: mediaDocument([...files.keys()])};
  const listeners = new Set<(document: MediaDocument) => void>();
  const source: MissingFilesSource = {
    get: () => state.document,
    fileOf: id => {
      for (const [key, file] of state.files) if (key === id) return file;
      return null;
    },
    subscribe: listener => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
  const change = (next: ReadonlyMap<MediaId, string | null>): void => {
    state.files = next;
    state.document = mediaDocument([...next.keys()]);
    for (const listener of listeners) listener(state.document);
  };
  return {source, change, listeners};
}

function setup(
  files: ReadonlyMap<MediaId, string | null>,
  exists: (file: string) => Promise<boolean>,
) {
  const {source, change, listeners} = fakeSource(files);
  const pushed = vi.fn<(missing: MissingMedia) => void>();
  const exist = vi.fn(exists);
  const missing = new MissingFiles({
    source,
    onChange: pushed,
    exists: exist,
    publishDelayMs: 5,
  });
  onTestFinished(() => {
    missing.dispose();
  });
  return {missing, pushed, exist, change, listeners};
}

function deferred() {
  let resolve: (value: boolean) => void = () => undefined;
  const promise = new Promise<boolean>(settle => {
    resolve = settle;
  });
  return {promise, resolve};
}

const A = mediaId(1);
const B = mediaId(2);
const C = mediaId(3);

describe('missing media files', () => {
  it('checks every file at start and pushes the missing ones once, in list order', async () => {
    const present = new Set(['D:\\media\\a.png']);
    const {missing, pushed} = setup(
      new Map([
        [A, 'D:\\media\\a.png'],
        [B, 'D:\\media\\b.png'],
        [C, null],
      ]),
      file => Promise.resolve(present.has(file)),
    );
    missing.start();
    await vi.waitFor(() => expect(pushed).toHaveBeenCalled());
    expect(pushed).toHaveBeenCalledExactlyOnceWith([B, C]);
    expect(missing.list()).toEqual([B, C]);
    expect(missing.isMissing(A)).toBe(false);
    expect(missing.isMissing(B)).toBe(true);
  });

  it('checks only an item whose file changed, forgets a removed one, and pushes only a change', async () => {
    const present = new Set(['D:\\media\\a.png', 'D:\\media\\b.png']);
    const {missing, pushed, exist, change} = setup(
      new Map([
        [A, 'D:\\media\\a.png'],
        [B, 'D:\\media\\b.png'],
      ]),
      file => Promise.resolve(present.has(file)),
    );
    missing.start();
    await vi.waitFor(() => expect(exist).toHaveBeenCalledTimes(2));
    change(
      new Map([
        [A, 'D:\\moved\\a.png'],
        [C, 'D:\\media\\c.png'],
      ]),
    );
    await vi.waitFor(() => expect(pushed).toHaveBeenCalled());
    expect(exist.mock.calls.slice(2).map(([file]) => file)).toEqual([
      'D:\\moved\\a.png',
      'D:\\media\\c.png',
    ]);
    expect(pushed).toHaveBeenCalledExactlyOnceWith([A, C]);
    change(
      new Map([
        [A, 'D:\\moved\\a.png'],
        [C, 'D:\\media\\c.png'],
      ]),
    );
    await new Promise(resolve => setTimeout(resolve, 20));
    expect(exist).toHaveBeenCalledTimes(4);
    expect(pushed).toHaveBeenCalledOnce();
  });

  it('checks one file again on request and ignores an unknown id', async () => {
    const present = new Set<string>();
    const {missing, pushed, exist} = setup(
      new Map([[A, 'D:\\media\\a.png']]),
      file => Promise.resolve(present.has(file)),
    );
    missing.start();
    await vi.waitFor(() => expect(pushed).toHaveBeenCalledWith([A]));
    present.add('D:\\media\\a.png');
    missing.check(A);
    missing.check(B);
    await vi.waitFor(() => expect(pushed).toHaveBeenLastCalledWith([]));
    expect(exist).toHaveBeenCalledTimes(2);
  });

  it('counts only the newest check of an item', async () => {
    const first = deferred();
    const second = deferred();
    const answers = [first.promise, second.promise];
    const {missing, pushed} = setup(
      new Map([[A, 'D:\\media\\a.png']]),
      () => answers.shift() ?? Promise.resolve(true),
    );
    missing.start();
    missing.check(A);
    second.resolve(false);
    await vi.waitFor(() => expect(pushed).toHaveBeenCalledWith([A]));
    first.resolve(true);
    await new Promise(resolve => setTimeout(resolve, 20));
    expect(missing.list()).toEqual([A]);
    expect(pushed).toHaveBeenCalledOnce();
  });

  it('reads at most the parallel cap of files at once', async () => {
    const ids = Array.from({length: 20}, (_, index) => mediaId(index + 1));
    const waiting: Array<(value: boolean) => void> = [];
    const {missing, pushed} = setup(
      new Map(ids.map(id => [id, `D:\\media\\${id}.png`])),
      () =>
        new Promise<boolean>(resolve => {
          waiting.push(resolve);
        }),
    );
    missing.start();
    expect(waiting).toHaveLength(MAX_PARALLEL_FILE_CHECKS);
    let answered = 0;
    while (answered < ids.length) {
      const next = waiting.shift();
      if (next === undefined) {
        await new Promise(resolve => setImmediate(resolve));
        continue;
      }
      next(false);
      answered++;
      expect(waiting.length).toBeLessThan(MAX_PARALLEL_FILE_CHECKS);
    }
    await vi.waitFor(() => expect(pushed).toHaveBeenCalledWith(ids));
  });

  it('drops removed items from the queue while every worker is busy', async () => {
    const base = Array.from({length: MAX_PARALLEL_FILE_CHECKS}, (_, index) =>
      mediaId(index + 1),
    );
    const files = new Map(base.map(id => [id, `D:/media/${id}.png`]));
    const waiting: Array<(value: boolean) => void> = [];
    const {missing, exist, change} = setup(
      files,
      () =>
        new Promise<boolean>(resolve => {
          waiting.push(resolve);
        }),
    );
    missing.start();
    expect(waiting).toHaveLength(MAX_PARALLEL_FILE_CHECKS);
    for (let round = 0; round < 50; round++) {
      const added = mediaId(100 + round);
      change(new Map([...files, [added, `D:/media/${added}.png`]]));
      change(files);
    }
    expect(missing.waitingChecks).toBe(0);
    for (const resolve of waiting.splice(0)) resolve(true);
    await new Promise(resolve => setTimeout(resolve, 20));
    expect(exist).toHaveBeenCalledTimes(MAX_PARALLEL_FILE_CHECKS);
  });

  it('stops following the list and pushing on dispose', async () => {
    const check = deferred();
    const {missing, pushed, listeners} = setup(
      new Map([[A, 'D:\\media\\a.png']]),
      () => check.promise,
    );
    missing.start();
    expect(listeners.size).toBe(1);
    missing.dispose();
    check.resolve(false);
    await new Promise(resolve => setTimeout(resolve, 20));
    expect(listeners.size).toBe(0);
    expect(pushed).not.toHaveBeenCalled();
    missing.start();
    expect(listeners.size).toBe(0);
  });
});
