import {describe, expect, it} from 'vitest';
import {monitorById, monitorsOf} from '../displays/testing';
import {OUTPUT_WINDOW_SIZE, planPlacement} from './placement';
import {fullScreenScreen} from './testing';

const monitors = monitorsOf({id: 1, primary: true}, {id: 2, x: 1920});
const controlMonitor = monitorById(monitors, 1);
const projector = monitorById(monitors, 2);

describe('planPlacement', () => {
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
