import {expect, it, vi} from 'vitest';
import {recordingLogger} from '@fixtures/main/displays/testing';
import type {DocumentFiles} from '@main/store/contentPersistence';
import type {WriteResult} from '@main/store/fileWriter';
import {SettingsPersistence} from '@main/store/settingsPersistence';

it('waits for a settings edit accepted while a flush is writing', async () => {
  let release: (result: WriteResult) => void = () => undefined;
  const success: WriteResult = {ok: true, value: undefined};
  const write = vi
    .fn<DocumentFiles['write']>()
    .mockImplementationOnce(
      () =>
        new Promise(resolve => {
          release = resolve;
        }),
    )
    .mockResolvedValue(success);
  const saves = new SettingsPersistence(
    {write, remove: vi.fn()},
    recordingLogger(),
  );
  const target = {file: 'C:\\data\\looks.json', kind: 'settings', id: 'looks'};
  const first = saves.save({target, text: 'first'});
  const flushing = saves.flush();
  expect(write).toHaveBeenCalledOnce();
  const latest = saves.save({target, text: 'latest'});
  release(success);
  await flushing;
  expect(write).toHaveBeenLastCalledWith({target, text: 'latest'});
  expect(await first).toEqual(success);
  expect(await latest).toEqual(success);
  saves.dispose();
});

it('answers every caller with the failure when reporting a failed write throws', async () => {
  const thrown = new Error('Sink is broken');
  const message = thrown.message;
  vi.useFakeTimers();
  const target = {
    file: 'C:/data/themes.json',
    kind: 'settings',
    id: 'themes',
  };
  const write = vi.fn<DocumentFiles['write']>().mockResolvedValue({
    ok: false,
    error: {file: target.file, message: 'Disk is full'},
  });
  const failures = {
    waiting: () => {
      throw thrown;
    },
    saved: vi.fn(),
    remind: vi.fn(),
  };
  const log = recordingLogger();
  const saves = new SettingsPersistence(
    {write, remove: vi.fn(), failures},
    log,
    10,
  );
  const first = saves.save({target, text: 'first'});
  const second = saves.save({target, text: 'second'});
  await vi.advanceTimersByTimeAsync(10);
  const failure = {ok: false, error: {file: target.file, message}};
  expect(await first).toEqual(failure);
  expect(await second).toEqual(failure);
  expect(write).toHaveBeenCalledOnce();
  expect(log.messages('error')).toEqual(['could not save app-wide settings']);
  saves.dispose();
  vi.useRealTimers();
});
