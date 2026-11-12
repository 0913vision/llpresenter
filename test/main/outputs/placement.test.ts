import {describe, expect, it} from 'vitest';
import {monitorById, monitorsOf} from '@fixtures/main/displays/testing';
import {
  captureContentWithFrame,
  OUTPUT_WINDOW_SIZE,
  planPlacement,
} from '@main/outputs/placement';
import {fullScreenScreen} from '@fixtures/main/outputs/testing';

const monitors = monitorsOf({id: 1, primary: true}, {id: 2, x: 1920});
const controlMonitor = monitorById(monitors, 1);
const projector = monitorById(monitors, 2);
const saved = {
  id: projector.id,
  name: projector.name,
  bounds: projector.bounds,
};

describe('captureContentWithFrame', () => {
  it.each([
    {x: 67, y: 0, width: 1613, height: 1050},
    {x: 0, y: 0, width: 1920, height: 1080},
    {x: -2560, y: 0, width: 2560, height: 1440},
  ])('centers the entire framed window inside %o', area => {
    const outer = {x: 100, y: 100, width: 976, height: 579};
    const content = {x: 108, y: 131, width: 960, height: 540};
    const fitted = captureContentWithFrame(
      area,
      {width: 1920, height: 1080},
      {outer, content},
    );
    const actual = {
      x: fitted.x - 8,
      y: fitted.y - 31,
      width: fitted.width + 16,
      height: fitted.height + 39,
    };
    expect(actual.x).toBeGreaterThanOrEqual(area.x);
    expect(actual.y).toBeGreaterThanOrEqual(area.y);
    expect(actual.x + actual.width).toBeLessThanOrEqual(area.x + area.width);
    expect(actual.y + actual.height).toBeLessThanOrEqual(area.y + area.height);
    expect(
      Math.abs(actual.x + actual.width / 2 - (area.x + area.width / 2)),
    ).toBeLessThanOrEqual(0.5);
    expect(
      Math.abs(actual.y + actual.height / 2 - (area.y + area.height / 2)),
    ).toBeLessThanOrEqual(0.5);
    expect(fitted.width / fitted.height).toBeCloseTo(16 / 9, 2);
    if (area.width === 2560) {
      expect(fitted).toMatchObject({width: 1920, height: 1080});
    }
  });
});

