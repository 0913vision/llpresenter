import {describe, expect, it} from 'vitest';
import {monitorById, monitorsOf} from '../displays/testing';
import {OUTPUT_WINDOW_SIZE, planPlacement} from './placement';
import {fullScreenScreen} from './testing';

const monitors = monitorsOf({id: 1, primary: true}, {id: 2, x: 1920});
const controlMonitor = monitorById(monitors, 1);
const projector = monitorById(monitors, 2);

describe('planPlacement', () => {
  it('centers fallback bounds in a work area offset by a left taskbar', () => {
    const placement = planPlacement({
      screen: fullScreenScreen(),
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

  it('keeps capture content at its chosen resolution without requiring or reserving a monitor', () => {
    for (const resolution of [undefined, {width: 2560, height: 1440}]) {
      const placement = planPlacement({
        screen: fullScreenScreen({
          method: 'capture',
          alwaysOnTop: false,
          ...(resolution === undefined ? {} : {resolution}),
        }),
        monitor: null,
        controlMonitor,
      });
      expect(placement).toEqual({
        kind: 'capture',
        bounds: {x: 0, y: 0, ...(resolution ?? {width: 1920, height: 1080})},
      });
    }
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
      screen: fullScreenScreen(),
      monitor: null,
      controlMonitor,
    });
    expect(placement).toEqual({
      kind: 'window',
      bounds: {x: 480, y: 250, ...OUTPUT_WINDOW_SIZE},
      reason: 'monitorMissing',
    });
  });

  it('turns the output off when its monitor is missing and 연결이 끊기면 says off', () => {
    const placement = planPlacement({
      screen: fullScreenScreen({onDisconnect: 'off'}),
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
