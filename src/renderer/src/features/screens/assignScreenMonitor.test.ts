import {describe, expect, it} from 'vitest';
import {assignScreenMonitor} from './assignScreenMonitor';
import {
  MAIN_ID,
  STAGE_ID,
  screensDocument,
} from '@core/testing/screenDocuments';
import {projector} from './testing/monitors';

function screens() {
  const document = screensDocument();
  if (document.name !== 'screens') throw new Error('Expected screens');
  return document.value.screens;
}

describe('assignScreenMonitor', () => {
  it('saves display identity and releases the previous screen together', () => {
    const result = assignScreenMonitor({
      screens: screens(),
      screenId: STAGE_ID,
      monitor: projector,
    });
    expect(
      result.find(screen => screen.id === MAIN_ID)?.display,
    ).toBeUndefined();
    expect(result.find(screen => screen.id === STAGE_ID)?.display).toEqual({
      id: 2,
      number: 3,
      name: 'Projector',
      bounds: projector.bounds,
      scaleFactor: 1.5,
    });
  });

  it('releases published assignments even when main used a fallback match', () => {
    const source = screens().map(screen =>
      screen.id === MAIN_ID && screen.display !== undefined
        ? {...screen, display: {...screen.display, id: 99}}
        : screen,
    );
    const result = assignScreenMonitor({
      screens: source,
      screenId: STAGE_ID,
      monitor: projector,
    });
    expect(result[0]?.display).toBeUndefined();
    expect(source[0]?.display?.id).toBe(99);
  });

  it('releases saved assignments even while outputs are off', () => {
    const result = assignScreenMonitor({
      screens: screens(),
      screenId: STAGE_ID,
      monitor: {
        ...projector,
        screenIds: [],
      },
    });
    expect(result[0]?.display).toBeUndefined();
  });

  it('changes a window to full screen while preserving its other properties', () => {
    const source = screens().map(screen => ({
      ...screen,
      method: 'window' as const,
    }));
    const result = assignScreenMonitor({
      screens: source,
      screenId: MAIN_ID,
      monitor: projector,
    });
    expect(result[0]).toMatchObject({name: '본 화면', method: 'fullscreen'});
    expect(result[1]).toBe(source[1]);
  });

  it('ignores control monitors, older publishers, and unknown screens', () => {
    const source = screens();
    const {id, ...older} = projector;
    expect(id).toBe(2);
    expect(
      assignScreenMonitor({screens: source, screenId: MAIN_ID, monitor: older}),
    ).toBe(source);
    expect(
      assignScreenMonitor({
        screens: source,
        screenId: MAIN_ID,
        monitor: {...projector, hasMainWindow: true},
      }),
    ).toBe(source);
    expect(
      assignScreenMonitor({
        screens: source,
        screenId: 'unknown',
        monitor: projector,
      }),
    ).toBe(source);
  });

  it('keeps an intervening assignment despite an old published owner', () => {
    const observedScreens = screens();
    const current = observedScreens.map(screen =>
      screen.id === MAIN_ID && screen.display !== undefined
        ? {...screen, display: {...screen.display, id: 3}}
        : screen,
    );
    const result = assignScreenMonitor({
      screens: current,
      screenId: STAGE_ID,
      monitor: projector,
      observedScreens,
    });
    expect(result[0]?.display?.id).toBe(3);
    expect(result[2]?.display?.id).toBe(2);
  });

  it('still clears unchanged fallback ownership after the document is cloned', () => {
    const observedScreens = screens().map(screen =>
      screen.id === MAIN_ID && screen.display !== undefined
        ? {...screen, display: {...screen.display, id: 99}}
        : screen,
    );
    const result = assignScreenMonitor({
      screens: structuredClone(observedScreens),
      screenId: STAGE_ID,
      monitor: projector,
      observedScreens,
    });
    expect(result[0]?.display).toBeUndefined();
  });
});