describe('planPlacement', () => {
  it.each(['window', 'off'] as const)(
    'keeps control accessible regardless of disconnect action %s',
    onDisconnect => {
      const screen = fullScreenScreen({
        display: saved,
        onDisconnect,
        alwaysOnTop: true,
      });
      expect(
        planPlacement({screen, monitor: projector, controlMonitor: projector}),
      ).toEqual({
        kind: 'window',
        reason: 'controlConflict',
        bounds: {x: 2400, y: 250, ...OUTPUT_WINDOW_SIZE},
      });
      expect(
        planPlacement({screen, monitor: projector, controlMonitor}),
      ).toMatchObject({kind: 'fullscreen', bounds: projector.bounds});
      expect(screen.display).toEqual(saved);
    },
  );
  it('centers fallback bounds in a work area offset by a left taskbar', () => {
    const placement = planPlacement({
      screen: fullScreenScreen({display: saved}),
      monitor: null,
      controlMonitor: {
        ...controlMonitor,
        workArea: {x: 62, y: 0, width: 1858, height: 1080},
      },
    });
    expect(placement).toEqual({
      kind: 'window',
      reason: 'monitorMissing',
      bounds: {x: 511, y: 270, ...OUTPUT_WINDOW_SIZE},
    });
  });
  it.each(['fullscreen', 'window', 'capture'] as const)(
    'uses the method default and honors an explicit always-on-top choice for %s',
    method => {
      const placement = planPlacement({
        screen: {
          id: 'fixture',
          name: 'Fixture',
          method,
          display: null,
          onDisconnect: 'window',
        },
        monitor: projector,
        controlMonitor,
      });
      if (placement.kind === 'off') throw new Error('Missing placement');
      expect(placement.alwaysOnTop ?? false).toBe(false);
      const chosen = planPlacement({
        screen: fullScreenScreen({method, alwaysOnTop: true}),
        monitor: projector,
        controlMonitor,
      });
      if (chosen.kind === 'off') throw new Error('Missing placement');
      expect(chosen.alwaysOnTop).toBe(true);
      const fallback = planPlacement({
        screen: fullScreenScreen({alwaysOnTop: true}),
        monitor: null,
        controlMonitor,
      });
      expect(fallback).not.toHaveProperty('alwaysOnTop', true);
    },
  );

  it.each([
    [
      {x: 67, y: 0, width: 1613, height: 1050},
      {x: 67, y: 72, width: 1613, height: 907},
    ],
    [
      {x: 0, y: 0, width: 1920, height: 1080},
      {x: 0, y: 0, width: 1920, height: 1080},
    ],
    [
      {x: 0, y: 0, width: 1920, height: 1040},
      {x: 36, y: 0, width: 1848, height: 1040},
    ],
    [
      {x: 0, y: 0, width: 2560, height: 1440},
      {x: 320, y: 180, width: 1920, height: 1080},
    ],
  ])('fits and centers capture in %o', (workArea, bounds) => {
    expect(
      planPlacement({
        screen: fullScreenScreen({method: 'capture'}),
        monitor: null,
        controlMonitor: {...controlMonitor, workArea},
      }),
    ).toEqual({kind: 'capture', alwaysOnTop: true, bounds});
  });

  it('fits a custom capture resolution', () => {
    expect(
      planPlacement({
        screen: fullScreenScreen({
          method: 'capture',
          resolution: {width: 2560, height: 1440},
        }),
        monitor: null,
        controlMonitor: {
          ...controlMonitor,
          workArea: {x: 0, y: 0, width: 1920, height: 1080},
        },
      }),
    ).toMatchObject({bounds: {x: 0, y: 0, width: 1920, height: 1080}});
  });

  it('puts a full screen output over its whole monitor', () => {
    const placement = planPlacement({
      screen: fullScreenScreen({alwaysOnTop: false}),
      monitor: projector,
      controlMonitor,
    });
    expect(placement).toEqual({
      kind: 'fullscreen',
      bounds: {x: 1920, y: 0, width: 1920, height: 1080},
      alwaysOnTop: false,
    });
  });

  it('moves a full screen output into a window on the control monitor when its monitor is missing', () => {
    const placement = planPlacement({
      screen: fullScreenScreen({display: saved}),
      monitor: null,
      controlMonitor,
    });
    expect(placement).toEqual({
      kind: 'window',
      bounds: {x: 480, y: 250, ...OUTPUT_WINDOW_SIZE},
      reason: 'monitorMissing',
    });
  });

  it('opens a screen that never had a monitor as a window, not as a lost monitor', () => {
    for (const onDisconnect of ['window', 'off'] as const) {
      expect(
        planPlacement({
          screen: fullScreenScreen({display: null, onDisconnect}),
          monitor: null,
          controlMonitor,
        }),
      ).toMatchObject({kind: 'window', reason: 'method'});
    }
  });

  it('turns the output off when its monitor is missing and ?곌껐???딄린硫?says off', () => {
    const placement = planPlacement({
      screen: fullScreenScreen({display: saved, onDisconnect: 'off'}),
      monitor: null,
      controlMonitor,
    });
    expect(placement).toEqual({kind: 'off'});
  });

  it('shows a window-method output in a window even when it has a monitor', () => {
    const placement = planPlacement({
      screen: fullScreenScreen({method: 'window'}),
      monitor: projector,
      controlMonitor,
    });
    expect(placement).toMatchObject({kind: 'window', reason: 'method'});
  });
});
