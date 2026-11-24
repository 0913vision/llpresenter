import {expect, it} from 'vitest';
import type {MonitorInfo} from '@core/schema/screens/monitors';
import {monitorAssignment} from '@core/screens/monitorAssignment';

function monitor(number: number, screenIds: readonly string[]): MonitorInfo {
  return {
    number,
    name: `Monitor ${number}`,
    bounds: {x: (number - 1) * 1920, y: 0, width: 1920, height: 1080},
    scaleFactor: 1,
    refreshRate: 60,
    hasMainWindow: number === 1,
    screenIds: [...screenIds],
  };
}

it('names the monitor main placed each full screen output on, and none for a screen without one', () => {
  const control = monitor(1, []);
  const projector = monitor(2, ['main']);
  const stage = monitor(3, ['stage', 'lobby']);

  const assigned = monitorAssignment([control, projector, stage]);

  expect(assigned.get('main')).toBe(projector);
  expect(assigned.get('stage')).toBe(stage);
  expect(assigned.get('lobby')).toBe(stage);
  expect(assigned.has('broadcast')).toBe(false);
  expect(assigned.size).toBe(3);
});
