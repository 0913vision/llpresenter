import {describe, expect, it} from 'vitest';
import type {Monitor} from '@main/displays/monitor';
import {monitorsOf} from '@fixtures/main/displays/testing';
import {
  MAIN_SCREEN_ID,
  createDefaultScreenSource,
} from '@main/outputs/defaultScreens';

function feed(monitors: readonly Monitor[]): {monitors: readonly Monitor[]} {
  return {monitors};
}

describe('createDefaultScreenSource', () => {
  it('excludes the actual control monitor even when it is not primary', () => {
    const displays = feed(monitorsOf({id: 1, primary: true}, {id: 2, x: 1920}));
    const source = createDefaultScreenSource(displays, () => ({
      x: 1920,
      y: 0,
      width: 1920,
      height: 1080,
    }));
    expect(source.list()[0]?.display?.id).toBe(1);
  });
  it('puts the 청중 화면 on the first monitor that is not the primary one', () => {
    const monitors = monitorsOf(
      {id: 5, x: -1920, name: 'Left'},
      {id: 1, primary: true},
      {id: 9, x: 1920},
    );
    const [main] = createDefaultScreenSource(feed(monitors)).list();
    expect(main).toMatchObject({
      id: MAIN_SCREEN_ID,
      method: 'fullscreen',
      display: {id: 5, name: 'Left', bounds: {x: -1920, y: 0}},
      onDisconnect: 'window',
      alwaysOnTop: false,
    });
  });

  it('leaves the 청중 화면 unassigned with only the primary monitor', () => {
    const [main] = createDefaultScreenSource(
      feed(monitorsOf({id: 1, primary: true})),
    ).list();
    expect(main?.display).toBeNull();
  });

  it('chooses the monitor at the first successful read and keeps it', () => {
    const displays = feed([]);
    const source = createDefaultScreenSource(displays);
    expect(source.list()[0]?.display).toBeNull();

    displays.monitors = monitorsOf({id: 1, primary: true}, {id: 2, x: 1920});
    expect(source.list()[0]?.display?.id).toBe(2);

    displays.monitors = monitorsOf({id: 1, primary: true}, {id: 3, x: 1920});
    expect(source.list()[0]?.display?.id).toBe(2);
  });
});
