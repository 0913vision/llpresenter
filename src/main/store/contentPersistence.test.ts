import {describe, expect, it, vi} from 'vitest';
import {recordingLogger} from '../displays/testing';
import {ContentPersistence, type DocumentFiles} from './contentPersistence';
import type {WriteResult} from './fileWriter';
import type {WaitingSave} from './saveFailures';

const FILE = 'D:\\data\\songs\\a.llsong';
const failed: WriteResult = {ok: false, error: {file: FILE, message: 'Full'}};
const written: WriteResult = {ok: true, value: undefined};

function request(text: string) {
  return {target: {file: FILE, kind: 'song', id: 'a'}, text};
}

function setup(nameOf?: (file: string) => string) {
  const waiting: WaitingSave[] = [];
  const saved = vi.fn<(file: string) => void>();
  const write = vi.fn<DocumentFiles['write']>(() => Promise.resolve(failed));
  const files: DocumentFiles = {
    write,
    remove: () => Promise.resolve(written),
    failures: {
      waiting: save => {
        waiting.push(save);
      },
      saved,
    },
  };
  const persistence = new ContentPersistence(files, recordingLogger(), nameOf);
  return {persistence, waiting, saved, write};
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
});
