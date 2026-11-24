import {expect, it} from 'vitest';
import {parseWallClockSample} from '@core/schema/app/wallClock';
it('accepts finite wall and monotonic readings and a bounded timezone', () => {
  expect(
    parseWallClockSample({wall: 100, monotonic: 80, timeZone: 'Asia/Seoul'}).ok,
  ).toBe(true);
  expect(
    parseWallClockSample({wall: Infinity, monotonic: 80, timeZone: 'UTC'}).ok,
  ).toBe(false);
  expect(
    parseWallClockSample({wall: 100, monotonic: 80, timeZone: ''}).ok,
  ).toBe(false);
  expect(
    parseWallClockSample({wall: 100, monotonic: 80, timeZone: 'x'.repeat(129)})
      .ok,
  ).toBe(false);
});
