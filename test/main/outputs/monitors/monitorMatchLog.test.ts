import {expect, it} from 'vitest';
import {monitorById, monitorsOf} from '@fixtures/main/displays/testing';
import {monitorMatchDetail} from '@main/outputs/monitors/monitorMatchLog';

const MONITORS = monitorsOf({id: 1, primary: true}, {id: 2, x: 1920});
const SAVED = {
  id: 2,
  name: 'PJ',
  bounds: {x: 1920, y: 0, width: 1920, height: 1080},
};
const screen = {id: 'main', method: 'fullscreen' as const, display: SAVED};

it('names the monitor a screen got and the rule that matched it', () => {
  expect(
    monitorMatchDetail(screen, {
      monitor: monitorById(MONITORS, 2),
      controlMonitorId: 1,
      match: {rule: 'saved id', monitorId: 2},
    }),
  ).toEqual({screen: 'main', monitor: 2, rule: 'saved id'});
});

it('marks a screen that got the control window monitor, with the rule that would have matched', () => {
  expect(
    monitorMatchDetail(screen, {
      monitor: monitorById(MONITORS, 1),
      controlMonitorId: 1,
      match: {rule: 'identity', monitorId: 1},
    }),
  ).toEqual({
    screen: 'main',
    monitor: 1,
    rule: 'control conflict',
    matchedBy: 'identity',
  });
});

it('says why a screen got no monitor', () => {
  expect(
    monitorMatchDetail(screen, {
      monitor: undefined,
      controlMonitorId: 1,
      match: {reason: 'no candidate'},
    }),
  ).toMatchObject({monitor: 'unmatched', reason: 'no candidate'});
  expect(
    monitorMatchDetail(
      {...screen, display: null},
      {monitor: undefined, controlMonitorId: 1, match: undefined},
    ),
  ).toMatchObject({reason: 'not applicable'});
});
