import {describe, expect, it} from 'vitest';
import {monitorsOf} from '../displays/testing';
import {MAIN_SCREEN_ID, createDefaultScreenSource} from './defaultScreens';

describe('createDefaultScreenSource', () => {
  it('puts the 본 화면 on the first monitor that is not the primary one', () => {
    const monitors = monitorsOf(
      {id: 5, x: -1920, name: 'Left'},
      {id: 1, primary: true},
      {id: 9, x: 1920},
    );
    const [main] = createDefaultScreenSource(monitors).list();
    expect(main).toMatchObject({
      id: MAIN_SCREEN_ID,
      method: 'fullscreen',
      display: {id: 5, name: 'Left', bounds: {x: -1920, y: 0}},
      onDisconnect: 'window',
      alwaysOnTop: true,
    });
  });

  it('leaves the 본 화면 unassigned with only the primary monitor', () => {
    const [main] = createDefaultScreenSource(
      monitorsOf({id: 1, primary: true}),
    ).list();
    expect(main?.display).toBeNull();
  });
});
