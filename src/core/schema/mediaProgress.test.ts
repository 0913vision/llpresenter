import {expect, it} from 'vitest';
import {parseMediaProgress} from './mediaProgress';

it('checks progress replies and pushes at the process boundary', () => {
  const reading = {
    mediaId: 'invented',
    startedAt: 0,
    positionSeconds: 12,
    durationSeconds: 54,
  };
  expect(parseMediaProgress(reading).ok).toBe(true);
  expect(parseMediaProgress(null).ok).toBe(true);
  expect(parseMediaProgress({...reading, durationSeconds: null}).ok).toBe(true);
  for (const patch of [
    {positionSeconds: -1},
    {positionSeconds: Infinity},
    {durationSeconds: 0},
    {durationSeconds: 10},
    {startedAt: NaN},
    {mediaId: ''},
  ]) {
    expect(parseMediaProgress({...reading, ...patch}).ok).toBe(false);
  }
});
