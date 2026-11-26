import {expect, it} from 'vitest';
import {fullScreenScreen} from '@fixtures/main/outputs/testing';
import {placementWithoutMonitors} from '@main/outputs/fallbackPlacement';

const AREA = {x: 0, y: 0, width: 1920, height: 1040};
const SAVED = {
  id: 2,
  name: 'EPSON PJ',
  bounds: {x: 1920, y: 0, width: 1920, height: 1080},
};

it('shows a full screen output whose monitor is gone as a window marked as missing its monitor', () => {
  expect(
    placementWithoutMonitors(fullScreenScreen({display: SAVED}), AREA),
  ).toMatchObject({kind: 'window', reason: 'monitorMissing'});
});

it('turns it off when 연결이 끊기면 says off', () => {
  expect(
    placementWithoutMonitors(
      fullScreenScreen({display: SAVED, onDisconnect: 'off'}),
      AREA,
    ),
  ).toEqual({kind: 'off'});
});

it('shows one without a monitor chosen, and a window output, as a plain window', () => {
  expect(placementWithoutMonitors(fullScreenScreen(), AREA)).toMatchObject({
    kind: 'window',
    reason: 'method',
  });
  expect(
    placementWithoutMonitors(
      fullScreenScreen({method: 'window', alwaysOnTop: true}),
      AREA,
    ),
  ).toMatchObject({kind: 'window', reason: 'method', alwaysOnTop: true});
});

it('keeps a capture window at its resolution, inside the control window', () => {
  const placement = placementWithoutMonitors(
    fullScreenScreen({
      method: 'capture',
      resolution: {width: 1280, height: 720},
      alwaysOnTop: false,
    }),
    AREA,
  );
  expect(placement.kind).toBe('capture');
  if (placement.kind !== 'capture') return;
  expect(placement.bounds.width / placement.bounds.height).toBeCloseTo(16 / 9);
  expect(placement.bounds.width).toBeLessThanOrEqual(AREA.width);
});
