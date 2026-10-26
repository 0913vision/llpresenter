import {describe, expect, it, vi} from 'vitest';
import {recordingLogger} from '../displays/testing';
import {ContentPersistence, type DocumentFiles} from './contentPersistence';
import type {WriteResult} from './fileWriter';
import {MAX_WAITING_SAVES, type WaitingSave} from './saveFailures';

const FILE = 'D:\\data\\songs\\a.llsong';
const failed: WriteResult = {ok: false, error: {file: FILE, message: 'Full'}};
const written: WriteResult = {ok: true, value: undefined};

function request(text: string, file = FILE) {
  return {target: {file, kind: 'song', id: 'a'}, text};
}

function setup(nameOf?: (file: string) => string) {
  const waiting: WaitingSave[] = [];
  const saved = vi.fn<(file: string) => void>();
  const remind = vi.fn<() => void>();
  const write = vi.fn<DocumentFiles['write']>(() => Promise.resolve(failed));
  const remove = vi.fn<DocumentFiles['remove']>(() => Promise.resolve(written));
  const files: DocumentFiles = {
    write,
    remove,
    failures: {
      waiting: save => {
        waiting.push(save);
      },
      saved,
      remind,
    },
  };
  const persistence = new ContentPersistence(files, recordingLogger(), nameOf);
  return {persistence, waiting, saved, remind, write, remove};
}

describe('content persistence failures', () => {
  it('reports a failed file by its name and the retry writes the newest text', async () => {
    const {persistence, waiting, saved, write} = setup();
    await persistence.write(request('first'));
    await persistence.write(request('second'));
    expect(waiting.map(({file, name}) => [file, name])).toEqual([
      [FILE, 'a.llsong'],
      [FILE, 'a.llsong'],
    ]);
    write.mockResolvedValue(written);
    await waiting[0]?.retry();
    expect(write).toHaveBeenLastCalledWith(request('second'));
    expect(saved).toHaveBeenCalledExactlyOnceWith(FILE);
    await waiting[0]?.retry();
    expect(write).toHaveBeenCalledTimes(3);
  });

  it('names a failed file with the store name', async () => {
    const {persistence, waiting} = setup(() => 'Invented hymn');
    await persistence.write(request('text'));
    expect(waiting[0]?.name).toBe('Invented hymn');
  });

  it('leaves a superseded failure to the newer write', async () => {
    const {persistence, waiting, saved, write} = setup();
    let finish: (result: WriteResult) => void = () => undefined;
    write.mockImplementationOnce(
      () =>
        new Promise(resolve => {
          finish = resolve;
        }),
    );
    write.mockResolvedValueOnce(written);
    const older = persistence.write(request('older'));
    await persistence.write(request('newer'));
    finish(failed);
    await older;
    expect(waiting).toEqual([]);
    expect(saved).toHaveBeenCalledExactlyOnceWith(FILE);
  });

  it('retries only a delete that superseded a waiting write of the same file', async () => {
    const {persistence, waiting, saved, write, remove} = setup();
    await persistence.write(request('created'));
    remove.mockResolvedValueOnce(failed);
    await persistence.remove({file: FILE, kind: 'song', id: 'a'});
    expect(new Set(waiting.map(({file}) => file))).toEqual(new Set([FILE]));
    await waiting[0]?.retry();
    expect(write).toHaveBeenCalledOnce();
    expect(remove).toHaveBeenCalledTimes(2);
    expect(saved).toHaveBeenCalledExactlyOnceWith(FILE);
    expect(persistence.admits(['new.llsong'])).toBe(true);
  });

  it('admits only files that wait already once the cap of files wait', async () => {
    const {persistence, remind, write} = setup();
    const files = Array.from(
      {length: MAX_WAITING_SAVES},
      (_, index) => `D:\\data\\songs\\${index}.llsong`,
    );
    for (const file of files.slice(0, -1)) {
      await persistence.write(request('text', file));
    }
    expect(persistence.admits(['new.llsong'])).toBe(true);
    await persistence.write(request('text', files.at(-1)));
    expect(persistence.admits(['new.llsong'])).toBe(false);
    expect(persistence.admits([files[0] ?? '', 'new.llsong'])).toBe(false);
    expect(persistence.admits(files.slice(0, 2))).toBe(true);
    expect(persistence.admits([])).toBe(true);
    persistence.remind();
    expect(remind).toHaveBeenCalledOnce();
    write.mockResolvedValueOnce(written);
    await persistence.retry(files[0] ?? '');
    expect(persistence.admits(['new.llsong'])).toBe(true);
  });
});
