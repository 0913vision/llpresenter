import type {SettingsReader} from '@core/schema/settingsReader';
import {describe, expect, it, vi} from 'vitest';
import {defaultPreferences} from '@core/schema/preferences';
import {recordingLogger} from '../displays/testing';
import {LiveStore} from '../live/store';
import {
  CAPTIONS,
  MAIN,
  overlaySettings,
  overlayUuid,
  settingsDocument,
  STAGE,
} from '@core/testing/overlays';
import {launchOutputCommands, showOutputsOnLaunch} from './launch';

const NDI_SCREEN = overlayUuid(40);

function settings(showOnLaunch: boolean): SettingsReader {
  const fixture = overlaySettings();
  fixture.update(
    settingsDocument('screens', {
      screens: [
        {id: MAIN, name: 'Main', kind: 'audience', method: 'fullscreen'},
        {id: CAPTIONS, name: 'Captions', kind: 'audience', method: 'capture'},
        {id: STAGE, name: 'Stage', kind: 'stage', method: 'window'},
        {id: NDI_SCREEN, name: 'Stream', kind: 'audience', method: 'ndi'},
      ],
    }),
  );
  return {
    ...fixture.reader,
    preferences: () => ({...defaultPreferences, showOnLaunch}),
  };
}

describe('켤 때 화면 출력', () => {
  it('turns nothing on while the preference is off', () => {
    expect(launchOutputCommands(settings(false))).toEqual([]);
  });

  it('turns on every screen that can show output', () => {
    expect(launchOutputCommands(settings(true))).toEqual(
      [MAIN, CAPTIONS, STAGE].map(screenId => ({
        type: 'output.set',
        screenId,
        on: true,
      })),
    );
  });

  it('applies the outputs in one broadcast once the settings are read', async () => {
    const reader = settings(true);
    const store = new LiveStore();
    store.connectSettings(reader);
    const listener = vi.fn();
    store.subscribe(listener);
    const log = recordingLogger();
    await showOutputsOnLaunch({store, settings: Promise.resolve(reader), log});
    expect(listener).toHaveBeenCalledOnce();
    expect(store.state.outputs).toMatchObject({
      [MAIN]: true,
      [CAPTIONS]: true,
      [STAGE]: true,
    });
    expect(store.state.outputs).not.toHaveProperty(NDI_SCREEN);
    expect(log.entries).toEqual([]);
  });

  it('does nothing without settings and logs settings that fail', async () => {
    const store = new LiveStore();
    const listener = vi.fn();
    store.subscribe(listener);
    const log = recordingLogger();
    await showOutputsOnLaunch({store, settings: Promise.resolve(null), log});
    await showOutputsOnLaunch({
      store,
      settings: Promise.reject(new Error('unreadable')),
      log,
    });
    expect(listener).not.toHaveBeenCalled();
    expect(log.messages('error')).toEqual([
      'could not turn the outputs on at launch',
    ]);
  });
});
