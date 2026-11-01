import {describe, expect, it, vi} from 'vitest';
import type {SettingsReader} from '@core/schema/settingsReader';
import {defaultPreferences} from '@core/schema/preferences';
import type {Screen} from '@core/schema/screens';
import {createScreenId} from '@core/schema/ids';
import {recordingLogger} from '@fixtures/main/displays/testing';
import {dispatchBatched, type LiveStore} from '@main/live/store';
import {launchOutputCommands, showOutputsOnLaunch} from '@main/outputs/launch';
import {switchableScreens} from '@main/outputs/savedScreens';

vi.mock('@main/outputs/savedScreens', () => ({switchableScreens: vi.fn()}));
vi.mock('@main/live/store', async importOriginal => ({
  ...(await importOriginal<typeof import('@main/live/store')>()),
  dispatchBatched: vi.fn(() => true),
}));

const MAIN = createScreenId('00000000-0000-4000-8000-000000000001');
const STAGE = createScreenId('00000000-0000-4000-8000-000000000003');
const screens: Screen[] = [
  {id: MAIN, name: 'Main', kind: 'audience', method: 'fullscreen'},
  {id: STAGE, name: 'Stage', kind: 'stage', method: 'window'},
];

function settings(showOnLaunch: boolean): SettingsReader {
  return {
    get: vi.fn(),
    preferences: () => ({...defaultPreferences, showOnLaunch}),
    subscribe: () => () => undefined,
  };
}

const store: Pick<LiveStore, 'handles' | 'dispatch'> = {
  handles: vi.fn(() => true),
  dispatch: vi.fn(() => true),
};

describe('켤 때 화면 출력', () => {
  it('turns nothing on while the preference is off', () => {
    vi.mocked(switchableScreens).mockReturnValue(screens);
    expect(launchOutputCommands(settings(false))).toEqual([]);
  });

  it('turns on every screen that can switch its output', () => {
    vi.mocked(switchableScreens).mockReturnValue(screens);
    expect(launchOutputCommands(settings(true))).toEqual(
      [MAIN, STAGE].map(screenId => ({type: 'output.set', screenId, on: true})),
    );
  });

  it('applies the outputs in one batch once the settings are read', async () => {
    vi.mocked(switchableScreens).mockReturnValue(screens);
    const log = recordingLogger();

    await showOutputsOnLaunch({
      store,
      settings: Promise.resolve(settings(true)),
      log,
    });

    expect(dispatchBatched).toHaveBeenLastCalledWith(
      store,
      launchOutputCommands(settings(true)),
      log,
    );
    expect(log.entries).toEqual([]);
  });

  it('does nothing without settings and logs settings that fail', async () => {
    vi.mocked(dispatchBatched).mockClear();
    const log = recordingLogger();
    await showOutputsOnLaunch({store, settings: Promise.resolve(null), log});
    await showOutputsOnLaunch({
      store,
      settings: Promise.reject(new Error('unreadable')),
      log,
    });

    expect(dispatchBatched).not.toHaveBeenCalled();
    expect(log.messages('error')).toEqual([
      'could not turn the outputs on at launch',
    ]);
  });
});
