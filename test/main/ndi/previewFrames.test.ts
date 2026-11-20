import {expect, it, vi} from 'vitest';
import {takeLatestFrame} from '../../../src/main/ndi/previewFrames.cjs';

it('releases older queued frames and returns the newest', () => {
  const frames = [1, 2, 3];
  const release = vi.fn();
  expect(takeLatestFrame(() => frames.shift() ?? null, release)).toBe(3);
  expect(release.mock.calls).toEqual([[1], [2]]);
});

it('bounds draining and releases the held frame when capture fails', () => {
  const frames = [1, 2, 3, 4];
  const release = vi.fn();
  expect(takeLatestFrame(() => frames.shift() ?? null, release, 3)).toBe(3);
  expect(frames).toEqual([4]);
  expect(release.mock.calls).toEqual([[1], [2]]);

  const next = vi
    .fn<() => number | null>()
    .mockReturnValueOnce(5)
    .mockImplementationOnce(() => {
      throw new Error('capture failed');
    });
  expect(() => takeLatestFrame(next, release)).toThrow('capture failed');
  expect(release).toHaveBeenLastCalledWith(5);
});

it('releases the new frame if releasing the previous frame fails', () => {
  const frames = [1, 2];
  const release = vi
    .fn<(frame: number) => void>()
    .mockImplementationOnce(() => {
      throw new Error('release failed');
    });
  expect(() => takeLatestFrame(() => frames.shift() ?? null, release)).toThrow(
    'release failed',
  );
  expect(release.mock.calls).toEqual([[1], [2]]);
});
