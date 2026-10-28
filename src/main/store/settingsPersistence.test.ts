import {expect, it, vi} from 'vitest';
import {recordingLogger} from '../displays/testing';
import type {DocumentFiles} from './contentPersistence';
import type {WriteResult} from './fileWriter';
import {SettingsPersistence} from './settingsPersistence';

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
