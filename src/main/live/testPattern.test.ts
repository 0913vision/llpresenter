import {describe, expect, it, vi} from 'vitest';
import {LIVE_STATE_LIMITS} from '@shared/schema/liveLimits';
import {parseLiveCommand} from '@shared/schema/liveCommand';
import {LiveStore} from './store';
import {
  CAPTIONS,
  MAIN,
  overlaySettings,
  overlayUuid,
  settingsDocument,
} from './testing/overlays';

function setup() {
  const store = new LiveStore();
  const settings = overlaySettings();
  store.connectSettings(settings.reader);
  const skipped = vi.fn();
  const set = (screenId: string, on: boolean): boolean => {
    const command = parseLiveCommand({
      type: 'screen.testPattern.set',
      screenId,
      on,
    });
    if (!command.ok) throw new Error(JSON.stringify(command.error));
    return store.dispatch(command.value, undefined, skipped);
  };
  return {store, settings, skipped, set};
}

describe('screen.testPattern.set', () => {
  it('shows the pattern per screen and drops the field once none shows it', () => {
    const {store, set} = setup();
    expect(set(MAIN, true)).toBe(true);
    expect(set(CAPTIONS, true)).toBe(true);
    expect(store.state.testPatterns).toEqual([MAIN, CAPTIONS]);
    const version = store.state.version;
    expect(set(MAIN, true)).toBe(false);
    expect(store.state.version).toBe(version);
    set(MAIN, false);
    expect(store.state.testPatterns).toEqual([CAPTIONS]);
    set(CAPTIONS, false);
    expect(store.state).not.toHaveProperty('testPatterns');
    expect(set(CAPTIONS, false)).toBe(false);
  });

  it('shows it only on a saved screen and still hides one that is gone', () => {
    const {store, settings, skipped, set} = setup();
    set(overlayUuid(90), true);
    expect(skipped).toHaveBeenCalledWith(
      expect.objectContaining({reason: 'missing-target'}),
    );
    set(MAIN, true);
    settings.update(settingsDocument('screens', {screens: []}));
    set(MAIN, false);
    expect(store.state).not.toHaveProperty('testPatterns');
  });

  it('survives clears and their undo', () => {
    const {store, set} = setup();
    set(MAIN, true);
    store.dispatch({type: 'layer.clear', target: 'all'});
    store.dispatch({type: 'clear.undo'});
    expect(store.state.testPatterns).toEqual([MAIN]);
  });

  it('refuses a screen past the live state cap', () => {
    const {store, settings, skipped, set} = setup();
    const screens = Array.from(
      {length: LIVE_STATE_LIMITS.outputs + 1},
      (_, index) => ({
        id: overlayUuid(1000 + index),
        name: `Screen ${index}`,
        kind: 'audience',
        method: 'window',
      }),
    );
    settings.update(settingsDocument('screens', {screens}));
    for (const {id} of screens) set(id, true);
    expect(store.state.testPatterns).toHaveLength(LIVE_STATE_LIMITS.outputs);
    expect(skipped).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({reason: 'failed'}),
    );
  });
});
