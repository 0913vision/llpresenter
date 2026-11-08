import {
  loaded,
  main,
  mocks,
  projector,
  setup,
  STAGE_SCREEN,
} from '@fixtures/main/outputs/startFixtures';
import type {SettingsReader} from '@core/schema/settingsReader';
import {MAIN, CAPTIONS} from '@fixtures/core/overlays';
import {describe, expect, it} from 'vitest';

describe('output windows at launch', () => {
  it.each(['normal', 'offscreen'] as const)(
    'prepares every saved output while switches remain off in %s mode',
    async mode => {
      const {save, store, windows} = setup(undefined, mode);
      save([
        main,
        {...main, id: CAPTIONS, kind: 'broadcast', method: 'capture'},
        {...main, id: STAGE_SCREEN, kind: 'stage', method: 'window'},
      ]);
      await loaded();

      expect(windows.created.map(window => window.screen.id)).toEqual([
        MAIN,
        CAPTIONS,
        STAGE_SCREEN,
      ]);
      expect(store.state.outputs).toEqual({});
      expect(mocks.start).not.toHaveBeenCalled();
      for (const window of windows.created) {
        expect(window.mode).toEqual({kind: 'hidden'});
        expect(window.placements).toEqual([]);
        expect(window.prepared).not.toBeNull();
      }
      const audience = windows.only(MAIN);
      expect(audience.prepared).toEqual(projector.bounds);

      for (let turn = 0; turn < 2; turn += 1) {
        store.dispatch({type: 'output.set', screenId: MAIN, on: true});
        expect(windows.only(MAIN)).toBe(audience);
        expect(audience.mode.kind).toBe('fullscreen');
        expect(windows.created).toHaveLength(3);
        store.dispatch({type: 'output.set', screenId: MAIN, on: false});
        expect(audience.mode.kind).toBe('hidden');
      }
      expect(windows.only(CAPTIONS).placements).toEqual([]);
      expect(windows.only(STAGE_SCREEN).placements).toEqual([]);
    },
  );

  it('prepares late settings without a turn-on and excludes NDI screens', async () => {
    let resolve: (reader: SettingsReader) => void = () => undefined;
    const loading = new Promise<SettingsReader>(done => {
      resolve = done;
    });
    const {settings, save, store, windows} = setup(loading);
    save([main, {...main, id: CAPTIONS, method: 'ndi'}]);
    await loaded();
    expect(windows.created).toHaveLength(0);

    resolve(settings.reader);
    await loaded();
    expect(windows.created).toHaveLength(1);
    expect(windows.only(MAIN).prepared).toEqual(projector.bounds);
    expect(windows.only(MAIN).placements).toEqual([]);
    expect(store.state.outputs).toEqual({});
    expect(mocks.start).not.toHaveBeenCalled();
  });
});
