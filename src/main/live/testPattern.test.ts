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
    const start = store.state.version;
    expect(set(MAIN, true)).toBe(true);
    expect(store.state.version).toBe(start + 1);
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
    const slide = {itemId: 'item-1', position: 0, label: null, lines: ['줄']};
    store.dispatch({type: 'slide.show', slide});
    set(MAIN, true);
    store.dispatch({type: 'layer.clear', target: 'all'});
    expect(store.state.layers.slide).toBeNull();
    expect(store.state.testPatterns).toEqual([MAIN]);
    store.dispatch({type: 'clear.undo'});
    expect(store.state.layers.slide).toEqual(slide);
    expect(store.state.testPatterns).toEqual([MAIN]);
  });

  it('hides the pattern of a screen whose output turns off, and only then', () => {
    const {store, set} = setup();
    const output = (screenId: string, on: boolean) => {
      const command = parseLiveCommand({type: 'output.set', screenId, on});
      if (!command.ok) throw new Error(JSON.stringify(command.error));
      store.dispatch(command.value);
    };
    set(MAIN, true);
    set(CAPTIONS, true);
    output(MAIN, false);
    expect(store.state.testPatterns).toEqual([MAIN, CAPTIONS]);
    output(MAIN, true);
    expect(store.state.testPatterns).toEqual([MAIN, CAPTIONS]);
    output(MAIN, false);
    expect(store.state.testPatterns).toEqual([CAPTIONS]);
    output(CAPTIONS, true);
    output(CAPTIONS, false);
    expect(store.state).not.toHaveProperty('testPatterns');
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
