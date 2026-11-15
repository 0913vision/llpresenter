import {writeFile} from 'node:fs/promises';
import {join} from 'node:path';
import {describe, expect, it, vi} from 'vitest';
import {createScreenId} from '@core/schema/ids';
import {emptyLiveState} from '@core/live/state';
import type {SettingsReader} from '@core/schema/settingsReader';
import {defaultPreferences} from '@core/schema/preferences';
import {makeTempDir} from '@fixtures/tempDir';
import {recordingLogger} from '@fixtures/main/displays/testing';
import {dispatchBatched} from '@main/live/store';
import {switchableScreens} from '@main/outputs/savedScreens';
import {
  cancelRestartOutputs,
  restoreRestartOutputs,
  saveRestartOutputs,
} from '@main/update/restartOutputs';

vi.mock('@main/outputs/savedScreens', () => ({switchableScreens: vi.fn()}));
vi.mock('@main/live/store', () => ({dispatchBatched: vi.fn(() => true)}));

const main = createScreenId('00000000-0000-4000-8000-000000000001');
const stage = createScreenId('00000000-0000-4000-8000-000000000003');
const store = {handles: vi.fn(() => true), dispatch: vi.fn(() => true)};
const log = recordingLogger();
const settings: SettingsReader = {
  get: vi.fn(),
  preferences: () => defaultPreferences,
  subscribe: () => () => undefined,
};
const screens = [
  {
    id: main,
    name: 'Main',
    kind: 'audience' as const,
    method: 'fullscreen' as const,
  },
  {
    id: stage,
    name: 'Stage',
    kind: 'stage' as const,
    method: 'fullscreen' as const,
  },
];

describe('update restart outputs', () => {
  it('restores precisely the saved screens once, including outputs that were off', async () => {
    const folder = await makeTempDir();
    vi.mocked(switchableScreens).mockReturnValue(screens);
    expect(
      await saveRestartOutputs({
        folder,
        version: '1.2.3',
        state: {...emptyLiveState(), outputs: {[main]: true, [stage]: false}},
        log,
      }),
    ).toBe(true);
    const options = {
      folder,
      crashed: false,
      version: '1.2.3',
      settings: Promise.resolve(settings),
      store,
      log,
    };
    expect(await restoreRestartOutputs(options)).toBe(true);
    expect(dispatchBatched).toHaveBeenLastCalledWith(
      store,
      [
        {type: 'output.set', screenId: main, on: true},
        {type: 'output.set', screenId: stage, on: false},
      ],
      log,
    );
    expect(await restoreRestartOutputs(options)).toBe(false);
  });
  it('does not restore abandoned, corrupt or crash restart records', async () => {
    const folder = await makeTempDir();
    const options = {
      folder,
      crashed: false,
      version: '1.2.3',
      settings: Promise.resolve(settings),
      store,
      log,
    };
    await saveRestartOutputs({
      folder,
      version: '1.2.3',
      state: {...emptyLiveState(), outputs: {[main]: true}},
      log,
    });
    await cancelRestartOutputs(folder);
    expect(await restoreRestartOutputs(options)).toBe(false);
    await saveRestartOutputs({
      folder,
      version: '1.2.3',
      state: {...emptyLiveState(), outputs: {[main]: true}},
      log,
    });
    expect(await restoreRestartOutputs({...options, version: '1.2.2'})).toBe(
      false,
    );
    await writeFile(join(folder, 'update-restart.json'), '{invalid');
    expect(await restoreRestartOutputs(options)).toBe(false);
    await saveRestartOutputs({
      folder,
      version: '1.2.3',
      state: {...emptyLiveState(), outputs: {[main]: true}},
      log,
    });
    expect(await restoreRestartOutputs({...options, crashed: true})).toBe(
      false,
    );
    expect(await restoreRestartOutputs(options)).toBe(false);
  });
  it('restores no outputs when none were on', async () => {
    const folder = await makeTempDir();
    vi.mocked(switchableScreens).mockReturnValue(screens);
    await saveRestartOutputs({
      folder,
      version: '1.2.3',
      state: emptyLiveState(),
      log,
    });
    expect(
      await restoreRestartOutputs({
        folder,
        version: '1.2.3',
        crashed: false,
        settings: Promise.resolve(settings),
        store,
        log,
      }),
    ).toBe(true);
    expect(dispatchBatched).toHaveBeenLastCalledWith(
      store,
      [
        {type: 'output.set', screenId: main, on: false},
        {type: 'output.set', screenId: stage, on: false},
      ],
      log,
    );
  });
});
