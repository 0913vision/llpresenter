import {describe, expect, it, vi} from 'vitest';
import type {SettingsDocument} from '@shared/schema/settingsDocuments';
import {fakeLlpApi} from '@shared/testing/fakeLlpApi';
import {
  CAPTIONS,
  MAIN,
  overlaySettings,
  settingsDocument,
  STAGE,
} from '../../../main/live/testing/overlays';
import {followRenderScreen, resolveRenderScreen} from './screenIdentity';

function screens() {
  const document = overlaySettings().reader.get('screens');
  if (document.name !== 'screens') throw new Error('Missing screen fixtures');
  return document;
}

describe('output screen identity', () => {
  it('resolves exact configured ids and the legacy output aliases without guessing unknown ids', () => {
    const {value} = screens();
    expect(resolveRenderScreen(MAIN, value.screens)).toEqual({
      id: MAIN,
      kind: 'audience',
      method: 'fullscreen',
    });
    expect(resolveRenderScreen('main', value.screens)?.id).toBe(MAIN);
    expect(resolveRenderScreen('captions', value.screens)?.id).toBe(CAPTIONS);
    expect(resolveRenderScreen('broadcast', value.screens)?.id).toBe(CAPTIONS);
    expect(resolveRenderScreen('stage', value.screens)).toEqual({
      id: STAGE,
      kind: 'stage',
      method: 'fullscreen',
    });
    expect(resolveRenderScreen('unknown', value.screens)).toBeUndefined();
  });

  it('keeps a changed document newer than a pending read and releases its listener', async () => {
    let resolve: (document: SettingsDocument) => void = () => undefined;
    let changed: (document: SettingsDocument) => void = () => undefined;
    const unsubscribe = vi.fn();
    const receive = vi.fn();
    const settings = fakeLlpApi({
      settings: {
        get: () =>
          new Promise(done => {
            resolve = done;
          }),
        subscribe: listener => {
          changed = listener;
          return unsubscribe;
        },
      },
    }).settings;
    const stop = followRenderScreen({
      settings,
      id: 'main',
      receive,
      onError: vi.fn(),
    });
    changed(settingsDocument('screens', {screens: []}, 2));
    resolve(screens());
    await Promise.resolve();
    expect(receive).toHaveBeenCalledExactlyOnceWith(undefined);
    stop();
    changed(settingsDocument('screens', {screens: screens().value.screens}, 3));
    expect(receive).toHaveBeenCalledTimes(1);
    expect(unsubscribe).toHaveBeenCalledTimes(1);
  });

  it('logs a failed read and ignores a read that resolves after disposal', async () => {
    const onError = vi.fn();
    const stop = followRenderScreen({
      settings: fakeLlpApi().settings,
      id: 'main',
      receive: vi.fn(),
      onError,
    });
    await Promise.resolve();
    await Promise.resolve();
    expect(onError).toHaveBeenCalledTimes(1);
    stop();
    const receive = vi.fn();
    const stopEarly = followRenderScreen({
      settings: fakeLlpApi({settings: {get: () => Promise.resolve(screens())}})
        .settings,
      id: 'main',
      receive,
      onError,
    });
    stopEarly();
    await Promise.resolve();
    expect(receive).not.toHaveBeenCalled();
  });
});
